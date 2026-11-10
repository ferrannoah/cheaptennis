import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, noErrors } from './helpers';

test('player graphics option: sprite mode loads every placeholder strip and draws the match with them', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);

  // the Options entry toggles DRAWN <-> SPRITES
  await goto(page, 'options');
  const val = () => page.evaluate(() => (window as any).__game.top().items().find((i: any) => i.id === 'playerart').value);
  expect(await val()).toBe('DRAWN');
  await page.evaluate(() => (window as any).__game.top().items().find((i: any) => i.id === 'playerart').change(1));
  expect(await val()).toBe('SPRITES');
  await shot(page, 'sprites-options');

  // every strip in the manifest loads, in both views
  await goto(page, 'spritegallery', { view: 'back', page: 0 });
  await page.waitForFunction(() => (window as any).__game.sprites().state !== 'loading' && (window as any).__game.sprites().state !== 'idle');
  const st = await page.evaluate(() => (window as any).__game.sprites());
  expect(st.state).toBe('ready');
  expect(st.missing).toEqual([]);
  for (const view of ['back', 'front'] as const) {
    for (let p = 0; p < 3; p++) {
      await goto(page, 'spritegallery', { view, page: p });
      await adv(page, 1);
      await shot(page, `sprites-gallery-${view}-${p}`);
    }
  }

  // a COM-vs-COM match draws both players from the sprite strips, through serves and swings
  await goto(page, 'match', { surface: 'hard', ai: true, seed: 12 });
  const before = (await page.evaluate(() => (window as any).__game.sprites())).drawn;
  let swings = 0;
  for (let i = 0; i < 40 && swings < 2; i++) {
    const s = await page.evaluate(() => (window as any).__game.runUntil('s => s.players[0].swing && !s.players[0].swing.whiff', 600, 1));
    if (!s.players?.[0]?.swing) continue;
    swings++;
    for (let f = 0; f < 4; f++) {
      await shot(page, `sprites-match-${swings}-${f}`);
      await adv(page, 4);
    }
    await page.evaluate(() => (window as any).__game.runUntil('s => !s.players[0].swing', 120, 1));
  }
  expect(swings).toBe(2);
  const after = (await page.evaluate(() => (window as any).__game.sprites())).drawn;
  expect(after - before).toBeGreaterThan(20);

  noErrors(errors);
});
