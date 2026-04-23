// ─── Touch Targets Module ───────────────────────────────────────────────────
// Standalone panel: scans interactive elements for WCAG 2.5.5 / 2.5.8 target size

import { escapeHtml, getActiveTab, showElement, hideElement, renderError, ensureContentCSS, highlightElement } from './utils.js';
import { TOUCH_TARGET } from './constants.js';

let overlayActive = false;

// ─── Touch Target Scan ──────────────────────────────────────────────────────

async function scanTouchTargets() {
  const container = document.getElementById('touch-target-results');
  const loading = document.getElementById('touch-target-loading');
  const statsEl = document.getElementById('touch-target-stats');
  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (thresholds) => {
        const interactive = Array.from(document.querySelectorAll(
          'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])'
        ));
        return interactive.map(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return null;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return null;
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          const minDim = Math.min(w, h);
          let severity = 'pass';
          if (minDim < thresholds.AA) severity = 'fail';
          else if (minDim < thresholds.AAA) severity = 'warn';
          const tag = el.tagName.toLowerCase();
          const name = el.getAttribute('aria-label') || el.textContent?.trim().substring(0, 40) || '';
          let selector;
          if (el.id) selector = '#' + CSS.escape(el.id);
          else {
            el.setAttribute('data-a11y-tt-idx', el.dataset.a11yTtIdx || String(Math.random()).slice(2, 10));
            selector = '[data-a11y-tt-idx="' + el.dataset.a11yTtIdx + '"]';
          }
          return { tag, name, w, h, minDim, severity, selector };
        }).filter(Boolean);
      },
      args: [TOUCH_TARGET]
    });

    hideElement(loading);
    if (!result || result.length === 0) {
      container.innerHTML = '<div class="empty-state">No interactive elements found</div>';
      return;
    }
    const fails = result.filter(r => r.severity === 'fail').length;
    const warns = result.filter(r => r.severity === 'warn').length;
    const passes = result.filter(r => r.severity === 'pass').length;
    statsEl.innerHTML = `<span class="stat-num">${result.length}</span> targets &middot; <span class="stat-num">${passes}</span> pass` +
      (warns ? ` &middot; <span class="stat-num">${warns}</span> warn` : '') +
      (fails ? ` &middot; <span class="stat-num sr-stat-issue">${fails}</span> fail` : '');
    showElement(statsEl);

    // Sort: fail first, then warn, then pass
    const order = { fail: 0, warn: 1, pass: 2 };
    result.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

    let html = '';
    result.forEach(r => {
      const icon = r.severity === 'fail' ? '\ud83d\udd34' : r.severity === 'warn' ? '\ud83d\udfe0' : '\ud83d\udfe2';
      html += `<div class="sr-touch-card sr-touch-${r.severity} sr-clickable" data-selector="${escapeHtml(r.selector)}">
        <div class="sr-touch-header">${icon} <span class="sr-touch-size">${r.w}\u00d7${r.h}px</span> <span class="sr-touch-label">&lt;${escapeHtml(r.tag)}&gt; ${escapeHtml(r.name)}</span></div>
        <div class="sr-touch-detail">${r.severity === 'fail' ? '\u274c Below ' + TOUCH_TARGET.AA + 'px minimum (WCAG 2.5.8)' : r.severity === 'warn' ? '\u26a0\ufe0f Below ' + TOUCH_TARGET.AAA + 'px enhanced (WCAG 2.5.5)' : '\u2705 Meets enhanced target size'}</div>
      </div>`;
    });
    container.innerHTML = html;

    // Click to highlight
    container.querySelectorAll('.sr-clickable[data-selector]').forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', async () => {
        await highlightElement(tab.id, item.dataset.selector);
      });
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ─── Touch Target Overlay ───────────────────────────────────────────────────

async function toggleTouchOverlay() {
  const tab = await getActiveTab();
  if (overlayActive) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { document.querySelectorAll('.a11y-touch-overlay').forEach(el => el.remove()); }
    });
    overlayActive = false;
    document.getElementById('btn-toggle-touch-overlay').textContent = 'Show Overlay';
    return;
  }
  await ensureContentCSS(tab.id);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (thresholds) => {
      document.querySelectorAll('.a11y-touch-overlay').forEach(el => el.remove());
      const interactive = Array.from(document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])'
      ));
      interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const minDim = Math.min(rect.width, rect.height);
        const color = minDim < thresholds.AA ? 'rgba(229,57,53,0.3)' : minDim < thresholds.AAA ? 'rgba(251,140,0,0.3)' : 'rgba(67,160,71,0.15)';
        const border = minDim < thresholds.AA ? '2px solid #e53935' : minDim < thresholds.AAA ? '2px solid #fb8c00' : '1px solid #43a047';
        const overlay = document.createElement('div');
        overlay.className = 'a11y-touch-overlay';
        overlay.style.cssText = `position:absolute;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;background:${color};border:${border};pointer-events:none;z-index:99998;border-radius:3px;`;
        const label = document.createElement('span');
        label.style.cssText = 'position:absolute;top:-16px;left:0;font-size:10px;background:#222;color:#fff;padding:1px 4px;border-radius:2px;white-space:nowrap;';
        label.textContent = Math.round(rect.width) + '\u00d7' + Math.round(rect.height);
        overlay.appendChild(label);
        document.body.appendChild(overlay);
      });
    },
    args: [TOUCH_TARGET]
  });
  overlayActive = true;
  document.getElementById('btn-toggle-touch-overlay').textContent = 'Hide Overlay';
}

// ─── Init ───────────────────────────────────────────────────────────────────

export function initTouchTargets() {
  document.getElementById('btn-scan-touch')?.addEventListener('click', scanTouchTargets);
  document.getElementById('btn-toggle-touch-overlay')?.addEventListener('click', toggleTouchOverlay);
}
