import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { castHexagram } from '../../data/iching';
import type { IChingResult } from '../../engine/types';

const LINE_LABELS = ['1st (bottom)', '2nd', '3rd', '4th', '5th', '6th (top)'];

export default function IChingMinigame() {
  const { state, engine } = useGameEngine();
  const [castCount, setCastCount] = useState(0);
  const [hexagramResult, setHexagramResult] = useState<IChingResult | null>(null);
  const [done, setDone] = useState(false);

  const handleCast = useCallback(() => {
    if (done) return;
    const next = castCount + 1;
    setCastCount(next);
    if (next >= 6) {
      const result = castHexagram(state.affinities);
      setHexagramResult(result);
      setDone(true);
    }
  }, [castCount, done, state.affinities]);

  useEffect(() => {
    if (!done || !hexagramResult) return;
    const timer = setTimeout(() => {
      engine.completeMinigame(hexagramResult);
    }, 2000);
    return () => clearTimeout(timer);
  }, [done, hexagramResult, engine]);

  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayHex =
    committedSlot && committedSlot.type === 'iching' ? committedSlot : hexagramResult;

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>
          {!done ? `Cast ${castCount + 1} of 6` : 'The hexagram is revealed'}
        </h1>

        {!done ? (
          <motion.button
            style={castButtonStyle}
            whileHover={{ scale: 1.05, borderColor: '#5b8c5a', boxShadow: '0 0 20px rgba(91,140,90,0.2)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCast}
          >
            <span style={coinStyle}>{String.fromCodePoint(0x26AA)} {String.fromCodePoint(0x26AB)} {String.fromCodePoint(0x26AA)}</span>
            <span style={castLabelStyle}>Tap to cast coins</span>
            <span style={lineLabelStyle}>{LINE_LABELS[castCount]}</span>
          </motion.button>
        ) : (
          <motion.div
            key={displayHex ? `${displayHex.hexagramNumber}-${displayHex.changingLines.join(',')}` : 'hex'}
            style={hexagramResultStyle}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div style={hexagramSymbolStyle}>{displayHex?.symbol}</div>
            <div style={hexagramNameStyle}>{displayHex?.name}</div>
            <div style={hexagramNumberStyle}>Hexagram #{displayHex?.hexagramNumber}</div>
            <p style={hexagramJudgmentStyle}>{displayHex?.judgment}</p>
            {displayHex && displayHex.changingLines.length > 0 && (
              <div style={changingLinesStyle}>
                Changing lines: {displayHex.changingLines.join(', ')}
              </div>
            )}
          </motion.div>
        )}

        {/* Casting progress */}
        <div style={progressStyle}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              style={{
                ...progressDotStyle,
                background: i < castCount ? '#5b8c5a' : '#1a2440',
              }}
            />
          ))}
        </div>
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
  gap: '1.5rem',
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

const castButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.5rem 2rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '8px',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const coinStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  letterSpacing: '0.3em',
};

const castLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const lineLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#5b7290',
};

const hexagramResultStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  textAlign: 'center',
};

const hexagramSymbolStyle: React.CSSProperties = {
  fontSize: '3rem',
  color: '#d4a854',
};

const hexagramNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const hexagramNumberStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.8rem',
  color: '#5b8c5a',
};

const hexagramJudgmentStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  lineHeight: 1.5,
  margin: '0.5rem 0 0',
  maxWidth: '360px',
};

const changingLinesStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.75rem',
  color: '#d4a854',
  marginTop: '0.25rem',
};

const progressStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const progressDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  transition: 'background 0.3s ease',
};
