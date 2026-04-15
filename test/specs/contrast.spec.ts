import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, getSummaryCount, countContentOverlays } from '../utils/helpers';

test.describe('Contrast Panel', () => {
  test('should detect AA contrast failures', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'contrast', 'btn-contrast-aa', '#contrast-summary:not(.hidden)');

    expect(await getSummaryCount(panelPage, '#contrast-fail-count')).toBeGreaterThanOrEqual(3);
    expect(await countElements(panelPage, '#contrast-list .result-item, #contrast-list .contrast-result-item')).toBeGreaterThanOrEqual(1);
  });

  test('should inject overlays on content page', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'contrast', 'btn-contrast-aa', '#contrast-summary:not(.hidden)');

    expect(await countContentOverlays(contentPage, '.a11y-ext-contrast-overlay, .a11y-ext-contrast-badge, [class*="contrast"]')).toBeGreaterThanOrEqual(1);
  });

  test('should clear overlays on hide', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'contrast', 'btn-contrast-aa', '#btn-contrast-hide:not(.hidden)');

    await panelPage.click('#btn-contrast-hide');
    expect(await countContentOverlays(contentPage, '.a11y-ext-contrast-overlay')).toBe(0);
  });
});
