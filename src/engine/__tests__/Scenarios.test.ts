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
    const ok = engine.loadScenarioById('chaos-wild-surge');
    expect(ok).toBe(true);
    // chaos-wild-surge sets Chaos to Dominant (>= 82); it must NOT be clobbered by notify()
    expect(snapshot.affinities.chaos).toBeGreaterThanOrEqual(82);
    unsub();
  });

  it('event-resolved scenarios set debugForcedEffect', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('chaos-wild-surge');
    expect(engine.getState().debugForcedEffect).toBe('wild-surge');
  });
});

describe('Phase 2/3 scenarios', () => {
  it('includes Fate/Will and Light/Shadow groups', () => {
    const engine = new GameEngine();
    const groups = new Set(engine.getScenarioPresets().map((p) => p.group));
    expect(groups.has('Fate / Will')).toBe(true);
    expect(groups.has('Light / Shadow')).toBe(true);
  });

  it('card-swap scenario sets Fate Ascendant and forces the effect', () => {
    const engine = new GameEngine();
    const ok = engine.loadScenarioById('fate-card-swap');
    expect(ok).toBe(true);
    expect(engine.getState().affinities.fate).toBeGreaterThanOrEqual(60);
    expect(engine.getState().debugForcedEffect).toBe('card-swap');
  });

  it('peek-failure scenario sets Light Ascendant', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('light-peek-failure');
    expect(engine.getState().affinities.light).toBeGreaterThanOrEqual(60);
  });

  it('every Phase 2/3 preset loads without error', () => {
    const engine = new GameEngine();
    const ids = engine.getScenarioPresets()
      .filter((p) => p.group === 'Fate / Will' || p.group === 'Light / Shadow')
      .map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) expect(engine.loadScenarioById(id)).toBe(true);
  });
});
