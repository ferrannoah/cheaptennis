import { Tier, TIERS, TierId } from '../data/tour';

export type EntryStatus = 'direct' | 'qualifying' | 'ineligible' | 'wildcard';

export interface Eligibility {
  status: EntryStatus;
  label: string;
}

/** Entry rules for the human player. rank = null means unranked. */
export function eligibility(tierId: TierId, rank: number | null, opts: { wildcard?: boolean; finalsRace?: number | null } = {}): Eligibility {
  const t: Tier = TIERS[tierId];
  if (opts.wildcard) return { status: 'wildcard', label: 'Wildcard: main draw' };
  if (tierId === 'finals') {
    const r = opts.finalsRace ?? rank;
    if (r !== null && r !== undefined && r <= 8) return { status: 'direct', label: 'Qualified (top 8)' };
    return { status: 'ineligible', label: 'Not eligible: year-end top 8 only' };
  }
  if (t.direct === null) return { status: 'direct', label: 'Open entry' };
  if (rank !== null && rank <= t.direct) return { status: 'direct', label: 'Direct entry' };
  if (t.qual !== null && rank !== null && rank <= t.qual) return { status: 'qualifying', label: 'Qualifying only' };
  const need = t.qual ?? t.direct;
  return { status: 'ineligible', label: `Not eligible: rank #${need} required` };
}

export function canEnter(e: Eligibility): boolean {
  return e.status !== 'ineligible';
}

export { TIERS };
