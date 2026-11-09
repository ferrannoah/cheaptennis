import { game } from '../core/game';
import { input } from '../core/input';
import { AI } from '../match/ai';
import { ARCHETYPE_BLEND } from '../data/tactics';
import type { MatchScene } from '../scenes/match';
import { ShotType } from '../data/types';
import { StrikeId, strikeButtons, ServeForce } from '../match/strike';
import type { Player } from '../match/player';

/**
 * Drives a human player through *virtual key presses* (the real input path), for playtests.
 * (M21) It plays like a person with the hold-to-strike controls: run to the ball, press and hold
 * the strike button early, steer the aim sweep with left/right, keep holding through contact.
 * `offset` delays the press by that many frames (negative = earlier).
 */
export class Autopilot {
  ai = new AI(0, ARCHETYPE_BLEND.allCourt);
  /** (optional) press exactly this many frames before the planned contact instead */
  holdBefore: number | null = null;
  constructor(public playerIdx: 0 | 1, public ctrlId: string, public offset = 0, public shot: StrikeId | 'mix' = 'mix', public serve: ServeForce = 'normal') {}
  holdFor = -1;
  holdAt = -1;
  readyHeld = 0;

  private steerAim(id: string, p: Player, target: number): void {
    if (p.strike.aim < target - 0.06) input.vpress(id, 'right', 1);
    else if (p.strike.aim > target + 0.06) input.vpress(id, 'left', 1);
  }

  private hold(id: string, p: Player, b: { b1: boolean; b2: boolean; fwd: number }): void {
    if (b.b1) input.vpress(id, 'b1', 2);
    if (b.b2) input.vpress(id, 'b2', 2);
    if (b.fwd !== 0) {
      // toward the net is screen-up for the near player, screen-down for the far one
      const up = (b.fwd > 0) === (p.dir === 1);
      input.vpress(id, up ? 'up' : 'down', 1);
    }
  }

  tick(): void {
    const top = game.top as MatchScene | undefined;
    if (!top || !('m' in top) || !('view' in top)) return;
    const m = top.m;
    const p = m.players[this.playerIdx];
    if (!p.ctrl) return;
    const id = p.ctrl.id;
    // in a Tactics School drill, follow the lesson's coaching hint (where a good player would aim)
    const hint = (top as unknown as { lessonHint?: () => { x: number; d: number; shot?: ShotType; serveAim?: number } }).lessonHint?.();
    if (m.phase === 'serve' && m.server === p) {
      const b = { b1: this.serve !== 'safe', b2: this.serve !== 'normal', fwd: 0 };
      if (p.serve.phase === 'ready' && m.phaseT > 50 && !m.players.some((q) => q.autoWalk)) {
        // press to toss; if the press got swallowed (e.g. by a skip), let go for a frame and press again
        if (++this.readyHeld % 12 !== 0) this.hold(id, p, b);
      } else if (p.serve.phase === 'toss') {
        this.readyHeld = 0;
        this.hold(id, p, b);
        this.steerAim(id, p, hint?.serveAim ?? 0);
      }
      return;
    }
    if (m.phase !== 'rally') return;
    const o = this.ai.update(m, p);
    const plan = this.ai.plan;
    if (o.hold && plan && this.holdFor !== m.rally.shotCount) {
      this.holdFor = m.rally.shotCount;
      this.holdAt = this.holdBefore !== null ? plan.contactAt - this.holdBefore : m.frame + this.offset;
    }
    const holding = !!o.hold && plan && this.holdFor === m.rally.shotCount && m.frame >= this.holdAt;
    if (holding && plan) {
      const want: StrikeId = (hint?.shot as StrikeId | undefined) ?? (this.shot === 'mix' ? plan.strike : this.shot);
      this.hold(id, p, strikeButtons(want));
      this.steerAim(id, p, hint ? hint.x : plan.aimX);
      return;
    }
    const dz = 0.25;
    if (o.mx > dz) input.vpress(id, 'right', 1);
    if (o.mx < -dz) input.vpress(id, 'left', 1);
    if (o.my > dz) input.vpress(id, 'down', 1);
    if (o.my < -dz) input.vpress(id, 'up', 1);
  }
}

let active: Autopilot[] = [];
export function setAutopilot(list: { idx: 0 | 1; offset?: number; shot?: StrikeId | 'mix'; serve?: ServeForce; holdBefore?: number }[]): void {
  active = list.map((a) => {
    const ap = new Autopilot(a.idx, 'p' + (a.idx + 1), a.offset ?? 0, a.shot ?? 'mix', a.serve ?? 'normal');
    if (a.holdBefore !== undefined) ap.holdBefore = a.holdBefore;
    return ap;
  });
  if (!(game as any).__apHooked) {
    (game as any).__apHooked = true;
    game.preStep.push(() => active.forEach((a) => a.tick()));
  }
}
