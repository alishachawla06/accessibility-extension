import { type Page, expect } from '@playwright/test';

/**
 * Navigate to a panel, click a scan/action button, and wait for results.
 */
export async function scanPanel(
  panelPage: Page,
  clickNav: (name: string) => Promise<void>,
  panelName: string,
  scanBtnId: string,
  resultSelector: string,
  timeout = 10000
) {
  await clickNav(panelName);
  await panelPage.click(`#${scanBtnId}`);
  await panelPage.waitForSelector(resultSelector, { timeout });
}

/**
 * Click a button via evaluate — bypasses CSS overlap issues.
 */
export async function clickFilter(panelPage: Page, selector: string, delay = 300) {
  await panelPage.evaluate((sel) => {
    (document.querySelector(sel) as HTMLElement)?.click();
  }, selector);
  await panelPage.waitForTimeout(delay);
}

/**
 * Get innerHTML of a container element.
 */
export async function getInnerHtml(page: Page, selector: string): Promise<string> {
  return page.$eval(selector, (el) => el.innerHTML);
}

/**
 * Count elements matching a selector.
 */
export async function countElements(page: Page, selector: string): Promise<number> {
  return (await page.$$(selector)).length;
}

/**
 * Check if an element is visible (not has class 'hidden').
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.$eval(selector, (el) => !el.classList.contains('hidden'));
}

/**
 * Switch to content page and count overlay elements.
 */
export async function countContentOverlays(
  contentPage: Page,
  overlaySelector: string,
  delay = 500
): Promise<number> {
  await contentPage.bringToFront();
  await contentPage.waitForTimeout(delay);
  return (await contentPage.$$(overlaySelector)).length;
}

/**
 * Get a numeric value from a summary count element.
 */
export async function getSummaryCount(page: Page, selector: string): Promise<number> {
  return page.$eval(selector, (el) => parseInt(el.textContent || '0'));
}
