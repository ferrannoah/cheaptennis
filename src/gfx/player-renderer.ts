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
  };
}

function pose(o: Partial<Pose>): Pose {
  return { ...base(), ...o };
}

export const POSES = {
  ready: pose({ kL: P(-0.18, 0.47), kR: P(0.18, 0.47), hip: P(0, 0.9), fL: P(-0.27, 0.02), fR: P(0.27, 0.02), head: P(0, 1.62), neck: P(0, 1.45), sL: P(-0.21, 1.4), sR: P(0.21, 1.4), eL: P(-0.2, 1.12), eR: P(0.22, 1.12), hL: P(-0.02, 0.95), hR: P(0.07, 0.93), racket: -0.85 }),
  runA: pose({ kL: P(-0.1, 0.58), kR: P(0.2, 0.42), fL: P(-0.16, 0.2), fR: P(0.24, 0.02), eL: P(-0.27, 1.22), hL: P(-0.18, 1.08), eR: P(0.25, 1.15), hR: P(0.2, 0.98), racket: 0.6, lean: 0.06 }),
  runB: pose({ kL: P(-0.2, 0.42), kR: P(0.1, 0.58), fL: P(-0.24, 0.02), fR: P(0.16, 0.2), eL: P(-0.22, 1.15), hL: P(-0.12, 1.0), eR: P(0.3, 1.24), hR: P(0.28, 1.08), racket: 0.9, lean: 0.06 }),
  fhBack: pose({ hip: P(0.02, 0.9), kL: P(-0.16, 0.48), kR: P(0.2, 0.47), fL: P(-0.24, 0.02), fR: P(0.3, 0.02), sL: P(-0.17, 1.42), sR: P(0.23, 1.42), eL: P(-0.05, 1.22), hL: P(0.08, 1.12), eR: P(0.42, 1.25), hR: P(0.55, 1.18), racket: 2.1, lean: 0.05 }),
  fhContact: pose({ hip: P(0, 0.9), kL: P(-0.18, 0.48), kR: P(0.18, 0.47), fL: P(-0.26, 0.02), fR: P(0.28, 0.02), eL: P(-0.25, 1.2), hL: P(-0.25, 1.05), eR: P(0.36, 1.12), hR: P(0.5, 1.0), racket: 1.45, lean: -0.02 }),
  fhFollow: pose({ hip: P(-0.02, 0.92), sL: P(-0.23, 1.44), sR: P(0.17, 1.46), eL: P(-0.3, 1.24), hL: P(-0.2, 1.1), eR: P(0.0, 1.42), hR: P(-0.25, 1.55), racket: -2.3, lean: -0.06 }),
  bhBack: pose({ hip: P(-0.02, 0.9), kL: P(-0.2, 0.47), kR: P(0.16, 0.48), fL: P(-0.3, 0.02), fR: P(0.24, 0.02), sL: P(-0.23, 1.42), sR: P(0.17, 1.42), eL: P(-0.35, 1.2), hL: P(-0.48, 1.15), eR: P(-0.15, 1.18), hR: P(-0.45, 1.13), racket: -2.1, lean: -0.05 }),
  bhContact: pose({ eL: P(-0.3, 1.12), hL: P(-0.45, 1.0), eR: P(-0.12, 1.1), hR: P(-0.42, 0.99), racket: -1.45, lean: 0.02 }),
  bhFollow: pose({ sL: P(-0.17, 1.46), sR: P(0.23, 1.44), eL: P(0.05, 1.38), hL: P(0.28, 1.52), eR: P(0.18, 1.32), hR: P(0.3, 1.5), racket: 2.4, lean: 0.06 }),
  srvToss: pose({ eL: P(-0.22, 1.6), hL: P(-0.15, 2.0), eR: P(0.35, 1.2), hR: P(0.42, 1.0), racket: 2.6, kL: P(-0.14, 0.5), kR: P(0.16, 0.5) }),
  srvTrophy: pose({ hip: P(0, 0.88), kL: P(-0.17, 0.45), kR: P(0.17, 0.45), eL: P(-0.2, 1.75), hL: P(-0.12, 2.05), eR: P(0.38, 1.55), hR: P(0.26, 1.72), racket: 3.0, lean: -0.08 }),
  srvContact: pose({ hip: P(0, 1.0), kL: P(-0.12, 0.56), kR: P(0.14, 0.55), fL: P(-0.14, 0.08), fR: P(0.16, 0.04), head: P(0, 1.74), neck: P(0, 1.56), sL: P(-0.2, 1.5), sR: P(0.2, 1.52), eL: P(-0.25, 1.25), hL: P(-0.12, 1.1), eR: P(0.22, 1.9), hR: P(0.18, 2.22), racket: 0.1, lean: 0.04 }),
  srvFollow: pose({ eL: P(-0.25, 1.15), hL: P(-0.1, 1.0), eR: P(0.0, 1.2), hR: P(-0.25, 0.95), racket: -2.6, lean: 0.12, kL: P(-0.18, 0.5), kR: P(0.1, 0.48) }),
  volley: pose({ hip: P(0, 0.86), kL: P(-0.2, 0.45), kR: P(0.2, 0.44), fL: P(-0.3, 0.02), fR: P(0.3, 0.02), eR: P(0.35, 1.25), hR: P(0.48, 1.3), racket: 0.5, hL: P(0.1, 1.15), eL: P(-0.1, 1.2) }),
  dive: pose({ hip: P(0.25, 0.65), head: P(0.55, 1.2), neck: P(0.45, 1.08), sL: P(0.3, 1.05), sR: P(0.58, 1.0), eL: P(0.1, 0.9), hL: P(-0.05, 0.8), eR: P(0.85, 0.95), hR: P(1.1, 0.9), kL: P(-0.2, 0.45), kR: P(0.45, 0.3), fL: P(-0.55, 0.05), fR: P(0.6, 0.02), racket: 1.5, lean: 0.4 }),
  celebrate: pose({ eR: P(0.35, 1.7), hR: P(0.3, 2.0), racket: 0.2, eL: P(-0.35, 1.2), hL: P(-0.25, 1.35) }),
  slump: pose({ head: P(0, 1.42), neck: P(0, 1.3), sL: P(-0.2, 1.25), sR: P(0.2, 1.25), hip: P(0, 0.82), kL: P(-0.18, 0.42), kR: P(0.18, 0.42), eL: P(-0.22, 0.95), hL: P(-0.17, 0.62), eR: P(0.24, 0.95), hR: P(0.2, 0.62), racket: 2.8, lean: 0.15 }),
} satisfies Record<string, Pose>;

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

/** Draw a player figure at ground screen point (sx, sy) with scale s px/m. */
export function drawFigure(ctx: CanvasRenderingContext2D, sx: number, sy: number, s: number, p: Pose, kit: Kit, o: DrawOpts): void {
  const m = o.mirror ? -1 : 1;
  const X = (pt: P2) => sx + (pt[0] + p.lean * (pt[1] - 0.0) * 0.5) * s * m;
  const Y = (pt: P2) => sy - (pt[1] + o.bob) * s;
  const limb = (a: P2, b: P2, c: P2, w: number, col: string) => {
    ctx.strokeStyle = shade(col, -0.35);
    ctx.lineWidth = w * s + 1.2;
    ctx.beginPath();
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(b), Y(b));
    ctx.lineTo(X(c), Y(c));
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w * s;
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const skin = kit.skin;
  const hipL: P2 = [p.hip[0] - 0.1, p.hip[1]];
  const hipR: P2 = [p.hip[0] + 0.1, p.hip[1]];

  // legs
  limb(hipL, p.kL, p.fL, 0.11, skin);
  limb(hipR, p.kR, p.fR, 0.11, skin);
  // socks/shoes
  for (const f of [p.fL, p.fR]) {
    ctx.fillStyle = shade(kit.shoes, -0.3);
    ctx.beginPath();
    ctx.ellipse(X(f), Y(f) - 0.02 * s, 0.085 * s + 0.6, 0.05 * s + 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = kit.shoes;
    ctx.beginPath();
    ctx.ellipse(X(f), Y(f) - 0.03 * s, 0.075 * s, 0.04 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // shorts
  ctx.fillStyle = shade(kit.shorts, -0.18);
  ctx.beginPath();
  ctx.moveTo(X([p.hip[0] - 0.19, p.hip[1] + 0.08]), Y([0, p.hip[1] + 0.08]));
  ctx.lineTo(X([p.hip[0] + 0.19, p.hip[1] + 0.08]), Y([0, p.hip[1] + 0.08]));
  ctx.lineTo(X([(p.hip[0] + p.kR[0]) / 2 + 0.09, (p.hip[1] + p.kR[1]) / 2 + 0.07]), Y([0, (p.hip[1] + p.kR[1]) / 2 + 0.07]));
  ctx.lineTo(X([p.hip[0] + 0.01, p.hip[1] - 0.1]), Y([0, p.hip[1] - 0.1]));
  ctx.lineTo(X([(p.hip[0] + p.kL[0]) / 2 - 0.09, (p.hip[1] + p.kL[1]) / 2 + 0.07]), Y([0, (p.hip[1] + p.kL[1]) / 2 + 0.07]));
  ctx.closePath();
  ctx.fill();

  // back arm (the non-racket arm drawn behind when facing camera? keep simple: left arm first)
  const racketArmFirst = false;
  const drawRacketArm = () => {
    limb(p.sR, p.eR, p.hR, 0.085, skin);
    drawRacket(ctx, X(p.hR), Y(p.hR), s, p.racket * m);
  };
  const drawOffArm = () => {
    limb(p.sL, p.eL, p.hL, 0.08, skin);
  };
  if (!o.facingCamera) drawOffArm();

  // torso (shirt) with shading
  const tx0 = X(p.sL), tx1 = X(p.sR);
  const g = ctx.createLinearGradient(Math.min(tx0, tx1), 0, Math.max(tx0, tx1), 0);
  g.addColorStop(0, shade(kit.shirt, -0.22));
  g.addColorStop(0.45, kit.shirt);
  g.addColorStop(1, shade(kit.shirt, -0.12));
  ctx.fillStyle = g;
  ctx.strokeStyle = shade(kit.shirt, -0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X([p.sL[0] - 0.03, p.sL[1] + 0.02]), Y([0, p.sL[1] + 0.02]));
  ctx.quadraticCurveTo(X(p.neck), Y([0, p.neck[1] + 0.04]), X([p.sR[0] + 0.03, p.sR[1] + 0.02]), Y([0, p.sR[1] + 0.02]));
  ctx.lineTo(X([p.hip[0] + 0.17, p.hip[1] + 0.12]), Y([0, p.hip[1] + 0.12]));
  ctx.quadraticCurveTo(X([p.hip[0], p.hip[1] + 0.05]), Y([0, p.hip[1] + 0.05]), X([p.hip[0] - 0.17, p.hip[1] + 0.12]), Y([0, p.hip[1] + 0.12]));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (o.facingCamera) drawOffArm();
  drawRacketArm();
  if (o.twoHanded && Math.hypot(p.hL[0] - p.hR[0], p.hL[1] - p.hR[1]) < 0.12) {
    // second hand on grip
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(X(p.hL), Y(p.hL), 0.05 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // head
  const hx = X(p.head), hy = Y(p.head);
  const hr = 0.115 * s;
  ctx.fillStyle = shade(skin, -0.3);
  ctx.beginPath();
  ctx.arc(hx, hy, hr + 0.6, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, hr * 0.1, hx, hy, hr);
  hg.addColorStop(0, shade(skin, 0.15));
  hg.addColorStop(1, skin);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  // hair: from behind it covers the head, from the front only the top
  ctx.fillStyle = kit.hair;
  ctx.beginPath();
  if (o.facingCamera) ctx.arc(hx, hy - hr * 0.15, hr * 1.02, Math.PI * 1.08, Math.PI * 1.92);
  else ctx.arc(hx, hy - hr * 0.05, hr * 1.03, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  // headband
  ctx.strokeStyle = kit.band;
  ctx.lineWidth = Math.max(1, 0.035 * s);
  ctx.beginPath();
  ctx.arc(hx, hy, hr * 0.98, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  if (o.facingCamera) {
    // tiny eyes
    ctx.fillStyle = 'rgba(30,20,10,0.8)';
    const ex = hr * 0.35;
    ctx.fillRect(hx - ex - 0.5, hy - 0.5, Math.max(1, hr * 0.15), Math.max(1, hr * 0.18));
    ctx.fillRect(hx + ex - 0.5, hy - 0.5, Math.max(1, hr * 0.15), Math.max(1, hr * 0.18));
  }
}

export function drawRacket(ctx: CanvasRenderingContext2D, hx: number, hy: number, s: number, ang: number): void {
  const len = 0.66 * s;
  const handle = 0.24 * s;
  const dx = Math.sin(ang);
  const dy = -Math.cos(ang);
  const cx = hx + dx * (handle + (len - handle) / 2);
  const cy = hy + dy * (handle + (len - handle) / 2);
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = Math.max(1.2, 0.04 * s);
  ctx.beginPath();
  ctx.moveTo(hx - dx * 0.04 * s, hy - dy * 0.04 * s);
  ctx.lineTo(hx + dx * handle, hy + dy * handle);
  ctx.stroke();
  const rw = 0.13 * s;
  const rl = (len - handle) / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(240,240,230,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rl, 0, 0, Math.PI * 2);
  ctx.fill();
  // strings
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * rw * 0.33, -rl * 0.9);
    ctx.lineTo(i * rw * 0.33, rl * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-rw * 0.9, i * rl * 0.33);
    ctx.lineTo(rw * 0.9, i * rl * 0.33);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d23a2a';
  ctx.lineWidth = Math.max(1.3, 0.035 * s);
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rl, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawShadow(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, rx: number, alpha = 0.28): void {
  const p = cam.project(x, y, 0);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx * p.s, rx * p.s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}
