import type { AffinityId, CorruptionBand } from '../engine/types';
import { AFFINITY_IDS } from './affinities';

export const CORRUPTION_BANDS: CorruptionBand[] =
  ['dormant', 'seeded', 'spreading', 'virulent', 'pinnacle'];

// ── Imbalance metric ──
// Affinity points above this threshold count as "excess" — the food corruption eats.
export const HIGH_THRESHOLD = 81; // the ascendant boundary

// ── Lifecycle tuning (playtest defaults) ──
export const SEED_INITIAL = 5;         // value the moment corruption spawns
export const SEED_FOOD_FACTOR = 0.004; // per-reading seed chance added per excess point
export const SEED_MAX_CHANCE = 0.25;   // cap on the per-reading seed chance
export const EROSION_RATE = 0.06;      // corruption gained per excess point per reading (primary growth)
export const SKIM_RATE = 0.10;         // corruption gained per realized affinity-gain point (secondary)
export const DRAIN_RATE = 0.04;        // fraction of each affinity's excess drained into corruption per reading
export const DECAY_RATE = 8;           // corruption lost per reading while starved (food === 0)
export const PINNACLE = 100;           // value at/above which the Rupture fires
export const RUPTURE_RESET = 25;       // every affinity is reset to this (latent) after a Rupture

// Σ of how far each affinity sits above the high threshold = distance from the
// natural order = the imbalance corruption feeds on.
export function corruptionFood(affinities: Record<AffinityId, number>): number {
  let food = 0;
  for (const id of AFFINITY_IDS) food += Math.max(0, affinities[id] - HIGH_THRESHOLD);
  return food;
}

export function corruptionBandOf(value: number): CorruptionBand {
  if (value <= 0) return 'dormant';
  if (value >= PINNACLE) return 'pinnacle';
  if (value <= 34) return 'seeded';
  if (value <= 66) return 'spreading';
  return 'virulent';
}

// No imbalance → zero chance. Otherwise scales with food, capped.
export function seedChance(food: number): number {
  if (food <= 0) return 0;
  return Math.min(SEED_MAX_CHANCE, food * SEED_FOOD_FACTOR);
}
