import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';
import { RUPTURE_RESET } from '../../data/corruption';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

// Drive exactly one completed reading: commit a die, drain any queued effect
// batch (so the deferred review beat actually arms), then release the review beat
// (where advanceAfterCommit — and thus the corruption tick — runs).
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('GameEngine corruption lifecycle', () => {
  it('exposes a dormant corruption snapshot by default', () => {
    const e = new GameEngine(3);
    expect(e.getState().corruption).toEqual({ value: 0, band: 'dormant' });
  });

  it('grows corruption and erodes hoarded affinities across a reading', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // suppress procs + seeding noise
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(50);

    oneReading(e);

    const s = e.getState();
    expect(s.corruption.value).toBeGreaterThan(50); // erosion + skim
    expect(s.affinityBase.chaos).toBeLessThan(100); // hoard bled down
  });

  it('performs the Rupture at the pinnacle: affinities reset low, corruption gone', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 100, will: 100, light: 100, shadow: 100 } });
    e.setCorruption(99);

    oneReading(e);

    const s = e.getState();
    expect(s.corruption.value).toBe(0);
    expect(s.corruption.band).toBe('dormant');
    expect(s.affinityBase.chaos).toBe(RUPTURE_RESET);
    expect(s.affinityBase.shadow).toBe(RUPTURE_RESET);
  });

  it('never seeds corruption from a balanced world', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // would pass any positive seed chance
    const e = new GameEngine(3);
    e.startTurn('self'); // all affinities at baseline 50 → no food
    oneReading(e);
    expect(e.getState().corruption.value).toBe(0);
  });
});
