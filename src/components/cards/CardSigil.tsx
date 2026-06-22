import type { TarotResult, TarotCardFace } from '../../engine/types';

type AnyCard = TarotResult | TarotCardFace;

// Minimal line-art registry — keyed by major id. Paths use a 0 0 48 48 viewBox,
// stroke=currentColor, fill=none. Start with a generic star; flesh out per-major.
const MAJOR_SIGILS: Record<string, string> = {
  'the-fool': 'M24 6 L30 24 L24 42 L18 24 Z',
  'the-star': 'M24 6 L27 20 L42 24 L27 28 L24 42 L21 28 L6 24 L21 20 Z',
  // ...add the remaining 20 majors; fall back to GENERIC below until authored.
};
const GENERIC = 'M24 8 A16 16 0 1 0 24 40 A16 16 0 1 0 24 8 M24 8 L24 40';

const SUIT_EMBLEM: Record<string, string> = {
  wands: 'M24 6 L24 42 M16 14 L24 6 L32 14',     // staff
  cups: 'M14 14 H34 L30 28 H18 Z M24 28 V40 M16 40 H32', // chalice
  swords: 'M24 6 V34 M16 30 H32 M24 34 L20 40 H28 Z',    // blade
  pentacles: 'M24 8 A16 16 0 1 0 24 40 A16 16 0 1 0 24 8 M24 10 L29 34 L9 19 H39 L19 34 Z', // coin/star
};

function isFace(c: AnyCard): c is TarotCardFace { return 'arcana' in c; }

export default function CardSigil({ card, size = 48, color = 'currentColor' }: { card: AnyCard; size?: number; color?: string }) {
  const reversed = card.orientation === 'reversed';
  const face = isFace(card) ? card : card.spread?.[Math.min(1, (card.spread?.length ?? 1) - 1)]?.card;
  const arcana = face?.arcana ?? 'major';
  const suit = face?.suit;
  const isSpread = !isFace(card) && (card.spread?.length ?? 1) > 1;

  let d = GENERIC;
  if (isSpread) d = 'M10 14 H30 V40 H10 Z M16 10 H36 V36 M22 6 H42 V32'; // three overlapping cards
  else if (arcana === 'minor' && suit) d = SUIT_EMBLEM[suit];
  else if (face) d = MAJOR_SIGILS[face.id] ?? GENERIC;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img"
      aria-label={isFace(card) ? card.name : (card as TarotResult).name}
      style={{ transform: reversed ? 'rotate(180deg)' : undefined, color }}>
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
