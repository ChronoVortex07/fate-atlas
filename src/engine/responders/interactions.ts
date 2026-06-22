import type { Responder, EffectReport } from '../events/types';
import type { SlotResult, TarotResult, DiceResult } from '../types';
import { reverseSpread } from '../../data/tarot';

const has = (s: SlotResult, ...tags: string[]) => tags.every((t) => s.tags.includes(t));
const reversibles = (spread: SlotResult[]) => spread.filter((s) => s.tags.includes('reversible'));
const criticalDie = (spread: SlotResult[], threshold: DiceResult['threshold']) =>
  spread.find((s): s is DiceResult => s.type === 'd20' && (s as DiceResult).threshold === threshold);

function report(id: string, label: string, description: string, animation: string, targetSlot?: number): EffectReport {
  return { responderId: id, label, description, animation, targetSlot };
}

export function buildInteractionResponders(): Responder[] {
  return [
    {
      id: 'fool-reroll', source: 'interaction', triggers: ['dice:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => c.draft.outcome?.type === 'd20' && c.spread.some((s) => has(s, 'major-arcana', 'fool-archetype')),
      roll: () => true,
      apply: (c) => {
        c.draft.rerollOutcome = true;
        return report('fool-reroll', "The Fool", "The Fool's wild energy ripples through fate — the dice must be cast again.", 'reroll');
      },
    },
    {
      id: 'critical-resonance', source: 'interaction', triggers: ['tarot:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => {
        const card = c.draft.outcome;
        if (card?.type !== 'tarot') return false;
        const up = (card as TarotResult).orientation === 'upright';
        return up ? !!criticalDie(c.spread, 'critical-low') : !!criticalDie(c.spread, 'critical-high');
      },
      roll: () => true,
      apply: (c) => {
        const card = c.draft.outcome as TarotResult;
        const wasUpright = card.orientation === 'upright';
        c.draft.outcome = reverseSpread(card);
        return report('critical-resonance', 'Critical Resonance',
          wasUpright ? 'A dire omen drags the spread down — it inverts.' : 'A bright omen lifts the spread — it rights itself.',
          'flip');
      },
    },
    {
      id: 'mirror', source: 'interaction', triggers: ['dice:commit', 'tarot:commit', 'iching:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => reversibles(c.spread).length === 2,
      roll: (c) => c.rng() < 0.85,
      apply: (c) => {
        if (c.draft.outcome?.type === 'tarot') {
          c.draft.outcome = reverseSpread(c.draft.outcome as TarotResult);
        }
        return report('mirror', 'The Mirror', 'Two forces reflect each other across the weave — both turn.', 'mirror');
      },
    },
    {
      id: 'iching-happening-boost', source: 'interaction', triggers: ['happening:start'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 1,
      condition: (c) => c.spread.some((s) => s.type === 'iching' && s.tags.includes('changing-lines')),
      roll: () => true,
      apply: (c) => {
        c.draft.addChoice = true;
        return report('iching-happening-boost', 'I Ching', 'The changing lines reveal hidden branches — more choices emerge.', 'add-choice');
      },
    },
  ];
}
