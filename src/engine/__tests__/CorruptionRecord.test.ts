import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { isVisibleCorruption } from '../../data/corruption';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });
function fullTurn(e: GameEngine) {
  for (let i = 0; i < 3; i++) { e.completeMinigame(dice());
    if (e.getState().eventQueue.length > 0) e.finishEventBatch(); e.continueAfterReview(); }
}

describe('isVisibleCorruption', () => {
  it('is true for spreading+ only', () => {
    expect(isVisibleCorruption('dormant')).toBe(false);
    expect(isVisibleCorruption('seeded')).toBe(false);
    expect(isVisibleCorruption('spreading')).toBe(true);
    expect(isVisibleCorruption('virulent')).toBe(true);
  });
});

describe('corrupted run record', () => {
  it('flags the record when corruption is visible', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 95, order: 95, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); // virulent
    fullTurn(e);
    const last = e.getState().history.slice(-1)[0]!;
    expect(last.corrupted).toBe(true);
  });
  it('does not flag a clean record', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3); e.startTurn('self');
    fullTurn(e);
    const last = e.getState().history.slice(-1)[0]!;
    expect(last.corrupted ?? false).toBe(false);
  });
});
