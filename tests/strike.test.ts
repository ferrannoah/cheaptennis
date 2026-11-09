import { describe, it, expect, afterEach } from 'vitest';
import { STRIKE_IDS, strikeFrom, strikeButtons, aimRate, zoneRadius, accelQuota, prepQ, dangerOf, dangerClass } from '../src/match/strike';
import { makeShot, planStrike } from '../src/match/shots';
import { Match, MatchEvent } from '../src/match/match';
import { Controller, input } from '../src/core/input';
import { humanSetup } from '../src/data/defaults';
import { roster, proSetup } from '../src/data/roster';
import { SURFACES } from '../src/data/surfaces';
import { Rng } from '../src/core/rng';
import { T } from '../src/data/tuning';
import { shotInput } from './shot-input';
import type { Action } from '../src/core/settings';

describe('strike menu (Elbow controls)', () => {
  it('every one of the 10 strikes is reachable and strikeButtons inverts strikeFrom', () => {
    const got = new Set<string>();
    for (const b1 of [false, true]) for (const b2 of [false, true]) for (const fwd of [-1, 0, 1]) got.add(strikeFrom(b1, b2, fwd));
    expect([...got].sort()).toEqual([...STRIKE_IDS].sort());
    for (const id of STRIKE_IDS) {
      const b = strikeButtons(id);
      expect(strikeFrom(b.b1, b.b2, b.fwd)).toBe(id);
    }
    expect(strikeFrom(true, false, 0)).toBe('normal');
    expect(strikeFrom(true, false, 1)).toBe('short');
    expect(strikeFrom(true, false, -1)).toBe('topspin');
    expect(strikeFrom(false, true, 0)).toBe('slice');
    expect(strikeFrom(false, true, 1)).toBe('drop');
    expect(strikeFrom(false, true, -1)).toBe('lob');
    expect(strikeFrom(true, true, 0)).toBe('accel');
  });

  it('the aim sweeps 2-3x slower from a few metres behind the baseline than at the net', () => {
    const atNet = 1 / aimRate(2), behind = 1 / aimRate(14.5);
    expect(atNet).toBeLessThan(0.5);
    expect(behind / atNet).toBeGreaterThan(2);
    expect(behind / atNet).toBeLessThan(3);
  });

  it('the aiming zone shrinks with preparation; Arcade at 0.5 s = Simulation at 1 s', () => {
    expect(zoneRadius(0, 'arcade', 0.7)).toBeGreaterThan(zoneRadius(0.3, 'arcade', 0.7) * 1.6);
    expect(zoneRadius(0.5, 'arcade', 0.7)).toBeCloseTo(zoneRadius(1.0, 'sim', 0.7), 5);
    expect(zoneRadius(0.4, 'sim', 0.7)).toBeGreaterThan(zoneRadius(0.4, 'arcade', 0.7));
    expect(prepQ(1.5, 'arcade')).toBeGreaterThan(0.99);
  });

  it('good accelerations per point: 1-5 from endurance, plus the style bonus', () => {
    expect(accelQuota(10, 'serveVolley')).toBe(1);
    expect(accelQuota(60, 'serveVolley')).toBe(3);
    expect(accelQuota(100, 'serveVolley')).toBe(5);
    expect(accelQuota(60, 'aggressive')).toBe(6);
    expect(accelQuota(10, 'grinder')).toBe(1);
  });

  it('the danger zone is red only for fast rising balls', () => {
    expect(dangerClass(dangerOf(4, 4.2, 27))).toBe('red');
    expect(dangerClass(dangerOf(4, 4.2, 15))).not.toBe('red');
    expect(dangerClass(dangerOf(0.5, 4.2, 27))).toBe('green');
    expect(dangerOf(-1, 4, 27)).toBe(0); // falling: no danger
  });
});

describe('shot rules', () => {
  const sf = SURFACES.hard;
  const avg = (over: Parameters<typeof shotInput>[0], n = 60) => {
    let pace = 0, zone = 0, lost = 0;
    for (let i = 0; i < n; i++) {
      const o = makeShot(shotInput({ ...over, rng: new Rng(i + 7) }), sf);
      pace += o.pace;
      zone += o.zone;
      if (o.label === 'MISHIT') lost++;
    }
    return { pace: pace / n, zone: zone / n, lost: lost / n };
  };
  it('a rising ball in the red zone costs power and control; Arcade halves it', () => {
    const green = avg({ danger: 0 }), red = avg({ danger: 0.85, mode: 'sim' }), redArc = avg({ danger: 0.85, mode: 'arcade' });
    expect(red.pace).toBeLessThan(green.pace * 0.9);
    expect(red.lost).toBeGreaterThan(0.1);
    expect(redArc.lost).toBeLessThan(red.lost);
    expect(redArc.zone).toBeLessThan(red.zone);
  });
  it('off-centre (into the body) costs accuracy and can lose the ball', () => {
    const ok = avg({ centre: 0 }), body = avg({ centre: 0.95, body: true, mode: 'sim' });
    expect(body.zone).toBeGreaterThan(ok.zone * 1.3);
    expect(body.lost).toBeGreaterThan(0.05);
  });
  it('accelerations are faster; past the quota they get slower and wilder', () => {
    const n = avg({ strike: 'normal' }), a = avg({ strike: 'accel' }), a2 = avg({ strike: 'accel', accelOver: 2 });
    expect(a.pace).toBeGreaterThan(n.pace * 1.15);
    expect(a2.pace).toBeLessThan(a.pace * 0.9);
    expect(a2.zone).toBeGreaterThan(a.zone * 1.5);
  });
  it('earlier preparation hits deeper; short strikes land shorter; closer to the baseline goes deeper', () => {
    const deepPrep = planStrike(shotInput({ prep: 1 })).depth, latePrep = planStrike(shotInput({ prep: 0.05 })).depth;
    expect(deepPrep).toBeGreaterThan(latePrep + 0.5);
    const shortPrep = planStrike(shotInput({ strike: 'short', prep: 1 })).depth, shortLate = planStrike(shotInput({ strike: 'short', prep: 0.05 })).depth;
    expect(shortPrep).toBeLessThan(shortLate);
    expect(planStrike(shotInput({ contactY: -11.2 })).depth).toBeGreaterThan(planStrike(shotInput({ contactY: -14.5 })).depth);
  });
  it('a lob on the run follows the run; a drop on a fast ball floats long', () => {
    expect(planStrike(shotInput({ strike: 'lob', speedRatio: 0.9, runVx: 5 })).tx).toBeGreaterThan(1.5);
    expect(planStrike(shotInput({ strike: 'drop', inSpeed: 30 })).depth).toBeGreaterThan(planStrike(shotInput({ strike: 'drop', inSpeed: 12 })).depth + 1);
  });
  it('max acceleration pace at the top of the bounce, bonus at shoulder height', () => {
    const top = planStrike(shotInput({ strike: 'accel', ballVz: 0, contactZ: 1.0 })).pace;
    const falling = planStrike(shotInput({ strike: 'accel', ballVz: -5, contactZ: 1.0 })).pace;
    const shoulder = planStrike(shotInput({ strike: 'accel', ballVz: 0, contactZ: 1.4, shoulderStyle: 1 })).pace;
    expect(top).toBeGreaterThan(falling);
    expect(shoulder).toBeGreaterThan(top);
  });
});

// ------------------------------------------------------- in a real match (practice ball machine)
function practice(type: 'normal' | 'lob' = 'normal', side: 'fh' | 'bh' | 'mix' = 'fh') {
  const me = humanSetup();
  const ctrl = new Controller('t1', null, null);
  return new Match({
    surface: 'hard', format: { kind: 'games', target: 99 }, players: [me, proSetup(roster()[0], 'MACHINE')], controllers: [ctrl, null],
    difficulty: 'normal', seed: 11, practice: { type, side, speed: 0.8, interval: 40 }, controls: { mode: 'arcade', autoPos: 'fast' },
  });
}
function hold(...as: Action[]) {
  for (const a of as) input.vpress('t1', a, 100000);
}
function runToHit(m: Match, maxF = 600): { hit: Extract<MatchEvent, { t: 'hit' }> | null; maxHoldSpeed: number } {
  let maxHoldSpeed = 0;
  for (let f = 0; f < maxF; f++) {
    m.update();
    const p = m.players[0];
    if (p.strike.held && !p.swing && p.lock === 'none') maxHoldSpeed = Math.max(maxHoldSpeed, Math.hypot(p.vx, p.vy));
    const e = m.events.find((x) => x.t === 'hit' && x.p === 0) as Extract<MatchEvent, { t: 'hit' }> | undefined;
    m.events.length = 0;
    if (e) return { hit: e, maxHoldSpeed };
  }
  return { hit: null, maxHoldSpeed };
}

describe('hold-to-strike in a match', () => {
  afterEach(() => input.virtual.clear());
  it('holding a strike button auto-positions at the auto-pos speed and strikes by itself', () => {
    const m = practice();
    hold('b1');
    const r = runToHit(m);
    expect(r.hit).not.toBeNull();
    expect(r.hit!.strike).toBe('normal');
    expect(r.hit!.prep).toBeGreaterThan(0.5);
    expect(r.maxHoldSpeed).toBeLessThanOrEqual(T.autoPosSpeed.fast + 0.05);
    expect(r.maxHoldSpeed).toBeGreaterThan(0.3); // it really walked to the ball
  });
  it('nothing held: a weak safe strike', () => {
    const m = practice();
    const r = runToHit(m);
    expect(r.hit?.strike).toBe('safe');
    expect(r.hit?.grade).toBe('SAFE');
  });
  it('B2 + toward the net = drop shot, B1 + away = topspin, Accel = acceleration (one less in the quota)', () => {
    let m = practice();
    hold('b2', 'up');
    expect(runToHit(m).hit?.strike).toBe('drop');
    input.virtual.clear();
    m = practice();
    hold('b1', 'down');
    expect(runToHit(m).hit?.strike).toBe('topspin');
    input.virtual.clear();
    m = practice();
    hold('acc');
    expect(runToHit(m).hit?.strike).toBe('accel');
    expect(m.players[0].accelUsed).toBe(1);
  });
  it('holding right sweeps the aim to the right over time', () => {
    const m = practice();
    hold('b1', 'right');
    let aim0 = -1;
    for (let f = 0; f < 600 && aim0 < 0; f++) {
      m.update();
      m.events.length = 0;
      if (m.players[0].strike.held && m.ballLive) aim0 = m.players[0].strike.aim;
    }
    for (let f = 0; f < 20; f++) m.update();
    expect(m.players[0].strike.aim).toBeGreaterThan(aim0 + 0.15);
  });
});
