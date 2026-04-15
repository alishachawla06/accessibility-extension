// ─── Aria Tree Module (Controller) ──────────────────────────────────────────
// Handles CDP tree requests, UI interactions, and picker integration.
// Rendering logic is in aria-tree-render.js.

import { escapeHtml, getActiveTab, showElement, hideElement, renderError, sendBackgroundMessage } from './utils.js';
import { injectPicker } from './picker-inject.js';
import {
  renderTreeNode, buildTreeStats, filterIgnored, attachTreeToggle,
  expandAndHighlightNode, buildPickedSummary, findNodeByBackendId
} from './aria-tree-render.js';

// Re-export rendering functions so existing consumers (pick-element.js) don't break
export { renderTreeNode, buildTreeStats, filterIgnored, attachTreeToggle,
  expandAndHighlightNode, buildPickedSummary, findNodeByBackendId };

let showIgnored = false;

export function getShowIgnored() { return showIgnored; }

// Request tree from background via CDP
async function requestCDPTree(tabId, selector) {
  const response = await sendBackgroundMessage(
    { type: 'getAXTree', tabId, selector: selector || null }
  );
  return response.tree;
}

// Render and display CDP tree into the container
function displayTree(tree, container, selDiv, selectorText) {
  if (tree.error) {
    renderError(container, tree.error);
    return;
  }

  if (selectorText !== undefined) {
    showElement(selDiv);
    selDiv.innerHTML = `<strong>Inspecting:</strong> <code>${escapeHtml(selectorText)}</code> → role: <strong>${escapeHtml(tree.role)}</strong>${tree.name ? ' — "' + escapeHtml(tree.name) + '"' : ''}`;
  }

  // Insert stats summary above the tree
  const statsHtml = buildTreeStats(tree);

  const display = showIgnored ? tree : filterIgnored(tree, showIgnored);
  container.innerHTML = statsHtml + (display
    ? renderTreeNode(display, 0)
    : '<div class="result-item"><div class="result-item-title">All nodes are ignored by assistive technology</div></div>');
  attachTreeToggle(container);
}

async function inspectElement() {
  const selector = document.getElementById('aria-selector').value.trim();
  if (!selector) {
    document.getElementById('aria-tree-container').innerHTML =
      '<div class="result-item"><div class="result-item-title" style="color:#e53935">Enter a CSS selector first</div><div class="result-item-desc">Examples: <b>nav</b>, <b>header</b>, <b>main</b>, <b>footer</b>, <b>#myId</b>, <b>.my-class</b>, <b>form</b>, <b>[role="dialog"]</b></div></div>';
    return;
  }

  const ariaLoading = document.getElementById('aria-loading');
  const container = document.getElementById('aria-tree-container');
  const selDiv = document.getElementById('aria-selected');

  showElement(ariaLoading);
  container.innerHTML = '';
  hideElement(selDiv);

  const tab = await getActiveTab();

  try {
    const tree = await requestCDPTree(tab.id, selector);
    hideElement(ariaLoading);
    displayTree(tree, container, selDiv, selector);
  } catch (e) {
    hideElement(ariaLoading);
    renderError(container, `Error: ${e.message}`);
  }
}

async function showFullTree() {
  const tab = await getActiveTab();
  const ariaLoading = document.getElementById('aria-loading');
  const container = document.getElementById('aria-tree-container');

  hideElement('aria-selected');
  showElement(ariaLoading);
  container.innerHTML = '';

  try {
    const tree = await requestCDPTree(tab.id, null);
    hideElement(ariaLoading);
    displayTree(tree, container);
  } catch (e) {
    hideElement(ariaLoading);
    renderError(container, `Error: ${e.message}`);
  }
}



async function pickElement() {
  await injectPicker();

  // Don't close the panel window — only close the popup
  if (!window.location.pathname.includes('panel.html')) {
    window.close();
  }
}




async function checkForPick() {
  const picked = await chrome.runtime.sendMessage({ type: 'getPickedElement' }).catch(() => null);
  if (!picked || !picked.selector) return;

  const container = document.getElementById('aria-tree-container');
  const ariaLoading = document.getElementById('aria-loading');
  const selDiv = document.getElementById('aria-selected');

  showElement(ariaLoading);
  container.innerHTML = '';
  hideElement(selDiv);

  try {
    const result = await chrome.runtime.sendMessage(
      { type: 'getAXTreeForPick', tabId: picked.tabId, selector: picked.selector }
    );

    hideElement(ariaLoading);

    if (!result.success) throw new Error(result.error);

    showElement(selDiv);
    selDiv.innerHTML = `🎯 <strong>Picked:</strong> <code>${escapeHtml(picked.selector)}</code>`;
    selDiv.className = 'scan-scope-badge active';

    const display = showIgnored ? result.tree : filterIgnored(result.tree, showIgnored);
    if (!display) {
      container.innerHTML = '<div class="result-item"><div class="result-item-title">Element not found in accessibility tree</div></div>';
      return;
    }

    const pickedNode = result.targetBackendId ? findNodeByBackendId(display, result.targetBackendId) : null;
    if (pickedNode) {
      // It's possible buildPickedSummary doesn't exist in aria-tree? Wait, pick-element imported buildPickedSummary from aria-tree! So it exists.
      selDiv.innerHTML += buildPickedSummary(pickedNode);
    }

    container.innerHTML = renderTreeNode(display, 0);
    attachTreeToggle(container);

    if (result.targetBackendId) {
      expandAndHighlightNode(container, result.targetBackendId);
    }
  } catch (e) {
    hideElement(ariaLoading);
    renderError(container, `Error: ${e.message}`);
  }
}



function filterTree(query) {
  const q = query.toLowerCase();
  const treeNodes = document.querySelectorAll('#aria-tree-container .ax-node');
  
  if (!q) {
    // Reset all
    treeNodes.forEach(n => {
      n.style.display = '';
      if(n.dataset.searchHidden) delete n.dataset.searchHidden;
    });
    return;
  }

  // Iterate and check matches
  treeNodes.forEach(n => {
    const text = (n.textContent || '').toLowerCase();
    if (text.includes(q)) {
      n.style.display = '';
      delete n.dataset.searchHidden;
      // Show parents
      let parent = n.closest('.ax-children');
      while(parent) {
        const toggleNode = parent.previousElementSibling;
        if(toggleNode && toggleNode.classList.contains('ax-node')) {
          toggleNode.style.display = '';
          delete toggleNode.dataset.searchHidden;
        }
        parent = parent.parentElement?.closest('.ax-children');
      }
    } else {
      n.dataset.searchHidden = 'true';
    }
  });

  // Second pass to apply hiding
  treeNodes.forEach(n => {
    if (n.dataset.searchHidden) {
      n.style.display = 'none';
      const childrenWrapper = n.nextElementSibling;
      if (childrenWrapper && childrenWrapper.classList.contains('ax-children')) {
        childrenWrapper.style.display = 'none';
      }
    } else {
      // Auto expand matching nodes
      const toggle = n.querySelector('.ax-toggle');
      if (toggle && toggle.textContent === '+') {
        toggle.click();
      }
    }
  });
}





export function initAriaTree() {
  document.getElementById('chk-show-ignored')?.addEventListener('change', (e) => {
    showIgnored = e.target.checked;
    // Re-trigger current state if we want, for now it will just apply on next load
  });

  const searchInput = document.getElementById('aria-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterTree(e.target.value);
    });
  }

  document.getElementById('btn-pick-element')?.addEventListener('click', pickElement);
  document.getElementById('btn-full-tree')?.addEventListener('click', showFullTree);

  // Listen for pick results when panel is already open
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'pickReady') {
      // Switch to aria-tree panel if not already active
      const navBtn = document.querySelector('.nav-btn[data-panel="aria-tree"]');
      if (navBtn && !navBtn.classList.contains('active')) navBtn.click();
      checkForPick();
    }
  });

  checkForPick();
}
