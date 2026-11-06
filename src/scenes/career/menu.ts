import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry } from '../menu-base';
import { drawSetupScreen } from '../setup-common';
import { loadCareer, importCareer, saveCareer, seasonOf, weekOfSeason, CareerState } from '../../career/state';
import { rehydrate } from '../../career/flow';
import { TitleScene } from '../title';
import { CreateScene } from './create';
import { HubScene } from './hub';
import { text } from '../../gfx/text';
import { audio } from '../../core/audio';

export class CareerMenu extends MenuScene {
  name = 'careermenu';
  save: CareerState | null;
  msg = '';
  confirmNew = false;
  constructor() {
    super();
    this.save = loadCareer();
  }
  items(): MenuEntry[] {
    const it: MenuEntry[] = [];
    if (this.save) {
      const s = this.save;
      it.push({ id: 'continue', label: `Continue: ${s.player.name} (${s.playerRank ? '#' + s.playerRank : 'unranked'}, S${seasonOf(s.week)} W${weekOfSeason(s.week)})`, action: () => openCareer(s) });
    }
    it.push({
      id: 'new', label: this.confirmNew ? 'Really overwrite your save? Press again' : 'New career', action: () => {
        if (this.save && !this.confirmNew) {
          this.confirmNew = true;
          return;
        }
        game.goto(new CreateScene());
      },
    });
    it.push({
      id: 'import', label: 'Import career (JSON file)', action: () =>
        importCareer((s, err) => {
          if (s) {
            rehydrate(s);
            saveCareer(s);
            this.save = s;
            this.msg = 'Career imported!';
            audio.sfx('ding');
          } else this.msg = err ?? 'Import failed';
        }),
    });
    it.push({ id: 'back', label: 'Back', action: () => game.goto(new TitleScene()) });
    return it;
  }
  onBack(): void {
    game.goto(new TitleScene());
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawSetupScreen(ctx, this.t, 'CAREER', this.items(), this.sel, 'Start unranked. Climb the tour. Win the four Majors.', 'clay');
    if (this.msg) text(ctx, this.msg, W / 2, H - 44, { size: 13, align: 'center', color: '#9ef07a', outline: '#13284a' });
  }
}

export function openCareer(s: CareerState): void {
  rehydrate(s);
  game.goto(new HubScene(s));
}
