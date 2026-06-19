import type { AffinityId } from '../engine/types';

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
