import type {
  AggregatedReading, SynthesisResult, SlotResult, QuestionType,
  ModifierRole, InteractionEvent,
} from './types';
import { NARRATIVE_TEMPLATES } from '../data/narrative-templates';

// Subject noun phrases per question type (for {subject} substitution)
const SUBJECT_NOUNS: Record<QuestionType, string> = {
  decision: 'your path forward',
  relationship: 'the bonds you share',
  future: 'the horizon ahead',
  self: 'your inner nature',
};

// Dimension band thresholds
type Band = 'high' | 'neutral' | 'low';

function getFavorabilityBand(value: number): Band {
  if (value >= 1.0) return 'high';
  if (value <= -0.9) return 'low';
  return 'neutral';
}

function getPolarBand(value: number): Band | null {
  // For certainty and volatility: only high/low speak, neutral is null
  if (value >= 1.0) return 'high';
  if (value <= -0.9) return 'low';
  return null;
}

export class NarrativeAssembler {
  private rotationState: Map<string, number> = new Map();
  private templates = NARRATIVE_TEMPLATES;

  /** Reset rotation state (call at start of each turn) */
  resetRotation(): void {
    this.rotationState.clear();
  }

  /**
   * Select a template from a pool and advance rotation index.
   * Returns the template string; wraps to 0 after exhausting the pool.
   */
  private pick(poolKey: string, pool: string[]): string {
    if (pool.length === 0) return '';
    let idx = this.rotationState.get(poolKey) ?? 0;
    if (idx >= pool.length) idx = 0;
    const template = pool[idx];
    this.rotationState.set(poolKey, idx + 1);
    return template;
  }

  /**
   * Main assembly: produce SynthesisResult from aggregated data.
   */
  assemble(
    aggregated: AggregatedReading,
    _results: SlotResult[],
    question: QuestionType,
    affinities: Record<string, number>,
  ): SynthesisResult {
    const paragraphs: string[] = [];

    // Stage 1: Opening
    const openingKey = aggregated.dominantTheme;
    const openingPool = this.templates.openings[openingKey];
    let opening: string;
    if (openingPool && openingPool.length > 0) {
      opening = this.pick(`opening_${openingKey}`, openingPool);
    } else {
      opening = this.pick('fallback_noDominantTheme', this.templates.fallbacks.noDominantTheme);
    }
    paragraphs.push(opening.replace('{subject}', SUBJECT_NOUNS[question]));

    // Stage 2: Dimension body
    const dimParts: string[] = [];
    const favBand = getFavorabilityBand(aggregated.dimensionProfile.favorability);
    const certBand = getPolarBand(aggregated.dimensionProfile.certainty);
    const volBand = getPolarBand(aggregated.dimensionProfile.volatility);

    dimParts.push(this.pick(
      `dim_favorability_${favBand}`,
      this.templates.dimensionBands[`favorability_${favBand}`] ?? [],
    ));

    if (certBand !== null) {
      dimParts.push(this.pick(
        `dim_certainty_${certBand}`,
        this.templates.dimensionBands[`certainty_${certBand}`] ?? [],
      ));
    }
    if (volBand !== null) {
      dimParts.push(this.pick(
        `dim_volatility_${volBand}`,
        this.templates.dimensionBands[`volatility_${volBand}`] ?? [],
      ));
    }

    if (dimParts.length > 0) {
      paragraphs.push(dimParts.join(' '));
    }

    // Stage 3: Modifier weaving
    const allRoles: ModifierRole[] = ['subject', 'action', 'effect'];
    for (const role of allRoles) {
      const assigned = aggregated.modifierAssignments[role];
      const frameKey = `${role}_${question}`;
      const framePool = this.templates.modifierFrames[frameKey];

      if (assigned && assigned.length > 0) {
        const resultsText = assigned.map((r) => this.describeSlotBrief(r)).join('; ');
        const frame = this.pick(`modifier_${frameKey}`, framePool ?? [frameKey]);
        paragraphs.push(frame.replace('{results}', resultsText));
      } else {
        // Missing modifier — acknowledge the gap
        const fallbackPool = this.templates.fallbacks.missingModifier[role];
        if (fallbackPool && fallbackPool.length > 0) {
          paragraphs.push(this.pick(`missing_${role}`, fallbackPool));
        }
      }
    }

    // Stage 4: Tension (conditional)
    if (aggregated.hasTension) {
      let tensionKey: string;
      if (aggregated.tensionPair) {
        const [a, b] = aggregated.tensionPair;
        // Normalize key: sort alphabetically
        tensionKey = [a, b].sort().join('_');
      } else {
        tensionKey = 'high_variance';
      }
      const tensionPool = this.templates.tensionPatterns[tensionKey];
      if (tensionPool && tensionPool.length > 0) {
        paragraphs.push(this.pick(`tension_${tensionKey}`, tensionPool));
      }
    }

    // Stage 5: Closing
    const closingPool = this.templates.closings[question];
    if (closingPool && closingPool.length > 0) {
      const closing = this.pick(`closing_${question}`, closingPool);
      paragraphs.push(closing.replace('{dominantTheme}', aggregated.dominantTheme));
    }

    // Affinity note (unchanged from current)
    let affinityNote: string | undefined;
    if (affinities.chaos >= 0.5) {
      affinityNote = 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.';
    } else if (affinities.order >= 0.5) {
      affinityNote = 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.';
    }

    // Headline
    const headline = this.buildHeadline(aggregated, question);

    return {
      headline,
      paragraphs,
      tensionNote: aggregated.hasTension ? paragraphs.find(
        (_p, i) => paragraphs.length > 3 && i >= paragraphs.length - 2,
      ) : undefined,
      affinityNote,
    };
  }

  private buildHeadline(aggregated: AggregatedReading, _question: QuestionType): string {
    const favBand = getFavorabilityBand(aggregated.dimensionProfile.favorability);
    const headlineKey = `${aggregated.dominantTheme}_${favBand}`;
    const headlinePool = this.templates.headlines[headlineKey];
    if (headlinePool && headlinePool.length > 0) {
      return this.pick(`headline_${headlineKey}`, headlinePool);
    }
    // Fallback
    return `The Threads of Fate Unspool...`;
  }

  private describeSlotBrief(slot: SlotResult): string {
    switch (slot.type) {
      case 'tarot':
        return `The ${slot.name} (${slot.orientation})`;
      case 'd20':
        return `The dice settle on ${slot.result} (${slot.threshold.replace('-', ' ')})`;
      case 'iching':
        return `Hexagram ${slot.hexagramNumber} "${slot.name}"`;
      case 'happening':
        return `A happening: ${slot.scene}`;
      default:
        return '';
    }
  }

  /**
   * Generate LLM prompt with structured data alongside narrative.
   * Replaces SynthesisEngine.generateLLMPrompt().
   */
  generateLLMPrompt(run: {
    question: QuestionType;
    slots: SlotResult[];
    interactions: InteractionEvent[];
    affinities: Record<string, number>;
    aggregated?: AggregatedReading;
  }): string {
    const lines: string[] = [];
    lines.push('## Atlas of Fate Reading');
    lines.push('');
    lines.push(`**Question type:** ${run.question}`);
    lines.push(`**Affinity hints:** ${run.affinities.chaos >= 0.5 ? 'High Chaos - volatile and unpredictable' : run.affinities.order >= 0.5 ? 'High Order - steady and clear' : 'Balanced - neutral currents'}`);
    lines.push('');

    if (run.aggregated) {
      lines.push('### Structured Brief');
      lines.push(`- Dominant theme: ${run.aggregated.dominantTheme}`);
      if (run.aggregated.secondaryTheme) {
        lines.push(`- Secondary theme: ${run.aggregated.secondaryTheme}`);
      }
      lines.push(`- Favorability: ${run.aggregated.dimensionProfile.favorability}`);
      lines.push(`- Certainty: ${run.aggregated.dimensionProfile.certainty}`);
      lines.push(`- Volatility: ${run.aggregated.dimensionProfile.volatility}`);
      if (run.aggregated.hasTension) {
        lines.push(`- Tension: ${run.aggregated.tensionPair ? run.aggregated.tensionPair.join(' vs ') : 'high variance'}`);
      }
      lines.push('');
    }

    lines.push('### Divinations');
    lines.push('```');
    run.slots.forEach((slot, i) => {
      if (!slot) return;
      lines.push(`${i + 1}. ${this.describeSlotFull(slot)}`);
    });
    lines.push('```');
    lines.push('');

    if (run.interactions.length > 0) {
      lines.push('### Meta Events');
      run.interactions.forEach((ev) => {
        lines.push(`- ${ev.description}`);
      });
      lines.push('');
    }

    lines.push('### Instructions');
    lines.push('Synthesize these divination results into a cohesive, mystical reading. Consider:');
    lines.push('- How the divinations reinforce or contradict each other');
    lines.push('- The question context and what is at stake');
    lines.push('- The affinity state and how it colors the interpretation');
    lines.push('- The meta events and their implications');
    lines.push('- The structured theme/dimension brief above as a guide to the overall shape');
    lines.push('');
    lines.push('Write in an atmospheric, insightful tone — as if divining the stars themselves. Avoid generic fortune-cookie phrasing. Be specific to the cards, numbers, and hexagrams drawn.');

    return lines.join('\n');
  }

  private describeSlotFull(slot: SlotResult): string {
    switch (slot.type) {
      case 'tarot':
        return `The ${slot.name} appears ${slot.orientation} — ${slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed} [themes: ${slot.themes.join(', ')}] [favorability: ${slot.dimensions.favorability}]`;
      case 'd20':
        return `The dice settle on ${slot.result} (${slot.threshold.replace('-', ' ')}) — ${slot.interpretation} [themes: ${slot.themes.join(', ')}] [favorability: ${slot.dimensions.favorability}]`;
      case 'iching':
        return `Hexagram ${slot.hexagramNumber} "${slot.name}" ${slot.symbol} — ${slot.judgment}${slot.changingLines.length ? ` Changing lines at ${slot.changingLines.join(', ')}.` : ''} [themes: ${slot.themes.join(', ')}] [favorability: ${slot.dimensions.favorability}]`;
      case 'happening':
        return `An event unfolds: ${slot.scene} [themes: ${slot.themes.join(', ')}]`;
      default:
        return '';
    }
  }
}
