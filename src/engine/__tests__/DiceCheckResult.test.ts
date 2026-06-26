import { describe, it, expect } from 'vitest';
import { buildDiceResult } from '../../data/dice';
import type { DiceCheckBreakdown } from '../types';

const base: DiceCheckBreakdown = {
  d20: 14, bless: [], bane: [], dc: 12, total: 14, margin: 2,
  tier: 'high', critical: null,
};

describe('buildDiceResult', () => {
  it('carries the natural d20 as result and the tier as threshold', () => {
    const r = buildDiceResult(base);
    expect(r.type).toBe('d20');
    expect(r.result).toBe(14);
    expect(r.threshold).toBe('high');
    expect(r.check).toEqual(base);
  });

  it('pulls themes/dimensions/modifierRoles from the tier data', () => {
    const r = buildDiceResult(base);
    // 'high' tier in THRESHOLD_DATA: favorability +1.0
    expect(r.dimensions.favorability).toBe(1.0);
    expect(r.themes.length).toBeGreaterThan(0);
    expect(r.modifierRoles).toContain('effect');
  });

  it('emits the relative-tier tag (low/high/neutral)', () => {
    expect(buildDiceResult(base).tags).toContain('high');
    expect(buildDiceResult({ ...base, tier: 'neutral', margin: -2 }).tags).toContain('neutral');
    expect(buildDiceResult({ ...base, tier: 'low', margin: -6 }).tags).toContain('low');
  });

  it('emits a triumph tag and a natural-20 interpretation on a triumph crit', () => {
    const r = buildDiceResult({ ...base, d20: 20, tier: 'critical-high', critical: 'triumph' });
    expect(r.tags).toContain('triumph');
    expect(r.interpretation.toLowerCase()).toContain('natural 20');
  });

  it('emits a fumble tag and a natural-1 interpretation on a fumble crit', () => {
    const r = buildDiceResult({ ...base, d20: 1, tier: 'critical-low', critical: 'fumble' });
    expect(r.tags).toContain('fumble');
    expect(r.interpretation.toLowerCase()).toContain('natural 1');
  });

  it('non-crit interpretation names the DC', () => {
    expect(buildDiceResult(base).interpretation).toContain('12');
  });
});
