import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { buildFace, DECK_BY_ID } from '../../data/tarot';
import type { TarotResult, DiceResult } from '../types';

const tarot = (orientation: 'upright' | 'reversed'): TarotResult => {
  const face = buildFace(DECK_BY_ID['the-fool'], orientation);
  return {
    type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0, orientation, symbol: '☉',
    meaningUpright: 'x', meaningReversed: 'y',
    tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', orientation],
    themes: ['renewal'], dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
    modifierRoles: ['subject'],
    spread: [{ position: 'present', card: face }],
  };
};

function startMinigame(e: GameEngine) {
  e.startTurn('self');
  const idx = e.getState().availableMethods.findIndex((m) => m !== 'happening');
  if (idx !== -1) e.selectMethod(idx);
}

// jitter midpoint (Math.random()=0.5 → ×1.0) keeps coupling math deterministic.
function noJitter<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = () => 0.5;
  try { return fn(); } finally { Math.random = orig; }
}

const dice = (result: number): DiceResult => ({
  type: 'd20', result, threshold: result <= 9 ? 'low' : 'neutral', interpretation: 'x',
  tags: ['roll', 'numeric'], themes: ['stagnation'],
  dimensions: { favorability: -1, certainty: 0, volatility: 0.5 }, modifierRoles: ['effect'],
} as DiceResult);

describe('completeMinigame meta feeds', () => {
  it('reveal-as-drawn meta feeds Fate', () => {
    const e = new GameEngine();
    startMinigame(e);
    const before = e.getState().affinities.fate;
    noJitter(() => e.completeMinigame(tarot('upright'), { revealedAsDrawn: true }));
    expect(e.getState().affinities.fate).toBeGreaterThan(before);
  });

  it('reversed meta feeds Will', () => {
    const e = new GameEngine();
    startMinigame(e);
    const before = e.getState().affinities.will;
    noJitter(() => e.completeMinigame(tarot('reversed'), { reversed: true }));
    expect(e.getState().affinities.will).toBeGreaterThan(before);
  });
});

// Pre-commit reroll used by the dice minigame's reroll prompt. resolveReroll
// returns the next result for the component to commit; Fate (via the
// fate-hollow-reroll responder) may make it hollow (same value returned).
describe('resolveReroll (pre-commit dice reroll)', () => {
  it('returns a fresh result (not hollow) at baseline Fate', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99; // baseline Fate < ascendant → never hollow
    const { hollow } = e.resolveReroll(dice(5));
    Math.random = orig;
    expect(hollow).toBe(false);
  });

  it('returns the same result (hollow) when fate-hollow-reroll is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.forceEffects(['fate-hollow-reroll'], false);
    const { result, hollow } = e.resolveReroll(dice(5));
    expect(hollow).toBe(true);
    expect((result as { result: number }).result).toBe(5);
  });
});

describe('orientation', () => {
  it('planReveal preempts and returns an orientation when fate-auto-orient is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.forceEffects(['fate-auto-orient'], false);
    const { preempt, orientation } = e.planReveal();
    expect(preempt).toBe(true);
    expect(orientation === 'upright' || orientation === 'reversed').toBe(true);
  });

  it('planReveal does not preempt at baseline Fate', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99; // below any gate
    const { preempt, orientation } = e.planReveal();
    Math.random = orig;
    expect(preempt).toBe(false);
    expect(orientation).toBeNull();
  });
});

describe('dice pair (advantage/disadvantage/choice)', () => {
  it('rollDicePair returns two dice and keeps the higher on advantage', () => {
    const e = new GameEngine();
    startMinigame(e);
    const { dice: pair, keptIndex } = e.rollDicePair('advantage');
    expect(pair).toHaveLength(2);
    if (keptIndex !== null) {
      expect(pair[keptIndex].result).toBeGreaterThanOrEqual(pair[keptIndex === 0 ? 1 : 0].result);
    }
  });

  it('rollDicePair keeps neither on choice', () => {
    const e = new GameEngine();
    startMinigame(e);
    const { keptIndex } = e.rollDicePair('choice');
    expect(keptIndex).toBeNull();
  });
});

describe('planDiceRoll', () => {
  it('returns a valid mode and reports array', () => {
    const e = new GameEngine();
    startMinigame(e);
    const plan = e.planDiceRoll();
    expect(['single', 'advantage', 'disadvantage', 'choice']).toContain(plan.mode);
    expect(Array.isArray(plan.reports)).toBe(true);
  });
});

describe('method control', () => {
  it('Fate Ascendant no longer statically trims the pool (base stays 3)', () => {
    const e = new GameEngine();
    const orig = Math.random;
    Math.random = () => 0.99; // suppress the probabilistic fate-thin-pool roll
    try {
      e.loadState({ affinities: { ...e.getState().affinities, fate: 95 } });
      e.startTurn('self');
      expect(e.getState().availableMethods.length).toBe(3);
    } finally {
      Math.random = orig;
    }
  });

  it('fate-thin-pool thins the pool to 2 when it fires (probabilistic, forced here)', () => {
    const e = new GameEngine();
    e.forceEffects(['fate-thin-pool'], true);
    e.loadState({ affinities: { ...e.getState().affinities, fate: 70 } });
    e.startTurn('self');
    expect(e.getState().availableMethods.length).toBe(2);
    expect(e.getState().drawPhase!.effectReports.some((r) => r.responderId === 'fate-thin-pool')).toBe(true);
  });

  it('swapMethod feeds Will and yields a fresh pool', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.will;
    noJitter(() => e.swapMethod());
    expect(e.getState().affinities.will).toBeGreaterThan(before);
    expect(e.getState().availableMethods.length).toBeGreaterThanOrEqual(1);
  });
});

describe('peek wrapper + decline', () => {
  it('usePeek returns a non-empty leaning derived from the preview on success', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, light: 80 } });
    e.startTurn('self'); // beginRun drift 80→~70 (still ascendant); peek counters reset
    const orig = Math.random; Math.random = () => 0.0; // free first peek → success
    const r = e.usePeek(dice(18));
    Math.random = orig;
    expect(r.failed).toBe(false);
    expect(r.leaning.length).toBeGreaterThan(0);
  });

  it('declinePeek feeds Shadow', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.shadow;
    noJitter(() => e.declinePeek());
    expect(e.getState().affinities.shadow).toBeGreaterThan(before);
  });
});
