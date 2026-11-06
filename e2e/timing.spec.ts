import { test, expect } from '@playwright/test';
import { boot, goto, shot, noErrors } from './helpers';

// autopilot offset: + = press later (LATE), - = press earlier (EARLY)
const CASES: [number, string][] = [
  [-1, 'PERFECT'],
  [-5, 'GOOD'],
  [-10, 'EARLY'],
  [-17, 'MISHIT'],
  [7, 'LATE'],
  [12, 'MISHIT'],
];

for (const [off, want] of CASES) {
  test(`press offset ${off} grades ${want}`, async ({ page }) => {
    const errors: string[] = [];
    await boot(page, errors);
    await goto(page, 'match', { surface: 'hard', seed: 11 });
    await page.evaluate((o) => (window as any).__game.autopilot([{ idx: 0, offset: o, shot: 'normal' }]), off);
    // run until the human makes a contact (a popup appears with a grade label)
    let found = '';
    for (let i = 0; i < 1500 && !found; i++) {
      const s = await page.evaluate(() => (window as any).__game.advanceFrames(2));
      const human = (s.players[0].swing && !s.players[0].swing.whiff && s.players[0].swing.grade) || null;
      if (human && s.rally.lastHitter === 0) {
        found = human;
        await shot(page, `timing-${want}-${off}`);
        console.log(off, human, JSON.stringify(s.popups), s.players[0].swing.offset);
      }
    }
    expect(found).toBe(want);
    noErrors(errors);
  });
}
