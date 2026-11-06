import { game, W, H } from '../../core/game';
import { Scene } from '../../core/game';
import { CareerState } from '../../career/state';
import { Season, proKey } from '../../career/season';
import { careerFrame } from './common';
import { panel, roundRect } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { input } from '../../core/input';
import { audio } from '../../core/audio';
import { HubScene } from './hub';
import { ovr } from '../../data/types';
import { ARCHETYPES } from '../../data/archetypes';

interface Row { rank: number; key: string; name: string; pts: number; ovr: number; arch: string; city: string }

export class RankingsScene implements Scene {
  name = 'rankings';
  t = 0;
  rows: Row[] = [];
  top = 0;
  constructor(public s: CareerState) {
    const season = new Season(s);
    for (const st of s.pros) {
      if (st.rank === null) continue;
      const p = season.byKey.get(proKey(st.id))!;
      this.rows.push({ rank: st.rank, key: proKey(st.id), name: `${p.first} ${p.last}`, pts: st.points, ovr: ovr(p.stats), arch: ARCHETYPES[p.archetype].name, city: p.city });
    }
    if (s.playerRank !== null) this.rows.push({ rank: s.playerRank, key: 'you', name: s.player.name + ' (YOU)', pts: s.playerPoints, ovr: ovr(s.player.stats), arch: ARCHETYPES[s.player.primary].name, city: '' });
    this.rows.sort((a, b) => a.rank - b.rank);
    const mine = this.rows.findIndex((r) => r.key === 'you');
    this.top = mine >= 0 ? Math.max(0, mine - 8) : 0;
  }
  update(): void {
    this.t += 1 / 60;
    const per = 18;
    if (input.menu('down')) this.top = Math.min(Math.max(0, this.rows.length - per), this.top + 1);
    if (input.menu('up')) this.top = Math.max(0, this.top - 1);
    if (input.menu('right')) this.top = Math.min(Math.max(0, this.rows.length - per), this.top + per);
    if (input.menu('left')) this.top = Math.max(0, this.top - per);
    if (input.menu('ok') || input.menu('back')) {
      audio.sfx('menu_back');
      game.goto(new HubScene(this.s));
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    careerFrame(ctx, this.t, this.s, 'WORLD RANKINGS');
    panel(ctx, 12, 54, W - 24, H - 84);
    const hdr = 70;
    text(ctx, '#', 30, hdr, { size: 10, color: '#ffc04a' });
    text(ctx, 'Player', 70, hdr, { size: 10, color: '#ffc04a' });
    text(ctx, 'Style', 300, hdr, { size: 10, color: '#ffc04a' });
    text(ctx, 'OVR', 470, hdr, { size: 10, color: '#ffc04a' });
    text(ctx, 'Points', W - 30, hdr, { size: 10, color: '#ffc04a', align: 'right' });
    const per = 18;
    for (let i = 0; i < per; i++) {
      const r = this.rows[this.top + i];
      if (!r) break;
      const y = 90 + i * 19;
      if (r.key === 'you') {
        ctx.fillStyle = 'rgba(255,160,40,0.85)';
        roundRect(ctx, 20, y - 9, W - 40, 18, 6);
        ctx.fill();
      }
      text(ctx, String(r.rank), 30, y, { size: 11 });
      text(ctx, r.name, 70, y, { size: 11, weight: 700, maxWidth: 220 });
      text(ctx, r.arch, 300, y, { size: 9, weight: 700, color: r.key === 'you' ? '#13284a' : '#bcd0ee' });
      text(ctx, String(r.ovr), 470, y, { size: 11, weight: 700 });
      text(ctx, String(r.pts), W - 30, y, { size: 11, align: 'right' });
    }
    text(ctx, `↑↓ scroll • ←→ page • Space back • ${this.rows.length} ranked players • rolling 52 weeks, best 19 results`, W / 2, H - 14, { size: 10, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
  }
  debugState(): Record<string, unknown> {
    return { rows: this.rows.length, top: this.rows.slice(0, 3).map((r) => `${r.rank} ${r.name} ${r.pts}`) };
  }
}
