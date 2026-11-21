import QRCode from 'qrcode';
import { isPumpVariant, isValidZip, PUMP_VARIANTS } from './offers.js';
import { demoRequest } from './demo-api.js';
import { PARTS, PART_BY_ID, REMOVABLE_PARTS, VARIANT_NAMES } from './parts.js';
import { mountViewer } from './viewer.js';
import { getSupplierListings } from './supplier-listings.js';

const icons = {
  brand: '<path d="M5.4 5h15l-1.8 4.1h-4.7L10 19H5.6l3.8-9.9H3.9z" fill="currentColor" stroke="none"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  box: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18m-12 4h6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10M7.5 4.5l9 5"/>',
  reset: '<path d="M4 11a8 8 0 1 1 1.6 5M4 5v6h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  cover: '<path d="M4 11v8h16v-8M3 7l15-4 1 4-15 4zM9 15h6"/>',
  cursor: '<path d="m5 3 14 10-6 1-2 6z"/>',
  ring: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
  shopping: '<path d="M4 7h16l2 13H2zM8 9V6a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
  sliders: '<path d="M4 7h4m4 0h8M4 17h10m4 0h2"/><circle cx="10" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  shield: '<path d="m12 2 8 4v5c0 5-3 8-8 11-5-3-8-6-8-11V6z"/><path d="m9 12 2 2 4-4"/>',
  external: '<path d="M13 4h7v7m0-7-9 9m-1-8H5v14h14v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  truck: '<path d="M3 5h11v12H3zm11 5h4l3 3v4h-7"/><circle cx="7" cy="18" r="2" fill="currentColor" stroke="none"/><circle cx="18" cy="18" r="2" fill="currentColor" stroke="none"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
};

const graphic = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => escaped[character]);
document.querySelectorAll('[data-icon]').forEach((element) => {
  element.innerHTML = graphic(element.dataset.icon);
});

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const zipInput = document.querySelector('#zip');
const priorityInput = document.querySelector('#priority');
const deliveryForm = document.querySelector('#delivery-form');
const locationStatus = document.querySelector('#location-status');
const applyLocation = document.querySelector('#apply-location');
const componentSelect = document.querySelector('#component-select');
const selectionStatus = document.querySelector('#selection-status');
const content = document.querySelector('#sourcing-content');
const supplierListings = document.querySelector('#supplier-listings');
const partReference = document.querySelector('#part-reference');
const nameplateField = document.querySelector('#nameplate-field');
const nameplateInput = document.querySelector('#nameplate');
const replacementField = document.querySelector('#replacement-field');
const replacementInput = document.querySelector('#replacement');
const dialog = document.querySelector('#checkout');
const expandedButton = document.querySelector('#expanded');
const coverButton = document.querySelector('#machine-cover');
const coverLabel = document.querySelector('#machine-cover-label');
const toolTabs = [...document.querySelectorAll('.tool-tab')];
const symptomForm = document.querySelector('#symptom-form');
const symptomInput = document.querySelector('#symptoms');
const symptomExamples = document.querySelector('#symptom-examples');
const diagnosisResult = document.querySelector('#diagnosis-result');
const diagnosePanel = document.querySelector('#diagnose-panel');
const diagnosisHandoff = document.querySelector('#diagnosis-handoff');
const diagnoseButton = symptomForm.querySelector('button[type="submit"]');
const demoMode = document.querySelector('#demo-mode');
const pumpKey = 'water-pump';
const catalogUrl = new URL('./RLCSILVIAM_en-US.pdf', import.meta.url).href;
document.querySelector('#catalog-link').href = catalogUrl;
for (const [variant, { spec }] of Object.entries(PUMP_VARIANTS)) {
  nameplateInput.add(new Option(spec, variant));
}

let sponsorMode = false;
demoRequest('/status').then(({ mode, configured }) => {
  sponsorMode = mode === 'live';
  if (mode === 'live') demoMode.textContent = configured ? 'Sponsor demo' : 'Sponsor setup needed';
  if (selectedPart) renderPartReference(PART_BY_ID[selectedPart]);
}).catch(() => {
  demoMode.textContent = 'Demo server unavailable';
});

const groups = new Map();
for (const part of PARTS) {
  if (!groups.has(part.group)) {
    const group = document.createElement('optgroup');
    group.label = part.group;
    groups.set(part.group, group);
    componentSelect.append(group);
  }
  groups.get(part.group).append(new Option(part.name, part.id));
}
document.querySelector('#component-count').textContent = `${PARTS.length} components`;

function showTool(tool) {
  for (const tab of toolTabs) {
    const active = tab.dataset.tool === tool;
    tab.tabIndex = active ? 0 : -1;
    tab.setAttribute('aria-selected', String(active));
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
}

for (const [index, tab] of toolTabs.entries()) {
  tab.addEventListener('click', () => showTool(tab.dataset.tool));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? toolTabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + toolTabs.length) % toolTabs.length;
    showTool(toolTabs[nextIndex].dataset.tool);
    toolTabs[nextIndex].focus();
  });
}

const recommendationLabels = {
  fastest: 'Best arrival',
  'lowest-price': 'Lowest total',
  'top-rated': 'Best reviewed',
};

let zip = zipInput.value;
let selectedPart = null;
let selectedDiagnosis = null;
let selectedOfferId = null;
let referenceRequest = 0;
let offerView;
let offerRequest = 0;
let submittingOrder = false;
let quote = null;
const ordersByPart = new Map();
let expanded = false;
let machineOpen = false;

const viewer = mountViewer(document.querySelector('#viewer'), {
  onSelect: selectPart,
  onAvailability(available) {
    document.querySelector('.model-stage').classList.toggle('viewer-unavailable', !available);
    expandedButton.disabled = !available;
    coverButton.disabled = !available;
    document.querySelector('.reset-view').disabled = !available;
  },
});

function setMachineOpen(open) {
  machineOpen = open;
  coverButton.setAttribute('aria-expanded', String(open));
  coverLabel.textContent = open ? 'Close machine' : 'Open machine';
  viewer.setOpen(open);
}

function selectPart(part, diagnosisSource = null) {
  if (part !== null && !Object.hasOwn(PART_BY_ID, part)) return;
  const component = PART_BY_ID[part];
  if (component?.inside && !machineOpen) setMachineOpen(true);
  if (REMOVABLE_PARTS.has(part) && machineOpen) setMachineOpen(false);
  const changed = selectedPart !== part;
  if (changed) {
    selectedOfferId = null;
    const options = (component?.partNumbers ?? []).map((code) => new Option(`${code} · ${VARIANT_NAMES[code] ?? component.name}`, code));
    replacementInput.replaceChildren(new Option('Select a catalog part', ''), ...options);
  }
  selectedPart = part;
  selectedDiagnosis = diagnosisSource;
  componentSelect.value = part ?? '';
  selectionStatus.textContent = component ? `${component.name} selected.` : '';
  viewer.select(part);
  if (changed) renderPartReference(component);
  if (component) showTool('parts');
  return renderContent();
}

async function renderPartReference(part) {
  const request = ++referenceRequest;
  partReference.hidden = !part;
  if (!part) return;
  partReference.innerHTML = `
    <a href="${catalogUrl}#page=${part.page}" target="_blank" rel="noopener noreferrer">Rancilio catalog · p. ${part.page} ${graphic('external')}</a>
    <p>${part.partNumbers.join(' · ')}</p>
    <small role="status"></small>
  `;
  if (!sponsorMode) return;
  const status = partReference.querySelector('small');
  try {
    const result = await demoRequest(`/part-evidence?part=${encodeURIComponent(part.id)}`);
    if (request !== referenceRequest) return;
    status.textContent = result.partNumbers.length ? `Matched in Cognee · ${result.partNumbers.join(' · ')}` : 'Catalog match unavailable in Cognee';
  } catch {
    if (request === referenceRequest) status.textContent = 'Cognee lookup unavailable';
  }
}

function renderDiagnosis(result) {
  const matched = result.status === 'matched';
  const heading = matched ? (result.causes.length ? 'Likely causes' : 'Next step') : 'A little more detail';
  diagnosisResult.dataset.source = result.source;
  const source = result.source === 'live' ? 'Cognee' : 'Mock diagnosis';
  diagnosisResult.innerHTML = `
    <div class="diagnosis-heading">
      <span class="diagnosis-label">${graphic('sparkle')} ${source}</span>
      <button type="button" class="text-button" data-clear-diagnosis>New check</button>
    </div>
    <h3 tabindex="-1">${heading}</h3>
    <p>${escapeHtml(result.summary)}</p>
    ${matched && result.causes.length ? `<p class="fault-key"><span class="fault-dot fault-dot-primary"></span> Most likely <span class="fault-dot fault-dot-secondary"></span> Also check</p>` : ''}
    ${matched ? `
      <div class="cause-list">
        ${result.causes.map((cause) => `
          <article class="cause">
            <h4>${escapeHtml(cause.title)}</h4>
            <p>${escapeHtml(cause.description)}</p>
            ${cause.evidence?.length ? `<p class="cause-evidence">Catalog match in Cognee: ${cause.evidence.map(escapeHtml).join(' · ')}</p>` : ''}
            <div class="cause-actions">
              ${cause.partIds.filter((id) => Object.hasOwn(PART_BY_ID, id)).map((id) => `
                <button type="button" data-diagnose-part="${id}">${graphic('cube')} Inspect ${PART_BY_ID[id].name.toLowerCase()} ${graphic('chevron')}</button>
              `).join('')}
            </div>
          </article>
        `).join('')}
      </div>
      ${result.checks.length ? `
        <div class="diagnosis-checks"><h4>Checks to try first</h4><ul>${result.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join('')}</ul></div>
      ` : ''}
    ` : `<div class="diagnosis-question">${escapeHtml(result.clarification)}</div>`}
  `;
  diagnosisResult.hidden = false;
  highlightFaults(matched ? result.causes : []);
}

// Shows the diagnosis on the model: the first cause is the most likely one.
function highlightFaults(causes) {
  const known = (cause) => (cause?.partIds ?? []).filter((id) => Object.hasOwn(PART_BY_ID, id));
  const primary = known(causes[0]);
  const secondary = causes.slice(1).flatMap(known).filter((id) => !primary.includes(id));
  viewer.setFaults({ primary, secondary });
  if ([...primary, ...secondary].some((id) => PART_BY_ID[id].inside) && !machineOpen) setMachineOpen(true);
}

async function analyzeSymptom(symptom) {
  if (diagnoseButton.disabled) return;
  diagnoseButton.disabled = true;
  symptomExamples.hidden = true;
  diagnosePanel.classList.add('has-result');
  diagnosisResult.hidden = false;
  diagnosisResult.innerHTML = '<p class="request-state" role="status">Analyzing symptoms…</p>';
  try {
    renderDiagnosis(await demoRequest('/diagnose', { symptom }));
    if (document.activeElement === document.body || document.activeElement === diagnoseButton) {
      diagnosisResult.querySelector('h3')?.focus({ preventScroll: true });
    }
  } catch (error) {
    diagnosisResult.innerHTML = `<p class="request-state request-error" role="alert">${escapeHtml(error.message)}</p>`;
    symptomExamples.hidden = false;
  } finally {
    diagnoseButton.disabled = false;
  }
}

symptomForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const symptom = symptomInput.value.trim();
  if (symptom) analyzeSymptom(symptom);
  else {
    symptomInput.setCustomValidity('Describe what the machine does when you try to use it.');
    symptomInput.reportValidity();
  }
});
symptomInput.addEventListener('input', () => symptomInput.setCustomValidity(''));
symptomExamples.addEventListener('click', (event) => {
  const symptom = event.target.closest('[data-symptom]')?.dataset.symptom;
  if (!symptom) return;
  symptomInput.value = symptom;
  symptomInput.setCustomValidity('');
  analyzeSymptom(symptom);
});
diagnosisResult.addEventListener('click', (event) => {
  const part = event.target.closest('[data-diagnose-part]')?.dataset.diagnosePart;
  if (part) {
    selectPart(part, diagnosisResult.dataset.source ?? 'mock');
    document.querySelector('#parts-tab').focus({ preventScroll: true });
  } else if (event.target.closest('[data-clear-diagnosis]')) {
    symptomForm.reset();
    symptomInput.setCustomValidity('');
    diagnosisResult.hidden = true;
    symptomExamples.hidden = false;
    viewer.setFaults();
    diagnosePanel.classList.remove('has-result');
    symptomInput.focus();
  }
});

function renderEmpty() {
  if (machineOpen) {
    content.innerHTML = `
      <div class="inside-picker">
        <h3>Inside the machine</h3>
        <p>Select a part to compare replacements.</p>
        <div class="inside-list">
          ${PARTS.filter((part) => part.inside).map((part) => `
            <button type="button" data-component="${part.id}">${graphic('cube')} ${part.name} ${graphic('chevron')}</button>
          `).join('')}
        </div>
      </div>
    `;
    return;
  }
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-art">${graphic('cube')}</div>
      <h3>Select a component</h3>
      <p>Click an exterior part or open the machine to inspect what’s inside.</p>
    </div>
  `;
}

function partSummary(part, subtitle = part.group) {
  const icon = part.id === 'seal' ? 'ring' : 'cube';
  return `
    <div class="part-summary">
      <div class="part-art">${graphic(icon)}</div>
      <div><h3>${part.name}</h3><p>${escapeHtml(subtitle)}</p></div>
    </div>
  `;
}

function renderSupplierListings(part, selectedNumber) {
  const partNumbers = selectedNumber ? [selectedNumber] : part?.id === pumpKey ? [] : part?.partNumbers ?? [];
  const groups = partNumbers.map(getSupplierListings).filter(({ listings }) => listings.length);
  supplierListings.hidden = groups.length === 0;
  supplierListings.innerHTML = groups.length ? `
    <h3 id="supplier-listings-title">Supplier listings</h3>
    <p>Check current price and stock on the supplier’s site.</p>
    ${groups.length > 1 ? '<p>Match the part number to your machine before ordering.</p>' : ''}
    <ul>${groups.map(({ partNumber, variant, listings }) => `
      <li>
        <strong>${escapeHtml(variant ? `${variant} · ${partNumber}` : partNumber)}</strong>
        <div>${listings.map(({ seller, url }) => `
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="View part ${escapeHtml(partNumber)} at ${escapeHtml(seller)}">${escapeHtml(seller)} ${graphic('external')}</a>
        `).join('')}</div>
      </li>
    `).join('')}</ul>
  ` : '';
}

function offerCard(offer, part) {
  const status = offer.compatible ? (part.id === pumpKey ? 'Exact fit' : 'Catalog match') : 'Doesn’t fit';
  const selection = offer.id === selectedOfferId;
  return `
    <label class="offer ${selection ? 'offer-selected' : ''} ${offer.compatible ? '' : 'offer-incompatible'}">
      <input type="radio" name="offer" value="${escapeHtml(offer.id)}" ${selection ? 'checked' : ''} ${offer.compatible ? '' : 'disabled'} aria-label="${escapeHtml(offer.seller)}, ${currency.format(offer.total)}, ${status}">
      <div class="offer-main">
        <div class="offer-line"><span class="offer-name">${escapeHtml(offer.seller)}</span>${offer.recommended ? `<span class="recommended">${graphic('sparkle')}${recommendationLabels[priorityInput.value]}</span>` : ''}</div>
        <div class="offer-meta"><span class="fit ${offer.compatible ? '' : 'fit-no'}">${graphic(offer.compatible ? 'check' : 'close')}${status} · ${escapeHtml(offer.spec)}</span><span class="offer-rating">${graphic('star')}${offer.rating.toFixed(1)} <span>(${offer.reviewCount.toLocaleString('en-US')})</span></span></div>
      <div class="offer-detail">${graphic('truck')}${escapeHtml(offer.deliveryLabel)}<span>· ${escapeHtml(offer.partNumber)}</span></div>
        ${offer.compatible ? '' : `<div class="offer-reason">${escapeHtml(offer.fitReason)}</div>`}
      </div>
      <div class="offer-price"><strong>${currency.format(offer.total)}</strong><small>with shipping</small></div>
    </label>
  `;
}

function renderOffers(part, offers, source, variant) {
  const selected = offers.find((offer) => offer.compatible && offer.id === selectedOfferId) ?? offers.find((offer) => offer.recommended);
  if (!selected) {
    content.textContent = 'No compatible offers are available for this part.';
    return;
  }
  selectedOfferId = selected.id;
  offerView = { partId: part.id, offers, source, variant };
  const sourceSuffix = source === 'singlestore' ? ' · SingleStore' : '';

  content.innerHTML = `
    ${partSummary(part, `${selected.spec} · ${offers.length} sandbox offers${sourceSuffix}`)}
    <fieldset class="offers">
      <legend class="sr-only">Replacement offers</legend>
      ${offers.map((offer) => offerCard(offer, part)).join('')}
    </fieldset>
    <div class="order-action">
      <button type="button" class="button button-primary" data-action="review">Review order <span>${currency.format(selected.total)} ${graphic('arrow')}</span></button>
    </div>
  `;
}

async function loadOffers(part, request, variant) {
  content.innerHTML = '<p class="request-state" role="status">Loading replacement offers…</p>';
  try {
    const query = new URLSearchParams({ zip, priority: priorityInput.value, part: part.id });
    if (variant) query.set('variant', variant);
    const data = await demoRequest(`/offers?${query}`);
    if (request === offerRequest) renderOffers(part, data.offers, data.source, variant);
  } catch (error) {
    if (request === offerRequest) {
      content.innerHTML = `<div class="request-state request-error" role="alert">${escapeHtml(error.message)}<br><button class="button button-secondary" type="button" data-action="retry-offers">Retry offers</button></div>`;
    }
  }
}

function renderReceipt(part, order) {
  const diagnosis = order.diagnosisSource === 'live' ? ' from a Cognee-backed diagnosis'
    : order.diagnosisSource === 'mock' ? ' from a mock diagnosis' : '';
  content.innerHTML = `
    <div class="receipt" tabindex="-1" aria-live="polite">
      <span class="receipt-icon">${graphic('check')}</span>
      <h3>Sandbox order placed</h3>
      <p>${escapeHtml(order.id)} · ${escapeHtml(order.seller)}${order.source === 'singlestore' ? ' · Saved in SingleStore' : ''}</p>
      <dl class="receipt-detail">
        <div><dt>Part</dt><dd>${escapeHtml(order.title)} · ${escapeHtml(order.partNumber)}</dd></div>
        <div><dt>Delivery to ${escapeHtml(order.zip)}</dt><dd>${escapeHtml(order.deliveryLabel)}</dd></div>
        <div><dt>Total</dt><dd>${currency.format(order.total)}</dd></div>
      </dl>
      <details class="audit">
        <summary>${graphic('list')} Order audit trail</summary>
        <ol>
          <li>${part.name} selected${diagnosis}.</li>
          <li>${escapeHtml(order.fitReason)}</li>
          ${order.rejectedReason ? `<li>Excluded offer. ${escapeHtml(order.rejectedReason)}</li>` : ''}
          <li>Compared delivered price, ETA, and seller reviews for ZIP ${escapeHtml(order.zip)}.</li>
          ${order.personaStatus === 'approved' ? '<li>Persona Sandbox confirmed the demo technician’s approved verification.</li>' : ''}
          <li>You approved the sandbox order for ${currency.format(order.total)}.</li>
        </ol>
      </details>
      <button type="button" class="button button-secondary" data-action="compare">Compare offers again ${graphic('arrow')}</button>
    </div>
  `;
}

function renderContent() {
  const request = ++offerRequest;
  offerView = null;
  const part = PART_BY_ID[selectedPart];
  const order = ordersByPart.get(selectedPart);
  const isPump = part?.id === pumpKey;
  const hasOptions = part && !isPump && part.partNumbers.length > 1;
  const needsNameplate = isPump && !isPumpVariant(nameplateInput.value);
  const needsPartNumber = hasOptions && !part.partNumbers.includes(replacementInput.value);
  const variant = isPump ? nameplateInput.value : hasOptions ? replacementInput.value : undefined;
  const selectedNumber = isPump ? PUMP_VARIANTS[variant]?.partNumber : variant;
  renderSupplierListings(part, order?.partNumber ?? selectedNumber);
  diagnosisHandoff.hidden = !selectedDiagnosis || Boolean(order);
  nameplateField.hidden = !isPump || Boolean(order);
  replacementField.hidden = !hasOptions || Boolean(order);
  deliveryForm.hidden = !part || Boolean(order) || needsNameplate || needsPartNumber;
  locationStatus.hidden = deliveryForm.hidden;
  if (!part) {
    renderEmpty();
  } else if (order) {
    renderReceipt(part, order);
  } else if (needsNameplate) {
    content.innerHTML = partSummary(part, 'Choose the nameplate to compare compatible pumps.');
  } else if (needsPartNumber) {
    content.innerHTML = partSummary(part, 'Choose a catalog part number to compare offers.');
  } else {
    return loadOffers(part, request, variant);
  }
}

async function openCheckout() {
  const part = PART_BY_ID[selectedPart];
  if (!part || dialog.open) return;
  if (zipInput.value.trim() !== zip && !await applyZip()) return;
  if (dialog.open || selectedPart !== part.id || offerView?.partId !== part.id) return;
  const offer = offerView.offers.find((candidate) => candidate.id === selectedOfferId && candidate.compatible);
  if (!offer) return;
  quote = {
    offer, zip, partId: part.id, diagnosisSource: selectedDiagnosis, variant: offerView.variant,
    requestId: crypto.randomUUID(),
  };
  dialog.innerHTML = `
    <div class="checkout-top">
      <span class="panel-icon">${graphic('shopping')}</span>
      <button type="button" class="icon-button" data-dialog="cancel" aria-label="Close order review">${graphic('close')}</button>
    </div>
    <h2 id="checkout-title">Want me to order it?</h2>
    <p>Review the replacement and delivery details.</p>
    <dl class="receipt-detail">
      <div><dt>Part</dt><dd>${escapeHtml(offer.title)} · ${escapeHtml(offer.partNumber)}</dd></div>
      ${part.id === pumpKey ? `<div><dt>Machine nameplate</dt><dd>${escapeHtml(offer.spec)}</dd></div>` : ''}
      <div><dt>Seller</dt><dd>${escapeHtml(offer.seller)}</dd></div>
      <div><dt>Delivery to ${escapeHtml(zip)}</dt><dd>${escapeHtml(offer.deliveryLabel)}</dd></div>
      <div><dt>Total with shipping</dt><dd>${currency.format(offer.total)}</dd></div>
    </dl>
    ${offerView.source === 'singlestore' ? '<p>When you approve, Persona asks for a live selfie before the order is placed.</p>' : ''}
    <p class="checkout-sandbox">${graphic('shield')} Sandbox order · No payment will be taken</p>
    <p class="checkout-error" role="alert" hidden></p>
    <div class="dialog-buttons">
      <button type="button" class="button button-secondary" data-dialog="cancel" autofocus>Cancel</button>
      <button type="button" class="button button-primary" data-dialog="confirm">Approve sandbox order</button>
    </div>
  `;
  dialog.showModal();
}

async function applyZip() {
  if (!isValidZip(zipInput.value)) {
    zipInput.reportValidity();
    locationStatus.textContent = 'Enter a five-digit ZIP code.';
    return false;
  }
  zip = zipInput.value.trim();
  zipInput.value = zip;
  selectedOfferId = null;
  applyLocation.hidden = true;
  locationStatus.textContent = 'Delivery estimates updated.';
  await renderContent();
  return true;
}

dialog.addEventListener('close', () => {
  quote = null;
  if (ordersByPart.has(selectedPart)) content.querySelector('.receipt')?.focus();
  else content.querySelector('[data-action="review"]')?.focus();
});
dialog.addEventListener('cancel', (event) => {
  if (submittingOrder) event.preventDefault();
});
dialog.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-dialog]')?.dataset.dialog;
  if (submittingOrder) return;
  if (action === 'cancel') dialog.close();
  if (action === 'confirm' && quote && !ordersByPart.has(quote.partId)) {
    const checkout = quote;
    const buttons = [...dialog.querySelectorAll('button')];
    const submit = dialog.querySelector('[data-dialog="confirm"]');
    const message = dialog.querySelector('.checkout-error');
    submittingOrder = true;
    buttons.forEach((button) => { button.disabled = true; });
    submit.textContent = offerView?.source === 'singlestore' ? 'Checking and placing order…' : 'Placing sandbox order…';
    message.hidden = true;
    try {
      const { offer, zip, partId, requestId, variant } = checkout;
      const inquiryId = offerView?.source === 'singlestore' ? await verifyWithPersona(requestId, submit) : undefined;
      submit.textContent = 'Placing order…';
      const order = await demoRequest('/orders', {
        approved: true, offerId: offer.id, zip, partId, requestId, variant, inquiryId,
        diagnosisSource: checkout.diagnosisSource,
        expectedQuote: { partNumber: offer.partNumber, total: offer.total, deliveryDays: offer.deliveryDays },
      });
      ordersByPart.set(partId, order);
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      if (error.statusCode === 409) renderContent();
      return;
    } finally {
      submittingOrder = false;
      submit.textContent = 'Approve sandbox order';
      buttons.forEach((button) => { button.disabled = false; });
    }
    dialog.close();
    renderContent();
  }
});

// Starts a fresh Persona selfie check for this order and waits until the technician finishes it.
async function verifyWithPersona(requestId, submit) {
  dialog.querySelector('.persona-check')?.remove();
  submit.textContent = 'Starting Persona check…';
  const { inquiryId, url } = await demoRequest('/verification', { requestId });
  const panel = document.createElement('div');
  panel.className = 'persona-check';
  panel.innerHTML = `
    <h3>Verify it’s you</h3>
    <p>Scan with your phone, or open the link, and take the Persona selfie. The order is placed when Persona confirms.</p>
    <canvas aria-label="QR code for the Persona check"></canvas>
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Persona check ${graphic('external')}</a>
    <p class="persona-status" role="status">Waiting for your selfie…</p>
  `;
  dialog.querySelector('.dialog-buttons').before(panel);
  await QRCode.toCanvas(panel.querySelector('canvas'), url, { width: 180, margin: 1 });
  submit.textContent = 'Waiting for Persona…';
  const statusLine = panel.querySelector('.persona-status');
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline && dialog.open) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const { status } = await demoRequest(`/verification?id=${encodeURIComponent(inquiryId)}`);
    if (['completed', 'approved'].includes(status)) {
      statusLine.textContent = 'Persona verified you ✓';
      return inquiryId;
    }
    if (['failed', 'declined', 'expired'].includes(status)) throw new Error(`Persona check ${status}. Approve again to retry.`);
    statusLine.textContent = status === 'pending' ? 'Persona is checking your selfie…' : 'Waiting for your selfie…';
  }
  throw new Error('The Persona check timed out. Approve again to retry.');
}

componentSelect.addEventListener('change', () => {
  selectPart(componentSelect.value || null);
});
document.querySelector('.reset-view').addEventListener('click', () => {
  viewer.reset();
});
expandedButton.addEventListener('click', () => {
  expanded = !expanded;
  expandedButton.setAttribute('aria-pressed', String(expanded));
  viewer.setExpanded(expanded);
});
coverButton.addEventListener('click', () => {
  setMachineOpen(!machineOpen);
  showTool('parts');
  if (machineOpen || PART_BY_ID[selectedPart]?.inside) {
    selectPart(null);
  } else {
    renderContent();
  }
});

deliveryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyZip();
});
zipInput.addEventListener('input', () => {
  applyLocation.hidden = zipInput.value === zip;
  locationStatus.textContent = '';
});
for (const input of [priorityInput, nameplateInput, replacementInput]) {
  input.addEventListener('change', () => {
    selectedOfferId = null;
    renderContent();
  });
}

content.addEventListener('click', async (event) => {
  const component = event.target.closest('[data-component]')?.dataset.component;
  if (component) {
    await selectPart(component);
    if (selectedPart === component) content.querySelector('input[name="offer"]:checked, .receipt')?.focus({ preventScroll: true });
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'review') openCheckout();
  if (action === 'retry-offers') renderContent();
  if (action === 'compare') {
    const part = selectedPart;
    ordersByPart.delete(part);
    await renderContent();
    if (selectedPart === part) content.querySelector('[data-action="review"]')?.focus();
  }
});
content.addEventListener('change', (event) => {
  if (event.target.name === 'offer' && offerView?.partId === selectedPart) {
    selectedOfferId = event.target.value;
    renderOffers(PART_BY_ID[selectedPart], offerView.offers, offerView.source, offerView.variant);
    content.querySelector('input[name="offer"]:checked')?.focus({ preventScroll: true });
  }
});

renderContent();
