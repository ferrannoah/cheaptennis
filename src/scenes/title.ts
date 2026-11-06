import { game, W, H } from '../core/game';
import { MenuScene, MenuEntry } from './menu-base';
import { drawBackdrop, drawLogo } from '../gfx/backdrop';
import { panel, menuList, easeOutCubic, roundRect } from '../gfx/ui';
import { text } from '../gfx/text';
import { audio } from '../core/audio';
import { input } from '../core/input';
import { settings } from '../core/settings';
import { goExhibition, goTournament, goCareer, goVersus, goPractice, goOptions } from './nav';

export class TitleScene extends MenuScene {
  name = 'title';
  enterT = 0;
  items(): MenuEntry[] {
    return [
      { id: 'exhibition', label: 'Exhibition', action: () => goExhibition() },
      { id: 'tournament', label: 'Tournament', action: () => goTournament() },
      { id: 'career', label: 'Career', action: () => goCareer() },
      { id: 'versus', label: 'Versus', action: () => goVersus() },
      { id: 'practice', label: 'Practice', action: () => goPractice() },
      { id: 'options', label: 'Options', action: () => goOptions() },
    ];
  }
  enter(): void {
    audio.playSong('title');
  }
  extraUpdate(): void {
    this.enterT += 1 / 60;
    if (input.keyPressed('KeyM')) audio.toggleMute();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.t;
    drawBackdrop(ctx, t, 'grass');
    const k = easeOutCubic(this.enterT * 2.2);
    drawLogo(ctx, W / 2 - 18, 70 - (1 - k) * 60, 62, t);
    text(ctx, 'WORLD TOUR TENNIS', W / 2, 124, { size: 14, align: 'center', color: '#13284a', alpha: k, weight: 900 });
    // menu panel
    const pw = 220, ph = 222;
    const px = 34 - (1 - k) * 260;
    const py = 150;
    ctx.save();
    ctx.globalAlpha = k;
    panel(ctx, px, py, pw, ph);
    menuList(ctx, this.items(), this.sel, px + 18, py + 30, pw - 36, 32, 19, t);
    ctx.restore();
    // how to play
    ctx.fillStyle = 'rgba(10,20,40,0.7)';
    roundRect(ctx, 34, 388, W - 68, 76, 12);
    ctx.fill();
    text(ctx, 'HOW TO PLAY', 50, 404, { size: 12, color: '#ffc04a' });
    text(ctx, 'Arrows move  •  Space swings (time it as the ball arrives)  •  hold an arrow at contact to aim', 50, 424, { size: 11, weight: 700 });
    text(ctx, 'Z topspin  •  X slice  •  C lob  •  V drop shot  •  Serve: Space to toss, Space again at the top', 50, 442, { size: 11, weight: 700 });
    text(ctx, `M mute ${settings.muted ? '(muted)' : ''}  •  Esc pause`, 50, 458, { size: 9, weight: 700, color: '#bcd0ee' });
    if (audio.state === 'locked') {
      const a = 0.6 + Math.sin(t * 4) * 0.4;
      text(ctx, '♪ press any key for sound', W - 44, 404, { size: 10, align: 'right', alpha: a, color: '#d8f0ff' });
    }
  }
}
