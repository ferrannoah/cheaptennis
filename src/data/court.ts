/** Court geometry in metres. x across (left -, right +), y along (near baseline -, far +), z up. */
export const HALF_LEN = 11.885;
export const HALF_W = 4.115; // singles
export const HALF_W_DBL = 5.485;
export const SERVICE_Y = 6.4;
export const NET_H_CENTER = 0.914;
export const NET_H_POST = 1.07;
export const POST_X = 6.4;
export const BALL_R = 0.034;
export const GRAVITY = 9.81;
/** run-off area */
export const RUN_X = 9.2;
export const RUN_Y = 18.2;

export function netHeightAt(x: number): number {
  const t = Math.min(1, Math.abs(x) / POST_X);
  return NET_H_CENTER + (NET_H_POST - NET_H_CENTER) * t * t;
}
