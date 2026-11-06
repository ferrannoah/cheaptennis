/** Pure tennis scoring. Player indices: 0 and 1. */
export type MatchFormat =
  | { kind: 'games'; target: number } // "first to N games" (classic arcade)
  | { kind: 'sets'; bestOf: 1 | 3 | 5 };

export type FormatId = '1game' | '3games' | 'set' | 'bo3' | 'bo5';
export const FORMATS: Record<FormatId, { label: string; f: MatchFormat }> = {
  '1game': { label: '1 Game', f: { kind: 'games', target: 1 } },
  '3games': { label: 'First to 3 games', f: { kind: 'games', target: 3 } },
  set: { label: '6-game set', f: { kind: 'sets', bestOf: 1 } },
  bo3: { label: 'Best of 3 sets', f: { kind: 'sets', bestOf: 3 } },
  bo5: { label: 'Best of 5 sets', f: { kind: 'sets', bestOf: 5 } },
};

export type ScoreEvent =
  | 'point' | 'deuce' | 'advantage' | 'game' | 'break' | 'set' | 'match' | 'tiebreak' | 'changeover' | 'tbswap';

export interface PointResult {
  events: ScoreEvent[];
  winner: 0 | 1;
}

export class Score {
  points: [number, number] = [0, 0];
  games: [number, number] = [0, 0];
  sets: [number, number] = [0, 0];
  setHistory: [number, number][] = [];
  tiebreak = false;
  server: 0 | 1;
  winner: -1 | 0 | 1 = -1;
  /** who served the first point of the current tiebreak */
  private tbFirstServer: 0 | 1 = 0;
  /** server of the current game when not in tiebreak */
  private gameServer: 0 | 1;
  totalPointsWon: [number, number] = [0, 0];
  breakPointsFaced: [number, number] = [0, 0];
  breakPointsSaved: [number, number] = [0, 0];

  constructor(public format: MatchFormat, firstServer: 0 | 1 = 0) {
    this.server = firstServer;
    this.gameServer = firstServer;
  }

  get isGamesFormat(): boolean {
    return this.format.kind === 'games';
  }

  setsToWin(): number {
    return this.format.kind === 'sets' ? Math.ceil(this.format.bestOf / 2) : 1;
  }

  /** points played in the current game / tiebreak */
  get pointsInGame(): number {
    return this.points[0] + this.points[1];
  }

  /** true when the server is serving from the deuce (right) court */
  get deuceCourt(): boolean {
    return this.pointsInGame % 2 === 0;
  }

  isBreakPoint(): boolean {
    if (this.tiebreak || this.winner >= 0) return false;
    const r = (1 - this.server) as 0 | 1;
    const pr = this.points[r];
    const ps = this.points[this.server];
    return pr >= 3 && pr > ps;
  }

  /** game point / set point / match point for player p (approx: next point wins the unit) */
  isGamePointFor(p: 0 | 1): boolean {
    const o = 1 - p;
    if (this.tiebreak) return this.points[p] >= 6 && this.points[p] > this.points[o];
    return this.points[p] >= 3 && this.points[p] > this.points[o];
  }

  isSetPointFor(p: 0 | 1): boolean {
    if (!this.isGamePointFor(p)) return false;
    const g = [...this.games] as [number, number];
    g[p]++;
    return this.setWonBy(g) === p;
  }

  isMatchPointFor(p: 0 | 1): boolean {
    if (!this.isSetPointFor(p)) return false;
    return this.sets[p] + 1 >= this.setsToWin();
  }

  isBigPoint(): boolean {
    return this.isBreakPoint() || this.isSetPointFor(0) || this.isSetPointFor(1) || (this.tiebreak && this.pointsInGame >= 10);
  }

  private setWonBy(g: [number, number]): -1 | 0 | 1 {
    if (this.format.kind === 'games') {
      if (g[0] >= this.format.target) return 0;
      if (g[1] >= this.format.target) return 1;
      return -1;
    }
    for (const p of [0, 1] as const) {
      const o = 1 - p;
      if (g[p] >= 6 && g[p] - g[o] >= 2) return p;
      if (g[p] === 7 && g[o] === 6) return p; // tiebreak
    }
    return -1;
  }

  pointWon(p: 0 | 1): PointResult {
    const events: ScoreEvent[] = ['point'];
    if (this.winner >= 0) return { events, winner: p };
    const o = (1 - p) as 0 | 1;
    this.totalPointsWon[p]++;
    if (this.isBreakPoint()) {
      this.breakPointsFaced[this.server]++;
      if (p === this.server) this.breakPointsSaved[this.server]++;
    }
    this.points[p]++;
    if (this.tiebreak) {
      const total = this.pointsInGame;
      if (this.points[p] >= 7 && this.points[p] - this.points[o] >= 2) {
        this.games[p]++;
        events.push('game');
        this.endSet(p, events);
        return { events, winner: p };
      }
      if (total % 6 === 0) events.push('tbswap');
      // serve rotation 1-2-2
      this.server = (Math.floor((total + 1) / 2) % 2 === 0 ? this.tbFirstServer : 1 - this.tbFirstServer) as 0 | 1;
      return { events, winner: p };
    }
    const a = this.points[p];
    const b = this.points[o];
    if (a >= 4 && a - b >= 2) {
      // game
      const wasBreak = p !== this.server;
      this.games[p]++;
      events.push('game');
      if (wasBreak) events.push('break');
      this.points = [0, 0];
      const sw = this.setWonBy(this.games);
      if (sw >= 0) {
        this.endSet(sw as 0 | 1, events);
      } else {
        this.gameServer = (1 - this.gameServer) as 0 | 1;
        this.server = this.gameServer;
        if (this.format.kind === 'sets' && this.games[0] === 6 && this.games[1] === 6) {
          this.tiebreak = true;
          this.tbFirstServer = this.server;
          events.push('tiebreak');
        }
        if ((this.games[0] + this.games[1]) % 2 === 1) events.push('changeover');
      }
    } else if (a >= 3 && b >= 3) {
      events.push(a === b ? 'deuce' : 'advantage');
    }
    return { events, winner: p };
  }

  private endSet(p: 0 | 1, events: ScoreEvent[]): void {
    this.sets[p]++;
    this.setHistory.push([this.games[0], this.games[1]]);
    events.push('set');
    const wasTb = this.tiebreak;
    this.tiebreak = false;
    this.points = [0, 0];
    if (this.sets[p] >= this.setsToWin()) {
      this.winner = p;
      events.push('match');
      return;
    }
    this.games = [0, 0];
    // next set: the player who received first in the tiebreak serves; else normal alternation
    this.gameServer = (wasTb ? 1 - this.tbFirstServer : 1 - this.gameServer) as 0 | 1;
    this.server = this.gameServer;
    events.push('changeover');
  }

  pointLabel(p: 0 | 1): string {
    if (this.tiebreak) return String(this.points[p]);
    const a = this.points[p];
    const b = this.points[1 - p];
    if (a >= 3 && b >= 3) {
      if (a === b) return '40';
      return a > b ? 'AD' : '40';
    }
    return ['0', '15', '30', '40'][Math.min(3, a)];
  }

  /** e.g. "6-4 3-6 7-6" */
  summary(): string {
    const parts = this.setHistory.map(([a, b]) => `${a}-${b}`);
    if (this.winner < 0 && (this.games[0] || this.games[1] || this.format.kind === 'sets')) parts.push(`${this.games[0]}-${this.games[1]}`);
    return parts.join(' ');
  }
}
