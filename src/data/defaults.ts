import { PlayerSetup, Stats, DEFAULT_KIT } from './types';

export const HUMAN_STATS: Stats = {
  forehand: 72, backhand: 66, serve: 68, footwork: 72, volley: 62, touch: 62, spin: 64, ret: 66, endurance: 70, mental: 66,
};

export function humanSetup(name = 'You', short = 'YOU', kit = DEFAULT_KIT): PlayerSetup {
  return {
    name, short, stats: { ...HUMAN_STATS }, archetype: 'allCourt', kit: { ...kit }, hand: 'R', twoHanded: true, badges: [], startStamina: 100,
    city: 'Home',
  };
}

export const P2_KIT = { shirt: '#ffffff', shorts: '#26324a', band: '#e84a4a', skin: '#c98e62', hair: '#111111', shoes: '#f4f4f4' };
