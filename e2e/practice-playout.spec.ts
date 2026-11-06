import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, noErrors } from './helpers';

const run = (page: any, pred: string, max = 4000, chunk = 1) =>
  page.evaluate(([p, m, c]: [string, number, number]) => (window as any).__game.runUntil(p, m, c), [pred, max, chunk]);

test('ball machine: the shot plays out, landing is marked, then a pause before the next feed', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'machine');
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  // the player's shot lands (first bounce recorded)
  let s = await run(page, 's => s.rally.lastHitter === 0 && s.rally.bounces >= 1');
  expect(s.rally.lastHitter).toBe(0);
  await adv(page, 4);
  await shot(page, 'practice-landing');
  // wait until it has fully played out
  s = await run(page, 's => s.rally.dead');
  const deadAt = s.frame;
  // the next feed only comes after a pause
  s = await run(page, 's => s.rally.lastHitter === 1 && !s.rally.dead');
  expect(s.frame - deadAt).toBeGreaterThanOrEqual(45);
  noErrors(errors);
});

test('tutorial: a step that is completed by a hit waits for that ball to finish', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'tutorial');
  await adv(page, 20);
  // skip the movement step with a quick run
  await page.evaluate(() => (window as any).__game.press('right', 200));
  let s = await run(page, 's => s.tutStep >= 1', 600);
  expect(s.tutStep).toBe(1);
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0, shot: 'normal' }]));
  s = await run(page, 's => s.tutPending', 6000);
  expect(s.tutPending).toBe(true);
  // the ball that completed the step is still in the air: same step, ball not dead
  expect(s.tutStep).toBe(1);
  expect(s.rally.dead).toBe(false);
  await adv(page, 10);
  await shot(page, 'tutorial-step-complete');
  s = await run(page, 's => s.rally.dead', 600);
  const deadAt = s.frame;
  s = await run(page, 's => s.tutStep >= 2', 600);
  expect(s.tutStep).toBe(2);
  expect(s.frame - deadAt).toBeGreaterThanOrEqual(40);
  noErrors(errors);
});
