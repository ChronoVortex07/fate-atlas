import { describe, it, expect } from 'vitest';
import type { AstralResult, AstralCast } from '../types';

describe('astral types', () => {
  it('an AstralResult is assignable with the required surface', () => {
    const cast: AstralCast = { planet: 'mars', planetHouse: 7, sign: 'aries', signHouse: 7, omens: [] };
    const r: AstralResult = {
      type: 'astral', id: 'astral:mars-aries-h7', name: 'Mars in Aries', symbol: '♂',
      interpretation: 'x', planet: 'mars', sign: 'aries', house: 7, aspect: 'conjunction',
      themes: ['conflict'], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
      modifierRoles: ['action'], tags: ['astral'], cast,
    };
    expect(r.type).toBe('astral');
  });
});
