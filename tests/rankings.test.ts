import { describe, it, expect } from 'vitest';
import { rankingPoints, dropExpired, computeRanks, Result, isValid } from '../src/career/rankings';
import { eligibility } from '../src/career/entry';
import { TIERS } from '../src/data/tour';

describe('52-week rolling window', () => {
  it('a result counts for 52 weeks and drops when the same week comes around', () => {
    const r: Result[] = [[10, 250, 't250']];
    expect(rankingPoints(r, 10)).toBe(250);
    expect(rankingPoints(r, 61)).toBe(250); // 51 weeks later still counts
    expect(rankingPoints(r, 62)).toBe(0); // same week next season: dropped
    expect(isValid(r[0], 62)).toBe(false);
    expect(dropExpired(r, 62)).toEqual([]);
  });
  it('future results do not count yet', () => {
    expect(rankingPoints([[20, 100, 'c125']], 19)).toBe(0);
  });
  it('defending points: replacing a result next season', () => {
    const r: Result[] = [[5, 500, 't500'], [57, 100, 't500']];
    expect(rankingPoints(r, 56)).toBe(500);
    expect(rankingPoints(r, 57)).toBe(100);
  });
});

describe('best 19', () => {
  it('only the best 19 results count', () => {
    const r: Result[] = [];
    for (let i = 0; i < 25; i++) r.push([i + 1, i + 1, 'c75']);
    // best 19 of 1..25 = 7..25
    const expected = Array.from({ length: 19 }, (_, i) => 25 - i).reduce((a, b) => a + b, 0);
    expect(rankingPoints(r, 30)).toBe(expected);
  });
  it('tour finals counts on top of the best 19', () => {
    const r: Result[] = [];
    for (let i = 0; i < 20; i++) r.push([i + 1, 100, 'c125']);
    r.push([45, 600, 'finals']);
    expect(rankingPoints(r, 45)).toBe(1900 + 600);
  });
});

describe('ranking order', () => {
  it('sorts by points, ties by fewer events, zero points unranked', () => {
    const m = computeRanks([
      { id: 'a', name: 'A', points: 300, events: 10 },
      { id: 'b', name: 'B', points: 500, events: 12 },
      { id: 'c', name: 'C', points: 300, events: 8 },
      { id: 'd', name: 'D', points: 0, events: 0 },
    ]);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(2);
    expect(m.get('a')).toBe(3);
    expect(m.get('d')).toBe(null);
  });
});

describe('entry eligibility', () => {
  it('futures are open to everyone, including unranked', () => {
    expect(eligibility('f15', null).status).toBe('direct');
    expect(eligibility('f25', 900).status).toBe('direct');
  });
  it('challenger 75: direct <= 350, qualifying <= 550', () => {
    expect(eligibility('c75', 350).status).toBe('direct');
    expect(eligibility('c75', 351).status).toBe('qualifying');
    expect(eligibility('c75', 550).label).toBe('Qualifying only');
    const e = eligibility('c75', 551);
    expect(e.status).toBe('ineligible');
    expect(e.label).toBe('Not eligible: rank #550 required');
    expect(eligibility('c75', null).status).toBe('ineligible');
  });
  it('majors: direct <= 104, qualifying <= 240', () => {
    expect(eligibility('major', 104).status).toBe('direct');
    expect(eligibility('major', 105).status).toBe('qualifying');
    expect(eligibility('major', 241).label).toBe('Not eligible: rank #240 required');
  });
  it('every tier matches the data file cutoffs', () => {
    for (const t of Object.values(TIERS)) {
      if (t.id === 'finals' || t.direct === null) continue;
      expect(eligibility(t.id, t.direct).status).toBe('direct');
      expect(eligibility(t.id, t.direct + 1).status).toBe(t.qual ? 'qualifying' : 'ineligible');
    }
  });
  it('wildcards override the cutoff; finals need top 8', () => {
    expect(eligibility('t250', 600, { wildcard: true }).status).toBe('wildcard');
    expect(eligibility('finals', 8).status).toBe('direct');
    expect(eligibility('finals', 9).status).toBe('ineligible');
  });
});
