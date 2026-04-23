// ─── Mobile Viewport Simulator Module ────────────────────────────────────────
// Emulates mobile devices via CDP Emulation.setDeviceMetricsOverride, then
// re-runs audits at the emulated viewport for comparison with desktop.
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, highlightElement } from './utils.js';

const DEVICE_PRESETS = [
  { id: 'iphone-se',  label: 'iPhone SE',  width: 375, height: 667, scale: 2, mobile: true },
  { id: 'iphone-14',  label: 'iPhone 14',  width: 390, height: 844, scale: 3, mobile: true },
  { id: 'pixel-7',    label: 'Pixel 7',    width: 412, height: 915, scale: 2.625, mobile: true },
  { id: 'ipad',       label: 'iPad',       width: 810, height: 1080, scale: 2, mobile: true },
  { id: 'ipad-pro',   label: 'iPad Pro 12.9', width: 1024, height: 1366, scale: 2, mobile: true }
];

let activeDevice = null;
let orientation = 'portrait'; // 'portrait' | 'landscape'
let desktopBaseline = null;

function dims(preset) {
  return orientation === 'landscape'
    ? { w: preset.height, h: preset.width }
    : { w: preset.width, h: preset.height };
}

/* ── Apply device emulation via background CDP ────────────────────────────── */
async function applyEmulation(preset) {
  const tab = await getActiveTab();
  const { w, h } = dims(preset);
  const resp = await chrome.runtime.sendMessage({
    type: 'setDeviceEmulation', tabId: tab.id,
    width: w, height: h,
    deviceScaleFactor: preset.scale,
    mobile: preset.mobile
  });
  if (!resp?.success) throw new Error(resp?.error || 'Emulation failed');
  activeDevice = preset;
  updateStatus();
}

async function clearEmulation() {
  const tab = await getActiveTab();
  await chrome.runtime.sendMessage({ type: 'clearDeviceEmulation', tabId: tab.id });
  activeDevice = null;
  updateStatus();
}

/* ── Status indicator ─────────────────────────────────────────────────────── */
function updateStatus() {
  const el = document.getElementById('mobile-status');
  if (!el) return;
  if (activeDevice) {
    const { w, h } = dims(activeDevice);
    el.innerHTML = `<span class="mv-status-active">Emulating <strong>${escapeHtml(activeDevice.label)}</strong> (${w}×${h} ${orientation})</span>`;
    el.classList.remove('hidden');
    showElement('btn-mobile-reset');
    // Highlight active device button
    document.querySelectorAll('.mv-device-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.device === activeDevice.id);
    });
  } else {
    el.innerHTML = '<span class="mv-status-off">No emulation active</span>';
    el.classList.remove('hidden');
    hideElement('btn-mobile-reset');
    document.querySelectorAll('.mv-device-btn').forEach(b => b.classList.remove('active'));
  }
}

/* ── Mobile Audit: re-run scans at emulated viewport ─────────────────────── */
async function runMobileAudit() {
  const loading = document.getElementById('mobile-audit-loading');
  const results = document.getElementById('mobile-audit-results');
  const stats = document.getElementById('mobile-audit-stats');

  showElement(loading);
  results.innerHTML = '';
  hideElement(stats);

  try {
    const tab = await getActiveTab();

    // Inject axe if not already present, then run
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['libs/axe.min.js']
    }).catch(() => {});

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        function buildSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const parent = el.parentElement;
          if (!parent) return tag;
          const sibs = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          if (sibs.length === 1) return buildSelector(parent) + ' > ' + tag;
          const idx = sibs.indexOf(el) + 1;
          return buildSelector(parent) + ' > ' + tag + ':nth-of-type(' + idx + ')';
        }

        const touchResults = [];
        const minSize = 44;
        const interactiveSelector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"]';
        document.querySelectorAll(interactiveSelector).forEach(el => {
          if (el.offsetParent === null && el.getAttribute('type') !== 'hidden') return;
          const rect = el.getBoundingClientRect();
          if (rect.width < minSize || rect.height < minSize) {
            const severity = (rect.width < 24 || rect.height < 24) ? 'fail' : 'warn';
            touchResults.push({
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 50),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              selector: buildSelector(el),
              severity,
              type: 'small-target'
            });
          }
        });

        // Check for horizontal overflow
        const overflowIssues = [];
        const vw = window.innerWidth;
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > vw + 5 && rect.width > 0 && el.scrollWidth > el.clientWidth + 5) {
            const tag = el.tagName.toLowerCase();
            if (!['html', 'body'].includes(tag)) {
              overflowIssues.push({
                tag,
                text: (el.textContent || '').trim().slice(0, 40),
                overflow: Math.round(rect.right - vw),
                selector: buildSelector(el),
                severity: 'fail',
                type: 'overflow'
              });
            }
          }
        });

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          smallTargets: touchResults.length,
          overflowCount: overflowIssues.length,
          issues: [...touchResults.slice(0, 50), ...overflowIssues.slice(0, 20)]
        };
      }
    });

    hideElement(loading);

    const totalIssues = result.issues.length;
    stats.innerHTML = `
      <span class="stat-pill"><strong>${result.smallTargets}</strong> small targets</span>
      <span class="stat-pill"><strong>${result.overflowCount}</strong> overflow</span>
      <span class="stat-pill">${result.viewport.width}×${result.viewport.height}</span>
    `;
    showElement(stats);

    if (desktopBaseline !== null) {
      const delta = totalIssues - desktopBaseline;
      const cls = delta > 0 ? 'mv-delta-worse' : delta < 0 ? 'mv-delta-better' : 'mv-delta-same';
      const sign = delta > 0 ? '+' : '';
      stats.innerHTML += ` <span class="stat-pill ${cls}">vs desktop: ${sign}${delta}</span>`;
    } else {
      desktopBaseline = totalIssues;
    }

    if (!result.issues.length) {
      results.innerHTML = '<div class="empty-state">✅ No mobile-specific issues found at this viewport.</div>';
      return;
    }

    results.innerHTML = result.issues.map(issue => {
      const icon = issue.severity === 'fail' ? '🔴' : '🟡';
      const selAttr = issue.selector ? ` data-selector="${escapeHtml(issue.selector)}"` : '';
      if (issue.type === 'small-target') {
        const detail = issue.severity === 'fail'
          ? '❌ Below 24px minimum (WCAG 2.5.5 AAA)'
          : '⚠️ Below 44px recommended (WCAG 2.5.8 AA)';
        return `<div class="sr-touch-card sr-touch-${issue.severity} sr-clickable"${selAttr}>
          <div class="sr-touch-header">${icon} <span class="sr-touch-size">${issue.width}×${issue.height}px</span> <span class="sr-touch-label">&lt;${escapeHtml(issue.tag)}&gt; ${escapeHtml(issue.text)}</span></div>
          <div class="sr-touch-detail">${detail}</div>
        </div>`;
      }
      return `<div class="sr-touch-card sr-touch-fail sr-clickable"${selAttr}>
        <div class="sr-touch-header">🔴 <span class="sr-touch-size">overflow +${issue.overflow}px</span> <span class="sr-touch-label">&lt;${escapeHtml(issue.tag)}&gt; ${escapeHtml(issue.text)}</span></div>
        <div class="sr-touch-detail">❌ Content overflows viewport by ${issue.overflow}px — may require horizontal scrolling</div>
      </div>`;
    }).join('');

    // Wire click-to-highlight
    results.querySelectorAll('.sr-clickable[data-selector]').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', async () => {
        await highlightElement(tab.id, card.dataset.selector);
      });
    });

  } catch (e) {
    hideElement(loading);
    renderError(results, 'Mobile audit failed: ' + e.message);
  }
}

/* ── Custom viewport apply ────────────────────────────────────────────────── */
async function applyCustom() {
  const w = parseInt(document.getElementById('mv-custom-w')?.value);
  const h = parseInt(document.getElementById('mv-custom-h')?.value);
  if (!w || !h || w < 200 || h < 200) return;
  const custom = { id: 'custom', label: `Custom ${w}×${h}`, width: w, height: h, scale: 2, mobile: true };
  await applyEmulation(custom);
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
export function initMobileViewport() {
  // Device preset buttons
  document.querySelectorAll('.mv-device-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const preset = DEVICE_PRESETS.find(d => d.id === btn.dataset.device);
      if (preset) await applyEmulation(preset);
    });
  });

  // Orientation toggle
  document.getElementById('btn-mv-orientation')?.addEventListener('click', async () => {
    orientation = orientation === 'portrait' ? 'landscape' : 'portrait';
    document.getElementById('btn-mv-orientation').textContent = orientation === 'portrait' ? '↕ Portrait' : '↔ Landscape';
    if (activeDevice) await applyEmulation(activeDevice);
  });

  // Custom apply
  document.getElementById('btn-mv-custom-apply')?.addEventListener('click', applyCustom);

  // Reset
  document.getElementById('btn-mobile-reset')?.addEventListener('click', clearEmulation);

  // Mobile audit
  document.getElementById('btn-mobile-audit')?.addEventListener('click', runMobileAudit);

  updateStatus();
}
