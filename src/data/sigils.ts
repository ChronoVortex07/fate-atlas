import type { TarotResult, TarotCardFace } from '../engine/types';

type AnyCard = TarotResult | TarotCardFace;
type Rank = number | 'page' | 'knight' | 'queen' | 'king';

// Icon keys are the chosen react-icons/gi export names. CardSigil maps each to a
// component via a Record<IconKey, IconType>, so every value here MUST be a real
// `gi` export (verified in Task 1). No fallback is permitted.
//
// Substitutions from plan's directional names:
//   GiStar        → GiSevenPointedStar   (the-star: no plain GiStar export)
//   GiWheel       → GiSpinningWheel      (wheel-of-fortune: no plain GiWheel export)
//   GiBalance     → GiScales             (justice: no plain GiBalance export)
//   GiHorns       → GiBullHorns          (the-devil: no plain GiHorns export)
//   GiHangedMan   → GiHangingSign        (the-hanged-man: no GiHangedMan export)
//   GiWandfire    → GiCrystalWand        (wands suit: no GiWandfire export)
//   GiGoblet      → GiTrophyCup          (cups suit: no GiGoblet export)
//   GiMoon (high-priestess) → GiConcentricCrescents (avoid duplicate; crescent=mystery)
export const MAJOR_ICON_KEYS = {
  'the-fool': 'GiJesterHat',
  'the-magician': 'GiMagicSwirl',
  'the-high-priestess': 'GiConcentricCrescents',
  'the-empress': 'GiQueenCrown',
  'the-emperor': 'GiCrown',
  'the-hierophant': 'GiPopeCrown',
  'the-lovers': 'GiHearts',
  'the-chariot': 'GiHorseHead',
  'strength': 'GiLion',
  'the-hermit': 'GiLantern',
  'wheel-of-fortune': 'GiSpinningWheel',
  'justice': 'GiScales',
  'the-hanged-man': 'GiHangingSign',
  'death': 'GiDeathSkull',
  'temperance': 'GiPouringPot',
  'the-devil': 'GiBullHorns',
  'the-tower': 'GiTowerFall',
  'the-star': 'GiSevenPointedStar',
  'the-moon': 'GiMoon',
  'the-sun': 'GiSun',
  'judgement': 'GiAngelWings',
  'the-world': 'GiWorld',
} as const;

export const SUIT_ICON_KEYS = {
  wands: 'GiCrystalWand',
  cups: 'GiTrophyCup',
  swords: 'GiBroadsword',
  pentacles: 'GiPentacle',
} as const;

export type MajorIconKey = (typeof MAJOR_ICON_KEYS)[keyof typeof MAJOR_ICON_KEYS];
export type SuitIconKey = (typeof SUIT_ICON_KEYS)[keyof typeof SUIT_ICON_KEYS];
export type IconKey = MajorIconKey | SuitIconKey | 'spread';

export type SigilSpec =
  | { kind: 'major'; icon: MajorIconKey }
  | { kind: 'minor'; icon: SuitIconKey; rank: { label: string; court: boolean } }
  | { kind: 'spread'; icon: 'spread' };

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
    return { kind: 'spread', icon: 'spread' };
  }
  const f = primaryFace(card);
  if (f && f.arcana === 'minor' && f.suit) {
    return {
      kind: 'minor',
      icon: SUIT_ICON_KEYS[f.suit],
      rank: { label: rankLabel(f.rank ?? 1), court: typeof f.rank !== 'number' },
    };
  }
  const id = f?.id ?? card.id;
  const icon = MAJOR_ICON_KEYS[id as keyof typeof MAJOR_ICON_KEYS];
  if (!icon) {
    // A non-mapped major id is a data bug; surface it (the completeness test
    // guards against it for shipped data) and fall back to a real icon so the
    // render never points at a missing component.
    console.warn(`resolveSigil: no icon mapped for major id "${id}"; using the-fool`);
    return { kind: 'major', icon: MAJOR_ICON_KEYS['the-fool'] };
  }
  return { kind: 'major', icon };
}
