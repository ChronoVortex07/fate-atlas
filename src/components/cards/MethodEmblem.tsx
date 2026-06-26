import type { DivinationType } from '../../engine/types';

// Per-method illustrated emblem (inline SVG, monochrome via currentColor). The
// parent (MethodCardFront) sets `color` to the family accent.
export default function MethodEmblem({ method, size = 64 }: { method: DivinationType; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 64 64',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
    strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const,
    style: { display: 'block' as const },
  };
  switch (method) {
    case 'tarot':
      return (
        <svg {...common} role="img" aria-label="Tarot">
          {/* three fanned cards */}
          <g transform="rotate(-14 32 40)"><rect x="16" y="18" width="20" height="30" rx="2.5" opacity="0.5" /></g>
          <g transform="rotate(0 32 40)"><rect x="22" y="14" width="20" height="32" rx="2.5" opacity="0.75" /></g>
          <g transform="rotate(14 32 40)"><rect x="28" y="18" width="20" height="30" rx="2.5" /></g>
          <path d="M38 24 l2.6 5.2 5.4.8 -4 3.9.9 5.4 -4.8-2.5 -4.8 2.5.9-5.4 -4-3.9 5.4-.8 Z" strokeWidth="1" opacity="0.9" />
        </svg>
      );
    case 'd20':
      return (
        <svg {...common} role="img" aria-label="Dice">
          <path d="M32 8 L52 20 V44 L32 56 L12 44 V20 Z" />
          <path d="M32 8 L32 22 M12 20 L32 22 L52 20 M32 22 L20 44 M32 22 L44 44 M12 44 L20 44 L32 56 L44 44 L52 44" opacity="0.7" strokeWidth="1" />
          <text x="32" y="38" textAnchor="middle" fontSize="11" fontFamily="'Cormorant Garamond', serif" fill="currentColor" stroke="none">20</text>
        </svg>
      );
    case 'iching':
      return (
        <svg {...common} role="img" aria-label="I Ching">
          {/* six stacked lines: solid / broken alternating (Qian-over-Kun motif) */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const y = 14 + i * 7.6;
            const broken = i % 2 === 1;
            return broken ? (
              <g key={i}><line x1="16" y1={y} x2="29" y2={y} strokeWidth="3.2" /><line x1="35" y1={y} x2="48" y2={y} strokeWidth="3.2" /></g>
            ) : (
              <line key={i} x1="16" y1={y} x2="48" y2={y} strokeWidth="3.2" />
            );
          })}
        </svg>
      );
    case 'astral':
      return (
        <svg {...common} role="img" aria-label="Astral">
          <circle cx="32" cy="32" r="9" />
          <ellipse cx="32" cy="32" rx="22" ry="9" opacity="0.6" />
          <ellipse cx="32" cy="32" rx="22" ry="9" opacity="0.6" transform="rotate(60 32 32)" />
          <circle cx="54" cy="32" r="2" fill="currentColor" />
          <circle cx="14" cy="46" r="1.5" fill="currentColor" />
          <circle cx="48" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'rune':
      return (
        <svg {...common} role="img" aria-label="Rune">
          <rect x="17" y="9" width="30" height="46" rx="6" opacity="0.5" />
          {/* Algiz stave — smaller, centered in the tablet (approved tweak) */}
          <path d="M32 22 V44 M32 28 L25 20 M32 28 L39 20" strokeWidth="2" />
        </svg>
      );
    case 'strings':
      return (
        <svg {...common} role="img" aria-label="Strings of Fate">
          {/* a knotted thread threading three nodes */}
          <path d="M12 50 C 24 30, 30 30, 40 40 C 50 50, 54 22, 52 14" opacity="0.9" />
          <path d="M40 40 C 50 56, 30 58, 24 50" opacity="0.6" />
          <circle cx="12" cy="50" r="3" fill="currentColor" />
          <circle cx="40" cy="40" r="3.4" fill="currentColor" />
          <circle cx="52" cy="14" r="3" fill="currentColor" />
          <path d="M40 36 L44 40 L40 44 L36 40 Z" fill="none" />
        </svg>
      );
    case 'happening':
    default:
      return (
        <svg {...common} role="img" aria-label="Happening">
          <path d="M32 12 l3 14 14 3 -14 3 -3 14 -3 -14 -14 -3 14 -3 Z" />
        </svg>
      );
  }
}
