import type { Match } from './match';
import { Player } from './player';
import { cloneBall, stepBall, predictFirstBounce } from './ball';
import { T } from '../data/tuning';
import { HALF_LEN } from '../data/court';
import { ARCHETYPES } from '../data/archetypes';
import { ArchetypeId, ShotType, ServeType } from '../data/types';
import { Difficulty } from '../core/settings';
import { TACTICS, TACTIC_IDS, TacticBlend, TacticId, normalize, dominant } from '../data/tactics';
import { StrikeId, strikeButtons, dangerOf, ServeForce, zoneRadius, STRIKES } from './strike';
import { HALF_W } from '../data/court';

export const DIFF_NOISE: Record<Difficulty, number> = { easy: 1.7, normal: 1.0, hard: 0.78, pro: 0.62 };

interface Plan {
  tx: number;
  ty: number;
  /** frame of the planned contact */
  contactAt: number;
  shot: ShotType;
  strike: StrikeId;
  aimX: number;
  aimDepth: number;
  power: number;
  /** (M21) seconds of preparation the COM wants: it presses this long before contact (if it is set by then) */
  prep: number;
  holding: boolean;
}

/** (M21) how early the COM presses its strike button before contact (s): easy ≈0.5, normal ≈0.8, pro ≈1.0 */
function prepBase(noise: number): number {
  return Math.max(0.45, Math.min(1.15, 1.25 - 0.45 * noise));
}

/** The effective decision parameters for one point: archetype tendencies shaped by the active tactic. */
export interface Eff {
  homeBack: number;
  netRush: number;
  serveVolley: number;
  approachShort: number;
  shotW: Record<ShotType, number>;
  aggression: number;
  crossBias: number;
  targetBackhand: number;
  runAround: number;
  depth: number;
  serve: Record<ServeType, number>;
  serveAim: number[];
}

export function effective(arch: ArchetypeId, tid: TacticId): Eff {
  const a = ARCHETYPES[arch].ai;
  const t = TACTICS[tid];
  const shotW = {} as Record<ShotType, number>;
  for (const k of ['normal', 'topspin', 'slice', 'lob', 'drop'] as ShotType[]) shotW[k] = a.shotW[k] * t.shotMul[k];
  return {
    homeBack: Math.max(-0.5, a.homeBack + t.homeBack * 0.9),
    netRush: a.netRush * 0.3 + t.netRush * 0.7,
    serveVolley: Math.min(0.9, t.serveVolley * (0.6 + a.netRush)),
    approachShort: t.approachShort,
    shotW,
    aggression: Math.max(0.05, Math.min(1, a.aggression + t.aggression)),
    crossBias: t.crossBias,
    targetBackhand: t.targetBackhand,
    runAround: t.runAround,
    depth: t.depth,
    serve: { flat: a.serve.flat * t.serveMul.flat, kick: a.serve.kick * t.serveMul.kick, slice: a.serve.slice * t.serveMul.slice },
    serveAim: t.serveAim,
  };
}

/** forehand side direction in world x for a player (+1 = +x) */
function fhSign(p: Player): number {
  return (p.side === 0 ? 1 : -1) * (p.setup.hand === 'R' ? 1 : -1);
}

export class AI {
  plan: Plan | null = null;
  planFor = -1; // shot counter the plan was made for
  replanAt = 0;
  serveWait = 0;
  serveHitAt = -1;
  serveType: ServeType = 'flat';
  serveAim = 0;
  rushing = false;
  /** current game plan and its parameters */
  tactic: TacticId = 'grind';
  eff: Eff;
  blend: TacticBlend;
  /** points won/played per tactic this match */
  record: Record<TacticId, [number, number]> = { serve1: [0, 0], fhDom: [0, 0], grind: [0, 0], net: [0, 0], counter: [0, 0] };
  oppNetSeen = 0;
  oppSamples = 0;
  private useFh = true;

  constructor(public noise = 1, public base: TacticBlend, public arch: ArchetypeId = 'allCourt', public fixed = false) {
    this.blend = { ...base };
    this.tactic = dominant(base);
    this.eff = effective(arch, this.tactic);
  }

  /** Pick this point's game plan from the blend, shaped by the situation. */
  newPoint(m: Match, p: Player): TacticId {
    const opp = m.players[1 - p.idx];
    const serving = m.server === p;
    const w = { ...this.blend };
    const mul = (k: TacticId, v: number) => (w[k] *= v);
    if (serving) {
      mul('serve1', 1.6);
      mul('net', 1.3);
    } else {
      mul('serve1', 0.45);
      mul('grind', 1.2);
      mul('counter', 1.2);
    }
    if (m.sf.id === 'grass') {
      mul('net', 1.5);
      mul('serve1', 1.3);
      mul('grind', 0.8);
    } else if (m.sf.id === 'clay') {
      mul('grind', 1.4);
      mul('counter', 1.25);
      mul('net', 0.5);
      mul('serve1', 0.8);
    }
    if (p.staminaF() < 0.35) {
      // tired: shorten the points
      mul('serve1', 1.5);
      mul('net', 1.4);
      mul('grind', 0.5);
      mul('counter', 0.7);
    }
    if (opp.stats.backhand < opp.stats.forehand - 4) mul('fhDom', 1.35);
    if (this.oppSamples > 30 && this.oppNetSeen / this.oppSamples > 0.25) mul('counter', 1.6);
    if (m.score.isBigPoint()) for (const k of TACTIC_IDS) w[k] = w[k] * w[k]; // stick to what you trust
    const tot = TACTIC_IDS.reduce((a, k) => a + w[k], 0);
    let r = m.rng.next() * tot;
    let pick: TacticId = dominant(this.blend);
    for (const k of TACTIC_IDS) {
      r -= w[k];
      if (r <= 0 && w[k] > 0) {
        pick = k;
        break;
      }
    }
    this.tactic = pick;
    this.eff = effective(this.arch, pick);
    return pick;
  }

  /** After a point: learn which plans are working. Returns the new dominant tactic if it changed. */
  onPointEnd(won: boolean): TacticId | null {
    const rec = this.record[this.tactic];
    rec[1]++;
    if (won) rec[0]++;
    if (this.fixed) return null;
    const before = dominant(this.blend);
    const b = { ...this.blend };
    b[this.tactic] *= won ? 1.12 : 0.9;
    // stay anchored to the player's natural style
    for (const k of TACTIC_IDS) b[k] = b[k] * 0.97 + this.base[k] * 0.03;
    this.blend = normalize(b);
    const after = dominant(this.blend);
    return after !== before ? after : null;
  }

  /**
   * Returns the movement vector, the strike buttons to hold this frame (or null), and the aim the
   * sweep heads for. (M21) The COM runs to its spot, then presses early and lets auto-positioning
   * finish the approach, exactly like a player.
   */
  update(m: Match, p: Player): { mx: number; my: number; hold: { b1: boolean; b2: boolean; fwd: number } | null; aimX: number; power: number } {
    const out = { mx: 0, my: 0, hold: null as { b1: boolean; b2: boolean; fwd: number } | null, aimX: 0, power: 1 };
    const opp = m.players[1 - p.idx];
    const incoming = m.ballLive && m.rally.lastHitter !== p.idx && m.rally.lastHitter !== -1 && !m.rally.dead;

    if (incoming) {
      if (this.planFor !== m.rally.shotCount || m.frame >= this.replanAt) {
        let reactFrames = this.planFor !== m.rally.shotCount ? Math.round((9 + 9 * (1 - p.stats.footwork / 99)) * Math.sqrt(this.noise)) : 0;
        // lobbed at the net: it takes a moment to read it and turn around
        if (reactFrames && Math.abs(p.y) < 6.5 && m.ball.vz > 5) reactFrames += T.netLobReact;
        // reading a serve takes longer than reading a rally ball
        if (reactFrames && m.rally.isServe) reactFrames += T.returnReact;
        if (this.planFor !== m.rally.shotCount) {
          this.planFor = m.rally.shotCount;
          this.plan = null;
          this.replanAt = m.frame + reactFrames;
          // per-shot: run around the backhand?
          this.useFh = this.firstStrike || m.rng.chance(0.25 + this.eff.runAround * 0.75);
          this.oppSamples++;
          if (Math.abs(opp.y) < 7) this.oppNetSeen++;
        } else {
          this.makePlan(m, p, opp);
          this.replanAt = m.frame + 20;
        }
      }
      if (this.plan) {
        const pl = this.plan;
        const dx = pl.tx - p.x;
        const dy = pl.ty - p.y;
        const d = Math.hypot(dx, dy);
        const max = p.maxSpeed(m.sf);
        const want = Math.min(1, d / Math.max(0.3, max * 0.18));
        if (d > 0.08) {
          out.mx = (dx / d) * want;
          out.my = (-dy / d) * want;
        }
        const left = (pl.contactAt - m.frame) / 60;
        // press once the preparation time has come and auto-positioning can cover the rest
        if (!pl.holding && left <= pl.prep && (d <= T.aiAutoPos * left * 0.85 + 0.12 || left <= 0.14)) pl.holding = true;
        out.aimX = pl.aimX;
        out.power = pl.power;
        if (pl.holding) out.hold = strikeButtons(pl.strike);
      }
    } else if (m.ballLive && m.rally.lastHitter === p.idx) {
      const home = this.home(m, p);
      const dx = home.x - p.x;
      const dy = home.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.15) {
        const want = Math.min(1, d / 1.2) * (p.swing ? 0.3 : 1);
        out.mx = (dx / d) * want;
        out.my = (-dy / d) * want;
      }
    }
    return out;
  }

  private home(m: Match, p: Player): { x: number; y: number } {
    const dir = p.dir;
    let back = this.eff.homeBack;
    if (p.staminaF() < 0.3) back += 0.6;
    let y = -dir * (HALF_LEN + back - T.aiHomeShift);
    if (this.rushing) y = -dir * 3.4;
    const bx = m.predicted ? m.predicted.x : 0;
    let x = Math.max(-2.5, Math.min(2.5, bx * 0.35));
    // forehand-dominant players shade towards their backhand corner to keep the forehand open
    if (!this.rushing) x -= fhSign(p) * this.eff.runAround * 0.6;
    return { x, y };
  }

  onOwnShot(m: Match, p: Player, shot: ShotType): void {
    const deepOpp = Math.abs(m.players[1 - p.idx].y) > HALF_LEN - 0.5;
    const inside = Math.abs(p.y) < HALF_LEN - 1.5;
    let chance = this.eff.netRush * (inside ? 1.6 : 0.6) * (deepOpp ? 1.2 : 0.8);
    // chip-and-charge: came forward for a short ball
    if (Math.abs(p.y) < HALF_LEN - 3) chance = Math.max(chance, this.eff.approachShort);
    this.rushing = (shot === 'slice' || shot === 'normal' || shot === 'topspin') && m.rng.chance(chance);
    if (Math.abs(p.y) < 6) this.rushing = true;
    if (shot === 'lob' || shot === 'drop') this.rushing = false;
    this.firstStrike = false;
  }

  onServeHit(m: Match, p: Player): void {
    this.rushing = m.rng.chance(this.eff.serveVolley);
    this.firstStrike = this.tactic === 'serve1';
  }
  /** Serve + 1: the first shot after our own serve is an all-out forehand to the open court */
  firstStrike = false;

  private makePlan(m: Match, p: Player, opp: Player): void {
    // let it go: a ball that will land out should not be played (unless the read is wrong on a close call)
    if (m.rally.bounces === 0) {
      const fb = predictFirstBounce(m.ball, m.sf);
      if (!fb.hitNet && fb.by * p.dir < 0) {
        const overY = Math.abs(fb.by) - (HALF_LEN + 0.034);
        const overX = Math.abs(fb.bx) - (4.115 + 0.034);
        const over = Math.max(overY, overX);
        if (over > 0 && !(over < 0.3 && m.rng.chance(0.3 * this.noise))) {
          this.plan = null;
          return;
        }
      }
    }
    const b = cloneBall(m.ball);
    let bounces = m.rally.bounces;
    let vz0 = bounces >= 1 ? m.rally.bounceVz : 0;
    const dir = p.dir;
    const fs = fhSign(p);
    let best: { f: number; x: number; y: number; z: number; cost: number; vol: boolean; need: number } | null = null;
    let fallback: { f: number; x: number; y: number; z: number; short: number; vol: boolean } | null = null;
    const serveRet = m.rally.isServe;
    for (let f = 1; f <= 200; f++) {
      const ev = stepBall(b, m.sf);
      if (ev === 'bounce') {
        bounces++;
        if (bounces === 1) vz0 = b.vz;
      }
      if (ev === 'net') return;
      if (bounces >= 2) break;
      if (b.y * dir > -0.8) continue;
      const vol = bounces === 0;
      if (vol && (serveRet || Math.abs(b.y) > 8.5)) continue;
      if (b.z < 0.2 || b.z > (vol ? 2.4 : 2.3)) continue;
      // forehand or backhand side: natural side is where the ball already is
      const naturalFh = (b.x - p.x) * fs >= 0;
      const side = naturalFh || this.useFh ? fs : -fs;
      const lat = side === fs || !p.setup.twoHanded ? T.idealLat1H : T.idealLat2H;
      const px = b.x - lat * side;
      const py = b.y - dir * T.contactAhead;
      // (M20) feet must be set when the swing animation starts, a windup before contact
      const tAvail = (f - 3 - T.windup * 0.7) / 60;
      let need = p.timeTo(px, py, m.sf) + 0.06;
      // a smash while running back needs time to get set under the ball
      if (vol && b.z > T.overheadZ && (py - p.y) * dir < -0.5) need += T.overheadSetup;
      if (need <= tAvail) {
        let cost = Math.abs(b.z - 1.0) * 2;
        // (M21) stay out of the danger zone: a ball still rising off the bounce is hard to control
        if (!vol) cost += dangerOf(b.vz, vz0, Math.hypot(b.vx, b.vy)) * T.aiDangerCost;
        cost += (f / 60) * (this.eff.aggression - 0.4) * 2.2;
        if (Math.abs(py) > HALF_LEN + 2.5) cost += (Math.abs(py) - HALF_LEN - 2.5) * 0.8 * (this.tactic === 'counter' ? 0.4 : 1);
        // (M20) take the ball around the baseline like the Free Tennis players, not from deep behind it
        if (Math.abs(py) > HALF_LEN - 0.5) cost += (Math.abs(py) - HALF_LEN + 0.5) * T.aiDeepCost * (this.tactic === 'counter' ? 0.5 : 1);
        if (vol) cost += this.rushing || Math.abs(p.y) < 6 ? -0.6 : 1.2;
        if (!best || cost < best.cost) best = { f, x: px, y: py, z: b.z, cost, vol, need };
      } else {
        const short = need - tAvail;
        if (!fallback || short < fallback.short) fallback = { f, x: b.x - Math.sign(b.x - p.x) * 1.2, y: py, z: b.z, short, vol };
      }
    }
    const pick = best ?? (fallback ? { ...fallback, cost: 0, need: 9 } : null);
    if (!pick) {
      this.plan = null;
      return;
    }
    // (M21) preparation: better and calmer players press earlier
    const prev = this.plan;
    let prep = prepBase(this.noise) * (0.85 + 0.3 * (p.stats.mental / 99)) + m.rng.gauss() * 0.12 * this.noise;
    if (p.staminaF() < 0.35) prep *= 0.8;
    prep = Math.max(0.15, Math.min(1.4, prep));
    const shot = prev?.holding ? prev.shot : this.chooseShot(m, p, opp, pick.vol, pick.z, pick.y);
    const aim = prev?.holding ? { x: prev.aimX, d: prev.aimDepth } : this.chooseAim(m, p, opp, shot, pick.x);
    const strike = prev?.holding ? prev.strike : this.chooseStrike(m, p, opp, shot, aim.d, pick.vol, pick.y);
    if (!prev?.holding) {
      // (M21) aim inside the lines by a margin the COM expects its aiming zone to need
      const statF = (p.stats.forehand + p.stats.backhand) / 2 / 99;
      // the preparation it will really get: what is left after running there (auto-positioning does the last bit)
      const expPrep = Math.max(0.1, Math.min(prep, pick.f / 60 - pick.need * 0.75));
      const sig = (zoneRadius(expPrep, 'sim', statF) * 1.25 * (STRIKES[strike].accel ? 1.18 : 1)) / 1.354;
      const width = STRIKES[strike].short ? 3.9 : shot === 'drop' || shot === 'lob' ? 3.2 : 3.6;
      const k = 1.5 - 0.6 * this.eff.aggression;
      const maxX = Math.max(0.25, (HALF_W - k * sig) / width);
      aim.x = Math.max(-maxX, Math.min(maxX, aim.x));
    }
    let power = 1 + (this.eff.aggression - 0.5) * 0.2;
    if (this.tactic === 'grind') power = Math.min(power, 0.96);
    if (this.tactic === 'net' && pick.vol) power = 1.06;
    if (this.firstStrike) power = 1.1;
    this.plan = {
      tx: pick.x, ty: pick.y, contactAt: m.frame + pick.f, shot, strike, aimX: aim.x, aimDepth: aim.d, power,
      prep: prev?.holding ? prev.prep : prep, holding: !!prev?.holding,
    };
  }

  /** (M21) turn the chosen shot into a strike from the menu: accelerations, short angles, attack lobs */
  private chooseStrike(m: Match, p: Player, opp: Player, shot: ShotType, aimD: number, vol: boolean, contactY: number): StrikeId {
    const r = m.rng;
    const left = p.accelQuota - p.accelUsed;
    const shortBall = Math.abs(contactY) < HALF_LEN - 2.5;
    const oppNet = Math.abs(opp.y) < 6.5;
    if (shot === 'lob') return oppNet && left > 0 && this.eff.aggression > 0.55 && r.chance(0.35) ? 'attackLob' : 'lob';
    if (shot !== 'normal') return shot;
    let accelP = this.eff.aggression * 0.45 + (this.firstStrike ? 0.5 : 0) + (shortBall ? 0.3 : 0) - (vol ? 0.3 : 0);
    if (left <= 0) accelP *= 0.15; // the COM rarely forces an acceleration it hasn't got
    const accel = r.chance(Math.max(0, accelP));
    const short = aimD < -0.35 || (oppNet && r.chance(0.5));
    if (accel) return short ? 'shortAccel' : 'accel';
    return short ? 'short' : 'normal';
  }

  private chooseShot(m: Match, p: Player, opp: Player, vol: boolean, z: number, contactY: number): ShotType {
    const w = { ...this.eff.shotW };
    const oppNet = Math.abs(opp.y) < 6.5;
    const oppDeep = Math.abs(opp.y) > HALF_LEN + 1.5;
    const meDeep = Math.abs(contactY) > HALF_LEN + 1;
    const shortBall = Math.abs(contactY) < HALF_LEN - 3;
    if (oppNet) {
      w.lob *= 6;
      w.drop *= 0.1;
      w.normal *= 1.5;
    } else {
      w.lob *= meDeep ? 0.8 : 0.15;
    }
    if (oppDeep && !meDeep) w.drop *= 4;
    else w.drop *= meDeep ? 0.1 : 0.5;
    if (shortBall && this.tactic === 'net') w.slice *= 2.5; // chip approach
    if (shortBall && (this.tactic === 'serve1' || this.tactic === 'fhDom')) w.normal *= 2; // attack the short ball
    if (this.firstStrike) {
      w.normal *= 4;
      w.lob *= 0.1;
      w.drop *= 0.1;
    }
    if (vol) {
      w.lob *= 0.1;
      w.topspin *= 0.2;
      w.drop *= 1.5;
    }
    if (z < 0.45) {
      w.slice *= 2;
      w.topspin *= 0.6;
    }
    if (m.sf.id === 'clay') w.topspin *= 1.4;
    if (m.sf.id === 'grass') w.slice *= 1.4;
    const tot = w.normal + w.topspin + w.slice + w.lob + w.drop;
    let r = m.rng.next() * tot;
    for (const k of ['normal', 'topspin', 'slice', 'lob', 'drop'] as ShotType[]) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'normal';
  }

  private chooseAim(m: Match, p: Player, opp: Player, shot: ShotType, contactX: number): { x: number; d: number } {
    const r = m.rng;
    const e = this.eff;
    let x: number;
    const oppBh = -fhSign(opp); // world-x direction of the opponent's backhand side
    if (Math.abs(p.y) < 6.5 && shot !== 'lob') {
      // at the net: put the volley away, short and angled away from the opponent
      const side = Math.abs(opp.x) > 0.5 ? -Math.sign(opp.x) : r.chance(0.5) ? 1 : -1;
      return { x: side * r.range(0.75, 1.0), d: r.range(-0.8, -0.25) };
    }
    if (this.firstStrike && shot !== 'lob' && shot !== 'drop') {
      // the "+1": hit into the open court, deep and close to the line
      const side = Math.abs(opp.x) > 0.4 ? -Math.sign(opp.x) : r.chance(0.5) ? 1 : -1;
      return { x: side * r.range(0.8, 1.0), d: r.range(0.45, 0.8) };
    }
    if (Math.abs(opp.x) > 1.2 && r.chance(0.35 + e.aggression * 0.45)) {
      // open court
      x = -Math.sign(opp.x) * r.range(0.45, 0.6 + e.aggression * 0.45);
    } else if (r.chance(e.targetBackhand)) {
      x = oppBh * r.range(0.4, 0.55 + e.aggression * 0.45);
    } else if (Math.abs(contactX) > 0.8) {
      // crosscourt (away from our side) or down the line
      const cross = r.chance(e.crossBias);
      x = (cross ? -Math.sign(contactX) : Math.sign(contactX)) * r.range(0.35, 0.5 + e.aggression * 0.5);
    } else {
      x = r.range(-1, 1) * (0.3 + e.aggression * 0.6);
    }
    let d = Math.min(1, r.range(0.05, 0.35) + e.depth * 0.7 + e.aggression * 0.15);
    if (shot === 'drop') d = r.range(-0.5, 0.3);
    if (shot === 'lob') d = r.range(0.2, 0.7);
    if (Math.abs(opp.y) < 6.5 && shot !== 'lob') {
      // passing shot: wide and dipping
      x = (r.chance(0.5) ? 1 : -1) * r.range(0.7, 1);
      d = r.range(-0.6, 0.1);
    }
    return { x: Math.max(-1.05, Math.min(1.05, x)), d };
  }

  // ---------------- serving ----------------
  /**
   * (M21) The COM serves like a player: it tosses, holds the buttons for the serve it wants through
   * the toss (contact is automatic) and sweeps the aim toward its target.
   */
  serveUpdate(m: Match, p: Player): { toss: boolean; aimX: number; buttons: { b1: boolean; b2: boolean; fwd: number } } {
    const res = { toss: false, aimX: this.serveAim, buttons: this.serveButtons };
    if (p.serve.phase === 'ready') {
      if (this.serveWait <= 0) this.serveWait = 40 + Math.floor(m.rng.next() * 35);
      this.serveWait--;
      if (this.serveWait === 0) {
        res.toss = true;
        const second = m.serveFaults > 0;
        const base = this.eff.serve;
        const sw = second ? { flat: base.flat * 0.15, kick: base.kick * 2.5 + 1, slice: base.slice } : base;
        const tot = sw.flat + sw.kick + sw.slice;
        let rr = m.rng.next() * tot;
        this.serveType = (rr -= sw.flat) <= 0 ? 'flat' : (rr -= sw.kick) <= 0 ? 'kick' : 'slice';
        // force: big servers go Strong on first serves; second serves are Normal or Safe
        const flatShare = base.flat / Math.max(0.01, base.flat + base.kick + base.slice);
        const strongP = second ? 0.04 : Math.min(0.9, 0.3 + flatShare * 0.7 + (this.tactic === 'serve1' ? 0.15 : 0));
        const safeP = second ? (this.eff.aggression < 0.45 ? 0.6 : 0.4) : 0.03;
        const r2 = m.rng.next();
        const force: ServeForce = r2 < strongP ? 'strong' : r2 < strongP + safeP ? 'safe' : 'normal';
        const fwd = this.serveType === 'slice' ? 1 : this.serveType === 'kick' ? -1 : 0;
        this.serveButtons = { b1: force !== 'safe', b2: force !== 'normal', fwd };
        // direction: -1 wide, 0 body, 1 T  -> serve aimX (toward the box's outside or the centre line)
        const v = m.rng.pick(this.eff.serveAim);
        const s = Math.sign(p.x) || 1;
        this.serveAim = (v === 0 ? m.rng.range(-0.3, 0.3) : (v < 0 ? -s : s) * m.rng.range(0.55, 0.95)) * (second ? 0.7 : 1);
        res.aimX = this.serveAim;
        res.buttons = this.serveButtons;
      }
    }
    return res;
  }
  serveButtons = { b1: true, b2: false, fwd: 0 };

  reset(): void {
    this.firstStrike = false;
    this.plan = null;
    this.planFor = -1;
    this.serveWait = 0;
    this.rushing = false;
  }
}
