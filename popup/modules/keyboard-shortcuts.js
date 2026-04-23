// ─── Keyboard Shortcuts Audit Module ────────────────────────────────────────
// Detects accesskey conflicts, single-key shortcuts (WCAG 2.1.4),
// and verifies skip-to-content / bypass blocks (WCAG 2.4.1).

import { escapeHtml, getActiveTab, showElement, hideElement, renderError, highlightElement, ensureContentCSS } from './utils.js';

function shortcutsScanFunc() {
  const issues = [];
  const infos = [];

  // 1. accesskey audit — detect duplicates & conflicts
  const accesskeyMap = {};
  document.querySelectorAll('[accesskey]').forEach(el => {
    const key = (el.getAttribute('accesskey') || '').toLowerCase();
    if (!key) return;
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute('aria-label') || (el.textContent || '').trim().substring(0, 50) || tag;
    const selector = el.id ? '#' + CSS.escape(el.id) : tag + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
    if (!accesskeyMap[key]) accesskeyMap[key] = [];
    accesskeyMap[key].push({ name, selector, html: el.outerHTML.substring(0, 120) });
  });

  for (const [key, els] of Object.entries(accesskeyMap)) {
    if (els.length > 1) {
      els.forEach(e => {
        issues.push({
          type: 'accesskey-conflict', severity: 'error',
          desc: `Duplicate accesskey="${key}" — ${els.length} elements share the same key`,
          name: e.name, selector: e.selector, html: e.html
        });
      });
    } else {
      infos.push({
        type: 'accesskey', severity: 'info',
        desc: `accesskey="${key}"`,
        name: els[0].name, selector: els[0].selector, html: els[0].html
      });
    }
  }

  // 2. Single-character shortcuts on interactive elements (WCAG 2.1.4)
  // Check elements with explicit keyboard shortcut attributes
  document.querySelectorAll('[aria-keyshortcuts]').forEach(el => {
    const shortcut = el.getAttribute('aria-keyshortcuts') || '';
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute('aria-label') || (el.textContent || '').trim().substring(0, 50) || tag;
    const selector = el.id ? '#' + CSS.escape(el.id) : tag + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');

    // Single character without modifier = potential WCAG 2.1.4 fail
    const isSingleChar = /^[a-zA-Z0-9]$/.test(shortcut.trim());
    if (isSingleChar) {
      issues.push({
        type: 'single-key-shortcut', severity: 'error',
        desc: `Single-character shortcut "${shortcut}" — violates WCAG 2.1.4 (must be remappable or only active on focus)`,
        name, selector, html: el.outerHTML.substring(0, 120)
      });
    } else {
      infos.push({
        type: 'keyboard-shortcut', severity: 'info',
        desc: `aria-keyshortcuts="${escapeAttr(shortcut)}"`,
        name, selector, html: el.outerHTML.substring(0, 120)
      });
    }
  });

  function escapeAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // 3. Skip link / bypass block audit (WCAG 2.4.1)
  const skipLinks = Array.from(document.querySelectorAll('a[href^="#"]')).filter(a => {
    const text = (a.textContent || '').trim().toLowerCase();
    return /skip|jump|bypass|go to (main|content)/i.test(text);
  });

  const hasSkipLink = skipLinks.length > 0;
  const hasMainLandmark = !!document.querySelector('main, [role="main"]');
  const hasNavLandmark = !!document.querySelector('nav, [role="navigation"]');

  if (hasSkipLink) {
    skipLinks.forEach(a => {
      const target = a.getAttribute('href');
      const targetEl = target && target !== '#' ? document.querySelector(target) : null;
      const selector = a.id ? '#' + CSS.escape(a.id) : 'a[href="' + (target || '') + '"]';
      if (!targetEl) {
        issues.push({
          type: 'skip-link-broken', severity: 'error',
          desc: `Skip link "${(a.textContent || '').trim()}" points to "${target}" which doesn't exist`,
          name: (a.textContent || '').trim(), selector,
          html: a.outerHTML.substring(0, 120)
        });
      } else {
        infos.push({
          type: 'skip-link', severity: 'pass',
          desc: `Skip link found → targets "${target}"`,
          name: (a.textContent || '').trim(), selector,
          html: a.outerHTML.substring(0, 120)
        });
      }
    });
  } else if (!hasMainLandmark) {
    issues.push({
      type: 'no-bypass', severity: 'warning',
      desc: 'No skip link and no <main> landmark found — may fail WCAG 2.4.1 Bypass Blocks',
      name: '(page)', selector: 'body', html: ''
    });
  }

  if (!hasNavLandmark) {
    issues.push({
      type: 'no-nav-landmark', severity: 'warning',
      desc: 'No <nav> landmark found — navigation should be wrapped in <nav> for bypass',
      name: '(page)', selector: 'body', html: ''
    });
  }

  // 4. tabindex > 0 (positive tabindex disrupts natural order)
  document.querySelectorAll('[tabindex]').forEach(el => {
    const ti = parseInt(el.getAttribute('tabindex'));
    if (ti > 0) {
      const tag = el.tagName.toLowerCase();
      const name = el.getAttribute('aria-label') || (el.textContent || '').trim().substring(0, 50) || tag;
      const selector = el.id ? '#' + CSS.escape(el.id) : tag + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
      issues.push({
        type: 'positive-tabindex', severity: 'warning',
        desc: `tabindex="${ti}" — positive tabindex disrupts natural tab order`,
        name, selector, html: el.outerHTML.substring(0, 120)
      });
    }
  });

  return { issues, infos };
}

// ─── Rendering ──────────────────────────────────────────────────────────────

const TYPE_META = {
  'accesskey-conflict':  { label: 'Accesskey Conflict',      icon: '🔴' },
  'single-key-shortcut': { label: 'Single-Key Shortcut',     icon: '🔴' },
  'skip-link-broken':    { label: 'Broken Skip Link',        icon: '🔴' },
  'no-bypass':           { label: 'No Bypass Block',         icon: '🟠' },
  'no-nav-landmark':     { label: 'No Nav Landmark',         icon: '🟠' },
  'positive-tabindex':   { label: 'Positive tabindex',       icon: '🟠' },
  'accesskey':           { label: 'Accesskey',               icon: 'ℹ️' },
  'keyboard-shortcut':   { label: 'Keyboard Shortcut',       icon: 'ℹ️' },
  'skip-link':           { label: 'Skip Link',               icon: '✅' }
};

async function runShortcutsAudit() {
  const container = document.getElementById('ks-audit-results');
  const loading = document.getElementById('ks-audit-loading');
  const statsEl = document.getElementById('ks-audit-stats');

  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);

  const tab = await getActiveTab();
  await ensureContentCSS(tab.id);

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: shortcutsScanFunc
    });

    hideElement(loading);

    const allItems = [...result.issues, ...result.infos];
    const errors = result.issues.filter(i => i.severity === 'error').length;
    const warns = result.issues.filter(i => i.severity === 'warning').length;
    const passes = result.infos.filter(i => i.severity === 'pass').length;
    const info = result.infos.filter(i => i.severity === 'info').length;

    statsEl.innerHTML = [
      `<span class="kb-stat"><strong>${result.issues.length}</strong> issues</span>`,
      errors ? `<span class="kb-stat kb-stat-error"><strong>${errors}</strong> errors</span>` : '',
      warns ? `<span class="kb-stat kb-stat-warning"><strong>${warns}</strong> warnings</span>` : '',
      passes ? `<span class="kb-stat" style="color:#2e7d32"><strong>${passes}</strong> pass</span>` : '',
      info ? `<span class="kb-stat kb-stat-info"><strong>${info}</strong> info</span>` : ''
    ].filter(Boolean).join('');
    showElement(statsEl);

    if (allItems.length === 0) {
      container.innerHTML = '<div class="empty-state">No keyboard shortcuts or bypass issues found ✅</div>';
      return;
    }

    // Group by type
    const groups = {};
    allItems.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });

    let html = '';
    // Issues first, then infos
    const sortedTypes = Object.keys(groups).sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2, pass: 3 };
      const sevA = groups[a][0].severity;
      const sevB = groups[b][0].severity;
      return (order[sevA] ?? 9) - (order[sevB] ?? 9);
    });

    for (const type of sortedTypes) {
      const items = groups[type];
      const meta = TYPE_META[type] || { label: type, icon: '•' };
      const sev = items[0].severity;
      const sevCls = sev === 'error' ? 'kb-sev-error' : sev === 'warning' ? 'kb-sev-warning' : sev === 'pass' ? '' : 'kb-sev-info';

      html += `<div class="kb-group">
        <div class="kb-group-header" data-toggle="ks-g-${escapeHtml(type)}">
          <span class="kb-group-arrow">▸</span>
          <span class="kb-group-label">${meta.icon} ${escapeHtml(meta.label)}</span>
          <span class="kb-group-count">${items.length}</span>
        </div>
        <div class="kb-group-body collapsed" id="ks-g-${escapeHtml(type)}">`;

      items.forEach(item => {
        html += `<div class="kb-issue-card sr-clickable ${sevCls}" data-selector="${escapeHtml(item.selector)}" style="cursor:pointer">
          <div class="kb-issue-name">${escapeHtml(item.name)}</div>
          <div class="kb-issue-desc">${escapeHtml(item.desc)}</div>
          ${item.html ? '<div class="kb-issue-html"><code>' + escapeHtml(item.html) + '</code></div>' : ''}
        </div>`;
      });

      html += '</div></div>';
    }

    container.innerHTML = html;

    // Toggle groups
    container.querySelectorAll('.kb-group-header').forEach(header => {
      header.addEventListener('click', () => {
        const body = document.getElementById(header.dataset.toggle);
        if (body) {
          body.classList.toggle('collapsed');
          const arrow = header.querySelector('.kb-group-arrow');
          if (arrow) arrow.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
        }
      });
    });

    // Click to highlight
    container.querySelectorAll('.sr-clickable[data-selector]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.kb-group-header')) return;
        highlightElement(tab.id, item.dataset.selector);
      });
    });

  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────

export function initKeyboardShortcuts() {
  document.getElementById('btn-run-ks-audit')?.addEventListener('click', runShortcutsAudit);
}
