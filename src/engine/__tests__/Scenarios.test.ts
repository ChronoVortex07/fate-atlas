import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('debug scenarios', () => {
  it('exposes a group for every preset', () => {
    const engine = new GameEngine();
    const presets = engine.getScenarioPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) expect(typeof p.group).toBe('string');
  });

  it('scenario affinity setup routes through the engine and survives notify()', () => {
    const engine = new GameEngine();
    let snapshot = engine.getState();
    const unsub = engine.subscribe((s) => { snapshot = s; });
    const ok = engine.loadScenarioById('chaos-second-result');
    expect(ok).toBe(true);
    // chaos-second-result sets Chaos high (90); it must NOT be clobbered by notify()
    expect(snapshot.affinities.chaos).toBeGreaterThanOrEqual(82);
    unsub();
  });

  it('scenarios set the forced debug config', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('shadow-shroud');
    expect(engine.getState().debugConfig.forced).toEqual(['shadow-shroud']);
    expect(engine.getState().debugConfig.isolate).toBe(true);
  });

  it('includes Affinity, Interaction and Combination groups', () => {
    const engine = new GameEngine();
    const groups = new Set(engine.getScenarioPresets().map((p) => p.group));
    expect(groups.has('Affinity')).toBe(true);
    expect(groups.has('Interaction')).toBe(true);
    expect(groups.has('Combination')).toBe(true);
  });

  it('fate-deal-swap scenario sets Fate Ascendant and forces the effect', () => {
    const engine = new GameEngine();
    const ok = engine.loadScenarioById('fate-deal-swap');
    expect(ok).toBe(true);
    expect(engine.getState().affinities.fate).toBeGreaterThanOrEqual(60);
    expect(engine.getState().debugConfig.forced).toEqual(['fate-deal-swap']);
  });

  it('every preset loads without error', () => {
    const engine = new GameEngine();
    const ids = engine.getScenarioPresets().map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(engine.loadScenarioById(id)).toBe(true);
  });

  it('a method-select scenario populates a non-empty method pool', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('will-widen-pool');
    const s = engine.getState();
    expect(s.screen).toBe('method-select');
    expect(s.availableMethods.length).toBeGreaterThan(0);
  });

  it('the combination scenario forces two effects', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('combo-widen-shroud');
    expect(engine.getState().debugConfig.forced).toEqual(['will-widen-pool', 'shadow-shroud']);
  });

  it('returns false for an unknown id', () => {
    const engine = new GameEngine();
    expect(engine.loadScenarioById('will-keep-one-of-two')).toBe(false);
    expect(engine.loadScenarioById('nonexistent')).toBe(false);
  });
});
