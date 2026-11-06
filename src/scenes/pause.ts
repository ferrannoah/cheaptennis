import { game, W, H } from '../core/game';
import { MenuScene, MenuEntry } from './menu-base';
import { panel, menuList } from '../gfx/ui';
import { text } from '../gfx/text';
import { settings, saveSettings } from '../core/settings';
import { audio } from '../core/audio';
import { input } from '../core/input';
import type { MatchScene } from './match';

export class PauseScene extends MenuScene {
  name = 'pause';
  overlay = true;
  constructor(private ms: MatchScene) {
    super();
  }
  items(): MenuEntry[] {
    return [
      { id: 'resume', label: 'Resume', action: () => game.pop() },
      { id: 'hud', label: 'Training HUD', value: settings.trainingHud ? 'ON' : 'OFF', change: () => { settings.trainingHud = !settings.trainingHud; saveSettings(); } },
      { id: 'mute', label: 'Sound', value: settings.muted ? 'MUTED' : 'ON', change: () => audio.toggleMute() },
      {
        id: 'quit', label: this.ms.opts.onQuit ? 'Retire (forfeit)' : 'Quit to menu', action: () => {
          game.pop();
          if (this.ms.opts.onQuit) this.ms.opts.onQuit();
          else this.ms.opts.onEnd(this.ms.result(true));
        },
      },
    ];
  }
  onBack(): void {
    game.pop();
  }
  extraUpdate(): void {
    if (input.menu('pause') && this.t > 0.1) game.pop();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(5,10,20,0.45)';
    ctx.fillRect(0, 0, W, H);
    const w = 280, h = 200;
    const x = (W - w) / 2, y = (H - h) / 2;
    panel(ctx, x, y, w, h);
    text(ctx, 'PAUSED', W / 2, y + 30, { size: 24, align: 'center' });
    menuList(ctx, this.items(), this.sel, x + 20, y + 72, w - 40, 32, 16, this.t);
  }
}
