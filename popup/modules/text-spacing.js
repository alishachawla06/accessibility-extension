// ─── Text Spacing Module (WCAG 1.4.12) ─────────────────────────────────────
import { getActiveTab, showElement, hideElement } from './utils.js';

let isActive = false;

const SPACING_CSS = `
  * {
    line-height: 1.5em !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, .paragraph, [class*="paragraph"] {
    margin-bottom: 2em !important;
  }
`;

async function toggleTextSpacing() {
  const tab = await getActiveTab();
  const btn = document.getElementById('btn-toggle-spacing');
  const screenshotBtn = document.getElementById('btn-spacing-screenshot');
  const status = document.getElementById('spacing-status');

  if (isActive) {
    await chrome.scripting.removeCSS({
      target: { tabId: tab.id },
      css: SPACING_CSS
    });
    isActive = false;
    btn.textContent = 'Enable Text Spacing';
    btn.classList.remove('btn-active');
    hideElement(screenshotBtn);
    status.textContent = 'Inactive';
    status.className = 'spacing-status spacing-off';
  } else {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      css: SPACING_CSS
    });
    isActive = true;
    btn.textContent = 'Disable Text Spacing';
    btn.classList.add('btn-active');
    showElement(screenshotBtn);
    status.textContent = 'Active — Check for text overlap or broken containers';
    status.className = 'spacing-status spacing-on';
  }
}

async function captureScreenshot() {
  try {
    const tab = await getActiveTab();
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    // Open screenshot in a new tab
    const html = `<!DOCTYPE html><html><head><title>Text Spacing Screenshot</title>
      <style>body{margin:0;background:#222;display:flex;justify-content:center;padding:20px}
      img{max-width:100%;box-shadow:0 4px 20px rgba(0,0,0,0.5);border-radius:4px}</style></head>
      <body><img src="${dataUrl}" alt="Text spacing compliance screenshot"></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    const status = document.getElementById('spacing-status');
    status.textContent = 'Screenshot failed: ' + e.message;
    status.className = 'spacing-status spacing-off';
  }
}

export function initTextSpacing() {
  document.getElementById('btn-toggle-spacing').addEventListener('click', toggleTextSpacing);
  document.getElementById('btn-spacing-screenshot').addEventListener('click', captureScreenshot);
}
