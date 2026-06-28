import { describe, it, expect, vi } from 'vitest';
import {
  bandOf,
  defaultAffinityState,
  AFFINITY_IDS,
  AFFINITY_PAIRS,
} from '../../data/affinities';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';
import type { TarotResult } from '../types';

describe('band + foundation helpers', () => {
  it('classifies values into bands at the documented boundaries', () => {
    expect(bandOf(0)).toBe('latent');
    expect(bandOf(34)).toBe('latent');
    expect(bandOf(35)).toBe('stirring');
    expect(bandOf(59)).toBe('stirring');
    expect(bandOf(60)).toBe('ascendant');
    expect(bandOf(81)).toBe('ascendant');
    expect(bandOf(82)).toBe('dominant');
    expect(bandOf(100)).toBe('dominant');
  });

  it('AFFINITY_PAIRS is a symmetric involution over all six ids', () => {
    expect(AFFINITY_IDS).toHaveLength(6);
    for (const id of AFFINITY_IDS) {
      const opp = AFFINITY_PAIRS[id];
      expect(opp).not.toBe(id);
      expect(AFFINITY_PAIRS[opp]).toBe(id);
    }
  });

  it('defaultAffinityState seeds all six affinities at baseline 50', () => {
    const s = defaultAffinityState();
    expect(Object.keys(s).sort()).toEqual([...AFFINITY_IDS].sort());
    for (const id of AFFINITY_IDS) expect(s[id]).toBe(50);
  });
});

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

// jitter = JITTER_MIN + r*(JITTER_MAX-JITTER_MIN); r=0.5 → ×1.0 (no jitter)
function noJitter<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = () => 0.5;
  try { return fn(); } finally { Math.random = orig; }
}

describe('AffinityEngine.shift pipeline', () => {
  it('starts all six at 50', () => {
    const e = make();
    const s = e.getState();
    expect(Object.values(s)).toEqual([50, 50, 50, 50, 50, 50]);
  });

  it('getBase returns the permanent values; with no surges effective equals base', () => {
    const e = make();
    e.setState({ chaos: 70 });
    expect(e.getBase().chaos).toBe(70);
    expect(e.getState().chaos).toBe(70); // effective == base when no modifiers
  });

  it('a gain applies coupling: opposite -0.35g, others -0.09g (rounded, clamped)', () => {
    const e = make();
    noJitter(() => e.shift('chaos', 10, 'test')); // dr=1, jitter=1 → g=10
    const s = e.getState();
    expect(s.chaos).toBe(60);  // 50 + 10
    expect(s.order).toBe(47);  // 50 - 10×0.35 = 46.5 → round 47 (opposite)
    expect(s.fate).toBe(49);   // 50 - 10×0.09 = 49.1 → round 49 (other)
    expect(s.will).toBe(49);
    expect(s.light).toBe(49);
    expect(s.shadow).toBe(49);
  });

  it('diminishing returns shrink successive same-run gains and floor at 0.5', () => {
    const e = make();
    const g1 = noJitter(() => e.shift('chaos', 10, 't')); // dr=1.00 → 10
    const g2 = noJitter(() => e.shift('chaos', 10, 't')); // dr=0.95 → 9.5
    const g3 = noJitter(() => e.shift('chaos', 10, 't')); // dr=0.90 → 9.0
    expect(g1).toBeGreaterThan(g2);
    expect(g2).toBeGreaterThan(g3);
    let last = 0;
    for (let i = 0; i < 50; i++) last = noJitter(() => e.shift('chaos', 10, 't'));
    expect(last).toBeGreaterThanOrEqual(6.7 - 0.001); // floor 0.67 → 10 × 0.67
  });

  it('jitter keeps realized gain within +/-15% of the diminished base', () => {
    const e = make();
    const lo = (() => { const o = Math.random; Math.random = () => 0; const g = e.shift('chaos', 10, 't'); Math.random = o; return g; })();
    const e2 = make();
    const hi = (() => { const o = Math.random; Math.random = () => 0.999; const g = e2.shift('chaos', 10, 't'); Math.random = o; return g; })();
    expect(lo).toBeCloseTo(8.5, 5);   // 10 * 1 * 0.85
    expect(hi).toBeCloseTo(11.5, 1);  // 10 * 1 * ~1.15
  });

  it('penalties subtract directly with no fan-out', () => {
    const e = make();
    e.shift('light', -12, 'peek-fail');
    const s = e.getState();
    expect(s.light).toBe(38);   // 50 - 12, direct
    expect(s.shadow).toBe(50);  // opposite untouched
    expect(s.chaos).toBe(50);   // others untouched
  });

  it('applyResultTags raises chaos for a reversed result; random no longer feeds it', () => {
    const e = make();
    // 'random' is on nearly every draw and no longer feeds Chaos — only 'reversed' counts.
    const reversed = { tags: ['draw', 'random', 'reversed', 'reversible'] } as TarotResult;
    noJitter(() => e.applyResultTags(reversed)); // 1 match ('reversed') × 5 = 5
    expect(e.getState().chaos).toBe(55);
    expect(e.getState().order).toBeLessThan(50); // coupling taxes the opposite
  });

  it('caps Fortune tag feeds at +8 per run; beginRun resets the cap', () => {
    const e = make();
    noJitter(() => e.feedFortuneTag('chaos', 5, 't')); // +5 (counter 5)
    noJitter(() => e.feedFortuneTag('chaos', 5, 't')); // +3 (counter hits 8)
    expect(noJitter(() => e.feedFortuneTag('chaos', 5, 't'))).toBe(0); // cap exhausted
    e.beginRun();
    expect(noJitter(() => e.feedFortuneTag('chaos', 5, 't'))).toBeGreaterThan(0); // reset
  });
});

describe('bands, reach-up, and run boundary', () => {
  it('resolveBand reaches one band up at the reach-up chance, never two, never from dominant', () => {
    const e = make();
    e.setState({ chaos: 50 }); // stirring
    const orig = Math.random;
    Math.random = () => 0.05; // < 0.12 → reach up one band
    expect(e.resolveBand('chaos')).toBe('ascendant');
    Math.random = () => 0.5;  // >= 0.12 → stay
    expect(e.resolveBand('chaos')).toBe('stirring');
    e.setState({ chaos: 90 }); // dominant — the ceiling
    Math.random = () => 0.0;   // would reach up, but there is no higher band
    expect(e.resolveBand('chaos')).toBe('dominant');
    Math.random = orig;
  });

  it('beginRun drifts 8% toward 50 (rounded)', () => {
    const e = make();
    e.setState({ chaos: 80, order: 20 });
    e.beginRun();
    expect(e.getState().chaos).toBe(78); // round(80 + (50-80)×0.08) = round(77.6)
    expect(e.getState().order).toBe(22); // round(20 + (50-20)×0.08) = round(22.4)
  });

  it('beginRun resets diminishing-returns counters so the next gain is full', () => {
    const e = make();
    const o = Math.random;
    Math.random = () => 0.5; // no jitter
    e.shift('order', 10, 't'); // feedsThisRun.order = 1 (next would be diminished)
    e.beginRun();
    const g = e.shift('order', 10, 't'); // dr back to 1.0
    Math.random = o;
    expect(g).toBeCloseTo(10, 5);
  });
});

describe('AffinityMandate', () => {
  it('scales a gain by the per-affinity factor', () => {
    const e = make();
    e.setState({ chaos: 50 });
    const baseline = make(); baseline.setState({ chaos: 50 });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    e.setMandate({ gainMult: { chaos: 2.0 }, globalMult: 1.0, source: 'test' });
    const gMandate = e.shift('chaos', 10, 'test');
    const gBase = baseline.shift('chaos', 10, 'test');
    expect(gMandate).toBeCloseTo(gBase * 2.0, 5);
    vi.restoreAllMocks();
  });

  it('scales a direct penalty by the per-affinity factor', () => {
    const e = make(); e.setState({ light: 50 });
    e.setMandate({ gainMult: { light: 2.0 }, globalMult: 1.0, source: 'test' });
    const d = e.shift('light', -10, 'test');
    expect(d).toBe(-20);
  });

  it('uses globalMult for affinities absent from gainMult', () => {
    const e = make();
    e.setMandate({ gainMult: { chaos: 2.0 }, globalMult: 0.5, source: 'test' });
    expect(e.getMandate()!.globalMult).toBe(0.5);
  });

  it('decays each factor 40% toward 1.0, skipping the set turn', () => {
    const e = make();
    e.setMandate({ gainMult: { chaos: 2.0 }, globalMult: 1.0, source: 'test' });
    e.decayMandate(); // fresh → no decay
    expect(e.getMandate()!.gainMult.chaos).toBeCloseTo(2.0, 5);
    e.decayMandate(); // 2.0 → 2.0 + (1-2.0)*0.4 = 1.6
    expect(e.getMandate()!.gainMult.chaos).toBeCloseTo(1.6, 5);
  });

  it('globalMult scales an affinity absent from gainMult', () => {
    // Mandate with only globalMult: 0.5 and no per-affinity entries.
    // A shift on 'order' (not in gainMult) should be scaled by globalMult (0.5).
    const e = make(); e.setState({ order: 50 });
    const baseline = make(); baseline.setState({ order: 50 });
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no jitter
    e.setMandate({ gainMult: {}, globalMult: 0.5, source: 'test' });
    const gMandate = e.shift('order', 10, 'test');
    const gBase = baseline.shift('order', 10, 'test');
    expect(gMandate).toBeCloseTo(gBase * 0.5, 5);
    vi.restoreAllMocks();
  });

  it('decays globalMult 40% toward 1.0, skipping the set turn', () => {
    const e = make();
    e.setMandate({ gainMult: {}, globalMult: 0.5, source: 'test' });
    e.decayMandate(); // fresh → no decay
    expect(e.getMandate()!.globalMult).toBeCloseTo(0.5, 5);
    e.decayMandate(); // 0.5 → 0.5 + (1-0.5)*0.4 = 0.7
    expect(e.getMandate()!.globalMult).toBeCloseTo(0.7, 5);
  });

  it('clears the mandate on beginRun', () => {
    const e = make();
    e.setMandate({ gainMult: { chaos: 2 }, globalMult: 1, source: 'test' });
    e.beginRun();
    expect(e.getMandate()).toBeNull();
  });
});
