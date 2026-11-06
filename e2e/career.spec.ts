import { test, expect } from '@playwright/test';
import { boot, adv, state, goto, shot, menu, noErrors } from './helpers';

test('career: create, calendar gating, event, build, rankings, save/load', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => localStorage.clear());
  // create through the UI: type a name
  await goto(page, 'create');
  await adv(page, 5);
  await menu(page, 'ok');
  for (const k of ['KeyS', 'KeyA', 'KeyM', 'Space', 'KeyR', 'KeyI', 'KeyV', 'KeyE', 'KeyR', 'Enter']) await page.keyboard.press(k);
  await adv(page, 2);
  await menu(page, 'down');
  await menu(page, 'down');
  await menu(page, 'down');
  await menu(page, 'right'); // primary archetype
  await adv(page, 5);
  await shot(page, 'career-create');
  // jump to Start career
  for (let i = 0; i < 7; i++) await menu(page, 'down');
  await menu(page, 'ok');
  await page.waitForTimeout(600);
  await adv(page, 30);
  let s = await state(page);
  expect(s.scene).toBe('hub');
  expect(s.rank).toBe(null);
  console.log('new career', JSON.stringify(s));
  await shot(page, 'career-hub');
  // calendar: unranked player sees gating labels
  await menu(page, 'ok');
  await adv(page, 30);
  s = await state(page);
  expect(s.scene).toBe('calendar');
  console.log('calendar', JSON.stringify(s.rows));
  expect(s.rows.some((r: string) => r.includes('Not eligible: rank #'))).toBe(true);
  expect(s.rows.some((r: string) => r.includes('Open entry'))).toBe(true);
  await shot(page, 'career-calendar');
  // browse to a Major week to see more labels
  for (let i = 0; i < 2; i++) await menu(page, 'right');
  await adv(page, 5);
  await shot(page, 'career-calendar-major');
  for (let i = 0; i < 2; i++) await menu(page, 'left');
  // enter the first open event (Futures)
  const rows: string[] = (await state(page)).rows;
  const idx = rows.findIndex((r) => r.includes('Open entry'));
  for (let i = 0; i < idx; i++) await menu(page, 'down');
  await menu(page, 'ok');
  await adv(page, 30);
  s = await state(page);
  expect(s.scene).toBe('event');
  await shot(page, 'career-event');
  // play the first match with autopilot (normal difficulty)
  await menu(page, 'ok');
  await adv(page, 50);
  expect((await state(page)).scene).toBe('statcard');
  await shot(page, 'career-statcard');
  await menu(page, 'ok');
  await adv(page, 30);
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.scene !== "match" || s.phase === "over"', 60000, 60));
  await adv(page, 300);
  s = await state(page);
  console.log('after match', JSON.stringify(s));
  expect(['event', 'trophy']).toContain(s.scene);
  await shot(page, 'career-after-match');
  await page.evaluate(() => (window as any).__game.autopilot([]));
  // quick-sim the rest of the event
  for (let i = 0; i < 6 && (await state(page)).next; i++) {
    await page.evaluate(() => {
      const top = (window as any).__game.top();
      top.sim();
    });
    await adv(page, 30);
    const st = await state(page);
    if (st.scene === 'trophy') {
      await shot(page, 'career-trophy');
      await menu(page, 'ok');
      await adv(page, 30);
    }
  }
  s = await state(page);
  expect(s.scene).toBe('event');
  await menu(page, 'ok'); // finish week
  await adv(page, 30);
  s = await state(page);
  expect(s.scene).toBe('hub');
  expect(s.week).toBe(2);
  console.log('week 2', JSON.stringify(s));
  await shot(page, 'career-hub-week2');
  // build screen: spend a point
  const before = await page.evaluate(() => {
    const top = (window as any).__game.top();
    return top.s.player.sp;
  });
  await goto(page, 'build');
  await adv(page, 5);
  await menu(page, 'right');
  await adv(page, 5);
  s = await state(page);
  expect(s.sp).toBeLessThan(before + 1);
  await shot(page, 'career-build');
  // rankings and career page
  await goto(page, 'rankings');
  await adv(page, 5);
  await shot(page, 'career-rankings');
  // save / load round-trip
  const ok = await page.evaluate(() => (window as any).__career.roundTrip());
  expect(ok).toBe(true);
  noErrors(errors);
});

test('career: auto-sim seasons, rankings move, save persists across reload', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => localStorage.clear());
  await goto(page, 'hub');
  const r1 = await page.evaluate(() => (window as any).__career.autoWeeks(20));
  console.log('after 20 weeks', JSON.stringify(r1));
  const r2 = await page.evaluate(() => (window as any).__career.autoWeeks(100));
  console.log('after 120 weeks', JSON.stringify(r2));
  expect(r2.rank).not.toBe(null);
  await goto(page, 'hub');
  await adv(page, 10);
  await shot(page, 'career-hub-later');
  await goto(page, 'careerpage');
  await adv(page, 5);
  await shot(page, 'career-page');
  await goto(page, 'rankings');
  await adv(page, 5);
  await shot(page, 'career-rankings-later');
  // reload page: save persists
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.career') || 'null')?.week);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__game);
  await page.evaluate(() => (window as any).__game.setPaused(true));
  const reloaded = await page.evaluate(() => {
    (window as any).__career.reloadFromStorage();
    return (window as any).__career.get().week;
  });
  expect(reloaded).toBe(saved);
  await goto(page, 'careermenu');
  await adv(page, 10);
  await shot(page, 'career-menu-continue');
  noErrors(errors);
});
