import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { TarotResult, DiceResult } from '../types';

const tarot = (orientation: 'upright' | 'reversed'): TarotResult => ({
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0, orientation, symbol: '☉',
  meaningUpright: 'x', meaningReversed: 'y',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', orientation],
  themes: ['renewal'], dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
  modifierRoles: ['subject'],
});

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

const dice = (result: number): DiceResult => ({
  type: 'd20', result, threshold: result <= 9 ? 'low' : 'neutral', interpretation: 'x',
  tags: ['roll', 'numeric'], themes: ['stagnation'],
  dimensions: { favorability: -1, certainty: 0, volatility: 0.5 }, modifierRoles: ['effect'],
} as DiceResult);

describe('reroll system', () => {
  it('offerReroll fires with probability 1 when forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'offer-reroll' });
    expect(e.offerReroll()).toBe(true);
  });

  it('takeReroll feeds Will and redraws the active dice slot when not hollow', () => {
    const e = new GameEngine();
    startMinigame(e);
    noJitter(() => e.completeMinigame(dice(5)));
    while (e.getState().interactionQueue.length > 0) e.advanceInteractionQueue();
    const beforeWill = e.getState().affinities.will;
    // Fate is at baseline (stirring < ascendant) so hollow can't fire unforced; stub RNG high.
    const orig = Math.random; Math.random = () => 0.99;
    const { hollow } = e.takeReroll();
    Math.random = orig;
    expect(hollow).toBe(false);
    expect(e.getState().affinities.will).toBeGreaterThan(beforeWill);
  });

  it('takeReroll is hollow (same result kept) when hollow-reroll is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    noJitter(() => e.completeMinigame(dice(5)));
    while (e.getState().interactionQueue.length > 0) e.advanceInteractionQueue();
    const idx = e.getState().activeSlotIndex!;
    e.loadState({ debugForcedEffect: 'hollow-reroll' });
    const { hollow } = e.takeReroll();
    expect(hollow).toBe(true);
    expect((e.getState().turnResults[idx] as { result: number }).result).toBe(5); // unchanged
  });
});

// Pre-commit reroll used by the dice minigame's Will-offered prompt. Unlike
// takeReroll (post-commit, mutates the active slot), resolveReroll returns the
// next result for the component to commit, and surfaces Fate's hollow outcome.
describe('resolveReroll (pre-commit dice reroll)', () => {
  it('returns a fresh result (not hollow) at baseline Fate', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99; // baseline Fate < ascendant → never hollow
    const { hollow } = e.resolveReroll(dice(5));
    Math.random = orig;
    expect(hollow).toBe(false);
  });

  it('returns the same result (hollow) when hollow-reroll is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'hollow-reroll' });
    const { result, hollow } = e.resolveReroll(dice(5));
    expect(hollow).toBe(true);
    expect((result as { result: number }).result).toBe(5);
  });

  // A forced hollow reroll implies the offer was presented — otherwise the player
  // could never trigger it. offerReroll must surface it without consuming the flag,
  // so the subsequent resolveReroll can still read it.
  it('offerReroll fires for a forced hollow-reroll and leaves the flag for resolveReroll', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'hollow-reroll' });
    expect(e.offerReroll()).toBe(true);
    expect(e.getState().debugForcedEffect).toBe('hollow-reroll'); // not consumed
    expect(e.resolveReroll(dice(7)).hollow).toBe(true);
  });
});

describe('resolveTarotPick (Fate card-swap)', () => {
  const hand = [
    tarot('upright'),
    { ...tarot('reversed'), id: 'the-star', name: 'The Star' },
    { ...tarot('upright'), id: 'death', name: 'Death' },
  ];

  it('returns the chosen card when nothing fires', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99;
    const { card, swapped } = e.resolveTarotPick(0, hand);
    Math.random = orig;
    expect(swapped).toBe(false);
    expect(card.id).toBe('the-fool');
  });

  it('returns a different card when card-swap is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'card-swap' });
    const { card, swapped } = e.resolveTarotPick(0, hand);
    expect(swapped).toBe(true);
    expect(card.id).not.toBe('the-fool');
  });
});

describe('orientation + keep-one-of-two', () => {
  it('maybeAutoOrient returns an orientation when forced, else null at baseline', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99;
    expect(e.maybeAutoOrient()).toBeNull();
    Math.random = orig;
    e.loadState({ debugForcedEffect: 'auto-orient' });
    expect(['upright', 'reversed']).toContain(e.maybeAutoOrient());
  });

  it('setOrientation feeds Will', () => {
    const e = new GameEngine();
    startMinigame(e);
    const before = e.getState().affinities.will;
    noJitter(() => e.setOrientation('reversed'));
    expect(e.getState().affinities.will).toBeGreaterThan(before);
  });

});

describe('method control', () => {
  it('Fate Ascendant trims the pool to 2 methods at startTurn', () => {
    const e = new GameEngine();
    // Seed Fate high before the turn; beginRun drifts 95→~80, still Ascendant.
    e.loadState({ affinities: { ...e.getState().affinities, fate: 95 } });
    e.startTurn('self');
    expect(e.getState().availableMethods.length).toBe(2);
  });

  it('swapMethod feeds Will and yields a fresh pool', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.will;
    noJitter(() => e.swapMethod());
    expect(e.getState().affinities.will).toBeGreaterThan(before);
    expect(e.getState().availableMethods.length).toBeGreaterThanOrEqual(1);
  });

  it('maybeForceMethod fires with probability 1 when forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'force-method' });
    expect(e.maybeForceMethod()).toBe(true);
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
