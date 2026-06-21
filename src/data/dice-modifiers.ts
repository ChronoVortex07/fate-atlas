import type { AffinityId, AffinityBand, RollModifier, RollMode } from '../engine/types';

// Pending-effect actions that are pre-roll dice modifiers (consumed by
// planDiceRoll, not executeEffect). 'offer-reroll' is NOT here — it is not a
// pending-effect action; it rides the existing probabilistic offerReroll().
export const ROLL_MODIFIER_ACTIONS: RollModifier[] = ['advantage', 'disadvantage', 'choice'];

// The stable, type-level tags a d20 carries before it is rolled. A pending
// roll-modifier effect matches the upcoming die when all its triggerTags are here.
export const DICE_PREROLL_TAGS: string[] = ['roll', 'numeric'];

export interface AffinityRollModifier {
  affinity: AffinityId;
  minBand: AffinityBand;   // applies deterministically at or above this band
  modifier: RollModifier;
  source: string;          // caption text
}

// Seed triggers (easily extended — add a row). Deterministic while in-band.
export const AFFINITY_ROLL_MODIFIERS: AffinityRollModifier[] = [
  { affinity: 'light',  minBand: 'ascendant', modifier: 'advantage',    source: 'Light favors you' },
  { affinity: 'shadow', minBand: 'ascendant', modifier: 'disadvantage', source: 'Shadow clouds the cast' },
  { affinity: 'will',   minBand: 'dominant',  modifier: 'choice',       source: 'Your will seizes the cast' },
];

// Pure combine rule:
//  - any 'choice' wins (player pick), and suppresses offer-reroll;
//  - else advantage/disadvantage net by count, ties → single (cancel out).
export function resolveRollMode(mods: RollModifier[]): { mode: RollMode; offerReroll: boolean } {
  if (mods.includes('choice')) return { mode: 'choice', offerReroll: false };
  const net =
    mods.filter((m) => m === 'advantage').length -
    mods.filter((m) => m === 'disadvantage').length;
  const mode: RollMode = net > 0 ? 'advantage' : net < 0 ? 'disadvantage' : 'single';
  return { mode, offerReroll: mods.includes('offer-reroll') };
}
