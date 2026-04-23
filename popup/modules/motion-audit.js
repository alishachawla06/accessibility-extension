// ─── Animation / Motion Audit Module ─────────────────────────────────────────
// Scans for CSS animations, transitions, autoplay media, and checks
// whether the page respects prefers-reduced-motion.
import { escapeHtml, getActiveTab, showElement, hideElement, renderError } from './utils.js';

async function runMotionAudit() {
  const loading = document.getElementById('motion-audit-loading');
  const results = document.getElementById('motion-audit-results');
  const stats = document.getElementById('motion-audit-stats');

  showElement(loading);
  results.innerHTML = '';
  hideElement(stats);

  try {
    const tab = await getActiveTab();

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const issues = [];

        // 1. Check stylesheets for prefers-reduced-motion support
        let hasReducedMotion = false;
        try {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule instanceof CSSMediaRule && rule.conditionText?.includes('prefers-reduced-motion')) {
                  hasReducedMotion = true;
                  break;
                }
              }
            } catch (_) { /* cross-origin stylesheet */ }
            if (hasReducedMotion) break;
          }
        } catch (_) {}

        // 2. Scan elements for CSS animations
        const allElements = document.querySelectorAll('*');
        let animCount = 0;
        let transCount = 0;
        allElements.forEach(el => {
          if (el.offsetParent === null && el.tagName !== 'BODY') return;
          const style = getComputedStyle(el);
          const animName = style.animationName;
          const animDur = parseFloat(style.animationDuration);
          if (animName && animName !== 'none' && animDur > 0) {
            animCount++;
            if (animCount <= 20) {
              issues.push({
                type: 'animation',
                severity: 'moderate',
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().slice(0, 40),
                detail: `animation: ${animName} (${style.animationDuration})`
              });
            }
          }
          const transDur = parseFloat(style.transitionDuration);
          if (transDur > 0 && style.transitionProperty !== 'none') {
            transCount++;
          }
        });

        // 3. Autoplay video/audio
        let autoplayCount = 0;
        document.querySelectorAll('video[autoplay], audio[autoplay]').forEach(el => {
          autoplayCount++;
          const hasControls = el.hasAttribute('controls');
          issues.push({
            type: 'autoplay',
            severity: hasControls ? 'moderate' : 'serious',
            tag: el.tagName.toLowerCase(),
            text: el.getAttribute('aria-label') || el.getAttribute('src') || '',
            detail: `autoplay${el.hasAttribute('loop') ? ' + loop' : ''}${hasControls ? '' : ' (no controls)'}`
          });
        });

        // 4. Looping video without autoplay
        document.querySelectorAll('video[loop]:not([autoplay])').forEach(el => {
          issues.push({
            type: 'loop',
            severity: 'moderate',
            tag: 'video',
            text: el.getAttribute('aria-label') || el.getAttribute('src') || '',
            detail: 'loop attribute (may autoplay via JS)'
          });
        });

        // 5. Animated GIFs
        let gifCount = 0;
        document.querySelectorAll('img').forEach(el => {
          const src = (el.src || el.getAttribute('src') || '').toLowerCase();
          if (src.endsWith('.gif') || src.includes('.gif?')) {
            gifCount++;
            if (gifCount <= 10) {
              issues.push({
                type: 'gif',
                severity: 'moderate',
                tag: 'img',
                text: el.alt || el.src?.split('/').pop()?.slice(0, 40) || '',
                detail: 'Animated GIF (may distract or cause seizures)'
              });
            }
          }
        });

        // 6. Deprecated motion elements
        document.querySelectorAll('marquee, blink').forEach(el => {
          issues.push({
            type: 'deprecated',
            severity: 'critical',
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 40),
            detail: `<${el.tagName.toLowerCase()}> is deprecated and causes motion issues`
          });
        });

        // 7. scroll-behavior: smooth on html/body
        ['html', 'body'].forEach(sel => {
          const el = document.querySelector(sel);
          if (el && getComputedStyle(el).scrollBehavior === 'smooth') {
            issues.push({
              type: 'scroll',
              severity: 'moderate',
              tag: sel,
              text: '',
              detail: 'scroll-behavior: smooth (not all users want smooth scrolling)'
            });
          }
        });

        return {
          hasReducedMotion,
          animCount,
          transCount,
          autoplayCount,
          gifCount,
          issues
        };
      }
    });

    hideElement(loading);

    // Stats bar
    const rmIcon = result.hasReducedMotion ? '✅' : '❌';
    stats.innerHTML = `
      <span class="stat-pill"><strong>${result.animCount}</strong> animations</span>
      <span class="stat-pill"><strong>${result.autoplayCount}</strong> autoplay</span>
      <span class="stat-pill"><strong>${result.gifCount}</strong> GIFs</span>
      <span class="stat-pill">${rmIcon} prefers-reduced-motion</span>
    `;
    showElement(stats);

    // Critical warning if no reduced-motion support and animations exist
    let html = '';
    if (!result.hasReducedMotion && (result.animCount > 0 || result.autoplayCount > 0 || result.gifCount > 0)) {
      html += `<div class="kb-issue-card" style="border-left:4px solid #c62828">
        <span class="kb-sev-pill sev-critical">critical</span>
        <strong>No prefers-reduced-motion media query detected</strong>
        <div style="margin-top:4px;font-size:12px;color:#999">Page has motion content but no CSS rule to disable it for users who need reduced motion (WCAG 2.3.3).</div>
      </div>`;
    }

    if (!result.issues.length && result.hasReducedMotion) {
      results.innerHTML = '<div class="empty-state">No motion issues found. prefers-reduced-motion is supported.</div>';
      return;
    }

    const sevOrder = { critical: 0, serious: 1, moderate: 2 };
    result.issues.sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));

    html += result.issues.map(issue => `
      <div class="kb-issue-card">
        <span class="kb-sev-pill sev-${issue.severity}">${issue.severity}</span>
        <strong>&lt;${escapeHtml(issue.tag)}&gt;</strong>
        ${issue.text ? escapeHtml(issue.text) : ''}
        <div style="margin-top:2px;font-size:12px;color:#aaa">${escapeHtml(issue.detail)}</div>
      </div>
    `).join('');

    results.innerHTML = html;

  } catch (e) {
    hideElement(loading);
    renderError(results, 'Motion audit failed: ' + e.message);
  }
}

export function initMotionAudit() {
  document.getElementById('btn-run-motion-audit')?.addEventListener('click', runMotionAudit);
}
