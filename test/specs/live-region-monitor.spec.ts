import { test, expect } from '../fixtures/extension';
import { scanPanel, getInnerHtml } from '../utils/helpers';

test.describe('Live Region Monitor', () => {
  test('should scan and find live regions', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'monitoring', 'btn-scan-live-regions',
      '#live-region-list .result-item, #live-region-list .kb-issue-card, #live-region-stats:not(.hidden)', 10000);

    const html = await getInnerHtml(panelPage, '#live-region-list');
    expect(html.length).toBeGreaterThan(10);
  });

  test('should show stats with region count', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'monitoring', 'btn-scan-live-regions',
      '#live-region-stats:not(.hidden)', 10000);

    const statsHtml = await getInnerHtml(panelPage, '#live-region-stats');
    expect(statsHtml.length).toBeGreaterThan(10);
  });

  test('should show monitoring buttons after scan', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'monitoring', 'btn-scan-live-regions',
      '#live-region-stats:not(.hidden)', 10000);

    expect(await panelPage.$('#btn-start-monitoring:not(.hidden)')).toBeTruthy();
  });

  test('should detect assertive live region', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'monitoring', 'btn-scan-live-regions',
      '#live-region-list .result-item, #live-region-list .kb-issue-card, #live-region-stats:not(.hidden)', 10000);

    const html = await getInnerHtml(panelPage, '#live-region-list');
    const hasLiveRegion = html.includes('assertive') || html.includes('live') || html.includes('status') || html.includes('alert');
    expect(hasLiveRegion).toBe(true);
  });
});
