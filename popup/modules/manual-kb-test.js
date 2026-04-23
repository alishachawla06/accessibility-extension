// ─── Manual Keyboard Test Module ────────────────────────────────────────────
// Records the user's live focus trail as they Tab through the page.
import { escapeHtml, getActiveTab, ensureContentCSS, highlightElement } from './utils.js';

let recording = false;
let focusTrail = [];
let listenerTabId = null;

/* ── Inject the focus-trail recorder into the page ────────────────────────── */
async function startRecording() {
  const tab = await getActiveTab();
  listenerTabId = tab.id;
  focusTrail = [];
  recording = true;
  await chrome.storage.session.set({ mktRecording: true, mktTabId: tab.id });

  await ensureContentCSS(tab.id);

  // Inject the recorder script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Clean up previous session
      window.__a11yFocusTrail = [];
      window.__a11yFocusIdx = 0;
      document.querySelectorAll('.a11y-ext-focus-trail-badge').forEach(b => b.remove());

      function getSelector(el) {
        if (el.id) return '#' + CSS.escape(el.id);
        const tag = el.tagName.toLowerCase();
        const cls = Array.from(el.classList).filter(c => !c.startsWith('a11y-ext')).slice(0, 2).join('.');
        const parent = el.parentElement;
        if (!parent) return tag;
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        const idx = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(el) + 1})` : '';
        return tag + (cls ? '.' + cls : '') + idx;
      }

      function getComponent(el) {
        let p = el;
        for (let i = 0; i < 15; i++) {
          if (!p || p === document.body) break;
          const tag = p.tagName.toLowerCase();
          const role = p.getAttribute('role') || '';
          const label = p.getAttribute('aria-label') || '';
          if (['header', 'nav', 'main', 'footer', 'aside', 'section', 'form'].includes(tag))
            return label ? tag + ' – ' + label : tag;
          if (['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region', 'form'].includes(role))
            return label ? role + ' – ' + label : role;
          p = p.parentElement;
        }
        return 'page';
      }

      window.__a11yFocusHandler = (e) => {
        const el = e.target;
        if (!el || el === document.body) return;
        window.__a11yFocusIdx++;
        const idx = window.__a11yFocusIdx;

        const rect = el.getBoundingClientRect();
        const entry = {
          idx,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || '',
          name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 60) || '',
          selector: getSelector(el),
          component: getComponent(el),
          rect: { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height }
        };
        window.__a11yFocusTrail.push(entry);

        // Show badge on page
        const badge = document.createElement('div');
        badge.className = 'a11y-ext-focus-trail-badge';
        badge.textContent = idx;
        badge.style.cssText = `
          position: absolute; top: ${rect.top + window.scrollY - 10}px; left: ${rect.left + window.scrollX - 10}px;
          width: 22px; height: 22px; border-radius: 50%; background: #6200ea; color: #fff;
          font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
          z-index: 2147483647; pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,.3);
        `;
        document.body.appendChild(badge);
      };

      document.addEventListener('focusin', window.__a11yFocusHandler, true);
    }
  });

  updateUI();
  // Focus the target page and close this panel so the user can start tabbing
  chrome.runtime.sendMessage({ type: 'mktStarted', tabId: tab.id });
}

/* ── Stop recording and pull collected trail back ─────────────────────────── */
async function stopRecording() {
  recording = false;
  await chrome.storage.session.remove(['mktRecording', 'mktTabId']);
  if (!listenerTabId) return;

  // Pull trail data and remove listener
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: listenerTabId },
    func: () => {
      document.removeEventListener('focusin', window.__a11yFocusHandler, true);
      return window.__a11yFocusTrail || [];
    }
  });

  focusTrail = result || [];
  renderTrail();
  updateUI();
}

/* ── Clear badges from the page ───────────────────────────────────────────── */
async function clearOverlays() {
  if (!listenerTabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: listenerTabId },
      func: () => document.querySelectorAll('.a11y-ext-focus-trail-badge').forEach(b => b.remove())
    });
  } catch (_) { /* tab may be closed */ }
}

/* ── Render the recorded trail ────────────────────────────────────────────── */
function renderTrail() {
  const container = document.getElementById('mkt-results');
  const statsEl = document.getElementById('mkt-stats');

  if (!focusTrail.length) {
    container.innerHTML = '<p class="sr-sub-desc">No focus events recorded. Click Start, then Tab through the target page.</p>';
    statsEl.classList.add('hidden');
    return;
  }

  // Stats
  const uniqueComponents = [...new Set(focusTrail.map(e => e.component))];
  statsEl.innerHTML = `
    <span class="stat-pill"><strong>${focusTrail.length}</strong> focus stops</span>
    <span class="stat-pill"><strong>${uniqueComponents.length}</strong> regions</span>
  `;
  statsEl.classList.remove('hidden');

  // Group by component
  const groups = {};
  focusTrail.forEach(e => {
    (groups[e.component] ??= []).push(e);
  });

  let html = '';
  for (const [comp, items] of Object.entries(groups)) {
    html += `<div class="kb-group">`;
    html += `<div class="kb-group-header"><span class="kb-group-title">${escapeHtml(comp)}</span><span class="kb-group-count">${items.length}</span></div>`;
    items.forEach(item => {
      const roleBadge = item.role ? `<span class="sr-flow-role">${escapeHtml(item.role)}</span>` : '';
      html += `
        <div class="mkt-trail-item kb-issue-card" data-selector="${escapeHtml(item.selector)}" title="Click to highlight on page">
          <span class="mkt-trail-idx">${item.idx}</span>
          <span class="mkt-trail-tag">&lt;${escapeHtml(item.tag)}&gt;</span>
          ${roleBadge}
          <span class="mkt-trail-name">${escapeHtml(item.name)}</span>
        </div>`;
    });
    html += `</div>`;
  }

  container.innerHTML = html;

  // Click-to-highlight
  container.querySelectorAll('.mkt-trail-item[data-selector]').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      if (listenerTabId) highlightElement(listenerTabId, card.dataset.selector);
    });
  });
}

/* ── UI state helper ──────────────────────────────────────────────────────── */
function updateUI() {
  const btnStart = document.getElementById('btn-mkt-start');
  const btnStop = document.getElementById('btn-mkt-stop');
  const btnClear = document.getElementById('btn-mkt-clear');
  if (recording) {
    btnStart.classList.add('hidden');
    btnStop.classList.remove('hidden');
    btnClear.classList.add('hidden');
  } else {
    btnStart.classList.remove('hidden');
    btnStop.classList.add('hidden');
    btnClear.classList.toggle('hidden', !focusTrail.length);
  }
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
export function initManualKbTest() {
  // Restore recording state if panel was closed mid-session
  chrome.storage.session.get(['mktRecording', 'mktTabId'], ({ mktRecording, mktTabId }) => {
    if (mktRecording && mktTabId) {
      recording = true;
      listenerTabId = mktTabId;
      updateUI();
      // Auto-navigate to Manual Test sub-tab (only in standalone panel window)
      chrome.windows.getCurrent(win => {
        if (win.type === 'popup') {
          document.querySelector('.nav-btn[data-panel="keyboard"]')?.click();
          document.querySelector('.section-sub-tab[data-tab="manual-kb"]')?.click();
        }
      });
      const results = document.getElementById('mkt-results');
      if (results && !results.children.length) {
        results.innerHTML = '<p class="sr-sub-desc">Recording in progress — Tab through the page, then click <strong>Stop Recording</strong>.</p>';
      }
    }
  });

  document.getElementById('btn-mkt-start')?.addEventListener('click', startRecording);
  document.getElementById('btn-mkt-stop')?.addEventListener('click', stopRecording);
  document.getElementById('btn-mkt-clear')?.addEventListener('click', async () => {
    await clearOverlays();
    await chrome.storage.session.remove(['mktRecording', 'mktTabId']);
    focusTrail = [];
    document.getElementById('mkt-results').innerHTML = '';
    document.getElementById('mkt-stats').classList.add('hidden');
    updateUI();
  });
}
