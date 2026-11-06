/** Procedurally drawn trophies. kind: cup (default), plate (Majors), bowl. */
export function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, spin: number, color = 'gold', kind: 'cup' | 'plate' | 'bowl' = 'cup'): void {
  const sx = Math.max(0.15, Math.abs(Math.cos(spin)));
  const pal = color === 'silver'
    ? { hi: '#ffffff', mid: '#c9d2dc', lo: '#7d8894' }
    : color === 'bronze'
      ? { hi: '#ffd9b0', mid: '#c98a4a', lo: '#7a4a22' }
      : { hi: '#fff6b0', mid: '#f2c230', lo: '#a86f10' };
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(-size * 0.5 * sx, 0, size * 0.5 * sx, 0);
  g.addColorStop(0, pal.lo);
  g.addColorStop(0.35, pal.hi);
  g.addColorStop(0.6, pal.mid);
  g.addColorStop(1, pal.lo);
  if (kind === 'plate') {
    ctx.scale(sx, 1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -size * 0.55, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.lo;
    ctx.lineWidth = size * 0.03;
    for (const r of [0.42, 0.3, 0.16]) {
      ctx.beginPath();
      ctx.arc(0, -size * 0.55, size * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(-size * 0.18, -size * 0.06, size * 0.36, size * 0.08);
    ctx.restore();
    return;
  }
  // base
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(-size * 0.3 * sx, -size * 0.12, size * 0.6 * sx, size * 0.12);
  ctx.fillStyle = '#5a4026';
  ctx.fillRect(-size * 0.24 * sx, -size * 0.2, size * 0.48 * sx, size * 0.08);
  ctx.fillStyle = g;
  // stem
  ctx.fillRect(-size * 0.06 * sx, -size * 0.42, size * 0.12 * sx, size * 0.22);
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.22, size * 0.16 * sx, size * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  // cup
  const cw = kind === 'bowl' ? 0.48 : 0.36;
  ctx.beginPath();
  ctx.moveTo(-size * cw * sx, -size * 0.95);
  ctx.quadraticCurveTo(-size * cw * sx, -size * 0.45, 0, -size * 0.42);
  ctx.quadraticCurveTo(size * cw * sx, -size * 0.45, size * cw * sx, -size * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.lo;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.95, size * cw * sx, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // handles
  if (kind === 'cup') {
    ctx.strokeStyle = pal.mid;
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.ellipse(-size * 0.38 * sx, -size * 0.78, size * 0.12 * sx, size * 0.14, 0, Math.PI * 0.4, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(size * 0.38 * sx, -size * 0.78, size * 0.12 * sx, size * 0.14, 0, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
  }
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.12 * sx, -size * 0.75, size * 0.04 * sx, size * 0.14, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
