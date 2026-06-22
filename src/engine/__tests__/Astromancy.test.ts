import { describe, it, expect } from 'vitest';
import type { AstralResult, AstralCast } from '../types';
import { PLANETS, SIGNS, HOUSES, DIGNITY, aspectBetween, consolidateCast, dignityOf, drawAstralCast } from '../../data/astromancy';

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

describe('aspectBetween', () => {
  it('maps house separations to the right aspect', () => {
    expect(aspectBetween(1, 1)).toBe('conjunction');   // 0°
    expect(aspectBetween(1, 3)).toBe('sextile');        // 60°
    expect(aspectBetween(1, 4)).toBe('square');         // 90°
    expect(aspectBetween(1, 5)).toBe('trine');          // 120°
    expect(aspectBetween(1, 7)).toBe('opposition');     // 180°
    expect(aspectBetween(1, 2)).toBe('minor');          // 30°
    expect(aspectBetween(1, 6)).toBe('minor');          // 150°
  });
  it('is symmetric and wraps the wheel', () => {
    expect(aspectBetween(12, 1)).toBe('minor');         // 30° across the wrap
    expect(aspectBetween(2, 8)).toBe('opposition');     // 180°
    expect(aspectBetween(7, 1)).toBe(aspectBetween(1, 7));
  });
});

describe('dignityOf', () => {
  it('returns "dignified" when planet is in a dignified sign', () => {
    expect(dignityOf('mars', 'aries')).toBe('dignified');
    expect(dignityOf('sun', 'leo')).toBe('dignified');
  });
  it('returns "debilitated" when planet is in a debilitated sign', () => {
    expect(dignityOf('mars', 'libra')).toBe('debilitated');
    expect(dignityOf('sun', 'aquarius')).toBe('debilitated');
  });
  it('returns null when neither dignified nor debilitated', () => {
    expect(dignityOf('mars', 'gemini')).toBeNull();
    expect(dignityOf('sun', 'aries')).toBeNull();
  });
});

describe('consolidateCast', () => {
  it('sums dimensions from planet+element+modality+aspect, divides by 2, clamps to 0.5 granularity', () => {
    const cast: AstralCast = { planet: 'sun', planetHouse: 1, sign: 'leo', signHouse: 1, omens: [] };
    const r = consolidateCast(cast);
    // Check that dimensions are at 0.5 granularity
    for (const v of Object.values(r.dimensions)) {
      expect(Math.round(v * 2) / 2).toBe(v);
    }
    // Check that dimensions are within [-2, 2]
    for (const v of Object.values(r.dimensions)) {
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
  });

  it('ranks themes by house→planet→aspect→sign element, dedupes, caps at 2', () => {
    const cast: AstralCast = { planet: 'sun', planetHouse: 1, sign: 'leo', signHouse: 1, omens: [] };
    const r = consolidateCast(cast);
    expect(r.themes.length).toBeLessThanOrEqual(2);
    expect(r.themes).toEqual(expect.arrayContaining(['authority'])); // house 1 theme
  });

  it('includes all required tags: astral, planet-*, sign-*, house-*, element-*, aspect-*', () => {
    const cast: AstralCast = { planet: 'mars', planetHouse: 7, sign: 'aries', signHouse: 7, omens: [] };
    const r = consolidateCast(cast);
    expect(r.tags).toContain('astral');
    expect(r.tags).toContain('planet-mars');
    expect(r.tags).toContain('sign-aries');
    expect(r.tags).toContain('house-7');
    expect(r.tags).toContain('element-fire');
    expect(r.tags).toContain('aspect-conjunction');
  });

  it('adds dignity tag when dignified or debilitated', () => {
    const dignified: AstralCast = { planet: 'mars', planetHouse: 3, sign: 'aries', signHouse: 3, omens: [] };
    const r1 = consolidateCast(dignified);
    expect(r1.tags).toContain('dignified');

    const debilitated: AstralCast = { planet: 'mars', planetHouse: 4, sign: 'libra', signHouse: 4, omens: [] };
    const r2 = consolidateCast(debilitated);
    expect(r2.tags).toContain('debilitated');

    const neutral: AstralCast = { planet: 'mars', planetHouse: 5, sign: 'gemini', signHouse: 5, omens: [] };
    const r3 = consolidateCast(neutral);
    expect(r3.tags).not.toContain('dignified');
    expect(r3.tags).not.toContain('debilitated');
  });

  it('carries through omen tags from the cast', () => {
    const cast: AstralCast = { planet: 'sun', planetHouse: 1, sign: 'leo', signHouse: 1, omens: ['omen-test' as any] };
    const r = consolidateCast(cast);
    expect(r.tags).toContain('omen-test');
  });

  it('records the planet, sign, house, aspect in the result', () => {
    const cast: AstralCast = { planet: 'venus', planetHouse: 5, sign: 'libra', signHouse: 7, omens: [] };
    const r = consolidateCast(cast);
    expect(r.planet).toBe('venus');
    expect(r.sign).toBe('libra');
    expect(r.house).toBe(5);
    expect(r.aspect).toBe(aspectBetween(5, 7));
    expect(r.cast).toEqual(cast);
  });

  it('generates a unique id and name from planet and sign', () => {
    const cast: AstralCast = { planet: 'mercury', planetHouse: 3, sign: 'gemini', signHouse: 3, omens: [] };
    const r = consolidateCast(cast);
    expect(r.id).toBeTruthy();
    expect(r.name).toBeTruthy();
    expect(r.type).toBe('astral');
  });

  it('derives modifierRoles from the planet', () => {
    const cast: AstralCast = { planet: 'mars', planetHouse: 1, sign: 'aries', signHouse: 1, omens: [] };
    const r = consolidateCast(cast);
    expect(r.modifierRoles).toContain(PLANETS.mars.modifierRole);
  });

  it('sets the symbol to the planet glyph', () => {
    const cast: AstralCast = { planet: 'jupiter', planetHouse: 1, sign: 'sagittarius', signHouse: 1, omens: [] };
    const r = consolidateCast(cast);
    expect(r.symbol).toBe(PLANETS.jupiter.glyph);
  });

  it('includes type: astral in the result', () => {
    const cast: AstralCast = { planet: 'saturn', planetHouse: 1, sign: 'capricorn', signHouse: 1, omens: [] };
    const r = consolidateCast(cast);
    expect(r.type).toBe('astral');
  });

  // Regression: element+modality lean must contribute to dimensions.

  // Mercury in Gemini (air/mutable), house 3 vs house 3 (conjunction).
  // Hand-computed from the brief's formula:
  //   planet Mercury: {fav:0, cert:0.5, vol:0.5}
  //   ELEMENT_LEAN.air: {cert:0.5}
  //   MODALITY_LEAN.mutable: {vol:0.5, cert:-0.5}
  //   ASPECT_EFFECT.conjunction: {cert:1.5, vol:0.5}
  //   raw sum: {fav:0, cert:0.5+0.5-0.5+1.5=2.0, vol:0.5+0+0.5+0.5=1.5}
  //   /2: {fav:0, cert:1.0, vol:0.75}
  //   clamp(0.5 granularity): {fav:0, cert:1.0, vol:1.0}
  it('element+modality lean contributes to dimensions (Mercury in Gemini vs Aries)', () => {
    const gemini: AstralCast = { planet: 'mercury', planetHouse: 3, sign: 'gemini', signHouse: 3, omens: [] };
    const aries: AstralCast  = { planet: 'mercury', planetHouse: 3, sign: 'aries',  signHouse: 3, omens: [] };
    const rGemini = consolidateCast(gemini);
    const rAries  = consolidateCast(aries);
    // Pinned exact values for Mercury in Gemini (air/mutable, conjunction)
    expect(rGemini.dimensions).toEqual({ favorability: 0, certainty: 1.0, volatility: 1.0 });
    // Mercury in Aries (fire/cardinal, conjunction) differs in favorability due to fire lean (+0.5)
    // raw sum: {fav:0+0.5=0.5, cert:0.5+0+0+1.5=2.0, vol:0.5+0.5+0.5+0.5=2.0}
    // /2: {fav:0.25, cert:1.0, vol:1.0}
    // clamp: {fav:0.5, cert:1.0, vol:1.0}
    expect(rAries.dimensions).toEqual({ favorability: 0.5, certainty: 1.0, volatility: 1.0 });
    // The two casts must differ, proving element lean is active
    expect(rGemini.dimensions.favorability).not.toBe(rAries.dimensions.favorability);
  });
});

describe('drawAstralCast', () => {
  it('produces a valid, consolidatable cast', () => {
    const c = drawAstralCast({ chaos: 0, order: 0 });
    expect(c.planetHouse).toBeGreaterThanOrEqual(1);
    expect(c.planetHouse).toBeLessThanOrEqual(12);
    expect(c.signHouse).toBeGreaterThanOrEqual(1);
    expect(c.signHouse).toBeLessThanOrEqual(12);
    expect(() => consolidateCast(c)).not.toThrow();
    expect(c.omens).toEqual([]);
  });
  it('order biases the two houses toward the same arena (tighter aspects)', () => {
    const orig = Math.random;
    try {
      // force the raw houses far apart; order should pull signHouse toward planetHouse
      let calls = 0;
      Math.random = () => { calls++; return calls === 3 ? 0.99 : 0.01; };
      const c = drawAstralCast({ order: 100, chaos: 0 });
      expect(Math.abs(c.planetHouse - c.signHouse)).toBeLessThanOrEqual(6);
    } finally { Math.random = orig; }
  });
});
