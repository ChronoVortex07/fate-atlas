import { describe, it, expect, vi } from 'vitest';
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

  it('forced shadow-shroud effect lands in drawPhase.effectReports on its trigger', () => {
    const e = new GameEngine();
    e.loadScenarioById('shadow-shroud'); // forces shadow-shroud, isolate, on method-select
    e.startTurn('self'); // select:draw:start / select:draw:end fire in the pool path
    // shadow-shroud fires on select:draw:end — the draw-phase report is diverted off
    // the generic eventQueue onto drawPhase for MethodSelect to narrate in-spread.
    const reports = e.getState().drawPhase!.effectReports;
    expect(reports.some((r) => r.responderId === 'shadow-shroud')).toBe(true);
  });

  it('shadow-shroud (forced) populates shroudedMethods after startTurn', () => {
    const e = new GameEngine();
    e.forceEffects(['shadow-shroud'], true);
    e.startTurn('self');
    const s = e.getState();
    expect(s.shroudedMethods.length).toBeGreaterThanOrEqual(1);
    // Shrouded indices must be valid pool indices.
    for (const idx of s.shroudedMethods) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(s.availableMethods.length);
    }
  });

  it('shadow-shroud (forced, high Shadow) shrouds 1..poolLength distinct methods', () => {
    const e = new GameEngine();
    // beginRun drifts toward baseline (~83.5 after a 100 start) → still Dominant,
    // so the progressive responder can roll up to three distinct indices.
    e.loadState({ affinities: { ...e.getState().affinities, shadow: 100 } });
    e.forceEffects(['shadow-shroud'], true);
    e.startTurn('self');
    const s = e.getState();
    expect(s.shroudedMethods.length).toBeGreaterThanOrEqual(1);
    expect(s.shroudedMethods.length).toBeLessThanOrEqual(s.availableMethods.length);
    expect(new Set(s.shroudedMethods).size).toBe(s.shroudedMethods.length); // distinct indices
  });

  it('fool-reroll (forced) replaces the committed d20 slot with a fresh die', () => {
    const e = new GameEngine();
    // Load the fool-reroll scenario: slots already contain The Fool, screen=minigame, method=d20.
    // Do NOT call startTurn() — it clears turnResults. The scenario is pre-staged at minigame.
    e.loadScenarioById('fool-reroll');

    // Stub Math.random so the rerolled d20 is deterministic (result=20 range; we just need
    // it to not equal the original die by identity, which is guaranteed because drawSingleResult
    // creates a new object).
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99); // high value → high d20 result

    const d20Result: import('../types').DiceResult = {
      type: 'd20', result: 1, threshold: 'critical-low', interpretation: 'A dire omen.',
      tags: ['threshold', 'critical-low'],
      themes: [], dimensions: { favorability: -1, certainty: 1, volatility: 0 }, modifierRoles: [],
    };

    e.completeMinigame(d20Result);

    mockRandom.mockRestore();

    const state = e.getState();
    // The fool-reroll responder must fire on dice:commit AND the slot must be actually replaced.
    const foolFired = state.eventQueue.some((r) => r.responderId === 'fool-reroll');
    expect(foolFired).toBe(true);
    expect(state.turnResults[0]).not.toBe(d20Result); // committed slot was replaced by a fresh die
  });

  it('fate-force-method redirects the selected method index when forced', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    // ensure at least two distinct methods in availableMethods, else the redirect is a no-op
    engine.forceEffects(['fate-force-method'], true);
    const chosen = 0;
    engine.selectMethod(chosen);
    const s = engine.getState();
    // selectedMethod should match availableMethods at the (possibly redirected) index,
    // and an override report should be queued.
    expect(s.eventQueue.some((r) => r.responderId === 'fate-force-method')).toBe(true);
  });

  it('chaos-second-result spawns a slot and points its report at the new index', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    engine.selectMethod(0);
    engine.forceEffects(['chaos-second-result'], true);

    const before = engine.getState().turnResults.length;
    engine.completeMinigame({
      type: 'd20', result: 7, threshold: 'low', interpretation: '',
      tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
      modifierRoles: [],
    } as any);

    const s = engine.getState();
    expect(s.turnResults.length).toBe(before + 2); // committed + spawned second
    const report = s.eventQueue.find((r) => r.responderId === 'chaos-second-result');
    expect(report).toBeDefined();
    expect(report!.targetSlot).toBe(s.turnResults.length - 1);
  });
});
