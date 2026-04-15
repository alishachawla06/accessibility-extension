// ─── Shared Utilities ───────────────────────────────────────────────────────

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export async function getActiveTab() {
  // Ask background for the real browser tab (it tracks the source window)
  const tab = await chrome.runtime.sendMessage({ type: 'getTargetTab' });
  if (tab) return tab;
  // Fallback: active tab in any normal window
  const [fallback] = await chrome.tabs.query({ active: true, windowType: 'normal' });
  return fallback;
}

export function showElement(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.classList.remove('hidden');
}

export function hideElement(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.classList.add('hidden');
}

export function setButtons(ids, disabled) {
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

// Render error / success message into a container
export function renderError(container, message) {
  if (typeof container === 'string') container = document.getElementById(container);
  container.innerHTML = `<div class="result-item"><div class="result-item-title" style="color:#e53935">${escapeHtml(message)}</div></div>`;
}

export function renderSuccess(container, message) {
  if (typeof container === 'string') container = document.getElementById(container);
  container.innerHTML = `<div class="result-item"><div class="result-item-title" style="color:#43a047">${escapeHtml(message)}</div></div>`;
}

// Promise wrapper for chrome.runtime.sendMessage with standard error handling
export function sendBackgroundMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('No response from background script'));
        return;
      }
      if (!response.success && response.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

// ─── Template Helpers ───────────────────────────────────────────────────────

// Track which tabs have had content CSS injected
const injectedTabs = new Set();

/**
 * Ensure the shared content-inject.css is loaded in the target tab.
 * Safe to call multiple times — injects only once per tab.
 */
export async function ensureContentCSS(tabId) {
  if (injectedTabs.has(tabId)) return;
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content-inject.css']
    });
    injectedTabs.add(tabId);
  } catch (e) {
    // Tab might not be injectable (e.g. chrome:// pages)
  }
}

/**
 * Create a badge HTML string.
 * @param {string} text - Badge text
 * @param {string} className - CSS class(es) e.g. 'ax-badge-state', 'ax-badge-warn'
 * @returns {string} HTML
 */
export function badge(text, className) {
  return `<span class="ax-badge ${className}">${escapeHtml(text)}</span>`;
}

/**
 * Create a stat bar HTML string from an array of stat objects.
 * @param {Array<{label: string, value: string|number, className?: string}>} stats
 * @returns {string} HTML
 */
export function statBar(stats) {
  return stats.map(s =>
    `<span class="ax-stat${s.className ? ' ' + s.className : ''}"><strong>${escapeHtml(String(s.value))}</strong> ${escapeHtml(s.label)}</span>`
  ).join('');
}

/**
 * Highlight an element on the content page by scrolling to it and
 * drawing a temporary blue outline overlay. Auto-removes after ~2s.
 * @param {number} tabId - The tab to highlight in
 * @param {string} selector - CSS selector for the target element
 */
export async function highlightElement(tabId, selector) {
  if (!selector) return;
  await ensureContentCSS(tabId);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        let el = null;
        try { el = document.querySelector(sel); } catch (e) { /* invalid selector */ }
        if (!el) {
          // Fallback: try last segment (handles axe iframe paths joined with ' > ')
          const parts = sel.split(' > ');
          if (parts.length > 1) {
            try { el = document.querySelector(parts[parts.length - 1]); } catch (e) {}
          }
        }
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Remove any previous highlight
        document.querySelectorAll('.a11y-ext-highlight').forEach(h => h.remove());
        const rect = el.getBoundingClientRect();
        const hl = document.createElement('div');
        hl.className = 'a11y-ext-highlight';
        Object.assign(hl.style, {
          top: (rect.top + window.scrollY) + 'px',
          left: (rect.left + window.scrollX) + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px'
        });
        document.body.appendChild(hl);
        setTimeout(() => hl.remove(), 2300);
      },
      args: [selector]
    });
  } catch (e) {
    // Tab not injectable (chrome:// pages etc.)
  }
}

/**
 * Walk up from an element to find the nearest section/component landmark.
 * Used inside chrome.scripting.executeScript injected functions.
 * Pass SECTION_TAGS and SECTION_ROLES from constants via args.
 */
export function getComponentFunc(el, sectionTags, sectionRoles) {
  let parent = el;
  for (let i = 0; i < 15; i++) {
    if (!parent || parent === document.body || parent === document.documentElement) break;
    const tag = parent.tagName.toLowerCase();
    const role = parent.getAttribute('role') || '';
    const label = parent.getAttribute('aria-label') || '';
    if (sectionTags.includes(tag))
      return label ? tag + ' – ' + label : tag;
    if (sectionRoles.includes(role))
      return label ? role + ' – ' + label : role;
    parent = parent.parentElement;
  }
  return 'page';
}
