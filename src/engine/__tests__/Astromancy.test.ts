import { describe, it, expect } from 'vitest';
import type { AstralResult, AstralCast } from '../types';
import { PLANETS, SIGNS, HOUSES, DIGNITY } from '../../data/astromancy';

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

describe('astromancy tables', () => {
  it('defines all 12 planets and 12 signs', () => {
    expect(Object.keys(PLANETS)).toHaveLength(12);
    expect(Object.keys(SIGNS)).toHaveLength(12);
  });
  it('defines 12 houses, indexed 1..12 with a theme each', () => {
    expect(HOUSES).toHaveLength(12);
    expect(HOUSES[0].house).toBe(1);
    expect(HOUSES[11].house).toBe(12);
    expect(HOUSES.every((h) => typeof h.theme === 'string')).toBe(true);
  });
  it('every sign has an element and modality', () => {
    expect(Object.values(SIGNS).every((s) => !!s.element && !!s.modality)).toBe(true);
  });
  it('dignity table marks Mars dignified in Aries and debilitated in Libra', () => {
    expect(DIGNITY.mars.dignified).toContain('aries');
    expect(DIGNITY.mars.debilitated).toContain('libra');
  });
  it('planet dimension signatures stay within [-2,2]', () => {
    for (const p of Object.values(PLANETS)) {
      for (const v of Object.values(p.dimensions)) {
        expect(v).toBeGreaterThanOrEqual(-2);
        expect(v).toBeLessThanOrEqual(2);
      }
    }
  });
});
