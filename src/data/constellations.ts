export interface ConstellationStar {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  brightness: number; // 0-1
}

export interface ConstellationLine {
  from: number; // index into stars array
  to: number;
}

export interface Constellation {
  name: string;
  stars: ConstellationStar[];
  lines: ConstellationLine[];
  color: 'white' | 'gold';
  theme: string;
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'The Eye',
    theme: 'Divine sight, awareness',
    color: 'white',
    stars: [
      { x: 72, y: 15, brightness: 0.85 },
      { x: 78, y: 27, brightness: 0.7 },
      { x: 80, y: 38, brightness: 0.85 },
      { x: 72, y: 40, brightness: 0.7 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
      { from: 2, to: 3 }, { from: 3, to: 0 },
      { from: 2, to: 0 },
    ],
  },
  {
    name: 'The Serpent',
    theme: 'Chaos, transformation',
    color: 'white',
    stars: [
      { x: 5, y: 72, brightness: 0.85 },
      { x: 12, y: 62, brightness: 0.7 },
      { x: 17, y: 66, brightness: 0.75 },
      { x: 22, y: 52, brightness: 0.85 },
      { x: 25, y: 43, brightness: 0.7 },
      { x: 21, y: 34, brightness: 0.75 },
      { x: 19, y: 27, brightness: 0.85 },
      { x: 15, y: 22, brightness: 0.7 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
      { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
      { from: 6, to: 7 },
    ],
  },
  {
    name: 'The Crown',
    theme: 'Order, authority',
    color: 'gold',
    stars: [
      { x: 40, y: 5, brightness: 0.8 },
      { x: 44, y: 14, brightness: 0.65 },
      { x: 50, y: 9, brightness: 0.8 },
      { x: 49, y: 18, brightness: 0.6 },
      { x: 42, y: 18, brightness: 0.6 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
      { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 0 },
    ],
  },
  {
    name: 'The Gate',
    theme: 'Threshold, choice',
    color: 'white',
    stars: [
      { x: 78, y: 68, brightness: 0.75 },
      { x: 78, y: 78, brightness: 0.65 },
      { x: 88, y: 70, brightness: 0.75 },
      { x: 88, y: 80, brightness: 0.65 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 2, to: 3 },
      { from: 0, to: 2 },
    ],
  },
  {
    name: 'The Scales',
    theme: 'Judgment, balance',
    color: 'white',
    stars: [
      { x: 40, y: 35, brightness: 0.8 },
      { x: 36, y: 46, brightness: 0.65 },
      { x: 34, y: 51, brightness: 0.55 },
      { x: 62, y: 35, brightness: 0.8 },
      { x: 58, y: 46, brightness: 0.65 },
      { x: 56, y: 51, brightness: 0.55 },
      { x: 51, y: 35, brightness: 0.6 },
      { x: 51, y: 55, brightness: 0.55 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
      { from: 3, to: 4 }, { from: 4, to: 5 },
      { from: 0, to: 6 }, { from: 6, to: 3 },
      { from: 6, to: 7 },
    ],
  },
  {
    name: 'The Spindle',
    theme: "The Fates' thread",
    color: 'white',
    stars: [
      { x: 62, y: 65, brightness: 0.75 },
      { x: 64, y: 71, brightness: 0.75 },
      { x: 66, y: 77, brightness: 0.75 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
    ],
  },
];
