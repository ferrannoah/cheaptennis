import { test, expect, Page } from '@playwright/test';
import { adv, goto, state, shot, noErrors } from './helpers';

// a phone held sideways
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });

async function bootTouch(page: Page, errors: string[]): Promise<void> {
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?test&touch');
  await page.waitForFunction(() => !!(window as any).__game);
  await page.evaluate(() => (window as any).__game.setPaused(true));
}

/** press a touch button with a given pointer, keep it down for `frames`, then lift */
async function holdBtn(page: Page, sel: string, frames: number, id = 11): Promise<void> {
  await page.dispatchEvent(sel, 'pointerdown', { pointerId: id, pointerType: 'touch', isPrimary: true });
  await adv(page, frames);
  await page.dispatchEvent(sel, 'pointerup', { pointerId: id, pointerType: 'touch' });
  await adv(page, 2);
}

/** drag the joystick by (dx, dy) px for `frames`, then let go */
async function stick(page: Page, dx: number, dy: number, frames: number): Promise<void> {
  const box = (await page.locator('#touch .zone').boundingBox())!;
  const x = box.x + 120, y = box.y + box.height - 100;
  await page.dispatchEvent('#touch .zone', 'pointerdown', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y });
  await page.dispatchEvent('#touch .zone', 'pointermove', { pointerId: 7, pointerType: 'touch', clientX: x + dx, clientY: y + dy });
  await adv(page, frames);
  await page.dispatchEvent('#touch .zone', 'pointerup', { pointerId: 7, pointerType: 'touch' });
  await adv(page, 2);
}

test('touch overlay: drives menus and moves the player in a match', async ({ page }) => {
  const errors: string[] = [];
  await bootTouch(page, errors);
  await expect(page.locator('#touch')).toHaveClass(/on/);
  await adv(page, 60);
  expect((await state(page)).scene).toBe('title');
  await shot(page, 'touch-title-landscape');

  // stick down moves the cursor one row, button 1 confirms
  const sel = () => page.evaluate(() => (window as any).__game.top().sel as number);
  const before = await sel();
  await stick(page, 0, 60, 4);
  expect(await sel()).toBe(before + 1);
  await holdBtn(page, '#touch .btn.a', 2);
  await adv(page, 30);
  expect((await state(page)).scene).not.toBe('title');
  // ACC doubles as back
  await holdBtn(page, '#touch .btn.b', 2);
  await adv(page, 30);
  expect((await state(page)).scene).toBe('title');

  // in a match the stick walks the human player
  await goto(page, 'match', { surface: 'hard', seed: 3 });
  await adv(page, 30);
  const x0 = (await state(page)).players[0].x;
  await stick(page, 60, 0, 30);
  const x1 = (await state(page)).players[0].x;
  expect(Math.abs(x1 - x0)).toBeGreaterThan(0.3);
  await shot(page, 'touch-match-landscape');
  // pause button opens the pause menu
  await holdBtn(page, '#touch .btn.start', 2);
  expect((await state(page)).scene).toBe('pause');
  noErrors(errors);
});

test('touch overlay: portrait puts the court on top, hidden on desktop', async ({ page, browser }) => {
  const errors: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await bootTouch(page, errors);
  await goto(page, 'match', { surface: 'clay', seed: 4 });
  await adv(page, 40);
  await shot(page, 'touch-match-portrait');
  noErrors(errors);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 }, hasTouch: false, isMobile: false });
  const p2 = await ctx.newPage();
  await p2.goto('/?test');
  await p2.waitForFunction(() => !!(window as any).__game);
  await expect(p2.locator('#touch')).not.toHaveClass(/on/);
  await ctx.close();
});
