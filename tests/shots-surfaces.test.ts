import { describe, it, expect } from 'vitest';
import { makeShot, makeServe, ShotInput } from '../src/match/shots';
import { stepBall, cloneBall, BallState } from '../src/match/ball';
import { SURFACES, SurfaceId } from '../src/data/surfaces';
import { flatStats, ShotType, ServeType } from '../src/data/types';
import { Rng } from '../src/core/rng';
import { netHeightAt } from '../src/data/court';
import { shotInput } from './shot-input';

interface Flight { maxZ: number; netClear: number; b1: number; apex2: number; speed2: number; gap: number; b1x: number; kmh: number }

function fly(b0: BallState, sfId: SurfaceId): Flight {
  const sf = SURFACES[sfId];
  const b = cloneBall(b0);
  const kmh = Math.hypot(b.vx, b.vy, b.vz) * 3.6;
  let maxZ = 0, netClear = NaN, b1 = NaN, b1x = NaN, apex2 = 0, speed2 = 0, gap = NaN, bounces = 0;
  for (let i = 0; i < 600; i++) {
    const py = b.y;
    const ev = stepBall(b, sf);
    maxZ = Math.max(maxZ, b.z);
    if ((py > 0) !== (b.y > 0) && isNaN(netClear)) netClear = b.z - netHeightAt(b.x);
    if (ev === 'bounce') {
      bounces++;
      if (bounces === 1) {
        b1 = b.y;
        b1x = b.x;
        speed2 = Math.hypot(b.vx, b.vy);
      } else {
        gap = b.y - b1;
        break;
      }
    }
    if (bounces === 1) apex2 = Math.max(apex2, b.z);
  }
  return { maxZ, netClear, b1, apex2, speed2, gap, b1x, kmh };
}

const from: BallState = { x: 0.3, y: -11.6, z: 0.95, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
function shot(type: ShotType, sf: SurfaceId): Flight {
  // average a few seeds of GOOD shots aimed straight
  const acc: Flight[] = [];
  for (let s = 1; s <= 6; s++) {
    const inp: ShotInput = shotInput({ strike: type, from, aimX: 0.05, rng: new Rng(s) });
    acc.push(fly(makeShot(inp, SURFACES[sf]).ball, sf));
  }
  const avg = {} as Flight;
  for (const k of Object.keys(acc[0]) as (keyof Flight)[]) avg[k] = acc.reduce((a, f) => a + f[k], 0) / acc.length;
  return avg;
}

function serve(type: ServeType, sf: SurfaceId): Flight {
  const b0: BallState = { x: 1.0, y: -11.8, z: 3.0, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
  const r = makeServe({ from: b0, dir: 1, serverX: 0.9, aimX: 0, type, force: 'safe', prep: 0.6, stats: flatStats(75), stamina: 100, badges: [], second: false, rng: new Rng(3) }, SURFACES[sf]);
  return fly(r.ball, sf);
}

const SF: SurfaceId[] = ['grass', 'clay', 'hard'];
const TYPES: ShotType[] = ['normal', 'topspin', 'slice', 'lob', 'drop'];

describe('5 shot types are distinct on every surface', () => {
  for (const sf of SF) {
    it(sf, () => {
      const r = Object.fromEntries(TYPES.map((t) => [t, shot(t, sf)])) as Record<ShotType, Flight>;
      console.log(sf, Object.entries(r).map(([t, f]) => `${t}: net+${f.netClear.toFixed(2)} max${f.maxZ.toFixed(1)} b1 y${f.b1.toFixed(1)} apex2 ${f.apex2.toFixed(2)} v2 ${f.speed2.toFixed(1)} gap ${f.gap.toFixed(1)} ${f.kmh.toFixed(0)}kmh`).join(' | '));
      expect(r.topspin.netClear).toBeGreaterThan(r.normal.netClear);
      expect(r.topspin.apex2).toBeGreaterThan(r.normal.apex2);
      expect(r.slice.apex2).toBeLessThan(r.normal.apex2);
      expect(r.slice.kmh).toBeLessThan(r.normal.kmh);
      expect(r.lob.maxZ).toBeGreaterThan(5);
      expect(r.drop.b1).toBeLessThan(5);
      expect(r.drop.gap).toBeLessThan(r.normal.gap * 0.5);
      expect(r.drop.speed2).toBeLessThan(r.slice.speed2);
    });
  }
  it('surfaces change bounce height and post-bounce speed', () => {
    for (const t of TYPES) {
      const g = shot(t, 'grass'), c = shot(t, 'clay'), h = shot(t, 'hard');
      expect(c.apex2).toBeGreaterThan(g.apex2);
      expect(g.speed2).toBeGreaterThan(c.speed2);
      expect(h.apex2).toBeGreaterThan(g.apex2 * 0.99);
    }
  });
});

describe('3 serve types are distinct on every surface', () => {
  for (const sf of SF) {
    it(sf, () => {
      const flat = serve('flat', sf), kick = serve('kick', sf), sl = serve('slice', sf);
      console.log(sf, 'serves', [['flat', flat], ['kick', kick], ['slice', sl]].map(([n, f]: any) => `${n}: ${f.kmh.toFixed(0)}kmh net+${f.netClear.toFixed(2)} apex2 ${f.apex2.toFixed(2)} b1x ${f.b1x.toFixed(2)}`).join(' | '));
      expect(flat.kmh).toBeGreaterThan(sl.kmh);
      expect(sl.kmh).toBeGreaterThan(kick.kmh);
      expect(kick.netClear).toBeGreaterThan(flat.netClear + 0.3);
      expect(kick.apex2).toBeGreaterThan(flat.apex2);
      expect(sl.apex2).toBeLessThan(kick.apex2);
    });
  }
});
