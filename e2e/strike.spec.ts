import { test, expect, Page } from '@playwright/test';
import { boot, goto, shot, noErrors } from './helpers';

/**
 * (M21) Hold-to-strike: the autopilot holds the strike button like a player. `offset` delays the press
 * (frames after the moment a good player would press); a huge offset never presses = safe strike.
 */
async function firstHumanHit(page: Page, offset: number, name: string, strike = 'normal', holdBefore?: number) {
  await goto(page, 'match', { surface: 'hard', seed: 11 });
  await page.evaluate(([o, s, h]) => (window as any).__game.autopilot([{ idx: 0, offset: o, shot: s, holdBefore: h ?? undefined }]), [offset, strike, holdBefore ?? null] as const);
  let snapped = false;
  for (let i = 0; i < 1500; i++) {
    const s = await page.evaluate(() => (window as any).__game.advanceFrames(2));
    const p = s.players[0];
    // mid-preparation: the danger zone, green spots and aiming zone are on court
    if (!snapped && p.strike.held && p.strike.prep > 0.3 && s.rally.lastHitter === 1 && s.phase === 'rally') {
      snapped = true;
      await shot(page, `strike-${name}-holding`);
    }
    if (p.swing && p.swing.done && !p.swing.whiff && p.swing.grade && s.rally.lastHitter === 0) {
      await page.evaluate(() => (window as any).__game.advanceFrames(4));
      await shot(page, `strike-${name}`);
      console.log(name, p.swing.grade, p.swing.strike, JSON.stringify(s.popups));
      return { grade: p.swing.grade as string, strike: p.swing.strike as string, popups: s.popups as string[] };
    }
  }
  return null;
}

test('pressed early: a clean, prepared strike with the preview on court', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const r = await firstHumanHit(page, 0, 'early');
  expect(r).not.toBeNull();
  expect(['PERFECT', 'GOOD']).toContain(r!.grade);
  expect(r!.popups.some((p) => p.startsWith('PERFECT') || p.startsWith('GOOD'))).toBe(true);
  noErrors(errors);
});

test('pressed at the last moment: RUSHED', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const r = await firstHumanHit(page, 0, 'late', 'normal', 6);
  expect(r).not.toBeNull();
  expect(['RUSHED', 'MISHIT', 'OFFCENTRE', 'RISING']).toContain(r!.grade);
  noErrors(errors);
});

test('nothing held: SAFE strike', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const r = await firstHumanHit(page, 99999, 'none');
  expect(r).not.toBeNull();
  expect(r!.grade).toBe('SAFE');
  expect(r!.strike).toBe('safe');
  noErrors(errors);
});

test('acceleration: pips go down and the popup names it', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const r = await firstHumanHit(page, 0, 'accel', 'accel');
  expect(r).not.toBeNull();
  expect(r!.strike).toBe('accel');
  expect(r!.popups.some((p) => p.includes('ACCELERATION'))).toBe(true);
  const s = await page.evaluate(() => (window as any).__game.advanceFrames(1));
  expect(s.players[0].accel[0]).toBe(1);
  noErrors(errors);
});

test('serve: hold to toss, contact by itself; STRONG serve popup', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'machine', { serve: true });
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, serve: 'strong' }]));
  let s: any = null;
  for (let i = 0; i < 400; i++) {
    s = await page.evaluate(() => (window as any).__game.advanceFrames(2));
    if (s.players[0].serve === 'toss' && s.players[0].strike.held) {
      await shot(page, 'serve-toss-preview');
      break;
    }
  }
  s = await page.evaluate(() => (window as any).__game.runUntil('s => s.popups.some(p => p.includes("STRONG serve"))', 300, 1));
  expect(s.popups.some((p: string) => p.includes('STRONG serve'))).toBe(true);
  noErrors(errors);
});
