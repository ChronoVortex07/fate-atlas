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
    engine.selectMethod(0);
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
    engine.selectMethod(0);
    expect(engine.getState().screen).toBe('minigame');
    expect(engine.getState().selectedMethod).toBe(methods[0]);
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
      // If interaction fired, dismiss it
      if (engine.getState().activeInteraction) {
        engine.clearActiveInteraction();
      }
    }

    const state = engine.getState();
    expect(state.turnResults.length).toBe(3);
    expect(state.synthesis).toBeTruthy();
    expect(state.screen).toBe('result');
  });

  it('clearActiveInteraction between minigames returns to method-select', () => {
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

    // After 1 of 3 minigames with an interaction, clearing should go to method-select
    if (engine.getState().activeInteraction) {
      engine.clearActiveInteraction();
      expect(engine.getState().screen).toBe('method-select');
    }
    // If no interaction fired, screen is already method-select (set by completeMinigame)
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
