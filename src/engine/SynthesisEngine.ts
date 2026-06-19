import type { SlotResult, SynthesisResult, QuestionType, InteractionEvent } from './types';

export class SynthesisEngine {
  synthesize(
    slots: SlotResult[],
    question: QuestionType,
    interactions: InteractionEvent[],
    affinities: Record<string, number>,
  ): SynthesisResult {
    const paragraphs: string[] = [];
    let tensionNote: string | undefined;
    let affinityNote: string | undefined;

    // Build individual interpretation lines
    for (const slot of slots) {
      if (!slot) continue;
      const para = this.describeSlot(slot);
      paragraphs.push(para);
    }

    // Check for tension: opposing signals between results
    const hasHigh = slots.some((s) => s?.tags.includes('high') || s?.tags.includes('critical-high'));
    const hasLow = slots.some((s) => s?.tags.includes('low') || s?.tags.includes('critical-low'));
    if (hasHigh && hasLow) {
      tensionNote = 'The forces revealed are in tension — fortune and caution pull in opposite directions. The path forward requires balancing boldness with prudence.';
    }

    const hasReversedOrientation = slots.some((s) => s?.type === 'tarot' && s.orientation === 'reversed');
    const hasUprightOrientation = slots.some((s) => s?.type === 'tarot' && s.orientation === 'upright');
    if (hasReversedOrientation && hasUprightOrientation) {
      tensionNote = (tensionNote ?? '') + ' Reversed and upright influences intertwine — what appears straightforward may carry hidden dimensions.';
    }

    // Tarot orientation vs dice threshold tension
    const anyUprightTarot = slots.some((s) => s?.type === 'tarot' && s.orientation === 'upright');
    const anyLowDice = slots.some((s) => s?.type === 'd20' && (s.threshold === 'low' || s.threshold === 'critical-low'));
    const anyReversedTarot = slots.some((s) => s?.type === 'tarot' && s.orientation === 'reversed');
    const anyHighDice = slots.some((s) => s?.type === 'd20' && (s.threshold === 'high' || s.threshold === 'critical-high'));
    if (anyUprightTarot && anyLowDice) {
      tensionNote = (tensionNote ?? '') + ' An upright card\'s promise is shadowed by a cautious dice roll — fate speaks in contradictions. The bold path and the safe path diverge before you.';
    }
    if (anyReversedTarot && anyHighDice) {
      tensionNote = (tensionNote ?? '') + ' A reversed card\'s doubt meets a fortunate dice roll — the omens are mixed, urging careful discernment.';
    }

    // Affinity note
    if (affinities.chaos >= 0.5) {
      affinityNote = 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.';
    } else if (affinities.order >= 0.5) {
      affinityNote = 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.';
    }

    // Question framing
    const questionFrames: Record<QuestionType, string> = {
      decision: 'As you weigh your decision, consider how these forces illuminate the choice before you.',
      relationship: 'In matters of connection, these signs reveal the deeper currents at play.',
      future: 'When gazing ahead, these threads of fate offer glimpses of what may come.',
      self: 'In the mirror of divination, these symbols reflect aspects of your inner landscape.',
    };

    const headline = this.buildHeadline(slots, question);

    return {
      headline,
      paragraphs: [...paragraphs, questionFrames[question]],
      tensionNote,
      affinityNote,
    };
  }

  private describeSlot(slot: SlotResult): string {
    switch (slot.type) {
      case 'tarot':
        return `The ${slot.name} appears ${slot.orientation} — ${slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed}`;
      case 'd20':
        return `The dice settle on ${slot.result} (${slot.threshold.replace('-', ' ')}) — ${slot.interpretation}`;
      case 'iching':
        return `Hexagram ${slot.hexagramNumber}, "${slot.name}" ${slot.symbol} emerges — ${slot.judgment}${slot.changingLines.length ? ` Changing lines at ${slot.changingLines.join(', ')} suggest transformation in progress.` : ''}`;
      case 'happening':
        return `An event unfolds: ${slot.scene}`;
      default:
        return '';
    }
  }

  private buildHeadline(slots: SlotResult[], question: QuestionType): string {
    const questionNouns: Record<QuestionType, string> = {
      decision: 'your path forward',
      relationship: 'the bonds you share',
      future: 'the horizon ahead',
      self: 'your inner nature',
    };
    const cards = slots.filter(Boolean);
    if (cards.length === 0) return `The stars are silent on ${questionNouns[question]}.`;
    const firstSlot = cards[0];
    const firstWord = firstSlot.type === 'tarot' ? (firstSlot as { name: string }).name :
      firstSlot.type === 'd20' ? `The number ${(firstSlot as { result: number }).result}` :
      (firstSlot as { name: string }).name;
    return `${firstWord} illuminates ${questionNouns[question]}.`;
  }

  generateLLMPrompt(run: {
    question: QuestionType;
    slots: SlotResult[];
    interactions: InteractionEvent[];
    affinities: Record<string, number>;
  }): string {
    const lines: string[] = [];
    lines.push('## Atlas of Fate Reading');
    lines.push('');
    lines.push(`**Question type:** ${run.question}`);
    lines.push(`**Affinity hints:** ${run.affinities.chaos >= 0.5 ? 'High Chaos - volatile and unpredictable' : run.affinities.order >= 0.5 ? 'High Order - steady and clear' : 'Balanced - neutral currents'}`);
    lines.push('');
    lines.push('### Divinations');
    lines.push('```');
    run.slots.forEach((slot, i) => {
      if (!slot) return;
      lines.push(`${i + 1}. ${this.describeSlot(slot)}`);
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
    lines.push('');
    lines.push('Write in an atmospheric, insightful tone — as if divining the stars themselves. Avoid generic fortune-cookie phrasing. Be specific to the cards, numbers, and hexagrams drawn.');

    return lines.join('\n');
  }
}
