export interface FogHole { cx: number; cy: number; r: number; }

// One soft dispersal blob per lit/candidate point — the corridor the fog clears.
export function fogHoles(points: { left: number; top: number }[], radius = 48): FogHole[] {
  return points.map((p) => ({ cx: p.left, cy: p.top, r: radius }));
}

// feTurbulence cloud params (the screen renders the <filter> with these).
export const FOG_CLOUD = { baseFrequency: '0.013 0.021', numOctaves: 5, seed: 5 } as const;
