import { Rng } from '../core/rng';
import { Controller } from '../core/input';
import { Difficulty } from '../core/settings';
import { BallState, stepBall, cloneBall, predictFirstBounce } from './ball';
import { Player } from './player';
import { AI, DIFF_NOISE } from './ai';
import { Score, MatchFormat, ScoreEvent } from './scoring';
import { makeShot, makeServe, solveShot, Grade } from './shots';
import { Surface, SURFACES, SurfaceId } from '../data/surfaces';
import { PlayerSetup, ShotType, ServeType, Stats, STAT_KEYS } from '../data/types';
import { HALF_LEN, HALF_W, SERVICE_Y, BALL_R } from '../data/court';
import { T } from '../data/tuning';
import { TacticId, normalize, ARCHETYPE_BLEND } from '../data/tactics';

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
}

export interface PracticeFeed {
  type: ShotType | 'random';
  side: 'fh' | 'bh' | 'mix';
  speed: number; // 0.6..1.3
  interval: number; // frames between feeds
  serve?: boolean; // serve practice instead of feeding
}

export type MatchEvent =
  | { t: 'hit'; p: 0 | 1; grade: Grade; reason: string; shot: ShotType; volley: boolean; overhead: boolean; pace: number; dive: boolean; fh: boolean; cy: number; tx: number }
  | { t: 'whiff'; p: 0 | 1; reason: string }
  | { t: 'serve'; p: 0 | 1; kmh: number; grade: Grade; type: ServeType }
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
  rally = { lastHitter: -1 as -1 | 0 | 1, bounces: 0, shotCount: 0, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0 };
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
      p.serve = { phase: 'ready', t: 0, tossApex: 34, type: 'flat' };
      p.meterA = -1;
    }
    this.ais.forEach((a) => a?.reset());
    this.ballLive = false;
    this.ballVisible = false;
    this.rally = { lastHitter: -1, bounces: 0, shotCount: 0, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0 };
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
      if (p.meterShow > 0) p.meterShow--;
      p.sweat = p.staminaF() < 0.35 ? 1 : 0;
    }
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
    // receiver can shuffle
    this.controlReceiverPreServe(r);
    let toss = false;
    let hit = false;
    let type: ServeType = 'flat';
    let aimX = 0;
    let mx = 0;
    const ai = this.ais[s.idx];
    if (ai) {
      const a = ai.serveUpdate(this, s);
      toss = a.toss;
      hit = a.hit;
      type = a.type;
      aimX = a.aimX;
    } else if (s.ctrl) {
      const c = s.ctrl;
      const ax = c.axis();
      mx = ax.x;
      aimX = ax.x;
      if (sv.phase === 'ready' && (c.pressed('normal') || c.pressed('topspin') || c.pressed('slice'))) toss = true;
      else if (sv.phase === 'toss' && sv.t > 3) {
        if (c.pressed('normal')) {
          hit = true;
          type = c.held('topspin') ? 'kick' : c.held('slice') ? 'slice' : 'flat';
        } else if (c.pressed('topspin')) {
          hit = true;
          type = 'kick';
        } else if (c.pressed('slice')) {
          hit = true;
          type = 'slice';
        }
      }
    }
    if (sv.phase === 'ready') {
      // small sideways adjustment along the baseline
      if (mx !== 0) {
        const base = (s.side === 0 ? 1 : -1) * (this.score.deuceCourt ? 1 : -1);
        s.x = Math.max(Math.min(base * 0.3, base * 3), Math.min(Math.max(base * 0.3, base * 3), s.x + mx * 0.04));
        s.x = base > 0 ? Math.max(0.3, Math.min(3.0, s.x)) : Math.min(-0.3, Math.max(-3.0, s.x));
      }
      this.ballVisible = true;
      this.placeBallInHand(s);
      if (toss) {
        sv.phase = 'toss';
        sv.t = 0;
        s.anim = 'serve';
        s.animT = 0;
        const hand = this.tossHand(s);
        this.ball = { x: hand.x, y: hand.y, z: T.tossZ0, vx: 0, vy: 0, vz: T.tossVz, spin: 0, side: 0 };
        sv.tossApex = Math.round((T.tossVz / 9.81) * 60);
        this.emit({ t: 'toss', p: s.idx });
      }
    } else if (sv.phase === 'toss') {
      // toss flight (vertical only)
      this.ball.vz -= 9.81 / 60;
      this.ball.z += this.ball.vz / 60;
      if (hit) {
        this.hitServe(s, type, aimX);
        return;
      }
      if (this.ball.z < 1.25 && this.ball.vz < 0) {
        // let it drop: re-toss
        sv.phase = 'ready';
        sv.t = 0;
        s.anim = 'idle';
      }
    }
  }

  private controlReceiverPreServe(r: Player): void {
    if (r.ctrl) {
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

  private hitServe(s: Player, type: ServeType, aimX: number): void {
    const sv = s.serve;
    const off = sv.t - sv.tossApex;
    const a = Math.abs(off);
    const q = a <= T.servePerfectWin ? 'PERFECT' : a <= T.serveGoodWin ? 'GOOD' : off < 0 ? 'EARLY' : 'LATE';
    sv.phase = 'hit';
    sv.t = 0;
    sv.type = type;
    s.animT = 0;
    const from = cloneBall(this.ball);
    const res = makeServe({
      from, dir: s.dir, serverX: s.x, aimX, type, quality: q, tossOffset: off, stats: s.stats, stamina: s.stamina,
      badges: s.setup.badges, second: this.serveFaults > 0, rng: this.rng,
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
    s.drain(T.shotDrain * (type === 'flat' ? 1.3 : 1));
    if (q === 'PERFECT') {
      s.perfects++;
      this.trailOn = 50;
      this.hitstop = 2;
    }
    this.predicted = (() => {
      const f = predictFirstBounce(this.ball, this.sf);
      return { x: f.bx, y: f.by };
    })();
    this.emit({ t: 'serve', p: s.idx, kmh: res.speed, grade: q, type });
    this.ais[s.idx]?.onServeHit(this, s);
    const r = this.receiver;
    r.splitStep = 12;
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

  private updatePlayer(p: Player): void {
    let mx = 0;
    let my = 0;
    let press: ShotType | null = null;
    let aimX = 0;
    let aimDepth = 0;
    let power = 1;
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
      press = o.press;
      aimX = o.aimX;
      aimDepth = o.aimDepth;
      power = o.power;
    } else if (p.ctrl) {
      const ax = p.ctrl.axis();
      mx = ax.x;
      my = ax.y;
      press = p.ctrl.shotPressed();
      aimX = ax.x;
      aimDepth = -ax.y * p.dir;
    }
    if (press) {
      p.bufferedShot = press;
      p.bufferT = 5;
      p.swingPower = power;
      if (ai) p.aiAim = { x: aimX, d: aimDepth };
    }
    if (p.bufferT > 0) p.bufferT--;
    this.aimHint[p.idx] = { x: aimX, d: aimDepth };
    const swinging = !!p.swing && !p.swing.done;
    p.move(mx, my, this.sf, swinging);
    if (p.stepAcc > 0.9) {
      p.stepAcc = 0;
      this.emit({ t: 'step', p: p.idx, slide: false });
    }
    // clay slide when changing direction fast
    if (this.sf.slides && Math.hypot(p.vx, p.vy) > 4 && (Math.sign(mx) !== Math.sign(p.vx) || mx === 0)) {
      if (p.slideT <= 0) this.emit({ t: 'step', p: p.idx, slide: true });
      p.slideT = 20;
    }
    if (p.slideT > 0) p.slideT--;
    // timing meter prediction for humans
    if (p.human || this.practice) this.updateMeter(p);
    // swing handling
    if (p.bufferedShot && p.bufferT > 0 && !swinging && p.recover <= 0) {
      this.startSwing(p, p.bufferedShot, aimX, aimDepth);
      p.bufferedShot = null;
      p.bufferT = 0;
    }
    if (p.swing && !p.swing.done && this.frame >= p.swing.contactAt) {
      // humans aim with the direction held at contact; the AI uses the aim it chose when it swung
      if (ai) this.resolveContact(p, p.aiAim.x, p.aiAim.d, true);
      else this.resolveContact(p, aimX, aimDepth, false);
    }
    if (p.swing && p.swing.done && this.frame - p.swing.contactAt > T.swingRecover) p.swing = null;
    // animation state
    if (!p.swing) p.anim = Math.hypot(p.vx, p.vy) > 0.6 ? 'run' : p.staminaF() < 0.2 ? 'slump' : 'idle';
  }

  private incomingFor(p: Player): boolean {
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

  private updateMeter(p: Player): void {
    const a = this.predictArrival(p, 70);
    if (a && a.f > -12) {
      p.meterA = a.f;
      p.meterShow = 30;
    } else p.meterA = -1;
  }

  private startSwing(p: Player, type: ShotType, aimX: number, aimDepth: number): void {
    const arr = this.predictArrival(p);
    const W = T.windup;
    p.anim = 'swing';
    p.animT = 0;
    if (!arr) {
      p.swing = { type, start: this.frame, contactAt: this.frame + W, grade: null, offset: 0, whiff: true, whiffReason: '', done: false, fh: p.facingFh, kind: 'ground', reach: 0 };
      p.meterMark = null;
      return;
    }
    const offset = arr.f - W;
    const wm = p.windowMul() * (this.bigPoint && p.setup.badges.includes('clutch') ? 1.25 : 1);
    const running = p.speedRatio(this.sf) > 0.5 ? 0.85 : 1;
    const k = wm * running;
    const pw = T.perfectWin * k;
    const gw = T.goodWin * k;
    let grade: Grade | null;
    let whiffReason = '';
    if (Math.abs(offset) <= pw) grade = 'PERFECT';
    else if (Math.abs(offset) <= gw) grade = 'GOOD';
    else if (offset > 0 && offset <= T.earlyMax) grade = 'EARLY';
    else if (offset < 0 && -offset <= T.lateMax) grade = 'LATE';
    else if (offset > 0 && offset <= T.mishitEarly) grade = 'MISHIT';
    else if (offset < 0 && -offset <= T.mishitLate) grade = 'MISHIT';
    else {
      grade = null;
      whiffReason = offset > 0 ? 'swung far too early' : 'far too late';
    }
    p.meterMark = offset;
    p.meterShow = 50;
    const fh = p.isForehand(arr.x);
    p.facingFh = fh;
    if (grade === null) {
      p.swing = { type, start: this.frame, contactAt: this.frame + W, grade: null, offset, whiff: true, whiffReason, done: false, fh, kind: 'ground', reach: 0 };
      return;
    }
    const contactAt = this.frame + Math.max(1, Math.round(arr.f));
    p.swing = {
      type, start: this.frame, contactAt, grade, offset, whiff: false, whiffReason: '', done: false, fh,
      kind: arr.vol ? (arr.z > T.overheadZ ? 'overhead' : 'volley') : 'ground', reach: 0,
    };
    // the swing "start" for animation purposes: contact pose happens at contactAt
    p.swing.start = contactAt - W;
  }

  private resolveContact(p: Player, aimX: number, aimDepth: number, isAi: boolean): void {
    const sw = p.swing!;
    sw.done = true;
    if (sw.whiff) {
      p.recover = T.whiffRecover;
      this.emit({ t: 'whiff', p: p.idx, reason: sw.whiffReason });
      return;
    }
    const b = this.ball;
    const plane = p.y + p.dir * T.contactAhead;
    const dx = b.x - p.x;
    const dy = Math.abs(b.y - plane);
    const lat = Math.abs(dx);
    const wall = p.setup.badges.includes('wall') ? 1.08 : 1;
    const netMag = sw.kind === 'volley' && p.setup.badges.includes('netMagnet') ? 1.1 : 1;
    const maxReach = T.stretchReach * wall * netMag;
    const inZ = b.z >= T.minContactZ && b.z <= T.maxContactZ + (sw.kind === 'overhead' ? 0.3 : 0);
    if (!this.incomingFor(p) || lat > maxReach || dy > 1.4 || !inZ) {
      p.recover = T.whiffRecover;
      this.emit({ t: 'whiff', p: p.idx, reason: lat > maxReach ? 'out of reach' : !inZ ? (b.z > T.maxContactZ ? 'too high' : 'too low') : 'missed it' });
      return;
    }
    const stretch = Math.max(0, (lat - T.reach) / (maxReach - T.reach));
    sw.reach = dx;
    sw.fh = p.isForehand(b.x);
    if (stretch > 0.45) {
      sw.kind = 'dive';
      p.drain(T.diveDrain * stretch);
      p.anim = 'dive';
    }
    const volley = this.rally.bounces === 0;
    const overhead = volley && b.z > T.overheadZ;
    const isReturn = this.rally.isServe;
    const shot = makeShot({
      type: sw.type, from: cloneBall(b), dir: p.dir, aimX, aimDepth, grade: sw.grade!, offset: sw.offset,
      stats: p.stats, stamina: p.stamina, speedRatio: p.speedRatio(this.sf), stretch, contactZ: b.z, lateral: lat,
      sideSign: Math.sign(dx) || 1, fh: sw.fh, volley, overhead, isReturn, badges: p.setup.badges, rng: this.rng, power: p.swingPower,
    }, this.sf);
    this.ball = shot.ball;
    this.rally.lastHitter = p.idx;
    this.rally.bounces = 0;
    this.rally.isServe = false;
    this.rally.firstBounceIn = false;
    this.rally.shotCount++;
    this.rally.rallyLen++;
    p.shots++;
    p.drain(T.shotDrain + (sw.grade === 'PERFECT' ? T.powerDrain : 0) + (sw.type === 'lob' ? 0.4 : 0));
    if (this.rally.rallyLen > 8) p.drain(T.rallyDrain);
    if (sw.grade === 'PERFECT') {
      p.perfects++;
      this.hitstop = T.hitstopPerfect;
      this.trailOn = 45;
    } else if (shot.pace > 26) this.trailOn = 30;
    const f = predictFirstBounce(this.ball, this.sf);
    this.predicted = { x: f.bx, y: f.by };
    this.emit({ t: 'hit', p: p.idx, grade: sw.grade!, reason: shot.reason, shot: sw.type, volley, overhead, pace: shot.pace, dive: sw.kind === 'dive', fh: sw.fh, cy: b.y, tx: shot.tx });
    const opp = this.players[1 - p.idx];
    opp.splitStep = 12;
    if (isAi) this.ais[p.idx]?.onOwnShot(this, p, sw.type);
    if (this.practice) {
      this.practiceHits++;
      if (sw.grade === 'PERFECT') this.practiceStreak++;
      else this.practiceStreak = 0;
      this.practiceBest = Math.max(this.practiceBest, this.practiceStreak);
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
      } else this.endPoint(hitter, 'winner', '');
      return;
    }
    if (ev === 'bounce') {
      this.rally.bounces++;
      this.emit({ t: 'bounce', x: b.x, y: b.y, speed: Math.hypot(b.vx, b.vy, b.vz) });
      if (this.rally.bounces === 1) {
        this.rally.bounceX = b.x;
        this.rally.bounceY = b.y;
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
      this.rally.dead = true;
      this.ballLive = false;
      this.practiceFeedT = 50;
      return;
    }
    this.rally.dead = true;
    this.ballLive = true;
    if (call && !already) this.emit({ t: 'call', text: call, kind: how === 'out' ? 'out' : how === 'net' ? 'net' : 'info' });
    const loser = this.players[1 - winner];
    const w = this.players[winner];
    if (how === 'ace') w.aces++;
    if (how === 'winner') w.winners++;
    if (how === 'out' || how === 'net') loser.errors++;
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
      this.rally = { lastHitter: -1, bounces: 0, shotCount: this.rally.shotCount, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0 };
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
    const tx = Math.max(-3.6, Math.min(3.6, p.x + sideSign * this.rng.range(0.9, 2.6)));
    const depth = type === 'lob' ? -10.2 : this.rng.range(-10.6, -8.0);
    const from: BallState = { x: this.rng.range(-0.5, 0.5), y: HALF_LEN + 0.5, z: 0.9, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };
    const spin = { normal: 0.3, topspin: 1.2, slice: -0.85, lob: 0.4, drop: -1.9 }[type];
    const T0 = type === 'lob' ? 2.2 : 22 / (20 * pr.speed);
    const margin = type === 'lob' ? 2 : 0.4;
    this.ball = solveShot(from, tx, depth, T0, spin, 0, this.sf, margin);
    this.ballLive = true;
    this.ballVisible = true;
    this.rally = { lastHitter: 1, bounces: 0, shotCount: this.rally.shotCount + 1, isServe: false, firstBounceIn: false, dead: false, rallyLen: 0, bounceX: 0, bounceY: 0 };
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
      ball: { x: r2(this.ball.x), y: r2(this.ball.y), z: r2(this.ball.z), vx: r2(this.ball.vx), vy: r2(this.ball.vy), vz: r2(this.ball.vz), spin: r2(this.ball.spin) },
      ballLive: this.ballLive,
      tactics: this.ais.map((a) => (a ? a.tactic : null)),
      rally: { ...this.rally },
      players: this.players.map((p) => ({
        x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), stamina: r2(p.stamina), anim: p.anim,
        swing: p.swing ? { grade: p.swing.grade, offset: p.swing.offset, whiff: p.swing.whiff, kind: p.swing.kind, type: p.swing.type } : null,
        serve: p.serve.phase, meterA: p.meterA, perfects: p.perfects, maxSpeed: r2(p.maxSpeed(this.sf)), windowMul: r2(p.windowMul()),
      })),
    };
  }
}

