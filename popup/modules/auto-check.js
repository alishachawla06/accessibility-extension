// ─── Auto Check Module ──────────────────────────────────────────────────────
import { escapeHtml, getActiveTab, setButtons, showElement, hideElement, renderError, renderSuccess, highlightElement } from './utils.js';
import { WCAG_TAGS, FIX_SUGGESTIONS } from './constants.js';

const BTN_IDS = ['btn-check-aa', 'btn-check-aaa', 'btn-check-bp', 'btn-pick-section'];

let lastCheckResult = null;
let currentViewMode = 'flat';
let pickedSelector = null;
let currentSearchTerm = '';
let currentResultFilter = 'violations'; // 'violations' | 'passes' | 'incomplete'

// ─── Section Picker ─────────────────────────────────────────────────────────

async function pickPageSection() {
  const tab = await getActiveTab();
  const wcagLevel = document.getElementById('select-wcag-level').value;
  chrome.runtime.sendMessage({ type: 'startPickingSection', tabId: tab.id, level: wcagLevel, from: 'auto-check' });
  window.close(); // Close the extension popup immediately
}

// ─── Axe Scan ───────────────────────────────────────────────────────────────
async function runAxeCheck(filterTags, btnLabel, selector) {
  const loading = document.getElementById('loading');
  const summary = document.getElementById('results-summary');
  const list = document.getElementById('results-list');
  const viewToggle = document.getElementById('view-toggle');

  setButtons(BTN_IDS, true);
  showElement(loading);
  hideElement(summary);
  hideElement(viewToggle);
  list.innerHTML = '';
  lastCheckResult = null;

  const tab = await getActiveTab();

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['libs/axe.min.js']
    });
  } catch (e) {
    hideElement(loading);
    setButtons(BTN_IDS, false);
    renderError(list, `Failed to inject axe-core: ${e.message}`);
    return;
  }

  let result;
  try {
    const [response] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (runTags, contextSelector) => {
        return new Promise((resolve) => {
          if (typeof axe === 'undefined') {
            resolve({ error: 'axe not loaded', violations: [], passes: 0, incomplete: 0 });
            return;
          }
          const opts = { iframes: true, shadowDom: true };
          if (runTags && runTags.length > 0) {
            opts.runOnly = { type: 'tag', values: runTags };
          }
          let context = document;
          if (contextSelector) {
            try {
              const el = document.querySelector(contextSelector);
              if (!el) { resolve({ error: 'No element found for: ' + contextSelector }); return; }
              context = contextSelector;
            } catch (e) { resolve({ error: 'Invalid selector: ' + contextSelector }); return; }
          }
          axe.run(context, opts).then(results => {
            function getComponent(target) {
              try {
                const el = document.querySelector(target);
                if (!el) return 'page';
                let parent = el;
                for (let i = 0; i < 15; i++) {
                  if (!parent || parent === document.body || parent === document.documentElement) break;
                  const tag = parent.tagName.toLowerCase();
                  const role = parent.getAttribute('role') || '';
                  const label = parent.getAttribute('aria-label') || '';
                  if (['header', 'nav', 'main', 'footer', 'aside', 'section', 'form'].includes(tag))
                    return label ? tag + ' – ' + label : tag;
                  if (['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region', 'form'].includes(role))
                    return label ? role + ' – ' + label : role;
                  parent = parent.parentElement;
                }
              } catch (e) {}
              return 'page';
            }
            resolve({
              violations: results.violations.map(v => ({
                id: v.id, impact: v.impact, description: v.description,
                help: v.help, helpUrl: v.helpUrl, tags: v.tags || [],
                nodes: v.nodes.map(n => ({
                  html: n.html,
                  component: getComponent(n.target ? n.target[0] : ''),
                  target: n.target ? (typeof n.target[0] === 'string' ? n.target[0] : '') : '',
                  failureSummary: n.failureSummary || ''
                }))
              })),
              passes: results.passes.map(v => ({
                id: v.id, description: v.description,
                help: v.help, helpUrl: v.helpUrl,
                nodeCount: v.nodes.length
              })),
              incomplete: results.incomplete.map(v => ({
                id: v.id, impact: v.impact, description: v.description,
                help: v.help, helpUrl: v.helpUrl,
                nodeCount: v.nodes.length
              }))
            });
          }).catch(err => {
            resolve({ error: err.message, violations: [], passes: [], incomplete: [] });
          });
        });
      },
      args: [filterTags, selector || null]
    });
    result = response.result;
  } catch (e) {
    hideElement(loading);
    setButtons(BTN_IDS, false);
    renderError(list, `Error: ${e.message}`);
    return;
  }

  if (result.error) {
    hideElement(loading);
    setButtons(BTN_IDS, false);
    renderError(list, `Error: ${result.error}`);
    return;
  }

  hideElement(loading);
  setButtons(BTN_IDS, false);

  document.getElementById('count-violations').textContent = result.violations.length;
  document.getElementById('count-passes').textContent = result.passes.length;
  document.getElementById('count-incomplete').textContent = result.incomplete.length;
  showElement(summary);

  lastCheckResult = result;
  currentResultFilter = 'violations';
  updateSummaryActiveState();

  showElement(viewToggle);
  document.getElementById('auto-check-search-container').style.display = 'block';
  currentViewMode = 'flat';
  document.getElementById('btn-view-flat').classList.add('active');
  document.getElementById('btn-view-component').classList.remove('active');
  renderCurrentView();
}

function updateSummaryActiveState() {
  document.querySelectorAll('#results-summary .pill-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === currentResultFilter);
  });
}

// ─── Render Helpers ─────────────────────────────────────────────────────────
function renderCurrentView() {
  if (!lastCheckResult) return;
  const list = document.getElementById('results-list');
  list.innerHTML = '';

  // Show/hide view toggle depending on filter
  const viewToggle = document.getElementById('view-toggle');
  if (currentResultFilter === 'violations') {
    showElement(viewToggle);
  } else {
    hideElement(viewToggle);
  }

  if (currentResultFilter === 'passes') {
    renderPassRules(lastCheckResult.passes, list);
    return;
  }

  if (currentResultFilter === 'incomplete') {
    renderIncompleteRules(lastCheckResult.incomplete, list);
    return;
  }

  // Default: violations
  let violationsToRender = lastCheckResult.violations;
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    violationsToRender = violationsToRender.filter(v => 
      v.help.toLowerCase().includes(term) ||
      v.id.toLowerCase().includes(term) ||
      (v.description && v.description.toLowerCase().includes(term)) ||
      v.nodes.some(n => {
        const component = n.component ? n.component.toLowerCase() : '';
        const html = typeof n === 'string' ? n.toLowerCase() : (n.html && n.html.toLowerCase() || '');
        return component.includes(term) || html.includes(term);
      })
    );
  }

  if (violationsToRender.length === 0 && currentSearchTerm) {
      list.innerHTML = '<div class="empty-state">No results found for your search.</div>';
      return;
  }

  if (violationsToRender.length === 0) {
      list.innerHTML = '<div class="empty-state" style="color: #43a047;">✅ No violations found!</div>';
      return;
  }

  if (currentViewMode === 'component') {
    renderComponentView({ ...lastCheckResult, violations: violationsToRender }, list);
  } else {
    renderFlatView({ ...lastCheckResult, violations: violationsToRender }, list);
  }
}

function renderViolationItems(violations, container) {
  violations.forEach(v => {
    const item = document.createElement('div');
    item.className = 'result-item';

    const fix = FIX_SUGGESTIONS[v.id];
    const fixHtml = fix ? `
      <div class="ax-fix-section">
        <button class="ax-fix-btn">💡 Fix Suggestion</button>
        <div class="ax-fix-detail hidden">
          <div class="ax-fix-desc">${escapeHtml(fix.fix)}</div>
          <pre class="ax-fix-code"><code>${escapeHtml(fix.snippet)}</code></pre>
          <button class="ax-fix-copy" title="Copy snippet">📋 Copy</button>
        </div>
      </div>
    ` : '';

    item.innerHTML = `
      <div class="result-item-header">
        <span class="result-item-title">${escapeHtml(v.help)}</span>
        <span class="result-item-impact impact-${v.impact}">${v.impact}</span>
      </div>
      <div class="result-item-desc">${escapeHtml(v.description)}</div>
      <div class="result-item-meta">
        <span class="result-rule-id">${escapeHtml(v.id)}</span>
        ${v.helpUrl ? `<a href="${escapeHtml(v.helpUrl)}" target="_blank" class="result-help-link">Learn more ↗</a>` : ''}
      </div>
      <div class="result-item-count">${v.nodes.length} element${v.nodes.length > 1 ? 's' : ''}</div>
      <div class="result-item-details">
        ${v.nodes.map(n => {
          const node = typeof n === 'string' ? { html: n, target: '' } : n;
          const sel = node.target || '';
          return `<div class="detail-node" data-selector="${escapeHtml(sel)}"><span class="detail-node-hint">click to locate</span>${escapeHtml(node.html)}${sel ? `<span class="detail-node-selector">${escapeHtml(sel)}</span>` : ''}</div>`;
        }).join('')}
      </div>
      ${fixHtml}
    `;

    item.querySelector('.result-item-header')?.addEventListener('click', () => item.classList.toggle('expanded'));
    // Also expand when clicking count or description (anywhere on card except interactive children)
    item.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .detail-node, .ax-fix-section')) return;
      item.classList.toggle('expanded');
    });

    // Click-to-highlight on detail nodes
    item.querySelectorAll('.detail-node[data-selector]').forEach(node => {
      node.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sel = node.dataset.selector;
        if (!sel) return;
        const tab = await getActiveTab();
        await highlightElement(tab.id, sel);
      });
    });

    // Fix toggle
    const fixBtn = item.querySelector('.ax-fix-btn');
    if (fixBtn) {
      fixBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fixBtn.nextElementSibling.classList.toggle('hidden');
      });
    }

    // Copy button
    const copyBtn = item.querySelector('.ax-fix-copy');
    if (copyBtn && fix) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(fix.snippet).then(() => {
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
        });
      });
    }
    container.appendChild(item);
  });
}

function renderFlatView(result, list) {
  list.innerHTML = '';
  renderViolationItems(result.violations, list);
}

function renderPassRules(passes, container) {
  if (!passes || passes.length === 0) return;
  const section = document.createElement('div');
  section.className = 'pass-rules-section';
  section.innerHTML = `<div class="section-divider"><span class="section-divider-text">✅ ${passes.length} Passed Rule${passes.length > 1 ? 's' : ''}</span></div>`;
  passes.forEach(p => {
    const item = document.createElement('div');
    item.className = 'result-item result-item-pass';
    item.innerHTML = `
      <div class="result-item-header">
        <span class="result-item-title">${escapeHtml(p.help)}</span>
        <span class="result-item-impact impact-pass">pass</span>
      </div>
      <div class="result-item-desc">${escapeHtml(p.description || '')}</div>
      <div class="result-item-meta">
        <span class="result-rule-id">${escapeHtml(p.id)}</span>
        ${p.helpUrl ? `<a href="${escapeHtml(p.helpUrl)}" target="_blank" class="result-help-link">Learn more ↗</a>` : ''}
      </div>
      <div class="result-item-count">${p.nodeCount} element${p.nodeCount > 1 ? 's' : ''} passed</div>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      item.classList.toggle('expanded');
    });
    section.appendChild(item);
  });
  container.appendChild(section);
}

function renderIncompleteRules(incomplete, container) {
  if (!incomplete || incomplete.length === 0) {
    container.innerHTML = '<div class="empty-state">No rules need manual review.</div>';
    return;
  }
  const section = document.createElement('div');
  section.className = 'incomplete-rules-section';
  section.innerHTML = `<div class="section-divider" style="background:#fff3e0;border-left-color:#fb8c00;"><span class="section-divider-text" style="color:#e65100;">⚠️ ${incomplete.length} Rule${incomplete.length > 1 ? 's' : ''} Need Review</span></div>`;
  incomplete.forEach(p => {
    const item = document.createElement('div');
    item.className = 'result-item result-item-incomplete';
    item.innerHTML = `
      <div class="result-item-header">
        <span class="result-item-title">${escapeHtml(p.help)}</span>
        <span class="result-item-impact impact-incomplete">${p.impact || 'review'}</span>
      </div>
      <div class="result-item-desc">${escapeHtml(p.description || '')}</div>
      <div class="result-item-meta">
        <span class="result-rule-id">${escapeHtml(p.id)}</span>
        ${p.helpUrl ? `<a href="${escapeHtml(p.helpUrl)}" target="_blank" class="result-help-link">Learn more ↗</a>` : ''}
      </div>
      <div class="result-item-count">${p.nodeCount} element${p.nodeCount > 1 ? 's' : ''} need review</div>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      item.classList.toggle('expanded');
    });
    section.appendChild(item);
  });
  container.appendChild(section);
}

function renderComponentView(result, list) {
  list.innerHTML = '';
  const componentMap = {};
  result.violations.forEach(v => {
    v.nodes.forEach(n => {
      const node = typeof n === 'string' ? { html: n, component: 'page' } : n;
      const comp = node.component || 'page';
      if (!componentMap[comp]) componentMap[comp] = [];
      componentMap[comp].push({ help: v.help, impact: v.impact, description: v.description, html: node.html, target: node.target || '', id: v.id, helpUrl: v.helpUrl });
    });
  });

  Object.keys(componentMap).forEach(comp => {
    const issues = componentMap[comp];
    const section = document.createElement('div');
    section.className = 'component-group';

    const header = document.createElement('div');
    header.className = 'component-header';
    header.innerHTML = `
      <span class="component-name">&lt;${escapeHtml(comp)}&gt;</span>
      <span class="component-count">${issues.length} issue${issues.length > 1 ? 's' : ''}</span>
    `;
    section.appendChild(header);

    const ruleMap = {};
    issues.forEach(iss => {
      if (!ruleMap[iss.help]) ruleMap[iss.help] = { ...iss, nodes: [] };
      ruleMap[iss.help].nodes.push({ html: iss.html, target: iss.target || '' });
    });

    Object.values(ruleMap).forEach(rule => {
      const fix = FIX_SUGGESTIONS[rule.id];
      const fixHtml = fix ? `
        <div class="ax-fix-section">
          <button class="ax-fix-btn">💡 Fix Suggestion</button>
          <div class="ax-fix-detail hidden">
            <div class="ax-fix-desc">${escapeHtml(fix.fix)}</div>
            <pre class="ax-fix-code"><code>${escapeHtml(fix.snippet)}</code></pre>
          </div>
        </div>
      ` : '';

      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <div class="result-item-header">
          <span class="result-item-title">${escapeHtml(rule.help)}</span>
          <span class="result-item-impact impact-${rule.impact}">${rule.impact}</span>
        </div>
        <div class="result-item-desc">${escapeHtml(rule.description)}</div>
        <div class="result-item-meta">
          <span class="result-rule-id">${escapeHtml(rule.id)}</span>
          ${rule.helpUrl ? `<a href="${escapeHtml(rule.helpUrl)}" target="_blank" class="result-help-link">Learn more ↗</a>` : ''}
        </div>
        <div class="result-item-count">${rule.nodes.length} element${rule.nodes.length > 1 ? 's' : ''}</div>
        <div class="result-item-details">
          ${rule.nodes.map(n => {
            const html = typeof n === 'string' ? n : n.html;
            const sel = typeof n === 'string' ? '' : (n.target || '');
            return `<div class="detail-node" data-selector="${escapeHtml(sel)}"><span class="detail-node-hint">click to locate</span>${escapeHtml(html)}${sel ? `<span class="detail-node-selector">${escapeHtml(sel)}</span>` : ''}</div>`;
          }).join('')}
        </div>
        ${fixHtml}
      `;
      item.querySelector('.result-item-header')?.addEventListener('click', () => item.classList.toggle('expanded'));
      // Also expand when clicking count or description
      item.addEventListener('click', (e) => {
        if (e.target.closest('a, button, .detail-node, .ax-fix-section')) return;
        item.classList.toggle('expanded');
      });

      // Click-to-highlight on detail nodes
      item.querySelectorAll('.detail-node[data-selector]').forEach(node => {
        node.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sel = node.dataset.selector;
          if (!sel) return;
          const tab = await getActiveTab();
          await highlightElement(tab.id, sel);
        });
      });
      const fixBtn = item.querySelector('.ax-fix-btn');
      if (fixBtn) {
        fixBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          fixBtn.nextElementSibling.classList.toggle('hidden');
        });
      }
      section.appendChild(item);
    });
    list.appendChild(section);
  });
}

// ─── Init ───────────────────────────────────────────────────────────────────
export function initAutoCheck() {
  const selectWcag = document.getElementById('select-wcag-level');
  
  const searchInput = document.getElementById('auto-check-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value.trim();
      renderCurrentView();
    });
  }

  // Pill tab filter clicks
  document.querySelectorAll('#results-summary .pill-tab[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentResultFilter = tab.dataset.filter;
      updateSummaryActiveState();
      renderCurrentView();
    });
  });

  document.getElementById('btn-scan-page').addEventListener('click', () => {
    const level = selectWcag.value;
    const tag = level === 'aa' ? WCAG_TAGS.AA : level === 'aaa' ? WCAG_TAGS.AAA : WCAG_TAGS.BP;
    const label = level === 'aa' ? 'WCAG AA' : level === 'aaa' ? 'WCAG AAA' : 'Best Practice';
    runAxeCheck(tag, label, null);
  });

  // Visual section picker
  document.getElementById('btn-pick-section').addEventListener('click', pickPageSection);

  // Check if we just finished picking a section
  chrome.runtime.sendMessage({ type: 'getPickedSection', consume: true, consumerId: 'auto-check' }, (response) => {
    if (response && response.selector && response.from === 'auto-check') {
      const scopeBadge = document.getElementById('scan-scope-badge');
      pickedSelector = response.selector;
      const displayName = response.role ? `[${response.role}]` : `<${response.tag}>`;
      const displayLabel = response.label ? ` "${response.label}"` : '';
      scopeBadge.innerHTML = `📌 Scanning: <strong>${escapeHtml(displayName)}${escapeHtml(displayLabel)}</strong> <button class="scope-clear" title="Clear scope">✕</button>`;
      scopeBadge.className = 'scan-scope-badge active';
      showElement(scopeBadge);

      scopeBadge.querySelector('.scope-clear').addEventListener('click', () => {
        pickedSelector = null;
        hideElement(scopeBadge);
      });

      // Update select dropdown to match
      selectWcag.value = response.level || 'aa';

      const tag = response.level === 'aa' ? WCAG_TAGS.AA : response.level === 'aaa' ? WCAG_TAGS.AAA : WCAG_TAGS.BP;
      const label = response.level === 'aa' ? 'WCAG AA' : response.level === 'aaa' ? 'WCAG AAA' : 'Best Practice';
      runAxeCheck(tag, `${label} · ${displayName}${displayLabel}`, response.selector);
    }
  });

  // View toggles
  document.getElementById('btn-view-flat').addEventListener('click', () => {
    currentViewMode = 'flat';
    document.getElementById('btn-view-flat').classList.add('active');
    document.getElementById('btn-view-component').classList.remove('active');
    renderCurrentView();
  });

  document.getElementById('btn-view-component').addEventListener('click', () => {
    currentViewMode = 'component';
    document.getElementById('btn-view-component').classList.add('active');
    document.getElementById('btn-view-flat').classList.remove('active');
    renderCurrentView();
  });
}
