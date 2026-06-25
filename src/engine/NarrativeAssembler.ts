import type {
  AggregatedReading, SynthesisResult, SlotResult, QuestionType,
  ModifierRole, EffectReport, AffinityEffects,
} from './types';
import { NARRATIVE_TEMPLATES } from '../data/narrative-templates';
import { bandOf } from '../data/affinities';

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
  if (value >= 0.5) return 'high';
  if (value <= -0.5) return 'low';
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

  /** Snapshot rotation state so preview calls don't consume template rotation. */
  getRotationSnapshot(): Map<string, number> {
    return new Map(this.rotationState);
  }

  /** Restore rotation state from a snapshot. */
  restoreRotation(snapshot: Map<string, number>): void {
    this.rotationState = new Map(snapshot);
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
    results: SlotResult[],
    question: QuestionType,
    affinities: Record<string, number>,
    effects?: AffinityEffects,
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
    // Assign each result to exactly one modifier role for narration: the role in
    // which it ranks strongest (lowest index after the sumAbsDimensions sort).
    const roleOrder: ModifierRole[] = ['subject', 'action', 'effect'];
    const rankIn = (role: ModifierRole, r: SlotResult) => aggregated.modifierAssignments[role].indexOf(r);
    const uniqueResults = new Set<SlotResult>();
    for (const role of roleOrder) for (const r of aggregated.modifierAssignments[role]) uniqueResults.add(r);
    const narrationByRole: Record<ModifierRole, SlotResult[]> = { subject: [], action: [], effect: [] };
    for (const r of uniqueResults) {
      const roles = roleOrder.filter((role) => rankIn(role, r) >= 0);
      let best = roles[0];
      for (const role of roles.slice(1)) if (rankIn(role, r) < rankIn(best, r)) best = role;
      narrationByRole[best].push(r);
    }
    for (const role of roleOrder) {
      narrationByRole[role].sort((a, b) => rankIn(role, a) - rankIn(role, b));
    }

    for (const role of roleOrder) {
      const assigned = narrationByRole[role];
      const frameKey = `${role}_${question}`;
      const framePool = this.templates.modifierFrames[frameKey];
      const trueGap = aggregated.modifierAssignments[role].length === 0;

      if (assigned && assigned.length > 0) {
        const resultsText = assigned.map((r) => this.describeSlotBrief(r)).join('; ');
        const frame = this.pick(`modifier_${frameKey}`, framePool ?? [frameKey]);
        paragraphs.push(frame.replace('{results}', resultsText));
      } else if (trueGap) {
        const fallbackPool = this.templates.fallbacks.missingModifier[role];
        if (fallbackPool && fallbackPool.length > 0) {
          paragraphs.push(this.pick(`missing_${role}`, fallbackPool));
        }
      }
    }

    // Per-position insight: one compact line per multi-card tarot spread.
    for (const r of results) {
      if (r.type !== 'tarot' || !r.spread || r.spread.length <= 1) continue;
      const parts = r.spread.map((sp) => {
        const pos = sp.position.charAt(0).toUpperCase() + sp.position.slice(1);
        const fav = sp.card.dimensions.favorability;
        if (fav >= 0.5) return `${pos} leans ${sp.card.themes[0] ?? 'mystery'}`;
        if (fav <= -0.5) return `${pos} turns adverse`;
        return `${pos} holds steady`;
      });
      paragraphs.push(parts.join(' · '));
    }

    // Stage 4: Tension (conditional)
    // Named opposition: when strong poles oppose, name them explicitly.
    const netBand = getFavorabilityBand(aggregated.dimensionProfile.favorability);
    const favPole = aggregated.strongestFavor;
    const advPole = aggregated.strongestAdverse;
    const polesOppose = !!favPole && !!advPole && favPole.value >= 1 && advPole.value <= -1;
    let namedOpposition: string | null = null;
    if (polesOppose) {
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      namedOpposition = `${cap(favPole!.label)} pulls toward fortune while ${advPole!.label} drags against it — the balance you feel is a contest, not a calm.`;
    }
    if (netBand === 'neutral' && namedOpposition) {
      paragraphs.push(namedOpposition);
    }

    if (aggregated.hasTension) {
      if (!aggregated.tensionPair && namedOpposition) {
        // Variance-based tension names its actual poles (avoid double-print when
        // the neutral branch above already pushed it).
        if (netBand !== 'neutral') paragraphs.push(namedOpposition);
      } else {
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
    }

    // Stage 5: Closing
    const closingPool = this.templates.closings[question];
    if (closingPool && closingPool.length > 0) {
      const closing = this.pick(`closing_${question}`, closingPool);
      paragraphs.push(closing.replace('{dominantTheme}', aggregated.dominantTheme));
    }

    // Affinity note — elevated when Chaos/Order reach Ascendant or higher.
    let affinityNote: string | undefined;
    const chaosBand = bandOf(affinities.chaos ?? 0);
    const orderBand = bandOf(affinities.order ?? 0);
    const isElevated = (b: string) => b === 'ascendant' || b === 'dominant';
    if (isElevated(chaosBand)) {
      affinityNote = 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.';
    } else if (isElevated(orderBand)) {
      affinityNote = 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.';
    }

    // Light/Shadow reading detail & clarity (Phase 3).
    const detail = effects?.readingDetail ?? 0;
    const clarity = effects?.hintClarity ?? 0;
    if (detail > 0) {
      paragraphs.push(
        'Every thread lies plain to the eye — the reading withholds nothing, each sign spelled out in full.',
      );
    } else if (detail < 0) {
      // Terse: collapse the body to its first two paragraphs.
      if (paragraphs.length > 2) paragraphs.splice(2);
    }
    if (clarity >= 2 && affinityNote) {
      affinityNote = `The forces name themselves plainly: ${affinityNote}`;
    } else if (clarity <= -2 && affinityNote) {
      affinityNote = 'Something stirs beneath the surface, but its name will not come.';
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
        if (slot.spread && slot.spread.length > 1) {
          // Name the cards; positions are narrated by the dedicated per-position line.
          return slot.spread.map((sp) => `${sp.card.name} (${sp.card.orientation})`).join(', ');
        }
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
    effects: EffectReport[];
    affinities: Record<string, number>;
    aggregated?: AggregatedReading;
  }): string {
    const lines: string[] = [];
    lines.push('## Atlas of Fate Reading');
    lines.push('');
    lines.push(`**Question type:** ${run.question}`);
    const isElevatedChaos = (() => { const b = bandOf(run.affinities.chaos ?? 0); return b === 'ascendant' || b === 'dominant'; })();
    const isElevatedOrder = (() => { const b = bandOf(run.affinities.order ?? 0); return b === 'ascendant' || b === 'dominant'; })();
    lines.push(`**Affinity hints:** ${isElevatedChaos ? 'High Chaos - volatile and unpredictable' : isElevatedOrder ? 'High Order - steady and clear' : 'Balanced - neutral currents'}`);
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

    if (run.effects.length > 0) {
      lines.push('### Meta Events');
      run.effects.forEach((ev) => {
        lines.push(`- ${ev.label}: ${ev.description}`);
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
        if (slot.spread && slot.spread.length > 1) {
          return slot.spread.map((sp) => {
            const pos = sp.position.charAt(0).toUpperCase() + sp.position.slice(1);
            if (sp.card.veiled) return `${pos}: (veiled)`;
            return `${pos}: ${sp.card.name} (${sp.card.orientation})`;
          }).join('\n');
        }
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
