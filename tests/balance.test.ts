import { describe, it, expect } from 'vitest';
import { Match } from '../src/match/match';
import { PlayerSetup, flatStats, DEFAULT_KIT, ArchetypeId, ShotType } from '../src/data/types';
import { Grade } from '../src/match/shots';
import { ARCHETYPE_IDS } from '../src/data/archetypes';
import { normalize, ARCHETYPE_BLEND } from '../src/data/tactics';
import { HALF_LEN, HALF_W } from '../src/data/court';
import { Rng } from '../src/core/rng';
import { T } from '../src/data/tuning';

/**
 * Balance harness: AI-vs-AI matches across archetypes, measuring how often well-placed
 * shots win, how strong drop shots and lobs are, and how long rallies last.
 * Numbers are logged; the assertions are the design targets from docs/PLAN.md (M16).
 */

type SurfaceId = 'hard' | 'grass' | 'clay';

function setup(name: string, arch: ArchetypeId): PlayerSetup {
  return {
    name, short: name, stats: flatStats(72), archetype: arch, kit: DEFAULT_KIT, hand: 'R', twoHanded: true, badges: [], startStamina: 100,
    tactics: normalize(ARCHETYPE_BLEND[arch]),
  };
}

interface Shot { hitter: number; shot: ShotType; grade: Grade; oppY: number; landX?: number; landY?: number; inside?: boolean }

export interface Balance {
  points: number; rally: number; aceRate: number;
  cornerN: number; cornerOutright: number; cornerPoint: number;
  midN: number; midOutright: number;
  dropN: number; dropWinClose: number; dropNClose: number; dropWinDeep: number; dropNDeep: number;
  pdropN: number; pdropWinClose: number;
  lobNetN: number; lobNetWin: number;
  unreturned: number;
  df: number;
}

const mkDiag = () => ({ n: 0, inside: 0, returned: 0, returnedWon: 0, noBounce: 0 });
export const diag = { drop: mkDiag(), lob: mkDiag() };
export const lobLog: string[] = [];

export function measureBalance(surface: SurfaceId, matches: number, seed0 = 1): Balance {
  const r = new Rng(seed0 * 7919);
  const acc: Balance = { points: 0, rally: 0, aceRate: 0, cornerN: 0, cornerOutright: 0, cornerPoint: 0, midN: 0, midOutright: 0, dropN: 0, dropWinClose: 0, dropNClose: 0, dropWinDeep: 0, dropNDeep: 0, pdropN: 0, pdropWinClose: 0, lobNetN: 0, lobNetWin: 0, unreturned: 0, df: 0 };
  let aces = 0;
  for (let i = 0; i < matches; i++) {
    const a = r.pick(ARCHETYPE_IDS);
    const b = r.pick(ARCHETYPE_IDS);
    const m = new Match({ surface, format: { kind: 'games', target: 4 }, players: [setup('A', a), setup('B', b)], controllers: [null, null], difficulty: 'normal', seed: seed0 * 1000 + i * 31 });
    let shots: Shot[] = [];
    for (let f = 0; f < 200000 && m.phase !== 'over'; f++) {
      m.update();
      for (const e of m.events) {
        if (e.t === 'hit') {
          const prev = shots[shots.length - 1];
          if (prev && prev.shot === 'lob' && prev.oppY < 7 && lobLog.length < 30) lobLog.push(`${prev.grade} oppY ${prev.oppY.toFixed(1)} land ${prev.landY?.toFixed(1) ?? '-'} hitBackAt y ${Math.abs(e.cy).toFixed(1)} z ${m.ball.z.toFixed(1)} ${e.shot}${e.volley ? ' V' : ''}`);
          shots.push({ hitter: e.p, shot: e.shot, grade: e.grade, oppY: Math.abs(m.players[1 - e.p].y) });
        } else if (e.t === 'bounce') {
          const last = shots[shots.length - 1];
          if (last && last.landX === undefined && m.rally.lastHitter === last.hitter && m.rally.bounces === 1) {
            last.landX = e.x;
            last.landY = e.y;
            last.inside = Math.abs(e.x) <= HALF_W && Math.abs(e.y) <= HALF_LEN && Math.sign(e.y) !== (last.hitter === 0 ? -1 : 1);
          }
        } else if (e.t === 'point') {
          acc.points++;
          acc.rally += e.rally;
          if (e.how === 'ace') aces++;
          if (e.rally === 0 && e.how !== 'df') acc.unreturned++;
          if (e.how === 'df') acc.df++;
          shots.forEach((s, k) => {
            const lastShot = k === shots.length - 1;
            const won = s.hitter === e.winner;
            const outright = lastShot && won;
            if (s.inside && s.shot !== 'drop' && s.shot !== 'lob') {
              const corner = Math.abs(s.landX!) >= HALF_W - 1.2 && Math.abs(s.landY!) >= HALF_LEN - 3.5;
              if (corner) {
                acc.cornerN++;
                if (outright) acc.cornerOutright++;
                if (won) acc.cornerPoint++;
              } else if (Math.abs(s.landX!) < 1.5) {
                acc.midN++;
                if (outright) acc.midOutright++;
              }
            }
            const returned = k < shots.length - 1;
            if ((s.shot === 'drop' && s.oppY <= HALF_LEN + 1.5) || (s.shot === 'lob' && s.oppY < 7)) {
              const d = s.shot === 'drop' ? diag.drop : diag.lob;
              d.n++;
              if (s.inside) d.inside++;
              if (returned) d.returned++;
              if (returned && won) d.returnedWon++;
              if (s.landX === undefined) d.noBounce++;
            }
            if (s.shot === 'drop') {
              acc.dropN++;
              // "close" = the opponent at a normal rally position (up to 1.5 m behind the baseline)
              const close = s.oppY <= HALF_LEN + 1.5;
              if (close) {
                acc.dropNClose++;
                if (won) acc.dropWinClose++;
                if (s.grade === 'PERFECT') {
                  acc.pdropN++;
                  if (won) acc.pdropWinClose++;
                }
              } else {
                acc.dropNDeep++;
                if (won) acc.dropWinDeep++;
              }
            }
            if (s.shot === 'lob' && s.oppY < 7) {
              acc.lobNetN++;
              if (won) acc.lobNetWin++;
            }
          });
          shots = [];
        }
      }
      m.events.length = 0;
    }
  }
  acc.rally /= Math.max(1, acc.points);
  acc.aceRate = aces / Math.max(1, acc.points);
  return acc;
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : '-');
export function fmt(s: string, b: Balance): string {
  return `${s.padEnd(5)} pts ${b.points} rally ${b.rally.toFixed(1)} aces ${(b.aceRate * 100).toFixed(1)}% unreturned ${pct(b.unreturned, b.points)} df ${pct(b.df, b.points)} | corner n${b.cornerN} outright ${pct(b.cornerOutright, b.cornerN)} pointWon ${pct(b.cornerPoint, b.cornerN)} | middle outright ${pct(b.midOutright, b.midN)} | drop n${b.dropN} close ${pct(b.dropWinClose, b.dropNClose)} (n${b.dropNClose}) perfectClose ${pct(b.pdropWinClose, b.pdropN)} (n${b.pdropN}) deep ${pct(b.dropWinDeep, b.dropNDeep)} (n${b.dropNDeep}) | lob vs net ${pct(b.lobNetWin, b.lobNetN)} (n${b.lobNetN})`;
}

/** metres a player with footwork 72 covers from a standing start in `t` seconds */
export function coverage(t: number, footwork = 72): number {
  const v = T.baseSpeed + T.footworkSpeedBonus * (footwork / 99);
  const a = T.accel * (0.85 + 0.3 * (footwork / 99));
  const ta = v / a;
  return t <= ta ? 0.5 * a * t * t : 0.5 * a * ta * ta + v * (t - ta);
}

describe('balance (AI vs AI)', () => {
  const R = {} as Record<SurfaceId, Balance>;
  it('collects numbers', () => {
    for (const sf of ['hard', 'grass', 'clay'] as SurfaceId[]) {
      R[sf] = measureBalance(sf, 14);
      console.log(fmt(sf, R[sf]));
    }
    console.log('diag', JSON.stringify(diag));
    console.log(`coverage in 0.6 s: ${coverage(0.6).toFixed(2)} m, 1.0 s: ${coverage(1.0).toFixed(2)} m`);
  }, 600_000);

  // pooled over the three surfaces to keep the small samples (drops, lobs) stable
  const pool = () => {
    const all = Object.values(R);
    const sum = (k: keyof Balance) => all.reduce((a, b) => a + (b[k] as number), 0);
    return {
      rally: all.reduce((a, b) => a + b.rally, 0) / all.length,
      cornerOut: sum('cornerOutright') / sum('cornerN'),
      midOut: sum('midOutright') / Math.max(1, sum('midN')),
      dropClose: sum('dropWinClose') / sum('dropNClose'),
      dropDeep: sum('dropWinDeep') / sum('dropNDeep'),
      lobNet: sum('lobNetWin') / sum('lobNetN'),
      unreturned: sum('unreturned') / sum('points'),
      df: sum('df') / sum('points'),
    };
  };
  it('rallies last about 4-7 shots', () => {
    const p = pool();
    expect(p.rally).toBeGreaterThan(4);
    expect(p.rally).toBeLessThan(7);
  });
  it('a ball placed in the corner can beat the player (and the middle cannot)', () => {
    const p = pool();
    expect(p.cornerOut).toBeGreaterThan(0.08); // was ~1% before M16
    expect(p.midOut).toBeLessThan(p.cornerOut / 3);
  });
  it('drop shots against a baseline player are no longer near-automatic; against a deep defender they still work', () => {
    const p = pool();
    expect(p.dropClose).toBeLessThan(0.62); // was 43-71% (and 75-83% for PERFECT drops)
    expect(p.dropDeep).toBeGreaterThan(0.42);
  });
  it('a lob over a net player usually wins', () => {
    const p = pool();
    expect(p.lobNet).toBeGreaterThan(0.4); // was 18-39%
    expect(p.lobNet).toBeLessThan(0.8);
  });
  it('serves can win outright but double faults stay rare', () => {
    const p = pool();
    expect(p.unreturned).toBeGreaterThan(0.02); // was ~0%
    expect(p.df).toBeLessThan(0.05);
    const aces = Object.values(R).reduce((a, b) => a + b.aceRate * b.points, 0);
    expect(aces).toBeGreaterThan(0); // untouched serves are called ACE!
  });
});
