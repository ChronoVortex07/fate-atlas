import { describe, it, expect } from 'vitest';
import { InteractionResolver } from '../InteractionResolver';
import { TagSystem } from '../TagSystem';
import { EventBus } from '../EventBus';
import { INTERACTION_RULES } from '../../data/interactions';
import type { SlotResult } from '../types';

const foolCard: SlotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'upright', symbol: '☉',
  meaningUpright: '...', meaningReversed: '...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'upright'],
};

const diceRoll: SlotResult = {
  type: 'd20', result: 3, threshold: 'critical-low',
  interpretation: '...',
  tags: ['roll', 'random', 'numeric', 'threshold', 'low', 'critical-low', 'pending'],
};

const ichingHex: SlotResult = {
  type: 'iching', hexagramNumber: 27, name: 'Nourishment',
  symbol: '䷛', judgment: '...', changingLines: [3, 5],
  tags: ['draw', 'random', 'binary', 'iching', 'reversible', 'changing-lines'],
};

describe('InteractionResolver', () => {
  const tagSystem = new TagSystem();
  const bus = new EventBus();

  it('triggers fool-reroll when Fool is revealed and pending dice exists', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const slots: (SlotResult | null)[] = [foolCard, diceRoll, null];

    const events = resolver.checkAndResolve(slots, 0, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);

    const rerollEvent = events.find((e) => e.ruleId === 'fool-reroll');
    expect(rerollEvent).toBeTruthy();
    expect(rerollEvent!.targetSlotIndex).toBe(1);
  });

  it('triggers critical-low-flip when low dice is revealed and reversible tarot exists', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const slots: (SlotResult | null)[] = [foolCard, diceRoll, null];

    const events = resolver.checkAndResolve(slots, 1, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);

    const flipEvent = events.find((e) => e.ruleId === 'critical-low-flip');
    expect(flipEvent).toBeTruthy();
    expect(flipEvent!.targetSlotIndex).toBe(0);
  });

  it('triggers iching-happening-boost when iching with changing lines is revealed', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const happeningSlot: SlotResult = {
      type: 'happening', id: 'crossroads', scene: '...', choices: [],
      tags: ['event', 'happening', 'choice', 'affinity-shift', 'pending'],
    };
    const slots: (SlotResult | null)[] = [ichingHex, happeningSlot, null];

    const events = resolver.checkAndResolve(slots, 0, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);

    const boostEvent = events.find((e) => e.ruleId === 'iching-happening-boost');
    expect(boostEvent).toBeTruthy();
  });

  it('does not trigger interactions when no rules match', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const noMatch: SlotResult = {
      type: 'tarot', id: 'the-star', name: 'The Star', number: 17,
      orientation: 'upright', symbol: '⭐',
      meaningUpright: 'Hope...', meaningReversed: 'Despair...',
      tags: ['draw', 'random', 'major-arcana', 'reversible', 'star-archetype'],
    };
    const slots: (SlotResult | null)[] = [noMatch, null, null];

    const events = resolver.checkAndResolve(slots, 0, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);
    expect(events).toHaveLength(0);
  });
});
