import type { AffinityId, AffinityBand } from '../engine/types';

// ── Scale & bands (playtest defaults) ──
export const BASELINE = 50;
export const BAND_BOUNDS = { latentMax: 34, stirringMax: 59, ascendantMax: 81 };
export const BAND_ORDER: AffinityBand[] = ['latent', 'stirring', 'ascendant', 'dominant'];

// ── Pipeline tuning (playtest defaults) ──
export const REACH_UP_CHANCE = 0.12;
export const COUPLING_OPPOSITE = 0.6;
export const COUPLING_OTHER = 0.35;
export const DR_STEP = 0.08;
export const DR_FLOOR = 0.3;
export const JITTER_MIN = 0.85;
export const JITTER_MAX = 1.15;
export const RUN_DRIFT = 0.33;
export const FEED_PER_MATCH = 5;

export const AFFINITY_IDS: AffinityId[] = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];

export const AFFINITY_PAIRS: Record<AffinityId, AffinityId> = {
  chaos: 'order',
  order: 'chaos',
  fate: 'will',
  will: 'fate',
  light: 'shadow',
  shadow: 'light',
};

export function bandOf(value: number): AffinityBand {
  if (value <= BAND_BOUNDS.latentMax) return 'latent';
  if (value <= BAND_BOUNDS.stirringMax) return 'stirring';
  if (value <= BAND_BOUNDS.ascendantMax) return 'ascendant';
  return 'dominant';
}

export function defaultAffinityState(): Record<AffinityId, number> {
  return AFFINITY_IDS.reduce(
    (acc, id) => ((acc[id] = BASELINE), acc),
    {} as Record<AffinityId, number>,
  );
}

export interface AffinityDefinition {
  id: AffinityId;
  name: string;
  description: string;
  accumulateFrom: string[]; // tags that increase this affinity
  dominantThreshold: number; // value at which effects kick in
  dominantHints: string[]; // flavor text shown when dominant
  effects: {
    description: string;
    magnitude: string; // for tooltip/debug
  }[];
}

export const CHAOS_AFFINITY: AffinityDefinition = {
  id: 'chaos',
  name: 'Chaos',
  description: 'Fueled by randomness, reversals, and changing patterns. Makes outcomes more volatile and unpredictable.',
  accumulateFrom: ['random', 'reversed', 'changing-lines'],
  dominantThreshold: 0.5,
  dominantHints: [
    'The air feels charged with unpredictability...',
    'The stars shift restlessly above...',
  ],
  effects: [
    { description: 'Increased chance of wild modifiers', magnitude: 'moderate' },
    { description: 'Interaction chains more likely', magnitude: 'significant' },
    { description: 'Happenings appear more often', magnitude: 'moderate' },
  ],
};

export const ORDER_AFFINITY: AffinityDefinition = {
  id: 'order',
  name: 'Order',
  description: 'Grows through stable results and measured choices. Steadies outcomes and brings clarity.',
  accumulateFrom: ['upright', 'neutral', 'stable'],
  dominantThreshold: 0.5,
  dominantHints: [
    'Patterns align with unusual clarity...',
    'A sense of steady purpose settles over the reading...',
  ],
  effects: [
    { description: 'Reduced chance of negative reversals', magnitude: 'moderate' },
    { description: 'Results lean toward balanced outcomes', magnitude: 'significant' },
    { description: 'Extra clarity in interpretation', magnitude: 'moderate' },
  ],
};
