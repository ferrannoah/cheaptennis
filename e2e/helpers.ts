import { Page, expect } from '@playwright/test';

export async function boot(page: Page, errors: string[]): Promise<void> {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?test');
  await page.waitForFunction(() => !!(window as any).__game);
  await page.evaluate(() => (window as any).__game.setPaused(true));
  await page.locator('canvas').click({ position: { x: 5, y: 5 } });
}

export async function adv(page: Page, n: number): Promise<any> {
  return page.evaluate((k) => (window as any).__game.advanceFrames(k), n);
}

export async function state(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__game.state());
}

export async function goto(page: Page, name: string, params?: unknown): Promise<void> {
  await page.evaluate(([n, p]) => (window as any).__game.goto(n, p), [name, params] as const);
}

export async function press(page: Page, action: string, frames = 1, id = 'p1'): Promise<void> {
  await page.evaluate(([a, f, i]) => (window as any).__game.press(a, f, i), [action, frames, id] as const);
}

export async function menu(page: Page, action: string): Promise<void> {
  await page.evaluate((a) => (window as any).__game.menu(a), action);
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `playtest/${name}.png` });
}

export function noErrors(errors: string[]): void {
  expect(errors.filter((e) => !e.includes('AudioContext'))).toEqual([]);
}
