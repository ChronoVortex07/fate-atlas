import type { AffinityId, CorruptionBand } from './types';
import { AFFINITY_IDS } from '../data/affinities';
import {
  corruptionFood, corruptionBandOf, seedChance,
  SEED_INITIAL, EROSION_RATE, SKIM_RATE, DRAIN_RATE, DECAY_RATE,
  HIGH_THRESHOLD, PINNACLE,
} from '../data/corruption';

export interface CorruptionTickResult {
  value: number;                                 // rounded scalar after the tick
  band: CorruptionBand;
  seeded: boolean;                               // true only on the tick it spawns
  drains: Partial<Record<AffinityId, number>>;   // positive magnitudes to subtract from each affinity
  ruptured: boolean;                             // true once the pinnacle is reached
}

// The predator. A single 0–100 scalar that lives outside the affinity laws.
// Value is kept as a float internally (so slow growth never rounds away) and
// surfaced rounded.
export class CorruptionEngine {
  private value = 0;

  getValue(): number { return Math.round(this.value); }
  getBand(): CorruptionBand { return corruptionBandOf(Math.round(this.value)); }

  setValue(v: number): void { this.value = Math.max(0, Math.min(PINNACLE, v)); }
  clear(): void { this.value = 0; }

  // Advance one completed reading. Pure except for the internal scalar.
  tick(
    affinities: Record<AffinityId, number>,
    realizedGains: number,
    rng: () => number = Math.random,
    infectionMult = 1,
  ): CorruptionTickResult {
    const food = corruptionFood(affinities);

    // Dormant: corruption appears ONLY as a consequence of imbalance.
    if (this.value <= 0) {
      const seeded = food > 0 && rng() < seedChance(food);
      if (seeded) this.value = SEED_INITIAL;
      return this.report(seeded, {}); // a fresh seed neither drains nor ruptures this tick
    }

    // Active: grow on food, starve without it.
    const drains: Partial<Record<AffinityId, number>> = {};
    if (food > 0) {
      this.value = Math.min(PINNACLE, this.value + (EROSION_RATE * food + SKIM_RATE * Math.max(0, realizedGains)) * infectionMult);
      for (const id of AFFINITY_IDS) {
        const excess = affinities[id] - HIGH_THRESHOLD;
        if (excess > 0) drains[id] = DRAIN_RATE * excess;
      }
    } else {
      this.value = Math.max(0, this.value - DECAY_RATE);
    }

    return this.report(false, drains);
  }

  private report(seeded: boolean, drains: Partial<Record<AffinityId, number>>): CorruptionTickResult {
    return {
      value: this.getValue(),
      band: this.getBand(),
      seeded,
      drains,
      ruptured: this.value >= PINNACLE,
    };
  }

  serialize(): string { return JSON.stringify({ value: this.value }); }

  loadFrom(json: string): void {
    try {
      const parsed = JSON.parse(json) as { value?: unknown };
      this.value = typeof parsed.value === 'number'
        ? Math.max(0, Math.min(PINNACLE, parsed.value))
        : 0;
    } catch {
      this.value = 0;
    }
  }
}
