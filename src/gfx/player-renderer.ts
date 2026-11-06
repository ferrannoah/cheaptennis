import { Camera } from './camera';
import { Kit } from '../data/types';

/** Joint positions in body space (metres, x = player's right as seen on screen for a near player, y up). */
export interface Pose {
  head: [number, number];
  neck: [number, number];
  sL: [number, number]; sR: [number, number];
  eL: [number, number]; eR: [number, number];
  hL: [number, number]; hR: [number, number];
  hip: [number, number];
  kL: [number, number]; kR: [number, number];
  fL: [number, number]; fR: [number, number];
  racket: number; // angle of racket from right hand (0 = up, +clockwise)
  lean: number;
  /**
   * depth of the racket arm / off arm relative to the body: < 0 in front of the chest, > 0 behind
   * the back. Decides whether they are drawn behind or over the torso and head.
   */
  rDepth: number;
  oDepth: number;
}

type P2 = [number, number];
const P = (x: number, y: number): P2 => [x, y];

function base(): Pose {
  return {
    head: P(0, 1.68), neck: P(0, 1.5),
    sL: P(-0.21, 1.45), sR: P(0.21, 1.45),
    eL: P(-0.22, 1.18), eR: P(0.24, 1.18),
    hL: P(-0.06, 1.02), hR: P(0.06, 1.0),
    hip: P(0, 0.95),
    kL: P(-0.15, 0.5), kR: P(0.15, 0.5),
    fL: P(-0.2, 0.02), fR: P(0.2, 0.02),
    racket: -0.35, lean: 0,
    rDepth: -1, oDepth: -1,
  };
}

function pose(o: Partial<Pose>): Pose {
  return { ...base(), ...o };
}

export const POSES = {
  ready: pose({ kL: P(-0.18, 0.47), kR: P(0.18, 0.47), hip: P(0, 0.9), fL: P(-0.27, 0.02), fR: P(0.27, 0.02), head: P(0, 1.62), neck: P(0, 1.45), sL: P(-0.21, 1.4), sR: P(0.21, 1.4), eL: P(-0.2, 1.12), eR: P(0.22, 1.12), hL: P(-0.02, 0.95), hR: P(0.07, 0.93), racket: -0.85 }),
  runA: pose({ kL: P(-0.1, 0.58), kR: P(0.2, 0.42), fL: P(-0.16, 0.2), fR: P(0.24, 0.02), eL: P(-0.27, 1.22), hL: P(-0.18, 1.08), eR: P(0.25, 1.15), hR: P(0.2, 0.98), racket: 0.6, lean: 0.06 }),
  runB: pose({ kL: P(-0.2, 0.42), kR: P(0.1, 0.58), fL: P(-0.24, 0.02), fR: P(0.16, 0.2), eL: P(-0.22, 1.15), hL: P(-0.12, 1.0), eR: P(0.3, 1.24), hR: P(0.28, 1.08), racket: 0.9, lean: 0.06 }),
  // ---- forehand (M18): unit turn with the off arm pointing at the ball, racket drop, low-to-high, wrap over the opposite shoulder
  fhBack: pose({ hip: P(0.04, 0.88), kL: P(-0.14, 0.46), kR: P(0.22, 0.45), fL: P(-0.24, 0.02), fR: P(0.32, 0.02), sL: P(-0.08, 1.42), sR: P(0.26, 1.4), eL: P(0.14, 1.34), hL: P(0.38, 1.32), eR: P(0.46, 1.3), hR: P(0.62, 1.32), racket: 2.5, lean: 0.07 }),
  fhContact: pose({ hip: P(0.02, 0.88), kL: P(-0.18, 0.46), kR: P(0.2, 0.46), fL: P(-0.27, 0.02), fR: P(0.3, 0.02), sL: P(-0.2, 1.43), sR: P(0.22, 1.42), eL: P(-0.12, 1.28), hL: P(0.04, 1.2), eR: P(0.4, 1.08), hR: P(0.6, 0.98), racket: 1.6, lean: 0.0 }),
  fhFollow: pose({ hip: P(-0.03, 0.92), sL: P(-0.25, 1.44), sR: P(0.12, 1.47), eL: P(-0.36, 1.22), hL: P(-0.3, 1.08), eR: P(-0.06, 1.48), hR: P(-0.32, 1.66), racket: -2.6, lean: -0.08 }),
  // ---- two-handed backhand: both hands on the grip the whole swing, shoulders turned the other way
  bhBack: pose({ hip: P(-0.04, 0.88), kL: P(-0.22, 0.45), kR: P(0.14, 0.46), fL: P(-0.32, 0.02), fR: P(0.24, 0.02), sL: P(-0.26, 1.4), sR: P(0.06, 1.43), eL: P(-0.4, 1.2), hL: P(-0.5, 1.16), eR: P(-0.2, 1.18), hR: P(-0.56, 1.12), racket: -2.3, lean: -0.07 }),
  bhContact: pose({ hip: P(-0.02, 0.88), sL: P(-0.22, 1.42), sR: P(0.18, 1.43), eL: P(-0.34, 1.12), hL: P(-0.5, 1.02), eR: P(-0.1, 1.1), hR: P(-0.54, 0.98), racket: -1.6, lean: 0.0 }),
  bhFollow: pose({ hip: P(0.03, 0.92), sL: P(-0.14, 1.46), sR: P(0.25, 1.44), eL: P(0.06, 1.42), hL: P(0.28, 1.62), eR: P(0.28, 1.36), hR: P(0.33, 1.6), racket: 2.6, lean: 0.08 }),
  // ---- one-handed backhand: off hand helps the take-back, then the off arm goes back for balance
  bh1Back: pose({ hip: P(-0.04, 0.88), kL: P(-0.22, 0.45), kR: P(0.14, 0.46), fL: P(-0.32, 0.02), fR: P(0.24, 0.02), sL: P(-0.26, 1.4), sR: P(0.06, 1.43), eL: P(-0.36, 1.26), hL: P(-0.46, 1.3), eR: P(-0.22, 1.24), hR: P(-0.5, 1.26), racket: -2.4, lean: -0.07 }),
  bh1Contact: pose({ hip: P(-0.02, 0.88), sL: P(-0.22, 1.42), sR: P(0.16, 1.43), eL: P(-0.4, 1.3), hL: P(-0.58, 1.26), eR: P(-0.12, 1.14), hR: P(-0.44, 1.0), racket: -1.55, lean: 0.0 }),
  bh1Follow: pose({ hip: P(0.02, 0.92), sL: P(-0.2, 1.44), sR: P(0.22, 1.45), eL: P(-0.46, 1.34), hL: P(-0.7, 1.28), eR: P(0.34, 1.4), hR: P(0.52, 1.56), racket: 0.9, lean: 0.06 }),
  // ---- slice (both wings use a one-handed slice): high take-back, high-to-low, forward finish
  fhSliceBack: pose({ hip: P(0.03, 0.9), sL: P(-0.12, 1.43), sR: P(0.25, 1.42), eL: P(0.06, 1.3), hL: P(0.28, 1.3), eR: P(0.44, 1.42), hR: P(0.5, 1.58), racket: 0.9, lean: 0.05 }),
  fhSliceContact: pose({ eL: P(-0.12, 1.26), hL: P(0.0, 1.16), eR: P(0.42, 1.18), hR: P(0.58, 1.02), racket: 1.85, lean: 0.0 }),
  fhSliceFollow: pose({ eL: P(-0.3, 1.22), hL: P(-0.4, 1.06), eR: P(0.22, 1.12), hR: P(0.14, 0.92), racket: 2.6, lean: -0.03 }),
  bhSliceBack: pose({ hip: P(-0.03, 0.9), sL: P(-0.25, 1.42), sR: P(0.1, 1.43), eL: P(-0.36, 1.32), hL: P(-0.42, 1.5), eR: P(-0.2, 1.36), hR: P(-0.46, 1.56), racket: -0.8, lean: -0.05 }),
  bhSliceContact: pose({ eL: P(-0.32, 1.22), hL: P(-0.4, 1.12), eR: P(-0.16, 1.16), hR: P(-0.5, 1.02), racket: -1.9, lean: 0.0 }),
  bhSliceFollow: pose({ eL: P(-0.44, 1.26), hL: P(-0.66, 1.2), eR: P(0.08, 1.1), hR: P(0.12, 0.94), racket: -2.7, lean: 0.03 }),
  // ---- lob: open face, finish straight up
  lobFollow: pose({ hip: P(0, 0.92), eL: P(-0.3, 1.2), hL: P(-0.3, 1.04), eR: P(0.28, 1.5), hR: P(0.24, 1.86), racket: 0.15, lean: -0.05 }),
  srvToss: pose({ eL: P(-0.22, 1.6), hL: P(-0.15, 2.0), eR: P(0.35, 1.2), hR: P(0.42, 1.0), racket: 2.6, kL: P(-0.14, 0.5), kR: P(0.16, 0.5) }),
  srvTrophy: pose({ hip: P(0, 0.88), kL: P(-0.17, 0.45), kR: P(0.17, 0.45), eL: P(-0.2, 1.75), hL: P(-0.12, 2.05), eR: P(0.38, 1.55), hR: P(0.26, 1.72), racket: 3.0, lean: -0.08 }),
  srvContact: pose({ hip: P(0, 1.0), kL: P(-0.12, 0.56), kR: P(0.14, 0.55), fL: P(-0.14, 0.08), fR: P(0.16, 0.04), head: P(0, 1.74), neck: P(0, 1.56), sL: P(-0.2, 1.5), sR: P(0.2, 1.52), eL: P(-0.25, 1.25), hL: P(-0.12, 1.1), eR: P(0.22, 1.9), hR: P(0.18, 2.22), racket: 0.1, lean: 0.04 }),
  srvFollow: pose({ eL: P(-0.25, 1.15), hL: P(-0.1, 1.0), eR: P(0.0, 1.2), hR: P(-0.25, 0.95), racket: -2.6, lean: 0.12, kL: P(-0.18, 0.5), kR: P(0.1, 0.48) }),
  volley: pose({ hip: P(0, 0.86), kL: P(-0.2, 0.45), kR: P(0.2, 0.44), fL: P(-0.3, 0.02), fR: P(0.3, 0.02), eR: P(0.35, 1.25), hR: P(0.48, 1.3), racket: 0.5, hL: P(0.1, 1.15), eL: P(-0.1, 1.2) }),
  dive: pose({ hip: P(0.25, 0.65), head: P(0.55, 1.2), neck: P(0.45, 1.08), sL: P(0.3, 1.05), sR: P(0.58, 1.0), eL: P(0.1, 0.9), hL: P(-0.05, 0.8), eR: P(0.85, 0.95), hR: P(1.1, 0.9), kL: P(-0.2, 0.45), kR: P(0.45, 0.3), fL: P(-0.55, 0.05), fR: P(0.6, 0.02), racket: 1.5, lean: 0.4 }),
  celebrate: pose({ eR: P(0.35, 1.7), hR: P(0.3, 2.0), racket: 0.2, eL: P(-0.35, 1.2), hL: P(-0.25, 1.35) }),
  slump: pose({ head: P(0, 1.42), neck: P(0, 1.3), sL: P(-0.2, 1.25), sR: P(0.2, 1.25), hip: P(0, 0.82), kL: P(-0.18, 0.42), kR: P(0.18, 0.42), eL: P(-0.22, 0.95), hL: P(-0.17, 0.62), eR: P(0.24, 0.95), hR: P(0.2, 0.62), racket: 2.8, lean: 0.15 }),
} satisfies Record<string, Pose>;

/**
 * Where the racket arm and the off arm are relative to the body in each key pose
 * ([racket, off]; < 0 in front of the chest, > 0 behind the back). Interpolated with the pose.
 */
const DEPTHS: Record<keyof typeof POSES, [number, number]> = {
  ready: [-1, -1], runA: [-0.3, -0.3], runB: [-0.3, -0.3],
  fhBack: [0.6, -1], fhContact: [-0.6, -0.8], fhFollow: [1, -0.5],
  bhBack: [0.6, 0.6], bhContact: [-0.6, -0.6], bhFollow: [1, 1],
  bh1Back: [0.6, 0.6], bh1Contact: [-0.6, 0.5], bh1Follow: [-0.5, 0.8],
  fhSliceBack: [0.4, -1], fhSliceContact: [-0.6, -0.8], fhSliceFollow: [-1, -0.5],
  bhSliceBack: [0.4, 0.4], bhSliceContact: [-0.6, 0.5], bhSliceFollow: [-1, 0.8],
  lobFollow: [-0.3, -0.5],
  srvToss: [0.6, -0.5], srvTrophy: [1, -0.5], srvContact: [-0.2, -1], srvFollow: [-1, -1],
  volley: [-1, -1], dive: [-0.5, -0.5], celebrate: [-0.2, -0.5], slump: [-0.5, -0.5],
};
for (const k of Object.keys(DEPTHS) as (keyof typeof POSES)[]) {
  POSES[k].rDepth = DEPTHS[k][0];
  POSES[k].oDepth = DEPTHS[k][1];
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const o = {} as Pose;
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'number') (o as any)[k] = va + ((vb as number) - va) * t;
    else (o as any)[k] = [va[0] + ((vb as P2)[0] - va[0]) * t, va[1] + ((vb as P2)[1] - va[1]) * t];
  }
  return o;
}

export function smooth(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) {
    r = Math.round(r * (1 + k)); g = Math.round(g * (1 + k)); b = Math.round(b * (1 + k));
  } else {
    r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
  }
  return `rgb(${r},${g},${b})`;
}

export interface DrawOpts {
  mirror: boolean; // flip x (far player seen from front, lefty)
  facingCamera: boolean;
  twoHanded: boolean;
  bob: number;
}

/** Stylised proportions (M18): short legs, big head, oversized racket. */
const LEG_K = 0.78; // legs are 78% of the pose's leg length
// M20: matched to the Free Tennis footage. In a match the figure is drawn at FIGURE_SCALE, so a
// standing player is ≈1.4 court-metres tall, the head ≈19% of that, and the racket ≈0.75 of it.
const HEAD_R = 0.17; // head radius (m)
const RACKET_LEN = 1.28; // total racket length (m)
const RACKET_HANDLE = 0.3;
const RACKET_W = 0.26; // head half-width
/** in-match draw scale of the figure relative to the court (M20, was 1.15) */
export const FIGURE_SCALE = 0.82;
/** light comes from the upper left of the screen */
const LIGHT: P2 = [-0.55, 0.85];

/** Draw a player figure at ground screen point (sx, sy) with scale s px/m. */
export function drawFigure(ctx: CanvasRenderingContext2D, sx: number, sy: number, s: number, p: Pose, kit: Kit, o: DrawOpts): void {
  const m = o.mirror ? -1 : 1;
  const hipY = p.hip[1];
  // squash the legs, keep feet on the ground and lift nothing above the hips except by the leg change
  const tp = (pt: P2): P2 => (pt[1] <= hipY ? [pt[0], pt[1] * LEG_K] : [pt[0], pt[1] - hipY * (1 - LEG_K)]);
  const X = (pt: P2) => { const q = tp(pt); return sx + (q[0] + p.lean * q[1] * 0.5) * s * m; };
  const Y = (pt: P2) => sy - (tp(pt)[1] + o.bob) * s;
  const lx = LIGHT[0] * m;
  /** a shaded capsule limb a-b-c */
  const limb = (a: P2, b: P2, c: P2, w: number, col: string) => {
    const pts = [a, b, c].map((q) => [X(q), Y(q)] as const);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
    };
    path();
    ctx.strokeStyle = shade(col, -0.45);
    ctx.lineWidth = w * s + 1.6;
    ctx.stroke();
    ctx.strokeStyle = shade(col, -0.08);
    ctx.lineWidth = w * s;
    ctx.stroke();
    // highlight on the lit side
    ctx.save();
    ctx.translate(lx * w * s * 0.22, -w * s * 0.18);
    path();
    ctx.strokeStyle = shade(col, 0.22);
    ctx.lineWidth = w * s * 0.42;
    ctx.stroke();
    ctx.restore();
  };
  const ball = (pt: P2, r: number, col: string) => {
    const x = X(pt), y = Y(pt), rr = r * s;
    const g = ctx.createRadialGradient(x + lx * rr * 0.4, y - rr * 0.45, rr * 0.1, x, y, rr);
    g.addColorStop(0, shade(col, 0.3));
    g.addColorStop(0.65, col);
    g.addColorStop(1, shade(col, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const skin = kit.skin;
  const hipL: P2 = [p.hip[0] - 0.11, hipY];
  const hipR: P2 = [p.hip[0] + 0.11, hipY];

  // ---- legs + shoes
  limb(hipL, p.kL, p.fL, 0.135, skin);
  limb(hipR, p.kR, p.fR, 0.135, skin);
  for (const f of [p.fL, p.fR]) {
    const x = X(f), y = Y(f);
    ctx.fillStyle = shade(kit.shoes, -0.45);
    ctx.beginPath();
    ctx.ellipse(x, y - 0.02 * s, 0.12 * s + 0.8, 0.07 * s + 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - 0.1 * s, 0, y);
    g.addColorStop(0, shade(kit.shoes, 0.2));
    g.addColorStop(1, shade(kit.shoes, -0.15));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 0.035 * s, 0.11 * s, 0.06 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // ---- shorts: one rounded leg piece per thigh + waist
  for (const [h, k] of [[hipL, p.kL], [hipR, p.kR]] as const) {
    const mid: P2 = [h[0] + (k[0] - h[0]) * 0.45, h[1] + (k[1] - h[1]) * 0.45];
    limb(h, mid, mid, 0.2, kit.shorts);
  }
  limb([p.hip[0] - 0.13, hipY + 0.04], [p.hip[0], hipY + 0.05], [p.hip[0] + 0.13, hipY + 0.04], 0.16, kit.shorts);

  // ---- arms + racket
  const drawRacketArm = () => {
    limb(p.sR, p.eR, p.hR, 0.105, skin);
    drawRacket(ctx, X(p.hR), Y(p.hR), s, p.racket * m, kit);
    ball(p.hR, 0.06, skin);
  };
  const drawOffArm = () => {
    limb(p.sL, p.eL, p.hL, 0.1, skin);
    ball(p.hL, 0.058, skin);
  };
  const grip = () => {
    if (o.twoHanded && Math.hypot(p.hL[0] - p.hR[0], p.hL[1] - p.hR[1]) < 0.16) {
      // second hand on the grip, drawn over the racket hand
      ball([p.hR[0] + (p.hL[0] - p.hR[0]) * 0.5, p.hR[1] + (p.hL[1] - p.hR[1]) * 0.5 - 0.04], 0.058, skin);
    }
  };
  // Draw order: an arm (and racket) on the camera's side of the body goes over the torso and head,
  // one on the far side goes behind them. The near (back-view) player sees the back; the far player the chest.
  const nearCam = (depth: number) => (o.facingCamera ? depth <= 0 : depth > 0);
  const rNear = nearCam(p.rDepth);
  const oNear = nearCam(p.oDepth);
  const arms = (near: boolean) => {
    if (oNear === near) drawOffArm();
    if (rNear === near) {
      drawRacketArm();
      grip();
    }
  };
  arms(false);

  // ---- torso: a rounded, shaded shirt
  const sl: P2 = [p.sL[0] - 0.05, p.sL[1] + 0.03];
  const sr: P2 = [p.sR[0] + 0.05, p.sR[1] + 0.03];
  const wl: P2 = [p.hip[0] - 0.19, hipY + 0.1];
  const wr: P2 = [p.hip[0] + 0.19, hipY + 0.1];
  const tx0 = Math.min(X(sl), X(wl)), tx1 = Math.max(X(sr), X(wr));
  const g = ctx.createLinearGradient(m > 0 ? tx0 : tx1, 0, m > 0 ? tx1 : tx0, 0);
  g.addColorStop(0, shade(kit.shirt, 0.18));
  g.addColorStop(0.5, kit.shirt);
  g.addColorStop(1, shade(kit.shirt, -0.28));
  ctx.fillStyle = g;
  ctx.strokeStyle = shade(kit.shirt, -0.5);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X(sl), Y(sl));
  ctx.quadraticCurveTo(X(p.neck), Y([p.neck[0], p.neck[1] + 0.07]), X(sr), Y(sr));
  ctx.quadraticCurveTo(X([sr[0] + 0.04, (sr[1] + wr[1]) / 2]), Y([0, (sr[1] + wr[1]) / 2]), X(wr), Y(wr));
  ctx.quadraticCurveTo(X([p.hip[0], hipY + 0.04]), Y([p.hip[0], hipY + 0.04]), X(wl), Y(wl));
  ctx.quadraticCurveTo(X([sl[0] - 0.04, (sl[1] + wl[1]) / 2]), Y([0, (sl[1] + wl[1]) / 2]), X(sl), Y(sl));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // sleeve caps
  ball(p.sL, 0.085, kit.shirt);
  ball(p.sR, 0.085, kit.shirt);
  // trim stripe in the band colour
  ctx.strokeStyle = kit.band;
  ctx.lineWidth = Math.max(1, 0.03 * s);
  ctx.beginPath();
  ctx.moveTo(X([wl[0] + 0.02, wl[1] + 0.05]), Y([0, wl[1] + 0.05]));
  ctx.lineTo(X([wr[0] - 0.02, wr[1] + 0.05]), Y([0, wr[1] + 0.05]));
  ctx.stroke();

  // ---- neck + big head
  limb(p.neck, [p.neck[0], p.neck[1] + 0.08], [p.neck[0], p.neck[1] + 0.1], 0.1, skin);
  const headC: P2 = [p.neck[0] + (p.head[0] - p.neck[0]) * 1.2, p.neck[1] + HEAD_R * 0.92];
  const hx = X(headC), hy = Y(headC) - 0.0;
  const hr = HEAD_R * s;
  ctx.fillStyle = shade(skin, -0.45);
  ctx.beginPath();
  ctx.arc(hx, hy, hr + 0.8, 0, Math.PI * 2);
  ctx.fill();
  ball(headC, HEAD_R, skin);
  // ears
  ctx.fillStyle = shade(skin, -0.12);
  for (const e of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + e * hr * 0.97, hy + hr * 0.08, hr * 0.13, hr * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // hair: from behind it covers most of the head, from the front only the top and a fringe
  const hairG = ctx.createLinearGradient(hx - hr, hy - hr, hx + hr, hy + hr);
  hairG.addColorStop(0, shade(kit.hair, 0.25));
  hairG.addColorStop(1, shade(kit.hair, -0.2));
  ctx.fillStyle = hairG;
  ctx.beginPath();
  if (o.facingCamera) {
    ctx.arc(hx, hy, hr * 1.04, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(hx + hr * 0.3, hy - hr * 0.25, hx - hr * 1.0, hy - hr * 0.1);
  } else {
    ctx.arc(hx, hy + hr * 0.05, hr * 1.05, Math.PI * 0.82, Math.PI * 2.18);
    ctx.quadraticCurveTo(hx, hy + hr * 0.75, hx - hr * 0.86, hy + hr * 0.55);
  }
  ctx.fill();
  // headband
  ctx.strokeStyle = kit.band;
  ctx.lineWidth = Math.max(1.2, 0.05 * s);
  ctx.beginPath();
  ctx.arc(hx, hy + hr * 0.05, hr * 1.0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  if (o.facingCamera) {
    // face: eyes, a hint of a nose and mouth
    ctx.fillStyle = 'rgba(25,18,10,0.9)';
    const ex = hr * 0.36;
    const ey = hy + hr * 0.12;
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx + e * ex, ey, Math.max(0.8, hr * 0.09), Math.max(1, hr * 0.13), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = shade(skin, -0.35);
    ctx.lineWidth = Math.max(0.8, hr * 0.06);
    ctx.beginPath();
    ctx.arc(hx, hy + hr * 0.42, hr * 0.18, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  arms(true);
}

/** Oversized racket with a visible string bed; `kit` tints the frame. */
export function drawRacket(ctx: CanvasRenderingContext2D, hx: number, hy: number, s: number, ang: number, kit?: Kit): void {
  const len = RACKET_LEN * s;
  const handle = RACKET_HANDLE * s;
  const dx = Math.sin(ang);
  const dy = -Math.cos(ang);
  const rl = (len - handle) / 2;
  const cx = hx + dx * (handle + rl);
  const cy = hy + dy * (handle + rl);
  // grip + throat
  ctx.strokeStyle = '#1b1f29';
  ctx.lineWidth = Math.max(1.6, 0.055 * s);
  ctx.beginPath();
  ctx.moveTo(hx - dx * 0.06 * s, hy - dy * 0.06 * s);
  ctx.lineTo(hx + dx * handle * 0.75, hy + dy * handle * 0.75);
  ctx.stroke();
  const rw = RACKET_W * s;
  const frame = frameColor(kit);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // throat "V"
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(1.2, 0.035 * s);
  ctx.beginPath();
  ctx.moveTo(0, rl + handle * 0.25);
  ctx.lineTo(-rw * 0.55, rl * 0.78);
  ctx.moveTo(0, rl + handle * 0.25);
  ctx.lineTo(rw * 0.55, rl * 0.78);
  ctx.stroke();
  // string bed
  ctx.fillStyle = 'rgba(245,245,235,0.33)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rl, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = Math.max(0.4, 0.008 * s);
  const nx = s > 30 ? 7 : 4;
  for (let i = -nx; i <= nx; i++) {
    const u = (i / (nx + 1)) * rw;
    ctx.beginPath();
    ctx.moveTo(u, -rl);
    ctx.lineTo(u, rl);
    ctx.stroke();
  }
  const ny = s > 30 ? 9 : 5;
  for (let i = -ny; i <= ny; i++) {
    const v = (i / (ny + 1)) * rl;
    ctx.beginPath();
    ctx.moveTo(-rw, v);
    ctx.lineTo(rw, v);
    ctx.stroke();
  }
  ctx.restore();
  // frame: dark rim + coloured face
  ctx.strokeStyle = '#141820';
  ctx.lineWidth = Math.max(2, 0.06 * s);
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rl, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(1.3, 0.038 * s);
  ctx.stroke();
  ctx.restore();
}

function frameColor(kit?: Kit): string {
  if (!kit) return '#d23a2a';
  // use the band colour unless it is too pale to read against the court
  const n = parseInt(kit.band.slice(1), 16);
  const lum = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
  return lum > 200 ? '#d23a2a' : kit.band;
}

export function drawShadow(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, rx: number, alpha = 0.28): void {
  const p = cam.project(x, y, 0);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx * p.s, rx * p.s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}
