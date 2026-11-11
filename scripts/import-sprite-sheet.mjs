// Cuts a generated sprite sheet into the game's player sprite strips (npm run sprites:import).
//
//   node scripts/import-sprite-sheet.mjs <sheet.png> --rows front/forehand,back/forehand [--ref 0] [--stand 1]
//
// --rows lists the sheet's rows top to bottom, separated by commas. Each row can go to several
// strips (separated by |); a strip name can end in ~ to mirror it (a swing drawn on the wrong side)
// and in @0.6 to keep only those frames. "-" skips a row. Example for a sheet whose top row is a
// backhand volley and bottom row a forehand volley:
//   --rows "front/volleyBh|front/volleyFh~,back/volleyFh|back/volleyBh~"
// --stand: how tall the --ref frame is compared with standing upright (0.9 for a crouch,
// 1.3 when the racket is held up above the head), so every sheet comes out the same size.
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
const rows = (opt('rows', '') || '').split(',').filter(Boolean).map((r) =>
  r === '-' ? [] : r.split('|').map((t) => {
    const m = /^([a-z]+\/[A-Za-z0-9]+)(?:@([0-9.]+))?(~)?$/.exec(t.trim());
    if (!m) throw new Error('bad strip name: ' + t);
    return { key: m[1], pick: m[2] ? m[2].split('.').map(Number) : null, mirror: !!m[3] };
  }));
if (!src || !rows.length) {
  console.error('usage: node scripts/import-sprite-sheet.mjs <sheet.png> --rows front/forehand,back/forehand [--ref 0]');
  process.exit(1);
}
const manifestPath = join(spriteDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const dataUrl = 'data:image/png;base64,' + readFileSync(src).toString('base64');

/** Runs in the browser: background removal, row/frame detection, scaling and placement. */
async function cutSheet({ dataUrl, rows, cell, anchor, figureHeight, ref, stand }) {
  const nRows = rows.length;
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

  // 2. figures: 8-connected pixel blobs, merged when they nearly touch (a racket held clear of the hand)
  const comp = new Int32Array(W * H).fill(-1);
  const blobs = [];
  for (let i0 = 0; i0 < W * H; i0++) {
    if (bg[i0] || comp[i0] >= 0) continue;
    const id = blobs.length;
    const bl = { x0: W, y0: H, x1: 0, y1: 0, n: 0 };
    comp[i0] = id;
    const st = [i0];
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i / W) | 0;
      bl.n++;
      if (x < bl.x0) bl.x0 = x; if (x > bl.x1) bl.x1 = x; if (y < bl.y0) bl.y0 = y; if (y > bl.y1) bl.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!bg[j] && comp[j] < 0) { comp[j] = id; st.push(j); }
      }
    }
    blobs.push(bl);
  }
  // union blobs whose boxes come within PAD px of each other; specks under 30 px are dropped
  const PAD = 8;
  const parent = blobs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const big = blobs.map((b, i) => i).filter((i) => blobs[i].n >= 30);
  for (const i of big) for (const j of big) {
    if (j <= i) continue;
    const A = blobs[i], B = blobs[j];
    if (A.x0 - PAD <= B.x1 && B.x0 - PAD <= A.x1 && A.y0 - PAD <= B.y1 && B.y0 - PAD <= A.y1) parent[find(i)] = find(j);
  }
  const figMap = new Map();
  for (const i of big) {
    const r = find(i), b = blobs[i];
    const f = figMap.get(r) ?? { x0: W, x1: 0, top: H, bot: 0, n: 0, ids: new Set() };
    f.x0 = Math.min(f.x0, b.x0); f.x1 = Math.max(f.x1, b.x1); f.top = Math.min(f.top, b.y0); f.bot = Math.max(f.bot, b.y1);
    f.n += b.n; f.ids.add(i);
    figMap.set(r, f);
  }
  let figs = [...figMap.values()].filter((f) => f.n >= 400);
  // 3. rows: split the figures at the biggest gaps between their vertical centres
  figs.sort((p, q) => (p.top + p.bot) - (q.top + q.bot));
  const cuts = figs.slice(1).map((f, i) => ({ i: i + 1, gap: (f.top + f.bot) / 2 - (figs[i].top + figs[i].bot) / 2 }))
    .sort((p, q) => q.gap - p.gap).slice(0, nRows - 1).map((c) => c.i).sort((p, q) => p - q);
  const rowFigs = [];
  let at = 0;
  for (const c of [...cuts, figs.length]) { rowFigs.push(figs.slice(at, c).sort((p, q) => p.x0 - q.x0)); at = c; }
  if (rowFigs.length !== nRows || rowFigs.some((r) => !r.length)) throw new Error(`expected ${nRows} rows, found figures: ${rowFigs.map((r) => r.length).join(', ')}`);
  /** a canvas holding only this figure's pixels (neighbouring frames can overlap its box) */
  const figureCanvas = (f) => {
    const w = f.x1 - f.x0 + 1, h = f.bot - f.top + 1;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const src = cx.getImageData(f.x0, f.top, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const id = comp[(f.top + y) * W + f.x0 + x];
      if (id < 0 || !f.ids.has(id)) src.data[(y * w + x) * 4 + 3] = 0;
    }
    g.putImageData(src, 0, 0);
    return c;
  };
  const mine = (f, x, y) => { const id = comp[y * W + x]; return id >= 0 && f.ids.has(id); };

  const out = [];
  rowFigs.forEach((frames, ri) => {
    const r = frames[Math.min(ref, frames.length - 1)];
    const standH = (r.bot - r.top + 1) / stand;
    const k = figureHeight / standH;
    // the row's ground line; frames clearly above it (jumps) keep their height instead of being grounded
    const ground = [...frames.map((f) => f.bot)].sort((a, b) => a - b)[Math.floor(frames.length / 2)];
    for (const f of frames) {
      // feet: centre of the figure pixels in the bottom 12% of a standing height
      const footH = standH * 0.12;
      let fx0 = f.x1, fx1 = f.x0;
      for (let y = Math.round(f.bot - footH); y <= f.bot; y++) for (let x = f.x0; x <= f.x1; x++) if (mine(f, x, y)) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
      f.ax = (fx0 + fx1) / 2;
      f.ay = ground - f.bot > standH * 0.04 ? ground : f.bot;
    }
    const strips = rows[ri].map((t) => {
      const pick = (t.pick ?? frames.map((_, i) => i)).map((i) => frames[i]).filter(Boolean);
      const strip = document.createElement('canvas');
      strip.width = cell[0] * pick.length; strip.height = cell[1];
      const sx = strip.getContext('2d');
      sx.imageSmoothingEnabled = true;
      sx.imageSmoothingQuality = 'high';
      const clipped = [];
      pick.forEach((f, i) => {
        const ox = (f.x0 - f.ax) * k;
        const dy = anchor[1] + (f.top - f.ay) * k;
        const dw = (f.x1 - f.x0 + 1) * k, dh = (f.bot - f.top + 1) * k;
        const left = t.mirror ? -(ox + dw) : ox;
        if (anchor[0] + left < 0 || anchor[0] + left + dw > cell[0] || dy < 0) clipped.push(i);
        sx.save();
        sx.beginPath();
        sx.rect(i * cell[0], 0, cell[0], cell[1]);
        sx.clip();
        sx.translate(i * cell[0] + anchor[0], 0);
        if (t.mirror) sx.scale(-1, 1);
        sx.drawImage(f.canvas ?? (f.canvas = figureCanvas(f)), ox, dy, dw, dh);
        sx.restore();
      });
      return { key: t.key, mirror: t.mirror, png: strip.toDataURL('image/png'), frames: pick.length, clipped };
    });
    out.push({ strips, found: frames.length, scale: k, refHeight: r.bot - r.top + 1 });
  });
  return out;
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
    dataUrl, rows, cell: manifest.cell, anchor: manifest.anchor, figureHeight: manifest.figureHeight,
    ref: Number(opt('ref', '0')), stand: Number(opt('stand', '1')),
  });
  const custom = new Set(manifest.custom ?? []);
  res.forEach((row, ri) => {
    console.log(`row ${ri + 1}: ${row.found} frames, reference frame ${row.refHeight}px tall (x${row.scale.toFixed(3)})`);
    for (const r of row.strips) {
      const file = join(spriteDir, r.key + '.png');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(r.png.split(',')[1], 'base64'));
      custom.add(r.key);
      const warn = r.clipped.length ? `  (frames ${r.clipped.join(', ')} reach past the cell edge and are cut off)` : '';
      console.log(`  -> ${r.key}${r.mirror ? ' (mirrored)' : ''}: ${r.frames} frames${warn}`);
    }
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
