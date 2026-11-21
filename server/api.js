import { diagnoseSymptom } from '../diagnostics.js';
import { PART_BY_ID } from '../parts.js';
import { createSandboxOrder, getCatalog, getOffers, isValidZip } from '../offers.js';
import { getDemoConfig } from './config.js';
import { createLiveDiagnosis } from './diagnose.js';
import { PersonaError, createPersonaSessions } from './persona.js';
import { createPartsStore } from './singlestore.js';

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

function requireCatalog(partId, variant) {
  const catalog = getCatalog(partId, variant);
  if (!catalog) {
    throw new ApiError(400, partId === pumpKey
      ? 'Select the voltage and frequency from the machine nameplate.'
      : 'Choose a Silvia M component and a matching catalog part number.');
  }
  return catalog;
}

function readApproval(body) {
  const { approved, offerId, requestId, zip, partId = pumpKey, variant, expectedQuote, diagnosisSource = null, inquiryId } = body;
  if (approved !== true) throw new ApiError(400, 'Approve the sandbox order to continue.');
  const catalog = requireCatalog(partId, variant);
  if (
    typeof offerId !== 'string' ||
    !offerId ||
    typeof requestId !== 'string' ||
    !requestIdPattern.test(requestId) ||
    !isValidZip(zip) ||
    ![null, 'live', 'mock'].includes(diagnosisSource) ||
    typeof expectedQuote?.partNumber !== 'string' ||
    !Number.isFinite(expectedQuote.total) ||
    !Number.isInteger(expectedQuote.deliveryDays) ||
    (inquiryId !== undefined && !/^inq_[a-z0-9]+$/i.test(inquiryId))
  ) {
    throw new ApiError(400, 'Review an offer with a valid ZIP before approving.');
  }
  if (expectedQuote.partNumber !== catalog.partNumber) {
    throw new ApiError(409, 'Review an offer for the selected catalog part.');
  }
  return { offerId, zip: zip.trim(), requestId, partId, variant, expectedQuote, diagnosisSource, inquiryId };
}

function matchesQuote(offer, quote) {
  return offer.partNumber === quote.partNumber && offer.total === quote.total && offer.deliveryDays === quote.deliveryDays;
}

function handleMockApproval(input, mockOrders) {
  const { offerId, zip, requestId, partId, variant, expectedQuote, diagnosisSource } = input;
  const existing = mockOrders.get(requestId);
  if (existing) {
    if (existing.offerId !== offerId || existing.partId !== partId || existing.order.zip !== zip ||
      existing.order.diagnosisSource !== diagnosisSource ||
      !matchesQuote(existing.offer, expectedQuote)) {
      throw new ApiError(409, 'This approval was already used for a different quote.');
    }
    return existing.order;
  }

  const offer = getOffers(zip, 'fastest', partId, variant).find((candidate) => candidate.id === offerId);
  if (!offer?.compatible) throw new ApiError(409, 'Choose a compatible replacement before ordering.');
  if (!matchesQuote(offer, expectedQuote)) throw new ApiError(409, 'The quote changed. Review the current offer before approving.');
  const order = {
    ...createSandboxOrder(offer, zip, partId, variant),
    diagnosisSource,
    fitReason: offer.fitReason,
    rejectedReason: getCatalog(partId, variant).mismatch,
  };
  mockOrders.set(requestId, { offerId, offer, order, partId });
  return order;
}

export function createDemoApi(env, factories = { createLiveDiagnosis, createPartsStore }) {
  const { mode, missing } = getDemoConfig(env);
  const isLive = mode === 'live';
  const mockOrders = new Map();
  let diagnosis;
  let store;
  let personaSessions;

  function assertConfigured() {
    if (missing.length) throw new ApiError(503, `Configure the live demo in .env.local. Missing: ${missing.join(', ')}.`);
  }

  function getDiagnosis() {
    if (!env.COGNEE_API_KEY?.trim()) throw new ApiError(503, 'Set COGNEE_API_KEY in .env.local to query the Silvia M catalog.');
    diagnosis ??= factories.createLiveDiagnosis(env);
    return diagnosis;
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

        upstream = 'Cognee';
        sendJson(res, 200, await getDiagnosis().diagnose(symptom));
        return;
      }

      if (route === 'GET /part-evidence') {
        const part = url.searchParams.get('part');
        if (!Object.hasOwn(PART_BY_ID, part)) throw new ApiError(404, 'Unknown Silvia M component.');
        if (!isLive) {
          sendJson(res, 200, { partId: part, partNumbers: [], source: 'catalog' });
          return;
        }
        upstream = 'Cognee';
        sendJson(res, 200, { ...await getDiagnosis().lookupPart(part), source: 'cognee' });
        return;
      }

      if (route === 'GET /offers') {
        const zip = url.searchParams.get('zip');
        const priority = url.searchParams.get('priority') ?? 'fastest';
        const partId = url.searchParams.get('part') ?? pumpKey;
        const variant = url.searchParams.get('variant') ?? undefined;
        requireCatalog(partId, variant);
        if (!isValidZip(zip)) throw new ApiError(400, 'Enter a valid five-digit ZIP code.');
        if (!priorities.has(priority)) throw new ApiError(400, 'Choose a supported ranking priority.');
        assertConfigured();
        upstream = 'SingleStore';
        if (isLive) store ??= factories.createPartsStore(env);
        const offers = isLive ? await store.getOffers(zip, priority, partId, variant) : getOffers(zip, priority, partId, variant);
        sendJson(res, 200, { offers, source: isLive ? 'singlestore' : 'mock' });
        return;
      }

      if (route === 'POST /verification' || route === 'GET /verification') {
        if (!isLive) throw new ApiError(404, 'Persona checks run in live mode only.');
        upstream = 'Persona';
        personaSessions ??= createPersonaSessions(env);
        if (req.method === 'POST') {
          const { requestId } = await readBody(req);
          if (typeof requestId !== 'string' || !requestIdPattern.test(requestId)) throw new ApiError(400, 'Review an offer before verifying.');
          sendJson(res, 200, await personaSessions.start(requestId));
        } else {
          sendJson(res, 200, { status: await personaSessions.status(url.searchParams.get('id')) });
        }
        return;
      }

      if (route === 'POST /orders') {
        const input = readApproval(await readBody(req));
        assertConfigured();
        upstream = 'SingleStore';
        if (isLive) store ??= factories.createPartsStore(env);
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
