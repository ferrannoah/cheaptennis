export type SurfaceId = 'grass' | 'clay' | 'hard';

export interface Surface {
  id: SurfaceId;
  name: string;
  /** vertical restitution */
  restitution: number;
  /** horizontal speed kept on bounce */
  friction: number;
  /** how strongly topspin kicks forward/up after the bounce */
  topspinKick: number;
  /** how strongly backspin skids/keeps low */
  sliceSkid: number;
  /** player acceleration multiplier */
  grip: number;
  /** player top speed multiplier */
  footSpeed: number;
  /** slides into wide balls (clay) */
  slides: boolean;
  colors: {
    a: string; // stripe/base A
    b: string; // stripe/base B
    surround: string;
    surroundB: string;
    line: string;
  };
}

export const SURFACES: Record<SurfaceId, Surface> = {
  grass: {
    id: 'grass', name: 'Grass',
    restitution: 0.66, friction: 0.83, topspinKick: 0.7, sliceSkid: 1.35, grip: 0.95, footSpeed: 1.0, slides: false,
    colors: { a: '#4fae4a', b: '#62bf55', surround: '#4fae4a', surroundB: '#62bf55', line: '#ffffff' },
  },
  clay: {
    id: 'clay', name: 'Clay',
    restitution: 0.77, friction: 0.66, topspinKick: 1.2, sliceSkid: 0.75, grip: 0.82, footSpeed: 0.96, slides: true,
    colors: { a: '#cf6a3d', b: '#c9643a', surround: '#c25f37', surroundB: '#bd5a34', line: '#f6efe6' },
  },
  hard: {
    id: 'hard', name: 'Hard',
    restitution: 0.74, friction: 0.75, topspinKick: 1.0, sliceSkid: 1.0, grip: 1.0, footSpeed: 1.0, slides: false,
    colors: { a: '#2f6fb8', b: '#2f6fb8', surround: '#3f8f5f', surroundB: '#3f8f5f', line: '#ffffff' },
  },
};
