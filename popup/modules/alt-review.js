// ─── Alt-Text Reviewer Module ───────────────────────────────────────────────
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, highlightElement } from './utils.js';

let imageData = [];

async function scanImages() {
  const loading = document.getElementById('alt-review-loading');
  const stats = document.getElementById('alt-review-stats');
  const gallery = document.getElementById('alt-review-gallery');
  const filterBar = document.getElementById('alt-review-filter');

  showElement(loading);
  hideElement(stats);
  hideElement(filterBar);
  gallery.innerHTML = '';
  imageData = [];

  const tab = await getActiveTab();

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return Array.from(document.querySelectorAll('img, [role="img"], svg[role="img"], input[type="image"]')).map((el, i) => {
          const tag = el.tagName.toLowerCase();
          const alt = el.getAttribute('alt');
          const src = tag === 'img' || tag === 'input' ? el.src : null;
          const role = el.getAttribute('role') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const ariaLabelledby = el.getAttribute('aria-labelledby') || '';
          const hasPresentation = role === 'presentation' || role === 'none';
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';

          let nameSource = '';
          if (alt !== null && alt !== '') nameSource = 'alt';
          else if (ariaLabel) nameSource = 'aria-label';
          else if (ariaLabelledby) nameSource = 'aria-labelledby';

          // Classify
          let classification = 'needs-review';
          if (alt === '' || hasPresentation) classification = 'decorative';
          else if (alt && alt.trim().length > 0) classification = 'informative';
          else if (ariaLabel || ariaLabelledby) classification = 'informative';

          // Detect issues
          const issues = [];
          if (alt === null && !ariaLabel && !ariaLabelledby && !hasPresentation) issues.push('Missing alt attribute');
          if (alt && /^(image|photo|picture|img|graphic|icon|logo|banner|untitled|placeholder)\s*\.?\s*$/i.test(alt.trim())) issues.push('Generic alt text');
          if (alt && alt.length > 150) issues.push('Alt text too long (' + alt.length + ' chars)');
          if (alt && /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)/i.test(alt)) issues.push('Alt text contains filename');
          if (tag === 'input' && !alt && !ariaLabel) issues.push('Input image missing label');

          // Tag element with data-attribute for reliable re-selection
          el.setAttribute('data-a11y-img-idx', String(i));

          // Build robust selector: prefer id, then data attribute
          let selector = '';
          if (el.id) {
            selector = '#' + CSS.escape(el.id);
          } else {
            selector = '[data-a11y-img-idx="' + i + '"]';
          }

          return {
            index: i, tag, src, alt, role, ariaLabel, ariaLabelledby,
            nameSource, classification, issues, isVisible,
            width: Math.round(rect.width), height: Math.round(rect.height),
            selector
          };
        });
      }
    });

    hideElement(loading);

    if (!result || result.length === 0) {
      gallery.innerHTML = '<div class="empty-state">No images found on this page</div>';
      return;
    }

    imageData = result;
    renderStats();
    showElement(filterBar);
    renderGallery('all');

  } catch (e) {
    hideElement(loading);
    renderError(gallery, `Error: ${e.message}`);
  }
}

function renderStats() {
  const stats = document.getElementById('alt-review-stats');
  const total = imageData.length;
  const decorative = imageData.filter(i => i.classification === 'decorative').length;
  const informative = imageData.filter(i => i.classification === 'informative').length;
  const needsReview = imageData.filter(i => i.classification === 'needs-review').length;
  const withIssues = imageData.filter(i => i.issues.length > 0).length;

  const parts = [
    `<span class="stat-num">${total}</span> images`,
    `<span class="stat-num">${informative}</span> informative`,
    `<span class="stat-num">${decorative}</span> decorative`
  ];
  if (needsReview > 0) parts.push(`<span class="stat-num">${needsReview}</span> needs review`);
  if (withIssues > 0) parts.push(`<span class="stat-num">${withIssues}</span> issues`);
  stats.innerHTML = parts.join(' · ');
  showElement(stats);
}

function renderGallery(filter) {
  const gallery = document.getElementById('alt-review-gallery');
  gallery.innerHTML = '';

  let items = imageData;
  if (filter === 'informative') items = items.filter(i => i.classification === 'informative');
  else if (filter === 'decorative') items = items.filter(i => i.classification === 'decorative');
  else if (filter === 'needs-review') items = items.filter(i => i.classification === 'needs-review');
  else if (filter === 'issues') items = items.filter(i => i.issues.length > 0);

  if (items.length === 0) {
    gallery.innerHTML = '<div class="empty-state">No images match this filter</div>';
    return;
  }

  items.forEach(img => {
    const card = document.createElement('div');
    card.className = `alt-card alt-card-${img.classification}`;

    const thumbHtml = img.src
      ? `<img src="${escapeHtml(img.src)}" alt="" class="alt-card-thumb" loading="lazy" />`
      : `<div class="alt-card-thumb alt-card-no-img">${escapeHtml(img.tag.toUpperCase())}</div>`;

    const classBadge = img.classification === 'decorative'
      ? '<span class="alt-badge alt-badge-decorative">Decorative</span>'
      : img.classification === 'informative'
      ? '<span class="alt-badge alt-badge-informative">Informative</span>'
      : '<span class="alt-badge alt-badge-needs-review">Needs Review</span>';

    const altDisplay = img.alt !== null
      ? (img.alt === '' ? '<span class="alt-empty">alt=""</span>' : `<span class="alt-text">"${escapeHtml(img.alt)}"</span>`)
      : '<span class="alt-missing">No alt attribute</span>';

    const sourceHtml = img.nameSource
      ? `<span class="alt-source">via ${escapeHtml(img.nameSource)}</span>`
      : '';

    const issuesHtml = img.issues.length > 0
      ? `<div class="alt-issues">${img.issues.map(i => `<span class="alt-issue-tag">⚠️ ${escapeHtml(i)}</span>`).join('')}</div>`
      : '';

    const sizeHtml = img.isVisible
      ? `<span class="alt-size">${img.width}×${img.height}</span>`
      : '<span class="alt-size alt-hidden-img">Hidden</span>';

    card.innerHTML = `
      <div class="alt-card-preview">${thumbHtml}</div>
      <div class="alt-card-body">
        <div class="alt-card-top">
          ${classBadge}
          ${sizeHtml}
        </div>
        <div class="alt-card-alt">${altDisplay} ${sourceHtml}</div>
        ${img.ariaLabel ? `<div class="alt-card-attr"><span class="alt-attr-key">aria-label</span> ${escapeHtml(img.ariaLabel)}</div>` : ''}
        ${img.role && img.role !== 'img' ? `<div class="alt-card-attr"><span class="alt-attr-key">role</span> ${escapeHtml(img.role)}</div>` : ''}
        ${issuesHtml}
        <div class="alt-card-selector">${escapeHtml(img.selector)}</div>
        <div class="alt-card-actions">
          <button class="alt-action-btn alt-btn-decorative${img.classification === 'decorative' ? ' active' : ''}" data-idx="${img.index}" data-type="decorative">Decorative</button>
          <button class="alt-action-btn alt-btn-informative${img.classification === 'informative' ? ' active' : ''}" data-idx="${img.index}" data-type="informative">Informative</button>
        </div>
      </div>
    `;

    // Classification buttons
    card.querySelectorAll('.alt-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const type = btn.dataset.type;
        const item = imageData.find(i => i.index === idx);
        if (!item) return;

        item.classification = type;

        // Validate based on classification
        item.issues = item.issues.filter(i => i !== 'Decorative image has alt text' && i !== 'Informative image missing alt text');
        if (type === 'decorative' && item.alt && item.alt.trim().length > 0) {
          item.issues.push('Decorative image has alt text');
        }
        if (type === 'informative' && !item.alt && !item.ariaLabel && !item.ariaLabelledby) {
          item.issues.push('Informative image missing alt text');
        }

        renderStats();
        const currentFilter = document.querySelector('.alt-filter-btn.active')?.dataset.filter || 'all';
        renderGallery(currentFilter);
      });
    });

    // Click card to highlight image on page
    card.addEventListener('click', async () => {
      if (!img.selector) return;
      const tab = await getActiveTab();
      await highlightElement(tab.id, img.selector);
    });

    gallery.appendChild(card);
  });
}

export function initAltReview() {
  document.getElementById('btn-scan-images').addEventListener('click', scanImages);

  // Filter buttons
  document.querySelectorAll('.alt-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.alt-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGallery(btn.dataset.filter);
    });
  });
}
