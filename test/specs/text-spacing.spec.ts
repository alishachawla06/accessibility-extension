import { test, expect } from '../fixtures/extension';
import { getInnerHtml, clickSubTab } from '../utils/helpers';

test.describe('Text Spacing Panel', () => {
  test('should toggle text spacing on and off', async ({ panelPage, contentPage, clickNav }) => {
    await clickNav('visual');
    await clickSubTab(panelPage, 'text-spacing');

    // Toggle ON
    await panelPage.click('#btn-toggle-spacing');
    await panelPage.waitForTimeout(500);

    expect(await getInnerHtml(panelPage, '#spacing-status')).toContain('Active');

    await contentPage.bringToFront();
    const lineHeight = await contentPage.$eval('body p', el => getComputedStyle(el).lineHeight);
    expect(lineHeight).not.toBe('normal');

    // Toggle OFF
    await panelPage.bringToFront();
    await panelPage.click('#btn-toggle-spacing');
    await panelPage.waitForTimeout(500);

    expect(await getInnerHtml(panelPage, '#spacing-status')).toContain('Inactive');
  });
});
