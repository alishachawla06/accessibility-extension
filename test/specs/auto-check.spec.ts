import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, getSummaryCount, clickFilter } from '../utils/helpers';

test.describe('Auto Check Panel', () => {
  test('should detect WCAG AA violations on test page', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'auto-check', 'btn-scan-page', '#results-summary:not(.hidden)', 15000);

    const violationCount = await getSummaryCount(panelPage, '#count-violations');
    expect(violationCount).toBeGreaterThanOrEqual(3);

    const resultCount = await countElements(panelPage, '#results-list .result-item');
    expect(resultCount).toBeGreaterThanOrEqual(3);
  });

  test('should show search bar and filter results', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'auto-check', 'btn-scan-page', '#results-summary:not(.hidden)', 15000);

    const searchContainer = await panelPage.$('#auto-check-search-container');
    expect(searchContainer).toBeTruthy();

    await panelPage.fill('#auto-check-search', 'contrast');
    await panelPage.waitForTimeout(300);

    const items = await countElements(panelPage, '#results-list .result-item');
    expect(items).toBeGreaterThanOrEqual(1);
  });

  test('should toggle between flat and component views', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'auto-check', 'btn-scan-page', '#view-toggle:not(.hidden)', 15000);

    await panelPage.click('#btn-view-component');
    expect(await countElements(panelPage, '#results-list .component-group')).toBeGreaterThanOrEqual(1);

    await panelPage.click('#btn-view-flat');
    expect(await countElements(panelPage, '#results-list .result-item')).toBeGreaterThanOrEqual(1);
  });

  test('should switch to pass rules via summary card click', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'auto-check', 'btn-scan-page', '#results-summary:not(.hidden)', 15000);

    // Click passes summary card
    await clickFilter(panelPage, '#results-summary .pill-tab[data-filter="passes"]');

    // Should show pass items
    const passItems = await countElements(panelPage, '#results-list .result-item-pass');
    expect(passItems).toBeGreaterThanOrEqual(1);

    // Active tab should be passes
    const isActive = await panelPage.$eval(
      '#results-summary .pill-tab[data-filter="passes"]',
      el => el.classList.contains('active')
    );
    expect(isActive).toBe(true);
  });

  test('should switch back to violations via summary card click', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'auto-check', 'btn-scan-page', '#results-summary:not(.hidden)', 15000);

    // Switch to passes then back to violations
    await clickFilter(panelPage, '#results-summary .pill-tab[data-filter="passes"]');
    await clickFilter(panelPage, '#results-summary .pill-tab[data-filter="violations"]');

    const violationItems = await countElements(panelPage, '#results-list .result-item');
    expect(violationItems).toBeGreaterThanOrEqual(3);

    // View toggle should be visible for violations
    const viewToggleVisible = await panelPage.$eval('#view-toggle', el => !el.classList.contains('hidden'));
    expect(viewToggleVisible).toBe(true);
  });
});
