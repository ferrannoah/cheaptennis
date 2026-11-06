import { describe, it, expect } from 'vitest';
import { Match } from '../src/match/match';
import { PlayerSetup, flatStats, DEFAULT_KIT, ArchetypeId } from '../src/data/types';
import { normalize, ARCHETYPE_BLEND } from '../src/data/tactics';
import { T } from '../src/data/tuning';

function setup(name: string, arch: ArchetypeId): PlayerSetup {
  return { name, short: name, stats: flatStats(72), archetype: arch, kit: DEFAULT_KIT, hand: 'R', twoHanded: true, badges: [], startStamina: 100, tactics: normalize(ARCHETYPE_BLEND[arch]) };
}

describe('stroke commitment (M20)', () => {
  it('no steering or speeding up while a swing animates; planted strokes stop, running strokes slide', () => {
    let lockedFrames = 0, accelWhileLocked = 0, turnWhileLocked = 0, plants = 0, slides = 0, plantStopped = 0;
    for (const surface of ['hard', 'clay', 'grass'] as const) {
      const m = new Match({ surface, format: { kind: 'games', target: 3 }, players: [setup('A', 'grinder'), setup('B', 'allCourt')], controllers: [null, null], difficulty: 'normal', seed: 4242 });
      const prev = m.players.map((p) => ({ vx: 0, vy: 0, lock: 'none' as string, since: 0 }));
      for (let f = 0; f < 60000 && m.phase !== 'over'; f++) {
        m.update();
        m.events.length = 0;
        m.players.forEach((p, k) => {
          const q = prev[k];
          if (m.phase === 'rally' && p.lock !== 'none' && q.lock === p.lock) {
            lockedFrames++;
            const s0 = Math.hypot(q.vx, q.vy), s1 = Math.hypot(p.vx, p.vy);
            if (s1 > s0 + 1e-6) accelWhileLocked++;
            // velocity direction never changes while locked (only shrinks)
            if (s0 > 0.2 && s1 > 0.2 && (q.vx * p.vx + q.vy * p.vy) / (s0 * s1) < 0.999) turnWhileLocked++;
            q.since++;
            if (p.lock === 'plant' && q.since === 10 && s1 < 0.3) plantStopped++;
          } else if (m.phase === 'rally' && p.lock !== 'none') {
            if (p.lock === 'plant') plants++;
            else slides++;
            q.since = 0;
          }
          q.vx = p.vx; q.vy = p.vy; q.lock = p.lock;
        });
      }
    }
    console.log({ lockedFrames, plants, slides, plantStopped, accelWhileLocked, turnWhileLocked });
    expect(lockedFrames).toBeGreaterThan(1000);
    expect(accelWhileLocked).toBe(0);
    expect(turnWhileLocked).toBe(0);
    expect(slides).toBeGreaterThan(5);
    expect(plants).toBeGreaterThan(slides);
    expect(plantStopped / plants).toBeGreaterThan(0.8);
  }, 120_000);

  it('the lock lasts from the swing animation to the end of the follow-through', () => {
    const m = new Match({ surface: 'hard', format: { kind: 'games', target: 1 }, players: [setup('A', 'aggressive'), setup('B', 'grinder')], controllers: [null, null], difficulty: 'normal', seed: 7 });
    let checked = 0;
    for (let f = 0; f < 20000 && checked < 20; f++) {
      m.update();
      m.events.length = 0;
      for (const p of m.players) {
        const sw = p.swing;
        if (!sw || m.phase !== 'rally') continue;
        const d = m.frame - sw.start;
        if (d >= 0 && m.frame <= sw.contactAt + T.followLock) { expect(m.strokeLocked(p)).toBe(true); checked++; }
        if (m.frame > sw.contactAt + T.followLock && !(p.serve.phase === 'hit' && p.serve.t < T.serveLock)) expect(m.strokeLocked(p)).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
