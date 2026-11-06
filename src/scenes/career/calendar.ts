import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry } from '../menu-base';
import { CareerState, weekOfSeason } from '../../career/state';
import { playerEligibility, enterEvent } from '../../career/flow';
import { canEnter } from '../../career/entry';
import { eventsInWeek, TIERS, OFFSEASON_START } from '../../data/tour';
import { careerFrame, tierBadge, surfDot } from './common';
import { panel, roundRect } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { input } from '../../core/input';
import { audio } from '../../core/audio';
import { HubScene } from './hub';
import { EventScene } from './event';
import { SURFACES } from '../../data/surfaces';

export class CalendarScene extends MenuScene {
  name = 'calendar';
  viewWeek: number; // week of season being viewed
  constructor(public s: CareerState) {
    super();
    this.viewWeek = weekOfSeason(s.week);
  }
  get isCurrent(): boolean {
    return this.viewWeek === weekOfSeason(this.s.week);
  }
  items(): MenuEntry[] {
    const evs = eventsInWeek(this.viewWeek);
    const it: MenuEntry[] = evs.map((e) => {
      const el = playerEligibility(this.s, e);
      return {
        id: e.id, label: e.name, value: el.label, disabled: !this.isCurrent || !canEnter(el),
        action: () => {
          if (enterEvent(this.s, e.id)) game.goto(new EventScene(this.s));
        },
      };
    });
    it.push({ id: 'back', label: 'Back to hub', action: () => game.goto(new HubScene(this.s)) });
    return it;
  }
  onBack(): void {
    game.goto(new HubScene(this.s));
  }
  extraUpdate(): void {
    if (input.menu('left')) {
      this.viewWeek = Math.max(1, this.viewWeek - 1);
      this.sel = 0;
      audio.sfx('menu_move');
    } else if (input.menu('right')) {
      this.viewWeek = Math.min(52, this.viewWeek + 1);
      this.sel = 0;
      audio.sfx('menu_move');
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.s;
    careerFrame(ctx, this.t, s, 'CALENDAR');
    const evs = eventsInWeek(this.viewWeek);
    text(ctx, `◀  Week ${this.viewWeek}${this.isCurrent ? ' (this week)' : ''}  ▶`, W / 2, 66, { size: 16, align: 'center', color: this.isCurrent ? '#ffd479' : '#fff' });
    const x = 18, w = W - 36;
    const items = this.items();
    panel(ctx, x, 80, w, Math.max(80, items.length * 52 + 10));
    if (this.viewWeek >= OFFSEASON_START) text(ctx, 'Off-season: no events', W / 2, 110, { size: 13, align: 'center' });
    items.forEach((it, i) => {
      const y = 90 + i * 52;
      if (i === this.sel) {
        ctx.fillStyle = 'rgba(255,160,40,0.85)';
        roundRect(ctx, x + 6, y, w - 12, it.id === 'back' ? 30 : 48, 10);
        ctx.fill();
      }
      if (it.id === 'back') {
        text(ctx, it.label, W / 2, y + 15, { size: 14, align: 'center' });
        return;
      }
      const e = evs[i];
      const t = TIERS[e.tier];
      const el = playerEligibility(s, e);
      tierBadge(ctx, e.tier, x + 16, y + 16, 54);
      surfDot(ctx, e.surface, x + 84, y + 16);
      text(ctx, e.name, x + 94, y + 14, { size: 14, color: it.disabled && i !== this.sel ? 'rgba(255,255,255,0.6)' : '#fff' });
      const cutoff = t.direct === null ? 'open to all' : e.tier === 'finals' ? 'top 8 only' : `direct #${t.direct}${t.qual ? `, qualifying #${t.qual}` : ''}`;
      text(ctx, `${t.name} • ${SURFACES[e.surface].name}${e.indoor ? ' (indoor)' : ''} • draw ${t.draw} • winner ${t.winnerPts} pts • ${cutoff}${e.weeks > 1 ? ' • 2 weeks' : ''}`, x + 16, y + 34, { size: 9, weight: 700, color: '#d6e4f7' });
      const col = el.status === 'ineligible' ? '#ff9a8a' : el.status === 'qualifying' ? '#ffd479' : '#9ef07a';
      text(ctx, el.label, x + w - 16, y + 14, { size: 11, align: 'right', color: i === this.sel ? '#13284a' : col });
    });
    text(ctx, '← → browse weeks (info only)  •  enter events in the current week', W / 2, H - 14, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
  }
  debugState(): Record<string, unknown> {
    return { viewWeek: this.viewWeek, rows: this.items().map((i) => `${i.label}: ${i.value ?? ''}`) };
  }
}
