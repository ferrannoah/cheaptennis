import { W, H } from '../../core/game';
import { CareerState, CareerPlayer, playerOvr, archetypeLabel } from '../../career/state';
import { PlayerSetup } from '../../data/types';
import { fatigueStamina } from '../../career/progression';
import { drawBackdrop } from '../../gfx/backdrop';
import { panel, roundRect } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { weekLabel } from '../../career/flow';
import { TIERS, TierId } from '../../data/tour';
import { SurfaceId } from '../../data/surfaces';

export function careerSetup(p: CareerPlayer): PlayerSetup {
  return {
    name: p.name, short: 'YOU', stats: { ...p.stats }, archetype: p.primary, kit: p.kit, hand: p.hand, twoHanded: p.twoHanded,
    badges: [...p.equipped], startStamina: fatigueStamina(p), city: 'Career',
  };
}

/** Standard career screen frame: backdrop + header strip with player summary. */
export function careerFrame(ctx: CanvasRenderingContext2D, t: number, s: CareerState, title: string, sf: SurfaceId = 'hard'): void {
  drawBackdrop(ctx, t, sf, false);
  ctx.fillStyle = 'rgba(6,12,26,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10,18,34,0.85)';
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(0, 46, W, 2);
  const p = s.player;
  text(ctx, title, 12, 15, { size: 15, color: '#ffc04a' });
  text(ctx, `${p.name}  •  ${archetypeLabel(p)}`, 12, 34, { size: 10, color: '#cfe0f6', weight: 700, maxWidth: 300 });
  const rk = s.playerRank ? `#${s.playerRank}` : 'Unranked';
  text(ctx, rk, W - 12, 15, { size: 16, align: 'right' });
  text(ctx, `${s.playerPoints} pts • OVR ${playerOvr(p)} • ${weekLabel(s)}`, W - 12, 34, { size: 10, align: 'right', color: '#cfe0f6', weight: 700 });
}

export function tierBadge(ctx: CanvasRenderingContext2D, tier: TierId, x: number, y: number, w = 46): void {
  const t = TIERS[tier];
  ctx.fillStyle = t.color;
  roundRect(ctx, x, y - 7, w, 14, 7);
  ctx.fill();
  text(ctx, t.short, x + w / 2, y + 0.5, { size: 8, align: 'center', color: '#0d1a30' });
}

export const SURF_COLOR: Record<SurfaceId, string> = { grass: '#5fc456', clay: '#d8703e', hard: '#3f7fd0' };

export function surfDot(ctx: CanvasRenderingContext2D, sf: SurfaceId, x: number, y: number): void {
  ctx.fillStyle = SURF_COLOR[sf];
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function newsTicker(ctx: CanvasRenderingContext2D, s: CareerState, t: number): void {
  const y = H - 14;
  ctx.fillStyle = 'rgba(10,18,34,0.9)';
  ctx.fillRect(0, y - 11, W, 22);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(0, y - 11, 64, 22);
  text(ctx, 'NEWS', 32, y, { size: 11, align: 'center', color: '#13284a' });
  const msg = s.news.slice(0, 6).join('      •      ');
  ctx.save();
  ctx.beginPath();
  ctx.rect(66, y - 11, W - 66, 22);
  ctx.clip();
  ctx.font = '700 11px sans-serif';
  const w = ctx.measureText(msg).width * 1.1 + 200;
  const x = W - ((t * 50) % (w + W - 66));
  text(ctx, msg, x, y, { size: 11, weight: 700 });
  ctx.restore();
}

export function msgPanel(ctx: CanvasRenderingContext2D, lines: string[], y = 70): void {
  if (!lines.length) return;
  const w = 420;
  panel(ctx, (W - w) / 2, y, w, 18 + lines.length * 17, 0.85);
  lines.forEach((l, i) => text(ctx, l, W / 2, y + 17 + i * 17, { size: 12, align: 'center', color: i === 0 ? '#ffd479' : '#fff' }));
}
