import type { TarotResult, TarotCardFace } from '../../engine/types';
import { resolveSigil } from '../../data/sigils';

type AnyCard = TarotResult | TarotCardFace;

function isFace(c: AnyCard): c is TarotCardFace { return 'arcana' in c; }

export default function CardSigil({
  card, size = 48, color = 'currentColor',
}: { card: AnyCard; size?: number; color?: string }) {
  const reversed = card.orientation === 'reversed';
  const spec = resolveSigil(card);
  const label = isFace(card) ? card.name : (card as TarotResult).name;

  const stroke = (
    <g stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round">
      {spec.kind === 'major' && spec.paths.map((d, i) => <path key={i} d={d} />)}
      {spec.kind === 'spread' && spec.paths.map((d, i) => <path key={i} d={d} />)}
      {spec.kind === 'minor' && (
        <>
          {/* Court crown above the emblem */}
          {spec.rank.court && <path d="M17 9 l3 4 l4 -4 l4 4 l3 -4 v4 h-14 Z" />}
          {spec.emblem.map((d, i) => <path key={i} d={d} />)}
          {/* Rank cartouche — rounded rect bottom-right + numeral */}
          <rect x="31" y="33" width="14" height="11" rx="2.5" />
          <text
            x="38" y="41.5" textAnchor="middle" fontSize="8"
            fontFamily="'Cormorant Garamond', serif" fill={color} stroke="none"
          >
            {spec.rank.label}
          </text>
        </>
      )}
    </g>
  );

  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label}
      style={{ transform: reversed ? 'rotate(180deg)' : undefined, color }}
    >
      {stroke}
    </svg>
  );
}
