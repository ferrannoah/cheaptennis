export interface BadgeDef {
  id: string;
  name: string;
  short: string;
  color: string;
  effect: string;
  unlock: string;
}

export const BADGES: Record<string, BadgeDef> = {
  aceMachine: { id: 'aceMachine', name: 'Ace Machine', short: 'ACE', color: '#ffd23a', effect: '+4% serve pace', unlock: 'Serve 75+ and 50 career aces' },
  wall: { id: 'wall', name: 'Wall', short: 'WALL', color: '#7fd0ff', effect: '+8% reach on stretches', unlock: 'Footwork 75+ and 10 rallies of 12+ shots won' },
  netMagnet: { id: 'netMagnet', name: 'Net Magnet', short: 'NET', color: '#9ef07a', effect: '+10% volley reach, steadier volleys', unlock: 'Volley 70+' },
  clutch: { id: 'clutch', name: 'Clutch', short: 'CLUTCH', color: '#ff8ad0', effect: 'Tighter aim zone on big points, steadier 2nd serve', unlock: 'Mental 70+ and 20 break points saved' },
  ironLungs: { id: 'ironLungs', name: 'Iron Lungs', short: 'LUNGS', color: '#ffa04a', effect: 'Stamina drains 15% slower', unlock: 'Endurance 75+' },
  dirtballer: { id: 'dirtballer', name: 'Dirtballer', short: 'DIRT', color: '#e0865a', effect: 'Full grip and extra speed on clay', unlock: 'Win a clay-court title' },
};
export const BADGE_IDS = Object.keys(BADGES);
