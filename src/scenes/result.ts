import { Scene, W, H, game } from '../core/game';
import { MenuScene, MenuEntry } from './menu-base';
import { MatchResult } from './match';
import { PlayerSetup } from '../data/types';
import { drawBackdrop } from '../gfx/backdrop';
import { panel, menuList } from '../gfx/ui';
import { text } from '../gfx/text';
import { audio } from '../core/audio';

export class ResultScene extends MenuScene {
  name = 'result';
  constructor(
    public r: MatchResult,
    public players: [PlayerSetup, PlayerSetup],
    public onRematch: (() => void) | null,
    public onContinue: () => void,
    public continueLabel = 'Continue',
  ) {
    super();
  }
  enter(): void {
    audio.playSong('hub');
  }
  items(): MenuEntry[] {
    const it: MenuEntry[] = [];
    if (this.onRematch) it.push({ id: 'rematch', label: 'Rematch', action: () => this.onRematch!() });
    it.push({ id: 'continue', label: this.continueLabel, action: () => this.onContinue() });
    return it;
  }
  onBack(): void {
    this.onContinue();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx, this.t, 'grass', true);
    const r = this.r;
    const w = this.players[r.winner];
    const pw = 440, ph = 300;
    const px = (W - pw) / 2, py = 70;
    panel(ctx, px, py, pw, ph, 0.85);
    text(ctx, r.quit ? 'MATCH ABANDONED' : 'MATCH RESULT', W / 2, py + 28, { size: 14, align: 'center', color: '#ffc04a' });
    text(ctx, r.quit ? '' : w.name === 'You' ? 'You win!' : `${w.name} wins`, W / 2, py + 62, { size: 26, align: 'center' });
    text(ctx, r.summary || '-', W / 2, py + 94, { size: 20, align: 'center', color: '#ffd479' });
    const rows: [string, number, number][] = [
      ['PERFECT shots', r.perfects[0], r.perfects[1]],
      ['Aces', r.aces[0], r.aces[1]],
      ['Long rallies won', r.longRallyWins[0], r.longRallyWins[1]],
      ['Break points saved', r.breakSaved[0], r.breakSaved[1]],
    ];
    text(ctx, this.players[0].short, px + 150, py + 128, { size: 12, align: 'center', color: '#bcd0ee' });
    text(ctx, this.players[1].short, px + pw - 70, py + 128, { size: 12, align: 'center', color: '#bcd0ee' });
    rows.forEach(([l, a, b], i) => {
      const y = py + 150 + i * 22;
      text(ctx, l, px + 30, y, { size: 12, weight: 700, color: '#fff' });
      text(ctx, String(a), px + 150, y, { size: 13, align: 'center' });
      text(ctx, String(b), px + pw - 70, y, { size: 13, align: 'center' });
    });
    const items = this.items();
    menuList(ctx, items, this.sel, px + 90, py + ph - 20 - (items.length - 1) * 30, pw - 180, 30, 16, this.t);
  }
}

export type { Scene };
void game;
void H;
