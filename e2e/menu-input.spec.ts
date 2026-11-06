import { test, expect, Page } from '@playwright/test';
import { boot, adv, goto, noErrors } from './helpers';

const sel = (page: Page) => page.evaluate(() => (window as any).__game.top().sel as number);

/** Hold a real key for `frames` simulated frames, then release it. */
async function hold(page: Page, key: string, frames: number): Promise<void> {
  await page.keyboard.down(key);
  await adv(page, frames);
  await page.keyboard.up(key);
  await adv(page, 2);
}

test('menus: one arrow tap moves one row, holding repeats', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  for (const scene of ['title', 'exhibition']) {
    await goto(page, scene);
    await adv(page, 30);
    // a realistic human tap: key is down for several frames
    for (const frames of [1, 3, 8, 15]) {
      const before = await sel(page);
      await hold(page, 'ArrowDown', frames);
      const after = await sel(page);
      expect(after - before, `${scene}: tap held ${frames} frames`).toBe(1);
    }
    const before = await sel(page);
    await hold(page, 'ArrowUp', 1);
    expect(await sel(page)).toBe(before - 1);
    // holding for ~40 frames auto-repeats a little
    await goto(page, scene);
    await adv(page, 30);
    await hold(page, 'ArrowDown', 40);
    const moved = await sel(page);
    expect(moved).toBeGreaterThanOrEqual(2);
    expect(moved).toBeLessThanOrEqual(4);
  }
  noErrors(errors);
});
