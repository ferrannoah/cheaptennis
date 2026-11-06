import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry } from '../menu-base';
import { CareerState, saveCareer, playerOvr } from '../../career/state';
import { playerCaps, raise, statCost } from '../../career/progression';
import { STAT_KEYS, STAT_LABEL, StatKey, rating10 } from '../../data/types';
import { BADGES, BADGE_IDS } from '../../data/badges';
import { careerFrame } from './common';
import { panel, roundRect, valueBar } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { input } from '../../core/input';
import { audio } from '../../core/audio';
import { HubScene } from './hub';

export class BuildScene extends MenuScene {
  name = 'build';
  base: Record<StatKey, number>;
  spent: Record<StatKey, number[]>; // costs paid this session (for undo)
  constructor(public s: CareerState) {
    super();
    this.base = { ...s.player.stats };
    this.spent = Object.fromEntries(STAT_KEYS.map((k) => [k, []])) as unknown as Record<StatKey, number[]>;
  }
  items(): MenuEntry[] {
    const p = this.s.player;
    const caps = playerCaps(p);
    const it: MenuEntry[] = STAT_KEYS.map((k) => ({
      id: k, label: STAT_LABEL[k], value: `${p.stats[k]} / ${caps[k]}`,
      change: (d) => (d > 0 ? this.plus(k) : this.minus(k)),
      hint: `Next point costs ${statCost(p.stats[k])} SP • ← undo, → add`,
    }));
    for (const id of BADGE_IDS) {
      const b = BADGES[id];
      const has = p.badges.includes(id);
      const on = p.equipped.includes(id);
      it.push({
        id: 'badge-' + id, label: `Badge: ${b.name}`, value: has ? (on ? 'EQUIPPED' : 'off') : 'locked', disabled: !has,
        change: () => this.toggle(id), action: () => this.toggle(id), hint: has ? `${b.effect}` : `Unlock: ${b.unlock} • Effect: ${b.effect}`,
      });
    }
    it.push({ id: 'done', label: 'Done', action: () => this.done() });
    return it;
  }
  plus(k: StatKey): void {
    const p = this.s.player;
    const c = statCost(p.stats[k]);
    if (raise(p, k)) {
      this.spent[k].push(c);
      audio.sfx('menu_ok');
    } else audio.sfx('menu_back');
  }
  minus(k: StatKey): void {
    const p = this.s.player;
    const c = this.spent[k].pop();
    if (c === undefined) return;
    p.stats[k]--;
    p.sp += c;
  }
  toggle(id: string): void {
    const p = this.s.player;
    if (!p.badges.includes(id)) return;
    if (p.equipped.includes(id)) p.equipped = p.equipped.filter((x) => x !== id);
    else if (p.equipped.length < 3) p.equipped.push(id);
    else audio.sfx('menu_back');
  }
  done(): void {
    saveCareer(this.s);
    game.goto(new HubScene(this.s));
  }
  onBack(): void {
    this.done();
  }
  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.s;
    const p = s.player;
    careerFrame(ctx, this.t, s, 'BUILD');
    const caps = playerCaps(p);
    const items = this.items();
    panel(ctx, 12, 54, W - 24, H - 84);
    text(ctx, `Skill points: ${p.sp}`, 28, 72, { size: 15, color: '#ffc04a' });
    text(ctx, `OVR ${playerOvr(p)}`, W - 28, 72, { size: 15, align: 'right', color: '#ffc04a' });
    const rowH = 20;
    items.forEach((it, i) => {
      const y = 94 + i * rowH;
      if (i === this.sel) {
        ctx.fillStyle = 'rgba(255,160,40,0.85)';
        roundRect(ctx, 20, y - rowH / 2 + 1, W - 40, rowH - 2, 8);
        ctx.fill();
      }
      const isStat = (STAT_KEYS as string[]).includes(it.id);
      text(ctx, it.label, 32, y, { size: 11, color: it.disabled ? 'rgba(255,255,255,0.45)' : '#fff' });
      if (isStat) {
        const k = it.id as StatKey;
        valueBar(ctx, 170, y - 4, 300, 8, p.stats[k], caps[k], p.stats[k] > this.base[k] ? '#9ef07a' : '#ff9a2a');
        text(ctx, `${p.stats[k]} / ${caps[k]}  (${rating10(p.stats[k])}/10)`, W - 32, y, { size: 10, align: 'right', weight: 700 });
      } else if (it.value) {
        text(ctx, it.value, W - 32, y, { size: 10, align: 'right', weight: 700, color: it.value === 'EQUIPPED' ? '#9ef07a' : '#ffd479' });
      } else if (it.id === 'done') {
        text(ctx, '', 0, 0);
      }
    });
    const h = items[this.sel]?.hint;
    if (h) text(ctx, h, W / 2, H - 14, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
    void input;
  }
  debugState(): Record<string, unknown> {
    return { sp: this.s.player.sp, stats: this.s.player.stats, caps: playerCaps(this.s.player), badges: this.s.player.badges, equipped: this.s.player.equipped };
  }
}
