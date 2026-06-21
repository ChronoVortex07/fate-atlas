import { describe, it, expect } from 'vitest';
import { resolveRollMode } from '../../data/dice-modifiers';

describe('resolveRollMode', () => {
  it('no modifiers → single, no reroll', () => {
    expect(resolveRollMode([])).toEqual({ mode: 'single', offerReroll: false });
  });

  it('a single advantage → advantage', () => {
    expect(resolveRollMode(['advantage']).mode).toBe('advantage');
  });

  it('a single disadvantage → disadvantage', () => {
    expect(resolveRollMode(['disadvantage']).mode).toBe('disadvantage');
  });

  it('advantage + disadvantage cancel to single', () => {
    expect(resolveRollMode(['advantage', 'disadvantage']).mode).toBe('single');
  });

  it('net advantage wins when sources are unequal', () => {
    expect(resolveRollMode(['advantage', 'advantage', 'disadvantage']).mode).toBe('advantage');
  });

  it('choice beats both advantage and disadvantage', () => {
    expect(resolveRollMode(['advantage', 'disadvantage', 'choice']).mode).toBe('choice');
  });

  it('offer-reroll surfaces on a single/advantage result', () => {
    expect(resolveRollMode(['offer-reroll'])).toEqual({ mode: 'single', offerReroll: true });
    expect(resolveRollMode(['advantage', 'offer-reroll']).offerReroll).toBe(true);
  });

  it('offer-reroll is suppressed in choice mode', () => {
    expect(resolveRollMode(['choice', 'offer-reroll']).offerReroll).toBe(false);
  });
});
