import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { InteractionEvent } from '../../engine/types';
import RerollAnimation from './InteractionAnimations/RerollAnimation';
import FlipAnimation from './InteractionAnimations/FlipAnimation';
import MirrorAnimation from './InteractionAnimations/MirrorAnimation';
import AddChoiceAnimation from './InteractionAnimations/AddChoiceAnimation';
import SecondResultAnimation from './InteractionAnimations/SecondResultAnimation';

interface AnimationDescriptor {
  effect: 'reroll' | 'flip' | 'mirror' | 'add-choice' | 'second-result';
  sourceIndex: number | null;
  targetIndex: number | null;
  description: string;
}

export type { AnimationDescriptor };

const EFFECT_LABELS: Record<string, string> = {
  reroll: "Fool's Reroll",
  flip: 'Critical Flip',
  mirror: 'The Mirror',
  'add-choice': 'I Ching Boost',
  'second-result': 'Chaos Surge',
};

function eventToDescriptor(event: InteractionEvent): AnimationDescriptor {
  return {
    effect: event.effect as AnimationDescriptor['effect'],
    sourceIndex: event.sourceSlotIndex,
    targetIndex: event.targetSlotIndex,
    description: event.description,
  };
}

interface Props {
  onActiveSlotsChange: (slots: { sourceIndex: number | null; targetIndex: number | null }) => void;
  onAnimationComplete: () => void;
}

const AUTO_ADVANCE_MS = 2500; // base auto-advance time per interaction

export default function InteractionSequencer({ onActiveSlotsChange, onAnimationComplete }: Props) {
  const { state, engine } = useGameEngine();
  const [currentDescriptor, setCurrentDescriptor] = useState<AnimationDescriptor | null>(null);
  const [phase, setPhase] = useState<'showing' | 'animating' | 'done'>('showing');
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const queue = state.interactionQueue;

  // When queue changes, start playing the first interaction
  useEffect(() => {
    if (queue.length > 0 && !startedRef.current) {
      startedRef.current = true;
      const desc = eventToDescriptor(queue[0]);
      setCurrentDescriptor(desc);
      setPhase('showing');
      onActiveSlotsChange({ sourceIndex: desc.sourceIndex, targetIndex: desc.targetIndex });

      // Auto-advance from showing to animating
      phaseTimerRef.current = setTimeout(() => {
        setPhase('animating');
      }, 600);

      // Auto-advance to done
      advanceTimerRef.current = setTimeout(() => {
        handleComplete();
      }, AUTO_ADVANCE_MS);
    }

    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [queue.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  const handleComplete = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

    onActiveSlotsChange({ sourceIndex: null, targetIndex: null });
    engine.advanceInteractionQueue();
    setCurrentDescriptor(null);
    setPhase('done');
    startedRef.current = false;

    // Check actual queue state after advancing to avoid stale closure
    if (engine.getState().interactionQueue.length === 0) {
      onAnimationComplete();
    }
  }, [engine, onActiveSlotsChange, onAnimationComplete]);

  const handleTap = useCallback(() => {
    if (phase === 'showing') {
      setPhase('animating');
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      // Reduce remaining auto-advance time
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        handleComplete();
      }, 800);
    } else if (phase === 'animating') {
      handleComplete();
    }
  }, [phase, handleComplete]);

  if (!currentDescriptor || queue.length === 0) return null;

  const label = EFFECT_LABELS[currentDescriptor.effect] ?? currentDescriptor.effect;

  return (
    <AnimatePresence>
      <motion.div
        key={currentDescriptor.effect + '-' + currentDescriptor.sourceIndex + '-' + currentDescriptor.targetIndex}
        style={overlayStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleTap}
      >
        {/* Dimming veil */}
        <motion.div
          style={veilStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Description banner */}
        <motion.div
          style={bannerStyle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: phase === 'showing' ? 1 : 0.6, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div style={bannerLabelStyle}>{label}</div>
          <div style={bannerDescStyle}>{currentDescriptor.description}</div>
        </motion.div>

        {/* Tap hint */}
        {phase === 'showing' && (
          <motion.div
            style={tapHintStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          >
            Tap to continue
          </motion.div>
        )}

        {/* Per-effect animation — only show when not in 'done' phase */}
        {phase !== 'done' && (
          <>
            {currentDescriptor.effect === 'reroll' && (
              <RerollAnimation descriptor={currentDescriptor} phase={phase} />
            )}
            {currentDescriptor.effect === 'flip' && (
              <FlipAnimation descriptor={currentDescriptor} phase={phase} />
            )}
            {currentDescriptor.effect === 'mirror' && (
              <MirrorAnimation descriptor={currentDescriptor} phase={phase} />
            )}
            {currentDescriptor.effect === 'add-choice' && (
              <AddChoiceAnimation descriptor={currentDescriptor} phase={phase} />
            )}
            {currentDescriptor.effect === 'second-result' && (
              <SecondResultAnimation descriptor={currentDescriptor} phase={phase} />
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

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

const tapHintStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.65rem',
  color: '#5b7290',
  letterSpacing: '0.05em',
};
