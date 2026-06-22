import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { DivinationType } from '../../engine/types';

const METHOD_CARDS: Record<DivinationType, { symbol: string; title: string; description: string; color: string }> = {
  tarot: { symbol: 'XXI', title: 'Tarot', description: 'Draw from the Major Arcana — the ancient cards reveal hidden truths.', color: '#9b6bb0' },
  d20: { symbol: String.fromCodePoint(0x2685), title: 'Dice', description: 'Cast the twenty-sided die — fate speaks through numbers.', color: '#c75b4a' },
  iching: { symbol: String.fromCodePoint(0x4DC0), title: 'I Ching', description: 'Consult the Book of Changes — the hexagram illuminates your path.', color: '#5b8c5a' },
  astral: { symbol: '★', title: 'Astral', description: 'Gaze upon the heavens — the celestial bodies reveal their wisdom.', color: '#5b7ec7' },
  happening: { symbol: String.fromCodePoint(0x2726), title: 'Happening', description: 'Something stirs in the weave — a cryptic event awaits.', color: '#d4a854' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function MethodSelect() {
  const { state, engine } = useGameEngine();

  const handleSelect = (index: number) => {
    engine.selectMethod(index);
  };

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>Choose your divination</h1>
        <p style={subtitleStyle}>
          {state.minigamesCompleted > 0
            ? `Reading ${state.minigamesCompleted + 1} of ${3} — pick your next method`
            : 'The stars have dealt three methods — pick one to reveal your fate'}
        </p>
        <div style={turnProgressStyle}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{
              ...progressDotStyle,
              background: i < state.minigamesCompleted ? '#d4a854' : '#1a2440',
              boxShadow: i < state.minigamesCompleted ? '0 0 6px rgba(212,168,84,0.4)' : 'none',
            }} />
          ))}
        </div>
        <div style={goldRuleStyle} />

        <motion.div style={gridStyle} variants={containerVariants} initial="hidden" animate="visible">
          {state.availableMethods.map((method, i) => {
            const card = METHOD_CARDS[method];
            const isShrouded = state.shroudedMethods.includes(i);
            return (
              <motion.button
                key={i}
                style={isShrouded
                  ? { ...cardStyle, ...shroudedCardStyle }
                  : { ...cardStyle, borderColor: card.color + '40' }}
                variants={cardVariants}
                whileHover={isShrouded
                  ? { borderColor: '#4a3a6060', scale: 1.02 }
                  : { borderColor: card.color, boxShadow: `0 0 20px ${card.color}20`, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(i)}
              >
                <div style={{ ...cardSymbolStyle, color: isShrouded ? '#4a5a7a' : card.color }}>
                  {isShrouded ? '?' : card.symbol}
                </div>
                <div style={cardTitleStyle}>
                  {isShrouded ? '???' : card.title}
                </div>
                <div style={cardDescStyle}>
                  {isShrouded
                    ? 'Shadow conceals this path — its nature is hidden.'
                    : card.description}
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Will (elevated): call for a different set of methods. handSize >= 4
            is the already-exposed proxy for an elevated Will. */}
        {state.affinityEffects.handSize >= 4 && (
          <motion.button
            style={swapMethodStyle}
            whileHover={{ borderColor: '#9b6bb0', scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => engine.swapMethod()}
          >
            ↺ Call for different methods
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

const swapMethodStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.4vw, 0.9rem)',
  letterSpacing: '0.08em',
  color: '#c8a0d0',
  background: '#0d1220',
  border: '1px solid #9b6bb040',
  borderRadius: '6px',
  padding: '0.6rem 1.25rem',
  cursor: 'pointer',
  outline: 'none',
  marginTop: '0.5rem',
};

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '660px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.12em',
  margin: 0,
  textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  letterSpacing: '0.05em',
  margin: 0,
  textAlign: 'center',
};

const goldRuleStyle: React.CSSProperties = {
  width: '40px',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
};

const turnProgressStyle: React.CSSProperties = {
  display: 'flex', gap: '10px',
};

const progressDotStyle: React.CSSProperties = {
  width: '10px', height: '10px', borderRadius: '50%',
  transition: 'background 0.4s ease, box-shadow 0.4s ease',
};

const gridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
  maxWidth: '420px',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '1.25rem 1.5rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  outline: 'none',
  width: '100%',
};

// Face-down / veiled style for shadow-shrouded method cards.
const shroudedCardStyle: React.CSSProperties = {
  background: '#08090f',
  border: '1px solid #1a1e30',
  opacity: 0.75,
};

const cardSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(1rem, 2vw, 1.2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const cardDescStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
  color: '#7b9ec7',
  textAlign: 'center',
  lineHeight: 1.4,
};
