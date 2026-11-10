import { Game } from '../core/game';
import { input } from '../core/input';
import { rng } from '../core/rng';
import { audio } from '../core/audio';
import type { Action } from '../core/settings';
import type { MenuAction } from '../core/input';
import { setAutopilot } from './autopilot';
import { playerSprites } from '../gfx/sprites';

declare global {
  interface Window {
    __game?: Record<string, unknown>;
    __scenes?: Record<string, (params?: any) => import('../core/game').Scene>;
  }
}

/** Deterministic test hooks (dev builds or ?test). */
export function installHooks(g: Game): void {
  const enabled = import.meta.env.DEV || location.search.includes('test');
  if (!enabled) return;
  window.__game = {
    setPaused(on: boolean) {
      g.realtime = !on;
    },
    advanceFrames(n: number) {
      g.advance(n);
      return g.top?.debugState?.() ?? { scene: g.top?.name };
    },
    press(action: Action | MenuAction, frames = 1, id = 'p1') {
      input.vpress(id, action, frames);
    },
    menu(action: MenuAction) {
      input.vpress('menu', action, 1);
      g.advance(1);
    },
    setSeed(n: number) {
      rng.seed(n);
    },
    scene() {
      return g.top?.name;
    },
    stack() {
      return g.stack.map((s) => s.name);
    },
    state() {
      return {
        scene: g.top?.name,
        stack: g.stack.map((s) => s.name),
        frame: g.frame,
        transitioning: g.transitioning,
        audio: { ctx: audio.state, song: audio.currentSong, voices: audio.playing, last: audio.lastSfx },
        ...(g.top?.debugState?.() ?? {}),
      };
    },
    goto(name: string, params?: unknown) {
      const f = window.__scenes?.[name];
      if (!f) throw new Error('no scene ' + name);
      g.goto(f(params), 0);
      g.advance(1);
    },
    top() {
      return g.top;
    },
    autopilot(list: { idx: 0 | 1; offset?: number; shot?: string }[]) {
      setAutopilot(list as any);
    },
    /** run until predicate on state() is true or max frames; returns state */
    runUntil(fnSrc: string, max = 20000, chunk = 30) {
      const fn = new Function('s', 'return (' + fnSrc + ')(s)') as (s: any) => boolean;
      const st = () => ({ scene: g.top?.name, ...(g.top?.debugState?.() ?? {}) });
      for (let i = 0; i < max; i += chunk) {
        for (let k = 0; k < chunk; k++) g.step();
        if (fn(st())) break;
      }
      g.draw();
      return st();
    },
    /** player sprite bank status (sprite mode) */
    sprites() {
      return { state: playerSprites.state, missing: [...playerSprites.missing], drawn: playerSprites.drawn };
    },
    game: g,
  };
}
