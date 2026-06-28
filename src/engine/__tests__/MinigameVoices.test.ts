import { describe, it, expect } from 'vitest';
import { READING_FRAGMENTS } from '../../data/reading-fragments';
import { voiceFor } from '../narrative/voices/index';
import { describeDraw } from '../narrative/drawVoice';
import type { SlotResult, ModifierRole } from '../types';

const d20 = (result: number, fav = 0): SlotResult => ({
  type: 'd20', result, threshold: 'neutral', interpretation: 'Steady',
  themes: ['mystery'], tags: [], modifierRoles: ['effect'],
  dimensions: { favorability: fav, certainty: 0, volatility: 0 },
} as unknown as SlotResult);

const tarot = (name: string, fav = 0): SlotResult => ({
  type: 'tarot', id: name, name, number: 1, orientation: 'upright', symbol: '☉',
  meaningUpright: 'New beginnings', meaningReversed: 'Recklessness',
  themes: ['mystery'], tags: [], modifierRoles: ['subject'],
  dimensions: { favorability: fav, certainty: 0, volatility: 0 },
} as unknown as SlotResult);

describe('drawFraming fragments', () => {
  it('exposes variant scaffolds and group framing', () => {
    const df = READING_FRAGMENTS.drawFraming;
    expect(df.variantScaffolds.d20.length).toBeGreaterThan(0);
    expect(df.variantScaffolds.d20[0]).toContain('{n}');
    expect(df.group.lead.d20).toBeTruthy();
    expect(df.group.lead.generic).toBeTruthy();
    expect(typeof df.group.seqLast).toBe('string');
    expect(typeof df.group.listLast).toBe('string');
    expect(typeof df.group.mid).toBe('string');
  });
});

describe('MinigameVoice — single-draw parity', () => {
  it('describeOne (index 0) matches legacy describeDraw for d20', () => {
    const slot = d20(10);
    const viaVoice = voiceFor('d20').describeOne(slot, 'effect' as ModifierRole, { index: 0, total: 1 });
    const viaLegacy = describeDraw(slot, 'effect');
    expect(viaVoice).toEqual(viaLegacy);
    expect(viaVoice.subject).toBe('the dice, settling on 10');
  });

  it('describeDraw still returns the legacy d20 subject', () => {
    expect(describeDraw(d20(10), 'effect').subject).toBe('the dice, settling on 10');
  });
});

describe('MinigameVoice — occurrence variation', () => {
  it('a 2nd d20 draw uses a variant scaffold, not the base one', () => {
    const v = voiceFor('d20').describeOne(d20(7), 'effect', { index: 1, total: 2 });
    expect(v.subject).not.toBe('the dice, settling on 7');
    expect(v.subject).toContain('7');
  });

  it('two same-role siblings do not end on the identical clause', () => {
    const a = voiceFor('d20').describeOne(d20(5), 'effect', { index: 0, total: 2 });
    const b = voiceFor('d20').describeOne(d20(12), 'effect', { index: 1, total: 2 });
    expect(a.clause).not.toBe(b.clause);
  });
});

describe('MinigameVoice — aggregation', () => {
  it('collapses 3 d20 draws into one combined subject naming each value', () => {
    const g = voiceFor('d20').describeGroup([d20(5), d20(12), d20(18)], 'effect', 0);
    expect(g.subject).toContain('5');
    expect(g.subject).toContain('12');
    expect(g.subject).toContain('18');
    expect(g.subject).toContain('the dice fall in turn');
    // exactly one scaffold, not three
    expect(g.subject.match(/the dice/g)?.length).toBe(1);
    expect(g.clause.trim().length).toBeGreaterThan(0);
  });

  it('collapses tarot draws naming each card once', () => {
    const g = voiceFor('tarot').describeGroup([tarot('The Tower'), tarot('The Star')], 'subject', 0);
    expect(g.subject).toContain('Tower');
    expect(g.subject).toContain('Star');
    expect(g.clause.trim().length).toBeGreaterThan(0);
  });
});

describe('MinigameVoice — fallback', () => {
  it('an unmapped type (astral) still yields subject + clause', () => {
    const astral = { type: 'astral', name: 'Mars in the 7th', interpretation: 'Tension in partnership',
      themes: ['conflict'], tags: [], modifierRoles: ['subject'],
      dimensions: { favorability: -0.5, certainty: 0, volatility: 0 } } as unknown as SlotResult;
    const one = voiceFor('astral').describeOne(astral, 'subject', { index: 0, total: 1 });
    expect(one.subject).toContain('Mars');
    expect(one.clause.trim().length).toBeGreaterThan(0);
    const group = voiceFor('astral').describeGroup([astral, astral], 'subject', 0);
    expect(group.subject.length).toBeGreaterThan(0);
    expect(group.clause.trim().length).toBeGreaterThan(0);
  });
});
