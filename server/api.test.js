import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { catalogListings, getCatalog, PUMP_VARIANTS, pumpListings } from '../offers.js';
import { PARTS } from '../parts.js';
import { createSilviaModel } from '../silvia-model.js';
import { getSupplierListings } from '../supplier-listings.js';
import { createDemoApi } from './api.js';
import { requiredLiveCredentials } from './config.js';
import { createLiveDiagnosis } from './diagnose.js';
import { createPersonaVerifier } from './persona.js';
import { createPartsStore } from './singlestore.js';

const symptom = 'The pump makes a loud noise, but no water comes out of the group head.';
const zip = '94105';
const variant = '120v-60hz';
const catalogUrl = `/offers?zip=${zip}&variant=${variant}`;

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
    variant,
    requestId: randomUUID(),
    expectedQuote: { partNumber: offer.partNumber, total: offer.total, deliveryDays: offer.deliveryDays },
  };
}

test('mock pump flow requires approval and rejects incompatible or stale quotes', async () => {
  const api = createDemoApi({});
  const { data: diagnosis } = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(diagnosis.source, 'mock');
  assert(diagnosis.causes.some((cause) => cause.partIds.includes('water-pump')));
  const { data } = await request(api, 'GET', catalogUrl);
  assert.equal(data.source, 'mock');
  const [best, , incompatible] = data.offers;
  assert.equal(best.partNumber, '34011023');
  assert.equal(incompatible.partNumber, '34011026');
  assert.equal(incompatible.compatible, false);
  assert.equal((await request(api, 'GET', `/offers?zip=${zip}`)).status, 400);
  const alternate = await request(api, 'GET', `/offers?zip=${zip}&variant=230v-50hz`);
  assert.equal(alternate.data.offers[0].partNumber, '34011026');
  assert.equal(alternate.data.offers.find((offer) => offer.partNumber === '34011023').compatible, false);

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
  const listings = catalogListings;
  const pool = {
    async query() { return [[{ Field: 'persona_status' }]]; },
    async execute(sql, params) {
      if (sql.includes('INSERT IGNORE INTO torque_pump_offers')) {
        assert.equal(params.length, 10 * listings.length);
        return [{ affectedRows: 0 }];
      }
      if (sql.includes('FROM torque_pump_orders')) return [saved?.request_id === params[0] ? [saved] : []];
      if (sql.includes('INSERT INTO torque_pump_orders')) {
        calls.push('SingleStore sandbox write');
        const [requestId, orderId, zip, deliveryDays, delivery, fit, rejected, diagnosis, persona, placed, paymentRef, supplierStatus, offerId, partNumber, totalCents] = params;
        saved = {
          request_id: requestId, order_id: orderId, offer_id: offerId, zip,
          delivery_days: deliveryDays, delivery_label: delivery, fit_reason: fit, rejected_reason: rejected,
          diagnosis_source: diagnosis, persona_status: persona, placed_at: placed,
          payment_ref: paymentRef, supplier_status: supplierStatus,
          part_number: partNumber, total_cents: totalCents,
        };
        return [{ affectedRows: 1 }];
      }
      assert(sql.includes('FROM torque_pump_offers'));
      if (!sql.includes(' IN (')) return [listings.filter(({ id }) => id === params[0])];
      assert(params.every((id) => listings.some((listing) => listing.id === id)));
      calls.push('SingleStore read');
      return [params.map((id) => listings.find((listing) => listing.id === id))];
    },
  };
  const api = createDemoApi(env, {
    createLiveDiagnosis: (config) => createLiveDiagnosis(config, {
      fetch: async (url, { body }) => {
        assert.equal(url, 'https://api.cognee.ai/api/v1/search');
        const payload = JSON.parse(body);
        assert(payload.query.includes('Silvia M'));
        assert.deepEqual(payload.datasets, ['default_dataset']);
        calls.push('Cognee');
        return Response.json([
          { dataset_name: 'default_dataset', context_result: '34011023 34011026 38228002' },
          { dataset_name: 'another-dataset', context_result: '34040039' },
        ]);
      },
    }),
    createPartsStore: (config) => createPartsStore(config, {
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
  assert.match(diagnosis.checks.at(-1), /confirm the faulty part/);
  const { data: reference } = await request(api, 'GET', '/part-evidence?part=water-pump');
  assert.deepEqual(reference, { partId: 'water-pump', partNumbers: ['34011023', '34011026'], source: 'cognee' });
  const { data: catalog } = await request(api, 'GET', catalogUrl);
  assert.equal(catalog.source, 'singlestore');
  assert.equal(catalog.offers[2].compatible, false);
  assert.deepEqual(new Set(catalog.offers.map(({ id }) => id)), new Set(pumpListings.map(({ id }) => id)));
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
  assert.deepEqual(calls, ['Cognee', 'Cognee', 'Cognee', 'Cognee', 'SingleStore read', 'Persona Sandbox', 'Persona Sandbox', 'SingleStore sandbox write']);
});

test('the agent can submit a non-pump part order and rejects a mismatched variant', async () => {
  const api = createDemoApi({});
  const { data: catalog } = await request(api, 'GET', `/offers?zip=${zip}&part=water-tank`);
  assert.equal(catalog.offers[0].partNumber, '38120334');
  const orderInput = { ...approval(catalog.offers[0]), partId: 'water-tank', variant: undefined };
  const first = await request(api, 'POST', '/orders', orderInput);
  assert.equal(first.status, 200);
  assert.equal(first.data.partNumber, '38120334');
  assert.match(first.data.fitReason, /38120334/);
  assert.equal((await request(api, 'POST', '/orders', orderInput)).data.id, first.data.id);

  assert.equal((await request(api, 'GET', `/offers?zip=${zip}&part=heating-element`)).status, 400);
  const { data: heater } = await request(api, 'GET', `/offers?zip=${zip}&part=heating-element&variant=10705638`);
  const invalid = heater.offers.find(({ partNumber }) => partNumber === '10705639');
  assert.equal(invalid.compatible, false);
  const denial = await request(api, 'POST', '/orders', {
    ...approval(invalid), partId: 'heating-element', variant: '10705638',
  });
  assert.equal(denial.status, 409);
});

test('live mode with missing credentials surfaces configuration without calling a sponsor', async () => {
  const denied = () => { throw new Error('Sponsor factory should not be called.'); };
  const api = createDemoApi({ TORQUE_MODE: 'live' }, { createLiveDiagnosis: denied, createPartsStore: denied });
  const health = await request(api, 'GET', '/status');
  assert.deepEqual(health.data, { mode: 'live', configured: false });
  const failed = await request(api, 'POST', '/diagnose', { symptom });
  assert.equal(failed.status, 503);
  assert.match(failed.data.error, /COGNEE_API_KEY/);
});

test('every Silvia M component has a pickable mesh, catalog reference, and supplier listing', () => {
  const { group } = createSilviaModel();
  const tagged = new Set();
  group.traverse((object) => {
    if (object.isMesh) tagged.add(object.userData.partId);
  });
  assert.deepEqual(tagged, new Set(PARTS.map(({ id }) => id)));
  assert(PARTS.every(({ page, partNumbers }) => [5, 7, 9].includes(page) && partNumbers.length));
  for (const { id, partNumbers } of PARTS) {
    for (const partNumber of partNumbers) {
      const selector = partNumbers.length === 1 ? undefined : partNumber;
      const variant = id === 'water-pump'
        ? Object.keys(PUMP_VARIANTS).find((key) => PUMP_VARIANTS[key].partNumber === partNumber)
        : selector;
      const offers = getCatalog(id, variant)?.listings.filter((offer) => offer.partNumber === partNumber);
      assert.equal(offers?.length, 2);
      assert(offers.every(({ priceCents }) => Number.isInteger(priceCents) && priceCents > 0));
      const { listings } = getSupplierListings(partNumber);
      assert(listings.length, `Missing a supplier listing for ${partNumber}`);
      assert(listings.every(({ url }) => new URL(url).protocol === 'https:'));
    }
  }
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
