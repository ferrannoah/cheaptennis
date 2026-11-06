import { Camera } from './camera';
import { Layer } from './layer';
import { drawCourtBackground, drawNet, drawCrowd, makeCrowd } from './court';
import { SURFACES, SurfaceId } from '../data/surfaces';
import { W, H } from '../core/game';
import { text } from './text';

/** Title-screen style backdrop: sky with drifting clouds over the stadium. */
export const titleCam = new Camera(-78, 23, 2, 0, 820, 338);
titleCam.cx = 430;
const layers = new Map<string, Layer>();
const seats = makeCrowd(11);

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const blobs: [number, number, number][] = [[0, 0, 18], [20, -8, 22], [44, -2, 18], [62, 4, 13], [-18, 5, 12], [24, 8, 16]];
  ctx.beginPath();
  for (const [bx, by, r] of blobs) {
    ctx.moveTo(x + bx * s + r * s, y + by * s);
    ctx.arc(x + bx * s, y + by * s, r * s, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(200,225,245,0.55)';
  ctx.beginPath();
  ctx.ellipse(x + 22 * s, y + 16 * s, 46 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, t: number, sf: SurfaceId = 'grass', crowd = true): void {
  let l = layers.get(sf);
  if (!l) {
    l = new Layer((c) => {
      drawCourtBackground(c, titleCam, SURFACES[sf], W, H);
      drawNet(c, titleCam);
    });
    layers.set(sf, l);
  }
  l.draw(ctx);
  // clouds
  const clouds: [number, number, number, number][] = [[40, 46, 1.0, 6], [260, 28, 1.3, 4], [470, 60, 0.9, 7], [620, 36, 1.1, 5], [150, 88, 0.7, 9]];
  for (const [x0, y, s, sp] of clouds) {
    const x = ((x0 + t * sp) % (W + 200)) - 100;
    cloud(ctx, x, y, s);
  }
  if (crowd) drawCrowd(ctx, titleCam, seats, t, 0.1, 0);
}

export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number): void {
  const word = 'BASELINE';
  ctx.save();
  ctx.translate(x, y);
  const wob = Math.sin(t * 2) * 0.01;
  ctx.rotate(-0.04 + wob);
  // swoosh behind
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(size * 2.2, size * 1.4, size * 2.6, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  // ball
  const bx = size * 2.95, by = -size * 0.55;
  const bg = ctx.createRadialGradient(bx - size * 0.1, by - size * 0.1, size * 0.04, bx, by, size * 0.32);
  bg.addColorStop(0, '#fbffb0');
  bg.addColorStop(1, '#b8d82a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(bx, by, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.arc(bx - size * 0.32, by, size * 0.24, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx + size * 0.32, by, size * 0.24, Math.PI - 0.9, Math.PI + 0.9);
  ctx.stroke();
  // word
  text(ctx, word, 0, 6, { size, align: 'center', color: '#13284a', outline: '#13284a', outlineWidth: size * 0.32 });
  ctx.save();
  ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Nunito", "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
  g.addColorStop(0, '#fff6a0');
  g.addColorStop(0.45, '#ffc93a');
  g.addColorStop(1, '#ff7a1a');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.12;
  ctx.strokeText(word, 0, 0);
  ctx.fillStyle = g;
  ctx.fillText(word, 0, 0);
  ctx.restore();
  ctx.restore();
}
