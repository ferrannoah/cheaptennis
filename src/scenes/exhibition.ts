import { game } from '../core/game';
import { MenuScene, MenuEntry, cycle } from './menu-base';
import { drawSetupScreen } from './setup-common';
import { settings, saveSettings, Difficulty } from '../core/settings';
import { SurfaceId, SURFACES } from '../data/surfaces';
import { FORMATS, FormatId } from '../match/scoring';
import { roster, proSetup, proOvr, Pro } from '../data/roster';
import { humanSetup } from '../data/defaults';
import { StatCardScene } from './statcard';
import { MatchScene } from './match';
import { ResultScene } from './result';
import { Controller } from '../core/input';
import { rng } from '../core/rng';
import { TitleScene } from './title';
import { ARCHETYPES } from '../data/archetypes';
import { TACTICS, TACTIC_IDS, TacticId, TacticBlend, normalize, pureBlend } from '../data/tactics';
import { venueFor } from '../data/venues';

type PlanChoice = 'auto' | 'random' | TacticId;
const PLANS: PlanChoice[] = ['auto', ...TACTIC_IDS, 'random'];

export const SURF_IDS: SurfaceId[] = ['grass', 'clay', 'hard'];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'pro'];
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', pro: 'Pro' };
const EX_FORMATS: FormatId[] = ['1game', '3games', 'set', 'bo3'];

export class ExhibitionSetup extends MenuScene {
  name = 'exhibition';
  surface: SurfaceId = 'grass';
  format: FormatId = '3games';
  oppIdx = -1; // -1 random
  plan: PlanChoice = 'auto';
  night = false;
  pool: Pro[];
  constructor() {
    super();
    this.pool = roster().slice(0, 60);
  }
  items(): MenuEntry[] {
    const opp = this.oppIdx < 0 ? 'Random' : `${this.pool[this.oppIdx].first[0]}. ${this.pool[this.oppIdx].last} (${proOvr(this.pool[this.oppIdx])})`;
    return [
      { id: 'surface', label: 'Surface', value: SURFACES[this.surface].name, change: (d) => (this.surface = cycle(SURF_IDS, this.surface, d)), hint: 'Grass is fast and low, clay slow and high, hard in between' },
      { id: 'length', label: 'Length', value: FORMATS[this.format].label, change: (d) => (this.format = cycle(EX_FORMATS, this.format, d)) },
      {
        id: 'opponent', label: 'Opponent', value: opp, change: (d) => {
          this.oppIdx += d;
          if (this.oppIdx < -1) this.oppIdx = this.pool.length - 1;
          if (this.oppIdx >= this.pool.length) this.oppIdx = -1;
        },
        hint: this.oppIdx >= 0 ? ARCHETYPES[this.pool[this.oppIdx].archetype].name + ': ' + ARCHETYPES[this.pool[this.oppIdx].archetype].desc : 'A random tour pro',
      },
      {
        id: 'plan', label: 'COM game plan', value: this.plan === 'auto' ? 'Natural blend' : this.plan === 'random' ? 'Random blend' : TACTICS[this.plan].name,
        change: (d) => (this.plan = cycle(PLANS, this.plan, d)),
        hint: this.plan === 'auto' ? "The pro's own mix of tactics; adapts during the match" : this.plan === 'random' ? 'A random mix of all five tactics; adapts during the match' : `${TACTICS[this.plan].desc} (forced, no adapting)`,
      },
      { id: 'difficulty', label: 'Difficulty', value: DIFF_LABEL[settings.difficulty], change: (d) => { settings.difficulty = cycle(DIFFS, settings.difficulty, d); saveSettings(); }, hint: 'Difficulty adjusts COM stats and timing, never the physics' },
      {
        id: 'session', label: 'Session', value: this.surface === 'hard' && this.night ? 'Night' : 'Day',
        change: () => { if (this.surface === 'hard') this.night = !this.night; },
        hint: this.surface === 'hard' ? 'Play under the lights in the night session' : 'Night sessions are played on hard courts',
      },
      { id: 'start', label: 'Start Match', action: () => this.start() },
      { id: 'back', label: 'Back', action: () => game.goto(new TitleScene()) },
    ];
  }
  onBack(): void {
    game.goto(new TitleScene());
  }
  start(): void {
    const pro = this.oppIdx < 0 ? this.pool[Math.floor(rng.next() * 40) + 10] : this.pool[this.oppIdx];
    const a = humanSetup();
    const b = proSetup(pro);
    if (this.plan === 'random') {
      const blend = {} as TacticBlend;
      for (const k of TACTIC_IDS) blend[k] = rng.next() ** 2;
      b.tactics = normalize(blend);
    } else if (this.plan !== 'auto') {
      b.tactics = pureBlend(this.plan);
      b.tacticsFixed = true;
    }
    const surface = this.surface;
    const format = FORMATS[this.format].f;
    const venue = venueFor(surface, { tier: 'tour', stage: 0.45, night: surface === 'hard' && this.night });
    const startMatch = () => {
      game.goto(new MatchScene({
        surface, format, players: [a, b], controllers: [new Controller('p1', 'solo', 0), null], difficulty: settings.difficulty,
        seed: Math.floor(rng.next() * 1e9), venue,
      }, {
        title: 'EXHIBITION',
        onEnd: (r) => game.goto(new ResultScene(r, [a, b], () => startMatch(), () => game.goto(new ExhibitionSetup()))),
      }));
    };
    game.goto(new StatCardScene(a, b, surface, `EXHIBITION  •  ${FORMATS[this.format].label}`, startMatch, () => game.goto(this)));
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawSetupScreen(ctx, this.t, 'EXHIBITION', this.items(), this.sel, '', this.surface);
  }
}
