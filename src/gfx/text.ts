export const FONT_STACK = '"Arial Rounded MT Bold", "Nunito", "Trebuchet MS", "Segoe UI", Verdana, sans-serif';

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  outline?: string | null;
  outlineWidth?: number;
  weight?: number;
  shadow?: boolean;
  alpha?: number;
  maxWidth?: number;
}

export function font(size: number, weight = 800): string {
  return `${weight} ${size}px ${FONT_STACK}`;
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOpts = {}): void {
  const size = o.size ?? 16;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.font = font(size, o.weight ?? 800);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  if (o.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(str, x + size * 0.06, y + size * 0.09, o.maxWidth);
  }
  if (o.outline) {
    ctx.strokeStyle = o.outline;
    ctx.lineWidth = o.outlineWidth ?? Math.max(2, size * 0.18);
    ctx.strokeText(str, x, y, o.maxWidth);
  }
  ctx.fillStyle = o.color ?? '#fff';
  ctx.fillText(str, x, y, o.maxWidth);
  ctx.restore();
}

export function measure(ctx: CanvasRenderingContext2D, str: string, size: number, weight = 800): number {
  ctx.save();
  ctx.font = font(size, weight);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** word-wrap text into lines that fit maxWidth */
export function wrap(ctx: CanvasRenderingContext2D, str: string, size: number, maxWidth: number, weight = 700): string[] {
  ctx.save();
  ctx.font = font(size, weight);
  const out: string[] = [];
  for (const para of str.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  ctx.restore();
  return out;
}
