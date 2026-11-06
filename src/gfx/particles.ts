import { Camera } from './camera';

interface Part {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  color: string;
  kind: 'dust' | 'grass' | 'sweat' | 'spark' | 'confetti' | 'chalk';
  rot: number;
}

const MAX = 400;

/** Cosmetic particles in world space (Math.random is fine here). */
export class Particles {
  list: Part[] = [];

  spawn(kind: Part['kind'], x: number, y: number, z: number, n: number, color: string, spread = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= MAX) this.list.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 1.6) * spread;
      const p: Part = {
        x, y, z,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.random() * 1.5 * spread,
        life: 0, max: 0.5 + Math.random() * 0.5, size: 0.05 + Math.random() * 0.06, color, kind, rot: Math.random() * 6,
      };
      if (kind === 'dust') {
        p.vz = 0.3 + Math.random() * 0.8;
        p.size = 0.12 + Math.random() * 0.15;
        p.max = 0.6 + Math.random() * 0.6;
      } else if (kind === 'sweat') {
        p.vz = 1.5 + Math.random() * 1.5;
        p.size = 0.035;
        p.max = 0.5;
      } else if (kind === 'spark') {
        p.vx *= 3;
        p.vy *= 3;
        p.vz = (Math.random() - 0.3) * 4;
        p.max = 0.25 + Math.random() * 0.2;
        p.size = 0.04;
      } else if (kind === 'confetti') {
        p.vz = 2 + Math.random() * 4;
        p.max = 2.5 + Math.random() * 1.5;
        p.size = 0.09;
      }
      this.list.push(p);
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += dt * 8;
      if (p.kind === 'dust') {
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vz *= 0.95;
        p.size += dt * 0.25;
      } else if (p.kind === 'confetti') {
        p.vz -= 3 * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.z < 0) {
          p.z = 0;
          p.vz = 0;
          p.vx = p.vy = 0;
        }
      } else {
        p.vz -= 9.8 * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.3;
          p.vx *= 0.5;
          p.vy *= 0.5;
        }
      }
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    for (const p of this.list) {
      const pr = cam.project(p.x, p.y, p.z);
      const k = 1 - p.life / p.max;
      const r = Math.max(0.6, p.size * pr.s);
      if (p.kind === 'dust') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = k * 0.45;
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'confetti') {
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.8 * Math.abs(Math.sin(p.rot)) + 0.5);
        ctx.restore();
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.list.length = 0;
  }
}
