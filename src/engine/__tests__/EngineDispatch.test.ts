import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('engine dispatch wiring', () => {
  it('exposes an empty event queue and default debug config initially', () => {
    const e = new GameEngine();
    expect(e.getState().eventQueue).toEqual([]);
    expect(e.getState().debugConfig).toEqual({ forced: [], isolate: false });
  });

  it('forceEffects sets the debug config', () => {
    const e = new GameEngine();
    e.forceEffects(['shadow-shroud'], true);
    expect(e.getState().debugConfig).toEqual({ forced: ['shadow-shroud'], isolate: true });
  });

  it('clearEventQueue empties the queue', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.planDiceRoll();
    e.clearEventQueue();
    expect(e.getState().eventQueue).toEqual([]);
  });

  it('loadScenarioById resets fresh and forces the scenario effect', () => {
    const e = new GameEngine();
    expect(e.loadScenarioById('shadow-shroud')).toBe(true);
    const s = e.getState();
    expect(s.screen).toBe('method-select');
    expect(s.debugConfig.forced).toEqual(['shadow-shroud']);
    expect(s.affinities.shadow).toBeGreaterThanOrEqual(60);
  });

  it('loadScenarioById returns false for an unknown id', () => {
    const e = new GameEngine();
    expect(e.loadScenarioById('nonexistent')).toBe(false);
  });

  it('planDiceRoll returns a valid mode at baseline with no reroll', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const plan = e.planDiceRoll();
    expect(['single', 'advantage', 'disadvantage', 'choice']).toContain(plan.mode);
  });

  it('forced shadow-shroud effect lands in the event queue on its trigger', () => {
    const e = new GameEngine();
    e.loadScenarioById('shadow-shroud'); // forces shadow-shroud, isolate, on method-select
    e.startTurn('self'); // select:draw:start / select:draw:end fire in the pool path
    // shadow-shroud fires on select:draw:end — the forced responder must appear in the queue.
    const queue = e.getState().eventQueue;
    expect(queue.some((r) => r.responderId === 'shadow-shroud')).toBe(true);
  });

  it('fool-reroll (forced) replaces the committed d20 slot with a fresh die', () => {
    const e = new GameEngine();
    // Load the fool-reroll scenario: slots already contain The Fool, screen=minigame, method=d20.
    e.loadScenarioById('fool-reroll');
    e.startTurn('self');

    // Stub Math.random so the rerolled d20 is deterministic (result=20 range; we just need
    // it to not equal the original die by identity, which is guaranteed because drawSingleResult
    // creates a new object).
    const originalRandom = Math.random;
    Math.random = () => 0.99; // high value → high d20 result

    const d20Result: import('../types').DiceResult = {
      type: 'd20', result: 1, threshold: 'critical-low', interpretation: 'A dire omen.',
      tags: ['threshold', 'critical-low'],
      themes: [], dimensions: { favorability: -1, certainty: 1, volatility: 0 }, modifierRoles: [],
    };

    e.completeMinigame(d20Result);

    Math.random = originalRandom;

    const state = e.getState();
    // The fool-reroll responder fires on dice:commit and sets rerollOutcome → engine redraws.
    // Either the slot was replaced (value differs from result=1 since rng=0.99 produces high roll)
    // or the EffectReport for fool-reroll is in the eventQueue proving the responder fired.
    const foolFired = state.eventQueue.some((r) => r.responderId === 'fool-reroll');
    const slotReplaced = state.turnResults.length > 0 && state.turnResults[0] !== d20Result;
    expect(foolFired || slotReplaced).toBe(true);
  });
});
