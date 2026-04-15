// ─── Panel Entry Point (runs inside the detached window) ────────────────────
import { initAutoCheck } from './modules/auto-check.js';
import { initTabStops } from './modules/tab-stops.js';
import { initAriaTree } from './modules/aria-tree.js';
import { initContrast } from './modules/contrast.js';
import { initTextSpacing } from './modules/text-spacing.js';
import { initHeadingOutline } from './modules/heading-outline.js';
import { initLandmarkNav } from './modules/landmark-nav.js';
import { initFormLabeller } from './modules/form-labeller.js';
import { initNameCalcTest } from './modules/name-calc-test.js';
import { initAltReview } from './modules/alt-review.js';

// ─── Lazy Module Initialization ─────────────────────────────────────────────
const initializers = {
  'auto-check': initAutoCheck,
  'tab-stops': initTabStops,
  'aria-tree': initAriaTree,
  'contrast': initContrast,
  'text-spacing': initTextSpacing,
  'headings': initHeadingOutline,
  'landmarks': initLandmarkNav,
  'form-labeller': initFormLabeller,
  'name-calc': initNameCalcTest,
  'alt-review': initAltReview
};
const initialized = new Set();

function ensureInit(panelId) {
  if (initialized.has(panelId)) return;
  const init = initializers[panelId];
  if (init) {
    init();
    initialized.add(panelId);
  }
}

// ─── Navigation ─────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panelId = btn.dataset.panel;
    document.getElementById('panel-' + panelId).classList.add('active');
    ensureInit(panelId);
  });
});

// ─── Auto-switch to the panel requested via URL hash ────────────────────────
const requestedPanel = location.hash.replace('#', '');
if (requestedPanel) {
  const btn = document.querySelector(`[data-panel="${requestedPanel}"]`);
  if (btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + requestedPanel).classList.add('active');
  }
}

// Initialize the active panel (default or hash-requested)
const activePanel = requestedPanel || 'auto-check';
ensureInit(activePanel);

// These modules check for pending picked elements on init, so they must init eagerly
ensureInit('auto-check');
ensureInit('aria-tree');
ensureInit('tab-stops');
