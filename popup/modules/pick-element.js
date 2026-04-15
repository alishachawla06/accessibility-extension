// ─── Pick Element Module ────────────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, sendBackgroundMessage } from './utils.js';
import { injectPicker } from './picker-inject.js';
import {
  renderTreeNode, filterIgnored, attachTreeToggle,
  expandAndHighlightNode, findNodeByBackendId, buildPickedSummary,
  getShowIgnored
} from './aria-tree.js';

async function pickElement() {
  await injectPicker();

  // Don't close the panel window — only close the popup
  if (!window.location.pathname.includes('panel.html')) {
    window.close();
  }
}

// Check for stored pick result on popup open and show results in pick panel
async function checkForPick() {
  const picked = await sendBackgroundMessage({ type: 'getPickedElement' }).catch(() => null);

  if (!picked || !picked.selector) return;

  // Auto-switch to Pick Element panel
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-panel="pick-element"]').classList.add('active');
  document.getElementById('panel-pick-element').classList.add('active');

  const loading = document.getElementById('pick-loading');
  const container = document.getElementById('pick-tree-container');
  const infoDiv = document.getElementById('pick-info');

  showElement(loading);
  container.innerHTML = '';
  hideElement(infoDiv);

  try {
    const result = await sendBackgroundMessage(
      { type: 'getAXTreeForPick', tabId: picked.tabId, selector: picked.selector }
    );

    hideElement(loading);

    showElement(infoDiv);
    infoDiv.innerHTML = `<strong>Picked:</strong> <code>${escapeHtml(picked.selector)}</code>`;

    const isShowIgnored = getShowIgnored();
    const display = isShowIgnored ? result.tree : filterIgnored(result.tree, isShowIgnored);
    if (!display) {
      container.innerHTML = '<div class="result-item"><div class="result-item-title">Element not found in accessibility tree</div></div>';
      return;
    }

    const pickedNode = result.targetBackendId ? findNodeByBackendId(display, result.targetBackendId) : null;
    if (pickedNode) {
      infoDiv.innerHTML += buildPickedSummary(pickedNode);
    }

    container.innerHTML = renderTreeNode(display, 0);
    attachTreeToggle(container);

    if (result.targetBackendId) {
      expandAndHighlightNode(container, result.targetBackendId);
    }
  } catch (e) {
    hideElement(loading);
    renderError(container, `Error: ${e.message}`);
  }
}

export function initPickElement() {
  document.getElementById('btn-pick-element').addEventListener('click', pickElement);
  checkForPick();
}
