import type { QuestionType, WeaveGraph, WeavePlan, WovenNode, WovenEdge, StringsResult } from './types';
import { bandOf, BAND_ORDER } from '../data/affinities';
import { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor, consolidatePath } from '../data/strings';

const idx = (value: number) => BAND_ORDER.indexOf(bandOf(value));
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function planWeave(affinities: Record<string, number>): WeavePlan {
  const chaosI = idx(affinities.chaos ?? 0);
  const orderI = idx(affinities.order ?? 0);
  const fateI = idx(affinities.fate ?? 0);
  const willI = idx(affinities.will ?? 0);
  const lightI = idx(affinities.light ?? 0);
  const shadowI = idx(affinities.shadow ?? 0);

  const width = willI >= 2 ? 4 : (fateI >= 2 ? 2 : 3);
  const veil = shadowI >= 3 ? 2 : (shadowI >= 2 ? 1 : 0);
  const clarity: WeavePlan['clarity'] =
    shadowI >= 2 ? 'silhouette'
    : lightI >= 3 ? 'laid-bare'
    : lightI >= 2 ? 'themes'
    : 'mood';

  const sources: string[] = [];
  if (willI >= 2) sources.push('Your will widens the weave');
  if (fateI >= 2) sources.push('Fate narrows the threads');
  if (lightI >= 2) sources.push('Light parts the fog');
  if (shadowI >= 2) sources.push('Shadow deepens the veil');
  if (chaosI >= 2) sources.push('Chaos tangles the path');
  if (orderI >= 2) sources.push('Order straightens the weave');

  return {
    bandCount: chaosI >= 3 ? 5 : 4,
    width,
    veil,
    clarity,
    lookAhead: lightI >= 3 ? 2 : (lightI >= 2 ? 1 : 0),
    backtracks: willI >= 3 ? 2 : (willI >= 2 ? 1 : 0),
    allowRedraw: willI >= 3,
    offerRethread: willI >= 1,
    extremeBias: chaosI - orderI,
    crossingDensity: clampN(3 + (chaosI >= 2 ? 1 : 0) - (orderI >= 2 ? 1 : 0), 2, 4),
    foresight: lightI >= 2,
    sources,
  };
}

// generateWeave / revealFrom / drawWeave are added in Tasks 5–7.
export type { WeaveGraph, WeavePlan, WovenNode, WovenEdge, StringsResult, QuestionType };
export { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor, consolidatePath };
