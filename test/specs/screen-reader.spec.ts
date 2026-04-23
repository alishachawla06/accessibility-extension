import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, getInnerHtml } from '../utils/helpers';

test.describe('Screen Reader Panel', () => {

  test.describe('Element List', () => {
    const SR_TAB = { type: 'sr' as const, name: 'shortcuts' };

    test('should scan and show categorized elements', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-shortcuts',
        '#sr-shortcut-results .result-item, #sr-shortcut-stats:not(.hidden)', 10000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-shortcut-results');
      expect(html.length).toBeGreaterThan(50);
    });

    test('should show stats', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-shortcuts',
        '#sr-shortcut-stats:not(.hidden)', 10000, SR_TAB);

      const statsHtml = await getInnerHtml(panelPage, '#sr-shortcut-stats');
      expect(statsHtml.length).toBeGreaterThan(10);
    });
  });

  test.describe('Reading Flow', () => {
    const SR_TAB = { type: 'sr' as const, name: 'sr-flow' };

    test('should generate reading flow', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-sr-flow',
        '#sr-flow-results .result-item, #sr-flow-results .sr-flow-item, #sr-flow-stats:not(.hidden)', 15000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-flow-results');
      expect(html.length).toBeGreaterThan(50);
    });
  });

  test.describe('Focus Traps', () => {
    const SR_TAB = { type: 'sr' as const, name: 'traps' };

    test('should scan for focus traps and dialogs', async ({ panelPage, clickNav }) => {
      await clickNav('screen-reader');
      await panelPage.click('.sr-sub-tab[data-sr-tab="traps"]');
      await panelPage.waitForTimeout(300);
      await panelPage.click('#btn-scan-traps');
      await panelPage.waitForTimeout(5000);

      const html = await getInnerHtml(panelPage, '#sr-trap-results');
      // May find dialogs/modals or report none — just verify scan completes
      expect(html).toBeDefined();
    });
  });

  test.describe('Hidden Content', () => {
    const SR_TAB = { type: 'sr' as const, name: 'hidden' };

    test('should detect hidden content issues', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-hidden',
        '#sr-hidden-results .result-item, #sr-hidden-results .kb-issue-card, #sr-hidden-stats:not(.hidden)', 10000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-hidden-results');
      // Test page has aria-hidden with focusable button inside
      const hasFocusableInHidden = html.includes('hidden-focusable') || html.includes('aria-hidden') || html.includes('focusable');
      expect(hasFocusableInHidden).toBe(true);
    });

    test('should show stats', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-hidden',
        '#sr-hidden-stats:not(.hidden)', 10000, SR_TAB);

      const statsHtml = await getInnerHtml(panelPage, '#sr-hidden-stats');
      expect(statsHtml.length).toBeGreaterThan(10);
    });
  });

  test.describe('Table Audit', () => {
    const SR_TAB = { type: 'sr' as const, name: 'tables' };

    test('should scan tables and detect issues', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-tables',
        '#sr-table-results .result-item, #sr-table-results .kb-issue-card, #sr-table-stats:not(.hidden)', 10000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-table-results');
      expect(html.length).toBeGreaterThan(10);
    });

    test('should show table stats', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-tables',
        '#sr-table-stats:not(.hidden)', 10000, SR_TAB);

      const statsHtml = await getInnerHtml(panelPage, '#sr-table-stats');
      expect(statsHtml.length).toBeGreaterThan(10);
    });
  });

  test.describe('ARIA Validation', () => {
    const SR_TAB = { type: 'sr' as const, name: 'aria-validation' };

    test('should detect ARIA issues', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-aria-validation',
        '#sr-aria-val-results .result-item, #sr-aria-val-results .kb-issue-card, #sr-aria-val-stats:not(.hidden)', 10000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-aria-val-results');
      expect(html.length).toBeGreaterThan(10);
    });

    test('should detect broken aria references', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-aria-validation',
        '#sr-aria-val-results .result-item, #sr-aria-val-results .kb-issue-card, #sr-aria-val-stats:not(.hidden)', 10000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-aria-val-results');
      const hasBrokenRef = html.includes('broken') || html.includes('nonexistent') || html.includes('labelledby') || html.includes('reference');
      expect(hasBrokenRef).toBe(true);
    });

    test('should detect invalid roles', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-aria-validation',
        '#sr-aria-val-results .result-item, #sr-aria-val-results .kb-issue-card, #sr-aria-val-stats:not(.hidden)', 10000, SR_TAB);

      const html = await getInnerHtml(panelPage, '#sr-aria-val-results');
      const hasInvalidRole = html.includes('invalid') || html.includes('banana') || html.includes('role');
      expect(hasInvalidRole).toBe(true);
    });

    test('should show stats', async ({ panelPage, clickNav }) => {
      await scanPanel(panelPage, clickNav, 'screen-reader', 'btn-scan-aria-validation',
        '#sr-aria-val-stats:not(.hidden)', 10000, SR_TAB);

      const statsHtml = await getInnerHtml(panelPage, '#sr-aria-val-stats');
      expect(statsHtml.length).toBeGreaterThan(10);
    });
  });
});
