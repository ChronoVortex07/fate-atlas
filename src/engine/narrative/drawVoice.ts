import type { SlotResult, ModifierRole } from '../types';
import type { DrawVoice } from './types';
import { favBandOf, withArticle, gloss, verbPhrase, stableIndex } from './voices/shared';

export { favBandOf };

/**
 * Turn a single concrete draw into a grammatical fragment: a named `subject`
 * and a role/favorability-aware `clause`. Multi-card tarot spreads are handled
 * upstream by the composer (positions beat); if one is passed here, the first
 * card is used. Never returns an empty subject or clause.
 */
export function describeDraw(slot: SlotResult, role: ModifierRole): DrawVoice {
  switch (slot.type) {
    case 'tarot': {
      if (slot.spread && slot.spread.length > 1) {
        const first = slot.spread[0].card;
        return {
          subject: `${withArticle(first.name)}, ${first.orientation}`,
          clause: verbPhrase(role, first.dimensions, first.name + first.orientation),
        };
      }
      const subject = `${withArticle(slot.name)}, ${slot.orientation}`;
      const meaning = slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed;
      let clause = verbPhrase(role, slot.dimensions, slot.name + slot.orientation);
      if (meaning && stableIndex('gloss' + slot.name, 2) === 0) {
        const g = gloss(meaning);
        if (g) clause = `${clause} — ${g}`;
      }
      return { subject, clause };
    }
    case 'd20': {
      const subject = `the dice, settling on ${slot.result}`;
      const g = gloss(slot.interpretation);
      let clause = verbPhrase(role, slot.dimensions, 'd20' + slot.result);
      if (g && stableIndex('gloss-d20-' + slot.result, 2) === 0) clause = `${clause}, ${g}`;
      return { subject, clause };
    }
    case 'iching': {
      const subject = `Hexagram ${slot.hexagramNumber}, ${slot.name}`;
      let clause = verbPhrase(role, slot.dimensions, 'iching' + slot.hexagramNumber);
      const g = gloss(slot.judgment);
      if (g) clause = `${clause} — ${g}`;
      if (slot.changingLines.length > 0) clause = `${clause}, its lines already turning`;
      return { subject, clause };
    }
    case 'strings': {
      const parts = slot.name.split(' · ');
      const origin = parts[0] ?? 'the start';
      const dest = parts[parts.length - 1] ?? 'the end';
      const subject = parts.length > 1
        ? `the thread drawn from ${origin} to ${dest}`
        : `the thread at ${origin}`;
      let clause = verbPhrase(role, slot.dimensions, 'strings' + slot.name);
      const g = gloss(slot.interpretation);
      if (g) clause = `${clause} — ${g}`;
      return { subject, clause };
    }
    default: {
      const named = (slot as { name?: string }).name ?? slot.type;
      const interp = (slot as { interpretation?: string }).interpretation ?? '';
      const subject = `the ${named}`;
      let clause = verbPhrase(role, slot.dimensions, named);
      const g = gloss(interp);
      if (g) clause = `${clause} — ${g}`;
      return { subject, clause };
    }
  }
}
