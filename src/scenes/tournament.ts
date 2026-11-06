import { game, W, H } from '../core/game';
import { MenuScene, MenuEntry, cycle } from './menu-base';
import { drawSetupScreen } from './setup-common';
import { settings, saveSettings, Difficulty } from '../core/settings';
import { SurfaceId, SURFACES } from '../data/surfaces';
import { FORMATS, FormatId } from '../match/scoring';
import { roster, proSetup, proName, Pro, proBlend } from '../data/roster';
import { humanSetup, HUMAN_STATS } from '../data/defaults';
import { ovr, PlayerSetup, STAT_KEYS } from '../data/types';
import { Bracket, Entrant, roundName, flipScore, BMatch } from '../sim/bracket';
import { Rng } from '../core/rng';
import { rng } from '../core/rng';
import { StatCardScene } from './statcard';
import { MatchScene } from './match';
import { ResultScene } from './result';
import { TrophyScene } from './trophy';
import { TitleScene } from './title';
import { Controller } from '../core/input';
import { drawBackdrop } from '../gfx/backdrop';
import { panel, menuList, roundRect } from '../gfx/ui';
import { text } from '../gfx/text';
import { audio } from '../core/audio';
import { simMatch } from '../sim/match-sim';
import { SURF_IDS } from './exhibition';
import { venueFor, stageFromDraw } from '../data/venues';

const DRAWS = [8, 16, 32];
const T_FORMATS: FormatId[] = ['1game', '3games', 'set', 'bo3'];
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'pro'];
const DIFF_STAT: Record<Difficulty, number> = { easy: -16, normal: -5, hard: 3, pro: 9 };
const EVENT_NAMES = ['Coastline Classic', 'Harbour Lights Open', 'Summit Cup', 'Sunfield Invitational', 'Riverside Trophy', 'Golden Racquet Open'];

export class TournamentSetup extends MenuScene {
  name = 'tournament';
  draw_ = 16;
  surface: SurfaceId = 'hard';
  format: FormatId = '3games';
  items(): MenuEntry[] {
    return [
      { id: 'draw', label: 'Draw size', value: `${this.draw_} players`, change: (d) => (this.draw_ = cycle(DRAWS, this.draw_, d)) },
      { id: 'surface', label: 'Surface', value: SURFACES[this.surface].name, change: (d) => (this.surface = cycle(SURF_IDS, this.surface, d)) },
      { id: 'length', label: 'Match length', value: FORMATS[this.format].label, change: (d) => (this.format = cycle(T_FORMATS, this.format, d)) },
      { id: 'difficulty', label: 'Difficulty', value: settings.difficulty.toUpperCase(), change: (d) => { settings.difficulty = cycle(DIFFS, settings.difficulty, d); saveSettings(); } },
      { id: 'start', label: 'Start Tournament', action: () => this.start() },
      { id: 'back', label: 'Back', action: () => game.goto(new TitleScene()) },
    ];
  }
  onBack(): void {
    game.goto(new TitleScene());
  }
  start(): void {
    const t = createTournament(this.draw_, this.surface, this.format, settings.difficulty, Math.floor(rng.next() * 1e9));
    game.goto(new BracketScene(t));
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawSetupScreen(ctx, this.t, 'TOURNAMENT', this.items(), this.sel, 'Knockout bracket with seeded COM players', this.surface);
  }
}

export interface Tournament {
  name: string;
  bracket: Bracket;
  surface: SurfaceId;
  format: FormatId;
  difficulty: Difficulty;
  rng: Rng;
  pros: Map<string, Pro>;
  human: PlayerSetup;
}

export function createTournament(size: number, surface: SurfaceId, format: FormatId, diff: Difficulty, seed: number): Tournament {
  const r = new Rng(seed);
  const pool = roster().slice(0, 90);
  r.shuffle(pool);
  const picks = pool.slice(0, size - 1);
  const pros = new Map<string, Pro>();
  const human = humanSetup();
  const ents: Entrant[] = picks.map((p) => {
    pros.set('pro:' + p.id, p);
    const st = { ...p.stats };
    for (const k of STAT_KEYS) st[k] = Math.max(15, Math.min(99, st[k] + DIFF_STAT[diff]));
    return { key: 'pro:' + p.id, name: proName(p), short: p.last.slice(0, 3).toUpperCase(), seed: 0, human: false, sim: { stats: st, archetype: p.archetype, fav: p.fav, tactics: proBlend(p) } };
  });
  ents.push({ key: 'you', name: 'You', short: 'YOU', seed: 0, human: true, sim: { stats: { ...HUMAN_STATS }, archetype: 'allCourt' } });
  ents.sort((a, b) => ovr(b.sim.stats) - ovr(a.sim.stats));
  const bracket = new Bracket(ents, size / 4);
  return { name: r.pick(EVENT_NAMES), bracket, surface, format, difficulty: diff, rng: r, pros, human };
}

export class BracketScene extends MenuScene {
  name = 'bracket';
  flash = 0;
  constructor(public tour: Tournament) {
    super();
  }
  enter(): void {
    audio.playSong('hub');
  }
  get done(): boolean {
    return this.tour.bracket.champion >= 0;
  }
  items(): MenuEntry[] {
    const b = this.tour.bracket;
    const hm = b.humanMatch();
    if (this.done) return [{ id: 'menu', label: 'Back to menu', action: () => game.goto(new TitleScene()) }];
    if (hm) {
      return [
        { id: 'play', label: `Play ${roundName(b.playersLeft())}`, action: () => this.playHuman(hm) },
        { id: 'sim', label: 'Quick-sim my match', action: () => this.simHuman(hm) },
        { id: 'quit', label: 'Withdraw', action: () => game.goto(new TitleScene()) },
      ];
    }
    return [
      { id: 'simrest', label: 'Simulate to the end', action: () => this.simToEnd() },
      { id: 'menu', label: 'Back to menu', action: () => game.goto(new TitleScene()) },
    ];
  }
  onBack(): void {}

  private opponentSetup(m: BMatch): { me: PlayerSetup; opp: PlayerSetup; meIsA: boolean } {
    const b = this.tour.bracket;
    const meIsA = b.entrants[m.a].human;
    const oppE = b.entrants[meIsA ? m.b : m.a];
    const pro = this.tour.pros.get(oppE.key)!;
    const opp = proSetup(pro);
    return { me: this.tour.human, opp, meIsA };
  }

  playHuman(m: BMatch): void {
    const { me, opp, meIsA } = this.opponentSetup(m);
    const b = this.tour.bracket;
    const surface = this.tour.surface;
    const start = () => {
      game.goto(new MatchScene({
        surface, format: FORMATS[this.tour.format].f, players: [me, opp], controllers: [new Controller('p1', 'solo', 0), null],
        difficulty: this.tour.difficulty, seed: this.tour.rng.int(0, 1e9),
        venue: venueFor(surface, { tier: 'tour', stage: stageFromDraw(b.size, b.playersLeft()), name: this.tour.name, round: roundName(b.playersLeft()) }),
      }, {
        title: `${this.tour.name.toUpperCase()}  •  ${roundName(b.playersLeft()).toUpperCase()}`,
        onEnd: (r) => {
          const humanWon = r.winner === 0 && !r.quit;
          const meIdx = meIsA ? m.a : m.b;
          const oppIdx = meIsA ? m.b : m.a;
          b.record(m, humanWon ? meIdx : oppIdx, humanWon ? r.summary : flipScore(r.summary));
          game.goto(new ResultScene(r, [me, opp], null, () => this.finishRound(), 'Continue'));
        },
      }));
    };
    game.goto(new StatCardScene(me, opp, surface, `${this.tour.name}  •  ${roundName(b.playersLeft())}`, start, () => game.goto(this)));
  }

  simHuman(m: BMatch): void {
    const b = this.tour.bracket;
    const A = b.entrants[m.a], B = b.entrants[m.b];
    const r = simMatch(A.sim, B.sim, this.tour.surface, FORMATS[this.tour.format].f, this.tour.rng);
    b.record(m, r.winner === 0 ? m.a : m.b, r.winner === 0 ? r.score : flipScore(r.score));
    this.finishRound();
  }

  finishRound(): void {
    const b = this.tour.bracket;
    b.simRound(this.tour.rng, this.tour.surface, FORMATS[this.tour.format].f);
    const humanWasIn = !!b.current().find((m) => b.entrants[m.a].human || (m.b >= 0 && b.entrants[m.b].human));
    const alive = b.humanAlive();
    b.advance();
    this.flash = 1;
    this.sel = 0;
    if (b.champion >= 0 && b.entrants[b.champion].human) {
      game.goto(new TrophyScene(this.tour.name, `${SURFACES[this.tour.surface].name} • ${b.size}-player draw`, () => game.goto(this)));
      return;
    }
    if (humanWasIn && !alive) audio.playSong('defeat', false);
    game.goto(this);
  }

  simToEnd(): void {
    const b = this.tour.bracket;
    let guard = 0;
    while (b.champion < 0 && guard++ < 10) {
      b.simRound(this.tour.rng, this.tour.surface, FORMATS[this.tour.format].f, true);
      b.advance();
    }
  }

  extraUpdate(): void {
    this.flash = Math.max(0, this.flash - 1 / 60);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx, this.t, this.tour.surface, false);
    ctx.fillStyle = 'rgba(6,12,26,0.55)';
    ctx.fillRect(0, 0, W, H);
    const b = this.tour.bracket;
    text(ctx, this.tour.name.toUpperCase(), W / 2, 20, { size: 18, align: 'center', outline: '#13284a', outlineWidth: 5 });
    const status = b.champion >= 0 ? `Champion: ${b.entrants[b.champion].name}` : b.humanMatch() ? `Next: ${roundName(b.playersLeft())}` : `You were eliminated in the ${roundName(b.humanExitRound() || b.playersLeft())}`;
    text(ctx, `${SURFACES[this.tour.surface].name} • ${FORMATS[this.tour.format].label} • ${status}`, W / 2, 40, { size: 11, align: 'center', color: '#ffd479', weight: 700 });
    drawBracket(ctx, b, 8, 52, W - 16, 340, this.flash);
    const items = this.items();
    const pw = 300, ph = items.length * 28 + 16;
    panel(ctx, (W - pw) / 2, H - ph - 8, pw, ph, 0.85);
    menuList(ctx, items, this.sel, (W - pw) / 2 + 14, H - ph - 8 + 22, pw - 28, 28, 15, this.t);
  }

  debugState(): Record<string, unknown> {
    const b = this.tour.bracket;
    return { round: b.round, left: b.playersLeft(), champion: b.champion >= 0 ? b.entrants[b.champion].name : null, humanAlive: b.humanAlive(), humanMatch: !!b.humanMatch() };
  }
}

/** Draw a bracket as columns of rounds with connector lines. */
export function drawBracket(ctx: CanvasRenderingContext2D, b: Bracket, x: number, y: number, w: number, h: number, flash: number): void {
  const n = b.size;
  const rounds = Math.log2(n);
  const cols = rounds + 1;
  const colW = w / cols;
  const slotH = h / n;
  const fs = n >= 32 ? 7.5 : n >= 16 ? 9 : 11;
  const boxH = Math.min(slotH * 0.86, n >= 32 ? 10 : 20);
  const ent = (i: number) => (i >= 0 ? b.entrants[i] : null);
  for (let r = 0; r <= rounds; r++) {
    const slots = n >> r;
    const sh = h / slots;
    const label = r === rounds ? 'Champion' : roundName(n >> r);
    text(ctx, label, x + r * colW + colW / 2, y - 2, { size: 8, align: 'center', color: '#9fb6d8', weight: 700 });
    for (let s = 0; s < slots; s++) {
      let idx = -1;
      let won = false;
      let score = '';
      if (r < b.rounds.length) {
        const m = b.rounds[r][Math.floor(s / 2)];
        idx = s % 2 === 0 ? m.a : m.b;
        won = m.winner >= 0 && m.winner === idx;
        if (won) score = m.score;
      } else if (r === rounds && b.champion >= 0) {
        idx = b.champion;
        won = true;
      }
      const e = ent(idx);
      const bx = x + r * colW + 2;
      const by = y + 6 + s * sh + sh / 2 - boxH / 2;
      const bw = colW - 10;
      const human = e?.human;
      ctx.fillStyle = human ? `rgba(255,170,40,${0.75 + flash * 0.25})` : won ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
      roundRect(ctx, bx, by, bw, boxH, 3);
      ctx.fill();
      if (e) {
        const label = (e.seed ? `[${e.seed}] ` : '') + e.name;
        text(ctx, label, bx + 3, by + boxH / 2 + 0.5, { size: fs, color: human ? '#13284a' : won ? '#ffffff' : '#c9d6ea', weight: won || human ? 800 : 600, maxWidth: bw - (score && n <= 16 ? 34 : 6) });
        if (score && n <= 16 && r < rounds) text(ctx, score.split(' ').slice(0, 3).join(' '), bx + bw - 2, by + boxH / 2 + 0.5, { size: fs - 2, align: 'right', color: human ? '#13284a' : '#ffd479', weight: 700 });
      }
      // connector
      if (r < rounds && s % 2 === 0) {
        const y1 = by + boxH / 2;
        const y2 = y1 + sh;
        const cx = bx + bw + 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + bw, y1);
        ctx.lineTo(cx, y1);
        ctx.lineTo(cx, y2);
        ctx.lineTo(bx + bw, y2);
        ctx.moveTo(cx, (y1 + y2) / 2);
        ctx.lineTo(cx + 4, (y1 + y2) / 2);
        ctx.stroke();
      }
    }
  }
}
