import { CareerState } from './state';
import { thisWeek, playerEligibility, enterEvent, humanMatch, simHumanMatch, recordHuman, finishWeek, isOffseason } from './flow';
import { canEnter } from './entry';
import { TIERS, PROGRESSION, EventDef } from '../data/tour';
import { autoSpend } from './progression';

/** Pick the best event for a simple ambitious strategy. */
export function pickEvent(s: CareerState): EventDef | null {
  const evs = thisWeek(s)
    .map((e) => ({ e, el: playerEligibility(s, e) }))
    .filter((x) => canEnter(x.el))
    .sort((a, b) => {
      const score = (x: typeof a) => TIERS[x.e.tier].prestige * 10 + (x.el.status === 'qualifying' ? -14 : 0);
      return score(b) - score(a);
    });
  return evs[0]?.e ?? null;
}

/** Quick-sim one whole career week with the auto strategy. Returns messages. */
export function autoWeek(s: CareerState): string[] {
  autoSpend(s.player);
  if (isOffseason(s)) return finishWeek(s, 'train', PROGRESSION.trainXp);
  if (s.player.fatigue >= 4) return finishWeek(s, 'rest');
  const ev = pickEvent(s);
  if (!ev || !enterEvent(s, ev.id)) return finishWeek(s, 'train', PROGRESSION.trainXp);
  let guard = 0;
  while (guard++ < 20) {
    const hm = humanMatch(s);
    if (!hm) break;
    if (hm.opponent === 'bye') {
      recordHuman(s, true, 'bye', { perfects: 0, aces: 0, longRallies: 0, bpSaved: 0 });
      continue;
    }
    const r = simHumanMatch(s);
    recordHuman(s, r.won, r.score, { perfects: 6, aces: r.won ? 3 : 1, longRallies: 1, bpSaved: 1 });
  }
  if (s.current && s.current.stage !== 'done' && !humanMatch(s)) s.current.stage = 'done';
  return finishWeek(s, 'event');
}
