import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

const ENTITY = [
  'It watches. It is pleased.',
  'Expect us.',
  'The card you did not draw speaks the loudest.',
  'This reading was never yours.',
];

describe('entity voice replaces the affinity note at Virulent+', () => {
  it('a Virulent reading speaks in the entity voice, not the affinity line', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const e = new GameEngine(1); // single reading IS the final reading
    e.startTurn('self', 1);
    e.loadState({ affinities: { chaos: 95, order: 50, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); // virulent
    oneReading(e);
    expect(ENTITY).toContain(e.getState().synthesis?.affinityNote);
  });

  it('below Virulent the affinity line is unchanged', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // suppress seeding
    const e = new GameEngine(1);
    e.startTurn('self', 1);
    e.loadState({ affinities: { chaos: 95, order: 50, fate: 50, will: 50, light: 50, shadow: 50 } });
    oneReading(e);
    expect(e.getState().synthesis?.affinityNote).toContain('chaos');
  });
});
