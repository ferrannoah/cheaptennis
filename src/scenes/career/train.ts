import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry } from '../menu-base';
import { CareerState } from '../../career/state';
import { finishWeek } from '../../career/flow';
import { careerFrame, careerSetup } from './common';
import { panel, menuList } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { HubScene } from './hub';
import { PROGRESSION } from '../../data/tour';
import { MatchScene } from '../match';
import { roster, proSetup } from '../../data/roster';
import { Controller } from '../../core/input';
import { settings } from '../../core/settings';
import { ShotType } from '../../data/types';

const DRILL_FRAMES = 45 * 60;

export class TrainScene extends MenuScene {
  name = 'train';
  constructor(public s: CareerState) {
    super();
  }
  items(): MenuEntry[] {
    return [
      { id: 'quick', label: `Quick training (+${PROGRESSION.trainXp} XP)`, action: () => this.quick() },
      { id: 'drill-rally', label: 'Play drill: rally (45 s, score = XP)', action: () => this.drill('random') },
      { id: 'drill-top', label: 'Play drill: topspin feeds', action: () => this.drill('topspin') },
      { id: 'drill-slice', label: 'Play drill: slice feeds', action: () => this.drill('slice') },
      { id: 'back', label: 'Back', action: () => game.goto(new HubScene(this.s)) },
    ];
  }
  onBack(): void {
    game.goto(new HubScene(this.s));
  }
  quick(): void {
    const msgs = finishWeek(this.s, 'train', PROGRESSION.trainXp);
    game.goto(new HubScene(this.s, msgs));
  }
  drill(type: ShotType | 'random'): void {
    const s = this.s;
    let frames = 0;
    let ended = false;
    const end = (m: MatchScene['m']) => {
      if (ended) return;
      ended = true;
      const xp = Math.min(PROGRESSION.trainDrillMaxXp, 60 + m.practiceHits * 8 + m.players[0].perfects * 14);
      const msgs = finishWeek(s, 'train', xp);
      msgs.unshift(`Drill score: ${m.practiceHits} hits, ${m.players[0].perfects} PERFECT`);
      game.goto(new HubScene(s, msgs));
    };
    const ms = new MatchScene({
      surface: 'hard', format: { kind: 'games', target: 99 }, players: [careerSetup(s.player), proSetup(roster()[0], 'MACHINE')],
      controllers: [new Controller('p1', 'solo', 0), null], difficulty: settings.difficulty, seed: s.week, practice: { type, side: 'mix', speed: 1, interval: 60 },
    }, {
      onEnd: () => {},
      onQuit: () => end(ms.m),
      onUpdate: (m) => {
        frames++;
        if (frames >= DRILL_FRAMES) end(m);
      },
      practiceOverlay: (ctx) => {
        panel(ctx, W / 2 - 110, 8, 220, 40, 0.8);
        text(ctx, `TRAINING DRILL  ${Math.max(0, Math.ceil((DRILL_FRAMES - frames) / 60))}s`, W / 2, 28, { size: 14, align: 'center', color: '#ffc04a' });
      },
    });
    game.goto(ms);
  }
  draw(ctx: CanvasRenderingContext2D): void {
    careerFrame(ctx, this.t, this.s, 'TRAINING');
    const items = this.items();
    panel(ctx, (W - 380) / 2, 120, 380, items.length * 32 + 20);
    menuList(ctx, items, this.sel, (W - 380) / 2 + 14, 142, 352, 32, 15, this.t);
    text(ctx, 'Training uses up the week. Play a drill for more XP: every hit and PERFECT counts.', W / 2, H - 30, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
  }
}
