import { createSandboxOrder, getOffers, isValidZip } from './offers.js';
import { diagnoseSymptom } from './diagnostics.js';
import { PARTS, PART_BY_ID } from './parts.js';
import { mountViewer } from './viewer.js';

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
const dialog = document.querySelector('#checkout');
const expandedButton = document.querySelector('#expanded');
const coverButton = document.querySelector('#machine-cover');
const coverLabel = document.querySelector('#machine-cover-label');
const coverParts = new Set(['side-panel-left', 'top-panel', 'cup-rail']);
const toolTabs = [...document.querySelectorAll('.tool-tab')];
const symptomForm = document.querySelector('#symptom-form');
const symptomInput = document.querySelector('#symptoms');
const symptomExamples = document.querySelector('#symptom-examples');
const diagnosisResult = document.querySelector('#diagnosis-result');
const diagnosePanel = document.querySelector('#diagnose-panel');
const diagnosisHandoff = document.querySelector('#diagnosis-handoff');

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
let selectedFromDiagnosis = false;
let selectedOfferId = null;
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

function selectPart(part, fromDiagnosis = false) {
  if (part !== null && !Object.hasOwn(PART_BY_ID, part)) return;
  const component = PART_BY_ID[part];
  if (component?.inside && !machineOpen) setMachineOpen(true);
  if (coverParts.has(part) && machineOpen) setMachineOpen(false);
  if (selectedPart !== part) selectedOfferId = null;
  selectedPart = part;
  selectedFromDiagnosis = fromDiagnosis;
  componentSelect.value = part ?? '';
  selectionStatus.textContent = component ? `${component.name} selected.` : '';
  viewer.select(part);
  if (component) showTool('parts');
  renderContent();
}

function renderDiagnosis(symptom) {
  const result = diagnoseSymptom(symptom);
  const matched = result.status === 'matched';
  const heading = matched ? (result.causes.length ? 'Likely causes' : 'Next step') : 'A little more detail';
  symptomExamples.hidden = true;
  diagnosePanel.classList.add('has-result');
  diagnosisResult.innerHTML = `
    <div class="diagnosis-heading">
      <span class="diagnosis-label">${graphic('sparkle')} Mock diagnosis</span>
      <button type="button" class="text-button" data-clear-diagnosis>New check</button>
    </div>
    <h3 tabindex="-1">${heading}</h3>
    <p>${result.summary}</p>
    ${matched ? `
      <div class="cause-list">
        ${result.causes.map((cause) => `
          <article class="cause">
            <h4>${cause.title}</h4>
            <p>${cause.description}</p>
            <div class="cause-actions">
              ${cause.partIds.filter((id) => Object.hasOwn(PART_BY_ID, id)).map((id) => `
                <button type="button" data-diagnose-part="${id}">${graphic('cube')} Inspect ${PART_BY_ID[id].name.toLowerCase()} ${graphic('chevron')}</button>
              `).join('')}
            </div>
          </article>
        `).join('')}
      </div>
      ${result.checks.length ? `
        <div class="diagnosis-checks"><h4>Checks to try first</h4><ul>${result.checks.map((check) => `<li>${check}</li>`).join('')}</ul></div>
      ` : ''}
    ` : `<div class="diagnosis-question">${result.clarification}</div>`}
  `;
  diagnosisResult.hidden = false;
}

symptomForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const symptom = symptomInput.value.trim();
  if (symptom) renderDiagnosis(symptom);
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
  renderDiagnosis(symptom);
  diagnosisResult.querySelector('h3').focus({ preventScroll: true });
});
diagnosisResult.addEventListener('click', (event) => {
  const part = event.target.closest('[data-diagnose-part]')?.dataset.diagnosePart;
  if (part) {
    selectPart(part, true);
    document.querySelector('#parts-tab').focus({ preventScroll: true });
  } else if (event.target.closest('[data-clear-diagnosis]')) {
    symptomForm.reset();
    symptomInput.setCustomValidity('');
    diagnosisResult.hidden = true;
    symptomExamples.hidden = false;
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
  const icon = part.offerKey === 'seal' ? 'ring' : 'cube';
  return `
    <div class="part-summary">
      <div class="part-art">${graphic(icon)}</div>
      <div><h3>${part.name}</h3><p>${subtitle}</p></div>
    </div>
  `;
}

function renderPartDetail(part) {
  content.innerHTML = `
    <div class="component-detail">
      ${partSummary(part)}
      <p class="component-description">${part.description}</p>
      <div class="catalog-status">
        <strong>No sandbox offers for this component</strong>
        <p>Compare replacements for the seals and internal components.</p>
      </div>
    </div>
  `;
}

function offerCard(offer) {
  const status = offer.compatible ? 'Exact fit' : 'Doesn’t fit';
  const selection = offer.id === selectedOfferId;
  return `
    <label class="offer ${selection ? 'offer-selected' : ''} ${offer.compatible ? '' : 'offer-incompatible'}">
      <input type="radio" name="offer" value="${offer.id}" ${selection ? 'checked' : ''} ${offer.compatible ? '' : 'disabled'} aria-label="${offer.seller}, ${currency.format(offer.total)}, ${status}">
      <div class="offer-main">
        <div class="offer-line"><span class="offer-name">${offer.seller}</span>${offer.recommended ? `<span class="recommended">${graphic('sparkle')}${recommendationLabels[priorityInput.value]}</span>` : ''}</div>
        <div class="offer-meta"><span class="fit ${offer.compatible ? '' : 'fit-no'}">${graphic(offer.compatible ? 'check' : 'close')}${status} · ${offer.spec}</span><span class="offer-rating">${graphic('star')}${offer.rating.toFixed(1)} <span>(${offer.reviewCount.toLocaleString('en-US')})</span></span></div>
        <div class="offer-detail">${graphic('truck')}${offer.deliveryLabel}</div>
        ${offer.compatible ? '' : `<div class="offer-reason">${offer.fitReason}</div>`}
      </div>
      <div class="offer-price"><strong>${currency.format(offer.total)}</strong><small>with shipping</small></div>
    </label>
  `;
}

function renderOffers(part) {
  const offers = getOffers(zip, priorityInput.value, part.offerKey);
  const selected = offers.find((offer) => offer.compatible && offer.id === selectedOfferId) ?? offers.find((offer) => offer.recommended);
  if (!selected) {
    content.textContent = 'Enter a valid five-digit ZIP code to compare offers.';
    return;
  }
  selectedOfferId = selected.id;

  content.innerHTML = `
    ${partSummary(part, `${selected.spec} · ${offers.length} offers`)}
    <fieldset class="offers">
      <legend class="sr-only">Replacement offers</legend>
      ${offers.map(offerCard).join('')}
    </fieldset>
    <div class="order-action">
      <button type="button" class="button button-primary" data-action="review">Review order <span>${currency.format(selected.total)} ${graphic('arrow')}</span></button>
    </div>
  `;
}

function renderReceipt(part, order) {
  content.innerHTML = `
    <div class="receipt" tabindex="-1" aria-live="polite">
      <span class="receipt-icon">${graphic('check')}</span>
      <h3>Sandbox order placed</h3>
      <p>${order.id} · ${order.seller}</p>
      <dl class="receipt-detail">
        <div><dt>Part</dt><dd>${part.name} · ${order.partNumber}</dd></div>
        <div><dt>Delivery to ${order.zip}</dt><dd>${order.deliveryLabel}</dd></div>
        <div><dt>Total</dt><dd>${currency.format(order.total)}</dd></div>
      </dl>
      <details class="audit">
        <summary>${graphic('list')} Order audit trail</summary>
        <ol>
          <li>${part.name} selected${order.fromDiagnosis ? ' from a mock diagnosis' : ''}.</li>
          <li>${order.fitReason}</li>
          ${order.rejectedReason ? `<li>Excluded offer. ${order.rejectedReason}</li>` : ''}
          <li>Compared delivered price, ETA, and seller reviews for ZIP ${order.zip}.</li>
          <li>You approved the sandbox order for ${currency.format(order.total)}.</li>
        </ol>
      </details>
      <button type="button" class="button button-secondary" data-action="compare">Compare offers again ${graphic('arrow')}</button>
    </div>
  `;
}

function renderContent() {
  const part = PART_BY_ID[selectedPart];
  const order = ordersByPart.get(selectedPart);
  diagnosisHandoff.hidden = !selectedFromDiagnosis || Boolean(order);
  deliveryForm.hidden = !part?.offerKey || Boolean(order);
  locationStatus.hidden = deliveryForm.hidden;
  if (!part) {
    renderEmpty();
  } else if (!part.offerKey) {
    renderPartDetail(part);
  } else if (order) {
    renderReceipt(part, order);
  } else {
    renderOffers(part);
  }
}

function openCheckout() {
  const part = PART_BY_ID[selectedPart];
  if (!part?.offerKey) return;
  if (zipInput.value !== zip && !applyZip()) return;
  const offers = getOffers(zip, priorityInput.value, part.offerKey);
  const offer = offers.find((candidate) => candidate.id === selectedOfferId && candidate.compatible);
  if (!offer) return;
  quote = { offer, zip, partId: part.id, offerKey: part.offerKey, fromDiagnosis: selectedFromDiagnosis, rejectedReason: offers.find((candidate) => !candidate.compatible)?.fitReason };
  dialog.innerHTML = `
    <div class="checkout-top">
      <span class="panel-icon">${graphic('shopping')}</span>
      <button type="button" class="icon-button" data-dialog="cancel" aria-label="Close order review">${graphic('close')}</button>
    </div>
    <h2 id="checkout-title">Want me to order it?</h2>
    <p>Review the replacement and delivery details.</p>
    <dl class="receipt-detail">
      <div><dt>Part</dt><dd>${part.name} · ${offer.partNumber}</dd></div>
      <div><dt>Seller</dt><dd>${offer.seller}</dd></div>
      <div><dt>Delivery to ${zip}</dt><dd>${offer.deliveryLabel}</dd></div>
      <div><dt>Total with shipping</dt><dd>${currency.format(offer.total)}</dd></div>
    </dl>
    <p class="checkout-sandbox">${graphic('shield')} Sandbox order · No payment will be taken</p>
    <p class="checkout-error" role="alert" hidden></p>
    <div class="dialog-buttons">
      <button type="button" class="button button-secondary" data-dialog="cancel" autofocus>Cancel</button>
      <button type="button" class="button button-primary" data-dialog="confirm">Approve sandbox order</button>
    </div>
  `;
  dialog.showModal();
}

function applyZip() {
  if (!isValidZip(zipInput.value)) {
    zipInput.reportValidity();
    locationStatus.textContent = 'Enter a five-digit ZIP code.';
    return false;
  }
  zip = zipInput.value;
  selectedOfferId = null;
  applyLocation.hidden = true;
  locationStatus.textContent = 'Delivery estimates updated.';
  renderContent();
  return true;
}

dialog.addEventListener('close', () => {
  quote = null;
  if (ordersByPart.has(selectedPart)) content.querySelector('.receipt')?.focus();
  else content.querySelector('[data-action="review"]')?.focus();
});
dialog.addEventListener('click', (event) => {
  const action = event.target.closest('[data-dialog]')?.dataset.dialog;
  if (action === 'cancel') dialog.close();
  if (action === 'confirm' && quote && !ordersByPart.has(quote.partId)) {
    try {
      const order = createSandboxOrder(quote.offer, quote.zip, quote.offerKey);
      ordersByPart.set(quote.partId, {
        ...order,
        fitReason: quote.offer.fitReason,
        rejectedReason: quote.rejectedReason,
        fromDiagnosis: quote.fromDiagnosis,
      });
    } catch (error) {
      const message = dialog.querySelector('.checkout-error');
      message.textContent = error.message;
      message.hidden = false;
      return;
    }
    dialog.close();
    renderContent();
  }
});

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
priorityInput.addEventListener('change', () => {
  selectedOfferId = null;
  renderContent();
});

content.addEventListener('click', (event) => {
  const component = event.target.closest('[data-component]')?.dataset.component;
  if (component) {
    selectPart(component);
    content.querySelector('input[name="offer"]:checked, .receipt')?.focus({ preventScroll: true });
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'review') openCheckout();
  if (action === 'compare') {
    ordersByPart.delete(selectedPart);
    renderContent();
    content.querySelector('[data-action="review"]')?.focus();
  }
});
content.addEventListener('change', (event) => {
  if (event.target.name === 'offer') {
    selectedOfferId = event.target.value;
    renderContent();
    content.querySelector('input[name="offer"]:checked')?.focus({ preventScroll: true });
  }
});

renderContent();
