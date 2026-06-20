import type { GameState, PendingEffect, SlotResult } from './types';
import { MAJOR_ARCANA } from '../data/tarot';

export interface ScenarioPreset {
  id: string;
  label: string;
  apply: (state: GameState) => void;
}

const foolsRerollEffect: PendingEffect = {
  id: 'debug-fools-reroll',
  sourceRunId: 'debug-run',
  sourceCard: 'The Fool',
  sourceSlotIndex: 0,
  triggerTags: ['roll', 'numeric'],
  action: 'reroll',
  description: "The Fool's wild energy ripples through fate — the dice must be cast again.",
  expiresAfter: 3,
  turnsRemaining: 3,
};

const criticalFlipEffect: PendingEffect = {
  id: 'debug-critical-flip',
  sourceRunId: 'debug-run',
  sourceCard: 'Critical Roll',
  sourceSlotIndex: 0,
  triggerTags: ['major-arcana', 'reversible'],
  action: 'flip',
  description: 'A dire omen from the dice — the cards tremble and turn.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

const ichingBoostEffect: PendingEffect = {
  id: 'debug-iching-boost',
  sourceRunId: 'debug-run',
  sourceCard: 'Hexagram',
  sourceSlotIndex: 0,
  triggerTags: ['event', 'happening'],
  action: 'add-choice',
  description: 'The changing lines reveal hidden branches — more choices emerge.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

const mirrorEffect: PendingEffect = {
  id: 'debug-mirror',
  sourceRunId: 'debug-run',
  sourceCard: 'Mirrored Card',
  sourceSlotIndex: 0,
  triggerTags: ['reversible'],
  action: 'mirror',
  description: 'Two forces reflect each other across the weave — both turn.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

const chaosSurgeEffect: PendingEffect = {
  id: 'debug-chaos-surge',
  sourceRunId: 'debug-run',
  sourceCard: 'Chaos',
  sourceSlotIndex: 0,
  triggerTags: [], // always triggers on any result
  action: 'second-result',
  description: 'Chaos surges — a second possibility emerges from the void.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'fools-reroll',
    label: "Fool's Reroll",
    apply: (state) => {
      const card = MAJOR_ARCANA.find((c) => c.id === 'the-fool')!;
      state.turnResults = [{
        type: 'tarot',
        id: card.id,
        name: card.name,
        number: card.number,
        orientation: 'upright',
        symbol: card.symbol,
        meaningUpright: card.meaningUpright,
        meaningReversed: card.meaningReversed,
        tags: ['draw', 'random', 'major-arcana', 'reversible', card.archetypeTag, 'upright'],
        themes: ['renewal', 'mystery'],
        dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
        modifierRoles: ['subject'],
      } as SlotResult];
      state.minigamesCompleted = 1;
      state.pendingEffects = [foolsRerollEffect];
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
    },
  },
  {
    id: 'critical-low-flip',
    label: 'Critical Flip',
    apply: (state) => {
      state.pendingEffects = [criticalFlipEffect];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'iching-boost',
    label: 'I Ching Boost',
    apply: (state) => {
      state.pendingEffects = [ichingBoostEffect];
      state.selectedMethod = 'iching';
      state.screen = 'minigame';
    },
  },
  {
    id: 'mirror-event',
    label: 'Mirror Event',
    apply: (state) => {
      state.pendingEffects = [mirrorEffect];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'chaos-surge',
    label: 'Chaos Surge',
    apply: (state) => {
      state.pendingEffects = [chaosSurgeEffect];
      state.affinities.chaos = 0.8;
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
    },
  },
];

export function loadScenario(presetId: string, state: GameState): boolean {
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  preset.apply(state);
  return true;
}
