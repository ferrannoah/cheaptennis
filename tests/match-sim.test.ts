import { describe, it, expect } from 'vitest';
import { Match } from '../src/match/match';
import { PlayerSetup, flatStats, DEFAULT_KIT } from '../src/data/types';
import { SurfaceId } from '../src/data/surfaces';

function setup(name: string, v: number, arch: PlayerSetup['archetype'] = 'allCourt'): PlayerSetup {
  return { name, short: name, stats: flatStats(v), archetype: arch, kit: DEFAULT_KIT, hand: 'R', twoHanded: true, badges: [], startStamina: 100 };
}

export function runAiMatch(seed: number, surface: SurfaceId, a = 70, b = 70) {
  const m = new Match({
    surface, format: { kind: 'games', target: 3 }, players: [setup('A', a), setup('B', b, 'grinder')],
    controllers: [null, null], difficulty: 'normal', seed,
  });
  const stats = { points: 0, rally: 0, faults: 0, df: 0, aces: 0, out: 0, net: 0, winners: 0, hits: 0, grades: {} as Record<string, number>, whiffs: 0 };
  let f = 0;
  for (; f < 120000 && m.phase !== 'over'; f++) {
    m.update();
    for (const e of m.events) {
      if (e.t === 'point') {
        stats.points++;
        stats.rally += e.rally;
        if (e.how === 'ace') stats.aces++;
        if (e.how === 'out') stats.out++;
        if (e.how === 'net') stats.net++;
        if (e.how === 'winner') stats.winners++;
        if (e.how === 'df') stats.df++;
      }
      if (e.t === 'call' && e.kind === 'fault') stats.faults++;
      if (e.t === 'hit') {
        stats.hits++;
        stats.grades[e.grade] = (stats.grades[e.grade] ?? 0) + 1;
      }
      if (e.t === 'whiff') stats.whiffs++;
    }
    m.events.length = 0;
  }
  return { m, stats, frames: f };
}

describe('AI vs AI match', () => {
  for (const sf of ['grass', 'clay', 'hard'] as SurfaceId[]) {
    it(`completes a first-to-3 match on ${sf}`, () => {
      const { m, stats, frames } = runAiMatch(7, sf);
      console.log(sf, frames, JSON.stringify(stats), m.score.games);
      expect(m.phase).toBe('over');
      expect(stats.points).toBeGreaterThan(11);
      expect(stats.rally / stats.points).toBeGreaterThan(1.5);
    });
  }
  it('stronger player usually wins', () => {
    let wins = 0;
    for (let s = 1; s <= 6; s++) {
      const { m } = runAiMatch(s * 31, 'hard', 85, 45);
      if (m.score.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});
