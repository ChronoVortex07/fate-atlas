import { describe, it, expect } from 'vitest';
import { corruptionRoll } from '../events/eligibility';
import { defaultAffinityState } from '../../data/affinities';
import type { PhaseContext } from '../events/types';
import type { CorruptionBand } from '../types';

function ctx(band: CorruptionBand | undefined, rng: () => number): PhaseContext {
  return {
    trigger: 't',
    affinities: defaultAffinityState(),
    corruption: band ? { value: 50, band } : undefined,
    slots: [], hand: null, spread: [], minigame: null, event: null,
    draft: {}, rng,
  };
}

describe('corruptionRoll', () => {
  it('never fires below the minimum band', () => {
    expect(corruptionRoll(ctx('spreading', () => 0), 'virulent', 0.5)).toBe(false);
  });

  it('fires at the minimum band when the roll passes', () => {
    expect(corruptionRoll(ctx('virulent', () => 0), 'virulent', 0.5)).toBe(true);
  });

  it('treats absent corruption as dormant (never fires)', () => {
    expect(corruptionRoll(ctx(undefined, () => 0), 'seeded', 0.9)).toBe(false);
  });

  it('scales the chance up for bands above the gate', () => {
    // pinnacle is one band above virulent → strictly higher effective chance.
    const r = 0.6; // above base 0.5, below the scaled pinnacle chance
    expect(corruptionRoll(ctx('virulent', () => r), 'virulent', 0.5)).toBe(false);
    expect(corruptionRoll(ctx('pinnacle', () => r), 'virulent', 0.5)).toBe(true);
  });
});
