import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';

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
    engine.selectMethod(0);
    const state = engine.getState();
    // If happening was selected, may go to happening instead
    expect(['minigame', 'happening']).toContain(state.screen);
  });

  it('selectMethod with out-of-bounds index throws', () => {
    engine.startTurn('self');
    expect(() => engine.selectMethod(99)).toThrow('out of bounds');
  });

  it('selectMethod with happening type always triggers happening', () => {
    engine.startTurn('self');
    // Find happening index if any
    const methods = engine.getState().availableMethods;
    const happeningIdx = methods.indexOf('happening');
    if (happeningIdx !== -1) {
      engine.selectMethod(happeningIdx);
      expect(engine.getState().screen).toBe('happening');
    }
  });

  it('completeMinigame sets turnResult, checks pending effects, synthesizes', () => {
    engine.startTurn('self');
    // Find a non-happening method
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return; // all happenings, skip

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return; // happening override

    const tarotResult = {
      type: 'tarot' as const,
      id: 'the-star',
      name: 'The Star',
      number: 17,
      orientation: 'upright' as const,
      symbol: '*',
      meaningUpright: 'Hope',
      meaningReversed: 'Despair',
      tags: ['major-arcana', 'reversible', 'star-archetype'],
    };

    engine.completeMinigame(tarotResult);
    const state = engine.getState();
    expect(state.turnResult).toBeTruthy();
    expect(state.synthesis).toBeTruthy();
    // activeInteraction may be null if no pending effects matched
  });

  it('clearActiveInteraction clears interaction and goes to result', () => {
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

    engine.clearActiveInteraction();
    expect(engine.getState().screen).toBe('result');
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
    engine.clearActiveInteraction();

    const beforeAffinities = { ...engine.getState().affinities };
    const beforeHistory = [...engine.getState().history];

    engine.returnToQuestionSelect();
    const state = engine.getState();
    expect(state.screen).toBe('question');
    expect(state.turnResult).toBeNull();
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
    expect(state.activeInteraction).toBeTruthy();
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
});
