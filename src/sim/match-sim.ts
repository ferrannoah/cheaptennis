import { Rng } from '../core/rng';
import { Stats } from '../data/types';
import { SurfaceId } from '../data/surfaces';
import { Score, MatchFormat } from '../match/scoring';
import { ArchetypeId } from '../data/types';
import { TACTIC_IDS, TacticBlend, TacticId, ARCHETYPE_BLEND } from '../data/tactics';

/** How well each plan suits a surface (added to point-win chance). */
const SURF_FIT: Record<TacticId, Record<SurfaceId, number>> = {
  serve1: { grass: 0.015, clay: -0.01, hard: 0.005 },
  fhDom: { grass: 0, clay: 0.004, hard: 0.008 },
  grind: { grass: -0.012, clay: 0.02, hard: 0 },
  net: { grass: 0.022, clay: -0.022, hard: 0 },
  counter: { grass: -0.006, clay: 0.012, hard: 0.002 },
};
/** Row plan vs column plan (antisymmetric): net beats grind, counter beats net, serve1 beats counter, grind beats serve1, fhDom beats grind. */
const MATCHUP: Record<TacticId, Partial<Record<TacticId, number>>> = {
  net: { grind: 0.012, counter: -0.015 },
  counter: { net: 0.015, serve1: -0.01 },
  serve1: { counter: 0.01, grind: -0.01 },
  grind: { serve1: 0.01, net: -0.012, fhDom: -0.01 },
  fhDom: { grind: 0.01 },
};

export function tacticEdge(a: TacticBlend, b: TacticBlend, sf: SurfaceId): number {
  let e = 0;
  for (const i of TACTIC_IDS) {
    e += a[i] * SURF_FIT[i][sf] - b[i] * SURF_FIT[i][sf];
    for (const j of TACTIC_IDS) e += a[i] * b[j] * (MATCHUP[i][j] ?? 0);
  }
  return e;
}

export interface SimPlayer {
  tactics?: TacticBlend;
  stats: Stats;
  archetype: ArchetypeId;
  fav?: SurfaceId;
  /** 0..1 starting stamina factor (career fatigue) */
  fresh?: number;
  badges?: string[];
}

/** Probability that the server wins a point. Stat-driven, with surface flavour. */
export function servePointProb(s: SimPlayer, r: SimPlayer, sf: SurfaceId): number {
  const S = s.stats, R = r.stats;
  const serveRating = S.serve * 0.55 + S.forehand * 0.15 + S.volley * (sf === 'grass' ? 0.12 : 0.05) + S.mental * 0.08 + S.footwork * 0.1;
  const retRating = R.ret * 0.45 + R.backhand * 0.15 + R.forehand * 0.1 + R.footwork * 0.2 + R.mental * 0.1;
  const rally = (S.forehand + S.backhand + S.footwork + S.spin * (sf === 'clay' ? 0.8 : 0.4)) - (R.forehand + R.backhand + R.footwork + R.spin * (sf === 'clay' ? 0.8 : 0.4));
  let p = 0.615 + (serveRating - retRating) * 0.0019 + rally * 0.00032;
  if (sf === 'grass') p += 0.035;
  if (sf === 'clay') p -= 0.03;
  if (s.fav === sf) p += 0.012;
  if (r.fav === sf) p -= 0.012;
  if (sf === 'clay' && s.archetype === 'claySpec') p += 0.01;
  if (s.badges?.includes('aceMachine')) p += 0.008;
  if (r.badges?.includes('wall')) p -= 0.006;
  const fs = s.fresh ?? 1, fr = r.fresh ?? 1;
  p += (fs - fr) * 0.03;
  p += tacticEdge(s.tactics ?? ARCHETYPE_BLEND[s.archetype], r.tactics ?? ARCHETYPE_BLEND[r.archetype], sf);
  return Math.max(0.3, Math.min(0.9, p));
}

export interface SimResult {
  winner: 0 | 1;
  score: string;
  games: [number, number];
  sets: [number, number];
  points: [number, number];
}

/** Point-by-point simulation using real scoring. */
export function simMatch(a: SimPlayer, b: SimPlayer, sf: SurfaceId, format: MatchFormat, rng: Rng): SimResult {
  const sc = new Score(format, rng.chance(0.5) ? 0 : 1);
  const pA = servePointProb(a, b, sf);
  const pB = servePointProb(b, a, sf);
  // tiny per-match form swing
  const formA = rng.gauss() * 0.012;
  const formB = rng.gauss() * 0.012;
  let guard = 0;
  while (sc.winner < 0 && guard++ < 2000) {
    const srv = sc.server;
    let p = srv === 0 ? pA + formA - formB : pB + formB - formA;
    if (sc.isBigPoint()) {
      const ms = (srv === 0 ? a : b).stats.mental;
      const mr = (srv === 0 ? b : a).stats.mental;
      p += (ms - mr) * 0.0012;
    }
    const srvWins = rng.next() < p;
    sc.pointWon(srvWins ? srv : ((1 - srv) as 0 | 1));
  }
  return {
    winner: sc.winner as 0 | 1,
    score: sc.summary(),
    games: [...sc.games] as [number, number],
    sets: [...sc.sets] as [number, number],
    points: [...sc.totalPointsWon] as [number, number],
  };
}

/** Fast estimate of A's chance to beat B (used for COM-vs-COM field sims where speed matters). */
export function quickWinProb(a: SimPlayer, b: SimPlayer, sf: SurfaceId, bestOf: number): number {
  const pa = servePointProb(a, b, sf);
  const pb = servePointProb(b, a, sf);
  const edge = pa - pb; // ~ -0.3..0.3
  const k = bestOf >= 5 ? 16 : bestOf >= 3 ? 13 : 9;
  return 1 / (1 + Math.exp(-edge * k));
}
