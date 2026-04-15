import { test, expect } from '../fixtures/extension';
import { scanPanel, getInnerHtml, isVisible, countContentOverlays } from '../utils/helpers';

const SCAN = { panel: 'landmarks', btn: 'btn-scan-landmarks', result: '#landmark-list .landmark-item' } as const;

test.describe('Landmarks Panel', () => {
  test('should detect landmarks and flag duplicates', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result);

    const html = await getInnerHtml(panelPage, '#landmark-list');
    expect(html.length).toBeGreaterThan(50);

    expect(await isVisible(panelPage, '#landmark-stats')).toBe(true);
  });

  test('should show and hide landmark labels on page', async ({ panelPage, contentPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result);

    // Show labels
    await panelPage.click('#btn-show-landmark-labels');
    expect(await countContentOverlays(contentPage, '.a11y-ext-landmark-label, .a11y-ext-landmark-highlight')).toBeGreaterThanOrEqual(1);

    // Hide labels
    await panelPage.bringToFront();
    await panelPage.click('#btn-show-landmark-labels');
    expect(await countContentOverlays(contentPage, '.a11y-ext-landmark-label')).toBe(0);
  });
});
