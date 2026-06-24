import { RING_BOUNDS } from '../../../data/runes';

// The casting cloth is a square field; normalized scatter coords (~[-1,1]) map onto
// it via scatter.ts. These are the concentric ring radii (as a fraction of the
// cloth's half-width) and the decorative speckle, used to render the backdrop SVG.

export const CLOTH_RINGS = [
  { key: 'heart',  radius: RING_BOUNDS.heartMax, label: 'Heart',  color: '#d4a854' },
  { key: 'field',  radius: RING_BOUNDS.fieldMax, label: 'Field',  color: '#7b9ec7' },
  { key: 'margin', radius: 1.0,                  label: 'Margin', color: '#3a3354' },
] as const;

// Fraction of the cloth half-width that normalized radius 1.0 occupies, leaving a
// rim so margin stones sit near (not on) the edge and errant stones can spill past.
export const CLOTH_RADIUS_SCALE = 0.82;

// Static decorative starfield speckle for the cloth backdrop (normalized -1..1).
export const CLOTH_SPECKLE: { x: number; y: number; r: number; o: number; gold?: boolean }[] = [
  { x: -0.62, y: -0.55, r: 0.9, o: 0.55 }, { x: 0.5, y: -0.66, r: 0.7, o: 0.5, gold: true },
  { x: 0.72, y: -0.2, r: 0.8, o: 0.5 },    { x: 0.66, y: 0.5, r: 0.7, o: 0.55, gold: true },
  { x: 0.18, y: 0.72, r: 0.6, o: 0.45 },   { x: -0.5, y: 0.62, r: 0.8, o: 0.5 },
  { x: -0.74, y: 0.12, r: 0.7, o: 0.5, gold: true }, { x: -0.2, y: -0.78, r: 0.6, o: 0.45 },
  { x: 0.36, y: 0.28, r: 0.5, o: 0.35 },   { x: -0.34, y: -0.18, r: 0.5, o: 0.35 },
];
