import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const THRESHOLD_COLORS: Record<string, string> = {
  'critical-low': '#c0392b',
  'low': '#c75b4a',
  'neutral': '#7b9ec7',
  'high': '#5b8c5a',
  'critical-high': '#d4a854',
};

interface Props {
  value: number;      // final die value, 1-20
  threshold: string;  // for number color
  dc?: number;        // when present, shown beneath the die (fallback path)
  total?: number;     // d20 ± bless/bane, when present
}

// Presentational dice reveal: counts up to `value` on mount. The parent
// remounts this (key={value}) so a reroll replays the throw. This component
// is the single seam for a future physics-based throw — swap the internals
// here without touching DiceMinigame or the engine.
export default function DiceThrowAnimation({ value, threshold, dc, total }: Props) {
  const [rollValue, setRollValue] = useState(0);

  useEffect(() => {
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= value) {
        clearInterval(interval);
        setRollValue(value);
      } else {
        setRollValue(Math.min(count, 20));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <motion.div
      style={{ ...dieResultStyle, flexDirection: 'column' }}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
    >
      <span style={{ ...resultNumberStyle, color: THRESHOLD_COLORS[threshold] ?? '#c8d8f0' }}>
        {rollValue}
      </span>
      {dc !== undefined && (
        <span style={dcLineStyle}>
          {total ?? value} vs DC {dc}
        </span>
      )}
    </motion.div>
  );
}

const dcLineStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.7rem',
  letterSpacing: '0.12em',
  color: '#7b9ec7',
  marginTop: '0.4rem',
  display: 'block',
  textAlign: 'center',
};

const dieResultStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  background: '#0d1220',
  border: '2px solid #1a2440',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const resultNumberStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: '3rem',
  transition: 'color 0.5s ease',
};
