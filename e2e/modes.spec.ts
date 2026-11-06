import { test, expect } from '@playwright/test';
import { boot, adv, state, goto, shot, press, menu, noErrors } from './helpers';

test('stamina drains, affects play and shows red', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'match', { surface: 'clay', seed: 4, stamina: 100 });
  let s = await adv(page, 2);
  const fresh = { speed: s.players[0].maxSpeed, win: s.players[0].windowMul, st: s.players[0].stamina };
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.rally && s.rally.rallyLen >= 8', 6000, 10));
  expect(s.players[0].stamina).toBeLessThan(fresh.st);
  // tired player
  await goto(page, 'match', { surface: 'clay', seed: 4, stamina: 12 });
  s = await adv(page, 2);
  expect(s.players[0].maxSpeed).toBeLessThan(fresh.speed * 0.9);
  expect(s.players[0].windowMul).toBeLessThan(fresh.win * 0.8);
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "rally" && s.ball.y < 0', 3000, 5));
  await shot(page, 'stamina-tired');
  // recovery between points
  const before = (await state(page)).players[0].stamina;
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.points[0] + s.points[1] + s.games[0] + s.games[1] > 0', 8000, 10));
  s = await adv(page, 100);
  console.log('stamina before/after point', before, s.players[0].stamina);
  noErrors(errors);
});

test('options remap: rebind swing to Enter works in a match', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => localStorage.clear());
  await goto(page, 'remap');
  await adv(page, 5);
  // select "Normal shot" (5th row) and press Enter to capture, then press KeyQ
  for (let i = 0; i < 4; i++) await menu(page, 'down');
  await menu(page, 'ok');
  await adv(page, 2);
  await page.keyboard.press('KeyQ');
  await adv(page, 2);
  await shot(page, 'remap');
  const keys = await page.evaluate(() => JSON.parse(localStorage.getItem('baseline.settings') || '{}').keys?.solo?.normal);
  expect(keys).toEqual(['KeyQ']);
  // in a match, Q now tosses the serve when the human serves
  await goto(page, 'match', { surface: 'hard', seed: 1 });
  let s = await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "serve" && s.server === 0 && s.players[0].serve === "ready"', 1200, 5));
  await adv(page, 60);
  await page.keyboard.down('KeyQ');
  await adv(page, 2);
  await page.keyboard.up('KeyQ');
  s = await adv(page, 2);
  expect(s.players[0].serve).toBe('toss');
  // restore defaults
  await page.evaluate(() => localStorage.clear());
  await goto(page, 'options');
  await adv(page, 10);
  await shot(page, 'options');
  noErrors(errors);
});

test('practice ball machine, serve practice and tutorial', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'practice');
  await adv(page, 10);
  await shot(page, 'practice-menu');
  await goto(page, 'machine');
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  let s = await page.evaluate(() => (window as any).__game.runUntil('s => s.players[0].perfects >= 3', 4000, 10));
  expect(s.players[0].perfects).toBeGreaterThanOrEqual(3);
  await shot(page, 'practice-machine');
  // tutorial: step through movement + timing via autopilot
  await goto(page, 'tutorial');
  await adv(page, 30);
  await shot(page, 'tutorial-1');
  await press(page, 'right', 90);
  s = await adv(page, 90);
  await press(page, 'left', 90);
  s = await adv(page, 100);
  expect(s.tutStep).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0, shot: 'normal' }]));
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.tutStep >= 2', 5000, 10));
  expect(s.tutStep).toBeGreaterThanOrEqual(2);
  await shot(page, 'tutorial-3');
  // serve practice
  await goto(page, 'machine', { serve: true });
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.call === "IN!"', 3000, 5));
  expect(s.call).toBe('IN!');
  await shot(page, 'serve-practice');
  noErrors(errors);
});

test('versus: keyboard split and two gamepads', async ({ page }) => {
  const errors: string[] = [];
  // mock two gamepads controlled through window.__pads
  await page.addInitScript(() => {
    const mk = (i: number) => ({ index: i, id: 'mock pad ' + i, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) });
    (window as any).__pads = [mk(0), mk(1)];
    (navigator as any).getGamepads = () => (window as any).__pads;
  });
  await boot(page, errors);
  await goto(page, 'versus');
  await adv(page, 10);
  await shot(page, 'versus-setup');
  // keyboard split: P1 (WASD) and P2 (arrows) both move
  await goto(page, 'match', { versus: 'kb', surface: 'grass', seed: 2 });
  let s = await adv(page, 60);
  const x1 = s.players[0].x, x2 = s.players[1].x;
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ArrowLeft');
  s = await adv(page, 20);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ArrowLeft');
  expect(s.players[0].x).toBeGreaterThan(x1);
  expect(s.players[1].x).toBeLessThan(x2);
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0 }, { idx: 1 }]));
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.rally && s.rally.rallyLen >= 4', 4000, 10));
  expect(s.rally.rallyLen).toBeGreaterThanOrEqual(4);
  await shot(page, 'versus-kb');
  // two gamepads: P1 stick right, P2 stick left; P1 pad A tosses the serve
  await page.evaluate(() => (window as any).__game.autopilot([]));
  await goto(page, 'match', { versus: 'pad', surface: 'hard', seed: 2 });
  s = await adv(page, 60);
  const gx1 = s.players[0].x, gx2 = s.players[1].x;
  await page.evaluate(() => {
    const p = (window as any).__pads;
    p[0].axes[0] = 1;
    p[1].axes[0] = -1;
  });
  s = await adv(page, 20);
  await page.evaluate(() => {
    const p = (window as any).__pads;
    p[0].axes[0] = 0;
    p[1].axes[0] = 0;
  });
  expect(s.players[0].x).toBeGreaterThan(gx1);
  expect(s.players[1].x).toBeLessThan(gx2);
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "serve" && s.players[s.server].serve === "ready"', 600, 5));
  const srv = s.server;
  await adv(page, 60);
  await page.evaluate((i) => { (window as any).__pads[i].buttons[0] = { pressed: true, value: 1, touched: true }; }, srv);
  await adv(page, 2);
  await page.evaluate((i) => { (window as any).__pads[i].buttons[0] = { pressed: false, value: 0, touched: false }; }, srv);
  s = await adv(page, 2);
  expect(s.players[srv].serve).toBe('toss');
  await shot(page, 'versus-pad');
  noErrors(errors);
});

test('tournament brackets 8/16/32 and trophy', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  for (const size of [8, 16, 32]) {
    await goto(page, 'bracket', { size });
    await adv(page, 10);
    // quick-sim my first match, then screenshot the updated bracket
    await menu(page, 'down');
    await menu(page, 'ok');
    await adv(page, 30);
    const s = await state(page);
    console.log('bracket', size, JSON.stringify(s));
    expect(s.round).toBe(1);
    await shot(page, `bracket-${size}`);
  }
  await goto(page, 'trophy');
  await adv(page, 90);
  await shot(page, 'trophy');
  noErrors(errors);
});
