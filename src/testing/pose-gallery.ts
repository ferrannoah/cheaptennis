import { Scene, W, H } from '../core/game';
import { drawFigure, POSES, Pose } from '../gfx/player-renderer';
import { strokePoses } from '../gfx/match-view';
import { text } from '../gfx/text';
import { DEFAULT_KIT, Kit, ShotType } from '../data/types';

/** Test-only scene: every stroke's key poses side by side (playtest screenshots). */
export class PoseGallery implements Scene {
  name = 'posegallery';
  constructor(public view: 'back' | 'front' = 'back', public lefty = false) {}
  update(): void {}
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#2f6db5';
    ctx.fillRect(0, 0, W, H);
    const kit: Kit = { ...DEFAULT_KIT, shirt: '#3a7bd5', band: '#f5c542', shorts: '#ffffff' };
    const rows: [string, ShotType, boolean, boolean][] = [
      ['Forehand', 'topspin', true, true],
      ['Backhand (2H)', 'topspin', false, true],
      ['Backhand (1H)', 'topspin', false, false],
      ['FH slice', 'slice', true, true],
      ['BH slice', 'slice', false, true],
    ];
    const mirror = (this.view === 'front') !== this.lefty;
    text(ctx, `${this.view === 'back' ? 'Near player (back view)' : 'Far player (front view)'} • ${this.lefty ? 'left' : 'right'}-handed`, W / 2, 14, { size: 12, align: 'center' });
    rows.forEach(([label, type, fh, two], r) => {
      const y = 100 + r * 92;
      text(ctx, label, 12, y - 40, { size: 11, color: '#ffd479' });
      const { back, con, fol } = strokePoses(fh, type, two);
      const poses: Pose[] = [POSES.ready, back, con, fol];
      poses.forEach((ps, i) => drawFigure(ctx, 150 + i * 130, y, 44, ps, kit, { mirror, facingCamera: this.view === 'front', twoHanded: two, bob: 0 }));
    });
  }
}
