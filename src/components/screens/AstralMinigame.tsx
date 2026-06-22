import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { drawAstralCast, consolidateCast, HOUSES } from '../../data/astromancy';
import CelestialCast from './CelestialCast';
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

  // Physics faces passed to CelestialCast
  const [facesA, setFacesA] = useState<AstralCast | null>(null);
  const [facesB, setFacesB] = useState<AstralCast | null>(null);

  // Raw settled casts from physics
  const [castA, setCastA] = useState<AstralCast | null>(null);
  const [castB, setCastB] = useState<AstralCast | null>(null);

  // Results displayed / committed
  const [localResult, setLocalResult] = useState<AstralResult | null>(null);
  const [choiceResults, setChoiceResults] = useState<[AstralResult, AstralResult] | null>(null);

  const committedRef = useRef(false);
  // Tracks whether the recast was already used (so second settle auto-commits viaReroll)
  const recastUsedRef = useRef(false);

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

  const handleCast = useCallback(() => {
    const p = engine.planAstralCast();
    setPlan(p);
    recastUsedRef.current = false;

    // For single/favored/clouded: use staged cast as face-A if available (debug only)
    const useStaged = !!stagedCast && p.mode !== 'choice';

    if (p.mode === 'single') {
      setFacesA(useStaged ? stagedCast! : drawAstralCast(state.affinities));
      setFacesB(null);
    } else {
      setFacesA(useStaged ? stagedCast! : drawAstralCast(state.affinities));
      setFacesB(drawAstralCast(state.affinities));
    }
    setPhase('casting');
  }, [engine, state.affinities, stagedCast]);

  // CelestialCast A settled
  const handleSettledA = useCallback((cast: AstralCast) => {
    setCastA(cast);
    if (!plan) return;
    if (plan.mode === 'single') {
      const result = consolidateCast(cast);
      setLocalResult(result);
      // single: if offerRecast and haven't recast yet → offer; else auto-commit
      if (plan.offerRecast && !recastUsedRef.current) {
        setPhase('recast-offer');
      } else {
        setPhase('settled');
      }
    } else {
      // Need B to settle first
      setPhase('settle-b');
    }
  }, [plan]);

  // CelestialCast B settled
  const handleSettledB = useCallback((cast: AstralCast) => {
    setCastB(cast);
    setPhase('both-settled');
  }, []);

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
    setCastA(null);
    setCastB(null);
    setLocalResult(null);
    const a = drawAstralCast(state.affinities);
    setFacesA(a);
    if (plan.mode !== 'single') {
      setFacesB(drawAstralCast(state.affinities));
    }
    setPhase('casting');
  }, [plan, state.affinities]);

  // Choice: player picks one of the two readings (Will)
  const handlePickChoice = useCallback((index: 0 | 1) => {
    if (!choiceResults) return;
    const picked = choiceResults[index];
    setPhase('done');
    setTimeout(() => commit(picked, { viaReroll: true }), REVEAL_DELAY_MS);
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

        {/* Idle: tap-to-cast button */}
        {isIdle && (
          <motion.button
            style={castButtonStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleCast}
          >
            <span style={castGlyphStyle}>✦</span>
            <span style={tapHintStyle}>Tap to cast</span>
          </motion.button>
        )}

        {/* Casting: one or two CelestialCast boards */}
        {isCasting && facesA && (
          <motion.div
            style={castRowStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <CelestialCast
              affinities={state.affinities}
              faces={facesA}
              onSettled={handleSettledA}
            />
            {facesB && (
              <CelestialCast
                affinities={state.affinities}
                faces={facesB}
                onSettled={handleSettledB}
              />
            )}
          </motion.div>
        )}

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
            {veiled && !committedRef.current ? (
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

const castButtonStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  background: '#0d1220',
  border: '2px solid #d4a854',
  borderRadius: '50%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
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

const castRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'flex-start',
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
