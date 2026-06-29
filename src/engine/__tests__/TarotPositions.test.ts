import { describe, it, expect } from 'vitest';
import { aggregateTarotPositions } from '../narrative/voices/index';
import type { SlotResult } from '../types';

const face = (name: string, fav: number, over: Record<string, unknown> = {}) => ({
  id: name, name, arcana: 'major', orientation: fav < 0 ? 'reversed' : 'upright', symbol: '☉',
  themes: ['mystery'], dimensions: { favorability: fav, certainty: 0, volatility: 0 },
  modifierRoles: ['subject'], meaningUpright: 'Hope and renewal', meaningReversed: 'Loss and doubt',
  tags: [], ...over,
});

const spread = (cards: [string, number][]): SlotResult => ({
  type: 'tarot', id: 's', name: cards.map((c) => c[0]).join(' · '), number: 0,
  orientation: 'upright', symbol: '☉', meaningUpright: '', meaningReversed: '', tags: [],
  themes: ['mystery'], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'],
  spread: [
    { position: 'past', card: face(cards[0][0], cards[0][1]) },
    { position: 'present', card: face(cards[1][0], cards[1][1]) },
    { position: 'future', card: face(cards[2][0], cards[2][1]) },
  ],
} as unknown as SlotResult);

describe('aggregateTarotPositions', () => {
  it('one spread → three position summaries, one card each, no contradiction', () => {
    const out = aggregateTarotPositions([spread([['A', 1], ['B', 0], ['C', -1]])]);
    expect(out.map((s) => s.position)).toEqual(['past', 'present', 'future']);
    expect(out.every((s) => s.cards.length === 1)).toBe(true);
    expect(out.map((s) => s.lean)).toEqual(['favor', 'steady', 'adverse']);
    expect(out.some((s) => s.contradiction)).toBe(false);
  });

  it('three spreads collapse into still exactly three positions, cards pooled', () => {
    const out = aggregateTarotPositions([
      spread([['A', 1], ['B', 0], ['C', -1]]),
      spread([['D', 1], ['E', 0], ['F', -1]]),
      spread([['G', 1], ['H', 0], ['I', -1]]),
    ]);
    expect(out.length).toBe(3);
    expect(out.find((s) => s.position === 'past')!.cards.length).toBe(3);
  });

  it('flags contradiction when a position mixes a favorable and an adverse card', () => {
    const out = aggregateTarotPositions([
      spread([['Sun', 1.5], ['B', 0], ['C', 0]]),
      spread([['Five of Swords', -1.5], ['E', 0], ['F', 0]]),
    ]);
    expect(out.find((s) => s.position === 'past')!.contradiction).toBe(true);
  });

  it('veiled cards carry no gloss', () => {
    const s = spread([['A', 1], ['B', 0], ['C', -1]]);
    (s as unknown as { spread: { card: { veiled?: boolean } }[] }).spread[0].card.veiled = true;
    const past = aggregateTarotPositions([s]).find((p) => p.position === 'past')!;
    expect(past.cards[0].veiled).toBe(true);
    expect(past.cards[0].gloss).toBe('');
  });
});

import { ProseBuilder } from '../narrative/ProseBuilder';
import type { Beat, PositionSummary } from '../narrative/types';
import type { AggregatedReading } from '../types';

const aggStub: AggregatedReading = {
  dominantTheme: 'mystery', secondaryTheme: null,
  dimensionProfile: { favorability: 0, certainty: 0, volatility: 0 },
  modifierAssignments: { subject: [], action: [], effect: [] },
  hasTension: false, tensionPair: null, strongestFavor: null, strongestAdverse: null,
};
const closeBeat: Beat = { kind: 'close', question: 'self', theme: 'mystery', carryForce: null };
const proseCtx = { aggregated: aggStub, question: 'self' as const, seed: 0 };

describe('ProseBuilder positions rendering', () => {
  it('single-card position names the card and weaves its gloss', () => {
    const summaries: PositionSummary[] = [{
      position: 'past', contradiction: false, lean: 'adverse',
      cards: [{ name: 'Tower', orientation: 'reversed', favorability: -1, lean: 'adverse', gloss: 'the ground already broken', veiled: false }],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ');
    expect(text).toContain('Tower');
    expect(text).toContain('the ground already broken');
  });

  it('contradiction position names both opposing cards', () => {
    const summaries: PositionSummary[] = [{
      position: 'present', contradiction: true, lean: 'steady',
      cards: [
        { name: 'Sun', orientation: 'upright', favorability: 1.5, lean: 'favor', gloss: 'warmth', veiled: false },
        { name: 'Five of Swords', orientation: 'reversed', favorability: -1.5, lean: 'adverse', gloss: 'a hollow win', veiled: false },
      ],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ');
    expect(text).toContain('Sun');
    expect(text).toContain('Five of Swords');
  });

  it('all-veiled position falls back to the bare lean phrase', () => {
    const summaries: PositionSummary[] = [{
      position: 'future', contradiction: false, lean: 'favor',
      cards: [{ name: '?', orientation: 'upright', favorability: 1, lean: 'favor', gloss: '', veiled: true }],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ').toLowerCase();
    expect(text).toContain('fortune'); // positionLeans.favor === 'leans toward fortune'
  });

  it('does not leak a veiled card name in a contradiction position', () => {
    const summaries: PositionSummary[] = [{
      position: 'present', contradiction: true, lean: 'steady',
      cards: [
        { name: 'SecretSun', orientation: 'upright', favorability: 1.5, lean: 'favor', gloss: '', veiled: true },
        { name: 'Five of Swords', orientation: 'reversed', favorability: -1.5, lean: 'adverse', gloss: 'a hollow win', veiled: false },
      ],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ');
    expect(text).not.toContain('SecretSun');
  });
});
