import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, SlotResult, RollModifier, TarotResult, TarotCardFace } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE, bandOf, BAND_ORDER } from '../../data/affinities';
import { reverseSpread, buildFace, DECK_BY_ID, drawTarotCard, consolidateSpread, FULL_DECK } from '../../data/tarot';

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
      id: 'fate-deal-swap', source: 'affinity', triggers: ['tarot:deal'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => Array.isArray(c.draft.faces) && (c.draft.faces as unknown[]).length >= 1,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const faces = c.draft.faces as unknown as TarotCardFace[];
        const idx = Math.floor(c.rng() * faces.length);
        const used = new Set(faces.map((f) => f.id));
        const replacement = drawTarotCard(c.affinities).spread![0].card;
        if (used.has(replacement.id)) return null;
        faces[idx] = replacement;
        c.draft.faces = faces as unknown as typeof c.draft.faces;
        c.draft.swappedIndex = idx;
        return report('fate-deal-swap', 'Fate', 'The weave deals you another — a card changes before it turns.', 'override');
      },
    },
    {
      id: 'fate-fated-card', source: 'affinity', triggers: ['tarot:picked'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) =>
        typeof c.draft.handIndex === 'number'
        && typeof c.draft.tableIndex === 'number'
        && c.draft.fatedDrawnThisDraft !== true,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.notable),
      apply: (c) => {
        // Draw a fresh card distinct from the original
        const usedIds = new Set((c.draft.usedCardIds as string[] | undefined) ?? []);
        const pool = FULL_DECK.filter((cd) => !usedIds.has(cd.id));
        const pick = pool.length > 0 ? pool[Math.floor(c.rng() * pool.length)] : FULL_DECK[0];
        c.draft.fatedHandIndex = c.draft.handIndex as number;
        c.draft.fatedCardId = pick.id;
        c.draft.fatedDrawnThisDraft = true;
        return report('fate-fated-card', 'Fate',
          'The weave tightens — this card is not yours to refuse.',
          'shroud');
      },
    },
    {
      id: 'fate-auto-orient', source: 'affinity', triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => c.draft.outcome?.type === 'tarot',
      roll: (c) => bandRoll(c, 'fate', 'stirring', T.notable),
      apply: (c) => {
        const result = c.draft.outcome as TarotResult;
        if (c.rng() < 0.5) c.draft.outcome = reverseSpread(result);
        return report('fate-auto-orient', 'Fate', 'Fate turns the spread for you.', 'override');
      },
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
    {
      id: 'chaos-wild-card', source: 'affinity', triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('chaos'),
      condition: (c) => c.draft.outcome?.type === 'tarot' && !!(c.draft.outcome as TarotResult).spread,
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.notable),
      apply: (c) => {
        const result = c.draft.outcome as TarotResult;
        const faces = result.spread!.map((s) => s.card);
        const i = Math.floor(c.rng() * faces.length);
        faces[i] = buildFace(DECK_BY_ID[faces[i].id], faces[i].orientation === 'upright' ? 'reversed' : 'upright');
        c.draft.outcome = consolidateSpread(faces);
        return report('chaos-wild-card', 'Chaos', 'One card defies the spread — it turns against the rest.', 'flip');
      },
    },
    {
      id: 'order-anchor', source: 'affinity', triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('order'),
      condition: (c) => c.draft.outcome?.type === 'tarot' && !!(c.draft.outcome as TarotResult).spread
        && (c.draft.outcome as TarotResult).spread!.some((s) => s.card.orientation === 'reversed'),
      roll: (c) => bandRoll(c, 'order', 'ascendant', T.notable),
      apply: (c) => {
        const result = c.draft.outcome as TarotResult;
        const faces = result.spread!.map((s) => buildFace(DECK_BY_ID[s.card.id], 'upright'));
        c.draft.outcome = consolidateSpread(faces);
        return report('order-anchor', 'Order', 'The spread settles — anchored, upright, and coherent.', 'anchor');
      },
    },
    {
      id: 'shadow-veil-position', source: 'affinity', triggers: ['tarot:commit'],
      group: { kind: 'combine', channel: 'spread' }, weight: w('shadow'),
      condition: (c) => c.draft.outcome?.type === 'tarot' && (c.draft.outcome as TarotResult).spread!.length > 1,
      roll: (c) => bandRoll(c, 'shadow', 'ascendant', T.notable),
      apply: (c) => {
        const result = c.draft.outcome as TarotResult;
        const i = Math.floor(c.rng() * result.spread!.length);
        result.spread![i].card.veiled = true;
        (c.draft.spreadReports ??= []).push(
          report('shadow-veil-position', 'Shadow', 'One card stays veiled — its face withheld from the reading.', 'shroud'));
        return null;
      },
    },
  ];
}
