import { test, expect } from '@playwright/test';
import { boot, goto, noErrors } from './helpers';

test('realtime match runs near 60 fps with bounded particles', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'match', { surface: 'clay', ai: true, seed: 8 });
  await page.evaluate(() => (window as any).__game.setPaused(false));
  const samples: { fps: number; parts: number }[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(() => {
      const g = (window as any).__game;
      return { fps: g.game.fps, parts: g.top().view.particles.list.length };
    }));
  }
  console.log('perf', JSON.stringify(samples));
  const avg = samples.slice(2).reduce((a, s) => a + s.fps, 0) / (samples.length - 2);
  expect(avg).toBeGreaterThan(50);
  expect(Math.max(...samples.map((s) => s.parts))).toBeLessThanOrEqual(400);
  noErrors(errors);
});
