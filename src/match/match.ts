import { Rng } from '../core/rng';
import { Controller } from '../core/input';
import { Difficulty } from '../core/settings';
import { BallState, stepBall, cloneBall, predictFirstBounce } from './ball';
import { Player } from './player';
import { AI, DIFF_NOISE } from './ai';
import { Score, MatchFormat, ScoreEvent } from './scoring';
import { makeShot, makeServe, solveShot, Grade, planStrike, ShotInput, serveTarget, serveZone } from './shots';
import { Surface, SURFACES, SurfaceId } from '../data/surfaces';
import { PlayerSetup, ShotType, ServeType, Stats, STAT_KEYS } from '../data/types';
import { HALF_LEN, HALF_W, SERVICE_Y, BALL_R } from '../data/court';
import { T } from '../data/tuning';
import { TacticId, normalize, ARCHETYPE_BLEND } from '../data/tactics';
import type { Venue } from '../data/venues';
import {
  STRIKES, StrikeId, ServeForce, ControlMode, strikeFrom, serveFrom, aimRate, stepAim, dangerOf, dangerClass, centreOf, Zone,
  SHOULDER_STYLE, JUMP_STYLE,
} from './strike';
import type { GestureKind } from './player';

/** (M21) how human players' strikes behave */
export interface ControlOpts {
  mode: ControlMode;
  autoPos: 'slow' | 'average' | 'fast';
}

/** the incoming ball's path after its bounce, for auto-positioning and the danger-zone HUD */
export interface BallRead {
  /** after-bounce samples on the receiver's side: position, height, vertical speed, danger 0..1 */
  samples: { x: number; y: number; z: number; vz: number; d: number; f: number }[];
  /** the two green spots (forehand side, backhand side) where the player should stand */
  spots: { x: number; y: number; fh: boolean }[];
  /** auto-positioning target */
  pick: { x: number; y: number } | null;
  volley: boolean;
  at: number;
  forShot: number;
}

export interface MatchConfig {
  surface: SurfaceId;
  format: MatchFormat;
  players: [PlayerSetup, PlayerSetup];
  controllers: [Controller | null, Controller | null];
  difficulty: Difficulty;
  firstServer?: 0 | 1;
  seed?: number;
  /** practice: ball machine feeds to player 0, no scoring */
  practice?: PracticeFeed | null;
  /** stadium look (cosmetic): theme, tier, how far into the event */
  venue?: Venue;
  /** human strike settings (default Arcade + fast auto-positioning) */
  controls?: ControlOpts;
}

export interface PracticeFeed {
  type: ShotType | 'random';
  side: 'fh' | 'bh' | 'mix';
  speed: number; // 0.6..1.3
  interval: number; // frames between feeds
  serve?: boolean; // serve practice instead of feeding
  /** landing distance from the net in metres [min, max] (default: deep, 8-10.6) */
  depth?: [number, number];
  /** feed to the sideline instead of near the player (stretch / defence drills) */
  wide?: boolean;
}

export type MatchEvent =
  | {
    t: 'hit'; p: 0 | 1; grade: Grade; reason: string; shot: ShotType; strike: StrikeId; volley: boolean; overhead: boolean; pace: number; dive: boolean; fh: boolean; cy: number; tx: number;
    prep: number; danger: Zone; centre: Zone; zone: number; accelOver: number;
  }
  | { t: 'whiff'; p: 0 | 1; reason: string }
  | { t: 'serve'; p: 0 | 1; kmh: number; grade: Grade; type: ServeType; force: ServeForce }
  | { t: 'gesture'; p: 0 | 1; kind: GestureKind }
  | { t: 'toss'; p: 0 | 1 }
  | { t: 'bounce'; x: number; y: number; speed: number }
  | { t: 'net' }
  | { t: 'netcord' }
  | { t: 'call'; text: string; kind: 'out' | 'fault' | 'let' | 'net' | 'info' | 'score' }
  | { t: 'point'; winner: 0 | 1; how: string; rally: number }
  | { t: 'score'; events: ScoreEvent[]; winner: 0 | 1 }
  | { t: 'changeover'; set: boolean }
  | { t: 'over'; winner: 0 | 1 }
  | { t: 'step'; p: 0 | 1; slide: boolean }
  | { t: 'feed' }
  | { t: 'plan'; p: 0 | 1; tactic: TacticId }
  | { t: 'adapt'; p: 0 | 1; tactic: TacticId };

export type Phase = 'intro' | 'serve' | 'rally' | 'dead' | 'changeover' | 'over';

const DIFF_STAT: Record<Difficulty, number> = { easy: -16, normal: -5, hard: 3, pro: 9 };

export class Match {
  sf: Surface;
  score: Score;
  players: [Player, Player];
  ais: [AI | null, AI | null];
  ball: BallState = { x: 0, y: 0, z: -5, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
  ballLive = false;
  ballVisible = false;
  phase: Phase = 'intro';
  phaseT = 0;
  frame = 0;
  rng: Rng;
  events: MatchEvent[] = [];
  serveFaults = 0;
  rally = { lastHitter: -1 as -1 | 0 | 1, bounces: 0, shotCount: 0, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0, bounceVz: 0 };
  controls: ControlOpts;
  /** cached reads of the incoming ball per player */
  reads: [BallRead | null, BallRead | null] = [null, null];
  /** (M21) centring icon after a human's error: shows how the missed ball was struck */
  missIcon: { p: 0 | 1; zone: Zone; body: boolean; t: number } | null = null;
  predicted: { x: number; y: number } | null = null;
  /** trail of recent ball positions for rendering */
  trail: { x: number; y: number; z: number }[] = [];
  trailOn = 0;
  hitstop = 0;
  lastServeKmh = 0;
  practice: PracticeFeed | null;
  practiceFeedT = 0;
  practiceStreak = 0;
  practiceBest = 0;
  practiceHits = 0;
  pendingResult: { winner: 0 | 1; how: string } | null = null;
  crowdExcite = 0;
  bigPoint = false;
  aimHint: [{ x: number; d: number }, { x: number; d: number }] = [{ x: 0, d: 0 }, { x: 0, d: 0 }];

  constructor(public cfg: MatchConfig) {
    this.sf = SURFACES[cfg.surface];
    this.controls = cfg.controls ?? { mode: 'arcade', autoPos: 'fast' };
    this.rng = new Rng(cfg.seed ?? 1234);
    this.practice = cfg.practice ?? null;
    this.score = new Score(cfg.format, cfg.firstServer ?? 0);
    const mk = (i: 0 | 1) => {
      const setup = cfg.players[i];
      const st: Stats = { ...setup.stats };
      if (!cfg.controllers[i]) for (const k of STAT_KEYS) st[k] = Math.max(15, Math.min(99, st[k] + DIFF_STAT[cfg.difficulty]));
      const p = new Player(i, setup, st, cfg.controllers[i]);
      p.side = i;
      return p;
    };
    this.players = [mk(0), mk(1)];
    const mkAi = (i: 0 | 1) => {
      if (cfg.controllers[i]) return null;
      const s = cfg.players[i];
      return new AI(DIFF_NOISE[cfg.difficulty], normalize(s.tactics ?? ARCHETYPE_BLEND[s.archetype]), s.archetype, !!s.tacticsFixed);
    };
    this.ais = [mkAi(0), mkAi(1)];
    this.setupPoint(true);
    this.phase = this.practice ? (this.practice.serve ? 'serve' : 'rally') : 'intro';
  }

  /** switch practice between ball machine feeding and serve practice */
  setPractice(feed: PracticeFeed): void {
    this.practice = feed;
    this.serveFaults = 0;
    this.setupPoint(true);
    this.practiceFeedT = 40;
    this.setPhase(feed.serve ? 'serve' : 'rally');
  }
  practiceServes = 0;
  practiceResetT = 0;

  emit(e: MatchEvent): void {
    this.events.push(e);
    if (this.events.length > 200) this.events.shift();
  }

  get server(): Player {
    return this.players[this.score.server];
  }
  get receiver(): Player {
    return this.players[1 - this.score.server];
  }

  /** positions players for the next point */
  setupPoint(snap: boolean): void {
    const s = this.server;
    const r = this.receiver;
    const deuce = this.practice?.serve ? this.practiceServes % 2 === 0 : this.score.deuceCourt;
    // near player's right is +x; far player's right is -x
    const sx = (s.side === 0 ? 1 : -1) * (deuce ? 1 : -1) * 0.9;
    const sPos = { x: sx, y: s.side === 0 ? -HALF_LEN - 0.25 : HALF_LEN + 0.25 };
    const rPos = { x: -Math.sign(sx) * 2.5, y: r.side === 0 ? -HALF_LEN - 1.0 : HALF_LEN + 1.0 };
    if (this.practice && !this.practice.serve) {
      sPos.x = 0;
      sPos.y = -HALF_LEN - 0.6;
    }
    for (const [p, pos] of [[s, sPos], [r, rPos]] as const) {
      if (snap) {
        p.x = pos.x;
        p.y = pos.y;
        p.autoWalk = null;
      } else p.autoWalk = { ...pos };
      p.vx = p.vy = 0;
      p.swing = null;
      p.recover = 0;
      p.lock = 'none';
      p.serve = { phase: 'ready', t: 0, tossApex: 34, type: 'flat' };
      p.strike.since = this.frame;
      p.strike.aim = 0;
      p.accelUsed = 0;
      p.smoke = 0;
      p.autoT = null;
      p.gesture = null;
    }
    this.reads = [null, null];
    this.ais.forEach((a) => a?.reset());
    this.ballLive = false;
    this.ballVisible = false;
    this.rally = { lastHitter: -1, bounces: 0, shotCount: 0, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0, bounceVz: 0 };
    this.predicted = null;
    this.trail.length = 0;
    this.bigPoint = this.score.isBigPoint();
    // each COM picks its game plan for the new point (not for a second serve)
    if (!this.practice && this.serveFaults === 0) {
      this.ais.forEach((a, i) => {
        if (!a) return;
        const t = a.newPoint(this, this.players[i]);
        this.emit({ t: 'plan', p: i as 0 | 1, tactic: t });
      });
    }
  }

  // =============================== update ===============================
  update(): void {
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    this.frame++;
    this.phaseT++;
    this.crowdExcite = Math.max(0, this.crowdExcite - 1 / 150);
    for (const p of this.players) {
      p.animT++;
      if (p.recover > 0) p.recover--;
      if (p.celebrate > 0) p.celebrate--;
      if (p.splitStep > 0) p.splitStep--;
      if (p.smoke > 0) p.smoke--;
      if (p.gesture) p.gesture.t++;
      p.sweat = p.staminaF() < 0.35 ? 1 : 0;
    }
    if (this.missIcon && ++this.missIcon.t > 150) this.missIcon = null;
    this.updateGestures();
    this.trySkipDowntime();
    switch (this.phase) {
      case 'intro':
        this.ballVisible = false;
        if (this.phaseT > 30) this.setPhase('serve');
        break;
      case 'serve':
        this.updateServe();
        break;
      case 'rally':
        this.updateRally();
        break;
      case 'dead':
        this.updateDead();
        break;
      case 'changeover':
        this.walkPlayers();
        if (this.phaseT > 120) {
          this.setupPoint(false);
          this.setPhase('serve');
        }
        break;
      case 'over':
        this.walkPlayers(true);
        break;
    }
    if (this.ballVisible) {
      this.trail.push({ x: this.ball.x, y: this.ball.y, z: this.ball.z });
      if (this.trail.length > 12) this.trail.shift();
    }
    if (this.trailOn > 0) this.trailOn--;
  }

  setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** frame until which a human serve toss is ignored (the skip press must not also toss) */
  private skipLockUntil = 0;
  skips = 0;

  /**
   * Between points a human can press the shot button to skip the dead time and the walk
   * back to position: the point is scored at once and both players snap to their spots.
   */
  get canSkipDowntime(): boolean {
    if (this.practice || !this.players.some((p) => p.ctrl)) return false;
    return (
      (this.phase === 'dead' && this.phaseT >= T.skipMinDeadFrames) ||
      this.phase === 'changeover' ||
      (this.phase === 'serve' && this.players.some((p) => p.autoWalk))
    );
  }

  private trySkipDowntime(): void {
    if (!this.canSkipDowntime) return;
    if (!this.players.some((p) => p.ctrl?.strikePressed())) return;
    if (this.phase === 'dead') {
      this.phaseT = Math.max(this.phaseT, this.deadAction === 'point' ? 80 : 55);
      this.updateDead();
    }
    if (this.phase === 'changeover') this.setPhase('serve');
    if (this.phase !== 'serve') return;
    for (const p of this.players) {
      if (p.autoWalk) {
        p.x = p.autoWalk.x;
        p.y = p.autoWalk.y;
        p.autoWalk = null;
      }
      p.vx = p.vy = 0;
      p.swing = null;
    }
    this.phaseT = 1;
    this.skipLockUntil = this.frame + T.skipTossLock;
    this.skips++;
  }

  private walkPlayers(celebrating = false): void {
    for (const p of this.players) {
      if (p.autoWalk) {
        const dx = p.autoWalk.x - p.x;
        const dy = p.autoWalk.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.05) {
          p.autoWalk = null;
          p.vx = p.vy = 0;
        } else {
          const sp = Math.min(3.2, d * 3);
          p.vx = (dx / d) * sp;
          p.vy = (dy / d) * sp;
          p.x += p.vx / 60;
          p.y += p.vy / 60;
          p.runPhase += sp * 0.04;
        }
      } else {
        p.vx *= 0.8;
        p.vy *= 0.8;
      }
      if (!celebrating && p.swing && this.frame - p.swing.start > 40) p.swing = null;
    }
  }

  // ---------------------------------------------------------- serve phase
  /**
   * (M21) Press a strike button to toss and keep holding it: contact is automatic at the top of the
   * toss. What is held at contact picks the serve (B1 Normal, B2 Safe, both Strong; â†‘ slice, â†“ kick),
   * and left/right sweeps the aim. Releasing just before contact still serves (with what was held
   * last) and leaves the server free to run in at once.
   */
  private updateServe(): void {
    const s = this.server;
    const r = this.receiver;
    this.walkPlayers();
    if (s.autoWalk || r.autoWalk) {
      if (this.phaseT < 240) return;
      s.autoWalk = r.autoWalk = null;
    }
    const sv = s.serve;
    sv.t++;
    // receiver can shuffle (or hold a button to auto-position as soon as the serve is struck)
    this.controlReceiverPreServe(r);
    let toss = false;
    let mx = 0;
    const ai = this.ais[s.idx];
    let holding = false;
    let aimTarget = 0;
    let b1 = false, b2 = false, fwd = 0;
    if (ai) {
      const a = ai.serveUpdate(this, s);
      toss = a.toss;
      if (sv.phase === 'toss' || toss) {
        holding = true;
        ({ b1, b2, fwd } = a.buttons);
        aimTarget = a.aimX;
      }
    } else if (s.ctrl) {
      const c = s.ctrl;
      const ax = c.axis();
      const bt = c.strikeButtons();
      b1 = bt.b1;
      b2 = bt.b2;
      holding = b1 || b2;
      fwd = Math.abs(ax.y) > 0.4 ? Math.sign(-ax.y * s.dir) : 0;
      aimTarget = ax.x > 0.3 ? T.aimMax : ax.x < -0.3 ? -T.aimMax : 0;
      if (!holding) mx = ax.x;
      if (this.frame < this.skipLockUntil) {
        // the skip press must not also start the toss
      } else if (sv.phase === 'ready' && c.strikePressed()) toss = true;
    }
    if (sv.phase === 'ready') {
      // small sideways adjustment along the baseline
      if (mx !== 0) {
        const base = (s.side === 0 ? 1 : -1) * (this.score.deuceCourt ? 1 : -1);
        s.x = base > 0 ? Math.max(0.3, Math.min(3.0, s.x + mx * 0.04)) : Math.min(-0.3, Math.max(-3.0, s.x + mx * 0.04));
      }
      this.ballVisible = true;
      this.placeBallInHand(s);
      if (toss) {
        sv.phase = 'toss';
        sv.t = 0;
        sv.held = 0;
        sv.b1 = b1 || !b2;
        sv.b2 = b2;
        sv.fwd = fwd;
        sv.free = false;
        s.strike.aim = 0;
        s.anim = 'serve';
        s.animT = 0;
        const hand = this.tossHand(s);
        this.ball = { x: hand.x, y: hand.y, z: T.tossZ0, vx: 0, vy: 0, vz: T.tossVz, spin: 0, side: 0 };
        sv.tossApex = Math.round((T.tossVz / 9.81) * 60);
        this.emit({ t: 'toss', p: s.idx });
      }
    } else if (sv.phase === 'toss') {
      // latch what is held; sweep the aim
      if (holding && !s.strike.held) s.strike.since = this.frame;
      s.strike.held = holding;
      if (holding) {
        sv.b1 = b1;
        sv.b2 = b2;
        sv.fwd = fwd;
        sv.held = (sv.held ?? 0) + 1;
      }
      s.strike.aim = stepAim(s.strike.aim, aimTarget, 1 / T.serveAimSweep);
      // toss flight (vertical only)
      this.ball.vz -= 9.81 / 60;
      this.ball.z += this.ball.vz / 60;
      if (sv.t >= sv.tossApex) {
        const pick = serveFrom(!!sv.b1, !!sv.b2, sv.fwd ?? 0);
        sv.free = !holding && !ai;
        this.hitServe(s, pick.spin, pick.force, s.strike.aim, (sv.held ?? 0) / 60);
        return;
      }
    }
  }

  private controlReceiverPreServe(r: Player): void {
    if (r.ctrl) {
      const bt = r.ctrl.strikeButtons();
      // holding a strike button before the serve: wait, auto-positioning starts when it is struck
      if (bt.b1 || bt.b2) {
        r.move(0, 0, this.sf, false);
        return;
      }
      const ax = r.ctrl.axis();
      r.move(ax.x * 0.6, ax.y * 0.4, this.sf, false);
    }
  }

  private tossHand(s: Player): { x: number; y: number } {
    const right = s.side === 0 ? 1 : -1;
    const hs = s.setup.hand === 'R' ? 1 : -1;
    return { x: s.x + right * hs * 0.18, y: s.y + s.dir * 0.35 };
  }

  private placeBallInHand(s: Player): void {
    const h = this.tossHand(s);
    this.ball = { x: h.x - (s.side === 0 ? 1 : -1) * 0.25, y: h.y - s.dir * 0.2, z: 1.0, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
  }

  /** where a serve is aimed and how big its zone is, for the HUD preview */
  servePreview(s: Player): { tx: number; ty: number; r: number } | null {
    const sv = s.serve;
    if (sv.phase !== 'toss') return null;
    const pick = serveFrom(!!sv.b1, !!sv.b2, sv.fwd ?? 0);
    const t = serveTarget(s.x, s.strike.aim, pick.spin, pick.force, s.dir);
    return { tx: t.tx, ty: t.ty, r: serveZone(s.stats.serve, pick.force, this.serveFaults > 0, (sv.held ?? 0) / 60 + Math.max(0, sv.tossApex - sv.t) / 60) };
  }

  private hitServe(s: Player, type: ServeType, force: ServeForce, aimX: number, prep: number): void {
    const sv = s.serve;
    sv.phase = 'hit';
    sv.t = 0;
    sv.type = type;
    s.animT = 0;
    const from = cloneBall(this.ball);
    const second = this.serveFaults > 0;
    const res = makeServe({
      from, dir: s.dir, serverX: s.x, aimX, type, force, prep, stats: s.stats, stamina: s.stamina,
      badges: s.setup.badges, second, rng: this.rng,
    }, this.sf);
    this.ball = res.ball;
    this.ballLive = true;
    this.lastServeKmh = res.speed;
    this.serveX = s.x;
    this.serveNetcord = false;
    this.rally.lastHitter = s.idx;
    this.rally.isServe = true;
    this.rally.bounces = 0;
    this.rally.shotCount++;
    // a strong second serve is as tiring as an acceleration
    s.drain(T.shotDrain * (force === 'strong' ? 1.3 : 1) + (force === 'strong' && second ? T.accelPowerDrain : 0));
    const grade: Grade = force === 'strong' ? 'PERFECT' : force === 'safe' ? 'SAFE' : 'GOOD';
    if (force === 'strong') this.trailOn = 50;
    this.predicted = (() => {
      const f = predictFirstBounce(this.ball, this.sf);
      return { x: f.bx, y: f.by };
    })();
    s.strike.aim = 0;
    s.strike.since = this.frame;
    this.emit({ t: 'serve', p: s.idx, kmh: res.speed, grade, type, force });
    this.ais[s.idx]?.onServeHit(this, s);
    const r = this.receiver;
    r.splitStep = 12;
    r.strike.since = Math.max(r.strike.since, this.frame - 30); // a return can't be "prepared" for longer than the read
    this.setPhase('rally');
  }

  // ---------------------------------------------------------- rally phase
  private updateRally(): void {
    if (this.practice) this.updatePractice();
    // players
    for (const p of this.players) this.updatePlayer(p);
    // ball
    if (this.ballLive || this.ballVisible) this.updateBall();
  }

  /**
   * (M21) One frame of a player. No strike button: run freely. Holding one: auto-position toward the
   * ideal spot while left/right sweeps the aim and up/down picks the strike. The swing starts on its
   * own when the ball is a windup away, and contact happens whatever is held (nothing = safe strike).
   */
  private updatePlayer(p: Player): void {
    let mx = 0;
    let my = 0;
    let b1 = false, b2 = false, fwd = 0;
    let aimTarget = 0;
    const ai = this.ais[p.idx];
    if (p.serve.phase === 'hit' && p.serve.t < 30) {
      p.serve.t++;
    }
    if (this.practice && p.idx === 1) {
      // ball machine side: nobody
      return;
    }
    if (ai) {
      const o = ai.update(this, p);
      mx = o.mx;
      my = o.my;
      if (o.hold) ({ b1, b2, fwd } = o.hold);
      aimTarget = o.aimX;
      p.swingPower = o.power;
    } else if (p.ctrl) {
      const ax = p.ctrl.axis();
      mx = ax.x;
      my = ax.y;
      ({ b1, b2 } = p.ctrl.strikeButtons());
      fwd = Math.abs(ax.y) > 0.4 ? Math.sign(-ax.y * p.dir) : 0;
      aimTarget = ax.x > 0.3 ? T.aimMax : ax.x < -0.3 ? -T.aimMax : 0;
      p.swingPower = 1;
    }
    const holding = b1 || b2;
    // strike state: preparation counts from the press; the aim sweeps while held, drifts back when released
    const st = p.strike;
    if (holding && !st.held) st.since = this.frame;
    st.held = holding;
    if (holding) {
      st.b1 = b1;
      st.b2 = b2;
      st.fwd = fwd;
    }
    const rate = aimRate(Math.abs(p.y));
    st.aim = stepAim(st.aim, ai ? aimTarget : holding ? aimTarget : 0, rate);

    const swinging = !!p.swing && !p.swing.done;
    const wasLocked = p.lock !== 'none';
    const locked = this.strokeLocked(p);
    if (locked && !wasLocked) {
      // the swing animation starts: plant, or slide through it if we were running
      const sp = Math.hypot(p.vx, p.vy);
      if (sp >= T.slideMinSpeed && !(p.serve.phase === 'hit' && p.serve.t < T.serveLock)) {
        p.lock = 'slide';
        p.slideDir = Math.sign(p.vx) || 0;
        p.slideT = 20;
        this.emit({ t: 'step', p: p.idx, slide: true });
      } else p.lock = 'plant';
    } else if (!locked) p.lock = 'none';
    if (p.lock === 'slide') p.brake(T.slideDecel * this.sf.grip * (this.sf.slides ? 0.75 : 1));
    else if (p.lock === 'plant') p.brake(T.plantDecel * this.sf.grip);
    else if (holding) {
      this.autoPosition(p, ai ? T.aiAutoPos : T.autoPosSpeed[this.controls.autoPos]);
      mx = 0;
    } else {
      p.autoT = null;
      p.move(mx, my, this.sf, swinging);
    }
    if (p.stepAcc > 0.9) {
      p.stepAcc = 0;
      this.emit({ t: 'step', p: p.idx, slide: false });
    }
    // clay slide when changing direction fast
    if (this.sf.slides && !holding && Math.hypot(p.vx, p.vy) > 4 && (Math.sign(mx) !== Math.sign(p.vx) || mx === 0)) {
      if (p.slideT <= 0) this.emit({ t: 'step', p: p.idx, slide: true });
      p.slideT = 20;
    }
    if (p.slideT > 0) p.slideT--;
    // swing handling: automatic
    if (!p.swing && p.recover <= 0) this.maybeStartSwing(p);
    if (p.swing && !p.swing.done && this.frame >= p.swing.contactAt) this.resolveContact(p, !!ai);
    if (p.swing && p.swing.done && this.frame - p.swing.contactAt > T.swingRecover) p.swing = null;
    // animation state
    if (!p.swing) p.anim = Math.hypot(p.vx, p.vy) > 0.6 ? 'run' : p.staminaF() < 0.2 ? 'slump' : 'idle';
  }

  /**
   * Stroke commitment (M20): no steering from the first frame of the swing animation until the
   * follow-through is done, and briefly after the serve (unless the button was released before it).
   */
  strokeLocked(p: Player): boolean {
    if (p.serve.phase === 'hit' && p.serve.t < T.serveLock && !p.serve.free) return true;
    const sw = p.swing;
    return !!sw && this.frame >= sw.start && this.frame <= sw.contactAt + T.followLock;
  }

  incomingFor(p: Player): boolean {
    return this.ballLive && !this.rally.dead && this.rally.lastHitter !== p.idx && this.rally.lastHitter !== -1;
  }

  /** frames until the ball crosses the player's contact plane (negative if already passed), or null */
  predictArrival(p: Player, maxFrames = 100): { f: number; x: number; z: number; vol: boolean } | null {
    if (!this.incomingFor(p)) return null;
    const plane = p.y + p.dir * T.contactAhead;
    const b = cloneBall(this.ball);
    let bounces = this.rally.bounces;
    const mustBounce = this.rally.isServe;
    // already past?
    const ahead = (b.y - plane) * p.dir; // >0 => ball still in front
    if (ahead <= 0) {
      const vy = Math.abs(b.vy) || 1;
      const fBack = -(Math.abs(b.y - plane) / vy) * 60;
      if (mustBounce && bounces === 0) return null;
      return { f: fBack, x: b.x, z: b.z, vol: bounces === 0 };
    }
    for (let f = 1; f <= maxFrames; f++) {
      const ev = stepBall(b, this.sf);
      if (ev === 'net') return null;
      if (ev === 'bounce') bounces++;
      if (bounces >= 2) return null;
      if ((b.y - plane) * p.dir <= 0) {
        if (mustBounce && bounces === 0) return null;
        return { f, x: b.x, z: b.z, vol: bounces === 0 };
      }
    }
    return null;
  }

  /**
   * (M21) Read the incoming ball for a player: its path after the bounce with the danger zone along it,
   * and the two green spots (forehand / backhand) where contact comes at the top of the bounce at a
   * comfortable height. Cached for a few frames.
   */
  readBall(p: Player): BallRead | null {
    if (!this.incomingFor(p)) return null;
    const c = this.reads[p.idx];
    if (c && c.forShot === this.rally.shotCount && this.frame - c.at < 4) return c;
    const dir = p.dir;
    const b = cloneBall(this.ball);
    let bounces = this.rally.bounces;
    let vz0 = bounces >= 1 ? this.rally.bounceVz : 0;
    const samples: BallRead['samples'] = [];
    const canVolley = !this.rally.isServe && bounces === 0 && Math.abs(p.y) < T.volleyZoneY;
    const plane = p.y + dir * T.contactAhead;
    let volleyAt: { x: number; y: number; z: number } | null = null;
    if (bounces === 1) samples.push({ x: b.x, y: b.y, z: b.z, vz: b.vz, d: dangerOf(b.vz, vz0, Math.hypot(b.vx, b.vy)), f: 0 });
    for (let f = 1; f <= 160; f++) {
      const ev = stepBall(b, this.sf);
      if (ev === 'net') break;
      if (ev === 'bounce') {
        bounces++;
        if (bounces === 1) vz0 = b.vz;
      }
      if (bounces >= 2) break;
      if (b.y * dir > -0.3) continue;
      if (canVolley && bounces === 0 && !volleyAt && (b.y - plane) * dir <= 0 && b.z > 0.3 && b.z < 2.6) volleyAt = { x: b.x, y: b.y, z: b.z };
      if (bounces === 1 && f % 2 === 0) samples.push({ x: b.x, y: b.y, z: b.z, vz: b.vz, d: dangerOf(b.vz, vz0, Math.hypot(b.vx, b.vy)), f });
    }
    // the green point: first sample past the danger at a comfortable height
    let g = samples.find((s) => s.d <= T.dangerOrange && s.z >= 0.45 && s.z <= 1.75) ?? null;
    if (!g) {
      const calm = samples.filter((s) => s.d <= T.dangerOrange);
      g = calm.length ? calm.reduce((a, s) => (Math.abs(s.z - 1) < Math.abs(a.z - 1) ? s : a)) : samples[samples.length - 1] ?? null;
    }
    const fs = (p.side === 0 ? 1 : -1) * (p.setup.hand === 'R' ? 1 : -1);
    const lFh = T.idealLat1H;
    const lBh = p.setup.twoHanded ? T.idealLat2H : T.idealLat1H;
    const spots: BallRead['spots'] = [];
    const at = volleyAt ?? g;
    if (at) {
      const y = volleyAt ? p.y : at.y - dir * T.contactAhead;
      const clampX = (x: number) => Math.max(-7.6, Math.min(7.6, x));
      spots.push({ x: clampX(at.x - fs * lFh), y, fh: true }, { x: clampX(at.x + fs * lBh), y, fh: false });
    }
    let pick: { x: number; y: number } | null = null;
    if (spots.length) {
      const d0 = Math.hypot(spots[0].x - p.x, spots[0].y - p.y);
      const d1 = Math.hypot(spots[1].x - p.x, spots[1].y - p.y);
      pick = d0 <= d1 + 0.15 ? spots[0] : spots[1];
    }
    const r: BallRead = { samples, spots, pick, volley: !!volleyAt, at: this.frame, forShot: this.rally.shotCount };
    this.reads[p.idx] = r;
    return r;
  }

  /** holding a strike button: walk to the ideal spot at the auto-positioning speed */
  private autoPosition(p: Player, speed: number): void {
    const ai = this.ais[p.idx];
    let tgt: { x: number; y: number } | null = null;
    if (ai?.plan) tgt = { x: ai.plan.tx, y: ai.plan.ty };
    else tgt = this.readBall(p)?.pick ?? null;
    p.autoT = tgt;
    if (!tgt) {
      p.move(0, 0, this.sf, false);
      return;
    }
    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.03) {
      p.move(0, 0, this.sf, false);
      return;
    }
    const v = Math.min(speed, d * 5);
    const k = v / Math.max(0.1, p.maxSpeed(this.sf));
    p.move((dx / d) * k, (-dy / d) * k, this.sf, false);
  }

  /** the swing starts on its own a windup before the ball reaches the contact plane */
  private maybeStartSwing(p: Player): void {
    if (!this.incomingFor(p)) return;
    const arr = this.predictArrival(p, T.windup + 2);
    if (!arr || arr.f > T.windup || arr.f < 0) return;
    // nothing held: groundstrokes still come back (safe strike) but a ball in the air is left alone
    if (arr.vol && !p.strike.held) return;
    const lat = Math.abs(arr.x - p.x);
    if (lat > T.stretchReach * T.diveReachMul * 1.15 + 0.3) return; // hopeless: let it go
    const st = p.strike;
    const id: StrikeId = st.held ? strikeFrom(st.b1, st.b2, st.fwd) : 'safe';
    const fh = p.isForehand(arr.x);
    p.facingFh = fh;
    p.anim = 'swing';
    p.animT = 0;
    const contactAt = this.frame + Math.max(1, Math.round(arr.f));
    p.swing = {
      type: STRIKES[id].shot, strike: id, start: contactAt - T.windup, contactAt, grade: null, offset: 0, whiff: false, whiffReason: '', done: false, fh,
      kind: arr.vol ? (arr.z > T.overheadZ ? 'overhead' : 'volley') : 'ground', reach: 0,
    };
  }

  /** maximum lateral reach right now (a held button lets you stretch, and jump for volleys at the net) */
  private maxReach(p: Player, volley: boolean, held: boolean): number {
    const wall = p.setup.badges.includes('wall') ? 1.08 : 1;
    const netMag = volley && p.setup.badges.includes('netMagnet') ? 1.1 : 1;
    let r = T.stretchReach * wall * netMag;
    if (!held) r = Math.min(r, T.reach + T.safeReach);
    else if (volley && Math.abs(p.y) < T.volleyZoneY) r *= T.diveReachMul * JUMP_STYLE[p.setup.archetype];
    return r;
  }

  /** the ShotInput this player would strike with if the ball were met now (HUD preview and contact) */
  private shotInput(p: Player, isAi: boolean, contact: { x: number; y: number; z: number; vx: number; vy: number; vz: number }, volley: boolean, overhead: boolean, maxReach: number): ShotInput {
    const st = p.strike;
    const id: StrikeId = st.held ? strikeFrom(st.b1, st.b2, st.fwd) : 'safe';
    const lat = Math.abs(contact.x - p.x);
    const fh = p.isForehand(contact.x);
    const ideal = fh || !p.setup.twoHanded ? T.idealLat1H : T.idealLat2H;
    const cen = centreOf(lat, ideal, maxReach);
    const danger = !volley && this.rally.bounces >= 1 ? dangerOf(contact.vz, this.rally.bounceVz, Math.hypot(contact.vx, contact.vy)) : 0;
    const backpedal = volley ? Math.max(0, Math.min(1, (-p.vy * p.dir) / Math.max(1, p.maxSpeed(this.sf) * T.backpedalMul))) : 0;
    return {
      strike: id, from: { ...this.ball, x: contact.x, y: contact.y, z: contact.z }, dir: p.dir, aimX: st.aim, prep: st.held ? (this.frame - st.since) / 60 : 0,
      mode: isAi ? 'sim' : this.controls.mode, danger, centre: cen.c, body: cen.body, stats: p.stats, stamina: p.stamina,
      speedRatio: p.speedRatio(this.sf), runVx: p.vx, stretch: Math.max(0, (lat - T.reach) / Math.max(0.1, maxReach - T.reach)), contactZ: contact.z, contactY: contact.y,
      ballVz: contact.vz, inSpeed: Math.hypot(contact.vx, contact.vy, contact.vz), lateral: lat, fh, twoHanded: p.setup.twoHanded, volley, overhead,
      isReturn: this.rally.isServe, badges: p.setup.badges, rng: this.rng, power: p.swingPower, backpedal,
      accelOver: STRIKES[id].accel ? Math.max(0, p.accelUsed + 1 - p.accelQuota) : 0, shoulderStyle: SHOULDER_STYLE[p.setup.archetype],
      clutch: this.bigPoint && p.setup.badges.includes('clutch'),
    };
  }

  /**
   * (M21) HUD: where the held strike is aimed and how big its zone is right now, assuming contact
   * at the auto-positioning spot.
   */
  strikePreview(p: Player): { tx: number; ty: number; r: number } | null {
    if (!p.strike.held || !this.incomingFor(p)) return null;
    const rd = this.readBall(p);
    const g = rd?.samples.find((s) => s.d <= T.dangerOrange) ?? null;
    const cz = g ? { x: g.x, y: g.y, z: g.z, vx: this.ball.vx, vy: this.ball.vy, vz: g.vz } : { x: p.x, y: p.y + p.dir * T.contactAhead, z: 1, vx: this.ball.vx, vy: this.ball.vy, vz: 0 };
    const volley = !!rd?.volley;
    const inp = this.shotInput(p, !p.human, cz, volley, false, this.maxReach(p, volley, true));
    inp.centre = 0;
    inp.body = false;
    inp.speedRatio = 0;
    const pl = planStrike(inp);
    return { tx: pl.tx, ty: p.dir * pl.depth, r: pl.zone };
  }

  private resolveContact(p: Player, isAi: boolean): void {
    const sw = p.swing!;
    sw.done = true;
    const st = p.strike;
    const b = this.ball;
    const plane = p.y + p.dir * T.contactAhead;
    const dx = b.x - p.x;
    const dy = Math.abs(b.y - plane);
    const lat = Math.abs(dx);
    const volley = this.rally.bounces === 0;
    const maxReach = this.maxReach(p, volley, st.held);
    const inZ = b.z >= T.minContactZ && b.z <= T.maxContactZ + (sw.kind === 'overhead' ? 0.3 : 0);
    // a late contact can still frame a ball that passed the contact plane up to ~0.1 s ago
    const passTol = Math.max(1.4, Math.abs(b.vy) * 0.1);
    if (!this.incomingFor(p) || lat > maxReach || dy > passTol || !inZ) {
      p.recover = T.whiffRecover;
      this.emit({ t: 'whiff', p: p.idx, reason: lat > maxReach ? (st.held || lat > T.stretchReach ? 'out of reach' : 'hold a button to stretch') : !inZ ? (b.z > T.maxContactZ ? 'too high' : 'too low') : 'missed it' });
      return;
    }
    const inp = this.shotInput(p, isAi, b, volley, volley && b.z > T.overheadZ, maxReach);
    const S = STRIKES[inp.strike];
    sw.strike = inp.strike;
    sw.type = S.shot;
    sw.reach = dx;
    sw.fh = inp.fh;
    if (inp.stretch > 0.45 && (!volley || st.held)) {
      sw.kind = 'dive';
      p.drain(T.diveDrain * inp.stretch);
      p.anim = 'dive';
    }
    if (S.accel) {
      p.accelUsed++;
      // the racket smokes from the last good acceleration on
      if (p.accelUsed >= p.accelQuota) p.smoke = T.smokeFrames;
    }
    const shot = makeShot(inp, this.sf);
    sw.grade = shot.label;
    p.lastCentre = shot.centreZone;
    p.lastBody = inp.body;
    this.ball = shot.ball;
    this.rally.lastHitter = p.idx;
    this.rally.bounces = 0;
    this.rally.isServe = false;
    this.rally.firstBounceIn = false;
    this.rally.shotCount++;
    this.rally.rallyLen++;
    p.shots++;
    p.drain(T.shotDrain + (S.accel ? T.accelPowerDrain * (1 + (inp.accelOver ?? 0) * 0.3) : 0) + (S.shot === 'lob' ? 0.4 : 0) + (S.id === 'topspin' ? 0.15 : 0));
    if (this.rally.rallyLen > 8) p.drain(T.rallyDrain);
    if (shot.label === 'PERFECT') {
      p.perfects++;
      this.hitstop = T.hitstopPerfect;
      this.trailOn = 45;
    } else if (shot.pace > 26) this.trailOn = 30;
    const f = predictFirstBounce(this.ball, this.sf);
    this.predicted = { x: f.bx, y: f.by };
    this.emit({
      t: 'hit', p: p.idx, grade: shot.label, reason: shot.reason, shot: S.shot, strike: inp.strike, volley, overhead: inp.overhead, pace: shot.pace, dive: sw.kind === 'dive',
      fh: sw.fh, cy: b.y, tx: shot.tx, prep: inp.prep, danger: shot.danger, centre: shot.centreZone, zone: shot.zone, accelOver: inp.accelOver ?? 0,
    });
    // a button held on after the stroke prepares the next one from now
    st.since = this.frame;
    st.aim = 0;
    const opp = this.players[1 - p.idx];
    opp.splitStep = 12;
    if (isAi) this.ais[p.idx]?.onOwnShot(this, p, S.shot);
    if (this.practice) {
      this.practiceHits++;
      if (shot.label === 'PERFECT') this.practiceStreak++;
      else this.practiceStreak = 0;
      this.practiceBest = Math.max(this.practiceBest, this.practiceStreak);
    }
  }

  /** after a point: gesture button + a direction */
  private updateGestures(): void {
    if (this.phase !== 'dead' && this.phase !== 'over') return;
    if (this.phase === 'dead' && this.deadAction !== 'point') return;
    for (const p of this.players) {
      if (!p.ctrl || !p.ctrl.pressed('gesture')) continue;
      const won = this.phase === 'over' ? this.score.winner === p.idx : this.pendingResult?.winner === p.idx;
      const ax = p.ctrl.axis();
      let d: 'up' | 'down' | 'left' | 'right' = 'up';
      if (Math.abs(ax.x) > Math.abs(ax.y) && Math.abs(ax.x) > 0.3) d = ax.x < 0 ? 'left' : 'right';
      else if (ax.y > 0.3) d = 'down';
      if (p.setup.hand === 'L' && (d === 'left' || d === 'right')) d = d === 'left' ? 'right' : 'left';
      const kind: GestureKind = won
        ? ({ up: 'jump', left: 'fist', right: 'rage', down: 'sorry' } as const)[d]
        : ({ up: 'applaud', left: 'facepalm', right: 'crazy', down: 'throw' } as const)[d];
      p.gesture = { kind, t: 0 };
      p.celebrate = 0;
      this.emit({ t: 'gesture', p: p.idx, kind });
    }
  }

  private updateBall(): void {
    if (this.rally.dead) {
      // ball continues to roll/bounce for visuals
      stepBall(this.ball, this.sf);
      return;
    }
    if (!this.ballLive) return;
    const stop = { v: false };
    const ev = stepBall(this.ball, this.sf, stop);
    const b = this.ball;
    const hitter = this.rally.lastHitter as 0 | 1;
    if (ev === 'netcord') {
      this.emit({ t: 'netcord' });
      if (this.rally.isServe) this.serveNetcord = true;
    }
    if (ev === 'net') {
      this.emit({ t: 'net' });
      if (this.rally.isServe) this.fault('NET', 'net');
      else this.endPoint((1 - hitter) as 0 | 1, 'net', 'NET');
      return;
    }
    // flew out of the stadium without bouncing
    if (Math.abs(b.x) > 9.6 || Math.abs(b.y) > 19.4) {
      if (this.rally.bounces === 0) {
        if (this.rally.isServe) this.fault('FAULT', 'fault');
        else this.endPoint((1 - hitter) as 0 | 1, 'out', 'OUT!');
      } else if (this.rally.isServe) this.endPoint(hitter, 'ace', 'ACE!'); // an untouched serve that flew past the returner
      else this.endPoint(hitter, 'winner', '');
      return;
    }
    if (ev === 'bounce') {
      this.rally.bounces++;
      this.emit({ t: 'bounce', x: b.x, y: b.y, speed: Math.hypot(b.vx, b.vy, b.vz) });
      if (this.rally.bounces === 1) {
        this.rally.bounceX = b.x;
        this.rally.bounceY = b.y;
        this.rally.bounceVz = b.vz;
        const hp = this.players[hitter];
        const oppSide = b.y * hp.dir > 0;
        if (this.rally.isServe) {
          const sx = this.serveX;
          const correctSide = Math.sign(b.x) !== Math.sign(sx) || Math.abs(b.x) <= BALL_R;
          const inBox = oppSide && Math.abs(b.y) <= SERVICE_Y + BALL_R && Math.abs(b.x) <= HALF_W + BALL_R && correctSide;
          if (!inBox) {
            this.fault('FAULT', 'fault');
            return;
          }
          if (this.practice) {
            this.emit({ t: 'call', text: this.serveNetcord ? 'LET' : 'IN!', kind: this.serveNetcord ? 'let' : 'info' });
            if (!this.serveNetcord) this.practiceHits++;
            this.rally.dead = true;
            this.practiceResetT = 70;
            this.practiceServes++;
            return;
          }
          if (this.serveNetcord) {
            this.emit({ t: 'call', text: 'LET', kind: 'let' });
            this.letServe();
            return;
          }
          this.rally.firstBounceIn = true;
        } else {
          const inside = oppSide && Math.abs(b.y) <= HALF_LEN + BALL_R && Math.abs(b.x) <= HALF_W + BALL_R;
          if (!inside) {
            this.endPoint((1 - hitter) as 0 | 1, 'out', oppSide ? 'OUT!' : 'NET');
            return;
          }
          this.rally.firstBounceIn = true;
        }
      } else if (this.rally.bounces >= 2) {
        // receiver failed to return
        const isAce = this.rally.isServe;
        this.endPoint(hitter, isAce ? 'ace' : 'winner', isAce ? 'ACE!' : '');
        return;
      }
    }
    // rolling ball safety
    if (this.ball.vz === 0 && this.ball.z <= BALL_R + 0.001 && Math.hypot(b.vx, b.vy) < 1) {
      this.endPoint(this.rally.bounces > 0 && this.rally.firstBounceIn ? hitter : ((1 - hitter) as 0 | 1), 'winner', '');
    }
  }

  serveX = 0;
  serveNetcord = false;
  private netcordThisShot(): boolean {
    // scan recent events since the serve for a netcord
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.t === 'serve') return false;
      if (e.t === 'netcord') return true;
    }
    return false;
  }

  private letServe(): void {
    this.rally.dead = true;
    this.pendingResult = null;
    this.setPhase('dead');
    this.deadAction = 'let';
  }

  private deadAction: 'point' | 'fault' | 'let' = 'point';

  private fault(text: string, kind: 'fault' | 'net'): void {
    if (this.practice) {
      this.emit({ t: 'call', text: kind === 'net' ? 'NET' : 'FAULT', kind: 'fault' });
      this.rally.dead = true;
      this.practiceResetT = 70;
      this.practiceServes++;
      return;
    }
    this.serveFaults++;
    this.rally.dead = true;
    const s = this.server;
    if (this.serveFaults >= 2) {
      s.doubleFaults++;
      this.emit({ t: 'call', text: 'DOUBLE FAULT', kind: 'fault' });
      this.endPoint(this.receiver.idx, 'df', '', true);
    } else {
      this.emit({ t: 'call', text: kind === 'net' ? 'FAULT' : text, kind: 'fault' });
      this.deadAction = 'fault';
      this.setPhase('dead');
    }
  }

  private endPoint(winner: 0 | 1, how: string, call: string, already = false): void {
    if (this.practice) {
      // the ball keeps flying (visible) so the player sees where the shot went
      this.rally.dead = true;
      this.ballLive = false;
      this.practiceFeedT = T.practiceAfterShot;
      if (call && !already) this.emit({ t: 'call', text: call, kind: how === 'out' ? 'out' : how === 'net' ? 'net' : 'info' });
      return;
    }
    this.rally.dead = true;
    this.ballLive = true;
    if (call && !already) this.emit({ t: 'call', text: call, kind: how === 'out' ? 'out' : how === 'net' ? 'net' : 'info' });
    const loser = this.players[1 - winner];
    const w = this.players[winner];
    if (how === 'ace') w.aces++;
    if (how === 'winner') w.winners++;
    if (how === 'out' || how === 'net') {
      loser.errors++;
      // (M21) show how the missed ball was struck: green centred, orange off-centre, red into the body / full stretch
      if (loser.human && this.rally.lastHitter === loser.idx) this.missIcon = { p: loser.idx, zone: loser.lastCentre, body: loser.lastBody, t: 0 };
    }
    if (this.rally.rallyLen >= 12) w.longRallyWins++;
    this.pendingResult = { winner, how };
    this.deadAction = 'point';
    this.setPhase('dead');
    this.emit({ t: 'point', winner, how, rally: this.rally.rallyLen });
    this.crowdExcite = Math.min(1, 0.3 + this.rally.rallyLen * 0.06 + (how === 'ace' || how === 'winner' ? 0.3 : 0));
  }

  private updateDead(): void {
    // players coast to a stop, swings finish
    for (const p of this.players) {
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x += p.vx / 60;
      p.y += p.vy / 60;
      p.clamp();
      if (p.swing && this.frame - p.swing.contactAt > T.swingRecover) p.swing = null;
      if (!p.swing) p.anim = p.celebrate > 0 ? 'celebrate' : 'idle';
    }
    this.updateBall();
    if (this.phaseT === 20 && this.deadAction === 'point' && this.pendingResult) {
      const w = this.players[this.pendingResult.winner];
      if (this.rally.rallyLen >= 3 || this.pendingResult.how === 'ace' || this.score.isBigPoint()) w.celebrate = 50;
    }
    const wait = this.deadAction === 'point' ? 80 : 55;
    if (this.phaseT < wait) return;
    if (this.deadAction === 'fault' || this.deadAction === 'let') {
      // second serve / replay
      const s = this.server;
      s.serve = { phase: 'ready', t: 0, tossApex: 34, type: 'flat' };
      this.ballLive = false;
      this.rally = { lastHitter: -1, bounces: 0, shotCount: this.rally.shotCount, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0, bounceVz: 0 };
      this.ais.forEach((a) => a?.reset());
      this.setupPoint(false);
      this.setPhase('serve');
      return;
    }
    const res = this.pendingResult!;
    this.pendingResult = null;
    const r = this.score.pointWon(res.winner);
    this.serveFaults = 0;
    this.ais.forEach((a, i) => {
      if (!a) return;
      const changed = a.onPointEnd(res.winner === i);
      if (changed) this.emit({ t: 'adapt', p: i as 0 | 1, tactic: changed });
    });
    this.emit({ t: 'score', events: r.events, winner: res.winner });
    for (const p of this.players) p.recoverStamina(T.pointRecover);
    if (r.events.includes('match')) {
      this.setPhase('over');
      this.players[res.winner].celebrate = 9999;
      this.emit({ t: 'over', winner: res.winner });
      this.ballVisible = false;
      return;
    }
    if (r.events.includes('changeover')) {
      const set = r.events.includes('set');
      for (const p of this.players) p.recoverStamina(set ? T.setRecover : T.changeoverRecover);
      this.emit({ t: 'changeover', set });
      this.ballVisible = false;
      this.setPhase('changeover');
      this.setupPoint(false);
      return;
    }
    this.setupPoint(false);
    this.setPhase('serve');
  }

  // ---------------------------------------------------------- practice ball machine
  private updatePractice(): void {
    const pr = this.practice!;
    if (pr.serve) {
      if (this.rally.dead && this.practiceResetT > 0 && --this.practiceResetT === 0) {
        this.setupPoint(true);
        this.setPhase('serve');
      }
      return;
    }
    if (this.ballLive && !this.rally.dead) return;
    if (this.practiceFeedT > 0) {
      // after a shot has played out, the shot button skips the rest of the wait
      const waited = T.practiceAfterShot - this.practiceFeedT;
      if (this.rally.dead && waited >= T.practiceSkipAfter && this.players[0].ctrl?.strikePressed()) this.practiceFeedT = 1;
      this.practiceFeedT--;
      if (this.practiceFeedT === 0) this.feed();
      return;
    }
    this.practiceFeedT = pr.interval;
  }

  feed(): void {
    const pr = this.practice!;
    const p = this.players[0];
    const type: ShotType = pr.type === 'random' ? this.rng.pick(['normal', 'topspin', 'slice', 'lob'] as ShotType[]) : pr.type;
    const sideSign = pr.side === 'mix' ? (this.rng.chance(0.5) ? 1 : -1) : (pr.side === 'fh' ? 1 : -1) * (p.setup.hand === 'R' ? 1 : -1);
    const tx = pr.wide ? sideSign * this.rng.range(2.9, 3.7) : Math.max(-3.6, Math.min(3.6, p.x + sideSign * this.rng.range(0.9, 2.6)));
    const depth = type === 'lob' ? -10.2 : pr.depth ? -this.rng.range(pr.depth[0], pr.depth[1]) : this.rng.range(-10.6, -8.0);
    const from: BallState = { x: this.rng.range(-0.5, 0.5), y: HALF_LEN + 0.5, z: 0.9, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
    const spin = { normal: 0.3, topspin: 1.2, slice: -0.85, lob: 0.4, drop: -1.9 }[type];
    const T0 = type === 'lob' ? 2.2 : 22 / (20 * pr.speed);
    const margin = type === 'lob' ? 2 : 0.4;
    this.ball = solveShot(from, tx, depth, T0, spin, 0, this.sf, margin);
    this.ballLive = true;
    this.ballVisible = true;
    this.rally = { lastHitter: 1, bounces: 0, shotCount: this.rally.shotCount + 1, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0, bounceVz: 0 };
    this.players[0].accelUsed = 0;
    const f = predictFirstBounce(this.ball, this.sf);
    this.predicted = { x: f.bx, y: f.by };
    this.emit({ t: 'feed' });
  }

  debug(): Record<string, unknown> {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      phase: this.phase,
      frame: this.frame,
      server: this.score.server,
      points: [...this.score.points],
      games: [...this.score.games],
      sets: [...this.score.sets],
      winner: this.score.winner,
      faults: this.serveFaults,
      phaseT: this.phaseT,
      pressure: this.score.pressureLabel(),
      setHistory: this.score.setHistory.map((s) => s.join('-')),
      skips: this.skips,
      missIcon: this.missIcon ? this.missIcon.zone : null,
      canSkip: this.canSkipDowntime,
      walking: this.players.some((p) => p.autoWalk),
      ball: { x: r2(this.ball.x), y: r2(this.ball.y), z: r2(this.ball.z), vx: r2(this.ball.vx), vy: r2(this.ball.vy), vz: r2(this.ball.vz), spin: r2(this.ball.spin) },
      ballLive: this.ballLive,
      tactics: this.ais.map((a) => (a ? a.tactic : null)),
      rally: { ...this.rally },
      players: this.players.map((p) => ({
        x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), stamina: r2(p.stamina), anim: p.anim,
        swing: p.swing ? { grade: p.swing.grade, whiff: p.swing.whiff, kind: p.swing.kind, type: p.swing.type, strike: p.swing.strike, contactAt: p.swing.contactAt, done: p.swing.done } : null,
        strike: { held: p.strike.held, b1: p.strike.b1, b2: p.strike.b2, fwd: p.strike.fwd, prep: p.strike.held ? r2((this.frame - p.strike.since) / 60) : 0, aim: r2(p.strike.aim) },
        autoT: p.autoT ? { x: r2(p.autoT.x), y: r2(p.autoT.y) } : null, accel: [p.accelUsed, p.accelQuota], smoke: p.smoke, lock: p.lock,
        gesture: p.gesture?.kind ?? null,
        serve: p.serve.phase, perfects: p.perfects, maxSpeed: r2(p.maxSpeed(this.sf)), windowMul: r2(p.windowMul()),
      })),
    };
  }
}

