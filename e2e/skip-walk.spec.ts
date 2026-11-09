import { test, expect } from '@playwright/test';
import { boot, adv, goto, press, shot, noErrors } from './helpers';

test('Space skips the dead time and walk between points without tossing', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await goto(page, 'match', { surface: 'hard', seed: 3 });
  await page.evaluate(() => (window as any).__game.autopilot([{ idx: 0, offset: 0 }]));
  let skipped = 0;
  for (let n = 0; n < 4; n++) {
    // wait for a finished point with the call on screen
    let s = await page.evaluate(() => (window as any).__game.runUntil('s => s.phase === "dead" && s.phaseT >= 14 && s.faults === 0', 6000, 1));
    expect(s.phase).toBe('dead');
    expect(s.canSkip).toBe(true);
    if (n === 0) await shot(page, 'skip-hint');
    const pts = JSON.stringify([s.points, s.games]);
    await press(page, 'b1', 1);
    s = await adv(page, 1);
    s = await page.evaluate(() => (window as any).__game.state());
    expect(s.skips).toBe(++skipped);
    expect(['serve', 'over']).toContain(s.phase);
    if (s.phase === 'over') break;
    expect(JSON.stringify([s.points, s.games])).not.toBe(pts); // the point was scored
    expect(s.walking).toBe(false);
    // the point-won UI is cleared too
    expect(s.call).toBeNull();
    expect(s.popups).toEqual([]);
    expect(s.banner).toBeNull();
    // the same press must not have started a toss
    expect(s.players[s.server].serve).toBe('ready');
    s = await adv(page, 6);
    if (s.server === 0) expect(s.players[0].serve).toBe('ready');
  }
  noErrors(errors);
});
