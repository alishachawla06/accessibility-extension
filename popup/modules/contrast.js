// ─── Color Contrast Module ──────────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, renderSuccess } from './utils.js';

async function runContrastCheck(level) {
  const btnAA = document.getElementById('btn-contrast-aa');
  const btnAAA = document.getElementById('btn-contrast-aaa');
  const btnHide = document.getElementById('btn-contrast-hide');
  const loading = document.getElementById('contrast-loading');
  const summary = document.getElementById('contrast-summary');
  const list = document.getElementById('contrast-list');

  btnAA.disabled = true;
  btnAAA.disabled = true;
  showElement(loading);
  hideElement(summary);
  list.innerHTML = '';

  const ratio = level === 'AAA' ? 7 : 4.5;
  const largeRatio = level === 'AAA' ? 4.5 : 3;

  const tab = await getActiveTab();

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (minRatio, minLargeRatio) => {
        // Remove previous overlays
        document.querySelectorAll('.a11y-contrast-overlay').forEach(el => el.remove());
        document.querySelectorAll('[data-a11y-contrast]').forEach(el => {
          el.style.outline = '';
          el.style.outlineOffset = '';
          delete el.dataset.a11yContrast;
        });

        function luminance(r, g, b) {
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        }

        function contrastRatio(l1, l2) {
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        function parseColor(colorStr) {
          const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) return { r: +m[1], g: +m[2], b: +m[3] };
          return { r: 0, g: 0, b: 0 };
        }

        function getEffectiveBg(el) {
          let node = el;
          while (node && node !== document.documentElement) {
            const bg = window.getComputedStyle(node).backgroundColor;
            const parsed = parseColor(bg);
            const alphaMatch = bg.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
            const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 1;
            if (alpha > 0.1) return parsed;
            node = node.parentElement;
          }
          return { r: 255, g: 255, b: 255 };
        }

        const textEls = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          { acceptNode: (n) => n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
        );
        const seen = new Set();
        while (walker.nextNode()) {
          const el = walker.currentNode.parentElement;
          if (!el || seen.has(el)) continue;
          seen.add(el);
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          if (el.offsetParent === null && style.position !== 'fixed') continue;
          textEls.push(el);
        }

        const failures = [];
        let passCount = 0;

        textEls.forEach(el => {
          const style = window.getComputedStyle(el);
          const fgColor = parseColor(style.color);
          const bgColor = getEffectiveBg(el);

          const fgLum = luminance(fgColor.r, fgColor.g, fgColor.b);
          const bgLum = luminance(bgColor.r, bgColor.g, bgColor.b);
          const ratio = contrastRatio(fgLum, bgLum);

          const fontSize = parseFloat(style.fontSize);
          const fontWeight = parseInt(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
          const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

          const requiredRatio = isLarge ? minLargeRatio : minRatio;

          if (ratio < requiredRatio) {
            const rect = el.getBoundingClientRect();
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            let severity, bgOverlay;
            if (ratio < 2) {
              severity = 'critical';
              bgOverlay = 'rgba(211, 47, 47, 0.25)';
            } else if (ratio < 3) {
              severity = 'serious';
              bgOverlay = 'rgba(245, 124, 0, 0.22)';
            } else {
              severity = 'moderate';
              bgOverlay = 'rgba(255, 193, 7, 0.2)';
            }

            const overlay = document.createElement('div');
            overlay.className = 'a11y-contrast-overlay';
            overlay.style.cssText = `
              position: absolute;
              top: ${rect.top + scrollY}px;
              left: ${rect.left + scrollX}px;
              width: ${rect.width}px;
              height: ${rect.height}px;
              background: ${bgOverlay};
              border: 2px solid ${ratio < 2 ? '#d32f2f' : ratio < 3 ? '#f57c00' : '#ffc107'};
              border-radius: 3px;
              z-index: 2147483645;
              pointer-events: none;
            `;

            const badge = document.createElement('div');
            badge.className = 'a11y-contrast-overlay';
            badge.style.cssText = `
              position: absolute;
              top: ${rect.top + scrollY - 16}px;
              left: ${rect.left + scrollX}px;
              background: ${ratio < 2 ? '#d32f2f' : ratio < 3 ? '#f57c00' : '#ffc107'};
              color: ${ratio < 3 ? '#fff' : '#000'};
              font-size: 10px;
              font-weight: 700;
              font-family: -apple-system, sans-serif;
              padding: 1px 5px;
              border-radius: 3px;
              z-index: 2147483646;
              pointer-events: none;
              white-space: nowrap;
            `;
            badge.textContent = ratio.toFixed(1) + ':1';

            document.body.appendChild(overlay);
            document.body.appendChild(badge);

            el.dataset.a11yContrast = 'fail';
            el.dataset.a11yContrastIdx = String(failures.length);

            failures.push({
              idx: failures.length,
              text: el.textContent.trim().substring(0, 60),
              tag: el.tagName.toLowerCase(),
              ratio: Math.round(ratio * 100) / 100,
              required: requiredRatio,
              severity,
              fg: `rgb(${fgColor.r},${fgColor.g},${fgColor.b})`,
              bg: `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`,
              isLarge,
              selector: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.split(' ')[0] : el.tagName.toLowerCase())
            });
          } else {
            passCount++;
          }
        });

        return { failures, passCount };
      },
      args: [ratio, largeRatio]
    });

    hideElement(loading);
    btnAA.disabled = false;
    btnAAA.disabled = false;

    document.getElementById('contrast-fail-count').textContent = result.failures.length;
    document.getElementById('contrast-pass-count').textContent = result.passCount;
    showElement(summary);

    if (result.failures.length > 0) {
      showElement(btnHide);
    }

    if (result.failures.length === 0) {
      renderSuccess(list, `All text elements pass ${level} contrast requirements`);
      return;
    }

    renderContrastResults(result.failures, list);
  } catch (e) {
    hideElement(loading);
    btnAA.disabled = false;
    btnAAA.disabled = false;
    renderError(list, `Error: ${e.message}`);
  }
}

function renderContrastResults(failures, list) {
  const bySeverity = { critical: [], serious: [], moderate: [] };
  failures.forEach(f => bySeverity[f.severity].push(f));

  ['critical', 'serious', 'moderate'].forEach(sev => {
    if (bySeverity[sev].length === 0) return;
    const header = document.createElement('div');
    header.className = 'contrast-severity-header contrast-' + sev;
    header.textContent = sev.charAt(0).toUpperCase() + sev.slice(1) + ' (' + bySeverity[sev].length + ')';
    list.appendChild(header);

    bySeverity[sev].forEach(f => {
      const item = document.createElement('div');
      item.className = 'result-item contrast-result-item';
      item.innerHTML = `
        <div class="result-item-header">
          <span class="result-item-title">${escapeHtml(f.text || '(no text)')}</span>
          <span class="contrast-ratio contrast-${f.severity}">${f.ratio}:1</span>
        </div>
        <div class="result-item-desc">
          Required: ${f.required}:1 ${f.isLarge ? '(large text)' : ''} &bull; &lt;${escapeHtml(f.tag)}&gt;
        </div>
        <div class="result-item-details">
          <div class="contrast-colors">
            <span class="contrast-swatch" style="background:${f.fg}"></span> Foreground: ${escapeHtml(f.fg)}
            &nbsp;&nbsp;
            <span class="contrast-swatch" style="background:${f.bg}"></span> Background: ${escapeHtml(f.bg)}
          </div>
          <div class="detail-node">${escapeHtml(f.selector)}</div>
        </div>
      `;
      item.querySelector('.result-item-header').addEventListener('click', () => item.classList.toggle('expanded'));
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.result-item-header')) return;
        const t = await getActiveTab();
        await chrome.scripting.executeScript({
          target: { tabId: t.id },
          func: (idx) => {
            document.querySelectorAll('.a11y-contrast-highlight').forEach(el => el.remove());
            const el = document.querySelector('[data-a11y-contrast-idx="' + idx + '"]');
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const rect = el.getBoundingClientRect();
            const highlight = document.createElement('div');
            highlight.className = 'a11y-contrast-highlight';
            highlight.style.cssText = `
              position: fixed;
              top: ${rect.top - 4}px;
              left: ${rect.left - 4}px;
              width: ${rect.width + 8}px;
              height: ${rect.height + 8}px;
              border: 3px solid #d32f2f;
              border-radius: 4px;
              background: rgba(211,47,47,0.12);
              z-index: 2147483647;
              pointer-events: none;
              animation: a11y-pulse 1.5s ease-out;
            `;
            if (!document.getElementById('a11y-contrast-anim')) {
              const style = document.createElement('style');
              style.id = 'a11y-contrast-anim';
              style.textContent = `
                @keyframes a11y-pulse {
                  0% { box-shadow: 0 0 0 0 rgba(211,47,47,0.5); }
                  70% { box-shadow: 0 0 0 12px rgba(211,47,47,0); }
                  100% { box-shadow: 0 0 0 0 rgba(211,47,47,0); }
                }
              `;
              document.head.appendChild(style);
            }
            document.body.appendChild(highlight);
            setTimeout(() => highlight.remove(), 2000);
          },
          args: [f.idx]
        });
      });
      list.appendChild(item);
    });
  });
}

async function hideContrastOverlays() {
  const tab = await getActiveTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document.querySelectorAll('.a11y-contrast-overlay, .a11y-contrast-highlight').forEach(el => el.remove());
      document.querySelectorAll('[data-a11y-contrast]').forEach(el => {
        delete el.dataset.a11yContrast;
        delete el.dataset.a11yContrastIdx;
      });
    }
  });
  hideElement('btn-contrast-hide');
  hideElement('contrast-summary');
  document.getElementById('contrast-list').innerHTML = '';
}

export function initContrast() {
  document.getElementById('btn-contrast-aa').addEventListener('click', () => runContrastCheck('AA'));
  document.getElementById('btn-contrast-aaa').addEventListener('click', () => runContrastCheck('AAA'));
  document.getElementById('btn-contrast-hide').addEventListener('click', hideContrastOverlays);
}
