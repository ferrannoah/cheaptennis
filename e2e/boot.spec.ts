import { test, expect } from '@playwright/test';
import { boot, adv, state, goto, shot, noErrors } from './helpers';

test('title, statcard and match views render', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await adv(page, 60);
  expect((await state(page)).scene).toBe('title');
  await shot(page, 'title');
  await goto(page, 'statcard');
  await adv(page, 40);
  await shot(page, 'statcard');
  for (const sf of ['grass', 'clay', 'hard']) {
    await goto(page, 'match', { surface: sf, ai: true, seed: 5 });
    await adv(page, 200);
    await shot(page, `match-${sf}-serve`);
    await adv(page, 70);
    await shot(page, `match-${sf}-rally`);
  }
  noErrors(errors);
});
