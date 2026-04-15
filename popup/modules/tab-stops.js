// ─── Tab Stops Module ───────────────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement } from './utils.js';

let lastTabResult = null;
let tabViewMode = 'flat';
let lastFlowState = false;

let pickedTabSelector = null;

async function showTabStops(withFlow, mode = tabViewMode, contextSelector = pickedTabSelector) {
  lastFlowState = withFlow;
  const tab = await getActiveTab();

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (addFlow, viewMode, contextSelector) => {
      const baseSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable]';
      const root = contextSelector ? (document.querySelector(contextSelector) || document) : document;
      const elements = Array.from(root.querySelectorAll(baseSelector)).filter(el => {
        const tabindex = el.getAttribute('tabindex');
        if (tabindex && parseInt(tabindex) < 0) return false;
        if (el.disabled) return false;
        if (el.offsetParent === null && el.getAttribute('type') !== 'hidden') return false;
        return true;
      });

      // Remove existing overlays
      document.querySelectorAll('.a11y-ext-tab-marker, .a11y-ext-svg-overlay').forEach(m => m.remove());

      // Find component for each element
      function getComponent(el) {
        let parent = el;
        for (let i = 0; i < 15; i++) {
          if (!parent || parent === document.body || parent === document.documentElement) break;
          const tag = parent.tagName.toLowerCase();
          const role = parent.getAttribute('role') || '';
          const label = parent.getAttribute('aria-label') || '';
          if (['header', 'nav', 'main', 'footer', 'aside', 'section', 'form'].includes(tag))
            return label ? tag + ' - ' + label : tag;
          if (['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region', 'form'].includes(role))
            return label ? role + ' - ' + label : role;
          parent = parent.parentElement;
        }
        return 'page';
      }

      let svg = null;
      if (addFlow) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('a11y-ext-svg-overlay');
        svg.style.cssText = `
          position: absolute; top: 0; left: 0;
          width: ${document.documentElement.scrollWidth}px;
          height: ${document.documentElement.scrollHeight}px;
          z-index: 2147483646; pointer-events: none; overflow: visible;
        `;
        document.body.appendChild(svg);

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
          <marker id="a11y-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4fc3f7" />
          </marker>
          <marker id="a11y-arrow-warn" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#ff5722" />
          </marker>
        `;
        svg.appendChild(defs);
      }

      const MARKER_STYLE = `
        width: 24px; height: 24px; background: #1a1a2e; color: #fff;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; font-family: -apple-system, sans-serif;
        z-index: 2147483647; pointer-events: none; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `;

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      const itemsWithOrder = [];
      const jumps = [];

      if (viewMode === 'component') {
        // Group elements by component
        const groups = {};
        elements.forEach(el => {
          const comp = getComponent(el);
          if (!groups[comp]) groups[comp] = [];
          groups[comp].push(el);
        });

        Object.values(groups).forEach(groupElements => {
          const coords = [];
          groupElements.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + scrollX + rect.width / 2;
            const cy = rect.top + scrollY + rect.height / 2;
            coords.push({ x: cx, y: cy });

            const order = i + 1;
            const marker = document.createElement('div');
            marker.className = 'a11y-ext-tab-marker';
            marker.textContent = order;
            marker.style.cssText = `
              position: absolute;
              top: ${rect.top + scrollY - 12}px;
              left: ${rect.left + scrollX - 12}px;
              ${MARKER_STYLE}
            `;
            document.body.appendChild(marker);

            el.style.outline = '2px solid #4fc3f7';
            el.style.outlineOffset = '2px';
            el.dataset.a11yExtOrigOutline = 'true';

            itemsWithOrder.push({ el, order, isJump: false });
          });

          // Draw flow lines only within this group
          if (addFlow && svg) {
            for (let i = 0; i < coords.length - 1; i++) {
              const from = coords[i];
              const to = coords[i + 1];
              const dx = Math.abs(to.x - from.x);
              const dy = Math.abs(to.y - from.y);
              const distance = Math.sqrt(dx * dx + dy * dy);
              const goesBackward = (to.y - from.y) < -100;
              const hugeJump = distance > 800;
              const isWarning = goesBackward || hugeJump;
              
              const itemToUpdate = itemsWithOrder.find(item => item.el === groupElements[i+1]);
              if (itemToUpdate && isWarning) {
                itemToUpdate.isJump = true;
                jumps.push(itemToUpdate.order);
              }

              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', from.x);
              line.setAttribute('y1', from.y);
              line.setAttribute('x2', to.x);
              line.setAttribute('y2', to.y);
              line.setAttribute('stroke', isWarning ? '#ff5722' : '#4fc3f7');
              line.setAttribute('stroke-width', isWarning ? '3' : '2');
              line.setAttribute('stroke-dasharray', isWarning ? '8,4' : 'none');
              line.setAttribute('stroke-opacity', '0.7');
              line.setAttribute('marker-end', isWarning ? 'url(#a11y-arrow-warn)' : 'url(#a11y-arrow)');
              svg.appendChild(line);
            }
          }
        });
      } else {
        // Flat mode
        const coords = [];
        elements.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + scrollX + rect.width / 2;
          const cy = rect.top + scrollY + rect.height / 2;
          coords.push({ x: cx, y: cy });

          const order = i + 1;
          const marker = document.createElement('div');
          marker.className = 'a11y-ext-tab-marker';
          marker.textContent = order;
          marker.style.cssText = `
            position: absolute;
            top: ${rect.top + scrollY - 12}px;
            left: ${rect.left + scrollX - 12}px;
            ${MARKER_STYLE}
          `;
          document.body.appendChild(marker);

          el.style.outline = '2px solid #4fc3f7';
          el.style.outlineOffset = '2px';
          el.dataset.a11yExtOrigOutline = 'true';

          itemsWithOrder.push({ el, order, isJump: false });
        });

        // Draw flow lines across all elements
        if (addFlow && svg) {
          for (let i = 0; i < coords.length - 1; i++) {
            const from = coords[i];
            const to = coords[i + 1];
            const dx = Math.abs(to.x - from.x);
            const dy = Math.abs(to.y - from.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const goesBackward = (to.y - from.y) < -100;
            const hugeJump = distance > 800;
            const isWarning = goesBackward || hugeJump;
            
            const itemToUpdate = itemsWithOrder[i + 1];
            if (itemToUpdate && isWarning) {
              itemToUpdate.isJump = true;
              jumps.push(itemToUpdate.order);
            }

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
            line.setAttribute('stroke', isWarning ? '#ff5722' : '#4fc3f7');
            line.setAttribute('stroke-width', isWarning ? '3' : '2');
            line.setAttribute('stroke-dasharray', isWarning ? '8,4' : 'none');
            line.setAttribute('stroke-opacity', '0.7');
            line.setAttribute('marker-end', isWarning ? 'url(#a11y-arrow-warn)' : 'url(#a11y-arrow)');
            svg.appendChild(line);
          }
        }
      }

      return itemsWithOrder.map((item) => ({
        order: item.order,
        tag: item.el.tagName.toLowerCase(),
        text: (item.el.textContent || item.el.getAttribute('aria-label') || item.el.getAttribute('placeholder') || '').trim().substring(0, 50),
        role: item.el.getAttribute('role') || '',
        component: getComponent(item.el),
        isJump: item.isJump
      }));
    },
    args: [withFlow, mode, contextSelector]
  });

  hideElement('btn-show-tabs');
  hideElement('btn-show-flow');
  showElement('btn-hide-tabs');
  showElement('tab-view-toggle');

  document.getElementById('count-focusable').textContent = result.length;
  showElement('tab-stats');

  if (withFlow) {
    const jumpCount = result.filter(el => el.isJump).length;
    if (jumpCount > 0) {
      document.getElementById('count-focusable').textContent =
        `${result.length} (${jumpCount} tab trap${jumpCount > 1 ? 's' : ''} detected)`;
    }
  }

  lastTabResult = result;
  tabViewMode = mode;
  
  if (tabViewMode === 'flat') {
    document.getElementById('btn-tab-view-flat')?.classList.add('active');
    document.getElementById('btn-tab-view-component')?.classList.remove('active');
    renderTabList(result);
  } else {
    document.getElementById('btn-tab-view-component')?.classList.add('active');
    document.getElementById('btn-tab-view-flat')?.classList.remove('active');
    renderTabsByComponent(result);
  }
}

function renderTabList(items) {
  const list = document.getElementById('tab-list');
  list.innerHTML = '';
  items.forEach(el => {
    const item = document.createElement('div');
    item.className = 'tab-item' + (el.isJump ? ' tab-jump-warning' : '');
    item.innerHTML = `
      <div class="tab-order" ${el.isJump ? 'style="background:#ff5722"' : ''}>${el.order}</div>
      <div class="tab-info">
        <div class="tab-tag">&lt;${el.tag}&gt;${el.role ? ' [role="' + escapeHtml(el.role) + '"]' : ''}${el.isJump ? ' <span style="color:#ff5722;font-weight:700">⚠ Tab trap / illogical jump</span>' : ''}</div>
        <div class="tab-selector">${escapeHtml(el.text) || '(no text)'}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderTabsByComponent(items) {
  const list = document.getElementById('tab-list');
  list.innerHTML = '';
  const groups = {};
  items.forEach(el => {
    const comp = el.component || 'page';
    if (!groups[comp]) groups[comp] = [];
    groups[comp].push(el);
  });

  Object.entries(groups).forEach(([comp, els]) => {
    const section = document.createElement('div');
    section.className = 'component-group';
    const header = document.createElement('div');
    header.className = 'component-header';
    header.innerHTML = `
      <span class="component-name">&lt;${escapeHtml(comp)}&gt;</span>
      <span class="component-count">${els.length} focusable</span>
    `;
    section.appendChild(header);
    els.forEach(el => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (el.isJump ? ' tab-jump-warning' : '');
      item.innerHTML = `
        <div class="tab-order" ${el.isJump ? 'style="background:#ff5722"' : ''}>${el.order}</div>
        <div class="tab-info">
          <div class="tab-tag">&lt;${el.tag}&gt;${el.role ? ' [role="' + escapeHtml(el.role) + '"]' : ''}${el.isJump ? ' <span style="color:#ff5722;font-weight:700">⚠ Jump</span>' : ''}</div>
          <div class="tab-selector">${escapeHtml(el.text) || '(no text)'}</div>
        </div>
      `;
      section.appendChild(item);
    });
    list.appendChild(section);
  });
}

async function hideTabStops() {
  const tab = await getActiveTab();

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document.querySelectorAll('.a11y-ext-tab-marker, .a11y-ext-svg-overlay').forEach(m => m.remove());
      document.querySelectorAll('[data-a11y-ext-orig-outline]').forEach(el => {
        el.style.outline = '';
        el.style.outlineOffset = '';
        delete el.dataset.a11yExtOrigOutline;
      });
    }
  });

  showElement('btn-show-tabs');
  showElement('btn-show-flow');
  hideElement('btn-hide-tabs');
  hideElement('tab-stats');
  hideElement('tab-view-toggle');
  lastTabResult = null;
  pickedTabSelector = null;
  document.getElementById('tab-list').innerHTML = '';
}

export function initTabStops() {
  document.getElementById('btn-show-tabs').addEventListener('click', () => showTabStops(false));
  document.getElementById('btn-show-flow').addEventListener('click', () => showTabStops(true));
  document.getElementById('btn-hide-tabs').addEventListener('click', hideTabStops);

  const btnPick = document.getElementById('btn-pick-tab-component');
  if (btnPick) {
    btnPick.addEventListener('click', async () => {
      const tab = await getActiveTab();
      chrome.runtime.sendMessage({ type: 'startPickingSection', tabId: tab.id, level: 'bp', from: 'tab-stops' });
      window.close();
    });

    // Check if we just finished picking a section
    chrome.runtime.sendMessage({ type: 'getPickedSection', consume: true, consumerId: 'tab-stops' }, (response) => {
      if (response && response.selector && response.from === 'tab-stops') {
        pickedTabSelector = response.selector;
        showTabStops(true, 'flat'); 
      }
    });
  }

  document.getElementById('btn-tab-view-flat')?.addEventListener('click', () => {
    if (!lastTabResult) return;
    tabViewMode = 'flat';
    document.getElementById('btn-tab-view-flat').classList.add('active');
    document.getElementById('btn-tab-view-component').classList.remove('active');
    showTabStops(lastFlowState, 'flat');
  });
  document.getElementById('btn-tab-view-component')?.addEventListener('click', () => {
    if (!lastTabResult) return;
    tabViewMode = 'component';
    document.getElementById('btn-tab-view-component').classList.add('active');
    document.getElementById('btn-tab-view-flat').classList.remove('active');
    showTabStops(lastFlowState, 'component');
  });
}
