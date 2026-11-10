// Bakes the placeholder player sprite sheets into public/sprites/player/ (npm run sprites:placeholder).
// Runs src/gfx/sprite-bake.ts in a headless browser (it draws with canvas) and saves the PNG strips
// plus manifest.json. Browser: $CHROME_PATH if set, else $PW_CHANNEL / Edge, else Playwright's Chromium.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'sprites', 'player');

const bundle = await build({
  stdin: { contents: "import { bakeAll } from './src/gfx/sprite-bake';\nwindow.__bake = bakeAll;", resolveDir: root, loader: 'ts' },
  bundle: true,
  format: 'iife',
  write: false,
  define: { 'import.meta.env': '{"BASE_URL":"./"}' },
  logLevel: 'warning',
});

async function launch() {
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    return await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' });
  } catch {
    return chromium.launch();
  }
}

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const { manifest, strips } = await page.evaluate(() => window.__bake());
  for (const [key, url] of Object.entries(strips)) {
    const file = join(outDir, key + '.png');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${Object.keys(strips).length} strips + manifest.json to public/sprites/player/`);
} finally {
  await browser.close();
}
