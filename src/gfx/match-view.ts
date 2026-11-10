import { Match } from '../match/match';
import { Player } from '../match/player';
import { matchCam, Camera } from './camera';
import { Layer } from './layer';
import { drawCourtBackground, drawNet, drawCrowd, makeCrowd, Seat } from './court';
import { drawFigure, drawShadow, lerpPose, POSES, Pose, smooth, FIGURE_SCALE, strokePoses, slidePose, mirrorPose } from './player-renderer';

export { strokePoses, slidePose };
import { Particles } from './particles';
import { text, font } from './text';
import { TacticId } from '../data/tactics';
import { roundRect } from './ui';
import { W, H, game } from '../core/game';
import { T } from '../data/tuning';
import { settings, Preview } from '../core/settings';
import { SURFACES, SurfaceId } from '../data/surfaces';
import { Grade } from '../match/shots';
import { prepQ, Zone } from '../match/strike';
import type { GestureKind } from '../match/player';
import { Venue, VenueLook, venueFor, venueKey, venueLook } from '../data/venues';
import { fatigueEffects } from '../match/fatigue';
import { AnimRef, AnimName, playerSprites } from './sprites';

/** courtside photographers behind the far baseline (Majors / late rounds) */
const PHOTOGRAPHERS: [number, number][] = [[-7.6, 18.7], [-5.6, 18.9], [5.4, 18.9], [7.4, 18.7]];

export const GRADE_COLOR: Record<Grade | 'MISS', string> = {
  PERFECT: '#ffd23a', GOOD: '#9ef07a', RUSHED: '#7fd0ff', RISING: '#ff9a4a', OFFCENTRE: '#ffb86a', SAFE: '#cfd8e6', MISHIT: '#ff6262', MISS: '#ff8a8a',
};
const ZONE_COLOR: Record<Zone, string> = { green: '#5fe07a', orange: '#ff9a2e', red: '#ff3b3b' };
const GESTURE_POSE: Record<GestureKind, keyof typeof POSES> = {
  jump: 'celebrate', fist: 'gFist', rage: 'gRage', sorry: 'gSorry', applaud: 'gApplaud', facepalm: 'gFacepalm', crazy: 'gCrazy', throw: 'gThrow',
};
/** sprite animation per gesture (same names as the poses) */
const GESTURE_ANIM: Record<GestureKind, AnimName> = {
  jump: 'celebrate', fist: 'gFist', rage: 'gRage', sorry: 'gSorry', applaud: 'gApplaud', facepalm: 'gFacepalm', crazy: 'gCrazy', throw: 'gThrow',
};

interface Popup { text: string; sub: string; color: string; x: number; y: number; t: number; life: number; big: boolean }

const bgCache = new Map<string, Layer>();
export function courtLayer(sf: SurfaceId, cam: Camera = matchCam, key = 'match', venue: Venue = venueFor(sf)): Layer {
  const k = key + sf + venueKey(venue);
  let l = bgCache.get(k);
  if (!l) {
    l = new Layer((ctx) => drawCourtBackground(ctx, cam, SURFACES[sf], W, H, venue));
    bgCache.set(k, l);
    // keep the cache small (each layer is a full-screen canvas)
    if (bgCache.size > 6) bgCache.delete(bgCache.keys().next().value as string);
  }
  return l;
}

export class MatchView {
  cam = matchCam;
  venue: Venue;
  look: VenueLook;
  seats: Seat[];
  /** camera flashes in the crowd / from courtside photographers */
  flashes: { x: number; y: number; z: number; t: number }[] = [];
  lastServeKmh = 0;
  particles = new Particles();
  popups: Popup[] = [];
  call: { text: string; t: number; color: string } | null = null;
  banner: { text: string; sub: string; t: number; life: number } | null = null;
  wear: HTMLCanvasElement | null = null;
  wearRes = 0;
  time = 0;
  netLayer: Layer;

  constructor(public m: Match) {
    this.netLayer = new Layer((ctx) => drawNet(ctx, this.cam));
    this.venue = m.cfg.venue ?? venueFor(m.sf.id, { tier: m.practice ? 'practice' : 'tour' });
    this.look = venueLook(this.venue);
    const lk = this.look;
    this.seats = makeCrowd(7, lk.standRows, lk.empty, lk.farRows, lk.sideRange, lk.park ? 7.5 : 16);
  }

  /** a burst of camera flashes around the stadium (e.g. after match point in a final) */
  burstFlashes(n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.seats[Math.floor(Math.random() * this.seats.length)];
      if (s) this.flashes.push({ x: s.x, y: s.y, z: s.z + 0.5, t: -Math.random() * 0.6 });
    }
  }

  private updateFlashes(dt: number): void {
    const m = this.m;
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.12);
    // flashes come at exciting moments, more in later rounds and at Majors
    const rate = this.look.flashes * (m.phase === 'dead' || m.phase === 'over' ? 0.3 + m.crowdExcite * 1.6 : 0.05);
    if (Math.random() < rate * dt) this.burstFlashes(1);
    if (this.look.photographers && (m.phase === 'dead' || m.phase === 'over') && Math.random() < rate * dt * 0.6) {
      const ph = PHOTOGRAPHERS[Math.floor(Math.random() * PHOTOGRAPHERS.length)];
      this.flashes.push({ x: ph[0], y: ph[1], z: 0.75, t: 0 });
    }
    if (this.flashes.length > 120) this.flashes.splice(0, this.flashes.length - 120);
  }

  private drawPhotographers(ctx: CanvasRenderingContext2D): void {
    if (!this.look.photographers) return;
    for (const [x, y] of PHOTOGRAPHERS) {
      const p = this.cam.project(x, y, 0);
      const s = p.s;
      // crouched figure in dark clothes with a long lens
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 0.4 * s, 0.15 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2f3a';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 0.4 * s, 0.26 * s, 0.38 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c99a72';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 0.85 * s, 0.13 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(p.x - 0.05 * s, p.y - 0.84 * s, 0.1 * s, 0.32 * s);
    }
  }

  /** night session: the stands fall into darkness, the court stays under the lights */
  private drawFloodlights(ctx: CanvasRenderingContext2D): void {
    const c = this.cam.project(0, 0, 0);
    const g = ctx.createRadialGradient(c.x, c.y, 120, c.x, c.y, 420);
    g.addColorStop(0, 'rgba(6,10,30,0)');
    g.addColorStop(1, 'rgba(6,10,30,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,250,220,0.04)';
    ctx.fillRect(0, 0, W, H);
  }

  private drawFlashes(ctx: CanvasRenderingContext2D): void {
    for (const f of this.flashes) {
      if (f.t < 0) continue;
      const p = this.cam.project(f.x, f.y, f.z);
      const a = 1 - f.t / 0.12;
      const r = Math.max(2, p.s * 0.5) * (0.6 + a * 0.6);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
  }

  private wearCtx(): CanvasRenderingContext2D {
    const res = game.res;
    if (!this.wear || this.wearRes !== res) {
      this.wear = document.createElement('canvas');
      this.wear.width = Math.ceil(W * res);
      this.wear.height = Math.ceil(H * res);
      this.wearRes = res;
      const c = this.wear.getContext('2d')!;
      c.setTransform(res, 0, 0, res, 0, 0);
    }
    return this.wear.getContext('2d')!;
  }

  stampWear(x: number, y: number, size: number, alpha: number): void {
    const sf = this.m.sf.id;
    const ctx = this.wearCtx();
    const p = this.cam.project(x, y, 0);
    ctx.fillStyle = sf === 'grass' ? `rgba(150,120,60,${alpha})` : sf === 'clay' ? `rgba(110,40,15,${alpha})` : `rgba(255,255,255,${alpha * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, size * p.s, size * p.s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  popup(p: Player, label: string, sub: string, color: string, big = true): void {
    const pr = this.cam.project(p.x, p.y, p.side === 0 ? 3.1 : 2.9);
    this.popups.push({ text: label, sub, color, x: pr.x, y: pr.y, t: 0, life: 1.3, big });
    if (this.popups.length > 6) this.popups.shift();
  }

  showCall(textS: string, color = '#ffffff'): void {
    this.call = { text: textS, t: 0, color };
  }

  showBanner(textS: string, sub = '', life = 2): void {
    this.banner = { text: textS, sub, t: 0, life };
  }

  scoreKey = '';
  scorePulse = 0;
  /** the COM's game plan for the current point */
  planTag: [{ tactic: TacticId; t: number } | null, { tactic: TacticId; t: number } | null] = [null, null];
  ring: { x: number; y: number; z: number; t: number } | null = null;

  flashRing(x: number, y: number, z: number): void {
    this.ring = { x, y, z, t: 0 };
  }

  update(dt: number): void {
    this.time += dt;
    this.scorePulse = Math.max(0, this.scorePulse - dt * 2.5);
    this.tab.t += dt;
    for (const pt of this.planTag) if (pt) pt.t += dt;
    if (this.ring) {
      this.ring.t += dt;
      if (this.ring.t > 0.3) this.ring = null;
    }
    this.particles.update(dt);
    this.updateFlashes(dt);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);
    if (this.call) {
      this.call.t += dt;
      if (this.call.t > 1.5) this.call = null;
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
    // footprints / wear & sweat
    for (const p of this.m.players) {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 2.5 && Math.random() < 0.12 && (this.m.sf.id !== 'hard')) this.stampWear(p.x + (Math.random() - 0.5) * 0.3, p.y, 0.16, this.m.sf.id === 'grass' ? 0.05 : 0.08);
      if (p.slideT > 15 && this.m.sf.id === 'clay') {
        this.particles.spawn('dust', p.x, p.y, 0.05, 1, '#e0a07a', 0.6);
        this.stampWear(p.x, p.y, 0.25, 0.06);
      }
      // slide stroke (M20): a skid trail on every surface while the slide carries the player
      if (p.lock === 'slide' && sp > 1) {
        const id = this.m.sf.id;
        const col = id === 'clay' ? '#e0a07a' : id === 'grass' ? '#b7e08f' : '#dfe8f0';
        if (Math.random() < 0.7) this.particles.spawn('dust', p.x + (Math.random() - 0.5) * 0.4, p.y, 0.05, 1, col, id === 'hard' ? 0.35 : 0.6);
        if (id !== 'hard') this.stampWear(p.x, p.y, 0.22, id === 'grass' ? 0.07 : 0.08);
      }
      if (p.sweat && Math.random() < 0.06) this.particles.spawn('sweat', p.x, p.y, 1.75, 1, '#bfe6ff', 0.5);
      // (M21) the racket smokes from the last good acceleration of the point on
      if (p.smoke > 0 && Math.random() < 0.45) {
        const rs = (p.side === 0 ? 1 : -1) * (p.setup.hand === 'R' ? 1 : -1) * (p.facingFh ? 1 : -1);
        this.particles.spawn('dust', p.x + rs * 0.55, p.y, 1.25, 1, '#9aa3ad', 0.7);
      }
    }
  }

  // ======================================================== drawing
  draw(ctx: CanvasRenderingContext2D, opts: { hud: boolean; preview: Preview; labels?: [string, string] }): void {
    const m = this.m;
    const sx = game.shakeX, sy = game.shakeY;
    ctx.save();
    ctx.translate(sx, sy);
    courtLayer(m.sf.id, this.cam, 'match', this.venue).draw(ctx);
    if (this.wear) ctx.drawImage(this.wear, 0, 0, W, H);
    const ballX = m.ballVisible ? m.ball.x : 0;
    drawCrowd(ctx, this.cam, this.seats, this.time, m.crowdExcite, ballX);
    this.drawPhotographers(ctx);
    if (this.venue.theme.night) this.drawFloodlights(ctx);
    this.drawFlashes(ctx);

    if (opts.preview !== 'off') this.drawPreview(ctx, opts.preview);

    // shadows
    for (const p of m.players) if (!(m.practice && p.idx === 1)) drawShadow(ctx, this.cam, p.x, p.y, 0.48);
    if (m.ballVisible && m.ball.z > -1) {
      const a = Math.max(0.2, 0.5 - m.ball.z * 0.06);
      drawShadow(ctx, this.cam, m.ball.x, m.ball.y, 0.11, a);
    }

    // far side objects then net then near
    type Obj = { y: number; draw: () => void };
    const far: Obj[] = [];
    const near: Obj[] = [];
    for (const p of m.players) {
      if (m.practice && p.idx === 1) {
        far.push({ y: 12.4, draw: () => this.drawBallMachine(ctx) });
        continue;
      }
      (p.y > 0 ? far : near).push({ y: p.y, draw: () => this.drawPlayer(ctx, p) });
    }
    if (m.ballVisible) (m.ball.y > 0 ? far : near).push({ y: m.ball.y, draw: () => this.drawBall(ctx) });
    far.sort((a, b) => b.y - a.y);
    near.sort((a, b) => b.y - a.y);
    for (const o of far) o.draw();
    this.netLayer.draw(ctx);
    for (const o of near) o.draw();
    this.particles.draw(ctx, this.cam);
    if (this.ring) {
      const r = this.ring;
      const p = this.cam.project(r.x, r.y, r.z);
      const k = r.t / 0.3;
      ctx.strokeStyle = `rgba(255,255,220,${1 - k})`;
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + k * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * (1 - k) + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (opts.hud) this.drawHud(ctx);
    this.drawPopups(ctx);
  }

  /** ground ellipse of radius r (m) around a court point */
  private groundEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const c = this.cam.project(x, y, 0);
    const ex = this.cam.project(x + r, y, 0);
    const ey = this.cam.project(x, y + r, 0);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, Math.max(1, Math.abs(ex.x - c.x)), Math.max(0.8, Math.abs(ey.y - c.y)), 0, 0, Math.PI * 2);
  }

  /**
   * (M21) The court preview for human players: the impact marker, the danger zone along the ball's
   * path after the bounce with the two green spots, the live aiming zone while a strike button is
   * held, and the preparation ring at the player's feet.
   */
  private drawPreview(ctx: CanvasRenderingContext2D, level: Preview): void {
    const m = this.m;
    const live = m.ballLive && !m.rally.dead;
    for (const p of m.players) {
      if (!(p.human || (m.practice && p.idx === 0))) continue;
      const incoming = live && m.incomingFor(p);
      // impact marker
      if (incoming && m.predicted && m.rally.bounces === 0) {
        const c = this.cam.project(m.predicted.x, m.predicted.y, 0);
        const pulse = 1 + Math.sin(this.time * 10) * 0.15;
        ctx.strokeStyle = 'rgba(255,240,80,0.9)';
        ctx.lineWidth = 1.5;
        this.groundEllipse(ctx, m.predicted.x, m.predicted.y, 0.32 * pulse);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(c.x - 0.2 * c.s, c.y);
        ctx.lineTo(c.x + 0.2 * c.s, c.y);
        ctx.stroke();
      }
      // danger zone + green spots
      if (incoming && level !== 'impact') {
        const rd = m.readBall(p);
        if (rd) {
          ctx.save();
          ctx.lineCap = 'round';
          for (let i = 1; i < rd.samples.length; i++) {
            const a = rd.samples[i - 1], b = rd.samples[i];
            if (a.d <= 0.22 && b.d <= 0.22) break; // the danger is over: the green spots take it from here
            const pa = this.cam.project(a.x, a.y, 0), pb = this.cam.project(b.x, b.y, 0);
            ctx.strokeStyle = a.d > 0.55 ? 'rgba(255,59,59,0.55)' : 'rgba(255,154,46,0.5)';
            ctx.lineWidth = Math.max(2, 0.5 * pa.s);
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
          for (const s of rd.spots) {
            const chosen = rd.pick && Math.abs(rd.pick.x - s.x) < 0.01;
            ctx.fillStyle = chosen ? 'rgba(95,224,122,0.5)' : 'rgba(95,224,122,0.28)';
            ctx.strokeStyle = chosen ? 'rgba(170,255,180,0.95)' : 'rgba(170,255,180,0.55)';
            ctx.lineWidth = 1.2;
            this.groundEllipse(ctx, s.x, s.y, 0.34);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      if (level === 'all') {
        // aiming zone (rally) or serve target
        const pv = incoming ? m.strikePreview(p) : m.phase === 'serve' && m.server === p ? m.servePreview(p) : null;
        if (pv) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.13)';
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          this.groundEllipse(ctx, pv.tx, pv.ty, Math.max(0.2, pv.r));
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
          const c = this.cam.project(pv.tx, pv.ty, 0);
          ctx.strokeStyle = '#ffd23a';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(c.x - 4, c.y);
          ctx.lineTo(c.x + 4, c.y);
          ctx.moveTo(c.x, c.y - 3);
          ctx.lineTo(c.x, c.y + 3);
          ctx.stroke();
          ctx.restore();
        }
      }
      // preparation ring: closes as the aiming zone shrinks
      if (p.strike.held && (incoming || m.phase === 'serve')) {
        const q = prepQ((m.frame - p.strike.since) / 60, m.controls.mode);
        const c = this.cam.project(p.x, p.y, 0);
        const ex = this.cam.project(p.x + 0.6, p.y, 0);
        const rx = Math.abs(ex.x - c.x);
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(10,18,34,0.45)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx, rx * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = q > 0.88 ? '#ffd23a' : q > 0.55 ? '#9ef07a' : '#7fd0ff';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx, rx * 0.4, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawBallMachine(ctx: CanvasRenderingContext2D): void {
    const p = this.cam.project(0, 12.4, 0);
    const s = p.s;
    ctx.fillStyle = '#2b3d55';
    roundRect(ctx, p.x - 0.4 * s, p.y - 0.9 * s, 0.8 * s, 0.9 * s, 0.1 * s);
    ctx.fill();
    ctx.fillStyle = '#d8f03a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 0.95 * s, 0.32 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 0.45 * s, 0.12 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBall(ctx: CanvasRenderingContext2D): void {
    const m = this.m;
    const b = m.ball;
    if (m.trailOn > 0 && m.trail.length > 2) {
      const n = m.trail.length;
      for (let i = 1; i < n; i++) {
        const a = m.trail[i - 1];
        const c = m.trail[i];
        const pa = this.cam.project(a.x, a.y, a.z);
        const pc = this.cam.project(c.x, c.y, c.z);
        const k = i / n;
        ctx.strokeStyle = `rgba(255,${200 + 55 * k},${80 * k},${k * 0.55 * Math.min(1, m.trailOn / 20)})`;
        ctx.lineWidth = Math.max(1, 0.14 * pc.s * k);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pc.x, pc.y);
        ctx.stroke();
      }
    }
    const p = this.cam.project(b.x, b.y, Math.max(0.034, b.z));
    const r = Math.max(2, 0.1 * p.s);
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, '#fbffb0');
    g.addColorStop(0.6, '#d8f03a');
    g.addColorStop(1, '#9ab820');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  poseFor(p: Player): Pose {
    const m = this.m;
    const f = m.frame;
    const W8 = T.windup;
    if (m.phase === 'serve' && p === m.server && p.serve.phase !== 'ready') {
      const t = p.serve.t;
      if (p.serve.phase === 'toss') {
        if (t < 12) return lerpPose(POSES.ready, POSES.srvToss, smooth(t / 12));
        return lerpPose(POSES.srvToss, POSES.srvTrophy, smooth((t - 12) / Math.max(1, p.serve.tossApex - 14)));
      }
    }
    if (p.serve.phase === 'hit' && p.serve.t < 30 && (m.phase === 'rally' || m.phase === 'dead')) {
      const t = p.serve.t;
      if (t < 4) return lerpPose(POSES.srvTrophy, POSES.srvContact, smooth(t / 4));
      if (t < 16) return lerpPose(POSES.srvContact, POSES.srvFollow, smooth((t - 4) / 12));
      return lerpPose(POSES.srvFollow, POSES.ready, smooth((t - 16) / 14));
    }
    if (p.swing) {
      const sw = p.swing;
      const t = f - sw.start;
      let back: Pose, con: Pose, fol: Pose;
      if (sw.kind === 'overhead') {
        back = POSES.srvTrophy; con = POSES.srvContact; fol = POSES.srvFollow;
      } else if (sw.kind === 'volley') {
        back = lerpPose(POSES.ready, POSES.volley, 0.4);
        con = sw.fh ? POSES.volley : mirrorPose(POSES.volley);
        fol = lerpPose(con, POSES.ready, 0.4);
      } else if (sw.kind === 'dive') {
        back = sw.fh ? POSES.fhBack : POSES.bhBack;
        con = sw.fh ? POSES.dive : mirrorPose(POSES.dive);
        fol = con;
      } else {
        ({ back, con, fol } = strokePoses(sw.fh, sw.type, p.setup.twoHanded));
      }
      const a = W8 * 0.45;
      let out: Pose | null = null;
      if (t < a) out = lerpPose(POSES.ready, back, smooth(t / a));
      else if (t < W8) out = lerpPose(back, con, smooth((t - a) / (W8 - a)));
      else if (t < W8 + 12) out = lerpPose(con, fol, smooth((t - W8) / 12));
      else if (t < W8 + 24) out = lerpPose(fol, POSES.ready, smooth((t - W8 - 12) / 12));
      if (out && t >= 0) {
        // slide stroke (M20): the legs split into a slide in the running direction while the arms swing
        if (p.lock === 'slide' && sw.kind !== 'dive') {
          const mirror = (p.side === 1) !== (p.setup.hand === 'L');
          const k = Math.min(1, Math.hypot(p.vx, p.vy) / 2 + 0.35);
          return slidePose(out, (p.slideDir || 1) * (mirror ? -1 : 1), k);
        }
        return out;
      }
    }
    if (p.gesture && p.gesture.t < 160 && (m.phase === 'dead' || m.phase === 'over' || m.phase === 'serve')) {
      const g = POSES[GESTURE_POSE[p.gesture.kind]];
      // fists pump, the crazy one shakes
      if (p.gesture.kind === 'fist' || p.gesture.kind === 'crazy') return lerpPose(POSES.ready, g, 0.75 + 0.25 * Math.sin(p.gesture.t * 0.35));
      return lerpPose(POSES.ready, g, smooth(Math.min(1, p.gesture.t / 8)));
    }
    if (p.celebrate > 0 && (m.phase === 'dead' || m.phase === 'over')) return POSES.celebrate;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 0.6) {
      const k = (Math.sin(p.runPhase * 2) + 1) / 2;
      const run = lerpPose(POSES.runA, POSES.runB, k);
      const blend = Math.min(1, sp / 2.5);
      const out = lerpPose(POSES.ready, run, blend);
      out.lean += (p.vx * (p.side === 0 ? 1 : -1) * (p.setup.hand === 'R' ? 1 : -1)) * 0.012;
      return out;
    }
    if (p.staminaF() < 0.2 && m.phase !== 'rally') return POSES.slump;
    return POSES.ready;
  }

  /**
   * Sprite mode: which animation plays and where in it, following the same game state and the same
   * timing as poseFor (wind-up up to contact, 12 ticks of follow-through, 12 back to ready).
   */
  spriteAnimFor(p: Player): AnimRef {
    const m = this.m;
    const W8 = T.windup;
    const facing = Math.abs(p.vx) > 0.3 ? Math.sign(p.vx) : 0;
    if (m.phase === 'serve' && p === m.server && p.serve.phase === 'toss') {
      // toss → trophy, reaching the contact frame 4 ticks after the toss apex
      return { name: 'serve', kind: 'once', k: Math.min(0.95, p.serve.t / (p.serve.tossApex + 4)) };
    }
    if (p.serve.phase === 'hit' && p.serve.t < 30 && (m.phase === 'rally' || m.phase === 'dead')) {
      const t = p.serve.t;
      const k = t < 4 ? (p.serve.tossApex + t) / (p.serve.tossApex + 4) : 1 + (t - 4) / 26;
      return { name: 'serve', kind: 'once', k };
    }
    if (p.swing) {
      const sw = p.swing;
      const t = m.frame - sw.start;
      if (t >= 0 && t < W8 + 24) {
        const k = t < W8 ? t / W8 : 1 + (t - W8) / 24;
        if (sw.kind === 'overhead') return { name: 'overhead', kind: 'once', k };
        if (sw.kind === 'volley') return { name: sw.fh ? 'volleyFh' : 'volleyBh', kind: 'once', k };
        // one dive strip (to the forehand side), mirrored for the backhand side
        if (sw.kind === 'dive') return { name: 'dive', kind: 'once', k, flip: !sw.fh };
        const two = p.setup.twoHanded;
        let name: AnimName;
        if (sw.type === 'slice' || sw.type === 'drop') name = sw.fh ? 'fhSlice' : 'bhSlice';
        else if (sw.type === 'lob') name = sw.fh ? 'fhLob' : 'bhLob';
        else name = sw.fh ? 'forehand' : two ? 'backhand' : 'backhand1h';
        return { name, kind: 'once', k };
      }
    }
    if (p.gesture && p.gesture.t < 160 && (m.phase === 'dead' || m.phase === 'over' || m.phase === 'serve')) {
      return { name: GESTURE_ANIM[p.gesture.kind], kind: 'clock', t: p.gesture.t / 60 };
    }
    if (p.celebrate > 0 && (m.phase === 'dead' || m.phase === 'over')) return { name: 'celebrate', kind: 'clock', t: this.time };
    if (Math.hypot(p.vx, p.vy) > 0.6) return { name: 'run', kind: 'cycle', phase: (p.runPhase * 2) / (Math.PI * 2), facing };
    if (p.staminaF() < 0.2 && m.phase !== 'rally') return { name: 'slump', kind: 'clock', t: this.time };
    return { name: 'ready', kind: 'clock', t: this.time + p.idx * 0.37 };
  }

  drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
    const pr = this.cam.project(p.x, p.y, 0);
    if (settings.playerArt === 'sprites') {
      playerSprites.load();
      // the jump gesture and the split step still lift the sprite off the ground
      let lift = 0;
      if (p.splitStep > 0) lift = Math.sin((p.splitStep / 12) * Math.PI) * 0.1;
      if (p.gesture?.kind === 'jump' && p.gesture.t < 160) lift = Math.abs(Math.sin(p.gesture.t * 0.16)) * 0.35;
      const s = pr.s * FIGURE_SCALE;
      const view = p.side === 1 ? 'front' : 'back';
      // the strips are right-handed: left-handers are mirrored
      if (playerSprites.draw(ctx, view, this.spriteAnimFor(p), pr.x, pr.y - lift * s, s, p.setup.hand === 'L')) return;
      // still loading or no art: fall through to the drawn figure
    }
    const pose = this.poseFor(p);
    const mirror = (p.side === 1) !== (p.setup.hand === 'L');
    let bob = 0;
    if (p.splitStep > 0) bob = Math.sin((p.splitStep / 12) * Math.PI) * 0.1;
    else if (Math.hypot(p.vx, p.vy) < 0.5) bob = Math.sin(this.time * 4 + p.idx) * 0.012;
    if (p.celebrate > 0 && (this.m.phase === 'dead' || this.m.phase === 'over')) bob = Math.abs(Math.sin(this.time * 9)) * 0.12;
    if (p.gesture?.kind === 'jump' && p.gesture.t < 160) bob = Math.abs(Math.sin(p.gesture.t * 0.16)) * 0.35;
    drawFigure(ctx, pr.x, pr.y, pr.s * FIGURE_SCALE, pose, p.setup.kit, { mirror, facingCamera: p.side === 1, twoHanded: p.setup.twoHanded, bob });
  }

  // ======================================================== HUD
  private drawHud(ctx: CanvasRenderingContext2D): void {
    const m = this.m;
    const sc = m.score;
    const [p0, p1] = m.players;
    if (!m.practice) {
      const sbH = this.drawScoreboard(ctx, 8, 8);
      // stamina bars: far player under the scoreboard, near player bottom-left.
      // (the COM's game plan is not shown during play: you have to read it from how they play)
      this.staminaBar(ctx, p1, 10, 8 + sbH + 8, p1.setup.short);
      this.staminaBar(ctx, p0, 10, H - 22, p0.setup.short);
    } else {
      const bx = 10, by = H - 34;
      ctx.fillStyle = 'rgba(10,18,34,0.62)';
      roundRect(ctx, bx - 4, by - 13, 210, 42, 9);
      ctx.fill();
      text(ctx, `PERFECT streak ${m.practiceStreak}  (best ${m.practiceBest})`, bx + 6, by, { size: 13 });
      text(ctx, `Hits ${m.practiceHits}`, bx + 6, by + 17, { size: 11, color: '#cfe3ff', weight: 700 });
      this.staminaBar(ctx, p0, 10, H - 58, p0.setup.short);
    }

    // (M21) centring icon after a human's error
    if (m.missIcon) this.drawMissIcon(ctx, m.missIcon.zone, m.missIcon.body, m.missIcon.t);

    // umpire call
    if (this.call) {
      const c = this.call;
      const a = Math.min(1, c.t * 8) * Math.min(1, (1.5 - c.t) * 4);
      const s = 1 + Math.max(0, 0.25 - c.t) * 1.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, 92);
      ctx.scale(s, s);
      ctx.fillStyle = 'rgba(10,18,34,0.72)';
      const w = Math.max(120, c.text.length * 15 + 40);
      roundRect(ctx, -w / 2, -20, w, 40, 20);
      ctx.fill();
      text(ctx, c.text, 0, 1, { size: 24, color: c.color, align: 'center', outline: 'rgba(0,0,0,0.4)' });
      ctx.restore();
    }
    if (this.banner) {
      const b = this.banner;
      const a = Math.min(1, b.t * 5) * Math.min(1, (b.life - b.t) * 4);
      ctx.save();
      ctx.globalAlpha = a;
      const y = H / 2 - 30;
      ctx.fillStyle = 'rgba(10,18,34,0.8)';
      ctx.fillRect(0, y - 30, W, b.sub ? 72 : 56);
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(0, y - 30, W, 3);
      ctx.fillRect(0, y + (b.sub ? 39 : 23), W, 3);
      text(ctx, b.text, W / 2, y - 4, { size: 28, align: 'center', color: '#fff' });
      if (b.sub) text(ctx, b.sub, W / 2, y + 22, { size: 14, align: 'center', color: '#ffd479', weight: 700 });
      ctx.restore();
    }
  }

  /** pressure tab state for the scoreboard ("BREAK POINT" etc.) */
  private tab = { label: '', t: 0 };

  /**
   * Broadcast-style scoreboard: one row per player (far player on top, like the court):
   * colour chip, name (+ ranking), serve ball, completed sets, current games, point box.
   * Returns its height.
   */
  private drawScoreboard(ctx: CanvasRenderingContext2D, x: number, y: number): number {
    const m = this.m;
    const sc = m.score;
    const key = sc.points.join() + sc.games.join() + sc.sets.join();
    if (key !== this.scoreKey) {
      if (this.scoreKey) this.scorePulse = 1;
      this.scoreKey = key;
    }
    const rowH = 20;
    const nameW = 128;
    const colW = 19;
    const sets = sc.isGamesFormat ? [] : sc.setHistory;
    const cols = sets.length + 1; // completed sets + current games
    const ptsW = 32;
    const w = 10 + nameW + cols * colW + ptsW + 4;
    const h = rowH * 2 + 4;
    const order: (0 | 1)[] = [1, 0];
    // frame
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#16284a');
    bg.addColorStop(1, '#0b1730');
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.restore();
    // event strip on the left edge
    ctx.fillStyle = '#ffb02e';
    roundRect(ctx, x, y, 4, h, 2);
    ctx.fill();
    order.forEach((pi, r) => {
      const p = m.players[pi];
      const ry = y + 2 + r * rowH;
      const cy = ry + rowH / 2;
      if (r === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 4, ry, w - 4, 1);
      }
      // colour chip (kit) + serve ball
      ctx.fillStyle = p.setup.kit.shirt;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      roundRect(ctx, x + 9, cy - 5, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
      const nm = (p.setup.name.split(' ').slice(-1)[0] || p.setup.short).toUpperCase();
      const rank = p.setup.city?.startsWith('#') ? p.setup.city : '';
      text(ctx, nm, x + 26, cy + 0.5, { size: 11, color: '#fff', maxWidth: nameW - 44 });
      if (rank) text(ctx, rank, x + nameW - 8, cy + 0.5, { size: 8, color: '#9fb6da', align: 'right', weight: 700 });
      if (sc.server === pi && sc.winner < 0) {
        ctx.fillStyle = '#d8f03a';
        ctx.beginPath();
        ctx.arc(x + nameW + 2, cy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // completed sets (winner's number bright)
      sets.forEach((s, i) => {
        const won = s[pi] > s[1 - pi];
        text(ctx, String(s[pi]), x + 10 + nameW + i * colW + colW / 2, cy + 0.5, { size: 12, align: 'center', color: won ? '#ffffff' : '#7f93b5' });
      });
      // current games (highlighted column)
      const gx = x + 10 + nameW + sets.length * colW;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(gx, ry + 1, colW, rowH - 2);
      text(ctx, String(sc.games[pi]), gx + colW / 2, cy + 0.5, { size: 12, align: 'center', color: '#ffffff' });
      // point box
      const px = gx + colW + 2;
      const flash = this.scorePulse;
      ctx.fillStyle = `rgb(${Math.round(255 - 20 * (1 - flash))},${Math.round(196 + 50 * flash)},${Math.round(46 + 160 * flash)})`;
      roundRect(ctx, px, ry + 2, ptsW - 2, rowH - 4, 3);
      ctx.fill();
      const lbl = sc.winner >= 0 ? '' : sc.pointLabel(pi);
      text(ctx, lbl, px + (ptsW - 2) / 2, cy + 0.5, { size: 12, align: 'center', color: '#13284a' });
    });
    // pressure tab sliding out to the right
    const label = sc.pressureLabel();
    if (label !== this.tab.label) this.tab = { label, t: 0 };
    if (label) {
      const k = Math.min(1, this.tab.t * 4);
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.font = font(10);
      const tw = ctx.measureText(label).width + 18;
      ctx.beginPath();
      ctx.rect(x + w, y, tw + 4, h);
      ctx.clip();
      const tx = x + w - tw + tw * e + 2;
      ctx.fillStyle = label === 'MATCH POINT' ? '#e0393e' : label === 'TIEBREAK' ? '#3a7bd5' : '#ff8a1e';
      roundRect(ctx, tx, y + h / 2 - 10, tw, 20, 4);
      ctx.fill();
      ctx.restore();
      if (e > 0.6) text(ctx, label, x + w + 2 + tw / 2, y + h / 2 + 0.5, { size: 10, align: 'center', color: '#fff' });
    }
    return h;
  }


  private staminaBar(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, label: string): void {
    const f = p.staminaF();
    const w = 90;
    ctx.fillStyle = 'rgba(10,18,34,0.6)';
    roundRect(ctx, x - 4, y - 2, w + 52, 14, 7);
    ctx.fill();
    text(ctx, label, x, y + 5, { size: 9, color: '#fff', weight: 800 });
    const bx = x + 40;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, bx, y + 1, w, 8, 4);
    ctx.fill();
    const low = f < T.lowStamina / 100;
    const crit = f < 0.2;
    let col = f > 0.6 ? '#5fe07a' : f > 0.4 ? '#f2d23a' : '#ff4a3a';
    if (crit && Math.sin(this.time * 12) > 0) col = '#ff9a8a';
    ctx.fillStyle = col;
    roundRect(ctx, bx, y + 1, Math.max(4, w * f), 8, 4);
    ctx.fill();
    if (low) text(ctx, 'TIRED', bx + w + 4, y + 5, { size: 8, color: '#ff8a7a', weight: 800 });
    if (p.human) this.fatigueInfo(ctx, p, x - 4, y, y > H / 2);
    if (p.human || this.m.practice) this.accelPips(ctx, p, x + (p.human ? 236 : 174), y);
  }

  /** (M21) good accelerations left this point; smoke once they are used up */
  private accelPips(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number): void {
    const n = p.accelQuota;
    const w = 26 + n * 9;
    ctx.fillStyle = 'rgba(10,18,34,0.6)';
    roundRect(ctx, x, y - 2, w, 14, 7);
    ctx.fill();
    text(ctx, 'ACC', x + 6, y + 5, { size: 8, color: '#d6e4f7', weight: 800 });
    for (let i = 0; i < n; i++) {
      const left = i < n - p.accelUsed;
      ctx.fillStyle = left ? '#ffd23a' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x + 28 + i * 9, y + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.accelUsed > n) text(ctx, `+${p.accelUsed - n}`, x + w + 3, y + 5, { size: 8, color: '#b9c2cc', weight: 800 });
  }

  /** (M21) after an error: how was it struck? green centred, orange off-centre, red into the body / at full stretch */
  private drawMissIcon(ctx: CanvasRenderingContext2D, zone: Zone, body: boolean, t: number): void {
    const a = Math.min(1, t / 6) * Math.min(1, (150 - t) / 20);
    const x = W - 46, y = H - 74, s = 30;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = ZONE_COLOR[zone];
    roundRect(ctx, x, y, s, s, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,18,34,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // a little player hitting the ball: body, racket, ball
    ctx.strokeStyle = '#13284a';
    ctx.fillStyle = '#13284a';
    ctx.beginPath();
    ctx.arc(x + 11, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + 11, y + 11);
    ctx.lineTo(x + 11, y + 20);
    ctx.lineTo(x + 7, y + 27);
    ctx.moveTo(x + 11, y + 20);
    ctx.lineTo(x + 15, y + 27);
    ctx.moveTo(x + 11, y + 14);
    ctx.lineTo(x + 18, y + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 21, y + 14, 3, 4, 0.3, 0, Math.PI * 2);
    ctx.stroke();
    const bx = zone === 'green' ? x + 25 : body ? x + 13 : x + 28;
    ctx.fillStyle = '#e8ff5a';
    ctx.beginPath();
    ctx.arc(bx, y + 14, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const label = zone === 'green' ? 'CENTRED' : body ? (zone === 'red' ? 'INTO BODY' : 'TOO CLOSE') : zone === 'red' ? 'FULL STRETCH' : 'OFF-CENTRE';
    text(ctx, label, x + s / 2, y + s + 9, { size: 8, align: 'center', color: '#fff', outline: '#13284a', weight: 800, alpha: a });
  }

  /** "H" hint chip next to a human's stamina bar, and (when toggled on) what tiredness costs right now */
  private fatigueInfo(ctx: CanvasRenderingContext2D, p: Player, x: number, barY: number, above: boolean): void {
    const open = settings.fatigueInfo;
    const hx = x + 174; // after the bar and its "TIRED" tag
    ctx.fillStyle = open ? 'rgba(255,212,121,0.9)' : 'rgba(10,18,34,0.6)';
    roundRect(ctx, hx, barY - 2, open ? 16 : 54, 14, 7);
    ctx.fill();
    text(ctx, open ? 'H' : 'H  fatigue', hx + (open ? 8 : 27), barY + 5, { size: 8, align: 'center', color: open ? '#13284a' : '#d6e4f7', weight: 800 });
    if (!open) return;
    const effects = fatigueEffects(p.staminaF());
    const rowH = 12;
    const w = 168;
    const h = 20 + effects.length * rowH;
    const y = above ? barY - 6 - h : barY + 18;
    ctx.fillStyle = 'rgba(10,18,34,0.78)';
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    text(ctx, `FATIGUE  â€¢  stamina ${Math.round(p.stamina)}%`, x + 8, y + 10, { size: 9, color: '#ffd479', weight: 800 });
    effects.forEach((e, i) => {
      const yy = y + 22 + i * rowH;
      const pct = Math.round(e.delta * 100);
      text(ctx, e.label, x + 8, yy, { size: 9, color: '#d6e4f7', weight: 700 });
      text(ctx, pct === 0 ? 'OK' : `${pct}%`, x + w - 8, yy, { size: 9, align: 'right', color: pct === 0 ? '#7fe08f' : pct > -10 ? '#f2d23a' : '#ff8a7a', weight: 800 });
    });
  }

  private drawPopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.popups) {
      const k = p.t / p.life;
      const a = Math.min(1, (1 - k) * 4);
      const yy = p.y - 8 - k * 18;
      const pop = p.t < 0.12 ? 1 + (0.12 - p.t) * 3 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, yy);
      ctx.scale(pop, pop);
      const size = p.big ? 17 : 12;
      text(ctx, p.text, 0, 0, { size, color: p.color, align: 'center', outline: 'rgba(10,18,34,0.85)', outlineWidth: 4 });
      if (p.sub) text(ctx, p.sub, 0, size * 0.95, { size: p.big ? 10 : 8, color: '#fff', align: 'center', outline: 'rgba(10,18,34,0.85)', outlineWidth: 3, weight: 700 });
      ctx.restore();
    }
  }
}
