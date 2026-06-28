import { describe, it, expect } from 'vitest';
import {
  corruptionFood, corruptionBandOf, seedChance,
  HIGH_THRESHOLD, SEED_MAX_CHANCE, PINNACLE,
} from '../../data/corruption';
import type { AffinityId } from '../types';

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> => ({
  chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over,
});

describe('corruptionFood', () => {
  it('is zero when nothing exceeds the high threshold', () => {
    expect(corruptionFood(vec({ chaos: HIGH_THRESHOLD }))).toBe(0);
  });

  it('sums only the excess above the high threshold across all six', () => {
    // chaos 91 → +10, order 86 → +5, rest at/below threshold → +0
    expect(corruptionFood(vec({ chaos: 91, order: 86 }))).toBe(15);
  });

  it('counts two maxed affinities as much as the spread (concentration is punished)', () => {
    const twoMaxed = corruptionFood(vec({ chaos: 100, order: 100 }));     // 19 + 19 = 38
    const fourHigh = corruptionFood(vec({ chaos: 90, order: 90, fate: 90, will: 90 })); // 9*4 = 36
    expect(twoMaxed).toBeGreaterThanOrEqual(fourHigh - 5);
  });
});

describe('corruptionBandOf', () => {
  it('maps the scalar onto escalating bands', () => {
    expect(corruptionBandOf(0)).toBe('dormant');
    expect(corruptionBandOf(5)).toBe('seeded');
    expect(corruptionBandOf(34)).toBe('seeded');
    expect(corruptionBandOf(35)).toBe('spreading');
    expect(corruptionBandOf(66)).toBe('spreading');
    expect(corruptionBandOf(67)).toBe('virulent');
    expect(corruptionBandOf(99)).toBe('virulent');
    expect(corruptionBandOf(PINNACLE)).toBe('pinnacle');
  });
});

describe('seedChance', () => {
  it('is zero with no food (no imbalance → no corruption, ever)', () => {
    expect(seedChance(0)).toBe(0);
  });

  it('scales with food and is capped', () => {
    expect(seedChance(10)).toBeGreaterThan(0);
    expect(seedChance(100_000)).toBe(SEED_MAX_CHANCE);
  });
});
