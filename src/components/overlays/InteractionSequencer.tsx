import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useInteractionFocus } from '../../context/InteractionFocusContext';
import RerollAnimation from './InteractionAnimations/RerollAnimation';
import FlipAnimation from './InteractionAnimations/FlipAnimation';
import MirrorAnimation from './InteractionAnimations/MirrorAnimation';
import AddChoiceAnimation from './InteractionAnimations/AddChoiceAnimation';
import SecondResultAnimation from './InteractionAnimations/SecondResultAnimation';
import ShroudAnimation from './InteractionAnimations/ShroudAnimation';
import WidenAnimation from './InteractionAnimations/WidenAnimation';
import OverrideAnimation from './InteractionAnimations/OverrideAnimation';
import ThinAnimation from './InteractionAnimations/ThinAnimation';
import InterruptAnimation from './InteractionAnimations/InterruptAnimation';
import { useAnchorResolver, constellationKey } from '../../context/AnchorRegistry';
import { primitiveFor, themeFor, anchorKeyFor, expandSlotFor, type Primitive } from './anim/theme';
import type { PrimitiveProps } from './anim/AnchoredStage';
import SpawnPrimitive from './anim/primitives/SpawnPrimitive';
import RerollPrimitive from './anim/primitives/RerollPrimitive';
import VeilPrimitive from './anim/primitives/VeilPrimitive';
import FlipPrimitive from './anim/primitives/FlipPrimitive';
import GlowPrimitive from './anim/primitives/GlowPrimitive';
import AmplifyPrimitive from './anim/primitives/AmplifyPrimitive';
import MirrorPrimitive from './anim/primitives/MirrorPrimitive';
import type { EffectReport, SlotResult } from '../../engine/types';

// Primitives migrated to anchored rendering. Anything not here still plays its
// legacy centered animation, so the app stays fully working mid-rollout.
const ANCHORED: Partial<Record<Primitive, React.FC<PrimitiveProps>>> = {
  spawn: SpawnPrimitive,
  reroll: RerollPrimitive,
  veil: VeilPrimitive,
  flip: FlipPrimitive,
  glow: GlowPrimitive,
  amplify: AmplifyPrimitive,
  mirror: MirrorPrimitive,
};

// Per-animation on-screen durations (ms). Animations with ripples/delays need
// longer than the old flat 1400 so the reveal lands after the motion settles.
const DURATION: Record<string, number> = {
  reroll: 2600,
  'second-result': 2400,
  flip: 1800,
  mirror: 1800,
  override: 1800,
  shroud: 1600,
  widen: 1500,
  thin: 1500,
  interrupt: 2000,
  'add-choice': 1800,
};
const DEFAULT_DURATION = 1400;

// Hold while the fan expands, scrolls to the triggering card, and it glows
// before a hand-involved effect's animation plays.
const FOCUS_BEAT = 750;

export default function InteractionSequencer() {
  const { state, engine } = useGameEngine();
  const { setFocus } = useInteractionFocus();
  const { resolve } = useAnchorResolver();
  const [i, setI] = useState(0);
  // Starts hidden ('focusing') so the effect decides per report whether to run a
  // focus beat (hand-involved) or go straight to the animation (field-only).
  const [localPhase, setLocalPhase] = useState<'focusing' | 'animating'>('focusing');

  const queue = state.eventQueue;

  useEffect(() => {
    if (queue.length === 0) return;
    if (i >= queue.length) {
      setFocus(null, null);
      engine.finishEventBatch();
      setI(0);
      return;
    }
    const report = queue[Math.min(i, queue.length - 1)];
    // Run the focus beat only when the animation plays on a fan card (so the fan
    // expands and the card is large/centered). Outcome-anchored effects skip it,
    // so the fan never expands to occlude the card they target.
    const hasHand = expandSlotFor(report) !== null;
    let inner: ReturnType<typeof setTimeout> | undefined;
    let outer: ReturnType<typeof setTimeout>;
    if (hasHand) {
      setLocalPhase('focusing');
      setFocus(report, 'focusing');
      outer = setTimeout(() => {
        setLocalPhase('animating');
        setFocus(report, 'animating');
        const ms = DURATION[report.animation] ?? DEFAULT_DURATION;
        inner = setTimeout(() => setI((n) => n + 1), ms);
      }, FOCUS_BEAT);
    } else {
      setLocalPhase('animating');
      setFocus(report, 'animating');
      const ms = DURATION[report.animation] ?? DEFAULT_DURATION;
      outer = setTimeout(() => setI((n) => n + 1), ms);
    }
    return () => {
      clearTimeout(outer);
      if (inner) clearTimeout(inner);
    };
  }, [i, queue.length, engine, setFocus]);

  const skip = useCallback(() => {
    setFocus(null, null);
    engine.finishEventBatch();
    setI(0);
  }, [engine, setFocus]);

  if (queue.length === 0) return null;
  // During the focus beat the sequencer shows nothing — the glowing hand card is
  // the focal point. The centered animation appears once we reach 'animating'.
  if (localPhase === 'focusing') return null;

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
          {renderAnimation(report, resolve, state.turnResults)}
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

function renderAnimation(
  report: EffectReport,
  resolve: (key: string) => DOMRect | null,
  turnResults: SlotResult[],
) {
  // Migrated effects play ON the real card via an anchored primitive.
  const primitive = primitiveFor(report.animation);
  const Anchored = ANCHORED[primitive];
  if (Anchored) {
    const rect = resolve(anchorKeyFor(report));
    const theme = themeFor(report, turnResults);
    const durationMs = DURATION[report.animation] ?? DEFAULT_DURATION;
    // Mirror reflects between two cards: resolve the source card's rect too.
    const sourceRect =
      primitive === 'mirror' && typeof report.sourceSlot === 'number'
        ? resolve(constellationKey(report.sourceSlot))
        : undefined;
    return <Anchored rect={rect} theme={theme} durationMs={durationMs} sourceRect={sourceRect} />;
  }

  // Legacy centered animations (not yet migrated).
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
    case 'thin':
      return <ThinAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
    case 'interrupt':
      return <InterruptAnimation description={props.description} sourceSlot={props.sourceSlot} targetSlot={props.targetSlot} />;
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
