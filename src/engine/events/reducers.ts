import type { CombineReducer, PhaseContext, EffectReport } from './types';
import type { RollMode, RollModifier } from '../types';
import { resolveRollMode } from '../../data/dice-modifiers';

function describeRollMode(mode: RollMode, offerReroll: boolean): string {
  if (mode === 'choice') return 'Your will seizes the cast — two dice, keep one.';
  if (mode === 'advantage') return 'The cast is favored — the higher die holds.';
  if (mode === 'disadvantage') return 'The cast is clouded — the lower die holds.';
  return offerReroll ? 'The cast may be tried again.' : 'The cast holds steady.';
}

export const rollModeReducer: CombineReducer = {
  channel: 'roll-mode',
  reduce(ctx: PhaseContext): EffectReport | null {
    const mods = (ctx.draft.rollMods ?? []) as RollModifier[];
    const { mode, offerReroll } = resolveRollMode(mods);
    ctx.draft.rollMode = mode;
    ctx.draft.offerReroll = offerReroll;
    // Only narrate when something actually changed the cast.
    if (mode === 'single' && !offerReroll) return null;
    return {
      responderId: 'roll-mode',
      label: 'The Cast',
      description: describeRollMode(mode, offerReroll),
      animation: 'roll-mode',
    };
  },
};

export const REDUCERS: Record<string, CombineReducer> = {
  'roll-mode': rollModeReducer,
};
