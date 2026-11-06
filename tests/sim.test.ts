import { describe, it, expect } from 'vitest';
import { simMatch, quickWinProb } from '../src/sim/match-sim';
import { flatStats } from '../src/data/types';
import { Rng } from '../src/core/rng';

describe('stat-based match sim', () => {
  it('stronger player wins most matches, and results are valid', () => {
    const r = new Rng(9);
    const strong = { stats: flatStats(80), archetype: 'allCourt' as const };
    const weak = { stats: flatStats(65), archetype: 'allCourt' as const };
    let w = 0;
    for (let i = 0; i < 400; i++) {
      const res = simMatch(strong, weak, 'hard', { kind: 'sets', bestOf: 3 }, r);
      if (res.winner === 0) w++;
      expect(Math.max(...res.sets)).toBe(2);
    }
    expect(w / 400).toBeGreaterThan(0.8);
    expect(w / 400).toBeLessThan(0.995);
  });
  it('equal players are ~50/50', () => {
    const r = new Rng(4);
    const p = { stats: flatStats(70), archetype: 'allCourt' as const };
    let w = 0;
    for (let i = 0; i < 1000; i++) if (simMatch(p, p, 'clay', { kind: 'sets', bestOf: 3 }, r).winner === 0) w++;
    expect(Math.abs(w / 1000 - 0.5)).toBeLessThan(0.06);
  });
  it('quick win prob agrees in direction', () => {
    const a = { stats: flatStats(75), archetype: 'grinder' as const };
    const b = { stats: flatStats(60), archetype: 'grinder' as const };
    expect(quickWinProb(a, b, 'hard', 3)).toBeGreaterThan(0.75);
    expect(quickWinProb(b, a, 'hard', 3)).toBeLessThan(0.25);
  });
});
