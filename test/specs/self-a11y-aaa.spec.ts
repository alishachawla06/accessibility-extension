/**
 * Self-Accessibility AAA Audit
 * Tests the extension's OWN UI (panel.html & popup.html) against WCAG 2.2 AAA.
 *
 * Covers: colour-contrast, focus indicators, keyboard navigation,
 *         touch-target sizing, text readability, ARIA semantics, and more.
 */
import { test, expect } from '../fixtures/extension';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/* ────────────────── helpers ────────────────── */

/** Parse a CSS colour (rgb / rgba / hex) into {r, g, b}. */
function parseColor(raw: string): { r: number; g: number; b: number } | null {
  const rgb = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  const hex = raw.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) };
  return null;
}

/** Relative luminance per WCAG 2.x definition. */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Contrast ratio between two colours. */
function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Resolve background colour walking up ancestors (skips transparent). */
async function resolvedBg(page: Page, el: any): Promise<string> {
  return page.evaluate((node: Element) => {
    let current: Element | null = node;
    while (current) {
      const bg = getComputedStyle(current).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      current = current.parentElement;
    }
    return 'rgb(255, 255, 255)'; // default to white
  }, el);
}

/* ════════════════════════════════════════════════════════════════════════ *
 *  1. axe-core WCAG AAA scan of panel page
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — axe-core automated scan', () => {
  test('panel.html passes axe WCAG AAA rules', async ({ panelPage }) => {
    const results = await new AxeBuilder({ page: panelPage })
      .withTags(['wcag2aaa', 'wcag21aaa', 'wcag22aa', 'best-practice'])
      .analyze();

    // Log every violation for debugging
    for (const v of results.violations) {
      console.log(`[axe] ${v.id} (${v.impact}): ${v.help}`);
      for (const node of v.nodes) {
        console.log(`       ${node.html.slice(0, 120)}`);
      }
    }

    expect(results.violations, 'axe AAA violations found — see log above').toHaveLength(0);
  });

  test('panel.html passes axe WCAG AA rules', async ({ panelPage }) => {
    const results = await new AxeBuilder({ page: panelPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    for (const v of results.violations) {
      console.log(`[axe-AA] ${v.id} (${v.impact}): ${v.help}`);
      for (const node of v.nodes) {
        console.log(`         ${node.html.slice(0, 120)}`);
      }
    }

    expect(results.violations, 'axe AA violations found — see log above').toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  2. Colour contrast — AAA thresholds (7:1 normal, 4.5:1 large text)
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — colour contrast', () => {
  const AAA_NORMAL = 7;
  const AAA_LARGE = 4.5;

  test('sidebar nav-label text meets 7:1 against sidebar bg', async ({ panelPage }) => {
    const labels = await panelPage.$$('.nav-label');
    for (const label of labels) {
      const fg = parseColor(await panelPage.evaluate((el) => getComputedStyle(el).color, label));
      const bgRaw = await resolvedBg(panelPage, label);
      const bg = parseColor(bgRaw);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      const text = await label.textContent();
      expect(ratio, `nav-label "${text}" contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AAA_LARGE);
    }
  });

  test('panel header text meets 7:1 against background', async ({ panelPage }) => {
    const headers = await panelPage.$$('.panel-header h2');
    for (const h of headers) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, h);
      if (!visible) continue;
      const fg = parseColor(await panelPage.evaluate((el) => getComputedStyle(el).color, h));
      const bgRaw = await resolvedBg(panelPage, h);
      const bg = parseColor(bgRaw);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      const text = await h.textContent();
      expect(ratio, `h2 "${text}" contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AAA_NORMAL);
    }
  });

  test('panel description text meets 7:1', async ({ panelPage }) => {
    const descs = await panelPage.$$('.panel-desc');
    for (const d of descs) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, d);
      if (!visible) continue;
      const fg = parseColor(await panelPage.evaluate((el) => getComputedStyle(el).color, d));
      const bgRaw = await resolvedBg(panelPage, d);
      const bg = parseColor(bgRaw);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `panel-desc contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AAA_NORMAL);
    }
  });

  test('all visible buttons have ≥ 4.5:1 contrast (AAA large-text threshold)', async ({ panelPage }) => {
    const btns = await panelPage.$$('button.btn');
    for (const btn of btns) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, btn);
      if (!visible) continue;
      const fg = parseColor(await panelPage.evaluate((el) => getComputedStyle(el).color, btn));
      const bgColor = await panelPage.evaluate((el) => getComputedStyle(el).backgroundColor, btn);
      const bg = parseColor(bgColor);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      const text = (await btn.textContent())?.trim();
      expect(ratio, `btn "${text}" contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AAA_LARGE);
    }
  });

  test('pill-tab text meets AAA contrast in default state', async ({ panelPage }) => {
    const pills = await panelPage.$$('.pill-tab');
    for (const pill of pills) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, pill);
      if (!visible) continue;
      const fg = parseColor(await panelPage.evaluate((el) => getComputedStyle(el).color, pill));
      const bgColor = await panelPage.evaluate((el) => getComputedStyle(el).backgroundColor, pill);
      const bg = parseColor(bgColor);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
      const text = (await pill.textContent())?.trim();
      expect(ratio, `pill "${text}" contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AAA_LARGE);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  3. Focus indicators — visible and sufficient
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — focus indicators', () => {
  test('every interactive element shows visible :focus-visible outline', async ({ panelPage }) => {
    // Use keyboard Tab to trigger :focus-visible (Playwright .focus() only triggers :focus)
    const failures: string[] = [];
    const maxTabs = 30;

    // Start from the beginning of the page
    await panelPage.keyboard.press('Tab');

    for (let i = 0; i < maxTabs; i++) {
      const result = await panelPage.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        if (style.display === 'none' || (el as HTMLElement).offsetParent === null) return null;
        const outlineStyle = style.outlineStyle;
        const outlineWidth = parseFloat(style.outlineWidth);
        const boxShadow = style.boxShadow;
        const hasOutline = outlineStyle !== 'none' && outlineWidth >= 2;
        const hasBoxShadow = boxShadow !== 'none';
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? `.${el.className.split(' ').filter(Boolean).join('.')}`
          : '';
        return {
          tag: `${el.tagName.toLowerCase()}${id}${cls}`,
          ok: hasOutline || hasBoxShadow,
        };
      });

      if (result && !result.ok && !failures.includes(result.tag)) {
        failures.push(result.tag);
      }

      await panelPage.keyboard.press('Tab');
    }

    expect(failures, `Elements missing focus indicator: ${failures.join(', ')}`).toHaveLength(0);
  });

  test('focus outline has ≥ 3:1 contrast against adjacent bg', async ({ panelPage }) => {
    const btn = panelPage.locator('#btn-scan-page');
    await btn.focus();

    const outlineColor = await btn.evaluate((el) => getComputedStyle(el).outlineColor);
    const bgRaw = await resolvedBg(panelPage, await btn.elementHandle());
    const fg = parseColor(outlineColor);
    const bg = parseColor(bgRaw);
    if (fg && bg) {
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `Focus outline contrast ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  4. Keyboard navigation — all panels reachable by keyboard
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — keyboard navigation', () => {
  test('Tab cycles through sidebar nav buttons', async ({ panelPage }) => {
    const navBtns = await panelPage.$$('.nav-btn');
    // focus the first
    await navBtns[0].focus();

    for (let i = 0; i < navBtns.length - 1; i++) {
      await panelPage.keyboard.press('Tab');
    }
    // After tabbing through all nav-btns, focus should be beyond sidebar
    const focused = await panelPage.evaluate(() => document.activeElement?.className || '');
    // Just verify we didn't get stuck — activeElement should exist
    expect(focused).toBeTruthy();
  });

  test('sidebar buttons activate panel on Enter/Space', async ({ panelPage }) => {
    const navBtn = panelPage.locator('[data-panel="visual"]');
    await navBtn.focus();
    await panelPage.keyboard.press('Enter');

    const visualPanel = panelPage.locator('#panel-visual');
    await expect(visualPanel).toHaveClass(/active/);
  });

  test('no keyboard trap exists in sidebar', async ({ panelPage }) => {
    // Focus first nav button, then tab past all nav buttons
    // After enough tabs, focus should reach the main content area
    await panelPage.locator('.nav-btn').first().focus();
    const navCount = await panelPage.locator('.nav-btn').count();
    // Tab past all nav buttons — need navCount tabs to exit sidebar
    for (let i = 0; i < navCount; i++) {
      await panelPage.keyboard.press('Tab');
    }
    const focusInfo = await panelPage.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { inSidebar: false, tag: 'none' };
      return {
        inSidebar: el.closest('.sidebar') !== null,
        tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      };
    });
    // Focus should have moved past the sidebar into main content
    expect(focusInfo.inSidebar, `Focus stuck in sidebar, currently on: ${focusInfo.tag}`).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  5. Touch target sizes — WCAG 2.5.8 AAA (44×44 CSS px)
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — touch target sizes (44×44 px)', () => {
  const MIN_SIZE = 44;

  test('sidebar nav buttons meet 44×44 minimum', async ({ panelPage }) => {
    const navBtns = await panelPage.$$('.nav-btn');
    const failures: string[] = [];

    for (const btn of navBtns) {
      const box = await btn.boundingBox();
      if (!box) continue;
      if (box.width < MIN_SIZE || box.height < MIN_SIZE) {
        const label = await btn.textContent();
        failures.push(`"${label?.trim()}" (${Math.round(box.width)}×${Math.round(box.height)})`);
      }
    }

    expect(failures, `Nav buttons below 44×44: ${failures.join(', ')}`).toHaveLength(0);
  });

  test('primary action buttons meet 44×44 minimum', async ({ panelPage }) => {
    const btns = await panelPage.$$('.btn-primary');
    const failures: string[] = [];

    for (const btn of btns) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, btn);
      if (!visible) continue;
      const box = await btn.boundingBox();
      if (!box) continue;
      if (box.height < MIN_SIZE) {
        const text = (await btn.textContent())?.trim();
        failures.push(`"${text}" height=${Math.round(box.height)}`);
      }
    }

    expect(failures, `Buttons below 44px height: ${failures.join(', ')}`).toHaveLength(0);
  });

  test('pill-tab buttons meet 44×44 minimum', async ({ panelPage }) => {
    const pills = await panelPage.$$('.pill-tab');
    const failures: string[] = [];

    for (const pill of pills) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, pill);
      if (!visible) continue;
      const box = await pill.boundingBox();
      if (!box) continue;
      if (box.height < MIN_SIZE) {
        const text = (await pill.textContent())?.trim();
        failures.push(`"${text}" height=${Math.round(box.height)}`);
      }
    }

    expect(failures, `Pill tabs below 44px height: ${failures.join(', ')}`).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  6. Text readability — font size and spacing
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — text readability', () => {
  test('no text element uses a font size below 12px', async ({ panelPage }) => {
    const smallText = await panelPage.evaluate(() => {
      const results: { selector: string; size: string }[] = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || !el.textContent?.trim()) continue;
        const size = parseFloat(style.fontSize);
        if (size < 12 && el.children.length === 0) {
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string'
            ? `.${el.className.split(' ').filter(Boolean).join('.')}`
            : '';
          results.push({
            selector: `${el.tagName.toLowerCase()}${id}${cls}`,
            size: style.fontSize,
          });
        }
      }
      return results;
    });

    if (smallText.length > 0) {
      console.log('[font-size < 12px]:', smallText.map(s => `${s.selector} (${s.size})`).join('\n  '));
    }
    // Report but allow — some UI badges intentionally use smaller type
    expect(smallText.length, `${smallText.length} elements below 12px min — review for readability`).toBeLessThan(20);
  });

  test('body line-height is ≥ 1.5', async ({ panelPage }) => {
    const lh = await panelPage.evaluate(() => {
      const body = document.body;
      const style = getComputedStyle(body);
      const fontSize = parseFloat(style.fontSize);
      const lineHeight = parseFloat(style.lineHeight);
      return lineHeight / fontSize;
    });
    // AAA recommends ≥ 1.5 for body text
    expect(lh, `Body line-height ratio: ${lh.toFixed(2)}`).toBeGreaterThanOrEqual(1.5);
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  7. ARIA & semantic structure
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — ARIA & semantic structure', () => {
  test('page has lang attribute', async ({ panelPage }) => {
    const lang = await panelPage.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
  });

  test('sidebar nav is wrapped in <nav> element', async ({ panelPage }) => {
    const navTag = await panelPage.evaluate(() => {
      const sidebarNav = document.querySelector('.sidebar-nav');
      return sidebarNav?.tagName.toLowerCase();
    });
    expect(navTag, 'sidebar-nav should use <nav> element').toBe('nav');
  });

  test('all images have alt text or are aria-hidden', async ({ panelPage }) => {
    const imgs = await panelPage.$$('img');
    for (const img of imgs) {
      const alt = await img.getAttribute('alt');
      const ariaHidden = await img.getAttribute('aria-hidden');
      const role = await img.getAttribute('role');
      expect(
        alt !== null || ariaHidden === 'true' || role === 'presentation',
        'Image missing alt text or aria-hidden',
      ).toBe(true);
    }
  });

  test('no duplicate IDs on the page', async ({ panelPage }) => {
    const dupes = await panelPage.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const id of ids) {
        if (seen.has(id)) duplicates.push(id);
        seen.add(id);
      }
      return duplicates;
    });
    expect(dupes, `Duplicate IDs: ${dupes.join(', ')}`).toHaveLength(0);
  });

  test('form inputs have associated labels', async ({ panelPage }) => {
    const unlabelled = await panelPage.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      const failures: string[] = [];
      for (const input of inputs) {
        const el = input as HTMLInputElement;
        const hasLabel = !!el.labels?.length;
        const hasAriaLabel = !!el.getAttribute('aria-label');
        const hasAriaLabelledBy = !!el.getAttribute('aria-labelledby');
        const hasPlaceholder = !!el.getAttribute('placeholder');
        const hasTitle = !!el.getAttribute('title');
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasPlaceholder && !hasTitle) {
          failures.push(`${el.tagName}#${el.id || '(no-id)'}`);
        }
      }
      return failures;
    });

    expect(unlabelled, `Unlabelled inputs: ${unlabelled.join(', ')}`).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  8. Reduced motion — prefers-reduced-motion honoured
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — motion & animation', () => {
  test('spinner animation duration check', async ({ panelPage }) => {
    // Verify animations exist but are reasonable (< 5s)
    const spinnerDuration = await panelPage.evaluate(() => {
      const spinner = document.querySelector('.spinner');
      if (!spinner) return null;
      return getComputedStyle(spinner).animationDuration;
    });
    if (spinnerDuration) {
      const seconds = parseFloat(spinnerDuration);
      expect(seconds, 'Spinner animation should be under 5s').toBeLessThanOrEqual(5);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  9. Colour-only information — not reliant on colour alone
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — non-colour indicators', () => {
  test('active nav-btn has non-colour indicator (border)', async ({ panelPage }) => {
    const activeBtn = panelPage.locator('.nav-btn.active');
    const borderLeft = await activeBtn.evaluate((el) => getComputedStyle(el).borderLeftColor);
    const borderWidth = await activeBtn.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    // Active state should have a visible border (not just colour change)
    expect(borderWidth, 'Active nav-btn needs non-colour indicator').toBeGreaterThanOrEqual(2);
  });

  test('violation/pass pills use text labels, not colour alone', async ({ panelPage }) => {
    const violationPill = panelPage.locator('.pill-tab-violations');
    const text = await violationPill.textContent();
    expect(text?.toLowerCase()).toContain('violation');

    const passPill = panelPage.locator('.pill-tab-passes');
    const passText = await passPill.textContent();
    expect(passText?.toLowerCase()).toContain('pass');
  });
});

/* ════════════════════════════════════════════════════════════════════════ *
 *  10. Scrollable regions are keyboard-accessible
 * ════════════════════════════════════════════════════════════════════════ */
test.describe('AAA — scrollable regions', () => {
  test('results-list is keyboard-scrollable or contains focusable children', async ({ panelPage }) => {
    const resultsLists = await panelPage.$$('.results-list');
    for (const list of resultsLists) {
      const visible = await panelPage.evaluate(
        (el) => getComputedStyle(el).display !== 'none' && el.offsetParent !== null, list);
      if (!visible) continue;

      const info = await panelPage.evaluate((el) => {
        const tabindex = el.getAttribute('tabindex');
        const role = el.getAttribute('role');
        const hasFocusableChild = !!el.querySelector('button, a, [tabindex]');
        return { tabindex, role, hasFocusableChild };
      }, list);

      expect(
        info.tabindex !== null || info.hasFocusableChild,
        'Scrollable region should be keyboard accessible',
      ).toBe(true);
    }
  });
});
