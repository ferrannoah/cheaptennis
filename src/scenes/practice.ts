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
import { settings, keyLabel } from '../core/settings';
import { ShotType } from '../data/types';
import { PracticeFeed, Match } from '../match/match';
import { panel, roundRect } from '../gfx/ui';
import { text, wrap } from '../gfx/text';
import { audio } from '../core/audio';
import { input } from '../core/input';
import { HALF_LEN, SERVICE_Y } from '../data/court';

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
    drawSetupScreen(ctx, this.t, 'PRACTICE', this.items(), this.sel, 'Training HUD is always on in practice. Esc to leave.', this.surface);
  }
}

export function practiceMatch(feed: PracticeFeed, surface: SurfaceId, extra: Partial<ConstructorParameters<typeof MatchScene>[1]> = {}): MatchScene {
  const me = humanSetup();
  const machine = proSetup(roster()[0], 'BALL MACHINE');
  return new MatchScene({
    surface, format: { kind: 'games', target: 99 }, players: [me, machine], controllers: [new Controller('p1', 'solo', 0), null],
    difficulty: settings.difficulty, seed: 77, practice: feed,
  }, { onEnd: () => game.goto(new PracticeSetup()), onQuit: () => game.goto(new PracticeSetup()), ...extra });
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
}

function K(a: 'normal' | 'topspin' | 'slice' | 'lob' | 'drop' | 'left' | 'right' | 'up' | 'down'): string {
  return keyLabel(settings.keys.solo[a][0]);
}

function steps(): Step[] {
  const feed = (type: ShotType | 'random', side: PracticeFeed['side'] = 'mix', speed = 0.85): PracticeFeed => ({ type, side, speed, interval: 75 });
  const shotStep = (type: ShotType, key: string, title: string, body: string): Step => ({
    title, body: `${body} Press ${key}.`, goal: 2, feed: feed('normal'),
    check: (e) => e.t === 'hit' && e.p === 0 && e.shot === type && e.grade !== 'MISHIT',
  });
  return [
    { title: 'Move', body: `Use the arrow keys (${K('left')} ${K('right')} ${K('up')} ${K('down')}) to run around your half of the court.`, goal: 1, feed: { ...feed('normal'), interval: 99999 }, manual: false },
    {
      title: 'Timing', body: `Press ${K('normal')} as the ball arrives. Watch the arc meter beside you: swing when it reaches the gold notch. Hit 3 shots graded GOOD or PERFECT.`, goal: 3, feed: feed('normal', 'fh', 0.8),
      check: (e) => e.t === 'hit' && e.p === 0 && (e.grade === 'GOOD' || e.grade === 'PERFECT'),
    },
    {
      title: 'Aim left and right', body: `Hold ${K('left')} or ${K('right')} while you hit to send the ball cross-court or down the line. Land one shot in each half (left and right).`, goal: 2, feed: feed('normal'),
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
      title: 'Deep and short', body: `Hold ${K('up')} at contact to hit deep, ${K('down')} to hit short. Land one deep (past the service line) and one short (inside it).`, goal: 2, feed: feed('normal'),
      check: (e, m, st) => {
        if (e.t === 'hit' && e.p === 0) st.awaitBounce = true;
        if (e.t === 'bounce' && st.awaitBounce && e.y > 0 && e.y < HALF_LEN) {
          st.awaitBounce = false;
          const side = e.y > SERVICE_Y + 1 ? 4 : e.y < SERVICE_Y ? 8 : 0;
          if (side && !(st.lastY & side)) {
            st.lastY |= side;
            return true;
          }
        }
        return false;
      },
    },
    shotStep('topspin', K('topspin'), 'Topspin', 'Topspin clears the net high, dips, and kicks up after the bounce: a safe, heavy rally ball.'),
    shotStep('slice', K('slice'), 'Slice', 'Slice stays low and skids: slower, great for defence and on grass.'),
    shotStep('lob', K('lob'), 'Lob', 'The lob sails high over an opponent at the net.'),
    shotStep('drop', K('drop'), 'Drop shot', 'The drop shot lands short and dies. Best when your opponent is far back.'),
    {
      title: 'Serve', body: `Press ${K('normal')} to toss, then ${K('normal')} again at the very top of the toss (the gold notch on the toss meter). Hold ${K('left')}/${K('right')} to aim. Land 2 serves in the box.`, goal: 2,
      feed: { type: 'normal', side: 'mix', speed: 1, interval: 70, serve: true },
      check: (e) => e.t === 'call' && e.text === 'IN!',
    },
    {
      title: 'Kick and slice serves', body: `Hold ${K('topspin')} while hitting for a high-bouncing KICK serve (safe second serve), or ${K('slice')} for a curving SLICE serve. Hit one of each.`, goal: 2,
      feed: { type: 'normal', side: 'mix', speed: 1, interval: 70, serve: true },
      check: (e, m, st) => {
        if (e.t === 'serve' && e.p === 0 && e.type !== 'flat') {
          const bit = e.type === 'kick' ? 16 : 32;
          if (!(st.lastX & bit)) {
            st.lastX |= bit;
            return true;
          }
        }
        return false;
      },
    },
    {
      title: 'Stamina', body: 'Your stamina bar (bottom left) drains when you sprint, dive and play long rallies. When it turns red you slow down, your PERFECT window shrinks and your shots get wilder. It recovers between points and faster at changeovers. Press Space to finish the tutorial!', goal: 1,
      feed: { ...feed('normal'), interval: 99999 }, manual: true,
    },
  ];
}

export function startTutorial(surface: SurfaceId): void {
  game.goto(makeTutorial(surface));
}

export function makeTutorial(surface: SurfaceId): MatchScene {
  const S = steps();
  const st: TutState = { step: 0, count: 0, moved: 0, lastX: 0, lastY: 0, done: false, doneT: 0, awaitBounce: false };
  let ms: MatchScene;
  const advance = (m: Match) => {
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
    if (!s || !s.check) return;
    if (s.check(e, m, st)) {
      st.count++;
      audio.sfx('menu_ok');
      if (st.count >= s.goal) advance(m);
    }
  };
  const onUpdate = (m: Match) => {
    const s = S[st.step];
    if (!s || st.done) return;
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
  ms.debugState = () => ({ ...base(), tutStep: st.step, tutCount: st.count, tutTitle: S[st.step]?.title });
  return ms;
}

void H;
