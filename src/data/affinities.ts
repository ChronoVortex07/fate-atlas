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

export type EffectTier = 'ambient' | 'notable' | 'major';

export interface BandedEffect {
  id: string;
  tier: EffectTier;
  band: AffinityBand; // minimum band at which it can fire
  description: string;
}

export interface AffinityDefinition {
  id: AffinityId;
  name: string;
  opposite: AffinityId;
  description: string;
  feeds: {
    tags: string[];    // result tags that feed this affinity (Chaos/Order)
    actions: string[]; // player-action ids that feed it (Fate/Will/Light/Shadow — Phase 2/3)
  };
  hints: Record<AffinityBand, string[]>; // per-band flavor, top-forces only
  bandedEffects: BandedEffect[];         // effects this affinity grants (stubbed for the new four)
}

export const CHAOS_AFFINITY: AffinityDefinition = {
  id: 'chaos',
  name: 'Chaos',
  opposite: 'order',
  description: 'Fueled by randomness, reversals, and changing patterns. Volatile, swingy outcomes.',
  feeds: { tags: ['random', 'reversed', 'changing-lines'], actions: [] },
  hints: {
    latent: [],
    stirring: ['The air carries a faint restlessness...'],
    ascendant: ['The currents run unpredictable and quick...', 'The stars shift restlessly above...'],
    dominant: ['Reality frays at the edges — anything may surface...'],
  },
  bandedEffects: [
    { id: 'wild-surge', tier: 'major', band: 'dominant', description: 'A result can spawn a second.' },
    { id: 'happening-interrupt', tier: 'major', band: 'dominant', description: 'A happening can interrupt a minigame.' },
  ],
};

export const ORDER_AFFINITY: AffinityDefinition = {
  id: 'order',
  name: 'Order',
  opposite: 'chaos',
  description: 'Grows through stable, upright, measured results. Steadies and clarifies outcomes.',
  feeds: { tags: ['upright', 'neutral', 'stable'], actions: [] },
  hints: {
    latent: [],
    stirring: ['A quiet steadiness settles in...'],
    ascendant: ['Patterns align with unusual clarity...', 'A sense of steady purpose settles over the reading...'],
    dominant: ['Everything coheres — the weave lies flat and legible...'],
  },
  bandedEffects: [],
};

// The new four are defined now so coupling and migration treat all six uniformly;
// their EFFECTS (bandedEffects) and action feeds are wired in Phases 2–3.
export const FATE_AFFINITY: AffinityDefinition = {
  id: 'fate',
  name: 'Fate',
  opposite: 'will',
  description: 'Control taken from the player — choices decided by the weave.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['The current seems to tug at your hand...'],
    ascendant: ['Something else is choosing alongside you...'],
    dominant: ['The weave moves your hand more than you do...'],
  },
  bandedEffects: [],
};

export const WILL_AFFINITY: AffinityDefinition = {
  id: 'will',
  name: 'Will',
  opposite: 'fate',
  description: 'Agency given to the player — more autonomy over the reading.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['Your choices feel a little freer...'],
    ascendant: ['The reading bends readily to your intent...'],
    dominant: ['The outcome is yours to shape...'],
  },
  bandedEffects: [],
};

export const LIGHT_AFFINITY: AffinityDefinition = {
  id: 'light',
  name: 'Light',
  opposite: 'shadow',
  description: 'The game reveals more — clearer readings and foresight.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['The reading reads a touch clearer...'],
    ascendant: ['Meaning surfaces readily; foresight beckons...'],
    dominant: ['Everything is laid bare and luminous...'],
  },
  bandedEffects: [],
};

export const SHADOW_AFFINITY: AffinityDefinition = {
  id: 'shadow',
  name: 'Shadow',
  opposite: 'light',
  description: 'The game conceals more — terse, cryptic, veiled readings.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['The edges of meaning blur...'],
    ascendant: ['Much is withheld; the reading speaks in riddles...'],
    dominant: ['Darkness swallows all but the faintest sign...'],
  },
  bandedEffects: [],
};

export const AFFINITY_DEFINITIONS: AffinityDefinition[] = [
  CHAOS_AFFINITY,
  ORDER_AFFINITY,
  FATE_AFFINITY,
  WILL_AFFINITY,
  LIGHT_AFFINITY,
  SHADOW_AFFINITY,
];
