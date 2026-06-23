import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { drawHexagramCast, consolidateHexagram } from '../../data/iching';
import HexagramPillar from '../cards/HexagramPillar';
import CoinCast from '../cards/CoinCast';
import type { HexagramCast, IChingResult } from '../../engine/types';

type HexagramMode = 'willed' | 'fated' | 'unaligned';

type Phase =
  | 'idle'
  | 'casting'          // tossing line-by-line
  | 'primary-revealed' // show the primary hexagram
  | 'transforming'     // ink-bleed morph primary→relating
  | 'resolve'          // present the agency beat (willed/fated/unaligned)
  | 'done';            // committed

const LINE_LABELS = ['1st (base)', '2nd', '3rd', '4th', '5th', '6th (top)'];
const TRANSFORM_MS = 1500;
const FATED_BEAT_MS = 1600;
const REVEAL_BEAT_MS = 1400;

export default function IChingMinigame() {
  const { state, engine } = useGameEngine();

  const [phase, setPhase] = useState<Phase>('idle');
  const [cast, setCast] = useState<HexagramCast | null>(null);
  const [lineIndex, setLineIndex] = useState(0);     // which line is currently being tossed (0..5)
  const [tossing, setTossing] = useState(false);     // a CoinCast is in flight
  const [result, setResult] = useState<IChingResult | null>(null); // transformed (working) result
  const [plan, setPlan] = useState<{ mode: HexagramMode; offerRecast: boolean } | null>(null);

  const committedRef = useRef(false);
  const recastUsedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const veiled = state.affinityEffects.poolPreview === 'hidden';

  // ── Single commit chokepoint ──────────────────────────────────────────────
  const commit = useCallback(
    (governing: IChingResult, meta: { reversed?: boolean; revealedAsDrawn?: boolean; viaReroll?: boolean }) => {
      if (committedRef.current) return;
      committedRef.current = true;
      setPhase('done');
      engine.completeMinigame(governing, meta);
    },
    [engine],
  );

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  // ── idle → casting: draw the full cast once ───────────────────────────────
  const handleBeginCast = useCallback(() => {
    const drawn = drawHexagramCast(state.affinities);
    setCast(drawn);
    setLineIndex(0);
    setTossing(false);
    setPhase('casting');
  }, [state.affinities]);

  // ── casting: player taps to toss the next line ────────────────────────────
  const handleToss = useCallback(() => {
    if (tossing) return;
    setTossing(true);
  }, [tossing]);

  // CoinCast settled the current line → paint it, advance to next or finish.
  const handleLineSettled = useCallback(() => {
    setTossing(false);
    setLineIndex((prev) => prev + 1);
  }, []);

  // ── after all six lines settle: run the transform, reveal primary ─────────
  useEffect(() => {
    if (phase !== 'casting' || !cast || lineIndex < 6) return;
    // Always run the transform (chaos-line-cascade can add a line even at 0).
    const transformed = engine.runHexagramTransform(consolidateHexagram(cast, 'relating'));
    const workingCast = transformed.cast ?? cast;
    setCast(workingCast);
    setResult(transformed);
    setPlan(engine.planHexagramCast(workingCast.changingLines.length > 0));
    setPhase('primary-revealed');
  }, [phase, cast, lineIndex, engine]);

  // ── primary-revealed → transforming (if changing lines) → resolve ─────────
  useEffect(() => {
    if (phase !== 'primary-revealed' || !cast) return;
    const hasChanges = cast.changingLines.length > 0;
    timerRef.current = setTimeout(() => {
      setPhase(hasChanges ? 'transforming' : 'resolve');
    }, REVEAL_BEAT_MS);
    return clearTimer;
  }, [phase, cast]);

  useEffect(() => {
    if (phase !== 'transforming') return;
    timerRef.current = setTimeout(() => setPhase('resolve'), TRANSFORM_MS);
    return clearTimer;
  }, [phase]);

  // ── resolve: enact the agency beat per plan.mode ──────────────────────────
  useEffect(() => {
    if (phase !== 'resolve' || !cast || !result || !plan) return;

    if (plan.mode === 'fated') {
      timerRef.current = setTimeout(() => {
        commit(consolidateHexagram(cast, 'relating'), { revealedAsDrawn: true });
      }, FATED_BEAT_MS);
      return clearTimer;
    }

    if (plan.mode === 'unaligned' && !plan.offerRecast) {
      // No agency, no recast (e.g. no changing lines) — auto-keep the governing form.
      timerRef.current = setTimeout(() => {
        const governing = cast.changingLines.length > 0 ? 'relating' : 'primary';
        commit(consolidateHexagram(cast, governing), { revealedAsDrawn: true });
      }, FATED_BEAT_MS);
      return clearTimer;
    }

    if (plan.mode === 'unaligned' && plan.offerRecast && recastUsedRef.current) {
      // A recast was already spent — a second settle just commits.
      timerRef.current = setTimeout(() => {
        commit(consolidateHexagram(cast, 'relating'), { viaReroll: true });
      }, FATED_BEAT_MS);
      return clearTimer;
    }
    // willed, or unaligned+offerRecast (first time): render buttons, no timer.
  }, [phase, cast, result, plan, commit]);

  // ── button handlers ───────────────────────────────────────────────────────
  const handleAcceptChange = useCallback(() => {
    if (!cast) return;
    commit(consolidateHexagram(cast, 'relating'), { reversed: true });
  }, [cast, commit]);

  const handleHoldMoment = useCallback(() => {
    if (!cast) return;
    commit(consolidateHexagram(cast, 'primary'), { revealedAsDrawn: true });
  }, [cast, commit]);

  const handleKeep = useCallback(() => {
    if (!cast) return;
    const meta = recastUsedRef.current ? { viaReroll: true } : { revealedAsDrawn: true };
    commit(consolidateHexagram(cast, 'relating'), meta);
  }, [cast, commit]);

  const handleRecast = useCallback(() => {
    recastUsedRef.current = true;
    clearTimer();
    const drawn = drawHexagramCast(state.affinities);
    setCast(drawn);
    setResult(null);
    setPlan(null);
    setLineIndex(0);
    setTossing(false);
    setPhase('casting');
  }, [state.affinities]);

  // ── display: prefer the committed slot so responder mutations show ────────
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const committedIChing =
    committedSlot && committedSlot.type === 'iching' ? committedSlot : null;

  // The hexagram identity to show. The 'primary-revealed' beat shows the PRIMARY
  // hexagram on its own; once the change resolves (transforming onward) the
  // governing hexagram — relating when there are changes, else primary — is shown.
  // After commit, the slot's own hexagram is authoritative (it reflects the
  // player's Accept/Hold choice and any responder mutation).
  const displayGoverning: 'primary' | 'relating' =
    cast && cast.changingLines.length > 0 && phase !== 'primary-revealed' ? 'relating' : 'primary';

  const primaryHex = cast ? consolidateHexagram(cast, 'primary') : null;
  const displayHex: IChingResult | null =
    committedIChing ?? (cast ? consolidateHexagram(cast, displayGoverning) : null) ?? result;

  // Which hexagram drives the silk-banner flavor (governing one).
  const mandateFlavor = (() => {
    if (!displayHex) return null;
    const v = displayHex.dimensions.volatility;
    if (v > 0.001) return 'The weave quickens — change feeds change.';
    if (v < -0.001) return 'The weave settles — what moves, slows.';
    return 'The weave holds even.';
  })();

  const heading =
    phase === 'idle'
      ? 'Cast the coins'
      : phase === 'casting'
      ? `Casting line ${Math.min(lineIndex + 1, 6)} of 6`
      : phase === 'done'
      ? 'The hexagram is sealed'
      : 'The hexagram forms';

  // Lines to paint on the pillar while building (partial during casting).
  const builtLines = cast ? cast.lines.slice(0, phase === 'casting' ? lineIndex : 6) : [];
  const pillarPhase =
    phase === 'casting'
      ? 'building'
      : phase === 'transforming'
      ? 'transforming'
      : phase === 'resolve' || phase === 'done'
      ? cast && cast.changingLines.length > 0
        ? 'relating'
        : 'primary'
      : 'primary';

  const showCoinButton = phase === 'casting' && !tossing && lineIndex < 6;
  const isWilled = phase === 'resolve' && plan?.mode === 'willed';
  const isRecastOffer =
    phase === 'resolve' && plan?.mode === 'unaligned' && plan.offerRecast && !recastUsedRef.current;
  const isFatedBanner = phase === 'resolve' && plan?.mode === 'fated';

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>{heading}</h1>

        {/* Idle: invite to cast */}
        {phase === 'idle' && (
          <motion.button
            style={beginButtonStyle}
            whileHover={{ scale: 1.05, borderColor: '#5b8c5a', boxShadow: '0 0 22px rgba(91,140,90,0.25)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBeginCast}
          >
            <span style={beginGlyphStyle}>☯</span>
            <span style={beginLabelStyle}>Tap to begin the casting</span>
          </motion.button>
        )}

        {/* Pillar (building / formed / morphing) */}
        {phase !== 'idle' && cast && (
          <HexagramPillar
            lines={builtLines.length ? builtLines : cast.lines.slice(0, lineIndex)}
            changingLines={phase === 'casting' ? [] : cast.changingLines}
            phase={pillarPhase as 'building' | 'primary' | 'transforming' | 'relating'}
          />
        )}

        {/* Casting controls */}
        {phase === 'casting' && cast && (
          <div style={castAreaStyle}>
            {tossing && (
              <CoinCast
                key={lineIndex}
                value={cast.lines[lineIndex]}
                index={lineIndex}
                onSettled={handleLineSettled}
              />
            )}
            {showCoinButton && (
              <motion.button
                style={tossButtonStyle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToss}
              >
                Toss the {LINE_LABELS[lineIndex]} line
              </motion.button>
            )}
          </div>
        )}

        {/* Hexagram identity + judgment (revealed onward) */}
        <AnimatePresence mode="wait">
          {phase !== 'idle' && phase !== 'casting' && displayHex && (
            <motion.div
              key={`${displayHex.hexagramNumber}-${phase === 'done' ? 'd' : 'p'}`}
              style={hexBlockStyle}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div style={symbolStyle}>{displayHex.symbol}</div>
              <div style={nameStyle}>{displayHex.name}</div>
              <div style={numberStyle}>Hexagram #{displayHex.hexagramNumber}</div>

              {/* Primary→relating transformation note */}
              {phase === 'transforming' && primaryHex && (
                <div style={morphNoteStyle}>
                  {primaryHex.symbol} {primaryHex.name} → {displayHex.symbol} {displayHex.name}
                </div>
              )}

              <p style={judgmentStyle}>{displayHex.judgment}</p>

              {/* Changing-lines list — withheld when veiled. */}
              {!veiled && displayHex.changingLines.length > 0 && (
                <div style={changingLinesStyle}>
                  Changing lines: {displayHex.changingLines.join(', ')}
                </div>
              )}
              {veiled && phase !== 'done' && (
                <div style={veiledNoteStyle}>The lines stir, their meaning veiled…</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agency beat: willed */}
        {isWilled && (
          <motion.div
            style={agencyStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p style={agencyFlavorStyle}>The change is yours to take or to hold.</p>
            <div style={buttonRowStyle}>
              <motion.button
                style={primaryActionStyle}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleAcceptChange}
              >
                Accept the Change
              </motion.button>
              <motion.button
                style={secondaryActionStyle}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleHoldMoment}
              >
                Hold the Moment
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Agency beat: unaligned recast offer */}
        {isRecastOffer && (
          <motion.div
            style={agencyStyle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p style={agencyFlavorStyle}>The reading is unsettled. Cast anew, or keep it?</p>
            <div style={buttonRowStyle}>
              <motion.button
                style={primaryActionStyle}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleRecast}
              >
                ↺ Re-cast
              </motion.button>
              <motion.button
                style={secondaryActionStyle}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleKeep}
              >
                Keep it
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Fated banner */}
        {isFatedBanner && (
          <motion.p
            style={fatedBannerStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            The weave decides — you are carried to where the change leads.
          </motion.p>
        )}

        {/* Mandate silk-banner (cosmetic flavor, no numbers) */}
        {phase === 'done' && mandateFlavor && (
          <motion.div
            style={silkBannerStyle}
            initial={{ opacity: 0, scaleX: 0.7 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {mandateFlavor}
          </motion.div>
        )}

        {/* Casting progress dots */}
        {(phase === 'idle' || phase === 'casting') && (
          <div style={progressStyle}>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                style={{
                  ...progressDotStyle,
                  background: i < lineIndex ? '#5b8c5a' : '#1a2440',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.25rem',
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

const beginButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '1.6rem 2rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '10px',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const beginGlyphStyle: React.CSSProperties = {
  fontSize: '2.4rem',
  color: '#d4a854',
  lineHeight: 1,
};

const beginLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const castAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
  minHeight: '64px',
  justifyContent: 'center',
};

const tossButtonStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.95rem',
  letterSpacing: '0.06em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #d4a854',
  padding: '0.55rem 1.4rem',
  borderRadius: '6px',
  cursor: 'pointer',
  outline: 'none',
};

const hexBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.4rem',
  textAlign: 'center',
};

const symbolStyle: React.CSSProperties = {
  fontSize: '3rem',
  color: '#d4a854',
  lineHeight: 1,
};

const nameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const numberStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.8rem',
  color: '#5b8c5a',
};

const morphNoteStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.78rem',
  color: '#7b9ec7',
  letterSpacing: '0.04em',
};

const judgmentStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.85rem, 1.6vw, 1rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  lineHeight: 1.5,
  margin: '0.4rem 0 0',
  maxWidth: '380px',
};

const changingLinesStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.75rem',
  color: '#d4a854',
  marginTop: '0.25rem',
};

const veiledNoteStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontStyle: 'italic',
  fontSize: '0.85rem',
  color: '#5b7290',
  marginTop: '0.25rem',
};

const agencyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.7rem',
};

const agencyFlavorStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontStyle: 'italic',
  fontSize: '0.9rem',
  color: '#7b9ec7',
  margin: 0,
  textAlign: 'center',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.7rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const primaryActionStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.9rem',
  letterSpacing: '0.06em',
  color: '#0d1220',
  background: '#d4a854',
  border: '1px solid #d4a854',
  padding: '0.5rem 1.2rem',
  borderRadius: '5px',
  cursor: 'pointer',
  outline: 'none',
};

const secondaryActionStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.9rem',
  letterSpacing: '0.06em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #5b8c5a',
  padding: '0.5rem 1.2rem',
  borderRadius: '5px',
  cursor: 'pointer',
  outline: 'none',
};

const fatedBannerStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontStyle: 'italic',
  fontSize: '0.95rem',
  color: '#d4a854',
  textAlign: 'center',
  margin: 0,
  maxWidth: '360px',
};

const silkBannerStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontStyle: 'italic',
  fontSize: '0.95rem',
  color: '#c8d8f0',
  letterSpacing: '0.05em',
  textAlign: 'center',
  padding: '0.5rem 1.4rem',
  borderTop: '1px solid rgba(212,168,84,0.3)',
  borderBottom: '1px solid rgba(212,168,84,0.3)',
};

const progressStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const progressDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  transition: 'background 0.3s ease',
};
