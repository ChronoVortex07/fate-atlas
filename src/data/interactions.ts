import type { InteractionRule } from '../engine/types';

export const INTERACTION_RULES: InteractionRule[] = [
  {
    id: 'fool-reroll',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['major-arcana', 'fool-archetype'],
    },
    target: {
      tags: ['roll', 'pending'],
      action: 'reroll',
    },
    modifier: {
      tags: ['reversed', 'upright'],
      evaluate: 'contextual',
    },
    display: {
      flashSource: true,
      flashTarget: true,
      description: "The Fool's wild energy ripples through fate — the dice must be cast again.",
    },
  },
  {
    id: 'critical-low-flip',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['critical-low', 'threshold'],
    },
    target: {
      tags: ['major-arcana', 'reversible'],
      action: 'flip',
    },
    display: {
      flashSource: true,
      flashTarget: true,
      description: 'A dire omen from the dice — the cards tremble and turn.',
    },
  },
  {
    id: 'iching-happening-boost',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['iching', 'changing-lines'],
    },
    target: {
      tags: ['event', 'happening'],
      action: 'add-choice',
    },
    display: {
      flashSource: true,
      flashTarget: false,
      description: 'The changing lines reveal hidden branches — more choices emerge.',
    },
  },
  {
    id: 'mirror-event',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['reversible'],
    },
    target: {
      tags: ['reversible'],
      action: 'mirror',
    },
    display: {
      flashSource: true,
      flashTarget: true,
      description: 'Two forces reflect each other across the weave — both turn.',
    },
  },
  {
    id: 'chaos-second-result',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['chaos-dominant'], // injected by engine when chaos &#x2265; 0.5
    },
    target: {
      tags: ['random'],
      action: 'second-result',
    },
    display: {
      flashSource: false,
      flashTarget: true,
      description: 'Chaos surges — a second possibility emerges from the void.',
    },
  },
];
