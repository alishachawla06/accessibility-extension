// ─── Aria Tree Render ───────────────────────────────────────────────────────
// Pure rendering functions for the accessibility tree, extracted from aria-tree.js.
// No side effects, no DOM queries — just takes data and returns HTML strings.

import { escapeHtml } from './utils.js';
import { NAMED_ROLES, LANDMARK_ROLES, INTERACTIVE_ROLES, NAME_SOURCE_LABELS } from './constants.js';

// Build ARIA Live badges with specific values
function buildLiveBadges(props) {
  const badges = [];
  if (props.live) {
    const liveVal = props.live.toLowerCase();
    if (liveVal === 'assertive') {
      badges.push('<span class="ax-badge ax-badge-live-assertive">🔴 Live: Assertive</span>');
    } else if (liveVal === 'polite') {
      badges.push('<span class="ax-badge ax-badge-live-polite">🟡 Live: Polite</span>');
    } else if (liveVal === 'off') {
      badges.push('<span class="ax-badge ax-badge-live-off">Live: Off</span>');
    } else {
      badges.push(`<span class="ax-badge ax-badge-live">Live: ${escapeHtml(liveVal)}</span>`);
    }
  }
  if (props.atomic === 'true') {
    badges.push('<span class="ax-badge ax-badge-atomic">Atomic</span>');
  }
  if (props.relevant) {
    badges.push(`<span class="ax-badge ax-badge-relevant">Relevant: ${escapeHtml(props.relevant)}</span>`);
  }
  return badges;
}

// Render tree node to HTML (works with CDP tree nodes)
export function renderTreeNode(node, depth) {
  if (!node || depth > 50) return '';

  const hasChildren = node.children && node.children.length > 0;
  const toggleIcon = hasChildren ? '▸' : '·';
  const isIgnored = node.ignored;
  const isGeneric = (node.role === 'generic' || node.role === 'none');
  const isLandmark = LANDMARK_ROLES.includes(node.role);
  const isInteractive = INTERACTIVE_ROLES.includes(node.role);
  const needsName = !isIgnored && !isGeneric && NAMED_ROLES.includes(node.role) && !node.name;
  const hasEmptyAlt = node.props && node.props.alt === '';
  const isHeading = node.role === 'heading';

  const rowClasses = ['ax-node-row'];
  if (isIgnored) rowClasses.push('ax-ignored');
  else if (needsName) rowClasses.push('ax-row-warn');
  else if (hasEmptyAlt) rowClasses.push('ax-row-warn-alt');
  if (isLandmark) rowClasses.push('ax-row-landmark');
  if (isHeading) rowClasses.push('ax-row-heading');

  const roleClass = isIgnored ? 'ax-role ax-ignored-role'
    : isLandmark ? 'ax-role ax-role-landmark'
    : needsName ? 'ax-role ax-role-warn'
    : isGeneric ? 'ax-role ax-generic'
    : 'ax-role';

  let tagLabel = '';
  if (isGeneric && node.tag) {
    tagLabel = `<span class="ax-tag">${escapeHtml(node.tag.toUpperCase())}</span>`;
  }

  let headingHtml = '';
  if (isHeading && node.headingLevel) {
    headingHtml = `<span class="ax-badge ax-badge-heading ax-badge-h${node.headingLevel}">H${node.headingLevel}</span>`;
  }

  let nameHtml = '';
  if (node.name) {
    nameHtml = `<span class="ax-name-primary">${escapeHtml(node.name)}</span>`;
  } else if (needsName) {
    nameHtml = `<span class="ax-missing-name">⚠️ missing name</span>`;
  }

  let nameSourceHtml = '';
  if (node.name && node.nameSource) {
    const label = NAME_SOURCE_LABELS[node.nameSource] || node.nameSource;
    nameSourceHtml = `<span class="ax-name-source">via ${escapeHtml(label)}</span>`;
  }

  let altWarningHtml = '';
  if (hasEmptyAlt && (node.role === 'img' || node.tag === 'img')) {
    altWarningHtml = '<span class="ax-badge ax-badge-warn">⚠️ alt=""</span>';
  }

  let badgesHtml = '';
  const badges = [];

  if (isLandmark) {
    badges.push(`<span class="ax-badge ax-badge-landmark">🏷 ${escapeHtml(node.role)}</span>`);
  }

  if (node.props) {
    badges.push(...buildLiveBadges(node.props));

    if (node.props.expanded === 'true') {
      badges.push('<span class="ax-badge ax-badge-state">▾ expanded</span>');
    } else if (node.props['aria-expanded'] === 'false' || node.props.expanded === 'false') {
      badges.push('<span class="ax-badge ax-badge-state-off">▸ collapsed</span>');
    }
    if (node.props.checked === 'true' || node.props['aria-checked'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-state">☑ checked</span>');
    } else if (node.props.checked === 'mixed' || node.props['aria-checked'] === 'mixed') {
      badges.push('<span class="ax-badge ax-badge-state-mixed">☐ mixed</span>');
    }
    if (node.props['aria-pressed'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-state">pressed</span>');
    }
    if (node.props['aria-selected'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-state">selected</span>');
    }
    if (node.props.disabled === 'true' || node.props['aria-disabled'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-disabled">🚫 disabled</span>');
    }
    if (node.props.required === 'true' || node.props['aria-required'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-required">* required</span>');
    }
    if (node.props.invalid === 'true' || node.props['aria-invalid'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-invalid">❌ invalid</span>');
    }
    if (node.props['aria-hidden'] === 'true') {
      badges.push('<span class="ax-badge ax-badge-hidden">👁‍🗨 aria-hidden</span>');
    }
    if (node.props.focusable === 'true' || node.props.focused === 'true') {
      badges.push('<span class="ax-badge ax-badge-focus">⌨ focusable</span>');
    }
    if (isInteractive && !isIgnored && node.props.focusable !== 'true' && !node.props['aria-hidden']) {
      badges.push('<span class="ax-badge ax-badge-warn">⚠️ not focusable</span>');
    }
  }

  if (node.ancestorLive) {
    badges.push(`<span class="ax-badge ax-badge-ancestor-live">📢 Inside ${escapeHtml(node.ancestorLive)} Live Region</span>`);
  }

  badgesHtml = badges.join('');

  let propsHtml = '';
  if (node.props && Object.keys(node.props).length > 0) {
    const skipKeys = ['live', 'atomic', 'relevant', 'focusable', 'focused',
      'expanded', 'checked', 'disabled', 'required', 'invalid'];
    const htmlAttrKeys = ['alt', 'loading', 'src', 'href', 'type', 'placeholder',
      'title', 'lang', 'dir', 'tabindex', 'target', 'rel', 'for',
      'action', 'method', 'width', 'height', 'srcset', 'sizes', 'decoding',
      'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-live',
      'aria-atomic', 'aria-relevant', 'aria-hidden', 'aria-expanded',
      'aria-haspopup', 'aria-controls', 'aria-owns', 'aria-current',
      'aria-pressed', 'aria-checked', 'aria-selected', 'aria-disabled',
      'aria-required', 'aria-invalid', 'aria-errormessage', 'aria-valuemin',
      'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-roledescription',
      'role'];
    const remaining = Object.entries(node.props).filter(([k]) => !skipKeys.includes(k));
    if (remaining.length > 0) {
      propsHtml = ' ' + remaining.map(([k, v]) => {
        const isHtmlAttr = htmlAttrKeys.includes(k);
        const keyClass = isHtmlAttr ? 'ax-html-attr-key' : 'ax-prop-key';
        const valClass = isHtmlAttr ? 'ax-html-attr-val' : 'ax-prop-val';
        const displayVal = v === '' ? '""' : v;
        return `<span class="${keyClass}">${escapeHtml(k)}</span>=<span class="${valClass}">${escapeHtml(displayVal)}</span>`;
      }).join(' ');
    }
  }

  let ignoredHtml = '';
  if (isIgnored && node.ignoredReason) {
    ignoredHtml = `<span class="ax-ignored-reason">(${escapeHtml(node.ignoredReason)})</span>`;
  }

  let childrenHtml = '';
  if (hasChildren) {
    const collapsed = depth > 1 ? ' collapsed' : '';
    childrenHtml = `<div class="ax-children${collapsed}">${node.children.map(c => renderTreeNode(c, depth + 1)).join('')}</div>`;
  }

  const expandedToggle = (hasChildren && depth <= 1) ? '▾' : toggleIcon;
  const backendAttr = node.backendDOMNodeId ? ` data-backend-id="${node.backendDOMNodeId}"` : '';

  return `
    <div class="ax-node">
      <div class="${rowClasses.join(' ')}"${backendAttr}>
        <span class="ax-toggle">${expandedToggle}</span>
        <span class="${roleClass}">${escapeHtml(node.role)}</span>
        ${tagLabel}
        ${headingHtml}
        ${nameHtml}
        ${nameSourceHtml}
        ${altWarningHtml}
        ${badgesHtml}
        <span class="ax-props">${propsHtml}</span>
        ${ignoredHtml}
      </div>
      ${childrenHtml}
    </div>
  `;
}

// Collect tree stats recursively
function collectStats(node, stats) {
  if (!node) return;
  stats.total++;
  if (node.ignored) { stats.ignored++; return; }
  if (LANDMARK_ROLES.includes(node.role)) stats.landmarks++;
  if (node.role === 'heading') {
    stats.headings++;
    if (node.headingLevel) stats.headingLevels.push(node.headingLevel);
  }
  if (node.props && (node.props.live && node.props.live !== 'off')) stats.liveRegions++;
  if (INTERACTIVE_ROLES.includes(node.role)) stats.interactive++;
  if (NAMED_ROLES.includes(node.role) && !node.name && node.role !== 'generic' && node.role !== 'none') stats.issues++;
  if (node.props && node.props.alt === '' && (node.role === 'img' || node.tag === 'img')) stats.issues++;
  if (INTERACTIVE_ROLES.includes(node.role) && node.props && node.props.focusable !== 'true' && !node.props['aria-hidden']) stats.issues++;

  if (node.children) node.children.forEach(c => collectStats(c, stats));
}

// Build tree stats summary HTML
export function buildTreeStats(tree) {
  const stats = { total: 0, landmarks: 0, headings: 0, liveRegions: 0, interactive: 0, issues: 0, ignored: 0, headingLevels: [] };
  collectStats(tree, stats);

  let headingOrderOk = true;
  const levels = stats.headingLevels;
  if (levels.length > 0 && levels[0] !== 1) headingOrderOk = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) { headingOrderOk = false; break; }
  }
  if (!headingOrderOk) stats.issues++;

  let html = '<div class="ax-stats">';
  html += `<span class="ax-stat"><strong>${stats.total}</strong> nodes</span>`;
  html += `<span class="ax-stat ax-stat-landmark">🏷 <strong>${stats.landmarks}</strong> landmarks</span>`;
  html += `<span class="ax-stat ax-stat-heading">H <strong>${stats.headings}</strong> headings</span>`;
  if (!headingOrderOk) {
    html += `<span class="ax-stat ax-stat-warn">⚠️ heading order skipped</span>`;
  }
  html += `<span class="ax-stat ax-stat-live">📢 <strong>${stats.liveRegions}</strong> live regions</span>`;
  html += `<span class="ax-stat"><strong>${stats.interactive}</strong> interactive</span>`;
  if (stats.issues > 0) {
    html += `<span class="ax-stat ax-stat-issue">⚠️ <strong>${stats.issues}</strong> issues</span>`;
  }
  html += '</div>';
  return html;
}

// Filter ignored nodes from tree
export function filterIgnored(node, showIgnored) {
  if (!node) return null;
  if (node.ignored && !showIgnored) {
    const kept = (node.children || []).map(c => filterIgnored(c, showIgnored)).filter(Boolean);
    if (kept.length === 0) return null;
    if (kept.length === 1) return kept[0];
    return { ...node, children: kept };
  }
  return {
    ...node,
    children: (node.children || []).map(c => filterIgnored(c, showIgnored)).filter(Boolean)
  };
}

// Toggle tree expand/collapse
export function attachTreeToggle(container) {
  container.querySelectorAll('.ax-node-row').forEach(row => {
    row.addEventListener('click', () => {
      const node = row.closest('.ax-node');
      const children = node.querySelector(':scope > .ax-children');
      const toggle = row.querySelector('.ax-toggle');
      if (children) {
        children.classList.toggle('collapsed');
        toggle.textContent = children.classList.contains('collapsed') ? '▸' : '▾';
      }
    });
  });
}

// Expand all parent nodes and scroll to highlight the target
export function expandAndHighlightNode(container, targetBackendId) {
  const targetRow = container.querySelector(`.ax-node-row[data-backend-id="${targetBackendId}"]`);
  if (!targetRow) return;

  let parent = targetRow.closest('.ax-node');
  while (parent) {
    const parentChildren = parent.closest('.ax-children');
    if (parentChildren) {
      parentChildren.classList.remove('collapsed');
      const parentNode = parentChildren.closest('.ax-node');
      if (parentNode) {
        const toggle = parentNode.querySelector(':scope > .ax-node-row .ax-toggle');
        if (toggle) toggle.textContent = '▾';
      }
    }
    parent = parentChildren ? parentChildren.closest('.ax-node') : null;
  }

  targetRow.classList.add('ax-row-picked');
  targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Build a picked-element summary panel
export function buildPickedSummary(node) {
  if (!node) return '';

  const role = node.role || 'unknown';
  const name = node.name || '';
  const props = node.props || {};

  let html = '<div class="ax-pick-summary">';
  html += `<div class="ax-pick-row"><span class="ax-pick-label">Role</span><span class="ax-badge ax-badge-role">${escapeHtml(role)}</span></div>`;
  if (name) {
    html += `<div class="ax-pick-row"><span class="ax-pick-label">Name</span><span class="ax-name-primary">${escapeHtml(name)}</span></div>`;
  } else if (NAMED_ROLES.includes(role)) {
    html += `<div class="ax-pick-row"><span class="ax-pick-label">Name</span><span class="ax-missing-name">⚠️ missing name</span></div>`;
  }
  if (props.live) {
    const lvl = props.live.toLowerCase();
    const cls = lvl === 'assertive' ? 'ax-badge-live-assertive' : lvl === 'polite' ? 'ax-badge-live-polite' : 'ax-badge-live';
    html += `<div class="ax-pick-row"><span class="ax-pick-label">Live</span><span class="ax-badge ${cls}">${escapeHtml(props.live)}</span></div>`;
  }
  if (props.atomic) {
    html += `<div class="ax-pick-row"><span class="ax-pick-label">Atomic</span><span class="ax-badge ax-badge-atomic">${escapeHtml(props.atomic)}</span></div>`;
  }
  if (props.relevant) {
    html += `<div class="ax-pick-row"><span class="ax-pick-label">Relevant</span><span class="ax-badge ax-badge-relevant">${escapeHtml(props.relevant)}</span></div>`;
  }
  if (node.ancestorLive) {
    html += `<div class="ax-pick-row"><span class="ax-pick-label">Context</span><span class="ax-badge ax-badge-ancestor-live">📢 Inside ${escapeHtml(node.ancestorLive)} live region</span></div>`;
  }
  if (props['aria-label']) {
    html += `<div class="ax-pick-row"><span class="ax-pick-label">aria-label</span><span class="ax-html-attr-val">${escapeHtml(props['aria-label'])}</span></div>`;
  }
  html += '</div>';
  return html;
}

// Recursively find a node by backendDOMNodeId
export function findNodeByBackendId(node, targetId) {
  if (!node) return null;
  if (node.backendDOMNodeId === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByBackendId(child, targetId);
      if (found) return found;
    }
  }
  return null;
}
