import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { intrusionChance } from '../../data/corruption';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('intrusionChance', () => {
  it('is 0 below virulent and ramps within virulent', () => {
    expect(intrusionChance(50)).toBe(0);
    expect(intrusionChance(67)).toBeGreaterThan(0);
    expect(intrusionChance(99)).toBeGreaterThan(intrusionChance(67));
  });
});

describe('intrusion firing', () => {
  it('never fires below virulent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // would fire if eligible
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 90, order: 50, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(40); // seeded/spreading boundary — below virulent
    oneReading(e);
    expect(e.getState().intrusion).toBeNull();
  });

  it('fires at virulent when the roll passes, and marks the event', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // roll always passes
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 95, order: 95, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); // virulent
    oneReading(e);
    expect(e.getState().intrusion).not.toBeNull();
    expect(typeof e.getState().intrusion!.text).toBe('string');
  });

  it('clearIntrusion clears it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 95, order: 95, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); oneReading(e);
    e.clearIntrusion();
    expect(e.getState().intrusion).toBeNull();
  });
});
