import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import singlestore from 'singlestore-nodejs/promise';
import { getCatalog, isPumpVariant, isValidZip, pumpListings, quoteCatalog } from '../offers.js';
import { createPersonaVerifier } from './persona.js';

const pumpKey = 'water-pump';
const pumpListingIds = pumpListings.map(({ id }) => id);
const catalogPlaceholders = pumpListingIds.map(() => '?').join(', ');

const catalogColumns = `
  offer_id AS id, seller, title, part_number AS partNumber, spec,
  price_cents AS priceCents, shipping_cents AS shippingCents, rating,
  review_count AS reviewCount, base_delivery_days AS deliveryDays
`;

function storeError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function openPool(env) {
  const { SINGLESTORE_HOST: host, SINGLESTORE_USER: user, SINGLESTORE_PASSWORD: password,
    SINGLESTORE_DATABASE: database, SINGLESTORE_PORT, SINGLESTORE_CA_PATH } = env;
  if (!host || !user || !password || !database) {
    throw storeError(503, 'SingleStore is missing connection settings.');
  }
  const port = Number(SINGLESTORE_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw storeError(503, 'The configured SingleStore port is invalid.');
  }

  const ssl = { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' };
  if (SINGLESTORE_CA_PATH) {
    try {
      ssl.ca = readFileSync(SINGLESTORE_CA_PATH);
    } catch {
      throw storeError(503, 'The configured SingleStore CA file could not be read.');
    }
  }

  return singlestore.createPool({
    host, port, user, password, database, ssl,
    connectionLimit: 4,
    queueLimit: 20,
    connectTimeout: 6000,
    charset: 'UTF8MB4_UNICODE_CI',
  });
}

function sameQuote(quote, actual) {
  return quote.partNumber === actual.partNumber && quote.total === actual.total && quote.deliveryDays === actual.deliveryDays;
}

function receipt(row) {
  return {
    id: row.order_id,
    seller: row.seller,
    title: row.title,
    partNumber: row.part_number,
    total: row.total_cents / 100,
    zip: row.zip,
    deliveryLabel: row.delivery_label,
    status: 'confirmed',
    placedAt: row.placed_at,
    fitReason: row.fit_reason,
    rejectedReason: row.rejected_reason,
    diagnosisSource: row.diagnosis_source,
    personaStatus: row.persona_status,
  };
}

export function createPumpStore(env, { pool = openPool(env), verifyTechnician = createPersonaVerifier(env) } = {}) {
  let initialization;

  async function initialize() {
    await pool.query(`
      CREATE ROWSTORE TABLE IF NOT EXISTS torque_pump_offers (
        offer_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
        seller VARCHAR(120) NOT NULL,
        title VARCHAR(120) NOT NULL,
        part_number VARCHAR(48) NOT NULL,
        spec VARCHAR(120) NOT NULL,
        price_cents INT UNSIGNED NOT NULL,
        shipping_cents INT UNSIGNED NOT NULL,
        rating DECIMAL(3,2) NOT NULL,
        review_count INT UNSIGNED NOT NULL,
        base_delivery_days INT UNSIGNED NOT NULL
      )
    `);
    await pool.query(`
      CREATE ROWSTORE TABLE IF NOT EXISTS torque_pump_orders (
        request_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
        order_id VARCHAR(40) NOT NULL,
        offer_id VARCHAR(64) NOT NULL,
        seller VARCHAR(120) NOT NULL,
        title VARCHAR(120) NOT NULL,
        part_number VARCHAR(48) NOT NULL,
        total_cents INT UNSIGNED NOT NULL,
        zip CHAR(5) NOT NULL,
        delivery_days INT UNSIGNED NOT NULL,
        delivery_label VARCHAR(32) NOT NULL,
        fit_reason VARCHAR(255) NOT NULL,
        rejected_reason VARCHAR(255),
        diagnosis_source VARCHAR(10),
        persona_status VARCHAR(16),
        placed_at VARCHAR(24) NOT NULL
      )
    `);

    const [personaColumn] = await pool.query(`SHOW COLUMNS FROM torque_pump_orders LIKE 'persona\\_status'`);
    if (personaColumn.length === 0) {
      try {
        await pool.query('ALTER TABLE torque_pump_orders ADD COLUMN persona_status VARCHAR(16)');
      } catch (error) {
        if (error.errno !== 1060 && error.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }

    for (const listing of pumpListings) {
      await pool.execute(`
        INSERT IGNORE INTO torque_pump_offers
          (offer_id, seller, title, part_number, spec, price_cents,
           shipping_cents, rating, review_count, base_delivery_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        listing.id, listing.seller, listing.title, listing.partNumber, listing.spec,
        listing.priceCents, listing.shippingCents, listing.rating, listing.reviewCount, listing.deliveryDays,
      ]);
    }
  }

  function seed() {
    initialization ??= initialize().catch((error) => {
      initialization = undefined;
      throw error;
    });
    return initialization;
  }

  function quotes(listings, zip, priority, catalog) {
    return quoteCatalog({
      ...catalog,
      listings: listings.map((listing) => ({ ...listing, rating: Number(listing.rating) })),
    }, zip, priority);
  }

  async function getOffers(zip, priority, variant) {
    if (!isValidZip(zip)) throw storeError(400, 'Enter a five-digit ZIP code.');
    if (!isPumpVariant(variant)) throw storeError(400, 'Choose a Silvia M nameplate variant.');
    await seed();
    const [listings] = await pool.execute(
      `SELECT ${catalogColumns} FROM torque_pump_offers WHERE offer_id IN (${catalogPlaceholders})`, pumpListingIds,
    );
    return quotes(listings, zip, priority, getCatalog(pumpKey, variant));
  }

  async function readOrder(requestId, offerId, zip, expectedQuote, diagnosisSource) {
    const [[row]] = await pool.execute(`
      SELECT * FROM torque_pump_orders WHERE request_id = ?
    `, [requestId]);
    if (!row) return null;

    const order = receipt(row);
    if (row.offer_id !== offerId || order.zip !== zip || order.diagnosisSource !== diagnosisSource ||
      !sameQuote(expectedQuote, { ...order, deliveryDays: row.delivery_days })) {
      throw storeError(409, 'This approval ID already belongs to another quote.');
    }
    return order;
  }

  async function createOrder({ offerId, zip, requestId, variant, expectedQuote, diagnosisSource = null }) {
    if (!isValidZip(zip)) throw storeError(400, 'Enter a five-digit ZIP code.');
    if (typeof offerId !== 'string' || !/^[a-z\d_-]{1,64}$/i.test(offerId)) {
      throw storeError(400, 'Choose a replacement pump offer.');
    }
    if (typeof requestId !== 'string' || !/^[a-z\d_-]{1,128}$/i.test(requestId)) {
      throw storeError(400, 'A valid approval request ID is required.');
    }
    if (!expectedQuote || typeof expectedQuote.partNumber !== 'string' ||
      !Number.isFinite(expectedQuote.total) || !Number.isInteger(expectedQuote.deliveryDays)) {
      throw storeError(400, 'Review the pump quote before approving.');
    }

    const catalog = getCatalog(pumpKey, variant);
    if (!catalog) throw storeError(400, 'Choose a Silvia M nameplate variant.');
    if (!pumpListingIds.includes(offerId) || expectedQuote.partNumber !== catalog.partNumber) {
      throw storeError(409, 'This pump offer does not match the selected Silvia M nameplate.');
    }

    const deliveryZip = zip.trim();
    await seed();
    const existing = await readOrder(requestId, offerId, deliveryZip, expectedQuote, diagnosisSource);
    if (existing) return existing;

    const [listings] = await pool.execute(`SELECT ${catalogColumns} FROM torque_pump_offers WHERE offer_id = ?`, [offerId]);
    const [offer] = quotes(listings, deliveryZip, 'fastest', catalog);
    if (!offer?.compatible) throw storeError(409, 'This pump offer does not fit the machine.');
    if (!sameQuote(expectedQuote, offer)) throw storeError(409, 'This quote has changed. Review the current pump offer before approving.');

    const personaStatus = await verifyTechnician();

    const orderId = `SBX-${randomUUID().slice(0, 8).toUpperCase()}`;
    const placedAt = new Date().toISOString();
    const totalCents = Math.round(offer.total * 100);
    let quoteChanged = false;
    try {
      const [insert] = await pool.execute(`
        INSERT INTO torque_pump_orders
          (request_id, order_id, offer_id, seller, title, part_number,
           total_cents, zip, delivery_days, delivery_label, fit_reason, rejected_reason, diagnosis_source, persona_status, placed_at)
        SELECT ?, ?, offer_id, seller, title, part_number, price_cents + shipping_cents, ?, ?, ?, ?, ?, ?, ?, ?
        FROM torque_pump_offers
        WHERE offer_id = ? AND part_number = ? AND price_cents + shipping_cents = ? AND base_delivery_days = ?
      `, [
        requestId, orderId, deliveryZip, offer.deliveryDays, offer.deliveryLabel,
        offer.fitReason, catalog.mismatch, diagnosisSource, personaStatus, placedAt,
        offer.id, offer.partNumber, totalCents, listings[0].deliveryDays,
      ]);
      quoteChanged = insert.affectedRows === 0;
    } catch (error) {
      if (error.errno !== 1062 && error.code !== 'ER_DUP_ENTRY') throw error;
    }

    const stored = await readOrder(requestId, offerId, deliveryZip, expectedQuote, diagnosisSource);
    if (stored) return stored;
    if (quoteChanged) throw storeError(409, 'This quote has changed. Review the current pump offer before approving.');
    throw storeError(503, 'Could not confirm the saved sandbox order.');
  }

  return { seed, getOffers, createOrder, close: () => pool.end() };
}
