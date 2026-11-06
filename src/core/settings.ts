import { loadJSON, saveJSON } from './save';

export type Action = 'left' | 'right' | 'up' | 'down' | 'normal' | 'topspin' | 'slice' | 'lob' | 'drop';
export const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'normal', 'topspin', 'slice', 'lob', 'drop'];
export const ACTION_LABEL: Record<Action, string> = {
  left: 'Left', right: 'Right', up: 'Up / Deep', down: 'Down / Short',
  normal: 'Normal shot / Serve', topspin: 'Topspin / Kick serve', slice: 'Slice / Slice serve',
  lob: 'Lob', drop: 'Drop shot',
};

export type Profile = 'solo' | 'vs1' | 'vs2';
export type KeyBindings = Record<Action, string[]>;

export const DEFAULT_KEYS: Record<Profile, KeyBindings> = {
  solo: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    normal: ['Space'], topspin: ['KeyZ'], slice: ['KeyX'], lob: ['KeyC'], drop: ['KeyV'],
  },
  vs1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    normal: ['KeyF'], topspin: ['KeyG'], slice: ['KeyH'], lob: ['KeyJ'], drop: ['KeyK'],
  },
  vs2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    normal: ['Numpad1', 'Digit1'], topspin: ['Numpad2', 'Digit2'], slice: ['Numpad3', 'Digit3'],
    lob: ['Numpad4', 'Digit4'], drop: ['Numpad5', 'Digit5'],
  },
};

/** Standard-mapping gamepad buttons. Movement always also uses stick + d-pad. */
export const DEFAULT_PAD: Partial<Record<Action, number>> = {
  normal: 0, // A
  topspin: 2, // X
  slice: 1, // B
  lob: 3, // Y
  drop: 5, // RB
};

export type Difficulty = 'easy' | 'normal' | 'hard' | 'pro';

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
  };
}

export const settings: Settings = (() => {
  const d = defaults();
  const s = loadJSON<Partial<Settings>>('settings', {});
  const merged = { ...d, ...s } as Settings;
  // make sure every action has bindings after version changes
  for (const p of ['solo', 'vs1', 'vs2'] as Profile[]) {
    merged.keys[p] = { ...d.keys[p], ...(s.keys?.[p] ?? {}) };
  }
  merged.pad = { ...d.pad, ...(s.pad ?? {}) };
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
