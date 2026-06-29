import type { SlotResult, DivinationType, DimensionValues } from '../../types';
import type { MinigameVoice, DrawOccurrence } from './types';
import type { PositionCard, PositionSummary } from '../types';
import { READING_FRAGMENTS as F } from '../../../data/reading-fragments';
import {
  withArticle, gloss, verbPhrase, stableIndex, joinSeq, joinAnd, meanFavorability,
} from './shared';

const DF = F.drawFraming;

/** Pick a variant scaffold for a 2nd+ draw; falls back to null when none defined. */
function variantScaffold(type: string, value: string | number, occ: DrawOccurrence): string | null {
  const pool = DF.variantScaffolds[type];
  if (!pool || pool.length === 0) return null;
  const tpl = pool[(occ.index - 1) % pool.length];
  return tpl.replace('{n}', String(value));
}

/** Clause seed key offset by occurrence so siblings don't collide; '' for index 0. */
function occSuffix(occ: DrawOccurrence): string {
  return occ.index > 0 ? `#${occ.index}` : '';
}

const groupDims = (slots: SlotResult[]): DimensionValues =>
  ({ favorability: meanFavorability(slots), certainty: 0, volatility: 0 });

const POSITION_ORDER: ('past' | 'present' | 'future')[] = ['past', 'present', 'future'];

function leanOf(fav: number): 'favor' | 'steady' | 'adverse' {
  return fav >= 0.5 ? 'favor' : fav <= -0.5 ? 'adverse' : 'steady';
}

/** Magnitude-weighted mean favorability: strong pulls dominate rather than cancel. */
function weightedMeanFavorability(favs: number[]): number {
  let num = 0, den = 0;
  for (const f of favs) { const w = Math.abs(f); num += f * w; den += w; }
  return den > 0 ? num / den : 0;
}

/**
 * Collapse every multi-card spread into one Past/Present/Future set: each
 * occupied position carries all cards that landed there (across every spread),
 * a magnitude-weighted merged lean, and a contradiction flag when the position
 * holds both a favorable (>= +0.5) and an adverse (<= -0.5) card.
 */
export function aggregateTarotPositions(spreads: SlotResult[]): PositionSummary[] {
  const byPos = new Map<'past' | 'present' | 'future', PositionCard[]>();
  for (const s of spreads) {
    if (s.type !== 'tarot' || !s.spread) continue;
    for (const { position, card } of s.spread) {
      const meaning = (card.orientation === 'upright' ? card.meaningUpright : card.meaningReversed) ?? '';
      const pc: PositionCard = {
        name: card.name,
        orientation: card.orientation,
        favorability: card.dimensions.favorability,
        lean: leanOf(card.dimensions.favorability),
        gloss: card.veiled ? '' : gloss(meaning),
        veiled: !!card.veiled,
      };
      const list = byPos.get(position) ?? [];
      list.push(pc);
      byPos.set(position, list);
    }
  }
  const summaries: PositionSummary[] = [];
  for (const position of POSITION_ORDER) {
    const cards = byPos.get(position);
    if (!cards || cards.length === 0) continue;
    const favs = cards.map((c) => c.favorability);
    const lean = leanOf(weightedMeanFavorability(favs));
    const contradiction = favs.some((f) => f >= 0.5) && favs.some((f) => f <= -0.5);
    summaries.push({ position, cards, lean, contradiction });
  }
  return summaries;
}

// ── Tarot ──
const tarotVoice: MinigameVoice = {
  type: 'tarot',
  describeOne(slot, role, occ) {
    if (slot.type !== 'tarot') return genericVoice.describeOne(slot, role, occ);
    if (slot.spread && slot.spread.length > 1) {
      const first = slot.spread[0].card;
      return {
        subject: `${withArticle(first.name)}, ${first.orientation}`,
        clause: verbPhrase(role, first.dimensions, first.name + first.orientation + occSuffix(occ)),
      };
    }
    const subject = `${withArticle(slot.name)}, ${slot.orientation}`;
    const meaning = slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed;
    let clause = verbPhrase(role, slot.dimensions, slot.name + slot.orientation + occSuffix(occ));
    if (meaning && stableIndex('gloss' + slot.name, 2) === 0) {
      const g = gloss(meaning);
      if (g) clause = `${clause} — ${g}`;
    }
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const cards = slots.filter((s): s is Extract<SlotResult, { type: 'tarot' }> => s.type === 'tarot');
    const items = cards.map((c, i) => {
      const label = `${withArticle(c.name)} ${c.orientation}`;
      return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
    });
    const subject = `${DF.group.lead.tarot} ${joinAnd(items, DF.group.listLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'tarot-group' + cards.map((c) => c.name).join('|'));
    return { subject, clause };
  },
};

// ── D20 ──
const d20Voice: MinigameVoice = {
  type: 'd20',
  describeOne(slot, role, occ) {
    if (slot.type !== 'd20') return genericVoice.describeOne(slot, role, occ);
    const variant = occ.index > 0 ? variantScaffold('d20', slot.result, occ) : null;
    const subject = variant ?? `the dice, settling on ${slot.result}`;
    const g = gloss(slot.interpretation);
    let clause = verbPhrase(role, slot.dimensions, 'd20' + slot.result + occSuffix(occ));
    if (g && stableIndex('gloss-d20-' + slot.result, 2) === 0) clause = `${clause}, ${g}`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const dice = slots.filter((s): s is Extract<SlotResult, { type: 'd20' }> => s.type === 'd20');
    const items = dice.map((d) => String(d.result));
    const subject = `${DF.group.lead.d20} ${joinSeq(items, DF.group.seqLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'd20-group' + items.join('|'));
    return { subject, clause };
  },
};

// ── I Ching ──
const ichingVoice: MinigameVoice = {
  type: 'iching',
  describeOne(slot, role, occ) {
    if (slot.type !== 'iching') return genericVoice.describeOne(slot, role, occ);
    const variant = occ.index > 0 ? variantScaffold('iching', slot.hexagramNumber, occ) : null;
    const subject = variant ?? `Hexagram ${slot.hexagramNumber}, ${slot.name}`;
    let clause = verbPhrase(role, slot.dimensions, 'iching' + slot.hexagramNumber + occSuffix(occ));
    const g = gloss(slot.judgment);
    if (g) clause = `${clause} — ${g}`;
    if (slot.changingLines.length > 0) clause = `${clause}, its lines already turning`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const hexes = slots.filter((s): s is Extract<SlotResult, { type: 'iching' }> => s.type === 'iching');
    const items = hexes.map((h) => String(h.hexagramNumber));
    const subject = `${DF.group.lead.iching} ${joinSeq(items, DF.group.seqLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'iching-group' + items.join('|'));
    return { subject, clause };
  },
};

// ── Strings ──
const stringsVoice: MinigameVoice = {
  type: 'strings',
  describeOne(slot, role, occ) {
    if (slot.type !== 'strings') return genericVoice.describeOne(slot, role, occ);
    const parts = slot.name.split(' · ');
    const origin = parts[0] ?? 'the start';
    const dest = parts[parts.length - 1] ?? 'the end';
    const subject = parts.length > 1
      ? `the thread drawn from ${origin} to ${dest}`
      : `the thread at ${origin}`;
    let clause = verbPhrase(role, slot.dimensions, 'strings' + slot.name + occSuffix(occ));
    const g = gloss(slot.interpretation);
    if (g) clause = `${clause} — ${g}`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const threads = slots.filter((s): s is Extract<SlotResult, { type: 'strings' }> => s.type === 'strings');
    const partsOf = (t: Extract<SlotResult, { type: 'strings' }>) => t.name.split(' · ');
    const origin = partsOf(threads[0])[0] ?? 'the start';
    const waypoints: string[] = [];
    const destinations: string[] = [];
    for (const t of threads) {
      const p = partsOf(t);
      for (const mid of p.slice(1, -1)) if (!waypoints.includes(mid)) waypoints.push(mid);
      const dest = p[p.length - 1] ?? 'the end';
      if (!destinations.includes(dest)) destinations.push(dest);
    }
    let subject: string;
    if (destinations.length > 1) {
      subject = `${DF.group.stringsSplit} ${origin} toward ${joinAnd(destinations, DF.group.listLast, DF.group.mid)}`;
    } else {
      const through = waypoints.length > 0 ? ` through ${joinAnd(waypoints, DF.group.listLast, DF.group.mid)}` : '';
      subject = `${DF.group.stringsLead} ${origin}${through} to ${destinations[0] ?? 'the end'}`;
    }
    const clause = verbPhrase(role, groupDims(slots), 'strings-group' + threads.map((t) => t.name).join('|'));
    return { subject, clause };
  },
};

// ── Generic fallback (astral, rune, happening, any future type) ──
const genericVoice: MinigameVoice = {
  type: 'astral', // nominal; used for any unmapped type
  describeOne(slot, role, occ) {
    const named = (slot as { name?: string }).name ?? slot.type;
    const interp = (slot as { interpretation?: string }).interpretation ?? '';
    const subject = `the ${named}`;
    let clause = verbPhrase(role, slot.dimensions, named + occSuffix(occ));
    const g = gloss(interp);
    if (g) clause = `${clause} — ${g}`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const items = slots.map((s, i) => {
      const named = (s as { name?: string }).name ?? s.type;
      return i === 0 ? `the ${named}` : named;
    });
    const subject = `${DF.group.lead.generic} ${joinAnd(items, DF.group.listLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'generic-group' + items.join('|'));
    return { subject, clause };
  },
};

const REGISTRY: Partial<Record<DivinationType, MinigameVoice>> = {
  tarot: tarotVoice,
  d20: d20Voice,
  iching: ichingVoice,
  strings: stringsVoice,
};

/** The voice for a type, or the generic fallback (astral/rune/happening/future). */
export function voiceFor(type: DivinationType): MinigameVoice {
  return REGISTRY[type] ?? genericVoice;
}
