import type { PhaseContext } from './types';
import type { AffinityId, AffinityBand, CorruptionBand } from '../types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP } from '../../data/affinities';
import { CORRUPTION_BANDS } from '../../data/corruption';

// Affinity band-gate × tier chance, scaled up per band above the gate.
// Mirrors the retired GameEngine.forcedOrRoll, but reads ctx.rng and ctx.affinities.
export function bandRoll(
  ctx: PhaseContext,
  affinity: AffinityId,
  minBand: AffinityBand,
  baseChance: number,
): boolean {
  const idx = BAND_ORDER.indexOf(bandOf(ctx.affinities[affinity]));
  const minIdx = BAND_ORDER.indexOf(minBand);
  if (idx < minIdx) return false;
  const scaled = baseChance * (1 + (idx - minIdx) * BAND_POWER_STEP);
  return ctx.rng() < Math.min(1, scaled);
}

// Corruption band-gate × tier chance, scaled up per band above the gate.
// Mirrors bandRoll but reads ctx.corruption (absent → dormant, never fires).
export function corruptionRoll(
  ctx: PhaseContext,
  minBand: CorruptionBand,
  baseChance: number,
): boolean {
  const band = ctx.corruption?.band ?? 'dormant';
  const idx = CORRUPTION_BANDS.indexOf(band);
  const minIdx = CORRUPTION_BANDS.indexOf(minBand);
  if (idx < minIdx) return false;
  const scaled = baseChance * (1 + (idx - minIdx) * BAND_POWER_STEP);
  return ctx.rng() < Math.min(1, scaled);
}
