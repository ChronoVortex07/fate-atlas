import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import type { DiceResult, MinigameMeta } from '../../engine/types';
import DiceThrowAnimation, { THRESHOLD_COLORS } from './DiceThrowAnimation';

// Beat that lets a thrown die's reveal animation finish before completeMinigame
// transitions the screen. Matches the auto-commit delay so a reroll's replayed
// throw gets the same time on screen as the first one.
const REVEAL_DELAY_MS = 1500;

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const [thrown, setThrown] = useState(false);
  const [localResult, setLocalResult] = useState<DiceResult | null>(null);
  const [offered, setOffered] = useState(false);
  const [chose, setChose] = useState(false);
  const committedRef = useRef(false);
  const veiled = state.affinityEffects.poolPreview === 'hidden';

  const commit = useCallback((result: DiceResult, meta: MinigameMeta) => {
    if (committedRef.current) return;
    committedRef.current = true;
    engine.completeMinigame(result, meta);
  }, [engine]);

  const handleThrow = useCallback(() => {
    setThrown(true);
    setLocalResult(rollD20(state.affinities));
    setOffered(engine.offerReroll()); // Will may offer a reroll
  }, [state.affinities, engine]);

  // Auto-commit (keeping the first roll → Fate) after a beat — unless Will is
  // offering a reroll, in which case we wait for the player's choice.
  useEffect(() => {
    if (!localResult || !thrown || offered) return;
    const timer = setTimeout(() => commit(localResult, { revealedAsDrawn: true }), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [localResult, thrown, offered, commit]);

  const handleKeep = useCallback(() => {
    setChose(true); // hide the offer; the shown die already animated
    if (localResult) commit(localResult, { revealedAsDrawn: true }); // accept → Fate
  }, [localResult, commit]);

  const handleReroll = useCallback(() => {
    const next = rollD20(state.affinities);
    setChose(true);        // hide the offer so it can't fire twice
    setLocalResult(next);  // remounts DiceThrowAnimation (key=value) → replays the throw
    // Let the replayed throw play out before committing, which transitions the
    // screen. Committing immediately cut the animation off (→ result page early).
    // commit() is idempotent (committedRef), so a late fire after unmount is safe.
    setTimeout(() => commit(next, { viaReroll: true }), REVEAL_DELAY_MS); // assert control → Will
  }, [state.affinities, commit]);

  // Once committed, the engine owns this slot — display from it so interaction
  // effects (e.g. Fool's Reroll) are reflected. Before commit, use local roll.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayResult: DiceResult | null =
    committedSlot && committedSlot.type === 'd20' ? committedSlot : localResult;

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>{thrown ? 'The die is cast' : 'Cast the die'}</h1>

        {!thrown ? (
          <motion.button
            style={dieButtonStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleThrow}
          >
            <span style={dieFaceStyle}>{String.fromCodePoint(0x2685)}</span>
            <span style={tapHintStyle}>Tap to throw</span>
          </motion.button>
        ) : (
          displayResult && (
            <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              {/* key on the value so a reroll remounts and replays the throw */}
              <DiceThrowAnimation key={displayResult.result} value={displayResult.result} threshold={displayResult.threshold} />
              {/* Shadow (veiled): the threshold/meaning stays hidden until commit. */}
              {veiled && !committedRef.current ? (
                <p style={interpretationStyle}>The die rests, its meaning shrouded...</p>
              ) : (
                <motion.div style={thresholdStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <span style={{ ...thresholdBadgeStyle, color: THRESHOLD_COLORS[displayResult.threshold], borderColor: THRESHOLD_COLORS[displayResult.threshold] }}>
                    {displayResult.threshold.replace(/-/g, ' ').toUpperCase()}
                  </span>
                  <p style={interpretationStyle}>{displayResult.interpretation}</p>
                </motion.div>
              )}
              {offered && !chose && (
                <div style={rerollRowStyle}>
                  <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleReroll}>
                    ↺ Reroll?
                  </motion.button>
                  <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleKeep}>
                    Keep it
                  </motion.button>
                </div>
              )}
            </motion.div>
          )
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '500px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
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

const dieButtonStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  background: '#0d1220',
  border: '2px solid #c75b4a',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
};

const dieFaceStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  lineHeight: 1,
};

const tapHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.6rem',
  color: '#5b7290',
  letterSpacing: '0.1em',
};

const resultContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
};

const thresholdStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const thresholdBadgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.7rem',
  letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem',
  border: '1px solid',
  borderRadius: '3px',
};

const interpretationStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  margin: 0,
  maxWidth: '300px',
};

const rerollRowStyle: React.CSSProperties = {
  display: 'flex', gap: '0.6rem', marginTop: '0.25rem',
};

const rerollBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem',
  letterSpacing: '0.08em', color: '#c8d8f0', background: '#0d1220',
  border: '1px solid #1a2440', padding: '0.45rem 1.1rem', borderRadius: '4px',
  cursor: 'pointer', outline: 'none',
};
