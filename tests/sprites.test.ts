import { describe, it, expect } from 'vitest';
import { ANIM_NAMES, FALLBACKS, pickFrame, resolveAnim, AnimName } from '../src/gfx/sprites';

describe('sprite frame picking', () => {
  it('one-shot strokes land the contact frame exactly at contact (k = 1)', () => {
    const meta = { contact: 3 };
    // 7 frames: 0,1,2 before contact, 3 = contact, 4,5,6 after
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 0 })).toBe(0);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 0.5 })).toBe(1);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 0.99 })).toBe(2);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 1 })).toBe(3);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 1.3 })).toBe(4);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 1.99 })).toBe(6);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: 5 })).toBe(6);
    expect(pickFrame(7, meta, { name: 'forehand', kind: 'once', k: -1 })).toBe(0);
  });

  it('every frame of a one-shot is shown somewhere in its run', () => {
    for (const [n, c] of [[7, 3], [10, 6], [4, 2], [5, 0], [5, 4]] as const) {
      const seen = new Set<number>();
      for (let k = 0; k <= 2; k += 0.001) seen.add(pickFrame(n, { contact: c }, { name: 'serve', kind: 'once', k }));
      expect(seen.size).toBe(n);
    }
  });

  it('loops follow the clock at the manifest fps, cycles follow the stride', () => {
    expect(pickFrame(4, { fps: 6 }, { name: 'ready', kind: 'clock', t: 0 })).toBe(0);
    expect(pickFrame(4, { fps: 6 }, { name: 'ready', kind: 'clock', t: 0.5 })).toBe(3);
    expect(pickFrame(4, { fps: 6 }, { name: 'ready', kind: 'clock', t: 0.7 })).toBe(0); // wrapped
    expect(pickFrame(4, { fps: 6, loop: false }, { name: 'gThrow', kind: 'clock', t: 9 })).toBe(3); // holds the last frame
    expect(pickFrame(8, {}, { name: 'run', kind: 'cycle', phase: 0.5 })).toBe(4);
    expect(pickFrame(8, {}, { name: 'run', kind: 'cycle', phase: 2.99 })).toBe(7);
    expect(pickFrame(1, {}, { name: 'run', kind: 'cycle', phase: 0.5 })).toBe(0);
  });
});

describe('sprite fallbacks', () => {
  it('a missing strip falls back along FALLBACKS, ending on ready', () => {
    const have = (set: AnimName[]) => (n: AnimName) => set.includes(n);
    expect(resolveAnim('backhand', have(['ready', 'backhand']))).toBe('backhand');
    expect(resolveAnim('backhand', have(['ready', 'backhand1h']))).toBe('backhand1h');
    expect(resolveAnim('bhSlice', have(['ready', 'forehand']))).toBe('forehand');
    expect(resolveAnim('gThrow', have(['ready']))).toBe('ready');
    expect(resolveAnim('serve', have([]))).toBe(null);
  });

  it('every animation has a fallback list that only names real animations', () => {
    for (const n of ANIM_NAMES) for (const f of FALLBACKS[n]) expect(ANIM_NAMES).toContain(f);
  });
});
