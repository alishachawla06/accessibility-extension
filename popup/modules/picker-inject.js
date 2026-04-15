// ─── Shared Picker Injection ────────────────────────────────────────────────
// Single injected function used by both aria-tree.js and pick-element.js
// to avoid duplicating the overlay/HUD/highlight/selector code.

import { getActiveTab, ensureContentCSS } from './utils.js';
import { SEMANTIC_ROLES, SEMANTIC_TAGS, TAG_ROLE_MAP } from './constants.js';

/**
 * The function injected into the target page context.
 * Receives semantic roles, tags, and role map via args (can't import in page context).
 */
function pickerPageFunc(extTabId, semanticRoles, semanticTags, tagRoleMap) {
  if (window.__a11yPicker) {
    window.__a11yPicker.cleanup();
  }

  function findSemanticParent(el) {
    let node = el;
    let depth = 0;
    while (node && node !== document.body && node !== document.documentElement && depth < 10) {
      const role = node.getAttribute('role');
      const tag = node.tagName.toLowerCase();
      if (role && semanticRoles.includes(role)) return node;
      if (semanticTags.includes(tag)) return node;
      node = node.parentElement;
      depth++;
    }
    return el;
  }

  function findAncestorLiveRegion(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const role = node.getAttribute('role');
      const ariaLive = node.getAttribute('aria-live');
      if (ariaLive && ariaLive !== 'off') {
        return { type: ariaLive, role: role || node.tagName.toLowerCase() };
      }
      if (role && ['status', 'alert', 'log', 'marquee', 'timer'].includes(role)) {
        const implicit = (role === 'alert') ? 'assertive' : 'polite';
        return { type: implicit, role: role };
      }
      node = node.parentElement;
    }
    return null;
  }

  function buildHUD(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const alt = el.getAttribute('alt');
    const text = (el.textContent || '').trim().substring(0, 30);
    const ariaLive = el.getAttribute('aria-live');

    let displayRole = role;
    if (!displayRole) {
      displayRole = tagRoleMap[tag] || tag;
    }

    let name = ariaLabel;
    if (!name && alt != null) name = alt;
    if (!name && text && text.length <= 30) name = text;

    const ancestor = findAncestorLiveRegion(el);
    return { displayRole, name, tag, alt, ariaLive, ancestor };
  }

  function getUniqueSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      let selector = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id));
        break;
      }
      if (node.className && typeof node.className === 'string') {
        const cls = node.className.trim().split(/\s+/).map(c => '.' + CSS.escape(c)).join('');
        selector += cls;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s => s.tagName === node.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(node) + 1;
          selector += ':nth-child(' + idx + ')';
        }
      }
      parts.unshift(selector);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  // ─── Create overlay elements ──────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'a11y-ext-pick-overlay';

  const highlight = document.createElement('div');
  highlight.id = 'a11y-ext-pick-highlight';

  const hud = document.createElement('div');
  hud.id = 'a11y-ext-pick-hud';

  const banner = document.createElement('div');
  banner.id = 'a11y-ext-pick-banner';
  banner.textContent = '🎯 Pick Mode — hover to inspect, click to select. Press Esc to cancel.';

  document.body.appendChild(highlight);
  document.body.appendChild(hud);
  document.body.appendChild(banner);
  document.body.appendChild(overlay);

  let lastTarget = null;
  let lastSemantic = null;

  function onMove(e) {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = '';
    if (!el || el === overlay || el === highlight || el === hud || el === banner) return;

    const semantic = findSemanticParent(el);
    lastTarget = el;
    lastSemantic = semantic;

    const rect = semantic.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.top = rect.top + 'px';
    highlight.style.left = rect.left + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';

    const info = buildHUD(semantic);

    let hudContent = '';
    hudContent += `<div style="display:flex;gap:6px;align-items:center;margin-bottom:2px">`;
    hudContent += `<span style="background:#4fc3f7;color:#000;padding:1px 6px;border-radius:4px;font-weight:700;font-size:10px;text-transform:uppercase">${info.displayRole}</span>`;
    if (info.name) {
      hudContent += `<span style="color:#81d4fa;font-weight:600">"${info.name.substring(0, 40)}"</span>`;
    } else {
      hudContent += `<span style="color:#ef5350;font-weight:600">⚠️ No Name</span>`;
    }
    hudContent += `</div>`;
    hudContent += `<div style="display:flex;gap:10px;font-size:10px;color:#aaa">`;
    hudContent += `<span>&lt;${info.tag}&gt;</span>`;
    hudContent += `</div>`;

    if (info.alt != null && info.alt === '') {
      hudContent += `<div style="color:#ffab40;font-size:10px;margin-top:2px">⚠️ alt="" (empty alt attribute)</div>`;
    }

    if (info.ancestor) {
      hudContent += `<div style="margin-top:3px;padding:2px 6px;background:rgba(156,39,176,0.3);border-radius:3px;font-size:10px">`;
      hudContent += `📢 Inside <b>${info.ancestor.type}</b> live region (${info.ancestor.role})`;
      hudContent += `</div>`;
    }

    if (info.ariaLive && info.ariaLive !== 'off') {
      hudContent += `<div style="margin-top:2px;padding:2px 6px;background:rgba(244,67,54,0.3);border-radius:3px;font-size:10px">`;
      hudContent += `🔴 aria-live="${info.ariaLive}"`;
      hudContent += `</div>`;
    }

    hud.innerHTML = hudContent;
    hud.style.display = 'block';

    let hudTop = e.clientY + 20;
    let hudLeft = e.clientX + 15;
    const hudRect = hud.getBoundingClientRect();
    if (hudTop + hudRect.height > window.innerHeight) hudTop = e.clientY - hudRect.height - 10;
    if (hudLeft + hudRect.width > window.innerWidth) hudLeft = e.clientX - hudRect.width - 10;
    hud.style.top = Math.max(0, hudTop) + 'px';
    hud.style.left = Math.max(0, hudLeft) + 'px';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = lastSemantic || lastTarget;
    if (!target) return;

    const selector = getUniqueSelector(target);
    chrome.runtime.sendMessage({ type: 'elementPicked', selector: selector, tabId: extTabId });
    cleanup();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      chrome.runtime.sendMessage({ type: 'elementPicked', selector: null, tabId: extTabId });
      cleanup();
    }
  }

  function cleanup() {
    overlay.remove();
    highlight.remove();
    hud.remove();
    banner.remove();
    document.removeEventListener('keydown', onKeyDown, true);
    window.__a11yPicker = null;
  }

  overlay.addEventListener('mousemove', onMove);
  overlay.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown, true);

  window.__a11yPicker = { cleanup };
}

/**
 * Inject the element picker into the active tab.
 * Used by both aria-tree.js and pick-element.js.
 */
export async function injectPicker() {
  const tab = await getActiveTab();
  await ensureContentCSS(tab.id);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: pickerPageFunc,
    args: [tab.id, SEMANTIC_ROLES, SEMANTIC_TAGS, TAG_ROLE_MAP]
  });

  return tab;
}
