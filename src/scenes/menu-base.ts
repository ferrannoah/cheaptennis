import { Scene } from '../core/game';
import { input } from '../core/input';
import { audio } from '../core/audio';
import { MenuItem } from '../gfx/ui';

export interface MenuEntry extends MenuItem {
  id: string;
  /** for option entries: change value by delta */
  change?: (d: number) => void;
  action?: () => void;
}

/** Shared menu navigation: up/down to select, left/right change, ok to activate, back to go back. */
export abstract class MenuScene implements Scene {
  abstract name: string;
  sel = 0;
  t = 0;
  abstract items(): MenuEntry[];
  onBack?(): void;

  update(): void {
    this.t += 1 / 60;
    const items = this.items();
    if (!items.length) return;
    if (input.menu('up')) {
      this.move(items, -1);
    } else if (input.menu('down')) {
      this.move(items, 1);
    }
    const it = items[this.sel];
    if (!it) {
      this.sel = 0;
      return;
    }
    if (it.change && !it.disabled) {
      if (input.menu('left')) {
        it.change(-1);
        audio.sfx('menu_move');
      } else if (input.menu('right')) {
        it.change(1);
        audio.sfx('menu_move');
      }
    }
    if (input.menu('ok')) {
      if (it.disabled) {
        audio.sfx('menu_back');
      } else if (it.action) {
        audio.sfx('menu_ok');
        it.action();
      } else if (it.change) {
        it.change(1);
        audio.sfx('menu_move');
      }
    } else if (input.menu('back') && this.onBack) {
      audio.sfx('menu_back');
      this.onBack();
    }
    this.extraUpdate();
  }

  extraUpdate(): void {}

  private move(items: MenuEntry[], d: number): void {
    const n = items.length;
    for (let i = 0; i < n; i++) {
      this.sel = (this.sel + d + n) % n;
      if (!items[this.sel].hint?.startsWith('#skip')) break;
    }
    audio.sfx('menu_move');
  }

  /** select by id (test hook helper) */
  select(id: string): boolean {
    const i = this.items().findIndex((e) => e.id === id);
    if (i >= 0) this.sel = i;
    return i >= 0;
  }

  abstract draw(ctx: CanvasRenderingContext2D): void;
}

export function cycle<T>(arr: readonly T[], cur: T, d: number): T {
  const i = arr.indexOf(cur);
  return arr[(i + d + arr.length) % arr.length];
}
