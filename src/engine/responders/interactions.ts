import type { Responder, EffectReport } from '../events/types';
import type { SlotResult, TarotResult, DiceResult, IChingResult } from '../types';
import { reverseSpread } from '../../data/tarot';

const has = (s: SlotResult, ...tags: string[]) => tags.every((t) => s.tags.includes(t));
const reversibles = (spread: SlotResult[]) => spread.filter((s) => s.tags.includes('reversible'));
const criticalDie = (spread: SlotResult[], threshold: DiceResult['threshold']) =>
  spread.find((s): s is DiceResult => s.type === 'd20' && (s as DiceResult).threshold === threshold);

function report(id: string, label: string, description: string, animation: string, targetSlot?: number, sourceSlot?: number): EffectReport {
  return { responderId: id, label, description, animation, targetSlot, sourceSlot };
}

// ── Spread-internal helpers ──

const spreadOf = (c: { draft: { outcome?: SlotResult } }): TarotResult | null =>
  c.draft.outcome?.type === 'tarot' && (c.draft.outcome as TarotResult).spread ? (c.draft.outcome as TarotResult) : null;
const facesOf = (r: TarotResult) => r.spread!.map((s) => s.card);
const OPPOSED: Record<string, string> = { fire: 'water', water: 'fire', air: 'earth', earth: 'air' };
const elementsIn = (r: TarotResult) =>
  new Set(facesOf(r).flatMap((f) => f.tags.filter((t) => t.startsWith('element-')).map((t) => t.slice(8))));
const primaryAxis: Record<string, keyof TarotResult['dimensions']> =
  { wands: 'volatility', cups: 'favorability', swords: 'favorability', pentacles: 'certainty' };

function spreadEntry(
  id: string, fires: (r: TarotResult) => boolean,
  apply: (r: TarotResult, push: (rep: EffectReport) => void) => void,
): Responder {
  return {
    id, source: 'interaction', triggers: ['tarot:commit'],
    group: { kind: 'combine', channel: 'spread' },
    condition: (c) => { const r = spreadOf(c); return !!r && (r.spread!.length > 1) && fires(r); },
    roll: () => true,
    apply: (c) => {
      const r = spreadOf(c)!;
      const push = (rep: EffectReport) => { (c.draft.spreadReports ??= [] as EffectReport[]).push(rep); };
      apply(r, push);
      c.draft.outcome = r;
      return null;
    },
  };
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
        const i = c.spread.findIndex((s) => has(s, 'major-arcana', 'fool-archetype'));
        return report('fool-reroll', "The Fool", "The Fool's wild energy ripples through fate — the dice must be cast again.", 'reroll', undefined, i < 0 ? undefined : i);
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
        const wanted: DiceResult['threshold'] = wasUpright ? 'critical-low' : 'critical-high';
        const i = c.spread.findIndex((s) => s.type === 'd20' && (s as DiceResult).threshold === wanted);
        c.draft.outcome = reverseSpread(card);
        return report('critical-resonance', 'Critical Resonance',
          wasUpright ? 'A dire omen drags the spread down — it inverts.' : 'A bright omen lifts the spread — it rights itself.',
          'flip', undefined, i < 0 ? undefined : i);
      },
    },
    {
      id: 'mirror', source: 'interaction', triggers: ['dice:commit', 'tarot:commit', 'iching:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => reversibles(c.spread).length === 2,
      roll: (c) => c.rng() < 0.85,
      apply: (c) => {
        const idxs = c.spread.map((s, i) => (s.tags.includes('reversible') ? i : -1)).filter((i) => i >= 0);
        if (c.draft.outcome?.type === 'tarot') {
          c.draft.outcome = reverseSpread(c.draft.outcome as TarotResult);
        }
        return report('mirror', 'The Mirror', 'Two forces reflect each other across the weave — both turn.', 'mirror', idxs[1], idxs[0]);
      },
    },
    {
      id: 'iching-happening-boost', source: 'interaction', triggers: ['happening:start'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 1,
      condition: (c) => c.spread.some((s) => s.type === 'iching' && s.tags.includes('changing-lines')),
      roll: () => true,
      apply: (c) => {
        c.draft.addChoice = true;
        const i = c.spread.findIndex((s) => s.type === 'iching' && s.tags.includes('changing-lines'));
        return report('iching-happening-boost', 'I Ching', 'The changing lines reveal hidden branches — more choices emerge.', 'add-choice', undefined, i < 0 ? undefined : i);
      },
    },
    // ── Spread-internal interactions ──
    spreadEntry('suit-accord',
      (r) => { const s = facesOf(r).map((f) => f.suit); return s.every((x) => x && x === s[0]); },
      (r, push) => {
        const suit = facesOf(r)[0].suit!;
        const axis = primaryAxis[suit];
        r.dimensions[axis] = Math.max(-2, Math.min(2, Math.round(r.dimensions[axis] * 1.5 * 2) / 2));
        push(report('suit-accord', 'Suit Accord', `The ${suit} run pure — their nature deepens.`, 'amplify'));
      }),
    spreadEntry('elemental-clash',
      (r) => { const e = elementsIn(r); return [...e].some((x) => e.has(OPPOSED[x])); },
      (r, push) => {
        r.dimensions.volatility = Math.max(-2, Math.min(2, Math.round((r.dimensions.volatility + 1) * 2) / 2));
        push(report('elemental-clash', 'Elemental Clash', 'Opposing elements grind — the reading turns turbulent.', 'amplify'));
      }),
    spreadEntry('major-convergence',
      (r) => facesOf(r).filter((f) => f.arcana === 'major').length >= 2,
      (_r, push) => push(report('major-convergence', 'Convergence', 'Two great arcana align — a fated current runs through the spread.', 'second-result'))),
    spreadEntry('spread-aligned',
      (r) => facesOf(r).every((f) => f.orientation === 'upright'),
      (_r, push) => push(report('spread-aligned', 'Order', 'The spread stands wholly upright — clarity settles.', 'anchor'))),
    spreadEntry('spread-cascade',
      (r) => facesOf(r).every((f) => f.orientation === 'reversed'),
      (_r, push) => push(report('spread-cascade', 'Chaos', 'Every card falls reversed — a cascade of upheaval.', 'flip'))),
    {
      id: 'iching-resonant-change', source: 'interaction', triggers: ['iching:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) =>
        c.draft.outcome?.type === 'iching'
        && (c.draft.outcome as IChingResult).tags.includes('changing-lines')
        && c.spread.some((s) => s.type !== 'iching' && s.tags.includes('reversible')),
      roll: () => true,
      apply: (c) => {
        const i = c.spread.findIndex((s) => s.type !== 'iching' && s.tags.includes('reversible'));
        return report('iching-resonant-change', 'I Ching', 'The changing lines resonate outward — a kindred force stirs in sympathy.', 'mirror', undefined, i < 0 ? undefined : i);
      },
    },
  ];
}
