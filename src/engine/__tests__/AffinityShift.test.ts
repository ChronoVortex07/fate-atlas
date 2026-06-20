import { describe, it, expect } from 'vitest';
import {
  bandOf,
  defaultAffinityState,
  AFFINITY_IDS,
  AFFINITY_PAIRS,
} from '../../data/affinities';

describe('band + foundation helpers', () => {
  it('classifies values into bands at the documented boundaries', () => {
    expect(bandOf(0)).toBe('latent');
    expect(bandOf(34)).toBe('latent');
    expect(bandOf(35)).toBe('stirring');
    expect(bandOf(59)).toBe('stirring');
    expect(bandOf(60)).toBe('ascendant');
    expect(bandOf(81)).toBe('ascendant');
    expect(bandOf(82)).toBe('dominant');
    expect(bandOf(100)).toBe('dominant');
  });

  it('AFFINITY_PAIRS is a symmetric involution over all six ids', () => {
    expect(AFFINITY_IDS).toHaveLength(6);
    for (const id of AFFINITY_IDS) {
      const opp = AFFINITY_PAIRS[id];
      expect(opp).not.toBe(id);
      expect(AFFINITY_PAIRS[opp]).toBe(id);
    }
  });

  it('defaultAffinityState seeds all six affinities at baseline 50', () => {
    const s = defaultAffinityState();
    expect(Object.keys(s).sort()).toEqual([...AFFINITY_IDS].sort());
    for (const id of AFFINITY_IDS) expect(s[id]).toBe(50);
  });
});
