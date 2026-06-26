import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import CardSpread from '../cards/CardSpread';
import WillSwapButton from './WillSwapButton';
import EventBanner, { type BannerMessage } from '../overlays/EventBanner';
import type { MethodCardVisual, MethodCardMotion } from '../cards/MethodCard';

// Local lifecycle of one draw: deal the cards face-down, auto-play any draw
// effects (widen/thin/shroud) with the banner, flip them up, become ready for a
// pick, then ascend the chosen card. (Fate overlay / shrouded reveal: Task 12.)
type Phase = 'dealing' | 'effects' | 'flip' | 'ready' | 'selecting';

const DEAL_MS = 650;
const EFFECT_MS = 1300;

export default function MethodSelect() {
  const { state, engine } = useGameEngine();
  const nonce = state.drawPhase?.nonce ?? 0;
  const pending = state.drawPhase?.pendingSelection ?? null;
  const reports = state.drawPhase?.effectReports ?? [];

  const [phase, setPhase] = useState<Phase>('dealing');
  const [effectIndex, setEffectIndex] = useState(-1); // -1 = no active effect
  const confirmedRef = useRef(false);

  // Deal, then auto-play each draw effect, then flip.
  useEffect(() => {
    confirmedRef.current = false;
    setEffectIndex(-1);
    setPhase('dealing');
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      if (reports.length === 0) {
        setPhase('flip');
        timers.push(setTimeout(() => setPhase('ready'), 450));
      } else {
        setPhase('effects');
        setEffectIndex(0);
      }
    }, DEAL_MS));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Advance through effects, one per EFFECT_MS, then flip.
  useEffect(() => {
    if (phase !== 'effects') return;
    if (effectIndex < 0) return;
    if (effectIndex >= reports.length) {
      setPhase('flip');
      const t = setTimeout(() => setPhase('ready'), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setEffectIndex((n) => n + 1), EFFECT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, effectIndex]);

  // When a selection is staged, ascend the chosen card, then confirm.
  useEffect(() => {
    if (!pending) return;
    setPhase('selecting');
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    const t = setTimeout(() => engine.confirmSelection(), 600);
    return () => clearTimeout(t);
  }, [pending, engine]);

  // A shroud report targeting `i` has already been sequenced this effects pass.
  const hasShroudPlayed = (i: number): boolean => {
    if (phase !== 'effects') return phase === 'flip' || phase === 'ready' || phase === 'selecting';
    for (let r = 0; r <= effectIndex && r < reports.length; r++) {
      if (reports[r].animation === 'shroud' && reports[r].targetSlot === i) return true;
    }
    return false;
  };

  const visualFor = (i: number): MethodCardVisual => {
    if (phase === 'dealing' || phase === 'effects') {
      // During effects the spread is still face-down; a shroud lands as the veil.
      return state.shroudedMethods.includes(i) && hasShroudPlayed(i) ? 'shrouded' : 'face-down';
    }
    return state.shroudedMethods.includes(i) ? 'shrouded' : 'face-up';
  };

  const activeReport = phase === 'effects' && effectIndex >= 0 && effectIndex < reports.length
    ? reports[effectIndex] : null;

  const bannerMessage: BannerMessage | null = activeReport
    ? { text: activeReport.description, affinity: labelToAffinity(activeReport.label) }
    : null;

  const effectTarget = activeReport?.targetSlot ?? null;

  const motionFor = (i: number): MethodCardMotion => {
    if (pending) {
      if (i === pending.finalIndex) return pending.wasForced ? 'fated' : 'selected';
      if (i === pending.chosenIndex && pending.wasForced) return 'rejected';
      return 'idle';
    }
    if (effectTarget === i) return 'selected'; // brief emphasis as the effect plays
    return 'idle';
  };

  const interactive = phase === 'ready';

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <EventBanner message={bannerMessage} />
      <div style={contentStyle}>
        <h1 style={headingStyle}>Choose your divination</h1>
        <p style={subtitleStyle}>
          {state.minigamesCompleted > 0
            ? `Reading ${state.minigamesCompleted + 1} of 3 — draw your next method`
            : 'The stars deal their cards — draw one to reveal your fate'}
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

        <CardSpread
          methods={state.availableMethods}
          visualFor={visualFor}
          motionFor={motionFor}
          interactive={interactive}
          onPick={(i) => engine.beginSelection(i)}
        />

        {state.affinityEffects.spreadRedraws >= 1 && (
          <WillSwapButton onSwap={() => engine.swapMethod()} disabled={!interactive} />
        )}
      </div>
    </motion.div>
  );
}

function labelToAffinity(label: string): BannerMessage['affinity'] {
  const k = label.toLowerCase();
  if (k === 'will' || k === 'fate' || k === 'shadow' || k === 'light' || k === 'chaos' || k === 'order') {
    return k as BannerMessage['affinity'];
  }
  return undefined;
}

const containerStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'min(760px, 96vw)', padding: '1.5rem 0.5rem',
  // Card sizing custom properties consumed by MethodCard.
  ['--card-w' as string]: 'clamp(86px, 22vw, 120px)',
  ['--card-h' as string]: 'calc(var(--card-w) * 1.5)',
};

const contentStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)', color: '#7b9ec7', letterSpacing: '0.05em', margin: 0, textAlign: 'center',
};

const goldRuleStyle: React.CSSProperties = {
  width: '40px', height: '2px', background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
};

const turnProgressStyle: React.CSSProperties = { display: 'flex', gap: '10px' };

const progressDotStyle: React.CSSProperties = {
  width: '10px', height: '10px', borderRadius: '50%',
  transition: 'background 0.4s ease, box-shadow 0.4s ease',
};
