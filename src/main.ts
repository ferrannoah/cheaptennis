import { Game, setGame } from './core/game';
import { input } from './core/input';
import { installHooks } from './testing/hooks';
import { audio } from './core/audio';
import { TitleScene } from './scenes/title';
import { registerScenes } from './scenes/registry';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const g = new Game(canvas);
setGame(g);
input.attach(window);

const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);
canvas.addEventListener('pointerdown', () => canvas.focus());
canvas.focus();

installHooks(g);
registerScenes();
g.goto(new TitleScene(), 0);
g.start();
