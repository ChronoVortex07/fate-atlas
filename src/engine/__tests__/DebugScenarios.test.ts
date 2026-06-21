import { describe, it, expect } from 'vitest';
import { DEBUG_SCENARIOS, findScenario } from '../events/scenarios';
import { defaultAffinityState } from '../../data/affinities';

describe('debug scenarios', () => {
  it('each scenario has a forced set and isolate flag', () => {
    expect(DEBUG_SCENARIOS.length).toBeGreaterThan(0);
    for (const s of DEBUG_SCENARIOS) {
      expect(Array.isArray(s.forced)).toBe(true);
      expect(typeof s.isolate).toBe('boolean');
    }
  });

  it('shadow-shroud scenario stages a fresh game and forces only its effect', () => {
    const s = findScenario('shadow-shroud')!;
    expect(s.forced).toEqual(['shadow-shroud']);
    expect(s.isolate).toBe(true);
    const stage = { affinities: defaultAffinityState(), screen: 'title', selectedMethod: null, slots: [] };
    s.setup(stage as any);
    expect(stage.screen).toBe('method-select');
  });

  it('supports a combination scenario forcing two effects', () => {
    const s = findScenario('combo-widen-shroud')!;
    expect(s.forced).toEqual(['will-widen-pool', 'shadow-shroud']);
    expect(s.isolate).toBe(true);
  });
});
