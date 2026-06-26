import { describe, it, expect } from 'vitest';
import { planDiceCheck, resolveCheck } from '../dice';
import type { DiceResult, SlotResult } from '../types';

// Minimal d20-shaped slot carrying a given aggregate favorability.
function slot(favorability: number): DiceResult {
  return {
    type: 'd20', result: 10, threshold: 'neutral', interpretation: '', tags: [],
    themes: [], dimensions: { favorability, certainty: 0, volatility: 0 }, modifierRoles: [],
  };
}
const asSlots = (...s: DiceResult[]) => s as SlotResult[];

describe('planDiceCheck — DC', () => {
  it('no priors → baseline DC 11, no bless/bane', () => {
    const p = planDiceCheck([]);
    expect(p.dc).toBe(11);
    expect(p.bless).toBe(0);
    expect(p.bane).toBe(0);
  });

  it('a strongly favorable reading raises the bar (and grants Bless)', () => {
    const p = planDiceCheck(asSlots(slot(2), slot(1.5)));
    expect(p.dc).toBeGreaterThan(11);
    expect(p.bless).toBe(1);
    expect(p.sources.some((s) => s.includes('+1d4'))).toBe(true);
  });

  it('a grim reading lowers the bar (and imposes Bane)', () => {
    const p = planDiceCheck(asSlots(slot(-2), slot(-1.5)));
    expect(p.dc).toBeLessThan(11);
    expect(p.bane).toBe(1);
    expect(p.sources.some((s) => s.includes('−1d4'))).toBe(true);
  });

  it('a mixed reading can grant both a Bless and a Bane', () => {
    const p = planDiceCheck(asSlots(slot(2), slot(-2)));
    expect(p.bless).toBe(1);
    expect(p.bane).toBe(1);
  });

  it('clamps DC to [5, 17]', () => {
    expect(planDiceCheck(asSlots(slot(2), slot(2), slot(2))).dc).toBeLessThanOrEqual(17);
    expect(planDiceCheck(asSlots(slot(-2), slot(-2), slot(-2))).dc).toBeGreaterThanOrEqual(5);
  });
});

describe('resolveCheck — tiers', () => {
  const plan = (dc: number): { dc: number; bless: number; bane: number; sources: string[] } =>
    ({ dc, bless: 0, bane: 0, sources: [] });

  it('meeting the DC is a success (high)', () => {
    expect(resolveCheck(12, plan(12)).breakdown.tier).toBe('high');
  });
  it('beating the DC by 5+ is a strong success (critical-high)', () => {
    expect(resolveCheck(18, plan(12)).breakdown.tier).toBe('critical-high');
  });
  it('a narrow miss is neutral', () => {
    expect(resolveCheck(10, plan(12)).breakdown.tier).toBe('neutral');
  });
  it('missing by 5..9 is a failure (low)', () => {
    expect(resolveCheck(5, plan(12)).breakdown.tier).toBe('low');
  });
  it('missing by 10+ is a grave failure (critical-low)', () => {
    expect(resolveCheck(2, plan(15)).breakdown.tier).toBe('critical-low');
  });
  it('natural 20 is always Triumph, even under a high DC', () => {
    const { breakdown } = resolveCheck(20, plan(17));
    expect(breakdown.critical).toBe('triumph');
    expect(breakdown.tier).toBe('critical-high');
  });
  it('natural 1 is always Fumble, even under a low DC', () => {
    const { breakdown } = resolveCheck(1, plan(5));
    expect(breakdown.critical).toBe('fumble');
    expect(breakdown.tier).toBe('critical-low');
  });
});

describe('resolveCheck — Bless/Bane math', () => {
  // rng returns 0.5 → floor(0.5*4)+1 = 3 per d4.
  const rng = () => 0.5;
  it('adds Bless and subtracts Bane into the total', () => {
    const { breakdown } = resolveCheck(10, { dc: 12, bless: 1, bane: 1, sources: [] }, rng);
    expect(breakdown.bless).toEqual([3]);
    expect(breakdown.bane).toEqual([3]);
    expect(breakdown.total).toBe(10); // 10 + 3 - 3
    expect(breakdown.margin).toBe(-2);
  });
  it('a Bless can lift a miss into a success', () => {
    const { breakdown } = resolveCheck(11, { dc: 13, bless: 1, bane: 0, sources: [] }, rng);
    expect(breakdown.total).toBe(14); // 11 + 3
    expect(breakdown.tier).toBe('high');
  });
});
