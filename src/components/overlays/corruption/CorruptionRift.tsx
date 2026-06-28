// The "watching tear": a torn rift in the top-right corner with an eye peering out.
// Tempting to press (it pulses and the data-streams stir); summons the glimpse.
import type { CSSProperties } from 'react';

const SEG = [
  ['cx-fa',0.0,6,36,9,.30],['cx-fc',1.0,8,52,5,.26],['cx-fb',2.0,10,22,8,.30],['cx-fe',.6,12,60,7,.28],
  ['cx-fd',1.6,14,40,11,.34],['cx-fa',2.4,16,14,6,.30],['cx-fc',.4,18,48,5,.26],['cx-fb',1.4,20,30,9,.32],
  ['cx-fe',2.6,22,64,6,.28],['cx-fd',.8,24,18,8,.32],['cx-fa',1.8,26,44,11,.36],['cx-fc',2.8,28,56,5,.28],
  ['cx-fb',.5,30,24,8,.32],['cx-fe',1.5,32,12,7,.34],['cx-fd',2.2,33,68,6,.28],['cx-fa',.9,34,38,12,.38],
  ['cx-fc',1.9,36,52,6,.30],['cx-fb',2.9,38,28,9,.34],['cx-fe',.7,40,60,5,.28],['cx-fd',1.7,42,18,8,.32],
  ['cx-fa',2.5,44,46,10,.36],['cx-fc',.3,46,34,7,.32],['cx-fb',1.3,48,56,6,.30],['cx-fe',2.3,50,24,8,.32],
  ['cx-fd',1.1,52,42,6,.30],['cx-fa',2.1,54,52,5,.26],['cx-fc',.95,56,32,7,.28],
] as const;
const TWK = [['cx-tk1',14,42],['cx-tk2',26,46],['cx-tk3',34,40],['cx-tk4',44,48]] as const;
const CRACKS = ['M44,34 L51,29','M48,62 L55,67','M38,70 L41,79 M40,74 L36,81','M18,60 L11,64','M24,30 L17,23','M38,16 L43,9','M22,50 L15,52'];
const RIFT = 'M32,5 L38,16 L34,24 L44,34 L40,42 L54,47 L44,52 L48,62 L38,70 L42,80 L32,88 L24,80 L26,70 L18,60 L22,50 L10,47 L20,40 L24,30 L16,22 L26,16 Z';

export default function CorruptionRift({ onSummon }: { onSummon: () => void }) {
  return (
    <button type="button" aria-label="Something watches" style={btnStyle} onClick={onSummon}>
      <svg width="48" height="68" viewBox="-8 -10 80 112">
        <defs>
          <radialGradient id="cx-ir" cx="52%" cy="48%"><stop offset="0%" stopColor="#ff6678"/><stop offset="45%" stopColor="#c20f22"/><stop offset="100%" stopColor="#3a0410"/></radialGradient>
          <radialGradient id="cx-vd"><stop offset="0%" stopColor="#180108"/><stop offset="100%" stopColor="#07010c"/></radialGradient>
          <clipPath id="cx-riftclip"><path d={RIFT}/></clipPath>
        </defs>
        <g>
          {SEG.map(([cls, delay, x, y, h, op], i) => (
            <rect key={i} className={cls} x={x} y={y} width={1.6} height={h} fill="#ff2d4a" fillOpacity={op} style={{ animationDelay: `${delay}s` }} />
          ))}
          {TWK.map(([cls, x, y], i) => (
            <rect key={`t${i}`} className={cls} x={x} y={y} width={2} height={4.5} fill="#ffc2ca" />
          ))}
        </g>
        <g stroke="#ff2d4a" fill="none" strokeWidth={0.8}>
          {CRACKS.map((d, i) => <path key={i} d={d} strokeOpacity={0.5} />)}
        </g>
        <path d={RIFT} fill="url(#cx-vd)" stroke="#ff2d4a" strokeWidth={1} strokeOpacity={0.55} />
        <g clipPath="url(#cx-riftclip)">
          <g className="cx-eye-iris">
            <ellipse className="cx-eye-glow" cx={32} cy={47} rx={14} ry={8} fill="#ff2d4a" fillOpacity={0.13} />
            <path d="M20,47 Q32,38 44,47 Q32,56 20,47 Z" fill="#0c0306" />
            <circle cx={34} cy={47} r={6} fill="url(#cx-ir)" />
            <circle cx={34} cy={47} r={2.4} fill="#0a0002" />
            <circle cx={35.6} cy={44.8} r={1.2} fill="#ffd9dd" />
            <path className="cx-eye-lid" d="M20,47 Q32,38 44,47 Q32,56 20,47 Z" fill="#0c0306" />
          </g>
        </g>
      </svg>
    </button>
  );
}

const btnStyle: CSSProperties = {
  position: 'absolute', top: '12px', right: '12px', zIndex: 20,
  width: '52px', height: '72px', padding: 0, border: 'none', background: 'transparent',
  cursor: 'pointer', outline: 'none', lineHeight: 0,
};
