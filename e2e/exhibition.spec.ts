import { test, expect } from '@playwright/test';
import { boot, adv, state, goto, shot, press, menu, noErrors } from './helpers';

test('arrow keys respond instantly', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'match', { surface: 'hard', seed: 3 });
  // wait for serve phase, COM or human serving
  let s = await adv(page, 60);
  const x0 = s.players[0].x;
  await press(page, 'right', 3);
  s = await adv(page, 2);
  // receiver/server movement allowed in serve phase (server shuffles along baseline, receiver moves)
  expect(s.players[0].x).toBeGreaterThan(x0);
  noErrors(errors);
});

test('full first-to-3 exhibition via menus and autopilot', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await adv(page, 30);
  // title -> exhibition
  await menu(page, 'ok');
  await adv(page, 40);
  expect((await state(page)).scene).toBe('exhibition');
  await shot(page, 'exhibition-setup');
  // select Start Match
  for (let i = 0; i < 6; i++) await menu(page, 'down');
  await menu(page, 'ok');
  await adv(page, 40);
  expect((await state(page)).scene).toBe('statcard');
  await menu(page, 'ok');
  await adv(page, 40);
  expect((await state(page)).scene).toBe('match');
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  const grades: Record<string, number> = {};
  let s: any;
  let shots = 0;
  for (let i = 0; i < 400; i++) {
    s = await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "over" || s.scene !== "match"', 600, 30));
    if (i === 3 && shots === 0) {
      await shot(page, 'exhibition-midmatch');
      shots++;
    }
    if (s.phase === 'over' || s.scene !== 'match') break;
  }
  expect(s.phase).toBe('over');
  await shot(page, 'exhibition-over');
  console.log('final', JSON.stringify({ games: s.games, winner: s.winner, perfects: s.players.map((p: any) => p.perfects) }));
  s = await adv(page, 300);
  expect((await state(page)).scene).toBe('result');
  await shot(page, 'exhibition-result');
  void grades;
  noErrors(errors);
});
