import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, SlotResult, RollModifier, TarotResult } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE, bandOf, BAND_ORDER } from '../../data/affinities';

const T = TIER_BASE_CHANCE;
const SHROUD_STEP_CHANCE = 0.20; // flat per-step chance (not bandRoll-scaled — see A3 note)
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
        return report('fate-thin-pool', 'Fate', 'Fate narrows the way — a path closes.', 'thin'); },
    },
    {
      id: 'shadow-shroud', source: 'affinity', triggers: ['select:draw:end'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('shadow'),
      condition: (c) => Array.isArray(c.draft.pool) && (c.draft.pool as SlotResult[]).length > 0,
      // Firing roll: Shadow at Ascendant+ (matches the design's "veiled" band)
      // AND a flat 20% chance. This responder intentionally uses a flat per-step
      // chance, not the band-scaled bandRoll: `forced` bypasses only the firing
      // roll, so a forced fire always yields >=1 shroud plus probabilistic extras
      // — correct for the demo scenario.
      roll: (c) => {
        const idx = BAND_ORDER.indexOf(bandOf(c.affinities.shadow));
        return idx >= BAND_ORDER.indexOf('ascendant') && c.rng() < SHROUD_STEP_CHANCE;
      },
      apply: (c) => {
        const pool = c.draft.pool as SlotResult[];
        const band = BAND_ORDER.indexOf(bandOf(c.affinities.shadow));
        const shrouded = (c.draft.shrouded ??= []);
        const pickDistinct = (): number | null => {
          if (shrouded.length >= pool.length) return null;
          let idx = Math.floor(c.rng() * pool.length);
          // linear-probe to a free index (small pools)
          while (shrouded.includes(idx)) idx = (idx + 1) % pool.length;
          return idx;
        };
        // First shroud always lands (the firing roll already passed / was forced).
        const first = pickDistinct();
        if (first !== null) shrouded.push(first);
        // Ascendant+: 20% for a second distinct index.
        if (band >= BAND_ORDER.indexOf('ascendant') && c.rng() < SHROUD_STEP_CHANCE) {
          const second = pickDistinct();
          if (second !== null) shrouded.push(second);
        }
        // Dominant: 20% for a third distinct index.
        if (band >= BAND_ORDER.indexOf('dominant') && c.rng() < SHROUD_STEP_CHANCE) {
          const third = pickDistinct();
          if (third !== null) shrouded.push(third);
        }
        const n = shrouded.length;
        return report('shadow-shroud', 'Shadow',
          n > 1 ? `Shadow falls across ${n} paths — their nature is hidden.`
                : 'Shadow falls across a path — its nature is hidden.',
          'shroud', shrouded[0]);
      },
    },
    {
      // Fate forces the method: redirects the chosen method index on select:pick.
      // The method pool is DivinationType[] (strings), so this works on indices,
      // not the SlotResult-shaped fate-override-pick below.
      id: 'fate-force-method', source: 'affinity', triggers: ['select:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => Array.isArray(c.draft.methodPool)
        && (c.draft.methodPool as unknown[]).length >= 2
        && typeof c.draft.methodIndex === 'number',
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const pool = c.draft.methodPool as string[];
        const chosen = c.draft.methodIndex as number;
        const others = pool.map((_, i) => i).filter((i) => i !== chosen);
        if (others.length === 0) return null;
        c.draft.methodIndex = others[Math.floor(c.rng() * others.length)];
        return report('fate-force-method', 'Fate', 'The weave moves your hand — another path is chosen for you.', 'override');
      },
    },
    {
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
        return report('chaos-second-result', 'Chaos', 'Chaos surges — a second reading manifests.', 'second-result');
      },
    },
    {
      id: 'chaos-happening-interrupt', source: 'affinity', triggers: ['minigame:end'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('chaos'),
      condition: (c) => c.draft.lastReading !== true,
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.major),
      apply: (c) => { c.draft.interruptHappening = true;
        return report('chaos-happening-interrupt', 'Chaos', 'The weave tears — something intrudes.', 'interrupt'); },
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
