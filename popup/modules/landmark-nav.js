// ─── Landmark Navigator Module ──────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError } from './utils.js';
import { LANDMARK_SELECTORS, TAG_LANDMARK_MAP } from './constants.js';

async function scanLandmarks() {
  const container = document.getElementById('landmark-list');
  const stats = document.getElementById('landmark-stats');
  const loading = document.getElementById('landmark-loading');

  showElement(loading);
  container.innerHTML = '';
  hideElement(stats);

  const tab = await getActiveTab();

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectors, tagRoleMap) => {
        const seen = new Set();
        const landmarks = [];

        document.querySelectorAll(selectors.join(',')).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || tagRoleMap[tag] || tag;

          // Compute accessible name
          let name = el.getAttribute('aria-label') || '';
          if (!name && el.getAttribute('aria-labelledby')) {
            const ids = el.getAttribute('aria-labelledby').split(/\s+/);
            name = ids.map(id => {
              const ref = document.getElementById(id);
              return ref ? ref.textContent.trim() : '';
            }).filter(Boolean).join(' ');
          }
          if (!name) name = el.getAttribute('title') || '';

          // Build a selector for hover highlighting
          let selector = '';
          if (el.id) { selector = '#' + el.id; }
          else {
            const idx = Array.from(document.querySelectorAll(tag)).indexOf(el);
            selector = tag + ':nth-of-type(' + (idx + 1) + ')';
          }

          landmarks.push({ role, name, tag, selector });
        });

        // Check for duplicate roles without unique names
        const roleCounts = {};
        landmarks.forEach(l => {
          if (!roleCounts[l.role]) roleCounts[l.role] = [];
          roleCounts[l.role].push(l);
        });
        const warnings = [];
        Object.entries(roleCounts).forEach(([role, items]) => {
          if (items.length > 1) {
            const names = items.map(i => i.name).filter(Boolean);
            const uniqueNames = new Set(names);
            if (uniqueNames.size < items.length) {
              warnings.push(`${items.length} "${role}" elements without unique labels`);
              items.forEach(i => { i.duplicateWarning = true; });
            }
          }
        });

        return { landmarks, warnings };
      },
      args: [LANDMARK_SELECTORS, TAG_LANDMARK_MAP]
    });

    hideElement(loading);

    if (!result || result.landmarks.length === 0) {
      container.innerHTML = '<div class="result-item"><div class="result-item-title">No landmarks found</div></div>';
      return;
    }

    // Stats
    stats.innerHTML = `
      <span class="ax-stat"><strong>${result.landmarks.length}</strong> landmarks</span>
      ${result.warnings.map(w => `<span class="ax-stat ax-stat-issue">⚠️ ${escapeHtml(w)}</span>`).join('')}
    `;
    showElement(stats);

    // Render list
    result.landmarks.forEach(lm => {
      const item = document.createElement('div');
      item.className = 'landmark-item' + (lm.duplicateWarning ? ' landmark-warn' : '');
      item.dataset.selector = lm.selector;
      item.innerHTML = `
        <span class="ax-badge ax-badge-landmark">🏷 ${escapeHtml(lm.role)}</span>
        <span class="ax-tag">${escapeHtml(lm.tag.toUpperCase())}</span>
        ${lm.name ? `<span class="ax-name-primary">${escapeHtml(lm.name)}</span>` : '<span class="ax-missing-name">no name</span>'}
        ${lm.duplicateWarning ? '<span class="ax-badge ax-badge-warn">⚠️ needs unique label</span>' : ''}
      `;

      // Hover to highlight on page
      item.addEventListener('mouseenter', () => highlightElement(tab.id, lm.selector, true));
      item.addEventListener('mouseleave', () => highlightElement(tab.id, lm.selector, false));
      container.appendChild(item);
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, `Error: ${e.message}`);
  }
}

async function highlightElement(tabId, selector, show) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel, doShow) => {
        document.querySelectorAll('.a11y-ext-landmark-highlight').forEach(m => m.remove());
        if (!doShow) return;
        try {
          const el = document.querySelector(sel);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const overlay = document.createElement('div');
          overlay.className = 'a11y-ext-landmark-highlight';
          overlay.style.cssText = `
            position: absolute;
            top: ${rect.top + window.scrollY}px;
            left: ${rect.left + window.scrollX}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 3px solid #26a69a;
            background: rgba(38, 166, 154, 0.1);
            z-index: 2147483646;
            pointer-events: none;
            border-radius: 4px;
            transition: all 0.2s;
          `;
          document.body.appendChild(overlay);
        } catch (e) {}
      },
      args: [selector, show]
    });
  } catch (e) { /* tab may have been closed */ }
}

let areLandmarkLabelsVisible = false;

export async function toggleLandmarkLabels() {
  areLandmarkLabelsVisible = !areLandmarkLabelsVisible;
  const tab = await getActiveTab();
  const btn = document.getElementById('btn-show-landmark-labels');

  if (areLandmarkLabelsVisible) {
    if(btn) { btn.textContent = 'Hide Labels'; btn.classList.add('active'); }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectors) => {
        document.querySelectorAll(selectors.join(',')).forEach(el => {
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const lbl = document.createElement('div');
          lbl.className = 'a11y-ext-landmark-label';
          lbl.textContent = role + (el.getAttribute('aria-label') ? ' ("'+el.getAttribute('aria-label')+'")' : '');
          lbl.style.cssText = 'position: absolute; background: #26a69a; color: #fff; padding: 2px 6px; font-size: 11px; font-weight: bold; border-radius: 4px; z-index: 2147483645; pointer-events: none; margin-top: -20px;';
          if(getComputedStyle(el).position === 'static') el.style.position = 'relative';
          el.dataset.prevOutlineLandmark = el.style.outline;
          el.style.outline = '2px dashed #26a69a';
          el.appendChild(lbl);
        });
      },
      args: [LANDMARK_SELECTORS]
    });
  } else {
    if(btn) { btn.textContent = 'Show Labels on Page'; btn.classList.remove('active'); }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectors) => {
        document.querySelectorAll('.a11y-ext-landmark-label').forEach(el => el.remove());
        document.querySelectorAll(selectors.join(',')).forEach(el => {
          if (el.dataset.prevOutlineLandmark !== undefined) {
             el.style.outline = el.dataset.prevOutlineLandmark;
             delete el.dataset.prevOutlineLandmark;
          } else el.style.outline = '';
        });
      },
      args: [LANDMARK_SELECTORS]
    });
  }
}

export function initLandmarkNav() {
  document.getElementById('btn-scan-landmarks').addEventListener('click', scanLandmarks);
  const lblBtn = document.getElementById('btn-show-landmark-labels');
  if (lblBtn) lblBtn.addEventListener('click', toggleLandmarkLabels);
}
