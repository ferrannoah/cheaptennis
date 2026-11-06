import { Action, ACTIONS, Profile, settings } from './settings';

const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'Backspace',
]);

type PadSnap = { buttons: boolean[]; axes: number[]; connected: boolean };

class InputSystem {
  private held = new Set<string>();
  private queue: string[] = [];
  private pressedNow = new Set<string>();
  private pads: PadSnap[] = [];
  private prevPads: PadSnap[] = [];
  private captureCb: ((code: string) => void) | null = null;
  private padCaptureCb: ((btn: number) => void) | null = null;
  /** test-injected virtual holds: key = controller id, value = action -> frames remaining */
  virtual = new Map<string, Map<Action | MenuAction, number>>();
  private virtualPressed = new Set<string>();
  anyKeyThisFrame = false;
  lastDevice: 'kb' | 'pad' = 'kb';
  private repeat = new Map<string, number>();

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code) || e.code.startsWith('Numpad') || e.code === 'Escape') e.preventDefault();
      if (this.captureCb) {
        const cb = this.captureCb;
        this.captureCb = null;
        cb(e.code);
        return;
      }
      if (!e.repeat) this.queue.push(e.code);
      this.held.add(e.code);
      this.lastDevice = 'kb';
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    target.addEventListener('blur', () => this.held.clear());
  }

  captureKey(cb: (code: string) => void): void {
    this.captureCb = cb;
  }
  capturePad(cb: (btn: number) => void): void {
    this.padCaptureCb = cb;
  }
  get capturing(): boolean {
    return this.captureCb !== null || this.padCaptureCb !== null;
  }
  cancelCapture(): void {
    this.captureCb = null;
    this.padCaptureCb = null;
  }

  /** Call once per fixed update, before scene update. */
  beginFrame(): void {
    this.pressedNow.clear();
    for (const c of this.queue) this.pressedNow.add(c);
    this.anyKeyThisFrame = this.queue.length > 0;
    this.queue.length = 0;
    this.prevPads = this.pads;
    this.pads = [];
    let gp: (Gamepad | null)[] = [];
    try {
      gp = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    } catch {
      gp = [];
    }
    for (let i = 0; i < 4; i++) {
      const g = gp[i];
      if (g && g.connected) {
        this.pads[i] = {
          connected: true,
          buttons: g.buttons.map((b) => b.pressed || b.value > 0.5),
          axes: Array.from(g.axes),
        };
      } else this.pads[i] = { connected: false, buttons: [], axes: [] };
    }
    for (let i = 0; i < 4; i++) {
      const p = this.pads[i];
      const q = this.prevPads[i];
      if (!p.connected) continue;
      for (let b = 0; b < p.buttons.length; b++) {
        if (p.buttons[b] && !(q && q.buttons[b])) {
          this.anyKeyThisFrame = true;
          this.lastDevice = 'pad';
          if (this.padCaptureCb && b !== 9) {
            const cb = this.padCaptureCb;
            this.padCaptureCb = null;
            cb(b);
          }
        }
      }
    }
    // virtual inputs: decrement, compute pressed
    this.virtualPressed.clear();
    for (const [id, m] of this.virtual) {
      for (const [a, f] of m) {
        if (f <= 0) {
          m.delete(a);
          continue;
        }
        if (f & 0x10000) {
          // first frame flag
          this.virtualPressed.add(id + ':' + a);
          m.set(a, (f & 0xffff) - 1);
        } else m.set(a, f - 1);
      }
    }
    this.updateMenuRepeat();
  }

  vpress(id: string, action: Action | MenuAction, frames: number): void {
    let m = this.virtual.get(id);
    if (!m) this.virtual.set(id, (m = new Map()));
    m.set(action, Math.max(1, frames) | 0x10000);
  }
  vheld(id: string, a: Action | MenuAction): boolean {
    const m = this.virtual.get(id);
    return !!m && (m.get(a) ?? 0) > 0 || this.virtualPressed.has(id + ':' + a);
  }
  vpressed(id: string, a: Action | MenuAction): boolean {
    return this.virtualPressed.has(id + ':' + a);
  }

  keyHeld(code: string): boolean {
    return this.held.has(code);
  }
  keyPressed(code: string): boolean {
    return this.pressedNow.has(code);
  }
  pad(i: number): PadSnap | undefined {
    return this.pads[i]?.connected ? this.pads[i] : undefined;
  }
  padPressed(i: number, b: number): boolean {
    const p = this.pads[i];
    const q = this.prevPads[i];
    return !!(p && p.connected && p.buttons[b] && !(q && q.buttons[b]));
  }
  padHeld(i: number, b: number): boolean {
    const p = this.pads[i];
    return !!(p && p.connected && p.buttons[b]);
  }
  connectedPads(): number[] {
    const r: number[] = [];
    for (let i = 0; i < 4; i++) if (this.pads[i]?.connected) r.push(i);
    return r;
  }

  // ---------------- menu input (any device) ----------------
  private menuFired = new Set<MenuAction>();

  /** Resolve menu directions once per frame: one tap = one step; holding repeats after a delay. */
  private updateMenuRepeat(): void {
    this.menuFired.clear();
    for (const a of MENU_DIRS) {
      const keys = MENU_KEYS[a];
      let edge = keys.some((k) => this.pressedNow.has(k));
      let h = keys.some((k) => this.held.has(k));
      for (let i = 0; i < 4; i++) {
        const p = this.pads[i];
        if (!p?.connected) continue;
        if (MENU_PAD[a].some((b) => this.padPressed(i, b))) edge = true;
        const ax = a === 'left' ? -(p.axes[0] ?? 0) : a === 'right' ? p.axes[0] ?? 0 : a === 'up' ? -(p.axes[1] ?? 0) : p.axes[1] ?? 0;
        if (ax > 0.6 || MENU_PAD[a].some((b) => p.buttons[b])) h = true;
      }
      const t = this.repeat.get(a) ?? 0;
      if (edge) {
        this.menuFired.add(a);
        this.repeat.set(a, 1);
      } else if (h) {
        this.repeat.set(a, t + 1);
        if (t === 0) this.menuFired.add(a); // stick pushed without a button edge
        else if (t >= MENU_REPEAT_DELAY && (t - MENU_REPEAT_DELAY) % MENU_REPEAT_EVERY === 0) this.menuFired.add(a);
      } else this.repeat.set(a, 0);
    }
  }

  menu(a: MenuAction): boolean {
    if (this.vpressed('menu', a)) return true;
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') return this.menuFired.has(a);
    for (const k of MENU_KEYS[a]) if (this.pressedNow.has(k)) return true;
    for (let i = 0; i < 4; i++) {
      const p = this.pads[i];
      if (!p?.connected) continue;
      for (const b of MENU_PAD[a]) if (this.padPressed(i, b)) return true;
    }
    return false;
  }
}

const MENU_DIRS = ['up', 'down', 'left', 'right'] as const;
const MENU_REPEAT_DELAY = 22;
const MENU_REPEAT_EVERY = 6;

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'pause';
const MENU_KEYS: Record<MenuAction, string[]> = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  ok: ['Space', 'Enter', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
};
const MENU_PAD: Record<MenuAction, number[]> = {
  up: [12], down: [13], left: [14], right: [15], ok: [0], back: [1], pause: [9],
};

export const input = new InputSystem();

/** A source of player actions: a keyboard profile and/or a gamepad. */
export class Controller {
  constructor(
    public id: string,
    public profile: Profile | null,
    public padIndex: number | null,
  ) {}

  private padDir(a: Action): boolean {
    if (this.padIndex === null) return false;
    const p = input.pad(this.padIndex);
    if (!p) return false;
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    switch (a) {
      case 'left': return ax < -0.35 || !!p.buttons[14];
      case 'right': return ax > 0.35 || !!p.buttons[15];
      case 'up': return ay < -0.35 || !!p.buttons[12];
      case 'down': return ay > 0.35 || !!p.buttons[13];
      default: return false;
    }
  }

  held(a: Action): boolean {
    if (input.vheld(this.id, a)) return true;
    if (this.profile) for (const k of settings.keys[this.profile][a]) if (input.keyHeld(k)) return true;
    if (this.padIndex !== null) {
      if (this.padDir(a)) return true;
      const b = settings.pad[a];
      if (b !== undefined && input.padHeld(this.padIndex, b)) return true;
    }
    return false;
  }

  pressed(a: Action): boolean {
    if (input.vpressed(this.id, a)) return true;
    if (this.profile) for (const k of settings.keys[this.profile][a]) if (input.keyPressed(k)) return true;
    if (this.padIndex !== null) {
      const b = settings.pad[a];
      if (b !== undefined && input.padPressed(this.padIndex, b)) return true;
    }
    return false;
  }

  /** -1..1 movement vector */
  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.padIndex !== null) {
      const p = input.pad(this.padIndex);
      if (p) {
        const ax = p.axes[0] ?? 0;
        const ay = p.axes[1] ?? 0;
        if (Math.hypot(ax, ay) > 0.25) {
          x = ax;
          y = ay;
        }
      }
    }
    if (this.held('left')) x = -1;
    if (this.held('right')) x = 1;
    if (this.held('up')) y = -1;
    if (this.held('down')) y = 1;
    if (this.held('left') && this.held('right')) x = 0;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x, y };
  }

  shotPressed(): 'normal' | 'topspin' | 'slice' | 'lob' | 'drop' | null {
    for (const a of ['normal', 'topspin', 'slice', 'lob', 'drop'] as const) if (this.pressed(a)) return a;
    return null;
  }
}

export { ACTIONS };
