import { ShotInput } from '../src/match/shots';
import { BallState } from '../src/match/ball';
import { flatStats } from '../src/data/types';
import { Rng } from '../src/core/rng';

export const FROM: BallState = { x: 0.3, y: -11.6, z: 0.95, vx: 0, vy: 0, vz: 0, spin: 0, side: 0 };

/** a well-prepared, centred strike from behind the near baseline (override what a test varies) */
export function shotInput(over: Partial<ShotInput> = {}): ShotInput {
  return {
    strike: 'normal', from: FROM, dir: 1, aimX: 0, prep: 1.0, mode: 'arcade', danger: 0, centre: 0, body: false,
    stats: flatStats(75), stamina: 100, speedRatio: 0, runVx: 0, stretch: 0, contactZ: 0.95, contactY: FROM.y, ballVz: 0, inSpeed: 20,
    lateral: 0.8, fh: true, twoHanded: true, volley: false, overhead: false, isReturn: false, badges: [], rng: new Rng(3),
    ...over,
  };
}
