import { BallState, predictFirstBounce } from './ball';
import { Surface } from '../data/surfaces';
import { GRAVITY, HALF_W, netHeightAt } from '../data/court';
import { Stats, ShotType, ServeType } from '../data/types';
import { Rng } from '../core/rng';
import { T } from '../data/tuning';
import { errorFatigue, paceFatigue, serveFatigue, serveErrorFatigue } from './fatigue';

export type Grade = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'MISHIT';

export interface ShotInput {
  type: ShotType;
  from: BallState;
  dir: 1 | -1;
  aimX: number; // -1..1 screen x
  aimDepth: number; // -1 short .. +1 deep
  grade: Grade;
  offset: number; // frames (+early, -late)
  stats: Stats;
  stamina: number; // 0..100
  speedRatio: number; // hitter speed / max at contact
  stretch: number; // 0..1
  contactZ: number;
  lateral: number; // |ball.x - player.x|
  sideSign: number; // sign(ball.x - player.x)
  fh: boolean;
  volley: boolean;
  overhead: boolean;
  isReturn: boolean;
  badges: string[];
  rng: Rng;
  /** risk/reward intent: >1 hits harder with more error, <1 plays safe (AI game plans) */
  power?: number;
  /** 0..1: how fast the hitter was running back towards their own baseline at contact */
  backpedal?: number;
}

export interface ShotOutput {
  ball: BallState;
  label: Grade;
  reason: string;
  factor: 'timing' | 'running' | 'stretch' | 'low' | 'jammed' | 'tired' | 'high' | 'backpedal';
  pace: number;
  tx: number;
  ty: number;
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
const BASE_DEPTH: Record<ShotType, number> = { normal: 9.0, topspin: 9.3, slice: 8.4, lob: 10.6, drop: 2.8 };
const BASE_PACE: Record<ShotType, number> = { normal: 25.3, topspin: 23.1, slice: 19.5, lob: 13, drop: 9 };
const MARGIN: Record<ShotType, number> = { normal: 0.4, topspin: 0.8, slice: 0.25, lob: 3.4, drop: 0.22 };
const BASE_ERR: Record<ShotType, number> = { normal: 0.038, topspin: 0.034, slice: 0.032, lob: 0.04, drop: 0.045 };

export function gradeReason(g: Grade, offset: number): string {
  switch (g) {
    case 'PERFECT': return '+power +accuracy';
    case 'GOOD': return 'clean contact';
    case 'EARLY': return 'rushed, floated long';
    case 'LATE': return 'ball pulled wide';
    case 'MISHIT': return offset > 0 ? 'way too early: framed it' : 'way too late: framed it';
  }
}

export function makeShot(inp: ShotInput, sf: Surface): ShotOutput {
  const { stats, rng } = inp;
  const type = inp.type;
  const f = inp.stamina / 100;
  // ---- relevant stat
  let stat = inp.fh ? stats.forehand : stats.backhand;
  if (inp.volley) stat = stats.volley;
  if (inp.overhead) stat = (stats.volley + stats.serve) / 2;
  if (type === 'lob' || type === 'drop') stat = (stat + stats.touch * 2) / 3;
  if (inp.isReturn) stat = (stat + stats.ret) / 2;
  const statF = stat / 99;

  // ---- error factors (multipliers)
  const timingF = { PERFECT: 0.35, GOOD: 1, EARLY: 1.45, LATE: 1.45, MISHIT: 3 }[inp.grade];
  const runningF = inp.speedRatio > 0.35 ? 1 + 0.9 * (inp.speedRatio - 0.35) * (1.2 - stats.footwork / 120) : 1;
  const stretchF = 1 + inp.stretch * 1.3;
  const lowF = !inp.volley && inp.contactZ < 0.4 ? 1 + (0.4 - inp.contactZ) * 3 : 1;
  const highF = !inp.overhead && inp.contactZ > 1.75 ? 1 + (inp.contactZ - 1.75) * 0.8 : 1;
  const jamF = inp.lateral < 0.25 ? 1.35 : 1;
  const tiredF = errorFatigue(f);
  const volleyBadge = inp.volley && inp.badges.includes('netMagnet') ? 0.8 : 1;
  const power = inp.power ?? 1;
  const backF = 1 + (inp.backpedal ?? 0) * T.backpedalErr;
  const errMul = timingF * runningF * stretchF * lowF * highF * jamF * tiredF * backF * (1.55 - statF * 0.95) * volleyBadge * (1 + (power - 1) * 2.5);

  // pick the dominant non-timing factor for the popup
  const factors: [ShotOutput['factor'], number][] = [
    ['running', runningF], ['stretch', stretchF], ['low', lowF], ['jammed', jamF], ['tired', tiredF], ['high', highF], ['backpedal', backF],
  ];
  factors.sort((a, b) => b[1] - a[1]);
  let factor: ShotOutput['factor'] = 'timing';
  let reason = gradeReason(inp.grade, inp.offset);
  if (inp.grade !== 'PERFECT' && inp.grade !== 'MISHIT' && factors[0][1] > 1.22) {
    factor = factors[0][0];
    reason = {
      running: 'Off-balance: you were still running',
      stretch: 'Stretched: reached too far',
      low: 'Too low: ball dropped below the knees',
      jammed: 'Jammed: ball too close',
      tired: 'Tired: timing window shrinking',
      high: 'Too high: ball above the shoulder',
      backpedal: 'Off-balance: backpedalling',
      timing: reason,
    }[factors[0][0]];
  }

  // ---- target
  const dir = inp.dir;
  let depth = BASE_DEPTH[type];
  if (type === 'drop') depth += inp.aimDepth * 0.6;
  else depth += inp.aimDepth > 0 ? inp.aimDepth * 1.5 : inp.aimDepth * 3.3;
  if (inp.volley && type !== 'drop' && type !== 'lob') depth -= 0.8;
  let tx: number;
  const width = type === 'drop' || type === 'lob' ? 3.0 : 3.45;
  if (Math.abs(inp.aimX) > 0.1) tx = inp.aimX * width;
  else tx = -inp.from.x * 0.25 + rng.range(-0.7, 0.7);

  // ---- pace
  let pace = BASE_PACE[type] * (0.74 + 0.42 * statF);
  if (inp.overhead) pace *= 1.4;
  if (inp.volley && !inp.overhead) pace *= 0.85;
  pace *= { PERFECT: 1.17, GOOD: 1, EARLY: 0.93, LATE: 0.93, MISHIT: 0.5 }[inp.grade];
  pace *= paceFatigue(f);
  pace *= inp.speedRatio > 0.5 ? 0.94 : 1;
  pace *= 1 - inp.stretch * 0.25;
  pace *= 1 - (inp.backpedal ?? 0) * 0.25;
  if (inp.contactZ < 0.35 && !inp.volley) pace *= 0.85;
  if (type !== 'lob' && type !== 'drop') pace *= power;

  let spin = { normal: 0.3, topspin: 0.75 + 0.55 * (stats.spin / 99), slice: -0.85, lob: 0.45, drop: -T.dropBackspin }[type];
  if (inp.volley && type === 'normal') spin = -0.25;
  let side = 0;
  let margin = MARGIN[type];
  if (inp.volley) margin = Math.min(margin, 0.18);
  if (inp.overhead) margin = 0.12;

  // ---- grade biases
  let floatK = 1;
  if (inp.grade === 'PERFECT' && type !== 'drop' && type !== 'lob') {
    // clean contact: a flatter, deeper drive that skims lower over the net
    depth += 0.7;
    margin *= 0.75;
  } else if (inp.grade === 'EARLY') {
    const e = Math.min(1, Math.max(0, (inp.offset - T.goodWin) / (T.earlyMax - T.goodWin)));
    depth += 0.9 + 2.2 * e;
    floatK = 1.12 + 0.12 * e;
  } else if (inp.grade === 'LATE') {
    const l = Math.min(1, Math.max(0, (-inp.offset - T.goodWin) / (T.lateMax - T.goodWin)));
    tx += inp.sideSign * (1.3 + 2.2 * l);
  } else if (inp.grade === 'MISHIT') {
    tx = rng.range(-5, 5);
    depth = rng.range(2.5, 13);
    spin = rng.range(-1, 1);
    side = rng.range(-1.2, 1.2);
    margin = rng.range(-0.3, 0.5);
  }
  depth = Math.min(depth, 13.5);
  const ty = dir * depth;

  // ---- flight time
  const dist = Math.hypot(tx - inp.from.x, ty - inp.from.y);
  let flightT: number;
  if (type === 'lob') flightT = T.lobFlight + 0.3 * (depth / 10) + (inp.grade === 'MISHIT' ? -0.5 : 0);
  // drops hang in the air longer the further back they are hit from (easier to chase down)
  else if (type === 'drop') flightT = T.dropFlight + T.dropFlightPerM * Math.max(0, Math.abs(inp.from.y) - 6) + (inp.grade === 'EARLY' ? 0.2 : 0);
  else flightT = dist / (pace * 0.93);
  flightT *= floatK;

  const out = solveShot(inp.from, tx, ty, flightT, spin, side, sf, margin);

  // ---- apply error cone
  const sigA = BASE_ERR[type] * errMul * 0.9;
  const sigD = 0.035 * errMul;
  const ang = rng.gauss() * sigA;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const vx = out.vx * ca - out.vy * sa;
  const vy = out.vx * sa + out.vy * ca;
  const dk = 1 + rng.gauss() * sigD;
  out.vx = vx * dk;
  out.vy = vy * dk;
  out.vz *= 1 + rng.gauss() * sigD * 0.6;
  if (inp.grade === 'MISHIT') {
    out.vz += rng.range(-0.5, 1.5);
  }
  return { ball: out, label: inp.grade, reason, factor, pace, tx, ty };
}

export interface ServeInput {
  from: BallState;
  dir: 1 | -1;
  serverX: number;
  aimX: number;
  type: ServeType;
  quality: 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE';
  tossOffset: number;
  stats: Stats;
  stamina: number;
  badges: string[];
  second: boolean;
  rng: Rng;
}

export function makeServe(inp: ServeInput, sf: Surface): { ball: BallState; speed: number; tx: number; ty: number } {
  const s = Math.sign(inp.serverX) || 1;
  const boxMid = -s * 2.05;
  let tx = boxMid + inp.aimX * 1.45;
  const lo = s > 0 ? -HALF_W + 0.38 : 0.35;
  const hi = s > 0 ? -0.35 : HALF_W - 0.38;
  tx = Math.min(hi, Math.max(lo, tx));
  const ty = inp.dir * (inp.type === 'kick' ? 5.3 : 5.75);
  const statF = inp.stats.serve / 99;
  const f = inp.stamina / 100;
  let speed = { flat: T.flatServeSpeed, kick: T.kickServeSpeed, slice: T.sliceServeSpeed }[inp.type] * (0.68 + 0.38 * statF);
  if (inp.badges.includes('aceMachine')) speed *= 1.04;
  speed *= serveFatigue(f);
  const qf = { PERFECT: 1.05, GOOD: 0.97, EARLY: 0.86, LATE: 0.86 }[inp.quality];
  speed *= qf;
  const spin = inp.type === 'kick' ? 1.15 : inp.type === 'slice' ? -0.2 : 0.15;
  const side = inp.type === 'slice' ? Math.sign(tx) * 1.6 : 0;
  const margin = inp.type === 'kick' ? 0.75 : inp.type === 'slice' ? 0.22 : 0.1;
  const dist = Math.hypot(tx - inp.from.x, ty - inp.from.y);
  const out = solveShot(inp.from, tx, ty, dist / (speed * 0.9), spin, side, sf, margin);
  // errors
  const qErr = { PERFECT: 0.45, GOOD: 1, EARLY: 1.9, LATE: 1.9 }[inp.quality] * (1 + Math.max(0, Math.abs(inp.tossOffset) - 9) * 0.06);
  const tired = serveErrorFatigue(f);
  const typeErr = inp.type === 'flat' ? 1.5 : inp.type === 'kick' ? 1.0 : 1.2;
  const err = qErr * tired * typeErr * (1.5 - statF * 0.9);
  const ang = inp.rng.gauss() * 0.017 * err;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const vx = out.vx * ca - out.vy * sa;
  const vy = out.vx * sa + out.vy * ca;
  out.vx = vx;
  out.vy = vy;
  out.vz += inp.rng.gauss() * 0.19 * err;
  const kmh = Math.hypot(out.vx, out.vy, out.vz) * 3.6;
  return { ball: out, speed: kmh, tx, ty };
}
