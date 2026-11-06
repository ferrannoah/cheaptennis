/**
 * How tiredness changes a player. These functions ARE the game rules: the physics, shot model and
 * serve model call them, and the in-match fatigue panel (H) shows the same numbers.
 * `f` is stamina as a fraction 0..1.
 */
import { T } from '../data/tuning';

const low = () => T.lowStamina / 100;

/** multiplier on top speed and acceleration */
export function moveFatigue(f: number): number {
  return f < low() ? 0.8 + 0.5 * f : 1;
}

/** multiplier on the timing windows (PERFECT / GOOD), relative to fresh */
export function timingFatigue(f: number): number {
  return f < low() ? 0.55 + f * 1.1 : 1;
}

/** multiplier on shot error (1 = fresh, higher = less accurate) */
export function errorFatigue(f: number): number {
  return f < low() ? 1 + (low() - f) * 2.2 : 1;
}

/** multiplier on groundstroke pace relative to fresh */
export function paceFatigue(f: number): number {
  return 0.86 + 0.14 * Math.min(1, f * 1.6);
}

/** multiplier on serve speed relative to fresh */
export function serveFatigue(f: number): number {
  return 0.84 + 0.16 * Math.min(1, f * 1.8);
}

/** multiplier on serve error */
export function serveErrorFatigue(f: number): number {
  return f < 0.4 ? 1 + (0.4 - f) * 1.8 : 1;
}

export interface FatigueEffect {
  label: string;
  /** change versus fresh, e.g. -0.12 = 12% worse */
  delta: number;
}

/** What tiredness is costing right now (for the HUD). Accuracy is shown as 1/error. */
export function fatigueEffects(f: number): FatigueEffect[] {
  const pace = paceFatigue(f) / paceFatigue(1);
  const serve = serveFatigue(f) / serveFatigue(1);
  return [
    { label: 'Top speed', delta: moveFatigue(f) - 1 },
    { label: 'Acceleration', delta: moveFatigue(f) - 1 },
    { label: 'Timing window', delta: timingFatigue(f) - 1 },
    { label: 'Shot accuracy', delta: 1 / errorFatigue(f) - 1 },
    { label: 'Shot power', delta: pace - 1 },
    { label: 'Serve speed', delta: serve - 1 },
    { label: 'Serve accuracy', delta: 1 / serveErrorFatigue(f) - 1 },
  ];
}
