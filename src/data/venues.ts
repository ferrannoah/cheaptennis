/**
 * Venues (M18): the stadium look around the court. Each surface has its own theme; Majors get a
 * grander version; the atmosphere builds through the rounds (`stage` 0 = first round, 1 = final).
 * All sponsor names are made up (no real brands or trademarks).
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

/** Fictional sponsors for the boards. The first one is the "timekeeper" with the clock board. */
export const SPONSORS = ['CHRONOVA', 'AURELIA', 'NORDLINE BANK', 'VANTAGE AIR', 'SOLACE WATER', 'KESTREL MOTORS', 'LUMEN', 'PIXELFOX'];

export type VenueTier = 'practice' | 'tour' | 'major' | 'final';

export interface Venue {
  theme: VenueTheme;
  tier: VenueTier;
  /** 0 = first round .. 1 = final */
  stage: number;
  /** event name for the wall (Majors) and the intro card */
  name: string;
  /** e.g. "QUARTERFINAL" for the walk-on card */
  round: string;
}

export interface VenueLook {
  standRows: number;
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

/** How a venue looks and sounds: grander for Majors, fuller and louder as the event goes on. */
export function venueLook(v: Venue): VenueLook {
  const major = v.tier === 'major' || v.tier === 'final';
  const s = Math.max(0, Math.min(1, v.stage));
  if (v.tier === 'practice') return { standRows: 7, empty: 0.85, noise: 0.4, flashes: 0, banners: false, photographers: false, wallName: false, introCard: false };
  return {
    standRows: major ? 10 : 7,
    empty: major ? 0.14 - 0.13 * s : 0.3 - 0.24 * s,
    noise: (major ? 1.05 : 0.85) + 0.35 * s,
    flashes: (major ? 4 : 1.5) * (0.3 + s),
    banners: major,
    photographers: major || s >= 0.75,
    wallName: major,
    introCard: s >= 0.6,
  };
}

export function venueFor(surface: SurfaceId, opts: { tier?: VenueTier; stage?: number; name?: string; round?: string; night?: boolean } = {}): Venue {
  const themeId = surface === 'hard' && opts.night ? 'hardNight' : surface;
  return { theme: THEMES[themeId], tier: opts.tier ?? 'tour', stage: opts.stage ?? 0.4, name: opts.name ?? '', round: opts.round ?? '' };
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
  return `${v.theme.id}|${v.tier}|${l.standRows}|${Math.round(l.empty * 20)}|${l.banners ? v.name : ''}`;
}
