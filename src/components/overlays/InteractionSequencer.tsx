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

interface AnimationStep {
  id: string;
  autoAdvanceMs: number; // 0 = requires manual tap
}

interface SlotInfo {
  sourceIndex: number | null;
  targetIndex: number | null;
  effect: string | null;
}

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

function getStepsForEffect(effect: AnimationDescriptor['effect']): AnimationStep[] {
  switch (effect) {
    case 'reroll':
      return [
        { id: 'desc', autoAdvanceMs: 1200 },
        { id: 'source-glint', autoAdvanceMs: 700 },
        { id: 'projectile', autoAdvanceMs: 600 },
        { id: 'rerolling', autoAdvanceMs: 1000 },
        { id: 'reveal', autoAdvanceMs: 0 },
      ];
    case 'flip':
      return [
        { id: 'desc', autoAdvanceMs: 1200 },
        { id: 'source-glint', autoAdvanceMs: 700 },
        { id: 'wave', autoAdvanceMs: 800 },
        { id: 'reveal', autoAdvanceMs: 0 },
      ];
    case 'mirror':
      return [
        { id: 'desc', autoAdvanceMs: 1200 },
        { id: 'source-glint', autoAdvanceMs: 700 },
        { id: 'reflection', autoAdvanceMs: 900 },
        { id: 'reveal', autoAdvanceMs: 0 },
      ];
    case 'add-choice':
      return [
        { id: 'desc', autoAdvanceMs: 1200 },
        { id: 'source-glint', autoAdvanceMs: 700 },
        { id: 'branching', autoAdvanceMs: 900 },
        { id: 'reveal', autoAdvanceMs: 0 },
      ];
    case 'second-result':
      return [
        { id: 'desc', autoAdvanceMs: 1200 },
        { id: 'source-glint', autoAdvanceMs: 700 },
        { id: 'portal', autoAdvanceMs: 800 },
        { id: 'reveal', autoAdvanceMs: 0 },
      ];
  }
}

interface Props {
  onActiveSlotsChange: (slots: SlotInfo) => void;
  onAnimationComplete: () => void;
}

export default function InteractionSequencer({ onActiveSlotsChange, onAnimationComplete }: Props) {
  const { state, engine } = useGameEngine();
  const [currentDescriptor, setCurrentDescriptor] = useState<AnimationDescriptor | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const queue = state.interactionQueue;

  const steps = currentDescriptor ? getStepsForEffect(currentDescriptor.effect) : [];
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;
  const totalSteps = steps.length;

  // When queue changes, start playing the first interaction
  useEffect(() => {
    if (queue.length > 0 && !startedRef.current) {
      startedRef.current = true;
      const desc = eventToDescriptor(queue[0]);
      setCurrentDescriptor(desc);
      setStepIndex(0);
      onActiveSlotsChange({
        sourceIndex: desc.sourceIndex,
        targetIndex: desc.targetIndex,
        effect: desc.effect,
      });
    }

    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [queue.length]);

  // Reset stepIndex when currentDescriptor changes (new interaction starts)
  useEffect(() => {
    if (currentDescriptor) {
      setStepIndex(0);
    }
  }, [currentDescriptor]);

  // Auto-advance timer per step
  useEffect(() => {
    if (!currentStep || currentStep.autoAdvanceMs <= 0) return;

    stepTimerRef.current = setTimeout(() => {
      if (isLastStep) {
        handleComplete();
      } else {
        setStepIndex((i) => i + 1);
      }
    }, currentStep.autoAdvanceMs);

    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [stepIndex, currentDescriptor]);

  // Update activeSlots based on current step
  useEffect(() => {
    if (!currentDescriptor || !currentStep) return;

    const desc = currentDescriptor;
    const stepId = currentStep.id;

    // Source highlighted during desc, source-glint, and effect-specific steps
    const highlightSource = ['desc', 'source-glint', 'projectile', 'wave', 'reflection', 'branching', 'portal'].includes(stepId);
    // Target highlighted during rerolling and reveal steps
    const highlightTarget = ['rerolling', 'reveal'].includes(stepId);
    // Obscure (placeholder) target during rerolling
    const effect = stepId === 'rerolling' ? 'reroll' : null;

    onActiveSlotsChange({
      sourceIndex: highlightSource ? desc.sourceIndex : null,
      targetIndex: highlightTarget ? desc.targetIndex : null,
      effect,
    });
  }, [stepIndex, currentDescriptor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  const handleComplete = useCallback(() => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);

    onActiveSlotsChange({ sourceIndex: null, targetIndex: null, effect: null });
    engine.advanceInteractionQueue();
    setCurrentDescriptor(null);
    setStepIndex(0);
    startedRef.current = false;

    // Check actual queue state after advancing to avoid stale closure
    if (engine.getState().interactionQueue.length === 0) {
      onAnimationComplete();
    }
  }, [engine, onActiveSlotsChange, onAnimationComplete]);

  const handleTap = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      setStepIndex((i) => i + 1);
    }
  }, [isLastStep, handleComplete]);

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

        {/* Description banner — always visible */}
        <motion.div
          style={bannerStyle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div style={bannerLabelStyle}>{label}</div>
          <div style={bannerDescStyle}>{currentDescriptor.description}</div>
          {currentStep && (
            <div style={stepIndicatorStyle}>
              Step {stepIndex + 1} of {totalSteps}
            </div>
          )}
        </motion.div>

        {/* Per-effect animation */}
        {currentDescriptor.effect === 'reroll' && (
          <RerollAnimation descriptor={currentDescriptor} step={currentStep?.id ?? 'desc'} />
        )}
        {currentDescriptor.effect === 'flip' && (
          <FlipAnimation descriptor={currentDescriptor} step={currentStep?.id ?? 'desc'} />
        )}
        {currentDescriptor.effect === 'mirror' && (
          <MirrorAnimation descriptor={currentDescriptor} step={currentStep?.id ?? 'desc'} />
        )}
        {currentDescriptor.effect === 'add-choice' && (
          <AddChoiceAnimation descriptor={currentDescriptor} step={currentStep?.id ?? 'desc'} />
        )}
        {currentDescriptor.effect === 'second-result' && (
          <SecondResultAnimation descriptor={currentDescriptor} step={currentStep?.id ?? 'desc'} />
        )}

        {/* Tap hint */}
        <motion.div
          style={tapHintStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          {isLastStep ? 'Tap to complete' : 'Tap to continue'}
        </motion.div>
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

const stepIndicatorStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.6rem',
  color: '#5b7290',
  letterSpacing: '0.08em',
  marginTop: '0.5rem',
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
