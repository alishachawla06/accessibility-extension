// ─── Heading Outline Module ──────────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, highlightElement } from './utils.js';

let labelsVisible = false;

async function scanHeadings() {
  const container = document.getElementById('heading-tree-container');
  const stats = document.getElementById('heading-stats');
  const loading = document.getElementById('heading-loading');

  showElement(loading);
  container.innerHTML = '';
  hideElement(stats);

  const tab = await getActiveTab();

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        return headings.map(h => {
          const rect = h.getBoundingClientRect();
          return {
            level: parseInt(h.tagName[1]),
            text: (h.textContent || '').trim(),
            isEmpty: (h.textContent || '').trim() === '',
            tag: h.tagName.toLowerCase(),
            selector: h.id ? '#' + h.id : h.tagName.toLowerCase() + ':nth-of-type(' +
              (Array.from(document.querySelectorAll(h.tagName)).indexOf(h) + 1) + ')',
            rect: { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height }
          };
        });
      }
    });

    hideElement(loading);

    if (!result || result.length === 0) {
      container.innerHTML = '<div class="result-item"><div class="result-item-title">No headings found on this page</div></div>';
      return;
    }

    // Validate heading order
    const issues = [];
    let skippedLevels = 0;
    let emptyCount = result.filter(h => h.isEmpty).length;
    if (result.length > 0 && result[0].level !== 1) {
      issues.push({ index: 0, msg: `Page should start with H1, found H${result[0].level}` });
      skippedLevels++;
    }
    for (let i = 1; i < result.length; i++) {
      if (result[i].level > result[i - 1].level + 1) {
        issues.push({ index: i, msg: `Skipped from H${result[i - 1].level} to H${result[i].level}` });
        skippedLevels++;
      }
    }

    // Stats bar
    const issueCount = skippedLevels + emptyCount;
    stats.innerHTML = `
      <span class="heading-stat"><strong>${result.length}</strong> headings</span>
      <span class="heading-stat ${issueCount === 0 ? 'heading-stat-pass' : 'heading-stat-issue'}">${issueCount === 0 ? '✅' : '⚠️'} <strong>${issueCount}</strong> issues</span>
    `;
    showElement(stats);

    // Build nested tree
    const issueMap = new Set(issues.map(i => i.index));
    const issueMessages = {};
    issues.forEach(i => { issueMessages[i.index] = i.msg; });

    let html = '<div class="heading-tree-label">Heading Tree</div>';
    result.forEach((h, idx) => {
      const indent = (h.level - 1) * 24;
      const warnClass = h.isEmpty ? 'heading-card-warn' : issueMap.has(idx) ? 'heading-card-warn' : '';
      const badge = `<span class="heading-badge heading-badge-h${h.level}">H${h.level}</span>`;
      const nameHtml = h.isEmpty
        ? '<span class="heading-card-empty">⚠️ empty heading</span>'
        : `<span class="heading-card-text">${escapeHtml(h.text.substring(0, 80))}</span>`;
      const warnMsg = issueMap.has(idx)
        ? `<div class="heading-card-issue">⚠️ ${escapeHtml(issueMessages[idx])}</div>`
        : '';

      html += `<div class="heading-card heading-card-h${h.level} ${warnClass}" style="margin-left:${indent}px; cursor:pointer" data-heading-idx="${idx}" data-selector="${escapeHtml(h.selector)}">
        ${badge} ${nameHtml}
        ${warnMsg}
      </div>`;
    });
    container.innerHTML = html;

    // Click to highlight heading on page
    const activeTab = await getActiveTab();
    container.querySelectorAll('.heading-card[data-selector]').forEach(card => {
      card.addEventListener('click', () => {
        highlightElement(activeTab.id, card.dataset.selector);
      });
    });

  } catch (e) {
    hideElement(loading);
    renderError(container, `Error: ${e.message}`);
  }
}

async function toggleHeadingLabels() {
  const tab = await getActiveTab();
  const btn = document.getElementById('btn-show-heading-labels');

  if (labelsVisible) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.querySelectorAll('.a11y-ext-heading-label').forEach(m => m.remove());
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
          h.style.outline = '';
          h.style.outlineOffset = '';
        });
      }
    });
    labelsVisible = false;
    btn.textContent = 'Show Heading Levels';
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document.querySelectorAll('.a11y-ext-heading-label').forEach(m => m.remove());
      const colors = { 1: '#1565c0', 2: '#1976d2', 3: '#1e88e5', 4: '#42a5f5', 5: '#64b5f6', 6: '#90caf9' };
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
        const level = parseInt(h.tagName[1]);
        const rect = h.getBoundingClientRect();
        const label = document.createElement('div');
        label.className = 'a11y-ext-heading-label';
        label.textContent = 'H' + level;
        label.style.cssText = `
          position: absolute;
          top: ${rect.top + window.scrollY - 10}px;
          left: ${rect.left + window.scrollX - 30}px;
          background: ${colors[level]};
          color: #fff; font-size: 10px; font-weight: 800;
          padding: 2px 6px; border-radius: 4px;
          z-index: 2147483647; pointer-events: none;
          font-family: -apple-system, sans-serif;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(label);
        h.style.outline = '2px solid ' + colors[level];
        h.style.outlineOffset = '2px';
      });
    }
  });
  labelsVisible = true;
  btn.textContent = 'Hide Heading Levels';
}

export function initHeadingOutline() {
  document.getElementById('btn-scan-headings').addEventListener('click', scanHeadings);
  document.getElementById('btn-show-heading-labels').addEventListener('click', toggleHeadingLabels);
}
