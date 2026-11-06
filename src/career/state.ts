import { ArchetypeId, Kit, Stats, STAT_KEYS, ovr } from '../data/types';
import { SurfaceId } from '../data/surfaces';
import { TierId, PROGRESSION, RANKING } from '../data/tour';
import { Result } from './rankings';
import { ARCHETYPES, buildCaps } from '../data/archetypes';
import { loadJSON, saveJSON, removeKey } from '../core/save';
import type { EventRun } from './season';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'career';

export interface Title {
  name: string;
  tier: TierId;
  surface: SurfaceId;
  season: number;
}

export interface CareerPlayer {
  name: string;
  hand: 'R' | 'L';
  twoHanded: boolean;
  kit: Kit;
  primary: ArchetypeId;
  secondary: ArchetypeId;
  stats: Stats;
  xp: number; // xp towards next SP
  sp: number;
  totalXp: number;
  badges: string[]; // unlocked
  equipped: string[];
  fatigue: number; // consecutive weeks played
  careerHigh: { rank: number; week: number } | null;
  titles: Title[];
  wl: Record<SurfaceId, [number, number]>;
  majors: Record<string, string>; // "S1 Southern Cross Open" -> "QF"
  aces: number;
  longRallies: number;
  bpSaved: number;
  perfects: number;
  matches: number;
  top100Week: number | null;
  firstMajorMainWeek: number | null;
}

export interface ProState {
  id: number;
  results: Result[];
  points: number;
  rank: number | null;
  busyUntil: number;
}

export interface CareerState {
  version: number;
  seed: number;
  rngState: number;
  week: number; // absolute week, season 1 week 1 = 1
  player: CareerPlayer;
  playerResults: Result[];
  playerPoints: number;
  playerRank: number | null;
  pros: ProState[];
  news: string[];
  wildcard: { eventId: string; absWeek: number } | null;
  current: EventRun | null;
  rankHistory: [number, number | null][];
  /** COM results computed for the current week (applied at week end) */
  weekDone: boolean;
}

export function seasonOf(absWeek: number): number {
  return Math.floor((absWeek - 1) / RANKING.weeksPerSeason) + 1;
}
export function weekOfSeason(absWeek: number): number {
  return ((absWeek - 1) % RANKING.weeksPerSeason + RANKING.weeksPerSeason) % RANKING.weeksPerSeason + 1;
}
export function absWeek(season: number, wos: number): number {
  return (season - 1) * RANKING.weeksPerSeason + wos;
}

export interface NewPlayerOpts {
  name: string;
  hand: 'R' | 'L';
  twoHanded: boolean;
  kit: Kit;
  primary: ArchetypeId;
  secondary: ArchetypeId;
}

export function startingStats(primary: ArchetypeId, secondary: ArchetypeId): Stats {
  const caps = buildCaps(primary, secondary);
  const s = {} as Stats;
  for (const k of STAT_KEYS) {
    const emph = (caps[k] - 80) / 20;
    s[k] = Math.round(Math.max(20, PROGRESSION.startLevel + emph * 8));
  }
  return s;
}

export function newPlayer(o: NewPlayerOpts): CareerPlayer {
  return {
    ...o,
    stats: startingStats(o.primary, o.secondary),
    xp: 0, sp: 3, totalXp: 0, badges: [], equipped: [], fatigue: 0, careerHigh: null, titles: [],
    wl: { grass: [0, 0], clay: [0, 0], hard: [0, 0] }, majors: {}, aces: 0, longRallies: 0, bpSaved: 0, perfects: 0, matches: 0,
    top100Week: null, firstMajorMainWeek: null,
  };
}

export function playerOvr(p: CareerPlayer): number {
  return ovr(p.stats);
}

export function archetypeLabel(p: CareerPlayer): string {
  return `${ARCHETYPES[p.primary].name} / ${ARCHETYPES[p.secondary].name}`;
}

// ---------------------------------------------------------------- persistence
export function saveCareer(s: CareerState): boolean {
  return saveJSON(SAVE_KEY, s);
}

export function loadCareer(): CareerState | null {
  const s = loadJSON<CareerState | null>(SAVE_KEY, null);
  return validateCareer(s) ? s : null;
}

export function deleteCareer(): void {
  removeKey(SAVE_KEY);
}

export function validateCareer(s: unknown): s is CareerState {
  if (!s || typeof s !== 'object') return false;
  const c = s as CareerState;
  return c.version === SAVE_VERSION && typeof c.week === 'number' && !!c.player && Array.isArray(c.pros) && Array.isArray(c.playerResults);
}

export function exportCareer(s: CareerState): void {
  try {
    const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `baseline-career-${s.player.name.replace(/[^a-z0-9]/gi, '_')}-s${seasonOf(s.week)}w${weekOfSeason(s.week)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  } catch {
    /* ignore */
  }
}

export function importCareer(cb: (s: CareerState | null, err?: string) => void): void {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files?.[0];
    if (!f) return cb(null, 'No file');
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const s = JSON.parse(String(rd.result));
        if (validateCareer(s)) cb(s);
        else cb(null, 'Not a valid Baseline career file');
      } catch {
        cb(null, 'Could not read file');
      }
    };
    rd.readAsText(f);
  };
  inp.click();
}

/** Import from a JSON string (used by tests and file import). */
export function parseCareer(json: string): CareerState | null {
  try {
    const s = JSON.parse(json);
    return validateCareer(s) ? s : null;
  } catch {
    return null;
  }
}
