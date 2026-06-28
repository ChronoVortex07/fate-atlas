import { describe, it, expect } from 'vitest';
import { HAPPENINGS, selectHappening, dominantAxis, choiceCue } from '../../data/happenings';
import { defaultAffinityState } from '../../data/affinities';
import type { HappeningEffect } from '../types';

const aff = (over: Partial<Record<string, number>> = {}) => ({ ...defaultAffinityState(), ...over } as Record<import('../types').AffinityId, number>);

describe('happenings data + selection', () => {
  it('every happening choice carries at least one effect and valid axes', () => {
    for (const h of HAPPENINGS) {
      expect(h.axes.length).toBeGreaterThan(0);
      for (const c of h.choices) expect(c.effects.length).toBeGreaterThan(0);
    }
  });

  it('dominantAxis picks the pair with the widest spread', () => {
    expect(dominantAxis(aff({ chaos: 90, order: 10 }))).toBe('fortune');
    expect(dominantAxis(aff({ light: 88, shadow: 20 }))).toBe('information');
    expect(dominantAxis(aff({ fate: 85, will: 15 }))).toBe('agency');
  });

  it('selectHappening biases toward the dominant axis (information-heavy → an information scene)', () => {
    const orig = Math.random;
    // Information-dominant weights (data order): crossroads 1, falling-star 2, … total 13.
    // roll = 0.1 × 13 = 1.3 → skips crossroads (w1), lands in falling-star's (1,3] band:
    // an `information` scene. (Deterministic given the data as authored in this task.)
    Math.random = () => 0.1;
    try {
      const picked = selectHappening([], aff({ light: 95, shadow: 5 }));
      expect(picked.axes).toContain('information');
    } finally {
      Math.random = orig;
    }
  });

  it('choiceCue derives the fiction cue from effect kinds', () => {
    expect(choiceCue([{ kind: 'cost', affinity: 'order', amount: 10 }] as HappeningEffect[])).toBe('price');
    expect(choiceCue([{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }] as HappeningEffect[])).toBe('tear');
    expect(choiceCue([{ kind: 'gamble', outcomes: [] }] as HappeningEffect[])).toBe('fortune');
    expect(choiceCue([{ kind: 'shift', affinity: 'order', amount: 6 }] as HappeningEffect[])).toBeNull();
  });
});
