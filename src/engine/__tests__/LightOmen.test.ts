import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, DiceResult } from '../types';
import { SEED_OMEN } from '../../data/corruption';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

// Light high + a hoard for corruption food (so it grows, never starves).
const litHoard = (light: number): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light, shadow: 50 });

function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('Light seed-omen', () => {
  it('fires SEED_OMEN on first perception at spreading with Dominant Light', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no procs/intrusions
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) }); // dominant + light=100 is food
    e.setCorruption(40); // spreading

    oneReading(e);

    expect(e.getState().omen).toEqual({ text: SEED_OMEN });
    expect(e.corruptionEngineForTest().getWarnedBand()).toBe('spreading');
  });

  it('does NOT fire when Light is below ascendant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } }); // food, but Light stirring
    e.setCorruption(40);

    oneReading(e);

    expect(e.getState().omen).toBeNull();
    expect(e.corruptionEngineForTest().getWarnedBand()).toBe('dormant');
  });

  it('does not re-fire for a band already warned', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) });
    e.setCorruption(40);

    oneReading(e);            // fires at spreading
    e.clearOmen();            // player saw it
    oneReading(e);            // still spreading → no new omen

    expect(e.getState().omen).toBeNull();
  });

  it('clearOmen() clears the transient', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) });
    e.setCorruption(40);
    oneReading(e);
    expect(e.getState().omen).not.toBeNull();
    e.clearOmen();
    expect(e.getState().omen).toBeNull();
  });
});
