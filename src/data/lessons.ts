/**
 * Tactics School: eight short lessons on real singles tactics (not tricks for beating the COM).
 * Each lesson = explanation, a ball-machine drill with a pass condition, and a takeaway card.
 * Court coordinates: metres, the player is on the near side (y < 0), targets are on the far side (y > 0).
 * Sources for the content are listed in docs/GDD.md (§3.5b).
 */
import { HALF_W, HALF_LEN, SERVICE_Y } from './court';
import { ShotType } from './types';
import { TacticId } from './tactics';
import type { PracticeFeed } from '../match/match';

export interface Zone { x0: number; x1: number; y0: number; y1: number; label?: string }

/** what happened to one of the player's shots (or serves) in a drill */
export interface ShotResult {
  hitX: number; // player x at contact (serves: server x)
  hitY: number; // ball y at contact
  landX: number;
  landY: number;
  inside: boolean;
  shot: ShotType | 'serve';
  good: boolean; // graded GOOD or PERFECT
  /** player back near the middle (|x| <= 1.5) by the time the ball landed */
  recovered: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  /** the AI game plan that is built around this idea */
  tactic: TacticId;
  intro: string[];
  drill: string;
  takeaway: string;
  feed: PracticeFeed;
  /** category -> how many are needed */
  need: Record<string, number>;
  /** consecutive successes required (a miss resets progress) */
  streak?: boolean;
  /** a stand-in opponent drawn on the far court (k = feed number) */
  dummy?: (k: number) => { x: number; y: number } | null;
  /** target areas to draw (and usually to hit) */
  zones: (hitX: number, k: number) => Zone[];
  /** classify a result: a category from `need`, or null if it doesn't count */
  classify: (r: ShotResult, k: number) => string | null;
  /** where a good player would aim right now: screen x (-1..1), depth (-1 short..1 deep), shot */
  hint: (px: number, k: number) => { x: number; d: number; shot?: ShotType; serveAim?: number };
  /** one line on screen while drilling */
  aimText: (k: number) => string;
}

const Z = (x0: number, x1: number, y0: number, y1: number, label?: string): Zone => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), label });
export const inZone = (r: { landX: number; landY: number }, z: Zone): boolean => r.landX >= z.x0 && r.landX <= z.x1 && r.landY >= z.y0 && r.landY <= z.y1;
const inAny = (r: ShotResult, zs: Zone[]) => r.inside && zs.some((z) => inZone(r, z));
const side = (x: number) => (x >= 0 ? 1 : -1);
const W = HALF_W;
const L = HALF_LEN;
const S = SERVICE_Y;
const feed = (o: Partial<PracticeFeed> = {}): PracticeFeed => ({ type: 'normal', side: 'mix', speed: 0.85, interval: 70, ...o });

/** the drill's dummy for "open court": stands on alternating sides */
const openDummy = (k: number) => ({ x: k % 2 === 0 ? 2.4 : -2.4, y: L - 0.3 });

export const LESSONS: Lesson[] = [
  {
    id: 'cross',
    title: 'Crosscourt is your safe rally ball',
    tactic: 'grind',
    intro: [
      'The diagonal (crosscourt) is the longest shot on the court, and it goes over the lowest part of the net, in the middle.',
      'That gives you the most room for error. Most rally balls in pro tennis go crosscourt, and they go deep.',
      'A deep ball pushes your opponent back, so they can\'t attack you.',
    ],
    drill: 'Hit 5 crosscourt balls in a row that land past the service line. Aim diagonally: from the right side, hold ← as you hit; from the left side, hold →.',
    takeaway: 'Rally crosscourt and deep until you get a short or weak ball. The Baseline Grind game plan is built on this.',
    feed: feed({ side: 'mix' }),
    need: { ok: 5 },
    streak: true,
    zones: (hx) => [Z(-side(hx) * 0.6, -side(hx) * W, S, L, 'CROSSCOURT')],
    classify: (r) => (inAny(r, [Z(-side(r.hitX) * 0.6, -side(r.hitX) * W, S, L)]) ? 'ok' : null),
    hint: (px) => ({ x: -side(px), d: 0.6 }),
    aimText: () => 'Aim diagonally, deep',
  },
  {
    id: 'open',
    title: 'Hit to the open court',
    tactic: 'serve1',
    intro: [
      'Every shot you hit moves your opponent. When they are pulled to one side, the other side of the court is open.',
      'Hitting to the open court makes them run the full width. Even if they get there, their reply is usually weak.',
      'Watch where your opponent is BEFORE you hit, not just the ball.',
    ],
    drill: 'A practice opponent stands on one side. Land 4 balls deep in the open side, away from them.',
    takeaway: 'Move the opponent, then hit into the space they left. The Serve + 1 plan does this right after a wide serve.',
    feed: feed({ speed: 0.8 }),
    need: { ok: 4 },
    dummy: openDummy,
    zones: (_hx, k) => [Z(-side(openDummy(k).x) * 0.8, -side(openDummy(k).x) * W, S - 1, L, 'OPEN COURT')],
    classify: (r, k) => (inAny(r, [Z(-side(openDummy(k).x) * 0.8, -side(openDummy(k).x) * W, S - 1, L)]) ? 'ok' : null),
    hint: (_px, k) => ({ x: -side(openDummy(k).x), d: 0.5 }),
    aimText: () => 'Aim away from the opponent',
  },
  {
    id: 'line',
    title: 'Change direction on a good ball',
    tactic: 'fhDom',
    intro: [
      'Down the line is the riskier shot: the court is shorter that way and the net is higher near the sides.',
      'So go down the line when you have a comfortable ball: one that is not too fast, not too wide, and that you can set up for.',
      'Changing direction surprises your opponent, and it often wins the point outright.',
    ],
    drill: 'The machine feeds easier balls. Hit 3 clean (GOOD or PERFECT) shots down the line, straight ahead, landing deep.',
    takeaway: 'Rally crosscourt, change direction down the line when the ball lets you. Forehand Dominance players love this switch.',
    feed: feed({ speed: 0.7, depth: [7.5, 9.5] }),
    need: { ok: 3 },
    zones: (hx) => [Z(side(hx) * 1.3, side(hx) * W, S, L, 'DOWN THE LINE')],
    classify: (r) => (r.good && inAny(r, [Z(side(r.hitX) * 1.3, side(r.hitX) * W, S, L)]) ? 'ok' : null),
    hint: (px) => ({ x: side(px), d: 0.6 }),
    aimText: () => 'Aim straight ahead, deep (only off a good ball)',
  },
  {
    id: 'short',
    title: 'Attack the short ball',
    tactic: 'net',
    intro: [
      'A ball that lands short (near the service line) is your green light. Step INTO the court and take it early, at a comfortable height.',
      'Hit a deep approach shot, usually down the line, and keep moving forward to the net.',
      'From the net you cover the angles and can finish with a volley.',
    ],
    drill: 'The machine feeds short balls. Move forward, hit from inside the baseline, land it deep, and keep coming in. Do it 3 times.',
    takeaway: 'Short ball = attack. Approach deep (down the line is safest), then close the net. That\'s the Net Attack plan.',
    feed: feed({ speed: 0.75, depth: [4.8, 6.4] }),
    need: { ok: 3 },
    zones: (hx) => [Z(side(hx) * 0.3, side(hx) * W, S + 1.2, L, 'APPROACH DEEP')],
    classify: (r) => (Math.abs(r.hitY) <= L - 2.2 && r.inside && r.landY >= S + 1.2 ? 'ok' : null),
    hint: (px) => ({ x: side(px), d: 1 }),
    aimText: () => 'Run forward, hit deep, keep coming in',
  },
  {
    id: 'serve',
    title: 'Serve to a spot',
    tactic: 'serve1',
    intro: [
      'A serve does not have to be fast to work. Placement matters more.',
      'A WIDE serve drags the returner off the court and opens the court for your next shot. A serve down the T (the middle) gives the returner less angle and can jam them.',
      'Mix them up so the returner can\'t guess.',
    ],
    drill: 'Land 2 serves out WIDE and 2 down the T. Hold ← or → while you serve to aim.',
    takeaway: 'Serve to a spot, then expect where the return goes. Serve + 1 players hit their first forehand into the open court.',
    feed: { type: 'normal', side: 'mix', speed: 1, interval: 70, serve: true },
    need: { wide: 2, t: 2 },
    zones: (hx) => {
      const s = side(hx); // server on +x serves to the -x box (deuce court)
      return [Z(-s * (W - 1.2), -s * W, 0.5, S, 'WIDE'), Z(-s * 0.0, -s * 1.1, 0.5, S, 'T')];
    },
    classify: (r) => {
      if (!r.inside) return null;
      const ax = Math.abs(r.landX);
      return ax >= W - 1.2 ? 'wide' : ax <= 1.1 ? 't' : null;
    },
    hint: (px, k) => ({ x: 0, d: 0, serveAim: k % 4 < 2 ? -side(px) : side(px) }),
    aimText: () => 'Serve WIDE or down the T',
  },
  {
    id: 'weak',
    title: 'Find the weaker side',
    tactic: 'fhDom',
    intro: [
      'Most players have a weaker side, usually the backhand. Notice it early: which side makes more errors, or hits shorter?',
      'Then play more balls there, especially on big points. A right-handed opponent\'s backhand is on YOUR right when you look across the net.',
      'Don\'t make it too obvious: hit there enough to collect errors and short balls, not every time.',
    ],
    drill: 'Your practice opponent is right-handed. Land 4 deep balls on their backhand side.',
    takeaway: 'Test both wings, then press on the weaker one. Forehand Dominance players aim about 70% of their shots at the backhand.',
    feed: feed(),
    need: { ok: 4 },
    dummy: () => ({ x: 0, y: L - 0.3 }),
    zones: () => [Z(1.0, W, S, L, 'BACKHAND')],
    classify: (r) => (inAny(r, [Z(1.0, W, S, L)]) ? 'ok' : null),
    hint: () => ({ x: 1, d: 0.5 }),
    aimText: () => 'Aim at their backhand (your right)',
  },
  {
    id: 'pass',
    title: 'Beat the net player',
    tactic: 'counter',
    intro: [
      'When your opponent comes to the net you have three answers: a passing shot down the line, a ball at their feet, or a lob over them.',
      'A lob works best when they are close to the net. Hit it high and deep so they have to turn and run back.',
      'A pass works when they are a little off-centre: go to the side they can\'t cover.',
    ],
    drill: 'A net player is waiting. Win 4: either lob it deep over them, or pass them along the sideline.',
    takeaway: 'Against a net rusher: pass down the line, dip it at their feet, or lob. Counterpunchers live on these shots.',
    feed: feed({ speed: 0.8 }),
    need: { ok: 4 },
    dummy: () => ({ x: 0, y: 3.2 }),
    zones: () => [Z(-W, W, L - 3.2, L, 'LOB DEEP'), Z(-W, -W + 1.2, 3.2, L - 3.2, 'PASS'), Z(W - 1.2, W, 3.2, L - 3.2, 'PASS')],
    classify: (r) => {
      if (!r.inside) return null;
      if (r.shot === 'lob' && r.landY >= L - 3.2) return 'ok';
      if (r.shot !== 'lob' && Math.abs(r.landX) >= W - 1.2 && r.landY >= 3.2) return 'ok';
      return null;
    },
    hint: () => ({ x: 0, d: 1, shot: 'lob' }),
    aimText: () => 'Lob (C) deep, or pass along a sideline',
  },
  {
    id: 'defend',
    title: 'Defend, then recover',
    tactic: 'grind',
    intro: [
      'When you are pulled wide and stretched, don\'t go for a winner. Buy time instead.',
      'Hit high and deep through the middle (topspin or a lob). The ball takes longer to arrive, so you can get back.',
      'Then recover to the middle of the baseline before your ball lands. A good defender turns defence into a neutral rally.',
    ],
    drill: 'The machine feeds wide. Get it back deep (past the service line, through the middle) AND be back near the centre mark before it lands. Do it 3 times.',
    takeaway: 'Under pressure: height, depth and recovery beat a risky winner. Grinders and counterpunchers defend like this.',
    feed: feed({ wide: true, speed: 0.75 }),
    need: { ok: 3 },
    zones: () => [Z(-2.2, 2.2, S + 1, L, 'DEEP MIDDLE')],
    classify: (r) => (r.inside && r.landY >= S + 1 && Math.abs(r.landX) <= 2.6 && r.recovered ? 'ok' : null),
    hint: () => ({ x: 0, d: 1, shot: 'topspin' }),
    aimText: () => 'High and deep (Z topspin), then run back to the middle',
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
