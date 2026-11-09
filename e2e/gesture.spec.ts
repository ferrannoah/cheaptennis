import { test, expect } from '@playwright/test';
import { boot, adv, goto, press, shot, noErrors } from './helpers';

test('after an error: centring icon; gesture key + direction plays a gesture', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'match', { surface: 'clay', seed: 21 });
  // pressing at the last moment makes errors likely
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, holdBefore: 5 }]));
  let s = await page.evaluate(() => (window as any).__game.runUntil('s => s.missIcon !== null', 20000, 2));
  expect(s.missIcon).not.toBeNull();
  await adv(page, 10);
  await shot(page, 'miss-icon');
  // gesture after the point
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "dead"', 600, 1));
  await press(page, 'down', 4);
  await press(page, 'gesture', 1);
  s = await adv(page, 12);
  expect(s.players[0].gesture).not.toBeNull();
  await shot(page, 'gesture');
  noErrors(errors);
});
