import { test, expect } from '../fixtures/extension';
import { scanPanel, clickFilter, getInnerHtml, countElements, getSummaryCount } from '../utils/helpers';

const SCAN = { panel: 'alt-review', btn: 'btn-scan-images', result: '#alt-review-gallery .alt-card' } as const;

/** Scan images then switch to a filter tab. */
async function scanAndFilter(panelPage: any, clickNav: any, filter: string) {
  await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result);
  await clickFilter(panelPage, `[data-filter="${filter}"]`);
}

test.describe('Alt Review Panel', () => {
  test('should scan and find all images with correct counts', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, '#alt-review-stats:not(.hidden)');

    const statNum = await getSummaryCount(panelPage, '#alt-review-stats .stat-num:first-child');
    expect(statNum).toBeGreaterThanOrEqual(10);
    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(10);
  });

  test('should detect missing alt, generic alt, and filename alt', async ({ panelPage, clickNav }) => {
    await scanAndFilter(panelPage, clickNav, 'issues');

    const html = await getInnerHtml(panelPage, '#alt-review-gallery');
    expect(html).toContain('Missing alt attribute');
    expect(html).toContain('Generic alt text');
    expect(html).toContain('Alt text contains filename');
  });

  test('should detect alt text too long', async ({ panelPage, clickNav }) => {
    await scanAndFilter(panelPage, clickNav, 'issues');

    expect(await getInnerHtml(panelPage, '#alt-review-gallery')).toContain('Alt text too long');
  });

  test('should detect input image missing label', async ({ panelPage, clickNav }) => {
    await scanAndFilter(panelPage, clickNav, 'issues');

    expect(await getInnerHtml(panelPage, '#alt-review-gallery')).toContain('Input image missing label');
  });

  test('should classify decorative and informative correctly', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result);

    await clickFilter(panelPage, '[data-filter="decorative"]');
    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(1);

    await clickFilter(panelPage, '[data-filter="informative"]');
    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(3);
  });

  test('should allow manual reclassification', async ({ panelPage, clickNav }) => {
    await scanAndFilter(panelPage, clickNav, 'needs-review');

    const before = await countElements(panelPage, SCAN.result);
    expect(before).toBeGreaterThan(0);

    // Click Decorative on first card
    await clickFilter(panelPage, '#alt-review-gallery .alt-card .alt-btn-decorative', 500);

    expect(await countElements(panelPage, SCAN.result)).toBeLessThan(before);
  });
});
