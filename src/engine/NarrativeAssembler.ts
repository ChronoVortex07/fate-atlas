import type {
  AggregatedReading, SynthesisResult, SlotResult, QuestionType,
  EffectReport, AffinityEffects,
} from './types';
import type { AffinityId } from './types';
import { bandOf } from '../data/affinities';
import { ReadingComposer } from './narrative/ReadingComposer';
import { ProseBuilder, seedFor } from './narrative/ProseBuilder';

// Each affinity's voice, surfaced when it is the most-elevated force in the reading.
const AFFINITY_NOTES: Record<AffinityId, string> = {
  chaos: 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.',
  order: 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.',
  fate:  'Fate draws the thread taut — what is shown here carries the weight of the already-written.',
  will:  'Your will presses against the omens; nothing here is fixed that your own hand cannot move.',
  light: 'Light lies plainly across the reading — the forces consent to be named.',
  shadow:'Shadow keeps its counsel; what is shown is the smaller truth, the larger one withheld.',
};
// Tie-break order when several affinities share the top value.
const AFFINITY_PRIORITY: AffinityId[] = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];

function pickAffinityNote(affinities: Record<string, number>, clarity: number): string | undefined {
  const elevated = AFFINITY_PRIORITY
    .map((id) => ({ id, value: affinities[id] ?? 0, band: bandOf(affinities[id] ?? 0) }))
    .filter((a) => a.band === 'ascendant' || a.band === 'dominant')
    .sort((a, b) => b.value - a.value); // priority order is preserved on ties (stable sort)
  if (elevated.length === 0) return undefined;
  let note = AFFINITY_NOTES[elevated[0].id];
  // Light's clarity reframe (preserved): plainly-named at high clarity, occluded at low.
  if (clarity >= 2) note = `The forces name themselves plainly: ${note}`;
  else if (clarity <= -2) note = 'Something stirs beneath the surface, but its name will not come.';
  return note;
}

export class NarrativeAssembler {
  private composer = new ReadingComposer();
  private builder = new ProseBuilder();

  /** Reset rotation state (call at start of each turn). */
  resetRotation(): void {
    this.builder.resetRotation();
  }

  /** Snapshot rotation state so preview calls don't consume rotation. */
  getRotationSnapshot(): Map<string, number> {
    return this.builder.getRotationSnapshot();
  }

  /** Restore rotation state from a snapshot. */
  restoreRotation(snapshot: Map<string, number>): void {
    this.builder.restoreRotation(snapshot);
  }

  /**
   * Main assembly: compose the aggregated reading into typed beats, then build
   * flowing prose. Affinity note + reading-detail elaboration are layered on
   * top (they are separate channels from the woven body).
   */
  assemble(
    aggregated: AggregatedReading,
    results: SlotResult[],
    question: QuestionType,
    affinities: Record<string, number>,
    effects?: AffinityEffects,
  ): SynthesisResult {
    const seed = seedFor(aggregated, question, results);
    const beats = this.composer.compose({ aggregated, results, question, effects, seed });
    const built = this.builder.build(beats, { aggregated, question, seed });
    const paragraphs = [...built.paragraphs];

    // Reading detail (Light): a rich reading spells an extra line out in full,
    // inserted just before the close so the reading still ends on its sign-off.
    const detail = effects?.readingDetail ?? 0;
    if (detail > 0 && paragraphs.length > 0) {
      const line = 'Every thread lies plain to the eye — the reading withholds nothing, each sign spelled out in full.';
      paragraphs.splice(Math.max(0, paragraphs.length - 1), 0, line);
    }

    // Affinity note — the most-elevated of the six affinities speaks (Ascendant+).
    const affinityNote = pickAffinityNote(affinities, effects?.hintClarity ?? 0);

    return {
      headline: built.headline,
      paragraphs,
      tensionNote: built.tensionNote,
      affinityNote,
    };
  }

  /**
   * Generate LLM prompt with structured data alongside narrative.
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
      case 'strings': {
        const parts = slot.name.split(' · ');
        const origin = parts[0];
        const dest = parts[parts.length - 1];
        const middle = parts.slice(1, -1);
        const route = middle.length > 0
          ? `From ${origin}, the thread weaves through ${middle.join(', ')} to ${dest}`
          : `The thread runs from ${origin} to ${dest}`;
        return `${route} — ${slot.interpretation} [themes: ${slot.themes.join(', ')}] [favorability: ${slot.dimensions.favorability}]`;
      }
      case 'happening':
        return `An event unfolds: ${slot.scene} [themes: ${slot.themes.join(', ')}]`;
      default:
        return '';
    }
  }
}
