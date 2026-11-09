import { game, W, H } from '../core/game';
import { MenuScene, MenuEntry, cycle } from './menu-base';
import { drawSetupScreen } from './setup-common';
import { SurfaceId, SURFACES } from '../data/surfaces';
import { humanSetup } from '../data/defaults';
import { roster, proSetup } from '../data/roster';
import { Controller } from '../core/input';
import { MatchScene } from './match';
import { TitleScene } from './title';
import { SURF_IDS } from './exhibition';
import { settings, keyLabel, Action } from '../core/settings';
import { STRIKES, StrikeId } from '../match/strike';
import { ShotType } from '../data/types';
import { PracticeFeed, Match } from '../match/match';
import { panel, roundRect } from '../gfx/ui';
import { text, wrap } from '../gfx/text';
import { audio } from '../core/audio';
import { input } from '../core/input';
import { HALF_LEN, SERVICE_Y } from '../data/court';
import { matchCam } from '../gfx/camera';
import { TacticsSchool } from './tactics-school';

const FEEDS: (ShotType | 'random')[] = ['normal', 'topspin', 'slice', 'lob', 'random'];
const FEED_LABEL: Record<string, string> = { normal: 'Normal', topspin: 'Topspin', slice: 'Slice', lob: 'Lob', random: 'Random mix' };
const SIDES: PracticeFeed['side'][] = ['fh', 'bh', 'mix'];
const SPEEDS = [0.75, 1.0, 1.25];

export class PracticeSetup extends MenuScene {
  name = 'practice';
  feed: ShotType | 'random' = 'normal';
  side: PracticeFeed['side'] = 'mix';
  speed = 1.0;
  surface: SurfaceId = 'hard';
  items(): MenuEntry[] {
    return [
      { id: 'tutorial', label: 'Tutorial (start here!)', action: () => startTutorial(this.surface) },
      { id: 'school', label: 'Tactics School', hint: '8 lessons on real singles tactics, each with a drill', action: () => game.goto(new TacticsSchool(this.surface, () => game.goto(new PracticeSetup()))) },
      { id: 'feed', label: 'Ball machine feed', value: FEED_LABEL[this.feed], change: (d) => (this.feed = cycle(FEEDS, this.feed, d)) },
      { id: 'side', label: 'Feed to', value: { fh: 'Forehand', bh: 'Backhand', mix: 'Both sides' }[this.side], change: (d) => (this.side = cycle(SIDES, this.side, d)) },
      { id: 'speed', label: 'Feed speed', value: { 0.75: 'Slow', 1: 'Medium', 1.25: 'Fast' }[this.speed] ?? 'Medium', change: (d) => (this.speed = cycle(SPEEDS, this.speed, d)) },
      { id: 'surface', label: 'Surface', value: SURFACES[this.surface].name, change: (d) => (this.surface = cycle(SURF_IDS, this.surface, d)) },
      { id: 'machine', label: 'Start ball machine', action: () => startPractice({ type: this.feed, side: this.side, speed: this.speed, interval: 70 }, this.surface) },
      { id: 'serve', label: 'Serve practice', action: () => startPractice({ type: 'normal', side: 'mix', speed: 1, interval: 70, serve: true }, this.surface) },
      { id: 'back', label: 'Back', action: () => game.goto(new TitleScene()) },
    ];
  }
  onBack(): void {
    game.goto(new TitleScene());
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawSetupScreen(ctx, this.t, 'PRACTICE', this.items(), this.sel, 'The court preview is always on in practice. Esc to leave.', this.surface);
  }
}

export function practiceMatch(feed: PracticeFeed, surface: SurfaceId, extra: Partial<ConstructorParameters<typeof MatchScene>[1]> = {}): MatchScene {
  const me = humanSetup();
  const machine = proSetup(roster()[0], 'BALL MACHINE');
  return new MatchScene({
    surface, format: { kind: 'games', target: 99 }, players: [me, machine], controllers: [new Controller('p1', 'solo', 0), null],
    difficulty: settings.difficulty, seed: 77, practice: feed,
  }, { onEnd: () => game.goto(new PracticeSetup()), onQuit: () => game.goto(new PracticeSetup()), practiceOverlay: drawLanding, ...extra });
}

/** Marks where the player's last shot first bounced (green ring = in, red cross = out) until the next feed. */
export function drawLanding(ctx: CanvasRenderingContext2D, m: Match): void {
  const r = m.rally;
  if (!m.practice || m.practice.serve || r.lastHitter !== 0 || r.bounces < 1) return;
  const inside = r.firstBounceIn;
  const c = matchCam.project(r.bounceX, r.bounceY, 0);
  const pulse = 1 + 0.15 * Math.sin(m.frame * 0.25);
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = inside ? '#9ef07a' : '#ff7a6a';
  ctx.beginPath();
  const rx = 0.45 * c.s * pulse;
  ctx.ellipse(c.x, c.y, rx, rx * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (!inside) {
    ctx.beginPath();
    ctx.moveTo(c.x - 5, c.y - 5);
    ctx.lineTo(c.x + 5, c.y + 5);
    ctx.moveTo(c.x + 5, c.y - 5);
    ctx.lineTo(c.x - 5, c.y + 5);
    ctx.stroke();
  }
  ctx.restore();
  text(ctx, inside ? 'IN' : 'OUT', c.x, c.y - 12, { size: 10, align: 'center', color: inside ? '#9ef07a' : '#ff9a8a', outline: '#13284a' });
  if (r.dead) text(ctx, `${keyLabel(settings.keys.solo.b1[0])}  next ball`, W - 14, H - 14, { size: 10, align: 'right', color: '#d6e4f7', outline: '#13284a', weight: 700 });
}

export function startPractice(feed: PracticeFeed, surface: SurfaceId): void {
  game.goto(practiceMatch(feed, surface));
}

// ---------------------------------------------------------------- tutorial
interface Step {
  title: string;
  body: string;
  goal: number;
  feed?: PracticeFeed;
  /** counts progress from an event */
  check?: (e: Match['events'][number], m: Match, st: TutState) => boolean;
  manual?: boolean;
}

interface TutState {
  step: number;
  count: number;
  moved: number;
  lastX: number;
  lastY: number;
  done: boolean;
  doneT: number;
  awaitBounce: boolean;
  /** goal reached: wait for the current ball to play out before the next step */
  pending: boolean;
  pendingT: number;
}

function K(a: Action): string {
  return keyLabel(settings.keys.solo[a][0]);
}

/** a tutorial step that wants one hit of each listed strike */
function eachStrike(st: TutState, e: Match['events'][number], ids: StrikeId[]): boolean {
  if (e.t !== 'hit' || e.p !== 0 || e.grade === 'MISHIT') return false;
  const i = ids.indexOf(e.strike);
  if (i < 0 || st.lastX & (1 << i)) return false;
  st.lastX |= 1 << i;
  return true;
}

function steps(): Step[] {
  const feed = (type: ShotType | 'random', side: PracticeFeed['side'] = 'mix', speed = 0.85): PracticeFeed => ({ type, side, speed, interval: 75 });
  const b1 = K('b1'), b2 = K('b2'), acc = K('acc');
  return [
    { title: 'Move', body: `Use the arrow keys (${K('left')} ${K('right')} ${K('up')} ${K('down')}) to run around your half of the court.`, goal: 1, feed: { ...feed('normal'), interval: 99999 }, manual: false },
    {
      title: 'Hold to strike',
      body: `Press and HOLD ${b1} (or Space) before the ball reaches you, and keep holding: you hit it by yourself. While you hold, you walk to the ball on your own (the green spot). The ring at your feet fills up: the earlier you press, the more accurate the shot. Hit 3 balls holding for at least half a second.`,
      goal: 3, feed: feed('normal', 'fh', 0.8),
      check: (e) => e.t === 'hit' && e.p === 0 && e.prep >= 0.45 && e.grade !== 'MISHIT',
    },
    {
      title: 'Aim by sweeping',
      body: `While holding ${b1}, push ${K('left')} or ${K('right')}: the aim (white circle on the other side) slides that way the longer you push, and drifts back to the middle when you let go. Too long and it goes wide! Land one shot in each half.`,
      goal: 2, feed: feed('normal'),
      check: (e, m, st) => {
        if (e.t === 'hit' && e.p === 0) st.awaitBounce = true;
        if (e.t === 'bounce' && st.awaitBounce && e.y > 0 && e.y < HALF_LEN) {
          st.awaitBounce = false;
          const side = e.x < -1 ? 1 : e.x > 1 ? 2 : 0;
          if (side && !(st.lastX & side)) {
            st.lastX |= side;
            return true;
          }
        }
        return false;
      },
    },
    {
      title: 'Danger zone',
      body: 'After the bounce the ball is still rising: the red and orange band. Hit it there and you lose control or accuracy. Meet it on a green spot, past the danger, at the side of your body (not into it). Hit 3 clean balls from a green spot.',
      goal: 3, feed: feed('normal', 'mix', 0.9),
      check: (e) => e.t === 'hit' && e.p === 0 && e.danger === 'green' && e.centre === 'green' && e.grade !== 'SAFE',
    },
    {
      title: `Strike 1 (${b1})`,
      body: `${b1} alone is the normal rally ball. Hold ${K('up')} with it (toward the net) for a SHORT angled strike, or ${K('down')} for TOPSPIN. Hit one short strike and one topspin.`,
      goal: 2, feed: feed('normal'),
      check: (e, m, st) => eachStrike(st, e, ['short', 'topspin']),
    },
    {
      title: `Strike 2 (${b2})`,
      body: `${b2} alone is a SLICE. ${b2} + ${K('up')} is a DROP SHOT, ${b2} + ${K('down')} a defensive LOB. Hit one of each.`,
      goal: 3, feed: feed('normal'),
      check: (e, m, st) => eachStrike(st, e, ['slice', 'drop', 'lob']),
    },
    {
      title: 'Acceleration',
      body: `Hold ${b1} + ${b2} together (or ${acc}) for an ACCELERATION: a fast attacking ball, fastest at the top of the bounce. You only get a few good ones per point (the yellow ACC pips); after that they get wild and your racket smokes. Hit 2 accelerations.`,
      goal: 2, feed: feed('normal', 'mix', 0.8),
      check: (e) => e.t === 'hit' && e.p === 0 && STRIKES[e.strike].accel && e.grade !== 'MISHIT',
    },
    {
      title: 'Serve',
      body: `Press ${b1} to toss and keep HOLDING it: the serve goes off by itself at the top. ${K('left')}/${K('right')} sweeps the aim across the box while you hold. Land 2 serves in the box.`,
      goal: 2,
      feed: { type: 'normal', side: 'mix', speed: 1, interval: 70, serve: true },
      check: (e) => e.t === 'call' && e.text === 'IN!',
    },
    {
      title: 'Serve types',
      body: `${b1} = NORMAL serve (in ~85%), ${b1} + ${b2} = STRONG (fast, in ~70%), ${b2} = SAFE (always in, slower). Hold ${K('up')} for slice, ${K('down')} for kick. Hit one STRONG and one SAFE serve.`,
      goal: 2,
      feed: { type: 'normal', side: 'mix', speed: 1, interval: 70, serve: true },
      check: (e, m, st) => {
        if (e.t === 'serve' && e.p === 0 && e.force !== 'normal') {
          const bit = e.force === 'strong' ? 16 : 32;
          if (!(st.lastX & bit)) {
            st.lastX |= bit;
            return true;
          }
        }
        return false;
      },
    },
    {
      title: 'Stamina and gestures',
      body: `Sprinting, accelerations and long rallies drain your stamina (bottom left). Tired, you run slower and your aim zone grows. After a point, press ${K('gesture')} + an arrow for a gesture. Release the button just before a serve to rush the net sooner. Press Space to finish the tutorial!`,
      goal: 1,
      feed: { ...feed('normal'), interval: 99999 }, manual: true,
    },
  ];
}

/** frames to show a finished step's last shot before moving on (~0.75 s) */
const TUT_STEP_PAUSE = 45;

export function startTutorial(surface: SurfaceId): void {
  game.goto(makeTutorial(surface));
}

export function makeTutorial(surface: SurfaceId): MatchScene {
  const S = steps();
  const st: TutState = { step: 0, count: 0, moved: 0, lastX: 0, lastY: 0, done: false, doneT: 0, awaitBounce: false, pending: false, pendingT: 0 };
  let ms: MatchScene;
  const advance = (m: Match) => {
    st.pending = false;
    st.pendingT = 0;
    st.step++;
    st.count = 0;
    st.lastX = 0;
    st.lastY = 0;
    audio.sfx('ding');
    if (st.step >= S.length) {
      st.done = true;
      game.goto(new PracticeSetup());
      return;
    }
    const f = S[st.step].feed;
    if (f) m.setPractice(f);
  };
  const onEvent = (e: Match['events'][number], m: Match) => {
    const s = S[st.step];
    if (!s || !s.check || st.pending) return;
    if (s.check(e, m, st)) {
      st.count++;
      audio.sfx('menu_ok');
      if (st.count >= s.goal) st.pending = true;
    }
  };
  const onUpdate = (m: Match) => {
    const s = S[st.step];
    if (!s || st.done) return;
    if (st.pending) {
      // let the shot finish (bounce out, net or second bounce), show the result, then move on
      const finished = m.rally.dead || (!m.ballLive && !m.ballVisible);
      if (finished) st.pendingT++;
      if (st.pendingT >= TUT_STEP_PAUSE || (st.pendingT > 15 && input.menu('ok'))) advance(m);
      return;
    }
    if (st.step === 0) {
      const p = m.players[0];
      st.moved += Math.hypot(p.vx, p.vy) / 60;
      if (st.moved > 6) advance(m);
    }
    if (s.manual && input.menu('ok')) advance(m);
  };
  const overlay = (ctx: CanvasRenderingContext2D, m: Match) => {
    const s = S[st.step];
    if (!s) return;
    drawLanding(ctx, m);
    if (st.pending) text(ctx, 'STEP COMPLETE!', W / 2, 150, { size: 20, align: 'center', color: '#9ef07a', outline: '#13284a' });
    const w = 420;
    const lines = wrap(ctx, s.body, 11, w - 24, 700);
    const h = 44 + lines.length * 15;
    panel(ctx, (W - w) / 2, 8, w, h, 0.85);
    text(ctx, `TUTORIAL ${st.step + 1}/${S.length}: ${s.title.toUpperCase()}`, (W - w) / 2 + 12, 24, { size: 13, color: '#ffc04a' });
    lines.forEach((l, i) => text(ctx, l, (W - w) / 2 + 12, 44 + i * 15, { size: 11, weight: 700 }));
    // progress pips
    for (let i = 0; i < s.goal; i++) {
      ctx.fillStyle = i < st.count ? '#9ef07a' : 'rgba(255,255,255,0.25)';
      roundRect(ctx, (W + w) / 2 - 16 - (s.goal - i) * 16, 18, 12, 12, 6);
      ctx.fill();
    }
    if (st.step === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(ctx, (W - w) / 2 + 12, h - 2, w - 24, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#9ef07a';
      roundRect(ctx, (W - w) / 2 + 12, h - 2, (w - 24) * Math.min(1, st.moved / 6), 6, 3);
      ctx.fill();
    }
  };
  ms = practiceMatch(S[0].feed!, surface, { onEvent, onUpdate, practiceOverlay: overlay });
  ms.name = 'tutorial';
  const base = ms.debugState.bind(ms);
  ms.debugState = () => ({ ...base(), tutStep: st.step, tutCount: st.count, tutTitle: S[st.step]?.title, tutPending: st.pending });
  return ms;
}

void H;
