import { Camera } from './camera';
import { Surface } from '../data/surfaces';
import { HALF_LEN, HALF_W, HALF_W_DBL, SERVICE_Y, POST_X, netHeightAt } from '../data/court';
import { Rng } from '../core/rng';
import { text } from './text';

type V3 = [number, number, number];

export function poly(ctx: CanvasRenderingContext2D, cam: Camera, pts: V3[]): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = cam.project(pts[i][0], pts[i][1], pts[i][2]);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function groundQuad(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, y0: number, x1: number, y1: number, fill: string): void {
  poly(ctx, cam, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]);
  ctx.fillStyle = fill;
  ctx.fill();
}

function lineSeg(ctx: CanvasRenderingContext2D, cam: Camera, x0: number, y0: number, x1: number, y1: number, w: number): void {
  // thick ground line as quad
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  poly(ctx, cam, [
    [x0 + nx, y0 + ny, 0],
    [x1 + nx, y1 + ny, 0],
    [x1 - nx, y1 - ny, 0],
    [x0 - nx, y0 - ny, 0],
  ]);
  ctx.fill();
}

export interface Seat {
  x: number;
  y: number;
  z: number;
  shirt: string;
  skin: string;
  hair: string;
  phase: number;
}

const SHIRTS = ['#e84a4a', '#f2f2f2', '#3a7bd5', '#f5c542', '#2fa86b', '#e87e3a', '#8f5bd6', '#222a35', '#f07aa8', '#5fc8e8', '#ffffff', '#c9d64a'];
const SKINS = ['#f3cfb0', '#e6b08a', '#c98e62', '#9b6640', '#6e4528', '#f7dcc4'];
const HAIRS = ['#2b1d12', '#5a3a1f', '#c99b52', '#111', '#8a4b2a', '#d8d0c0'];

export function makeCrowd(seed = 7): Seat[] {
  const r = new Rng(seed);
  const seats: Seat[] = [];
  const push = (x: number, y: number, z: number) => {
    if (r.chance(0.08)) return; // empty seats
    seats.push({
      x: x + r.range(-0.15, 0.15), y: y + r.range(-0.1, 0.1), z,
      shirt: r.pick(SHIRTS), skin: r.pick(SKINS), hair: r.pick(HAIRS), phase: r.range(0, Math.PI * 2),
    });
  };
  // side stands (rows going outward and up)
  for (const side of [-1, 1]) {
    for (let row = 0; row < 7; row++) {
      const x = side * (10.6 + row * 1.0);
      const z = 1.4 + row * 0.95;
      for (let y = -24; y <= 25; y += 0.95) push(x, y, z);
    }
  }
  // far stand
  for (let row = 0; row < 7; row++) {
    const y = 20.4 + row * 1.0;
    const z = 1.4 + row * 0.95;
    for (let x = -16; x <= 16; x += 0.95) push(x, y, z);
  }
  // sort far-to-near for painter's order (by depth: larger y & larger |x| first roughly)
  seats.sort((a, b) => b.y - a.y || Math.abs(b.x) - Math.abs(a.x));
  return seats;
}

/** Background: sky, stands (structure), ground, court lines. Crowd + net drawn separately. */
export function drawCourtBackground(ctx: CanvasRenderingContext2D, cam: Camera, sf: Surface, W: number, H: number): void {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  sky.addColorStop(0, '#5aa8e6');
  sky.addColorStop(1, '#bfe3fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // far stand structure
  const standCol = '#4d6a8a';
  const standTop = '#3b5372';
  for (let row = 7; row >= 0; row--) {
    const y = 20 + row * 1.0;
    const z = 1.0 + row * 0.95;
    poly(ctx, cam, [[-30, y, z], [30, y, z], [30, y + 1.0, z], [-30, y + 1.0, z]]);
    ctx.fillStyle = row % 2 ? '#6683a6' : '#5d799c';
    ctx.fill();
    poly(ctx, cam, [[-30, y, z - 0.95], [30, y, z - 0.95], [30, y, z], [-30, y, z]]);
    ctx.fillStyle = standTop;
    ctx.fill();
  }
  // far roof / back wall
  poly(ctx, cam, [[-30, 28, 7.6], [30, 28, 7.6], [30, 28, 14], [-30, 28, 14]]);
  ctx.fillStyle = standCol;
  ctx.fill();
  poly(ctx, cam, [[-30, 28, 13], [30, 28, 13], [30, 28, 14.5], [-30, 28, 14.5]]);
  ctx.fillStyle = '#1f6b46';
  ctx.fill();

  // side stands
  for (const side of [-1, 1]) {
    for (let row = 7; row >= 0; row--) {
      const x = side * (10.2 + row * 1.0);
      const z = 1.0 + row * 0.95;
      poly(ctx, cam, [[x, -40, z], [x + side * 1.0, -40, z], [x + side * 1.0, 28, z], [x, 28, z]]);
      ctx.fillStyle = row % 2 ? '#6683a6' : '#5d799c';
      ctx.fill();
      poly(ctx, cam, [[x, -40, z - 0.95], [x, 28, z - 0.95], [x, 28, z], [x, -40, z]]);
      ctx.fillStyle = standTop;
      ctx.fill();
    }
  }

  // ground: surround
  groundQuad(ctx, cam, -10.2, -40, 10.2, 20, sf.colors.surround);
  if (sf.id === 'grass') {
    // mow stripes across the full width, banded along y
    const step = HALF_LEN / 6;
    for (let i = -14; i < 10; i++) {
      const y0 = i * step;
      groundQuad(ctx, cam, -10.2, y0, 10.2, y0 + step, i % 2 === 0 ? sf.colors.a : sf.colors.b);
    }
  } else if (sf.id === 'hard') {
    groundQuad(ctx, cam, -HALF_W_DBL - 0.6, -HALF_LEN - 1.2, HALF_W_DBL + 0.6, HALF_LEN + 1.2, sf.colors.a);
  } else {
    // clay: subtle brushed bands + speckle
    const step = 1.3;
    for (let i = -30; i < 16; i++) {
      groundQuad(ctx, cam, -10.2, i * step, 10.2, i * step + step, i % 2 === 0 ? sf.colors.a : sf.colors.b);
    }
  }
  // texture speckle
  const r = new Rng(sf.id === 'clay' ? 3 : sf.id === 'hard' ? 5 : 9);
  const n = sf.id === 'clay' ? 4200 : 1800;
  for (let i = 0; i < n; i++) {
    const x = r.range(-10, 10);
    const y = r.range(-22, 20);
    const p = cam.project(x, y, 0);
    if (p.y < 0 || p.y > H) continue;
    const a = sf.id === 'clay' ? 0.1 : 0.05;
    ctx.fillStyle = r.chance(0.5) ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    const sz = Math.max(0.6, p.s * 0.05);
    ctx.fillRect(p.x, p.y, sz, sz * 0.6);
  }
  if (sf.id === 'clay') {
    // darker dusty halo along lines
    ctx.fillStyle = 'rgba(120,40,15,0.12)';
    lineSeg(ctx, cam, -HALF_W_DBL, -HALF_LEN, HALF_W_DBL, -HALF_LEN, 0.6);
    lineSeg(ctx, cam, -HALF_W_DBL, HALF_LEN, HALF_W_DBL, HALF_LEN, 0.6);
  }

  // side & back boards
  for (const side of [-1, 1]) {
    poly(ctx, cam, [[side * 9.9, -40, 0], [side * 9.9, 19.6, 0], [side * 9.9, 19.6, 1.0], [side * 9.9, -40, 1.0]]);
    ctx.fillStyle = '#1d5e3e';
    ctx.fill();
    poly(ctx, cam, [[side * 9.9, -40, 0.85], [side * 9.9, 19.6, 0.85], [side * 9.9, 19.6, 1.0], [side * 9.9, -40, 1.0]]);
    ctx.fillStyle = '#2b7a52';
    ctx.fill();
  }
  poly(ctx, cam, [[-10, 19.6, 0], [10, 19.6, 0], [10, 19.6, 1.1], [-10, 19.6, 1.1]]);
  ctx.fillStyle = '#1d5e3e';
  ctx.fill();
  // board lettering (fictional)
  const bl = cam.project(0, 19.6, 0.55);
  text(ctx, 'BASELINE  •  WORLD TOUR  •  BASELINE', bl.x, bl.y, { size: Math.max(7, bl.s * 0.55), color: 'rgba(255,255,255,0.85)', align: 'center', weight: 800 });

  // court lines
  const lw = 0.075;
  ctx.fillStyle = sf.colors.line;
  // baselines
  lineSeg(ctx, cam, -HALF_W_DBL, -HALF_LEN, HALF_W_DBL, -HALF_LEN, lw * 1.3);
  lineSeg(ctx, cam, -HALF_W_DBL, HALF_LEN, HALF_W_DBL, HALF_LEN, lw * 1.3);
  // sidelines
  for (const x of [-HALF_W_DBL, -HALF_W, HALF_W, HALF_W_DBL]) lineSeg(ctx, cam, x, -HALF_LEN, x, HALF_LEN, lw);
  // service lines
  lineSeg(ctx, cam, -HALF_W, -SERVICE_Y, HALF_W, -SERVICE_Y, lw);
  lineSeg(ctx, cam, -HALF_W, SERVICE_Y, HALF_W, SERVICE_Y, lw);
  lineSeg(ctx, cam, 0, -SERVICE_Y, 0, SERVICE_Y, lw);
  // centre marks
  lineSeg(ctx, cam, 0, -HALF_LEN, 0, -HALF_LEN + 0.2, lw);
  lineSeg(ctx, cam, 0, HALF_LEN, 0, HALF_LEN - 0.2, lw);

  // umpire chair (left side, at the net)
  drawUmpireChair(ctx, cam);
  // net shadow on the ground
  poly(ctx, cam, [[-POST_X, 0, 0], [POST_X, 0, 0], [POST_X, -0.5, 0], [-POST_X, -0.5, 0]]);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fill();
}

function drawUmpireChair(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const x = -7.4;
  const legs: [number, number][] = [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]];
  ctx.strokeStyle = '#1f4f36';
  for (const [dx, dy] of legs) {
    const a = cam.project(x + dx, dy, 0);
    const b = cam.project(x + dx * 0.6, dy * 0.6, 2.0);
    ctx.lineWidth = Math.max(1, a.s * 0.07);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // seat box
  poly(ctx, cam, [[x - 0.4, -0.3, 2.0], [x + 0.4, -0.3, 2.0], [x + 0.4, -0.3, 2.5], [x - 0.4, -0.3, 2.5]]);
  ctx.fillStyle = '#26704c';
  ctx.fill();
  // umpire (tiny figure)
  const h = cam.project(x, 0, 2.95);
  const t = cam.project(x, 0, 2.45);
  ctx.fillStyle = '#1b2a44';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y, t.s * 0.24, t.s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e6b08a';
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.ellipse(h.x, h.y - h.s * 0.1, h.s * 0.15, h.s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Net drawn between far-side and near-side objects. */
export function drawNet(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const N = 24;
  // mesh fill
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const x = -POST_X + (2 * POST_X * i) / N;
    const p = cam.project(x, 0, netHeightAt(x));
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  const br = cam.project(POST_X, 0, 0);
  const bl = cam.project(-POST_X, 0, 0);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(20,24,30,0.55)';
  ctx.fill();
  // mesh lines
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i <= 80; i++) {
    const x = -POST_X + (2 * POST_X * i) / 80;
    const a = cam.project(x, 0, 0);
    const b = cam.project(x, 0, 1.1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let z = 0.1; z < 1.1; z += 0.1) {
    const a = cam.project(-POST_X, 0, z);
    const b = cam.project(POST_X, 0, z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
  // centre strap
  const s0 = cam.project(0, 0, 0);
  const s1 = cam.project(0, 0, netHeightAt(0));
  ctx.strokeStyle = '#f4f4f4';
  ctx.lineWidth = Math.max(1, s0.s * 0.05);
  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  ctx.lineTo(s1.x, s1.y);
  ctx.stroke();
  // white tape
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const x = -POST_X + (2 * POST_X * i) / N;
    const p = cam.project(x, 0, netHeightAt(x));
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = '#fbfbfb';
  ctx.lineWidth = Math.max(1.5, s1.s * 0.07);
  ctx.stroke();
  // yellow posts
  for (const sx of [-1, 1]) {
    const a = cam.project(sx * POST_X, 0, 0);
    const b = cam.project(sx * POST_X, 0, 1.12);
    ctx.strokeStyle = '#e8c21e';
    ctx.lineWidth = Math.max(2, a.s * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = '#fff3a0';
    ctx.lineWidth = Math.max(0.8, a.s * 0.035);
    ctx.beginPath();
    ctx.moveTo(a.x - a.s * 0.03, a.y);
    ctx.lineTo(b.x - b.s * 0.03, b.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

/** Crowd: bobbing heads on the stands. excite 0..1 makes them stand/wave. */
export function drawCrowd(ctx: CanvasRenderingContext2D, cam: Camera, seats: Seat[], t: number, excite: number, ballX: number): void {
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    const bob = Math.sin(t * 2 + s.phase) * 0.03 + excite * Math.max(0, Math.sin(t * 9 + s.phase * 3)) * 0.28;
    const p = cam.project(s.x, s.y, s.z + 0.35 + bob);
    if (p.y < -10 || p.y > 500 || p.x < -10 || p.x > 650) continue;
    const k = p.s;
    // body
    ctx.fillStyle = s.shirt;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + k * 0.32, k * 0.26, k * 0.24, 0, Math.PI, 0);
    ctx.fill();
    // head
    ctx.fillStyle = s.skin;
    ctx.beginPath();
    ctx.arc(p.x, p.y, k * 0.14, 0, Math.PI * 2);
    ctx.fill();
    // hair (turn with ball a bit)
    const look = Math.max(-1, Math.min(1, (ballX - s.x) * 0.15));
    ctx.fillStyle = s.hair;
    ctx.beginPath();
    ctx.arc(p.x - look * k * 0.03, p.y - k * 0.03, k * 0.14, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    if (excite > 0.5 && (i % 5 === 0)) {
      // waving arm
      ctx.strokeStyle = s.skin;
      ctx.lineWidth = Math.max(0.8, k * 0.07);
      const sway = Math.sin(t * 12 + s.phase) * 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x + k * 0.2, p.y + k * 0.25);
      ctx.lineTo(p.x + k * (0.3 + sway * 0.3), p.y - k * 0.35);
      ctx.stroke();
    }
  }
}
