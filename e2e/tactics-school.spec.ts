import { test, expect } from '@playwright/test';
import { boot, adv, goto, shot, menu, state, noErrors } from './helpers';

const LESSONS = ['cross', 'open', 'line', 'short', 'serve', 'weak', 'pass', 'defend'];

test('Tactics School: menu, every lesson intro -> drill cleared by the autopilot -> summary, progress saved', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => localStorage.removeItem('baseline.lessons'));
  // reachable from the Practice menu
  await goto(page, 'practice');
  await adv(page, 10);
  await menu(page, 'down');
  await menu(page, 'ok');
  await adv(page, 40);
  expect((await state(page)).scene).toBe('tactics');
  await shot(page, 'school-menu');
  for (const id of LESSONS) {
    await goto(page, 'lesson', { id, card: 'intro' });
    await adv(page, 30);
    await shot(page, `school-${id}-intro`);
    await menu(page, 'ok');
    await adv(page, 40);
    let s = await state(page);
    expect(s.scene).toBe('lesson');
    await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
    // a mid-drill screenshot once a few balls have been played
    s = await page.evaluate(() => (window as any).__game.runUntil('s => s.scene !== "lesson" || s.results >= 2', 6000, 10));
    if (s.scene === 'lesson') await shot(page, `school-${id}-drill`);
    s = await page.evaluate(() => (window as any).__game.runUntil('s => s.scene !== "lesson"', 40000, 30));
    console.log(id, s.scene, JSON.stringify(s.counts ?? null), 'results', s.results);
    expect(s.scene, `lesson ${id} should be cleared`).toBe('lesson-card');
    expect(s.mode).toBe('done');
    await adv(page, 30);
    await shot(page, `school-${id}-done`);
  }
  const done = await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.lessons') || '{}'));
  expect(Object.keys(done).sort()).toEqual([...LESSONS].sort());
  await goto(page, 'tactics');
  await adv(page, 20);
  await shot(page, 'school-menu-complete');
  noErrors(errors);
});
