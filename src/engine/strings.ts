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

const N_CROSSING = 4; // crossing nodes per band
const N_DEST = 3;     // destination nodes shown

const pick = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// Weighted-without-replacement sample of `n` ids, weight skewed by extremeBias:
// Chaos (>0) favors high-magnitude concepts; Order (<0) favors mild ones.
function sampleCrossings(n: number, extremeBias: number, rng: () => number): string[] {
  const pool = [...CROSSING_IDS];
  const out: string[] = [];
  while (out.length < n && pool.length > 0) {
    const weights = pool.map((id) => {
      const d = CONCEPTS[id].dimensions;
      const mag = (Math.abs(d.favorability) + Math.abs(d.certainty) + Math.abs(d.volatility)) / 3; // 0..2
      return Math.max(0.05, 1 + extremeBias * 0.4 * (mag - 0.5));
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rng() * total;
    let chosen = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) { chosen = i; break; } }
    out.push(pool.splice(chosen, 1)[0]);
  }
  return out;
}

function placeNode(id: string, band: number, indexInBand: number, bandSize: number, bandCount: number, jitter: number, rng: () => number): WovenNode {
  const radius = bandCount > 1 ? band / (bandCount - 1) : 0;
  const baseAngle = bandSize > 1 ? (indexInBand / bandSize) * Math.PI * 2 : 0;
  const wobble = (rng() - 0.5) * jitter;
  return {
    id: `b${band}-${indexInBand}`,
    conceptId: id,
    band,
    family: CONCEPTS[id].family,
    x: Math.cos(baseAngle + wobble) * radius,
    y: Math.sin(baseAngle + wobble) * radius,
  };
}

export function generateWeave(question: QuestionType, plan: WeavePlan, rng: () => number = Math.random): WeaveGraph {
  const bandCount = plan.bandCount;
  const jitter = 0.4 + Math.max(0, plan.extremeBias) * 0.25;
  const bands: WovenNode[][] = [];

  // band 0: origin
  bands.push([placeNode(pick(ORIGIN_IDS, rng), 0, 0, 1, bandCount, 0, rng)]);

  // crossing bands 1..bandCount-2
  for (let b = 1; b < bandCount - 1; b++) {
    const ids = sampleCrossings(N_CROSSING, plan.extremeBias, rng);
    bands.push(ids.map((id, i) => placeNode(id, b, i, ids.length, bandCount, jitter, rng)));
  }

  // destination band
  const destPool = destinationsFor(question);
  const destIds = destPool.length <= N_DEST ? destPool : (() => {
    const copy = [...destPool]; const out: string[] = [];
    while (out.length < N_DEST && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    return out;
  })();
  bands.push(destIds.map((id, i) => placeNode(id, bandCount - 1, i, destIds.length, bandCount, jitter, rng)));

  // edges: every next-band node gets ≥1 incoming (round-robin), every source gets
  // up to crossingDensity distinct forward targets (≥2 when available).
  const edges: WovenEdge[] = [];
  for (let b = 0; b < bandCount - 1; b++) {
    const from = bands[b], to = bands[b + 1];
    const wanted = Math.min(plan.crossingDensity, to.length);
    const minPer = Math.min(Math.max(2, 1), to.length); // ≥2 when possible
    to.forEach((t, i) => edges.push({ from: from[i % from.length].id, to: t.id })); // coverage
    for (const src of from) {
      const have = new Set(edges.filter((e) => e.from === src.id).map((e) => e.to));
      const targets = [...to].sort(() => rng() - 0.5);
      for (const t of targets) {
        if (have.size >= Math.max(wanted, minPer)) break;
        if (!have.has(t.id)) { have.add(t.id); edges.push({ from: src.id, to: t.id }); }
      }
    }
  }

  return { nodes: bands.flat(), edges, originId: bands[0][0].id, bandCount };
}

// revealFrom / drawWeave are added in Tasks 6–7.
export type { WeaveGraph, WeavePlan, WovenNode, WovenEdge, StringsResult, QuestionType };
export { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor, consolidatePath };
