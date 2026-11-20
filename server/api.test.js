import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { getCatalog } from '../offers.js';
import { createDemoApi } from './api.js';
import { requiredLiveCredentials } from './config.js';
import { createLiveDiagnosis } from './diagnose.js';
import { createPersonaVerifier } from './persona.js';
import { createPumpStore } from './singlestore.js';

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

test('live checkout requires Persona approval and persists it with the sandbox order', async () => {
  const calls = [];
  const env = {
    ...Object.fromEntries(requiredLiveCredentials.map((key) => [key, 'fixture'])),
    TORQUE_MODE: 'live',
    PERSONA_API_KEY: 'persona_sandbox_fixture',
    PERSONA_INQUIRY_ID: 'inq_testTechnician',
  };
  let personaStatus = 'completed';
  let saved;
  const { listings } = getCatalog('water-pump');
  const pool = {
    async query() { return [[{ Field: 'persona_status' }]]; },
    async execute(sql, params) {
      if (sql.includes('INSERT IGNORE INTO torque_pump_offers')) return [{ affectedRows: 0 }];
      if (sql.includes('FROM torque_pump_orders')) return [saved?.request_id === params[0] ? [saved] : []];
      if (sql.includes('INSERT INTO torque_pump_orders')) {
        calls.push('SingleStore sandbox write');
        const [requestId, orderId, zip, deliveryDays, delivery, fit, rejected, diagnosis, persona, placed, offerId, partNumber, totalCents] = params;
        saved = {
          request_id: requestId, order_id: orderId, offer_id: offerId, zip,
          delivery_days: deliveryDays, delivery_label: delivery, fit_reason: fit, rejected_reason: rejected,
          diagnosis_source: diagnosis, persona_status: persona, placed_at: placed,
          part_number: partNumber, total_cents: totalCents,
        };
        return [{ affectedRows: 1 }];
      }
      assert(sql.includes('FROM torque_pump_offers'));
      if (params) return [listings.filter(({ id }) => id === params[0])];
      calls.push('SingleStore read');
      return [listings];
    },
  };
  const api = createDemoApi(env, {
    createLiveDiagnosis: (config) => createLiveDiagnosis(config, {
      fetch: async (url, { body }) => {
        assert.equal(url, 'https://api.cognee.ai/api/v1/search');
        assert(JSON.parse(body).query.includes(symptom));
        calls.push('Cognee');
        return Response.json([
          { dataset_name: 'torque-pump-demo', context_result: 'A water-pump or inlet-hose issue can affect both groups.' },
          { dataset_name: 'another-dataset', context_result: 'The solenoid-valve is stuck.' },
        ]);
      },
    }),
    createPumpStore: (config) => createPumpStore(config, {
      pool,
      verifyTechnician: createPersonaVerifier(config, { fetch: async (url, { headers, redirect }) => {
        assert.equal(url.origin, 'https://api.withpersona.com');
        assert.equal(url.pathname, `/api/v1/inquiries/${env.PERSONA_INQUIRY_ID}`);
        assert.equal(url.searchParams.get('fields[inquiry]'), 'status');
        assert.equal(headers.Authorization, `Bearer ${env.PERSONA_API_KEY}`);
        assert.equal(redirect, 'error');
        calls.push('Persona Sandbox');
        return Response.json({ data: { id: env.PERSONA_INQUIRY_ID, type: 'inquiry', attributes: { status: personaStatus } } });
      } }),
    }),
  });

  const { data: diagnosis } = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(diagnosis.source, 'live');
  assert.deepEqual(diagnosis.causes.flatMap((cause) => cause.partIds), ['inlet-hose', 'water-pump']);
  assert.match(diagnosis.checks.at(-1), /confirm the failing component/);
  const { data: catalog } = await request(api, 'GET', `/offers?zip=${zip}`);
  assert.equal(catalog.source, 'singlestore');
  assert.equal(catalog.offers[2].compatible, false);
  const purchase = { ...approval(catalog.offers[0]), diagnosisSource: diagnosis.source };
  assert.equal((await request(api, 'POST', '/orders', { ...purchase, approved: false })).status, 400);
  assert.equal((await request(api, 'POST', '/orders', approval(catalog.offers[2]))).status, 409);
  const denied = await request(api, 'POST', '/orders', { ...purchase, personaStatus: 'approved' });
  assert.equal(denied.status, 403);
  assert.equal(saved, undefined);

  personaStatus = 'approved';
  const { data: order } = await request(api, 'POST', '/orders', purchase);
  assert.equal(order.source, 'singlestore');
  assert.equal(order.status, 'confirmed');
  assert.equal(order.diagnosisSource, 'live');
  assert.equal(order.personaStatus, 'approved');
  assert.equal(saved.persona_status, 'approved');

  personaStatus = 'declined';
  const replay = await request(api, 'POST', '/orders', purchase);
  assert.deepEqual(replay.data, order);
  assert.deepEqual(calls, ['Cognee', 'SingleStore read', 'Persona Sandbox', 'Persona Sandbox', 'SingleStore sandbox write']);
});

test('live mode with missing credentials surfaces configuration without calling a sponsor', async () => {
  const denied = () => { throw new Error('Sponsor factory should not be called.'); };
  const api = createDemoApi({ TORQUE_MODE: 'live' }, { createLiveDiagnosis: denied, createPumpStore: denied });
  const health = await request(api, 'GET', '/status');
  assert.deepEqual(health.data, { mode: 'live', configured: false });
  const failed = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(failed.status, 503);
  assert.match(failed.data.error, /COGNEE_API_KEY/);
});

test('Persona rejects production credentials before contacting the provider', async () => {
  let requested = false;
  const verify = createPersonaVerifier({
    PERSONA_API_KEY: 'persona_production_fixture',
    PERSONA_INQUIRY_ID: 'inq_testTechnician',
  }, { fetch: async () => { requested = true; } });
  await assert.rejects(verify, { statusCode: 503 });
  assert.equal(requested, false);
});
