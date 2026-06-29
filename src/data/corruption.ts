import type { AffinityId, CorruptionBand } from '../engine/types';
import { AFFINITY_IDS } from './affinities';

export const CORRUPTION_BANDS: CorruptionBand[] =
  ['dormant', 'seeded', 'spreading', 'virulent', 'pinnacle'];

// ── Imbalance metric ──
// Affinity points above this threshold count as "excess" — the food corruption eats.
export const HIGH_THRESHOLD = 81; // the ascendant boundary

// ── Lifecycle tuning (playtest defaults) ──
export const SEED_INITIAL = 5;         // value the moment corruption spawns
export const SEED_FOOD_FACTOR = 0.004; // per-reading seed chance added per excess point (the "fill")
export const SEED_MAX_CHANCE = 0.85;   // cap on the per-reading seed chance (raised from 0.25 so a full hoard dominates; never 1.0 — a seed is never guaranteed)
export const SEED_COUNT_GROWTH = 1.7;  // exponential multiplier per additional high affinity (the "gate")
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

// How many affinities sit strictly above the high threshold — the breadth of imbalance.
export function highAffinityCount(affinities: Record<AffinityId, number>): number {
  let n = 0;
  for (const id of AFFINITY_IDS) if (affinities[id] > HIGH_THRESHOLD) n++;
  return n;
}

// Count gates an exponential multiplier; total excess (food) fills the magnitude.
// No high affinity → zero chance, ever. Capped so a seed is never guaranteed.
export function seedChance(food: number, highCount: number): number {
  if (highCount <= 0 || food <= 0) return 0;
  return Math.min(SEED_MAX_CHANCE, SEED_FOOD_FACTOR * food * Math.pow(SEED_COUNT_GROWTH, highCount - 1));
}

export const INFECTION_GAIN_MULT = 2; // corruption growth multiplier when an infected method is played

// How many offered methods corruption taints at each band. Infection (the
// amplified-growth mechanic + its selection-screen telegraph) begins at spreading.
export function infectedCountForBand(band: CorruptionBand): number {
  switch (band) {
    case 'spreading': return 1;
    case 'virulent':
    case 'pinnacle': return 2;
    default: return 0; // dormant, seeded — no infected methods yet
  }
}

export const INFECT_SPLIT = 0.5; // P(higher count) at spreading/virulent

// Chance-based taint count. Seeded shows nothing (gestation); Spreading 0–1;
// Virulent/Pinnacle 1–2. rng < INFECT_SPLIT picks the higher of the two.
export function rollInfectedCount(band: CorruptionBand, rng: () => number): number {
  switch (band) {
    case 'spreading': return rng() < INFECT_SPLIT ? 1 : 0;
    case 'virulent':
    case 'pinnacle':  return rng() < INFECT_SPLIT ? 2 : 1;
    default:          return 0; // dormant, seeded
  }
}

export const NEAR_PINNACLE = 90; // force a guaranteed intrusion past here if none yet this event
export const INTRUSION_PHRASES = [
  'i see you counting them.',
  'you keep feeding me.',
  'there is so much of you here.',
  'stop looking away.',
  'i was here before the stars.',
];
// Virulent-only; low base, ramping toward the pinnacle.
export function intrusionChance(value: number): number {
  if (value < 67) return 0;
  return 0.08 + ((value - 67) / (99 - 67)) * 0.25;
}

export function isVisibleCorruption(band: CorruptionBand): boolean {
  return band === 'spreading' || band === 'virulent' || band === 'pinnacle';
}

export const CORRUPTED_TAG = 'corrupted'; // marks a result the player can tell was tampered with

export const SIGHT_COST = 6;   // corruption added on the first forbidden-sight use per minigame
export const LIE_OFFSET = 18;  // magnitude the one falsified force is shifted by

// ── Light's corruption warning (presentation copy + seal staging) ──

// Light's seed-omen — fired once per perceived band escalation (sentence-case,
// formal: the scared protector). See docs/game-systems.md.
export const SEED_OMEN =
  'Something has taken root in the weave that should not be. Say nothing — do not let it know I warned you.';

// Light's furtive, cut-off line that corruption interrupts at the virulent crossing.
export const LIGHT_LEAD_IN = 'There is something in the —';

// Corruption's taunt, drawn when it interrupts Light at the virulent crossing.
// Lowercase, matching INTRUSION_PHRASES.
export const TAUNT_LIGHT = [
  'i let it warn you. watch how little it matters.',
];

// Ward-seal visual stage as a pure function of corruption value (deterministic,
// reload-safe). 'none' below spreading; intact → strain → shattered as it worsens.
export type SealStage = 'none' | 'intact' | 'strain' | 'shattered';
export const SEAL_INTACT_MAX = 56; // ≤ this (within spreading) the seal is calm
export const SEAL_STRAIN_MAX = 78; // ≤ this the seal strains; above → shattered

export function sealStageForValue(value: number): SealStage {
  const band = corruptionBandOf(value);
  if (band === 'dormant' || band === 'seeded') return 'none';
  if (value <= SEAL_INTACT_MAX) return 'intact';
  if (value <= SEAL_STRAIN_MAX) return 'strain';
  return 'shattered';
}
