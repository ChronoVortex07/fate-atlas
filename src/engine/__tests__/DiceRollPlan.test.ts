import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameEngine } from '../GameEngine';
import { resolveCheck as _resolveCheck } from '../dice';

afterEach(() => vi.restoreAllMocks());

describe('rollDicePair', () => {
  // drawSingleResult → rollD20 consumes Math.random; feed a descending sequence
  // so the two dice land on distinct, predictable values.
  function withRolls(values: number[], fn: () => void) {
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const v = values[Math.min(i, values.length - 1)];
      i += 1;
      return v;
    });
    fn();
  }

  it('advantage keeps the higher die', () => {
    const e = new GameEngine();
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

describe('planDiceRoll (dispatch-driven roll-mode)', () => {
  it('defaults to single mode at baseline affinities', () => {
    const e = new GameEngine();
    e.startTurn('self');
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no probabilistic responder fires
    expect(e.planDiceRoll().mode).toBe('single');
  });

  it('a forced light-advantage responder confers advantage', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.forceEffects(['light-advantage'], false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('advantage');
  });

  it('a forced shadow-disadvantage responder confers disadvantage', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.forceEffects(['shadow-disadvantage'], false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('disadvantage');
  });

  it('a forced will-choice responder confers choice', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.forceEffects(['will-choice'], false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('choice');
  });

  it('a forced effect is consumed from the debug config after firing', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.forceEffects(['shadow-disadvantage'], false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    e.planDiceRoll();
    expect(e.getState().debugConfig.forced).not.toContain('shadow-disadvantage');
  });

  it('forced advantage + disadvantage cancel to single', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.forceEffects(['light-advantage', 'shadow-disadvantage'], false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('single');
  });

  it('a forced roll-mode effect emits a report into the queue', () => {
    const e = new GameEngine();
    e.startTurn('self');
    e.forceEffects(['will-choice'], false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.reports.some((r) => r.responderId === 'roll-mode')).toBe(true);
  });
});

describe('planDiceRoll — check context', () => {
  it('returns baseline DC 11 and no bless/bane with no prior slots', () => {
    const e = new GameEngine();
    e.startTurn('self');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.dc).toBe(11);
    expect(plan.bless).toBe(0);
    expect(plan.bane).toBe(0);
    expect(Array.isArray(plan.sources)).toBe(true);
    expect(typeof _resolveCheck).toBe('function');
  });
});

describe('resolveDiceCheck', () => {
  it('produces a committed-shaped DiceResult carrying the breakdown', () => {
    const e = new GameEngine();
    const { result, breakdown } = e.resolveDiceCheck(15, { dc: 12, bless: 0, bane: 0, sources: [] });
    expect(result.type).toBe('d20');
    expect(result.result).toBe(15);
    expect(result.check).toEqual(breakdown);
    expect(breakdown.tier).toBe('high');
  });
});
