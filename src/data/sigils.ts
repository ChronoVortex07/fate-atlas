import type { TarotResult, TarotCardFace } from '../engine/types';

type AnyCard = TarotResult | TarotCardFace;
type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
type Rank = number | 'page' | 'knight' | 'queen' | 'king';

export type SigilSpec =
  | { kind: 'major'; paths: string[] }
  | { kind: 'minor'; emblem: string[]; rank: { label: string; court: boolean } }
  | { kind: 'spread'; paths: string[] };

// All paths share the contract: viewBox 0 0 48 48, stroke=currentColor, fill=none,
// stroke-width ~1.5, rounded caps/joins. Each value is an array of independent strokes.
export const MAJOR_SIGILS: Record<string, string[]> = {
  // 0 The Fool — cliff edge + rising sun disc + a small bundle (leap into the unknown)
  'the-fool': ['M8 36 H22 L26 30', 'M30 16 A8 8 0 1 1 29.99 16', 'M38 36 l4 -4 l-2 6 Z'],
  // I The Magician — infinity lemniscate over an upright wand
  'the-magician': ['M24 10 V30', 'M16 12 H32', 'M14 36 a5 4 0 1 0 10 0 a5 4 0 1 0 10 0'],
  // II The High Priestess — crescent between two pillars + veil line
  'the-high-priestess': ['M14 10 V38', 'M34 10 V38', 'M20 24 a6 6 0 1 0 9 -5 a8 8 0 1 1 -9 5', 'M14 30 H34'],
  // III The Empress — Venus glyph crowned (orb + cross + small crown arc)
  'the-empress': ['M24 12 a7 7 0 1 0 0.01 0', 'M24 26 V40', 'M17 33 H31', 'M18 9 l3 4 l3 -4 l3 4 l3 -4'],
  // IV The Emperor — Aries ram horns over a squared throne
  'the-emperor': ['M24 14 V30', 'M24 14 a6 6 0 0 0 -10 -2', 'M24 14 a6 6 0 0 1 10 -2', 'M16 30 H32 V40 H16 Z'],
  // V The Hierophant — triple cross / keys (vertical staff + 3 crossbars + base)
  'the-hierophant': ['M24 8 V40', 'M16 16 H32', 'M14 24 H34', 'M18 32 H30', 'M20 40 H28'],
  // VI The Lovers — two interlocking rings beneath an arc
  'the-lovers': ['M19 28 a6 6 0 1 0 0.01 0', 'M29 28 a6 6 0 1 0 0.01 0', 'M14 16 a10 6 0 0 1 20 0'],
  // VII The Chariot — chariot canopy + two wheels
  'the-chariot': ['M12 26 H36 L32 16 H16 Z', 'M18 34 a4 4 0 1 0 0.01 0', 'M30 34 a4 4 0 1 0 0.01 0'],
  // VIII Strength — lemniscate over a gentle lion-jaw arc (force tamed)
  'strength': ['M12 22 a5 4 0 1 0 10 0 a5 4 0 1 0 10 0', 'M16 30 a8 7 0 0 0 16 0', 'M20 30 V33', 'M28 30 V33'],
  // IX The Hermit — lantern (diamond) on a staff with a small flame
  'the-hermit': ['M30 10 V40', 'M22 20 l6 -6 l6 6 l-6 6 Z', 'M28 18 v-3', 'M12 40 H30'],
  // X Wheel of Fortune — spoked ring
  'wheel-of-fortune': ['M24 8 a16 16 0 1 0 0.01 0', 'M24 12 V36', 'M12 24 H36', 'M15 15 L33 33', 'M33 15 L15 33'],
  // XI Justice — balance scales (beam, two pans, central post)
  'justice': ['M24 10 V34', 'M12 16 H36', 'M12 16 l-3 7 h6 Z', 'M36 16 l-3 7 h6 Z', 'M16 38 H32'],
  // XII The Hanged Man — inverted suspended figure (T-bar + hanging line + triangle legs)
  'the-hanged-man': ['M12 12 H36', 'M24 12 V26', 'M24 26 a4 4 0 1 0 0.01 0', 'M21 33 L18 40', 'M27 33 L30 40'],
  // XIII Death — scythe (curved blade + long snath)
  'death': ['M16 40 L34 14', 'M34 14 a10 10 0 0 0 -14 2', 'M20 30 a5 5 0 1 0 0.01 0'],
  // XIV Temperance — two vessels with a flowing stream between them
  'temperance': ['M14 14 a6 4 0 0 0 12 0', 'M22 34 a6 4 0 0 0 12 0', 'M20 16 L30 32', 'M22 14 L18 18', 'M30 34 L34 30'],
  // XV The Devil — inverted pentagram inside a horned arc
  'the-devil': ['M24 14 L31 34 L14 21 H34 L17 34 Z', 'M14 12 a6 5 0 0 1 8 2', 'M34 12 a6 5 0 0 0 -8 2'],
  // XVI The Tower — struck tower with falling crown + lightning bolt
  'the-tower': ['M16 40 V20 H32 V40', 'M14 20 H34 L30 14 H18 Z', 'M24 6 L20 16 H27 L23 26', 'M19 30 H29'],
  // XVII The Star — eight-point star over wavy water
  'the-star': ['M24 8 L27 21 L40 24 L27 27 L24 40 L21 27 L8 24 L21 21 Z', 'M14 36 q5 -3 10 0 t10 0'],
  // XVIII The Moon — crescent + a winding path between two towers
  'the-moon': ['M20 22 a8 8 0 1 0 9 -6 a10 10 0 1 1 -9 6', 'M16 40 q4 -8 0 -16', 'M32 40 q-4 -8 0 -16', 'M24 40 V20'],
  // XIX The Sun — radiant disc with rays
  'the-sun': ['M24 16 a8 8 0 1 0 0.01 0', 'M24 6 V10', 'M24 38 V42', 'M6 24 H10', 'M38 24 H42', 'M11 11 L14 14', 'M37 11 L34 14', 'M11 37 L14 34', 'M37 37 L34 34'],
  // XX Judgement — trumpet with three sound-arcs
  'judgement': ['M12 30 L30 22 L34 26 L16 34 Z', 'M30 22 L38 18', 'M20 14 a6 6 0 0 1 6 4', 'M16 12 a10 10 0 0 1 11 6'],
  // XXI The World — laurel wreath (ellipse) cradling a small cross of axes
  'the-world': ['M24 8 a12 16 0 1 0 0.01 0', 'M24 14 V34', 'M16 24 H32', 'M18 12 l-3 3', 'M30 12 l3 3', 'M18 36 l-3 -3', 'M30 36 l3 -3'],
};

export const SUIT_EMBLEMS: Record<Suit, string[]> = {
  // Wands — a budding staff
  wands: ['M24 8 V40', 'M24 8 l-5 6', 'M24 8 l5 6', 'M24 18 l-4 4', 'M24 18 l4 4'],
  // Cups — a footed chalice
  cups: ['M14 14 H34 a10 10 0 0 1 -20 0 Z', 'M24 24 V36', 'M16 40 H32', 'M20 40 v-4 h8 v4'],
  // Swords — an upright blade with crossguard
  swords: ['M24 6 V34', 'M16 30 H32', 'M24 34 l-4 6 h8 Z', 'M20 8 L24 6 L28 8'],
  // Pentacles — a five-point star within a ring
  pentacles: ['M24 8 a16 16 0 1 0 0.01 0', 'M24 12 L29 32 L11 19 H37 L19 32 Z'],
};

// Three overlapping cards crest (refined) — drawn back-to-front.
export const SPREAD_CREST: string[] = [
  'M10 16 H26 V40 H10 Z',
  'M16 11 H34 V36 H16 Z',
  'M22 6 H42 V32 H22 Z',
];

const ROMAN: Record<number, string> = {
  1: 'A', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
};
const COURT_LETTER: Record<string, string> = { page: 'P', knight: 'N', queen: 'Q', king: 'K' };

export function rankLabel(rank: Rank): string {
  if (typeof rank === 'number') return ROMAN[rank] ?? String(rank);
  return COURT_LETTER[rank] ?? rank[0].toUpperCase();
}

function isFace(c: AnyCard): c is TarotCardFace {
  return 'arcana' in c;
}

/** The face a result should be drawn as: its own (face) or the middle/only spread card. */
function primaryFace(card: AnyCard): TarotCardFace | undefined {
  if (isFace(card)) return card;
  const spread = card.spread;
  if (!spread || spread.length === 0) return undefined;
  return spread[Math.min(1, spread.length - 1)].card;
}

export function resolveSigil(card: AnyCard): SigilSpec {
  if (!isFace(card) && (card.spread?.length ?? 1) > 1) {
    return { kind: 'spread', paths: SPREAD_CREST };
  }
  const f = primaryFace(card);
  if (f && f.arcana === 'minor' && f.suit) {
    return {
      kind: 'minor',
      emblem: SUIT_EMBLEMS[f.suit],
      rank: { label: rankLabel(f.rank ?? 1), court: typeof f.rank !== 'number' },
    };
  }
  const id = f?.id ?? card.id;
  return { kind: 'major', paths: MAJOR_SIGILS[id] ?? [] };
}
