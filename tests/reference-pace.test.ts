import { it, expect } from 'vitest';
import { Match } from '../src/match/match';
import { PlayerSetup, flatStats, DEFAULT_KIT, ArchetypeId } from '../src/data/types';
import { ARCHETYPE_IDS } from '../src/data/archetypes';
import { normalize, ARCHETYPE_BLEND } from '../src/data/tactics';
import { matchCam } from '../src/gfx/camera';
import { Rng } from '../src/core/rng';

/**
 * M20 reference pace: AI-vs-AI rallies measured the same way as the Free Tennis footage the
 * user supplied (tracked at 20 Hz, in court metres). Footage numbers:
 *   player speed when moving   p90 5.9-6.3 m/s
 *   ball ground speed          p50 17.6, p90 28.9 m/s
 *   hit-to-hit                 p25 0.90, p50 1.00, p75 1.25 s
 *   hitter depth at contact    p50 11.0 m from the net (on/inside the baseline)
 *   net-crossing height        p50 2.0 m
 *   standing still spans       p50 0.35 s
 */
function setup(name: string, arch: ArchetypeId): PlayerSetup {
  return { name, short: name, stats: flatStats(72), archetype: arch, kit: DEFAULT_KIT, hand: 'R', twoHanded: true, badges: [], startStamina: 100, tactics: normalize(ARCHETYPE_BLEND[arch]) };
}
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const line = (n: string, a: number[]) => `${n.padEnd(24)} n ${String(a.length).padStart(5)} p50 ${pct(a, 0.5).toFixed(2)} p75 ${pct(a, 0.75).toFixed(2)} p90 ${pct(a, 0.9).toFixed(2)} p95 ${pct(a, 0.95).toFixed(2)}`;

it('rally pace matches the Free Tennis reference footage', () => {
  const r = new Rng(77);
  const pSp: number[] = [], bSp: number[] = [], cross: number[] = [], still: number[] = [], hitIv: number[] = [], depth: number[] = [], cz: number[] = [], netZ: number[] = [];
  const near = matchCam.project(0, -11.885, 0).y, far = matchCam.project(0, 11.885, 0).y;
  const zN = near - 0.266 * (near - far), zF = near - 0.843 * (near - far);
  let rally = 0, points = 0;
  for (let i = 0; i < 8; i++) {
    const m = new Match({ surface: 'grass', format: { kind: 'games', target: 4 }, players: [setup('A', r.pick(ARCHETYPE_IDS)), setup('B', r.pick(ARCHETYPE_IDS))], controllers: [null, null], difficulty: 'normal', seed: 500 + i * 13 });
    const hist: { x: number; y: number }[][] = [[], []];
    const ballH: ({ x: number; y: number } | null)[] = [];
    let last: { zone: string; f: number } | null = null;
    const stillStart = [-1, -1];
    let lastHit: { p: number; f: number } | null = null;
    for (let f = 0; f < 200000 && m.phase !== 'over'; f++) {
      const by0 = m.ball.y;
      m.update();
      if (m.phase === 'rally' && m.ballLive && !m.rally.dead && !m.rally.isServe && Math.sign(by0) !== Math.sign(m.ball.y)) netZ.push(m.ball.z);
      for (const e of m.events) {
        if (e.t === 'point') { points++; rally += e.rally; lastHit = null; }
        if (e.t === 'hit') { depth.push(Math.abs(m.players[e.p].y)); cz.push(m.ball.z); if (lastHit && lastHit.p !== e.p) hitIv.push((f - lastHit.f) / 60); lastHit = { p: e.p, f }; }
      }
      m.events.length = 0;
      if (f % 3 !== 0) continue; // 20 Hz like the footage
      const live = m.phase === 'rally' && m.ballLive && !m.rally.dead;
      m.players.forEach((p, k) => {
        hist[k].push(live ? { x: p.x, y: p.y } : { x: NaN, y: NaN });
        const h = hist[k];
        if (h.length > 6) {
          const a = h[h.length - 7], b = h[h.length - 1];
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d / 0.3 > 0.8) pSp.push(d / 0.3);
        }
        if (h.length > 1 && live) {
          const a = h[h.length - 2], b = h[h.length - 1];
          const st = Math.hypot(b.x - a.x, b.y - a.y) < 0.06;
          if (st && stillStart[k] < 0) stillStart[k] = f;
          if (!st && stillStart[k] >= 0) { const s = (f - 3 - stillStart[k]) / 60; if (s >= 0.15 && s < 2) still.push(s); stillStart[k] = -1; }
        } else stillStart[k] = -1;
      });
      ballH.push(live ? { x: m.ball.x, y: m.ball.y } : null);
      if (ballH.length > 3) {
        const a = ballH[ballH.length - 4], b = ballH[ballH.length - 1];
        if (a && b) { const v = Math.hypot(b.x - a.x, b.y - a.y) / 0.15; if (v > 3 && v < 60) bSp.push(v); }
      }
      if (live) {
        const sy = matchCam.project(m.ball.x, m.ball.y, m.ball.z).y;
        const zone = sy > zN ? 'N' : sy < zF ? 'F' : null;
        if (zone) {
          if (last && last.zone !== zone && f - last.f < 180) cross.push((f - last.f) / 60);
          last = { zone, f };
        }
      } else last = null;
    }
  }
  console.log(line('player moving m/s', pSp));
  console.log(line('ball ground m/s', bSp));
  console.log(line('ball N<->F secs', cross));
  console.log(line('still spans s', still));
  console.log(line('hit-to-hit s', hitIv));
  console.log(line('hitter |y| at hit', depth));
  console.log(line('contact z', cz));
  console.log(line('net-crossing z', netZ));
  console.log('rally', (rally / points).toFixed(2), 'points', points);
  expect(pct(pSp, 0.9)).toBeGreaterThan(5.4);
  expect(pct(pSp, 0.9)).toBeLessThan(6.8);
  expect(pct(bSp, 0.5)).toBeGreaterThan(15.5);
  expect(pct(bSp, 0.5)).toBeLessThan(21);
  expect(pct(hitIv, 0.5)).toBeGreaterThan(0.9);
  expect(pct(hitIv, 0.5)).toBeLessThan(1.15);
  expect(pct(depth, 0.5)).toBeLessThan(12.3);
  expect(pct(netZ, 0.5)).toBeGreaterThan(1.2);
  expect(pct(netZ, 0.5)).toBeLessThan(2.6);
}, 600_000);
