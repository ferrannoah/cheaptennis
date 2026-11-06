import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, noErrors } from './helpers';

test('TV scoreboard: set columns, point box and the pressure tab', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'match', { surface: 'grass', ai: true, seed: 31, format: 'bo3' });
  await adv(page, 120);
  await shot(page, 'scoreboard-start');
  // a big point with the tab showing
  let s = await page.evaluate(() => (window as any).__game.runUntil('s => s.pressure === "BREAK POINT" || s.pressure === "SET POINT"', 120000, 10));
  expect(['BREAK POINT', 'SET POINT']).toContain(s.pressure);
  await adv(page, 30);
  await shot(page, 'scoreboard-pressure');
  // after the first set: a completed-set column
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.setHistory.length >= 1 && s.phase === "serve"', 200000, 30));
  expect(s.setHistory.length).toBeGreaterThanOrEqual(1);
  await adv(page, 20);
  await shot(page, 'scoreboard-set');
  noErrors(errors);
});
