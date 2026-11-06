import { describe, it, expect } from 'vitest';
import { lessonById, LESSONS, ShotResult } from '../src/data/lessons';

const r = (o: Partial<ShotResult>): ShotResult => ({ hitX: 2, hitY: -12, landX: 0, landY: 9, inside: true, shot: 'normal', good: true, recovered: true, ...o });
const L = (id: string) => lessonById(id)!;

describe('Tactics School drill rules', () => {
  it('has 8 lessons, each linked to a game plan and with a pass condition', () => {
    expect(LESSONS).toHaveLength(8);
    for (const l of LESSONS) {
      expect(l.intro.length).toBeGreaterThan(0);
      expect(Object.values(l.need).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });
  it('crosscourt: diagonal and deep counts; down the line, short or out does not', () => {
    const l = L('cross');
    expect(l.classify(r({ hitX: 2, landX: -2.5, landY: 9 }), 0)).toBe('ok');
    expect(l.classify(r({ hitX: -2, landX: 2.5, landY: 9 }), 0)).toBe('ok');
    expect(l.classify(r({ hitX: 2, landX: 2.5, landY: 9 }), 0)).toBeNull();
    expect(l.classify(r({ hitX: 2, landX: -2.5, landY: 4 }), 0)).toBeNull();
    expect(l.classify(r({ hitX: 2, landX: -2.5, landY: 9, inside: false }), 0)).toBeNull();
    expect(l.streak).toBe(true);
  });
  it('open court: away from the stand-in opponent', () => {
    const l = L('open');
    const d = l.dummy!(0)!;
    expect(l.classify(r({ landX: -Math.sign(d.x) * 2.5, landY: 9 }), 0)).toBe('ok');
    expect(l.classify(r({ landX: Math.sign(d.x) * 2.5, landY: 9 }), 0)).toBeNull();
  });
  it('down the line needs a clean ball', () => {
    const l = L('line');
    expect(l.classify(r({ hitX: 2, landX: 3, landY: 10 }), 0)).toBe('ok');
    expect(l.classify(r({ hitX: 2, landX: 3, landY: 10, good: false }), 0)).toBeNull();
    expect(l.classify(r({ hitX: 2, landX: -3, landY: 10 }), 0)).toBeNull();
  });
  it('short ball: must step in and land deep', () => {
    const l = L('short');
    expect(l.classify(r({ hitY: -8, landY: 10 }), 0)).toBe('ok');
    expect(l.classify(r({ hitY: -12, landY: 10 }), 0)).toBeNull();
    expect(l.classify(r({ hitY: -8, landY: 5 }), 0)).toBeNull();
  });
  it('serve: wide and T are separate targets', () => {
    const l = L('serve');
    expect(l.classify(r({ shot: 'serve', landX: -3.6, landY: 5 }), 0)).toBe('wide');
    expect(l.classify(r({ shot: 'serve', landX: -0.4, landY: 5 }), 0)).toBe('t');
    expect(l.classify(r({ shot: 'serve', landX: -2.0, landY: 5 }), 0)).toBeNull();
    expect(l.need).toEqual({ wide: 2, t: 2 });
  });
  it('net player: deep lob or sideline pass', () => {
    const l = L('pass');
    expect(l.classify(r({ shot: 'lob', landX: 0, landY: 10.5 }), 0)).toBe('ok');
    expect(l.classify(r({ shot: 'lob', landX: 0, landY: 6 }), 0)).toBeNull();
    expect(l.classify(r({ landX: 3.6, landY: 7 }), 0)).toBe('ok');
    expect(l.classify(r({ landX: 0.5, landY: 9 }), 0)).toBeNull();
  });
  it('defend: deep through the middle AND recovered', () => {
    const l = L('defend');
    expect(l.classify(r({ landX: 0.5, landY: 9 }), 0)).toBe('ok');
    expect(l.classify(r({ landX: 0.5, landY: 9, recovered: false }), 0)).toBeNull();
    expect(l.classify(r({ landX: 3.8, landY: 9 }), 0)).toBeNull();
  });
});
