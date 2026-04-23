// ─── Live Region Monitor Module ─────────────────────────────────────────────
// Detects aria-live regions, role="alert|status|log|timer", and watches for
// content mutations in real time.
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, highlightElement, ensureContentCSS } from './utils.js';

let monitoring = false;
let monitorTabId = null;
let liveRegions = [];

/* ── Scan for live regions ────────────────────────────────────────────────── */
async function scanLiveRegions() {
  const container = document.getElementById('live-region-list');
  const loading = document.getElementById('live-region-loading');
  const statsEl = document.getElementById('live-region-stats');
  showElement(loading);
  container.innerHTML = '';
  if (statsEl) statsEl.classList.add('hidden');

  const tab = await getActiveTab();
  monitorTabId = tab.id;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const regions = [];
        const seen = new Set();

        function getSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const cls = Array.from(el.classList).slice(0, 2).join('.');
          return tag + (cls ? '.' + cls : '');
        }

        // aria-live regions
        document.querySelectorAll('[aria-live]').forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          regions.push({
            selector: getSelector(el),
            type: 'aria-live',
            value: el.getAttribute('aria-live'),
            role: el.getAttribute('role') || '',
            text: el.textContent?.trim().slice(0, 80) || '(empty)',
            atomic: el.getAttribute('aria-atomic') || 'false',
            relevant: el.getAttribute('aria-relevant') || 'additions text'
          });
        });

        // role-based live regions
        ['alert', 'status', 'log', 'timer', 'marquee'].forEach(role => {
          document.querySelectorAll(`[role="${role}"]`).forEach(el => {
            if (seen.has(el)) return;
            seen.add(el);
            regions.push({
              selector: getSelector(el),
              type: 'role',
              value: role,
              role,
              text: el.textContent?.trim().slice(0, 80) || '(empty)',
              atomic: el.getAttribute('aria-atomic') || 'false',
              relevant: el.getAttribute('aria-relevant') || 'additions text'
            });
          });
        });

        // output elements (implicit live)
        document.querySelectorAll('output').forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          regions.push({
            selector: getSelector(el),
            type: 'output',
            value: 'polite',
            role: 'status',
            text: el.textContent?.trim().slice(0, 80) || '(empty)',
            atomic: 'false',
            relevant: 'additions text'
          });
        });

        return regions;
      }
    });

    hideElement(loading);
    liveRegions = result || [];

    if (!liveRegions.length) {
      container.innerHTML = '<div class="empty-state">No live regions found on this page.</div>';
      return;
    }

    if (statsEl) {
      const assertive = liveRegions.filter(r => r.value === 'assertive' || r.value === 'alert').length;
      const polite = liveRegions.length - assertive;
      statsEl.innerHTML = `<span class="stat-pill"><strong>${liveRegions.length}</strong> regions</span><span class="stat-pill" style="background:#fff9c4;color:#f57f17"><strong>${assertive}</strong> assertive</span><span class="stat-pill"><strong>${polite}</strong> polite</span>`;
      statsEl.classList.remove('hidden');
    }

    let html = '';
    liveRegions.forEach((r, i) => {
      const isAssertive = r.value === 'assertive' || r.role === 'alert';
      const badge = isAssertive
        ? '<span class="kb-sev-pill" style="background:#ffcdd2;color:#c62828">assertive</span>'
        : '<span class="kb-sev-pill" style="background:#e8f5e9;color:#2e7d32">polite</span>';
      html += `<div class="kb-issue-card sr-clickable" data-selector="${escapeHtml(r.selector)}" style="cursor:pointer">
        <div style="display:flex;gap:6px;align-items:center">${badge} <code>${escapeHtml(r.selector)}</code></div>
        <div style="font-size:11px;color:#666;margin-top:2px">Type: ${escapeHtml(r.type)} | atomic: ${r.atomic} | relevant: ${r.relevant}</div>
        <div style="font-size:12px;color:#333;margin-top:2px">"${escapeHtml(r.text)}"</div>
      </div>`;
    });
    container.innerHTML = html;

    // Show monitor buttons
    showElement('btn-start-monitoring');

    container.querySelectorAll('.sr-clickable[data-selector]').forEach(card => {
      card.addEventListener('click', () => highlightElement(monitorTabId, card.dataset.selector));
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

/* ── Start monitoring with MutationObserver ───────────────────────────────── */
async function startMonitoring() {
  if (!monitorTabId || !liveRegions.length) return;
  monitoring = true;
  updateMonitorUI();

  const selectors = liveRegions.map(r => r.selector);
  await chrome.scripting.executeScript({
    target: { tabId: monitorTabId },
    func: (selectors) => {
      window.__a11yLiveObservers = window.__a11yLiveObservers || [];
      // Clean up previous
      window.__a11yLiveObservers.forEach(o => o.disconnect());
      window.__a11yLiveObservers = [];
      window.__a11yLiveLog = window.__a11yLiveLog || [];

      selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        const obs = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            const newText = el.textContent?.trim().slice(0, 120) || '';
            window.__a11yLiveLog.push({
              time: new Date().toISOString(),
              selector: sel,
              type: m.type,
              text: newText
            });
          });
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true });
        window.__a11yLiveObservers.push(obs);
      });
    },
    args: [selectors]
  });

  // Poll for new log entries
  pollMonitorLog();
}

async function pollMonitorLog() {
  if (!monitoring) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: monitorTabId },
      func: () => {
        const log = window.__a11yLiveLog || [];
        window.__a11yLiveLog = [];
        return log;
      }
    });

    if (result && result.length) {
      const logEl = document.getElementById('monitor-log');
      result.forEach(entry => {
        const time = new Date(entry.time).toLocaleTimeString();
        const div = document.createElement('div');
        div.className = 'kb-issue-card';
        div.innerHTML = `<span style="color:#666;font-size:11px">${time}</span> <code>${escapeHtml(entry.selector)}</code><div style="font-size:12px;margin-top:2px">"${escapeHtml(entry.text)}"</div>`;
        logEl.prepend(div);
      });
    }
  } catch (_) { /* tab closed */ }

  if (monitoring) setTimeout(pollMonitorLog, 1500);
}

/* ── Stop monitoring ──────────────────────────────────────────────────────── */
async function stopMonitoring() {
  monitoring = false;
  updateMonitorUI();
  if (!monitorTabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: monitorTabId },
      func: () => {
        (window.__a11yLiveObservers || []).forEach(o => o.disconnect());
        window.__a11yLiveObservers = [];
      }
    });
  } catch (_) { /* tab closed */ }
}

function updateMonitorUI() {
  if (monitoring) {
    hideElement('btn-start-monitoring');
    showElement('btn-stop-monitoring');
    showElement('btn-clear-monitor-log');
  } else {
    showElement('btn-start-monitoring');
    hideElement('btn-stop-monitoring');
  }
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
export function initLiveRegionMonitor() {
  document.getElementById('btn-scan-live-regions')?.addEventListener('click', scanLiveRegions);
  document.getElementById('btn-start-monitoring')?.addEventListener('click', startMonitoring);
  document.getElementById('btn-stop-monitoring')?.addEventListener('click', stopMonitoring);
  document.getElementById('btn-clear-monitor-log')?.addEventListener('click', () => {
    document.getElementById('monitor-log').innerHTML = '';
  });
}
