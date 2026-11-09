import { describe, it, expect } from 'vitest';
import { makeServe, serveInChance, serveTopKmh } from '../src/match/shots';
import { predictFirstBounce, BallState } from '../src/match/ball';
import { SURFACES } from '../src/data/surfaces';
import { flatStats } from '../src/data/types';
import { Rng } from '../src/core/rng';
import { HALF_W, SERVICE_Y } from '../src/data/court';
import type { ServeForce } from '../src/match/strike';

const FROM: BallState = { x: 1.0, y: -11.8, z: 2.9, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };

function rate(force: ServeForce, stat: number, second: boolean, n = 800) {
  let inBox = 0, kmh = 0;
  for (let i = 0; i < n; i++) {
    const r = makeServe({ from: FROM, dir: 1, serverX: 0.9, aimX: 0.3, type: 'flat', force, prep: 0.6, stats: flatStats(stat), stamina: 100, badges: [], second, rng: new Rng(i * 13 + 5) }, SURFACES.hard);
    const f = predictFirstBounce(r.ball, SURFACES.hard);
    // deuce-court serve lands in the box on the receiver's left (x < 0)
    if (!f.hitNet && f.by > 0 && f.by <= SERVICE_Y + 0.034 && f.bx <= 0.034 && f.bx >= -HALF_W - 0.034) inBox++;
    kmh += r.speed;
  }
  return { in: inBox / n, kmh: kmh / n };
}

describe('serve (Elbow rules)', () => {
  it('first-serve success ≈ Strong 70%, Normal 85%, Safe 100% for an average server', () => {
    const s = rate('strong', 71, false), nm = rate('normal', 71, false), sf = rate('safe', 71, false);
    console.log({ strong: s, normal: nm, safe: sf });
    expect(s.in).toBeGreaterThan(0.64);
    expect(s.in).toBeLessThan(0.76);
    expect(nm.in).toBeGreaterThan(0.8);
    expect(nm.in).toBeLessThan(0.9);
    expect(sf.in).toBeGreaterThan(0.97);
    expect(s.kmh).toBeGreaterThan(nm.kmh);
    expect(nm.kmh).toBeGreaterThan(sf.kmh);
  });
  it('second-serve stress lowers the Strong and Normal success rates', () => {
    expect(serveInChance('strong', 71, true)).toBeCloseTo(serveInChance('strong', 71, false) - 0.1, 5);
    expect(serveInChance('normal', 71, true)).toBeCloseTo(serveInChance('normal', 71, false) - 0.04, 5);
    expect(rate('strong', 71, true).in).toBeLessThan(rate('strong', 71, false).in);
  });
  it('serve speed comes from the serve skill (≈102 km/h at 0 up to ≈204 at 100)', () => {
    expect(serveTopKmh(0)).toBe(102);
    expect(serveTopKmh(100)).toBe(204);
    const top = rate('strong', 99, false, 60).kmh, low = rate('strong', 20, false, 60).kmh;
    expect(top).toBeGreaterThan(180);
    expect(low).toBeLessThan(135);
  });
});
