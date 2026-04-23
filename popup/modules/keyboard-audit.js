// ─── Keyboard Audit Module ──────────────────────────────────────────────────
// Scans for keyboard accessibility issues: focusability, phantom focus,
// missing names, tab/visual order mismatches, and missing focus indicators.

import { escapeHtml, getActiveTab, showElement, hideElement, renderError, highlightElement, ensureContentCSS } from './utils.js';

let lastResult = null;
let currentView = 'type';
let currentSeverity = null; // null = all

// ─── Page-Injected Scanner ──────────────────────────────────────────────────

function keyboardScanFunc() {
  const INTERACTIVE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], summary, details, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="slider"], [role="spinbutton"], [role="combobox"], [role="textbox"], [role="searchbox"]';

  const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"], summary';

  function buildSel(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return tag + cls;
  }

  function getRegion(el) {
    let p = el;
    for (let i = 0; i < 20; i++) {
      if (!p || p === document.body || p === document.documentElement) break;
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

  function getComponent(el) {
    let p = el.parentElement;
    for (let i = 0; i < 10; i++) {
      if (!p || p === document.body) break;
      const tag = p.tagName.toLowerCase();
      const role = p.getAttribute('role') || '';
      const label = p.getAttribute('aria-label') || p.getAttribute('aria-labelledby') || '';
      if (['nav', 'form', 'dialog', 'menu', 'toolbar', 'tablist', 'listbox', 'grid', 'table'].includes(tag) ||
          ['navigation', 'form', 'dialog', 'alertdialog', 'menu', 'menubar', 'toolbar', 'tablist', 'listbox', 'grid', 'tree', 'treegrid'].includes(role)) {
        const name = label || p.id || tag;
        return name;
      }
      p = p.parentElement;
    }
    return 'page';
  }

  function getAccessibleName(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.getAttribute('aria-labelledby')) {
      const ids = el.getAttribute('aria-labelledby').split(/\s+/);
      const text = ids.map(id => {
        const ref = document.getElementById(id);
        return ref ? (ref.textContent || '').trim() : '';
      }).join(' ').trim();
      if (text) return text;
    }
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (el.id) {
        const label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (label) return (label.textContent || '').trim();
      }
      if (el.getAttribute('placeholder')) return el.getAttribute('placeholder');
      if (el.getAttribute('title')) return el.getAttribute('title');
    }
    if (el.tagName === 'IMG') return el.getAttribute('alt') || '';
    if (el.tagName === 'A' || el.tagName === 'BUTTON') {
      const text = (el.textContent || '').trim();
      if (text) return text;
      const img = el.querySelector('img[alt]');
      if (img) return img.getAttribute('alt');
    }
    return (el.textContent || '').trim().substring(0, 60);
  }

  const allInteractive = Array.from(document.querySelectorAll(INTERACTIVE)).filter(el => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.offsetParent === null && el.getAttribute('type') !== 'hidden' && style.position !== 'fixed') return false;
    if (el.disabled) return false;
    return true;
  });

  const allFocusable = Array.from(document.querySelectorAll(focusable)).filter(el => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.offsetParent === null && el.getAttribute('type') !== 'hidden' && style.position !== 'fixed') return false;
    return true;
  });

  const issues = [];

  // 1. Not Keyboard Focusable — interactive elements that can't be reached by keyboard
  allInteractive.forEach(el => {
    const ti = el.getAttribute('tabindex');
    if (ti !== null && parseInt(ti) >= 0) return;
    if (el.matches(focusable)) return;
    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    const hasClick = el.onclick !== null || el.getAttribute('onclick');
    if (!hasClick && !['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option', 'slider', 'spinbutton', 'combobox', 'textbox', 'searchbox'].includes(el.getAttribute('role') || '')) return;
    issues.push({
      type: 'not-focusable', severity: 'error',
      desc: `<${el.tagName.toLowerCase()}> with role="${role}" has no keyboard access`,
      name: getAccessibleName(el).substring(0, 60) || '(no name)',
      selector: buildSel(el), region: getRegion(el), component: getComponent(el),
      html: el.outerHTML.substring(0, 150)
    });
  });

  // 2. Phantom Focus — focusable but no interactive role/purpose
  allFocusable.forEach(el => {
    const role = el.getAttribute('role') || '';
    const tag = el.tagName.toLowerCase();
    const ti = el.getAttribute('tabindex');
    if (tag === 'div' || tag === 'span' || tag === 'li' || tag === 'p' || tag === 'section') {
      if (ti !== null && parseInt(ti) >= 0 && !role && !el.getAttribute('onclick') && el.onclick === null && !el.getAttribute('contenteditable')) {
        issues.push({
          type: 'phantom-focus', severity: 'error',
          desc: `<${tag}> is focusable (tabindex="${ti}") but has no interactive role or handler`,
          name: getAccessibleName(el).substring(0, 60) || '(no name)',
          selector: buildSel(el), region: getRegion(el), component: getComponent(el),
          html: el.outerHTML.substring(0, 150)
        });
      }
    }
  });

  // 3. No Accessible Name — focusable interactive elements with empty names
  allFocusable.forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) && el.getAttribute('type') === 'hidden') return;
    const name = getAccessibleName(el);
    if (!name || name.trim() === '') {
      issues.push({
        type: 'no-name', severity: 'error',
        desc: `<${tag}> is focusable but has no accessible name`,
        name: '(no name)',
        selector: buildSel(el), region: getRegion(el), component: getComponent(el),
        html: el.outerHTML.substring(0, 150)
      });
    }
  });

  // 4. Tab/Visual Order Mismatch — tab order differs from visual top-to-bottom, left-to-right
  const tabOrderEls = allFocusable.filter(el => {
    const ti = el.getAttribute('tabindex');
    return !ti || parseInt(ti) >= 0;
  });
  const rects = tabOrderEls.map(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, el };
  });
  const visualOrder = [...rects].sort((a, b) => {
    const rowDiff = Math.abs(a.top - b.top);
    if (rowDiff < 20) return a.left - b.left;
    return a.top - b.top;
  });
  const domOrder = rects;
  for (let i = 0; i < domOrder.length; i++) {
    const visualIdx = visualOrder.indexOf(domOrder[i]);
    if (Math.abs(visualIdx - i) > 3) {
      const el = domOrder[i].el;
      issues.push({
        type: 'order-mismatch', severity: 'warning',
        desc: `Tab position #${i + 1} but visually at position #${visualIdx + 1}`,
        name: getAccessibleName(el).substring(0, 60) || '(no name)',
        selector: buildSel(el), region: getRegion(el), component: getComponent(el),
        html: el.outerHTML.substring(0, 150)
      });
    }
  }

  // 5. Missing Focus Indicator — elements whose :focus outline/shadow is indistinguishable
  allFocusable.forEach(el => {
    const normal = getComputedStyle(el);
    const normalOutline = normal.outline;
    const normalShadow = normal.boxShadow;
    const normalBorder = normal.border;

    el.focus({ preventScroll: true });
    const focused = getComputedStyle(el);
    const focusOutline = focused.outline;
    const focusShadow = focused.boxShadow;
    const focusBorder = focused.border;
    el.blur();

    const outlineNone = !focusOutline || focusOutline === 'none' || focusOutline.includes('0px');
    const shadowSame = focusShadow === normalShadow;
    const borderSame = focusBorder === normalBorder;
    const outlineSame = focusOutline === normalOutline;

    if (outlineNone && shadowSame && borderSame && outlineSame) {
      issues.push({
        type: 'no-focus-indicator', severity: 'info',
        desc: `No visible focus style change detected`,
        name: getAccessibleName(el).substring(0, 60) || '(no name)',
        selector: buildSel(el), region: getRegion(el), component: getComponent(el),
        html: el.outerHTML.substring(0, 150)
      });
    }
  });

  return {
    total: issues.length,
    issues,
    focusableCount: allFocusable.length,
    interactiveCount: allInteractive.length
  };
}

// ─── Rendering ──────────────────────────────────────────────────────────────

const TYPE_META = {
  'not-focusable':      { label: 'Not Keyboard Focusable',       icon: '🚫' },
  'phantom-focus':      { label: 'Phantom Focus (No Interaction)', icon: '👻' },
  'no-name':            { label: 'No Accessible Name',            icon: '🏷' },
  'order-mismatch':     { label: 'Tab/Visual Order Mismatch',     icon: '🔀' },
  'no-focus-indicator': { label: 'Missing Focus Indicator',       icon: '👁' }
};

const SEVERITY_META = {
  'error':   { label: 'Error',   cls: 'kb-sev-error' },
  'warning': { label: 'Warning', cls: 'kb-sev-warning' },
  'info':    { label: 'Info',    cls: 'kb-sev-info' }
};

function renderStats(result) {
  const statsEl = document.getElementById('kb-audit-stats');
  const errors = result.issues.filter(i => i.severity === 'error').length;
  const warns  = result.issues.filter(i => i.severity === 'warning').length;
  const infos  = result.issues.filter(i => i.severity === 'info').length;

  statsEl.innerHTML = `
    <span class="kb-stat"><strong>${result.total}</strong> issues</span>
    <span class="kb-stat kb-stat-error"><strong>${errors}</strong> Errors</span>
    <span class="kb-stat kb-stat-warning"><strong>${warns}</strong> Warnings</span>
    <span class="kb-stat kb-stat-info"><strong>${infos}</strong> Infos</span>
  `;
  showElement(statsEl);
}

function renderSeverityPills(result) {
  const bar = document.getElementById('kb-severity-bar');
  const errors = result.issues.filter(i => i.severity === 'error').length;
  const warns  = result.issues.filter(i => i.severity === 'warning').length;
  const infos  = result.issues.filter(i => i.severity === 'info').length;

  bar.innerHTML = `
    <button class="kb-sev-pill kb-sev-pill-error ${currentSeverity === null || currentSeverity === 'error' ? 'active' : ''}" data-sev="error">Error <span class="kb-sev-count">${errors}</span></button>
    <button class="kb-sev-pill kb-sev-pill-warning ${currentSeverity === 'warning' ? 'active' : ''}" data-sev="warning">Warning <span class="kb-sev-count">${warns}</span></button>
    <button class="kb-sev-pill kb-sev-pill-info ${currentSeverity === 'info' ? 'active' : ''}" data-sev="info">Info <span class="kb-sev-count">${infos}</span></button>
  `;
  showElement(bar);

  bar.querySelectorAll('.kb-sev-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const sev = pill.dataset.sev;
      currentSeverity = currentSeverity === sev ? null : sev;
      renderSeverityPills(lastResult);
      renderIssues();
    });
  });
}

function renderViewToggles() {
  const bar = document.getElementById('kb-view-toggle');
  bar.innerHTML = `
    <button class="kb-view-btn ${currentView === 'type' ? 'active' : ''}" data-view="type">By Type</button>
    <button class="kb-view-btn ${currentView === 'region' ? 'active' : ''}" data-view="region">By Region</button>
    <button class="kb-view-btn ${currentView === 'component' ? 'active' : ''}" data-view="component">By Component</button>
  `;
  showElement(bar);

  bar.querySelectorAll('.kb-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      renderViewToggles();
      renderIssues();
    });
  });
}

function renderIssues() {
  const container = document.getElementById('kb-audit-results');
  if (!lastResult || lastResult.issues.length === 0) {
    container.innerHTML = '<div class="empty-state">No keyboard issues found ✅</div>';
    return;
  }

  let filtered = lastResult.issues;
  if (currentSeverity) {
    filtered = filtered.filter(i => i.severity === currentSeverity);
  }

  // Group
  const groups = {};
  filtered.forEach(issue => {
    let key;
    if (currentView === 'type') key = issue.type;
    else if (currentView === 'region') key = issue.region;
    else key = issue.component;
    if (!groups[key]) groups[key] = [];
    groups[key].push(issue);
  });

  let html = '';
  for (const [groupKey, items] of Object.entries(groups)) {
    const meta = currentView === 'type' ? TYPE_META[groupKey] : null;
    const label = meta ? meta.label : groupKey;
    const count = items.length;

    html += `<div class="kb-group">
      <div class="kb-group-header" data-toggle="kb-g-${escapeHtml(groupKey)}">
        <span class="kb-group-arrow">▸</span>
        <span class="kb-group-label">${escapeHtml(label)}</span>
        <span class="kb-group-count">${count}</span>
      </div>
      <div class="kb-group-body collapsed" id="kb-g-${escapeHtml(groupKey)}">`;

    items.forEach(issue => {
      const sevCls = SEVERITY_META[issue.severity]?.cls || '';
      html += `<div class="kb-issue-card sr-clickable ${sevCls}" data-selector="${escapeHtml(issue.selector)}" style="cursor:pointer">
        <div class="kb-issue-name">${escapeHtml(issue.name)}</div>
        <div class="kb-issue-desc">${escapeHtml(issue.desc)}</div>
        <div class="kb-issue-html"><code>${escapeHtml(issue.html)}</code></div>
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
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.kb-group-header')) return;
      const tab = await getActiveTab();
      await highlightElement(tab.id, item.dataset.selector);
    });
  });
}

// ─── Main Scan ──────────────────────────────────────────────────────────────

async function runKeyboardAudit() {
  const container = document.getElementById('kb-audit-results');
  const loading = document.getElementById('kb-audit-loading');
  const statsEl = document.getElementById('kb-audit-stats');
  const sevBar = document.getElementById('kb-severity-bar');
  const viewToggle = document.getElementById('kb-view-toggle');

  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  hideElement(sevBar);
  hideElement(viewToggle);

  currentSeverity = null;
  currentView = 'type';

  const tab = await getActiveTab();
  await ensureContentCSS(tab.id);

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: keyboardScanFunc
    });

    hideElement(loading);

    if (!result || result.issues.length === 0) {
      container.innerHTML = '<div class="empty-state">No keyboard issues found ✅</div>';
      statsEl.innerHTML = '<span class="kb-stat"><strong>0</strong> issues</span>';
      showElement(statsEl);
      return;
    }

    lastResult = result;
    renderStats(result);
    renderSeverityPills(result);
    renderViewToggles();
    renderIssues();

  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────

export function initKeyboardAudit() {
  document.getElementById('btn-run-kb-audit')?.addEventListener('click', runKeyboardAudit);
}
