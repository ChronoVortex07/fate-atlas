import { describe, it, expect } from 'vitest';
import {
  resolveSigil, rankLabel, MAJOR_ICON_KEYS, SUIT_ICON_KEYS,
} from '../../data/sigils';
import type { TarotCardFace, TarotResult } from '../types';
import { MAJOR_ARCANA, generateMinorArcana } from '../../data/tarot';

const face = (o: Partial<TarotCardFace>): TarotCardFace => ({
  id: 'x', name: 'X', arcana: 'major', orientation: 'upright', symbol: '',
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [], meaningUpright: '', meaningReversed: '', tags: [], ...o,
});

describe('resolveSigil (icon keys)', () => {
  it('every major id maps to a non-empty icon key', () => {
    for (const m of MAJOR_ARCANA) {
      const spec = resolveSigil(face({ id: m.id, arcana: 'major' }));
      expect(spec.kind).toBe('major');
      if (spec.kind === 'major') {
        expect(MAJOR_ICON_KEYS[m.id]).toBeDefined();
        expect(spec.icon.length).toBeGreaterThan(0);
        expect(spec.icon).toBe(MAJOR_ICON_KEYS[m.id]);
      }
    }
  });

  it('MAJOR_ICON_KEYS has exactly the 22 canonical ids', () => {
    const ids = new Set(MAJOR_ARCANA.map((m) => m.id));
    expect(Object.keys(MAJOR_ICON_KEYS).sort()).toEqual([...ids].sort());
  });

  it('every minor composes: suit icon present, correct rank label and court flag', () => {
    for (const m of generateMinorArcana()) {
      const spec = resolveSigil(face({ id: m.id, arcana: 'minor', suit: m.suit, rank: m.rank }));
      expect(spec.kind).toBe('minor');
      if (spec.kind === 'minor') {
        expect(spec.icon).toBe(SUIT_ICON_KEYS[m.suit!]);
        expect(spec.icon.length).toBeGreaterThan(0);
        expect(spec.rank.court).toBe(typeof m.rank !== 'number');
        expect(spec.rank.label).toBe(rankLabel(m.rank!));
      }
    }
  });

  it('all four suits have an icon key', () => {
    for (const s of ['wands', 'cups', 'swords', 'pentacles'] as const) {
      expect(SUIT_ICON_KEYS[s]).toBeTruthy();
    }
  });

  it('rankLabel maps aces, pips, and courts', () => {
    expect(rankLabel(1)).toBe('A');
    expect(rankLabel(2)).toBe('II');
    expect(rankLabel(9)).toBe('IX');
    expect(rankLabel(10)).toBe('X');
    expect(rankLabel('page')).toBe('P');
    expect(rankLabel('knight')).toBe('N');
    expect(rankLabel('queen')).toBe('Q');
    expect(rankLabel('king')).toBe('K');
  });

  it('a multi-card spread resolves to the spread crest key', () => {
    const spread = {
      type: 'tarot', id: 's', name: 'Spread', orientation: 'upright', spread: [
        { position: 'past', card: face({ id: 'the-fool' }) },
        { position: 'present', card: face({ id: 'the-sun' }) },
        { position: 'future', card: face({ id: 'the-moon' }) },
      ],
    } as unknown as TarotResult;
    const spec = resolveSigil(spread);
    expect(spec.kind).toBe('spread');
    if (spec.kind === 'spread') expect(spec.icon).toBe('spread');
  });

  it('a single-card tarot result resolves by its underlying face', () => {
    const single = {
      type: 'tarot', id: 'the-tower', name: 'The Tower', orientation: 'upright',
      spread: [{ position: 'present', card: face({ id: 'the-tower' }) }],
    } as unknown as TarotResult;
    const spec = resolveSigil(single);
    expect(spec.kind).toBe('major');
  });
});
