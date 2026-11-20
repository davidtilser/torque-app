import { diagnoseSymptom } from '../diagnostics.js';
import { createSandboxOrder, getOffers, isValidZip } from '../offers.js';
import { getDemoConfig } from './config.js';
import { createLiveDiagnosis } from './diagnose.js';
import { PersonaError } from './persona.js';
import { createPumpStore } from './singlestore.js';

const pumpKey = 'water-pump';
const priorities = new Set(['fastest', 'lowest-price', 'top-rated']);
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new ApiError(415, 'Send this request as JSON.');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > 8192) throw new ApiError(413, 'This request is too large.');
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to the same error for malformed and non-object JSON.
  }
  throw new ApiError(400, 'Send a valid JSON object.');
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readApproval(body) {
  const { approved, offerId, requestId, zip, expectedQuote, diagnosisSource = null } = body;
  if (approved !== true) throw new ApiError(400, 'Approve the sandbox order to continue.');
  if (
    typeof offerId !== 'string' ||
    !offerId ||
    typeof requestId !== 'string' ||
    !requestIdPattern.test(requestId) ||
    !isValidZip(zip) ||
    ![null, 'live', 'mock'].includes(diagnosisSource) ||
    typeof expectedQuote?.partNumber !== 'string' ||
    !Number.isFinite(expectedQuote.total) ||
    !Number.isInteger(expectedQuote.deliveryDays)
  ) {
    throw new ApiError(400, 'Review an offer with a valid ZIP before approving.');
  }
  return { offerId, zip: zip.trim(), requestId, expectedQuote, diagnosisSource };
}

function matchesQuote(offer, quote) {
  return offer.partNumber === quote.partNumber && offer.total === quote.total && offer.deliveryDays === quote.deliveryDays;
}

function handleMockApproval(input, mockOrders) {
  const { offerId, zip, requestId, expectedQuote, diagnosisSource } = input;
  const existing = mockOrders.get(requestId);
  if (existing) {
    if (existing.offerId !== offerId || existing.order.zip !== zip || existing.order.diagnosisSource !== diagnosisSource ||
      !matchesQuote(existing.offer, expectedQuote)) {
      throw new ApiError(409, 'This approval was already used for a different quote.');
    }
    return existing.order;
  }

  const offer = getOffers(zip, 'fastest', pumpKey).find((candidate) => candidate.id === offerId);
  if (!offer?.compatible) throw new ApiError(409, 'Choose a compatible pump before ordering.');
  if (!matchesQuote(offer, expectedQuote)) throw new ApiError(409, 'The quote changed. Review the current offer before approving.');
  const order = { ...createSandboxOrder(offer, zip, pumpKey), diagnosisSource };
  mockOrders.set(requestId, { offerId, offer, order });
  return order;
}

export function createDemoApi(env, factories = { createLiveDiagnosis, createPumpStore }) {
  const { mode, missing } = getDemoConfig(env);
  const isLive = mode === 'live';
  const mockOrders = new Map();
  let diagnosis;
  let store;

  function assertConfigured() {
    if (missing.length) throw new ApiError(503, `Configure the live demo in .env.local. Missing: ${missing.join(', ')}.`);
  }

  return async (req, res) => {
    let upstream = 'Torque’s demo server';
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const route = `${req.method} ${url.pathname}`;

      if (route === 'GET /status') {
        sendJson(res, 200, { mode, configured: missing.length === 0 });
        return;
      }

      if (route === 'POST /diagnose') {
        const { symptom } = await readBody(req);
        if (typeof symptom !== 'string' || !symptom.trim() || symptom.length > 1000) {
          throw new ApiError(400, 'Describe the symptom in 1–1,000 characters.');
        }
        if (!isLive) {
          sendJson(res, 200, { ...diagnoseSymptom(symptom), source: 'mock' });
          return;
        }

        assertConfigured();
        upstream = 'Cognee';
        diagnosis ??= factories.createLiveDiagnosis(env);
        sendJson(res, 200, await diagnosis.diagnose(symptom));
        return;
      }

      if (route === 'GET /offers') {
        const zip = url.searchParams.get('zip');
        const priority = url.searchParams.get('priority') ?? 'fastest';
        if (!isValidZip(zip)) throw new ApiError(400, 'Enter a valid five-digit ZIP code.');
        if (!priorities.has(priority)) throw new ApiError(400, 'Choose a supported ranking priority.');
        assertConfigured();
        upstream = 'SingleStore';
        if (isLive) store ??= factories.createPumpStore(env);
        const offers = isLive ? await store.getOffers(zip, priority) : getOffers(zip, priority, pumpKey);
        sendJson(res, 200, { offers, source: isLive ? 'singlestore' : 'mock' });
        return;
      }

      if (route === 'POST /orders') {
        const input = readApproval(await readBody(req));
        assertConfigured();
        upstream = 'SingleStore';
        if (isLive) store ??= factories.createPumpStore(env);
        const order = isLive ? await store.createOrder(input) : handleMockApproval(input, mockOrders);
        sendJson(res, 200, { ...order, source: isLive ? 'singlestore' : 'mock' });
        return;
      }

      throw new ApiError(404, 'This Torque demo route does not exist.');
    } catch (error) {
      if (error instanceof PersonaError) {
        sendJson(res, error.statusCode, { error: error.message });
        return;
      }
      const status = error instanceof ApiError || [400, 409, 503].includes(error.statusCode) ? error.statusCode : 502;
      const message = status === 502 ? `${upstream} could not complete this request. Check the local terminal for details.` : error.message;
      if (status === 502) {
        console.error(`[torque] ${upstream} request failed`, error.diagnostic ?? error.code ?? error.name);
      }
      sendJson(res, status, { error: message });
    }
  };
}
