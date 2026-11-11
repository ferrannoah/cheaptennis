import { input } from './input';
import { settings } from './settings';
import { H, type Game } from './game';

/**
 * On-screen controller for phones and tablets: a floating joystick on the left and four buttons on
 * the right, plus pause / fullscreen. It behaves like a standard-mapping gamepad in slot 0, so the
 * match (Controller 'p1' uses pad 0) and every menu read it through the existing gamepad code:
 *   A (0) = strike 1 / OK, X (2) = strike 2, B (1) = acceleration / back, Y (3) = gesture, Start (9) = pause.
 */

const BTN = { a: 0, b: 1, x: 2, y: 3, start: 9 } as const;
const STICK_R = 52; // px of thumb travel for a full push
const DEAD = 0.18;

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; display: none;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none;
  font: 700 15px system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; }
#touch.on { display: block; }
#touch .zone { position: absolute; left: 0; bottom: 0; width: 50%; height: 62%; pointer-events: auto; }
#touch .base { position: absolute; width: ${STICK_R * 2 + 36}px; height: ${STICK_R * 2 + 36}px; margin: -${STICK_R + 18}px 0 0 -${STICK_R + 18}px;
  border-radius: 50%; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.28); pointer-events: none; }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%;
  background: rgba(255,255,255,0.32); border: 2px solid rgba(255,255,255,0.6); }
#touch .btns { position: absolute; width: 196px; height: 196px;
  right: calc(14px + env(safe-area-inset-right)); bottom: calc(14px + env(safe-area-inset-bottom)); }
#touch .btn { position: absolute; width: 72px; height: 72px; border-radius: 50%; pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1;
  background: rgba(20,30,50,0.45); border: 2px solid rgba(255,255,255,0.45); box-sizing: border-box; }
#touch .btn small { font-size: 9px; opacity: 0.75; margin-top: 3px; letter-spacing: 0.04em; }
#touch .btn.down { background: rgba(216,240,58,0.55); border-color: #d8f03a; color: #10180a; }
#touch .btn.a { left: 62px; bottom: 0; width: 76px; height: 76px; font-size: 22px; border-color: rgba(216,240,58,0.85); }
#touch .btn.x { left: 0; top: 62px; font-size: 22px; }
#touch .btn.b { right: 0; top: 62px; }
#touch .btn.y { left: 66px; top: 0; width: 64px; height: 64px; font-size: 13px; }
#touch .sys { position: absolute; display: flex; gap: 10px; }
#touch .sys .btn { position: static; width: 44px; height: 44px; font-size: 15px; }
@media (orientation: portrait) {
  #touch .sys { right: calc(14px + env(safe-area-inset-right)); top: calc(var(--game-h, 60vh) + 12px); }
}
@media (orientation: landscape) {
  #touch .sys { left: calc(12px + env(safe-area-inset-left)); top: calc(12px + env(safe-area-inset-top)); }
}
`;

/** keep receiving a finger's events after it slides off the element (throws for synthetic pointers) */
function capture(el: Element, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    /* not an active pointer */
  }
}

class TouchControls {
  private root!: HTMLDivElement;
  private base!: HTMLDivElement;
  private knob!: HTMLDivElement;
  private fsBtn: HTMLDivElement | null = null;
  private buttons: boolean[] = new Array(17).fill(false);
  /** a tap shorter than one frame still registers as held for that frame */
  private tapped: boolean[] = new Array(17).fill(false);
  private axes = [0, 0];
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private sawTouch = false;
  active = false;

  constructor(private game: Game) {}

  install(): void {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const root = (this.root = document.createElement('div'));
    root.id = 'touch';
    root.innerHTML = `
      <div class="zone"><div class="base"><div class="knob"></div></div></div>
      <div class="btns">
        <div class="btn y" data-b="${BTN.y}">✋<small>GESTURE</small></div>
        <div class="btn x" data-b="${BTN.x}">2<small>SLICE</small></div>
        <div class="btn b" data-b="${BTN.b}">ACC<small>BACK</small></div>
        <div class="btn a" data-b="${BTN.a}">1<small>OK</small></div>
      </div>
      <div class="sys">
        <div class="btn start" data-b="${BTN.start}" aria-label="Pause">❚❚</div>
      </div>`;
    document.body.appendChild(root);
    this.base = root.querySelector('.base') as HTMLDivElement;
    this.knob = root.querySelector('.knob') as HTMLDivElement;

    for (const el of Array.from(root.querySelectorAll<HTMLDivElement>('.btn[data-b]'))) this.bindButton(el, Number(el.dataset.b));
    if (document.fullscreenEnabled) {
      const fs = (this.fsBtn = document.createElement('div'));
      fs.className = 'btn fs';
      fs.textContent = '⛶';
      fs.setAttribute('aria-label', 'Fullscreen');
      fs.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      });
      root.querySelector('.sys')!.appendChild(fs);
    }
    this.bindStick(root.querySelector('.zone') as HTMLDivElement);
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // "auto" also turns on the first time the screen is actually touched
    window.addEventListener('touchstart', () => {
      if (!this.sawTouch) {
        this.sawTouch = true;
        this.refresh();
      }
    }, { passive: true });
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('blur', () => this.releaseAll());

    input.touchSource = () => this.snapshot();
    this.refresh();
  }

  /** re-apply the Touch controls setting */
  refresh(): void {
    const forced = location.search.includes('touch');
    const auto = this.sawTouch || matchMedia('(pointer: coarse)').matches;
    const on = settings.touchControls === 'on' || (settings.touchControls === 'auto' && (auto || forced));
    this.active = on;
    this.root.classList.toggle('on', on);
    if (!on) this.releaseAll();
    this.layout();
  }

  private layout(): void {
    this.game.alignTop = this.active && window.innerHeight > window.innerWidth;
    this.game.resize();
    // portrait: the court's height, so pause / fullscreen sit just under it
    this.root.style.setProperty('--game-h', Math.round(H * this.game.scale) + 'px');
    this.resetStick();
  }

  private snapshot(): { buttons: boolean[]; axes: number[] } | null {
    if (!this.active) return null;
    const b = this.buttons.map((d, i) => d || this.tapped[i]);
    this.tapped.fill(false);
    return { buttons: b, axes: this.axes.slice() };
  }

  private bindButton(el: HTMLDivElement, idx: number): void {
    const ids = new Set<number>();
    const set = (down: boolean) => {
      this.buttons[idx] = down;
      el.classList.toggle('down', down);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(el, e.pointerId);
      ids.add(e.pointerId);
      this.tapped[idx] = true;
      set(true);
      navigator.vibrate?.(8);
    });
    const up = (e: PointerEvent) => {
      ids.delete(e.pointerId);
      if (ids.size === 0) set(false);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  private bindStick(zone: HTMLDivElement): void {
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      capture(zone, e.pointerId);
      // the stick appears under the thumb
      const r = zone.getBoundingClientRect();
      this.stickOrigin = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.placeBase(this.stickOrigin.x, this.stickOrigin.y);
      this.moveStick(0, 0);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      const r = zone.getBoundingClientRect();
      this.moveStick(e.clientX - r.left - this.stickOrigin.x, e.clientY - r.top - this.stickOrigin.y);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.resetStick();
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
  }

  private moveStick(dx: number, dy: number): void {
    const d = Math.hypot(dx, dy);
    const k = d > STICK_R ? STICK_R / d : 1;
    dx *= k;
    dy *= k;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let x = dx / STICK_R;
    let y = dy / STICK_R;
    const m = Math.hypot(x, y);
    if (m < DEAD) x = y = 0;
    this.axes[0] = x;
    this.axes[1] = y;
  }

  private placeBase(x: number, y: number): void {
    this.base.style.left = x + 'px';
    this.base.style.top = y + 'px';
  }

  /** park the stick at its resting spot near the bottom-left corner */
  private resetStick(): void {
    if (this.stickId !== null) return;
    this.moveStick(0, 0);
    const zone = this.base.parentElement as HTMLDivElement;
    const h = zone.clientHeight || window.innerHeight * 0.62;
    this.placeBase(STICK_R + 50, h - STICK_R - 50);
  }

  private releaseAll(): void {
    this.buttons.fill(false);
    this.tapped.fill(false);
    this.stickId = null;
    for (const el of Array.from(this.root?.querySelectorAll('.btn.down') ?? [])) el.classList.remove('down');
    if (this.base) this.resetStick();
  }
}

export let touch: TouchControls | null = null;

export function installTouch(g: Game): void {
  touch = new TouchControls(g);
  touch.install();
}
