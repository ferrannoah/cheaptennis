import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, noErrors } from './helpers';

const NAMES: Record<string, string> = { grass: 'Royal Meadow Championships', clay: 'Terracotta Open', hard: 'Harbour Lights Open' };

test('venues: each surface regular + Major, first round vs final, night session, and fps', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  await boot(page, errors);
  for (const surface of ['grass', 'clay', 'hard']) {
    for (const [tier, stage, round] of [['tour', 0, 'Round of 32'], ['major', 0, 'Round of 128'], ['major', 1, 'Final']] as const) {
      await goto(page, 'match', { surface, ai: true, seed: 4, venue: { tier, stage, name: NAMES[surface], round } });
      await adv(page, stage === 1 ? 40 : 160);
      await shot(page, `venue-${surface}-${tier}-${stage ? 'final' : 'r1'}`);
    }
  }
  await goto(page, 'match', { surface: 'hard', ai: true, seed: 4, venue: { tier: 'tour', stage: 0.5, night: true } });
  await adv(page, 160);
  await shot(page, 'venue-hard-night');
  // the final: flash burst after match point
  await goto(page, 'match', { surface: 'grass', ai: true, seed: 9, format: '1game', venue: { tier: 'major', stage: 1, name: NAMES.grass, round: 'Final' } });
  const s = await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "over"', 30000, 10));
  expect(s.phase).toBe('over');
  await adv(page, 3);
  await shot(page, 'venue-final-matchpoint');
  // a full Major crowd still runs well: time 300 frames of real stepping + drawing
  await goto(page, 'match', { surface: 'clay', ai: true, seed: 4, venue: { tier: 'major', stage: 1, name: NAMES.clay, round: 'Final' } });
  const ms = await page.evaluate(() => {
    const g = (window as any).__game.game;
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) {
      g.step();
      g.draw();
    }
    return (performance.now() - t0) / 120;
  });
  console.log('ms per frame (major crowd, headless):', ms.toFixed(2));
  expect(ms).toBeLessThan(16.7);
  noErrors(errors);
});
