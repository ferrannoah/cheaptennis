import { game, W, H, Scene } from '../../core/game';
import { CareerState, seasonOf, weekOfSeason } from '../../career/state';
import { careerFrame, SURF_COLOR } from './common';
import { panel } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { drawTrophy } from '../../gfx/trophy';
import { input } from '../../core/input';
import { audio } from '../../core/audio';
import { HubScene } from './hub';
import { TIERS, TIER_ORDER, MAJOR_NAMES } from '../../data/tour';
import { SurfaceId, SURFACES } from '../../data/surfaces';
import { BADGES } from '../../data/badges';

export class CareerPage implements Scene {
  name = 'careerpage';
  t = 0;
  constructor(public s: CareerState) {}
  update(): void {
    this.t += 1 / 60;
    if (input.menu('ok') || input.menu('back')) {
      audio.sfx('menu_back');
      game.goto(new HubScene(this.s));
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.s;
    const p = s.player;
    careerFrame(ctx, this.t, s, 'CAREER PAGE');
    // left: record
    panel(ctx, 12, 54, 300, 200);
    text(ctx, 'RECORD', 26, 72, { size: 12, color: '#ffc04a' });
    const surfs: SurfaceId[] = ['hard', 'clay', 'grass'];
    let tw = 0, tl = 0;
    surfs.forEach((sf, i) => {
      const [w, l] = p.wl[sf];
      tw += w;
      tl += l;
      const y = 94 + i * 20;
      ctx.fillStyle = SURF_COLOR[sf];
      ctx.fillRect(26, y - 5, 10, 10);
      text(ctx, `${SURFACES[sf].name}: ${w}-${l}${w + l ? `  (${Math.round((100 * w) / (w + l))}%)` : ''}`, 44, y, { size: 11, weight: 700 });
    });
    text(ctx, `Overall: ${tw}-${tl}`, 26, 158, { size: 12 });
    text(ctx, `Career high: ${p.careerHigh ? `#${p.careerHigh.rank} (S${seasonOf(p.careerHigh.week)} W${weekOfSeason(p.careerHigh.week)})` : '-'}`, 26, 180, { size: 11, weight: 700 });
    text(ctx, `Aces ${p.aces}  •  PERFECT shots ${p.perfects}  •  BP saved ${p.bpSaved}`, 26, 200, { size: 10, weight: 700, color: '#d6e4f7' });
    text(ctx, `Badges: ${p.badges.map((b) => BADGES[b].name).join(', ') || 'none yet'}`, 26, 220, { size: 10, weight: 700, color: '#d6e4f7', maxWidth: 270 });
    text(ctx, `Top 100: ${p.top100Week ? `S${seasonOf(p.top100Week)} W${weekOfSeason(p.top100Week)}` : 'not yet'}`, 26, 240, { size: 10, weight: 700, color: '#d6e4f7' });

    // right: titles by tier + majors
    panel(ctx, 324, 54, 304, 200);
    text(ctx, 'TITLES', 338, 72, { size: 12, color: '#ffc04a' });
    let y = 92;
    for (const tid of TIER_ORDER) {
      const n = p.titles.filter((t) => t.tier === tid).length;
      if (!n) continue;
      text(ctx, `${TIERS[tid].name}: ${n}`, 338, y, { size: 11, weight: 700 });
      y += 17;
    }
    if (!p.titles.length) text(ctx, 'No titles yet: go win one!', 338, y, { size: 11, weight: 700, color: '#bcd0ee' });
    text(ctx, 'MAJORS', 338, 178, { size: 12, color: '#ffc04a' });
    MAJOR_NAMES.forEach((mn, i) => {
      const res = Object.entries(p.majors).filter(([k]) => k.endsWith(mn)).map(([k, v]) => `${k.split(' ')[0]}:${v}`);
      text(ctx, `${mn}: ${res.slice(-3).join(' ') || '-'}`, 338, 196 + i * 15, { size: 9, weight: 700, maxWidth: 280 });
    });

    // trophy cabinet
    panel(ctx, 12, 262, W - 24, H - 292);
    text(ctx, 'TROPHY CABINET', 26, 280, { size: 12, color: '#ffc04a' });
    const shelfY = [370, 440];
    ctx.fillStyle = '#6b4a2a';
    for (const sy of shelfY) ctx.fillRect(24, sy, W - 48, 6);
    const titles = p.titles.slice(-24);
    titles.forEach((t, i) => {
      const row = i < 12 ? 0 : 1;
      const col = i % 12;
      const x = 50 + col * 49;
      const kind = t.tier === 'major' ? 'plate' : t.tier === 'm1000' || t.tier === 'finals' ? 'bowl' : 'cup';
      const color = TIERS[t.tier].prestige >= 5 ? 'gold' : TIERS[t.tier].prestige >= 3 ? 'silver' : 'bronze';
      drawTrophy(ctx, x, shelfY[row], TIERS[t.tier].prestige >= 7 ? 54 : 42, 0.3, color, kind);
    });
    if (!titles.length) text(ctx, 'Empty for now. Every title you win gets a trophy here.', W / 2, 340, { size: 12, align: 'center', color: '#bcd0ee', weight: 700 });
    text(ctx, 'Space to return', W / 2, H - 14, { size: 10, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
  }
}
