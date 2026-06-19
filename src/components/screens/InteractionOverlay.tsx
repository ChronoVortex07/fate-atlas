import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { InteractionEvent } from '../../engine/types';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

export default function InteractionOverlay() {
  const { state, engine } = useGameEngine();

  if (state.screen !== 'interaction') return null;

  const interactions = state.interactions;
  const hasInteractions = interactions.length > 0;

  const handleContinue = () => {
    engine.synthesize();
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
        <motion.div
          style={headingSectionStyle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 style={headingStyle}>
            {hasInteractions ? 'The Stars Intervene' : 'The Stars Are Still'}
          </h1>
          <p style={subtitleStyle}>
            {hasInteractions
              ? 'Meta-events stir the weave of fate...'
              : 'No meta-events disturb the reading.'}
          </p>
          <div style={goldRuleStyle} />
        </motion.div>

        {hasInteractions ? (
          <div style={interactionsListStyle}>
            {interactions.map((event, i) => (
              <InteractionCard key={`${event.ruleId}-${i}`} event={event} index={i} />
            ))}
          </div>
        ) : (
          <motion.p
            style={emptyStateStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            The threads remain untangled. Your reading proceeds undisturbed.
          </motion.p>
        )}

        <motion.button
          style={buttonStyle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: hasInteractions ? interactions.length * 0.5 + 0.3 : 0.5,
          }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(212, 168, 84, 0.5)' }}
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
        >
          REVEAL THE INTERPRETATION
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Interaction Card ──

function InteractionCard({
  event,
  index,
}: {
  event: InteractionEvent;
  index: number;
}) {
  return (
    <motion.div
      style={cardWrapperStyle}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.5 }}
    >
      {/* Gold flash overlay */}
      <motion.div
        style={flashOverlayStyle}
        initial={{ opacity: 0.7, scale: 1.04 }}
        animate={{ opacity: 0, scale: 1 }}
        transition={{ duration: 1.2, delay: index * 0.5, ease: 'easeOut' }}
      />

      <div style={cardInnerStyle}>
        {/* Source / target slot indicators */}
        <div style={slotRowStyle}>
          <span style={slotBadgeStyle}>
            <span style={slotLabelStyle}>Source</span>
            <span style={slotNumberStyle}>Slot {event.sourceSlotIndex + 1}</span>
          </span>
          <span style={arrowStyle}>{RUNES[5]} {RUNES[5]}</span>
          <span style={slotBadgeStyle}>
            <span style={slotLabelStyle}>Target</span>
            <span style={slotNumberStyle}>Slot {event.targetSlotIndex + 1}</span>
          </span>
        </div>

        <p style={descriptionStyle}>{event.description}</p>
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
  gap: '2rem',
  padding: '2rem',
  maxWidth: '600px',
  width: '100%',
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

const goldRuleStyle: React.CSSProperties = {
  width: '60px',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
  marginTop: '0.25rem',
};

const interactionsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  width: '100%',
};

const emptyStateStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  letterSpacing: '0.05em',
  textAlign: 'center',
  margin: '1.5rem 0',
};

const buttonStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  letterSpacing: '0.25em',
  color: '#d4a854',
  background: 'transparent',
  border: '1px solid #d4a854',
  padding: '0.8rem 2.4rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  outline: 'none',
};

// ── Interaction Card Styles ──

const cardWrapperStyle: React.CSSProperties = {
  position: 'relative',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '6px',
  overflow: 'hidden',
};

const flashOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212, 168, 84, 0.25), transparent 70%)',
  pointerEvents: 'none',
  borderRadius: '6px',
};

const cardInnerStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const slotRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
};

const slotBadgeStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.15rem',
  padding: '0.35rem 0.7rem',
  background: 'rgba(26, 36, 64, 0.6)',
  borderRadius: '4px',
};

const slotLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.6rem',
  color: '#7b9ec7',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const slotNumberStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.95rem',
  color: '#d4a854',
};

const arrowStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  color: '#1a2440',
  fontSize: '1rem',
  letterSpacing: '0.2em',
};

const descriptionStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.85rem',
  color: '#7b9ec7',
  lineHeight: 1.6,
  margin: 0,
  textAlign: 'center',
};
