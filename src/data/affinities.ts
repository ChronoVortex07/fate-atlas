import type { AffinityId, AffinityBand, AffinityAction } from '../engine/types';

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
export const FEED_PER_ACTION = 6;        // base affinity gain per agency/information action
export const FORTUNE_TAG_CAP = 8; // max base Fortune gain from result tags + coherence per run
export const SECONDARY_FEED_FACTOR = 0.5; // secondary axis (e.g. Chaos when reversing) feeds at half
export const BAND_POWER_STEP = 0.7;       // event-resolved chance scales +70% per band above the gate

// Tier base chances (playtest defaults; midpoints of the spec's ranges).
export const TIER_BASE_CHANCE = { ambient: 0.5, notable: 0.22, rare: 0.04, major: 0.08 } as const;

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

export function bandIndex(band: AffinityBand): number {
  return BAND_ORDER.indexOf(band);
}

export interface ActionFeed {
  primary: AffinityId;
  secondary?: AffinityId;
}

// Single source of truth for which affinity each player action feeds.
export const ACTION_FEEDS: Record<AffinityAction, ActionFeed> = {
  'reveal-as-drawn': { primary: 'fate' },
  'keep-roll':       { primary: 'fate' },
  'decline-reroll':  { primary: 'fate' },
  'reverse':         { primary: 'will', secondary: 'chaos' },
  'take-reroll':     { primary: 'will', secondary: 'chaos' },
  'swap-method':     { primary: 'will' },
  'set-orientation': { primary: 'will' },
  'use-peek':        { primary: 'light' },
  'seek-pattern':    { primary: 'light' },
  'decline-peek':    { primary: 'shadow' },
  'embrace-mystery': { primary: 'shadow' },
};

export function defaultAffinityState(): Record<AffinityId, number> {
  return AFFINITY_IDS.reduce(
    (acc, id) => ((acc[id] = BASELINE), acc),
    {} as Record<AffinityId, number>,
  );
}

export type EffectTier = 'ambient' | 'notable' | 'rare' | 'major';

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
  feeds: { tags: ['reversed', 'changing-lines'], actions: [] },
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
  feeds: { tags: [], actions: ['reveal-as-drawn', 'keep-roll', 'decline-reroll'] },
  hints: {
    latent: [],
    stirring: ['The current seems to tug at your hand...'],
    ascendant: ['Something else is choosing alongside you...'],
    dominant: ['The weave moves your hand more than you do...'],
  },
  bandedEffects: [
    { id: 'auto-orient',      tier: 'notable', band: 'stirring',  description: 'A coin-flip detail is decided for you.' },
    { id: 'card-swap',        tier: 'major',   band: 'ascendant', description: 'The card you pick may not be the one revealed.' },
    { id: 'hollow-reroll',    tier: 'major',   band: 'ascendant', description: 'A reroll may return the same result.' },
    { id: 'the-hand-chooses', tier: 'major',   band: 'dominant',  description: 'Sometimes the hand is picked for you.' },
    { id: 'force-method',     tier: 'notable', band: 'dominant',  description: 'The method may be forced.' },
    { id: 'fated-card',       tier: 'notable', band: 'ascendant', description: 'A picked card may be fated — immutable and locked.' },
  ],
};

export const WILL_AFFINITY: AffinityDefinition = {
  id: 'will',
  name: 'Will',
  opposite: 'fate',
  description: 'Agency given to the player — more autonomy over the reading.',
  feeds: { tags: [], actions: ['reverse', 'take-reroll', 'swap-method', 'set-orientation'] },
  hints: {
    latent: [],
    stirring: ['Your choices feel a little freer...'],
    ascendant: ['The reading bends readily to your intent...'],
    dominant: ['The outcome is yours to shape...'],
  },
  bandedEffects: [
    { id: 'offer-reroll',     tier: 'notable', band: 'stirring',  description: 'A "Reroll?" prompt may appear after an action.' },
    { id: 'free-orientation', tier: 'ambient', band: 'ascendant', description: 'Free orientation choice.' },
    { id: 'choice',           tier: 'major',   band: 'dominant',  description: 'Cast two dice and keep one.' },
  ],
};

export const LIGHT_AFFINITY: AffinityDefinition = {
  id: 'light',
  name: 'Light',
  opposite: 'shadow',
  description: 'The game reveals more — clearer readings and foresight.',
  feeds: { tags: [], actions: ['use-peek', 'seek-pattern'] },
  hints: {
    latent: [],
    stirring: ['The reading reads a touch clearer...'],
    ascendant: ['Meaning surfaces readily; foresight beckons...'],
    dominant: ['Everything is laid bare and luminous...'],
  },
  bandedEffects: [
    { id: 'peek',         tier: 'notable', band: 'ascendant', description: 'Foresight (peek) becomes available.' },
    { id: 'illumination', tier: 'ambient', band: 'dominant',  description: 'Rich, explicit reading; hints name the forces.' },
  ],
};

export const SHADOW_AFFINITY: AffinityDefinition = {
  id: 'shadow',
  name: 'Shadow',
  opposite: 'light',
  description: 'The game conceals more — terse, cryptic, veiled readings.',
  feeds: { tags: [], actions: ['decline-peek', 'embrace-mystery'] },
  hints: {
    latent: [],
    stirring: ['The edges of meaning blur...'],
    ascendant: ['Much is withheld; the reading speaks in riddles...'],
    dominant: ['Darkness swallows all but the faintest sign...'],
  },
  bandedEffects: [
    { id: 'veiled',  tier: 'notable', band: 'ascendant', description: 'Results show less; threshold hidden until commit.' },
    { id: 'eclipse', tier: 'ambient', band: 'dominant',  description: 'Cryptic, sparse reading; results may stay partly hidden.' },
  ],
};

export const AFFINITY_DEFINITIONS: AffinityDefinition[] = [
  CHAOS_AFFINITY,
  ORDER_AFFINITY,
  FATE_AFFINITY,
  WILL_AFFINITY,
  LIGHT_AFFINITY,
  SHADOW_AFFINITY,
];
