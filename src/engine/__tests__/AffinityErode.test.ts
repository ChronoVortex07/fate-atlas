import { describe, it, expect, vi, afterEach } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

afterEach(() => vi.restoreAllMocks());

describe('AffinityEngine.consumeRealizedGains', () => {
  it('accumulates positive realized gains and resets on consume', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter ×1.0, deterministic
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    const g1 = e.shift('order', 10, 'test');
    const g2 = e.shift('order', 10, 'test');
    expect(e.consumeRealizedGains()).toBeCloseTo(g1 + g2, 5);
    expect(e.consumeRealizedGains()).toBe(0); // reset after consume
  });

  it('ignores penalties (negative shifts contribute nothing)', () => {
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.shift('order', -10, 'test');
    expect(e.consumeRealizedGains()).toBe(0);
  });

  it('resets on beginRun', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.shift('order', 10, 'test');
    e.beginRun();
    expect(e.consumeRealizedGains()).toBe(0);
  });
});

describe('AffinityEngine.erode', () => {
  it('subtracts magnitudes directly with no coupling fan-out', () => {
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.setState({ chaos: 90, order: 90 });
    e.erode({ chaos: 10 });
    expect(e.getBase().chaos).toBe(80);
    expect(e.getBase().order).toBe(90); // untouched — no fan-out to the opposite
  });

  it('clamps at zero', () => {
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.setState({ chaos: 5 });
    e.erode({ chaos: 20 });
    expect(e.getBase().chaos).toBe(0);
  });
});
