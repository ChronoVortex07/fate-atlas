import { useId } from 'react';

export type SigilState = 'origin' | 'lit' | 'candidate' | 'veiled' | 'lookahead';

// The Sigil-Gem: a faceted lozenge ringed by a faint sigil-circle, glyph at its
// heart. Colour + glow vary by state (origin gold, lit/candidate crimson-rose,
// veiled/lookahead dim ghost). Self-contained — defines its own glow gradient.
export default function StringSigil({ glyph, state, size = 34 }:
  { glyph: string; state: SigilState; size?: number }) {
  const gid = useId();
  const lit = state === 'lit' || state === 'origin';
  const stroke = state === 'origin' ? '#d4a854'
    : lit ? '#d23f57'
    : state === 'candidate' ? '#b0566a'
    : '#3a3560';
  const core = state === 'origin' ? '#1a130a'
    : lit ? '#1a0e16'
    : state === 'candidate' ? '#1a0e16'
    : '#0d0a14';
  const glow = state === 'origin' ? '#f3dca0' : '#ff8095';
  const opacity = state === 'veiled' ? 0.4 : state === 'lookahead' ? 0.28 : 1;
  const showGlyph = state !== 'veiled';

  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" style={{ display: 'block', opacity }} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.9" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit && <ellipse rx="26" ry="24" fill={`url(#${gid})`} opacity={0.55} />}
      <circle r="22" fill="none" stroke={stroke} strokeWidth="1.1" opacity="0.5" strokeDasharray="2 3" />
      <path d="M0 -18 L15 0 L0 18 L-15 0 Z" fill={core} stroke={stroke} strokeWidth="2" />
      <path d="M0 -18 L0 18 M-15 0 L15 0" stroke={stroke} strokeWidth="1" opacity="0.55" />
      {showGlyph && (
        <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="13"
          fill={lit ? '#ffe9ec' : stroke} style={{ fontFamily: "'Cormorant Garamond', serif" }}>{glyph}</text>
      )}
    </svg>
  );
}
