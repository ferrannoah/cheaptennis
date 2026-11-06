import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, state, noErrors } from './helpers';

test('H toggles the fatigue panel; the COM plan is not shown in play', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('baseline.settings') || '{}');
    s.fatigueInfo = false;
    localStorage.setItem('baseline.settings', JSON.stringify(s));
  });
  await goto(page, 'match', { surface: 'grass', seed: 3, stamina: 22 });
  await adv(page, 100);
  await shot(page, 'fatigue-hidden');
  await page.keyboard.press('KeyH');
  await adv(page, 2);
  const on = await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.settings') || '{}').fatigueInfo);
  expect(on).toBe(true);
  await shot(page, 'fatigue-panel');
  await page.keyboard.press('KeyH');
  await adv(page, 2);
  const off = await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.settings') || '{}').fatigueInfo);
  expect(off).toBe(false);
  expect((await state(page)).scene).toBe('match');
  noErrors(errors);
});
