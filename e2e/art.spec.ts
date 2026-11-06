import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, state, noErrors } from './helpers';

test('player art: pose gallery (both views, both hands) and a forehand/backhand burst in a match', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  for (const view of ['back', 'front'] as const) {
    for (const lefty of [false, true]) {
      await goto(page, 'posegallery', { view, lefty });
      await adv(page, 2);
      await shot(page, `poses-${view}-${lefty ? 'L' : 'R'}`);
    }
  }
  // in a real match: capture frames through the near player's swings
  await goto(page, 'match', { surface: 'hard', ai: true, seed: 12 });
  const seen = new Set<string>();
  for (let i = 0; i < 200 && seen.size < 2; i++) {
    const s = await page.evaluate(() => (window as any).__game.runUntil('s => s.players[0].swing && !s.players[0].swing.whiff && s.players[0].swing.grade', 600, 1));
    const sw = s.players[0].swing;
    if (!sw) continue;
    const top = await page.evaluate(() => (window as any).__game.top().m.players[0].swing.fh);
    const key = top ? 'fh' : 'bh';
    if (!seen.has(key)) {
      seen.add(key);
      for (let f = 0; f < 6; f++) {
        await shot(page, `swing-${key}-${f}`);
        await adv(page, 3);
      }
    }
    await page.evaluate(() => (window as any).__game.runUntil('s => !s.players[0].swing', 120, 1));
  }
  expect(seen.size).toBe(2);
  expect((await state(page)).scene).toBe('match');
  noErrors(errors);
});
