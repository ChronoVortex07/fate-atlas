import type { IconType } from 'react-icons';
import {
  GiJesterHat, GiMagicSwirl, GiConcentricCrescents, GiQueenCrown, GiCrown, GiPopeCrown,
  GiHearts, GiHorseHead, GiLion, GiLantern, GiSpinningWheel, GiScales, GiHangingSign,
  GiDeathSkull, GiPouringPot, GiBullHorns, GiTowerFall, GiSevenPointedStar, GiMoon, GiSun,
  GiAngelWings, GiWorld, GiCrystalWand, GiTrophyCup, GiBroadsword, GiPentacle,
  GiCardPickup,
} from 'react-icons/gi';
import type { TarotResult, TarotCardFace } from '../../engine/types';
import { resolveSigil, type IconKey } from '../../data/sigils';

type AnyCard = TarotResult | TarotCardFace;
function isFace(c: AnyCard): c is TarotCardFace { return 'arcana' in c; }

// Every IconKey used by resolveSigil must appear here. Keys are gi export names.
const ICONS: Record<IconKey, IconType> = {
  GiJesterHat, GiMagicSwirl, GiConcentricCrescents, GiQueenCrown, GiCrown, GiPopeCrown,
  GiHearts, GiHorseHead, GiLion, GiLantern, GiSpinningWheel, GiScales, GiHangingSign,
  GiDeathSkull, GiPouringPot, GiBullHorns, GiTowerFall, GiSevenPointedStar, GiMoon, GiSun,
  GiAngelWings, GiWorld, GiCrystalWand, GiTrophyCup, GiBroadsword, GiPentacle,
  spread: GiCardPickup, // three-card crest stand-in
};

export default function CardSigil({
  card, size = 48, color = 'currentColor',
}: { card: AnyCard; size?: number; color?: string }) {
  const reversed = card.orientation === 'reversed';
  const spec = resolveSigil(card);
  const label = isFace(card) ? card.name : (card as TarotResult).name;
  const rotate = reversed ? 'rotate(180deg)' : undefined;

  if (spec.kind === 'minor') {
    const Icon = ICONS[spec.icon];
    const s = size;
    return (
      <span
        role="img" aria-label={label}
        style={{ position: 'relative', display: 'inline-flex', width: s, height: s, color, transform: rotate }}
      >
        {spec.rank.court && (
          <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden
            style={{ position: 'absolute', inset: 0, color }}>
            <path d="M16 8 l3 4 l5 -4 l5 4 l3 -4 v5 h-16 Z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
        )}
        <Icon size={s} color={color} style={{ display: 'block' }} />
        <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden
          style={{ position: 'absolute', inset: 0, color }}>
          <rect x="30" y="32" width="15" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth={1.4} />
          <text x="37.5" y="41.5" textAnchor="middle" fontSize="9"
            fontFamily="'Cormorant Garamond', serif" fill="currentColor" stroke="none">
            {spec.rank.label}
          </text>
        </svg>
      </span>
    );
  }

  const Icon = ICONS[spec.icon];
  return (
    <span role="img" aria-label={label} style={{ display: 'inline-flex', color, transform: rotate }}>
      <Icon size={size} color={color} style={{ display: 'block' }} />
    </span>
  );
}
