import { describe, it, expect } from 'vitest';
import { InteractionResolver } from '../InteractionResolver';
import { TagSystem } from '../TagSystem';
import { EventBus } from '../EventBus';
import { INTERACTION_RULES } from '../../data/interactions';
import type { PendingEffect, SlotResult, InteractionRule } from '../types';

function makeResolver() {
  return new InteractionResolver(new TagSystem(), new EventBus());
}

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

describe('InteractionResolver — pending effects', () => {
  const tarotResult: SlotResult = {
    type: 'tarot',
    id: 'the-fool',
    name: 'The Fool',
    number: 0,
    orientation: 'upright',
    symbol: 'X',
    meaningUpright: 'New beginnings',
    meaningReversed: 'Recklessness',
    tags: ['major-arcana', 'fool-archetype', 'reversible'],
  };

  const diceResult: SlotResult = {
    type: 'd20',
    result: 3,
    threshold: 'critical-low',
    interpretation: 'Dire outcome',
    tags: ['roll', 'numeric', 'threshold', 'critical-low'],
  };

  it('checkPendingEffects: matches tags and returns matched + remaining', () => {
    const resolver = makeResolver();
    const pending: PendingEffect[] = [
      {
        id: 'eff-1',
        sourceRunId: 'run-1',
        sourceCard: 'The Fool',
        sourceSlotIndex: 0,
        triggerTags: ['roll', 'numeric'],
        action: 'reroll',
        description: "The Fool's Reroll",
        expiresAfter: 3,
        turnsRemaining: 2,
      },
      {
        id: 'eff-2',
        sourceRunId: 'run-1',
        sourceCard: 'The Hermit',
        sourceSlotIndex: 0,
        triggerTags: ['iching', 'changing-lines'],
        action: 'add-choice',
        description: 'I Ching boost',
        expiresAfter: 3,
        turnsRemaining: 2,
      },
    ];

    const { matched, remaining } = resolver.checkPendingEffects(pending, diceResult);

    expect(matched).toHaveLength(1);
    expect(matched[0].id).toBe('eff-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('eff-2');
  });

  it('checkPendingEffects: no match returns empty matched, all remaining', () => {
    const resolver = makeResolver();
    const pending: PendingEffect[] = [
      {
        id: 'eff-1',
        sourceRunId: 'run-1',
        sourceCard: 'The Fool',
        sourceSlotIndex: 0,
        triggerTags: ['iching'],
        action: 'reroll',
        description: 'Test',
        expiresAfter: 3,
        turnsRemaining: 2,
      },
    ];

    const { matched, remaining } = resolver.checkPendingEffects(pending, diceResult);

    expect(matched).toHaveLength(0);
    expect(remaining).toHaveLength(1);
  });

  it('createPendingEffects: creates effects from interaction-eligible result', () => {
    const resolver = makeResolver();
    const rules: InteractionRule[] = [
      {
        id: 'fool-reroll',
        trigger: { on: 'slot-revealed', sourceTags: ['major-arcana', 'fool-archetype'] },
        target: { tags: ['roll', 'pending'], action: 'reroll' },
        display: { flashSource: true, flashTarget: true, description: 'Test reroll' },
      },
    ];

    const effects = resolver.createPendingEffects(tarotResult, 'run-1', rules);

    expect(effects).toHaveLength(1);
    expect(effects[0].action).toBe('reroll');
    expect(effects[0].sourceCard).toBe('The Fool');
    expect(effects[0].triggerTags).toEqual(['roll', 'pending']);
    expect(effects[0].turnsRemaining).toBe(3);
  });

  it('createPendingEffects: result with no matching rules returns empty', () => {
    const resolver = makeResolver();
    const nonTriggering: SlotResult = {
      ...tarotResult,
      tags: ['nothing-relevant'],
    };

    const rules: InteractionRule[] = [
      {
        id: 'fool-reroll',
        trigger: { on: 'slot-revealed', sourceTags: ['major-arcana', 'fool-archetype'] },
        target: { tags: ['roll', 'pending'], action: 'reroll' },
        display: { flashSource: true, flashTarget: true, description: 'Test' },
      },
    ];

    const effects = resolver.createPendingEffects(nonTriggering, 'run-1', rules);
    expect(effects).toHaveLength(0);
  });
});
