import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('AffinityEngine surges', () => {
  it('a fresh surge adds its full delta to effective, leaving base untouched', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'test');
    expect(e.getState().chaos).toBe(80); // 50 + 30 × (3/3)
    expect(e.getBase().chaos).toBe(50);  // base untouched
  });

  it('step-down decays the contribution each tick, then expires', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'test'); // factor 3/3 → +30
    e.tickModifiers();
    expect(e.getState().chaos).toBe(70);    // factor 2/3 → +20
    e.tickModifiers();
    expect(e.getState().chaos).toBe(60);    // factor 1/3 → +10
    e.tickModifiers();
    expect(e.getState().chaos).toBe(50);    // expired → +0
    expect(e.getModifiers()).toHaveLength(0);
  });

  it('surges stack additively and expire independently', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'a'); // +30
    e.grantSurge({ chaos: 30 }, 1, 'b'); // +30, single reading
    expect(e.getState().chaos).toBe(100); // 50 + 30 + 30, clamped
    e.tickModifiers();                    // a → +20, b expired
    expect(e.getState().chaos).toBe(70);
    expect(e.getModifiers()).toHaveLength(1);
  });

  it('a Light surge lifts the effective band so peek becomes available', () => {
    const e = make(); // base light 50 = stirring → no peek
    expect(e.peekAvailable()).toBe(false);
    e.grantSurge({ light: 20 }, 3, 'test'); // effective 70 = ascendant
    expect(e.peekAvailable()).toBe(true);
    expect(e.getEffects().peekAvailable).toBe(true);
  });

  it('beginRun preserves modifiers; clearModifiers empties them', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'test');
    e.beginRun();
    expect(e.getModifiers()).toHaveLength(1); // survives the turn boundary
    e.clearModifiers();
    expect(e.getModifiers()).toHaveLength(0);
    expect(e.getState().chaos).toBe(e.getBase().chaos);
  });

  it('clearModifiers also resets the per-run Fortune cap counter', () => {
    const e = make();
    // Exhaust the Fortune tag cap (FORTUNE_TAG_CAP = 8) without a beginRun.
    e.feedFortuneTag('chaos', 8, 't');
    expect(e.feedFortuneTag('chaos', 5, 't')).toBe(0); // cap exhausted
    e.clearModifiers();
    expect(e.feedFortuneTag('chaos', 5, 't')).toBeGreaterThan(0); // counter reset by clear
  });
});
