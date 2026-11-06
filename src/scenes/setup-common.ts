import { W, H } from '../core/game';
import { drawBackdrop } from '../gfx/backdrop';
import { panel, menuList, MenuItem } from '../gfx/ui';
import { text } from '../gfx/text';

/** Standard setup screen layout: backdrop, title, panel with options. */
export function drawSetupScreen(ctx: CanvasRenderingContext2D, t: number, title: string, items: MenuItem[], sel: number, hint = '', sf: 'grass' | 'clay' | 'hard' = 'grass'): void {
  drawBackdrop(ctx, t, sf, false);
  ctx.fillStyle = 'rgba(6,12,26,0.25)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, 50, { size: 34, align: 'center', outline: '#13284a', outlineWidth: 8 });
  const pw = 400;
  const ph = items.length * 34 + 36;
  const px = (W - pw) / 2;
  const py = Math.max(84, (H - ph) / 2 + 10);
  panel(ctx, px, py, pw, ph);
  menuList(ctx, items, sel, px + 18, py + 34, pw - 36, 34, 17, t);
  const cur = items[sel];
  const h = cur?.hint && !cur.hint.startsWith('#') ? cur.hint : hint;
  if (h) text(ctx, h, W / 2, H - 22, { size: 12, align: 'center', color: '#ffffff', outline: 'rgba(10,20,40,0.8)', weight: 700 });
}
