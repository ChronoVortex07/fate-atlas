import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameEngine } from '../GameEngine';

afterEach(() => vi.restoreAllMocks());

describe('rollDicePair', () => {
  // drawSingleResult → rollD20 consumes Math.random; feed a descending sequence
  // so the two dice land on distinct, predictable values.
  function withRolls(values: number[], fn: () => void) {
    let i = 0;
    // rollD20 uses Math.floor(random*20)+1 for the base roll, then a couple of
    // affinity gates. Returning 0 for the gate calls keeps the base roll intact
    // only when chaos/order are at baseline; at baseline (50) influences are low.
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const v = values[Math.min(i, values.length - 1)];
      i += 1;
      return v;
    });
    fn();
  }

  it('advantage keeps the higher die', () => {
    const e = new GameEngine();
    // base rolls: first ~ (0.90*20)+1=19, gate rolls high (no influence), second ~ (0.10*20)+1=3
    withRolls([0.90, 0.99, 0.99, 0.10, 0.99, 0.99], () => {
      const { dice, keptIndex } = e.rollDicePair('advantage');
      expect(keptIndex).not.toBeNull();
      expect(dice[keptIndex as number].result).toBe(Math.max(dice[0].result, dice[1].result));
    });
  });

  it('disadvantage keeps the lower die', () => {
    const e = new GameEngine();
    withRolls([0.90, 0.99, 0.99, 0.10, 0.99, 0.99], () => {
      const { dice, keptIndex } = e.rollDicePair('disadvantage');
      expect(dice[keptIndex as number].result).toBe(Math.min(dice[0].result, dice[1].result));
    });
  });

  it('choice leaves keptIndex null and returns two dice', () => {
    const e = new GameEngine();
    const { dice, keptIndex } = e.rollDicePair('choice');
    expect(keptIndex).toBeNull();
    expect(dice).toHaveLength(2);
    expect(dice[0].type).toBe('d20');
  });
});

describe('planDiceRoll', () => {
  it('defaults to single mode at baseline affinities', () => {
    const e = new GameEngine();
    e.startTurn('self');
    // Stub RNG high so the probabilistic offerReroll() does not fire.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('single');
  });

  it('Light Ascendant confers advantage', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, light: 75 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.mode).toBe('advantage');
    expect(plan.sources).toContain('Light favors you');
  });

  it('Shadow Ascendant confers disadvantage', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, shadow: 75 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('disadvantage');
  });

  it('Will Dominant confers choice', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, will: 92 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('choice');
  });

  it('a forced modifier via debugForcedEffect overrides affinities and clears the flag', () => {
    const e = new GameEngine();
    e.loadState({ debugForcedEffect: 'disadvantage' });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('disadvantage');
    expect(e.getState().debugForcedEffect).toBeNull();
  });

  it('a matching pending effect confers its modifier and is consumed', () => {
    const e = new GameEngine();
    e.loadState({
      pendingEffects: [{
        id: 'x', sourceRunId: 'r', sourceCard: 'The Tower', sourceSlotIndex: 0,
        triggerTags: ['roll'], action: 'disadvantage', description: 'd',
        expiresAfter: 3, turnsRemaining: 3,
      }],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.mode).toBe('disadvantage');
    expect(plan.sources).toContain('The Tower');
    expect(e.getState().pendingEffects).toHaveLength(0); // consumed
  });

  it('Light advantage and a card disadvantage cancel to single', () => {
    const e = new GameEngine();
    e.loadState({
      affinities: { ...e.getState().affinities, light: 75 },
      pendingEffects: [{
        id: 'x', sourceRunId: 'r', sourceCard: 'The Tower', sourceSlotIndex: 0,
        triggerTags: ['roll'], action: 'disadvantage', description: 'd',
        expiresAfter: 3, turnsRemaining: 3,
      }],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('single');
  });
});
