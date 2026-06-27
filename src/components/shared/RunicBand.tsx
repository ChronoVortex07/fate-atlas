import { useMemo } from 'react';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

interface RunicBandProps {
  text?: string;
  color?: string;
  opacity?: number;
  fontSize?: string;
  lines?: number; // max lines before clamp (default 3)
}

export default function RunicBand({
  text = RUNES,
  color = '#7b9ec7',
  opacity = 0.35,
  fontSize = 'clamp(0.6rem, 1.2vw, 0.85rem)',
  lines = 3,
}: RunicBandProps) {
  // Enough runes to plausibly fill up to `lines` wrapped rows at a typical
  // decorated width; the clamp hides any overflow, so the exact length isn't
  // load-bearing.
  const repeatCount = useMemo(
    () => Math.max(2, Math.ceil((18 * lines) / text.length)),
    [text, lines],
  );

  return (
    <div
      className="runic-band"
      style={{
        ['--rune-lines' as string]: String(lines),
        color,
        fontSize,
        letterSpacing: '0.5em',
        opacity,
        fontFamily: "'Cormorant Garamond', serif",
        // Wrap to the decorated element's width and flow up to --rune-lines
        // rows; the line-clamp truncates extra rows from the bottom first, so on
        // short / mobile viewports the lower lines drop before other UI is
        // pushed off-screen.
        whiteSpace: 'normal',
        wordBreak: 'break-all',
        textAlign: 'center',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 'var(--rune-lines)' as unknown as number,
        overflow: 'hidden',
        maxWidth: '100%',
        userSelect: 'none',
      }}
    >
      {text.repeat(repeatCount)}
    </div>
  );
}
