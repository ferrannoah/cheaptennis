import { game } from '../core/game';
import { input } from '../core/input';
import { AI } from '../match/ai';
import { ARCHETYPE_BLEND } from '../data/tactics';
import type { MatchScene } from '../scenes/match';
import { ShotType } from '../data/types';

/** Drives a human player through *virtual key presses* (the real input path), for playtests. */
export class Autopilot {
  ai = new AI(0, ARCHETYPE_BLEND.allCourt);
  constructor(public playerIdx: 0 | 1, public ctrlId: string, public offset = 0, public shot: ShotType | 'mix' = 'mix') {}

  tick(): void {
    const top = game.top as MatchScene | undefined;
    if (!top || !('m' in top) || !('view' in top)) return;
    const m = top.m;
    const p = m.players[this.playerIdx];
    if (!p.ctrl) return;
    const id = p.ctrl.id;
    if (m.phase === 'serve' && m.server === p) {
      if (p.serve.phase === 'ready' && m.phaseT > 50 && !p.autoWalk) input.vpress(id, 'normal', 1);
      else if (p.serve.phase === 'toss' && p.serve.t === p.serve.tossApex - 1 + this.offset) {
        if (this.shot === 'topspin') input.vpress(id, 'topspin', 2);
        input.vpress(id, 'normal', 1);
      }
      return;
    }
    if (m.phase !== 'rally') return;
    const o = this.ai.update(m, p);
    if (this.ai.plan && this.pressFor !== m.rally.shotCount && this.ai.plan.pressAt !== Infinity) {
      this.pressFor = m.rally.shotCount;
      this.pressAt = this.ai.plan.pressAt + this.offset;
      this.pressShot = this.ai.plan.shot;
    }
    o.press = null;
    if (this.pressAt >= 0 && m.frame >= this.pressAt) {
      o.press = this.pressShot;
      this.pressAt = -1;
    }
    const dz = 0.25;
    const sw = p.swing;
    if (sw && !sw.done && sw.contactAt - m.frame <= 2 && this.ai.plan) {
      // just before contact, hold the aim direction instead of the movement direction (like a player would)
      const ax = this.ai.plan.aimX;
      const ad = this.ai.plan.aimDepth * p.dir; // near player: screen up = deep
      if (ax > 0.4) input.vpress(id, 'right', 1);
      if (ax < -0.4) input.vpress(id, 'left', 1);
      if (ad > 0.5) input.vpress(id, 'up', 1);
      if (ad < -0.5) input.vpress(id, 'down', 1);
    } else {
      if (o.mx > dz) input.vpress(id, 'right', 1);
      if (o.mx < -dz) input.vpress(id, 'left', 1);
      if (o.my > dz) input.vpress(id, 'down', 1);
      if (o.my < -dz) input.vpress(id, 'up', 1);
    }
    if (o.press) {
      // the swing press happens one frame later than the AI's decision because inputs are read next step
      const t: ShotType = this.shot === 'mix' ? o.press : this.shot;
      input.vpress(id, t, 1);
    }
  }
  pressFor = -1;
  pressAt = -1;
  pressShot: ShotType = 'normal';
}

let active: Autopilot[] = [];
export function setAutopilot(list: { idx: 0 | 1; offset?: number; shot?: ShotType | 'mix' }[]): void {
  active = list.map((a) => new Autopilot(a.idx, 'p' + (a.idx + 1), a.offset ?? 0, a.shot ?? 'mix'));
  if (!(game as any).__apHooked) {
    (game as any).__apHooked = true;
    game.preStep.push(() => active.forEach((a) => a.tick()));
  }
}
