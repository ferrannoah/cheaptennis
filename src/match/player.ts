import { PlayerSetup, Stats, ShotType, ServeType } from '../data/types';
import { Controller } from '../core/input';
import { T } from '../data/tuning';
import { Surface } from '../data/surfaces';
import { HALF_LEN, RUN_X, RUN_Y } from '../data/court';
import { Grade } from './shots';

export type AnimState = 'idle' | 'run' | 'swing' | 'serve' | 'dive' | 'celebrate' | 'slump' | 'walk';

export interface Swing {
  type: ShotType;
  start: number; // frame pressed
  contactAt: number; // frame of contact
  grade: Grade | null;
  offset: number;
  whiff: boolean;
  whiffReason: string;
  done: boolean;
  fh: boolean;
  kind: 'ground' | 'volley' | 'overhead' | 'dive';
  reach: number; // lateral offset at contact for pose
}

export interface ServeState {
  phase: 'ready' | 'toss' | 'hit';
  t: number; // frames in phase
  tossApex: number; // frame of apex relative to toss start
  type: ServeType;
}

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  stamina = 100;
  swing: Swing | null = null;
  recover = 0;
  anim: AnimState = 'idle';
  animT = 0;
  runPhase = 0;
  serve: ServeState = { phase: 'ready', t: 0, tossApex: 34, type: 'flat' };
  /** whether the last swing press was buffered */
  bufferedShot: ShotType | null = null;
  /** AI risk/reward intent for the pending swing (humans: 1) */
  swingPower = 1;
  aiAim = { x: 0, d: 0 };
  bufferT = 0;
  facingFh = true;
  sweat = 0;
  /** timing meter for HUD */
  meterA = -1; // predicted frames to arrival (or -1)
  meterMark: number | null = null; // offset of last press
  meterShow = 0;
  /** match stats */
  perfects = 0;
  aces = 0;
  doubleFaults = 0;
  winners = 0;
  errors = 0;
  shots = 0;
  longRallyWins = 0;
  autoWalk: { x: number; y: number } | null = null;
  splitStep = 0;
  celebrate = 0;
  stepAcc = 0;
  slideT = 0;

  constructor(
    public idx: 0 | 1,
    public setup: PlayerSetup,
    public stats: Stats,
    public ctrl: Controller | null,
  ) {
    this.stamina = setup.startStamina;
  }

  /** near player (idx side 0) plays at y<0 and hits toward +y */
  side: 0 | 1 = 0;
  get dir(): 1 | -1 {
    return this.side === 0 ? 1 : -1;
  }
  get human(): boolean {
    return this.ctrl !== null;
  }

  staminaF(): number {
    return this.stamina / 100;
  }

  /** multiplier on movement from stamina */
  speedMul(): number {
    const f = this.staminaF();
    return f < T.lowStamina / 100 ? 0.8 + 0.5 * f : 1;
  }

  /** multiplier on timing windows */
  windowMul(): number {
    const f = this.staminaF();
    let w = 0.82 + 0.36 * (this.stats.mental / 99);
    if (f < T.lowStamina / 100) w *= 0.55 + f * 1.1;
    return w;
  }

  maxSpeed(sf: Surface): number {
    let s = (T.baseSpeed + T.footworkSpeedBonus * (this.stats.footwork / 99)) * this.speedMul() * sf.footSpeed;
    if (sf.id === 'clay' && this.setup.badges.includes('dirtballer')) s *= 1.04;
    return s;
  }

  accel(sf: Surface): number {
    let g = sf.grip;
    if (sf.id === 'clay' && this.setup.badges.includes('dirtballer')) g = 1;
    return T.accel * g * (0.85 + 0.3 * (this.stats.footwork / 99)) * this.speedMul();
  }

  /**
   * Seconds to run to (tx, ty) from the current position and velocity, accounting for
   * acceleration, braking when running the wrong way, and slower backpedalling.
   */
  timeTo(tx: number, ty: number, sf: Surface): number {
    const dx = tx - this.x;
    const dy = ty - this.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-3) return 0;
    const ux = dx / d;
    const uy = dy / d;
    const a = this.accel(sf);
    let vmax = this.maxSpeed(sf);
    if (uy * this.dir < 0) vmax *= Math.hypot(ux, uy * T.backpedalMul);
    let v0 = this.vx * ux + this.vy * uy;
    let t = 0;
    if (v0 < 0) {
      // wrong-footed: first stop
      t += -v0 / a;
      d += (v0 * v0) / (2 * a);
      v0 = 0;
    }
    v0 = Math.min(v0, vmax);
    const da = (vmax * vmax - v0 * v0) / (2 * a);
    if (d <= da) return t + (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a;
    return t + (vmax - v0) / a + (d - da) / vmax;
  }

  speedRatio(sf: Surface): number {
    return Math.hypot(this.vx, this.vy) / this.maxSpeed(sf);
  }

  drain(amount: number): void {
    let k = 1.35 - this.stats.endurance / 99 * 0.7;
    if (this.setup.badges.includes('ironLungs')) k *= 0.85;
    this.stamina = Math.max(0, this.stamina - amount * k);
  }

  recoverStamina(amount: number): void {
    this.stamina = Math.min(100, this.stamina + amount * (0.8 + 0.4 * this.stats.endurance / 99));
  }

  /** move toward desired velocity (mx,my in -1..1, screen space: my=-1 is up = +y) */
  move(mx: number, my: number, sf: Surface, slowed: boolean): void {
    const max = this.maxSpeed(sf) * (slowed ? T.swingMoveMult : 1);
    const tvx = mx * max;
    let tvy = -my * max;
    // running back towards your own baseline (e.g. chasing a lob) is slower
    if (tvy * this.dir < 0) tvy *= T.backpedalMul;
    const a = this.accel(sf) / 60;
    const d = (T.decel * sf.grip) / 60;
    const ax = tvx - this.vx;
    const ay = tvy - this.vy;
    const stopping = Math.abs(tvx) < 0.01 && Math.abs(tvy) < 0.01;
    const lim = stopping ? d : a;
    const m = Math.hypot(ax, ay);
    if (m > lim) {
      this.vx += (ax / m) * lim;
      this.vy += (ay / m) * lim;
    } else {
      this.vx = tvx;
      this.vy = tvy;
    }
    this.x += this.vx / 60;
    this.y += this.vy / 60;
    this.clamp();
    const sp = Math.hypot(this.vx, this.vy);
    this.drain((T.runDrain * sp) / Math.max(1, max));
    if (sp > 0.6) {
      this.runPhase += sp * 0.045;
      this.stepAcc += sp / 60;
    }
  }

  clamp(): void {
    this.x = Math.max(-RUN_X + 0.4, Math.min(RUN_X - 0.4, this.x));
    if (this.side === 0) this.y = Math.max(-RUN_Y + 0.8, Math.min(-0.55, this.y));
    else this.y = Math.max(0.55, Math.min(RUN_Y - 0.8, this.y));
  }

  /** forehand side check: is world x on this player's forehand side? */
  isForehand(bx: number): boolean {
    const rightIsPlusX = this.side === 0; // near player faces +y: right = +x
    let fh = rightIsPlusX ? bx >= this.x : bx <= this.x;
    if (this.setup.hand === 'L') fh = !fh;
    return fh;
  }

  baselineY(): number {
    return this.side === 0 ? -HALF_LEN : HALF_LEN;
  }
}
