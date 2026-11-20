import { diagnoseSymptom } from '../diagnostics.js';
import { PART_BY_ID } from '../parts.js';

const catalogTitle = 'Rancilio Silvia M spare parts catalogue RLCSILVIAM v.22';
const pumpParts = ['inlet-hose', 'water-pump', 'solenoid-valve'];

function diagnosisError(message) {
  return Object.assign(new Error(message), { diagnostic: message });
}

function cogneeOrigin(value) {
  let url;
  try {
    url = new URL(value || 'https://api.cognee.ai');
  } catch {
    throw diagnosisError('COGNEE_BASE_URL must be the HTTPS workspace URL from Cognee API Keys.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    !/^\/(?:api\/v1\/?|)$/.test(url.pathname)) {
    throw diagnosisError('COGNEE_BASE_URL must be the HTTPS workspace URL from Cognee API Keys.');
  }
  return url.origin;
}

function extractEvidence(results, dataset) {
  if (!Array.isArray(results)) throw diagnosisError('Cognee returned an unexpected catalog result.');
  return results
    .filter((result) => result && (result.dataset_name ?? result.datasetName ?? dataset) === dataset)
    .map((result) => result.context_result ?? result.contextResult ?? result.text_result ?? result.search_result)
    .map((value) => typeof value === 'string' ? value : JSON.stringify(value ?? ''))
    .join('\n');
}

function matchingNumbers(part, evidence) {
  return part.partNumbers.filter((number) => new RegExp(`\\b${number}\\b`, 'i').test(evidence));
}

export function createLiveDiagnosis(env = process.env, { fetch: fetcher = globalThis.fetch } = {}) {
  const dataset = env.COGNEE_DATASET?.trim() || 'default_dataset';

  async function search(query) {
    const key = env.COGNEE_API_KEY?.trim();
    if (!key) throw diagnosisError('Set COGNEE_API_KEY to query the Silvia M catalog.');
    const url = `${cogneeOrigin(env.COGNEE_BASE_URL)}/api/v1/search`;
    const signal = AbortSignal.timeout(14000);
    let response;
    try {
      response = await fetcher(url, {
        method: 'POST',
        redirect: 'error',
        signal,
        headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query, datasets: [dataset], searchType: 'CHUNKS', onlyContext: true, verbose: true, topK: 6,
        }),
      });
    } catch {
      throw diagnosisError(signal.aborted ? 'Cognee catalog search timed out.' : 'Could not reach Cognee to search the catalog.');
    }
    if (!response.ok) throw diagnosisError(`Cognee catalog search failed (HTTP ${response.status}). Check the workspace key and catalog dataset.`);
    const results = await response.json().catch(() => null);
    return extractEvidence(results, dataset);
  }

  async function lookupPart(id) {
    const part = PART_BY_ID[id];
    const evidence = await search(`${catalogTitle}. ${part.name}, page ${part.page}, parts ${part.partNumbers.join(' ')}.`);
    return { partId: id, partNumbers: matchingNumbers(part, evidence) };
  }

  async function seed() {
    const evidence = await search(`${catalogTitle}. Hydraulic system 14002/15: pump position 23, 34011023 and 34011026, and reservoir hose 38228002. Brewing group 14003/08: three-way valve 34040039.`);
    const pump = PART_BY_ID['water-pump'];
    if (matchingNumbers(pump, evidence).length !== pump.partNumbers.length) {
      throw diagnosisError('Cognee did not return both Silvia M pump variants. Set COGNEE_DATASET to the dataset containing the catalog PDF.');
    }
    const partIds = pumpParts.filter((id) => matchingNumbers(PART_BY_ID[id], evidence).length);
    return { dataset, partIds };
  }

  async function diagnose(symptom) {
    const result = diagnoseSymptom(symptom);
    if (!result.causes.some(({ partIds }) => partIds.includes('water-pump'))) {
      return { ...result, source: 'mock' };
    }

    const { partIds } = await seed();
    return {
      source: 'live',
      status: 'matched',
      summary: 'Check the water path before choosing a replacement.',
      clarification: null,
      causes: partIds.map((id) => ({
        title: PART_BY_ID[id].name,
        description: {
          'inlet-hose': 'A low reservoir or a restricted hose can starve the pump and make it sound louder.',
          'water-pump': 'If the reservoir is full and the brew group still has no flow, the pump is a candidate for inspection.',
          'solenoid-valve': 'If water runs into the drip tray during brewing, have the three-way valve checked.',
        }[id],
        partIds: [id],
      })),
      checks: [
        ...result.checks,
        'Have a qualified technician confirm the faulty part before replacement.',
      ],
    };
  }

  return { seed, diagnose, lookupPart };
}
