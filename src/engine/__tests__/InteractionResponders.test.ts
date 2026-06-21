import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildInteractionResponders } from '../responders/interactions';
import type { PhaseContext } from '../events/types';
import { defaultAffinityState } from '../../data/affinities';

const fool = { type: 'tarot', tags: ['major-arcana', 'fool-archetype', 'reversible'], orientation: 'upright' } as any;
const critLow = { type: 'd20', threshold: 'critical-low', tags: ['threshold', 'critical-low'] } as any;
const uprightCard = { type: 'tarot', orientation: 'upright', tags: ['major-arcana', 'reversible'] } as any;

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  const base: PhaseContext = {
    trigger: 't', affinities: defaultAffinityState(), slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.0, draft: {},
  };
  return { ...base, ...over };
}
const noDebug = { forced: [], isolate: false };

describe('interaction responders', () => {
  it('fool-reroll marks the die for redraw when The Fool is in the spread', () => {
    const c = ctx({ trigger: 'dice:roll', slots: [fool], spread: [fool], draft: { outcome: { type: 'd20' } as any } });
    dispatch('dice:roll', c, buildInteractionResponders(), noDebug);
    expect(c.draft.rerollOutcome).toBe(true);
  });

  it('critical-resonance inverts an upright tarot when a critical-low die is present', () => {
    const card = { ...uprightCard };
    const c = ctx({ trigger: 'tarot:commit', slots: [critLow], spread: [critLow, card], draft: { outcome: card } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect((c.draft.outcome as any).orientation).toBe('reversed');
  });

  it('mirror flips exactly two reversible items', () => {
    const a = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
    const b = { type: 'tarot', orientation: 'reversed', tags: ['reversible'] } as any;
    const c = ctx({ trigger: 'tarot:commit', spread: [a, b], rng: () => 0, draft: { outcome: b } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect(a.orientation).toBe('reversed');
    expect(b.orientation).toBe('upright');
  });
});
