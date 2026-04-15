import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, isVisible, getInnerHtml } from '../utils/helpers';

const SCAN = { panel: 'name-calc', btn: 'btn-run-name-tests', result: '#name-calc-list .result-item, #name-calc-list .ax-node-row', timeout: 15000 } as const;

test.describe('Name Calc Panel', () => {
  test('should run name tests and find patterns', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result, SCAN.timeout);
    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(1);
  });

  test('should show stats', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, '#name-calc-stats:not(.hidden)', SCAN.timeout);
    expect(await isVisible(panelPage, '#name-calc-stats')).toBe(true);
  });

  test('should detect aria-label override pattern', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result, SCAN.timeout);

    const html = await getInnerHtml(panelPage, '#name-calc-list');
    const hasOverride = html.includes('Close dialog') || html.includes('aria-label') || html.includes('override');
    expect(hasOverride).toBe(true);
  });
});
