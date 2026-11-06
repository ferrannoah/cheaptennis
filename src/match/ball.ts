import { BALL_R, GRAVITY, netHeightAt, POST_X } from '../data/court';
import { Surface } from '../data/surfaces';
import { T } from '../data/tuning';

export interface BallState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  spin: number; // + topspin, - backspin (relative to travel)
  side: number; // sidespin, + curves toward +x
}

export type BallEvent = 'bounce' | 'netcord' | 'net' | null;

const DT = 1 / 60;
const SUB = 2;

/** Advance a ball state one 60 Hz frame (2 substeps). Returns the most notable event. */
export function stepBall(b: BallState, sf: Surface, stopped: { v: boolean } | null = null, net = true): BallEvent {
  let ev: BallEvent = null;
  const h = DT / SUB;
  for (let s = 0; s < SUB; s++) {
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const hs = Math.hypot(b.vx, b.vy) || 1;
    let ax = -T.drag * sp * b.vx;
    let ay = -T.drag * sp * b.vy;
    let az = -GRAVITY - T.drag * sp * b.vz;
    if (b.z > BALL_R + 0.01) {
      az -= T.magnus * (b.spin > 0 ? b.spin : b.spin * 0.45) * hs;
      // sidespin curves the ball sideways (slice serves)
      ax += T.sideMagnus * b.side * hs * 0.1;
    }
    const py = b.y;
    b.vx += ax * h;
    b.vy += ay * h;
    b.vz += az * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.z += b.vz * h;
    // net crossing
    if (net && (py > 0) !== (b.y > 0) && py !== 0 && Math.abs(b.x) < POST_X + 0.05) {
      const nh = netHeightAt(b.x);
      if (b.z < nh + BALL_R) {
        if (b.z > nh - 0.07) {
          // clips the tape: slows and pops up, continues over
          b.vy *= 0.32;
          b.vx *= 0.6;
          b.vz = Math.abs(b.vz) * 0.3 + 1.1;
          b.z = nh + BALL_R + 0.01;
          b.spin *= 0.3;
          ev = 'netcord';
        } else {
          // into the net: drops on hitter's side
          b.y = py > 0 ? 0.08 : -0.08;
          b.vy = -b.vy * 0.08;
          b.vx *= 0.15;
          b.vz = Math.min(b.vz, 0) * 0.2;
          ev = 'net';
          if (stopped) stopped.v = true;
        }
      }
    }
    // bounce
    if (b.z <= BALL_R && b.vz < 0) {
      b.z = BALL_R;
      bounce(b, sf);
      if (ev !== 'net') ev = 'bounce';
    }
  }
  return ev;
}

export function bounce(b: BallState, sf: Surface): void {
  const e = sf.restitution;
  const f = sf.friction;
  const vzIn = -b.vz;
  let vz = vzIn * e;
  let hmul = f;
  if (b.spin > 0) {
    vz *= 1 + 0.14 * b.spin * sf.topspinKick;
    hmul *= 1 + 0.1 * b.spin * sf.topspinKick;
  } else if (b.spin < 0) {
    const s = -b.spin;
    vz *= Math.max(0.45, 1 - 0.2 * s * sf.sliceSkid);
    hmul *= 1 + 0.05 * Math.min(1, s) * sf.sliceSkid;
    if (s > 1.2) hmul *= Math.max(0.3, 1 - (s - 1.2) * 1.4); // drop shot checks up
  }
  // weak balls roll
  if (vz < 0.4) vz = 0;
  b.vz = vz;
  b.vx *= hmul;
  b.vy *= hmul;
  b.spin *= 0.35;
  b.side *= 0.3;
}

export function cloneBall(b: BallState): BallState {
  return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, spin: b.spin, side: b.side };
}

export interface FlightInfo {
  /** first bounce position + frame */
  bx: number; by: number; bframe: number;
  /** height when crossing the net (or NaN if it doesn't cross) */
  netZ: number;
  hitNet: boolean;
}

/** Simulate to the first bounce (or max frames). */
export function predictFirstBounce(b0: BallState, sf: Surface, maxFrames = 400, net = true): FlightInfo {
  const b = cloneBall(b0);
  let netZ = NaN;
  const stop = { v: false };
  for (let f = 1; f <= maxFrames; f++) {
    const py = b.y;
    const pz = b.z;
    const ev = stepBall(b, sf, stop, net);
    if ((py > 0) !== (b.y > 0) && isNaN(netZ)) netZ = (pz + b.z) / 2;
    if (ev === 'net') return { bx: b.x, by: b.y, bframe: f, netZ, hitNet: true };
    if (ev === 'netcord' && isNaN(netZ)) netZ = netHeightAt(b.x);
    if (ev === 'bounce') return { bx: b.x, by: b.y, bframe: f, netZ, hitNet: false };
  }
  return { bx: b.x, by: b.y, bframe: maxFrames, netZ, hitNet: false };
}
