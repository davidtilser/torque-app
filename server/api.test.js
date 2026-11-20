import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { createSandboxOrder, getOffers } from '../offers.js';
import { createDemoApi } from './api.js';
import { requiredLiveCredentials } from './config.js';
import { createLiveDiagnosis } from './diagnose.js';

const symptom = 'The pump makes a loud noise, but no water comes out of either group head.';
const zip = '94105';

async function request(api, method, url, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { method, url, headers: { 'content-type': 'application/json' } });
  const response = {
    setHeader() {},
    end(data) { this.data = JSON.parse(data); },
  };
  await api(req, response);
  return { status: response.statusCode, data: response.data };
}

function approval(offer) {
  return {
    approved: true,
    offerId: offer.id,
    zip,
    requestId: randomUUID(),
    expectedQuote: { partNumber: offer.partNumber, total: offer.total, deliveryDays: offer.deliveryDays },
  };
}

test('mock pump flow requires approval and rejects incompatible or stale quotes', async () => {
  const api = createDemoApi({});
  const { data: diagnosis } = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(diagnosis.source, 'mock');
  assert(diagnosis.causes.some((cause) => cause.partIds.includes('water-pump')));
  const { data } = await request(api, 'GET', `/offers?zip=${zip}`);
  assert.equal(data.source, 'mock');
  const [best, , incompatible] = data.offers;

  const purchase = approval(best);
  assert.equal((await request(api, 'POST', '/orders', { ...purchase, approved: false })).status, 400);
  assert.equal((await request(api, 'POST', '/orders', approval(incompatible))).status, 409);
  assert.equal((await request(api, 'POST', '/orders', { ...purchase, expectedQuote: { ...purchase.expectedQuote, total: 1 } })).status, 409);

  const first = await request(api, 'POST', '/orders', purchase);
  const replay = await request(api, 'POST', '/orders', purchase);
  assert.equal(first.status, 200);
  assert.equal(first.data.status, 'confirmed');
  assert.equal(first.data.partNumber, best.partNumber);
  assert.equal(first.data.id, replay.data.id);
});

test('live mode connects graph and model results to the SingleStore adapter', async () => {
  const calls = [];
  const env = {
    ...Object.fromEntries(requiredLiveCredentials.map((key) => [key, 'fixture'])),
    TORQUE_MODE: 'live',
  };
  const api = createDemoApi(env, {
    createLiveDiagnosis: (config) => createLiveDiagnosis(config, {
      fetch: async (url) => {
        if (new URL(url).hostname.endsWith('cognee.ai')) {
          calls.push('Cognee');
          return Response.json([{ context_result: 'A water-pump or inlet-hose issue can affect both groups.' }]);
        }
        calls.push('Arcee');
        return Response.json({ choices: [{ message: { content: '{"partIds":["water-pump","unverified-part"],"checkIds":["check-supply"]}' } }] });
      },
    }),
    createPumpStore: () => ({
      getOffers(requestedZip, priority) {
        calls.push('SingleStore read');
        return getOffers(requestedZip, priority, 'water-pump');
      },
      createOrder(input) {
        calls.push('SingleStore sandbox write');
        assert.equal(input.diagnosisSource, 'live');
        const offer = getOffers(input.zip, 'fastest', 'water-pump').find(({ id }) => id === input.offerId);
        return createSandboxOrder(offer, input.zip, 'water-pump');
      },
    }),
  });

  const { data: diagnosis } = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(diagnosis.source, 'live');
  assert.deepEqual(diagnosis.causes.flatMap((cause) => cause.partIds), ['water-pump', 'inlet-hose']);
  const { data: catalog } = await request(api, 'GET', `/offers?zip=${zip}`);
  assert.equal(catalog.source, 'singlestore');
  assert.equal(catalog.offers[2].compatible, false);
  const { data: order } = await request(api, 'POST', '/orders', {
    ...approval(catalog.offers[0]), diagnosisSource: diagnosis.source,
  });
  assert.equal(order.source, 'singlestore');
  assert.equal(order.status, 'confirmed');
  assert.deepEqual(calls, ['Cognee', 'Arcee', 'SingleStore read', 'SingleStore sandbox write']);
});

test('live mode with missing credentials surfaces configuration without calling a sponsor', async () => {
  const denied = () => { throw new Error('Sponsor factory should not be called.'); };
  const api = createDemoApi({ TORQUE_MODE: 'live' }, { createLiveDiagnosis: denied, createPumpStore: denied });
  const health = await request(api, 'GET', '/status');
  assert.deepEqual(health.data, { mode: 'live', configured: false });
  const failed = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(failed.status, 503);
  assert.match(failed.data.error, /ARCEE_API_KEY/);
});
