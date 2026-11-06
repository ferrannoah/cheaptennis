import { text, font } from './text';

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.78, r = 14): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = `rgba(12,22,42,${alpha})`;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
  ctx.stroke();
  ctx.restore();
}

export interface MenuItem {
  label: string;
  value?: string;
  disabled?: boolean;
  hint?: string;
}

/** Draws a vertical list of menu items with a highlighted selection. */
export function menuList(
  ctx: CanvasRenderingContext2D,
  items: MenuItem[],
  sel: number,
  x: number,
  y: number,
  w: number,
  rowH = 30,
  size = 18,
  t = 0,
): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const yy = y + i * rowH;
    if (i === sel) {
      const pulse = 0.85 + Math.sin(t * 6) * 0.08;
      ctx.save();
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, `rgba(255,170,40,${0.95 * pulse})`);
      g.addColorStop(1, `rgba(255,120,30,${0.85 * pulse})`);
      ctx.fillStyle = g;
      roundRect(ctx, x, yy - rowH / 2 + 2, w, rowH - 4, (rowH - 4) / 2);
      ctx.fill();
      ctx.restore();
    }
    const col = it.disabled ? 'rgba(255,255,255,0.35)' : '#fff';
    if (it.value !== undefined) {
      text(ctx, it.label, x + 16, yy, { size, color: col });
      text(ctx, (i === sel ? '◀ ' : '') + it.value + (i === sel ? ' ▶' : ''), x + w - 14, yy, {
        size, color: i === sel ? '#fff' : '#ffd479', align: 'right',
      });
    } else {
      text(ctx, it.label, x + w / 2, yy, { size, color: col, align: 'center' });
    }
  }
}

/** Orange stat bar rated 1..10 */
export function statBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rating: number, ghost?: number): void {
  const seg = 10;
  const gap = 2;
  const sw = (w - gap * (seg - 1)) / seg;
  for (let i = 0; i < seg; i++) {
    const sx = x + i * (sw + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, sx, y, sw, h, 2);
    ctx.fill();
    if (ghost !== undefined && i < ghost && i >= rating) {
      ctx.fillStyle = 'rgba(255,170,60,0.28)';
      roundRect(ctx, sx, y, sw, h, 2);
      ctx.fill();
    }
    if (i < rating) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#ffc04a');
      g.addColorStop(1, '#ff7a1a');
      ctx.fillStyle = g;
      roundRect(ctx, sx, y, sw, h, 2);
      ctx.fill();
    }
  }
}

/** continuous 0..99 bar with cap ghost */
export function valueBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, cap?: number, color = '#ff9a2a'): void {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (cap !== undefined) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, x, y, (w * cap) / 99, h, h / 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(h, (w * v) / 99), h, h / 2);
  ctx.fill();
}

export function keycap(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, size = 12): number {
  ctx.save();
  ctx.font = font(size);
  const w = Math.max(size * 1.6, ctx.measureText(label).width + size);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, x, y - size * 0.8, w, size * 1.6, 4);
  ctx.fill();
  ctx.restore();
  text(ctx, label, x + w / 2, y + 0.5, { size, color: '#16243c', align: 'center' });
  return w;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}
export function easeOutBack(t: number): number {
  t = Math.min(1, Math.max(0, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
