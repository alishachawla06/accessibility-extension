// ─── Accessibility Scorecard Module ──────────────────────────────────────────
// Runs a consolidated audit across 5 weighted categories and produces
// a letter grade with detailed descriptions, fix suggestions, and export.
import { escapeHtml, getActiveTab, showElement, hideElement, renderError, ensureContentCSS } from './utils.js';

const CATEGORIES = [
  { id: 'keyboard',   label: 'Keyboard & Interaction',  weight: 25 },
  { id: 'aria',       label: 'ARIA & Semantics',        weight: 20 },
  { id: 'visual',     label: 'Visual Clarity',          weight: 20 },
  { id: 'structure',  label: 'Structure & Navigation',  weight: 15 },
  { id: 'content',    label: 'Content & Naming',        weight: 20 }
];

function letterGrade(pct) {
  if (pct >= 90) return { letter: 'A', label: 'Excellent', color: '#2e7d32', ring: '#43a047' };
  if (pct >= 80) return { letter: 'B', label: 'Good', color: '#558b2f', ring: '#689f38' };
  if (pct >= 70) return { letter: 'C', label: 'Fair', color: '#f9a825', ring: '#fbc02d' };
  if (pct >= 60) return { letter: 'D', label: 'Poor', color: '#ef6c00', ring: '#f57c00' };
  return { letter: 'F', label: 'Failing', color: '#c62828', ring: '#e53935' };
}

function ringSVG(pct, color, size = 80) {
  const r = (size / 2) - 6;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="sc-ring">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#e8e8ec" stroke-width="5"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
      transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}

function buildDescription(catId, data) {
  const d = data;
  switch (catId) {
    case 'keyboard': {
      const parts = [];
      if (d.kbNotFocusable > 0) parts.push(`${d.kbNotFocusable} interactive element${d.kbNotFocusable > 1 ? 's' : ''} can't be reached by keyboard at all, effectively blocking users who can't use a mouse or touchscreen`);
      if (d.kbSmallTargets > 0) parts.push(`${d.kbSmallTargets} touch target${d.kbSmallTargets > 1 ? 's' : ''} below minimum size (24×24px)`);
      if (d.kbPositiveTabindex > 0) parts.push(`${d.kbPositiveTabindex} element${d.kbPositiveTabindex > 1 ? 's have' : ' has'} positive tabindex, disrupting natural tab order`);
      return parts.length ? `Keyboard users would face significant barriers. ${parts[0]}.` : 'All interactive elements are fully keyboard accessible.';
    }
    case 'aria': {
      const parts = [];
      if (d.ariaBrokenRefs > 0) parts.push(`${d.ariaBrokenRefs} broken ARIA reference${d.ariaBrokenRefs > 1 ? 's' : ''}`);
      if (d.ariaInvalidRoles > 0) parts.push(`${d.ariaInvalidRoles} invalid role${d.ariaInvalidRoles > 1 ? 's' : ''}`);
      if (d.ariaHiddenFocusable > 0) parts.push(`${d.ariaHiddenFocusable} element${d.ariaHiddenFocusable > 1 ? 's' : ''} hidden from screen readers but still keyboard-focusable`);
      if (d.ariaLiveRegions > 0) parts.push(`${d.ariaLiveRegions} live region issue${d.ariaLiveRegions > 1 ? 's' : ''}`);
      const total = d.ariaBrokenRefs + d.ariaInvalidRoles + d.ariaHiddenFocusable;
      return total > 0
        ? `The technical wiring for assistive technology has significant issues. ${total} ARIA error${total > 1 ? 's' : ''} mean screen readers may announce incorrect information or miss content entirely.`
        : 'ARIA attributes are correctly implemented across the page.';
    }
    case 'visual': {
      if (d.contrastFails > 0) return `Significant contrast issues affect readability. ${d.contrastFails} text element${d.contrastFails > 1 ? 's don\'t' : ' doesn\'t'} meet minimum contrast ratios. For the estimated 1 in 12 men with color vision deficiency, parts of this page may be unreadable.`;
      return 'All text elements meet WCAG contrast requirements for readability.';
    }
    case 'structure': {
      if (d.headingSkips === 0 && d.hasH1 && d.hasMain && d.hasNav)
        return 'Page structure is well-organized with clear landmarks and a logical heading hierarchy.';
      return `Page structure is mostly good, but has some gaps.`;
    }
    case 'content': {
      const named = d.contentNamedPct;
      if (named >= 99 && d.imgMissing === 0) return `Content on this page is well-identified for assistive technology users. ${named}% of interactive elements have accessible names.`;
      return `${100 - named}% of interactive elements are missing accessible names, meaning screen readers can't tell users what they do.`;
    }
    default: return '';
  }
}

function buildFixes(catId, data) {
  const fixes = [];
  const passes = [];
  const d = data;
  switch (catId) {
    case 'keyboard':
      if (d.kbNotFocusable > 0) fixes.push(`Fix ${d.kbNotFocusable} keyboard-inaccessible elements — users can't reach them without a mouse`);
      if (d.kbSmallTargets > 0) fixes.push(`Increase size of ${d.kbSmallTargets} touch targets below minimum (24×24px)`);
      if (d.kbPositiveTabindex > 0) fixes.push(`Remove positive tabindex from ${d.kbPositiveTabindex} element${d.kbPositiveTabindex > 1 ? 's' : ''} — use DOM order instead`);
      if (d.kbWarnings > 0) fixes.push(`Review ${d.kbWarnings} keyboard warning${d.kbWarnings > 1 ? 's' : ''} (tab order, focus indicators)`);
      if (d.focusMgmtOk) passes.push('Focus management is properly implemented');
      break;
    case 'aria':
      if (d.ariaBrokenRefs > 0) fixes.push(`Fix ${d.ariaBrokenRefs} broken ARIA references (aria-labelledby/describedby pointing to missing elements)`);
      if (d.ariaHiddenFocusable > 0) fixes.push(`Resolve ${d.ariaHiddenFocusable} element${d.ariaHiddenFocusable > 1 ? 's that are' : ' that is'} hidden from screen readers but still keyboard-focusable`);
      if (d.ariaLiveRegions > 0) fixes.push(`Review ${d.ariaLiveRegions} live region issue${d.ariaLiveRegions > 1 ? 's' : ''} for proper dynamic content announcements`);
      if (d.ariaInvalidRoles > 0) fixes.push(`Fix ${d.ariaInvalidRoles} invalid ARIA role${d.ariaInvalidRoles > 1 ? 's' : ''}`);
      break;
    case 'visual':
      if (d.contrastFails > 0) fixes.push(`Fix ${d.contrastFails} text element${d.contrastFails > 1 ? 's' : ''} with insufficient contrast against their background (WCAG AA)`);
      if (d.contrastFails === 0) passes.push('All text meets WCAG AA contrast requirements');
      break;
    case 'structure':
      if (!d.hasH1) fixes.push('Add a clear H1 heading to identify the page topic');
      if (d.headingSkips > 0) fixes.push(`Fix ${d.headingSkips} skipped heading level${d.headingSkips > 1 ? 's' : ''} — headings should descend sequentially`);
      if (!d.hasMain) fixes.push('Add a <main> landmark to identify the primary content area');
      if (d.hasH1) passes.push('Page has a clear H1 heading identifying the topic');
      if (d.hasMain && d.hasNav) passes.push('Main content and navigation landmarks are properly marked');
      if (d.headingSkips === 0) passes.push('Heading hierarchy is clean — no skipped levels');
      if (d.landmarkCount >= 3) passes.push(`${d.landmarkCount} landmarks provide clear page structure`);
      break;
    case 'content':
      if (d.contentUnnamed > 0) fixes.push(`Add accessible names to ${d.contentUnnamed} interactive element${d.contentUnnamed > 1 ? 's' : ''} (buttons, links, inputs)`);
      if (d.contentNamedPct >= 95) passes.push(`${d.contentNamedPct}% of interactive elements have proper accessible names`);
      if (d.imgMissing === 0) passes.push('All images have appropriate alt text');
      if (d.imgMissing > 0) fixes.push(`Add alt text to ${d.imgMissing} image${d.imgMissing > 1 ? 's' : ''} missing descriptions`);
      break;
  }
  return { fixes, passes };
}

function generateReportText(overall, grade, scores, data) {
  const lines = [];
  lines.push(`A11yLens Accessibility Scorecard Report`);
  lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString()}`);
  lines.push(`URL: ${data._url}`);
  lines.push(`${'═'.repeat(60)}`);
  lines.push(`Overall Score: ${overall}/100 (${grade.letter} — ${grade.label})`);
  lines.push(`${'═'.repeat(60)}\n`);

  CATEGORIES.forEach(cat => {
    const s = scores[cat.id];
    const g = letterGrade(s);
    const { fixes, passes } = buildFixes(cat.id, data);
    lines.push(`${'─'.repeat(50)}`);
    lines.push(`${g.letter}  ${cat.label}: ${s}/100`);
    lines.push(`   ${buildDescription(cat.id, data)}`);
    if (fixes.length) {
      lines.push(`\n   FIX FIRST:`);
      fixes.forEach(f => lines.push(`   → ${f}`));
    }
    if (passes.length) {
      passes.forEach(p => lines.push(`   ✓ ${p}`));
    }
    lines.push('');
  });

  lines.push(`${'═'.repeat(60)}`);
  lines.push('Generated by A11yLens Chrome Extension');
  return lines.join('\n');
}

async function runScorecard() {
  const gradeEl = document.getElementById('scorecard-grade');
  const catsEl = document.getElementById('scorecard-categories');
  const detailsEl = document.getElementById('scorecard-details');
  const loading = document.getElementById('scorecard-loading');

  showElement(loading);
  gradeEl.classList.add('hidden');
  catsEl.classList.add('hidden');
  detailsEl.innerHTML = '';

  const tab = await getActiveTab();

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const data = { _url: location.href };

        // ─── 1. Keyboard & Interaction ───
        const interactive = document.querySelectorAll(
          'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [onclick]'
        );
        let notFocusable = 0;
        interactive.forEach(el => {
          const tab = el.tabIndex;
          const tag = el.tagName.toLowerCase();
          const isFocusable = tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea' || tab >= 0;
          if (!isFocusable) notFocusable++;
        });
        const posTab = document.querySelectorAll('[tabindex]');
        let positiveTabindex = 0;
        posTab.forEach(el => { if (parseInt(el.getAttribute('tabindex')) > 0) positiveTabindex++; });
        let smallTargets = 0;
        interactive.forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)) smallTargets++;
        });
        // Focus warnings (no-focus-indicator heuristic)
        let kbWarnings = positiveTabindex;
        const focusMgmtOk = document.querySelectorAll('[aria-modal="true"]').length === 0 ||
          document.querySelectorAll('dialog, [role="dialog"]').length > 0;
        data.kbNotFocusable = notFocusable;
        data.kbSmallTargets = smallTargets;
        data.kbPositiveTabindex = positiveTabindex;
        data.kbWarnings = kbWarnings;
        data.focusMgmtOk = focusMgmtOk;
        const kbPenalty = (notFocusable * 10) + (smallTargets * 2) + (positiveTabindex * 5) + (kbWarnings * 3);
        data.keyboardScore = Math.max(0, 100 - kbPenalty);

        // ─── 2. ARIA & Semantics ───
        let brokenRefs = 0;
        ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns'].forEach(attr => {
          document.querySelectorAll(`[${attr}]`).forEach(el => {
            const ids = el.getAttribute(attr).split(/\s+/);
            ids.forEach(id => { if (id && !document.getElementById(id)) brokenRefs++; });
          });
        });
        const validRoles = new Set(['alert','alertdialog','application','article','banner','button','cell','checkbox','columnheader','combobox','complementary','contentinfo','definition','dialog','directory','document','feed','figure','form','grid','gridcell','group','heading','img','link','list','listbox','listitem','log','main','marquee','math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio','meter','navigation','none','note','option','presentation','progressbar','radio','radiogroup','region','row','rowgroup','rowheader','scrollbar','search','searchbox','separator','slider','spinbutton','status','switch','tab','table','tablist','tabpanel','term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem','generic']);
        let invalidRoles = 0;
        document.querySelectorAll('[role]').forEach(el => {
          const role = el.getAttribute('role')?.trim().toLowerCase();
          if (role && !validRoles.has(role)) invalidRoles++;
        });
        let hiddenFocusable = 0;
        document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
          el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').forEach(f => {
            if (f.tabIndex >= 0) hiddenFocusable++;
          });
        });
        const liveEls = document.querySelectorAll('[aria-live], [role="alert"], [role="status"], [role="log"], [role="timer"]');
        data.ariaBrokenRefs = brokenRefs;
        data.ariaInvalidRoles = invalidRoles;
        data.ariaHiddenFocusable = hiddenFocusable;
        data.ariaLiveRegions = liveEls.length;
        const ariaPenalty = (brokenRefs * 8) + (invalidRoles * 10) + (hiddenFocusable * 12) + Math.min(liveEls.length * 2, 10);
        data.ariaScore = Math.max(0, 100 - ariaPenalty);

        // ─── 3. Visual Clarity ───
        let contrastFails = 0;
        const textEls = document.querySelectorAll('p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6, div');
        const sampleSize = Math.min(textEls.length, 100);
        for (let i = 0; i < sampleSize; i++) {
          const el = textEls[i];
          if (!el.textContent?.trim()) continue;
          const style = getComputedStyle(el);
          const c = style.color.match(/\d+/g)?.map(Number) || [0,0,0];
          const b = style.backgroundColor.match(/\d+/g)?.map(Number) || [255,255,255];
          if (b[3] !== undefined && b[3] === 0) continue; // skip transparent bg
          const toLinear = v => { const s = v/255; return s <= 0.04045 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); };
          const lum = rgb => 0.2126*toLinear(rgb[0]) + 0.7152*toLinear(rgb[1]) + 0.0722*toLinear(rgb[2]);
          const l1 = lum(c), l2 = lum(b);
          const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
          if (ratio < 4.5) contrastFails++;
        }
        data.contrastFails = contrastFails;
        data.contrastSample = sampleSize;
        data.visualScore = sampleSize === 0 ? 100 : Math.max(0, Math.round(100 * (1 - contrastFails / sampleSize)));

        // ─── 4. Structure & Navigation ───
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const h1 = document.querySelectorAll('h1').length;
        let skips = 0;
        for (let i = 1; i < headings.length; i++) {
          if (parseInt(headings[i].tagName[1]) > parseInt(headings[i-1].tagName[1]) + 1) skips++;
        }
        const hasMain = !!document.querySelector('main, [role="main"]');
        const hasNav = !!document.querySelector('nav, [role="navigation"]');
        const landmarks = document.querySelectorAll('main, [role="main"], nav, [role="navigation"], header, [role="banner"], footer, [role="contentinfo"], aside, [role="complementary"], [role="search"]');
        data.headingCount = headings.length;
        data.hasH1 = h1 >= 1;
        data.headingSkips = skips;
        data.hasMain = hasMain;
        data.hasNav = hasNav;
        data.landmarkCount = landmarks.length;
        let structPenalty = (skips * 10) + (h1 !== 1 ? 15 : 0) + (!hasMain ? 15 : 0) + (!hasNav ? 10 : 0);
        data.structureScore = Math.max(0, 100 - structPenalty);

        // ─── 5. Content & Naming ───
        const allInteractive = document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea');
        let unnamed = 0;
        allInteractive.forEach(el => {
          const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent?.trim();
          const id = el.id;
          const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (!name && !hasLabel) unnamed++;
        });
        const allImg = document.querySelectorAll('img');
        const imgMissing = document.querySelectorAll('img:not([alt])').length;
        data.contentTotal = allInteractive.length;
        data.contentUnnamed = unnamed;
        data.contentNamedPct = allInteractive.length === 0 ? 100 : Math.round(100 * (1 - unnamed / allInteractive.length));
        data.imgTotal = allImg.length;
        data.imgMissing = imgMissing;
        const contentPenalty = (unnamed * 5) + (imgMissing * 8);
        data.contentScore = Math.max(0, 100 - contentPenalty);

        return data;
      }
    });

    hideElement(loading);

    const scores = {
      keyboard: result.keyboardScore,
      aria: result.ariaScore,
      visual: result.visualScore,
      structure: result.structureScore,
      content: result.contentScore
    };

    let totalWeight = 0, totalScore = 0;
    CATEGORIES.forEach(cat => {
      totalWeight += cat.weight;
      totalScore += (scores[cat.id] || 0) * cat.weight;
    });
    const overallPct = Math.round(totalScore / totalWeight);
    const grade = letterGrade(overallPct);

    // ─── Render Hero Banner ───
    const catPills = CATEGORIES.map(cat => {
      const g = letterGrade(scores[cat.id]);
      return `<span class="sc-pill" style="background:${g.color};color:#fff">${g.letter} ${cat.label.split(' ')[0]}</span>`;
    }).join('');

    gradeEl.innerHTML = `
      <div class="sc-hero">
        <div class="sc-hero-ring">
          ${ringSVG(overallPct, grade.ring, 100)}
          <span class="sc-hero-letter" style="color:${grade.color}">${grade.letter}</span>
        </div>
        <div class="sc-hero-info">
          <div class="sc-hero-score">${overallPct}<span class="sc-hero-max">/100</span></div>
          <div class="sc-hero-label" style="color:${grade.color}">${grade.label}</div>
        </div>
        <div class="sc-hero-pills">${catPills}</div>
      </div>
    `;
    gradeEl.classList.remove('hidden');

    // ─── Render Category Cards ───
    let catHtml = '';
    CATEGORIES.forEach(cat => {
      const s = scores[cat.id];
      const g = letterGrade(s);
      const desc = buildDescription(cat.id, result);
      const { fixes, passes } = buildFixes(cat.id, result);

      let fixHtml = '';
      if (fixes.length) {
        fixHtml += `<div class="sc-fix-section"><div class="sc-fix-title">FIX FIRST</div>`;
        fixes.forEach(f => fixHtml += `<div class="sc-fix-item sc-fix-action"><span class="sc-fix-arrow">→</span>${escapeHtml(f)}</div>`);
        fixHtml += '</div>';
      }
      if (passes.length) {
        passes.forEach(p => fixHtml += `<div class="sc-fix-item sc-fix-pass"><span class="sc-fix-check">✓</span>${escapeHtml(p)}</div>`);
      }

      catHtml += `
        <div class="sc-cat-card" style="border-left:4px solid ${g.color}">
          <div class="sc-cat-top">
            <div class="sc-cat-ring">
              ${ringSVG(s, g.ring, 56)}
              <span class="sc-cat-letter" style="color:${g.color}">${g.letter}</span>
            </div>
            <div class="sc-cat-meta">
              <div class="sc-cat-name">${cat.label} <span class="sc-cat-score" style="color:${g.color}">${s}/100</span></div>
              <div class="sc-cat-desc">${escapeHtml(desc)}</div>
            </div>
          </div>
          ${fixHtml}
        </div>`;
    });
    catsEl.innerHTML = catHtml;
    catsEl.classList.remove('hidden');

    // ─── Show Export Button ───
    detailsEl.innerHTML = `<button id="btn-export-scorecard" class="btn btn-secondary" style="width:100%;margin-top:12px">Export Report</button>`;
    detailsEl.querySelector('#btn-export-scorecard').addEventListener('click', () => {
      const text = generateReportText(overallPct, grade, scores, result);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `a11ylens-scorecard-${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // ─── Save to history for Issue Diff/History panel ───
    try {
      const tab = await getActiveTab();
      const pageUrl = tab?.url || '';
      const runEntry = {
        timestamp: Date.now(),
        score: overallPct,
        grade: grade.letter,
        totalIssues: CATEGORIES.reduce((sum, cat) => {
          const s = scores[cat.id] || 0;
          return sum + Math.round((100 - s) / 10);
        }, 0),
        url: pageUrl,
        categories: CATEGORIES.map(cat => ({
          name: cat.label,
          score: scores[cat.id] || 0,
          grade: letterGrade(scores[cat.id] || 0).letter
        }))
      };
      const data = await chrome.storage.local.get('a11y_history');
      const all = data.a11y_history || {};
      const key = pageUrl || '__unknown__';
      if (!all[key]) all[key] = [];
      all[key].unshift(runEntry);
      if (all[key].length > 50) all[key] = all[key].slice(0, 50);
      await chrome.storage.local.set({ a11y_history: all });
    } catch (_) { /* history save is non-critical */ }

  } catch (e) {
    hideElement(loading);
    renderError(detailsEl, 'Error: ' + e.message);
  }
}

export function initScorecard() {
  document.getElementById('btn-run-scorecard')?.addEventListener('click', runScorecard);
}
