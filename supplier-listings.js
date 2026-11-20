import { VARIANT_NAMES } from './parts.js';

// Exact SKU links checked against the Rancilio Group NA Silvia M store diagrams.
const rancilioParts = new Set([
  '10049063', '10060119', '10060190', '10070108R', '10705169', '10705636',
  '10705637', '10705638', '10705639', '10880188', '20103022D', '32330362',
  '32330363', '32330365', '32330369', '32330370', '32331989', '34011023',
  '34011026', '34030029', '34030038', '34030047', '34030144', '34040039',
  '34040053', '34200295', '34200296', '36301030', '36310008', '38120334',
  '38123011', '38228002', '40200005', '69000409',
]);

const retailerListings = {
  '10049063': { seller: '1st-line Equipment', url: 'https://www.1st-line.com/buy/rancilio-10049063/' },
  '10060406': { seller: 'Parts Town', url: 'https://www.partstown.com/rancilio/ra10060406' },
  '34011023': { seller: 'WebstaurantStore', url: 'https://www.webstaurantstore.com/rancilio-34011023-pump-120v-60hz/HP34011023.html' },
  '38120334': { seller: 'Seattle Coffee Gear', url: 'https://www.seattlecoffeegear.com/products/rancilio-silvia-water-tank' },
};

export function getSupplierListings(partNumber) {
  const listings = [];
  if (rancilioParts.has(partNumber)) {
    listings.push({ seller: 'Rancilio Group NA', url: `https://store.ranciliogroupna.com/${partNumber}` });
  }
  if (Object.hasOwn(retailerListings, partNumber)) listings.push(retailerListings[partNumber]);
  return { partNumber, variant: VARIANT_NAMES[partNumber], listings };
}
