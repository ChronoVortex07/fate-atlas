import { describe, it, expect, vi } from 'vitest';
import { castHexagram, HEXAGRAMS, HEX_BY_BINARY, hexagramByBinary, drawHexagramCast, consolidateHexagram } from '../../data/iching';

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

describe('drawHexagramCast', () => {
  it('all-changing: all old-yin lines (sum 6) yield primaryNumber=2, relatingNumber=1, changingLines=[1..6]', () => {
    // Each line: 3 coins (random < 0.5 → 2 each, so 2+2+2=6 = old yin, changing) + 1 bias call (chaos=0 → never fires).
    // Math.random always returns 0: 0 < 0.5 → coin=2; bias check 0 < 0 → false.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const cast = drawHexagramCast({});
    expect(cast.lines.every((v) => v === 6)).toBe(true);
    expect(cast.changingLines).toEqual([1, 2, 3, 4, 5, 6]);
    // primary: all bits '0' → binary "000000" → hexagram #2
    expect(cast.primaryNumber).toBe(2);
    // relating: all changing → flip every '0' to '1' → "111111" → hexagram #1
    expect(cast.relatingNumber).toBe(1);
    expect(cast.relatingNumber).not.toBe(cast.primaryNumber);
    vi.restoreAllMocks();
  });
  it('no-changing: all young-yang lines (sum 7) yield primaryNumber=1, relatingNumber=primaryNumber, changingLines=[]', () => {
    // Per-line sequence [0, 0, 0.9, 0]: coin1=0<0.5→2, coin2=0<0.5→2, coin3=0.9<0.5→3 → sum=7 (young yang, not changing).
    // 4th value (0) is the chaos bias call; chaos=0 so changingBias=0 and the check never fires.
    const seq = [0, 0, 0.9, 0]; let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]);
    const cast = drawHexagramCast({});
    expect(cast.lines.every((v) => v === 7)).toBe(true);
    expect(cast.changingLines).toEqual([]);
    // primary: all bits '1' → binary "111111" → hexagram #1
    expect(cast.primaryNumber).toBe(1);
    // no changing lines → relating binary identical to primary
    expect(cast.relatingNumber).toBe(cast.primaryNumber);
    vi.restoreAllMocks();
  });
  it('consolidateHexagram returns the governing hexagram with reversible tag when changing', () => {
    const cast = { lines: [9,7,7,7,7,9] as any, primaryNumber: 1, relatingNumber: 2, changingLines: [1,6] };
    const res = consolidateHexagram(cast, 'primary');
    expect(res.hexagramNumber).toBe(1);
    expect(res.relatingNumber).toBe(2);
    expect(res.tags).toContain('changing-lines');
    expect(res.tags).toContain('reversible');
    expect(res.tags).toContain('governing-primary');
    const rel = consolidateHexagram(cast, 'relating');
    expect(rel.hexagramNumber).toBe(2);
    expect(rel.tags).toContain('governing-relating');
  });
});
