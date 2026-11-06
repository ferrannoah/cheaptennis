import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry } from '../menu-base';
import { CareerState } from '../../career/state';
import { humanMatch, recordHuman, simHumanMatch, finishWeek, careerFormat, groupStandings } from '../../career/flow';
import { Season } from '../../career/season';
import { eventById, TIERS } from '../../data/tour';
import { careerFrame, careerSetup, tierBadge, msgPanel } from './common';
import { panel, menuList } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { drawBracket } from '../tournament';
import { HubScene } from './hub';
import { StatCardScene } from '../statcard';
import { MatchScene } from '../match';
import { proSetup, proBlend } from '../../data/roster';
import { blendLabel } from '../../data/tactics';
import { Controller } from '../../core/input';
import { settings } from '../../core/settings';
import { SURFACES } from '../../data/surfaces';
import { flipScore } from '../../sim/bracket';
import { audio } from '../../core/audio';
import { TrophyScene } from '../trophy';
import { ovr } from '../../data/types';
import { venueFor, stageFromDraw, levelForTier } from '../../data/venues';

export class EventScene extends MenuScene {
  name = 'event';
  msgs: string[] = [];
  constructor(public s: CareerState, msgs: string[] = []) {
    super();
    this.msgs = msgs;
  }
  enter(): void {
    audio.playSong('hub');
  }
  items(): MenuEntry[] {
    const hm = humanMatch(this.s);
    if (hm) {
      return [
        { id: 'play', label: `Play ${hm.label}`, action: () => this.play() },
        { id: 'sim', label: 'Quick-sim match', action: () => this.sim() },
        { id: 'hub', label: 'Back to hub (event continues)', action: () => game.goto(new HubScene(this.s)) },
      ];
    }
    return [{ id: 'finish', label: 'Finish the week', action: () => this.finish() }];
  }
  onBack(): void {}

  play(): void {
    const s = this.s;
    const hm = humanMatch(s)!;
    if (hm.opponent === 'bye') {
      recordHuman(s, true, 'bye', { perfects: 0, aces: 0, longRallies: 0, bpSaved: 0 });
      game.goto(new EventScene(s, ['Walkover: your opponent withdrew.']));
      return;
    }
    const run = s.current!;
    const ev = eventById(run.eventId)!;
    const season = new Season(s);
    const pro = season.byKey.get(hm.opponent)!;
    const me = careerSetup(s.player);
    const oppRank = season.rankOf(hm.opponent);
    const opp = proSetup(pro, 'COM');
    opp.city = oppRank ? `#${oppRank}` : 'Unranked';
    const fmt = careerFormat(s, run.tier);
    // stadium: Majors and the Tour Finals get the grand venue (qualifying is on an outside court)
    const tier = hm.isQual ? 'tour' : run.tier === 'major' ? 'major' : run.tier === 'finals' ? 'final' : 'tour';
    const stage = hm.isQual ? 0 : hm.finalsIdx ? { rr: 0.6, sf: 0.85, f: 1 }[hm.finalsIdx.stage] : hm.bracket ? stageFromDraw(hm.bracket.size, hm.bracket.playersLeft()) : 0.4;
    // crowd size follows the event: Futures are park courts with a few bleachers; qualifying is one level smaller
    const level = Math.max(0, levelForTier(run.tier) - (hm.isQual ? 1 : 0));
    const venue = venueFor(ev.surface, { tier, level, stage, name: ev.name, round: hm.label });
    const start = () =>
      game.goto(new MatchScene({ surface: ev.surface, format: fmt, players: [me, opp], controllers: [new Controller('p1', 'solo', 0), null], difficulty: settings.difficulty, seed: season.rng.int(0, 1e9), venue }, {
        title: `${ev.name.toUpperCase()} • ${hm.label.toUpperCase()}`,
        onEnd: (r) => {
          const won = r.winner === 0 && !r.quit;
          const res = recordHuman(s, won, r.summary, { perfects: r.perfects[0], aces: r.aces[0], longRallies: r.longRallyWins[0], bpSaved: r.breakSaved[0] });
          this.after(won, r.summary, res);
        },
        onQuit: () => {
          const res = recordHuman(s, false, '0-6 0-6', { perfects: 0, aces: 0, longRallies: 0, bpSaved: 0 });
          this.after(false, 'retired', res);
        },
      }));
    game.goto(new StatCardScene(me, opp, ev.surface, `${ev.name} • ${hm.label}`, start, () => game.goto(this)));
  }

  sim(): void {
    const s = this.s;
    const r = simHumanMatch(s);
    const res = recordHuman(s, r.won, r.score, { perfects: 5, aces: r.won ? 3 : 1, longRallies: 1, bpSaved: 1 });
    this.after(r.won, r.score, res);
  }

  after(won: boolean, score: string, res: { xp: number; sp: number; badges: string[] }): void {
    const s = this.s;
    const msgs = [`${won ? 'WON' : 'LOST'} ${score}`, `+${res.xp} XP${res.sp ? `  •  +${res.sp} skill point${res.sp > 1 ? 's' : ''}` : ''}`];
    const run = s.current;
    if (run && run.stage === 'done' && run.humanResult === 'W') {
      const ev = eventById(run.eventId)!;
      const kind = run.tier === 'major' ? 'plate' : run.tier === 'm1000' || run.tier === 'finals' ? 'bowl' : 'cup';
      game.goto(new TrophyScene(ev.name, `${TIERS[run.tier].name} • ${SURFACES[ev.surface].name}`, () => game.goto(new EventScene(s, msgs)), kind));
      return;
    }
    if (run?.finals && run.stage === 'done' && run.finals.f?.winner === 'you') {
      game.goto(new TrophyScene('Season Finale', 'Tour Finals champion', () => game.goto(new EventScene(s, msgs)), 'bowl'));
      return;
    }
    game.goto(new EventScene(s, msgs));
  }

  finish(): void {
    const msgs = finishWeek(this.s, 'event');
    game.goto(new HubScene(this.s, msgs));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.s;
    const run = s.current;
    if (!run) {
      careerFrame(ctx, this.t, s, 'EVENT');
      return;
    }
    const ev = eventById(run.eventId)!;
    careerFrame(ctx, this.t, s, ev.name.toUpperCase(), ev.surface);
    const season = new Season(s);
    tierBadge(ctx, run.tier, 16, 62, 54);
    text(ctx, `${TIERS[run.tier].name} • ${SURFACES[ev.surface].name} • ${run.status === 'qualifying' ? 'via qualifying' : run.status === 'wildcard' ? 'wildcard' : 'main draw'}`, 78, 62, { size: 11, weight: 700 });
    const hm = humanMatch(s);
    if (run.finals) {
      const f = run.finals;
      for (const gi of [0, 1] as const) {
        const x = 16 + gi * 310;
        panel(ctx, x, 78, 298, 120, 0.8);
        text(ctx, `GROUP ${gi === 0 ? 'A' : 'B'}`, x + 12, 94, { size: 12, color: '#ffc04a' });
        groupStandings(f, gi).forEach((r, i) => text(ctx, `${season.nameOf(r.key)}  —  ${r.w} W`, x + 12, 116 + i * 20, { size: 11, color: r.key === 'you' ? '#ffd479' : '#fff', weight: 700 }));
      }
      const lines = [...f.sf.map((m) => `SF: ${season.nameOf(m.a)} vs ${season.nameOf(m.b)}${m.winner ? ' → ' + season.nameOf(m.winner) : ''}`)];
      if (f.f) lines.push(`Final: ${season.nameOf(f.f.a)} vs ${season.nameOf(f.f.b)}${f.f.winner ? ' → ' + season.nameOf(f.f.winner) : ''}`);
      lines.forEach((l, i) => text(ctx, l, 24, 216 + i * 18, { size: 11, weight: 700 }));
    } else {
      const b = run.stage === 'qual' ? run.qual! : run.main!;
      if (b && b.size <= 32) {
        drawBracket(ctx, b, 12, 90, W - 24, 236, 0);
      } else if (b) {
        // big draws: show the player's path only
        panel(ctx, 16, 80, W - 32, 250, 0.75);
        text(ctx, `${b.size}-player draw • your path`, 28, 98, { size: 12, color: '#ffc04a' });
        let y = 120;
        for (let r = 0; r < b.rounds.length; r++) {
          for (const m of b.rounds[r]) {
            const ea = b.entrants[m.a], eb = b.entrants[m.b];
            if (!ea?.human && !eb?.human) continue;
            const opp = ea.human ? eb : ea;
            const res = m.winner < 0 ? 'next' : b.entrants[m.winner].human ? `won ${m.score}` : `lost ${flipScore(m.score)}`;
            text(ctx, `R${b.size >> r}: vs ${opp.name}${opp.rank ? ' (#' + opp.rank + ')' : ''}  —  ${res}`, 28, y, { size: 12, weight: 700, color: m.winner < 0 ? '#ffd479' : '#fff' });
            y += 20;
          }
        }
        if (b.champion >= 0) text(ctx, `Champion: ${b.entrants[b.champion].name}`, 28, y + 8, { size: 13, color: '#ffd479' });
      }
    }
    if (hm) {
      const pro = season.byKey.get(hm.opponent);
      const rk = season.rankOf(hm.opponent);
      text(ctx, `Next: ${hm.label} vs ${season.nameOf(hm.opponent)}${rk ? ' (#' + rk + ')' : ''}${pro ? '  •  OVR ' + ovr(pro.stats) : ''}`, W / 2, 340, { size: 13, align: 'center', color: '#ffd479', outline: '#13284a' });
      if (pro) text(ctx, `Scouting report: ${blendLabel(proBlend(pro), 2)}`, W / 2, 357, { size: 10, align: 'center', color: '#d6e4f7', outline: '#13284a', weight: 700 });
    } else {
      text(ctx, run.humanResult === 'W' ? 'CHAMPION!' : run.humanOut ? `Out in the ${run.humanResult || 'event'}` : 'Event complete', W / 2, 350, { size: 15, align: 'center', color: '#ffd479', outline: '#13284a' });
    }
    const items = this.items();
    panel(ctx, (W - 320) / 2, 366, 320, items.length * 28 + 14, 0.85);
    menuList(ctx, items, this.sel, (W - 320) / 2 + 12, 384, 296, 28, 14, this.t);
    if (this.msgs.length) msgPanel(ctx, this.msgs, 98);
  }

  debugState(): Record<string, unknown> {
    const hm = humanMatch(this.s);
    return { event: this.s.current?.eventId, stage: this.s.current?.stage, next: hm ? hm.label + ' vs ' + hm.opponent : null, out: this.s.current?.humanOut, result: this.s.current?.humanResult, msgs: this.msgs };
  }
}

void settings;
void H;
