import { CareerPlayer, CareerState } from './state';
import { buildCaps } from '../data/archetypes';
import { Stats, StatKey, STAT_KEYS, ovr } from '../data/types';
import { PROGRESSION, TIERS, TierId } from '../data/tour';
import { BADGES } from '../data/badges';

export function playerCaps(p: CareerPlayer): Stats {
  return buildCaps(p.primary, p.secondary);
}

export function matchXp(tier: TierId, won: boolean, perfects: number): number {
  const base = PROGRESSION.xpPerMatch + (won ? PROGRESSION.xpPerWin : 0);
  return Math.round(base * TIERS[tier].xp + Math.min(30, perfects) * PROGRESSION.xpPerPerfect);
}

export function addXp(p: CareerPlayer, xp: number): number {
  p.xp += xp;
  p.totalXp += xp;
  let gained = 0;
  while (p.xp >= PROGRESSION.xpPerSP) {
    p.xp -= PROGRESSION.xpPerSP;
    p.sp++;
    gained++;
  }
  return gained;
}

export function statCost(v: number): number {
  return PROGRESSION.cost(v);
}

export function canRaise(p: CareerPlayer, k: StatKey): boolean {
  const caps = playerCaps(p);
  return p.stats[k] < caps[k] && p.sp >= statCost(p.stats[k]);
}

export function raise(p: CareerPlayer, k: StatKey): boolean {
  if (!canRaise(p, k)) return false;
  p.sp -= statCost(p.stats[k]);
  p.stats[k]++;
  return true;
}

/** Simple auto-build used by quick-sim verification: raise the stat with the best gain per SP. */
export function autoSpend(p: CareerPlayer): void {
  const caps = playerCaps(p);
  const weight: Record<StatKey, number> = { forehand: 1.3, backhand: 1.2, serve: 1.3, footwork: 1.3, volley: 0.6, touch: 0.5, spin: 0.7, ret: 1.1, endurance: 0.7, mental: 0.9 };
  let guard = 0;
  while (p.sp > 0 && guard++ < 500) {
    let best: StatKey | null = null;
    let bestScore = -1;
    for (const k of STAT_KEYS) {
      if (p.stats[k] >= caps[k]) continue;
      const c = statCost(p.stats[k]);
      if (c > p.sp) continue;
      const score = (weight[k] / c) * (1 + (caps[k] - p.stats[k]) / 100);
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (!best) break;
    raise(p, best);
  }
}

/** Check unlock conditions; returns newly unlocked badge ids. Auto-equips up to 3. */
export function checkBadges(p: CareerPlayer): string[] {
  const s = p.stats;
  const cond: Record<string, boolean> = {
    aceMachine: s.serve >= 75 && p.aces >= 50,
    wall: s.footwork >= 75 && p.longRallies >= 10,
    netMagnet: s.volley >= 70,
    clutch: s.mental >= 70 && p.bpSaved >= 20,
    ironLungs: s.endurance >= 75,
    dirtballer: p.titles.some((t) => t.surface === 'clay'),
  };
  const out: string[] = [];
  for (const id of Object.keys(BADGES)) {
    if (cond[id] && !p.badges.includes(id)) {
      p.badges.push(id);
      out.push(id);
      if (p.equipped.length < 3) p.equipped.push(id);
    }
  }
  return out;
}

export function fatigueStamina(p: CareerPlayer): number {
  return Math.max(100 - PROGRESSION.fatigueMax, 100 - p.fatigue * PROGRESSION.fatiguePerWeek);
}

export function playerOvrNow(s: CareerState): number {
  return ovr(s.player.stats);
}
