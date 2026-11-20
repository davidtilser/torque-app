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

const catalogParts = {
  seal: {
    title: 'Silvia M group head gasket',
    partNumber: '36301030',
    spec: 'Rancilio catalog · p. 7',
    prices: [1490, 1250],
    shipping: [495, 195],
  },
  'inlet-hose': {
    title: 'Silvia M reservoir hose',
    partNumber: '38228002',
    spec: 'Silicone · 9 × 6 × 560 mm',
    prices: [2490, 1790],
    shipping: [495, 395],
  },
};

export function getCatalog(offerKey, variant) {
  if (offerKey === 'water-pump') {
    if (!isPumpVariant(variant)) return null;
    const { partNumber, spec } = PUMP_VARIANTS[variant];
    return {
      partNumber,
      mismatch: `This pump’s voltage or frequency differs from the selected ${spec} nameplate.`,
      fitReason: `Matches Rancilio Silvia M part ${partNumber} for the selected ${spec} nameplate (catalog p. 9).`,
      listings: pumpListings,
    };
  }
  if (!Object.hasOwn(catalogParts, offerKey)) return null;

  const { title, partNumber, spec, prices, shipping } = catalogParts[offerKey];
  return {
    partNumber,
    listings: sellers.map((seller, index) => ({
      ...seller,
      id: `silvia-m-${offerKey}-${seller.id}`,
      title, partNumber, spec,
      priceCents: prices[index],
      shippingCents: shipping[index],
      deliveryDays: [1, 4][index],
    })),
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

export function getOffers(zip = DEMO_ZIP, urgency = 'fastest', offerKey = 'seal', variant) {
  return quoteCatalog(getCatalog(offerKey, variant), zip, urgency);
}

export function createSandboxOrder(offer, zip, offerKey = 'seal', variant) {
  if (!isValidZip(zip)) throw new Error('Enter a five-digit ZIP code.');

  const selectedOffer = getOffers(zip, 'fastest', offerKey, variant).find((listing) => listing.id === offer?.id);
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
