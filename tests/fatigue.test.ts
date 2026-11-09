import { describe, it, expect } from 'vitest';
import { fatigueEffects, moveFatigue, timingFatigue } from '../src/match/fatigue';
import { Player } from '../src/match/player';
import { flatStats, DEFAULT_KIT } from '../src/data/types';

describe('fatigue panel numbers', () => {
  it('everything is OK (0%) when fresh', () => {
    for (const e of fatigueEffects(1)) expect(Math.round(e.delta * 100)).toBe(0);
  });
  it('a tired player sees what is getting worse, and more so when exhausted', () => {
    const tired = fatigueEffects(0.3);
    const dead = fatigueEffects(0.05);
    for (const e of tired) expect(e.delta).toBeLessThanOrEqual(0);
    expect(tired.find((e) => e.label === 'Top speed')!.delta).toBeLessThan(0);
    expect(tired.find((e) => e.label === 'Aim zone closing')!.delta).toBeLessThan(0);
    expect(tired.find((e) => e.label === 'Shot accuracy')!.delta).toBeLessThan(0);
    for (let i = 0; i < tired.length; i++) expect(dead[i].delta).toBeLessThanOrEqual(tired[i].delta);
  });
  it('the panel uses the same rules as the player physics', () => {
    const p = new Player(0, { name: 'A', short: 'A', stats: flatStats(70), archetype: 'allCourt', kit: DEFAULT_KIT, hand: 'R', twoHanded: true, badges: [], startStamina: 25 }, flatStats(70), null);
    expect(p.speedMul()).toBeCloseTo(moveFatigue(0.25), 6);
    const fresh = (0.82 + 0.36 * (70 / 99));
    expect(p.windowMul() / fresh).toBeCloseTo(timingFatigue(0.25), 6);
  });
});
