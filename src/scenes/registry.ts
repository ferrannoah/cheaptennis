import { TitleScene } from './title';
import { ExhibitionSetup } from './exhibition';
import { MatchScene } from './match';
import { StatCardScene } from './statcard';
import { Controller } from '../core/input';
import { humanSetup, P2_KIT } from '../data/defaults';
import { roster, proSetup } from '../data/roster';
import { FORMATS, FormatId } from '../match/scoring';
import { SurfaceId } from '../data/surfaces';
import { game } from '../core/game';
import { ResultScene } from './result';
import { settings } from '../core/settings';
import { TournamentSetup, BracketScene, createTournament } from './tournament';
import { TrophyScene } from './trophy';
import { VersusSetup } from './versus';
import { PracticeSetup, makeTutorial, practiceMatch } from './practice';
import { OptionsScene, RemapScene } from './options';
import { CareerMenu } from './career/menu';
import { CreateScene } from './career/create';
import { HubScene } from './career/hub';
import { CalendarScene } from './career/calendar';
import { EventScene } from './career/event';
import { BuildScene } from './career/build';
import { RankingsScene } from './career/rankings';
import { CareerPage } from './career/page';
import { createCareer } from '../career/season';
import { beginWeek, enterEvent, rehydrate } from '../career/flow';
import { CareerState, saveCareer, loadCareer, parseCareer } from '../career/state';
import { DEFAULT_KIT } from '../data/types';
import { autoWeek } from '../career/auto';

let career: CareerState | null = null;
function getCareer(): CareerState {
  if (!career) {
    career = createCareer({ name: 'Test Player', hand: 'R', twoHanded: true, kit: { ...DEFAULT_KIT, shirt: '#3a7bd5', band: '#f5c542' }, primary: 'aggressive', secondary: 'bigServer' }, 4242);
    beginWeek(career);
    saveCareer(career);
  }
  return career;
}

/** Scene factories for test hooks (window.__game.goto). */
export function registerScenes(): void {
  window.__scenes = {
    title: () => new TitleScene(),
    exhibition: () => new ExhibitionSetup(),
    statcard: (p?: { surface?: SurfaceId }) => {
      const a = humanSetup();
      const b = proSetup(roster()[4]);
      return new StatCardScene(a, b, p?.surface ?? 'grass', 'EXHIBITION', () => {});
    },
    match: (p?: { surface?: SurfaceId; format?: FormatId; ai?: boolean; opp?: number; seed?: number; versus?: 'kb' | 'pad'; stamina?: number; stamina2?: number }) => {
      const a = humanSetup(p?.versus ? 'Player 1' : 'You', p?.versus ? 'P1' : 'YOU');
      if (p?.stamina !== undefined) a.startStamina = p.stamina;
      const b = p?.versus ? humanSetup('Player 2', 'P2', P2_KIT) : proSetup(roster()[p?.opp ?? 20]);
      if (p?.stamina2 !== undefined) b.startStamina = p.stamina2;
      const players: [typeof a, typeof b] = [a, b];
      const c1 = p?.ai ? null : p?.versus === 'kb' ? new Controller('p1', 'vs1', null) : p?.versus === 'pad' ? new Controller('p1', null, 0) : new Controller('p1', 'solo', 0);
      const c2 = p?.versus === 'kb' ? new Controller('p2', 'vs2', null) : p?.versus === 'pad' ? new Controller('p2', null, 1) : null;
      return new MatchScene({
        surface: p?.surface ?? 'grass', format: FORMATS[p?.format ?? '3games'].f, players,
        controllers: [c1, c2], difficulty: settings.difficulty, seed: p?.seed ?? 99,
      }, { onEnd: (r) => game.goto(new ResultScene(r, players, null, () => game.goto(new TitleScene()))) });
    },
    tournament: () => new TournamentSetup(),
    bracket: (p?: { size?: number; surface?: SurfaceId }) => new BracketScene(createTournament(p?.size ?? 16, p?.surface ?? 'hard', '3games', settings.difficulty, 7)),
    trophy: () => new TrophyScene('Coastline Classic', 'Hard • 16-player draw', () => game.goto(new TitleScene())),
    versus: () => new VersusSetup(),
    practice: () => new PracticeSetup(),
    tutorial: () => makeTutorial('hard'),
    machine: (p?: { serve?: boolean }) => practiceMatch({ type: 'normal', side: 'mix', speed: 1, interval: 60, serve: !!p?.serve }, 'hard'),
    options: () => new OptionsScene(),
    remap: () => new RemapScene('solo', new OptionsScene()),
    careermenu: () => new CareerMenu(),
    create: () => new CreateScene(),
    hub: () => new HubScene(getCareer()),
    calendar: () => new CalendarScene(getCareer()),
    build: () => new BuildScene(getCareer()),
    rankings: () => new RankingsScene(getCareer()),
    careerpage: () => new CareerPage(getCareer()),
    event: (p?: { eventId?: string }) => {
      const s = getCareer();
      if (!s.current && p?.eventId) enterEvent(s, p.eventId);
      return new EventScene(s);
    },
  };
  // extra career test helpers
  (window as any).__career = {
    get: () => getCareer(),
    reset: () => (career = null),
    autoWeeks: (n: number) => {
      const s = getCareer();
      const msgs: string[][] = [];
      for (let i = 0; i < n; i++) msgs.push(autoWeek(s));
      saveCareer(s);
      return { week: s.week, rank: s.playerRank, points: s.playerPoints, last: msgs[msgs.length - 1] };
    },
    reloadFromStorage: () => {
      const s = loadCareer();
      if (s) {
        rehydrate(s);
        career = s;
      }
      return !!s;
    },
    roundTrip: () => {
      const s = getCareer();
      const json = JSON.stringify(s);
      const back = parseCareer(json);
      return !!back && JSON.stringify(back) === json;
    },
    setStats: (v: number) => {
      const s = getCareer();
      for (const k of Object.keys(s.player.stats)) (s.player.stats as any)[k] = v;
    },
  };
}
