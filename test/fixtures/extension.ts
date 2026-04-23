import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const TEST_PAGE_PATH = path.resolve(__dirname, '..', 'test-page.html');

// Worker-scoped fixtures — shared across ALL tests in a single worker.
// Since workers: 1, this means one browser for the entire run.
type WorkerFixtures = {
  sharedContext: BrowserContext;
  sharedExtensionId: string;
  sharedUserDataDir: string;
};

export type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  panelPage: Page;
  contentPage: Page;
  clickNav: (panelName: string) => Promise<void>;
};

export const test = base.extend<ExtensionFixtures, WorkerFixtures>({
  // ── Worker-scoped: one browser for the entire test run ──
  sharedUserDataDir: [async ({}, use) => {
    const dir = path.join(os.tmpdir(), 'a11ylens-test-profile-' + Date.now());
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }, { scope: 'worker' }],

  sharedContext: [async ({ sharedUserDataDir }, use) => {
    const context = await chromium.launchPersistentContext(sharedUserDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-default-apps',
      ],
    });
    await use(context);
    await context.close();
  }, { scope: 'worker' }],

  sharedExtensionId: [async ({ sharedContext }, use) => {
    let [background] = sharedContext.serviceWorkers();
    if (!background) {
      background = await sharedContext.waitForEvent('serviceworker');
    }
    await use(background.url().split('/')[2]);
  }, { scope: 'worker' }],

  // ── Test-scoped: fresh pages per test, reusing shared browser ──
  context: async ({ sharedContext }, use) => {
    await use(sharedContext);
  },

  extensionId: async ({ sharedExtensionId }, use) => {
    await use(sharedExtensionId);
  },

  contentPage: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(`file://${TEST_PAGE_PATH}`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },

  panelPage: async ({ context, extensionId, contentPage }, use) => {
    const background = context.serviceWorkers()[0];
    await background.evaluate((extId: string) => {
      (globalThis as any).chrome.windows.create({
        url: `chrome-extension://${extId}/popup/panel.html`,
        type: 'popup',
        width: 520,
        height: 700,
      });
    }, extensionId);

    // Wait for the panel page to appear in context
    let panel: Page | undefined;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300));
      panel = context.pages().find(p => p.url().includes('panel.html'));
      if (panel) break;
    }
    if (!panel) throw new Error('Panel page did not open');
    await panel.waitForLoadState('domcontentloaded');

    // Set sourceWindowId via background to point to the content page's window
    await background.evaluate(async () => {
      const tabs = await (globalThis as any).chrome.tabs.query({ active: true, windowType: 'normal' });
      const realTab = tabs.find((t: any) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
      if (realTab) {
        (globalThis as any).sourceWindowId = realTab.windowId;
      }
    });

    await use(panel);
    await panel.close();
  },

  clickNav: async ({ panelPage }, use) => {
    const fn = async (panelName: string) => {
      await panelPage.click(`[data-panel="${panelName}"]`);
      await panelPage.waitForTimeout(300);
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
