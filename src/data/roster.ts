import { Rng } from '../core/rng';
import { genName, CITIES } from './names';
import { ArchetypeId, Kit, PlayerSetup, Stats, STAT_KEYS, ovr } from './types';
import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes';
import { SurfaceId } from './surfaces';
import { personalBlend, TacticBlend } from './tactics';

export interface Pro {
  id: number;
  first: string;
  last: string;
  city: string;
  age: number;
  archetype: ArchetypeId;
  hand: 'R' | 'L';
  twoHanded: boolean;
  stats: Stats;
  fav: SurfaceId;
  kit: Kit;
}

const SKIN = ['#f3cfb0', '#e6b08a', '#c98e62', '#9b6640', '#6e4528', '#f7dcc4'];
const HAIR = ['#2b1d12', '#5a3a1f', '#c99b52', '#111111', '#8a4b2a', '#d8d0c0', '#3a2614'];
const ACCENT = ['#ffffff', '#e84a4a', '#3a7bd5', '#2fa86b', '#f5c542', '#222a35', '#8f5bd6', '#f07a3a'];

/** Generate a pro with a target overall level. */
export function makePro(id: number, level: number, r: Rng): Pro {
  const n = genName(r);
  const arch = r.pick(ARCHETYPE_IDS);
  const caps = ARCHETYPES[arch].caps;
  const stats = {} as Stats;
  for (const k of STAT_KEYS) {
    const emphasis = (caps[k] - 80) / 20; // -0.75 .. +0.95
    stats[k] = Math.round(Math.max(20, Math.min(caps[k], level + emphasis * 9 + r.gauss() * 4)));
  }
  const fav: SurfaceId = arch === 'claySpec' ? 'clay' : arch === 'serveVolley' || arch === 'bigServer' ? r.pick(['grass', 'hard'] as SurfaceId[]) : r.pick(['hard', 'hard', 'clay', 'grass'] as SurfaceId[]);
  const accent = r.pick(ACCENT);
  return {
    id, first: n.first, last: n.last, city: r.pick(CITIES), age: r.int(18, 34), archetype: arch,
    hand: r.chance(0.13) ? 'L' : 'R', twoHanded: r.chance(0.8), stats, fav,
    kit: { shirt: r.chance(0.6) ? '#ffffff' : accent, shorts: r.chance(0.7) ? '#ffffff' : '#2a3a55', band: accent, skin: r.pick(SKIN), hair: r.pick(HAIR), shoes: '#f4f4f4' },
  };
}

/** The fixed tour roster: ~300 pros from elite down to journeymen. */
export function generateRoster(seed = 2026, count = 500): Pro[] {
  const r = new Rng(seed);
  const out: Pro[] = [];
  for (let i = 0; i < count; i++) {
    // level curve: top ~89, #10 ~82, #100 ~70, #300 ~58
    const rank = i + 1;
    const level = 89 - 7 * Math.log10(rank) - rank * 0.045 + r.gauss() * 1.5;
    out.push(makePro(i + 1, level, r));
  }
  return out;
}

let cached: Pro[] | null = null;
export function roster(): Pro[] {
  if (!cached) cached = generateRoster();
  return cached;
}

export function proName(p: Pro): string {
  return `${p.first[0]}. ${p.last}`;
}

export function proSetup(p: Pro, short = 'COM', startStamina = 100): PlayerSetup {
  return {
    name: `${p.first} ${p.last}`, short, stats: { ...p.stats }, archetype: p.archetype, kit: p.kit, hand: p.hand,
    twoHanded: p.twoHanded, badges: [], startStamina, city: p.city, tactics: proBlend(p),
  };
}

/** A pro's personal game-plan blend (deterministic from id, does not disturb the roster RNG). */
export function proBlend(p: Pro): TacticBlend {
  return personalBlend(p.archetype, p.id);
}

export function proOvr(p: Pro): number {
  return ovr(p.stats);
}
