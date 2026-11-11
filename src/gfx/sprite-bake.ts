/**
 * Placeholder player sprite sheets, baked from the procedural figure's key poses.
 * `npm run sprites:placeholder` runs this in a headless browser and writes the PNG strips and
 * manifest.json into public/sprites/player/. Replace those PNGs with real art (same cell size,
 * same foot anchor) and the game picks them up; frame counts come from each strip's width.
 */
import { drawFigure, lerpPose, mirrorPose, POSES, Pose, strokePoses } from './player-renderer';
import { AnimMeta, AnimName, FIGURE_HEIGHT_M, SpriteManifest, SpriteView } from './sprites';
import { Kit } from '../data/types';

interface Frame {
  pose: Pose;
  bob?: number;
  twoHanded?: boolean;
}
interface PlaceholderAnim {
  meta: AnimMeta;
  frames: Frame[];
}

/** final cell size (px) and how much the low-res drawing is enlarged into it */
const CELL = 256;
const PIXEL = 2;
const FIGURE_PX = 100;
const ANCHOR: [number, number] = [128, 236];

/** white tennis whites, dark racket: close to the reference art the real sheets will follow */
const KIT: Kit = { shirt: '#f2f2f0', shorts: '#e8e8e6', band: '#3a3f4a', skin: '#c98a55', hair: '#2a1a10', shoes: '#ffffff' };

const mid = (a: Pose, b: Pose, t = 0.5): Pose => lerpPose(a, b, t);
const R = POSES.ready;

/** ready → back → (contact) → follow → recover, contact at index 3 */
function stroke(back: Pose, con: Pose, fol: Pose, twoHanded = false): PlaceholderAnim {
  const poses = [R, mid(R, back), back, con, mid(con, fol), fol, mid(fol, R)];
  return { meta: { contact: 3 }, frames: poses.map((pose) => ({ pose, twoHanded })) };
}

function loopOf(g: Pose, fps: number, ks = [0.75, 0.9, 1, 0.9], bobs = [0, 0, 0, 0]): PlaceholderAnim {
  return { meta: { fps, loop: true }, frames: ks.map((k, i) => ({ pose: mid(R, g, k), bob: bobs[i] })) };
}

/** placeholder art for every animation except the idle racket spin (no drawn pose for it) */
export function placeholderAnims(): Partial<Record<AnimName, PlaceholderAnim>> {
  const fh = strokePoses(true, 'topspin', true);
  const bh2 = strokePoses(false, 'topspin', true);
  const bh1 = strokePoses(false, 'topspin', false);
  const fhS = strokePoses(true, 'slice', true);
  const bhS = strokePoses(false, 'slice', true);
  const fhL = strokePoses(true, 'lob', true);
  const bhL = strokePoses(false, 'lob', true);
  const vol = POSES.volley;
  const volB = mirrorPose(POSES.volley);
  const run: Frame[] = [];
  for (let i = 0; i < 8; i++) {
    // same stride as the drawn figure: runA ↔ runB on a sine
    const k = (Math.sin((i / 8) * Math.PI * 2) + 1) / 2;
    run.push({ pose: lerpPose(POSES.runA, POSES.runB, k), bob: Math.abs(Math.sin((i / 8) * Math.PI * 2)) * 0.03 });
  }
  return {
    ready: { meta: { fps: 6, loop: true }, frames: [0, 0.03, 0.05, 0.03].map((b) => ({ pose: R, bob: -b })) },
    run: { meta: { loop: true }, frames: run },
    forehand: stroke(fh.back, fh.con, fh.fol),
    backhand: stroke(bh2.back, bh2.con, bh2.fol, true),
    backhand1h: stroke(bh1.back, bh1.con, bh1.fol),
    fhSlice: stroke(fhS.back, fhS.con, fhS.fol),
    bhSlice: stroke(bhS.back, bhS.con, bhS.fol),
    fhLob: stroke(fhL.back, fhL.con, fhL.fol),
    bhLob: stroke(bhL.back, bhL.con, bhL.fol, true),
    volleyFh: { meta: { contact: 2 }, frames: [R, mid(R, vol, 0.4), vol, mid(vol, R, 0.4)].map((pose) => ({ pose })) },
    volleyBh: { meta: { contact: 2 }, frames: [R, mid(R, volB, 0.4), volB, mid(volB, R, 0.4)].map((pose) => ({ pose, twoHanded: true })) },
    overhead: {
      meta: { contact: 3 },
      frames: [R, mid(R, POSES.srvTrophy), POSES.srvTrophy, POSES.srvContact, POSES.srvFollow, mid(POSES.srvFollow, R)].map((pose) => ({ pose })),
    },
    serve: {
      meta: { contact: 6 },
      frames: [
        R, mid(R, POSES.srvToss), POSES.srvToss, mid(POSES.srvToss, POSES.srvTrophy), POSES.srvTrophy, mid(POSES.srvTrophy, POSES.srvContact, 0.4),
        POSES.srvContact, mid(POSES.srvContact, POSES.srvFollow), POSES.srvFollow, mid(POSES.srvFollow, R),
      ].map((pose) => ({ pose })),
    },
    dive: { meta: { contact: 3 }, frames: [R, POSES.fhBack, mid(POSES.fhBack, POSES.dive, 0.6), POSES.dive, POSES.dive].map((pose) => ({ pose })) },
    celebrate: loopOf(POSES.celebrate, 8, [0.6, 0.85, 1, 0.85], [0, -0.04, -0.06, -0.04]),
    slump: loopOf(POSES.slump, 2, [1, 0.94], [0, 0.01]),
    gFist: loopOf(POSES.gFist, 8),
    gRage: loopOf(POSES.gRage, 8),
    gSorry: loopOf(POSES.gSorry, 4, [0.8, 1]),
    gApplaud: loopOf(POSES.gApplaud, 8, [0.6, 1, 0.6, 1]),
    gFacepalm: loopOf(POSES.gFacepalm, 4, [0.85, 1]),
    gCrazy: loopOf(POSES.gCrazy, 10, [0.7, 1, 0.7, 1], [0, -0.03, 0, -0.03]),
    gThrow: loopOf(POSES.gThrow, 6, [0.5, 0.8, 1, 1]),
  };
}

/** One strip: the pose drawn small with hard pixel edges and a dark outline, then enlarged PIXEL×. */
export function bakeStrip(view: SpriteView, anim: PlaceholderAnim): HTMLCanvasElement {
  const lo = CELL / PIXEL;
  const n = anim.frames.length;
  const small = document.createElement('canvas');
  small.width = lo * n;
  small.height = lo;
  const sctx = small.getContext('2d')!;
  const pxPerM = FIGURE_PX / PIXEL / FIGURE_HEIGHT_M;
  anim.frames.forEach((f, i) => {
    sctx.save();
    sctx.beginPath();
    sctx.rect(i * lo, 0, lo, lo);
    sctx.clip();
    drawFigure(sctx, i * lo + ANCHOR[0] / PIXEL, ANCHOR[1] / PIXEL, pxPerM, f.pose, KIT, {
      mirror: view === 'front', // a right-hander seen from the front holds the racket on screen-left
      facingCamera: view === 'front',
      twoHanded: !!f.twoHanded,
      bob: f.bob ?? 0,
    });
    sctx.restore();
  });
  pixelate(sctx, small.width, small.height, lo);
  const out = document.createElement('canvas');
  out.width = CELL * n;
  out.height = CELL;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

/** hard alpha edges plus a 1-pixel dark outline around the silhouette (kept inside each cell) */
function pixelate(ctx: CanvasRenderingContext2D, w: number, h: number, cell: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    solid[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    d[i * 4 + 3] = solid[i] ? 255 : 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const cx = x % cell;
      const near =
        (cx > 0 && solid[i - 1]) || (cx < cell - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
      if (near) {
        d[i * 4] = 20; d[i * 4 + 1] = 16; d[i * 4 + 2] = 24; d[i * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Everything the bake script writes: the manifest and one PNG data URL per view/animation. */
export function bakeAll(): { manifest: SpriteManifest; strips: Record<string, string> } {
  const anims = placeholderAnims();
  const manifest: SpriteManifest = { cell: [CELL, CELL], anchor: ANCHOR, figureHeight: FIGURE_PX, animations: {} };
  const strips: Record<string, string> = {};
  for (const name of Object.keys(anims) as AnimName[]) {
    const a = anims[name]!;
    manifest.animations[name] = a.meta;
    for (const view of ['front', 'back'] as SpriteView[]) strips[`${view}/${name}`] = bakeStrip(view, a).toDataURL('image/png');
  }
  return { manifest, strips };
}
