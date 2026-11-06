import { describe, it, expect } from 'vitest';
import { solveShot, makeShot, ShotInput } from '../src/match/shots';
import { predictFirstBounce, stepBall, cloneBall, BallState } from '../src/match/ball';
import { SURFACES } from '../src/data/surfaces';
import { flatStats } from '../src/data/types';
import { Rng } from '../src/core/rng';

const from: BallState = { x: 0.5, y: -11.5, z: 0.9, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };

function afterBounce(b0: BallState, sf = SURFACES.hard) {
  const b = cloneBall(b0);
  let bounced = 0;
  let apex = 0;
  let speedAfter = 0;
  for (let i = 0; i < 400; i++) {
    const ev = stepBall(b, sf);
    if (ev === 'bounce') {
      bounced++;
      if (bounced === 1) speedAfter = Math.hypot(b.vx, b.vy);
      if (bounced === 2) break;
    }
    if (bounced === 1) apex = Math.max(apex, b.z);
  }
  return { apex, speedAfter };
}

describe('trajectory solver', () => {
  for (const sf of Object.values(SURFACES)) {
    it(`lands near target on ${sf.id}`, () => {
      for (const [tx, ty, T, spin] of [[2, 9, 1.0, 0.3], [-3, 10, 1.1, 1.2], [0, 7, 1.3, -0.8], [1, 10, 2.2, 0.4]] as const) {
        const b = solveShot(from, tx, ty, T, spin, 0, sf, 0.3);
        const f = predictFirstBounce(b, sf, 600, false);
        expect(Math.hypot(f.bx - tx, f.by - ty)).toBeLessThan(0.35);
      }
    });
  }
  it('clears the net with the requested margin', () => {
    const b = solveShot(from, 0, 3, 0.6, 0, 0, SURFACES.hard, 0.3);
    const f = predictFirstBounce(b, SURFACES.hard);
    expect(f.hitNet).toBe(false);
  });
});

describe('surfaces and spin', () => {
  it('clay bounces higher and slower than grass', () => {
    const b = solveShot(from, 0, 9, 1.0, 0.3, 0, SURFACES.grass, 0.3);
    const g = afterBounce(b, SURFACES.grass);
    const c = afterBounce(b, SURFACES.clay);
    expect(c.apex).toBeGreaterThan(g.apex * 1.15);
    expect(c.speedAfter).toBeLessThan(g.speedAfter);
  });
  it('topspin bounces higher than slice; drop shot dies', () => {
    const top = afterBounce(solveShot(from, 0, 9, 1.1, 1.3, 0, SURFACES.hard, 0.3));
    const sl = afterBounce(solveShot(from, 0, 9, 1.1, -0.85, 0, SURFACES.hard, 0.3));
    const dr = afterBounce(solveShot(from, 0, 2.5, 1.0, -1.9, 0, SURFACES.hard, 0.1));
    expect(top.apex).toBeGreaterThan(sl.apex * 1.3);
    expect(dr.speedAfter).toBeLessThan(sl.speedAfter * 0.5);
  });
});

describe('shot model grades', () => {
  const base = (over: Partial<ShotInput>): ShotInput => ({
    type: 'normal', from, dir: 1, aimX: 0, aimDepth: 0, grade: 'GOOD', offset: 0, stats: flatStats(70), stamina: 100,
    speedRatio: 0, stretch: 0, contactZ: 0.9, lateral: 0.8, sideSign: 1, fh: true, volley: false, overhead: false,
    isReturn: false, badges: [], rng: new Rng(3), ...over,
  });
  it('PERFECT is faster than GOOD; EARLY lands deeper; LATE pulls wide', () => {
    const sf = SURFACES.hard;
    const avg = (g: ShotInput['grade'], offset: number) => {
      let sp = 0, by = 0, bx = 0;
      for (let i = 0; i < 40; i++) {
        const o = makeShot(base({ grade: g, offset, rng: new Rng(i + 1), aimX: 0.0 }), sf);
        sp += Math.hypot(o.ball.vx, o.ball.vy);
        const f = predictFirstBounce(o.ball, sf, 600, false);
        by += f.by;
        bx += f.bx;
      }
      return { sp: sp / 40, by: by / 40, bx: bx / 40 };
    };
    const p = avg('PERFECT', 0), g = avg('GOOD', 0), e = avg('EARLY', 10), l = avg('LATE', -9);
    expect(p.sp).toBeGreaterThan(g.sp * 1.08);
    expect(e.by).toBeGreaterThan(g.by + 1);
    expect(l.bx).toBeGreaterThan(g.bx + 1);
  });
});
