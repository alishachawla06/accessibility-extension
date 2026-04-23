// ─── Panel Entry Point (runs inside the detached window) ────────────────────
import { initAutoCheck }        from './modules/auto-check.js';
import { initTabStops }         from './modules/tab-stops.js';
import { initAriaTree }         from './modules/aria-tree.js';
import { initContrast }         from './modules/contrast.js';
import { initTextSpacing }      from './modules/text-spacing.js';
import { initHeadingOutline }   from './modules/heading-outline.js';
import { initLandmarkNav }      from './modules/landmark-nav.js';
import { initFormLabeller }     from './modules/form-labeller.js';
import { initAltReview }        from './modules/alt-review.js';
import { initScreenReader }     from './modules/screen-reader.js';
import { initTouchTargets }     from './modules/touch-targets.js';
import { initKeyboardAudit }    from './modules/keyboard-audit.js';
import { initKeyboardShortcuts } from './modules/keyboard-shortcuts.js';
import { initManualKbTest }     from './modules/manual-kb-test.js';
import { initScorecard }        from './modules/scorecard.js';
import { initLiveRegionMonitor } from './modules/live-region-monitor.js';
import { initMobileViewport }    from './modules/mobile-viewport.js';
import { initColorVision }       from './modules/color-vision.js';
import { initMotionAudit }       from './modules/motion-audit.js';
import { initIssueHistory }      from './modules/issue-history.js';

// ─── Module Initialization per Section ──────────────────────────────────────
const sectionModules = {
  'scorecard':     [initScorecard],
  'scan':          [initAutoCheck],
  'structure':     [initLandmarkNav, initHeadingOutline, initAriaTree],
  'content':       [initFormLabeller, initAltReview],
  'keyboard':      [initTabStops, initKeyboardAudit, initKeyboardShortcuts, initManualKbTest],
  'visual':        [initContrast, initTouchTargets, initTextSpacing, initColorVision, initMotionAudit],
  'screen-reader': [initScreenReader],
  'monitoring':    [initLiveRegionMonitor],
  'mobile':        [initMobileViewport],
  'history':       [initIssueHistory]
};
const initialized = new Set();

function ensureInit(sectionId) {
  if (initialized.has(sectionId)) return;
  const inits = sectionModules[sectionId];
  if (inits) {
    inits.forEach(fn => fn());
    initialized.add(sectionId);
  }
}

// ─── Generic Sub-tab Switching (for scan, structure, keyboard, visual, etc) ─
document.querySelectorAll('.section-sub-tabs').forEach(tabBar => {
  tabBar.querySelectorAll('.section-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const panel = tabBar.closest('.panel');
      panel.querySelectorAll('.section-sub-tab').forEach(t => t.classList.remove('active'));
      panel.querySelectorAll('.section-sub-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = panel.querySelector(`.section-sub-panel[data-panel="${tab.dataset.tab}"]`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
});

// ─── Sidebar Navigation ─────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panelId = btn.dataset.panel;
    document.getElementById('panel-' + panelId)?.classList.add('active');
    ensureInit(panelId);
  });
});

// ─── Auto-switch to the panel requested via URL hash ────────────────────────
const requestedPanel = location.hash.replace('#', '');
if (requestedPanel) {
  const btn = document.querySelector(`.nav-btn[data-panel="${requestedPanel}"]`);
  if (btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + requestedPanel)?.classList.add('active');
  }
}

// Initialize the active panel (default or hash-requested)
const activePanel = requestedPanel || 'scan';
ensureInit(activePanel);

// Eager init: sections whose modules check for pending picker state
['scan', 'structure', 'content', 'keyboard'].forEach(ensureInit);
