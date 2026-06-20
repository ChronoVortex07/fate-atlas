import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';
import type { TarotResult } from '../types';

const defs = AFFINITY_DEFINITIONS;

const reversedCard: TarotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'reversed', symbol: '☉',
  meaningUpright: '...', meaningReversed: '...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'reversed'],
  themes: ['stagnation', 'illumination'],
  dimensions: { favorability: -0.5, certainty: -1.5, volatility: 1.5 },
  modifierRoles: ['subject'],
};

const uprightCard: TarotResult = {
  type: 'tarot', id: 'the-star', name: 'The Star', number: 17,
  orientation: 'upright', symbol: '⭐',
  meaningUpright: 'Hope...', meaningReversed: 'Despair...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'star-archetype', 'upright'],
  themes: ['renewal', 'harmony'],
  dimensions: { favorability: 2.0, certainty: -0.5, volatility: 0.5 },
  modifierRoles: ['subject', 'effect'],
};

describe('AffinityEngine', () => {
  it('starts every affinity at baseline 50', () => {
    const e = new AffinityEngine(defs);
    const s = e.getState();
    expect(s.chaos).toBe(50);
    expect(s.order).toBe(50);
    expect(s.fate).toBe(50);
  });

  it('applyResultTags increases chaos for reversed/random results', () => {
    const e = new AffinityEngine(defs);
    e.applyResultTags(reversedCard);
    expect(e.getState().chaos).toBeGreaterThan(50);
  });

  it('applyResultTags increases order for upright results', () => {
    const e = new AffinityEngine(defs);
    e.applyResultTags(uprightCard);
    expect(e.getState().order).toBeGreaterThan(50);
  });

  it('clamps values to 0–100', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 99, order: 1 });
    e.applyResultTags(reversedCard);
    e.applyResultTags(reversedCard);
    expect(e.getState().chaos).toBeLessThanOrEqual(100);
    expect(e.getState().chaos).toBeGreaterThanOrEqual(0);
  });

  it('bandOf reports the current band of an affinity', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 85, order: 20 });
    expect(e.bandOf('chaos')).toBe('dominant');
    expect(e.bandOf('order')).toBe('latent');
  });

  it('getHint returns band flavor when out of latent, null when latent', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 70 });
    expect(e.getHint('chaos')).toBeTruthy();
    e.setState({ chaos: 10 });
    expect(e.getHint('chaos')).toBeNull(); // latent pool is empty
  });

  it('serialize and loadFrom round-trip all six', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 70, order: 30, fate: 55 });
    const json = e.serialize();
    const e2 = new AffinityEngine(defs);
    e2.loadFrom(json);
    expect(e2.getState()).toEqual(e.getState());
  });
});
