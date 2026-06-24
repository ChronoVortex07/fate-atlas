import { describe, it, expect } from 'vitest';
import { planRuneCast, resolveGoverning, shouldOfferRecast } from '../runes';
import { GameEngine } from '../GameEngine';
import type { RuneScatter, LandedRune } from '../types';

const lo = 20, asc = 70, dom = 90;
const base = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };

describe('planRuneCast', () => {
  it('defaults to single', () => {
    expect(planRuneCast(base, false).mode).toBe('single');
  });
  it('Will dominant → claim, and claim suppresses the recast offer', () => {
    const p = planRuneCast({ ...base, will: dom, fate: lo }, true);
    expect(p.mode).toBe('claim');
    expect(p.offerRecast).toBe(false);
  });
  it('Light ascendant → favored; Shadow ascendant → clouded', () => {
    expect(planRuneCast({ ...base, light: asc }, false).mode).toBe('favored');
    expect(planRuneCast({ ...base, shadow: asc, light: lo }, false).mode).toBe('clouded');
  });
  it('drift scales with the Fate band', () => {
    expect(planRuneCast({ ...base, fate: lo }, false).drift).toBe(0);
    expect(planRuneCast({ ...base, fate: dom, will: lo }, false).drift).toBe(1);
  });
  it('Fate ascendant+ suppresses the recast offer', () => {
    expect(planRuneCast({ ...base, fate: asc, will: lo }, true).offerRecast).toBe(false);
  });
});

const stone = (rune: LandedRune['rune'], faceUp: boolean, orientation: LandedRune['orientation'], x: number): LandedRune =>
  ({ rune, faceUp, orientation, ring: 'field', x, y: 0 });

describe('resolveGoverning', () => {
  const scatter: RuneScatter = {
    stones: [stone('sowilo', true, 'upright', 0.2), stone('hagalaz', true, 'upright', 0.3)],
    governingIndex: 0, omens: [],
  };
  it('single keeps the nearest-Heart default', () => {
    expect(resolveGoverning(scatter, 'single')).toBe(0);
  });
  it('favored picks the brighter; clouded the dimmer', () => {
    expect(resolveGoverning(scatter, 'favored')).toBe(0); // sowilo brighter
    expect(resolveGoverning(scatter, 'clouded')).toBe(1); // hagalaz dimmer
  });
});

describe('shouldOfferRecast', () => {
  it('is false below stirring', () => {
    expect(shouldOfferRecast({ will: 10 }, () => 0.0)).toBe(false);
  });
});

describe('engine rune integration', () => {
  it('exposes planRuneCast returning a valid mode', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    const p = engine.planRuneCast();
    expect(['single', 'favored', 'clouded', 'claim']).toContain(p.mode);
  });
});
