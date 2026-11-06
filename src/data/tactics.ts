/**
 * AI GAME PLANS. Five tactics modelled on common singles coaching patterns. Every COM player has a
 * personal *blend* of them; before each point the AI picks one plan from its blend (weighted by the
 * situation) and adapts the blend during the match according to which plans are winning points.
 */
import { ArchetypeId, ShotType, ServeType } from './types';
import { Rng } from '../core/rng';

export type TacticId = 'serve1' | 'fhDom' | 'grind' | 'net' | 'counter';
export const TACTIC_IDS: TacticId[] = ['serve1', 'fhDom', 'grind', 'net', 'counter'];

export interface Tactic {
  id: TacticId;
  name: string;
  short: string;
  desc: string;
  /** coaching pattern it is based on */
  pattern: string;
  color: string;
  /** metres added to the archetype's recovery depth (negative = closer to the baseline) */
  homeBack: number;
  /** chance to follow an approach shot to the net */
  netRush: number;
  /** chance to serve-and-volley */
  serveVolley: number;
  /** chance to come in behind a short ball (chip-and-charge) */
  approachShort: number;
  /** multipliers on the archetype's shot-type weights */
  shotMul: Record<ShotType, number>;
  /** added to archetype aggression (how close to the lines it aims, how early it takes the ball) */
  aggression: number;
  /** when not going for the open court: chance to rally crosscourt instead of down the line */
  crossBias: number;
  /** chance to aim at the opponent's backhand side */
  targetBackhand: number;
  /** how hard it runs around the backhand to hit forehands (0..1) */
  runAround: number;
  /** depth aim: + deep and heavy, - shorter/angled */
  depth: number;
  /** multipliers on serve-type weights, and preferred serve direction (-1 wide .. 0 body .. 1 T) */
  serveMul: Record<ServeType, number>;
  serveAim: number[];
}

export const TACTICS: Record<TacticId, Tactic> = {
  serve1: {
    id: 'serve1', name: 'Serve + 1', short: 'SERVE+1', color: '#ffb02e',
    desc: 'Big first serve to pull you wide, then a forehand into the open court. Short points.',
    pattern: 'serve + first forehand as one combination (wide serve, forehand to the open court)',
    homeBack: -0.4, netRush: 0.08, serveVolley: 0.03, approachShort: 0.18,
    shotMul: { normal: 1.6, topspin: 0.8, slice: 0.5, lob: 0.3, drop: 0.5 },
    aggression: 0.35, crossBias: 0.35, targetBackhand: 0.25, runAround: 0.6, depth: 0.25,
    serveMul: { flat: 2.2, kick: 0.6, slice: 1.3 }, serveAim: [-1, -1, 1, 1, 0],
  },
  fhDom: {
    id: 'fhDom', name: 'Forehand Dominance', short: 'FOREHAND', color: '#ff6a5a',
    desc: 'Runs around the backhand to rip inside-out forehands at your weaker wing.',
    pattern: 'run around the backhand, inside-out forehand to the opponent\'s backhand',
    homeBack: 0.0, netRush: 0.1, serveVolley: 0, approachShort: 0.2,
    shotMul: { normal: 1.3, topspin: 1.4, slice: 0.4, lob: 0.3, drop: 0.6 },
    aggression: 0.15, crossBias: 0.3, targetBackhand: 0.75, runAround: 1.0, depth: 0.35,
    serveMul: { flat: 1.2, kick: 1, slice: 1 }, serveAim: [-1, 1, 0],
  },
  grind: {
    id: 'grind', name: 'Baseline Grind', short: 'GRIND', color: '#5fc8e8',
    desc: 'Deep, heavy crosscourt topspin with big margins. Waits for you to miss.',
    pattern: 'high-margin crosscourt rallies, deep heavy balls, patience',
    homeBack: 0.7, netRush: 0.02, serveVolley: 0, approachShort: 0.08,
    shotMul: { normal: 0.9, topspin: 2.0, slice: 0.8, lob: 0.8, drop: 0.3 },
    aggression: -0.15, crossBias: 0.85, targetBackhand: 0.35, runAround: 0.3, depth: 0.55,
    serveMul: { flat: 0.6, kick: 2.0, slice: 1 }, serveAim: [0, -1, 1, 0],
  },
  net: {
    id: 'net', name: 'Net Attack', short: 'NET', color: '#9ef07a',
    desc: 'Serve-and-volley and chip-and-charge: low slices, rushes the net, finishes with volleys.',
    pattern: 'serve-and-volley; chip-and-charge approach on short balls; low slice approaches',
    homeBack: 0.0, netRush: 0.75, serveVolley: 0.7, approachShort: 0.85,
    shotMul: { normal: 1.0, topspin: 0.5, slice: 2.2, lob: 0.2, drop: 1.0 },
    aggression: 0.2, crossBias: 0.45, targetBackhand: 0.5, runAround: 0.2, depth: 0.1,
    serveMul: { flat: 1, kick: 1.6, slice: 1.4 }, serveAim: [1, 0, -1, 1],
  },
  counter: {
    id: 'counter', name: 'Counterpunch & Variety', short: 'COUNTER', color: '#c08aff',
    desc: 'Defends from deep, changes pace with slices, drops and lobs, passes you down the line.',
    pattern: 'retrieve and redirect: lobs over net-rushers, passing shots, drop shots off deep balls',
    homeBack: 2.3, netRush: 0.05, serveVolley: 0, approachShort: 0.1,
    shotMul: { normal: 1.0, topspin: 1.0, slice: 1.6, lob: 2.2, drop: 1.5 },
    aggression: -0.3, crossBias: 0.5, targetBackhand: 0.3, runAround: 0.2, depth: 0.2,
    serveMul: { flat: 0.8, kick: 1.4, slice: 1.2 }, serveAim: [0, -1, 1],
  },
};

export type TacticBlend = Record<TacticId, number>;

export const ARCHETYPE_BLEND: Record<ArchetypeId, TacticBlend> = {
  bigServer: { serve1: 0.55, fhDom: 0.25, grind: 0.05, net: 0.15, counter: 0 },
  grinder: { serve1: 0.05, fhDom: 0.1, grind: 0.6, net: 0, counter: 0.25 },
  aggressive: { serve1: 0.25, fhDom: 0.5, grind: 0.15, net: 0.1, counter: 0 },
  serveVolley: { serve1: 0.25, fhDom: 0.05, grind: 0, net: 0.6, counter: 0.1 },
  counterpuncher: { serve1: 0, fhDom: 0.1, grind: 0.3, net: 0.05, counter: 0.55 },
  allCourt: { serve1: 0.2, fhDom: 0.2, grind: 0.2, net: 0.2, counter: 0.2 },
  claySpec: { serve1: 0.05, fhDom: 0.3, grind: 0.45, net: 0, counter: 0.2 },
};

export function normalize(b: TacticBlend): TacticBlend {
  const t = TACTIC_IDS.reduce((a, k) => a + Math.max(0, b[k]), 0) || 1;
  const o = {} as TacticBlend;
  for (const k of TACTIC_IDS) o[k] = Math.max(0, b[k]) / t;
  return o;
}

/** A pro's personal blend: archetype default with a deterministic per-player twist. */
export function personalBlend(arch: ArchetypeId, seed: number): TacticBlend {
  const r = new Rng(seed * 7919 + 17);
  const base = ARCHETYPE_BLEND[arch];
  const o = {} as TacticBlend;
  for (const k of TACTIC_IDS) o[k] = (base[k] + 0.04) * (0.55 + 0.9 * r.next());
  return normalize(o);
}

/** Force a single tactic (100%). */
export function pureBlend(id: TacticId): TacticBlend {
  const o = {} as TacticBlend;
  for (const k of TACTIC_IDS) o[k] = k === id ? 1 : 0;
  return o;
}

/** Top tactics of a blend, e.g. "Grind 60% · Counter 30%". */
/** Pregame scouting: the main styles by name only (the exact mix stays hidden). */
export function blendLabel(b: TacticBlend, n = 2): string {
  const top = TACTIC_IDS.slice()
    .sort((a, c) => b[c] - b[a])
    .slice(0, n)
    .filter((k) => b[k] > 0.1)
    .map((k) => TACTICS[k].name);
  if (!top.length) return 'All-round';
  return top.length === 1 ? `Mostly ${top[0]}` : `Mostly ${top[0]}, also ${top.slice(1).join(', ')}`;
}

export function dominant(b: TacticBlend): TacticId {
  return TACTIC_IDS.reduce((a, k) => (b[k] > b[a] ? k : a), TACTIC_IDS[0]);
}
