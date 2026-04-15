import { test, expect } from '../fixtures/extension';
import { scanPanel, getInnerHtml, isVisible } from '../utils/helpers';

const SCAN = { panel: 'form-labeller', btn: 'btn-scan-forms', result: '#form-labeller-list .result-item, #form-labeller-list .ax-node-row' } as const;

test.describe('Form Labels Panel', () => {
  test('should detect orphaned form fields', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result);

    const html = await getInnerHtml(panelPage, '#form-labeller-list');
    expect(html.length).toBeGreaterThan(50);
  });

  test('should detect correct label association', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, SCAN.result);

    const html = await getInnerHtml(panelPage, '#form-labeller-list');
    expect(html).toContain('email');
  });

  test('should show stats', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, SCAN.panel, SCAN.btn, '#form-labeller-stats:not(.hidden)');
    expect(await isVisible(panelPage, '#form-labeller-stats')).toBe(true);
  });
});
