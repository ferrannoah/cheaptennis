// Cuts a generated sprite sheet into the game's player sprite strips (npm run sprites:import).
//
//   node scripts/import-sprite-sheet.mjs <sheet.png> --rows front/forehand,back/forehand [--ref 0]
//
// The sheet holds one animation per row, top to bottom in the order given by --rows, frames left
// to right with clear space between them. The background can be white or a painted checkerboard
// ("fake transparency"): everything light that can be reached from the image border without
// crossing the character's dark outline is removed. Each frame is scaled so that the --ref frame
// (default the first, a standing pose) is manifest.figureHeight px tall, and placed with the feet
// on the manifest's anchor. Imported strips are listed under "custom" in manifest.json, so
// npm run sprites:placeholder never overwrites them.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spriteDir = join(root, 'public', 'sprites', 'player');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const src = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const rows = (opt('rows', '') || '').split(',').filter(Boolean);
if (!src || !rows.length) {
  console.error('usage: node scripts/import-sprite-sheet.mjs <sheet.png> --rows front/forehand,back/forehand [--ref 0]');
  process.exit(1);
}
const manifestPath = join(spriteDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const dataUrl = 'data:image/png;base64,' + readFileSync(src).toString('base64');

/** Runs in the browser: background removal, row/frame detection, scaling and placement. */
async function cutSheet({ dataUrl, nRows, cell, anchor, figureHeight, ref }) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, W, H);
  const d = id.data;
  // 1. background: light, unsaturated pixels connected to the border
  const isBg = (i) => {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
    if (a < 20) return true;
    const lo = Math.min(r, g, b), hi = Math.max(r, g, b);
    return lo >= 222 && hi - lo <= 18;
  };
  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    const i = y * W + x;
    if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  for (let i = 0; i < W * H; i++) if (bg[i]) d[i * 4 + 3] = 0;
  cx.putImageData(id, 0, 0);
  const solid = (x, y) => !bg[y * W + x];

  // 2. rows: horizontal bands of figure pixels separated by empty space
  const rowCount = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(x, y)) rowCount[y]++;
  const bands = runs(rowCount, 10, 400);
  if (bands.length !== nRows) throw new Error(`expected ${nRows} rows, found ${bands.length}: ${JSON.stringify(bands)}`);

  const out = [];
  for (const [y0, y1] of bands) {
    // 3. frames: vertical runs of columns with figure pixels
    const colCount = new Array(W).fill(0);
    for (let x = 0; x < W; x++) for (let y = y0; y <= y1; y++) if (solid(x, y)) colCount[x]++;
    const groups = runs(colCount, 6, 150);
    const frames = groups.map(([x0, x1]) => {
      let top = y1, bot = y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (solid(x, y)) { if (y < top) top = y; if (y > bot) bot = y; }
      return { x0, x1, top, bot };
    });
    const r = frames[Math.min(ref, frames.length - 1)];
    const k = figureHeight / (r.bot - r.top + 1);
    for (const f of frames) {
      // feet: centre of the figure pixels in the bottom 12% of a standing height
      const footH = (r.bot - r.top) * 0.12;
      let fx0 = f.x1, fx1 = f.x0;
      for (let y = Math.round(f.bot - footH); y <= f.bot; y++) for (let x = f.x0; x <= f.x1; x++) if (solid(x, y)) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
      f.ax = (fx0 + fx1) / 2;
      f.ay = f.bot;
    }
    const strip = document.createElement('canvas');
    strip.width = cell[0] * frames.length; strip.height = cell[1];
    const sx = strip.getContext('2d');
    sx.imageSmoothingEnabled = true;
    sx.imageSmoothingQuality = 'high';
    const clipped = [];
    frames.forEach((f, i) => {
      const dx = i * cell[0] + anchor[0] + (f.x0 - f.ax) * k;
      const dy = anchor[1] + (f.top - f.ay) * k;
      const dw = (f.x1 - f.x0 + 1) * k, dh = (f.bot - f.top + 1) * k;
      if (dx < i * cell[0] || dx + dw > (i + 1) * cell[0] || dy < 0) clipped.push(i);
      sx.save();
      sx.beginPath();
      sx.rect(i * cell[0], 0, cell[0], cell[1]);
      sx.clip();
      sx.drawImage(cv, f.x0, f.top, f.x1 - f.x0 + 1, f.bot - f.top + 1, dx, dy, dw, dh);
      sx.restore();
    });
    out.push({ png: strip.toDataURL('image/png'), frames: frames.length, scale: k, refHeight: r.bot - r.top + 1, clipped });
  }
  return out;

  /** [start, end] runs where counts[i] > 0, split by gaps of at least minGap, dropping runs with < minMass */
  function runs(counts, minGap, minMass) {
    const res = [];
    let s = -1, gap = 0, mass = 0;
    for (let i = 0; i <= counts.length; i++) {
      const on = i < counts.length && counts[i] > 0;
      if (on) {
        if (s < 0) { s = i; mass = 0; }
        gap = 0;
        mass += counts[i];
      } else if (s >= 0) {
        gap++;
        if (gap >= minGap || i === counts.length) {
          if (mass >= minMass) res.push([s, i - gap]);
          s = -1; gap = 0;
        }
      }
    }
    return res;
  }
}

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
  const res = await page.evaluate(cutSheet, {
    dataUrl, nRows: rows.length, cell: manifest.cell, anchor: manifest.anchor, figureHeight: manifest.figureHeight, ref: Number(opt('ref', '0')),
  });
  const custom = new Set(manifest.custom ?? []);
  res.forEach((r, i) => {
    const key = rows[i];
    const file = join(spriteDir, key + '.png');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
    custom.add(key);
    const warn = r.clipped.length ? `  (frames ${r.clipped.join(', ')} reach past the cell edge and are cut off)` : '';
    console.log(`${key}: ${r.frames} frames, standing height ${r.refHeight}px -> ${manifest.figureHeight}px (x${r.scale.toFixed(3)})${warn}`);
  });
  manifest.custom = [...custom].sort();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  // keep the source sheet next to the art so it can be re-imported
  const keep = join(root, 'art', 'player', basename(src));
  if (resolve(src) !== keep) {
    mkdirSync(dirname(keep), { recursive: true });
    copyFileSync(src, keep);
  }
} finally {
  await browser.close();
}
