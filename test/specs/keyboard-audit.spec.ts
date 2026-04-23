import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, getInnerHtml } from '../utils/helpers';

const SUB_TAB = { name: 'kb-issues' };

test.describe('Keyboard Audit Panel', () => {
  test('should detect keyboard issues on test page', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'keyboard', 'btn-run-kb-audit', '#kb-audit-stats:not(.hidden)', 10000, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#kb-audit-results');
    expect(html.length).toBeGreaterThan(50);
  });

  test('should show stats after scan', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'keyboard', 'btn-run-kb-audit', '#kb-audit-stats:not(.hidden)', 10000, SUB_TAB);

    const statsHtml = await getInnerHtml(panelPage, '#kb-audit-stats');
    expect(statsHtml.length).toBeGreaterThan(10);
  });

  test('should detect not-focusable and phantom issues', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'keyboard', 'btn-run-kb-audit', '#kb-audit-stats:not(.hidden)', 10000, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#kb-audit-results');
    const hasKbIssues = html.includes('Not Keyboard Focusable') || html.includes('Phantom') || html.includes('not-focusable');
    expect(hasKbIssues).toBe(true);
  });
});
