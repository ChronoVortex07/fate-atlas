import { describe, it, expect } from 'vitest';
import { describeDraw, favBandOf } from '../narrative/drawVoice';
import type { SlotResult, ModifierRole } from '../types';

const tarot = (over: Record<string, unknown> = {}): SlotResult => ({
  type: 'tarot', id: 't', name: 'The Tower', number: 16, orientation: 'reversed',
  symbol: '☉', meaningUpright: 'Sudden upheaval', meaningReversed: 'Averted disaster',
  themes: ['upheaval'], tags: [], modifierRoles: ['subject'],
  dimensions: { favorability: -1, certainty: 0.5, volatility: 1 }, ...over,
} as unknown as SlotResult);

describe('describeDraw', () => {
  it('names a single tarot card and yields a non-empty clause', () => {
    const v = describeDraw(tarot(), 'subject' as ModifierRole);
    expect(v.subject).toContain('Tower');
    expect(v.subject).toContain('reversed');
    expect(v.clause.trim().length).toBeGreaterThan(0);
  });

  it('low favorability selects the low verb-phrase band', () => {
    const v = describeDraw(tarot({ dimensions: { favorability: -1, certainty: 0, volatility: 0 } }), 'action');
    expect(v.clause).toMatch(/hold|warns|caution|cost|force/i);
  });

  it('high favorability selects the high verb-phrase band', () => {
    const v = describeDraw(tarot({ dimensions: { favorability: 1.5, certainty: 0, volatility: 0 } }), 'effect');
    expect(v.clause).toMatch(/carry|opening|favor/i);
  });

  it('d20 names the rolled value', () => {
    const d = describeDraw({ type: 'd20', result: 17, threshold: 'high', interpretation: 'A clear win',
      themes: ['authority'], tags: [], modifierRoles: ['effect'],
      dimensions: { favorability: 1, certainty: 0, volatility: 0 } } as unknown as SlotResult, 'effect');
    expect(d.subject).toContain('17');
    expect(d.clause.trim().length).toBeGreaterThan(0);
  });

  it('iching names the hexagram', () => {
    const h = describeDraw({ type: 'iching', hexagramNumber: 49, name: 'Revolution', symbol: '䷰',
      judgment: 'Change comes at the appointed hour', changingLines: [3], themes: ['transformation'],
      tags: [], modifierRoles: ['effect'], dimensions: { favorability: 0, certainty: 0, volatility: 1 } } as unknown as SlotResult, 'effect');
    expect(h.subject).toMatch(/49|Revolution/);
    expect(h.clause.trim().length).toBeGreaterThan(0);
  });

  it('a multi-card spread falls back to its first card (composer handles positions)', () => {
    const spread = tarot({ spread: [
      { position: 'past', card: { name: 'The Star', orientation: 'upright', dimensions: { favorability: 1, certainty: 0, volatility: 0 } } },
      { position: 'present', card: { name: 'The Moon', orientation: 'reversed', dimensions: { favorability: -1, certainty: 0, volatility: 0 } } },
    ] });
    const v = describeDraw(spread, 'subject');
    expect(v.subject).toContain('Star');
  });

  it('favBandOf thresholds', () => {
    expect(favBandOf(0.5)).toBe('high');
    expect(favBandOf(-0.5)).toBe('low');
    expect(favBandOf(0.2)).toBe('neutral');
  });
});
