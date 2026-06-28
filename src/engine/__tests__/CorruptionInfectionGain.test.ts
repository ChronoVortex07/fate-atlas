import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CorruptionEngine } from '../CorruptionEngine';
import type { AffinityId, DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> => ({
  chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over,
});
const hoarded = vec({ chaos: 100, order: 100 }); // food = 38

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

describe('CorruptionEngine.tick infection multiplier', () => {
  it('grows more when the multiplier is higher', () => {
    const a = new CorruptionEngine(); a.setValue(50);
    const b = new CorruptionEngine(); b.setValue(50);
    const ra = a.tick(hoarded, 0, () => 0.99, 1);
    const rb = b.tick(hoarded, 0, () => 0.99, 2);
    expect(rb.value - 50).toBeGreaterThan(ra.value - 50);
  });
});

describe('infected games amplify corruption growth (GameEngine)', () => {
  // Math.random pinned to 0.99: deterministic pool, infected = [2], all rolls suppressed.
  function setup(): GameEngine {
    const e = new GameEngine(3);
    e.setCorruption(50);      // spreading → 1 infected method
    e.startTurn('self');      // buildPool computes infectedMethods = [2]
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } });
    return e;
  }

  it('an infected selection grows corruption more than an uninfected one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const infectedEngine = setup();
    expect(infectedEngine.getState().infectedMethods).toEqual([2]);
    infectedEngine.selectMethod(2); // infected
    oneReading(infectedEngine);

    const controlEngine = setup();
    controlEngine.selectMethod(0); // not infected
    oneReading(controlEngine);

    expect(infectedEngine.getState().corruption.value)
      .toBeGreaterThan(controlEngine.getState().corruption.value);
  });
});
