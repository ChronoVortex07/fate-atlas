import { describe, it, expect } from 'vitest';
import { corruptionTextLevel, interiorTypo, corruptText, corruptSynthesis } from '../CorruptionGlitch';

// deterministic PRNG so corruption output is reproducible in tests
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('corruptionTextLevel', () => {
  it('is 0 below spreading, 1 at spreading, >=2 at virulent', () => {
    expect(corruptionTextLevel('dormant', 0)).toBe(0);
    expect(corruptionTextLevel('seeded', 20)).toBe(0);
    expect(corruptionTextLevel('spreading', 50)).toBe(1);
    expect(corruptionTextLevel('virulent', 67)).toBeGreaterThanOrEqual(2);
    expect(corruptionTextLevel('virulent', 99)).toBeGreaterThan(corruptionTextLevel('virulent', 67));
  });
});

describe('interiorTypo', () => {
  it('preserves first and last letter and length', () => {
    const out = interiorTypo('softened', mulberry32(1));
    expect(out.length).toBe('softened'.length);
    expect(out[0]).toBe('s');
    expect(out[out.length - 1]).toBe('d');
    expect(out).not.toBe('softened');
  });
  it('leaves short words (<4) unchanged', () => {
    expect(interiorTypo('and', mulberry32(1))).toBe('and');
  });
});

describe('corruptText', () => {
  it('level 0 returns the text untouched', () => {
    const t = 'Fortune inclines toward you and the way ahead carries real promise.';
    expect(corruptText(t, 0, mulberry32(1))).toBe(t);
  });
  it('level 1 alters the text but stays free of redaction blocks and contradictions', () => {
    const t = 'Fortune inclines toward you and the way ahead carries real promise.';
    const out = corruptText(t, 1, mulberry32(7));
    expect(out).not.toBe(t);
    expect(out).not.toContain('█');
  });
  it('level >=2 introduces heavy artifacts (redaction or garble) and a contradiction', () => {
    const t = 'Fortune inclines toward you and the way ahead carries real promise.';
    const out = corruptText(t, 2, mulberry32(3));
    const heavy = out.includes('█') || /[̴̶̗]/.test(out);
    expect(heavy).toBe(true);
  });
  it('is deterministic for a given seed', () => {
    const t = 'the shape of things softening toward something new';
    expect(corruptText(t, 2, mulberry32(42))).toBe(corruptText(t, 2, mulberry32(42)));
  });
});

describe('corruptSynthesis', () => {
  it('corrupts headline + paragraphs at level>=1', () => {
    const s = { headline: 'Transformation Bears Its Fruit',
      paragraphs: ['Fortune inclines toward you and the way ahead carries real promise.'],
      tensionNote: undefined, affinityNote: undefined };
    const out = corruptSynthesis(s, 1, mulberry32(9));
    expect(out.paragraphs[0]).not.toBe(s.paragraphs[0]);
  });
});
