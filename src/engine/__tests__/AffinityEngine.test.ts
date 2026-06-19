import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { CHAOS_AFFINITY, ORDER_AFFINITY } from '../../data/affinities';
import type { TarotResult } from '../types';

const definitions = [CHAOS_AFFINITY, ORDER_AFFINITY];

const reversedCard: TarotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'reversed', symbol: '☉',
  meaningUpright: '...', meaningReversed: '...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'reversed'],
};

const uprightCard: TarotResult = {
  type: 'tarot', id: 'the-star', name: 'The Star', number: 17,
  orientation: 'upright', symbol: '⭐',
  meaningUpright: 'Hope...', meaningReversed: 'Despair...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'star-archetype', 'upright'],
};

describe('AffinityEngine', () => {
  it('starts with both affinities at 0.5', () => {
    const engine = new AffinityEngine(definitions);
    const state = engine.getState();
    expect(state.chaos).toBe(0.5);
    expect(state.order).toBe(0.5);
  });

  it('apply() increases chaos for reversed/random results', () => {
    const engine = new AffinityEngine(definitions);
    engine.apply([reversedCard]);
    expect(engine.getState().chaos).toBeGreaterThan(0.5);
  });

  it('apply() increases order for upright/stable results', () => {
    const engine = new AffinityEngine(definitions);
    engine.apply([uprightCard]);
    expect(engine.getState().order).toBeGreaterThan(0.5);
  });

  it('clamps values to 0.0–1.0', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.99, order: 0.01 });
    engine.apply([reversedCard]); // chaos should not exceed 1.0
    engine.apply([reversedCard]);
    expect(engine.getState().chaos).toBeLessThanOrEqual(1.0);
  });

  it('isDominant() returns true when affinity >= threshold', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.6, order: 0.3 });
    expect(engine.isDominant('chaos')).toBe(true);
    expect(engine.isDominant('order')).toBe(false);
  });

  it('getHint() returns flavor text for dominant affinity', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.6, order: 0.3 });
    expect(engine.getHint('chaos')).toBeTruthy();
    expect(engine.getHint('order')).toBeNull();
  });

  it('serialize() and loadFrom() round-trip', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.7, order: 0.3 });
    const json = engine.serialize();

    const engine2 = new AffinityEngine(definitions);
    engine2.loadFrom(json);
    expect(engine2.getState()).toEqual({ chaos: 0.7, order: 0.3 });
  });
});
