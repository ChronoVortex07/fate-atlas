import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import RunicBand from '../shared/RunicBand';

const STAR_POINTS = [
  'radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.8), transparent)',
  'radial-gradient(1.5px 1.5px at 25% 40%, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(1px 1px at 50% 10%, rgba(255,255,255,0.6), transparent)',
  'radial-gradient(2px 2px at 70% 60%, rgba(255,255,255,0.4), transparent)',
  'radial-gradient(1px 1px at 85% 30%, rgba(255,255,255,0.7), transparent)',
  'radial-gradient(1.5px 1.5px at 15% 75%, rgba(255,255,255,0.3), transparent)',
  'radial-gradient(1px 1px at 40% 90%, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(2px 2px at 60% 50%, rgba(255,255,255,0.9), transparent)',
  'radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.4), transparent)',
  'radial-gradient(1.5px 1.5px at 30% 20%, rgba(255,255,255,0.6), transparent)',
  'radial-gradient(1px 1px at 5% 50%, rgba(255,255,255,0.3), transparent)',
  'radial-gradient(2px 2px at 95% 10%, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(1px 1px at 45% 70%, rgba(255,255,255,0.7), transparent)',
  'radial-gradient(1.5px 1.5px at 80% 45%, rgba(255,255,255,0.4), transparent)',
  'radial-gradient(1px 1px at 20% 85%, rgba(255,255,255,0.6), transparent)',
  'radial-gradient(2px 2px at 75% 90%, rgba(255,255,255,0.3), transparent)',
  'radial-gradient(1px 1px at 55% 25%, rgba(255,255,255,0.8), transparent)',
  'radial-gradient(1.5px 1.5px at 35% 55%, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(1px 1px at 65% 35%, rgba(255,255,255,0.4), transparent)',
  'radial-gradient(2px 2px at 10% 95%, rgba(255,255,255,0.6), transparent)',
  'radial-gradient(1px 1px at 92% 65%, rgba(255,255,255,0.7), transparent)',
  'radial-gradient(1.5px 1.5px at 50% 45%, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(1px 1px at 15% 10%, rgba(255,255,255,0.3), transparent)',
  'radial-gradient(2px 2px at 88% 25%, rgba(255,255,255,0.5), transparent)',
  'radial-gradient(1px 1px at 42% 35%, rgba(255,255,255,0.8), transparent)',
].join(',\n');

export default function HappeningScene() {
  const { state, engine } = useGameEngine();
  const happening = state.happening;

  // Auto-transition to result if no happening is set when on this screen
  useEffect(() => {
    if (state.screen === 'happening' && !happening) {
      engine.loadState({ screen: 'result' });
    }
  }, [state.screen, happening, engine]);

  if (state.screen !== 'happening') return null;
  if (!happening) return null;

  const handleChoice = useCallback(
    (index: number) => {
      engine.resolveHappening(index);
    },
    [engine],
  );

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={scrollContentStyle}>
        <div style={contentStyle}>
          {/* Top runic band */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            style={{ textAlign: 'center', width: '100%' }}
          >
            <RunicBand opacity={0.3} />
          </motion.div>

          {/* Scene text */}
          <motion.p
            style={sceneStyle}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            {happening.scene}
          </motion.p>

          {/* Bottom runic band */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            style={{ marginTop: '0.25rem', textAlign: 'center', width: '100%' }}
          >
            <RunicBand opacity={0.2} />
          </motion.div>

          {/* Choice cards */}
          <motion.div
            style={choicesStyle}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.15, delayChildren: 0.3 },
              },
            }}
          >
            {happening.choices.map((choice, i) => (
              <motion.button
                key={i}
                style={choiceCardStyle}
                variants={{
                  hidden: { opacity: 0, y: 40 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.6, ease: 'easeOut' },
                  },
                }}
                whileHover={{
                  borderColor: '#d4a854',
                  boxShadow: '0 0 20px rgba(212, 168, 84, 0.25)',
                  scale: 1.02,
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChoice(i)}
              >
                <span style={choiceTextStyle}>{choice.text}</span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  justifyContent: 'center',
  background: '#070a12',
  backgroundImage: STAR_POINTS,
  overflow: 'hidden',
};

const scrollContentStyle: React.CSSProperties = {
  overflowY: 'auto',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
  padding: '3rem 2rem',
  maxWidth: '680px',
  width: '100%',
};

const sceneStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(1.1rem, 2.8vw, 1.5rem)',
  color: '#c8d8f0',
  textAlign: 'center',
  lineHeight: 1.7,
  margin: 0,
  maxWidth: '600px',
  letterSpacing: '0.03em',
};

const choicesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
  maxWidth: '480px',
  marginTop: '0.5rem',
};

const choiceCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.25rem 1.5rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  cursor: 'pointer',
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
  color: '#7b9ec7',
  letterSpacing: '0.05em',
  lineHeight: 1.5,
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  outline: 'none',
  textAlign: 'center',
};

const choiceTextStyle: React.CSSProperties = {
  color: '#7b9ec7',
};
