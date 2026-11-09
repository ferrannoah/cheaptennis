import { game, W, H } from '../core/game';
import { MenuScene, MenuEntry, cycle } from './menu-base';
import { drawSetupScreen } from './setup-common';
import { settings, saveSettings, resetBindings, Difficulty, Profile, ACTIONS, ACTION_LABEL, keyLabel, PAD_LABEL, Action, STRIKE_ACTIONS } from '../core/settings';
import { audio } from '../core/audio';
import { input } from '../core/input';
import { TitleScene } from './title';
import { drawBackdrop } from '../gfx/backdrop';
import { panel, menuList } from '../gfx/ui';
import { text } from '../gfx/text';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'pro'];
const pct = (v: number) => `${Math.round(v * 100)}%`;
const vol = (v: number, d: number) => Math.round(Math.max(0, Math.min(1, v + d * 0.1)) * 10) / 10;

export class OptionsScene extends MenuScene {
  name = 'options';
  constructor(private back: () => void = () => game.goto(new TitleScene())) {
    super();
  }
  items(): MenuEntry[] {
    const set = (fn: () => void) => () => {
      fn();
      saveSettings();
      audio.applyVolumes();
    };
    return [
      { id: 'keys-solo', label: 'Controls: single player', action: () => game.goto(new RemapScene('solo', this)) },
      { id: 'keys-vs1', label: 'Controls: Versus P1', action: () => game.goto(new RemapScene('vs1', this)) },
      { id: 'keys-vs2', label: 'Controls: Versus P2', action: () => game.goto(new RemapScene('vs2', this)) },
      { id: 'keys-pad', label: 'Controls: gamepad buttons', action: () => game.goto(new RemapScene('pad', this)) },
      { id: 'master', label: 'Master volume', value: pct(settings.master), change: (d) => set(() => (settings.master = vol(settings.master, d)))() },
      { id: 'music', label: 'Music volume', value: pct(settings.music), change: (d) => set(() => (settings.music = vol(settings.music, d)))() },
      { id: 'sfx', label: 'Effects volume', value: pct(settings.sfx), change: (d) => set(() => (settings.sfx = vol(settings.sfx, d)))() },
      { id: 'mute', label: 'Mute (M)', value: settings.muted ? 'ON' : 'OFF', change: () => audio.toggleMute() },
      {
        id: 'mode', label: 'Strike controls', value: settings.controlMode === 'arcade' ? 'ARCADE' : 'SIMULATION',
        change: set(() => (settings.controlMode = settings.controlMode === 'arcade' ? 'sim' : 'arcade')),
        hint: 'Arcade: half the danger-zone / off-centre penalties, the aiming zone closes twice as fast',
      },
      {
        id: 'autopos', label: 'Auto-positioning', value: settings.autoPos.toUpperCase(),
        change: (d) => set(() => (settings.autoPos = cycle(['slow', 'average', 'fast'] as const, settings.autoPos, d)))(),
        hint: 'How fast you walk to the ball by yourself while a strike button is held',
      },
      {
        id: 'preview', label: 'Court preview', value: { off: 'OFF', impact: 'IMPACT', danger: 'IMPACT + DANGER ZONE', all: 'ALL + AIMING' }[settings.preview],
        change: (d) => set(() => (settings.preview = cycle(['off', 'impact', 'danger', 'all'] as const, settings.preview, d)))(),
        hint: 'Landing marker, the danger zone with its green spots, and your live aiming zone',
      },
      { id: 'difficulty', label: 'COM difficulty', value: settings.difficulty.toUpperCase(), change: (d) => set(() => (settings.difficulty = cycle(DIFFS, settings.difficulty, d)))() },
      { id: 'clen', label: 'Career match length', value: { short: 'First to 3 games', set: '6-game set', full: 'Best of 3 sets' }[settings.careerLength], change: (d) => set(() => (settings.careerLength = cycle(['short', 'set', 'full'] as const, settings.careerLength, d)))() },
      { id: 'bo5', label: 'Majors best of 5', value: settings.majorsBo5 ? 'ON' : 'OFF', change: set(() => (settings.majorsBo5 = !settings.majorsBo5)), hint: 'Only applies when career match length is "Best of 3 sets"' },
      { id: 'shake', label: 'Screen shake', value: settings.reducedShake ? 'OFF' : 'ON', change: set(() => (settings.reducedShake = !settings.reducedShake)) },
      { id: 'fps', label: 'Show FPS', value: settings.showFps ? 'ON' : 'OFF', change: set(() => (settings.showFps = !settings.showFps)) },
      { id: 'back', label: 'Back', action: () => this.back() },
    ];
  }
  onBack(): void {
    this.back();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx, this.t, 'hard', false);
    ctx.fillStyle = 'rgba(6,12,26,0.3)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'OPTIONS', W / 2, 34, { size: 30, align: 'center', outline: '#13284a', outlineWidth: 8 });
    const items = this.items();
    const pw = 460, row = 22;
    const ph = items.length * row + 24;
    const px = (W - pw) / 2, py = 60;
    panel(ctx, px, py, pw, ph);
    menuList(ctx, items, this.sel, px + 16, py + 24, pw - 32, row, 14, this.t);
    const h = items[this.sel]?.hint;
    if (h) text(ctx, h, W / 2, H - 16, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
  }
}

export class RemapScene extends MenuScene {
  name = 'remap';
  waiting: Action | null = null;
  constructor(public profile: Profile | 'pad', private parent: OptionsScene) {
    super();
  }
  actions(): Action[] {
    return this.profile === 'pad' ? STRIKE_ACTIONS : ACTIONS;
  }
  items(): MenuEntry[] {
    const its: MenuEntry[] = this.actions().map((a) => ({
      id: a,
      label: ACTION_LABEL[a],
      value: this.waiting === a ? '...press...' : this.profile === 'pad' ? PAD_LABEL[settings.pad[a] ?? -1] ?? '-' : settings.keys[this.profile as Profile][a].map(keyLabel).join(' / '),
      action: () => this.capture(a),
    }));
    its.push({ id: 'reset', label: 'Reset all to defaults', action: () => resetBindings() });
    its.push({ id: 'back', label: 'Back', action: () => game.goto(this.parent) });
    return its;
  }
  capture(a: Action): void {
    this.waiting = a;
    if (this.profile === 'pad') {
      input.capturePad((b) => {
        settings.pad[a] = b;
        saveSettings();
        this.waiting = null;
        audio.sfx('menu_ok');
      });
    } else {
      const prof = this.profile;
      input.captureKey((code) => {
        if (code !== 'Escape') {
          settings.keys[prof][a] = [code];
          saveSettings();
          audio.sfx('menu_ok');
        }
        this.waiting = null;
      });
    }
  }
  update(): void {
    if (this.waiting) return; // input is captured
    super.update();
  }
  onBack(): void {
    game.goto(this.parent);
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const title = { solo: 'SINGLE PLAYER KEYS', vs1: 'VERSUS P1 KEYS', vs2: 'VERSUS P2 KEYS', pad: 'GAMEPAD BUTTONS' }[this.profile];
    drawSetupScreen(ctx, this.t, title, this.items(), this.sel, this.waiting ? 'Press the new key (Esc cancels)' : 'Space/Enter to rebind. Movement on gamepads always uses stick + d-pad.', 'hard');
  }
}
