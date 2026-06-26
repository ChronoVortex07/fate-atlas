import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import CardSpread from '../cards/CardSpread';
import WillSwapButton from './WillSwapButton';
import EventBanner, { type BannerMessage } from '../overlays/EventBanner';
import FateForceOverlay, { type HandTarget } from '../overlays/FateForceOverlay';
import type { MethodCardVisual, MethodCardMotion } from '../cards/MethodCard';
import type { DivinationType } from '../../engine/types';

// Local lifecycle of one draw: deal the cards face-down, auto-play any draw
// effects (widen/thin/shroud) with the banner, flip them up, become ready for a
// pick, then ascend the chosen card.
type Phase = 'dealing' | 'effects' | 'flip' | 'ready' | 'selecting';

// Sub-sequence of a Fate-forced pick: freeze the board, the hand descends and
// presses the chosen card down, it greys out (reject), then the fated card rises.
type ForceStage = 'idle' | 'freeze' | 'press' | 'reject' | 'ascend';

const DEAL_MS = 800;
const EFFECT_MS = 1300;
const DEAL_STAGGER = 0.07; // per-card deal-in delay (seconds)
// Placeholder method for the Fate-thin "closing path" card — dealt face-down and
// dissolved before it is ever revealed, so its method is purely cosmetic.
const PHANTOM_METHOD: DivinationType = 'tarot';

export default function MethodSelect() {
  const { state, engine } = useGameEngine();
  const nonce = state.drawPhase?.nonce ?? 0;
  const pending = state.drawPhase?.pendingSelection ?? null;
  const reports = state.drawPhase?.effectReports ?? [];

  const [phase, setPhase] = useState<Phase>('dealing');
  const [effectIndex, setEffectIndex] = useState(-1); // -1 = no active effect
  const [forceStage, setForceStage] = useState<ForceStage>('idle');
  const [handTarget, setHandTarget] = useState<HandTarget | null>(null);
  const [revealShrouded, setRevealShrouded] = useState(false);
  const confirmedRef = useRef(false);
  const spreadRef = useRef<HTMLDivElement>(null);

  // Deal, then either auto-play the draw effects or go straight to the flip.
  useEffect(() => {
    confirmedRef.current = false;
    setEffectIndex(-1);
    setPhase('dealing');
    const t = setTimeout(() => {
      if (reports.length === 0) {
        setPhase('flip');
      } else {
        setPhase('effects');
        setEffectIndex(0);
      }
    }, DEAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Advance through effects, one per EFFECT_MS, then hand off to the flip.
  useEffect(() => {
    if (phase !== 'effects' || effectIndex < 0) return;
    if (effectIndex >= reports.length) {
      setPhase('flip');
      return;
    }
    const t = setTimeout(() => setEffectIndex((n) => n + 1), EFFECT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, effectIndex]);

  // Flip → ready. Kept in its own [phase] effect so that entering 'flip' (from
  // either the no-effects path or the end of the effects sequence) schedules the
  // ready transition cleanly. Folding this into the effects effect meant
  // setPhase('flip') changed that effect's deps and its cleanup cancelled this
  // very timer before it fired — leaving phase stuck at 'flip' and the cards
  // permanently non-interactive whenever a draw effect played.
  useEffect(() => {
    if (phase !== 'flip') return;
    const t = setTimeout(() => setPhase('ready'), 450);
    return () => clearTimeout(t);
  }, [phase]);

  // When a selection is staged, play the dramatic sequence, then confirm.
  useEffect(() => {
    if (!pending) { setForceStage('idle'); setRevealShrouded(false); return; }
    setPhase('selecting');
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;

    if (pending.wasForced) {
      // The hand of fate: freeze the board, descend onto the chosen card, force
      // it down, grey it out, then let the fated card ascend.
      setForceStage('freeze');
      timers.push(setTimeout(() => setForceStage('press'), (t += 300)));
      timers.push(setTimeout(() => setForceStage('reject'), (t += 900)));
      timers.push(setTimeout(() => setForceStage('ascend'), (t += 550)));
      t += 850; // hold on the ascending fated card before leaving
      timers.push(setTimeout(() => setForceStage('idle'), t));
    } else {
      t += 600; // simple ascend
    }

    // Shrouded reveal: flip the veil to the real front before leaving.
    if (pending.shrouded) {
      timers.push(setTimeout(() => setRevealShrouded(true), t));
      t += 650;
    }

    timers.push(setTimeout(() => engine.confirmSelection(), t));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // ready/selecting: a picked shrouded card un-veils to its real front.
    if (state.shroudedMethods.includes(i)) {
      const isPicked = pending && (i === pending.finalIndex);
      return isPicked && revealShrouded ? 'face-up' : 'shrouded';
    }
    return 'face-up';
  };

  const activeReport = phase === 'effects' && effectIndex >= 0 && effectIndex < reports.length
    ? reports[effectIndex] : null;

  const bannerMessage: BannerMessage | null = activeReport
    ? { text: activeReport.description, affinity: labelToAffinity(activeReport.label) }
    : null;

  const effectTarget = activeReport?.targetSlot ?? null;

  const motionFor = (i: number): MethodCardMotion => {
    if (pending) {
      if (pending.wasForced) {
        // Chosen card: picked → pressed down by the hand → greyed out.
        if (i === pending.chosenIndex) {
          if (forceStage === 'press') return 'pressed';
          if (forceStage === 'reject' || forceStage === 'ascend') return 'rejected';
          return 'selected';
        }
        // Fated card only ascends once the chosen one has been rejected.
        if (i === pending.finalIndex) return forceStage === 'ascend' ? 'fated' : 'idle';
        return 'idle';
      }
      if (i === pending.finalIndex) return 'selected';
      return 'idle';
    }
    if (effectTarget === i) return 'selected'; // brief emphasis as the effect plays
    return 'idle';
  };

  // Deal-in gating. Base cards deal in immediately on each (re)deal; a Will-
  // widened card (the extra one, last index) holds back and deals in when its
  // "another way opens" banner plays during the effects phase.
  const widenReportIndex = reports.findIndex((r) => r.animation === 'widen');
  const widenCardIndex = widenReportIndex >= 0 ? state.availableMethods.length - 1 : -1;

  const appearedFor = (i: number): boolean => {
    if (i === widenCardIndex) {
      if (phase === 'dealing') return false;
      if (phase === 'effects') return effectIndex >= widenReportIndex;
      return true;
    }
    return true;
  };

  const appearDelayFor = (i: number): number => (i === widenCardIndex ? 0 : i * DEAL_STAGGER);

  // Fate-thin removal. The engine already generated the smaller pool, so to show
  // "a path closes" we deal in an extra phantom card at the end and dissolve it
  // into gold motes when the thin banner plays, leaving the real (smaller) pool.
  const thinReportIndex = reports.findIndex((r) => r.animation === 'thin');
  const showPhantom =
    thinReportIndex >= 0 &&
    (phase === 'dealing' || (phase === 'effects' && effectIndex <= thinReportIndex));
  const phantomIndex = showPhantom ? state.availableMethods.length : -1;
  const phantomDissolving = phase === 'effects' && effectIndex === thinReportIndex;

  const displayMethods = showPhantom
    ? [...state.availableMethods, PHANTOM_METHOD]
    : state.availableMethods;

  const dissolvingFor = (i: number): boolean => i === phantomIndex && phantomDissolving;

  const interactive = phase === 'ready';

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <EventBanner message={bannerMessage} />
      {forceStage !== 'idle' && (
        <FateForceOverlay
          text={pending?.forceReport?.description ?? 'Fate has marked another path.'}
          target={handTarget}
          pressed={forceStage === 'press' || forceStage === 'reject'}
        />
      )}
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
          containerRef={spreadRef}
          dealNonce={nonce}
          methods={displayMethods}
          visualFor={visualFor}
          motionFor={motionFor}
          appearedFor={appearedFor}
          appearDelayFor={appearDelayFor}
          dissolvingFor={dissolvingFor}
          phantomIndex={phantomIndex}
          interactive={interactive}
          onPick={(i) => {
            // Measure the picked card now (resting position) so the Fate-force
            // hand can descend onto it.
            const el = spreadRef.current?.children[i] as HTMLElement | undefined;
            if (el) {
              const r = el.getBoundingClientRect();
              setHandTarget({ x: r.left + r.width / 2, topY: r.top });
            }
            engine.beginSelection(i);
          }}
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
