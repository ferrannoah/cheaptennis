import { loadJSON, saveJSON } from './save';

/**
 * M21 "Elbow" controls: two strike buttons held through contact. B1+B2 (or the Accel key) = acceleration.
 * Up/down while holding picks the strike, left/right sweeps the aim.
 */
export type Action = 'left' | 'right' | 'up' | 'down' | 'b1' | 'b2' | 'acc' | 'gesture';
export const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'b1', 'b2', 'acc', 'gesture'];
export const STRIKE_ACTIONS: Action[] = ['b1', 'b2', 'acc', 'gesture'];
export const ACTION_LABEL: Record<Action, string> = {
  left: 'Left', right: 'Right', up: 'Up (toward the net)', down: 'Down (away from the net)',
  b1: 'Strike 1: normal / top / short', b2: 'Strike 2: slice / drop / lob', acc: 'Acceleration (= 1 + 2)', gesture: 'Gesture (after a point)',
};

export type Profile = 'solo' | 'vs1' | 'vs2';
export type KeyBindings = Record<Action, string[]>;

export const DEFAULT_KEYS: Record<Profile, KeyBindings> = {
  solo: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    b1: ['KeyX', 'Space'], b2: ['KeyZ'], acc: ['KeyC'], gesture: ['KeyV'],
  },
  vs1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    b1: ['KeyF'], b2: ['KeyG'], acc: ['KeyR'], gesture: ['KeyT'],
  },
  vs2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    b1: ['Numpad1', 'Digit1'], b2: ['Numpad2', 'Digit2'], acc: ['Numpad3', 'Digit3'], gesture: ['Numpad4', 'Digit4'],
  },
};

/** Standard-mapping gamepad buttons. Movement always also uses stick + d-pad. */
export const DEFAULT_PAD: Partial<Record<Action, number>> = {
  b1: 0, // A
  b2: 2, // X
  acc: 1, // B
  gesture: 3, // Y
};

export type Difficulty = 'easy' | 'normal' | 'hard' | 'pro';
/** Arcade halves the danger-zone/off-centre penalties and shrinks the aiming zone twice as fast (Tennis Elbow's Arcade mode) */
export type ControlMode = 'arcade' | 'sim';
export type AutoPos = 'slow' | 'average' | 'fast';
/** what the court preview shows: impact marker, + danger zone, + live aiming zone */
export type Preview = 'off' | 'impact' | 'danger' | 'all';

export interface Settings {
  version: 1;
  keys: Record<Profile, KeyBindings>;
  pad: Partial<Record<Action, number>>;
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  trainingHud: boolean;
  difficulty: Difficulty;
  careerLength: 'short' | 'set' | 'full';
  majorsBo5: boolean;
  reducedShake: boolean;
  showFps: boolean;
  /** in-match panel showing what tiredness is costing (toggle with H) */
  fatigueInfo: boolean;
  controlMode: ControlMode;
  autoPos: AutoPos;
  preview: Preview;
}

function defaults(): Settings {
  return {
    version: 1,
    keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
    pad: { ...DEFAULT_PAD },
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
    muted: false,
    trainingHud: false,
    difficulty: 'normal',
    careerLength: 'short',
    majorsBo5: false,
    reducedShake: false,
    showFps: false,
    fatigueInfo: false,
    controlMode: 'arcade',
    autoPos: 'fast',
    preview: 'all',
  };
}

export const settings: Settings = (() => {
  const d = defaults();
  const s = loadJSON<Partial<Settings>>('settings', {});
  const merged = { ...d, ...s } as Settings;
  // make sure every action has bindings after version changes
  // (M21: saves from the old 5-shot-button scheme keep only their movement keys)
  const pick = <V>(o: Partial<Record<string, V>> | undefined): Partial<Record<Action, V>> => {
    const r: Partial<Record<Action, V>> = {};
    if (o) for (const a of ACTIONS) if (o[a] !== undefined) r[a] = o[a];
    return r;
  };
  for (const p of ['solo', 'vs1', 'vs2'] as Profile[]) {
    merged.keys[p] = { ...d.keys[p], ...pick(s.keys?.[p] as Partial<Record<string, string[]>>) } as KeyBindings;
  }
  merged.pad = { ...d.pad, ...pick(s.pad as Partial<Record<string, number>>) };
  return merged;
})();

export function saveSettings(): void {
  saveJSON('settings', settings);
}

export function resetBindings(): void {
  settings.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
  settings.pad = { ...DEFAULT_PAD };
  saveSettings();
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  const map: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: 'Space', Enter: 'Enter', ShiftLeft: 'LShift', ShiftRight: 'RShift',
    ControlLeft: 'LCtrl', ControlRight: 'RCtrl', Comma: ',', Period: '.', Slash: '/',
    Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
  };
  return map[code] ?? code;
}

export const PAD_LABEL: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back', 9: 'Start', 10: 'LS', 11: 'RS',
};
