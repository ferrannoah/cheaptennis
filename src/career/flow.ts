import { CareerState, seasonOf, weekOfSeason, saveCareer } from './state';
import { Season, EventRun, advanceFinals, simFinals, groupStandings } from './season';
import { eligibility, Eligibility, canEnter } from './entry';
import { eventsInWeek, eventById, TIERS, WILDCARD, OFFSEASON_START, RANKING, PROGRESSION, EventDef, MAJOR_NAMES } from '../data/tour';
import { Bracket, BMatch, flipScore, roundName } from '../sim/bracket';
import { simMatch, quickWinProb } from '../sim/match-sim';
import { matchXp, addXp, checkBadges } from './progression';
import { MatchFormat, FORMATS } from '../match/scoring';
import { settings } from '../core/settings';
import { BADGES } from '../data/badges';

/** Rehydrate class instances after JSON load. */
export function rehydrate(s: CareerState): void {
  const fix = (b: Bracket | null) => {
    if (b && Object.getPrototypeOf(b) !== Bracket.prototype) Object.setPrototypeOf(b, Bracket.prototype);
  };
  if (s.current) {
    fix(s.current.qual);
    fix(s.current.main);
  }
}

export function isOffseason(s: CareerState): boolean {
  return weekOfSeason(s.week) >= OFFSEASON_START;
}

export function weekLabel(s: CareerState): string {
  return `Season ${seasonOf(s.week)} • Week ${weekOfSeason(s.week)}`;
}

export function playerEligibility(s: CareerState, ev: EventDef): Eligibility {
  const wc = s.wildcard && s.wildcard.eventId === ev.id && s.wildcard.absWeek === s.week;
  return eligibility(ev.tier, s.playerRank, { wildcard: !!wc });
}

export function thisWeek(s: CareerState): EventDef[] {
  return eventsInWeek(weekOfSeason(s.week));
}

function pushNews(s: CareerState, msg: string): void {
  s.news.unshift(msg);
  if (s.news.length > 30) s.news.length = 30;
}

/** Called when a new week becomes current: maybe offer a wildcard. */
export function beginWeek(s: CareerState): void {
  const season = new Season(s);
  if (!isOffseason(s) && (!s.wildcard || s.wildcard.absWeek !== s.week) && season.rng.chance(WILDCARD.chance)) {
    const options = thisWeek(s).filter((e) => {
      if (!WILDCARD.tiers.includes(e.tier)) return false;
      const el = eligibility(e.tier, s.playerRank);
      if (el.status === 'direct') return false;
      if (e.tier === 'major' && (s.playerRank === null || s.playerRank > WILDCARD.maxRankForMajor)) return false;
      return true;
    });
    if (options.length) {
      const ev = season.rng.pick(options);
      s.wildcard = { eventId: ev.id, absWeek: s.week };
      pushNews(s, `Wildcard offered into the ${ev.name} (${TIERS[ev.tier].name})!`);
    }
  }
  season.sync();
}

export function careerFormat(s: CareerState, tier: string): MatchFormat {
  if (settings.careerLength === 'short') return FORMATS['3games'].f;
  if (settings.careerLength === 'set') return FORMATS.set.f;
  return tier === 'major' && settings.majorsBo5 ? FORMATS.bo5.f : FORMATS.bo3.f;
}

/** Enter an event this week. Simulates every other event of the week right away. */
export function enterEvent(s: CareerState, eventId: string): boolean {
  const ev = eventById(eventId);
  if (!ev) return false;
  const el = playerEligibility(s, ev);
  if (!canEnter(el)) return false;
  const status = el.status;
  const season = new Season(s);
  const runs = season.buildFields(s.week, { eventId, status });
  for (const [id, run] of runs) {
    if (id === eventId) continue;
    season.simWholeEvent(run);
    season.applyPoints(run);
    newsForEvent(s, season, run);
  }
  s.current = runs.get(eventId)!;
  // a direct entrant waits for qualifying to finish: simulate it so the main draw exists
  const run = s.current;
  if (run.stage === 'qual' && run.qual && !run.qual.entrants.some((e) => e.human)) {
    const q = run.qual;
    while (q.round < TIERS[run.tier].qualRounds - 1 && q.current().length > 1) {
      season.simRoundFull(q, ev.surface, { kind: 'sets', bestOf: 3 });
      q.advance();
    }
    season.simRoundFull(q, ev.surface, { kind: 'sets', bestOf: 3 });
    season.startMain(run);
  }
  if (ev.tier === 'major' && status !== 'qualifying' && !s.player.firstMajorMainWeek) s.player.firstMajorMainWeek = s.week;
  if (s.wildcard?.eventId === eventId) s.wildcard = null;
  season.sync();
  saveCareer(s);
  return true;
}

function newsForEvent(s: CareerState, season: Season, run: EventRun): void {
  const t = TIERS[run.tier];
  if (t.prestige < 5) return;
  const ev = eventById(run.eventId)!;
  let champ: string | null = null;
  if (run.finals?.f?.winner) champ = run.finals.f.winner;
  else if (run.main && run.main.champion >= 0) champ = run.main.entrants[run.main.champion].key;
  if (!champ) return;
  const r = season.rankOf(champ);
  pushNews(s, `${r ? '#' + r + ' ' : ''}${season.nameOf(champ)} wins the ${ev.name}`);
}

/** Current human match in the event, or null if out / waiting. */
export interface HumanMatch {
  opponent: string;
  label: string; // round label
  isQual: boolean;
  bracket: Bracket | null;
  match: BMatch | null;
  finalsIdx?: { stage: 'rr' | 'sf' | 'f'; i: number };
}

export function humanMatch(s: CareerState): HumanMatch | null {
  const run = s.current;
  if (!run || run.humanOut || run.stage === 'done') return null;
  if (run.finals) {
    const f = run.finals;
    const list = f.stage === 'rr' ? f.rr : f.stage === 'sf' ? f.sf : f.f ? [f.f] : [];
    const i = list.findIndex((m) => !m.winner && (m.a === 'you' || m.b === 'you'));
    if (i < 0) return null;
    const m = list[i];
    return { opponent: m.a === 'you' ? m.b : m.a, label: f.stage === 'rr' ? 'Round robin' : f.stage === 'sf' ? 'Semifinal' : 'Final', isQual: false, bracket: null, match: null, finalsIdx: { stage: f.stage as 'rr', i } };
  }
  const b = run.stage === 'qual' ? run.qual! : run.main!;
  const m = b.humanMatch();
  if (!m) return null;
  const meA = b.entrants[m.a].human;
  const opp = b.entrants[meA ? m.b : m.a].key;
  const label = run.stage === 'qual' ? `Qualifying R${b.round + 1}` : roundName(b.playersLeft());
  return { opponent: opp, label, isQual: run.stage === 'qual', bracket: b, match: m };
}

export interface MatchStats {
  perfects: number;
  aces: number;
  longRallies: number;
  bpSaved: number;
}

/** Record the human match result (played or simulated) and progress the event. */
export function recordHuman(s: CareerState, won: boolean, scoreFromHuman: string, st: MatchStats): { xp: number; sp: number; badges: string[] } {
  const run = s.current!;
  const hm = humanMatch(s)!;
  const season = new Season(s);
  const ev = eventById(run.eventId)!;
  const p = s.player;
  p.matches++;
  p.perfects += st.perfects;
  p.aces += st.aces;
  p.longRallies += st.longRallies;
  p.bpSaved += st.bpSaved;
  p.wl[ev.surface][won ? 0 : 1]++;
  const xp = matchXp(run.tier, won, st.perfects);
  const sp = addXp(p, xp);
  if (run.finals && hm.finalsIdx) {
    const f = run.finals;
    const list = hm.finalsIdx.stage === 'rr' ? f.rr : hm.finalsIdx.stage === 'sf' ? f.sf : [f.f!];
    const m = list[hm.finalsIdx.i];
    m.winner = won ? 'you' : hm.opponent;
    m.score = won ? scoreFromHuman : flipScore(scoreFromHuman);
    // sim other matches up to the next human match
    const sf = ev.surface;
    simFinals(f, (a, b) => season.rng.next() < quickWinProb(season.simPlayer(a), season.simPlayer(b), sf, 3), 'you');
    // if the human is eliminated (not in sf/f), finish
    const inNext = (f.stage === 'sf' && f.sf.some((x) => x.a === 'you' || x.b === 'you')) || (f.stage === 'f' && (f.f?.a === 'you' || f.f?.b === 'you')) || f.stage === 'rr';
    if (!inNext || f.stage === 'done') {
      simFinals(f, (a, b) => season.rng.next() < quickWinProb(season.simPlayer(a), season.simPlayer(b), sf, 3));
      run.stage = 'done';
      run.humanOut = f.f?.winner !== 'you';
    }
  } else {
    const b = hm.bracket!;
    const m = hm.match!;
    const meIdx = b.entrants[m.a].human ? m.a : m.b;
    const oppIdx = meIdx === m.a ? m.b : m.a;
    b.record(m, won ? meIdx : oppIdx, won ? scoreFromHuman : flipScore(scoreFromHuman));
    const fmt: MatchFormat = run.tier === 'major' ? { kind: 'sets', bestOf: 5 } : { kind: 'sets', bestOf: 3 };
    season.simRoundFull(b, ev.surface, fmt);
    if (!won) {
      run.humanOut = true;
      run.humanResult = run.stage === 'qual' ? `Q${b.round + 1}` : roundName(b.playersLeft());
      // finish the event quickly
      finishRestOfEvent(season, run);
    } else {
      if (run.stage === 'qual') {
        const lastQual = b.round >= TIERS[run.tier].qualRounds - 1;
        if (lastQual) {
          // finish other qual matches then build the main draw
          season.simRoundFull(b, ev.surface, fmt);
          season.startMain(run);
          if (!p.firstMajorMainWeek && run.tier === 'major') p.firstMajorMainWeek = s.week;
        } else b.advance();
      } else {
        b.advance();
        if (b.champion >= 0) {
          run.stage = 'done';
          run.humanResult = 'W';
        }
      }
    }
  }
  if (run.tier === 'major' && run.stage === 'main' && !p.firstMajorMainWeek) p.firstMajorMainWeek = s.week;
  const badges = checkBadges(p);
  for (const id of badges) pushNews(s, `Badge unlocked: ${BADGES[id].name}!`);
  season.sync();
  saveCareer(s);
  return { xp, sp, badges };
}

function finishRestOfEvent(season: Season, run: EventRun): void {
  const ev = eventById(run.eventId)!;
  const bo = run.tier === 'major' ? 5 : 3;
  if (run.stage === 'qual') {
    const q = run.qual!;
    while (q.round < TIERS[run.tier].qualRounds - 1) {
      season.simRoundFast(q, ev.surface, 3);
      q.advance();
    }
    season.simRoundFast(q, ev.surface, 3);
    season.startMain(run);
  }
  const b = run.main!;
  while (b.champion < 0) {
    season.simRoundFast(b, ev.surface, bo);
    b.advance();
  }
  run.stage = 'done';
}

/** Quick-sim the human's current match. */
export function simHumanMatch(s: CareerState): { won: boolean; score: string } {
  const hm = humanMatch(s)!;
  const season = new Season(s);
  const ev = eventById(s.current!.eventId)!;
  const fmt: MatchFormat = s.current!.tier === 'major' ? { kind: 'sets', bestOf: 5 } : { kind: 'sets', bestOf: 3 };
  const r = simMatch(season.simPlayer('you'), season.simPlayer(hm.opponent), ev.surface, fmt, season.rng);
  season.sync();
  const won = r.winner === 0;
  return { won, score: r.score };
}

/** Finish the week after the human's event is done (or after rest/training). */
export function finishWeek(s: CareerState, mode: 'event' | 'rest' | 'train', trainXp = 0): string[] {
  const season = new Season(s);
  const p = s.player;
  const msgs: string[] = [];
  let span = 1;
  if (mode === 'event' && s.current) {
    const run = s.current;
    const ev = eventById(run.eventId)!;
    const pts = season.eventPoints(run);
    season.applyPoints(run);
    newsForEvent(s, season, run);
    const mine = pts.get('you');
    if (mine) {
      msgs.push(`${ev.name}: ${mine[1] === 'W' ? 'CHAMPION' : 'reached ' + mine[1]}  (+${mine[0]} pts)`);
      if (mine[1] === 'W') {
        p.titles.push({ name: ev.name, tier: run.tier, surface: ev.surface, season: seasonOf(s.week) });
        pushNews(s, `You win the ${ev.name}! (${TIERS[run.tier].name})`);
      }
      if (run.tier === 'major') p.majors[`S${seasonOf(s.week)} ${ev.name}`] = mine[1];
    }
    span = ev.weeks;
    p.fatigue = Math.min(PROGRESSION.fatigueMax / PROGRESSION.fatiguePerWeek, p.fatigue + span);
    s.current = null;
  } else {
    // nobody plays for the human this week: COM week
    if (!isOffseason(s)) {
      const runs = season.simComWeek(s.week);
      for (const run of runs.values()) newsForEvent(s, season, run);
    }
    if (mode === 'rest') {
      p.fatigue = 0;
      msgs.push('You rested: fatigue cleared.');
    } else {
      p.fatigue = Math.max(0, p.fatigue - 1);
      const got = addXp(p, trainXp);
      msgs.push(`Training: +${trainXp} XP${got ? `, +${got} skill point${got > 1 ? 's' : ''}` : ''}.`);
    }
  }
  // second week of a Major: everyone else plays
  for (let extra = 1; extra < span; extra++) {
    const runs = season.simComWeek(s.week + extra);
    for (const run of runs.values()) newsForEvent(s, season, run);
  }
  const before = s.playerRank;
  s.week += span;
  season.recomputeRanks(s.week);
  const after = s.playerRank;
  s.rankHistory.push([s.week, after]);
  if (s.rankHistory.length > 400) s.rankHistory.shift();
  if (after !== null) {
    if (!p.careerHigh || after < p.careerHigh.rank) {
      p.careerHigh = { rank: after, week: s.week };
      if (before !== null && after < before) msgs.push(`New career-high ranking: #${after}`);
    }
    for (const m of [1, 10, 20, 50, 100, 200, 300, 500]) {
      if (after <= m && (before === null || before > m)) {
        pushNews(s, m === 1 ? 'You are the new world No. 1!' : `You broke into the top ${m}!`);
        msgs.push(m === 1 ? 'WORLD No. 1!' : `You broke into the top ${m}!`);
        break;
      }
    }
    if (after <= 100 && p.top100Week === null) p.top100Week = s.week;
    if (before === null) {
      pushNews(s, `You earned your first ranking: #${after}`);
      msgs.push(`First ranking: #${after}`);
    }
  }
  const badges = checkBadges(p);
  for (const id of badges) {
    pushNews(s, `Badge unlocked: ${BADGES[id].name}!`);
    msgs.push(`Badge unlocked: ${BADGES[id].name}`);
  }
  season.sync();
  if (s.wildcard && s.wildcard.absWeek < s.week) s.wildcard = null;
  beginWeek(s);
  saveCareer(s);
  return msgs;
}

export { MAJOR_NAMES, groupStandings, advanceFinals };
