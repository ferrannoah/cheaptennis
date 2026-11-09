/**
 * M21 "Elbow" strike rules (modelled on Tennis Elbow 4's manual, Arcade controls):
 * hold a strike button through contact; what you hold at contact picks the strike, how long you
 * held it decides the accuracy. Pure functions: the match, the COM and the HUD preview share them.
 */
import { ShotType, ArchetypeId } from '../data/types';
import { T } from '../data/tuning';

export type ControlMode = 'arcade' | 'sim';

export type StrikeId = 'normal' | 'short' | 'topspin' | 'slice' | 'drop' | 'lob' | 'accel' | 'shortAccel' | 'attackLob' | 'safe';

export interface StrikeDef {
  id: StrikeId;
  /** the base flight family (poses, physics tables, COM weights) */
  shot: ShotType;
  accel: boolean;
  short: boolean;
  label: string;
}

export const STRIKES: Record<StrikeId, StrikeDef> = {
  normal: { id: 'normal', shot: 'normal', accel: false, short: false, label: 'Normal' },
  short: { id: 'short', shot: 'normal', accel: false, short: true, label: 'Short strike' },
  topspin: { id: 'topspin', shot: 'topspin', accel: false, short: false, label: 'Topspin' },
  slice: { id: 'slice', shot: 'slice', accel: false, short: false, label: 'Slice' },
  drop: { id: 'drop', shot: 'drop', accel: false, short: true, label: 'Drop shot' },
  lob: { id: 'lob', shot: 'lob', accel: false, short: false, label: 'Defensive lob' },
  accel: { id: 'accel', shot: 'normal', accel: true, short: false, label: 'Acceleration' },
  shortAccel: { id: 'shortAccel', shot: 'normal', accel: true, short: true, label: 'Short acceleration' },
  attackLob: { id: 'attackLob', shot: 'lob', accel: true, short: false, label: 'Attack lob' },
  safe: { id: 'safe', shot: 'normal', accel: false, short: false, label: 'Safe strike' },
};
export const STRIKE_IDS = Object.keys(STRIKES) as StrikeId[];

/**
 * The strike menu. fwd: +1 = pushing toward the net, -1 = away from it, 0 = neither.
 *   B1:      Normal   / ↑ Short strike       / ↓ Topspin
 *   B2:      Slice    / ↑ Drop shot          / ↓ Defensive lob
 *   B1 + B2: Acceleration / ↑ Short acceleration / ↓ Attack lob
 */
export function strikeFrom(b1: boolean, b2: boolean, fwd: number): StrikeId {
  if (!b1 && !b2) return 'safe';
  const up = fwd > 0, down = fwd < 0;
  if (b1 && b2) return up ? 'shortAccel' : down ? 'attackLob' : 'accel';
  if (b1) return up ? 'short' : down ? 'topspin' : 'normal';
  return up ? 'drop' : down ? 'lob' : 'slice';
}

/** the buttons that select a strike (inverse of strikeFrom; the COM and the autopilot use it) */
export function strikeButtons(id: StrikeId): { b1: boolean; b2: boolean; fwd: -1 | 0 | 1 } {
  switch (id) {
    case 'normal': return { b1: true, b2: false, fwd: 0 };
    case 'short': return { b1: true, b2: false, fwd: 1 };
    case 'topspin': return { b1: true, b2: false, fwd: -1 };
    case 'slice': return { b1: false, b2: true, fwd: 0 };
    case 'drop': return { b1: false, b2: true, fwd: 1 };
    case 'lob': return { b1: false, b2: true, fwd: -1 };
    case 'accel': return { b1: true, b2: true, fwd: 0 };
    case 'shortAccel': return { b1: true, b2: true, fwd: 1 };
    case 'attackLob': return { b1: true, b2: true, fwd: -1 };
    case 'safe': return { b1: false, b2: false, fwd: 0 };
  }
}

/** serve menu: B1 Normal, B2 Safe, both Strong; ↑ slice, ↓ kick (topspin) */
export type ServeForce = 'strong' | 'normal' | 'safe';
export function serveFrom(b1: boolean, b2: boolean, fwd: number): { force: ServeForce; spin: 'flat' | 'kick' | 'slice' } {
  const force: ServeForce = b1 && b2 ? 'strong' : b1 ? 'normal' : 'safe';
  return { force, spin: fwd > 0 ? 'slice' : fwd < 0 ? 'kick' : 'flat' };
}

/** 0..1: how "prepared" a strike is after holding for `prepS` seconds (focus scales the speed) */
export function prepQ(prepS: number, mode: ControlMode, focus = 1): number {
  const tau = (mode === 'arcade' ? T.prepTauArcade : T.prepTauSim) / Math.max(0.3, focus);
  return 1 - Math.exp(-Math.max(0, prepS) / tau);
}

/** radius (m) of the aiming zone that holds ~60% of landings, before situation penalties */
export function zoneRadius(prepS: number, mode: ControlMode, statF: number, focus = 1): number {
  const rmin = T.zoneRminBase + T.zoneRminSkill * (1 - statF);
  return rmin + (T.zoneR0 - rmin) * (1 - prepQ(prepS, mode, focus));
}

/** aim sweep speed in aim units per second: fast at the net, 2-3x slower behind the baseline */
export function aimRate(distFromNet: number): number {
  return 1 / (T.aimSweepBase + T.aimSweepPerM * Math.max(0, distFromNet));
}

/** move the aim one frame toward `target` (the held direction's limit, or 0 when released) */
export function stepAim(aim: number, target: number, ratePerS: number): number {
  const r = ratePerS / 60;
  return aim + Math.max(-r, Math.min(r, target - aim));
}

/**
 * Good accelerations per point: 1-5 from endurance (0-24: 1 ... 100: 5), plus the style
 * bonus (Power Baseliner +3, Puncher / Counter Puncher +2, All-court / Bulldog +1, Defender -1).
 */
const ACCEL_STYLE: Record<ArchetypeId, number> = { aggressive: 3, bigServer: 2, counterpuncher: 2, allCourt: 1, claySpec: 1, serveVolley: 0, grinder: -1 };
export function accelQuota(endurance: number, arch: ArchetypeId): number {
  const base = Math.min(5, Math.floor(Math.max(0, endurance) / 25) + 1);
  return Math.max(1, base + ACCEL_STYLE[arch]);
}

/** shoulder-height acceleration bonus by style: 1 big, 0.6 average, 0.3 low */
export const SHOULDER_STYLE: Record<ArchetypeId, number> = { aggressive: 1, bigServer: 1, allCourt: 1, serveVolley: 0.6, grinder: 0.3, counterpuncher: 0.3, claySpec: 0.3 };
/** volley jump reach by style (Volleyer "really bigger", All-court/Counter bigger, Puncher slightly) */
export const JUMP_STYLE: Record<ArchetypeId, number> = { serveVolley: 1.12, allCourt: 1.07, counterpuncher: 1.07, bigServer: 1.04, aggressive: 1, grinder: 1, claySpec: 1 };

/**
 * Danger zone: 0..1 for a ball still rising after its bounce. vz0 = vertical speed just after the
 * bounce; the faster the incoming ball, the more a rising contact costs.
 */
export function dangerOf(vz: number, vz0: number, hSpeed: number): number {
  if (vz <= 0 || vz0 <= 0.2) return 0;
  const rr = Math.min(1, vz / vz0);
  // "harder to hit, especially if the shot is fast": a rally ball (~20 m/s after the bounce) only
  // makes an orange zone; accelerations (25+ m/s) make a long red one
  const w = Math.max(0.15, Math.min(1, (hSpeed - 10) / 16));
  return rr * w;
}

export type Zone = 'green' | 'orange' | 'red';
export function dangerClass(d: number): Zone {
  return d > T.dangerRed ? 'red' : d > T.dangerOrange ? 'orange' : 'green';
}

/** centring: 0 = sweet spot; 1 = into the body (`body`) or at full stretch */
export function centreOf(lat: number, ideal: number, maxReach: number): { c: number; body: boolean } {
  if (lat < ideal) return { c: Math.min(1.2, (ideal - lat) / Math.max(0.1, ideal - 0.15)), body: true };
  return { c: Math.min(1.2, (lat - ideal) / Math.max(0.2, maxReach - ideal)), body: false };
}
export function centreClass(c: number): Zone {
  return c >= T.centreRed ? 'red' : c >= T.centreOrange ? 'orange' : 'green';
}
