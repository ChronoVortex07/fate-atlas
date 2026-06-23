// Standardized face-down card back: a faint geometric crest over a sparse
// star pattern, in muted blue/gold. Pure presentational SVG, scales to `size`.
export default function CardBack({
  size = 48,
  color = '#7b9ec7',
  accent = '#d4a854',
}: { size?: number; color?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 64" role="img" aria-label="Face-down card" style={{ display: 'block' }}>
      <rect x="1" y="1" width="46" height="62" rx="4" fill="#080d18" stroke={color} strokeWidth="0.75" opacity="0.9" />
      <rect x="4" y="4" width="40" height="56" rx="3" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.4" />
      {/* Central crest — diamond + ring */}
      <g stroke={accent} strokeWidth="0.9" fill="none" opacity="0.7" strokeLinejoin="round">
        <circle cx="24" cy="32" r="9" />
        <path d="M24 21 L31 32 L24 43 L17 32 Z" />
        <path d="M24 26 L24 38 M18 32 H30" stroke={color} strokeWidth="0.6" opacity="0.8" />
      </g>
      {/* Sparse stars */}
      <g fill={color} opacity="0.7">
        <circle cx="12" cy="12" r="0.7" />
        <circle cx="36" cy="14" r="0.6" />
        <circle cx="10" cy="50" r="0.6" />
        <circle cx="38" cy="52" r="0.7" />
        <circle cx="24" cy="9" r="0.5" />
        <circle cx="24" cy="55" r="0.5" />
      </g>
      <g fill={accent} opacity="0.6">
        <circle cx="14" cy="30" r="0.5" />
        <circle cx="34" cy="34" r="0.5" />
      </g>
    </svg>
  );
}
