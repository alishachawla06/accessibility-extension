// ─── Form Labeller Module ───────────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError } from './utils.js';

async function scanForms() {
  const container = document.getElementById('form-labeller-list');
  const stats = document.getElementById('form-labeller-stats');
  const loading = document.getElementById('form-labeller-loading');

  showElement(loading);
  container.innerHTML = '';
  hideElement(stats);

  const tab = await getActiveTab();

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const fields = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
          const type = (el.getAttribute('type') || '').toLowerCase();
          return type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'reset' && type !== 'image';
        });

        return fields.map(el => {
          const tag = el.tagName.toLowerCase();
          const type = el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : 'text');
          const id = el.id || '';
          const name = el.name || '';

          // Check labelling methods
          let method = '';
          let labelText = '';

          // 1. Explicit label via for/id
          if (id) {
            const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
            if (label) {
              method = 'label[for]';
              labelText = label.textContent.trim();
            }
          }
          // 2. Wrapping label
          if (!method) {
            const parentLabel = el.closest('label');
            if (parentLabel) {
              method = 'wrapping <label>';
              labelText = parentLabel.textContent.trim().replace(el.value || '', '').trim();
            }
          }
          // 3. aria-labelledby
          if (!method && el.getAttribute('aria-labelledby')) {
            const ids = el.getAttribute('aria-labelledby').split(/\s+/);
            const texts = ids.map(refId => {
              const ref = document.getElementById(refId);
              return ref ? ref.textContent.trim() : '';
            }).filter(Boolean);
            if (texts.length > 0) {
              method = 'aria-labelledby';
              labelText = texts.join(' ');
            }
          }
          // 4. aria-label
          if (!method && el.getAttribute('aria-label')) {
            method = 'aria-label';
            labelText = el.getAttribute('aria-label');
          }
          // 5. title
          if (!method && el.getAttribute('title')) {
            method = 'title';
            labelText = el.getAttribute('title');
          }
          // 6. placeholder (not a proper label, but note it)
          if (!method && el.getAttribute('placeholder')) {
            method = 'placeholder only';
            labelText = el.getAttribute('placeholder');
          }

          const isOrphaned = !method;

          // Build a selector
          let selector = '';
          if (id) selector = '#' + CSS.escape(id);
          else if (name) selector = `${tag}[name="${CSS.escape(name)}"]`;
          else {
            const idx = Array.from(document.querySelectorAll(tag)).indexOf(el);
            selector = `${tag}:nth-of-type(${idx + 1})`;
          }

          // Generate fix suggestion for orphaned fields
          let fixSnippet = '';
          if (isOrphaned) {
            if (id) {
              fixSnippet = `<label for="${id}">Label text</label>\n<${tag} id="${id}" type="${type}">`;
            } else {
              fixSnippet = `<!-- Option 1: Add aria-label -->\n<${tag} type="${type}" aria-label="Descriptive label">\n\n<!-- Option 2: Wrap in label -->\n<label>Label text\n  <${tag} type="${type}">\n</label>`;
            }
          }

          return { tag, type, id, name, method, labelText, isOrphaned, selector, fixSnippet };
        });
      }
    });

    hideElement(loading);

    if (!result || result.length === 0) {
      container.innerHTML = '<div class="result-item"><div class="result-item-title">No form fields found</div></div>';
      return;
    }

    const orphanCount = result.filter(f => f.isOrphaned).length;
    const placeholderOnly = result.filter(f => f.method === 'placeholder only').length;

    stats.innerHTML = `
      <span class="ax-stat"><strong>${result.length}</strong> fields</span>
      <span class="ax-stat ${orphanCount ? 'ax-stat-issue' : 'ax-stat-landmark'}">
        ${orphanCount ? `⚠️ <strong>${orphanCount}</strong> orphaned` : '✅ all labelled'}
      </span>
      ${placeholderOnly ? `<span class="ax-stat ax-stat-warn">⚠️ <strong>${placeholderOnly}</strong> placeholder-only</span>` : ''}
    `;
    showElement(stats);

    result.forEach(f => {
      const item = document.createElement('div');
      item.className = 'result-item' + (f.isOrphaned ? ' form-orphaned' : '');

      const methodBadge = f.isOrphaned
        ? '<span class="ax-badge ax-badge-invalid">❌ no label</span>'
        : f.method === 'placeholder only'
          ? '<span class="ax-badge ax-badge-warn">⚠️ placeholder only</span>'
          : `<span class="ax-badge ax-badge-state">${escapeHtml(f.method)}</span>`;

      const fixHtml = f.fixSnippet ? `
        <div class="ax-fix-section">
          <button class="ax-fix-btn">💡 Fix Suggestion</button>
          <div class="ax-fix-detail hidden">
            <pre class="ax-fix-code"><code>${escapeHtml(f.fixSnippet)}</code></pre>
          </div>
        </div>
      ` : '';

      item.innerHTML = `
        <div class="result-item-header">
          <span class="result-item-title">&lt;${escapeHtml(f.tag)}&gt; type="${escapeHtml(f.type)}"</span>
          ${methodBadge}
        </div>
        ${f.id ? `<div class="result-item-desc">id="${escapeHtml(f.id)}"</div>` : ''}
        ${f.labelText ? `<div class="result-item-desc">Label: "${escapeHtml(f.labelText.substring(0, 80))}"</div>` : ''}
        ${fixHtml}
      `;
      // Fix button toggle
      const fixBtn = item.querySelector('.ax-fix-btn');
      if (fixBtn) fixBtn.addEventListener('click', () => fixBtn.nextElementSibling.classList.toggle('hidden'));
      item.querySelector('.result-item-header')?.addEventListener('click', () => item.classList.toggle('expanded'));
      container.appendChild(item);
    });
  } catch (e) {
    hideElement(loading);
    renderError(container, `Error: ${e.message}`);
  }
}

async function highlightOrphans() {
  const tab = await getActiveTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Remove previous
      document.querySelectorAll('[data-a11y-orphan-highlight]').forEach(el => {
        el.style.outline = '';
        el.style.outlineOffset = '';
        delete el.dataset.a11yOrphanHighlight;
      });

      const fields = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
        const type = (el.getAttribute('type') || '').toLowerCase();
        return type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'reset' && type !== 'image';
      });

      fields.forEach(el => {
        const id = el.id;
        let hasLabel = false;
        if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) hasLabel = true;
        if (!hasLabel && el.closest('label')) hasLabel = true;
        if (!hasLabel && el.getAttribute('aria-labelledby')) hasLabel = true;
        if (!hasLabel && el.getAttribute('aria-label')) hasLabel = true;
        if (!hasLabel && el.getAttribute('title')) hasLabel = true;

        if (!hasLabel) {
          el.style.outline = '3px solid #d32f2f';
          el.style.outlineOffset = '2px';
          el.dataset.a11yOrphanHighlight = 'true';
        }
      });
    }
  });
}

export function initFormLabeller() {
  document.getElementById('btn-scan-forms').addEventListener('click', scanForms);
  document.getElementById('btn-highlight-orphans').addEventListener('click', highlightOrphans);
}
