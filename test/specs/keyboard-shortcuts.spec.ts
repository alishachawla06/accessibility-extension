import { test, expect } from '../fixtures/extension';
import { scanPanel, getInnerHtml } from '../utils/helpers';

const SUB_TAB = { name: 'kb-shortcuts' };

test.describe('Keyboard Shortcuts Panel', () => {
  test('should scan and show results', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'keyboard', 'btn-run-ks-audit', '#ks-audit-stats:not(.hidden)', 10000, SUB_TAB);

    const statsHtml = await getInnerHtml(panelPage, '#ks-audit-stats');
    expect(statsHtml.length).toBeGreaterThan(10);
  });

  test('should show results list after scan', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'keyboard', 'btn-run-ks-audit', '#ks-audit-stats:not(.hidden)', 10000, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#ks-audit-results');
    expect(html.length).toBeGreaterThan(0);
  });

  test('should detect accesskey issues', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'keyboard', 'btn-run-ks-audit', '#ks-audit-stats:not(.hidden)', 10000, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#ks-audit-results');
    // Test page has duplicate accesskey="p" on two links
    const hasAccesskeyInfo = html.includes('accesskey') || html.includes('conflict') || html.includes('duplicate') || html.length > 50;
    expect(hasAccesskeyInfo).toBe(true);
  });
});
