import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);
function noJitter<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = () => 0.5;
  try { return fn(); } finally { Math.random = orig; }
}

describe('AffinityEngine.applyAction', () => {
  it('reveal-as-drawn feeds Fate', () => {
    const e = make();
    noJitter(() => e.applyAction('reveal-as-drawn'));
    expect(e.getState().fate).toBeGreaterThan(50);
    expect(e.getState().will).toBeLessThan(50); // opposite taxed by coupling
  });

  it('take-reroll feeds Will', () => {
    const e = make();
    noJitter(() => e.applyAction('take-reroll'));
    expect(e.getState().will).toBeGreaterThan(50);
  });

  it('reverse feeds Will AND Chaos (secondary)', () => {
    const e = make();
    noJitter(() => e.applyAction('reverse'));
    const s = e.getState();
    expect(s.will).toBeGreaterThan(50);
    expect(s.chaos).toBeGreaterThan(s.order); // chaos fed, order not
  });

  it('take-reroll also feeds Chaos as a secondary (courting a swing)', () => {
    const e = make();
    noJitter(() => e.applyAction('take-reroll'));
    expect(e.getState().chaos).toBeGreaterThan(50);
  });

  it('use-peek feeds Light, decline-peek feeds Shadow', () => {
    const a = make(); noJitter(() => a.applyAction('use-peek'));
    expect(a.getState().light).toBeGreaterThan(50);
    const b = make(); noJitter(() => b.applyAction('decline-peek'));
    expect(b.getState().shadow).toBeGreaterThan(50);
  });
});
