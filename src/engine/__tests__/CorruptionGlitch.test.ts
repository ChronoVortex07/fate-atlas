import { describe, it, expect } from 'vitest';
import { corruptionTextLevel, interiorTypo, corruptText, corruptSegments, segmentsToText, corruptSynthesisSegments, SEED_OMENS, seedOmen, appendSeedOmen } from '../CorruptionGlitch';
import type { GlitchSegment } from '../types';

const countStyle = (segs: GlitchSegment[], style: string) => segs.filter((s) => s.style === style).length;

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

const LONG = 'Fortune inclines toward you and the way ahead carries real promise.';

describe('segmentsToText', () => {
  it('joins plain segments back to their text', () => {
    expect(segmentsToText([{ text: 'hello ' }, { text: 'world' }])).toBe('hello world');
  });
  it('renders a redacted segment as block characters, hiding its text', () => {
    const out = segmentsToText([{ text: 'secret', style: 'redact' }]);
    expect(out).toMatch(/^█+$/);
    expect(out).not.toContain('secret');
  });
  it('keeps a ghost whisper as plain text', () => {
    expect(segmentsToText([{ text: '(the way ahead does not exist)', style: 'ghost' }]))
      .toBe('(the way ahead does not exist)');
  });
  it('round-trips a clean (level 0) corruption to the original text', () => {
    expect(segmentsToText(corruptSegments(LONG, 0, mulberry32(1)))).toBe(LONG);
  });
});

describe('corruptSegments', () => {
  it('level 0 returns a single untouched, unstyled segment', () => {
    const segs = corruptSegments(LONG, 0, mulberry32(1));
    expect(segs).toEqual([{ text: LONG }]);
  });

  it('level 1 alters text but applies no glitch styling, redaction, or whispers', () => {
    const segs = corruptSegments(LONG, 1, mulberry32(7));
    expect(segmentsToText(segs)).not.toBe(LONG);
    expect(segs.every((s) => s.style === undefined)).toBe(true);
  });

  it('early virulent (level 2) uses at most one redaction and surfaces a whisper', () => {
    const segs = corruptSegments(LONG, 2, mulberry32(3));
    expect(countStyle(segs, 'redact')).toBe(1);
    expect(countStyle(segs, 'ghost')).toBeGreaterThanOrEqual(1);
  });

  it('ramps redactions and whispers from early virulent to near pinnacle', () => {
    const early = corruptSegments(LONG, 2, mulberry32(3));
    const peak = corruptSegments(LONG, 3, mulberry32(3));
    expect(countStyle(peak, 'redact')).toBeGreaterThan(countStyle(early, 'redact'));
    expect(countStyle(peak, 'ghost')).toBeGreaterThanOrEqual(countStyle(early, 'ghost'));
  });

  it('ghost whispers are drawn from the contradiction pool', () => {
    const segs = corruptSegments(LONG, 3, mulberry32(11));
    const ghosts = segs.filter((s) => s.style === 'ghost');
    expect(ghosts.length).toBeGreaterThan(0);
    for (const g of ghosts) expect(g.text.trim().length).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    expect(corruptSegments(LONG, 2, mulberry32(42))).toEqual(corruptSegments(LONG, 2, mulberry32(42)));
  });
});

describe('corruptSynthesisSegments', () => {
  it('returns segment arrays and falsifies headline + paragraphs at level>=1', () => {
    const s = { headline: 'Transformation Bears Its Fruit',
      paragraphs: ['Fortune inclines toward you and the way ahead carries real promise.'],
      tensionNote: undefined, affinityNote: undefined };
    const out = corruptSynthesisSegments(s, 1, mulberry32(9));
    expect(Array.isArray(out.headline)).toBe(true);
    expect(Array.isArray(out.paragraphs[0])).toBe(true);
    expect(segmentsToText(out.paragraphs[0])).not.toBe(s.paragraphs[0]);
  });

  it('carries optional notes through as segments when present', () => {
    const s = { headline: 'H', paragraphs: ['a body of words here'],
      tensionNote: 'tension lives here', affinityNote: undefined };
    const out = corruptSynthesisSegments(s, 2, mulberry32(5));
    expect(out.tensionNote).toBeTruthy();
    expect(out.affinityNote).toBeUndefined();
  });
});

describe('seed omen', () => {
  it('selects a line from the pool by rng', () => {
    expect(seedOmen(() => 0)).toBe(SEED_OMENS[0]);
    expect(seedOmen(() => 0.999)).toBe(SEED_OMENS[SEED_OMENS.length - 1]);
  });

  it('appends the omen as a closing paragraph without mutating the input', () => {
    const base = { headline: 'H', paragraphs: ['a', 'b'] };
    const out = appendSeedOmen(base, () => 0);
    expect(out.paragraphs).toEqual(['a', 'b', SEED_OMENS[0]]);
    expect(base.paragraphs).toEqual(['a', 'b']); // input untouched
  });
});
