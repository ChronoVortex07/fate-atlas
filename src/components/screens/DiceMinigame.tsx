import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import type { DiceResult, MinigameMeta, RollMode } from '../../engine/types';
import DiceThrowAnimation, { THRESHOLD_COLORS } from './DiceThrowAnimation';

// Beat that lets a thrown die's reveal animation finish before completeMinigame
// transitions the screen. Matches the auto-commit delay so a reroll's replayed
// throw gets the same time on screen as the first one.
const REVEAL_DELAY_MS = 1500;
// Beat the two advantage/disadvantage dice spend on screen before they collapse
// to the kept die.
const MERGE_DELAY_MS = 1300;

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const [thrown, setThrown] = useState(false);
  const [mode, setMode] = useState<RollMode>('single');
  const [pair, setPair] = useState<[DiceResult, DiceResult] | null>(null);
  const [keptIndex, setKeptIndex] = useState<0 | 1 | null>(null);
  const [merged, setMerged] = useState(false);
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
    const plan = engine.planDiceRoll();
    setMode(plan.mode);
    setThrown(true);
    if (plan.mode === 'single') {
      setLocalResult(rollD20(state.affinities));
      setOffered(plan.offerReroll);
    } else {
      const { dice, keptIndex: kept } = engine.rollDicePair(plan.mode);
      setPair(dice);
      setKeptIndex(kept);
      setOffered(plan.offerReroll); // suppressed in choice mode (plan.offerReroll === false)
    }
  }, [engine, state.affinities]);

  // Advantage/disadvantage: after the merge beat, collapse to the kept die and
  // fold into the single-result flow.
  useEffect(() => {
    if (mode !== 'advantage' && mode !== 'disadvantage') return;
    if (!pair || keptIndex === null || merged) return;
    const timer = setTimeout(() => {
      setLocalResult(pair[keptIndex]);
      setMerged(true);
    }, MERGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [mode, pair, keptIndex, merged]);

  // Auto-commit (Fate) once a single result is settled and no reroll is offered.
  // Covers single mode and the merged advantage/disadvantage result.
  useEffect(() => {
    if (!localResult || offered) return;
    if (mode === 'choice') return;
    if ((mode === 'advantage' || mode === 'disadvantage') && !merged) return;
    const timer = setTimeout(() => commit(localResult, { revealedAsDrawn: true }), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [localResult, offered, mode, merged, commit]);

  const handleKeep = useCallback(() => {
    setChose(true);
    if (localResult) commit(localResult, { revealedAsDrawn: true }); // accept → Fate
  }, [localResult, commit]);

  const handleReroll = useCallback(() => {
    if (!localResult) return;
    const { result: next } = engine.resolveReroll(localResult); // Fate may make it hollow
    setChose(true);
    setLocalResult(next);
    setTimeout(() => commit(next, { viaReroll: true }), REVEAL_DELAY_MS); // assert control → Will
  }, [localResult, engine, commit]);

  // Choice mode: the player keeps one of the two dice (Will).
  const handlePick = useCallback((index: 0 | 1) => {
    if (!pair) return;
    setKeptIndex(index);
    setLocalResult(pair[index]);
    setChose(true);
    setTimeout(() => commit(pair[index], { viaReroll: true }), REVEAL_DELAY_MS);
  }, [pair, commit]);

  // Once committed, prefer the engine's slot so interaction effects (e.g. Fool's
  // Reroll) are reflected. Before commit, use the local result.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayResult: DiceResult | null =
    committedSlot && committedSlot.type === 'd20' ? committedSlot : localResult;

  // Two dice are on screen while a pair is unresolved: advantage/disadvantage
  // before the merge beat, or choice before the player picks.
  const showingPair = !!pair && (
    ((mode === 'advantage' || mode === 'disadvantage') && !merged) ||
    (mode === 'choice' && !chose)
  );

  const modeLabel =
    mode === 'advantage' ? 'Advantage — the higher die holds'
    : mode === 'disadvantage' ? 'Disadvantage — the lower die holds'
    : mode === 'choice' ? 'Keep one — your will decides'
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
        ) : showingPair && pair ? (
          <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {modeLabel && <p style={interpretationStyle}>{modeLabel}</p>}
            <div style={pairRowStyle}>
              {pair.map((die, i) => {
                const isHeld = keptIndex === i;
                const interactive = mode === 'choice';
                return (
                  <motion.button
                    key={i}
                    style={{
                      ...pairDieStyle,
                      cursor: interactive ? 'pointer' : 'default',
                      borderColor: isHeld ? THRESHOLD_COLORS[die.threshold] : '#1a2440',
                      opacity: keptIndex !== null && !isHeld ? 0.4 : 1,
                    }}
                    whileHover={interactive ? { scale: 1.05, borderColor: '#c75b4a' } : undefined}
                    whileTap={interactive ? { scale: 0.96 } : undefined}
                    onClick={interactive ? () => handlePick(i as 0 | 1) : undefined}
                    disabled={!interactive}
                  >
                    <DiceThrowAnimation key={die.result} value={die.result} threshold={die.threshold} />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
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

const pairRowStyle: React.CSSProperties = {
  display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center',
};

const pairDieStyle: React.CSSProperties = {
  background: 'transparent', border: '2px solid #1a2440', borderRadius: '12px',
  padding: '0.25rem', outline: 'none', transition: 'border-color 0.3s, opacity 0.4s',
};
