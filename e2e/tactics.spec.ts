import { test, expect } from '@playwright/test';
import { boot, adv, state, goto, shot, menu, noErrors } from './helpers';

test('AI game plans: stat card, HUD tag, plan changes, exhibition picker, scouting', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'statcard');
  await adv(page, 40);
  await shot(page, 'tactics-statcard');
  // AI vs AI: the far COM shows its plan, and plans vary across points
  await goto(page, 'match', { surface: 'grass', ai: true, seed: 21, opp: 3 });
  const seen = new Set<string>();
  let s: any;
  for (let i = 0; i < 40; i++) {
    s = await page.evaluate(() => (window as any).__game.runUntil('s => false', 300, 300));
    if (s.tactics?.[1]) seen.add(s.tactics[1]);
    if (i === 2) await shot(page, 'tactics-hud');
    if (s.phase === 'over') break;
  }
  console.log('plans seen for COM 2:', [...seen].join(', '));
  expect(seen.size).toBeGreaterThanOrEqual(2);
  // exhibition picker
  await goto(page, 'exhibition');
  await adv(page, 10);
  for (let i = 0; i < 3; i++) await menu(page, 'down');
  await menu(page, 'right');
  await menu(page, 'right');
  await adv(page, 5);
  await shot(page, 'tactics-exhibition');
  // career scouting
  await page.evaluate(() => localStorage.clear());
  await goto(page, 'calendar');
  await adv(page, 5);
  const rows: string[] = (await state(page)).rows;
  const idx = rows.findIndex((r) => r.includes('Open entry'));
  for (let i = 0; i < idx; i++) await menu(page, 'down');
  await menu(page, 'ok');
  await adv(page, 40);
  expect((await state(page)).scene).toBe('event');
  await shot(page, 'tactics-scouting');
  noErrors(errors);
});
