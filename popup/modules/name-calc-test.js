// ─── Accessible Name Calculation Test Module ────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, sendBackgroundMessage } from './utils.js';

async function runNameTests() {
  const container = document.getElementById('name-calc-list');
  const stats = document.getElementById('name-calc-stats');
  const loading = document.getElementById('name-calc-loading');

  showElement(loading);
  container.innerHTML = '';
  hideElement(stats);

  const tab = await getActiveTab();

  try {
    // Step 1: Find tricky name scenarios in the page
    const [{ result: candidates }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const results = [];
        const MAX = 50;

        // 1. Override: aria-label differs from inner text
        document.querySelectorAll('[aria-label]').forEach(el => {
          if (results.length >= MAX) return;
          const ariaLabel = el.getAttribute('aria-label') || '';
          const innerText = (el.textContent || '').trim();
          if (ariaLabel && innerText && ariaLabel !== innerText) {
            results.push({
              type: 'override',
              html: el.outerHTML.substring(0, 200),
              visibleText: innerText.substring(0, 80),
              expectedName: ariaLabel,
              expectedSource: 'aria-label overrides text content',
              selector: buildSelector(el)
            });
          }
        });

        // 2. LabelledBy: aria-labelledby references another element
        document.querySelectorAll('[aria-labelledby]').forEach(el => {
          if (results.length >= MAX) return;
          const ids = el.getAttribute('aria-labelledby').split(/\s+/);
          const refText = ids.map(id => {
            const ref = document.getElementById(id);
            return ref ? ref.textContent.trim() : '';
          }).filter(Boolean).join(' ');
          if (refText) {
            results.push({
              type: 'labelledby',
              html: el.outerHTML.substring(0, 200),
              visibleText: (el.textContent || '').trim().substring(0, 80),
              expectedName: refText,
              expectedSource: 'aria-labelledby → ' + ids.join(', '),
              selector: buildSelector(el)
            });
          }
        });

        // 3. Hidden: elements inside aria-hidden="true"
        document.querySelectorAll('[aria-hidden="true"]').forEach(container => {
          if (results.length >= MAX) return;
          const interactive = container.querySelectorAll('button, a[href], input, select, textarea, [tabindex]');
          interactive.forEach(el => {
            if (results.length >= MAX) return;
            results.push({
              type: 'hidden',
              html: el.outerHTML.substring(0, 200),
              visibleText: (el.textContent || '').trim().substring(0, 80),
              expectedName: '(should be hidden from tree)',
              expectedSource: 'Inside aria-hidden="true"',
              selector: buildSelector(el),
              shouldBeHidden: true
            });
          });
        });

        // 4. Title fallback: named only by title attribute (no other label)
        document.querySelectorAll('input[title], select[title], textarea[title], a[title], button[title]').forEach(el => {
          if (results.length >= MAX) return;
          if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.textContent.trim()) {
            if (el.id && !document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) {
              results.push({
                type: 'title-fallback',
                html: el.outerHTML.substring(0, 200),
                visibleText: '(no visible label)',
                expectedName: el.getAttribute('title'),
                expectedSource: 'title attribute (last resort)',
                selector: buildSelector(el)
              });
            }
          }
        });

        // 5. Placeholder fallback
        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
          if (results.length >= MAX) return;
          if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
            const id = el.id;
            const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
            const hasWrap = el.closest('label');
            if (!hasLabel && !hasWrap && !el.getAttribute('title')) {
              results.push({
                type: 'placeholder-fallback',
                html: el.outerHTML.substring(0, 200),
                visibleText: '(placeholder: ' + el.getAttribute('placeholder') + ')',
                expectedName: el.getAttribute('placeholder'),
                expectedSource: 'placeholder (not a sufficient label)',
                selector: buildSelector(el)
              });
            }
          }
        });

        function buildSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const idx = Array.from(document.querySelectorAll(tag)).indexOf(el);
          return tag + ':nth-of-type(' + (idx + 1) + ')';
        }

        return results;
      }
    });

    if (!candidates || candidates.length === 0) {
      hideElement(loading);
      container.innerHTML = '<div class="result-item"><div class="result-item-title">No tricky name scenarios found on this page</div></div>';
      return;
    }

    // Step 2: Get computed accessible names via CDP
    const computedNames = await sendBackgroundMessage({
      type: 'getAccessibleNames',
      tabId: tab.id,
      selectors: candidates.map(c => c.selector)
    });

    hideElement(loading);

    // Step 3: Compare and render results
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    candidates.forEach((c, i) => {
      const computed = computedNames?.names?.[i] || {};
      const computedName = computed.name || '';
      const computedRole = computed.role || '';
      const isHiddenInTree = computed.ignored || false;

      let status, statusClass, statusIcon;
      if (c.shouldBeHidden) {
        if (isHiddenInTree) {
          status = 'Correctly hidden'; statusClass = 'name-pass'; statusIcon = '✅'; passCount++;
        } else {
          status = 'Should be hidden but still in tree'; statusClass = 'name-fail'; statusIcon = '❌'; failCount++;
        }
      } else if (c.type === 'override') {
        if (computedName === c.expectedName) {
          status = 'aria-label correctly overrides text'; statusClass = 'name-pass'; statusIcon = '✅'; passCount++;
        } else {
          status = 'Name mismatch'; statusClass = 'name-fail'; statusIcon = '❌'; failCount++;
        }
      } else if (c.type === 'labelledby') {
        if (computedName === c.expectedName) {
          status = 'aria-labelledby resolved correctly'; statusClass = 'name-pass'; statusIcon = '✅'; passCount++;
        } else {
          status = 'Name mismatch'; statusClass = 'name-warn'; statusIcon = '⚠️'; warnCount++;
        }
      } else if (c.type === 'placeholder-fallback') {
        status = 'Uses placeholder as name (insufficient)'; statusClass = 'name-warn'; statusIcon = '⚠️'; warnCount++;
      } else if (c.type === 'title-fallback') {
        status = 'Uses title as fallback name'; statusClass = 'name-warn'; statusIcon = '⚠️'; warnCount++;
      } else {
        if (computedName) {
          status = 'Has computed name'; statusClass = 'name-pass'; statusIcon = '✅'; passCount++;
        } else {
          status = 'No accessible name'; statusClass = 'name-fail'; statusIcon = '❌'; failCount++;
        }
      }

      const item = document.createElement('div');
      item.className = `result-item ${statusClass}`;
      item.innerHTML = `
        <div class="result-item-header">
          <span class="result-item-title">${statusIcon} ${escapeHtml(c.type.replace('-', ' '))}</span>
          <span class="ax-badge ax-badge-${statusClass === 'name-pass' ? 'state' : statusClass === 'name-warn' ? 'warn' : 'invalid'}">${escapeHtml(status)}</span>
        </div>
        <div class="name-calc-detail">
          <div class="name-calc-row"><span class="ax-pick-label">Source</span><span>${escapeHtml(c.expectedSource)}</span></div>
          <div class="name-calc-row"><span class="ax-pick-label">Visible</span><span>${escapeHtml(c.visibleText || '(none)')}</span></div>
          <div class="name-calc-row"><span class="ax-pick-label">Expected</span><span class="ax-name-primary">${escapeHtml(c.expectedName)}</span></div>
          <div class="name-calc-row"><span class="ax-pick-label">Computed</span><span class="ax-name-primary">${escapeHtml(computedName || '(empty)')}</span></div>
          ${computedRole ? `<div class="name-calc-row"><span class="ax-pick-label">Role</span><span class="ax-badge ax-badge-role">${escapeHtml(computedRole)}</span></div>` : ''}
        </div>
        <div class="result-item-details">
          <div class="detail-node">${escapeHtml(c.html)}</div>
        </div>
      `;
      item.querySelector('.result-item-header')?.addEventListener('click', () => item.classList.toggle('expanded'));
      container.appendChild(item);
    });

    stats.innerHTML = `
      <span class="ax-stat"><strong>${candidates.length}</strong> test cases</span>
      <span class="ax-stat ax-stat-landmark">✅ <strong>${passCount}</strong> pass</span>
      ${warnCount ? `<span class="ax-stat ax-stat-warn">⚠️ <strong>${warnCount}</strong> warnings</span>` : ''}
      ${failCount ? `<span class="ax-stat ax-stat-issue">❌ <strong>${failCount}</strong> failures</span>` : ''}
    `;
    showElement(stats);

  } catch (e) {
    hideElement(loading);
    renderError(container, `Error: ${e.message}`);
  }
}

export function initNameCalcTest() {
  document.getElementById('btn-run-name-tests').addEventListener('click', runNameTests);
}
