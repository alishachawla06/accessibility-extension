// ─── Background Service Worker ──────────────────────────────────────────────
// Uses Chrome DevTools Protocol (CDP) to get the real computed accessibility tree.

let panelWindowId = null;
let sourceWindowId = null;

function createPanelWindow(panel, openerWindowId) {
  const url = chrome.runtime.getURL('popup/panel.html' + (panel ? '#' + panel : ''));
  // Remember which browser window the panel was opened from
  if (openerWindowId) sourceWindowId = openerWindowId;
  if (panelWindowId !== null) {
    // Reuse existing window — update its URL and focus it
    chrome.windows.update(panelWindowId, { focused: true }, () => {
      chrome.tabs.query({ windowId: panelWindowId }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { url });
        }
      });
    });
  } else {
    chrome.windows.create({
      url,
      type: 'popup',
      width: 520,
      height: 680
    }, (win) => {
      panelWindowId = win.id;
    });
  }
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelWindowId) {
    panelWindowId = null;
  }
});

// Open floating panel directly when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  createPanelWindow(null, tab.windowId);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'openPanel') {
    createPanelWindow(msg.panel, msg.windowId);
    return;
  }
  if (msg.type === 'getTargetTab') {
    // Return the active tab from the source browser window (never a chrome-extension:// or chrome:// tab)
    const tryWindow = async (windowId) => {
      if (!windowId) return null;
      const tabs = await chrome.tabs.query({ active: true, windowId });
      const real = tabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
      return real || null;
    };
    (async () => {
      // 1. Try the remembered source window
      let tab = await tryWindow(sourceWindowId);
      if (tab) return sendResponse(tab);
      // 2. Try all normal windows
      const allTabs = await chrome.tabs.query({ active: true, windowType: 'normal' });
      tab = allTabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
      sendResponse(tab || null);
    })();
    return true;
  }
  if (msg.type === 'getAXTree') {
    getAXTree(msg.tabId, msg.selector)
      .then(tree => sendResponse({ success: true, tree }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // keep channel open for async response
  }
  if (msg.type === 'elementPicked') {
    if (!msg.selector) return; // Escape pressed — cancel silently
    pickedElement = { selector: msg.selector, tabId: msg.tabId };
    if (panelWindowId !== null) {
      // Panel already open — focus it and signal to process the pick
      chrome.windows.update(panelWindowId, { focused: true });
      chrome.runtime.sendMessage({ type: 'pickReady' }).catch(() => {});
    } else {
      createPanelWindow('aria-tree', null);
    }
    return;
  }
  if (msg.type === 'getPickedElement') {
    const result = pickedElement;
    pickedElement = null; // consume it
    sendResponse(result || null);
    return;
  }
  if (msg.type === 'getAXTreeForPick') {
    // Get full tree + resolve which backendDOMNodeId matches the picked selector
    getAXTreeForPick(msg.tabId, msg.selector)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true;
  }
  if (msg.type === 'getAccessibleNames') {
    // Resolve computed accessible names for an array of CSS selectors via CDP
    getAccessibleNames(msg.tabId, msg.selectors)
      .then(names => sendResponse({ success: true, names }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true;
  }
  if (msg.type === 'startPickingSection') {
    pickedSectionData = { from: msg.from }; // remember who called it
    // Inject the picker logic manually since we are closing the popup
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: pickSectionInTab,
      args: [{ wcagLevel: msg.level, from: msg.from }]
    });
    return;
  }
  if (msg.type === 'finishPickingSection') {
    pickedSectionData = {
      ...pickedSectionData,
      selector: msg.selector,
      tag: msg.tag,
      role: msg.role,
      label: msg.label,
      level: msg.level
    };
    // Re-open panel automatically
    createPanelWindow(pickedSectionData.from === 'tab-stops' ? 'tab-stops' : 'auto-check', null);
    return;
  }
  if (msg.type === 'getPickedSection') {
    const result = pickedSectionData;
    if (msg.consume && pickedSectionData) {
      if (pickedSectionData.from === msg.consumerId) {
         pickedSectionData = null; // consume it
      }
    }
    sendResponse(result || null);
    return;
  }
});

let pickedElement = null;
let pickedSectionData = null;

// Function run natively in the page context
function pickSectionInTab({ wcagLevel }) {
  let hl = document.getElementById('a11y-section-hl');
  if (!hl) {
    hl = document.createElement('div');
    hl.id = 'a11y-section-hl';
    Object.assign(hl.style, {
      position: 'absolute', zIndex: '2147483646', pointerEvents: 'none',
      border: '2px dashed #1976d2', background: 'rgba(25,118,210,0.1)',
      borderRadius: '2px', transition: 'none'
    });
    document.body.appendChild(hl);
  }

  // Tooltip
  let tip = document.getElementById('a11y-section-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'a11y-section-tip';
    Object.assign(tip.style, {
      position: 'absolute', zIndex: '2147483647', pointerEvents: 'none',
      background: '#1a1a2e', color: '#fff', padding: '4px 10px',
      borderRadius: '4px', fontSize: '12px', fontWeight: '600',
      fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap'
    });
    document.body.appendChild(tip);
  }

  let start = null;
  let isDragging = false;

  const onDown = (e) => {
    isDragging = true;
    start = { x: e.clientX, y: e.clientY };
    Object.assign(hl.style, {
      left: (start.x + window.scrollX) + 'px',
      top: (start.y + window.scrollY) + 'px',
      width: '0px', height: '0px',
      display: 'block'
    });
    tip.style.display = 'none';
    e.preventDefault();
  };

  const onMove = (e) => {
    tip.textContent = "Draw a rectangle to select area";
    Object.assign(tip.style, {
      top: (e.clientY + window.scrollY + 10) + 'px',
      left: (e.clientX + window.scrollX + 10) + 'px',
      display: 'block'
    });

    if (!isDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const minX = Math.min(start.x, currentX);
    const minY = Math.min(start.y, currentY);
    const width = Math.abs(currentX - start.x);
    const height = Math.abs(currentY - start.y);

    Object.assign(hl.style, {
      left: (minX + window.scrollX) + 'px',
      top: (minY + window.scrollY) + 'px',
      width: width + 'px',
      height: height + 'px'
    });
    e.preventDefault();
  };

  const cleanup = () => {
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    document.removeEventListener('keydown', onEsc, true);
    if(hl) hl.remove();
    if(tip) tip.remove();
  };

  const onUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    e.preventDefault();
    e.stopPropagation();

    const minX = Math.min(start.x, e.clientX);
    const minY = Math.min(start.y, e.clientY);
    const width = Math.abs(e.clientX - start.x);
    const height = Math.abs(e.clientY - start.y);

    // Find the center of the drawn box to pick the target element
    const cx = minX + width/2;
    const cy = minY + height/2;
    let target = document.elementFromPoint(cx, cy);
    if(!target) target = document.body;

    // Walk up to the nearest semantic container whose bounds overlap the drawn box
    const sectionTags = ['header', 'nav', 'main', 'footer', 'aside', 'section', 'form'];
    const sectionRoles = ['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region', 'form'];
    let candidate = target;
    for (let i = 0; i < 15; i++) {
      if (!candidate || candidate === document.body || candidate === document.documentElement) break;
      const tag = candidate.tagName.toLowerCase();
      const role = candidate.getAttribute('role') || '';
      if (sectionTags.includes(tag) || sectionRoles.includes(role)) {
        const r = candidate.getBoundingClientRect();
        // Check that semantic container overlaps drawn rectangle
        if (r.left <= minX + width && r.right >= minX && r.top <= minY + height && r.bottom >= minY) {
          target = candidate;
          break;
        }
      }
      candidate = candidate.parentElement;
    }

    function getSelector(el) {
      if (el.id) return '#' + CSS.escape(el.id);
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;
      const siblings = [...parent.children].filter(c => c.tagName === el.tagName);
      if (siblings.length === 1) return getSelector(parent) + ' > ' + tag;
      const idx = siblings.indexOf(el) + 1;
      return getSelector(parent) + ' > ' + tag + ':nth-of-type(' + idx + ')';
    }

    const sel = getSelector(target);
    cleanup();
    chrome.runtime.sendMessage({
      type: 'finishPickingSection',
      selector: sel,
      tag: target.tagName,
      role: target.getAttribute('role') || '',
      label: target.getAttribute('aria-label') || '',
      level: wcagLevel
    });
  };

  const onEsc = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'finishPickingSection', selector: null });
    }
  };

  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
  document.addEventListener('keydown', onEsc, true);
}

async function getAXTree(tabId, selector) {
  const debuggee = { tabId };

  // Attach debugger
  await chrome.debugger.attach(debuggee, '1.3');

  try {
    // Enable accessibility domain
    await chrome.debugger.sendCommand(debuggee, 'Accessibility.enable');
    // Enable DOM domain for tag name resolution
    await chrome.debugger.sendCommand(debuggee, 'DOM.enable');

    let rootNodeId = null;

    // If a CSS selector is specified, resolve its DOM node first
    if (selector) {
      const doc = await chrome.debugger.sendCommand(debuggee, 'DOM.getDocument', { depth: 0 });
      const queryResult = await chrome.debugger.sendCommand(debuggee, 'DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: selector
      });
      if (!queryResult.nodeId) {
        throw new Error('No element found for selector: ' + selector);
      }

      // Get the AX node for the specific DOM node
      const axNodeResult = await chrome.debugger.sendCommand(debuggee, 'Accessibility.getPartialAXTree', {
        nodeId: queryResult.nodeId,
        fetchRelatives: true
      });

      if (axNodeResult.nodes && axNodeResult.nodes.length > 0) {
        rootNodeId = axNodeResult.nodes[0].nodeId;
        // Resolve tag names + attributes for partial tree
        const { tagMap: partialTagMap, attrMap: partialAttrMap } = await resolveTagNames(axNodeResult.nodes, debuggee);
        return buildNestedTree(axNodeResult.nodes, rootNodeId, debuggee, partialTagMap, partialAttrMap);
      }
    }

    // Full page tree
    const result = await chrome.debugger.sendCommand(debuggee, 'Accessibility.getFullAXTree', {
      depth: 0 // 0 = unlimited depth
    });

    if (!result.nodes || result.nodes.length === 0) {
      return { role: 'none', name: '(empty tree)', children: [], ignored: false, props: {}, tag: '' };
    }

    const { tagMap, attrMap } = await resolveTagNames(result.nodes, debuggee);
    return buildNestedTree(result.nodes, null, debuggee, tagMap, attrMap);
  } finally {
    // Always detach
    try {
      await chrome.debugger.detach(debuggee);
    } catch (e) {
      // already detached
    }
  }
}

// HTML attributes worth surfacing in the tree
const USEFUL_HTML_ATTRS = ['alt', 'loading', 'src', 'href', 'type', 'placeholder',
  'title', 'lang', 'dir', 'tabindex', 'target', 'rel', 'for',
  'action', 'method', 'width', 'height', 'srcset', 'sizes', 'decoding',
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-live',
  'aria-atomic', 'aria-relevant', 'aria-hidden', 'aria-expanded',
  'aria-haspopup', 'aria-controls', 'aria-owns', 'aria-current',
  'aria-pressed', 'aria-checked', 'aria-selected', 'aria-disabled',
  'aria-required', 'aria-invalid', 'aria-errormessage', 'aria-valuemin',
  'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-roledescription',
  'role'];

/**
 * Resolve DOM tag names + HTML attributes for AX nodes via CDP DOM.describeNode.
 * Returns { tagMap: Map<nodeId, tagName>, attrMap: Map<nodeId, {key:val}> }
 */
async function resolveTagNames(nodes, debuggee) {
  const tagMap = new Map();
  const attrMap = new Map();
  const nodesToResolve = nodes.filter(n => n.backendDOMNodeId);
  const CHUNK = 200;
  for (let i = 0; i < nodesToResolve.length; i += CHUNK) {
    const chunk = nodesToResolve.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async (n) => {
      try {
        const desc = await chrome.debugger.sendCommand(debuggee, 'DOM.describeNode', {
          backendNodeId: n.backendDOMNodeId,
          depth: 0
        });
        if (desc && desc.node) {
          if (desc.node.nodeName) {
            tagMap.set(n.nodeId, desc.node.nodeName.toLowerCase());
          }
          // attributes is a flat array: [name, value, name, value, ...]
          if (desc.node.attributes) {
            const attrs = {};
            for (let i = 0; i < desc.node.attributes.length; i += 2) {
              const aName = desc.node.attributes[i];
              const aVal = desc.node.attributes[i + 1];
              if (USEFUL_HTML_ATTRS.includes(aName)) {
                attrs[aName] = aVal;
              }
            }
            if (Object.keys(attrs).length > 0) {
              attrMap.set(n.nodeId, attrs);
            }
          }
        }
      } catch (e) {
        // skip unresolvable nodes
      }
    }));
  }
  return { tagMap, attrMap };
}

/**
 * Transform the flat CDP AX node array into a nested tree.
 * CDP nodes have: nodeId, role, name, ignored, childIds, properties
 */
function buildNestedTree(nodes, rootId, debuggee, tagMap, attrMap) {
  const nodeMap = new Map();

  // Build lookup
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Find root
  const rootNode = rootId ? nodeMap.get(rootId) : nodes[0];
  if (!rootNode) {
    return { role: 'none', name: '(empty tree)', children: [], ignored: false, props: {}, tag: '' };
  }

  return transformNode(rootNode, nodeMap, 0, tagMap, null, attrMap);
}

function transformNode(node, nodeMap, depth, tagMap, ancestorLive, attrMap) {
  if (!node || depth > 50) return null;

  const role = extractValue(node.role) || 'unknown';
  const name = extractValue(node.name) || '';
  const ignored = node.ignored || false;
  const ignoredReasons = node.ignoredReasons;

  // Get DOM tag name from tagMap
  let tag = '';
  if (tagMap && tagMap.has(node.nodeId)) {
    tag = tagMap.get(node.nodeId);
  } else if (node.description) {
    tag = node.description;
  }

  // Extract name source (how the accessible name was computed)
  let nameSource = '';
  if (node.name && node.name.sources && node.name.sources.length > 0) {
    const src = node.name.sources.find(s => s.value && extractValue(s.value));
    if (src) nameSource = src.type || '';
  }
  // Fallback: use the name type from CDP
  if (!nameSource && node.name && node.name.type) {
    nameSource = node.name.type;
  }

  // Extract heading level from properties
  let headingLevel = 0;
  if (role === 'heading' && node.properties) {
    const lvlProp = node.properties.find(p => p.name === 'level');
    if (lvlProp) {
      headingLevel = parseInt(extractValue(lvlProp.value)) || 0;
    }
  }
  // Fallback from tag name
  if (role === 'heading' && !headingLevel && tag) {
    const m = tag.match(/^h(\d)$/);
    if (m) headingLevel = parseInt(m[1]);
  }

  // Extract ARIA properties
  const props = {};
  if (node.properties) {
    for (const prop of node.properties) {
      const pName = prop.name;
      const pValue = extractValue(prop.value);
      if (pValue !== undefined && pValue !== '' && pValue !== 'false') {
        props[pName] = String(pValue);
      }
    }
  }

  // Merge HTML attributes (alt, loading, src, etc.) — don't overwrite ARIA props
  const htmlAttrs = (attrMap && attrMap.has(node.nodeId)) ? attrMap.get(node.nodeId) : null;
  if (htmlAttrs) {
    for (const [k, v] of Object.entries(htmlAttrs)) {
      if (!(k in props)) {
        props[k] = v;
      }
    }
  }

  // Detect if THIS node is a live region
  let currentLive = ancestorLive || null;
  if (props.live && props.live !== 'off') {
    currentLive = props.live;
  } else if (['status', 'log', 'marquee', 'timer'].includes(role)) {
    currentLive = 'polite';
  } else if (role === 'alert') {
    currentLive = 'assertive';
  }

  // Recurse into children, passing down live region context
  const children = [];
  if (node.childIds) {
    for (const childId of node.childIds) {
      const childNode = nodeMap.get(childId);
      if (childNode) {
        const child = transformNode(childNode, nodeMap, depth + 1, tagMap, currentLive, attrMap);
        if (child) children.push(child);
      }
    }
  }

  // For ignored nodes, add reason
  let ignoredReason = '';
  if (ignored && ignoredReasons && ignoredReasons.length > 0) {
    ignoredReason = ignoredReasons
      .map(r => extractValue(r.value) || r.name)
      .filter(Boolean)
      .join(', ');
  }

  // Only set ancestorLive on children (not on the live region root itself)
  const isLiveRoot = (props.live && props.live !== 'off') ||
    ['status', 'alert', 'log', 'marquee', 'timer'].includes(role);

  return {
    role,
    name,
    tag,
    headingLevel,
    nameSource,
    backendDOMNodeId: node.backendDOMNodeId || null,
    ignored,
    ignoredReason,
    props,
    children,
    ancestorLive: (!isLiveRoot && ancestorLive) ? ancestorLive : null
  };
}

/**
 * CDP AXValue has different formats: { type, value } or just a primitive.
 */
function extractValue(axValue) {
  if (!axValue) return '';
  if (typeof axValue === 'string') return axValue;
  if (typeof axValue === 'number' || typeof axValue === 'boolean') return String(axValue);
  if (axValue.value !== undefined) return String(axValue.value);
  if (axValue.type === 'computedString' || axValue.type === 'idref') return axValue.value || '';
  return '';
}

/**
 * Fetch full AX tree and find which backendDOMNodeId matches a picked CSS selector.
 * Returns { tree, targetBackendId }.
 */
async function getAXTreeForPick(tabId, pickedSelector) {
  const debuggee = { tabId };
  await chrome.debugger.attach(debuggee, '1.3');

  try {
    await chrome.debugger.sendCommand(debuggee, 'Accessibility.enable');
    await chrome.debugger.sendCommand(debuggee, 'DOM.enable');

    // Resolve the picked selector to a backendNodeId
    const doc = await chrome.debugger.sendCommand(debuggee, 'DOM.getDocument', { depth: 0 });
    let targetBackendId = null;

    try {
      const queryResult = await chrome.debugger.sendCommand(debuggee, 'DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: pickedSelector
      });
      if (queryResult.nodeId) {
        // Get backendNodeId for this DOM node
        const desc = await chrome.debugger.sendCommand(debuggee, 'DOM.describeNode', {
          nodeId: queryResult.nodeId,
          depth: 0
        });
        if (desc && desc.node) {
          targetBackendId = desc.node.backendNodeId;
        }
      }
    } catch (e) {
      // couldn't resolve picked element
    }

    // Get full tree
    const result = await chrome.debugger.sendCommand(debuggee, 'Accessibility.getFullAXTree', {
      depth: 0
    });

    if (!result.nodes || result.nodes.length === 0) {
      return { tree: { role: 'none', name: '(empty tree)', children: [], ignored: false, props: {}, tag: '' }, targetBackendId: null };
    }

    const { tagMap, attrMap } = await resolveTagNames(result.nodes, debuggee);
    const tree = buildNestedTree(result.nodes, null, debuggee, tagMap, attrMap);
    return { tree, targetBackendId };
  } finally {
    try { await chrome.debugger.detach(debuggee); } catch (e) {}
  }
}

/**
 * Resolve computed accessible names for an array of CSS selectors via CDP.
 * Returns array of { selector, name, role, ignored } objects.
 */
async function getAccessibleNames(tabId, selectors) {
  const debuggee = { tabId };
  await chrome.debugger.attach(debuggee, '1.3');

  try {
    await chrome.debugger.sendCommand(debuggee, 'Accessibility.enable');
    await chrome.debugger.sendCommand(debuggee, 'DOM.enable');
    const doc = await chrome.debugger.sendCommand(debuggee, 'DOM.getDocument', { depth: 0 });

    const results = [];
    for (const sel of selectors) {
      try {
        const q = await chrome.debugger.sendCommand(debuggee, 'DOM.querySelector', {
          nodeId: doc.root.nodeId,
          selector: sel
        });
        if (!q.nodeId) {
          results.push({ selector: sel, name: '', role: '', ignored: false, error: 'not found' });
          continue;
        }
        const ax = await chrome.debugger.sendCommand(debuggee, 'Accessibility.getPartialAXTree', {
          nodeId: q.nodeId,
          fetchRelatives: false
        });
        if (ax.nodes && ax.nodes.length > 0) {
          const n = ax.nodes[0];
          results.push({
            selector: sel,
            name: extractValue(n.name) || '',
            role: extractValue(n.role) || '',
            ignored: n.ignored || false
          });
        } else {
          results.push({ selector: sel, name: '', role: '', ignored: true });
        }
      } catch (e) {
        results.push({ selector: sel, name: '', role: '', ignored: false, error: e.message });
      }
    }
    return results;
  } finally {
    try { await chrome.debugger.detach(debuggee); } catch (e) {}
  }
}
