import { describe, it, expect } from 'vitest';
import { ReadingComposer } from '../narrative/ReadingComposer';
import type { AggregatedReading, SlotResult, ModifierRole } from '../types';
import type { Beat } from '../narrative/types';

const slot = (type: string, over: Record<string, unknown> = {}): SlotResult => {
  const base = {
    type, tags: [], themes: ['mystery'],
    dimensions: { favorability: 0.5, certainty: 0, volatility: 0 },
    modifierRoles: ['subject' as ModifierRole],
    ...over,
  };
  if (type === 'tarot') return { id: 't', name: 'The Fool', number: 0, orientation: 'upright', symbol: '☉', meaningUpright: 'Beginnings', meaningReversed: 'Folly', ...base } as unknown as SlotResult;
  if (type === 'd20') return { result: 12, threshold: 'neutral', interpretation: 'Steady', ...base } as unknown as SlotResult;
  if (type === 'iching') return { hexagramNumber: 1, name: 'Creative', symbol: '䷀', judgment: 'Success', changingLines: [], ...base } as unknown as SlotResult;
  return base as unknown as SlotResult;
};

const base: AggregatedReading = {
  dominantTheme: 'mystery', secondaryTheme: null,
  dimensionProfile: { favorability: 0, certainty: 0, volatility: 0 },
  modifierAssignments: { subject: [], action: [], effect: [] },
  hasTension: false, tensionPair: null, strongestFavor: null, strongestAdverse: null,
};

const kinds = (beats: Beat[]) => beats.map((b) => b.kind);

describe('ReadingComposer', () => {
  const composer = new ReadingComposer();

  it('always ends on a close beat and emits the theme at most once', () => {
    const beats = composer.compose({ aggregated: base, results: [], question: 'self', seed: 0 });
    expect(beats[beats.length - 1].kind).toBe('close');
    expect(kinds(beats).filter((k) => k === 'theme').length).toBeLessThanOrEqual(1);
  });

  it('emits an opposition beat iff the poles oppose', () => {
    const opp = { ...base, strongestFavor: { label: 'the Ace of Cups', value: 1.5 }, strongestAdverse: { label: 'the Nine of Wands', value: -1.5 } };
    expect(kinds(composer.compose({ aggregated: opp, results: [], question: 'self', seed: 0 }))).toContain('opposition');
    const weak = { ...base, strongestFavor: { label: 'x', value: 0.5 }, strongestAdverse: { label: 'y', value: -0.5 } };
    expect(kinds(composer.compose({ aggregated: weak, results: [], question: 'self', seed: 0 }))).not.toContain('opposition');
  });

  it('cold-opens on opposition when poles strongly oppose', () => {
    const opp = { ...base, dimensionProfile: { favorability: 0, certainty: 0, volatility: 0 }, strongestFavor: { label: 'a', value: 1.5 }, strongestAdverse: { label: 'b', value: -1.5 } };
    const beats = composer.compose({ aggregated: opp, results: [], question: 'self', seed: 0 });
    expect(beats[0].kind).toBe('opposition');
  });

  it('opener varies with the seed for a plain neutral-theme reading', () => {
    const a = composer.compose({ aggregated: base, results: [], question: 'self', seed: 0 })[0].kind;
    const b = composer.compose({ aggregated: base, results: [], question: 'self', seed: 1 })[0].kind;
    expect(a).not.toBe(b);
  });

  it('terse reading (readingDetail<0) yields at most one force beat and no temper', () => {
    const agg = { ...base, dimensionProfile: { favorability: 1, certainty: 1.5, volatility: 1.5 },
      modifierAssignments: {
        subject: [slot('tarot', { name: 'The Fool' })],
        action: [slot('d20', { modifierRoles: ['action'] })],
        effect: [slot('iching', { modifierRoles: ['effect'] })],
      } };
    const beats = composer.compose({ aggregated: agg, results: [], question: 'decision', seed: 0, effects: { readingDetail: -1 } as never });
    expect(kinds(beats).filter((k) => k === 'force').length).toBeLessThanOrEqual(1);
    expect(kinds(beats)).not.toContain('temper');
  });

  it('a multi-card spread yields a positions beat, not force draws of each card', () => {
    const spread = slot('tarot', { spread: [
      { position: 'past', card: { name: 'A', orientation: 'upright', themes: ['renewal'], dimensions: { favorability: 1, certainty: 0, volatility: 0 }, modifierRoles: ['subject'] } },
      { position: 'present', card: { name: 'B', orientation: 'upright', themes: ['harmony'], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'] } },
      { position: 'future', card: { name: 'C', orientation: 'reversed', themes: ['conflict'], dimensions: { favorability: -1, certainty: 0, volatility: 0 }, modifierRoles: ['subject'] } },
    ] });
    const agg = { ...base, modifierAssignments: { subject: [spread], action: [], effect: [] } };
    const beats = composer.compose({ aggregated: agg, results: [spread], question: 'self', seed: 0 });
    const positions = beats.find((b) => b.kind === 'positions');
    expect(positions).toBeTruthy();
    if (positions && positions.kind === 'positions') {
      expect(positions.summaries.map((s) => s.position)).toEqual(['past', 'present', 'future']);
      expect(positions.summaries.map((s) => s.lean)).toEqual(['favor', 'steady', 'adverse']);
    }
  });

  it('de-dupes a result shared across roles into a single force beat', () => {
    const shared = slot('tarot', { name: 'The Tower', modifierRoles: ['subject', 'action', 'effect'], dimensions: { favorability: -1, certainty: 1, volatility: 1 } });
    const agg = { ...base, modifierAssignments: { subject: [shared], action: [shared], effect: [shared] } };
    const beats = composer.compose({ aggregated: agg, results: [], question: 'decision', seed: 0 });
    const towerMentions = beats.filter((b) => b.kind === 'force' && b.draws.some((d) => d.subject.includes('Tower'))).length;
    expect(towerMentions).toBe(1);
  });
});
