import { Scene, W, H } from '../core/game';
import { ANIM_NAMES, playerSprites, SpriteView } from '../gfx/sprites';
import { text } from '../gfx/text';

const PER_PAGE = 8;

/**
 * Test scene: every player sprite strip, frame by frame (contact frame boxed in yellow; missing strips
 * listed with what they fall back to). For checking new sprite art: ?test, then __game.goto('spritegallery', { view, page }).
 */
export class SpriteGallery implements Scene {
  name = 'spritegallery';
  constructor(public view: SpriteView = 'back', public page = 0) {}
  update(): void {
    playerSprites.load();
  }
  debugState(): Record<string, unknown> {
    return { sprites: playerSprites.state, missing: playerSprites.missing.length };
  }
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#2f6db5';
    ctx.fillRect(0, 0, W, H);
    const pages = Math.ceil(ANIM_NAMES.length / PER_PAGE);
    text(ctx, `Player sprites: ${this.view} view • page ${this.page + 1}/${pages} • ${playerSprites.state}`, W / 2, 14, { size: 12, align: 'center' });
    const bank = playerSprites;
    if (bank.state !== 'ready' || !bank.manifest) return;
    const k = 40 / bank.manifest.figureHeight; // figures ≈40 px tall
    ANIM_NAMES.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((name, r) => {
      const y = 82 + r * 54;
      const strip = bank.strips[this.view][name];
      const meta = bank.manifest!.animations[name] ?? {};
      const fell = bank.resolve(this.view, name);
      const info = strip ? `${strip.frames}f ${meta.contact !== undefined ? 'c' + meta.contact : meta.fps ? meta.fps + 'fps' : ''}` : `→ ${fell?.name ?? 'none'}`;
      text(ctx, name, 8, y - 26, { size: 11, color: '#ffd479' });
      text(ctx, info, 8, y - 12, { size: 9, color: strip ? '#cfe3ff' : '#ff9a9a', weight: 700 });
      if (!strip) return;
      for (let f = 0; f < strip.frames; f++) {
        const x = 118 + f * 52;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 26, y - 52, 52, 54);
        ctx.clip();
        bank.drawFrame(ctx, strip, f, x, y, k);
        ctx.restore();
        if (f === meta.contact) {
          ctx.strokeStyle = '#ffd23a';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - 25, y - 51, 50, 52);
        }
      }
    });
  }
}
