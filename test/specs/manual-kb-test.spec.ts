import { test, expect } from '../fixtures/extension';
import { clickSubTab, countElements } from '../utils/helpers';

test.describe('Manual Keyboard Test', () => {
  // Clear stale recording state between tests (shared browser context)
  test.beforeEach(async ({ context }) => {
    const bg = context.serviceWorkers()[0];
    if (bg) {
      await bg.evaluate(() => (globalThis as any).chrome.storage.session.remove(['mktRecording', 'mktTabId']));
    }
  });

  test('should show start button and hide stop/clear initially', async ({ panelPage, clickNav }) => {
    await clickNav('keyboard');
    await clickSubTab(panelPage, 'manual-kb');

    expect(await panelPage.$('#btn-mkt-start:not(.hidden)')).toBeTruthy();
    expect(await panelPage.$('#btn-mkt-stop.hidden')).toBeTruthy();
    expect(await panelPage.$('#btn-mkt-clear.hidden')).toBeTruthy();
  });

  test('should toggle buttons on start recording', async ({ panelPage, contentPage, clickNav }) => {
    await clickNav('keyboard');
    await clickSubTab(panelPage, 'manual-kb');

    await panelPage.click('#btn-mkt-start');
    await panelPage.waitForTimeout(500);

    // After starting, stop should be visible
    expect(await panelPage.$('#btn-mkt-stop:not(.hidden)')).toBeTruthy();
  });

  test('should record focus trail when tabbing on content page', async ({ panelPage, contentPage, clickNav }) => {
    await clickNav('keyboard');
    await clickSubTab(panelPage, 'manual-kb');

    // Start recording
    await panelPage.click('#btn-mkt-start');
    await panelPage.waitForTimeout(500);

    // Tab through content page
    await contentPage.bringToFront();
    for (let i = 0; i < 5; i++) {
      await contentPage.keyboard.press('Tab');
      await contentPage.waitForTimeout(200);
    }

    // Stop recording
    await panelPage.bringToFront();
    await panelPage.click('#btn-mkt-stop');
    await panelPage.waitForTimeout(1000);

    // Should have trail items
    const trailItems = await countElements(panelPage, '#mkt-results .kb-issue-card, #mkt-results .mkt-trail-item, #mkt-results .result-item');
    expect(trailItems).toBeGreaterThanOrEqual(1);
  });

  test('should clear trail on clear button click', async ({ panelPage, contentPage, clickNav }) => {
    await clickNav('keyboard');
    await clickSubTab(panelPage, 'manual-kb');

    // Start, tab, stop
    await panelPage.click('#btn-mkt-start');
    await panelPage.waitForTimeout(300);
    await contentPage.bringToFront();
    await contentPage.keyboard.press('Tab');
    await contentPage.waitForTimeout(200);
    await panelPage.bringToFront();
    await panelPage.click('#btn-mkt-stop');
    await panelPage.waitForTimeout(500);

    // Clear
    await panelPage.click('#btn-mkt-clear');
    await panelPage.waitForTimeout(300);

    const html = await panelPage.$eval('#mkt-results', el => el.innerHTML);
    expect(html.trim()).toBe('');
  });
});
