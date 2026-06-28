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

  it('feeds on BASE not effective vector: active upheaval inversion cannot redirect corruption food', () => {
    // Regression for the getState() → getBase() fix:
    // chaos is hoarded high in BASE (real food); order is low in base.
    // The invert-pair upheaval on the fortune axis makes chaos LOOK low in the
    // effective vector and order LOOK high — the old getState() path would misfeed
    // on order (low base, fake-high effective) and NOT erode chaos (high base).
    // With getBase(), corruption must still target chaos (the real hoard).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 20, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(50);

    // Grant an active invert-pair upheaval on the fortune axis (chaos ↔ order).
    // This flips the effective view: chaos reads ≈0, order reads ≈80 — but base is unchanged.
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 3, 'test');

    // Sanity: effective vector now shows chaos low, order high.
    const beforeEff = e.getState().affinities;
    expect(beforeEff.chaos).toBeLessThan(10); // ≈ 100 - 100
    expect(beforeEff.order).toBeGreaterThan(70); // ≈ 100 - 20

    // Base is untouched by the transform.
    const beforeBase = e.getState().affinityBase;
    expect(beforeBase.chaos).toBe(100);
    expect(beforeBase.order).toBe(20);

    oneReading(e);

    // Corruption must have eroded the HIGH-BASE affinity (chaos), not order.
    const afterBase = e.getState().affinityBase;
    expect(afterBase.chaos).toBeLessThan(100); // eroded — base was the real hoard
    expect(afterBase.order).toBe(20);           // untouched — base was never high
  });
});
