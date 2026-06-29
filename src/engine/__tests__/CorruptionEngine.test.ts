import { describe, it, expect } from 'vitest';
import { CorruptionEngine } from '../CorruptionEngine';
import { SEED_INITIAL, DECAY_RATE, RUPTURE_RESET } from '../../data/corruption';
import type { AffinityId } from '../types';

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> => ({
  chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over,
});
const balanced = vec({});
const hoarded = vec({ chaos: 100, order: 100 }); // food = 38

describe('CorruptionEngine.tick — dormant', () => {
  it('never seeds without imbalance, however the dice fall', () => {
    const e = new CorruptionEngine();
    const r = e.tick(balanced, 0, () => 0); // rng=0 would pass any positive chance
    expect(r.seeded).toBe(false);
    expect(r.value).toBe(0);
    expect(r.band).toBe('dormant');
  });

  it('seeds from imbalance when the roll passes', () => {
    const e = new CorruptionEngine();
    const r = e.tick(hoarded, 0, () => 0); // 0 < seedChance(38, 2) ≈ 0.258
    expect(r.seeded).toBe(true);
    expect(r.value).toBe(SEED_INITIAL);
    expect(r.band).toBe('seeded');
  });

  it('does not seed when the roll fails', () => {
    const e = new CorruptionEngine();
    const r = e.tick(hoarded, 0, () => 0.99);
    expect(r.seeded).toBe(false);
    expect(e.getValue()).toBe(0);
  });
});

describe('CorruptionEngine.tick — active', () => {
  it('grows while fed (erosion + skim) and reports drains on the hoarded affinities', () => {
    const e = new CorruptionEngine();
    e.setValue(50);
    const r = e.tick(hoarded, 10, () => 0.99); // food 38 → erosion; gains 10 → skim
    expect(r.value).toBeGreaterThan(50);
    expect(r.drains.chaos).toBeGreaterThan(0);
    expect(r.drains.order).toBeGreaterThan(0);
    expect(r.drains.fate).toBeUndefined(); // fate is at baseline, no excess
    expect(r.ruptured).toBe(false);
  });

  it('starves and decays when balance returns, with no drains', () => {
    const e = new CorruptionEngine();
    e.setValue(50);
    const r = e.tick(balanced, 0, () => 0.99);
    expect(r.value).toBe(50 - DECAY_RATE);
    expect(r.drains).toEqual({});
  });

  it('decays to zero over repeated starved readings', () => {
    const e = new CorruptionEngine();
    e.setValue(DECAY_RATE); // one tick from gone
    const r = e.tick(balanced, 0, () => 0.99);
    expect(r.value).toBe(0);
    expect(r.band).toBe('dormant');
  });

  it('flags rupture at the pinnacle', () => {
    const e = new CorruptionEngine();
    e.setValue(99);
    const r = e.tick(hoarded, 5, () => 0.99);
    expect(r.value).toBe(100);
    expect(r.band).toBe('pinnacle');
    expect(r.ruptured).toBe(true);
  });
});

describe('CorruptionEngine persistence', () => {
  it('round-trips through serialize/loadFrom', () => {
    const e = new CorruptionEngine();
    e.setValue(42);
    const blob = e.serialize();
    const e2 = new CorruptionEngine();
    e2.loadFrom(blob);
    expect(e2.getValue()).toBe(42);
  });

  it('loadFrom tolerates garbage and falls back to 0', () => {
    const e = new CorruptionEngine();
    e.setValue(42);
    e.loadFrom('not json');
    expect(e.getValue()).toBe(0);
  });
});

describe('CorruptionEngine.setValue', () => {
  it('clamps to [0, 100]', () => {
    const e = new CorruptionEngine();
    e.setValue(-5);
    expect(e.getValue()).toBe(0);
    e.setValue(250);
    expect(e.getValue()).toBe(RUPTURE_RESET + 75); // 100
  });
});
