import { Scene, W, H } from '../core/game';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { PlayerSetup, rating10, ovr } from '../data/types';
import { SurfaceId, SURFACES } from '../data/surfaces';
import { courtLayer } from '../gfx/match-view';
import { panel, statBar, roundRect, easeOutBack } from '../gfx/ui';
import { text } from '../gfx/text';
import { drawFigure, POSES } from '../gfx/player-renderer';
import { ARCHETYPES } from '../data/archetypes';
import { BADGES } from '../data/badges';
import { TACTICS, blendLabel, dominant } from '../data/tactics';

/** Pre-match stat comparison card. */
export class StatCardScene implements Scene {
  name = 'statcard';
  t = 0;
  constructor(
    public a: PlayerSetup,
    public b: PlayerSetup,
    public surface: SurfaceId,
    public subtitle: string,
    public onStart: () => void,
    public onBack?: () => void,
  ) {}

  enter(): void {
    audio.playSong('hub');
  }

  update(): void {
    this.t += 1 / 60;
    if (this.t > 0.3 && input.menu('ok')) {
      audio.sfx('menu_ok');
      this.onStart();
    } else if (input.menu('back') && this.onBack) {
      audio.sfx('menu_back');
      this.onBack();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    courtLayer(this.surface).draw(ctx);
    ctx.fillStyle = 'rgba(6,12,26,0.45)';
    ctx.fillRect(0, 0, W, H);
    const k = easeOutBack(this.t * 3);
    const pw = 560, ph = 312;
    const px = (W - pw) / 2, py = 52;
    ctx.save();
    ctx.translate(W / 2, py + ph / 2);
    ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    ctx.globalAlpha = Math.min(1, this.t * 5);
    ctx.translate(-W / 2, -(py + ph / 2));
    panel(ctx, px, py, pw, ph, 0.86);
    text(ctx, this.subtitle, W / 2, py + 22, { size: 13, align: 'center', color: '#ffc04a' });
    text(ctx, `${SURFACES[this.surface].name} court`, W / 2, py + 40, { size: 11, align: 'center', color: '#bcd0ee', weight: 700 });
    text(ctx, 'VS', W / 2, py + 92, { size: 34, align: 'center', color: '#ffb02e', outline: '#13284a' });
    this.side(ctx, this.a, px + 24, py + 56, false);
    this.side(ctx, this.b, px + pw / 2 + 24, py + 56, true);
    const labels = ['Forehand', 'Backhand', 'Serve', 'Footwork'];
    const keys = ['forehand', 'backhand', 'serve', 'footwork'] as const;
    for (let i = 0; i < 4; i++) {
      const y = py + 190 + i * 30;
      text(ctx, labels[i], W / 2, y + 5, { size: 12, align: 'center', color: '#fff' });
      statBar(ctx, px + 40, y, 190, 11, rating10(this.a.stats[keys[i]]));
      statBar(ctx, px + pw - 230, y, 190, 11, rating10(this.b.stats[keys[i]]));
    }
    ctx.restore();
    const blink = Math.sin(this.t * 5) > -0.3;
    if (blink) text(ctx, 'Press Space', W / 2, py + ph + 34, { size: 20, align: 'center', outline: '#13284a' });
  }

  private side(ctx: CanvasRenderingContext2D, p: PlayerSetup, x: number, y: number, right: boolean): void {
    // portrait
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, x, y, 66, 100, 10);
    ctx.fill();
    drawFigure(ctx, x + 33, y + 96, 50, POSES.ready, p.kit, { mirror: p.hand === 'L', facingCamera: true, twoHanded: p.twoHanded, bob: 0 });
    text(ctx, p.name, x + 76, y + 14, { size: 16, maxWidth: 170 });
    text(ctx, ARCHETYPES[p.archetype].name, x + 76, y + 34, { size: 11, color: '#bcd0ee', weight: 700 });
    text(ctx, `${p.hand === 'R' ? 'Right' : 'Left'}-handed${p.city ? '  •  ' + p.city : ''}`, x + 76, y + 50, { size: 10, color: '#bcd0ee', weight: 700, maxWidth: 170 });
    text(ctx, `OVR ${ovr(p.stats)}`, x + 76, y + 74, { size: 18, color: '#ffc04a' });
    if (p.tactics) {
      const label = p.tacticsFixed ? `${TACTICS[dominant(p.tactics)].name} (forced)` : blendLabel(p.tactics, 2);
      text(ctx, 'GAME PLAN', x, y + 114, { size: 9, color: '#ffc04a' });
      text(ctx, label, x + 62, y + 114, { size: 9, weight: 700, color: '#d6e4f7', maxWidth: 196 });
    } else {
      text(ctx, 'GAME PLAN', x, y + 114, { size: 9, color: '#ffc04a' });
      text(ctx, 'yours to decide', x + 62, y + 114, { size: 9, weight: 700, color: '#d6e4f7' });
    }
    let bx = x + 76;
    for (const id of p.badges.slice(0, 3)) {
      const b = BADGES[id];
      if (!b) continue;
      ctx.fillStyle = b.color;
      roundRect(ctx, bx, y + 88, 52, 14, 7);
      ctx.fill();
      text(ctx, b.short, bx + 26, y + 95, { size: 8, align: 'center', color: '#13284a' });
      bx += 56;
    }
    void right;
  }
}
