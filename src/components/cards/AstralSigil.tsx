import { PLANETS, SIGNS } from '../../data/astromancy';
import type { PlanetId, SignId } from '../../engine/types';

type Props =
  | { kind: 'planet'; id: PlanetId; size?: number }
  | { kind: 'sign'; id: SignId; size?: number }
  | { kind: 'house'; id: number; size?: number };

export default function AstralSigil(props: Props) {
  const size = props.size ?? 32;
  const glyph =
    props.kind === 'planet' ? PLANETS[props.id].glyph
    : props.kind === 'sign' ? SIGNS[props.id].glyph
    : String(props.id);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, fontSize: size * 0.7, color: '#d4a854',
        fontFamily: "'Cormorant Garamond', serif", lineHeight: 1,
      }}
      aria-label={props.kind === 'house' ? `House ${props.id}` : props.id}
    >
      {glyph}
    </span>
  );
}
