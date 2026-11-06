import { game, W, H } from '../../core/game';
import { MenuScene, MenuEntry, cycle } from '../menu-base';
import { ARCHETYPES, ARCHETYPE_IDS, buildCaps } from '../../data/archetypes';
import { ArchetypeId, Kit, STAT_KEYS, STAT_LABEL, ovr } from '../../data/types';
import { createCareer } from '../../career/season';
import { beginWeek } from '../../career/flow';
import { saveCareer, startingStats } from '../../career/state';
import { CareerMenu } from './menu';
import { HubScene } from './hub';
import { drawBackdrop } from '../../gfx/backdrop';
import { panel, menuList, valueBar } from '../../gfx/ui';
import { text } from '../../gfx/text';
import { drawFigure, POSES } from '../../gfx/player-renderer';
import { input } from '../../core/input';
import { audio } from '../../core/audio';
import { rng } from '../../core/rng';

const SHIRTS = ['#ffffff', '#e84a4a', '#3a7bd5', '#2fa86b', '#f5c542', '#222a35', '#8f5bd6', '#f07a3a', '#5fc8e8', '#f07aa8'];
const SHORTS = ['#ffffff', '#222a35', '#2a3a55', '#e84a4a', '#3a7bd5', '#2fa86b'];
const SKINS = ['#f7dcc4', '#f3cfb0', '#e6b08a', '#c98e62', '#9b6640', '#6e4528'];
const HAIRS = ['#2b1d12', '#5a3a1f', '#c99b52', '#111111', '#8a4b2a', '#d8d0c0', '#b8322a'];

export class CreateScene extends MenuScene {
  name = 'create';
  pname = 'Alex Rookie';
  typing = false;
  hand: 'R' | 'L' = 'R';
  twoHanded = true;
  primary: ArchetypeId = 'aggressive';
  secondary: ArchetypeId = 'counterpuncher';
  kit: Kit = { shirt: '#ffffff', shorts: '#ffffff', band: '#e84a4a', skin: '#e6b08a', hair: '#3a2614', shoes: '#f4f4f4' };
  busy = false;

  items(): MenuEntry[] {
    const sec = (d: number) => {
      do this.secondary = cycle(ARCHETYPE_IDS, this.secondary, d);
      while (this.secondary === this.primary);
    };
    return [
      { id: 'name', label: 'Name', value: this.pname + (this.typing && Math.sin(this.t * 8) > 0 ? '_' : ''), action: () => this.startTyping(), hint: 'Press Space/Enter, type a name, Enter to confirm' },
      { id: 'hand', label: 'Plays', value: this.hand === 'R' ? 'Right-handed' : 'Left-handed', change: () => (this.hand = this.hand === 'R' ? 'L' : 'R') },
      { id: 'bh', label: 'Backhand', value: this.twoHanded ? 'Two-handed' : 'One-handed', change: () => (this.twoHanded = !this.twoHanded) },
      {
        id: 'primary', label: 'Primary style', value: ARCHETYPES[this.primary].name, change: (d) => {
          this.primary = cycle(ARCHETYPE_IDS, this.primary, d);
          if (this.secondary === this.primary) sec(1);
        }, hint: ARCHETYPES[this.primary].desc,
      },
      { id: 'secondary', label: 'Secondary style', value: ARCHETYPES[this.secondary].name, change: sec, hint: 'Primary + secondary set your stat caps: nobody maxes everything' },
      { id: 'shirt', label: 'Shirt', value: '■', change: (d) => (this.kit.shirt = cycle(SHIRTS, this.kit.shirt, d)) },
      { id: 'shorts', label: 'Shorts', value: '■', change: (d) => (this.kit.shorts = cycle(SHORTS, this.kit.shorts, d)) },
      { id: 'band', label: 'Headband', value: '■', change: (d) => (this.kit.band = cycle(SHIRTS, this.kit.band, d)) },
      { id: 'skin', label: 'Skin', value: '■', change: (d) => (this.kit.skin = cycle(SKINS, this.kit.skin, d)) },
      { id: 'hair', label: 'Hair', value: '■', change: (d) => (this.kit.hair = cycle(HAIRS, this.kit.hair, d)) },
      { id: 'start', label: this.busy ? 'Building the tour...' : 'Start career', action: () => this.start() },
      { id: 'back', label: 'Back', action: () => game.goto(new CareerMenu()) },
    ];
  }

  startTyping(): void {
    this.typing = true;
    this.pname = '';
    const next = () =>
      input.captureKey((code) => {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Escape') {
          this.typing = false;
          if (!this.pname.trim()) this.pname = 'Alex Rookie';
          return;
        }
        if (code === 'Backspace') this.pname = this.pname.slice(0, -1);
        else if (code === 'Space' && this.pname.length < 18) this.pname += ' ';
        else if (code.startsWith('Key') && this.pname.length < 18) {
          const ch = code.slice(3);
          const prev = this.pname[this.pname.length - 1];
          this.pname += !prev || prev === ' ' ? ch : ch.toLowerCase();
        } else if (code.startsWith('Digit') && this.pname.length < 18) this.pname += code.slice(5);
        audio.sfx('menu_move');
        next();
      });
    next();
  }

  update(): void {
    if (this.typing) {
      this.t += 1 / 60;
      return;
    }
    super.update();
  }

  onBack(): void {
    game.goto(new CareerMenu());
  }

  start(): void {
    if (this.busy) return;
    this.busy = true;
    // let the "building" label render before the warm-up simulation runs
    setTimeout(() => {
      const s = createCareer({ name: this.pname.trim() || 'Rookie', hand: this.hand, twoHanded: this.twoHanded, kit: { ...this.kit }, primary: this.primary, secondary: this.secondary }, Math.floor(rng.next() * 1e9));
      beginWeek(s);
      saveCareer(s);
      game.goto(new HubScene(s));
    }, 30);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx, this.t, 'clay', false);
    ctx.fillStyle = 'rgba(6,12,26,0.35)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'CREATE YOUR PLAYER', W / 2, 30, { size: 26, align: 'center', outline: '#13284a', outlineWidth: 7 });
    const items = this.items();
    panel(ctx, 16, 56, 330, items.length * 27 + 20);
    menuList(ctx, items, this.sel, 30, 76, 302, 27, 14, this.t);
    // colour swatches over the ■ values
    const sw: Record<string, string> = { shirt: this.kit.shirt, shorts: this.kit.shorts, band: this.kit.band, skin: this.kit.skin, hair: this.kit.hair };
    items.forEach((it, i) => {
      if (sw[it.id]) {
        ctx.fillStyle = sw[it.id];
        ctx.strokeStyle = '#13284a';
        ctx.fillRect(300 - (i === this.sel ? 18 : 0), 76 + i * 27 - 7, 16, 14);
        ctx.strokeRect(300 - (i === this.sel ? 18 : 0), 76 + i * 27 - 7, 16, 14);
      }
    });
    // preview
    panel(ctx, 360, 56, 264, 390);
    drawFigure(ctx, 430, 210, 78, POSES.ready, this.kit, { mirror: this.hand === 'L', facingCamera: true, twoHanded: this.twoHanded, bob: Math.sin(this.t * 3) * 0.01 });
    drawFigure(ctx, 560, 210, 78, POSES.fhFollow, this.kit, { mirror: this.hand === 'L', facingCamera: false, twoHanded: this.twoHanded, bob: 0 });
    const caps = buildCaps(this.primary, this.secondary);
    const st = startingStats(this.primary, this.secondary);
    text(ctx, `Start OVR ${ovr(st)}  •  caps shown in grey`, 492, 232, { size: 11, align: 'center', color: '#ffd479' });
    STAT_KEYS.forEach((k, i) => {
      const y = 254 + i * 18;
      text(ctx, STAT_LABEL[k], 374, y, { size: 10, weight: 700 });
      valueBar(ctx, 446, y - 4, 140, 8, st[k], caps[k]);
      text(ctx, String(caps[k]), 610, y, { size: 9, align: 'right', color: '#bcd0ee', weight: 700 });
    });
    const h = items[this.sel]?.hint;
    if (h) text(ctx, h, W / 2, H - 16, { size: 11, align: 'center', outline: 'rgba(10,20,40,0.8)', weight: 700 });
  }
}
