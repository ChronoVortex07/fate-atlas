import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('AffinityEngine.getEffects', () => {
  it('fresh baseline gives base modifiers', () => {
    const e = make();
    const fx = e.getEffects();
    expect(fx.spreadRedraws).toBe(0);
    expect(fx.methodCount).toBe(3);
    expect(fx.hintClarity).toBe(0);
    expect(fx.readingDetail).toBe(0);
    expect(fx.poolPreview).toBe('none');
    expect(fx.peekAvailable).toBe(false);
  });

  it('spreadRedraws by Will: 0 at baseline, 1 at ascendant, 2 at dominant', () => {
    const e = make();
    expect(e.getEffects().spreadRedraws).toBe(0);
    e.setState({ will: 70 }); // ascendant
    expect(e.getEffects().spreadRedraws).toBe(1);
    e.setState({ will: 95 }); // dominant
    expect(e.getEffects().spreadRedraws).toBe(2);
  });

  it('Fate Ascendant lowers methodCount to 2', () => {
    const e = make();
    e.setState({ fate: 70 });
    expect(e.getEffects().methodCount).toBe(2);
  });

  it('Light raises clarity/detail/peek; Shadow lowers them', () => {
    const e = make();
    e.setState({ light: 90, shadow: 20 });
    const fx = e.getEffects();
    expect(fx.hintClarity).toBeGreaterThan(0);
    expect(fx.readingDetail).toBe(1);
    expect(fx.poolPreview).toBe('full');
    expect(fx.peekAvailable).toBe(true);

    e.setState({ light: 20, shadow: 90 });
    const fx2 = e.getEffects();
    expect(fx2.hintClarity).toBeLessThan(0);
    expect(fx2.readingDetail).toBe(-1);
    expect(fx2.poolPreview).toBe('hidden');
    expect(fx2.peekAvailable).toBe(false);
  });
});
