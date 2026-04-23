import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, getInnerHtml } from '../utils/helpers';

const NAV = 'structure';
const SUB_TAB = { name: 'aria-tree' };
const SCAN = { btn: 'btn-full-tree', result: '#aria-tree-container .ax-node', timeout: 15000 } as const;

test.describe('Aria Tree Panel', () => {
  test('should load full accessibility tree', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, SCAN.result, SCAN.timeout, SUB_TAB);
    expect(await countElements(panelPage, SCAN.result)).toBeGreaterThanOrEqual(10);
  });

  test('should show stats with landmarks and headings', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#aria-tree-container .ax-stats', SCAN.timeout, SUB_TAB);

    const statsHtml = await getInnerHtml(panelPage, '#aria-tree-container .ax-stats');
    expect(statsHtml).toContain('landmarks');
    expect(statsHtml).toContain('headings');
  });

  test('should show issue badges for problematic nodes', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, SCAN.result, SCAN.timeout, SUB_TAB);

    const html = await getInnerHtml(panelPage, '#aria-tree-container');
    const hasWarnings = html.includes('ax-badge-warn') || html.includes('ax-missing-name') || html.includes('ax-row-warn');
    expect(hasWarnings).toBe(true);
  });

  test('should detect live region', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#aria-tree-container .ax-stats', SCAN.timeout, SUB_TAB);

    const statsHtml = await getInnerHtml(panelPage, '#aria-tree-container .ax-stats');
    expect(statsHtml).toContain('live regions');
  });

  test('should filter tree by search', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, NAV, SCAN.btn, '#aria-tree-container .ax-node-row', SCAN.timeout, SUB_TAB);

    const nodesBefore = await countElements(panelPage, '#aria-tree-container .ax-node-row');

    await panelPage.fill('#aria-search', 'button');
    await panelPage.waitForTimeout(500);

    const nodesAfter = await countElements(panelPage, '#aria-tree-container .ax-node-row');
    expect(nodesAfter).toBeLessThanOrEqual(nodesBefore);
  });
});
