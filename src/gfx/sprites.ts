/**
 * Sprite-sheet player art (Options → Player graphics → SPRITES).
 *
 * Assets live in `public/sprites/player/`:
 *   manifest.json            cell size, foot anchor, character height and per-animation timing
 *   front/<anim>.png         far player (faces the camera), right-handed
 *   back/<anim>.png          near player (seen from behind), right-handed
 * Each PNG is one horizontal strip of equal cells; the frame count is the strip width / cell width.
 * Left-handers are drawn flipped. A missing strip falls back along FALLBACKS, and if nothing loads
 * at all the game keeps drawing the procedural figure.
 *
 * Timing: looping animations (ready, celebrate, gestures…) play at the manifest's fps. One-shot
 * animations (strokes, serve, dive) are driven by the game's own swing clock so the `contact`
 * frame is on screen exactly when the ball is struck: frames before it share the wind-up,
 * frames after it share the follow-through. The run cycle follows the player's stride.
 */

export type SpriteView = 'front' | 'back';

export const ANIM_NAMES = [
  'ready', 'run', 'forehand', 'backhand', 'backhand1h', 'fhSlice', 'bhSlice', 'fhLob', 'bhLob',
  'volleyFh', 'volleyBh', 'overhead', 'serve', 'dive', 'celebrate', 'slump',
  'gFist', 'gRage', 'gSorry', 'gApplaud', 'gFacepalm', 'gCrazy', 'gThrow',
] as const;
export type AnimName = (typeof ANIM_NAMES)[number];

/** What to try when an animation's strip is missing (first one present wins; `ready` is the last resort). */
export const FALLBACKS: Record<AnimName, AnimName[]> = {
  ready: [],
  run: ['ready'],
  forehand: ['ready'],
  backhand: ['backhand1h', 'forehand'],
  backhand1h: ['backhand', 'forehand'],
  fhSlice: ['forehand'],
  bhSlice: ['backhand1h', 'backhand', 'forehand'],
  fhLob: ['forehand'],
  bhLob: ['backhand', 'backhand1h', 'forehand'],
  volleyFh: ['forehand'],
  volleyBh: ['backhand', 'backhand1h', 'volleyFh'],
  overhead: ['serve', 'forehand'],
  serve: ['overhead', 'forehand'],
  dive: ['forehand'],
  celebrate: ['gFist', 'ready'],
  slump: ['ready'],
  gFist: ['celebrate'],
  gRage: ['slump'],
  gSorry: ['ready'],
  gApplaud: ['celebrate'],
  gFacepalm: ['slump'],
  gCrazy: ['celebrate'],
  gThrow: ['gRage', 'slump'],
};

export interface AnimMeta {
  /** playback rate for clock-driven (looping / gesture) animations */
  fps?: number;
  loop?: boolean;
  /** index of the frame where the racket meets the ball (one-shot animations) */
  contact?: number;
  /** the art faces / moves this way on screen; the sprite is flipped to match the player's movement */
  faces?: 'left' | 'right';
}

export interface SpriteManifest {
  /** cell width and height in px */
  cell: [number, number];
  /** where the feet touch the ground inside a cell (px) */
  anchor: [number, number];
  /** standing character height in px, soles to top of head: sets the in-game scale */
  figureHeight: number;
  animations: Partial<Record<AnimName, AnimMeta>>;
  /** strips ("view/anim") holding real art from npm run sprites:import; the placeholder baker leaves them alone */
  custom?: string[];
}

/** How the game wants an animation played this frame. */
export type AnimRef = (
  /** one-shot: k in 0..1 runs up to the contact frame, 1..2 from contact to the end */
  | { name: AnimName; kind: 'once'; k: number }
  /** cycle position 0..1 (the run follows the stride) */
  | { name: AnimName; kind: 'cycle'; phase: number }
  /** wall-clock seconds since the animation started */
  | { name: AnimName; kind: 'clock'; t: number }
) & {
  /** mirror this animation (e.g. a dive to the backhand side drawn from the forehand-side strip) */
  flip?: boolean;
  /** screen direction the player is moving (-1 left, +1 right), for strips with `faces` */
  facing?: number;
};

/** Frame index for `ref` in a strip of `frames` frames. Pure, so it is unit-tested. */
export function pickFrame(frames: number, meta: AnimMeta, ref: AnimRef): number {
  if (frames <= 1) return 0;
  const last = frames - 1;
  if (ref.kind === 'cycle') {
    const ph = ref.phase - Math.floor(ref.phase);
    return Math.min(last, Math.floor(ph * frames));
  }
  if (ref.kind === 'clock') {
    const f = Math.floor(Math.max(0, ref.t) * (meta.fps ?? 8));
    return meta.loop === false ? Math.min(last, f) : f % frames;
  }
  const c = Math.max(0, Math.min(last, meta.contact ?? Math.round(last * 0.45)));
  const k = Math.max(0, Math.min(2, ref.k));
  if (k < 1) return c === 0 ? 0 : Math.min(c - 1, Math.floor(k * c));
  const after = last - c; // frames after contact
  if (after === 0) return c;
  return Math.min(last, c + Math.floor((k - 1) * (after + 1)));
}

/** First available animation for `name` (itself, then its fallbacks, then `ready`). */
export function resolveAnim(name: AnimName, has: (n: AnimName) => boolean): AnimName | null {
  if (has(name)) return name;
  for (const f of FALLBACKS[name]) if (has(f)) return f;
  return has('ready') ? 'ready' : null;
}

/** standing height of the procedural figure (soles to top of head) in body metres, at FIGURE_SCALE 1 */
export const FIGURE_HEIGHT_M = 1.58;

export interface Strip {
  img: CanvasImageSource;
  frames: number;
}

export class SpriteBank {
  state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  manifest: SpriteManifest | null = null;
  strips: Record<SpriteView, Partial<Record<AnimName, Strip>>> = { front: {}, back: {} };
  /** strips that failed to load (missing file / decode error), for the gallery and tests */
  missing: string[] = [];
  /** sprite frames drawn so far (tests check the match really uses them) */
  drawn = 0;

  constructor(public base: string) {}

  /** Start loading (once). Safe to call every frame. */
  load(): void {
    if (this.state !== 'idle') return;
    this.state = 'loading';
    void this.loadAll().then(
      (ok) => (this.state = ok ? 'ready' : 'failed'),
      () => (this.state = 'failed'),
    );
  }

  private async loadAll(): Promise<boolean> {
    const res = await fetch(this.base + 'manifest.json');
    if (!res.ok) return false;
    const man = (await res.json()) as SpriteManifest;
    this.manifest = man;
    const jobs: Promise<void>[] = [];
    for (const view of ['front', 'back'] as SpriteView[]) {
      for (const name of Object.keys(man.animations) as AnimName[]) {
        if (!ANIM_NAMES.includes(name)) continue;
        jobs.push(
          loadImage(`${this.base}${view}/${name}.png`).then(
            (img) => {
              this.strips[view][name] = { img, frames: Math.max(1, Math.floor(img.naturalWidth / man.cell[0])) };
            },
            () => {
              this.missing.push(`${view}/${name}`);
            },
          ),
        );
      }
    }
    await Promise.all(jobs);
    return !!(this.strips.front.ready || this.strips.back.ready);
  }

  /** The strip that will actually play for `name` in `view`, after fallbacks. */
  resolve(view: SpriteView, name: AnimName): { name: AnimName; strip: Strip; meta: AnimMeta } | null {
    const man = this.manifest;
    if (!man) return null;
    const got = resolveAnim(name, (n) => !!this.strips[view][n]);
    if (!got) return null;
    return { name: got, strip: this.strips[view][got]!, meta: man.animations[got] ?? {} };
  }

  /**
   * Draw `ref` with the feet at screen point (sx, sy). `pxPerM` is the figure's pixels per body metre
   * (the same scale the procedural figure uses), `flip` mirrors it (left-handers).
   * Returns false when nothing could be drawn, so the caller can fall back to the drawn figure.
   */
  draw(ctx: CanvasRenderingContext2D, view: SpriteView, ref: AnimRef, sx: number, sy: number, pxPerM: number, flip: boolean): boolean {
    if (this.state !== 'ready' || !this.manifest) return false;
    const r = this.resolve(view, ref.name);
    if (!r) return false;
    // a one-shot falling back to a looping strip (e.g. a stroke on the ready stance) plays it on the clock
    const playRef: AnimRef = r.name !== ref.name && ref.kind === 'once' && r.meta.contact === undefined ? { name: r.name, kind: 'clock', t: ref.k * 0.25 } : ref;
    const f = pickFrame(r.strip.frames, r.meta, playRef);
    let mirror = flip !== !!ref.flip;
    // directional art (e.g. a side-on run) turns to face where the player is going
    if (r.meta.faces && ref.facing) mirror = ref.facing < 0 === (r.meta.faces === 'right');
    this.drawFrame(ctx, r.strip, f, sx, sy, (FIGURE_HEIGHT_M * pxPerM) / this.manifest.figureHeight, mirror);
    this.drawn++;
    return true;
  }

  /** Draw frame `f` of a strip with its foot anchor at (sx, sy), scaled by k. */
  drawFrame(ctx: CanvasRenderingContext2D, strip: Strip, f: number, sx: number, sy: number, k: number, mirror = false): void {
    const man = this.manifest!;
    const [cw, ch] = man.cell;
    const [ax, ay] = man.anchor;
    ctx.save();
    ctx.translate(sx, sy);
    if (mirror) ctx.scale(-1, 1);
    ctx.scale(k, k);
    ctx.imageSmoothingEnabled = k < 1;
    ctx.drawImage(strip.img, f * cw, 0, cw, ch, -ax, -ay, cw, ch);
    ctx.restore();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('sprite missing: ' + src));
    img.src = src;
  });
}

/** The player sprite set shipped with the game (placeholder art until the real sheets arrive). */
export const playerSprites = new SpriteBank(`${import.meta.env?.BASE_URL ?? './'}sprites/player/`);
