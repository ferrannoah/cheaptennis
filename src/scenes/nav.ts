import { game } from '../core/game';
import { ExhibitionSetup } from './exhibition';
import { TournamentSetup } from './tournament';
import { VersusSetup } from './versus';
import { PracticeSetup } from './practice';
import { OptionsScene } from './options';
import { CareerMenu } from './career/menu';

export function goExhibition(): void {
  game.goto(new ExhibitionSetup());
}
export function goTournament(): void {
  game.goto(new TournamentSetup());
}
export function goCareer(): void {
  game.goto(new CareerMenu());
}
export function goVersus(): void {
  game.goto(new VersusSetup());
}
export function goPractice(): void {
  game.goto(new PracticeSetup());
}
export function goOptions(): void {
  game.goto(new OptionsScene());
}
