import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import RerollAnimation from './InteractionAnimations/RerollAnimation';
import FlipAnimation from './InteractionAnimations/FlipAnimation';
import MirrorAnimation from './InteractionAnimations/MirrorAnimation';
import AddChoiceAnimation from './InteractionAnimations/AddChoiceAnimation';
import SecondResultAnimation from './InteractionAnimations/SecondResultAnimation';
import ShroudAnimation from './InteractionAnimations/ShroudAnimation';
import WidenAnimation from './InteractionAnimations/WidenAnimation';
import OverrideAnimation from './InteractionAnimations/OverrideAnimation';
import type { EffectReport } from '../../engine/types';

export default function InteractionSequencer() {
  const { state, engine } = useGameEngine();
  const [i, setI] = useState(0);

  const queue = state.eventQueue;

  useEffect(() => {
    if (queue.length === 0) return;
    if (i >= queue.length) {
      engine.clearEventQueue();
      setI(0);
      return;
    }
    const t = setTimeout(() => setI((n) => n + 1), 1400);
    return () => clearTimeout(t);
  }, [i, queue.length, engine]);

  const skip = useCallback(() => {
    engine.clearEventQueue();
    setI(0);
  }, [engine]);

  if (queue.length === 0) return null;

  const report: EffectReport = queue[Math.min(i, queue.length - 1)];

  return (
    <AnimatePresence>
      <motion.div
        key={`seq-${i}`}
        style={overlayStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={skip}
      >
        {/* Dimming veil */}
        <div style={veilStyle} />

        {/* Animation layer */}
        <div style={animLayerStyle}>
          {renderAnimation(report)}
        </div>

        {/* Info banner */}
        <motion.div
          style={bannerStyle}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div style={bannerLabelStyle}>{report.label}</div>
          <div style={bannerDescStyle}>{report.description}</div>
        </motion.div>

        {/* Progress dots */}
        {queue.length > 1 && (
          <div style={dotsStyle}>
            {queue.map((_r, idx) => (
              <div
                key={idx}
                style={{
                  ...dotStyle,
                  background: idx === i ? '#d4a854' : 'rgba(212,168,84,0.25)',
                }}
              />
            ))}
          </div>
        )}

        {/* Skip hint */}
        <motion.div
          style={skipHintStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          Tap to skip all
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function renderAnimation(report: EffectReport) {
  const props = {
    description: report.description,
    sourceSlot: report.sourceSlot ?? null,
    targetSlot: report.targetSlot ?? null,
  };

  switch (report.animation) {
    case 'reroll':
      return <RerollAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'flip':
      return <FlipAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'mirror':
      return <MirrorAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'add-choice':
      return <AddChoiceAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'second-result':
      return <SecondResultAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'shroud':
      return <ShroudAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'widen':
      return <WidenAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'override':
      return <OverrideAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    default:
      // Generic fallback — no crash for unknown animation strings (e.g. 'roll-mode')
      return null;
  }
}

// ── Styles ──

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.5rem',
  pointerEvents: 'auto',
  cursor: 'pointer',
};

const veilStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(2, 4, 10, 0.55)',
  pointerEvents: 'none',
};

const animLayerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const bannerStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.5rem 2rem',
  background: '#0d1220',
  border: '1px solid rgba(212, 168, 84, 0.5)',
  borderRadius: '6px',
  maxWidth: '420px',
  textAlign: 'center',
};

const bannerLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1.2rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
};

const bannerDescStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: '0.85rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  lineHeight: 1.5,
};

const dotsStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  gap: '6px',
  alignItems: 'center',
};

const dotStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  transition: 'background 0.3s',
};

const skipHintStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.65rem',
  color: '#5b7290',
  letterSpacing: '0.05em',
};
