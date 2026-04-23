import { test, expect } from '../fixtures/extension';
import { scanPanel, countElements, getInnerHtml } from '../utils/helpers';

test.describe('Scorecard Panel', () => {
  test('should run scorecard and show hero banner with grade', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'scorecard', 'btn-run-scorecard', '#scorecard-grade:not(.hidden)', 20000);

    const gradeHtml = await getInnerHtml(panelPage, '#scorecard-grade');
    // Should contain a letter grade (A-F) and score
    expect(gradeHtml).toMatch(/[A-F]/);
    expect(gradeHtml).toContain('/100');
    // Should have category pills
    expect(gradeHtml).toContain('sc-pill');
  });

  test('should show 5 category cards with rings', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'scorecard', 'btn-run-scorecard', '#scorecard-categories:not(.hidden)', 20000);

    expect(await countElements(panelPage, '.sc-cat-card')).toBe(5);
    // Each card should have a progress ring SVG
    expect(await countElements(panelPage, '.sc-cat-ring')).toBe(5);
  });

  test('should show category names and scores', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'scorecard', 'btn-run-scorecard', '#scorecard-categories:not(.hidden)', 20000);

    const names = await panelPage.$$eval('.sc-cat-name', els => els.map(e => e.textContent || ''));
    const allNames = names.join(' ');
    expect(allNames).toContain('Keyboard');
    expect(allNames).toContain('ARIA');
    expect(allNames).toContain('Visual');
    expect(allNames).toContain('Structure');
    expect(allNames).toContain('Content');
  });

  test('should show fix suggestions and pass indicators', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'scorecard', 'btn-run-scorecard', '#scorecard-categories:not(.hidden)', 20000);

    const catHtml = await getInnerHtml(panelPage, '#scorecard-categories');
    // Should have fix sections or pass checkmarks
    const hasFixes = catHtml.includes('FIX FIRST') || catHtml.includes('sc-fix-pass');
    expect(hasFixes).toBe(true);
  });

  test('should show descriptive text for each category', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'scorecard', 'btn-run-scorecard', '#scorecard-categories:not(.hidden)', 20000);

    const descs = await panelPage.$$eval('.sc-cat-desc', els => els.map(e => e.textContent));
    expect(descs.length).toBe(5);
    descs.forEach(d => expect(d.length).toBeGreaterThan(20));
  });

  test('should show export button after scan', async ({ panelPage, clickNav }) => {
    await scanPanel(panelPage, clickNav, 'scorecard', 'btn-run-scorecard', '#scorecard-grade:not(.hidden)', 20000);

    expect(await panelPage.$('#btn-export-scorecard')).toBeTruthy();
  });
});
