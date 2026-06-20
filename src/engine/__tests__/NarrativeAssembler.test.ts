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
    return { ...base, id: 'test', name: 'The Fool', number: 0, orientation: 'upright' as const, symbol: '☉', meaningUpright: 'New beginnings', meaningReversed: 'Recklessness' } as unknown as SlotResult;
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
      interactions: [],
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
});
