import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import type { DiceResult } from '../../engine/types';

const THRESHOLD_COLORS: Record<string, string> = {
  'critical-low': '#c0392b',
  'low': '#c75b4a',
  'neutral': '#7b9ec7',
  'high': '#5b8c5a',
  'critical-high': '#d4a854',
};

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const [thrown, setThrown] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [rollValue, setRollValue] = useState(10);

  const handleThrow = useCallback(() => {
    setThrown(true);
    const finalResult = rollD20(state.affinities);
    setResult(finalResult);
    // Animate the count-up
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= finalResult.result) {
        clearInterval(interval);
        setRollValue(finalResult.result);
      } else {
        setRollValue(Math.min(count, 20));
      }
    }, 50);
  }, [state.affinities]);

  useEffect(() => {
    if (!result || !thrown) return;
    const timer = setTimeout(() => {
      engine.completeMinigame(result);
    }, 1500);
    return () => clearTimeout(timer);
  }, [result, thrown, engine]);

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>{thrown ? 'The die is cast' : 'Cast the die'}</h1>

        {!thrown ? (
          <motion.button
            style={dieButtonStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleThrow}
          >
            <span style={dieFaceStyle}>{String.fromCodePoint(0x2685)}</span>
            <span style={tapHintStyle}>Tap to throw</span>
          </motion.button>
        ) : (
          <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <motion.div
              style={dieResultStyle}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              <span style={{ ...resultNumberStyle, color: result ? THRESHOLD_COLORS[result.threshold] : '#c8d8f0' }}>
                {rollValue}
              </span>
            </motion.div>
            {result && (
              <motion.div style={thresholdStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <span style={{ ...thresholdBadgeStyle, color: THRESHOLD_COLORS[result.threshold], borderColor: THRESHOLD_COLORS[result.threshold] }}>
                  {result.threshold.replace(/-/g, ' ').toUpperCase()}
                </span>
                <p style={interpretationStyle}>{result.interpretation}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '500px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.12em',
  margin: 0,
  textAlign: 'center',
};

const dieButtonStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  background: '#0d1220',
  border: '2px solid #c75b4a',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
};

const dieFaceStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  lineHeight: 1,
};

const tapHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.6rem',
  color: '#5b7290',
  letterSpacing: '0.1em',
};

const resultContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
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

const thresholdStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const thresholdBadgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.7rem',
  letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem',
  border: '1px solid',
  borderRadius: '3px',
};

const interpretationStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  margin: 0,
  maxWidth: '300px',
};
