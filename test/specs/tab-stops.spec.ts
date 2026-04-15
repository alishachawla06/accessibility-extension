import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, countContentOverlays, getSummaryCount, clickFilter } from '../utils/helpers';

test.describe('Tab Stops Panel', () => {
  test('should show tab stops on page', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'tab-stops', 'btn-show-tabs', '#tab-list .tab-item, #tab-list .result-item');

    expect(await countElements(panelPage, '#tab-list .tab-item, #tab-list .result-item')).toBeGreaterThanOrEqual(5);
    expect(await countContentOverlays(contentPage, '.a11y-ext-tab-marker')).toBeGreaterThanOrEqual(5);
  });

  test('should show focusable count in stats', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'tab-stops', 'btn-show-tabs', '#tab-stats:not(.hidden)');

    expect(await getSummaryCount(panelPage, '#count-focusable')).toBeGreaterThanOrEqual(5);
  });

  test('should hide tab markers', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'tab-stops', 'btn-show-tabs', '#btn-hide-tabs:not(.hidden)');

    await panelPage.click('#btn-hide-tabs');
    expect(await countContentOverlays(contentPage, '.a11y-ext-tab-marker')).toBe(0);
  });

  test('should show tab flow with arrow lines', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'tab-stops', 'btn-show-flow', '#tab-list .tab-item, #tab-list .result-item');

    // Flow mode adds SVG overlay with arrow lines
    expect(await countContentOverlays(contentPage, '.a11y-ext-svg-overlay')).toBe(1);
    expect(await countContentOverlays(contentPage, '.a11y-ext-tab-marker')).toBeGreaterThanOrEqual(5);
  });

  test('should switch to component view', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'tab-stops', 'btn-show-tabs', '#tab-view-toggle:not(.hidden)');

    await clickFilter(panelPage, '#btn-tab-view-component');
    expect(await countElements(panelPage, '#tab-list .component-group')).toBeGreaterThanOrEqual(1);

    // Switch back to flat
    await clickFilter(panelPage, '#btn-tab-view-flat');
    expect(await countElements(panelPage, '#tab-list .tab-item')).toBeGreaterThanOrEqual(5);
  });

  test('should re-scan after hide without stale scope', async ({ panelPage, contentPage, clickNav }) => {
    // First scan
    await scanPanel(panelPage, clickNav, 'tab-stops', 'btn-show-tabs', '#btn-hide-tabs:not(.hidden)');
    const firstCount = await countContentOverlays(contentPage, '.a11y-ext-tab-marker');
    expect(firstCount).toBeGreaterThanOrEqual(5);

    // Hide
    await panelPage.bringToFront();
    await panelPage.click('#btn-hide-tabs');
    await panelPage.waitForSelector('#btn-show-tabs:not(.hidden)');

    // Re-scan — should show same count (not stale scope)
    await panelPage.click('#btn-show-tabs');
    await panelPage.waitForSelector('#tab-list .tab-item, #tab-list .result-item');
    const secondCount = await countContentOverlays(contentPage, '.a11y-ext-tab-marker');
    expect(secondCount).toBeGreaterThanOrEqual(5);
  });
});
