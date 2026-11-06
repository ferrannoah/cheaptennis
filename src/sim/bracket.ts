import { Rng } from '../core/rng';
import { SurfaceId } from '../data/surfaces';
import { MatchFormat } from '../match/scoring';
import { simMatch, SimPlayer } from './match-sim';

export interface Entrant {
  key: string; // 'you' or 'pro:<id>'
  name: string;
  short: string;
  seed: number; // 0 = unseeded
  human: boolean;
  sim: SimPlayer;
  rank?: number;
}

export interface BMatch {
  a: number; // entrant index
  b: number; // entrant index or -1 for bye
  winner: number; // entrant index, -1 if unplayed
  score: string;
}

/** standard seeding positions: seedPositions(8) -> [1,8,4,5,2,7,3,6] */
export function seedPositions(n: number): number[] {
  let s = [1, 2];
  while (s.length < n) {
    const m = s.length * 2 + 1;
    s = s.flatMap((x) => [x, m - x]);
  }
  return s;
}

export function roundName(playersLeft: number): string {
  if (playersLeft === 2) return 'Final';
  if (playersLeft === 4) return 'Semifinal';
  if (playersLeft === 8) return 'Quarterfinal';
  return `Round of ${playersLeft}`;
}

export function roundShort(playersLeft: number): string {
  if (playersLeft === 2) return 'F';
  if (playersLeft === 4) return 'SF';
  if (playersLeft === 8) return 'QF';
  return `R${playersLeft}`;
}

export class Bracket {
  rounds: BMatch[][] = [];
  round = 0;
  champion = -1;

  /** entrants must be sorted strongest first (index 0 = seed 1) */
  constructor(public entrants: Entrant[], seeds: number) {
    const n = entrants.length;
    const pos = seedPositions(n);
    for (let i = 0; i < n; i++) entrants[i].seed = i < seeds ? i + 1 : 0;
    const order = pos.map((p) => p - 1);
    const first: BMatch[] = [];
    for (let i = 0; i < n; i += 2) first.push({ a: order[i], b: order[i + 1], winner: -1, score: '' });
    this.rounds.push(first);
  }

  get size(): number {
    return this.entrants.length;
  }

  playersLeft(round = this.round): number {
    return this.size >> round;
  }

  current(): BMatch[] {
    return this.rounds[this.round];
  }

  humanMatch(): BMatch | null {
    if (this.champion >= 0) return null;
    return this.current().find((m) => m.winner < 0 && (this.entrants[m.a].human || (m.b >= 0 && this.entrants[m.b].human))) ?? null;
  }

  humanAlive(): boolean {
    if (this.champion >= 0) return this.entrants[this.champion].human;
    return this.current().some((m) => this.entrants[m.a].human || (m.b >= 0 && this.entrants[m.b].human)) &&
      !this.current().some((m) => m.winner >= 0 && ((this.entrants[m.a].human && m.winner !== m.a) || (m.b >= 0 && this.entrants[m.b].human && m.winner !== m.b)));
  }

  /** simulate every unplayed non-human match in the current round */
  simRound(rng: Rng, sf: SurfaceId, format: MatchFormat, includeHuman = false): void {
    for (const m of this.current()) {
      if (m.winner >= 0) continue;
      if (m.b < 0) {
        m.winner = m.a;
        m.score = 'bye';
        continue;
      }
      const A = this.entrants[m.a], B = this.entrants[m.b];
      if (!includeHuman && (A.human || B.human)) continue;
      const r = simMatch(A.sim, B.sim, sf, format, rng);
      m.winner = r.winner === 0 ? m.a : m.b;
      m.score = r.winner === 0 ? r.score : flipScore(r.score);
    }
  }

  record(m: BMatch, winnerIdx: number, score: string): void {
    m.winner = winnerIdx;
    m.score = score;
  }

  roundDone(): boolean {
    return this.current().every((m) => m.winner >= 0);
  }

  /** move winners into the next round; returns false when the event is over */
  advance(): boolean {
    const cur = this.current();
    if (cur.length === 1) {
      this.champion = cur[0].winner;
      return false;
    }
    const next: BMatch[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push({ a: cur[i].winner, b: cur[i + 1].winner, winner: -1, score: '' });
    this.rounds.push(next);
    this.round++;
    return true;
  }

  /** the round the human lost in (players-left count), or 0 */
  humanExitRound(): number {
    for (let r = 0; r < this.rounds.length; r++) {
      for (const m of this.rounds[r]) {
        const h = this.entrants[m.a]?.human ? m.a : m.b >= 0 && this.entrants[m.b].human ? m.b : -1;
        if (h >= 0 && m.winner >= 0 && m.winner !== h) return this.size >> r;
      }
    }
    return 0;
  }
}

/** score string from the other player's perspective: "6-4 3-6" -> "4-6 6-3" */
export function flipScore(s: string): string {
  return s
    .split(' ')
    .map((p) => {
      const [a, b] = p.split('-');
      return b !== undefined ? `${b}-${a}` : p;
    })
    .join(' ');
}
