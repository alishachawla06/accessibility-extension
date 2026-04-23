import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, isVisible, getInnerHtml } from '../utils/helpers';

const NAV = 'screen-reader';
const SR_TAB = { type: 'sr' as const, name: 'name-audit' };
const SCAN = { btn: 'btn-run-name-audit', result: '#sr-name-results .result-item, #sr-name-results .ax-node-row', timeout: 15000 } as const;

test.describe('Name Audit Panel', () => {
  test('should run name audit and find patterns', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, SCAN.result, SCAN.timeout, SR_TAB);
    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(1);
  });

  test('should show stats', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#sr-name-stats:not(.hidden)', SCAN.timeout, SR_TAB);
    expect(await isVisible(panelPage, '#sr-name-stats')).toBe(true);
  });

  test('should detect aria-label override pattern', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, SCAN.result, SCAN.timeout, SR_TAB);

    const html = await getInnerHtml(panelPage, '#sr-name-results');
    const hasOverride = html.includes('Close dialog') || html.includes('aria-label') || html.includes('override');
    expect(hasOverride).toBe(true);
  });
});
