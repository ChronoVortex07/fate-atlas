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
    return { ...base, result: 10, threshold: 'neutral' as const, interpretation: 'Steady' } as unknown as SlotResult;
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

describe('NarrativeAssembler', () => {
  let assembler: NarrativeAssembler;

  beforeEach(() => {
    assembler = new NarrativeAssembler();
    assembler.resetRotation();
  });

  it('produces valid SynthesisResult with headline and paragraphs', () => {
    const agg = {
      ...baseAggregated,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Fool', themes: ['illumination'] })],
        action: [makeSlot('d20')],
        effect: [makeSlot('iching')],
      },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.headline).toBeTruthy();
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });

  it('opening uses correct theme template', () => {
    const agg = { ...baseAggregated, dominantTheme: 'upheaval' as const };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.paragraphs[0]).toContain('upheaval');
  });

  it('opening falls back when no dominant theme', () => {
    // Use a theme not in the template set
    const agg = { ...baseAggregated, dominantTheme: 'unknown_theme' as unknown as AggregatedReading['dominantTheme'] };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // Should use fallback noDominantTheme template
    expect(result.paragraphs[0].length).toBeGreaterThan(0);
  });

  it('dimension body includes all applicable bands', () => {
    const agg = {
      ...baseAggregated,
      dimensionProfile: { favorability: 1.5, certainty: 1.5, volatility: 0.0 },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // Should have an additional paragraph for dimensions (favorability + certainty bands fire)
    expect(result.paragraphs.length).toBeGreaterThanOrEqual(2);
  });

  it('dimension body skips neutral certainty and volatility', () => {
    const agg = {
      ...baseAggregated,
      dimensionProfile: { favorability: 0.0, certainty: 0.0, volatility: 0.0 },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // Only favorability should fire (all bands speak for favorability)
    const dimParagraph = result.paragraphs.find((p) => p.includes('Fortune') || p.includes('signs'));
    expect(dimParagraph).toBeTruthy();
    // Should NOT contain certainty or volatility language
    if (dimParagraph) {
      expect(dimParagraph).not.toMatch(/certainty|fixed/);
    }
  });

  it('modifier weaving produces paragraph for each filled role', () => {
    const agg = {
      ...baseAggregated,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Fool' })],
        action: [],
        effect: [makeSlot('d20')],
      },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // Should have paragraphs for subject, action (missing -> gap ack), effect
    const hasSubjectPara = result.paragraphs.some((p) => p.includes('The Fool'));
    expect(hasSubjectPara).toBe(true);
    // Missing action should produce a gap acknowledgment
    expect(result.paragraphs.some((p) => p.includes('not yet clear') || p.includes('veiled'))).toBe(true);
  });

  it('missing modifier produces gap acknowledgment', () => {
    const agg = {
      ...baseAggregated,
      modifierAssignments: { subject: [], action: [], effect: [] },
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const gapParagraphs = result.paragraphs.filter((p) => p.includes('remains veiled') || p.includes('not yet clear'));
    expect(gapParagraphs.length).toBe(3); // all three roles missing
  });

  it('tension section fires for opposing themes', () => {
    const agg = {
      ...baseAggregated,
      dominantTheme: 'upheaval' as const,
      secondaryTheme: 'harmony' as const,
      hasTension: true,
      tensionPair: ['upheaval', 'harmony'] as [AggregatedReading['dominantTheme'], AggregatedReading['dominantTheme']],
    };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.paragraphs.some((p) => p.includes('Upheaval') && p.includes('harmony'))).toBe(true);
  });

  it('no tension -> section absent', () => {
    const agg = { ...baseAggregated, hasTension: false };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result.tensionNote).toBeUndefined();
  });

  it('narrower band: favorability 0.5 reaches a real verdict (not neutral)', () => {
    const agg = { ...baseAggregated, dimensionProfile: { favorability: 0.5, certainty: 0, volatility: 0 } };
    const r1 = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const aggLow = { ...baseAggregated, dimensionProfile: { favorability: -0.5, certainty: 0, volatility: 0 } };
    assembler.resetRotation();
    const r2 = assembler.assemble(aggLow, [], 'decision', { chaos: 40, order: 50 });
    // The two verdicts must differ (one high band, one low band) — not both neutral.
    expect(r1.headline).not.toBe(r2.headline);
  });

  it('balanced-but-opposed emits a named tension paragraph', () => {
    const agg = {
      ...baseAggregated,
      dimensionProfile: { favorability: 0.0, certainty: 0, volatility: 0 },
      strongestFavor: { label: 'the Ace of Cups (upright)', value: 1.5 },
      strongestAdverse: { label: 'the reversed Nine of Wands', value: -1.5 },
    };
    const result = assembler.assemble(agg, [], 'self', { chaos: 40, order: 50 });
    const para = result.paragraphs.find((p) => p.includes('Ace of Cups') && p.includes('Nine of Wands'));
    expect(para).toBeTruthy();
    expect(para).toMatch(/contest|balance/);
  });

  it('emits a per-position line for a tarot spread', () => {
    const spread = makeSlot('tarot', {
      spread: [
        { position: 'past', card: { name: 'A', orientation: 'upright', themes: ['renewal'], dimensions: { favorability: 1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'a', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'present', card: { name: 'B', orientation: 'upright', themes: ['harmony'], dimensions: { favorability: 0.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'b', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'future', card: { name: 'C', orientation: 'reversed', themes: ['conflict'], dimensions: { favorability: -1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'c', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
      ],
    });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [spread], action: [], effect: [] } };
    const result = assembler.assemble(agg, [spread], 'self', { chaos: 40, order: 50 });
    const line = result.paragraphs.find((p) => p.includes('Past') && p.includes('Future'));
    expect(line).toBeTruthy();
    expect(line).toMatch(/Past leans/);
    expect(line).toMatch(/Future turns adverse/);
  });

  it('de-dupes a result shared across modifier roles to a single frame', () => {
    const shared = makeSlot('tarot', { name: 'The Tower', modifierRoles: ['subject', 'action', 'effect'],
      dimensions: { favorability: -1.0, certainty: 1.0, volatility: 1.0 } });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [shared], action: [shared], effect: [shared] } };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const mentions = result.paragraphs.filter((p) => p.includes('The Tower')).length;
    expect(mentions).toBe(1);
  });

  it('closing uses correct question type template', () => {
    const agg = { ...baseAggregated };
    const result = assembler.assemble(agg, [], 'self', { chaos: 40, order: 50 });
    const closing = result.paragraphs[result.paragraphs.length - 1];
    expect(closing.length).toBeGreaterThan(0);
  });

  it('template rotation: two calls use different template indices', () => {
    const assembler2 = new NarrativeAssembler();
    assembler2.resetRotation();
    const agg = {
      ...baseAggregated,
      dominantTheme: 'mystery' as const,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Moon' })],
        action: [makeSlot('d20')],
        effect: [makeSlot('iching')],
      },
    };
    const result1 = assembler2.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    assembler2.resetRotation();
    const result2 = assembler2.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // With 2+ templates in the pool, same-seed rotation should produce the same first pick
    // (since we reset rotation in between). Without reset, they'd differ.
    expect(result1.paragraphs[0]).toBe(result2.paragraphs[0]); // same because rotation reset
  });

  it('template rotation advances without reset', () => {
    const assembler3 = new NarrativeAssembler();
    assembler3.resetRotation();
    const agg = {
      ...baseAggregated,
      dominantTheme: 'mystery' as const,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Moon' })],
        action: [makeSlot('d20')],
        effect: [makeSlot('iching')],
      },
    };
    const result1 = assembler3.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // Don't reset -- second call should use next index
    const result2 = assembler3.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // The opening paragraphs should differ (mystery has 2 templates, index 0 vs 1)
    expect(result1.paragraphs[0]).not.toBe(result2.paragraphs[0]);
  });

  it('template rotation wraps to 0 after exhausting pool', () => {
    const assembler4 = new NarrativeAssembler();
    assembler4.resetRotation();
    const agg = {
      ...baseAggregated,
      dominantTheme: 'mystery' as const,
      modifierAssignments: {
        subject: [makeSlot('tarot', { name: 'The Moon' })],
        action: [makeSlot('d20')],
        effect: [makeSlot('iching')],
      },
    };
    const result1 = assembler4.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    assembler4.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    // Third call wraps back to index 0 (mystery has 2 openings)
    const result3 = assembler4.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    expect(result3.paragraphs[0]).toBe(result1.paragraphs[0]);
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

    // Should contain position labels
    expect(prompt).toContain('Past:');
    expect(prompt).toContain('Present:');
    expect(prompt).toContain('Future:');

    // Should contain card names with orientations for non-veiled cards
    expect(prompt).toContain('The Fool (upright)');
    expect(prompt).toContain('Two of Cups (reversed)');

    // Should NOT contain the veiled card's name
    expect(prompt).not.toContain('Three of Swords');

    // Veiled card should show as (veiled)
    expect(prompt).toContain('(veiled)');

    // Should still contain the regular prompt structure
    expect(prompt).toContain('Divinations');
    expect(prompt).toContain('Instructions');
  });

  it('affinity note appears for high order', () => {
    const result = assembler.assemble(baseAggregated, [], 'decision', { chaos: 30, order: 70 });
    expect(result.affinityNote).toContain('Order');
  });

  describe('NarrativeAssembler.describeSlotBrief', () => {
    it('describes a single tarot card by name', () => {
      const slot = makeSlot('tarot', { name: 'The Fool', orientation: 'upright' });
      const desc = (assembler as any).describeSlotBrief(slot);
      expect(desc).toBe('The The Fool (upright)');
    });

    it('describes a multi-card tarot spread by card name (positions handled by the per-position line)', () => {
      const spreadSlot = {
        type: 'tarot',
        id: 'spread:test',
        name: 'The Fool · The Magician · The High Priestess',
        number: 0,
        orientation: 'upright',
        symbol: '☉',
        meaningUpright: 'Meaning',
        meaningReversed: 'Reversed',
        themes: ['mystery'],
        dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 },
        modifierRoles: ['subject'],
        tags: [],
        spread: [
          { position: 'past' as const, card: { name: 'The Fool', orientation: 'upright' } },
          { position: 'present' as const, card: { name: 'The Magician', orientation: 'upright' } },
          { position: 'future' as const, card: { name: 'The High Priestess', orientation: 'upright' } },
        ],
      } as unknown as SlotResult;
      const desc = (assembler as any).describeSlotBrief(spreadSlot);
      expect(desc).toBe('The Fool (upright), The Magician (upright), The High Priestess (upright)');
      // Position labels are no longer re-listed in the brief.
      expect(desc).not.toContain('Past:');
    });

    it('single card tarot result with reversed uses original format', () => {
      const slot = makeSlot('tarot', { name: 'Death', orientation: 'reversed' });
      const desc = (assembler as any).describeSlotBrief(slot);
      expect(desc).toBe('The Death (reversed)');
    });
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
    // chaos elevated → affinityNote is set; clarity 2 should prefix the naming line.
    const r = na.assemble(baseAggregated, [], 'self', { chaos: 70, order: 30 }, fx({ hintClarity: 2 }));
    expect(r.affinityNote).toBeTruthy();
    expect(r.affinityNote).toContain('name themselves');
  });
});
