import type { AffinityBand, AffinityId } from './types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE } from '../data/affinities';

export type AstralCastMode = 'single' | 'favored' | 'clouded' | 'choice';

interface AstralModifier { affinity: AffinityId; minBand: AffinityBand; mode: Exclude<AstralCastMode, 'single'>; source: string; }

export const AFFINITY_ASTRAL_MODIFIERS: AstralModifier[] = [
  { affinity: 'will',   minBand: 'dominant',  mode: 'choice',  source: 'Your will seizes the cast' },
  { affinity: 'light',  minBand: 'ascendant', mode: 'favored', source: 'Light favors the heavens' },
  { affinity: 'shadow', minBand: 'ascendant', mode: 'clouded', source: 'Shadow clouds the chart' },
];

const atLeast = (value: number, band: AffinityBand) =>
  BAND_ORDER.indexOf(bandOf(value)) >= BAND_ORDER.indexOf(band);

export function planAstralCast(
  affinities: Record<string, number>,
  offerRecast: boolean,
): { mode: AstralCastMode; offerRecast: boolean; sources: string[] } {
  const sources: string[] = [];
  let mode: AstralCastMode = 'single';
  for (const m of AFFINITY_ASTRAL_MODIFIERS) {
    if (atLeast(affinities[m.affinity] ?? 0, m.minBand)) {
      // choice wins over favored/clouded; first matching choice locks it
      if (m.mode === 'choice') { mode = 'choice'; sources.push(m.source); break; }
      if (mode === 'single') { mode = m.mode; sources.push(m.source); }
    }
  }
  return { mode, offerRecast: mode === 'choice' ? false : offerRecast, sources };
}

// Probabilistic offer-recast (Will). Replicates bandRoll(c,'will','stirring',T.notable)
// exactly, so balance matches the legacy offered-reroll without depending on the
// dice:roll dispatch or dice-modifiers.ts.
export function shouldOfferRecast(affinities: Record<string, number>, rng: () => number = Math.random): boolean {
  const idx = BAND_ORDER.indexOf(bandOf(affinities.will ?? 0));
  const minIdx = BAND_ORDER.indexOf('stirring');
  if (idx < minIdx) return false;
  const scaled = TIER_BASE_CHANCE.notable * (1 + (idx - minIdx) * BAND_POWER_STEP);
  return rng() < Math.min(1, scaled);
}
