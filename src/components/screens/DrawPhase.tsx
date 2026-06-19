import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import CardSlot from '../cards/CardSlot';

function formatQuestionType(qt: string): string {
  switch (qt) {
    case 'decision': return 'Decision';
    case 'relationship': return 'Relationship';
    case 'future': return 'Future / Forecast';
    case 'self': return 'Self-Analysis';
    default: return qt;
  }
}

const SLOT_COUNT = 3;

export default function DrawPhase() {
  const { state, engine } = useGameEngine();

  if (state.screen !== 'draw') return null;

  const handleReveal = (index: number) => {
    if (!state.slots[index]) {
      engine.drawSlot(index);
    }
    engine.revealSlot(index);
  };

  const questionLabel = state.questionType
    ? formatQuestionType(state.questionType)
    : 'the unknown';

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <motion.div
          style={headingSectionStyle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 style={headingStyle}>Draw your fate</h1>
          <p style={subtitleStyle}>
            Seeking <span style={questionTypeStyle}>{questionLabel}</span>
          </p>
          <div style={goldRuleStyle} />
        </motion.div>

        <motion.div
          style={slotsRowStyle}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        >
          {Array.from({ length: SLOT_COUNT }, (_, i) => (
            <CardSlot
              key={i}
              index={i}
              slot={state.slots[i]}
              onReveal={handleReveal}
            />
          ))}
        </motion.div>

        {state.revealedCount === SLOT_COUNT && (
          <motion.p
            style={allRevealedStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            All cards revealed — the stars align...
          </motion.p>
        )}
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
  background: '#070a12',
  overflow: 'auto',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2.5rem',
  padding: '2rem',
};

const headingSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
  color: '#c8d8f0',
  letterSpacing: '0.15em',
  margin: 0,
  textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
  color: '#7b9ec7',
  letterSpacing: '0.1em',
  margin: 0,
};

const questionTypeStyle: React.CSSProperties = {
  color: '#d4a854',
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontStyle: 'italic',
};

const goldRuleStyle: React.CSSProperties = {
  width: '60px',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
  marginTop: '0.25rem',
};

const slotsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const allRevealedStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  color: '#d4a854',
  fontStyle: 'italic',
  letterSpacing: '0.1em',
  margin: 0,
};
