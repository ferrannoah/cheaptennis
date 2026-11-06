import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry } from '../menu-base';
import { CareerState, exportCareer, saveCareer, playerOvr } from '../../career/state';
import { finishWeek, isOffseason, thisWeek, playerEligibility, weekLabel } from '../../career/flow';
import { canEnter } from '../../career/entry';
import { careerFrame, newsTicker, msgPanel, tierBadge, surfDot } from './common';
import { panel, menuList, roundRect } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { audio } from '../../core/audio';
import { TitleScene } from '../title';
import { CalendarScene } from './calendar';
import { EventScene } from './event';
import { BuildScene } from './build';
import { RankingsScene } from './rankings';
import { CareerPage } from './page';
import { TrainScene } from './train';
import { PROGRESSION, eventById, TIERS } from '../../data/tour';
import { autoWeek } from '../../career/auto';

export class HubScene extends MenuScene {
  name = 'hub';
  msgs: string[] = [];
  msgT = 0;
  constructor(public s: CareerState, msgs: string[] = []) {
    super();
    this.msgs = msgs;
  }
  enter(): void {
    audio.playSong('hub');
  }
  items(): MenuEntry[] {
    const s = this.s;
    const it: MenuEntry[] = [];
    if (s.current) {
      const ev = eventById(s.current.eventId)!;
      it.push({ id: 'event', label: `Continue: ${ev.name}`, action: () => game.goto(new EventScene(s)) });
    } else if (isOffseason(s)) {
      it.push({ id: 'train', label: 'Off-season training', action: () => game.goto(new TrainScene(s)) });
      it.push({ id: 'rest', label: 'Rest this week', action: () => this.week('rest') });
    } else {
      const n = thisWeek(s).filter((e) => canEnter(playerEligibility(s, e))).length;
      it.push({ id: 'calendar', label: `Enter an event (${n} open this week)`, action: () => game.goto(new CalendarScene(s)) });
      it.push({ id: 'train', label: 'Train this week', action: () => game.goto(new TrainScene(s)) });
      it.push({ id: 'rest', label: `Rest this week${s.player.fatigue ? ' (clears fatigue)' : ''}`, action: () => this.week('rest') });
    }
    it.push({ id: 'build', label: `Build & badges${s.player.sp ? ` (${s.player.sp} SP to spend)` : ''}`, action: () => game.goto(new BuildScene(s)) });
    it.push({ id: 'rankings', label: 'Rankings', action: () => game.goto(new RankingsScene(s)) });
    it.push({ id: 'page', label: 'Career page & trophies', action: () => game.goto(new CareerPage(s)) });
    it.push({ id: 'export', label: 'Export save (JSON)', action: () => { saveCareer(s); exportCareer(s); this.msgs = ['Save exported as a .json download.']; this.msgT = 0; } });
    it.push({ id: 'quit', label: 'Save & quit to title', action: () => { saveCareer(s); game.goto(new TitleScene()); } });
    return it;
  }
  week(mode: 'rest' | 'train', xp = 0): void {
    this.msgs = finishWeek(this.s, mode, xp);
    this.msgT = 0;
    this.sel = 0;
    audio.sfx('ding');
  }
  onBack(): void {}
  extraUpdate(): void {
    this.msgT += 1 / 60;
  }
  /** test hook: auto-sim N weeks */
  autoSim(weeks: number): void {
    for (let i = 0; i < weeks; i++) this.msgs = autoWeek(this.s);
    this.msgT = 0;
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.s;
    careerFrame(ctx, this.t, s, 'CAREER HUB');
    const items = this.items();
    panel(ctx, 16, 62, 300, items.length * 28 + 18);
    menuList(ctx, items, this.sel, 28, 80, 276, 28, 14, this.t);
    // right column: this week + fatigue + stats
    const x = 330, w = 294;
    panel(ctx, x, 62, w, 200);
    text(ctx, isOffseason(s) ? 'OFF-SEASON' : 'THIS WEEK', x + 14, 80, { size: 13, color: '#ffc04a' });
    if (isOffseason(s)) {
      text(ctx, 'No events. Train hard or rest up', x + 14, 102, { size: 11, weight: 700 });
      text(ctx, 'for the new season.', x + 14, 118, { size: 11, weight: 700 });
    } else {
      thisWeek(s).slice(0, 6).forEach((e, i) => {
        const y = 102 + i * 24;
        const el = playerEligibility(s, e);
        tierBadge(ctx, e.tier, x + 12, y);
        surfDot(ctx, e.surface, x + 68, y);
        text(ctx, e.name, x + 78, y - 3, { size: 10, maxWidth: 200 });
        text(ctx, el.label, x + 78, y + 8, { size: 8, weight: 700, color: el.status === 'ineligible' ? '#ff9a8a' : el.status === 'qualifying' ? '#ffd479' : '#9ef07a' });
      });
    }
    panel(ctx, x, 270, w, 128);
    const p = s.player;
    text(ctx, `OVR ${playerOvr(p)}`, x + 14, 290, { size: 16, color: '#ffc04a' });
    text(ctx, `Skill points: ${p.sp}   XP ${p.xp}/${PROGRESSION.xpPerSP}`, x + 110, 290, { size: 11, weight: 700 });
    text(ctx, 'Fatigue', x + 14, 314, { size: 11, weight: 700 });
    const fat = p.fatigue / (PROGRESSION.fatigueMax / PROGRESSION.fatiguePerWeek);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, x + 70, 309, 150, 10, 5);
    ctx.fill();
    ctx.fillStyle = fat > 0.6 ? '#ff6a5a' : fat > 0.3 ? '#f2d23a' : '#5fe07a';
    roundRect(ctx, x + 70, 309, Math.max(6, 150 * fat), 10, 5);
    ctx.fill();
    text(ctx, `start stamina ${100 - p.fatigue * PROGRESSION.fatiguePerWeek}%`, x + 226, 314, { size: 9, weight: 700, color: '#bcd0ee' });
    text(ctx, `Career high: ${p.careerHigh ? '#' + p.careerHigh.rank : '-'}   Titles: ${p.titles.length}`, x + 14, 338, { size: 11, weight: 700 });
    const wl = Object.values(p.wl).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    text(ctx, `Matches: ${wl[0]}-${wl[1]}   Badges: ${p.equipped.length}/${p.badges.length}`, x + 14, 358, { size: 11, weight: 700 });
    text(ctx, weekLabel(s), x + 14, 380, { size: 10, weight: 700, color: '#bcd0ee' });
    if (this.msgs.length && this.msgT < 6) msgPanel(ctx, this.msgs, 404 - this.msgs.length * 17);
    newsTicker(ctx, s, this.t);
  }
  debugState(): Record<string, unknown> {
    const s = this.s;
    return { week: s.week, rank: s.playerRank, points: s.playerPoints, ovr: playerOvr(s.player), sp: s.player.sp, titles: s.player.titles.length, current: s.current?.eventId ?? null, msgs: this.msgs, top100Week: s.player.top100Week, majorWeek: s.player.firstMajorMainWeek, news: s.news.slice(0, 3) };
  }
}

void TIERS;
void H;
