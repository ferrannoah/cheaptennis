import { Scene, W, H } from '../core/game';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { drawBackdrop } from '../gfx/backdrop';
import { drawTrophy } from '../gfx/trophy';
import { text } from '../gfx/text';
import { panel } from '../gfx/ui';

interface Conf { x: number; y: number; vx: number; vy: number; r: number; c: string; s: number }

export class TrophyScene implements Scene {
  name = 'trophy';
  t = 0;
  conf: Conf[] = [];
  constructor(public title: string, public sub: string, public onDone: () => void, public kind: 'cup' | 'plate' | 'bowl' = 'cup', public lines: string[] = []) {}
  enter(): void {
    audio.playSong('trophy', false);
    audio.sfx('applause_big', 1);
    const cols = ['#ffd23a', '#ff6a6a', '#6ad0ff', '#9ef07a', '#ff9ae0', '#ffffff'];
    for (let i = 0; i < 160; i++) {
      this.conf.push({ x: Math.random() * W, y: -Math.random() * H, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 70, r: Math.random() * 6, c: cols[i % cols.length], s: 3 + Math.random() * 4 });
    }
  }
  update(): void {
    this.t += 1 / 60;
    for (const c of this.conf) {
      c.x += c.vx / 60;
      c.y += c.vy / 60;
      c.r += 0.1;
      if (c.y > H + 10) {
        c.y = -10;
        c.x = Math.random() * W;
      }
    }
    if (this.t > 1 && input.menu('ok')) {
      audio.sfx('menu_ok');
      this.onDone();
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx, this.t, 'grass', true);
    ctx.fillStyle = 'rgba(6,12,26,0.35)';
    ctx.fillRect(0, 0, W, H);
    // rays
    ctx.save();
    ctx.translate(W / 2, 250);
    ctx.rotate(this.t * 0.2);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      ctx.fillStyle = 'rgba(255,230,140,0.10)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-40, -420);
      ctx.lineTo(40, -420);
      ctx.fill();
    }
    ctx.restore();
    const bounce = Math.min(1, this.t * 1.5);
    drawTrophy(ctx, W / 2, 320, 170 * (0.6 + 0.4 * bounce), this.t * 1.6, 'gold', this.kind);
    text(ctx, 'CHAMPION!', W / 2, 62, { size: 46, align: 'center', color: '#ffd23a', outline: '#13284a', outlineWidth: 10 });
    text(ctx, this.title, W / 2, 104, { size: 18, align: 'center', outline: '#13284a', outlineWidth: 6 });
    if (this.lines.length) {
      panel(ctx, W / 2 - 200, 346, 400, 22 + this.lines.length * 18, 0.7);
      this.lines.forEach((l, i) => text(ctx, l, W / 2, 360 + i * 18, { size: 12, align: 'center', weight: 700 }));
    }
    text(ctx, this.sub, W / 2, 128, { size: 13, align: 'center', color: '#ffe9a8', outline: '#13284a', outlineWidth: 5 });
    for (const c of this.conf) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.s / 2, -c.s / 4, c.s, (c.s / 2) * Math.abs(Math.sin(c.r * 2)) + 1);
      ctx.restore();
    }
    if (this.t > 1 && Math.sin(this.t * 5) > -0.3) text(ctx, 'Press Space', W / 2, H - 30, { size: 18, align: 'center', outline: '#13284a' });
  }
}
