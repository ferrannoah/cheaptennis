import { game, W, H } from '../core/game';
import { MenuScene, MenuEntry, cycle } from './menu-base';
import { drawSetupScreen } from './setup-common';
import { SurfaceId, SURFACES } from '../data/surfaces';
import { FORMATS, FormatId } from '../match/scoring';
import { humanSetup, P2_KIT } from '../data/defaults';
import { Controller, input } from '../core/input';
import { MatchScene } from './match';
import { ResultScene } from './result';
import { StatCardScene } from './statcard';
import { TitleScene } from './title';
import { SURF_IDS } from './exhibition';
import { settings, keyLabel } from '../core/settings';
import { text } from '../gfx/text';
import { rng } from '../core/rng';

type Dev = 'kb' | 'pad0' | 'pad1';
const DEVS: Dev[] = ['kb', 'pad0', 'pad1'];
const V_FORMATS: FormatId[] = ['1game', '3games', 'set', 'bo3'];

export class VersusSetup extends MenuScene {
  name = 'versus';
  d1: Dev = 'kb';
  d2: Dev = 'kb';
  surface: SurfaceId = 'grass';
  format: FormatId = '3games';
  devLabel(d: Dev, p: 1 | 2): string {
    if (d === 'kb') return p === 1 ? 'Keyboard (WASD + F G H J K)' : 'Keyboard (Arrows + 1-5)';
    const i = d === 'pad0' ? 0 : 1;
    return `Gamepad ${i + 1}${input.pad(i) ? '' : ' (not found)'}`;
  }
  items(): MenuEntry[] {
    return [
      { id: 'p1', label: 'P1 (near)', value: this.devLabel(this.d1, 1), change: (d) => (this.d1 = cycle(DEVS, this.d1, d)) },
      { id: 'p2', label: 'P2 (far)', value: this.devLabel(this.d2, 2), change: (d) => (this.d2 = cycle(DEVS, this.d2, d)) },
      { id: 'surface', label: 'Surface', value: SURFACES[this.surface].name, change: (d) => (this.surface = cycle(SURF_IDS, this.surface, d)) },
      { id: 'length', label: 'Length', value: FORMATS[this.format].label, change: (d) => (this.format = cycle(V_FORMATS, this.format, d)) },
      { id: 'start', label: 'Start Versus', action: () => this.start() },
      { id: 'back', label: 'Back', action: () => game.goto(new TitleScene()) },
    ];
  }
  onBack(): void {
    game.goto(new TitleScene());
  }
  controller(d: Dev, p: 1 | 2): Controller {
    if (d === 'kb') return new Controller('p' + p, p === 1 ? 'vs1' : 'vs2', null);
    return new Controller('p' + p, null, d === 'pad0' ? 0 : 1);
  }
  start(): void {
    const a = humanSetup('Player 1', 'P1');
    const b = humanSetup('Player 2', 'P2', P2_KIT);
    const c1 = this.controller(this.d1, 1);
    const c2 = this.controller(this.d2, 2);
    const surface = this.surface;
    const fmt = this.format;
    const go = () =>
      game.goto(new MatchScene({ surface, format: FORMATS[fmt].f, players: [a, b], controllers: [c1, c2], difficulty: settings.difficulty, seed: Math.floor(rng.next() * 1e9) }, {
        title: 'VERSUS',
        onEnd: (r) => game.goto(new ResultScene(r, [a, b], go, () => game.goto(new VersusSetup()))),
      }));
    game.goto(new StatCardScene(a, b, surface, `VERSUS • ${FORMATS[fmt].label}`, go, () => game.goto(this)));
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawSetupScreen(ctx, this.t, 'VERSUS', this.items(), this.sel, '', this.surface);
    const k1 = settings.keys.vs1, k2 = settings.keys.vs2;
    const l = (k: typeof k1) => `${['up', 'left', 'down', 'right'].map((a) => keyLabel(k[a as 'up'][0])).join('')} move  •  ${keyLabel(k.normal[0])} shot  ${keyLabel(k.topspin[0])} top  ${keyLabel(k.slice[0])} slice  ${keyLabel(k.lob[0])} lob  ${keyLabel(k.drop[0])} drop`;
    text(ctx, 'P1: ' + l(k1), W / 2, H - 58, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.85)', weight: 700 });
    text(ctx, 'P2: ' + l(k2), W / 2, H - 40, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.85)', weight: 700 });
  }
}
