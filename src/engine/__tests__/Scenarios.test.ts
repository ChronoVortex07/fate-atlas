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
