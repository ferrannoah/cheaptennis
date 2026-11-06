import { game, W, H } from '../core/game';

/** A cached offscreen layer rendered at the display resolution, re-rendered on resize. */
export class Layer {
  canvas: HTMLCanvasElement | null = null;
  private res = 0;
  constructor(private render: (ctx: CanvasRenderingContext2D) => void, private w = W, private h = H) {}

  invalidate(): void {
    this.res = 0;
  }

  get(): HTMLCanvasElement {
    const res = game ? game.res : 1;
    if (!this.canvas || this.res !== res) {
      this.res = res;
      const c = this.canvas ?? document.createElement('canvas');
      c.width = Math.ceil(this.w * res);
      c.height = Math.ceil(this.h * res);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      this.render(ctx);
      this.canvas = c;
    }
    return this.canvas;
  }

  draw(ctx: CanvasRenderingContext2D, x = 0, y = 0): void {
    ctx.drawImage(this.get(), x, y, this.w, this.h);
  }
}
