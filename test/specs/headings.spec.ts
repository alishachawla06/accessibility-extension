import { test, expect } from '../fixtures/extension';
import { scanPanel, getInnerHtml, countElements, countContentOverlays } from '../utils/helpers';

const NAV = 'structure';
const SUB_TAB = { name: 'headings' };
const SCAN = { btn: 'btn-scan-headings', result: '#heading-tree-container .heading-card' } as const;

test.describe('Headings Panel', () => {
  test('should detect heading issues', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#heading-stats:not(.hidden)', 10000, SUB_TAB);

    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(5);

    const statsHtml = await getInnerHtml(panelPage, '#heading-stats');
    expect(statsHtml).toContain('issues');
  });

  test('should detect empty heading', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#heading-stats:not(.hidden)', 10000, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#heading-tree-container');
    expect(html).toContain('empty heading');
  });

  test('should show and hide heading labels on page', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#heading-stats:not(.hidden)', 10000, SUB_TAB);

    // Show labels
    await panelPage.click('#btn-show-heading-labels');
    expect(await countContentOverlays(contentPage, '.a11y-ext-heading-label')).toBeGreaterThanOrEqual(5);

    const hasOutline = await contentPage.$eval('h2', el => el.style.outline !== '');
    expect(hasOutline).toBe(true);

    // Hide labels
    await panelPage.bringToFront();
    await panelPage.click('#btn-show-heading-labels');
    expect(await countContentOverlays(contentPage, '.a11y-ext-heading-label')).toBe(0);

    const outlineAfter = await contentPage.$eval('h2', el => el.style.outline);
    expect(outlineAfter).toBe('');
  });
});
