import { describe, it, expect } from 'vitest';
import { Score } from '../src/match/scoring';

function win(s: Score, p: 0 | 1, n: number) {
  let last;
  for (let i = 0; i < n; i++) last = s.pointWon(p);
  return last!;
}

describe('game scoring', () => {
  it('counts 15/30/40/game', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 });
    s.pointWon(0);
    expect(s.pointLabel(0)).toBe('15');
    s.pointWon(0);
    expect(s.pointLabel(0)).toBe('30');
    s.pointWon(0);
    expect(s.pointLabel(0)).toBe('40');
    expect(s.pointLabel(1)).toBe('0');
    const r = s.pointWon(0);
    expect(r.events).toContain('game');
    expect(s.games).toEqual([1, 0]);
    expect(s.points).toEqual([0, 0]);
  });

  it('handles deuce and advantage', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 });
    win(s, 0, 3);
    win(s, 1, 2);
    const d = s.pointWon(1);
    expect(d.events).toContain('deuce');
    const a = s.pointWon(0);
    expect(a.events).toContain('advantage');
    expect(s.pointLabel(0)).toBe('AD');
    const back = s.pointWon(1);
    expect(back.events).toContain('deuce');
    s.pointWon(1);
    const g = s.pointWon(1);
    expect(g.events).toContain('game');
    expect(g.events).toContain('break'); // player 0 served
    expect(s.games).toEqual([0, 1]);
  });

  it('alternates server each game and flags changeovers on odd games', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 }, 0);
    expect(s.server).toBe(0);
    const r = win(s, 0, 4);
    expect(r.events).toContain('changeover');
    expect(s.server).toBe(1);
    const r2 = win(s, 1, 4);
    expect(r2.events).not.toContain('changeover');
    expect(s.server).toBe(0);
  });

  it('tracks deuce/ad court', () => {
    const s = new Score({ kind: 'sets', bestOf: 1 });
    expect(s.deuceCourt).toBe(true);
    s.pointWon(0);
    expect(s.deuceCourt).toBe(false);
  });

  it('detects break points', () => {
    const s = new Score({ kind: 'sets', bestOf: 1 }, 0);
    win(s, 1, 3);
    expect(s.isBreakPoint()).toBe(true);
    s.pointWon(0);
    expect(s.isBreakPoint()).toBe(true); // 15-40
    win(s, 0, 2); // deuce
    expect(s.isBreakPoint()).toBe(false);
  });

  it('labels the scoreboard pressure tab', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 }, 0);
    expect(s.pressureLabel()).toBe('');
    win(s, 1, 3); // 0-40 on player 0's serve
    expect(s.pressureLabel()).toBe('BREAK POINT');
    win(s, 1, 1);
    // player 1 leads 5-0 in the first set and serves next... give player 0 games until set point
    const t = new Score({ kind: 'sets', bestOf: 3 }, 0);
    for (let g = 0; g < 5; g++) win(t, 0, 4); // 5-0 (holds and breaks)
    win(t, 0, 3); // 40-0 at 5-0 -> set point
    expect(t.pressureLabel()).toBe('SET POINT');
    win(t, 0, 1); // set 1: 6-0
    for (let g = 0; g < 5; g++) win(t, 0, 4);
    win(t, 0, 3);
    expect(t.pressureLabel()).toBe('MATCH POINT');
  });
});

describe('set and match scoring', () => {
  it('first to 3 games format ends at 3 games', () => {
    const s = new Score({ kind: 'games', target: 3 });
    win(s, 0, 8);
    win(s, 1, 4);
    const r = win(s, 0, 4);
    expect(s.games[0]).toBe(3);
    expect(r.events).toContain('match');
    expect(s.winner).toBe(0);
  });

  it('1 game format', () => {
    const s = new Score({ kind: 'games', target: 1 });
    const r = win(s, 1, 4);
    expect(r.events).toContain('match');
    expect(s.winner).toBe(1);
  });

  it('a set needs a 2-game margin and goes to a tiebreak at 6-6', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 });
    for (let i = 0; i < 5; i++) {
      win(s, 0, 4);
      win(s, 1, 4);
    }
    expect(s.games).toEqual([5, 5]);
    win(s, 0, 4);
    expect(s.games).toEqual([6, 5]);
    expect(s.sets).toEqual([0, 0]);
    const r = win(s, 1, 4);
    expect(r.events).toContain('tiebreak');
    expect(s.tiebreak).toBe(true);
  });

  it('tiebreak to 7 with 2-point margin, serve rotation 1-2-2', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 }, 0);
    for (let i = 0; i < 6; i++) {
      win(s, 0, 4);
      win(s, 1, 4);
    }
    expect(s.tiebreak).toBe(true);
    const first = s.server;
    const servers: number[] = [s.server];
    for (let i = 0; i < 5; i++) {
      s.pointWon((i % 2) as 0 | 1);
      servers.push(s.server);
    }
    // A, B, B, A, A, B
    expect(servers).toEqual([first, 1 - first, 1 - first, first, first, 1 - first]);
    // play to 6-6 then 8-6
    while (s.points[0] < 6) s.pointWon(0);
    while (s.points[1] < 6) s.pointWon(1);
    expect(s.tiebreak).toBe(true);
    s.pointWon(0);
    expect(s.tiebreak).toBe(true);
    const r = s.pointWon(0);
    expect(r.events).toContain('set');
    expect(s.sets).toEqual([1, 0]);
    expect(s.setHistory[0]).toEqual([7, 6]);
    expect(s.tiebreak).toBe(false);
    // the player who received first in the tiebreak serves the next set
    expect(s.server).toBe(1 - first);
  });

  it('best of 3 requires 2 sets', () => {
    const s = new Score({ kind: 'sets', bestOf: 3 });
    for (let i = 0; i < 24; i++) s.pointWon(0);
    expect(s.sets).toEqual([1, 0]);
    expect(s.winner).toBe(-1);
    for (let i = 0; i < 24; i++) s.pointWon(0);
    expect(s.winner).toBe(0);
    expect(s.summary()).toBe('6-0 6-0');
  });

  it('best of 5 requires 3 sets', () => {
    const s = new Score({ kind: 'sets', bestOf: 5 });
    for (let i = 0; i < 48; i++) s.pointWon(1);
    expect(s.winner).toBe(-1);
    for (let i = 0; i < 24; i++) s.pointWon(1);
    expect(s.winner).toBe(1);
  });

  it('set/match point detection', () => {
    const s = new Score({ kind: 'games', target: 3 });
    win(s, 0, 8);
    win(s, 0, 3);
    expect(s.isSetPointFor(0)).toBe(true);
    expect(s.isMatchPointFor(0)).toBe(true);
    expect(s.isMatchPointFor(1)).toBe(false);
  });
});
