import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { LineValue } from '../../engine/types';

interface CoinCastProps {
  value: LineValue;   // predetermined by the engine; coin faces are cosmetic
  onSettled: () => void;
  index: number;      // line index 0..5, used only for accent timing
}

const BRONZE = '#d4a854';
const JADE = '#5b8c5a';

const SETTLE_MS = 1100;

// Coin sum 6/8 ⇒ more tails (yin), 7/9 ⇒ more heads (yang). Derive 3 faces that
// sum to the line value for flavor (heads=3, tails=2). This is purely cosmetic.
function facesFor(value: LineValue): boolean[] {
  // number of heads needed: value - 6 (6→0, 7→1, 8→2, 9→3 heads)
  const heads = value - 6;
  const faces = [true, true, true].map((_, i) => i < heads);
  // light shuffle so the heads aren't always first
  return faces.sort(() => Math.random() - 0.5);
}

export default function CoinCast({ value, onSettled, index }: CoinCastProps) {
  const settledRef = useRef(false);
  const faces = useRef<boolean[]>(facesFor(value)).current;

  useEffect(() => {
    settledRef.current = false;
    const timer = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      onSettled();
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // Re-arm whenever the target line changes (a new toss).
  }, [value, onSettled]);

  return (
    <div style={rowStyle}>
      {faces.map((heads, i) => (
        <motion.div
          key={i}
          style={coinStyle(heads)}
          initial={{ rotateY: 0, y: -40, opacity: 0 }}
          animate={{
            rotateY: [0, 540, 720 + (heads ? 0 : 180)],
            y: [-40, -10, 0],
            opacity: 1,
          }}
          transition={{
            duration: SETTLE_MS / 1000,
            times: [0, 0.6, 1],
            delay: i * 0.08 + (index % 2) * 0.02,
            ease: 'easeOut',
          }}
        >
          <span style={holeStyle} />
        </motion.div>
      ))}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  justifyContent: 'center',
  alignItems: 'center',
  perspective: '600px',
};

const coinStyle = (heads: boolean): React.CSSProperties => ({
  width: '38px',
  height: '38px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: heads
    ? `radial-gradient(circle at 30% 30%, ${BRONZE}, #8a6a2c)`
    : `radial-gradient(circle at 30% 30%, ${JADE}, #2f4a2e)`,
  border: `1.5px solid ${heads ? '#f0d089' : '#7fae7c'}`,
  boxShadow: `0 0 10px ${heads ? 'rgba(212,168,84,0.4)' : 'rgba(91,140,90,0.4)'}`,
  transformStyle: 'preserve-3d',
});

const holeStyle: React.CSSProperties = {
  width: '11px',
  height: '11px',
  borderRadius: '2px',
  background: '#0d1220',
  boxShadow: 'inset 0 0 3px rgba(0,0,0,0.8)',
};
