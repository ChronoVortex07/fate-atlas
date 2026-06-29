import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });

function fullTurn(e: GameEngine) {
  for (let i = 0; i < 3; i++) {
    e.completeMinigame(dice());
    if (e.getState().eventQueue.length > 0) e.finishEventBatch();
    e.continueAfterReview();
  }
}

describe('corruption falsifies the reading output', () => {
  it('leaves the reading clean when corruption is dormant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    fullTurn(e);
    const s = e.getState();
    expect(s.screen).toBe('result');
    // a clean reading contains no redaction blocks
    expect(JSON.stringify(s.synthesis)).not.toContain('█');
  });
});
