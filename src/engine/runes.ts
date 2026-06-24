import type { AffinityBand, RuneScatter } from './types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE } from '../data/affinities';
import { stoneBrightness } from '../data/runes';

export type RuneCastMode = 'single' | 'favored' | 'clouded' | 'claim';

interface RuneModifier { affinity: 'will' | 'light' | 'shadow'; minBand: AffinityBand; mode: Exclude<RuneCastMode, 'single'>; source: string; }

const MODIFIERS: RuneModifier[] = [
  { affinity: 'will',   minBand: 'dominant',  mode: 'claim',   source: 'Your will seizes the casting' },
  { affinity: 'light',  minBand: 'ascendant', mode: 'favored', source: 'Light unveils the silent stones' },
  { affinity: 'shadow', minBand: 'ascendant', mode: 'clouded', source: 'Shadow veils the scatter' },
];

const idx = (band: AffinityBand) => BAND_ORDER.indexOf(band);
const atLeast = (value: number, band: AffinityBand) => idx(bandOf(value)) >= idx(band);
const DRIFT_BY_BAND: Record<AffinityBand, number> = { latent: 0, stirring: 0.33, ascendant: 0.66, dominant: 1 };

export function planRuneCast(
  affinities: Record<string, number>,
  offerRecast: boolean,
): { mode: RuneCastMode; drift: number; offerRecast: boolean; sources: string[] } {
  const sources: string[] = [];
  let mode: RuneCastMode = 'single';
  for (const m of MODIFIERS) {
    if (atLeast(affinities[m.affinity] ?? 0, m.minBand)) {
      // claim (Will) wins outright; favored/clouded only fill an unclaimed 'single'
      if (m.mode === 'claim') { mode = 'claim'; sources.push(m.source); break; }
      if (mode === 'single') { mode = m.mode; sources.push(m.source); }
    }
  }
  const fateBand = bandOf(affinities.fate ?? 0);
  const drift = DRIFT_BY_BAND[fateBand];
  const fateMovesHand = idx(fateBand) >= idx('ascendant');
  // claim already grants agency; Fate ascendant+ "moves the hand" → no Keep/Re-cast prompt.
  return { mode, drift, offerRecast: offerRecast && mode !== 'claim' && !fateMovesHand, sources };
}

// Probabilistic Re-cast offer (Will). Mirrors bandRoll(c,'will','stirring',T.notable).
export function shouldOfferRecast(affinities: Record<string, number>, rng: () => number = Math.random): boolean {
  const i = BAND_ORDER.indexOf(bandOf(affinities.will ?? 0));
  const minI = BAND_ORDER.indexOf('stirring');
  if (i < minI) return false;
  const scaled = TIER_BASE_CHANCE.notable * (1 + (i - minI) * BAND_POWER_STEP);
  return rng() < Math.min(1, scaled);
}

// Default governing = nearest-Heart face-up (set by resolveScatter). Favored/clouded
// re-pick between the two nearest by brightness; claim/single defer to the default.
export function resolveGoverning(scatter: RuneScatter, mode: RuneCastMode): number {
  const faceUp = scatter.stones.map((s, i) => ({ s, i })).filter(({ s }) => s.faceUp);
  if (faceUp.length === 0) return scatter.governingIndex;
  faceUp.sort((a, b) => Math.hypot(a.s.x, a.s.y) - Math.hypot(b.s.x, b.s.y));
  if (mode === 'favored' || mode === 'clouded') {
    const top2 = faceUp.slice(0, 2);
    top2.sort((a, b) => stoneBrightness(b.s) - stoneBrightness(a.s)); // brightest first
    return mode === 'favored' ? top2[0].i : top2[top2.length - 1].i;
  }
  return scatter.governingIndex;
}
