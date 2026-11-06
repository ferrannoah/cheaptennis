/**
 * THE TOUR: every tier, points table, entry cutoff and the season calendar live in this one file.
 * Values are simplified analogues of the real men's pro ladder. All event names are fictional.
 */
import { SurfaceId } from './surfaces';

export type TierId = 'f15' | 'f25' | 'c75' | 'c125' | 't250' | 't500' | 'm1000' | 'major' | 'finals';

export interface Tier {
  id: TierId;
  name: string;
  short: string;
  analog: string;
  draw: number;
  winnerPts: number;
  /** direct-entry cutoff (max rank), null = open to all */
  direct: number | null;
  /** qualifying cutoff (max rank), null = no qualifying */
  qual: number | null;
  qualDraw: number;
  qualRounds: number;
  /** points by finishing position: [W, F, SF, QF, R16, R32, R64, R128] (only as many as rounds + 1) */
  points: number[];
  /** bonus added to main-draw points for players who came through qualifying */
  qualBonus: number;
  /** points for losing in qualifying: [lost in final qual round, the round before, ...] */
  qualPts: number[];
  /** XP multiplier for career progression */
  xp: number;
  /** COM players ranked better than this skip the tier (they play bigger events) */
  comFloor: number;
  color: string;
  prestige: number;
}

export const TIERS: Record<TierId, Tier> = {
  f15: { id: 'f15', name: 'Futures 15', short: 'M15', analog: 'ITF M15', draw: 32, winnerPts: 15, direct: null, qual: null, qualDraw: 0, qualRounds: 0, points: [15, 8, 4, 2, 1, 0], qualBonus: 0, qualPts: [], xp: 1.0, comFloor: 260, color: '#8aa0b8', prestige: 1 },
  f25: { id: 'f25', name: 'Futures 25', short: 'M25', analog: 'ITF M25', draw: 32, winnerPts: 25, direct: null, qual: null, qualDraw: 0, qualRounds: 0, points: [25, 16, 8, 3, 1, 0], qualBonus: 0, qualPts: [], xp: 1.2, comFloor: 210, color: '#9ab0c8', prestige: 2 },
  c75: { id: 'c75', name: 'Challenger 75', short: 'CH75', analog: 'Challenger 75', draw: 32, winnerPts: 75, direct: 350, qual: 550, qualDraw: 16, qualRounds: 2, points: [75, 44, 22, 12, 6, 0], qualBonus: 3, qualPts: [1, 0], xp: 1.6, comFloor: 75, color: '#6fc3a0', prestige: 3 },
  c125: { id: 'c125', name: 'Challenger 125', short: 'CH125', analog: 'Challenger 125', draw: 32, winnerPts: 125, direct: 220, qual: 400, qualDraw: 16, qualRounds: 2, points: [125, 75, 44, 25, 13, 0], qualBonus: 6, qualPts: [3, 0], xp: 2.0, comFloor: 45, color: '#4fb38a', prestige: 4 },
  t250: { id: 't250', name: 'Tour 250', short: '250', analog: 'ATP 250', draw: 32, winnerPts: 250, direct: 80, qual: 200, qualDraw: 16, qualRounds: 2, points: [250, 165, 100, 50, 25, 0], qualBonus: 12, qualPts: [6, 0], xp: 2.6, comFloor: 1, color: '#5aa0e6', prestige: 5 },
  t500: { id: 't500', name: 'Tour 500', short: '500', analog: 'ATP 500', draw: 32, winnerPts: 500, direct: 50, qual: 130, qualDraw: 16, qualRounds: 2, points: [500, 330, 200, 100, 50, 0], qualBonus: 20, qualPts: [8, 0], xp: 3.2, comFloor: 1, color: '#4a7fe0', prestige: 6 },
  m1000: { id: 'm1000', name: 'Masters 1000', short: '1000', analog: 'ATP Masters 1000', draw: 64, winnerPts: 1000, direct: 45, qual: 120, qualDraw: 32, qualRounds: 2, points: [1000, 650, 400, 200, 100, 50, 10], qualBonus: 20, qualPts: [10, 0], xp: 4.0, comFloor: 1, color: '#b06ae0', prestige: 7 },
  major: { id: 'major', name: 'Major', short: 'MAJOR', analog: 'Grand Slam', draw: 128, winnerPts: 2000, direct: 104, qual: 240, qualDraw: 64, qualRounds: 3, points: [2000, 1300, 800, 400, 200, 100, 50, 10], qualBonus: 30, qualPts: [16, 8, 0], xp: 5.0, comFloor: 1, color: '#ffb02e', prestige: 9 },
  finals: { id: 'finals', name: 'Tour Finals', short: 'FINALS', analog: 'ATP Finals', draw: 8, winnerPts: 1500, direct: 8, qual: null, qualDraw: 0, qualRounds: 0, points: [], qualBonus: 0, qualPts: [], xp: 5.0, comFloor: 1, color: '#ff5a7a', prestige: 8 },
};

/** Tour Finals scoring: per round-robin win, semi-final win, final win (max 1500). */
export const FINALS_PTS = { rrWin: 200, sfWin: 400, fWin: 500 };

export const TIER_ORDER: TierId[] = ['major', 'finals', 'm1000', 't500', 't250', 'c125', 'c75', 'f25', 'f15'];

export const RANKING = {
  windowWeeks: 52,
  countBest: 19,
  weeksPerSeason: 52,
};

export const MAJOR_NAMES = ['Southern Cross Open', 'Terre Rouge Championships', 'Greenhaven Championships', 'Liberty Open'];

export interface EventDef {
  id: string; // unique within a season, e.g. "w03-major"
  week: number; // week of the season, 1..52
  weeks: number; // duration (Majors = 2)
  tier: TierId;
  surface: SurfaceId;
  name: string;
  indoor?: boolean;
}

// ---------------------------------------------------------------- season template
type WeekPlan = { s: SurfaceId; ev: (TierId | [TierId, string] | [TierId, string, SurfaceId])[]; indoor?: boolean };

/** The season shape: hard-court start + Major 1, spring hard Masters, clay ending in Major 2,
 *  a short grass swing with Major 3, summer hard courts with Major 4, indoor autumn, Finals, off-season. */
const PLAN: Record<number, WeekPlan> = {
  1: { s: 'hard', ev: [['t250', 'Port Aurel International'], ['t250', 'Lumen Bay Open'], 'c75', 'f15', 'f25'] },
  2: { s: 'hard', ev: [['t250', 'Sol Marena Classic'], 'c125', 'c75', 'f15', 'f25'] },
  3: { s: 'hard', ev: [['major', 'Southern Cross Open'], 'c75', 'f15', 'f25'] },
  4: { s: 'hard', ev: ['c125', 'c75', 'f15', 'f25'] },
  5: { s: 'hard', indoor: true, ev: [['t250', 'Northgate Indoors'], ['t250', 'Ostmark Open'], 'c75', 'f15', 'f25'] },
  6: { s: 'hard', ev: [['t500', 'Mirabel Championships'], ['t250', 'Doranza Open'], 'c125', 'f15', 'f25'] },
  7: { s: 'hard', ev: [['t500', 'Halcyon Cup'], ['t250', 'Zafira Open'], 'c75', 'f15', 'f25'] },
  8: { s: 'hard', ev: [['t250', 'Aster Point Open'], 'c125', 'c75', 'f15', 'f25'] },
  9: { s: 'hard', ev: ['c75', 'f15', 'f25'] },
  10: { s: 'hard', ev: [['m1000', 'Desert Bloom Masters'], 'c75', 'f15', 'f25'] },
  11: { s: 'hard', ev: ['c125', 'c75', 'f15', 'f25'] },
  12: { s: 'hard', ev: [['m1000', 'Coral Coast Masters'], 'c75', 'f15', 'f25'] },
  13: { s: 'clay', ev: [['t250', 'Verdigris Open'], ['t250', 'Rio Plata Nova Open'], 'c75', 'f15', 'f25'] },
  14: { s: 'clay', ev: [['t250', 'Corvana Clay Cup'], 'c125', 'c75', 'f15', 'f25'] },
  15: { s: 'clay', ev: [['m1000', 'Riviera Masters'], 'c75', 'f15', 'f25'] },
  16: { s: 'clay', ev: [['t500', 'Montevar Trophy'], ['t250', 'Glenmoor Open'], 'c125', 'f15', 'f25'] },
  17: { s: 'clay', ev: [['t250', 'Tessaly Open'], ['t250', 'Ironvale Open'], 'c75', 'f15', 'f25'] },
  18: { s: 'clay', ev: [['m1000', 'Castile Masters'], 'c125', 'f15', 'f25'] },
  19: { s: 'clay', ev: [['m1000', 'Imperial Masters'], 'c75', 'f15', 'f25'] },
  20: { s: 'clay', ev: [['t250', 'Saint Elric Open'], ['t250', 'Novalis Open'], 'c125', 'f15', 'f25'] },
  21: { s: 'clay', ev: [['major', 'Terre Rouge Championships'], 'c75', 'f15', 'f25'] },
  22: { s: 'clay', ev: ['c125', 'c75', 'f15', 'f25'] },
  23: { s: 'grass', ev: [['t250', 'Elmstead Grass Open'], ['t250', 'Pinecrest Open'], 'c125', ['c75', 'Riverholm Challenger', 'clay'], 'f15', ['f25', '', 'clay']] },
  24: { s: 'grass', ev: [['t500', 'Brightwater Lawn Championships'], ['t250', 'Calder Reach Open'], 'c75', 'f15', ['f25', '', 'clay']] },
  25: { s: 'grass', ev: [['t250', 'Baylor Sands Open'], 'c75', ['f15', '', 'clay'], ['f25', '', 'clay']] },
  26: { s: 'grass', ev: [['major', 'Greenhaven Championships'], ['c75', '', 'clay'], ['f15', '', 'clay'], ['f25', '', 'hard']] },
  27: { s: 'clay', ev: ['c125', 'c75', 'f15', ['f25', '', 'hard']] },
  28: { s: 'clay', ev: [['t250', 'Kestrova Open'], ['t250', 'Oskarvik Open'], 'c125', 'f15', 'f25'] },
  29: { s: 'hard', ev: [['t500', 'Vellmar Open'], ['t250', 'San Coral Open'], 'c75', 'f15', 'f25'] },
  30: { s: 'hard', ev: [['t250', 'Ardenfell Open'], 'c125', 'c75', 'f15', 'f25'] },
  31: { s: 'hard', ev: [['m1000', 'Maple Leaf Masters'], 'c75', 'f15', 'f25'] },
  32: { s: 'hard', ev: [['m1000', 'Riverbend Masters'], 'c125', 'f15', 'f25'] },
  33: { s: 'hard', ev: [['t250', 'Harbourview Open'], 'c75', 'f15', 'f25'] },
  34: { s: 'hard', ev: [['major', 'Liberty Open'], 'c75', 'f15', 'f25'] },
  35: { s: 'hard', ev: ['c125', 'c75', 'f15', 'f25'] },
  36: { s: 'hard', ev: ['c75', 'f15', 'f25'] },
  37: { s: 'hard', ev: [['t250', 'Halvard Open'], ['t250', 'Sunvale Open'], 'c125', 'f15', 'f25'] },
  38: { s: 'hard', indoor: true, ev: [['t500', 'Eastwind Championships'], ['t250', 'Coldharbour Indoors'], 'c75', 'f15', 'f25'] },
  39: { s: 'hard', ev: [['m1000', 'Jade Harbour Masters'], 'c75', 'f15', 'f25'] },
  40: { s: 'hard', indoor: true, ev: [['t250', 'Nordvik Indoors'], ['t250', 'Ashford Open'], 'c125', 'f15', 'f25'] },
  41: { s: 'hard', indoor: true, ev: [['t500', 'Kaiserhalle Open'], ['t250', 'Westmere Open'], 'c75', 'f15', 'f25'] },
  42: { s: 'hard', indoor: true, ev: [['m1000', 'Lumiere Masters'], 'c125', 'f15', 'f25'] },
  43: { s: 'hard', indoor: true, ev: [['t250', 'Frostgate Open'], 'c75', 'f15', 'f25'] },
  44: { s: 'hard', ev: ['c75', 'f15', 'f25'] },
  45: { s: 'hard', indoor: true, ev: [['finals', 'Season Finale']] },
};

export const OFFSEASON_START = 46;

const CH_CITIES = ['Kestrova', 'Vellmar', 'Doranza', 'Ostmark', 'Tessaly', 'Glenmoor', 'Zafira', 'Novalis', 'Ardenfell', 'Pinecrest', 'Corvana', 'Halcyon', 'Mirabel', 'Calder', 'Riverholm', 'Ironvale', 'Brightwater', 'Saint Elric', 'Montevar', 'Aster Point'];

/** Build the season calendar (same every season). */
export function buildCalendar(): EventDef[] {
  const out: EventDef[] = [];
  for (const [wk, plan] of Object.entries(PLAN)) {
    const week = Number(wk);
    plan.ev.forEach((e, i) => {
      const [tier, name0, sf] = Array.isArray(e) ? [e[0], e[1] ?? '', e[2]] : [e, '', undefined];
      const city = CH_CITIES[(week * 7 + i * 3) % CH_CITIES.length];
      const name = name0 || (tier === 'f15' || tier === 'f25' ? `${TIERS[tier].short} ${city}` : `${city} Challenger`);
      out.push({
        id: `w${String(week).padStart(2, '0')}-${i}-${tier}`, week, weeks: tier === 'major' ? 2 : 1, tier,
        surface: sf ?? plan.s, name, indoor: plan.indoor,
      });
    });
  }
  return out;
}

export const CALENDAR = buildCalendar();

export function eventsInWeek(week: number): EventDef[] {
  return CALENDAR.filter((e) => e.week === week);
}

export function eventById(id: string): EventDef | undefined {
  return CALENDAR.find((e) => e.id === id);
}

/** Wildcard offers: chance per week and which tiers can offer one. */
export const WILDCARD = { chance: 0.08, tiers: ['c75', 'c125', 't250', 'major'] as TierId[], maxRankForMajor: 400 };

/** Career progression tuning. */
export const PROGRESSION = {
  startLevel: 44,
  xpPerMatch: 70,
  xpPerWin: 110,
  xpPerPerfect: 5,
  xpPerSP: 50,
  trainXp: 260,
  trainDrillMaxXp: 420,
  /** SP cost per stat point by current value */
  cost: (v: number) => (v < 60 ? 1 : v < 75 ? 2 : 3),
  fatiguePerWeek: 6,
  fatigueMax: 30,
};
