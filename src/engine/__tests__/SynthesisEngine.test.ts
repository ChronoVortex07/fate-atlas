import { describe, it, expect } from 'vitest';
import { SynthesisEngine } from '../SynthesisEngine';
import type { SlotResult, QuestionType } from '../types';

const foolCard: SlotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'upright', symbol: '☉',
  meaningUpright: 'A leap of faith awaits.', meaningReversed: 'Hesitation before the leap.',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'upright'],
};

const diceRoll: SlotResult = {
  type: 'd20', result: 17, threshold: 'critical-high',
  interpretation: 'Fortune favors boldness.',
  tags: ['roll', 'random', 'numeric', 'threshold', 'high'],
};

const ichingHex: SlotResult = {
  type: 'iching', hexagramNumber: 27, name: 'Nourishment',
  symbol: '䷛', judgment: 'Nourish what is worthy within.',
  changingLines: [3, 5],
  tags: ['draw', 'random', 'binary', 'reversible', 'changing-lines'],
};

describe('SynthesisEngine', () => {
  const engine = new SynthesisEngine();

  it('produces a synthesis with headline and paragraphs', () => {
    const result = engine.synthesize(
      [foolCard, diceRoll, ichingHex],
      'decision',
      [],
      { chaos: 0.4, order: 0.5 },
    );
    expect(result.headline).toBeTruthy();
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });

  it('detects tension between opposing results', () => {
    const cautionDice: SlotResult = {
      ...diceRoll, result: 3, threshold: 'critical-low',
      interpretation: 'The odds are against you.',
      tags: ['roll', 'random', 'numeric', 'threshold', 'low', 'critical-low'],
    };
    const result = engine.synthesize(
      [foolCard, cautionDice, ichingHex],
      'decision',
      [],
      { chaos: 0.4, order: 0.5 },
    );
    expect(result.tensionNote).toBeTruthy();
  });

  it('generates LLM prompt markdown with all elements', () => {
    const prompt = engine.generateLLMPrompt({
      question: 'decision' as QuestionType,
      slots: [foolCard, diceRoll, ichingHex],
      interactions: [],
      affinities: { chaos: 0.4, order: 0.5 },
    });
    expect(prompt).toContain('Atlas of Fate');
    expect(prompt).toContain('The Fool');
    expect(prompt).toContain('17');
    expect(prompt).toContain('Nourishment');
    expect(prompt).toContain('```');
  });
});
