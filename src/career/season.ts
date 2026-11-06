import { Rng } from '../core/rng';
import { CareerState, ProState, newPlayer, NewPlayerOpts, seasonOf, weekOfSeason, CareerPlayer, SAVE_VERSION } from './state';
import { Result, rankingPoints, dropExpired, computeRanks, countedEvents } from './rankings';
import { eligibility, EntryStatus } from './entry';
import { TIERS, TierId, EventDef, eventsInWeek, eventById, FINALS_PTS, WILDCARD, OFFSEASON_START, RANKING, PROGRESSION } from '../data/tour';
import { roster, Pro, proName, proBlend } from '../data/roster';
import { Bracket, Entrant, flipScore, roundName, roundShort } from '../sim/bracket';
import { simMatch, quickWinProb, SimPlayer } from '../sim/match-sim';
import { MatchFormat } from '../match/scoring';
import { ovr } from '../data/types';

export interface FinalsState {
  groups: [string[], string[]];
  rr: { a: string; b: string; winner: string | null; score: string; group: 0 | 1 }[];
  sf: { a: string; b: string; winner: string | null; score: string }[];
  f: { a: string; b: string; winner: string | null; score: string } | null;
  stage: 'rr' | 'sf' | 'f' | 'done';
}

export interface EventRun {
  eventId: string;
  tier: TierId;
  absWeek: number;
  status: EntryStatus | 'none';
  stage: 'qual' | 'main' | 'done';
  qual: Bracket | null;
  main: Bracket | null;
  /** keys of direct main-draw entrants (before qualifiers are added) */
  directKeys: string[];
  qualKeys: string[];
  finals: FinalsState | null;
  humanOut: boolean;
  humanResult: string; // e.g. "QF", "W", "Q2"
}

const FMT_BO3: MatchFormat = { kind: 'sets', bestOf: 3 };
const FMT_BO5: MatchFormat = { kind: 'sets', bestOf: 5 };

export function proKey(id: number): string {
  return 'pro:' + id;
}

export class Season {
  pros: Pro[];
  byKey = new Map<string, Pro>();
  rng: Rng;

  constructor(public s: CareerState) {
    this.pros = roster();
    for (const p of this.pros) this.byKey.set(proKey(p.id), p);
    this.rng = new Rng(1);
    this.rng.setState(s.rngState);
  }

  sync(): void {
    this.s.rngState = this.rng.getState();
  }

  proState(key: string): ProState | undefined {
    const id = Number(key.slice(4));
    return this.s.pros[id - 1];
  }

  rankOf(key: string): number | null {
    if (key === 'you') return this.s.playerRank;
    return this.proState(key)?.rank ?? null;
  }

  nameOf(key: string): string {
    if (key === 'you') return this.s.player.name;
    const p = this.byKey.get(key);
    return p ? proName(p) : key;
  }

  simPlayer(key: string): SimPlayer {
    if (key === 'you') {
      const pl = this.s.player;
      return { stats: pl.stats, archetype: pl.primary, badges: pl.equipped, fresh: 1 - pl.fatigue * PROGRESSION.fatiguePerWeek / 100 };
    }
    const p = this.byKey.get(key)!;
    return { stats: p.stats, archetype: p.archetype, fav: p.fav, tactics: proBlend(p) };
  }

  entrant(key: string): Entrant {
    const r = this.rankOf(key);
    return { key, name: this.nameOf(key), short: key === 'you' ? 'YOU' : 'COM', seed: 0, human: key === 'you', sim: this.simPlayer(key), rank: r ?? undefined };
  }

  // ------------------------------------------------------------ field building
  /** decide which COM pros play which event this week */
  buildFields(week: number, human: { eventId: string; status: EntryStatus } | null): Map<string, EventRun> {
    const wos = weekOfSeason(week);
    const events = eventsInWeek(wos).slice().sort((a, b) => TIERS[b.tier].prestige - TIERS[a.tier].prestige);
    const runs = new Map<string, EventRun>();
    const r = this.rng;
    // available COM players this week
    const avail: { key: string; rank: number | null; level: number }[] = [];
    for (const p of this.pros) {
      const st = this.s.pros[p.id - 1];
      if (st.busyUntil >= week) continue;
      const rk = st.rank;
      const playP = rk !== null && rk <= 30 ? 0.62 : rk !== null && rk <= 100 ? 0.74 : 0.8;
      if (!r.chance(playP)) continue;
      avail.push({ key: proKey(p.id), rank: rk, level: ovr(p.stats) });
    }
    avail.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || b.level - a.level);
    const used = new Set<string>();

    for (const ev of events) {
      const t = TIERS[ev.tier];
      const run: EventRun = { eventId: ev.id, tier: ev.tier, absWeek: week, status: 'none', stage: 'main', qual: null, main: null, directKeys: [], qualKeys: [], finals: null, humanOut: false, humanResult: '' };
      if (ev.tier === 'finals') {
        // top 8 by rank (human included if top 8)
        const top: string[] = [];
        const all = this.allRanked();
        for (const k of all) {
          if (top.length >= 8) break;
          top.push(k);
        }
        if (human?.eventId === ev.id && !top.includes('you')) top[7] = 'you';
        run.finals = makeFinals(top, r);
        run.directKeys = top;
        if (top.includes('you')) run.status = 'direct';
        for (const k of top) used.add(k);
        runs.set(ev.id, run);
        continue;
      }
      const humanHere = human?.eventId === ev.id;
      const qualifiers = t.qualDraw ? t.qualDraw >> t.qualRounds : 0;
      let mainSlots = t.draw - qualifiers;
      if (humanHere && (human!.status === 'direct' || human!.status === 'wildcard')) {
        mainSlots--;
        run.directKeys.push('you');
      }
      // Futures draw a random mix of lower-ranked and unranked players; bigger events fill by ranking
      const order = t.direct === null ? r.shuffle(avail.filter((a) => !used.has(a.key) && (a.rank === null || a.rank >= t.comFloor))) : avail;
      for (const a of order) {
        if (run.directKeys.length >= (humanHere && run.directKeys.includes('you') ? mainSlots + 1 : mainSlots)) break;
        if (used.has(a.key)) continue;
        if (a.rank !== null && a.rank < t.comFloor) continue;
        if (t.direct !== null && a.rank === null && ev.tier !== 'c75') continue;
        run.directKeys.push(a.key);
        used.add(a.key);
      }
      if (t.qualDraw) {
        if (humanHere && human!.status === 'qualifying') run.qualKeys.push('you');
        for (const a of avail) {
          if (run.qualKeys.length >= t.qualDraw) break;
          if (used.has(a.key)) continue;
          if (a.rank !== null && a.rank < t.comFloor) continue;
          run.qualKeys.push(a.key);
          used.add(a.key);
        }
      }
      // top up the main draw if the field was thin
      for (const a of avail) {
        if (run.directKeys.length + (run.qualKeys.length ? qualifiers : 0) >= t.draw) break;
        if (used.has(a.key)) continue;
        run.directKeys.push(a.key);
        used.add(a.key);
      }
      if (humanHere) run.status = human!.status;
      run.stage = run.qualKeys.length ? 'qual' : 'main';
      if (run.stage === 'qual') run.qual = this.makeBracket(run.qualKeys, Math.min(t.qualDraw, pow2(run.qualKeys.length)));
      else run.main = this.makeBracket(run.directKeys, t.draw);
      runs.set(ev.id, run);
    }
    // mark major entrants busy for the second week
    for (const ev of events) {
      if (ev.weeks > 1) {
        const run = runs.get(ev.id)!;
        for (const k of [...run.directKeys, ...run.qualKeys]) {
          const st = k === 'you' ? null : this.proState(k);
          if (st) st.busyUntil = week + ev.weeks - 1;
        }
      }
    }
    return runs;
  }

  allRanked(): string[] {
    const rows: { key: string; rank: number }[] = [];
    for (const st of this.s.pros) if (st.rank !== null) rows.push({ key: proKey(st.id), rank: st.rank });
    if (this.s.playerRank !== null) rows.push({ key: 'you', rank: this.s.playerRank });
    rows.sort((a, b) => a.rank - b.rank);
    return rows.map((r) => r.key);
  }

  makeBracket(keys: string[], size: number): Bracket {
    const n = pow2(Math.max(2, Math.min(size, keys.length)));
    const ents = keys.slice(0, n).map((k) => this.entrant(k));
    while (ents.length < n) ents.push({ key: 'bye', name: '-', short: '-', seed: 0, human: false, sim: { stats: { forehand: 1, backhand: 1, serve: 1, footwork: 1, volley: 1, touch: 1, spin: 1, ret: 1, endurance: 1, mental: 1 }, archetype: 'grinder' } });
    ents.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || ovr(b.sim.stats) - ovr(a.sim.stats));
    return new Bracket(ents, Math.max(2, n / 4));
  }

  /** after qualifying: build the main draw */
  startMain(run: EventRun): void {
    const t = TIERS[run.tier];
    const q = run.qual!;
    const qualifiers: string[] = [];
    for (const m of q.current()) if (m.winner >= 0) qualifiers.push(q.entrants[m.winner].key);
    const keys = [...run.directKeys, ...qualifiers];
    run.main = this.makeBracket(keys, t.draw);
    run.stage = 'main';
  }

  /** simulate a non-human round of an event (fast for COM-only events) */
  simRoundFast(b: Bracket, sf: EventDef['surface'], bo: number): void {
    for (const m of b.current()) {
      if (m.winner >= 0) continue;
      const A = b.entrants[m.a], B = b.entrants[m.b];
      if (A.human || B.human) continue;
      if (B.key === 'bye') {
        m.winner = m.a;
        m.score = 'bye';
        continue;
      }
      if (A.key === 'bye') {
        m.winner = m.b;
        m.score = 'bye';
        continue;
      }
      const p = quickWinProb(A.sim, B.sim, sf, bo);
      m.winner = this.rng.next() < p ? m.a : m.b;
      m.score = '';
    }
  }

  simRoundFull(b: Bracket, sf: EventDef['surface'], fmt: MatchFormat): void {
    for (const m of b.current()) {
      if (m.winner >= 0) continue;
      const A = b.entrants[m.a], B = b.entrants[m.b];
      if (A.human || B.human) continue;
      if (B.key === 'bye' || A.key === 'bye') {
        m.winner = B.key === 'bye' ? m.a : m.b;
        m.score = 'bye';
        continue;
      }
      const res = simMatch(A.sim, B.sim, sf, fmt, this.rng);
      m.winner = res.winner === 0 ? m.a : m.b;
      m.score = res.winner === 0 ? res.score : flipScore(res.score);
    }
  }

  /** run a COM-only event to completion */
  simWholeEvent(run: EventRun): void {
    const ev = eventById(run.eventId)!;
    const bo = run.tier === 'major' ? 5 : 3;
    if (run.finals) {
      simFinals(run.finals, (a, b) => this.rng.next() < quickWinProb(this.simPlayer(a), this.simPlayer(b), ev.surface, 3));
      run.stage = 'done';
      return;
    }
    if (run.stage === 'qual') {
      const q = run.qual!;
      for (let r = 0; r < TIERS[run.tier].qualRounds && q.current().length >= 1; r++) {
        this.simRoundFast(q, ev.surface, 3);
        if (r < TIERS[run.tier].qualRounds - 1 && q.current().length > 1) q.advance();
      }
      this.startMain(run);
    }
    const b = run.main!;
    while (b.champion < 0) {
      this.simRoundFast(b, ev.surface, bo);
      b.advance();
    }
    run.stage = 'done';
  }

  // ------------------------------------------------------------ points
  /** award points for a finished event: returns map key -> [points, resultLabel] */
  eventPoints(run: EventRun): Map<string, [number, string]> {
    const t = TIERS[run.tier];
    const out = new Map<string, [number, string]>();
    if (run.finals) {
      const f = run.finals;
      const pts = new Map<string, number>();
      for (const k of f.groups.flat()) pts.set(k, 0);
      for (const m of f.rr) if (m.winner) pts.set(m.winner, pts.get(m.winner)! + FINALS_PTS.rrWin);
      for (const m of f.sf) if (m.winner) pts.set(m.winner, pts.get(m.winner)! + FINALS_PTS.sfWin);
      if (f.f?.winner) pts.set(f.f.winner, pts.get(f.f.winner)! + FINALS_PTS.fWin);
      for (const [k, v] of pts) {
        const label = f.f?.winner === k ? 'W' : f.f && (f.f.a === k || f.f.b === k) ? 'F' : f.sf.some((m) => m.a === k || m.b === k) ? 'SF' : 'RR';
        out.set(k, [v, label]);
      }
      return out;
    }
    const qualified = new Set<string>();
    if (run.qual) {
      const q = run.qual;
      const rounds = t.qualRounds;
      for (let r = 0; r < q.rounds.length; r++) {
        for (const m of q.rounds[r]) {
          if (m.winner < 0) continue;
          const loser = m.winner === m.a ? m.b : m.a;
          const lk = q.entrants[loser]?.key;
          if (lk && lk !== 'bye') out.set(lk, [t.qualPts[rounds - 1 - r] ?? 0, `Q${r + 1}`]);
          if (r === q.rounds.length - 1) qualified.add(q.entrants[m.winner].key);
        }
      }
    }
    const b = run.main;
    if (!b) return out;
    const total = Math.log2(b.size);
    for (let r = 0; r < b.rounds.length; r++) {
      for (const m of b.rounds[r]) {
        if (m.winner < 0) continue;
        const loser = m.winner === m.a ? m.b : m.a;
        const lk = b.entrants[loser]?.key;
        if (lk && lk !== 'bye') {
          const idx = total - r;
          const base = t.points[Math.min(t.points.length - 1, idx)] ?? 0;
          out.set(lk, [base + (qualified.has(lk) ? t.qualBonus : 0), roundShort(b.size >> r)]);
        }
      }
    }
    if (b.champion >= 0) {
      const ck = b.entrants[b.champion].key;
      out.set(ck, [t.points[0] + (qualified.has(ck) ? t.qualBonus : 0), 'W']);
    }
    return out;
  }

  applyPoints(run: EventRun): void {
    const pts = this.eventPoints(run);
    const week = run.absWeek;
    for (const [k, [p]] of pts) {
      const res: Result = [week, p, run.tier];
      if (k === 'you') this.s.playerResults.push(res);
      else {
        const st = this.proState(k);
        if (st) st.results.push(res);
      }
    }
  }

  // ------------------------------------------------------------ rankings
  recomputeRanks(week: number): void {
    const rows = this.s.pros.map((st) => {
      st.results = dropExpired(st.results, week);
      st.points = rankingPoints(st.results, week);
      return { id: proKey(st.id), name: this.nameOf(proKey(st.id)), points: st.points, events: countedEvents(st.results, week) };
    });
    this.s.playerResults = dropExpired(this.s.playerResults, week);
    this.s.playerPoints = rankingPoints(this.s.playerResults, week);
    rows.push({ id: 'you', name: this.s.player.name, points: this.s.playerPoints, events: countedEvents(this.s.playerResults, week) });
    const ranks = computeRanks(rows);
    for (const st of this.s.pros) st.rank = ranks.get(proKey(st.id)) ?? null;
    this.s.playerRank = ranks.get('you') ?? null;
  }

  // ------------------------------------------------------------ the week
  /** Simulate an entire COM week (no human). */
  simComWeek(week: number): Map<string, EventRun> {
    const runs = this.buildFields(week, null);
    for (const run of runs.values()) {
      this.simWholeEvent(run);
      this.applyPoints(run);
    }
    return runs;
  }
}

export function pow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// ---------------------------------------------------------------- tour finals
export function makeFinals(top: string[], r: Rng): FinalsState {
  const g: [string[], string[]] = [[], []];
  // snake: 1,4,5,8 vs 2,3,6,7
  top.forEach((k, i) => g[[0, 1, 1, 0, 0, 1, 1, 0][i] as 0 | 1].push(k));
  const rr: FinalsState['rr'] = [];
  for (const gi of [0, 1] as const) {
    const ks = g[gi];
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) rr.push({ a: ks[i], b: ks[j], winner: null, score: '', group: gi });
  }
  void r;
  return { groups: g, rr, sf: [], f: null, stage: 'rr' };
}

export function groupStandings(f: FinalsState, gi: 0 | 1): { key: string; w: number }[] {
  return f.groups[gi].map((k) => ({ key: k, w: f.rr.filter((m) => m.winner === k).length })).sort((a, b) => b.w - a.w);
}

export function advanceFinals(f: FinalsState): void {
  if (f.stage === 'rr' && f.rr.every((m) => m.winner)) {
    const A = groupStandings(f, 0), B = groupStandings(f, 1);
    f.sf = [{ a: A[0].key, b: B[1].key, winner: null, score: '' }, { a: B[0].key, b: A[1].key, winner: null, score: '' }];
    f.stage = 'sf';
  } else if (f.stage === 'sf' && f.sf.every((m) => m.winner)) {
    f.f = { a: f.sf[0].winner!, b: f.sf[1].winner!, winner: null, score: '' };
    f.stage = 'f';
  } else if (f.stage === 'f' && f.f?.winner) f.stage = 'done';
}

export function simFinals(f: FinalsState, aWins: (a: string, b: string) => boolean, skipKey = ''): void {
  let guard = 0;
  while (f.stage !== 'done' && guard++ < 10) {
    const list = f.stage === 'rr' ? f.rr : f.stage === 'sf' ? f.sf : [f.f!];
    let blocked = false;
    for (const m of list) {
      if (m.winner) continue;
      if (skipKey && (m.a === skipKey || m.b === skipKey)) {
        blocked = true;
        continue;
      }
      m.winner = aWins(m.a, m.b) ? m.a : m.b;
    }
    if (blocked) return;
    advanceFinals(f);
  }
}

// ---------------------------------------------------------------- new career
export function createCareer(opts: NewPlayerOpts, seed: number): CareerState {
  const pros = roster();
  const s: CareerState = {
    version: SAVE_VERSION, seed, rngState: seed >>> 0, week: 1 - RANKING.weeksPerSeason, player: newPlayer(opts),
    playerResults: [], playerPoints: 0, playerRank: null,
    pros: pros.map((p) => ({ id: p.id, results: [], points: 0, rank: null, busyUntil: -999 })),
    news: ['Welcome to the tour! Futures events are open to everyone: start there.'], wildcard: null, current: null, rankHistory: [], weekDone: false,
  };
  // initial pseudo-ranking by level so the warm-up fields are sensible
  const order = pros.map((p) => ({ id: p.id, lv: ovr(p.stats) })).sort((a, b) => b.lv - a.lv);
  order.forEach((o, i) => (s.pros[o.id - 1].rank = i + 1));
  // warm-up season (season 0): fills everyone's 52-week window
  const season = new Season(s);
  for (let w = 1 - RANKING.weeksPerSeason; w <= 0; w++) {
    if (weekOfSeason(w) >= OFFSEASON_START) continue;
    season.simComWeek(w);
    season.recomputeRanks(w);
  }
  s.week = 1;
  season.recomputeRanks(1);
  season.sync();
  return s;
}

export { seasonOf, weekOfSeason };
export type { CareerPlayer };
export { roundName, WILDCARD, eligibility };
