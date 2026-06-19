import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

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

export default function TitleScreen() {
  const { state, engine } = useGameEngine();

  if (state.screen !== 'title') return null;

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
          <div style={runicBandStyle}>{RUNES}</div>
          <h1 style={titleStyle}>ATLAS OF FATE</h1>
          <div style={{
            ...runicBandStyle,
            transform: 'scaleX(-1)',
          }}>{RUNES}</div>
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
  background: `#070a12`,
  backgroundImage: STAR_POINTS,
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
  fontSize: 'clamp(2.5rem, 8vw, 5rem)',
  color: '#c8d8f0',
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  letterSpacing: '0.3em',
  margin: 0,
  lineHeight: 1.1,
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
