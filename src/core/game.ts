import { input } from './input';

export const W = 640;
export const H = 480;
export const DT = 1 / 60;

export interface Scene {
  name: string;
  enter?(): void;
  exit?(): void;
  /** called when this scene becomes top again after a pop */
  resume?(): void;
  update(): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /** compact JSON for test hooks */
  debugState?(): Record<string, unknown>;
  /** scenes below an overlay still draw */
  overlay?: boolean;
}

type Trans = { phase: 'out' | 'in'; t: number; dur: number; action: () => void } | null;

export class Game {
  stack: Scene[] = [];
  frame = 0;
  private trans: Trans = null;
  realtime = true;
  private acc = 0;
  private last = 0;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale = 1;
  /** device pixels per logical pixel; layers are pre-rendered at this resolution */
  res = 1;
  private offX = 0;
  private offY = 0;
  fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  onResize: (() => void)[] = [];
  paused = false; // tab hidden
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  /** pin the picture to the top of the window (portrait phones: touch controls go underneath) */
  alignTop = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      this.last = performance.now();
      this.acc = 0;
    });
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    this.canvas.style.width = ww + 'px';
    this.canvas.style.height = wh + 'px';
    this.canvas.width = Math.round(ww * dpr);
    this.canvas.height = Math.round(wh * dpr);
    this.scale = Math.min(ww / W, wh / H);
    const newRes = Math.min(3, Math.max(1, Math.ceil(this.scale * dpr * 2) / 2));
    this.offX = Math.round((this.canvas.width - W * this.scale * dpr) / 2);
    this.offY = this.alignTop ? 0 : Math.round((this.canvas.height - H * this.scale * dpr) / 2);
    const changed = newRes !== this.res;
    this.res = newRes;
    if (changed) for (const f of this.onResize) f();
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Replace the whole stack with a scene, with a fade transition. */
  goto(scene: Scene, fade = 0.22): void {
    const action = () => {
      for (let i = this.stack.length - 1; i >= 0; i--) this.stack[i].exit?.();
      this.stack = [scene];
      scene.enter?.();
    };
    if (fade <= 0 || this.stack.length === 0) {
      action();
      return;
    }
    this.trans = { phase: 'out', t: 0, dur: fade, action };
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.exit?.();
    this.top?.resume?.();
  }

  get transitioning(): boolean {
    return this.trans !== null;
  }

  preStep: (() => void)[] = [];

  step(): void {
    input.beginFrame();
    for (const f of this.preStep) f();
    this.frame++;
    if (this.trans) {
      this.trans.t += DT;
      if (this.trans.t >= this.trans.dur) {
        if (this.trans.phase === 'out') {
          this.trans.action();
          this.trans = { phase: 'in', t: 0, dur: this.trans.dur, action: () => {} };
        } else this.trans = null;
      }
      if (this.trans && this.trans.phase === 'out') return; // freeze while fading out
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - DT * 30);
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shakeY = (Math.random() - 0.5) * this.shake;
    } else {
      this.shakeX = this.shakeY = 0;
    }
    this.top?.update();
  }

  draw(): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale * dpr;
    ctx.setTransform(s, 0, 0, s, this.offX, this.offY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    // draw from the lowest non-overlay scene up
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].overlay) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) this.stack[i].draw(ctx);
    if (this.trans) {
      const k = this.trans.phase === 'out' ? this.trans.t / this.trans.dur : 1 - this.trans.t / this.trans.dur;
      ctx.fillStyle = `rgba(8,14,28,${Math.min(1, Math.max(0, k))})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.fpsAcc += dt;
      this.fpsFrames++;
      if (this.fpsAcc >= 0.5) {
        this.fps = this.fpsFrames / this.fpsAcc;
        this.fpsAcc = 0;
        this.fpsFrames = 0;
      }
      if (!this.realtime) return;
      if (this.paused) {
        this.draw();
        return;
      }
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 8) {
        this.step();
        this.acc -= DT;
        n++;
      }
      if (n >= 8) this.acc = 0;
      this.draw();
    };
    requestAnimationFrame(loop);
  }

  /** test hook: run exactly n fixed updates then draw */
  advance(n: number): void {
    for (let i = 0; i < n; i++) this.step();
    this.draw();
  }
}

export let game: Game;
export function setGame(g: Game): void {
  game = g;
}
