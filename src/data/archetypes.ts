import { ArchetypeId, Stats, ShotType, StatKey, STAT_KEYS } from './types';

export interface AiProfile {
  homeBack: number; // metres behind the baseline when recovering
  netRush: number; // chance to follow a shot to the net
  shotW: Record<ShotType, number>;
  aggression: number; // 0..1, how often it goes for the lines
  serve: { flat: number; kick: number; slice: number };
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  desc: string;
  caps: Stats;
  ai: AiProfile;
}

const caps = (o: Partial<Stats>, base = 78): Stats => {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = o[k] ?? base;
  return s;
};

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  bigServer: {
    id: 'bigServer', name: 'Big Server', desc: 'Huge first serve, short points. Weaker movement.',
    caps: caps({ serve: 99, forehand: 88, backhand: 76, footwork: 70, volley: 82, touch: 66, spin: 74, ret: 70, endurance: 76, mental: 84 }),
    ai: { homeBack: 0.7, netRush: 0.25, shotW: { normal: 5, topspin: 2, slice: 1.5, lob: 0.3, drop: 0.3 }, aggression: 0.75, serve: { flat: 6, kick: 1, slice: 2 } },
  },
  grinder: {
    id: 'grinder', name: 'Baseline Grinder', desc: 'Never misses, endless stamina. Rarely comes forward.',
    caps: caps({ serve: 74, forehand: 86, backhand: 88, footwork: 90, volley: 64, touch: 70, spin: 88, ret: 88, endurance: 99, mental: 86 }),
    ai: { homeBack: 1.8, netRush: 0.03, shotW: { normal: 3, topspin: 5, slice: 1.5, lob: 0.8, drop: 0.3 }, aggression: 0.3, serve: { flat: 1, kick: 4, slice: 2 } },
  },
  aggressive: {
    id: 'aggressive', name: 'Aggressive Baseliner', desc: 'Takes the ball early and rips winners off both wings.',
    caps: caps({ serve: 84, forehand: 97, backhand: 92, footwork: 82, volley: 72, touch: 68, spin: 82, ret: 86, endurance: 80, mental: 78 }),
    ai: { homeBack: 0.3, netRush: 0.12, shotW: { normal: 6, topspin: 3, slice: 0.6, lob: 0.2, drop: 0.5 }, aggression: 0.85, serve: { flat: 4, kick: 2, slice: 2 } },
  },
  serveVolley: {
    id: 'serveVolley', name: 'Serve-and-Volleyer', desc: 'Rushes the net behind the serve. Soft hands.',
    caps: caps({ serve: 92, forehand: 78, backhand: 74, footwork: 84, volley: 99, touch: 90, spin: 70, ret: 76, endurance: 78, mental: 82 }),
    ai: { homeBack: 0.6, netRush: 0.7, shotW: { normal: 3, topspin: 1, slice: 4, lob: 0.3, drop: 1.2 }, aggression: 0.6, serve: { flat: 3, kick: 3, slice: 3 } },
  },
  counterpuncher: {
    id: 'counterpuncher', name: 'Counterpuncher', desc: 'Lightning feet, turns defence into offence.',
    caps: caps({ serve: 70, forehand: 82, backhand: 86, footwork: 97, volley: 70, touch: 84, spin: 80, ret: 94, endurance: 92, mental: 90 }),
    ai: { homeBack: 1.6, netRush: 0.05, shotW: { normal: 4, topspin: 2, slice: 2.5, lob: 1.6, drop: 0.6 }, aggression: 0.35, serve: { flat: 1, kick: 3, slice: 3 } },
  },
  allCourt: {
    id: 'allCourt', name: 'All-Court Artist', desc: 'Every shot in the book, no glaring weakness, no 99s.',
    caps: caps({ serve: 86, forehand: 89, backhand: 89, footwork: 87, volley: 89, touch: 92, spin: 86, ret: 86, endurance: 84, mental: 88 }),
    ai: { homeBack: 0.8, netRush: 0.3, shotW: { normal: 4, topspin: 2.5, slice: 2.5, lob: 0.7, drop: 1.2 }, aggression: 0.6, serve: { flat: 3, kick: 3, slice: 3 } },
  },
  claySpec: {
    id: 'claySpec', name: 'Clay Specialist', desc: 'Heavy topspin and slides. Lethal on red dirt.',
    caps: caps({ serve: 76, forehand: 90, backhand: 84, footwork: 88, volley: 66, touch: 86, spin: 99, ret: 84, endurance: 94, mental: 84 }),
    ai: { homeBack: 2.0, netRush: 0.04, shotW: { normal: 2, topspin: 6, slice: 1, lob: 0.8, drop: 1.0 }, aggression: 0.45, serve: { flat: 1, kick: 5, slice: 2 } },
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/** Combined cap for a primary + secondary build. */
export function buildCaps(primary: ArchetypeId, secondary: ArchetypeId): Stats {
  const a = ARCHETYPES[primary].caps;
  const b = ARCHETYPES[secondary].caps;
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = Math.max(55, Math.max(a[k], b[k] - 8));
  // the pair can never exceed a total budget, so nobody maxes everything
  return out;
}

export function statEmphasis(id: ArchetypeId): Partial<Record<StatKey, number>> {
  const c = ARCHETYPES[id].caps;
  const out: Partial<Record<StatKey, number>> = {};
  for (const k of STAT_KEYS) out[k] = (c[k] - 78) / 20;
  return out;
}
