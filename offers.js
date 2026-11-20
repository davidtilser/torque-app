const DEMO_ZIP = '94105';
const SEAL_PART_NUMBER = 'ES-54-GS';

// Sellers, part numbers, prices, and availability are fictional demo data.
const sealOffers = [
  {
    id: 'barista-supply',
    seller: 'Barista Supply Co.',
    title: '54 mm silicone group-head seal',
    partNumber: SEAL_PART_NUMBER,
    diameter: 54,
    spec: '54 mm',
    priceCents: 1490,
    shippingCents: 495,
    rating: 4.8,
    reviewCount: 326,
    deliveryDays: 1,
  },
  {
    id: 'brew-parts',
    seller: 'BrewParts Direct',
    title: '54 mm silicone group-head seal',
    partNumber: SEAL_PART_NUMBER,
    diameter: 54,
    spec: '54 mm',
    priceCents: 1250,
    shippingCents: 195,
    rating: 4.6,
    reviewCount: 184,
    deliveryDays: 4,
  },
  {
    id: 'espresso-depot',
    seller: 'Espresso Depot',
    title: '58 mm silicone group-head seal',
    partNumber: 'ES-58-GS',
    diameter: 58,
    spec: '58 mm',
    priceCents: 990,
    shippingCents: 295,
    rating: 4.9,
    reviewCount: 521,
    deliveryDays: 1,
  },
];

const internalParts = {
  'steam-boiler': {
    title: 'Steam boiler assembly',
    partNumber: 'ES-SB-180-230',
    spec: '1.8 L · 230 V',
    alternatePartNumber: 'ES-SB-180-120',
    alternateSpec: '1.8 L · 120 V',
    mismatch: 'The heater in this assembly is rated for 120 V. The machine requires a 230 V assembly.',
    prices: [28900, 24900, 20900],
    shipping: [1795, 1295, 1495],
    deliveryDays: [2, 5, 1],
  },
  'brew-boiler': {
    title: 'Brew boiler assembly',
    partNumber: 'ES-BB-065-230',
    spec: '0.65 L · 230 V',
    alternatePartNumber: 'ES-BB-045-230',
    alternateSpec: '0.45 L · 230 V',
    mismatch: 'The 0.45 L boiler uses a different mounting bracket. This machine calls for the 0.65 L assembly.',
    prices: [23400, 19900, 17900],
    shipping: [1495, 995, 1195],
    deliveryDays: [2, 5, 2],
  },
  'water-pump': {
    title: 'Rotary water pump',
    partNumber: 'ES-WP-070-230',
    spec: '70 L/h · 230 V',
    alternatePartNumber: 'ES-WP-070-120',
    alternateSpec: '70 L/h · 120 V',
    mismatch: 'The flow rate matches, but the 120 V motor is incompatible with the 230 V machine.',
    prices: [13900, 11900, 9900],
    shipping: [995, 695, 795],
    deliveryDays: [1, 4, 1],
  },
  'solenoid-valve': {
    title: 'Solenoid valve assembly',
    partNumber: 'ES-SV-3W-230',
    spec: '3-way · 230 V',
    alternatePartNumber: 'ES-SV-2W-230',
    alternateSpec: '2-way · 230 V',
    mismatch: 'The 2-way valve lacks the drain port used by the machine’s 3-way valve.',
    prices: [5490, 4190, 3390],
    shipping: [695, 395, 495],
    deliveryDays: [1, 4, 2],
  },
  'control-board': {
    title: 'Main control board',
    partNumber: 'ES-CB-DG-R3',
    spec: '2-group · Rev 3',
    alternatePartNumber: 'ES-CB-DG-R2',
    alternateSpec: '2-group · Rev 2',
    mismatch: 'The Rev 2 board has a different connector layout. This machine uses the Rev 3 wiring harness.',
    prices: [25900, 22900, 17900],
    shipping: [1295, 795, 995],
    deliveryDays: [2, 6, 1],
  },
  'pressure-switch': {
    title: 'Boiler pressure switch',
    partNumber: 'ES-PS-12-G14',
    spec: '0.5–1.2 bar · G ¼',
    alternatePartNumber: 'ES-PS-12-G18',
    alternateSpec: '0.5–1.2 bar · G ⅛',
    mismatch: 'The pressure range matches, but the G ⅛ connection will not fit the G ¼ boiler port.',
    prices: [4590, 3590, 2890],
    shipping: [595, 395, 495],
    deliveryDays: [1, 4, 1],
  },
  'inlet-hose': {
    title: 'Braided inlet hose',
    partNumber: 'ES-IH-38-060',
    spec: 'G ⅜ · 60 cm',
    alternatePartNumber: 'ES-IH-14-060',
    alternateSpec: 'G ¼ · 60 cm',
    mismatch: 'The hose is the right length, but its G ¼ fitting is too small for the G ⅜ inlet.',
    prices: [2490, 1790, 1290],
    shipping: [495, 395, 395],
    deliveryDays: [1, 3, 2],
  },
  'heating-element': {
    title: 'Boiler heating element',
    partNumber: 'ES-HE-1600-230',
    spec: '1,600 W · 230 V · 2-bolt',
    alternatePartNumber: 'ES-HE-1600-120',
    alternateSpec: '1,600 W · 120 V · 2-bolt',
    mismatch: 'The flange matches, but this 120 V element is incompatible with the machine’s 230 V supply.',
    prices: [7690, 6290, 4990],
    shipping: [795, 595, 595],
    deliveryDays: [1, 5, 1],
  },
};

const sellers = sealOffers.map(({ id, seller, rating, reviewCount }) => ({ id, seller, rating, reviewCount }));

export function getCatalog(offerKey) {
  if (offerKey === 'seal') {
    return {
      partNumber: SEAL_PART_NUMBER,
      mismatch: 'This seal is 58 mm. The selected machine requires a 54 mm seal.',
      listings: sealOffers,
    };
  }
  if (!Object.hasOwn(internalParts, offerKey)) return null;

  const part = internalParts[offerKey];
  const listings = sellers.map((seller, index) => ({
    ...seller,
    id: `${offerKey}-${seller.id}`,
    title: part.title,
    partNumber: index < 2 ? part.partNumber : part.alternatePartNumber,
    spec: index < 2 ? part.spec : part.alternateSpec,
    priceCents: part.prices[index],
    shippingCents: part.shipping[index],
    deliveryDays: part.deliveryDays[index],
  }));
  return { partNumber: part.partNumber, mismatch: part.mismatch, listings };
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
        ? `Matches part ${catalog.partNumber} in the demo parts catalog.`
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

export function getOffers(zip = DEMO_ZIP, urgency = 'fastest', offerKey = 'seal') {
  return quoteCatalog(getCatalog(offerKey), zip, urgency);
}

export function createSandboxOrder(offer, zip, offerKey = 'seal') {
  if (!isValidZip(zip)) throw new Error('Enter a five-digit ZIP code.');

  const selectedOffer = getOffers(zip, 'fastest', offerKey).find((listing) => listing.id === offer?.id);
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
