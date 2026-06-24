import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { consolidateCast, HOUSES } from '../../data/astromancy';
import CelestialCast, { type CelestialCastHandle } from './CelestialCast';
import AstralSigil from '../cards/AstralSigil';
import type { AstralCast, AstralResult } from '../../engine/types';
import type { AstralCastMode } from '../../engine/astral';

// Reveal beat before committing — mirrors DiceMinigame's REVEAL_DELAY_MS.
const REVEAL_DELAY_MS = 1400;

export default function AstralMinigame() {
  const { state, engine } = useGameEngine();

  // Phase tracks where in the flow we are
  const [phase, setPhase] = useState<
    'idle' | 'casting' | 'settle-b' | 'both-settled' | 'settled' | 'choose' | 'recast-offer' | 'done'
  >('idle');

  const [plan, setPlan] = useState<{ mode: AstralCastMode; offerRecast: boolean; sources: string[] } | null>(null);

  const castRef = useRef<CelestialCastHandle | null>(null);
  const castIndexRef = useRef<0 | 1>(0);

  // Raw settled casts from physics
  const [castA, setCastA] = useState<AstralCast | null>(null);
  const [castB, setCastB] = useState<AstralCast | null>(null);

  // Results displayed / committed
  const [localResult, setLocalResult] = useState<AstralResult | null>(null);
  const [choiceResults, setChoiceResults] = useState<[AstralResult, AstralResult] | null>(null);

  const committedRef = useRef(false);
  // Tracks whether the recast was already used (so second settle auto-commits viaReroll)
  const recastUsedRef = useRef(false);
  // Timer ref for the choice-path commit delay — cleared on unmount to avoid stale calls
  const choiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const veiled = state.affinityEffects.poolPreview === 'hidden';

  // Debug: if an astral scenario is staged, its committed slot holds the target cast.
  // Use it as facesA on the first (pre-recast) cast so responders fire on the staged planet/sign.
  const debugConfig = state.debugConfig;
  const isAstralScenario = debugConfig.forced.some(id => id.startsWith('astral-'));
  const stagedCast: AstralCast | null =
    isAstralScenario && state.turnResults.length > 0
      ? (() => {
          const last = state.turnResults[state.turnResults.length - 1];
          return last && last.type === 'astral' ? last.cast : null;
        })()
      : null;

  const commit = useCallback((result: AstralResult, meta: { revealedAsDrawn?: boolean; viaReroll?: boolean }) => {
    if (committedRef.current) return;
    committedRef.current = true;
    engine.completeMinigame(result, meta);
  }, [engine]);

  // Roll cast N. Cast 0 always; cast 1 only for two-cast modes. Debug target
  // applies to the first (pre-recast) cast when an astral scenario is staged.
  const rollCast = useCallback((index: 0 | 1) => {
    castIndexRef.current = index;
    const useStaged = !!stagedCast && index === 0 && !recastUsedRef.current;
    castRef.current?.roll(useStaged ? stagedCast! : null);
  }, [stagedCast]);

  const handleCast = useCallback(() => {
    const p = engine.planAstralCast();
    setPlan(p);
    recastUsedRef.current = false;
    setCastA(null); setCastB(null); setLocalResult(null);
    setPhase('casting');
    rollCast(0);
  }, [engine, rollCast]);

  // Unified settle handler — the scene calls this once per roll.
  const handleCastSettled = useCallback((cast: AstralCast) => {
    if (!plan) return;
    if (castIndexRef.current === 0) {
      setCastA(cast);
      if (plan.mode === 'single') {
        const result = consolidateCast(cast);
        setLocalResult(result);
        setPhase(plan.offerRecast && !recastUsedRef.current ? 'recast-offer' : 'settled');
      } else {
        setPhase('settle-b');
        rollCast(1);
      }
    } else {
      setCastB(cast);
      setPhase('both-settled');
    }
  }, [plan, rollCast]);

  // Both settled → resolve favored/clouded or enter choice
  useEffect(() => {
    if (phase !== 'both-settled' || !plan || !castA || !castB) return;

    if (plan.mode === 'choice') {
      setChoiceResults([consolidateCast(castA), consolidateCast(castB)]);
      setPhase('choose');
    } else {
      // favored or clouded: engine auto-picks
      const { chosen } = engine.resolveCastSelection([castA, castB], plan.mode);
      const result = consolidateCast(chosen);
      setLocalResult(result);
      if (plan.offerRecast && !recastUsedRef.current) {
        setPhase('recast-offer');
      } else {
        setPhase('settled');
      }
    }
  }, [phase, plan, castA, castB, engine]);

  // Auto-commit once 'settled' (no recast pending)
  useEffect(() => {
    if (phase !== 'settled' || !localResult) return;
    // Determine meta: viaReroll if this was a recast, else revealedAsDrawn
    const meta = recastUsedRef.current ? { viaReroll: true } : { revealedAsDrawn: true };
    const timer = setTimeout(() => {
      commit(localResult, meta);
      setPhase('done');
    }, REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, localResult, commit]);

  // Keep: accept current result (Fate)
  const handleKeep = useCallback(() => {
    if (!localResult) return;
    setPhase('done');
    commit(localResult, { revealedAsDrawn: true });
  }, [localResult, commit]);

  // Re-cast: discard and throw again (Will)
  const handleRecast = useCallback(() => {
    if (!plan) return;
    recastUsedRef.current = true;
    committedRef.current = false;
    setCastA(null); setCastB(null); setLocalResult(null);
    setPhase('casting');
    rollCast(0);
  }, [plan, rollCast]);

  // Cleanup choice-path commit timer on unmount
  useEffect(() => {
    return () => {
      if (choiceTimerRef.current !== null) clearTimeout(choiceTimerRef.current);
    };
  }, []);

  // Choice: player picks one of the two readings (Will)
  const handlePickChoice = useCallback((index: 0 | 1) => {
    if (!choiceResults) return;
    const picked = choiceResults[index];
    setPhase('done');
    choiceTimerRef.current = setTimeout(() => commit(picked, { viaReroll: true }), REVEAL_DELAY_MS);
  }, [choiceResults, commit]);

  // After commit, prefer the engine's slot so responder mutations (e.g. dignity flip) show.
  const committedSlot = state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayResult: AstralResult | null =
    (committedSlot && committedSlot.type === 'astral' ? committedSlot : null) ?? localResult;

  // Derived booleans for rendering
  const isIdle = phase === 'idle';
  const isCasting = phase === 'casting' || phase === 'settle-b' || phase === 'both-settled';
  const showResult = displayResult !== null && !isCasting && phase !== 'choose';
  const showChoice = phase === 'choose' && choiceResults !== null;
  const showRecastOffer = phase === 'recast-offer' && displayResult !== null;

  const modeLabel =
    plan?.mode === 'favored' ? 'Light favors — the stronger cast holds'
    : plan?.mode === 'clouded' ? 'Shadow clouds — the weaker cast is kept'
    : plan?.mode === 'choice' ? 'Two casts — your will decides'
    : null;

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>
          {isIdle
            ? 'Cast the stars'
            : phase === 'done'
            ? 'The heavens have spoken'
            : 'The stars are cast'}
        </h1>

        {modeLabel && !isIdle && (
          <p style={modeLabelStyle}>{modeLabel}</p>
        )}

        {isCasting && (
          <motion.p
            style={settleHintStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0.7] }}
            transition={{ duration: 1.4, times: [0, 0.6, 1] }}
          >
            Tap the board to settle the stars
          </motion.p>
        )}

        {/* Persistent 3D board — visible from idle through the result */}
        <div style={boardWrapStyle}>
          <CelestialCast
            ref={castRef}
            affinities={state.affinities}
            onSettled={handleCastSettled}
          />
          {isIdle && (
            <motion.button
              style={castOverlayBtnStyle}
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCast}
            >
              <span style={castGlyphStyle}>✦</span>
              <span style={tapHintStyle}>Tap to cast</span>
            </motion.button>
          )}
        </div>

        {/* Single settled result (single / favored / clouded after resolution) */}
        {showResult && displayResult && (
          <motion.div
            style={resultStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <AstralSigil kind="planet" id={displayResult.planet} size={56} />
            <div style={resultNameStyle}>{displayResult.name}</div>
            <div style={houseStyle}>
              in the House of {HOUSES[displayResult.house - 1]?.arena ?? displayResult.house}
            </div>
            {veiled && phase !== 'done' ? (
              <p style={interpretationStyle}>The stars rest, their meaning veiled…</p>
            ) : (
              <motion.div
                style={aspectBlockStyle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span style={aspectBadgeStyle}>{displayResult.aspect.toUpperCase()}</span>
                <p style={interpretationStyle}>{displayResult.interpretation}</p>
              </motion.div>
            )}

            {/* Keep / Re-cast offer (non-choice only, once per cast) */}
            {showRecastOffer && (
              <div style={recastRowStyle}>
                <motion.button
                  style={recastBtnStyle}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleRecast}
                >
                  ↺ Re-cast
                </motion.button>
                <motion.button
                  style={recastBtnStyle}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleKeep}
                >
                  Keep it
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {/* Choice mode: two consolidated readings to pick from */}
        {showChoice && choiceResults && (
          <motion.div
            style={choicePairStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {choiceResults.map((r, i) => (
              <motion.button
                key={i}
                style={choiceCardStyle}
                whileHover={{ scale: 1.03, borderColor: '#d4a854' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handlePickChoice(i as 0 | 1)}
              >
                <AstralSigil kind="planet" id={r.planet} size={40} />
                <div style={resultNameStyle}>{r.name}</div>
                <div style={houseStyle}>
                  in the House of {HOUSES[r.house - 1]?.arena ?? r.house}
                </div>
                {!veiled && (
                  <span style={aspectBadgeStyle}>{r.aspect.toUpperCase()}</span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '860px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.12em',
  margin: 0,
  textAlign: 'center',
};

const modeLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  margin: 0,
};

const settleHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#5b7290',
  textAlign: 'center',
  margin: 0,
};

const boardWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const castOverlayBtnStyle: React.CSSProperties = {
  position: 'absolute',
  width: '120px', height: '120px',
  background: 'rgba(13, 18, 32, 0.72)',
  border: '2px solid #d4a854', borderRadius: '50%',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.5rem', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
};

const castGlyphStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  color: '#d4a854',
  lineHeight: 1,
};

const tapHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.6rem',
  color: '#5b7290',
  letterSpacing: '0.1em',
};

const resultStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
  color: '#c8d8f0',
  letterSpacing: '0.06em',
  textAlign: 'center',
};

const houseStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.75rem',
  color: '#7b9ec7',
  letterSpacing: '0.05em',
  textAlign: 'center',
};

const aspectBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const aspectBadgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.7rem',
  letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  color: '#d4a854',
};

const interpretationStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  margin: 0,
  maxWidth: '340px',
};

const recastRowStyle: React.CSSProperties = {
  display: 'flex', gap: '0.6rem', marginTop: '0.25rem',
};

const recastBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem',
  letterSpacing: '0.08em', color: '#c8d8f0', background: '#0d1220',
  border: '1px solid #1a2440', padding: '0.45rem 1.1rem', borderRadius: '4px',
  cursor: 'pointer', outline: 'none',
};

const choicePairStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.25rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const choiceCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1rem 1.25rem',
  background: '#0d1220',
  border: '2px solid #1a2440',
  borderRadius: '10px',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.2s',
  minWidth: '140px',
};
