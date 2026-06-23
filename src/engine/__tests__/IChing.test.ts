import { describe, it, expect } from 'vitest';
import { castHexagram, HEXAGRAMS, HEX_BY_BINARY, hexagramByBinary } from '../../data/iching';

describe('I Ching data', () => {
  it('has 64 hexagrams', () => {
    expect(HEXAGRAMS).toHaveLength(64);
  });

  it('each hexagram has required fields', () => {
    for (const h of HEXAGRAMS) {
      expect(h.number).toBeGreaterThanOrEqual(1);
      expect(h.number).toBeLessThanOrEqual(64);
      expect(h.name).toBeTruthy();
      expect(h.symbol).toBeTruthy();
      expect(h.judgment).toBeTruthy();
    }
  });

  it('all hexagram numbers are unique', () => {
    const numbers = HEXAGRAMS.map((h) => h.number);
    expect(new Set(numbers).size).toBe(64);
  });
});

describe('King Wen binary table', () => {
  it('has 64 unique 6-bit binary patterns covering all hexagrams', () => {
    const set = new Set(HEXAGRAMS.map((h) => h.binary));
    expect(set.size).toBe(64);
    for (const h of HEXAGRAMS) expect(h.binary).toMatch(/^[01]{6}$/);
  });
  it('maps the canonical anchor hexagrams correctly', () => {
    expect(hexagramByBinary('111111').number).toBe(1);
    expect(hexagramByBinary('000000').number).toBe(2);
    expect(hexagramByBinary('111000').number).toBe(11);
    expect(hexagramByBinary('000111').number).toBe(12);
    expect(hexagramByBinary('010010').number).toBe(29);
    expect(hexagramByBinary('101101').number).toBe(30);
    expect(hexagramByBinary('101010').number).toBe(63);
    expect(hexagramByBinary('010101').number).toBe(64);
  });
  it('round-trips every hexagram through the lookup', () => {
    for (const h of HEXAGRAMS) expect(HEX_BY_BINARY[h.binary].number).toBe(h.number);
  });
});

describe('castHexagram', () => {
  it('returns a valid IChingResult', () => {
    const result = castHexagram({ chaos: 0, order: 0 });
    expect(result.type).toBe('iching');
    expect(result.hexagramNumber).toBeGreaterThanOrEqual(1);
    expect(result.hexagramNumber).toBeLessThanOrEqual(64);
    expect(result.tags).toContain('draw');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('binary');
    expect(result.changingLines.length).toBeGreaterThanOrEqual(0);
    expect(result.changingLines.length).toBeLessThanOrEqual(6);
  });

  it('includes [changing-lines] tag when there are changing lines', () => {
    let hadChanging = false;
    for (let i = 0; i < 50; i++) {
      const result = castHexagram({ chaos: 50, order: 0 });
      if (result.changingLines.length > 0) {
        hadChanging = true;
        expect(result.tags).toContain('changing-lines');
        break;
      }
    }
    // Should find at least one with changing lines in 50 attempts
    expect(hadChanging).toBe(true);
  });
});
