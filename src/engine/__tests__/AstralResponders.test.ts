import { describe, it, expect } from 'vitest';
import { buildAstralResponders } from '../responders/astral';
import { consolidateCast } from '../../data/astromancy';
import type { PhaseContext } from '../events/types';
import type { AstralCast } from '../types';

const ctx = (cast: AstralCast): PhaseContext => ({
  trigger: 'astral:commit',
  affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
  slots: [], hand: null, spread: [], minigame: null, event: null,
  draft: { outcome: consolidateCast(cast) }, rng: () => 0,
});
const R = (id: string) => buildAstralResponders().find((r) => r.id === id)!;
const cast = (o: Partial<AstralCast>): AstralCast => ({ planet: 'mars', planetHouse: 7, sign: 'aries', signHouse: 7, omens: [], ...o });

describe('astral symbolic responders', () => {
  it('dignity fires for a dignified planet (Mars in Aries) and amplifies a dimension', () => {
    const c = ctx(cast({ sign: 'aries' }));
    const r = R('astral-dignity');
    expect(r.condition(c)).toBe(true);
    const before = { ...(c.draft.outcome as any).dimensions };
    r.apply(c);
    const after = (c.draft.outcome as any).dimensions;
    const changed = (['favorability','certainty','volatility'] as const).some((a) => after[a] !== before[a]);
    expect(changed).toBe(true);
  });
  it('dignity all-zero-dimensions fallback: dominantAxis defaults to favorability, amplify is +0.5', () => {
    // When all dimensions are 0, dominantAxis returns 'favorability' (strict > keeps initial).
    // Math.sign(0 || 1) = +1, so favorability goes from 0 to +0.5.
    const c = ctx(cast({ sign: 'aries' }));
    // Force all dimensions to zero on the draft outcome
    (c.draft.outcome as any).dimensions = { favorability: 0, certainty: 0, volatility: 0 };
    const r = R('astral-dignity');
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    const dims = (c.draft.outcome as any).dimensions;
    expect(dims.favorability).toBe(0.5);
    expect(dims.certainty).toBe(0);
    expect(dims.volatility).toBe(0);
  });
  it('debility fires for Mars in Libra and not for a dignified cast', () => {
    expect(R('astral-debility').condition(ctx(cast({ sign: 'libra' })))).toBe(true);
    expect(R('astral-debility').condition(ctx(cast({ sign: 'aries' })))).toBe(false);
  });
  it('great-trine fires for a benefic at trine', () => {
    // Venus, planetHouse 1 vs signHouse 5 = trine
    expect(R('astral-great-trine').condition(ctx(cast({ planet: 'venus', planetHouse: 1, signHouse: 5 })))).toBe(true);
  });
  it('duel fires for Mars at opposition', () => {
    expect(R('astral-duel').condition(ctx(cast({ planet: 'mars', planetHouse: 1, signHouse: 7 })))).toBe(true);
  });
  it("saturn's gate fires for Saturn in house 10", () => {
    expect(R('astral-saturns-gate').condition(ctx(cast({ planet: 'saturn', planetHouse: 10 })))).toBe(true);
  });
});

describe('astral omen responders', () => {
  it('errant-star fires on the off-board omen and spawns a second cast', () => {
    const c = ctx(cast({ omens: ['errant-star'] }));
    const r = R('astral-errant-star');
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('astral');
  });
  it('conjunction-crowned fires only with the omen tag', () => {
    expect(R('astral-conjunction-crowned').condition(ctx(cast({ omens: ['crowned-conjunction'] })))).toBe(true);
    expect(R('astral-conjunction-crowned').condition(ctx(cast({ omens: [] })))).toBe(false);
  });
  it('veiled-oracle fires on the cocked-die omen', () => {
    expect(R('astral-veiled-oracle').condition(ctx(cast({ omens: ['veiled-oracle'] })))).toBe(true);
  });
});
