import { test, expect } from '../fixtures/extension';

test.describe('Navigation', () => {
  test('should show 10 sidebar navigation buttons', async ({ panelPage }) => {
    const navBtns = await panelPage.$$('.nav-btn');
    expect(navBtns.length).toBe(10);
  });

  test('scan panel is active by default', async ({ panelPage }) => {
    const activePanel = await panelPage.$('#panel-scan.active');
    expect(activePanel).toBeTruthy();

    const activeBtn = await panelPage.$('.nav-btn.active');
    const label = await activeBtn?.textContent();
    expect(label).toContain('Scan');
  });

  test('clicking scorecard activates scorecard panel', async ({ panelPage, clickNav }) => {
    await clickNav('scorecard');
    expect(await panelPage.$('#panel-scorecard.active')).toBeTruthy();
  });

  test('clicking structure activates structure panel', async ({ panelPage, clickNav }) => {
    await clickNav('structure');
    expect(await panelPage.$('#panel-structure.active')).toBeTruthy();
  });

  test('clicking content activates content panel', async ({ panelPage, clickNav }) => {
    await clickNav('content');
    expect(await panelPage.$('#panel-content.active')).toBeTruthy();
  });

  test('clicking keyboard activates keyboard panel', async ({ panelPage, clickNav }) => {
    await clickNav('keyboard');
    expect(await panelPage.$('#panel-keyboard.active')).toBeTruthy();
  });

  test('clicking visual activates visual panel', async ({ panelPage, clickNav }) => {
    await clickNav('visual');
    expect(await panelPage.$('#panel-visual.active')).toBeTruthy();
  });

  test('clicking screen-reader activates screen-reader panel', async ({ panelPage, clickNav }) => {
    await clickNav('screen-reader');
    expect(await panelPage.$('#panel-screen-reader.active')).toBeTruthy();
  });

  test('clicking monitoring activates monitoring panel', async ({ panelPage, clickNav }) => {
    await clickNav('monitoring');
    expect(await panelPage.$('#panel-monitoring.active')).toBeTruthy();
  });

  test('sub-tab switching works in structure panel', async ({ panelPage, clickNav }) => {
    await clickNav('structure');

    // Default: landmarks active
    expect(await panelPage.$('.section-sub-panel[data-panel="landmarks"].active')).toBeTruthy();

    // Click headings tab
    await panelPage.click('.section-sub-tab[data-tab="headings"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('.section-sub-panel[data-panel="headings"].active')).toBeTruthy();
    expect(await panelPage.$('.section-sub-panel[data-panel="landmarks"].active')).toBeNull();

    // Click aria-tree tab
    await panelPage.click('.section-sub-tab[data-tab="aria-tree"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('.section-sub-panel[data-panel="aria-tree"].active')).toBeTruthy();
  });

  test('sub-tab switching works in keyboard panel', async ({ panelPage, clickNav }) => {
    await clickNav('keyboard');

    // Default: tab-stops
    expect(await panelPage.$('.section-sub-panel[data-panel="tab-stops"].active')).toBeTruthy();

    // Click manual test
    await panelPage.click('.section-sub-tab[data-tab="manual-kb"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('.section-sub-panel[data-panel="manual-kb"].active')).toBeTruthy();

    // Click component flow
    await panelPage.click('.section-sub-tab[data-tab="component-flow"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('.section-sub-panel[data-panel="component-flow"].active')).toBeTruthy();
  });

  test('sub-tab switching works in visual panel', async ({ panelPage, clickNav }) => {
    await clickNav('visual');

    // Default: contrast
    expect(await panelPage.$('.section-sub-panel[data-panel="contrast"].active')).toBeTruthy();

    // Click touch-targets
    await panelPage.click('.section-sub-tab[data-tab="touch-targets"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('.section-sub-panel[data-panel="touch-targets"].active')).toBeTruthy();

    // Click text-spacing
    await panelPage.click('.section-sub-tab[data-tab="text-spacing"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('.section-sub-panel[data-panel="text-spacing"].active')).toBeTruthy();
  });

  test('sr sub-tab switching works', async ({ panelPage, clickNav }) => {
    await clickNav('screen-reader');

    // Default: voice
    expect(await panelPage.$('#sr-panel-voice.active')).toBeTruthy();

    // Click name audit
    await panelPage.click('.sr-sub-tab[data-sr-tab="name-audit"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('#sr-panel-name-audit.active')).toBeTruthy();

    // Click aria validation
    await panelPage.click('.sr-sub-tab[data-sr-tab="aria-validation"]');
    await panelPage.waitForTimeout(200);
    expect(await panelPage.$('#sr-panel-aria-validation.active')).toBeTruthy();
  });

  test('icon spans have aria-hidden', async ({ panelPage }) => {
    const icons = await panelPage.$$('.nav-icon');
    for (const icon of icons) {
      const ariaHidden = await icon.getAttribute('aria-hidden');
      expect(ariaHidden).toBe('true');
    }
  });

  test('sidebar nav has aria-label', async ({ panelPage }) => {
    const nav = await panelPage.$('.sidebar-nav');
    const label = await nav?.getAttribute('aria-label');
    expect(label).toBeTruthy();
  });

  test('all sub-panels have description text', async ({ panelPage }) => {
    const descs = await panelPage.$$('.sr-sub-desc');
    expect(descs.length).toBeGreaterThanOrEqual(15);
  });
});
