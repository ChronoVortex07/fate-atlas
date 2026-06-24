import { RUNES } from '../../data/runes';
import type { RuneId, RuneOrientation } from '../../engine/types';

interface Props {
  rune: RuneId;
  orientation?: RuneOrientation;
  silent?: boolean;       // face-down — shows the blank knotwork back
  size?: number;          // stone height in px
  color?: string;         // override the carved-glyph color
  glow?: boolean;         // strong gold halo (governing stone)
}

// A cast rune-stone: a rounded tablet with the stave carved into it. Upright staves
// glow gold; merkstave (reversed) staves are inverted with a dim red-violet cast;
// silent (face-down) stones show a blank knotwork back.
export default function RuneSigil({ rune, orientation = 'upright', silent = false, size = 44, color, glow = false }: Props) {
  const def = RUNES[rune];
  const w = size * 0.78;
  const merk = orientation === 'merkstave';
  const glyphColor = color ?? (merk ? '#b083c4' : '#d4a854');

  const stoneStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: w, height: size, borderRadius: `${size * 0.18}px`,
    background: silent
      ? 'radial-gradient(70% 70% at 50% 35%, #1c2336, #0a0e1a)'
      : 'radial-gradient(70% 70% at 50% 30%, #232b40, #0d1322)',
    border: `1px solid ${silent ? '#2a3450' : merk ? '#5a3a64' : '#3a3354'}`,
    boxShadow: glow
      ? `0 0 16px ${merk ? 'rgba(176,131,196,0.5)' : 'rgba(212,168,84,0.55)'}, inset 0 0 10px rgba(8,13,24,0.8)`
      : 'inset 0 0 8px rgba(8,13,24,0.7)',
    overflow: 'hidden',
  };

  if (silent) {
    return (
      <span style={stoneStyle} aria-label="silent rune">
        <span style={{ fontSize: size * 0.5, color: '#3a4a66', lineHeight: 1, opacity: 0.5 }}>᛭</span>
      </span>
    );
  }

  return (
    <span style={stoneStyle} aria-label={`${def.name} ${merk ? 'merkstave' : 'upright'}`}>
      <span
        style={{
          fontSize: size * 0.56,
          color: glyphColor,
          fontFamily: "'Cormorant Garamond', serif",
          lineHeight: 1,
          transform: merk ? 'rotate(180deg)' : undefined,
          textShadow: `0 0 6px ${merk ? 'rgba(176,131,196,0.45)' : 'rgba(212,168,84,0.45)'}`,
        }}
      >
        {def.glyph}
      </span>
    </span>
  );
}
