import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

// Drive exactly one completed reading (mirrors the corruption-test helper).
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('game length', () => {
  it('startTurn records the chosen method count on state', () => {
    const e = new GameEngine();
    e.startTurn('self', 7);
    expect(e.getState().minigamesPerTurn).toBe(7);
  });

  it('a 7-method turn does not finalize at the old default of 3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine();
    e.startTurn('self', 7);
    for (let i = 0; i < 3; i++) oneReading(e);
    expect(e.getState().synthesis).toBeNull(); // would be set if it thought 3 was final
  });

  it('a 7-method turn finalizes on the 7th reading', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine();
    e.startTurn('self', 7);
    for (let i = 0; i < 7; i++) oneReading(e);
    expect(e.getState().synthesis).toBeTruthy();
    expect(e.getState().screen).toBe('result');
  });

  it('omitting the count falls back to the constructor default', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    expect(e.getState().minigamesPerTurn).toBe(3);
  });
});
