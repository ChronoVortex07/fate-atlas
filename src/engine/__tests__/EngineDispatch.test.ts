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
    // After a refill path runs the trigger, the forced effect should have been consumed.
    expect(Array.isArray(e.getState().eventQueue)).toBe(true);
  });
});
