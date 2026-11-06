import { RANKING, TierId } from '../data/tour';

/** A ranking result: absolute week (season*52 + week), points earned, tier. Stored compactly as a tuple. */
export type Result = [week: number, points: number, tier: TierId];

export function isValid(r: Result, currentWeek: number): boolean {
  // a result counts for 52 weeks: it drops off when the same week comes around again
  return r[0] <= currentWeek && currentWeek - r[0] < RANKING.windowWeeks;
}

/** Remove results that have dropped off. */
export function dropExpired(results: Result[], currentWeek: number): Result[] {
  return results.filter((r) => isValid(r, currentWeek));
}

/** Ranking total: best 19 results in the window (+ Tour Finals as an extra counting result). */
export function rankingPoints(results: Result[], currentWeek: number): number {
  let finals = 0;
  const pts: number[] = [];
  for (const r of results) {
    if (!isValid(r, currentWeek)) continue;
    if (r[2] === 'finals') finals += r[1];
    else pts.push(r[1]);
  }
  pts.sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < Math.min(RANKING.countBest, pts.length); i++) sum += pts[i];
  return sum + finals;
}

export function countedEvents(results: Result[], currentWeek: number): number {
  return Math.min(RANKING.countBest, results.filter((r) => isValid(r, currentWeek) && r[2] !== 'finals').length);
}

export interface RankRow {
  id: string;
  name: string;
  points: number;
  events: number;
}

/** Sort into a ranking. Players with 0 points are unranked (rank null). Ties: fewer events, then name. */
export function computeRanks(rows: RankRow[]): Map<string, number | null> {
  const ranked = rows.filter((r) => r.points > 0).sort((a, b) => b.points - a.points || a.events - b.events || a.name.localeCompare(b.name));
  const out = new Map<string, number | null>();
  ranked.forEach((r, i) => out.set(r.id, i + 1));
  for (const r of rows) if (!out.has(r.id)) out.set(r.id, null);
  return out;
}
