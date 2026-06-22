import type { AffinityId, SlotResult, MinigameState, RollModifier, RollMode } from '../types';

export type TriggerPoint = string; // namespaced: 'select:draw:end', 'dice:roll', 'tarot:commit'

export type PriorityBand = 'STRUCTURAL' | 'MUTATE' | 'SPAWN' | 'OVERRIDE';
export const PRIORITY_BANDS: readonly PriorityBand[] = ['STRUCTURAL', 'MUTATE', 'SPAWN', 'OVERRIDE'];
export function bandValue(b: PriorityBand): number {
  return (PRIORITY_BANDS.indexOf(b) + 1) * 100;
}

export type ResolutionGroup =
  | { kind: 'exclusive'; band: PriorityBand }
  | { kind: 'combine'; channel: string };

export interface EffectReport {
  responderId: string;
  label: string;         // "Shadow"
  description: string;   // "A path is shrouded..."
  animation: string;     // selects the sequencer animation
  sourceSlot?: number;
  targetSlot?: number;
}

export interface PhaseDraft {
  pool?: SlotResult[];        // draw phases: items being dealt
  outcome?: SlotResult;       // action hooks: candidate result (replace = interception)
  rollMods?: RollModifier[];  // 'roll-mode' combine accumulator
  rollMode?: RollMode;        // 'roll-mode' result
  offerReroll?: boolean;      // 'roll-mode' result
  shrouded?: number[];        // indices of shrouded pool items
  [key: string]: unknown;     // extensible per trigger family
}

export interface PhaseContext {
  trigger: TriggerPoint;
  affinities: Record<AffinityId, number>;
  slots: SlotResult[];        // committed results this round
  hand: SlotResult[] | null;  // current uncommitted pool/hand
  spread: SlotResult[];       // slots + hand
  minigame: MinigameState | null;
  event: unknown;             // payload of the triggering action
  draft: PhaseDraft;          // MUTABLE
  rng: () => number;          // injectable RNG
}

export interface Responder {
  id: string;
  source: 'affinity' | 'interaction';
  triggers: TriggerPoint[];
  group: ResolutionGroup;
  condition(ctx: PhaseContext): boolean; // structural precondition — always required
  roll(ctx: PhaseContext): boolean;      // probabilistic gate — bypassed when forced
  weight?(ctx: PhaseContext): number;    // same-band tiebreak weight (default 1)
  apply(ctx: PhaseContext): EffectReport | null;
}

export interface CombineReducer {
  channel: string;
  reduce(ctx: PhaseContext): EffectReport | null;
}

export interface DebugConfig {
  forced: string[]; // responder IDs guaranteed to fire on their next trigger (one-shot)
  isolate: boolean; // when true only forced responders may fire
}
