// ─── Screen Reader Simulator Module ─────────────────────────────────────────
// Sub-tabs: Voice Preview, SR Flow, Shortcut Menu,
//           Name Audit, Focus Traps, Hidden Audit, Table Audit

import { escapeHtml, getActiveTab, showElement, hideElement, renderError, ensureContentCSS, highlightElement, sendBackgroundMessage } from './utils.js';
import { AMBIGUOUS_LINK_TEXTS } from './constants.js';

let voicePreviewActive = false;

// ─── Sub-tab Switching ──────────────────────────────────────────────────────

function switchSubTab(tabId) {
  document.querySelectorAll('#panel-screen-reader .sr-sub-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#panel-screen-reader .sr-sub-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`#panel-screen-reader .sr-sub-tab[data-sr-tab="${tabId}"]`)?.classList.add('active');
  document.getElementById('sr-panel-' + tabId)?.classList.add('active');
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. VOICE PREVIEW
// ═════════════════════════════════════════════════════════════════════════════

function voicePreviewPageFunc() {
  if (window.__a11yVoicePreview) window.__a11yVoicePreview.cleanup();

  const tooltip = document.createElement('div');
  tooltip.id = 'a11y-voice-tooltip';
  document.body.appendChild(tooltip);

  const highlight = document.createElement('div');
  highlight.id = 'a11y-voice-highlight';
  document.body.appendChild(highlight);

  let lastEl = null;

  function getStates(el) {
    const states = [];
    if (el.getAttribute('aria-expanded') === 'true') states.push('expanded');
    if (el.getAttribute('aria-expanded') === 'false') states.push('collapsed');
    if (el.getAttribute('aria-checked') === 'true') states.push('checked');
    if (el.getAttribute('aria-checked') === 'false') states.push('not checked');
    if (el.getAttribute('aria-selected') === 'true') states.push('selected');
    if (el.getAttribute('aria-pressed') === 'true') states.push('pressed');
    if (el.getAttribute('aria-disabled') === 'true') states.push('disabled');
    if (el.disabled) states.push('disabled');
    if (el.getAttribute('aria-required') === 'true' || el.required) states.push('required');
    if (el.getAttribute('aria-invalid') === 'true') states.push('invalid');
    return states;
  }

  function getDescription(el) {
    const describedBy = el.getAttribute('aria-describedby');
    if (!describedBy) return '';
    return describedBy.split(/\s+/).map(id => {
      const ref = document.getElementById(id);
      return ref ? ref.textContent.trim() : '';
    }).filter(Boolean).join(' ');
  }

  function getComputedName(el) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy.split(/\s+/).map(id => {
        const ref = document.getElementById(id);
        return ref ? ref.textContent.trim() : '';
      }).filter(Boolean).join(' ');
    }
    const alt = el.getAttribute('alt');
    if (alt !== null) return alt;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      const id = el.id;
      if (id) {
        const label = document.querySelector('label[for="' + CSS.escape(id) + '"]');
        if (label) return label.textContent.trim();
      }
    }
    const title = el.getAttribute('title');
    if (title) return title;
    return (el.textContent || '').trim().substring(0, 80);
  }

  function getRole(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    const roleMap = {
      a: 'link', button: 'button', input: 'textbox', select: 'combobox',
      textarea: 'textbox', nav: 'navigation', header: 'banner', footer: 'contentinfo',
      main: 'main', aside: 'complementary', h1: 'heading', h2: 'heading',
      h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
      img: 'img', dialog: 'dialog', table: 'table', form: 'form',
      ul: 'list', ol: 'list', li: 'listitem'
    };
    if (tag === 'input') {
      const t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'range') return 'slider';
      if (t === 'submit' || t === 'button' || t === 'reset') return 'button';
      return 'textbox';
    }
    return roleMap[tag] || tag;
  }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === tooltip || el === highlight) return;
    if (el === lastEl) return;
    lastEl = el;
    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.top = rect.top + window.scrollY + 'px';
    highlight.style.left = rect.left + window.scrollX + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    const role = getRole(el);
    const name = getComputedName(el);
    const states = getStates(el);
    const desc = getDescription(el);
    let html = '<div class="a11y-vp-role">' + role + '</div>';
    if (name) html += '<div class="a11y-vp-name">"' + name + '"</div>';
    else html += '<div class="a11y-vp-no-name">⚠ No accessible name</div>';
    if (states.length) html += '<div class="a11y-vp-state">State: ' + states.join(', ') + '</div>';
    if (desc) html += '<div class="a11y-vp-desc">Desc: "' + desc + '"</div>';
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    let top = e.clientY + window.scrollY + 20;
    let left = e.clientX + window.scrollX + 15;
    const tRect = tooltip.getBoundingClientRect();
    if (top + tRect.height > window.scrollY + window.innerHeight) top = e.clientY + window.scrollY - tRect.height - 10;
    if (left + tRect.width > window.scrollX + window.innerWidth) left = e.clientX + window.scrollX - tRect.width - 10;
    tooltip.style.top = Math.max(0, top) + 'px';
    tooltip.style.left = Math.max(0, left) + 'px';
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cleanup();
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('keydown', onKeyDown, true);
    tooltip.remove();
    highlight.remove();
    window.__a11yVoicePreview = null;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.__a11yVoicePreview = { cleanup };
}

async function startVoicePreview() {
  const tab = await getActiveTab();
  await ensureContentCSS(tab.id);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: voicePreviewPageFunc });
  voicePreviewActive = true;
  document.getElementById('btn-start-voice').classList.add('hidden');
  document.getElementById('btn-stop-voice').classList.remove('hidden');
}

async function stopVoicePreview() {
  const tab = await getActiveTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { if (window.__a11yVoicePreview) window.__a11yVoicePreview.cleanup(); }
  });
  voicePreviewActive = false;
  document.getElementById('btn-start-voice').classList.remove('hidden');
  document.getElementById('btn-stop-voice').classList.add('hidden');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. SR FLOW SIMULATION
// ═════════════════════════════════════════════════════════════════════════════

async function scanSRFlow() {
  const container = document.getElementById('sr-flow-results');
  const loading = document.getElementById('sr-flow-loading');
  const statsEl = document.getElementById('sr-flow-stats');
  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const nodes = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (!text) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent || parent.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
                if (getComputedStyle(parent).display === 'none' || getComputedStyle(parent).visibility === 'hidden') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              }
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
                const tag = node.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)) return NodeFilter.FILTER_REJECT;
                const role = node.getAttribute('role');
                const isInteractive = ['a', 'button', 'input', 'select', 'textarea', 'img',
                  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'th', 'td', 'li',
                  'summary', 'details', 'dialog'].includes(tag) || role;
                if (isInteractive) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
              }
              return NodeFilter.FILTER_SKIP;
            }
          }
        );

        let node;
        let idx = 0;
        while ((node = walker.nextNode()) && idx < 300) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim().substring(0, 120);
            nodes.push({ idx: ++idx, type: 'text', announcement: text });
          } else {
            const el = node;
            const tag = el.tagName.toLowerCase();
            const role = el.getAttribute('role') || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const alt = el.getAttribute('alt');
            const text = (el.textContent || '').trim().substring(0, 60);
            let displayRole = role;
            if (!displayRole) {
              const map = {
                a: 'link', button: 'button', input: 'textbox', select: 'combobox',
                textarea: 'textbox', img: 'img', h1: 'heading', h2: 'heading',
                h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
                table: 'table', th: 'columnheader', td: 'cell', li: 'listitem',
                summary: 'button', dialog: 'dialog'
              };
              displayRole = map[tag] || tag;
            }
            let name = ariaLabel || (alt !== null && alt !== undefined ? alt : '') || text;
            if (tag === 'input') {
              const id = el.id;
              if (id) {
                const lbl = document.querySelector('label[for="' + CSS.escape(id) + '"]');
                if (lbl) name = lbl.textContent.trim();
              }
              if (!name) name = el.placeholder || '';
            }
            const states = [];
            if (el.getAttribute('aria-expanded')) states.push(el.getAttribute('aria-expanded') === 'true' ? 'expanded' : 'collapsed');
            if (el.getAttribute('aria-checked') === 'true') states.push('checked');
            if (el.disabled || el.getAttribute('aria-disabled') === 'true') states.push('disabled');
            const level = /^h[1-6]$/.test(tag) ? tag[1] : '';

            nodes.push({
              idx: ++idx,
              type: 'element',
              tag,
              role: displayRole,
              name: name.substring(0, 80),
              states,
              level,
              announcement: displayRole + (name ? ' "' + name.substring(0, 60) + '"' : '') +
                (states.length ? ' (' + states.join(', ') + ')' : '') +
                (level ? ' level ' + level : '')
            });
          }
        }
        return nodes;
      }
    });

    hideElement(loading);
    if (!result || result.length === 0) {
      container.innerHTML = '<div class="empty-state">No content found</div>';
      return;
    }
    statsEl.innerHTML = `<span class="stat-num">${result.length}</span> nodes in reading order`;
    showElement(statsEl);

    let html = '<div class="sr-flow-list">';
    result.forEach(n => {
      if (n.type === 'text') {
        html += `<div class="sr-flow-item sr-flow-text"><span class="sr-flow-idx">${n.idx}</span> <span class="sr-flow-content">${escapeHtml(n.announcement)}</span></div>`;
      } else {
        const roleClass = ['link', 'button', 'heading', 'img', 'textbox', 'checkbox', 'radio', 'combobox'].includes(n.role) ? ' sr-flow-interactive' : '';
        html += `<div class="sr-flow-item${roleClass}"><span class="sr-flow-idx">${n.idx}</span> <span class="sr-flow-role">${escapeHtml(n.role)}</span> <span class="sr-flow-content">${escapeHtml(n.name || '')}</span>${n.states.length ? ' <span class="sr-flow-state">(' + escapeHtml(n.states.join(', ')) + ')</span>' : ''}</div>`;
      }
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. READING ORDER (visual overlay on page)
// ═════════════════════════════════════════════════════════════════════════════

async function showReadingOrder() {
  const tab = await getActiveTab();
  await ensureContentCSS(tab.id);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document.querySelectorAll('.a11y-reading-order-badge').forEach(el => el.remove());

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode(node) {
            if (node.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
            const tag = node.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'template', 'meta', 'link'].includes(tag)) return NodeFilter.FILTER_REJECT;
            const hasText = (node.textContent || '').trim().length > 0;
            const isWidget = ['a', 'button', 'input', 'select', 'textarea', 'img',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag) || node.getAttribute('role');
            if (hasText || isWidget) {
              const childElements = Array.from(node.children).filter(c => {
                const s = getComputedStyle(c);
                return s.display !== 'none' && s.visibility !== 'hidden' && c.getAttribute('aria-hidden') !== 'true';
              });
              if (childElements.length === 0 || isWidget) return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      let node, idx = 0;
      while ((node = walker.nextNode()) && idx < 200) {
        idx++;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const badge = document.createElement('div');
        badge.className = 'a11y-reading-order-badge';
        badge.textContent = idx;
        badge.style.top = (rect.top + window.scrollY - 8) + 'px';
        badge.style.left = (rect.left + window.scrollX - 8) + 'px';
        document.body.appendChild(badge);
      }
    }
  });
  document.getElementById('btn-show-reading-order').classList.add('hidden');
  document.getElementById('btn-hide-reading-order').classList.remove('hidden');
}

async function hideReadingOrder() {
  const tab = await getActiveTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => { document.querySelectorAll('.a11y-reading-order-badge').forEach(el => el.remove()); }
  });
  document.getElementById('btn-show-reading-order').classList.remove('hidden');
  document.getElementById('btn-hide-reading-order').classList.add('hidden');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. SHORTCUT MENU SCAN (with pass results + clickable items)
// ═════════════════════════════════════════════════════════════════════════════

async function scanShortcutMenu() {
  const container = document.getElementById('sr-shortcut-results');
  const loading = document.getElementById('sr-shortcut-loading');
  const statsEl = document.getElementById('sr-shortcut-stats');
  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (ambiguousTexts) => {
        function buildSel(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          el.setAttribute('data-a11y-sc-idx', el.dataset.a11yScIdx || String(Math.random()).slice(2, 10));
          return '[data-a11y-sc-idx="' + el.dataset.a11yScIdx + '"]';
        }

        const links = Array.from(document.querySelectorAll('a[href]')).map(a => {
          const text = (a.textContent || '').trim().replace(/\s+/g, ' ');
          return {
            type: 'link', text, href: a.href, selector: buildSel(a),
            isSkipLink: !!(a.getAttribute('href') || '').startsWith('#') && !a.closest('main')
          };
        });

        const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).map(b => ({
          type: 'button',
          text: (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' '),
          selector: buildSel(b)
        }));

        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          type: 'heading',
          text: (h.textContent || '').trim().replace(/\s+/g, ' '),
          level: parseInt(h.tagName[1]),
          selector: buildSel(h)
        }));

        const formFields = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea')).map(f => {
          const id = f.id;
          const label = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
          return {
            type: 'form',
            text: f.getAttribute('aria-label') || (label ? label.textContent.trim() : '') || f.placeholder || '(unlabeled)',
            fieldType: f.type || f.tagName.toLowerCase(),
            selector: buildSel(f)
          };
        });

        const linksByText = {};
        links.forEach(l => {
          const key = l.text.toLowerCase();
          if (!linksByText[key]) linksByText[key] = [];
          linksByText[key].push(l);
        });
        const duplicates = {};
        for (const [key, arr] of Object.entries(linksByText)) {
          const uniqueHrefs = new Set(arr.map(l => l.href));
          if (arr.length > 1 && uniqueHrefs.size > 1) duplicates[key] = arr.length;
        }
        const ambiguousCount = links.filter(l => ambiguousTexts.includes(l.text.toLowerCase())).length;

        return { links, buttons, headings, formFields, duplicates, ambiguousCount };
      },
      args: [AMBIGUOUS_LINK_TEXTS]
    });

    hideElement(loading);
    const issues = Object.keys(result.duplicates).length + result.ambiguousCount;
    const parts = [
      `<span class="stat-num">${result.links.length}</span> links`,
      `<span class="stat-num">${result.buttons.length}</span> buttons`,
      `<span class="stat-num">${result.headings.length}</span> headings`,
      `<span class="stat-num">${result.formFields.length}</span> form fields`
    ];
    if (issues > 0) parts.push(`<span class="stat-num sr-stat-issue">${issues}</span> issues`);
    statsEl.innerHTML = parts.join(' &middot; ');
    showElement(statsEl);

    let html = '';

    // Issues section
    if (issues > 0) {
      html += `<div class="sr-section"><div class="sr-section-header sr-section-error" data-toggle="sr-issues">\u26a0\ufe0f Issues (${issues})</div><div class="sr-section-body" id="sr-issues">`;
      for (const [text, count] of Object.entries(result.duplicates)) {
        const firstLink = result.links.find(l => l.text.toLowerCase() === text);
        const sel = firstLink ? firstLink.selector : '';
        html += `<div class="sr-item sr-item-error sr-clickable" data-selector="${escapeHtml(sel)}"><span class="sr-item-badge">Duplicate</span> "${escapeHtml(text)}" \u2014 ${count} links to different URLs</div>`;
      }
      result.links.filter(l => AMBIGUOUS_LINK_TEXTS.includes(l.text.toLowerCase())).forEach(l => {
        html += `<div class="sr-item sr-item-warn sr-clickable" data-selector="${escapeHtml(l.selector)}"><span class="sr-item-badge sr-badge-warn">Ambiguous</span> <span class="sr-item-text">"${escapeHtml(l.text)}"</span></div>`;
      });
      html += '</div></div>';
    }

    // Links
    html += buildSection('\ud83d\udd17', 'Links', 'sr-links', result.links, l => {
      const dup = result.duplicates[l.text.toLowerCase()];
      const amb = AMBIGUOUS_LINK_TEXTS.includes(l.text.toLowerCase());
      const cls = dup ? ' sr-item-error' : amb ? ' sr-item-warn' : ' sr-item-pass';
      const icon = dup ? '\u274c' : amb ? '\u26a0\ufe0f' : '\u2705';
      const skip = l.isSkipLink ? '<span class="sr-item-badge sr-badge-skip">Skip</span> ' : '';
      return `<div class="sr-item${cls} sr-clickable" data-selector="${escapeHtml(l.selector)}">${skip}${icon} <span class="sr-item-text">${escapeHtml(l.text || '(empty)')}</span> <span class="sr-item-href">${escapeHtml((l.href || '').substring(0, 50))}</span></div>`;
    });

    // Buttons
    html += buildSection('\ud83d\udd18', 'Buttons', 'sr-buttons', result.buttons, b => {
      const icon = b.text ? '\u2705' : '\u274c';
      const cls = b.text ? ' sr-item-pass' : ' sr-item-error';
      return `<div class="sr-item${cls} sr-clickable" data-selector="${escapeHtml(b.selector)}">${icon} <span class="sr-item-text">${escapeHtml(b.text || '\u26a0 No name')}</span></div>`;
    });

    // Headings
    html += buildSection('\ud83d\udcd1', 'Headings', 'sr-headings', result.headings, h => {
      return `<div class="sr-item sr-item-pass sr-clickable" data-selector="${escapeHtml(h.selector)}"><span class="sr-item-level">H${h.level}</span> <span class="sr-item-text">${escapeHtml(h.text || '(empty)')}</span></div>`;
    });

    // Form Fields
    html += buildSection('\ud83d\udcdd', 'Form Fields', 'sr-forms', result.formFields, f => {
      const hasLabel = f.text && f.text !== '(unlabeled)';
      const icon = hasLabel ? '\u2705' : '\u274c';
      const cls = hasLabel ? ' sr-item-pass' : ' sr-item-error';
      return `<div class="sr-item${cls} sr-clickable" data-selector="${escapeHtml(f.selector)}">${icon} <span class="sr-item-text">${escapeHtml(f.text)}</span> <span class="sr-item-href">${escapeHtml(f.fieldType)}</span></div>`;
    });

    container.innerHTML = html;

    // Toggle sections
    container.querySelectorAll('.sr-section-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const body = document.getElementById(hdr.dataset.toggle);
        if (body) body.classList.toggle('collapsed');
      });
    });

    // Click to highlight on page
    container.querySelectorAll('.sr-clickable[data-selector]').forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        await highlightElement(tab.id, item.dataset.selector);
      });
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

function buildSection(icon, title, bodyId, items, renderItem) {
  let html = `<div class="sr-section"><div class="sr-section-header" data-toggle="${bodyId}">${icon} ${title} (${items.length})</div><div class="sr-section-body collapsed" id="${bodyId}">`;
  items.forEach(item => { html += renderItem(item); });
  html += '</div></div>';
  return html;
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. NAME AUDIT (moved from name-calc-test)
// ═════════════════════════════════════════════════════════════════════════════

async function runNameAudit() {
  const container = document.getElementById('sr-name-results');
  const loading = document.getElementById('sr-name-loading');
  const statsEl = document.getElementById('sr-name-stats');
  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  const tab = await getActiveTab();

  try {
    const [{ result: candidates }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const results = [];
        const MAX = 50;

        function buildSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const idx = Array.from(document.querySelectorAll(tag)).indexOf(el);
          return tag + ':nth-of-type(' + (idx + 1) + ')';
        }

        // aria-label overrides visible text
        document.querySelectorAll('[aria-label]').forEach(el => {
          if (results.length >= MAX) return;
          const ariaLabel = el.getAttribute('aria-label') || '';
          const innerText = (el.textContent || '').trim();
          if (ariaLabel && innerText && ariaLabel !== innerText) {
            results.push({
              type: 'override', html: el.outerHTML.substring(0, 200),
              visibleText: innerText.substring(0, 80), expectedName: ariaLabel,
              expectedSource: 'aria-label overrides text content', selector: buildSelector(el)
            });
          }
        });

        // aria-labelledby references
        document.querySelectorAll('[aria-labelledby]').forEach(el => {
          if (results.length >= MAX) return;
          const ids = el.getAttribute('aria-labelledby').split(/\s+/);
          const refText = ids.map(id => {
            const ref = document.getElementById(id);
            return ref ? ref.textContent.trim() : '';
          }).filter(Boolean).join(' ');
          if (refText) {
            results.push({
              type: 'labelledby', html: el.outerHTML.substring(0, 200),
              visibleText: (el.textContent || '').trim().substring(0, 80), expectedName: refText,
              expectedSource: 'aria-labelledby \u2192 ' + ids.join(', '), selector: buildSelector(el)
            });
          }
        });

        // Focusable inside aria-hidden
        document.querySelectorAll('[aria-hidden="true"]').forEach(cont => {
          if (results.length >= MAX) return;
          cont.querySelectorAll('button, a[href], input, select, textarea, [tabindex]').forEach(el => {
            if (results.length >= MAX) return;
            results.push({
              type: 'hidden', html: el.outerHTML.substring(0, 200),
              visibleText: (el.textContent || '').trim().substring(0, 80),
              expectedName: '(should be hidden)', expectedSource: 'Inside aria-hidden="true"',
              selector: buildSelector(el), shouldBeHidden: true
            });
          });
        });

        // Title fallback
        document.querySelectorAll('input[title], select[title], textarea[title], a[title], button[title]').forEach(el => {
          if (results.length >= MAX) return;
          if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.textContent.trim()) {
            if (el.id && !document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) {
              results.push({
                type: 'title-fallback', html: el.outerHTML.substring(0, 200),
                visibleText: '(no visible label)', expectedName: el.getAttribute('title'),
                expectedSource: 'title attribute (last resort)', selector: buildSelector(el)
              });
            }
          }
        });

        // Placeholder fallback
        document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
          if (results.length >= MAX) return;
          if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
            const id = el.id;
            const hasLabel = id && document.querySelector('label[for="' + CSS.escape(id) + '"]');
            if (!hasLabel && !el.closest('label') && !el.getAttribute('title')) {
              results.push({
                type: 'placeholder-fallback', html: el.outerHTML.substring(0, 200),
                visibleText: '(placeholder: ' + el.getAttribute('placeholder') + ')',
                expectedName: el.getAttribute('placeholder'),
                expectedSource: 'placeholder (not a sufficient label)', selector: buildSelector(el)
              });
            }
          }
        });

        return results;
      }
    });

    if (!candidates || candidates.length === 0) {
      hideElement(loading);
      container.innerHTML = '<div class="empty-state">No tricky name scenarios found</div>';
      return;
    }

    const computedNames = await sendBackgroundMessage({
      type: 'getAccessibleNames', tabId: tab.id,
      selectors: candidates.map(c => c.selector)
    });
    hideElement(loading);

    let passCount = 0, warnCount = 0, failCount = 0;

    candidates.forEach((c, i) => {
      const computed = computedNames?.names?.[i] || {};
      const computedName = computed.name || '';
      const computedRole = computed.role || '';
      const isHiddenInTree = computed.ignored || false;
      let status, statusClass, statusIcon;

      if (c.shouldBeHidden) {
        if (isHiddenInTree) { status = 'Correctly hidden'; statusClass = 'name-pass'; statusIcon = '\u2705'; passCount++; }
        else { status = 'Should be hidden but in tree'; statusClass = 'name-fail'; statusIcon = '\u274c'; failCount++; }
      } else if (c.type === 'override') {
        if (computedName === c.expectedName) { status = 'aria-label correctly overrides'; statusClass = 'name-pass'; statusIcon = '\u2705'; passCount++; }
        else { status = 'Name mismatch'; statusClass = 'name-fail'; statusIcon = '\u274c'; failCount++; }
      } else if (c.type === 'labelledby') {
        if (computedName === c.expectedName) { status = 'Resolved correctly'; statusClass = 'name-pass'; statusIcon = '\u2705'; passCount++; }
        else { status = 'Name mismatch'; statusClass = 'name-warn'; statusIcon = '\u26a0\ufe0f'; warnCount++; }
      } else if (c.type === 'placeholder-fallback') {
        status = 'Uses placeholder (insufficient)'; statusClass = 'name-warn'; statusIcon = '\u26a0\ufe0f'; warnCount++;
      } else if (c.type === 'title-fallback') {
        status = 'Uses title as fallback'; statusClass = 'name-warn'; statusIcon = '\u26a0\ufe0f'; warnCount++;
      } else {
        if (computedName) { status = 'Has computed name'; statusClass = 'name-pass'; statusIcon = '\u2705'; passCount++; }
        else { status = 'No accessible name'; statusClass = 'name-fail'; statusIcon = '\u274c'; failCount++; }
      }

      const item = document.createElement('div');
      item.className = 'result-item ' + statusClass;
      item.innerHTML = `<div class="result-item-header">
        <span class="result-item-title">${statusIcon} ${escapeHtml(c.type.replace('-', ' '))}</span>
        <span class="ax-badge ax-badge-${statusClass === 'name-pass' ? 'state' : statusClass === 'name-warn' ? 'warn' : 'invalid'}">${escapeHtml(status)}</span>
      </div>
      <div class="name-calc-detail">
        <div class="name-calc-row"><span class="ax-pick-label">Source</span><span>${escapeHtml(c.expectedSource)}</span></div>
        <div class="name-calc-row"><span class="ax-pick-label">Visible</span><span>${escapeHtml(c.visibleText || '(none)')}</span></div>
        <div class="name-calc-row"><span class="ax-pick-label">Expected</span><span class="ax-name-primary">${escapeHtml(c.expectedName)}</span></div>
        <div class="name-calc-row"><span class="ax-pick-label">Computed</span><span class="ax-name-primary">${escapeHtml(computedName || '(empty)')}</span></div>
        ${computedRole ? '<div class="name-calc-row"><span class="ax-pick-label">Role</span><span class="ax-badge ax-badge-role">' + escapeHtml(computedRole) + '</span></div>' : ''}
      </div>
      <div class="result-item-details"><div class="detail-node">${escapeHtml(c.html)}</div></div>`;
      item.querySelector('.result-item-header')?.addEventListener('click', () => item.classList.toggle('expanded'));
      container.appendChild(item);
    });

    statsEl.innerHTML = `<span class="stat-num">${candidates.length}</span> tests &middot; <span class="stat-num">${passCount}</span> pass` +
      (warnCount ? ` &middot; <span class="stat-num">${warnCount}</span> warn` : '') +
      ` &middot; <span class="stat-num sr-stat-issue">${failCount}</span> fail`;
    showElement(statsEl);
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. FOCUS TRAP DETECTOR
// ═════════════════════════════════════════════════════════════════════════════

async function scanFocusTraps() {
  const container = document.getElementById('sr-trap-results');
  const loading = document.getElementById('sr-trap-loading');
  showElement(loading);
  container.innerHTML = '';
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
        const modals = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog, .modal'));
        return modals.map(modal => {
          const role = modal.getAttribute('role') || modal.tagName.toLowerCase();
          const ariaModal = modal.getAttribute('aria-modal') === 'true';
          const isOpen = modal.tagName === 'DIALOG' ? modal.open : !modal.hidden && getComputedStyle(modal).display !== 'none';
          const focusable = Array.from(modal.querySelectorAll(focusableSelector));
          const closeBtn = modal.querySelector('button[aria-label*="close" i], button[aria-label*="dismiss" i], button[aria-label*="cancel" i], [data-dismiss], .close, .modal-close') ||
            Array.from(modal.querySelectorAll('button')).find(b => /close|dismiss|cancel|\u00d7|\u2715/i.test(b.textContent));
          // Initial focus check: autofocus attr or tabindex on container
          const hasAutofocus = !!modal.querySelector('[autofocus]');
          const hasTabindexSelf = modal.hasAttribute('tabindex');
          const initialFocusReady = hasAutofocus || hasTabindexSelf || focusable.length > 0;
          // Trigger element check: look for aria-haspopup, aria-controls, data-toggle pointing to this modal
          const modalId = modal.id;
          const hasTrigger = modalId ? !!document.querySelector(`[aria-controls="${CSS.escape(modalId)}"], [aria-haspopup][aria-controls="${CSS.escape(modalId)}"], [data-target="#${CSS.escape(modalId)}"], [data-bs-target="#${CSS.escape(modalId)}"]`) : false;
          let selector = modal.id ? '#' + CSS.escape(modal.id) : modal.tagName.toLowerCase() +
            (modal.className && typeof modal.className === 'string' ? '.' + modal.className.trim().split(/\s+/)[0] : '');
          return {
            selector, role, ariaModal, isOpen,
            focusableCount: focusable.length,
            hasCloseBtn: !!closeBtn,
            label: modal.getAttribute('aria-label') || '',
            initialFocusReady, hasTrigger, hasAutofocus
          };
        });
      }
    });
    hideElement(loading);
    if (!result || result.length === 0) {
      container.innerHTML = '<div class="empty-state">No dialogs or modals found</div>';
      return;
    }
    let html = '<div class="sr-disclaimer">\u26a0\ufe0f Heuristic scan \u2014 manual verification recommended</div>';
    result.forEach(m => {
      let severity = 'pass', statusText = 'Proper focus management';
      if (!m.hasCloseBtn && m.isOpen) { severity = 'fail'; statusText = 'No close mechanism detected'; }
      else if (!m.ariaModal && m.isOpen) { severity = 'warn'; statusText = 'No aria-modal \u2014 focus may escape'; }
      else if (!m.isOpen) { severity = 'neutral'; statusText = 'Hidden \u2014 test when open'; }
      const dot = severity === 'fail' ? '\ud83d\udd34' : severity === 'warn' ? '\ud83d\udfe0' : severity === 'pass' ? '\ud83d\udfe2' : '\u26aa';
      const fixes = [];
      if (!m.ariaModal && m.isOpen) fixes.push('<div class="sr-fix-suggestion">\ud83d\udca1 Add <code>aria-modal="true"</code> to trap focus inside the dialog</div>');
      if (!m.hasCloseBtn && m.isOpen) fixes.push('<div class="sr-fix-suggestion">\ud83d\udca1 Add a close button with <code>aria-label="Close"</code></div>');
      if (m.focusableCount === 0 && m.isOpen) fixes.push('<div class="sr-fix-suggestion">\ud83d\udca1 Ensure at least one focusable element inside the dialog</div>');
      if (!m.initialFocusReady && m.isOpen) fixes.push('<div class="sr-fix-suggestion">\ud83d\udca1 Add <code>autofocus</code> to the first interactive element or <code>tabindex="-1"</code> on the dialog for initial focus</div>');
      if (!m.hasTrigger && m.isOpen) fixes.push('<div class="sr-fix-suggestion">\ud83d\udca1 No trigger element found \u2014 ensure focus returns to the opener button when the dialog closes</div>');
      html += `<div class="sr-trap-card sr-trap-${severity} sr-clickable" data-selector="${escapeHtml(m.selector)}" style="cursor:pointer">
        <div class="sr-trap-header"><span>${dot}</span> <code>${escapeHtml(m.selector)}</code></div>
        <div class="sr-trap-details">
          <div>Role: <strong>${escapeHtml(m.role)}</strong>${m.label ? ' \u2014 "' + escapeHtml(m.label) + '"' : ''}</div>
          <div>aria-modal: ${m.ariaModal ? '\u2705 true' : '\u274c false'}</div>
          <div>Close button: ${m.hasCloseBtn ? '\u2705 found' : '\u274c not found'}</div>
          <div>Initial focus: ${m.hasAutofocus ? '\u2705 autofocus set' : m.initialFocusReady ? '\u26a0\ufe0f no autofocus, but focusable elements exist' : '\u274c no focusable elements'}</div>
          <div>Return-focus trigger: ${m.hasTrigger ? '\u2705 trigger found (aria-controls)' : '\u26a0\ufe0f no trigger element detected'}</div>
          <div>Focusable elements: ${m.focusableCount}</div>
          <div>Status: ${statusText}</div>
          ${fixes.join('\n          ')}
        </div>
      </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.sr-clickable[data-selector]').forEach(item => {
      item.addEventListener('click', async () => {
        await highlightElement(tab.id, item.dataset.selector);
      });
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. HIDDEN CONTENT AUDIT
// ═════════════════════════════════════════════════════════════════════════════

async function scanHiddenContent() {
  const container = document.getElementById('sr-hidden-results');
  const loading = document.getElementById('sr-hidden-loading');
  const statsEl = document.getElementById('sr-hidden-stats');
  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const issues = [];

        // 1. aria-hidden on visible elements with content
        document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
          const style = getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0) {
            const text = (el.textContent || '').trim();
            if (text.length > 0) {
              issues.push({
                type: 'visible-but-hidden', severity: 'warn',
                desc: 'Visible content hidden from screen readers',
                text: text.substring(0, 80), html: el.outerHTML.substring(0, 150),
                selector: el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase()
              });
            }
          }
        });

        // 2. Focusable elements inside aria-hidden
        document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] input, [aria-hidden="true"] select, [aria-hidden="true"] textarea, [aria-hidden="true"] [tabindex]:not([tabindex="-1"])').forEach(el => {
          if (el.disabled) return;
          issues.push({
            type: 'focusable-in-hidden', severity: 'fail',
            desc: 'Focusable element inside aria-hidden (keyboard trap risk)',
            text: (el.textContent || '').trim().substring(0, 60),
            html: el.outerHTML.substring(0, 150),
            selector: el.id ? '#' + CSS.escape(el.id) : el.tagName.toLowerCase()
          });
        });

        // 3. SR-only text (informational)
        document.querySelectorAll('.sr-only, .visually-hidden, .screen-reader-text, .screen-reader-only').forEach(el => {
          const text = (el.textContent || '').trim();
          if (text) {
            issues.push({
              type: 'sr-only-text', severity: 'info',
              desc: 'SR-only text (hidden visually, announced by screen reader)',
              text: text.substring(0, 80), html: el.outerHTML.substring(0, 150),
              selector: el.id ? '#' + CSS.escape(el.id) : el.className
            });
          }
        });

        // 4. Images without alt
        document.querySelectorAll('img:not([alt])').forEach(el => {
          if (el.closest('[aria-hidden="true"]')) return;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          issues.push({
            type: 'img-no-alt', severity: 'fail',
            desc: 'Image without alt \u2014 SR announces file name',
            text: (el.src || '').split('/').pop()?.substring(0, 60) || '',
            html: el.outerHTML.substring(0, 150),
            selector: el.id ? '#' + CSS.escape(el.id) : 'img[src*="' + ((el.src || '').split('/').pop() || '') + '"]'
          });
        });

        return issues;
      }
    });
    hideElement(loading);
    if (!result || result.length === 0) {
      container.innerHTML = '<div class="empty-state">No hidden content issues found \u2705</div>';
      return;
    }
    const fails = result.filter(r => r.severity === 'fail').length;
    const warns = result.filter(r => r.severity === 'warn').length;
    const infos = result.filter(r => r.severity === 'info').length;
    statsEl.innerHTML = [
      `<span class="stat-num">${result.length}</span> items`,
      fails ? `<span class="stat-num sr-stat-issue">${fails}</span> errors` : '',
      warns ? `<span class="stat-num">${warns}</span> warnings` : '',
      infos ? `<span class="stat-num">${infos}</span> info` : ''
    ].filter(Boolean).join(' &middot; ');
    showElement(statsEl);

    const severityOrder = { fail: 0, warn: 1, info: 2 };
    result.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    let html = '';
    result.forEach(r => {
      const icon = r.severity === 'fail' ? '\ud83d\udd34' : r.severity === 'warn' ? '\ud83d\udfe0' : '\u2139\ufe0f';
      const cls = r.severity === 'fail' ? 'sr-item-error' : r.severity === 'warn' ? 'sr-item-warn' : 'sr-item-pass';
      let fix = '';
      if (r.type === 'visible-but-hidden') fix = '<div class="sr-fix-suggestion">\ud83d\udca1 Remove <code>aria-hidden="true"</code> or hide visually with <code>display:none</code></div>';
      else if (r.type === 'focusable-in-hidden') fix = '<div class="sr-fix-suggestion">\ud83d\udca1 Add <code>tabindex="-1"</code> or move element outside <code>aria-hidden</code> region</div>';
      else if (r.type === 'img-no-alt') fix = '<div class="sr-fix-suggestion">\ud83d\udca1 Add <code>alt="description"</code> or <code>alt=""</code> if decorative</div>';
      html += `<div class="sr-item ${cls} sr-clickable" data-selector="${escapeHtml(r.selector)}" style="cursor:pointer">
        <div>${icon} <strong>${escapeHtml(r.type.replace(/-/g, ' '))}</strong></div>
        <div class="sr-hidden-desc">${escapeHtml(r.desc)}</div>
        ${r.text ? '<div class="sr-hidden-text">"' + escapeHtml(r.text) + '"</div>' : ''}
        <div class="sr-hidden-html"><code>${escapeHtml(r.html)}</code></div>
        ${fix}
      </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.sr-clickable[data-selector]').forEach(item => {
      item.addEventListener('click', async () => {
        await highlightElement(tab.id, item.dataset.selector);
      });
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. TABLE AUDIT
// ═════════════════════════════════════════════════════════════════════════════

async function scanTables() {
  const container = document.getElementById('sr-table-results');
  const loading = document.getElementById('sr-table-loading');
  const statsEl = document.getElementById('sr-table-stats');
  showElement(loading);
  container.innerHTML = '';
  hideElement(statsEl);
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const tables = Array.from(document.querySelectorAll('table'));
        return tables.map((table, i) => {
          const caption = table.querySelector('caption');
          const ths = table.querySelectorAll('th');
          const tds = table.querySelectorAll('td');
          const rows = table.querySelectorAll('tr');
          const role = table.getAttribute('role');
          const ariaLabel = table.getAttribute('aria-label') || '';
          const isLayout = role === 'presentation' || role === 'none';

          const issues = [];
          if (!isLayout && tds.length > 0 && ths.length === 0) issues.push('No <th> header cells \u2014 SR cannot identify columns/rows');
          const thsWithoutScope = Array.from(ths).filter(th => !th.getAttribute('scope'));
          if (thsWithoutScope.length > 0 && ths.length > 0) issues.push(thsWithoutScope.length + ' <th> cells missing scope attribute');
          if (!isLayout && !caption && !ariaLabel) issues.push('No <caption> or aria-label \u2014 table has no accessible name');
          if (isLayout && ths.length > 0) issues.push('Layout table (role="' + role + '") contains <th> \u2014 may confuse SR');
          const emptyThs = Array.from(ths).filter(th => !(th.textContent || '').trim());
          if (emptyThs.length > 0) issues.push(emptyThs.length + ' empty <th> cells');
          const cellsWithHeaders = table.querySelectorAll('td[headers], th[headers]');
          const hasHeadersAttr = cellsWithHeaders.length > 0;

          const selector = table.id ? '#' + CSS.escape(table.id) : 'table:nth-of-type(' + (i + 1) + ')';

          return {
            selector, caption: caption ? caption.textContent.trim().substring(0, 60) : '',
            ariaLabel, role: role || 'table', isLayout,
            thCount: ths.length, tdCount: tds.length, rowCount: rows.length,
            hasHeadersAttr, issues
          };
        });
      }
    });
    hideElement(loading);
    if (!result || result.length === 0) {
      container.innerHTML = '<div class="empty-state">No tables found on this page</div>';
      return;
    }
    const withIssues = result.filter(t => t.issues.length > 0).length;
    statsEl.innerHTML = `<span class="stat-num">${result.length}</span> tables` +
      (withIssues ? ` &middot; <span class="stat-num sr-stat-issue">${withIssues}</span> with issues` : ' &middot; <span class="stat-num">0</span> issues \u2705');
    showElement(statsEl);

    let html = '';
    result.forEach(t => {
      const severity = t.issues.length === 0 ? 'pass' : t.isLayout ? 'warn' : 'fail';
      const icon = severity === 'pass' ? '\ud83d\udfe2' : severity === 'warn' ? '\ud83d\udfe0' : '\ud83d\udd34';
      html += `<div class="sr-trap-card sr-trap-${severity}">
        <div class="sr-trap-header">${icon} <code>${escapeHtml(t.selector)}</code></div>
        <div class="sr-trap-details">
          <div>${t.isLayout ? '\ud83d\udcd0 Layout table' : '\ud83d\udcca Data table'} \u2014 ${t.rowCount} rows, ${t.thCount} headers, ${t.tdCount} data cells</div>
          ${t.caption ? '<div>Caption: "' + escapeHtml(t.caption) + '"</div>' : ''}
          ${t.ariaLabel ? '<div>aria-label: "' + escapeHtml(t.ariaLabel) + '"</div>' : ''}
          ${t.hasHeadersAttr ? '<div>\u2705 Uses headers attribute for complex associations</div>' : ''}
          ${t.issues.length > 0 ? '<div class="sr-table-issues">' + t.issues.map(issue => '<div class="sr-table-issue">\u274c ' + escapeHtml(issue) + '</div>').join('') + '</div>' : '<div style="color:#2e7d32;margin-top:4px">\u2705 No issues detected</div>'}
        </div>
      </div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. ARIA VALIDATION
// ═════════════════════════════════════════════════════════════════════════════

async function scanAriaValidation() {
  const container = document.getElementById('sr-aria-val-results');
  const loading = document.getElementById('sr-aria-val-loading');
  const statsEl = document.getElementById('sr-aria-val-stats');
  showElement(loading);
  container.innerHTML = '';
  if (statsEl) statsEl.classList.add('hidden');
  const tab = await getActiveTab();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const issues = [];
        const validRoles = new Set(['alert','alertdialog','application','article','banner','button','cell','checkbox','columnheader','combobox','complementary','contentinfo','definition','dialog','directory','document','feed','figure','form','grid','gridcell','group','heading','img','link','list','listbox','listitem','log','main','marquee','math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio','meter','navigation','none','note','option','presentation','progressbar','radio','radiogroup','region','row','rowgroup','rowheader','scrollbar','search','searchbox','separator','slider','spinbutton','status','switch','tab','table','tablist','tabpanel','term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem','generic']);

        function getSelector(el) {
          if (el.id) return '#' + CSS.escape(el.id);
          const tag = el.tagName.toLowerCase();
          const cls = Array.from(el.classList).slice(0, 2).join('.');
          return tag + (cls ? '.' + cls : '');
        }

        // 1. Broken aria-labelledby / aria-describedby refs
        document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-owns], [aria-controls], [aria-flowto]').forEach(el => {
          ['aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-controls', 'aria-flowto'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (!val) return;
            val.split(/\s+/).forEach(id => {
              if (id && !document.getElementById(id)) {
                issues.push({ type: 'error', category: 'Broken Reference', selector: getSelector(el), desc: `${attr}="${id}" — target ID does not exist` });
              }
            });
          });
        });

        // 2. Invalid ARIA roles
        document.querySelectorAll('[role]').forEach(el => {
          const role = el.getAttribute('role').trim().toLowerCase();
          role.split(/\s+/).forEach(r => {
            if (r && !validRoles.has(r)) {
              issues.push({ type: 'error', category: 'Invalid Role', selector: getSelector(el), desc: `role="${r}" is not a valid WAI-ARIA role` });
            }
          });
        });

        // 3. aria-hidden="true" on focusable elements
        const focusable = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        document.querySelectorAll('[aria-hidden="true"]').forEach(container => {
          container.querySelectorAll(focusable).forEach(el => {
            if (!el.disabled && el.offsetParent !== null) {
              issues.push({ type: 'error', category: 'Forbidden Pattern', selector: getSelector(el), desc: 'Focusable element inside aria-hidden="true" — creates a keyboard trap' });
            }
          });
          if (container.matches(focusable) && !container.disabled) {
            issues.push({ type: 'error', category: 'Forbidden Pattern', selector: getSelector(container), desc: 'Element has aria-hidden="true" but is itself focusable' });
          }
        });

        // 4. Required ARIA attributes
        const required = {
          slider: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
          spinbutton: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
          checkbox: ['aria-checked'],
          radio: ['aria-checked'],
          combobox: ['aria-expanded'],
          scrollbar: ['aria-controls', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
          separator: ['aria-valuenow'],
          switch: ['aria-checked']
        };
        for (const [role, attrs] of Object.entries(required)) {
          document.querySelectorAll(`[role="${role}"]`).forEach(el => {
            attrs.forEach(attr => {
              if (!el.hasAttribute(attr)) {
                issues.push({ type: 'warning', category: 'Missing Required Attr', selector: getSelector(el), desc: `role="${role}" requires ${attr}` });
              }
            });
          });
        }

        // 5. Empty aria-label
        document.querySelectorAll('[aria-label]').forEach(el => {
          if (!el.getAttribute('aria-label').trim()) {
            issues.push({ type: 'warning', category: 'Empty Attribute', selector: getSelector(el), desc: 'aria-label is present but empty' });
          }
        });

        return issues;
      }
    });
    hideElement(loading);
    if (!result || result.length === 0) {
      container.innerHTML = '<div class="empty-state">\u2705 No ARIA issues found</div>';
      return;
    }

    const errors = result.filter(i => i.type === 'error').length;
    const warnings = result.filter(i => i.type === 'warning').length;
    if (statsEl) {
      statsEl.innerHTML = `<span class="stat-pill" style="background:#ffcdd2;color:#c62828"><strong>${errors}</strong> errors</span><span class="stat-pill" style="background:#fff9c4;color:#f57f17"><strong>${warnings}</strong> warnings</span>`;
      statsEl.classList.remove('hidden');
    }

    // Group by category
    const groups = {};
    result.forEach(i => (groups[i.category] ??= []).push(i));

    let html = '';
    for (const [cat, items] of Object.entries(groups)) {
      html += `<div class="kb-group"><div class="kb-group-header"><span class="kb-group-title">${escapeHtml(cat)}</span><span class="kb-group-count">${items.length}</span></div>`;
      items.forEach(i => {
        const icon = i.type === 'error' ? '\ud83d\udd34' : '\ud83d\udfe1';
        html += `<div class="kb-issue-card sr-clickable" data-selector="${escapeHtml(i.selector)}" style="cursor:pointer"><span>${icon}</span> <code>${escapeHtml(i.selector)}</code><div style="font-size:12px;color:#555;margin-top:2px">${escapeHtml(i.desc)}</div></div>`;
      });
      html += '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.sr-clickable[data-selector]').forEach(item => {
      item.addEventListener('click', async () => {
        await highlightElement(tab.id, item.dataset.selector);
      });
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, 'Error: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// INIT
// ═════════════════════════════════════════════════════════════════════════════

export function initScreenReader() {
  document.querySelectorAll('#panel-screen-reader .sr-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => switchSubTab(tab.dataset.srTab));
  });

  // Voice Preview
  document.getElementById('btn-start-voice')?.addEventListener('click', startVoicePreview);
  document.getElementById('btn-stop-voice')?.addEventListener('click', stopVoicePreview);
  // SR Flow
  document.getElementById('btn-scan-sr-flow')?.addEventListener('click', scanSRFlow);
  // Reading Order
  document.getElementById('btn-show-reading-order')?.addEventListener('click', showReadingOrder);
  document.getElementById('btn-hide-reading-order')?.addEventListener('click', hideReadingOrder);
  // Shortcut Menu
  document.getElementById('btn-scan-shortcuts')?.addEventListener('click', scanShortcutMenu);
  // Name Audit
  document.getElementById('btn-run-name-audit')?.addEventListener('click', runNameAudit);
  // Focus Traps
  document.getElementById('btn-scan-traps')?.addEventListener('click', scanFocusTraps);
  // Hidden Content
  document.getElementById('btn-scan-hidden')?.addEventListener('click', scanHiddenContent);
  // Table Audit
  document.getElementById('btn-scan-tables')?.addEventListener('click', scanTables);
  // ARIA Validation
  document.getElementById('btn-scan-aria-validation')?.addEventListener('click', scanAriaValidation);
}
