// Stylised zodiac constellations for the board wedges. Each is a connect-the-dots
// star pattern — a recognizable approximation of the real constellation, not an
// astrometric chart. Coordinates are normalized to roughly [-1, 1] (x right, y
// down); the board scales/rotates them into each wedge. Drawn in the game's
// starfield style (glowing dots + faint lines).
import type { SignId } from '../../../engine/types';

export interface ZodiacConstellation {
  stars: [number, number, number][]; // x, y, brightness(0..1)
  lines: [number, number][];         // indices into stars
}

export const ZODIAC_CONSTELLATIONS: Record<SignId, ZodiacConstellation> = {
  // Aries — a short bent line (Hamal · Sheratan · Mesarthim).
  aries: {
    stars: [[0.8, -0.5, 1], [0.2, -0.2, 0.8], [-0.35, 0.1, 0.7], [-0.85, 0.45, 0.6]],
    lines: [[0, 1], [1, 2], [2, 3]],
  },
  // Taurus — the Hyades V with two horns; Aldebaran at the nose.
  taurus: {
    stars: [[-0.9, -0.8, 0.7], [-0.35, -0.15, 1], [0.05, 0.2, 0.8], [0.45, -0.2, 0.7], [0.9, -0.85, 0.7]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  // Gemini — the twins, two parallel strands joined at the heads.
  gemini: {
    stars: [
      [-0.5, -0.85, 0.9], [-0.55, -0.25, 0.7], [-0.6, 0.35, 0.7], [-0.62, 0.85, 0.8],
      [0.5, -0.85, 0.9], [0.55, -0.25, 0.7], [0.6, 0.35, 0.7], [0.62, 0.85, 0.8],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [0, 4], [2, 6]],
  },
  // Cancer — the faint inverted-Y asterism.
  cancer: {
    stars: [[0, -0.75, 0.7], [0, -0.05, 0.8], [-0.6, 0.45, 0.6], [0.6, 0.5, 0.6], [0.1, 0.75, 0.6]],
    lines: [[0, 1], [1, 2], [1, 3], [1, 4]],
  },
  // Leo — the Sickle (backward question mark) flowing into the triangle hindquarters.
  leo: {
    stars: [
      [0.65, -0.8, 0.7], [0.4, -0.5, 0.7], [0.2, -0.2, 0.8], [0.25, 0.1, 1],
      [-0.45, 0.0, 0.7], [-0.85, 0.5, 0.7], [-0.2, 0.55, 0.6],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 6], [6, 5], [5, 4], [4, 3]],
  },
  // Virgo — an angular line down to Spica.
  virgo: {
    stars: [[-0.85, -0.5, 0.7], [-0.35, -0.2, 0.7], [0.0, 0.1, 0.8], [0.35, -0.1, 0.7], [0.75, 0.2, 0.7], [0.15, 0.75, 1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
  },
  // Libra — the scales as a quadrilateral.
  libra: {
    stars: [[0, -0.75, 0.8], [-0.75, -0.05, 0.8], [0.75, -0.1, 0.8], [-0.35, 0.6, 0.7], [0.45, 0.55, 0.7]],
    lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4]],
  },
  // Scorpio — pincers, heart (Antares), curling tail and sting.
  scorpio: {
    stars: [
      [-0.95, -0.55, 0.7], [-0.65, -0.8, 0.7], [-0.4, -0.45, 0.8], [-0.15, -0.1, 1],
      [0.1, 0.25, 0.7], [0.4, 0.5, 0.7], [0.65, 0.6, 0.7], [0.8, 0.35, 0.8],
    ],
    lines: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  // Sagittarius — the Teapot.
  sagittarius: {
    stars: [
      [-0.7, -0.1, 0.7], [-0.25, -0.05, 0.8], [0.0, -0.6, 0.7], [0.35, -0.05, 0.8],
      [0.7, 0.25, 0.7], [0.2, 0.5, 0.7], [-0.25, 0.5, 0.7],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [1, 3], [3, 4], [4, 5], [5, 6], [6, 1]],
  },
  // Capricorn — the arrowhead / triangle of the sea-goat.
  capricorn: {
    stars: [[-0.8, -0.35, 0.8], [0.85, -0.1, 0.8], [0.1, 0.75, 0.8], [-0.15, -0.05, 0.6]],
    lines: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 2]],
  },
  // Aquarius — the water-bearer's stream, a descending zigzag.
  aquarius: {
    stars: [
      [-0.85, -0.35, 0.7], [-0.45, -0.55, 0.8], [-0.1, -0.3, 0.7], [0.05, -0.6, 0.8],
      [0.2, 0.1, 0.7], [-0.1, 0.4, 0.7], [0.25, 0.6, 0.7], [0.0, 0.9, 0.7],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [6, 7]],
  },
  // Pisces — two fish on cords meeting at the knot.
  pisces: {
    stars: [
      [-0.9, -0.7, 0.7], [-0.5, -0.4, 0.7], [-0.15, -0.05, 0.8], [0.05, 0.25, 1],
      [0.4, 0.0, 0.7], [0.7, -0.3, 0.7], [0.92, -0.6, 0.7],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
};
