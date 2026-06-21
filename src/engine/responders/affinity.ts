import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, SlotResult, RollModifier, TarotResult } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';

const T = TIER_BASE_CHANCE;
const w = (a: AffinityId) => (ctx: PhaseContext) => ctx.affinities[a];

function report(id: string, label: string, description: string, animation: string, targetSlot?: number): EffectReport {
  return { responderId: id, label, description, animation, targetSlot };
}

function pushMod(mod: RollModifier) {
  return (ctx: PhaseContext): EffectReport | null => {
    (ctx.draft.rollMods ??= []).push(mod);
    return null; // reducer reports
  };
}

export function buildAffinityResponders(): Responder[] {
  return [
    {
      id: 'will-widen-pool', source: 'affinity', triggers: ['select:draw:start'],
      group: { kind: 'exclusive', band: 'STRUCTURAL' }, weight: w('will'),
      condition: (c) => typeof c.draft.poolTarget === 'number',
      roll: (c) => bandRoll(c, 'will', 'ascendant', T.notable),
      apply: (c) => { c.draft.poolTarget = (c.draft.poolTarget as number) + 1;
        return report('will-widen-pool', 'Will', 'Your will widens the path — another way opens.', 'widen'); },
    },
    {
      id: 'fate-thin-pool', source: 'affinity', triggers: ['select:draw:start'],
      group: { kind: 'exclusive', band: 'STRUCTURAL' }, weight: w('fate'),
      condition: (c) => typeof c.draft.poolTarget === 'number' && (c.draft.poolTarget as number) > 2,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.notable),
      apply: (c) => { c.draft.poolTarget = (c.draft.poolTarget as number) - 1;
        return report('fate-thin-pool', 'Fate', 'Fate narrows the way — a path closes.', 'widen'); },
    },
    {
      id: 'shadow-shroud', source: 'affinity', triggers: ['select:draw:end'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('shadow'),
      condition: (c) => Array.isArray(c.draft.pool) && (c.draft.pool as SlotResult[]).length > 0,
      roll: (c) => bandRoll(c, 'shadow', 'ascendant', T.notable),
      apply: (c) => {
        const pool = c.draft.pool as SlotResult[];
        const idx = Math.floor(c.rng() * pool.length);
        (c.draft.shrouded ??= []).push(idx);
        return report('shadow-shroud', 'Shadow', 'Shadow falls across a path — its nature is hidden.', 'shroud', idx);
      },
    },
    {
      // 'select:pick' is never dispatched and the method pool is DivinationType[] (not SlotResult[]).
      // "Fate forces the method" is a deferred follow-up requiring a method-shaped override effect.
      id: 'fate-override-pick', source: 'affinity', triggers: ['tarot:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => !!c.hand && c.hand.length >= 2 && !!c.draft.outcome,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const hand = c.hand as SlotResult[];
        const others = hand.filter((h) => h !== c.draft.outcome);
        if (others.length === 0) return null;
        c.draft.outcome = others[Math.floor(c.rng() * others.length)];
        return report('fate-override-pick', 'Fate', 'The weave moves your hand — another is chosen for you.', 'override');
      },
    },
    {
      id: 'fate-auto-orient', source: 'affinity', triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => c.draft.outcome?.type === 'tarot',
      apply: (c) => {
        const card = c.draft.outcome as TarotResult;
        card.orientation = c.rng() < 0.5 ? 'upright' : 'reversed';
        return report('fate-auto-orient', 'Fate', 'Fate turns the card for you.', 'override');
      },
      roll: (c) => bandRoll(c, 'fate', 'stirring', T.notable),
    },
    {
      id: 'fate-hollow-reroll', source: 'affinity', triggers: ['dice:reroll'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => c.draft.outcome?.type === 'd20' && !!(c.event as { previous?: unknown })?.previous,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        c.draft.outcome = (c.event as { previous: SlotResult }).previous;
        return report('fate-hollow-reroll', 'Fate', 'The reroll rings hollow — the same face returns.', 'override');
      },
    },
    {
      id: 'chaos-second-result', source: 'affinity',
      triggers: ['dice:commit', 'tarot:commit', 'iching:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('chaos'),
      condition: (c) => !!c.draft.outcome && c.draft.outcome.type !== 'happening',
      roll: (c) => bandRoll(c, 'chaos', 'dominant', T.major),
      apply: (c) => {
        c.draft.spawnSecond = (c.draft.outcome as SlotResult).type;
        return report('chaos-second-result', 'Chaos', 'Chaos surges — a second possibility emerges from the void.', 'second-result');
      },
    },
    {
      id: 'chaos-happening-interrupt', source: 'affinity', triggers: ['minigame:end'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('chaos'),
      condition: (c) => c.draft.lastReading !== true,
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.major),
      apply: (c) => { c.draft.interruptHappening = true;
        return report('chaos-happening-interrupt', 'Chaos', 'The weave tears — something intrudes.', 'second-result'); },
    },
    {
      id: 'light-advantage', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('light'),
      condition: () => true, roll: (c) => bandRoll(c, 'light', 'ascendant', T.ambient),
      apply: pushMod('advantage'),
    },
    {
      id: 'shadow-disadvantage', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('shadow'),
      condition: () => true, roll: (c) => bandRoll(c, 'shadow', 'ascendant', T.ambient),
      apply: pushMod('disadvantage'),
    },
    {
      id: 'will-choice', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('will'),
      condition: () => true, roll: (c) => bandRoll(c, 'will', 'dominant', T.major),
      apply: pushMod('choice'),
    },
    {
      id: 'will-offer-reroll', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('will'),
      condition: () => true, roll: (c) => bandRoll(c, 'will', 'stirring', T.notable),
      apply: pushMod('offer-reroll'),
    },
  ];
}
