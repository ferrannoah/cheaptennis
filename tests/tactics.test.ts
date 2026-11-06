import { describe, it, expect } from 'vitest';
import { Match } from '../src/match/match';
import { PlayerSetup, flatStats, DEFAULT_KIT } from '../src/data/types';
import { TACTIC_IDS, TacticId, pureBlend, personalBlend, ARCHETYPE_BLEND, normalize, dominant } from '../src/data/tactics';
import { AI } from '../src/match/ai';
import { simMatch } from '../src/sim/match-sim';
import { Rng } from '../src/core/rng';

function setup(name: string, tactic?: TacticId): PlayerSetup {
  return {
    name, short: name, stats: flatStats(72), archetype: 'allCourt', kit: DEFAULT_KIT, hand: 'R', twoHanded: true, badges: [], startStamina: 100,
    tactics: tactic ? pureBlend(tactic) : undefined, tacticsFixed: !!tactic,
  };
}

interface Profile {
  shots: number; volleyPct: number; topPct: number; slicePct: number; lobDropPct: number; fhPct: number; depth: number;
  rally: number; flatServePct: number; svPct: number; crossPct: number; bhTargetPct: number; points: number;
}

/** Measure player 1 (far side) playing a fixed tactic against a neutral all-court COM. */
function measure(t: TacticId, surface: 'hard' | 'grass' | 'clay' = 'hard'): Profile {
  const acc = { shots: 0, volley: 0, top: 0, slice: 0, lobDrop: 0, fh: 0, depth: 0, rally: 0, points: 0, serves: 0, flat: 0, sv: 0, cross: 0, crossN: 0, bh: 0 };
  for (let seed = 1; seed <= 5; seed++) {
    const m = new Match({ surface, format: { kind: 'games', target: 3 }, players: [setup('A'), setup('B', t)], controllers: [null, null], difficulty: 'normal', seed: seed * 97 });
    let serveAt = -1;
    for (let f = 0; f < 90000 && m.phase !== 'over'; f++) {
      m.update();
      for (const e of m.events) {
        if (e.t === 'hit' && e.p === 1) {
          acc.shots++;
          if (e.volley) acc.volley++;
          if (e.shot === 'topspin') acc.top++;
          if (e.shot === 'slice') acc.slice++;
          if (e.shot === 'lob' || e.shot === 'drop') acc.lobDrop++;
          if (e.fh) acc.fh++;
          acc.depth += Math.abs(e.cy);
          const hx = m.players[1].x;
          if (Math.abs(hx) > 0.8 && Math.abs(e.tx) > 0.8) {
            acc.crossN++;
            if (Math.sign(e.tx) !== Math.sign(hx)) acc.cross++;
          }
          // the near (righty) opponent's backhand is the -x side
          if (e.tx < -0.8) acc.bh++;
          if (serveAt >= 0 && e.volley) acc.sv++;
          serveAt = -1;
        }
        if (e.t === 'serve' && e.p === 1) {
          acc.serves++;
          if (e.type === 'flat') acc.flat++;
          serveAt = m.frame;
        }
        if (e.t === 'point') {
          acc.points++;
          acc.rally += e.rally;
        }
      }
      m.events.length = 0;
    }
  }
  const pc = (a: number, b: number) => (b ? a / b : 0);
  return {
    shots: acc.shots, volleyPct: pc(acc.volley, acc.shots), topPct: pc(acc.top, acc.shots), slicePct: pc(acc.slice, acc.shots),
    lobDropPct: pc(acc.lobDrop, acc.shots), fhPct: pc(acc.fh, acc.shots), depth: pc(acc.depth, acc.shots), rally: pc(acc.rally, acc.points),
    flatServePct: pc(acc.flat, acc.serves), svPct: pc(acc.sv, acc.serves), crossPct: pc(acc.cross, acc.crossN), bhTargetPct: pc(acc.bh, acc.shots), points: acc.points,
  };
}

describe('each tactic plays measurably differently', () => {
  const P = {} as Record<TacticId, Profile>;
  it('collects profiles', () => {
    for (const t of TACTIC_IDS) {
      P[t] = measure(t);
      const p = P[t];
      console.log(`${t.padEnd(8)} shots ${p.shots} volley ${(p.volleyPct * 100).toFixed(0)}% top ${(p.topPct * 100).toFixed(0)}% slice ${(p.slicePct * 100).toFixed(0)}% lob/drop ${(p.lobDropPct * 100).toFixed(0)}% fh ${(p.fhPct * 100).toFixed(0)}% depth ${p.depth.toFixed(1)}m rally ${p.rally.toFixed(1)} flatServe ${(p.flatServePct * 100).toFixed(0)}% S&V ${(p.svPct * 100).toFixed(0)}% cross ${(p.crossPct * 100).toFixed(0)}% toBH ${(p.bhTargetPct * 100).toFixed(0)}%`);
    }
  }, 300_000);
  it('Net Attack volleys most and plays closest to the net', () => {
    for (const t of TACTIC_IDS) if (t !== 'net') expect(P.net.volleyPct).toBeGreaterThan(P[t].volleyPct);
    for (const t of TACTIC_IDS) if (t !== 'net') expect(P.net.depth).toBeLessThan(P[t].depth);
    expect(P.net.svPct).toBeGreaterThan(0.2);
  });
  it('Baseline Grind hits the most topspin and rallies crosscourt', () => {
    for (const t of TACTIC_IDS) if (t !== 'grind') expect(P.grind.topPct).toBeGreaterThan(P[t].topPct);
    expect(P.grind.crossPct).toBeGreaterThan(P.serve1.crossPct);
  });
  it('Counterpunch uses the most lobs/drops and stays deepest', () => {
    for (const t of TACTIC_IDS) if (t !== 'counter') expect(P.counter.lobDropPct).toBeGreaterThan(P[t].lobDropPct);
    for (const t of TACTIC_IDS) if (t !== 'counter') expect(P.counter.depth).toBeGreaterThan(P[t].depth);
  });
  it('Forehand Dominance hits the most forehands and targets the backhand', () => {
    for (const t of TACTIC_IDS) if (t !== 'fhDom') expect(P.fhDom.fhPct).toBeGreaterThan(P[t].fhPct);
    expect(P.fhDom.bhTargetPct).toBeGreaterThan(P.grind.bhTargetPct);
  });
  it('Serve + 1 serves the most flat first serves and plays shorter rallies than Grind', () => {
    for (const t of TACTIC_IDS) if (t !== 'serve1') expect(P.serve1.flatServePct).toBeGreaterThan(P[t].flatServePct);
    expect(P.serve1.rally).toBeLessThan(P.grind.rally);
  });
});

describe('blends and adaptation', () => {
  it('personal blends are normalized, archetype-flavoured and vary between players', () => {
    const a = personalBlend('grinder', 1);
    const b = personalBlend('grinder', 2);
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 6);
    expect(dominant(a)).toBe('grind');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(dominant(personalBlend('serveVolley', 9))).toBe('net');
  });
  it('the AI shifts its blend toward the plan that wins points', () => {
    const ai = new AI(1, normalize(ARCHETYPE_BLEND.allCourt), 'allCourt');
    const before = ai.blend.net;
    for (let i = 0; i < 12; i++) {
      ai.tactic = 'net';
      ai.onPointEnd(true);
      ai.tactic = 'grind';
      ai.onPointEnd(false);
    }
    expect(ai.blend.net).toBeGreaterThan(before * 1.5);
    expect(ai.blend.grind).toBeLessThan(0.2);
    expect(ai.record.net).toEqual([12, 12]);
  });
  it('a forced plan does not adapt', () => {
    const ai = new AI(1, pureBlend('counter'), 'allCourt', true);
    ai.tactic = 'counter';
    for (let i = 0; i < 10; i++) ai.onPointEnd(false);
    expect(ai.blend.counter).toBe(1);
  });
});

describe('tactic matchups in the stat sim', () => {
  it('Net Attack does better on grass than on clay against a grinder', () => {
    const r = new Rng(5);
    const netP = { stats: flatStats(70), archetype: 'allCourt' as const, tactics: pureBlend('net') };
    const grindP = { stats: flatStats(70), archetype: 'allCourt' as const, tactics: pureBlend('grind') };
    let grass = 0, clay = 0;
    for (let i = 0; i < 600; i++) {
      if (simMatch(netP, grindP, 'grass', { kind: 'sets', bestOf: 3 }, r).winner === 0) grass++;
      if (simMatch(netP, grindP, 'clay', { kind: 'sets', bestOf: 3 }, r).winner === 0) clay++;
    }
    expect(grass).toBeGreaterThan(clay + 40);
  });
});
