import { describe, it, expect, beforeEach } from 'vitest';
import { NarrativeAssembler } from '../NarrativeAssembler';
import type { AggregatedReading, SlotResult, QuestionType, ModifierRole } from '../types';

const makeSlot = (type: string, overrides: Record<string, unknown> = {}): SlotResult => {
  const base = {
    type, tags: [], themes: ['mystery'],
    dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 },
    modifierRoles: ['subject' as ModifierRole],
    ...overrides,
  };
  if (type === 'tarot') {
    return { id: 'test', name: 'The Fool', number: 0, orientation: 'upright' as const, symbol: '☉', meaningUpright: 'New beginnings', meaningReversed: 'Recklessness', ...base } as unknown as SlotResult;
  }
  if (type === 'd20') {
    return { result: 10, threshold: 'neutral' as const, interpretation: 'Steady', ...base } as unknown as SlotResult;
  }
  if (type === 'iching') {
    return { ...base, hexagramNumber: 1, name: 'Creative', symbol: '䷀', judgment: 'Success', changingLines: [] } as unknown as SlotResult;
  }
  return base as unknown as SlotResult;
};

const baseAggregated: AggregatedReading = {
  dominantTheme: 'illumination',
  secondaryTheme: null,
  dimensionProfile: { favorability: 1.0, certainty: 0.0, volatility: 0.0 },
  modifierAssignments: { subject: [], action: [], effect: [] },
  hasTension: false,
  tensionPair: null,
  strongestFavor: null,
  strongestAdverse: null,
};

const endsTerminally = (p: string) => /[.!?…—)]$/.test(p.trim());

describe('NarrativeAssembler', () => {
  let assembler: NarrativeAssembler;

  beforeEach(() => {
    assembler = new NarrativeAssembler();
    assembler.resetRotation();
  });

  it('produces a valid SynthesisResult with headline and paragraphs', () => {
    const agg = {
      ...baseAggregated,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Fool', themes: ['illumination'] })],
        action: [makeSlot('d20', { modifierRoles: ['action'] })],
        effect: [makeSlot('iching', { modifierRoles: ['effect'] })],
      },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.headline).toBeTruthy();
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });

  it('emits no empty paragraphs and every paragraph ends terminally', () => {
    const agg = {
      ...baseAggregated,
      dimensionProfile: { favorability: -1, certainty: 1.5, volatility: 1.5 },
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Tower', orientation: 'reversed' })],
        action: [makeSlot('d20', { result: 3, modifierRoles: ['action'] })],
        effect: [makeSlot('iching', { modifierRoles: ['effect'] })],
      },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    for (const p of result.paragraphs) {
      expect(p.trim().length).toBeGreaterThan(0);
      expect(endsTerminally(p)).toBe(true);
    }
  });

  it('still yields a non-empty opening when the dominant theme is unknown', () => {
    const agg = { ...baseAggregated, dominantTheme: 'unknown_theme' as unknown as AggregatedReading['dominantTheme'] };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.paragraphs[0].length).toBeGreaterThan(0);
    expect(endsTerminally(result.paragraphs[0])).toBe(true);
  });

  it('weaves a filled modifier role\'s draw name into the body', () => {
    const agg = {
      ...baseAggregated,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Fool' })],
        action: [],
        effect: [makeSlot('d20', { modifierRoles: ['effect'] })],
      },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const body = result.paragraphs.join('\n');
    expect(body).toContain('The Fool');
    expect(body).toContain('the dice, settling on 10');
  });

  it('renders a multi-card spread as one merged, elaborated positions line', () => {
    const spread = makeSlot('tarot', {
      spread: [
        { position: 'past', card: { name: 'Aurora', orientation: 'upright', themes: ['renewal'], dimensions: { favorability: 1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'a', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'present', card: { name: 'Beacon', orientation: 'upright', themes: ['harmony'], dimensions: { favorability: 0.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'b', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'future', card: { name: 'Cinder', orientation: 'reversed', themes: ['conflict'], dimensions: { favorability: -1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'c', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
      ],
    });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [spread], action: [], effect: [] } };
    const result = assembler.assemble(agg, [spread], 'self', { chaos: 40, order: 50 });
    const body = result.paragraphs.join('\n');
    expect(body).toContain('Aurora');
    expect(body).toContain('Cinder');
    expect(body).toMatch(/leans toward fortune|holds steady|turns adverse/);
  });

  it('de-dupes a result shared across modifier roles to a single mention', () => {
    const shared = makeSlot('tarot', { name: 'The Tower', modifierRoles: ['subject', 'action', 'effect'],
      dimensions: { favorability: -1.0, certainty: 1.0, volatility: 1.0 } });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [shared], action: [shared], effect: [shared] } };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const mentions = result.paragraphs.filter((p) => p.includes('The Tower')).length;
    expect(mentions).toBe(1);
  });

  it('does not bookend the reading with the dominant theme', () => {
    const agg = { ...baseAggregated, dominantTheme: 'upheaval' as const, dimensionProfile: { favorability: 1, certainty: 0, volatility: 0 } };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const first = result.paragraphs[0].toLowerCase();
    const last = result.paragraphs[result.paragraphs.length - 1].toLowerCase();
    expect(first.includes('upheaval') && last.includes('upheaval')).toBe(false);
  });

  it('is deterministic for the same reading', () => {
    const agg = {
      ...baseAggregated,
      modifierAssignments: { subject: [makeSlot('tarot', { name: 'The Moon' })], action: [], effect: [] },
    };
    const a = new NarrativeAssembler(); a.resetRotation();
    const r1 = a.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const b = new NarrativeAssembler(); b.resetRotation();
    const r2 = b.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(r2.paragraphs).toEqual(r1.paragraphs);
    expect(r2.headline).toBe(r1.headline);
  });

  it('tension surfaces (note or body) for opposing themes naming both', () => {
    const agg = {
      ...baseAggregated,
      dominantTheme: 'upheaval' as const,
      secondaryTheme: 'harmony' as const,
      hasTension: true,
      tensionPair: ['upheaval', 'harmony'] as [AggregatedReading['dominantTheme'], AggregatedReading['dominantTheme']],
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const all = [...result.paragraphs, result.tensionNote ?? ''].join('\n').toLowerCase();
    expect(all).toContain('upheaval');
    expect(all).toContain('harmony');
  });

  it('no tension -> tensionNote absent', () => {
    const agg = { ...baseAggregated, hasTension: false };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.tensionNote).toBeUndefined();
  });

  it('balanced-but-opposed names both poles as a contest', () => {
    const agg = {
      ...baseAggregated,
      dimensionProfile: { favorability: 0.0, certainty: 0, volatility: 0 },
      strongestFavor: { label: 'the Ace of Cups (upright)', value: 1.5 },
      strongestAdverse: { label: 'the reversed Nine of Wands', value: -1.5 },
    };
    const result = assembler.assemble(agg, [], 'self', { chaos: 40, order: 50 });
    const all = [...result.paragraphs, result.tensionNote ?? ''].join('\n');
    expect(all).toContain('Ace of Cups');
    expect(all).toContain('Nine of Wands');
    expect(all).toMatch(/contest|balance/);
  });

  it('verdict differs between favorable and adverse readings (headline)', () => {
    const agg = { ...baseAggregated, dimensionProfile: { favorability: 0.5, certainty: 0, volatility: 0 } };
    const r1 = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const aggLow = { ...baseAggregated, dimensionProfile: { favorability: -0.5, certainty: 0, volatility: 0 } };
    assembler.resetRotation();
    const r2 = assembler.assemble(aggLow, [], 'decision', { chaos: 40, order: 50 });
    expect(r1.headline).not.toBe(r2.headline);
  });

  it('closing yields a non-empty final paragraph', () => {
    const result = assembler.assemble(baseAggregated, [], 'self', { chaos: 40, order: 50 });
    const closing = result.paragraphs[result.paragraphs.length - 1];
    expect(closing.length).toBeGreaterThan(0);
    expect(endsTerminally(closing)).toBe(true);
  });

  it('LLM prompt contains structured brief', () => {
    const prompt = assembler.generateLLMPrompt({
      question: 'decision' as QuestionType,
      slots: [makeSlot('tarot', { name: 'The Fool', themes: ['renewal'] })],
      effects: [],
      affinities: { chaos: 40, order: 50 },
      aggregated: baseAggregated,
    });
    expect(prompt).toContain('Atlas of Fate');
    expect(prompt).toContain('Structured Brief');
    expect(prompt).toContain('illumination');
    expect(prompt).toContain('Favorability: 1');
  });

  it('affinity note appears for high chaos', () => {
    const result = assembler.assemble(baseAggregated, [], 'decision', { chaos: 70, order: 30 });
    expect(result.affinityNote).toBeTruthy();
    expect(result.affinityNote).toContain('chaos');
  });

  it('affinity note appears for high order', () => {
    const result = assembler.assemble(baseAggregated, [], 'decision', { chaos: 30, order: 70 });
    expect(result.affinityNote).toContain('Order');
  });

  it('affinity note appears for high fate', () => {
    const r = assembler.assemble(baseAggregated, [], 'decision', { fate: 80, will: 20 });
    expect(r.affinityNote).toContain('Fate');
  });

  it('affinity note appears for high will', () => {
    const r = assembler.assemble(baseAggregated, [], 'decision', { will: 80, fate: 20 });
    expect(r.affinityNote).toContain('will');
  });

  it('the most-elevated affinity wins when several are high', () => {
    const r = assembler.assemble(baseAggregated, [], 'decision', { chaos: 70, fate: 95 });
    expect(r.affinityNote).toContain('Fate'); // fate (95) outranks chaos (70)
  });

  it('LLM prompt formats spread positions for multi-position tarot slots', () => {
    const spreadSlot = {
      type: 'tarot',
      id: 'spread-test',
      name: 'Three-Card Spread',
      number: 0,
      orientation: 'upright',
      symbol: '☉',
      meaningUpright: 'Generic meaning',
      meaningReversed: 'Reversed meaning',
      themes: ['mystery'],
      dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 },
      modifierRoles: ['subject'],
      tags: [],
      spread: [
        {
          position: 'past' as const,
          card: {
            id: 'fool', name: 'The Fool', arcana: 'major' as const, number: 0,
            orientation: 'upright' as const, symbol: '☉', themes: ['mystery'],
            dimensions: { favorability: 0.5, certainty: 0.0, volatility: 0.0 },
            modifierRoles: [] as string[], meaningUpright: 'New beginnings',
            meaningReversed: 'Recklessness', tags: [],
          },
        },
        {
          position: 'present' as const,
          card: {
            id: 'cups-2', name: 'Two of Cups', arcana: 'minor' as const, number: 2,
            orientation: 'reversed' as const, symbol: '♡', themes: ['harmony'],
            dimensions: { favorability: 0.3, certainty: 0.0, volatility: 0.0 },
            modifierRoles: [] as string[], meaningUpright: 'Harmony',
            meaningReversed: 'Division', tags: [],
          },
        },
        {
          position: 'future' as const,
          card: {
            id: 'swords-3', name: 'Three of Swords', arcana: 'minor' as const, number: 3,
            orientation: 'upright' as const, symbol: '♤', themes: ['upheaval'],
            dimensions: { favorability: -0.5, certainty: 0.0, volatility: 0.0 },
            modifierRoles: [] as string[], meaningUpright: 'Heartbreak',
            meaningReversed: 'Recovery', tags: [], veiled: true,
          },
        },
      ],
    } as unknown as SlotResult;

    const prompt = assembler.generateLLMPrompt({
      question: 'decision' as QuestionType,
      slots: [spreadSlot],
      effects: [],
      affinities: { chaos: 40, order: 50 },
      aggregated: baseAggregated,
    });

    expect(prompt).toContain('Past:');
    expect(prompt).toContain('Present:');
    expect(prompt).toContain('Future:');
    expect(prompt).toContain('The Fool (upright)');
    expect(prompt).toContain('Two of Cups (reversed)');
    expect(prompt).not.toContain('Three of Swords');
    expect(prompt).toContain('(veiled)');
    expect(prompt).toContain('Divinations');
    expect(prompt).toContain('Instructions');
  });

  it('aggregates three same-role d20 draws into one combined mention', () => {
    const mk = (result: number) => makeSlot('d20', { result, modifierRoles: ['effect' as ModifierRole],
      dimensions: { favorability: 0.0, certainty: 0, volatility: 0 } });
    const agg = {
      ...baseAggregated,
      modifierAssignments: { subject: [], action: [], effect: [mk(5), mk(12), mk(18)] },
    };
    const result = assembler.assemble(agg, [], 'future', { chaos: 40, order: 50 });
    const body = result.paragraphs.join('\n');
    // one combined scaffold, not three "settling on" repeats
    expect((body.match(/the dice/g) ?? []).length).toBe(1);
    expect(body).toContain('the dice fall in turn');
    expect(body).toContain('5');
    expect(body).toContain('12');
    expect(body).toContain('18');
  });

  it('varies framing for the same type split across two roles', () => {
    const subj = makeSlot('d20', { result: 4, modifierRoles: ['subject' as ModifierRole],
      dimensions: { favorability: 0, certainty: 0, volatility: 0 } });
    const eff = makeSlot('d20', { result: 19, modifierRoles: ['effect' as ModifierRole],
      dimensions: { favorability: 0, certainty: 0, volatility: 0 } });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [subj], action: [], effect: [eff] } };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const body = result.paragraphs.join('\n');
    // the 2nd occurrence uses a variant scaffold, so "settling on" appears at most once
    expect((body.match(/settling on/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(body).toContain('4');
    expect(body).toContain('19');
  });

  it('remains deterministic with repeated minigames', () => {
    const mk = (result: number) => makeSlot('d20', { result, modifierRoles: ['effect' as ModifierRole] });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [], action: [], effect: [mk(5), mk(12), mk(18)] } };
    const a = new NarrativeAssembler(); a.resetRotation();
    const r1 = a.assemble(agg, [], 'future', { chaos: 40, order: 50 });
    const b = new NarrativeAssembler(); b.resetRotation();
    const r2 = b.assemble(agg, [], 'future', { chaos: 40, order: 50 });
    expect(r2.paragraphs).toEqual(r1.paragraphs);
  });
});

describe('NarrativeAssembler — reading detail/clarity (Light/Shadow)', () => {
  const fx = (over: Partial<import('../types').AffinityEffects>): import('../types').AffinityEffects => ({
    spreadRedraws: 0, methodCount: 3, hintClarity: 0, readingDetail: 0, poolPreview: 'none', peekAvailable: false, ...over,
  });

  it('rich reading (readingDetail>0) has at least as many paragraphs as terse', () => {
    const na = new NarrativeAssembler();
    na.resetRotation();
    const rich = na.assemble(baseAggregated, [], 'self', { light: 90, shadow: 10 }, fx({ readingDetail: 1, hintClarity: 2 }));
    na.resetRotation();
    const terse = na.assemble(baseAggregated, [], 'self', { light: 10, shadow: 90 }, fx({ readingDetail: -1, hintClarity: -2 }));
    expect(rich.paragraphs.length).toBeGreaterThanOrEqual(terse.paragraphs.length);
  });

  it('clarity >= 2 names the forces in the affinity note when one is present', () => {
    const na = new NarrativeAssembler();
    na.resetRotation();
    const r = na.assemble(baseAggregated, [], 'self', { chaos: 70, order: 30 }, fx({ hintClarity: 2 }));
    expect(r.affinityNote).toBeTruthy();
    expect(r.affinityNote).toContain('name themselves');
  });
});
