import { describe, it, expect } from 'vitest';
import { ProseBuilder, joinClauses, seedFor } from '../narrative/ProseBuilder';
import type { Beat } from '../narrative/types';
import type { AggregatedReading } from '../types';

const agg: AggregatedReading = {
  dominantTheme: 'illumination', secondaryTheme: null,
  dimensionProfile: { favorability: 1, certainty: 0, volatility: 0 },
  modifierAssignments: { subject: [], action: [], effect: [] },
  hasTension: false, tensionPair: null, strongestFavor: null, strongestAdverse: null,
};

const ctx = (seed: number) => ({ aggregated: agg, question: 'decision' as const, seed });

const endsTerminally = (p: string) => /[.!?…—)]$/.test(p.trim());

describe('joinClauses', () => {
  it('drops empty clauses and yields one capitalized, terminated sentence', () => {
    expect(joinClauses(['', '  ', 'the way is open'])).toBe('The way is open.');
  });
  it('returns empty string when nothing survives', () => {
    expect(joinClauses(['', '   '])).toBe('');
  });
});

describe('seedFor', () => {
  it('is deterministic and varies with inputs', () => {
    expect(seedFor(agg, 'decision', [])).toBe(seedFor(agg, 'decision', []));
    expect(seedFor({ ...agg, dominantTheme: 'conflict' }, 'decision', [])).not.toBe(seedFor(agg, 'decision', []));
  });
});

describe('ProseBuilder', () => {
  const forceBeats: Beat[] = [
    { kind: 'force', role: 'subject', draws: [{ subject: 'The Tower, reversed', clause: 'unsettles the ground you stand on' }] },
    { kind: 'force', role: 'action', draws: [{ subject: 'the dice, settling on 17', clause: 'urge a steadier hand' }] },
  ];
  const beats: Beat[] = [
    { kind: 'theme', theme: 'illumination', secondary: null, favBand: 'high' },
    { kind: 'fortune', favBand: 'high', strongestFavor: null, strongestAdverse: null },
    ...forceBeats,
    { kind: 'close', question: 'decision', theme: 'illumination', carryForce: null },
  ];

  it('produces a headline and at least one paragraph', () => {
    const b = new ProseBuilder();
    const out = b.build(beats, ctx(0));
    expect(out.headline.trim().length).toBeGreaterThan(0);
    expect(out.paragraphs.length).toBeGreaterThan(0);
  });

  it('emits no empty paragraphs and every paragraph ends terminally', () => {
    const b = new ProseBuilder();
    const out = b.build(beats, ctx(0));
    for (const p of out.paragraphs) {
      expect(p.trim().length).toBeGreaterThan(0);
      expect(endsTerminally(p)).toBe(true);
    }
  });

  it('weaves the specific draw subjects into the body', () => {
    const b = new ProseBuilder();
    const out = b.build(beats, ctx(0));
    const body = out.paragraphs.join('\n');
    expect(body).toContain('Tower');
    expect(body).toContain('17');
  });

  it('uses a connective when two force beats are present', () => {
    const b = new ProseBuilder();
    const out = b.build(beats, ctx(0));
    const body = out.paragraphs.join(' ');
    expect(body).toMatch(/yet|and so|and still|though|; |— and|, and/);
  });

  it('is deterministic for the same seed and varies across seeds', () => {
    const b1 = new ProseBuilder(); b1.resetRotation();
    const r0a = b1.build(beats, ctx(0));
    const b2 = new ProseBuilder(); b2.resetRotation();
    const r0b = b2.build(beats, ctx(0));
    expect(r0b.paragraphs).toEqual(r0a.paragraphs);
    const b3 = new ProseBuilder(); b3.resetRotation();
    const r1 = b3.build(beats, ctx(1));
    expect(r1.paragraphs.join('')).not.toBe(r0a.paragraphs.join(''));
  });

  it('renders an opposition beat as a tensionNote naming both poles', () => {
    const b = new ProseBuilder();
    const oppBeats: Beat[] = [
      { kind: 'theme', theme: 'harmony', secondary: null, favBand: 'neutral' },
      { kind: 'opposition', favPole: { label: 'the Ace of Cups', value: 1.5 }, advPole: { label: 'the Nine of Wands', value: -1.5 } },
      { kind: 'close', question: 'self', theme: 'harmony', carryForce: null },
    ];
    const out = b.build(oppBeats, { aggregated: { ...agg, dominantTheme: 'harmony' }, question: 'self', seed: 2 });
    expect(out.tensionNote).toBeTruthy();
    expect(out.tensionNote).toMatch(/Ace of Cups/);
    expect(out.tensionNote).toMatch(/Nine of Wands/);
    expect(out.tensionNote).toMatch(/contest|balance/);
  });

  it('does not restate the theme in the close when the theme opened the reading', () => {
    const b = new ProseBuilder();
    const out = b.build(beats, ctx(0)); // beats[0] is the theme beat
    const last = out.paragraphs[out.paragraphs.length - 1];
    expect(last.toLowerCase()).not.toContain('illumination');
  });
});
