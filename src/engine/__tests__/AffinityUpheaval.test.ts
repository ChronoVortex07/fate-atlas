import { describe, it, expect } from 'vitest';
import { AXIS_AFFINITIES, axisOf, AFFINITY_DEFINITIONS } from '../../data/affinities';
import { AffinityEngine } from '../AffinityEngine';

const makeEngine = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('axis helpers', () => {
  it('AXIS_AFFINITIES maps each axis to its polar pair', () => {
    expect(AXIS_AFFINITIES.agency).toEqual(['fate', 'will']);
    expect(AXIS_AFFINITIES.information).toEqual(['light', 'shadow']);
    expect(AXIS_AFFINITIES.fortune).toEqual(['chaos', 'order']);
  });

  it('axisOf returns the axis each affinity belongs to', () => {
    expect(axisOf('fate')).toBe('agency');
    expect(axisOf('will')).toBe('agency');
    expect(axisOf('light')).toBe('information');
    expect(axisOf('shadow')).toBe('information');
    expect(axisOf('chaos')).toBe('fortune');
    expect(axisOf('order')).toBe('fortune');
  });
});

describe('AffinityEngine transforms (upheavals)', () => {
  it('invert-pair flips both poles of one axis on EFFECTIVE, leaving others and base untouched', () => {
    const e = makeEngine();
    e.setState({ chaos: 90, order: 20, fate: 70 });
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 2, 'test');
    const eff = e.getState();
    expect(eff.chaos).toBe(10);   // 100 - 90
    expect(eff.order).toBe(80);   // 100 - 20
    expect(eff.fate).toBe(70);    // other axis untouched
    // base is never transformed
    expect(e.getBase().chaos).toBe(90);
    expect(e.getBase().order).toBe(20);
  });

  it('invert-all flips every affinity on EFFECTIVE', () => {
    const e = makeEngine();
    e.setState({ chaos: 80, order: 30, fate: 60, will: 40, light: 70, shadow: 10 });
    e.grantUpheaval({ transform: 'invert-all' }, 2, 'test');
    const eff = e.getState();
    expect(eff).toEqual({ chaos: 20, order: 70, fate: 40, will: 60, light: 30, shadow: 90 });
    expect(e.getBase().chaos).toBe(80); // base intact
  });

  it('scramble fixes its permutation at creation: repeated reads are identical and value-preserving', () => {
    const e = makeEngine();
    e.setState({ chaos: 10, order: 20, fate: 30, will: 40, light: 50, shadow: 60 });
    const orig = Math.random; Math.random = () => 0.42; // deterministic shuffle
    try {
      e.grantUpheaval({ transform: 'scramble' }, 2, 'test');
    } finally { Math.random = orig; }
    const a = e.getState();
    const b = e.getState();
    expect(a).toEqual(b); // stable across reads (permutation NOT re-rolled per eff)
    // a permutation preserves the multiset of base values
    expect(Object.values(a).sort((x, y) => x - y)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(e.getBase().light).toBe(50); // base intact
  });

  it('surge then transform compose: surge applies first, transform bends the surged value', () => {
    const e = makeEngine();
    // base chaos 50, surge +30 → effective-pre-transform 80, then invert → 20
    e.grantSurge({ chaos: 30 }, 3, 'surge');
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 2, 'up');
    expect(e.getState().chaos).toBe(20);
  });

  it('cliff expiry: full-strength every reading, then snaps back (no step-down)', () => {
    const e = makeEngine();
    e.setState({ chaos: 90, order: 20 });
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 2, 'test');
    expect(e.getState().chaos).toBe(10);  // reading 1: full invert
    e.tickModifiers();
    expect(e.getState().chaos).toBe(10);  // reading 2: STILL full invert (cliff, not decayed)
    e.tickModifiers();
    expect(e.getState().chaos).toBe(90);  // expired → snaps back to base
  });

  it('hasActiveTransform reflects whether any transform is live', () => {
    const e = makeEngine();
    expect(e.hasActiveTransform()).toBe(false);
    e.grantUpheaval({ transform: 'invert-all' }, 1, 'test');
    expect(e.hasActiveTransform()).toBe(true);
    e.tickModifiers();
    expect(e.hasActiveTransform()).toBe(false);
  });
});
