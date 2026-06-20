import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { SlotResult } from '../types';

describe('GameEngine — new lifecycle', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('starts in title screen', () => {
    expect(engine.getState().screen).toBe('title');
  });

  it('startTurn generates availableMethods and goes to method-select', () => {
    engine.startTurn('self');
    const state = engine.getState();
    expect(state.screen).toBe('method-select');
    expect(state.availableMethods).toHaveLength(3);
    expect(state.questionType).toBe('self');
  });

  it('selectMethod with valid index goes to minigame screen', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return; // all happenings, skip
    engine.selectMethod(idx);
    const state = engine.getState();
    expect(state.screen).toBe('minigame');
  });

  it('selectMethod with out-of-bounds index throws', () => {
    engine.startTurn('self');
    expect(() => engine.selectMethod(99)).toThrow('out of bounds');
  });

  it('selectMethod picks the method and goes to minigame', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    expect(methods.length).toBeGreaterThan(0);
    // Pick a non-happening method — happenings go to their own scene
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return; // all happenings, nothing to test
    engine.selectMethod(idx);
    expect(engine.getState().screen).toBe('minigame');
    expect(engine.getState().selectedMethod).toBe(methods[idx]);
  });

  it('synthesizes after 3 complete minigames and goes to result', () => {
    engine.startTurn('self');

    const makeResult = (): SlotResult => ({
      type: 'd20',
      result: 10,
      threshold: 'neutral',
      interpretation: 'Steady',
      tags: ['roll', 'numeric'],
    });

    // Complete 3 minigames
    for (let i = 0; i < 3; i++) {
      const methods = engine.getState().availableMethods;
      const idx = methods.findIndex((m) => m !== 'happening');
      if (idx === -1) return;
      engine.selectMethod(idx);
      if (engine.getState().screen !== 'minigame') {
        // Might have triggered a happening — resolve it to continue
        if (engine.getState().screen === 'happening') {
          engine.resolveHappening(0);
          methods.length = 0; // force re-read
          const m2 = engine.getState().availableMethods;
          const ix2 = m2.findIndex((m) => m !== 'happening');
          if (ix2 === -1) return;
          engine.selectMethod(ix2);
        }
      }
      engine.completeMinigame(makeResult());
      // If interaction fired, drain the queue
      while (engine.getState().interactionQueue.length > 0) {
        engine.advanceInteractionQueue();
      }
    }

    const state = engine.getState();
    expect(state.turnResults.length).toBe(3);
    expect(state.synthesis).toBeTruthy();
    expect(state.screen).toBe('result');
  });

  it('advanceInteractionQueue between minigames returns to method-select', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 10,
      threshold: 'neutral',
      interpretation: 'Steady',
      tags: ['roll', 'numeric'],
    });

    // After 1 of 3 minigames with an interaction, advancing should go to method-select
    if (engine.getState().interactionQueue.length > 0) {
      engine.advanceInteractionQueue();
      expect(engine.getState().screen).toBe('method-select');
    }
  });

  it('returnToQuestionSelect resets turn state, preserves history and affinities', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 10,
      threshold: 'neutral',
      interpretation: 'Steady',
      tags: ['roll', 'numeric'],
    });
    while (engine.getState().interactionQueue.length > 0) {
      engine.advanceInteractionQueue();
    }

    const beforeAffinities = { ...engine.getState().affinities };
    const beforeHistory = [...engine.getState().history];

    engine.returnToQuestionSelect();
    const state = engine.getState();
    expect(state.screen).toBe('question');
    expect(state.turnResults).toEqual([]);
    expect(state.synthesis).toBeNull();
    expect(state.affinities).toEqual(beforeAffinities);
    expect(state.history).toEqual(beforeHistory);
  });

  it('resolveHappening fails with invalid index', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    const happeningIdx = methods.indexOf('happening');
    if (happeningIdx === -1) return;

    engine.selectMethod(happeningIdx);
    if (engine.getState().screen !== 'happening') return;

    expect(() => engine.resolveHappening(99)).toThrow('Choice 99 not found');
    expect(engine.getState().screen).toBe('happening');
  });

  it('resolveHappening throws when no happening active', () => {
    expect(() => engine.resolveHappening(0)).toThrow('No happening active');
  });

  it('pending effects are checked on completeMinigame', () => {
    engine.startTurn('self');

    // Inject a pending effect that matches d20
    engine.injectPendingEffect({
      id: 'test-effect',
      sourceRunId: 'test-run',
      sourceCard: 'Test Card',
      sourceSlotIndex: 0,
      triggerTags: ['roll'],
      action: 'reroll',
      description: 'Test reroll',
      expiresAfter: 3,
      turnsRemaining: 3,
    });

    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 5,
      threshold: 'low',
      interpretation: 'Low roll',
      tags: ['roll', 'numeric', 'low'],
    });

    const state = engine.getState();
    // The pending effect should have matched
    expect(state.interactionQueue.length).toBeGreaterThan(0);
    // Pending effects list should be empty (the injected one was consumed)
    expect(state.pendingEffects).toHaveLength(0);
  });

  it('pending effects expire after turnsRemaining reaches zero', () => {
    engine.startTurn('self');

    engine.injectPendingEffect({
      id: 'expiring-effect',
      sourceRunId: 'test-run',
      sourceCard: 'Test',
      sourceSlotIndex: 0,
      triggerTags: ['roll'],
      action: 'reroll',
      description: 'Should expire',
      expiresAfter: 1,
      turnsRemaining: 1,
    });

    // Start another turn — effect should decrement and expire
    engine.returnToQuestionSelect();
    engine.startTurn('self');

    expect(engine.getState().pendingEffects).toHaveLength(0);
  });

  it('loadScenario loads a preset into state', () => {
    engine.startTurn('self');
    const ok = engine.loadScenarioById('fools-reroll');
    expect(ok).toBe(true);
    const state = engine.getState();
    expect(state.pendingEffects.length).toBeGreaterThan(0);
    expect(state.screen).toBe('minigame');
  });

  it('loadScenario returns false for unknown preset', () => {
    const ok = engine.loadScenarioById('nonexistent');
    expect(ok).toBe(false);
  });

  it('executeEffect reroll replaces dice result', () => {
    engine.startTurn('self');

    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 5,
      threshold: 'low',
      interpretation: 'Low roll',
      tags: ['roll', 'numeric'],
    });

    // Inject a reroll interaction and advance
    engine.loadState({
      interactionQueue: [
        {
          ruleId: 'test-reroll',
          sourceSlotIndex: 0,
          targetSlotIndex: 0,
          effect: 'reroll',
          description: 'Test reroll',
        },
      ],
    });

    const beforeResult = engine.getState().turnResults[0];
    expect(beforeResult.type).toBe('d20');

    engine.advanceInteractionQueue();

    const afterResult = engine.getState().turnResults[0];
    // The dice was rerolled — result may differ (though could be same by chance,
    // verify type and that a reroll happened by checking interactionQueue drained)
    expect(afterResult.type).toBe('d20');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });

  it('executeEffect flip toggles tarot orientation', () => {
    engine.startTurn('self');
    // Replace turnResults[0] with a tarot result
    engine.loadState({
      turnResults: [
        {
          type: 'tarot',
          id: 'fool',
          name: 'The Fool',
          number: 0,
          orientation: 'upright',
          symbol: '♆',
          meaningUpright: 'New beginnings',
          meaningReversed: 'Recklessness',
          tags: ['major-arcana', 'fool-archetype'],
        },
      ],
      interactionQueue: [
        {
          ruleId: 'test-flip',
          sourceSlotIndex: 0,
          targetSlotIndex: 0,
          effect: 'flip',
          description: 'Test flip',
        },
      ],
      minigamesCompleted: 1,
    });

    engine.advanceInteractionQueue();

    const result = engine.getState().turnResults[0];
    expect(result.type).toBe('tarot');
    expect((result as { orientation: string }).orientation).toBe('reversed');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });

  it('advanceInteractionQueue drains queue and transitions to method-select when more minigames remain', () => {
    engine.startTurn('self');

    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 10,
      threshold: 'neutral',
      interpretation: 'Steady',
      tags: ['roll', 'numeric'],
    });

    // completeMinigame with queue sets screen to minigame (frozen)
    const qLen = engine.getState().interactionQueue.length;
    if (qLen > 0) {
      expect(engine.getState().screen).toBe('minigame');

      engine.advanceInteractionQueue();
      expect(engine.getState().interactionQueue).toHaveLength(qLen - 1);

      // If more in queue, screen stays frozen
      if (engine.getState().interactionQueue.length > 0) {
        expect(engine.getState().screen).toBe('minigame');
      } else {
        // Queue empty — should transition
        expect(engine.getState().screen).toBe('method-select');
      }
    }
  });

  it('interactionQueue resets on startTurn', () => {
    engine.startTurn('self');
    engine.loadState({
      interactionQueue: [
        {
          ruleId: 'test',
          sourceSlotIndex: 0,
          targetSlotIndex: 0,
          effect: 'reroll',
          description: 'Test',
        },
      ],
    });
    expect(engine.getState().interactionQueue.length).toBe(1);

    engine.returnToQuestionSelect();
    engine.startTurn('self');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });

  it('executeEffect mirror toggles both source and target tarot orientations', () => {
    engine.startTurn('self');
    engine.loadState({
      turnResults: [
        {
          type: 'tarot', id: 'fool', name: 'The Fool', number: 0,
          orientation: 'upright', symbol: '♆',
          meaningUpright: 'New beginnings', meaningReversed: 'Recklessness',
          tags: ['major-arcana', 'fool-archetype'],
        },
        {
          type: 'tarot', id: 'magician', name: 'The Magician', number: 1,
          orientation: 'reversed', symbol: '☿',
          meaningUpright: 'Willpower', meaningReversed: 'Manipulation',
          tags: ['major-arcana'],
        },
      ],
      interactionQueue: [
        {
          ruleId: 'test-mirror', sourceSlotIndex: 0, targetSlotIndex: 1,
          effect: 'mirror', description: 'Test mirror',
        },
      ],
      minigamesCompleted: 2,
    });

    engine.advanceInteractionQueue();

    const r0 = engine.getState().turnResults[0] as { orientation: string };
    const r1 = engine.getState().turnResults[1] as { orientation: string };
    expect(r0.orientation).toBe('reversed');  // was upright, now reversed
    expect(r1.orientation).toBe('upright');   // was reversed, now upright
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });

  it('executeEffect add-choice adds bonus choice to happening', () => {
    engine.startTurn('self');
    engine.loadState({
      happening: {
        type: 'happening', id: 'test-happening',
        scene: 'A test scene',
        choices: [
          { text: 'Original choice', affinityChanges: {} },
        ],
        tags: [],
      },
      turnResults: [
        { type: 'd20', result: 10, threshold: 'neutral', interpretation: 'Steady', tags: ['roll'] },
      ],
      interactionQueue: [
        {
          ruleId: 'test-add-choice', sourceSlotIndex: 0, targetSlotIndex: 0,
          effect: 'add-choice', description: 'Test add-choice',
        },
      ],
      minigamesCompleted: 1,
    });

    const choicesBefore = engine.getState().happening!.choices.length;
    engine.advanceInteractionQueue();
    const choicesAfter = engine.getState().happening!.choices.length;

    expect(choicesAfter).toBe(choicesBefore + 1);
    expect(engine.getState().happening!.choices[choicesAfter - 1].text)
      .toContain('hidden path');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });

  it('executeEffect second-result appends new result to turnResults', () => {
    engine.startTurn('self');
    engine.loadState({
      turnResults: [
        { type: 'd20', result: 15, threshold: 'high', interpretation: 'High roll', tags: ['roll', 'high'] },
      ],
      interactionQueue: [
        {
          ruleId: 'test-second-result', sourceSlotIndex: 0, targetSlotIndex: 0,
          effect: 'second-result', description: 'Test second-result',
        },
      ],
      minigamesCompleted: 1,
    });

    const resultsBefore = engine.getState().turnResults.length;
    engine.advanceInteractionQueue();
    const resultsAfter = engine.getState().turnResults.length;

    expect(resultsAfter).toBe(resultsBefore + 1);
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });

  it('completeMinigame sets activeSlotIndex to the committed slot index', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20', result: 10, threshold: 'neutral',
      interpretation: 'Steady', tags: ['roll', 'numeric'],
    });

    const state = engine.getState();
    expect(state.activeSlotIndex).toBe(state.turnResults.length - 1);
  });

  it('startTurn resets activeSlotIndex to null', () => {
    engine.startTurn('self');
    engine.loadState({ activeSlotIndex: 2 });
    expect(engine.getState().activeSlotIndex).toBe(2);
    engine.startTurn('self');
    expect(engine.getState().activeSlotIndex).toBeNull();
  });

  it('activeSlotIndex and targetSlotIndex use the real appended index after a prior append', () => {
    engine.startTurn('self');
    // Simulate a turn where a second-result already appended an extra slot:
    // turnResults has 2 entries but only 1 counted minigame.
    engine.loadState({
      turnResults: [
        { type: 'd20', result: 10, threshold: 'neutral', interpretation: 'x', tags: ['roll', 'numeric'] },
        { type: 'd20', result: 11, threshold: 'neutral', interpretation: 'x', tags: ['roll', 'numeric'] },
      ],
      minigamesCompleted: 1,
      pendingEffects: [{
        id: 'pe', sourceRunId: 'r', sourceCard: 'c', sourceSlotIndex: 0,
        triggerTags: ['roll', 'numeric'], action: 'reroll', description: 'd',
        expiresAfter: 3, turnsRemaining: 3,
      }],
    });

    engine.completeMinigame({
      type: 'd20', result: 7, threshold: 'low', interpretation: 'x', tags: ['roll', 'numeric'],
    });

    const state = engine.getState();
    expect(state.activeSlotIndex).toBe(2); // new slot is at index 2, not completed-1 (=1)
    const ev = state.interactions[state.interactions.length - 1];
    expect(ev.targetSlotIndex).toBe(2);
  });
});
