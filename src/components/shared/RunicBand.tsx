import { useMemo } from 'react';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

interface RunicBandProps {
  text?: string;
  color?: string;
  opacity?: number;
  fontSize?: string;
}

export default function RunicBand({
  text = RUNES,
  color = '#7b9ec7',
  opacity = 0.35,
  fontSize = 'clamp(0.6rem, 1.2vw, 0.85rem)',
}: RunicBandProps) {
  const repeatCount = useMemo(() => Math.ceil(100 / text.length), [text]);

  return (
    <div
      style={{
        color,
        fontSize,
        letterSpacing: '0.5em',
        opacity,
        fontFamily: "'Cormorant Garamond', serif",
        // A single decorative rule: keep it to one line and clip the overflow so
        // it fills whatever width is available instead of wrapping into a tall
        // block of runes on narrow (mobile) screens.
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        maxWidth: '100%',
        lineHeight: 1.4,
        userSelect: 'none',
        textAlign: 'center',
      }}
    >
      {text.repeat(repeatCount)}
    </div>
  );
}
