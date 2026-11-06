export type StatKey = 'forehand' | 'backhand' | 'serve' | 'footwork' | 'volley' | 'touch' | 'spin' | 'ret' | 'endurance' | 'mental';
export const STAT_KEYS: StatKey[] = ['forehand', 'backhand', 'serve', 'footwork', 'volley', 'touch', 'spin', 'ret', 'endurance', 'mental'];
export const STAT_LABEL: Record<StatKey, string> = {
  forehand: 'Forehand', backhand: 'Backhand', serve: 'Serve', footwork: 'Footwork', volley: 'Volley',
  touch: 'Touch', spin: 'Spin', ret: 'Return', endurance: 'Endurance', mental: 'Mental',
};
export type Stats = Record<StatKey, number>;

export type ArchetypeId = 'bigServer' | 'grinder' | 'aggressive' | 'serveVolley' | 'counterpuncher' | 'allCourt' | 'claySpec';

export interface Kit {
  shirt: string;
  shorts: string;
  band: string;
  skin: string;
  hair: string;
  shoes: string;
}

export const DEFAULT_KIT: Kit = { shirt: '#ffffff', shorts: '#ffffff', band: '#ffffff', skin: '#e6b08a', hair: '#3a2614', shoes: '#f4f4f4' };

export type ShotType = 'normal' | 'topspin' | 'slice' | 'lob' | 'drop';
export type ServeType = 'flat' | 'kick' | 'slice';

export interface PlayerSetup {
  name: string;
  short: string; // HUD label e.g. "YOU", "COM", "P1"
  stats: Stats;
  archetype: ArchetypeId;
  kit: Kit;
  hand: 'R' | 'L';
  twoHanded: boolean;
  badges: string[];
  startStamina: number; // 0..100
  city?: string;
  /** COM game-plan blend (defaults to the archetype's blend) */
  tactics?: import('./tactics').TacticBlend;
  /** true = the blend is forced and the AI won't adapt it */
  tacticsFixed?: boolean;
}

export function ovr(s: Stats): number {
  const w: Record<StatKey, number> = {
    forehand: 1.3, backhand: 1.2, serve: 1.3, footwork: 1.3, volley: 0.7, touch: 0.6, spin: 0.7, ret: 1.0, endurance: 0.8, mental: 0.8,
  };
  let a = 0;
  let t = 0;
  for (const k of STAT_KEYS) {
    a += s[k] * w[k];
    t += w[k];
  }
  return Math.round(a / t);
}

export function rating10(v: number): number {
  return Math.max(1, Math.min(10, Math.ceil(v / 10)));
}

export function flatStats(v: number): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = v;
  return s;
}
