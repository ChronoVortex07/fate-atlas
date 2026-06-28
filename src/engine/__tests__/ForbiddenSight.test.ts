import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { AFFINITY_IDS } from '../../data/affinities';
import { SIGHT_COST, LIE_OFFSET } from '../../data/corruption';
import type { AffinityId } from '../types';

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over });

describe('useForbiddenSight — glimpse + lie', () => {
  it('returns all six forces; exactly one (the lie) is offset, the rest are true', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: vec({ chaos: 90 }) });
    e.setCorruption(80); // virulent
    const g = e.useForbiddenSight(() => 0); // rng=0 → lieId = AFFINITY_IDS[0] = 'chaos', dir = -1
    expect(g.lieId).toBe('chaos');
    expect(g.forces.chaos).toBe(90 - LIE_OFFSET); // falsified
    expect(g.forces.order).toBe(50);              // untouched
    expect(Object.keys(g.forces).sort()).toEqual([...AFFINITY_IDS].sort());
    expect('corruption' in g.forces).toBe(false); // never itself
  });

  it('clamps the lie into [0,100]', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: vec({ chaos: 5 }) });
    e.setCorruption(80);
    const g = e.useForbiddenSight(() => 0); // chaos, dir -1 → 5-18 → clamp 0
    expect(g.forces.chaos).toBe(0);
  });
});

describe('useForbiddenSight — cost once per minigame', () => {
  it('charges SIGHT_COST on first use, is free on re-open, recharges in a new minigame', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.setCorruption(80);
    const before = e.getState().corruption.value;

    e.useForbiddenSight(() => 0);
    const afterFirst = e.getState().corruption.value;
    expect(afterFirst).toBe(before + SIGHT_COST);

    e.useForbiddenSight(() => 0);
    expect(e.getState().corruption.value).toBe(afterFirst); // re-open free

    e.selectMethod(0); // enter a new minigame → flag resets
    e.useForbiddenSight(() => 0);
    expect(e.getState().corruption.value).toBe(afterFirst + SIGHT_COST); // charges again
  });
});
