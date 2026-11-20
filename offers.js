import { PARTS, PART_BY_ID, VARIANT_NAMES } from './parts.js';

const DEMO_ZIP = '94105';
export const PUMP_VARIANTS = {
  '120v-60hz': { partNumber: '34011023', spec: '120 V / 60 Hz' },
  '230v-50hz': { partNumber: '34011026', spec: '220–230 V / 50 Hz' },
};

export function isPumpVariant(variant) {
  return typeof variant === 'string' && Object.hasOwn(PUMP_VARIANTS, variant);
}

const sellers = [
  { id: 'barista-supply', seller: 'Barista Supply Co.', rating: 4.8, reviewCount: 326 },
  { id: 'brew-parts', seller: 'BrewParts Direct', rating: 4.6, reviewCount: 184 },
];

// Seller names, prices, reviews, and delivery estimates are demo fixtures.
export const pumpListings = Object.entries(PUMP_VARIANTS).flatMap(([variant, part]) =>
  sellers.map((seller, index) => ({
    ...seller,
    ...part,
    id: `silvia-m-pump-${variant}-${seller.id}`,
    title: 'Silvia M water pump',
    priceCents: [13900, 11900][index] - (variant === '230v-50hz' ? 2000 : 0),
    shippingCents: [995, 695][index],
    deliveryDays: [1, 4][index],
  })),
);

const demoPrices = {
  '10049063': 4990, '10060119': 5990, '10060190': 2290, '10060406': 3190,
  '10070108R': 7890, '10705169': 8990, '10705636': 16990, '10705637': 15990,
  '10705638': 6490, '10705639': 6190, '10880188': 7990, '20103022D': 9990,
  '32330362': 9890, '32330363': 4990, '32330365': 2690, '32330369': 3290,
  '32330370': 3890, '32331989': 6990, '34030029': 1990, '34030038': 1990,
  '34030047': 2290, '34030144': 2990, '34040039': 6890, '34040053': 6690,
  '34200295': 1890, '34200296': 1890, '36301030': 1490, '36310008': 590,
  '38120334': 3990, '38123011': 1290, '38228002': 2490, '40200005': 1590,
  '69000409': 1890,
};

const listingNames = {
  ...VARIANT_NAMES,
  '32330362': 'Stainless steel housing assembly',
  '36310008': 'Silvia support foot',
};

const fixtureOverrides = {
  '36301030': { lowerPrice: 1250, shipping: [495, 195] },
  '38228002': { spec: 'Silicone · 9 × 6 × 560 mm', lowerPrice: 1790, shipping: [495, 395] },
};

function componentOffers(part) {
  return part.partNumbers.flatMap((partNumber) => {
    const price = demoPrices[partNumber];
    const { spec = `Rancilio catalog · p. ${part.page}`, shipping = [695, 395], lowerPrice = Math.round(price * 0.82) } =
      fixtureOverrides[partNumber] ?? {};
    const name = listingNames[partNumber] ?? part.name;
    return sellers.map((seller, index) => ({
      ...seller,
      id: `silvia-m-${part.id}-${partNumber}-${seller.id}`,
      title: name,
      partNumber,
      spec,
      priceCents: index === 0 ? price : lowerPrice,
      shippingCents: shipping[index],
      deliveryDays: [1, 4][index],
    }));
  });
}

const listingsByPart = new Map(PARTS.map((part) => [
  part.id, part.id === 'water-pump' ? pumpListings : componentOffers(part),
]));
export const catalogListings = [...listingsByPart.values()].flat();

export function getCatalog(partId, variant) {
  if (typeof partId !== 'string' || !Object.hasOwn(PART_BY_ID, partId)) return null;
  const part = PART_BY_ID[partId];
  if (partId === 'water-pump') {
    if (!isPumpVariant(variant)) return null;
    const { partNumber, spec } = PUMP_VARIANTS[variant];
    return {
      partNumber,
      mismatch: `This pump’s voltage or frequency differs from the selected ${spec} nameplate.`,
      fitReason: `Matches Rancilio Silvia M part ${partNumber} for the selected ${spec} nameplate (catalog p. 9).`,
      listings: pumpListings,
    };
  }

  const partNumber = variant ?? (part.partNumbers.length === 1 ? part.partNumbers[0] : null);
  if (!part.partNumbers.includes(partNumber)) return null;
  return {
    partNumber,
    listings: listingsByPart.get(partId),
    fitReason: `Matches Rancilio Silvia M part ${partNumber} (catalog p. ${part.page}).`,
    mismatch: part.partNumbers.length > 1 ? `This listing is a different catalog item from the selected part ${partNumber}.` : null,
  };
}

const byDelivery = (left, right) => left.deliveryDays - right.deliveryDays;
const byTotal = (left, right) => left.total - right.total;
const byReviews = (left, right) => right.rating - left.rating || right.reviewCount - left.reviewCount;

export function isValidZip(zip) {
  return typeof zip === 'string' && /^\d{5}$/.test(zip.trim());
}

function deliveryAdjustment(zip) {
  if (zip.startsWith('94')) return 0;
  if (/^[89]/.test(zip)) return 1;
  if (/^[4-7]/.test(zip)) return 2;
  return 3;
}

export function quoteCatalog(catalog, zip, urgency = 'fastest') {
  if (!catalog || !isValidZip(zip)) return [];

  const deliveryZip = zip.trim();
  const extraDays = deliveryAdjustment(deliveryZip);
  const offers = catalog.listings.map(({ priceCents, shippingCents, ...listing }) => {
    const deliveryDays = listing.deliveryDays + extraDays;
    const compatible = listing.partNumber === catalog.partNumber;

    return {
      ...listing,
      compatible,
      price: priceCents / 100,
      shipping: shippingCents / 100,
      total: (priceCents + shippingCents) / 100,
      deliveryZip,
      deliveryDays,
      deliveryLabel: deliveryDays === 1 ? 'Tomorrow' : `In ${deliveryDays} days`,
      fitReason: compatible
        ? (catalog.fitReason ?? `Matches Rancilio Silvia M part ${catalog.partNumber} in the spare parts catalog.`)
        : catalog.mismatch,
    };
  });

  const compare = ['lowest-price', 'price', 'budget'].includes(urgency)
    ? (left, right) => byTotal(left, right) || byDelivery(left, right) || byReviews(left, right)
    : ['top-rated', 'reviews'].includes(urgency)
      ? (left, right) => byReviews(left, right) || byDelivery(left, right) || byTotal(left, right)
      : (left, right) => byDelivery(left, right) || byTotal(left, right) || byReviews(left, right);

  offers.sort((left, right) => Number(right.compatible) - Number(left.compatible) || compare(left, right));
  return offers.map((offer, index) => ({ ...offer, recommended: index === 0 && offer.compatible }));
}

export function getOffers(zip = DEMO_ZIP, urgency = 'fastest', partId = 'seal', variant) {
  return quoteCatalog(getCatalog(partId, variant), zip, urgency);
}

export function createSandboxOrder(offer, zip, partId = 'seal', variant) {
  if (!isValidZip(zip)) throw new Error('Enter a five-digit ZIP code.');

  const selectedOffer = getOffers(zip, 'fastest', partId, variant).find((listing) => listing.id === offer?.id);
  if (!selectedOffer?.compatible) throw new Error('Choose a compatible replacement before ordering.');
  if (
    offer.partNumber !== selectedOffer.partNumber ||
    offer.total !== selectedOffer.total ||
    offer.deliveryZip !== selectedOffer.deliveryZip ||
    offer.deliveryDays !== selectedOffer.deliveryDays
  ) {
    throw new Error('This quote has changed. Review the current offer before approving.');
  }

  return {
    id: `SBX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    seller: selectedOffer.seller,
    title: selectedOffer.title,
    partNumber: selectedOffer.partNumber,
    total: selectedOffer.total,
    zip: selectedOffer.deliveryZip,
    deliveryLabel: selectedOffer.deliveryLabel,
    status: 'confirmed',
    placedAt: new Date().toISOString(),
  };
}
