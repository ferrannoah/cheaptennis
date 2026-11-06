/** Fixed pinhole camera projecting court metres to screen pixels. */
export interface Proj {
  x: number;
  y: number;
  /** pixels per metre at this depth */
  s: number;
  /** depth (for sorting) */
  d: number;
}

export class Camera {
  px = 0;
  py = -38;
  pz = 25;
  // forward / up basis
  private fy = 0;
  private fz = 0;
  private uy = 0;
  private uz = 0;
  focal = 880;
  cx = 320;
  cy = 236;

  constructor(py = -38, pz = 25, ty = 0.6, tz = 0, focal = 880, cy = 236) {
    this.set(py, pz, ty, tz, focal, cy);
  }

  set(py: number, pz: number, ty: number, tz: number, focal: number, cy: number): void {
    this.py = py;
    this.pz = pz;
    const dy = ty - py;
    const dz = tz - pz;
    const l = Math.hypot(dy, dz);
    this.fy = dy / l;
    this.fz = dz / l;
    this.uy = -this.fz;
    this.uz = this.fy;
    this.focal = focal;
    this.cy = cy;
  }

  project(x: number, y: number, z: number, out?: Proj): Proj {
    const dx = x - this.px;
    const dy = y - this.py;
    const dz = z - this.pz;
    const zc = dy * this.fy + dz * this.fz;
    const yc = dy * this.uy + dz * this.uz;
    const k = this.focal / Math.max(0.1, zc);
    const o = out ?? { x: 0, y: 0, s: 0, d: 0 };
    o.x = this.cx + dx * k;
    o.y = this.cy - yc * k;
    o.s = k;
    o.d = zc;
    return o;
  }

  /** inverse: screen point to ground plane (z=0) */
  unproject(sx: number, sy: number): { x: number; y: number } {
    // ray dir in world: right*(sx-cx)/f + up*(cy-sy)/f + forward
    const a = (sx - this.cx) / this.focal;
    const b = (this.cy - sy) / this.focal;
    const dx = a;
    const dy = this.fy + b * this.uy;
    const dz = this.fz + b * this.uz;
    const t = -this.pz / dz;
    return { x: this.px + dx * t, y: this.py + dy * t };
  }
}

/**
 * The match broadcast camera (M20): a long-lens view fitted to the Free Tennis reference footage,
 * so the court fills the same share of the screen (near baseline 408 px wide at y≈395, far
 * baseline 340 px at y≈102; elevation ≈21°). Fitted by least squares over both baselines,
 * both service lines and the net (max error ≈7 px).
 */
export const matchCam = new Camera(-112.8, 43.76, 0, 0, 4092, 234.8);
