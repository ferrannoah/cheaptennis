import { test, expect } from '@playwright/test';

test('audio starts only after a gesture; M toggles mute', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?test');
  await page.waitForFunction(() => !!(window as any).__game);
  await page.evaluate(() => localStorage.clear());
  let s = await page.evaluate(() => (window as any).__game.state());
  expect(s.audio.ctx).toBe('locked');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  s = await page.evaluate(() => (window as any).__game.state());
  expect(s.audio.ctx).toBe('running');
  expect(s.audio.song).toBe('title');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(100);
  const muted = await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.settings') || '{}').muted);
  expect(muted).toBe(true);
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.settings') || '{}').muted)).toBe(false);
  expect(errors).toEqual([]);
});
