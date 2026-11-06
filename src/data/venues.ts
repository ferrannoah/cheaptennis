/**
 * Venues (M18): the stadium look around the court. Each surface has its own theme; Majors get a
 * grander version; the atmosphere builds through the rounds (`stage` 0 = first round, 1 = final).
 * No advertising: courtside walls are plain themed windscreens.
 */
import type { SurfaceId } from './surfaces';

export interface VenueTheme {
  id: string;
  sky: [string, string];
  /** alternating stand row colours + the riser colour */
  stand: [string, string];
  riser: string;
  /** back wall / roof band */
  wall: string;
  roofBand: string;
  /** courtside sponsor boards: background, lettering, accent */
  board: string;
  boardText: string;
  boardAccent: string;
  /** banner colours for Majors */
  banners: string[];
  /** extra wall decoration */
  ivy?: boolean;
  night?: boolean;
}

export const THEMES: Record<string, VenueTheme> = {
  // grass: green and purple, ivy on the walls, cream stands
  grass: {
    id: 'grass', sky: ['#5ea9e0', '#cfe8f7'], stand: ['#e8dfc6', '#ddd2b4'], riser: '#b8ab88', wall: '#24503a', roofBand: '#4b2a6e',
    board: '#174a2c', boardText: '#e3c463', boardAccent: '#5b2f86', banners: ['#4b2a6e', '#1f6b46', '#f2efe4'], ivy: true,
  },
  // clay: terracotta and navy, an open-air bowl
  clay: {
    id: 'clay', sky: ['#4e9ee0', '#d6ecfa'], stand: ['#d9d0c2', '#cdc1ae'], riser: '#a9998a', wall: '#1d2c4f', roofBand: '#c4572c',
    board: '#1d2c4f', boardText: '#ffffff', boardAccent: '#e07a3c', banners: ['#1d2c4f', '#c4572c', '#ffffff'],
  },
  // hard: blue and teal
  hard: {
    id: 'hard', sky: ['#5aa8e6', '#bfe3fa'], stand: ['#33557c', '#2c4a6e'], riser: '#203955', wall: '#16304d', roofBand: '#1fb5a8',
    board: '#0d3b4f', boardText: '#7af0e0', boardAccent: '#1f7ad8', banners: ['#1f7ad8', '#1fb5a8', '#ffffff'],
  },
  // hard court night session
  hardNight: {
    id: 'hardNight', sky: ['#0a1430', '#1c2f5c'], stand: ['#2a466a', '#243d5d'], riser: '#172b44', wall: '#0f2238', roofBand: '#1fb5a8',
    board: '#0b2e3e', boardText: '#7af0e0', boardAccent: '#1f7ad8', banners: ['#1f7ad8', '#1fb5a8', '#ffffff'], night: true,
  },
};

export type VenueTier = 'practice' | 'tour' | 'major' | 'final';

export interface Venue {
  theme: VenueTheme;
  tier: VenueTier;
  /**
   * size of the event 0..5: 0 Futures / practice (park court, tiny bleachers), 1 Challenger,
   * 2 Tour 250, 3 Tour 500 (Exhibition / Tournament default), 4 Masters 1000, 5 Major / Tour Finals
   */
  level: number;
  /** 0 = first round .. 1 = final */
  stage: number;
  /** event name for the court (Majors) and the intro card */
  name: string;
  /** e.g. "QUARTERFINAL" for the walk-on card */
  round: string;
}

export interface VenueLook {
  /** side stand rows */
  standRows: number;
  /** far stand rows (0 = none) */
  farRows: number;
  /** y range the side stands cover */
  sideRange: [number, number];
  /** park court: aluminium bleachers, grass and trees instead of a stadium */
  park: boolean;
  /** chance a seat is empty */
  empty: number;
  /** crowd noise multiplier for applause */
  noise: number;
  /** camera flashes per second in the crowd at big moments */
  flashes: number;
  banners: boolean;
  photographers: boolean;
  wallName: boolean;
  /** show the walk-on intro card */
  introCard: boolean;
}

/** How a venue looks and sounds: small events are near-empty park courts; the crowd grows with the level and the round. */
export function venueLook(v: Venue): VenueLook {
  const s = Math.max(0, Math.min(1, v.stage));
  const L = Math.max(0, Math.min(5, Math.round(v.level)));
  const full: [number, number] = [-24, 25];
  const base = { banners: false, photographers: false, wallName: false, introCard: false, flashes: 0 };
  if (v.tier === 'practice') return { ...base, standRows: 2, farRows: 0, sideRange: [-6, 13], park: true, empty: 0.97, noise: 0.25 };
  switch (L) {
    case 0: return { ...base, standRows: 2, farRows: 0, sideRange: [-6, 13], park: true, empty: 0.72 - 0.2 * s, noise: 0.3 + 0.15 * s };
    case 1: return { ...base, standRows: 3, farRows: 2, sideRange: [-13, 18], park: true, empty: 0.5 - 0.2 * s, noise: 0.45 + 0.2 * s, flashes: 0.3 * s };
    case 2: return { ...base, standRows: 5, farRows: 4, sideRange: full, park: false, empty: 0.36 - 0.2 * s, noise: 0.65 + 0.25 * s, flashes: 1 * (0.3 + s), introCard: s >= 0.6 };
    case 3: return { ...base, standRows: 7, farRows: 7, sideRange: full, park: false, empty: 0.3 - 0.24 * s, noise: 0.85 + 0.35 * s, flashes: 1.5 * (0.3 + s), photographers: s >= 0.75, introCard: s >= 0.6 };
    case 4: return { ...base, standRows: 8, farRows: 8, sideRange: full, park: false, empty: 0.2 - 0.17 * s, noise: 0.95 + 0.35 * s, flashes: 2.5 * (0.3 + s), photographers: s >= 0.5, introCard: s >= 0.6 };
    default: return { standRows: 10, farRows: 10, sideRange: full, park: false, empty: 0.14 - 0.13 * s, noise: 1.05 + 0.35 * s, flashes: 4 * (0.3 + s), banners: true, photographers: true, wallName: true, introCard: s >= 0.6 };
  }
}

/** venue level from a career tier id */
export function levelForTier(tier: string): number {
  return ({ f15: 0, f25: 0, c75: 1, c125: 1, t250: 2, t500: 3, m1000: 4, major: 5, finals: 5 } as Record<string, number>)[tier] ?? 3;
}

export function venueFor(surface: SurfaceId, opts: { tier?: VenueTier; level?: number; stage?: number; name?: string; round?: string; night?: boolean } = {}): Venue {
  const themeId = surface === 'hard' && opts.night ? 'hardNight' : surface;
  const tier = opts.tier ?? 'tour';
  const level = opts.level ?? (tier === 'major' || tier === 'final' ? 5 : tier === 'practice' ? 0 : 3);
  return { theme: THEMES[themeId], tier, level, stage: opts.stage ?? 0.4, name: opts.name ?? '', round: opts.round ?? '' };
}

/** stage 0..1 from a knockout round: players left vs. draw size */
export function stageFromDraw(size: number, playersLeft: number): number {
  const total = Math.log2(Math.max(2, size));
  if (total <= 1) return 1;
  return Math.max(0, Math.min(1, (total - Math.log2(Math.max(2, playersLeft))) / (total - 1)));
}

/** cache key for pre-rendered layers */
export function venueKey(v: Venue): string {
  const l = venueLook(v);
  return `${v.theme.id}|${v.tier}|${v.level}|${l.standRows}|${l.farRows}|${l.park}|${l.banners ? v.name : ''}`;
}
