import { BallState, predictFirstBounce } from './ball';
import { Surface } from '../data/surfaces';
import { GRAVITY, HALF_LEN, HALF_W, SERVICE_Y, netHeightAt } from '../data/court';
import { Stats, ShotType, ServeType } from '../data/types';
import { Rng } from '../core/rng';
import { T } from '../data/tuning';
import { errorFatigue, paceFatigue, serveFatigue, serveErrorFatigue, timingFatigue } from './fatigue';
import { STRIKES, StrikeId, ControlMode, ServeForce, prepQ, zoneRadius, dangerClass, centreClass, Zone } from './strike';

/**
 * How a strike came off the racket (M21). PERFECT = well prepared, centred, past the danger zone.
 * RUSHED = pressed too late; RISING = hit in the danger zone; OFFCENTRE = into the body or stretched;
 * SAFE = nothing held; MISHIT = lost control (net or long).
 */
export type Grade = 'PERFECT' | 'GOOD' | 'RUSHED' | 'RISING' | 'OFFCENTRE' | 'SAFE' | 'MISHIT';
export const GRADE_LABEL: Record<Grade, string> = {
  PERFECT: 'PERFECT!', GOOD: 'GOOD', RUSHED: 'RUSHED', RISING: 'RISING BALL', OFFCENTRE: 'OFF-CENTRE', SAFE: 'SAFE', MISHIT: 'MISHIT',
};
/** a strike that came off cleanly enough to count in drills */
export function cleanGrade(g: Grade): boolean {
  return g === 'PERFECT' || g === 'GOOD';
}

export interface ShotInput {
  strike: StrikeId;
  from: BallState;
  dir: 1 | -1;
  /** aim sweep at contact: -aimMax..aimMax screen x (1 = the sideline target) */
  aimX: number;
  /** seconds the strike button was held before contact (0 = safe strike) */
  prep: number;
  mode: ControlMode;
  /** danger zone 0..1 (rising ball), centring 0..1.2 (0 = sweet spot) */
  danger: number;
  centre: number;
  body: boolean;
  stats: Stats;
  stamina: number; // 0..100
  speedRatio: number; // hitter speed / max at contact
  runVx: number; // hitter world vx at contact (lobs on the run follow it)
  stretch: number; // 0..1
  contactZ: number;
  contactY: number; // world y of the contact
  ballVz: number; // ball vertical speed at contact
  inSpeed: number; // incoming ball speed (m/s)
  lateral: number; // |ball.x - player.x|
  fh: boolean;
  twoHanded: boolean;
  volley: boolean;
  overhead: boolean;
  isReturn: boolean;
  badges: string[];
  rng: Rng;
  /** accelerations beyond this point's quota (0 = still a good one) */
  accelOver?: number;
  /** shoulder-height acceleration bonus for the player's style (0..1) */
  shoulderStyle?: number;
  /** risk/reward intent: >1 hits harder with more error, <1 plays safe (COM game plans) */
  power?: number;
  /** 0..1: how fast the hitter was running back towards their own baseline at contact */
  backpedal?: number;
  /** Clutch badge on a big point */
  clutch?: boolean;
}

export interface ShotOutput {
  ball: BallState;
  label: Grade;
  reason: string;
  factor: 'prep' | 'running' | 'stretch' | 'low' | 'jammed' | 'tired' | 'high' | 'backpedal' | 'danger' | 'centre' | 'accel' | 'none';
  pace: number;
  tx: number;
  ty: number;
  /** aiming zone radius used (m) */
  zone: number;
  danger: Zone;
  centreZone: Zone;
}

/** Solve launch velocity so the ball lands at (tx, ty) after ~flightT seconds, clearing the net by margin. */
/** Fine-grained flight sim to ground (no net), returns landing pos + time (seconds, interpolated). */
function flyToGround(b0: BallState): { x: number; y: number; t: number } {
  let x = b0.x, y = b0.y, z = b0.z, vx = b0.vx, vy = b0.vy, vz = b0.vz;
  const h = 1 / 240;
  const mag = b0.spin > 0 ? b0.spin : b0.spin * 0.45;
  for (let i = 1; i < 2400; i++) {
    const sp = Math.hypot(vx, vy, vz);
    const hs = Math.hypot(vx, vy);
    const pz = z;
    vx += (-T.drag * sp * vx + T.sideMagnus * b0.side * hs * 0.1) * h;
    vy += -T.drag * sp * vy * h;
    vz += (-GRAVITY - T.drag * sp * vz - T.magnus * mag * hs) * h;
    x += vx * h;
    y += vy * h;
    z += vz * h;
    if (z <= 0.034 && vz < 0) {
      const k = (pz - 0.034) / Math.max(1e-6, pz - z);
      return { x: x - vx * h * (1 - k), y: y - vy * h * (1 - k), t: (i - 1 + k) * h };
    }
  }
  return { x, y, t: 10 };
}

export function solveShot(from: BallState, tx: number, ty: number, flightT: number, spin: number, side: number, sf: Surface, margin: number): BallState {
  let Tf = flightT;
  let b: BallState = { ...from, spin, side };
  const D0 = Math.hypot(tx - from.x, ty - from.y);
  for (let tries = 0; tries < 12; tries++) {
    let heading = Math.atan2(ty - from.y, tx - from.x);
    let u = D0 / Tf;
    let vz = (GRAVITY * Tf) / 2 - from.z / Tf;
    const evalF = (uu: number, vv: number, hd: number) => {
      const bb: BallState = { ...from, spin, side, vx: Math.cos(hd) * uu, vy: Math.sin(hd) * uu, vz: vv };
      const l = flyToGround(bb);
      const dx = l.x - from.x;
      const dy = l.y - from.y;
      const along = dx * Math.cos(hd) + dy * Math.sin(hd);
      return { along, t: l.t, l };
    };
    for (let outer = 0; outer < 3; outer++) {
      for (let i = 0; i < 8; i++) {
        const f0 = evalF(u, vz, heading);
        const e1 = f0.along - D0;
        const e2 = f0.t - Tf;
        if (Math.abs(e1) < 0.03 && Math.abs(e2) < 0.01) break;
        const fu = evalF(u + 0.05, vz, heading);
        const fv = evalF(u, vz + 0.05, heading);
        const a = (fu.along - f0.along) / 0.05, bq = (fv.along - f0.along) / 0.05;
        const c = (fu.t - f0.t) / 0.05, d = (fv.t - f0.t) / 0.05;
        const det = a * d - bq * c;
        if (Math.abs(det) < 1e-9) break;
        let du = (d * e1 - bq * e2) / det;
        let dv = (-c * e1 + a * e2) / det;
        du = Math.max(-8, Math.min(8, du));
        dv = Math.max(-6, Math.min(6, dv));
        u = Math.max(1, u - du);
        vz -= dv;
      }
      // heading correction for lateral miss (sidespin, drag)
      const fl = evalF(u, vz, heading).l;
      const target = Math.atan2(ty - from.y, tx - from.x);
      const got = Math.atan2(fl.y - from.y, fl.x - from.x);
      let dh = target - got;
      if (dh > Math.PI) dh -= Math.PI * 2;
      if (dh < -Math.PI) dh += Math.PI * 2;
      heading += dh;
      if (Math.abs(dh) < 0.002) break;
    }
    b = { ...from, spin, side, vx: Math.cos(heading) * u, vy: Math.sin(heading) * u, vz };
    // check net clearance if crossing the net
    if ((from.y > 0) !== (ty > 0)) {
      const nz = netCrossZ(b, sf);
      if (!isNaN(nz)) {
        const t0 = Math.abs(from.y) / Math.max(0.1, Math.abs(b.vy));
        const cross = nz - netHeightAt(from.x + b.vx * t0);
        if (cross < margin) {
          Tf *= 1.07;
          continue;
        }
      }
    }
    break;
  }
  return b;
}

function netCrossZ(b0: BallState, sf: Surface): number {
  const b = { ...b0 };
  const h = 1 / 120;
  for (let i = 0; i < 600; i++) {
    const py = b.y;
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const hs = Math.hypot(b.vx, b.vy);
    b.vx += -T.drag * sp * b.vx * h;
    b.vy += -T.drag * sp * b.vy * h;
    b.vz += (-GRAVITY - T.drag * sp * b.vz - T.magnus * (b.spin > 0 ? b.spin : b.spin * 0.45) * hs) * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.z += b.vz * h;
    if ((py > 0) !== (b.y > 0)) return b.z;
    if (b.z < 0) return NaN;
  }
  return NaN;
}

// (M16: groundstrokes ~10% faster so placement beats footspeed; drops land a little deeper)
// (M20: groundstrokes another ~8% faster: a shot every ~1.0 s like the Free Tennis footage)
// (M21: one row per strike of the Elbow strike menu)
const BASE_DEPTH: Record<StrikeId, number> = {
  normal: 8.9, short: 5.4, topspin: 9.2, slice: 8.3, drop: 2.6, lob: 10.3, accel: 9.3, shortAccel: 6.2, attackLob: 9.7, safe: 7.6,
};
const BASE_PACE: Record<StrikeId, number> = {
  normal: 27.3, short: 23.2, topspin: 24.9, slice: 21.1, drop: 9, lob: 13, accel: 33.8, shortAccel: 29.5, attackLob: 17, safe: 19.5,
};
const MARGIN: Record<StrikeId, number> = {
  normal: 0.4, short: 0.45, topspin: 0.8, slice: 0.25, drop: 0.22, lob: 3.4, accel: 0.3, shortAccel: 0.35, attackLob: 1.7, safe: 0.9,
};
const SPIN: Record<StrikeId, number> = {
  normal: 0.3, short: 1.0, topspin: 0, slice: -0.85, drop: 0, lob: 0.45, accel: 0.15, shortAccel: 0.7, attackLob: 1.3, safe: 0.45,
};

/** shoulder height for the acceleration bonus: forehand, two-handed backhand a bit lower, one-handed lower still */
function shoulderK(inp: ShotInput): number {
  if (!STRIKES[inp.strike].accel || inp.volley) return 0;
  const sz = inp.fh ? 1.4 : inp.twoHanded ? 1.25 : 1.15;
  const dz = Math.abs(inp.contactZ - sz);
  if (dz > 0.35 || inp.ballVz > 0.6) return 0;
  return 1 - dz / 0.35;
}

export interface StrikePlan {
  tx: number;
  depth: number;
  zone: number;
  pace: number;
  spin: number;
  margin: number;
  prepQ: number;
  shoulder: number;
  danger: Zone;
  centreZone: Zone;
  /** chance of losing control (into the net or long) */
  lose: number;
  /** dominant cause for the popup */
  factor: ShotOutput['factor'];
}

/**
 * The deterministic part of a strike: where it is aimed, how big the aiming zone is, how hard it
 * goes. The match adds the dice; the HUD preview draws exactly this.
 */
export function planStrike(inp: ShotInput): StrikePlan {
  const S = STRIKES[inp.strike];
  const type = S.shot;
  const stats = inp.stats;
  const f = inp.stamina / 100;
  let stat = inp.fh ? stats.forehand : stats.backhand;
  if (inp.volley) stat = stats.volley;
  if (inp.overhead) stat = (stats.volley + stats.serve) / 2;
  if (type === 'lob' || type === 'drop') stat = (stat + stats.touch * 2) / 3;
  if (inp.isReturn) stat = (stat + stats.ret) / 2;
  const statF = stat / 99;
  const pen = inp.mode === 'arcade' ? 0.5 : 1; // Arcade halves the positioning penalties
  const focus = (0.85 + 0.3 * (stats.mental / 99)) * timingFatigue(f);
  const safe = S.id === 'safe';
  const pq = safe ? 0 : prepQ(inp.prep, inp.mode, focus);
  const dZone = dangerClass(inp.danger);
  const cZone = centreClass(inp.centre);
  const shoulder = shoulderK(inp);
  const over = inp.accelOver ?? 0;
  const power = inp.power ?? 1;

  // ---- aiming zone (m)
  let zone = safe ? T.safeZone * (1.3 - 0.45 * statF) : zoneRadius(inp.prep, inp.mode, statF, focus);
  const runningF = inp.speedRatio > 0.35 ? 1 + 0.9 * (inp.speedRatio - 0.35) * (1.2 - stats.footwork / 120) : 1;
  const stretchF = 1 + inp.stretch * 0.8;
  const lowF = !inp.volley && inp.contactZ < 0.4 ? 1 + (0.4 - inp.contactZ) * 3 : 1;
  const highF = !inp.overhead && inp.contactZ > 1.75 && shoulder < 0.3 ? 1 + (inp.contactZ - 1.75) * 0.8 : 1;
  const tiredF = errorFatigue(f);
  const backF = 1 + (inp.backpedal ?? 0) * T.backpedalErr;
  const dangerF = 1 + Math.max(0, inp.danger - T.dangerOrange) * 1.5 * pen * (1 - 0.6 * shoulder);
  const centreF = 1 + Math.max(0, inp.centre - 0.3) * 0.9 * pen * (inp.volley || S.accel || type === 'drop' ? 1.4 : 1);
  const accelF = (S.accel ? 1.18 : 1) * Math.pow(1.3, over);
  const volleyBadge = inp.volley && inp.badges.includes('netMagnet') ? 0.8 : 1;
  zone *= runningF * stretchF * lowF * highF * tiredF * backF * dangerF * centreF * accelF * volleyBadge * (inp.isReturn ? 1.1 : 1) * (1 + (power - 1) * 1.5);
  if (inp.clutch) zone *= 0.9;
  zone = Math.min(T.zoneMax, zone);

  const factors: [ShotOutput['factor'], number][] = [
    ['running', runningF], ['stretch', stretchF], ['low', lowF], ['high', highF], ['tired', tiredF], ['backpedal', backF],
    ['danger', dangerF], ['centre', centreF], ['accel', over > 0 ? accelF : 1],
  ];
  factors.sort((a, b) => b[1] - a[1]);
  let factor: ShotOutput['factor'] = factors[0][1] > 1.2 ? factors[0][0] : 'none';
  if (!safe && pq < 0.55 && factor === 'none') factor = 'prep';
  if (factor === 'centre' && inp.body) factor = 'jammed';

  // ---- losing control: red danger zone or a ball into the body / at full stretch
  let lose = 0;
  if (dZone === 'red') lose += 0.16 + (inp.danger - T.dangerRed) * 0.9;
  if (cZone === 'red') lose += inp.body ? 0.28 : 0.18;
  lose *= pen * (S.accel ? 1.5 : 1) * (type === 'drop' || inp.volley ? 1.3 : 1) * (1.3 - statF * 0.6) * (safe ? 0.6 : 1) * (1 - 0.6 * shoulder);

  // ---- target
  const outOfPos = Math.max(0, inp.centre - 0.25) + Math.max(0, inp.danger - 0.2) + Math.max(0, inp.speedRatio - 0.5) * 0.8;
  let depth = BASE_DEPTH[S.id];
  const baselineBonus = Math.max(-0.6, Math.min(0.7, (HALF_LEN + 1.5 - Math.abs(inp.contactY)) * 0.22));
  if (S.short) {
    // short strikes: the better prepared, the shorter; out of position they float long
    depth -= (pq - 0.5) * (type === 'drop' ? 0.8 : 1.2);
    depth += outOfPos * 1.6;
  } else if (type === 'lob') {
    depth += (pq - 0.5) * 0.8;
  } else {
    depth += (pq - 0.5) * 1.6 + baselineBonus + (statF - 0.6) * 0.9 - outOfPos * 1.8;
  }
  const touchF = stats.touch / 99;
  if (type === 'drop') depth += Math.max(0, inp.inSpeed - 14) * 0.16 * (1.2 - touchF);
  if (type === 'lob') depth += Math.max(0, inp.inSpeed - 20) * 0.1 * (1.2 - touchF);
  if (inp.volley && type !== 'drop' && type !== 'lob') depth -= 0.8;
  depth = Math.max(1.5, Math.min(11.3, depth));
  const width = S.short ? 3.9 : type === 'drop' || type === 'lob' ? 3.2 : 3.6;
  let tx = inp.aimX * width;
  if (type === 'lob' && inp.speedRatio > 0.6) tx += inp.runVx * 0.5; // a lob on the run follows the run

  // ---- pace
  let pace = BASE_PACE[S.id] * (0.74 + 0.42 * statF);
  if (inp.overhead) pace *= 1.4;
  if (inp.volley && !inp.overhead) pace *= 0.85;
  pace *= paceFatigue(f);
  pace *= inp.speedRatio > 0.5 ? 0.94 : 1;
  pace *= 1 - inp.stretch * 0.25;
  pace *= 1 - (inp.backpedal ?? 0) * 0.25;
  if (inp.contactZ < 0.35 && !inp.volley) pace *= 0.85;
  if (!safe) pace *= 0.94 + 0.08 * pq;
  pace *= 1 - Math.min(1, inp.danger) * 0.22 * pen * (S.accel ? 1.6 : 1) * (1 - 0.6 * shoulder);
  pace *= 1 - Math.min(1, inp.centre) * 0.15 * pen * (S.accel ? 1.5 : 1);
  if (S.accel) {
    // max speed at the top of the bounce; head-high balls are slower; shoulder-height bonus by style
    if (!inp.volley) pace *= 1 - 0.07 * Math.min(1, Math.max(0, Math.abs(inp.ballVz) - 1.2) / 4);
    if (inp.contactZ > 1.85 && shoulder < 0.3) pace *= 1 - Math.min(0.2, (inp.contactZ - 1.85) * 0.15);
    pace *= 1 + 0.07 * (inp.shoulderStyle ?? 0.6) * shoulder * (0.6 + 0.4 * pq);
    pace *= Math.pow(0.93, over);
  }
  if (type !== 'lob' && type !== 'drop') pace *= power;

  let spin = SPIN[S.id];
  if (S.id === 'topspin') spin = 0.75 + 0.55 * (stats.spin / 99);
  if (S.id === 'drop') spin = -T.dropBackspin;
  if (inp.volley && (S.id === 'normal' || S.id === 'safe')) spin = -0.25;
  let margin = MARGIN[S.id];
  if (inp.volley) margin = Math.min(margin, 0.18);
  if (inp.overhead) margin = 0.12;
  if (pq > 0.85 && type !== 'drop' && type !== 'lob') margin *= 0.8; // a prepared drive skims lower
  return { tx, depth, zone, pace, spin, margin, prepQ: pq, shoulder, danger: dZone, centreZone: cZone, lose: Math.min(0.9, lose), factor };
}

/**
 * solveShot, then check the landing with the game's own 60 Hz ball physics and re-aim by the
 * difference (fast serves and drives otherwise land ~0.4 m long).
 */
export function solveLanded(from: BallState, tx: number, ty: number, flightT: number, spin: number, side: number, sf: Surface, margin: number): BallState {
  let ax = tx, ay = ty;
  let out = solveShot(from, ax, ay, flightT, spin, side, sf, margin);
  for (let i = 0; i < 2; i++) {
    const f = predictFirstBounce(out, sf);
    if (f.hitNet) break;
    const ex = f.bx - tx, ey = f.by - ty;
    if (Math.abs(ex) < 0.05 && Math.abs(ey) < 0.05) break;
    ax -= ex;
    ay -= ey;
    out = solveShot(from, ax, ay, flightT, spin, side, sf, margin);
  }
  return out;
}

function gradeFor(inp: ShotInput, pl: StrikePlan, lost: boolean): Grade {
  if (lost) return 'MISHIT';
  if (inp.strike === 'safe') return 'SAFE';
  // the labels only show when it really cost something (red, or well into orange)
  if ((pl.danger === 'red' || inp.danger > T.dangerOrange + 0.12) && pl.shoulder < 0.5) return 'RISING';
  if (pl.centreZone === 'red' || inp.centre > T.centreOrange + 0.12) return 'OFFCENTRE';
  if (pl.prepQ < 0.55) return 'RUSHED';
  // PERFECT: fully prepared, set (not running), met on the green spot
  if (pl.prepQ >= 0.88 && inp.speedRatio < 0.55 && pl.danger === 'green' && pl.centreZone === 'green') return 'PERFECT';
  return 'GOOD';
}

const REASON: Record<ShotOutput['factor'], string> = {
  prep: 'press earlier for accuracy',
  running: 'off-balance: still running',
  stretch: 'stretched: reached too far',
  low: 'too low: ball below the knees',
  high: 'too high: above the shoulder',
  jammed: 'jammed: ball into the body',
  centre: 'off the sweet spot',
  tired: 'tired: aim zone growing',
  backpedal: 'off-balance: backpedalling',
  danger: 'ball still rising',
  accel: 'out of good accelerations',
  none: '',
};

export function makeShot(inp: ShotInput, sf: Surface): ShotOutput {
  const { rng } = inp;
  const S = STRIKES[inp.strike];
  const type = S.shot;
  const pl = planStrike(inp);
  const lost = rng.next() < pl.lose;
  const grade = gradeFor(inp, pl, lost);
  const dir = inp.dir;
  let { tx, depth, pace, spin, margin } = pl;
  let side = 0;
  // landing scatter: the zone holds ~60% of landings (2D normal: r60 = 1.354 sigma)
  const sig = pl.zone / 1.354;
  if (!lost) {
    tx += rng.gauss() * sig;
    depth += rng.gauss() * sig * 0.7;
  } else if (rng.chance(0.45)) {
    // lost control, long
    tx = rng.range(-4.6, 4.6);
    depth = rng.range(12.3, 14.5);
    pace *= 0.85;
    margin = 0.6;
    side = rng.range(-1, 1);
  }
  const ty = dir * Math.min(depth, 15);
  const dist = Math.hypot(tx - inp.from.x, ty - inp.from.y);
  let flightT: number;
  if (S.id === 'lob') flightT = T.lobFlight + 0.3 * (depth / 10);
  else if (S.id === 'attackLob') flightT = T.lobFlight * 0.68 + 0.25 * (depth / 10);
  // drops hang in the air longer the further back they are hit from (easier to chase down)
  else if (type === 'drop') flightT = T.dropFlight + T.dropFlightPerM * Math.max(0, Math.abs(inp.from.y) - 6);
  else flightT = dist / (pace * 0.93);
  const out = lost ? solveShot(inp.from, tx, ty, flightT, spin, side, sf, margin) : solveLanded(inp.from, tx, ty, flightT, spin, side, sf, margin);
  // height scatter: a wide zone also means some balls are struck too flat (into the net)
  if (!lost && type !== 'lob') out.vz += rng.gauss() * sig * 0.3;
  if (lost && Math.abs(depth) < 12) {
    // lost control, into the net: flatten it until it can't clear the tape
    for (let i = 0; i < 24; i++) {
      const nz = netCrossZ(out, sf);
      if (isNaN(nz) || nz < netHeightAt(out.x) - 0.06) break;
      out.vz -= 0.35;
    }
  }
  let reason = REASON[pl.factor];
  if (grade === 'SAFE') reason = 'no button held';
  else if (grade === 'MISHIT') reason = pl.centreZone === 'red' ? (inp.body ? 'into the body: lost it' : 'full stretch: lost it') : 'rising ball: lost it';
  else if (grade === 'PERFECT') reason = S.accel && pl.shoulder > 0.5 ? 'shoulder-height power' : '';
  return { ball: out, label: grade, reason, factor: pl.factor, pace, tx, ty, zone: pl.zone, danger: pl.danger, centreZone: pl.centreZone };
}

// ======================================================================= serve
export interface ServeInput {
  from: BallState;
  dir: 1 | -1;
  serverX: number;
  /** aim sweep -aimMax..aimMax across the box (1 = near its edge) */
  aimX: number;
  type: ServeType;
  force: ServeForce;
  /** seconds the button was held during the toss */
  prep: number;
  stats: Stats;
  stamina: number;
  badges: string[];
  second: boolean;
  rng: Rng;
}

/** chance a serve goes in (Tennis Elbow 4 manual: Strong 70%, Normal 85%, Safe 100% at equal power/consistency) */
export function serveInChance(force: ServeForce, serveStat: number, second: boolean, stamina = 100, badges: string[] = []): number {
  const sF = serveStat / 99;
  let p = force === 'strong' ? 0.6 + 0.14 * sF : force === 'normal' ? 0.79 + 0.08 * sF : 1;
  // second-serve stress
  if (second && force === 'strong') p -= 0.1;
  if (second && force === 'normal') p -= 0.04;
  if (second && badges.includes('clutch')) p += 0.02;
  const tired = serveErrorFatigue(stamina / 100);
  if (force !== 'safe') p = 1 - (1 - p) * tired;
  else p = 1 - 0.03 * (tired - 1);
  return Math.max(0.05, Math.min(1, p));
}

/** max serve speed (km/h) for a serve skill: 102 at 0 up to 204 at 100 (men's table in the manual) */
export function serveTopKmh(serveStat: number): number {
  return 102 + 1.02 * Math.min(100, serveStat);
}

const FORCE_SPEED: Record<ServeForce, number> = { strong: 1, normal: 0.86, safe: 0.72 };
const SPIN_SPEED: Record<ServeType, number> = { flat: 1, slice: 0.93, kick: 0.84 };

export function serveTarget(serverX: number, aimX: number, type: ServeType, force: ServeForce, dir: 1 | -1): { tx: number; ty: number; boxMid: number } {
  const s = Math.sign(serverX) || 1;
  const boxMid = -s * 2.05;
  const tx = boxMid + aimX * 1.6;
  const depth = (force === 'strong' ? 5.85 : force === 'normal' ? 5.55 : 5.0) - (type === 'kick' ? 0.3 : 0);
  return { tx, ty: dir * depth, boxMid };
}

/** serve aiming zone (m) */
export function serveZone(serveStat: number, force: ServeForce, second: boolean, prep: number): number {
  const sF = serveStat / 99;
  let r = 0.22 + 0.4 * (1 - sF);
  r *= force === 'strong' ? 1.2 : force === 'safe' ? 0.8 : 1;
  if (second) r *= force === 'strong' ? 1.25 : force === 'normal' ? 1.2 : 1;
  r *= 1 + Math.max(0, 0.5 - prep) * 0.8; // released early / tapped
  return r;
}

export function makeServe(inp: ServeInput, sf: Surface): { ball: BallState; speed: number; tx: number; ty: number; inPlanned: boolean } {
  const rng = inp.rng;
  const s = Math.sign(inp.serverX) || 1;
  const tgt = serveTarget(inp.serverX, inp.aimX, inp.type, inp.force, inp.dir);
  let tx = tgt.tx;
  let ty = tgt.ty;
  // box (singles width) on the receiver's side
  const lo = s > 0 ? -HALF_W : 0;
  const hi = s > 0 ? 0 : HALF_W;
  const m = 0.07;
  let p = serveInChance(inp.force, inp.stats.serve, inp.second, inp.stamina, inp.badges);
  // over-aiming past the box edge goes out
  const overX = Math.max(0, lo - tx, tx - hi);
  if (overX > 0) p *= Math.max(0, 1 - overX * 3);
  const good = rng.next() < p;
  const sig = serveZone(inp.stats.serve, inp.force, inp.second, inp.prep) / 1.354;
  let net = false;
  if (good) {
    tx = Math.min(hi - m, Math.max(lo + m, tx + rng.gauss() * sig));
    ty = inp.dir * Math.min(SERVICE_Y - m, Math.max(1.6, Math.abs(ty) + rng.gauss() * sig * 0.8));
  } else {
    const r = rng.next();
    if (r < 0.4) net = true;
    else if (r < 0.75 || overX === 0) ty = inp.dir * (SERVICE_Y + rng.range(0.12, 0.8)); // long
    if (!net && (r >= 0.75 || overX > 0)) tx = overX > 0 ? tx + Math.sign(tx - (lo + hi) / 2) * rng.range(0.05, 0.3) : (rng.chance(0.5) ? lo - rng.range(0.08, 0.5) : hi + rng.range(0.08, 0.5)); // wide
  }
  const statF = inp.stats.serve / 99;
  void statF;
  let kmh = serveTopKmh(inp.stats.serve) * FORCE_SPEED[inp.force] * SPIN_SPEED[inp.type];
  if (inp.badges.includes('aceMachine')) kmh *= 1.04;
  kmh *= serveFatigue(inp.stamina / 100) * (1 + rng.range(-0.02, 0.02));
  const speed = kmh / 3.6;
  const spin = inp.type === 'kick' ? 1.15 : inp.type === 'slice' ? -0.2 : 0.15;
  const side = inp.type === 'slice' ? Math.sign(tgt.boxMid) * 1.6 : 0;
  const margin = inp.type === 'kick' ? 0.75 : inp.type === 'slice' ? 0.22 : 0.1;
  const dist = Math.hypot(tx - inp.from.x, ty - inp.from.y);
  const out = net ? solveShot(inp.from, tx, ty, dist / (speed * 0.9), spin, side, sf, 0) : solveLanded(inp.from, tx, ty, dist / (speed * 0.9), spin, side, sf, margin);
  if (net) {
    for (let i = 0; i < 24; i++) {
      const nz = netCrossZ(out, sf);
      if (isNaN(nz) || nz < netHeightAt(out.x) - 0.06) break;
      out.vz -= 0.3;
    }
  }
  const launch = Math.hypot(out.vx, out.vy, out.vz) * 3.6;
  return { ball: out, speed: launch, tx, ty, inPlanned: good };
}

void predictFirstBounce;
void GRAVITY;
