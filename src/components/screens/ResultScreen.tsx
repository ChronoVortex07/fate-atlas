import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { SlotResult } from '../../engine/types';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

function formatQuestionType(qt: string): string {
  switch (qt) {
    case 'decision':
      return 'Decision';
    case 'relationship':
      return 'Relationship';
    case 'future':
      return 'Future / Forecast';
    case 'self':
      return 'Self-Analysis';
    default:
      return qt;
  }
}

function getSlotIcon(slot: SlotResult): string {
  switch (slot.type) {
    case 'tarot':
      return slot.symbol;
    case 'd20':
      return '⚅'; // ⚅
    case 'iching':
      return slot.symbol;
    case 'happening':
      return '★'; // ★
    default:
      return '✵'; // ✵
  }
}

function getSlotLabel(slot: SlotResult): string {
  switch (slot.type) {
    case 'tarot':
      return slot.name;
    case 'd20':
      return `Dice — ${slot.result}`;
    case 'iching':
      return `Hexagram #${slot.hexagramNumber}`;
    case 'happening':
      return 'Happening';
    default:
      return 'Unknown';
  }
}

function getSlotSubtitle(slot: SlotResult): string {
  switch (slot.type) {
    case 'tarot':
      return slot.orientation === 'upright'
        ? slot.meaningUpright.slice(0, 80)
        : slot.meaningReversed.slice(0, 80);
    case 'd20':
      return slot.interpretation.slice(0, 80);
    case 'iching':
      return slot.judgment.slice(0, 80);
    case 'happening':
      return slot.scene.slice(0, 80);
    default:
      return '';
  }
}

function getAffinityHint(chaos: number, order: number): string {
  if (chaos > 0.65) {
    return 'The currents of chaos run strong — fate twists with every turn.';
  }
  if (chaos > 0.5) {
    return 'A whisper of chaos stirs the weave of fate.';
  }
  if (order > 0.65) {
    return 'The patterns of order hold firm — destiny follows its course.';
  }
  if (order > 0.5) {
    return 'A thread of order runs through the tapestry of fate.';
  }
  if (chaos > 0.55 && order > 0.55) {
    return 'Chaos and order dance in equal measure — a rare convergence.';
  }
  return 'The balance holds. Stars watch in silence.';
}

export default function ResultScreen() {
  const { state, engine } = useGameEngine();

  if (state.screen !== 'result') return null;

  const { synthesis, slots, happening, selectedHappeningChoice, affinities } = state;

  const handleDrawAgain = useCallback(() => {
    engine.reset();
    engine.loadState({ screen: 'question' });
  }, [engine]);

  const handleShareImage = useCallback(() => {
    // Placeholder — Task 24 will wire html2canvas here
  }, []);

  const handleViewHistory = useCallback(() => {
    // Placeholder — will navigate to a history screen in a future task
  }, []);

  const nonEmptySlots = slots.filter((s): s is SlotResult => s !== null);
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
      <div style={scrollContentStyle}>
        <div style={contentStyle}>
          {/* Header */}
          <motion.div
            style={headerSectionStyle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div style={runicBandStyle}>{RUNES}</div>
            <h1 style={titleStyle}>Your Reading</h1>
            <div style={questionLabelStyle}>{questionLabel}</div>
            <div style={goldRuleStyle} />
          </motion.div>

          {/* Slot result cards */}
          <motion.div
            style={slotsSectionStyle}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          >
            <h2 style={sectionHeadingStyle}>The Draw</h2>
            {nonEmptySlots.map((slot, i) => (
              <motion.div
                key={i}
                style={slotCardStyle}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.2 + i * 0.1,
                  ease: 'easeOut',
                }}
              >
                <div style={slotCardSymbolStyle}>{getSlotIcon(slot)}</div>
                <div style={slotCardInfoStyle}>
                  <div style={slotCardLabelStyle}>{getSlotLabel(slot)}</div>
                  <div style={slotCardSubtitleStyle}>{getSlotSubtitle(slot)}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Synthesis */}
          {synthesis && (
            <motion.div
              style={synthesisSectionStyle}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
            >
              <h2 style={sectionHeadingStyle}>Interpretation</h2>
              <h3 style={headlineStyle}>{synthesis.headline}</h3>
              <div style={paragraphsStyle}>
                {synthesis.paragraphs.map((para, i) => (
                  <p key={i} style={paragraphStyle}>
                    {para}
                  </p>
                ))}
              </div>
              {synthesis.tensionNote && (
                <div style={tensionBoxStyle}>
                  <div style={tensionBorderStyle} />
                  <p style={tensionTextStyle}>{synthesis.tensionNote}</p>
                </div>
              )}
              {synthesis.affinityNote && (
                <p style={affinityNoteStyle}>{synthesis.affinityNote}</p>
              )}
            </motion.div>
          )}

          {/* Happening outcome */}
          {happening && selectedHappeningChoice !== null && (
            <motion.div
              style={happeningSectionStyle}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            >
              <h2 style={sectionHeadingStyle}>The Crossroads</h2>
              <p style={happeningSceneStyle}>{happening.scene}</p>
              <div style={chosenStyle}>
                <span style={chosenLabelStyle}>You chose:</span>
                <span style={chosenTextStyle}>
                  {happening.choices[selectedHappeningChoice]?.text}
                </span>
              </div>
            </motion.div>
          )}

          {/* Affinity hint */}
          <motion.p
            style={affinityHintStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {getAffinityHint(affinities.chaos, affinities.order)}
          </motion.p>

          {/* Bottom runic band */}
          <motion.div
            style={{ ...runicBandStyle }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            {RUNES}
          </motion.div>

          {/* Action buttons */}
          <motion.div
            style={actionsStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <button
              style={primaryButtonStyle}
              onClick={handleDrawAgain}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  '0 0 30px rgba(212, 168, 84, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              DRAW AGAIN
            </button>

            <div style={secondaryRowStyle}>
              <button
                style={secondaryButtonStyle}
                onClick={handleShareImage}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    '0 0 20px rgba(212, 168, 84, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                SHARE AS IMAGE
              </button>

              <button
                style={secondaryButtonStyle}
                onClick={handleViewHistory}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    '0 0 20px rgba(212, 168, 84, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                VIEW HISTORY ({state.history.length})
              </button>
            </div>
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
  gap: '1.25rem',
  padding: '3rem 2rem 4rem',
  maxWidth: '680px',
  width: '100%',
};

const headerSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const runicBandStyle: React.CSSProperties = {
  color: '#7b9ec7',
  fontSize: 'clamp(0.6rem, 1.2vw, 0.85rem)',
  letterSpacing: '0.5em',
  opacity: 0.3,
  fontFamily: "'Cormorant Garamond', serif",
  wordBreak: 'break-all',
  lineHeight: 1.4,
  userSelect: 'none',
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.15em',
  margin: 0,
  textAlign: 'center',
};

const questionLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.85rem, 2vw, 1rem)',
  color: '#d4a854',
  fontStyle: 'italic',
  letterSpacing: '0.1em',
};

const goldRuleStyle: React.CSSProperties = {
  width: '60px',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
  marginTop: '0.25rem',
};

// ── Section heading ──

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
  color: '#d4a854',
  letterSpacing: '0.15em',
  margin: 0,
  textAlign: 'center',
};

// ── Slot cards ──

const slotsSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
};

const slotCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  width: '100%',
  padding: '1rem 1.25rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  boxSizing: 'border-box',
};

const slotCardSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(1.5rem, 3vw, 2rem)',
  color: '#d4a854',
  lineHeight: 1,
  flexShrink: 0,
};

const slotCardInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  minWidth: 0,
};

const slotCardLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
  color: '#c8d8f0',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const slotCardSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.7rem, 1.4vw, 0.8rem)',
  color: '#7b9ec7',
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// ── Synthesis section ──

const synthesisSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
  color: '#c8d8f0',
  letterSpacing: '0.05em',
  margin: 0,
  textAlign: 'center',
  lineHeight: 1.4,
};

const paragraphsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  width: '100%',
};

const paragraphStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.8rem, 1.6vw, 0.95rem)',
  color: '#7b9ec7',
  lineHeight: 1.7,
  margin: 0,
};

const tensionBoxStyle: React.CSSProperties = {
  position: 'relative',
  background: '#0d1220',
  borderRadius: '6px',
  padding: '0.9rem 1.1rem',
  width: '100%',
  boxSizing: 'border-box',
};

const tensionBorderStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '3px',
  background: '#d4a854',
  borderRadius: '3px 0 0 3px',
};

const tensionTextStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.75rem, 1.5vw, 0.9rem)',
  color: '#c8d8f0',
  lineHeight: 1.6,
  margin: 0,
  fontStyle: 'italic',
};

const affinityNoteStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.6vw, 0.95rem)',
  color: '#7b9ec7',
  lineHeight: 1.6,
  margin: 0,
  fontStyle: 'italic',
  textAlign: 'center',
};

// ── Happening outcome ──

const happeningSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.6rem',
  width: '100%',
  padding: '1rem 1.25rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  boxSizing: 'border-box',
};

const happeningSceneStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
  color: '#7b9ec7',
  lineHeight: 1.6,
  margin: 0,
  textAlign: 'center',
  fontStyle: 'italic',
};

const chosenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
};

const chosenLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: 'clamp(0.7rem, 1.4vw, 0.8rem)',
  color: '#d4a854',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const chosenTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
  color: '#c8d8f0',
  textAlign: 'center',
  lineHeight: 1.4,
  letterSpacing: '0.03em',
};

// ── Affinity hint ──

const affinityHintStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.6vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  lineHeight: 1.5,
  margin: 0,
  maxWidth: '480px',
};

// ── Action buttons ──

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  alignItems: 'center',
  marginTop: '0.5rem',
  width: '100%',
};

const primaryButtonStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
  letterSpacing: '0.25em',
  color: '#d4a854',
  background: 'transparent',
  border: '1px solid #d4a854',
  padding: '0.75rem 2.5rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  outline: 'none',
};

const secondaryRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const secondaryButtonStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.7rem, 1.4vw, 0.8rem)',
  letterSpacing: '0.1em',
  color: '#7b9ec7',
  background: 'transparent',
  border: '1px solid #1a2440',
  padding: '0.55rem 1.3rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  outline: 'none',
};
