import { describe, it, expect } from 'vitest';
import { createCareer } from '../src/career/season';
import { autoWeek } from '../src/career/auto';
import { seasonOf, weekOfSeason } from '../src/career/state';
import { ovr, DEFAULT_KIT } from '../src/data/types';
import { beginWeek } from '../src/career/flow';

function runCareer(seed: number, seasons: number) {
  const s = createCareer({ name: 'Sim', hand: 'R', twoHanded: true, kit: DEFAULT_KIT, primary: 'aggressive', secondary: 'bigServer' }, seed);
  beginWeek(s);
  const log: string[] = [];
  while (seasonOf(s.week) <= seasons) {
    const msgs = autoWeek(s);
    if (weekOfSeason(s.week) % 13 === 1) log.push(`S${seasonOf(s.week)}W${weekOfSeason(s.week)} rank ${s.playerRank ?? '-'} pts ${s.playerPoints} ovr ${ovr(s.player.stats)}`);
    void msgs;
    if (s.player.top100Week && s.player.firstMajorMainWeek && s.week > s.player.firstMajorMainWeek + 52) break;
  }
  return { s, log };
}

describe('career quick-sim progression', () => {
  it('a new career reaches the top 100 and a Major main draw within 3 seasons (median of seeds)', () => {
    const top100: number[] = [];
    const major: number[] = [];
    for (const seed of [11, 22, 33, 44, 55, 4242, 77]) {
      const t0 = Date.now();
      const { s, log } = runCareer(seed, 3);
      console.log(`seed ${seed} (${Date.now() - t0}ms): top100 week ${s.player.top100Week} majorMain week ${s.player.firstMajorMainWeek} final rank ${s.playerRank} ovr ${ovr(s.player.stats)} titles ${s.player.titles.length}`);
      console.log('  ' + log.join(' | '));
      top100.push(s.player.top100Week ?? 9999);
      major.push(s.player.firstMajorMainWeek ?? 9999);
    }
    top100.sort((a, b) => a - b);
    major.sort((a, b) => a - b);
    expect(top100[3]).toBeLessThanOrEqual(3 * 52);
    expect(major[3]).toBeLessThanOrEqual(3 * 52);
  }, 600_000);
});
