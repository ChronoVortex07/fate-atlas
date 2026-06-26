import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import DiceCast, { canUse3D, type DiceCastHandle, type FlickVector } from './dice3d/DiceCast';
import DiceTally from './dice3d/DiceTally';
import DiceThrowAnimation, { THRESHOLD_COLORS } from './DiceThrowAnimation';
import type { DiceResult, DiceCheckPlan, DiceCheckBreakdown, MinigameMeta, RollMode } from '../../engine/types';

type Phase = 'idle' | 'throwing' | 'choice' | 'tally' | 'reading' | 'done';
type Plan = DiceCheckPlan & { mode: RollMode; offerReroll: boolean };

const REVEAL_DELAY_MS = 1200;

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const use3D = useRef(canUse3D()).current;
  const castRef = useRef<DiceCastHandle | null>(null);
  const committedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [choiceValues, setChoiceValues] = useState<[number, number] | null>(null);
  const [breakdown, setBreakdown] = useState<DiceCheckBreakdown | null>(null);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [chose, setChose] = useState(false);

  const veiled = state.affinityEffects.poolPreview === 'hidden';

  const commit = useCallback((r: DiceResult, meta: MinigameMeta) => {
    if (committedRef.current) return;
    committedRef.current = true;
    engine.completeMinigame(r, meta);
  }, [engine]);

  // After the d20 is resolved, run the check + drop the modifier d4s.
  const resolveAndTally = useCallback((keptD20: number, p: DiceCheckPlan) => {
    const { result: r, breakdown: b } = engine.resolveDiceCheck(keptD20, p);
    setResult(r);
    setBreakdown(b);
    setPhase('tally');
    if (use3D) castRef.current?.rollModifiers(b.bless, b.bane);
  }, [engine, use3D]);

  const onResolved = useCallback((keptD20: number) => {
    if (!plan) return;
    resolveAndTally(keptD20, plan);
  }, [plan, resolveAndTally]);

  const onChoiceReady = useCallback((values: [number, number]) => {
    setChoiceValues(values);
    setPhase('choice');
  }, []);

  // For 3D, modifiers settle then DiceTally plays; for the fallback we skip straight in.
  const onModifiersResolved = useCallback(() => {/* DiceTally drives its own timing */}, []);

  // Invoked by the canvas flick (3D) or the tap button (fallback). `flick` is
  // undefined on the fallback path; the scene randomizes the throw then.
  const handleThrow = useCallback((flick?: FlickVector) => {
    if (phase !== 'idle') return;
    const p = engine.planDiceRoll();
    const checkPlan: DiceCheckPlan = { dc: p.dc, bless: p.bless, bane: p.bane, sources: p.sources };
    setPlan({ ...checkPlan, mode: p.mode, offerReroll: p.offerReroll });
    setPhase('throwing');

    if (p.mode === 'single') {
      const value = rollD20(state.affinities).result;
      if (use3D) castRef.current?.rollCheck([value], 'single', flick);
      else { resolveAndTally(value, checkPlan); }
    } else {
      const { dice } = engine.rollDicePair(p.mode);
      const targets = [dice[0].result, dice[1].result];
      if (use3D) castRef.current?.rollCheck(targets, p.mode, flick);
      else if (p.mode === 'choice') onChoiceReady([targets[0], targets[1]]);
      else {
        const keep = p.mode === 'advantage' ? Math.max(targets[0], targets[1]) : Math.min(targets[0], targets[1]);
        resolveAndTally(keep, checkPlan);
      }
    }
  }, [phase, engine, state.affinities, use3D, resolveAndTally, onChoiceReady]);

  const handlePick = useCallback((index: 0 | 1) => {
    if (!choiceValues || !plan) return;
    setChose(true);
    resolveAndTally(choiceValues[index], plan);
  }, [choiceValues, plan, resolveAndTally]);

  // Tally finished → show the reading, then auto-commit unless a reroll is offered.
  const onTallyDone = useCallback(() => setPhase('reading'), []);

  useEffect(() => {
    if (phase !== 'reading' || !result || !plan) return;
    if (plan.offerReroll && !chose) return; // wait for keep/reroll
    const meta: MinigameMeta = chose ? { viaReroll: true } : { revealedAsDrawn: true };
    const t = setTimeout(() => { commit(result, meta); setPhase('done'); }, REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, result, plan, chose, commit]);

  const handleKeep = useCallback(() => {
    if (result) { setChose(true); commit(result, { revealedAsDrawn: true }); setPhase('done'); }
  }, [result, commit]);

  const handleReroll = useCallback(() => {
    if (!result || !plan) return;
    setChose(true);
    const { result: fresh } = engine.resolveReroll(result); // Fool's reroll may apply
    const keptValue = fresh.result;
    setPhase('throwing');
    // Re-throw a single die; for 3D the scene's onResolved drives the single
    // resolveAndTally. For the fallback, resolve directly (no scene).
    if (use3D) castRef.current?.rollCheck([keptValue], 'single');
    else resolveAndTally(keptValue, plan);
  }, [result, plan, engine, use3D, resolveAndTally]);

  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const display: DiceResult | null =
    (committedSlot && committedSlot.type === 'd20' ? committedSlot : null) ?? result;

  const modeLabel =
    plan?.mode === 'advantage' ? 'Advantage — the higher die holds'
    : plan?.mode === 'disadvantage' ? 'Disadvantage — the lower die holds'
    : plan?.mode === 'choice' ? 'Keep one — your will decides'
    : null;

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>{phase === 'idle' ? 'Cast the die' : phase === 'done' ? 'The die is cast' : 'The check'}</h1>
        {modeLabel && phase !== 'idle' && <p style={interpStyle}>{modeLabel}</p>}
        {plan && plan.sources.length > 0 && phase !== 'idle' && (
          <p style={sourceStyle}>{plan.sources.join(' · ')}</p>
        )}

        {/* 3D board (or fallback reveal) */}
        {use3D ? (
          <div style={{ position: 'relative' }}>
            <DiceCast
              ref={castRef}
              affinities={state.affinities}
              idle={phase === 'idle'}
              onFlick={handleThrow}
              onResolved={onResolved}
              onChoiceReady={onChoiceReady}
              onModifiersResolved={onModifiersResolved}
            />
            {/* Non-interactive hint — the flick is captured on the canvas itself. */}
            {phase === 'idle' && (
              <div style={flickHintStyle}>
                <span style={{ fontSize: '1.6rem' }}>{String.fromCodePoint(0x2685)}</span>
                <span style={tapHintStyle}>Drag back &amp; release to flick</span>
              </div>
            )}
          </div>
        ) : (
          phase === 'idle' ? (
            <motion.button style={throwBtnStyle} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={() => handleThrow()}>
              <span style={{ fontSize: '2rem' }}>{String.fromCodePoint(0x2685)}</span>
              <span style={tapHintStyle}>Tap to throw</span>
            </motion.button>
          ) : display && (
            <DiceThrowAnimation
              key={display.result}
              value={display.result}
              threshold={display.threshold}
              dc={breakdown?.dc}
              total={breakdown?.total}
            />
          )
        )}

        {/* Choice: tap a value (Will) */}
        {phase === 'choice' && choiceValues && (
          <div style={choiceRowStyle}>
            {choiceValues.map((v, i) => (
              <motion.button key={i} style={choiceBtnStyle} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} onClick={() => handlePick(i as 0 | 1)}>
                {v}
              </motion.button>
            ))}
          </div>
        )}

        {/* BG3 tally */}
        {(phase === 'tally' || phase === 'reading') && plan && (
          <DiceTally dc={plan.dc} breakdown={breakdown} veiled={veiled} onDone={onTallyDone} />
        )}

        {/* Reading */}
        {phase === 'reading' && display && (
          <motion.div style={readingStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {veiled && !committedRef.current ? (
              <p style={interpStyle}>The die rests, its meaning shrouded…</p>
            ) : (
              <>
                <span style={{ ...badgeStyle, color: THRESHOLD_COLORS[display.threshold], borderColor: THRESHOLD_COLORS[display.threshold] }}>
                  {(display.check?.critical ?? display.threshold.replace(/-/g, ' ')).toUpperCase()}
                </span>
                <p style={interpStyle}>{display.interpretation}</p>
              </>
            )}
            {plan?.offerReroll && !chose && (
              <div style={rerollRowStyle}>
                <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleReroll}>↺ Reroll?</motion.button>
                <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleKeep}>Keep it</motion.button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = { width: '100%', maxWidth: '560px', padding: '2rem' };
const contentStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' };
const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};
const throwBtnStyle: React.CSSProperties = {
  width: 130, height: 130,
  background: 'rgba(13,18,32,0.72)', border: '2px solid #c75b4a', borderRadius: '14px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.4rem', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', color: '#c8d8f0',
};
// 3D idle overlay hint — non-interactive so the canvas underneath receives the flick.
const flickHintStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, margin: 'auto', width: 200, height: 80,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.4rem', color: '#c8d8f0', pointerEvents: 'none',
};
const tapHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.6rem', color: '#5b7290', letterSpacing: '0.1em',
};
const sourceStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', color: '#7b9ec7', letterSpacing: '0.06em', textAlign: 'center', margin: 0,
};
const choiceRowStyle: React.CSSProperties = { display: 'flex', gap: '1.25rem' };
const choiceBtnStyle: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '12px', background: '#0d1220', border: '2px solid #1a2440',
  color: '#c8d8f0', fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.8rem', cursor: 'pointer', outline: 'none',
};
const readingStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' };
const badgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem', border: '1px solid', borderRadius: '3px',
};
const interpStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7', fontStyle: 'italic', textAlign: 'center', margin: 0, maxWidth: '320px',
};
const rerollRowStyle: React.CSSProperties = { display: 'flex', gap: '0.6rem', marginTop: '0.25rem' };
const rerollBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440', padding: '0.45rem 1.1rem', borderRadius: '4px',
  cursor: 'pointer', outline: 'none',
};
