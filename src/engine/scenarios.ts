import type { GameState, PendingEffect, SlotResult, AffinityId } from './types';
import { MAJOR_ARCANA } from '../data/tarot';

export type ScenarioAffinityPatch = Partial<Record<AffinityId, number>>;

export interface ScenarioPreset {
  id: string;
  label: string;
  group: string;
  // Mutate non-affinity state; return an affinity patch (applied via the engine).
  apply: (state: GameState) => ScenarioAffinityPatch | void;
}

const base = (sourceCard: string, action: PendingEffect['action'], triggerTags: string[], description: string): PendingEffect => ({
  id: `debug-${sourceCard}`,
  sourceRunId: 'debug-run',
  sourceCard,
  sourceSlotIndex: 0,
  triggerTags,
  action,
  description,
  expiresAfter: 3,
  turnsRemaining: 3,
});

const foolTarotResult = (): SlotResult => {
  const card = MAJOR_ARCANA.find((c) => c.id === 'the-fool')!;
  return {
    type: 'tarot', id: card.id, name: card.name, number: card.number,
    orientation: 'upright', symbol: card.symbol,
    meaningUpright: card.meaningUpright, meaningReversed: card.meaningReversed,
    tags: ['draw', 'random', 'major-arcana', 'reversible', card.archetypeTag, 'upright'],
    themes: ['renewal', 'mystery'],
    dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
    modifierRoles: ['subject'],
  } as SlotResult;
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  // ── Meta-Interactions (existing five) ──
  {
    id: 'fools-reroll', label: "Fool's Reroll", group: 'Meta-Interactions',
    apply: (state) => {
      state.turnResults = [foolTarotResult()];
      state.minigamesCompleted = 1;
      state.pendingEffects = [base('The Fool', 'reroll', ['roll', 'numeric'], "The Fool's wild energy ripples through fate — the dice must be cast again.")];
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
    },
  },
  {
    id: 'critical-low-flip', label: 'Critical Flip', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Critical Roll', 'flip', ['major-arcana', 'reversible'], 'A dire omen from the dice — the cards tremble and turn.')];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'iching-boost', label: 'I Ching Boost', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Hexagram', 'add-choice', ['event', 'happening'], 'The changing lines reveal hidden branches — more choices emerge.')];
      state.selectedMethod = 'iching';
      state.screen = 'minigame';
    },
  },
  {
    id: 'mirror-event', label: 'Mirror Event', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Mirrored Card', 'mirror', ['reversible'], 'Two forces reflect each other across the weave — both turn.')];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'chaos-surge', label: 'Chaos Surge (pending)', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Chaos', 'second-result', [], 'Chaos surges — a second possibility emerges from the void.')];
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      return { chaos: 85 };
    },
  },

  // ── Chaos / Order ──
  {
    id: 'chaos-wild-surge', label: 'Wild Surge — Chaos Dominant', group: 'Chaos / Order',
    apply: (state) => {
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      state.debugForcedEffect = 'wild-surge';
      return { chaos: 90, order: 15 };
    },
  },
  {
    id: 'chaos-happening-interrupt', label: 'Happening Interrupt — Chaos Dominant', group: 'Chaos / Order',
    apply: (state) => {
      state.turnResults = [foolTarotResult()];
      state.minigamesCompleted = 1;
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      state.debugForcedEffect = 'happening-interrupt';
      return { chaos: 90, order: 15 };
    },
  },
  {
    id: 'chaos-volatile-dice', label: 'Volatile Dice — Chaos Ascendant', group: 'Chaos / Order',
    apply: (state) => {
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      return { chaos: 75, order: 25 };
    },
  },
  {
    id: 'order-steady-dice', label: 'Steady Dice — Order Ascendant', group: 'Chaos / Order',
    apply: (state) => {
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      return { order: 75, chaos: 25 };
    },
  },
];

// Returns the affinity patch to route through the engine, or null if id unknown.
export function loadScenario(presetId: string, state: GameState): ScenarioAffinityPatch | null {
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const patch = preset.apply(state);
  return patch ?? {};
}
