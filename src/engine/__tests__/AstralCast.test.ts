import { describe, it, expect } from 'vitest';
import { planAstralCast, shouldOfferRecast } from '../astral';

describe('planAstralCast', () => {
  it('is single by default', () => {
    const p = planAstralCast({ light: 50, shadow: 50, will: 50 }, false);
    expect(p.mode).toBe('single');
    expect(p.offerRecast).toBe(false);
  });
  it('Light ascendant → favored', () => {
    expect(planAstralCast({ light: 70 }, false).mode).toBe('favored');
  });
  it('Shadow ascendant → clouded', () => {
    expect(planAstralCast({ shadow: 70 }, false).mode).toBe('clouded');
  });
  it('Will dominant → choice, and choice suppresses recast', () => {
    const p = planAstralCast({ will: 95 }, true);
    expect(p.mode).toBe('choice');
    expect(p.offerRecast).toBe(false);
  });
  it('offerRecast passes through outside choice mode', () => {
    expect(planAstralCast({}, true).offerRecast).toBe(true);
  });
});

describe('shouldOfferRecast', () => {
  it('never offers below Will Stirring', () => {
    expect(shouldOfferRecast({ will: 10 }, () => 0)).toBe(false);
  });
  it('offers at Will Stirring+ when the roll passes', () => {
    expect(shouldOfferRecast({ will: 45 }, () => 0)).toBe(true);   // stirring band, rng 0 < chance
    expect(shouldOfferRecast({ will: 45 }, () => 0.99)).toBe(false); // roll fails
  });
});
