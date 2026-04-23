import { test, expect } from '../fixtures/extension';
import { scanPanel, getInnerHtml } from '../utils/helpers';

const SUB_TAB = { name: 'touch-targets' };

test.describe('Touch Targets Panel', () => {
  test('should scan and find touch targets', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'visual', 'btn-scan-touch',
      '#touch-target-stats:not(.hidden)', 10000, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#touch-target-results');
    expect(html.length).toBeGreaterThan(10);
  });

  test('should show stats after scan', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'visual', 'btn-scan-touch',
      '#touch-target-stats:not(.hidden)', 10000, SUB_TAB);

    const statsHtml = await getInnerHtml(panelPage, '#touch-target-stats');
    expect(statsHtml.length).toBeGreaterThan(10);
  });
});
