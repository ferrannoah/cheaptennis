import { Camera } from './camera';
import { Surface } from '../data/surfaces';
import { HALF_LEN, HALF_W, HALF_W_DBL, SERVICE_Y, POST_X, netHeightAt } from '../data/court';
import { Rng } from '../core/rng';
import { text } from './text';
import { Venue, VenueTheme, venueFor, venueLook } from '../data/venues';

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

export function makeCrowd(seed = 7, rows = 7, empty = 0.08, farRows = rows, sideRange: [number, number] = [-24, 25], farHalfW = 16): Seat[] {
  const r = new Rng(seed);
  const seats: Seat[] = [];
  const push = (x: number, y: number, z: number) => {
    if (r.chance(empty)) return; // empty seats
    seats.push({
      x: x + r.range(-0.15, 0.15), y: y + r.range(-0.1, 0.1), z,
      shirt: r.pick(SHIRTS), skin: r.pick(SKINS), hair: r.pick(HAIRS), phase: r.range(0, Math.PI * 2),
    });
  };
  // side stands (rows going outward and up)
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const x = side * (SIDE_WALL_X + 0.7 + row * 1.0);
      const z = 1.4 + row * 0.95;
      for (let y = sideRange[0] + 0.4; y <= sideRange[1] - 0.4; y += 0.95) push(x, y, z);
    }
  }
  // far stand
  for (let row = 0; row < farRows; row++) {
    const y = 20.4 + row * 1.0;
    const z = 1.4 + row * 0.95;
    for (let x = -farHalfW; x <= farHalfW; x += 0.95) push(x, y, z);
  }
  // sort far-to-near for painter's order (by depth: larger y & larger |x| first roughly)
  seats.sort((a, b) => b.y - a.y || Math.abs(b.x) - Math.abs(a.x));
  return seats;
}

/** Background: sky, stands (structure), ground, court lines. Crowd + net drawn separately. */
export function drawCourtBackground(ctx: CanvasRenderingContext2D, cam: Camera, sf: Surface, W: number, H: number, venue: Venue = venueFor(sf.id)): void {
  const th = venue.theme;
  const look = venueLook(venue);
  const rows = look.standRows;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  sky.addColorStop(0, th.sky[0]);
  sky.addColorStop(1, th.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (th.night) {
    const r0 = new Rng(17);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i++) ctx.fillRect(r0.range(0, W), r0.range(0, H * 0.18), 1, 1);
  }

  // stand colours: park courts have plain aluminium bleachers
  const standA = look.park ? '#c4ccd4' : th.stand[0];
  const standB = look.park ? '#b3bcc6' : th.stand[1];
  const riser = look.park ? '#8a949e' : th.riser;
  if (look.park) drawPark(ctx, cam);

  // far stand structure (a stadium has the full-width stand, wall and roof; a park court small bleachers or none)
  const farRows = look.farRows;
  const farX = look.park ? 8 : 30;
  const roofZ = 1.0 + farRows * 0.95 + 0.6;
  const backY = 20 + farRows * 1.0;
  for (let row = farRows; row >= 0 && farRows > 0; row--) {
    const y = 20 + row * 1.0;
    const z = 1.0 + row * 0.95;
    poly(ctx, cam, [[-farX, y, z], [farX, y, z], [farX, y + 1.0, z], [-farX, y + 1.0, z]]);
    ctx.fillStyle = row % 2 ? standA : standB;
    ctx.fill();
    poly(ctx, cam, [[-farX, y, z - 0.95], [farX, y, z - 0.95], [farX, y, z], [-farX, y, z]]);
    ctx.fillStyle = riser;
    ctx.fill();
  }
  if (!look.park) {
    // far roof / back wall + coloured roof band
    poly(ctx, cam, [[-30, backY, roofZ - 1], [30, backY, roofZ - 1], [30, backY, roofZ + 5.4], [-30, backY, roofZ + 5.4]]);
    ctx.fillStyle = th.wall;
    ctx.fill();
    poly(ctx, cam, [[-30, backY, roofZ + 4.4], [30, backY, roofZ + 4.4], [30, backY, roofZ + 5.9], [-30, backY, roofZ + 5.9]]);
    ctx.fillStyle = th.roofBand;
    ctx.fill();
  }
  if (th.night) {
    // floodlight towers glowing at the corners
    for (const sx of [-1, 1]) {
      const lp = cam.project(sx * 17, backY, roofZ + 7);
      const g = ctx.createRadialGradient(lp.x, lp.y, 1, lp.x, lp.y, 60);
      g.addColorStop(0, 'rgba(255,255,230,0.95)');
      g.addColorStop(0.15, 'rgba(255,250,210,0.5)');
      g.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lp.x - 60, lp.y - 60, 120, 120);
    }
  }

  // side stands (full length in a stadium, a short run of bleachers at a park court)
  const [sy0, sy1] = look.park ? look.sideRange : [-40, 28];
  for (const side of [-1, 1]) {
    for (let row = rows; row >= 0; row--) {
      const x = side * (SIDE_WALL_X + 0.3 + row * 1.0);
      const z = 1.0 + row * 0.95;
      poly(ctx, cam, [[x, sy0, z], [x + side * 1.0, sy0, z], [x + side * 1.0, sy1, z], [x, sy1, z]]);
      ctx.fillStyle = row % 2 ? standA : standB;
      ctx.fill();
      poly(ctx, cam, [[x, sy0, z - 0.95], [x, sy1, z - 0.95], [x, sy1, z], [x, sy0, z]]);
      ctx.fillStyle = riser;
      ctx.fill();
      if (look.park) {
        // bleacher end frame
        for (const yy of [sy0, sy1]) {
          poly(ctx, cam, [[x, yy, 0], [x + side * 1.0, yy, 0], [x + side * 1.0, yy, z], [x, yy, z]]);
          ctx.fillStyle = '#6f7983';
          ctx.fill();
        }
      }
    }
  }
  // Major banners hanging from the front of the side stands
  if (look.banners) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const by = 17 - i * 5.2;
        const col = th.banners[(i + (side > 0 ? 1 : 0)) % th.banners.length];
        const x = side * (SIDE_WALL_X + 0.35);
        poly(ctx, cam, [[x, by - 0.9, 3.4], [x, by + 0.9, 3.4], [x, by + 0.9, 1.6], [x, by, 1.2], [x, by - 0.9, 1.6]]);
        ctx.fillStyle = col;
        ctx.fill();
        poly(ctx, cam, [[x, by - 0.9, 3.4], [x, by + 0.9, 3.4], [x, by + 0.9, 3.15], [x, by - 0.9, 3.15]]);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }
    }
  }

  // ground: surround
  const GX = SIDE_WALL_X + 0.3;
  groundQuad(ctx, cam, -GX, -40, GX, 20, sf.colors.surround);
  if (sf.id === 'grass') {
    // mow stripes across the full width, banded along y
    const step = HALF_LEN / 6;
    for (let i = -14; i < 10; i++) {
      const y0 = i * step;
      groundQuad(ctx, cam, -GX, y0, GX, y0 + step, i % 2 === 0 ? sf.colors.a : sf.colors.b);
    }
  } else if (sf.id === 'hard') {
    groundQuad(ctx, cam, -HALF_W_DBL - 0.6, -HALF_LEN - 1.2, HALF_W_DBL + 0.6, HALF_LEN + 1.2, sf.colors.a);
  } else {
    // clay: subtle brushed bands + speckle
    const step = 1.3;
    for (let i = -30; i < 16; i++) {
      groundQuad(ctx, cam, -GX, i * step, GX, i * step + step, i % 2 === 0 ? sf.colors.a : sf.colors.b);
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

  drawBoards(ctx, cam, th, look.park);
  // Majors paint their name on the court behind each baseline
  if (look.wallName && venue.name) {
    for (const y of [HALF_LEN + 3.6, -HALF_LEN - 3.2]) {
      const c = cam.project(0, y, 0);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.42);
      text(ctx, venue.name.toUpperCase(), 0, 0, { size: Math.max(8, c.s * 0.75), color: 'rgba(255,255,255,0.55)', align: 'center', weight: 800 });
      ctx.restore();
    }
  }

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

/** Park setting for small events: grass all around, a line of trees in the distance. */
function drawPark(ctx: CanvasRenderingContext2D, cam: Camera): void {
  groundQuad(ctx, cam, -60, -60, 60, 80, '#6aa653');
  for (let i = 0; i < 8; i++) groundQuad(ctx, cam, -60, 20 + i * 6, 60, 23 + i * 6, 'rgba(255,255,255,0.04)');
  const r = new Rng(77);
  // far tree line, then side tree lines (far to near for overlap)
  const trees: [number, number, number][] = [];
  for (let x = -44; x <= 44; x += 2.6) trees.push([x + r.range(-0.8, 0.8), 36 + r.range(-2, 2), r.range(4, 7)]);
  for (const side of [-1, 1]) for (let y = 30; y >= -30; y -= 3.2) trees.push([side * (26 + r.range(-1.5, 1.5)), y + r.range(-1, 1), r.range(4, 7)]);
  trees.sort((a, b) => b[1] - a[1]);
  for (const [x, y, h] of trees) {
    const base = cam.project(x, y, 0);
    const top = cam.project(x, y, h);
    const rad = Math.max(3, base.s * h * 0.32);
    ctx.fillStyle = '#5a3d27';
    ctx.fillRect(base.x - base.s * 0.15, top.y, base.s * 0.3, base.y - top.y);
    for (const [dx, dy, k, col] of [[0, 0, 1, '#2f6b33'], [-0.35, 0.25, 0.75, '#3a7d3c'], [0.3, 0.3, 0.7, '#295e2d']] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(top.x + dx * rad, top.y + dy * rad, rad * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** the far courtside wall */
export const BOARD_Y = 19.6;
/**
 * The side walls (M20: was 9.9). With the Free Tennis framing the screen shows about ±8.6 m at the
 * near baseline, so the side stands sit right at the edge of the picture and stay visible.
 */
export const SIDE_WALL_X = 8.6;

/**
 * Courtside walls: plain themed windscreens (no advertising), a thin accent rule along the top,
 * ivy on grass. Small (park) courts get a lower, darker windscreen fence.
 */
function drawBoards(ctx: CanvasRenderingContext2D, cam: Camera, th: VenueTheme, park: boolean): void {
  const boardH = park ? 0.9 : 1.1;
  const col = park ? '#1f3d2c' : th.board;
  const accent = park ? '#2c5a40' : th.boardAccent;
  // back wall
  const bx = SIDE_WALL_X + 0.1;
  poly(ctx, cam, [[-bx, BOARD_Y, 0], [bx, BOARD_Y, 0], [bx, BOARD_Y, boardH], [-bx, BOARD_Y, boardH]]);
  const a = cam.project(0, BOARD_Y, boardH), b = cam.project(0, BOARD_Y, 0);
  const g = ctx.createLinearGradient(0, a.y, 0, b.y);
  g.addColorStop(0, shadeHex(col, 0.1));
  g.addColorStop(1, shadeHex(col, -0.2));
  ctx.fillStyle = g;
  ctx.fill();
  poly(ctx, cam, [[-bx, BOARD_Y, boardH - 0.08], [bx, BOARD_Y, boardH - 0.08], [bx, BOARD_Y, boardH], [-bx, BOARD_Y, boardH]]);
  ctx.fillStyle = accent;
  ctx.fill();
  // side walls
  for (const side of [-1, 1]) {
    const wx = side * SIDE_WALL_X;
    poly(ctx, cam, [[wx, -40, 0], [wx, BOARD_Y, 0], [wx, BOARD_Y, boardH - 0.1], [wx, -40, boardH - 0.1]]);
    ctx.fillStyle = col;
    ctx.fill();
    poly(ctx, cam, [[wx, -40, boardH - 0.18], [wx, BOARD_Y, boardH - 0.18], [wx, BOARD_Y, boardH - 0.1], [wx, -40, boardH - 0.1]]);
    ctx.fillStyle = accent;
    ctx.fill();
    if (th.ivy && !park) {
      // ivy along the top of the side walls
      const r0 = new Rng(side > 0 ? 41 : 43);
      for (let i = 0; i < 260; i++) {
        const y = r0.range(-30, BOARD_Y);
        const p = cam.project(wx, y, 1.0 + r0.range(0, 0.25));
        ctx.fillStyle = r0.chance(0.5) ? '#2f6e2a' : '#3d8a34';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.8, p.s * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) {
    r = Math.round(r * (1 + k)); g = Math.round(g * (1 + k)); b = Math.round(b * (1 + k));
  } else {
    r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
  }
  return `rgb(${r},${g},${b})`;
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
