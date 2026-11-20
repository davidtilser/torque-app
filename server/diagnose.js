import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { diagnoseSymptom } from '../diagnostics.js';

const defaultDataset = 'torque-pump-demo';
const cogneeDefaultOrigin = 'https://api.cognee.ai';
const seedFilename = 'torque-pump-troubleshooting-v1.txt';
const retrievalSession = 'torque-pump-diagnosis-v1';
const graphQuery = 'Two-group espresso machine with a loud motor during brewing and no water from either group head. Retrieve the troubleshooting note about shared water-flow faults, individual-group faults, and safe operator observations.';

const candidates = {
  'inlet-hose': {
    mention: /\b(?:inlet[-_ ]hose|feed[-_ ]line|inlet[-_ ]line)\b/i,
    title: 'Water supply or inlet restriction',
    description: 'A low tank, closed supply valve, or inlet restriction can starve the pump and make it sound louder.',
  },
  'water-pump': {
    mention: /\bwater[-_ ]pump\b/i,
    title: 'Possible water pump fault',
    description: 'If the supply is available and neither group flows, a technician can distinguish a pump fault from a restriction or air ingress.',
  },
  'solenoid-valve': {
    mention: /\b(?:solenoid[-_ ]valve|brew[-_ ]valve)\b/i,
    title: 'Possible brew valve restriction',
    description: 'A valve is more plausible if only one group is affected or water diverts into the drip tray during brewing.',
  },
};

const pumpChecks = [
  'Check the tank level or the visible external water supply. Stop brewing if the machine is out of water.',
  'Note whether one or both groups are affected and whether water is going into the drip tray during brewing.',
  'Have a qualified technician confirm the failing component before replacement.',
];

const completed = 'DATASET_PROCESSING_COMPLETED';
const processing = new Set(['DATASET_PROCESSING_INITIATED', 'DATASET_PROCESSING_STARTED']);

function diagnosisError(message) {
  return Object.assign(new Error(message), { diagnostic: message });
}

function cogneeOrigin(value) {
  let url;
  try {
    url = new URL(value || cogneeDefaultOrigin);
  } catch {
    throw diagnosisError('COGNEE_BASE_URL must be the HTTPS workspace URL from Cognee API Keys.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !/^\/(?:api\/v1\/?|)$/.test(url.pathname)) {
    throw diagnosisError('COGNEE_BASE_URL must be the HTTPS workspace URL from Cognee API Keys.');
  }
  return url.origin;
}

function providerHttpError(service, operation, status) {
  const instructions = {
    401: 'Check the API key and workspace configuration.',
    403: 'Check the API key and its permissions.',
    402: 'Check available API credits.',
    404: 'Check the workspace URL in COGNEE_BASE_URL and confirm the dataset was seeded.',
    429: 'The service is rate limited. Try again shortly.',
  };
  const hint = instructions[status];
  return diagnosisError(`${service} ${operation} failed (HTTP ${status}).${hint ? ` ${hint}` : ''}`);
}

async function requestJson(fetcher, service, operation, url, { headers, form, json, timeout = 14000 }) {
  let response;
  const signal = AbortSignal.timeout(timeout);
  try {
    response = await fetcher(url, {
      method: form || json ? 'POST' : 'GET',
      redirect: 'error',
      signal,
      headers: json ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body: form ?? (json ? JSON.stringify(json) : undefined),
    });
  } catch {
    throw diagnosisError(signal.aborted
      ? `${service} ${operation} timed out.`
      : `Could not reach ${service} to ${operation}. Check network and workspace settings.`);
  }
  if (!response.ok) throw providerHttpError(service, operation, response.status);
  try {
    return await response.json();
  } catch {
    throw diagnosisError(signal.aborted
      ? `${service} ${operation} timed out.`
      : `${service} returned an unreadable response while trying to ${operation}.`);
  }
}

function extractEvidence(results, datasetName) {
  if (!Array.isArray(results)) throw diagnosisError('Cognee search returned an unexpected result format.');
  return results
    .filter((result) => {
      const source = result?.dataset_name ?? result?.datasetName;
      return result && (!source || source === datasetName);
    })
    .map((result) => result.context_result ?? result.contextResult ?? result.search_result ?? result.searchResult)
    .map((value) => typeof value === 'string' ? value : JSON.stringify(value))
    .filter(Boolean)
    .join('\n')
    .slice(0, 12000);
}

function partsInEvidence(evidence) {
  return Object.keys(candidates).filter((id) => candidates[id].mention.test(evidence));
}

export function createLiveDiagnosis(env = process.env, { fetch: fetcher = globalThis.fetch, sleep = delay } = {}) {
  const workspace = () => cogneeOrigin(env.COGNEE_BASE_URL);
  const datasetName = env.COGNEE_DATASET?.trim() || defaultDataset;
  let seeding;

  function cognee(operation, path, options = {}) {
    const key = env.COGNEE_API_KEY?.trim();
    if (!key) throw diagnosisError('Set COGNEE_API_KEY in the server environment to use live pump diagnosis.');
    return requestJson(fetcher, 'Cognee', operation, `${workspace()}/api/v1/${path}`, {
      ...options,
      headers: { 'X-Api-Key': key },
    });
  }

  async function evidence(symptom) {
    const result = await cognee('search the pump knowledge graph', 'search', {
      json: {
        query: symptom ? `${graphQuery}\nTechnician's observation: ${symptom.trim()}` : graphQuery,
        datasets: [datasetName],
        searchType: 'HYBRID_COMPLETION',
        onlyContext: true,
        sessionId: retrievalSession,
        verbose: true,
        topK: 6,
      },
    });
    return extractEvidence(result, datasetName);
  }

  async function seedGraph() {
    const data = await readFile(new URL('./pump-knowledge.txt', import.meta.url));
    const digest = createHash('md5').update(data).digest('hex');
    const form = new FormData();
    form.append('datasetName', datasetName);
    form.append('data', new Blob([data], { type: 'text/plain' }), seedFilename);
    form.append('run_in_background', 'false');

    // Cognee treats an identical re-upload as a no-op. The filename is versioned
    // so a later seed revision can use a new dataset without replacing user data.
    const upload = await cognee('add pump knowledge', 'add', { form });
    const datasetId = upload?.dataset_id ?? upload?.datasetId;
    if (typeof datasetId !== 'string' || !datasetId) throw diagnosisError('Cognee did not return a dataset ID.');
    const datasetPath = `datasets/${encodeURIComponent(datasetId)}`;
    const matchingItems = await cognee('verify the uploaded seed', `${datasetPath}/data?${new URLSearchParams({ content_hash: digest, limit: '1' })}`);
    const itemId = matchingItems?.[0]?.id;
    if (!itemId) throw diagnosisError('Cognee did not retain the uploaded pump knowledge.');

    async function seedItemReady() {
      const status = await cognee('check seed item processing', `${datasetPath}/processing-status`);
      return Array.isArray(status?.items) && status.items.some((item) => item.id === itemId && item.completed === true);
    }

    async function datasetStatus() {
      const status = await cognee('check graph processing', `datasets/status?${new URLSearchParams({ dataset: datasetId })}`);
      return status?.[datasetId];
    }

    if (!await seedItemReady()) {
      if (!processing.has(await datasetStatus())) {
        await cognee('start pump graph processing', 'cognify', {
          json: { datasetIds: [datasetId], runInBackground: true },
        });
      }

      const deadline = Date.now() + 120000;
      let ready = false;
      do {
        const status = await datasetStatus();
        if (status === 'DATASET_PROCESSING_ERRORED') throw diagnosisError('Cognee failed to build the pump knowledge graph.');
        ready = status === completed && await seedItemReady();
        if (!ready) await sleep(1600);
      } while (!ready && Date.now() < deadline);
      if (!ready) throw diagnosisError('Cognee pump knowledge is still processing. Run the seed command again to check.');
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const partIds = partsInEvidence(await evidence());
      if (partIds.length === Object.keys(candidates).length) return { dataset: datasetName, datasetId, partIds };
      if (attempt < 4) await sleep(1200);
    }
    throw diagnosisError('Cognee built the dataset but search did not return all three pump components.');
  }

  function seed() {
    seeding ??= seedGraph().finally(() => { seeding = undefined; });
    return seeding;
  }

  async function diagnose(symptom) {
    const mock = diagnoseSymptom(symptom);
    if (!mock.causes.some((cause) => cause.partIds.includes('water-pump'))) {
      return { ...mock, source: 'mock' };
    }

    const partIds = partsInEvidence(await evidence(symptom));
    if (!partIds.includes('water-pump')) {
      throw diagnosisError('Cognee did not return the pump component. Seed and verify the pump dataset before using live diagnosis.');
    }

    return {
      source: 'live',
      status: 'matched',
      summary: 'Check the water path before choosing a replacement.',
      clarification: null,
      causes: partIds.map((id) => ({
        title: candidates[id].title,
        description: candidates[id].description,
        partIds: [id],
      })),
      checks: [...pumpChecks],
    };
  }

  return { seed, diagnose };
}
