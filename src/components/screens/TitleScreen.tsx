import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import RunicBand from '../shared/RunicBand';

export default function TitleScreen() {
  const { engine } = useGameEngine();

  const handleStart = () => {
    engine.loadState({ screen: 'question' });
  };

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div style={contentWrapperStyle}>
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={titleSectionStyle}
        >
          <RunicBand opacity={0.5} fontSize="clamp(0.7rem, 1.5vw, 1rem)" />
          <h1 style={titleStyle}>ATLAS OF FATE</h1>
          <div style={{
            ...runicBandStyle,
            transform: 'scaleX(-1)',
          }}>
            <RunicBand opacity={0.5} fontSize="clamp(0.7rem, 1.5vw, 1rem)" />
          </div>
        </motion.div>

        <motion.p
          style={subtitleStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <span style={moonStyle}>&#x263D;</span>
          {' '}the stars await your question{' '}
          <span style={moonStyle}>&#x263E;</span>
        </motion.p>

        <motion.button
          style={buttonStyle}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: 'easeOut' }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(212, 168, 84, 0.5)' }}
          whileTap={{ scale: 0.97 }}
          onClick={handleStart}
        >
          CONSULT THE STARS
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Cormorant Garamond', serif",
  overflow: 'hidden',
};

const contentWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
  textAlign: 'center',
  padding: '2rem',
};

const titleSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const titleStyle: React.CSSProperties = {
  // Min kept small enough that the full title fits on narrow phones without
  // clipping; letter-spacing scales with width so it stays generous on desktop
  // (max 5rem / 0.3em) but tightens on mobile.
  fontSize: 'clamp(1.9rem, 8vw, 5rem)',
  color: '#c8d8f0',
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  letterSpacing: 'clamp(0.12em, 1.2vw, 0.3em)',
  margin: 0,
  lineHeight: 1.1,
  maxWidth: '100%',
  textShadow: '0 0 40px rgba(200, 216, 240, 0.15)',
};

const runicBandStyle: React.CSSProperties = {
  color: '#7b9ec7',
  fontSize: 'clamp(0.7rem, 1.5vw, 1rem)',
  letterSpacing: '0.5em',
  opacity: 0.5,
  fontFamily: "'Cormorant Garamond', serif",
  wordBreak: 'break-all',
  lineHeight: 1.4,
  userSelect: 'none',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
  color: '#7b9ec7',
  letterSpacing: '0.15em',
  margin: 0,
};

const moonStyle: React.CSSProperties = {
  color: '#d4a854',
  fontSize: '1.1em',
};

const buttonStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
  letterSpacing: '0.25em',
  color: '#d4a854',
  background: 'transparent',
  border: '1px solid #d4a854',
  padding: '0.9rem 2.8rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  outline: 'none',
};
