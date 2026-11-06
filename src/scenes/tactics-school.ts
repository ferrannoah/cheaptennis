import { Scene, game, W, H } from '../core/game';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { loadJSON, saveJSON } from '../core/save';
import { MenuScene, MenuEntry } from './menu-base';
import { drawSetupScreen } from './setup-common';
import { MatchScene } from './match';
import { practiceMatch, drawLanding } from './practice';
import { Match } from '../match/match';
import { LESSONS, Lesson, ShotResult, Zone } from '../data/lessons';
import { TACTICS } from '../data/tactics';
import { SurfaceId } from '../data/surfaces';
import { HALF_W, SERVICE_Y } from '../data/court';
import { DEFAULT_KIT, ShotType } from '../data/types';
import { drawBackdrop } from '../gfx/backdrop';
import { panel, roundRect } from '../gfx/ui';
import { text, wrap } from '../gfx/text';
import { matchCam } from '../gfx/camera';
import { drawFigure, POSES } from '../gfx/player-renderer';

const SAVE_KEY = 'lessons';
type Progress = Record<string, boolean>;
export const loadProgress = (): Progress => loadJSON<Progress>(SAVE_KEY, {});
function markDone(id: string): void {
  const p = loadProgress();
  p[id] = true;
  saveJSON(SAVE_KEY, p);
}

/** Lesson list. */
export class TacticsSchool extends MenuScene {
  name = 'tactics';
  constructor(public surface: SurfaceId = 'hard', public back: () => void = () => {}) {
    super();
  }
  items(): MenuEntry[] {
    const done = loadProgress();
    const list: MenuEntry[] = LESSONS.map((l, i) => ({
      id: l.id,
      label: `${i + 1}. ${l.title}${done[l.id] ? '  ✓' : ''}`,
      hint: `Game plan: ${TACTICS[l.tactic].name}`,
      action: () => game.goto(new LessonCard(l, 'intro', this.surface, this.back)),
    }));
    list.push({ id: 'back', label: 'Back', action: () => this.back() });
    return list;
  }
  onBack(): void {
    this.back();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawSetupScreen(ctx, this.t, 'TACTICS SCHOOL', this.items(), this.sel, 'Real singles tactics: learn the idea, then drill it', this.surface);
    const n = LESSONS.filter((l) => loadProgress()[l.id]).length;
    text(ctx, `${n}/${LESSONS.length} lessons complete`, W / 2, 80, { size: 12, align: 'center', color: '#ffd479', outline: '#13284a', weight: 700 });
  }
  debugState(): Record<string, unknown> {
    return { sel: this.sel, done: loadProgress() };
  }
}

/** Intro card (idea + drill) or summary card (takeaway). */
export class LessonCard implements Scene {
  name = 'lesson-card';
  t = 0;
  constructor(public lesson: Lesson, public mode: 'intro' | 'done', public surface: SurfaceId, public back: () => void) {}
  update(): void {
    this.t += 1 / 60;
    if (this.t < 0.25) return;
    if (input.menu('ok')) {
      audio.sfx('menu_ok');
      if (this.mode === 'intro') game.goto(makeLessonMatch(this.lesson, this.surface, this.back));
      else game.goto(new TacticsSchool(this.surface, this.back));
    } else if (input.menu('back')) {
      audio.sfx('menu_back');
      game.goto(new TacticsSchool(this.surface, this.back));
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const l = this.lesson;
    drawBackdrop(ctx, this.t, this.surface, false);
    ctx.fillStyle = 'rgba(6,12,26,0.45)';
    ctx.fillRect(0, 0, W, H);
    const pw = 540;
    const px = (W - pw) / 2;
    const idx = LESSONS.indexOf(l) + 1;
    const paras = this.mode === 'intro' ? [...l.intro, 'DRILL: ' + l.drill] : [l.takeaway];
    const lines: { s: string; c: string }[] = [];
    for (const p of paras) {
      const col = p.startsWith('DRILL:') ? '#ffd479' : '#ffffff';
      for (const s of wrap(ctx, p, 12, pw - 40, 700)) lines.push({ s, c: col });
      lines.push({ s: '', c: col });
    }
    const ph = 92 + lines.length * 16 + (this.mode === 'done' ? 30 : 0);
    const py = Math.max(30, (H - ph) / 2 - 10);
    panel(ctx, px, py, pw, ph, 0.9);
    text(ctx, this.mode === 'intro' ? `LESSON ${idx}` : 'LESSON COMPLETE!', W / 2, py + 24, { size: 13, align: 'center', color: this.mode === 'intro' ? '#ffc04a' : '#9ef07a' });
    text(ctx, l.title, W / 2, py + 50, { size: 20, align: 'center', maxWidth: pw - 30 });
    lines.forEach((ln, i) => text(ctx, ln.s, px + 20, py + 80 + i * 16, { size: 12, color: ln.c, weight: 700 }));
    if (this.mode === 'done') {
      const tac = TACTICS[l.tactic];
      ctx.fillStyle = tac.color;
      roundRect(ctx, W / 2 - 150, py + ph - 42, 300, 22, 11);
      ctx.fill();
      text(ctx, `Pro pattern: the ${tac.name} game plan`, W / 2, py + ph - 31, { size: 11, align: 'center', color: '#13284a' });
    }
    if (Math.sin(this.t * 5) > -0.3) text(ctx, this.mode === 'intro' ? 'Press Space to start the drill  •  Esc: back' : 'Press Space to continue', W / 2, Math.min(H - 20, py + ph + 26), { size: 15, align: 'center', outline: '#13284a' });
  }
  debugState(): Record<string, unknown> {
    return { lesson: this.lesson.id, mode: this.mode };
  }
}

interface DrillState {
  counts: Record<string, number>;
  k: number;
  cur: (Omit<ShotResult, 'landX' | 'landY' | 'inside' | 'recovered'> & { k: number }) | null;
  pending: boolean;
  pendingT: number;
  flash: { text: string; ok: boolean; t: number } | null;
  results: number;
  /** x the target zones are drawn for: the incoming ball's bounce, then the player's contact point */
  zoneX: number;
}

const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** The drill: a practice match with lesson rules, target zones, an optional stand-in opponent. */
export function makeLessonMatch(lesson: Lesson, surface: SurfaceId, back: () => void): MatchScene {
  const st: DrillState = { counts: Object.fromEntries(Object.keys(lesson.need).map((k) => [k, 0])), k: 0, cur: null, pending: false, pendingT: 0, flash: null, results: 0, zoneX: 0 };
  const isServe = !!lesson.feed.serve;
  const complete = () => Object.entries(lesson.need).every(([c, n]) => st.counts[c] >= n);
  const toSchool = () => game.goto(new TacticsSchool(surface, back));

  const judge = (r: ShotResult, k: number) => {
    st.results++;
    const cat = lesson.classify(r, k);
    if (cat && st.counts[cat] !== undefined && st.counts[cat] < lesson.need[cat]) {
      st.counts[cat]++;
      st.flash = { text: 'NICE!', ok: true, t: 0 };
      audio.sfx('menu_ok');
      if (complete()) st.pending = true;
    } else if (!cat) miss();
  };
  const miss = () => {
    if (lesson.streak && total(st.counts) > 0) {
      for (const c of Object.keys(st.counts)) st.counts[c] = 0;
      st.flash = { text: 'STREAK RESET', ok: false, t: 0 };
    } else st.flash = { text: 'NOT QUITE', ok: false, t: 0 };
  };

  const onEvent = (e: Match['events'][number], m: Match) => {
    if (st.pending) return;
    const p = m.players[0];
    switch (e.t) {
      case 'feed':
        st.k++;
        st.zoneX = m.predicted ? m.predicted.x : p.x;
        break;
      case 'hit':
        if (e.p === 0) {
          st.cur = { hitX: p.x, hitY: e.cy, shot: e.shot, good: e.grade === 'GOOD' || e.grade === 'PERFECT', k: st.k };
          st.zoneX = p.x;
        }
        break;
      case 'serve':
        if (e.p === 0) st.cur = { hitX: p.x, hitY: p.y, shot: 'serve', good: e.grade === 'GOOD' || e.grade === 'PERFECT', k: m.practiceServes };
        break;
      case 'whiff':
        if (e.p === 0) miss();
        break;
      case 'net':
        if (st.cur) {
          st.cur = null;
          miss();
        }
        break;
      case 'bounce': {
        const c = st.cur;
        if (!c || m.rally.bounces !== 1) break;
        if (c.shot !== 'serve' && m.rally.lastHitter !== 0) break;
        st.cur = null;
        let inside: boolean;
        if (c.shot === 'serve') inside = e.y > 0 && e.y <= SERVICE_Y + 0.034 && Math.abs(e.x) <= HALF_W + 0.034 && Math.sign(e.x) !== Math.sign(c.hitX);
        else inside = m.rally.firstBounceIn;
        judge({ ...c, landX: e.x, landY: e.y, inside, recovered: Math.abs(p.x) <= 1.5 }, c.k);
        break;
      }
    }
  };

  const onUpdate = (m: Match) => {
    if (st.flash) st.flash.t += 1 / 60;
    if (st.flash && st.flash.t > 1.1) st.flash = null;
    if (isServe) st.k = m.practiceServes;
    if (!st.pending) return;
    const finished = m.rally.dead || (!m.ballLive && !m.ballVisible);
    if (finished) st.pendingT++;
    if (st.pendingT >= 45 || (st.pendingT > 15 && input.menu('ok'))) {
      st.pending = false;
      markDone(lesson.id);
      audio.sfx('ding');
      game.goto(new LessonCard(lesson, 'done', surface, back));
    }
  };

  const overlay = (ctx: CanvasRenderingContext2D, m: Match) => {
    const p = m.players[0];
    // target zones (on the far court), anchored to where the player hits from (not where they run to)
    for (const z of lesson.zones(isServe ? p.x : st.zoneX, st.k)) drawZone(ctx, z, m.frame);
    // stand-in opponent
    const d = lesson.dummy?.(st.k);
    if (d) {
      const c = matchCam.project(d.x, d.y, 0);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 0.45 * c.s, 0.18 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
      drawFigure(ctx, c.x, c.y, c.s, POSES.ready, { ...DEFAULT_KIT, shirt: '#d9534f', shorts: '#2b2b2b' }, { mirror: false, facingCamera: true, twoHanded: true, bob: 0 });
      ctx.restore();
    }
    if (!isServe) drawLanding(ctx, m);
    // lesson panel
    const w = 440;
    const lines = wrap(ctx, lesson.drill, 11, w - 24, 700);
    const h = 44 + lines.length * 14;
    panel(ctx, (W - w) / 2, 8, w, h, 0.85);
    text(ctx, lesson.title.toUpperCase(), (W - w) / 2 + 12, 24, { size: 12, color: '#ffc04a', maxWidth: w - 140 });
    lines.forEach((l, i) => text(ctx, l, (W - w) / 2 + 12, 42 + i * 14, { size: 11, weight: 700 }));
    // progress pips (one row per category)
    let px = (W + w) / 2 - 14;
    for (const [cat, n] of Object.entries(lesson.need).reverse()) {
      for (let i = n - 1; i >= 0; i--) {
        ctx.fillStyle = i < st.counts[cat] ? '#9ef07a' : 'rgba(255,255,255,0.25)';
        roundRect(ctx, px - 12, 16, 11, 11, 5.5);
        ctx.fill();
        px -= 14;
      }
      if (Object.keys(lesson.need).length > 1) {
        text(ctx, cat.toUpperCase(), px - 2, 22, { size: 8, align: 'right', color: '#bcd0ee' });
        px -= 30;
      }
    }
    text(ctx, '▶ ' + lesson.aimText(st.k), W / 2, h + 24, { size: 12, align: 'center', color: '#ffd479', outline: '#13284a', weight: 700 });
    if (st.flash) {
      const a = Math.max(0, 1 - st.flash.t / 1.1);
      ctx.save();
      ctx.globalAlpha = a;
      text(ctx, st.flash.text, W / 2, 150 - st.flash.t * 20, { size: 22, align: 'center', color: st.flash.ok ? '#9ef07a' : '#ff9a8a', outline: '#13284a' });
      ctx.restore();
    }
    if (st.pending) text(ctx, 'DRILL COMPLETE!', W / 2, 190, { size: 22, align: 'center', color: '#9ef07a', outline: '#13284a' });
  };

  const ms = practiceMatch(lesson.feed, surface, { onEvent, onUpdate, practiceOverlay: overlay, onQuit: toSchool, onEnd: toSchool });
  ms.name = 'lesson';
  const base = ms.debugState.bind(ms);
  ms.debugState = () => ({ ...base(), lesson: lesson.id, counts: { ...st.counts }, k: st.k, results: st.results, lessonPending: st.pending });
  /** test autopilot + future coach mode: where a good player would aim right now */
  (ms as unknown as { lessonHint: () => { x: number; d: number; shot?: ShotType; serveAim?: number } }).lessonHint = () => lesson.hint(ms.m.players[0].x, st.k);
  return ms;
}

function drawZone(ctx: CanvasRenderingContext2D, z: Zone, frame: number): void {
  const pts = [matchCam.project(z.x0, z.y0, 0), matchCam.project(z.x1, z.y0, 0), matchCam.project(z.x1, z.y1, 0), matchCam.project(z.x0, z.y1, 0)];
  ctx.save();
  ctx.fillStyle = `rgba(255,212,121,${0.16 + 0.06 * Math.sin(frame * 0.08)})`;
  ctx.strokeStyle = 'rgba(255,212,121,0.85)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (z.label) {
    const c = matchCam.project((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, 0);
    text(ctx, z.label, c.x, c.y, { size: 9, align: 'center', color: '#ffe7a8', outline: '#13284a' });
  }
}
