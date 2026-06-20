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
      { x: 68, y: 18, brightness: 0.85 },
      { x: 74, y: 30, brightness: 0.7 },
      { x: 76, y: 48, brightness: 0.85 },
      { x: 68, y: 52, brightness: 0.7 },
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
      { x: 42, y: 8, brightness: 0.8 },
      { x: 46, y: 16, brightness: 0.65 },
      { x: 50, y: 12, brightness: 0.8 },
      { x: 49, y: 22, brightness: 0.6 },
      { x: 44, y: 23, brightness: 0.6 },
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
      { x: 82, y: 68, brightness: 0.75 },
      { x: 82, y: 78, brightness: 0.65 },
      { x: 90, y: 70, brightness: 0.75 },
      { x: 90, y: 80, brightness: 0.65 },
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
      { x: 30, y: 20, brightness: 0.8 },
      { x: 22, y: 42, brightness: 0.65 },
      { x: 20, y: 48, brightness: 0.55 },
      { x: 55, y: 20, brightness: 0.8 },
      { x: 62, y: 42, brightness: 0.65 },
      { x: 64, y: 48, brightness: 0.55 },
      { x: 42, y: 20, brightness: 0.6 },
      { x: 42, y: 58, brightness: 0.55 },
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
      { x: 58, y: 62, brightness: 0.75 },
      { x: 58, y: 68, brightness: 0.75 },
      { x: 58, y: 74, brightness: 0.75 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
    ],
  },
];
