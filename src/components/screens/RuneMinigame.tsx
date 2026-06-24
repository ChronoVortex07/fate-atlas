import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { resolveScatter, consolidateScatter, RUNES } from '../../data/runes';
import RuneSigil from '../cards/RuneSigil';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import RunicBand from '../shared/RunicBand';
import { CLOTH_RINGS, CLOTH_SPECKLE, CLOTH_RADIUS_SCALE } from './runic/cloth';
import { toPixel, aimFrom, tumble, throwTransition } from './runic/scatter';
import type { RuneScatter, RuneResult } from '../../engine/types';
import type { RuneCastMode } from '../../engine/runes';

const CLOTH_PX = 300;
const STONE = 40;
const REVEAL_DELAY_MS = 1500;
const SETTLE_MS = 1150;

type Phase = 'idle' | 'aiming' | 'casting' | 'reading' | 'claim' | 'recast-offer' | 'done';
interface Plan { mode: RuneCastMode; drift: number; offerRecast: boolean; sources: string[]; }

const OMEN_LABEL: Record<string, string> = {
  bindrune: 'Bindrune', 'merkstave-cascade': 'Merkstave Cascade', 'true-cast': 'True Cast',
  'silent-field': 'Silent Field', 'errant-rune': 'Errant Rune',
};

export default function RuneMinigame() {
  const { state, engine } = useGameEngine();

  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [scatter, setScatter] = useState<RuneScatter | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  const clothRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const committedRef = useRef(false);
  const recastUsedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const veiled = state.affinityEffects.poolPreview === 'hidden';

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  useEffect(() => () => clearTimer(), []);

  // Debug: a forced rune scenario stages the target scatter in the last slot.
  const isRuneScenario = state.debugConfig.forced.some((id) => id.startsWith('rune-'));
  const stagedScatter: RuneScatter | null =
    isRuneScenario && state.turnResults.length > 0
      ? (() => { const last = state.turnResults[state.turnResults.length - 1]; return last && last.type === 'rune' ? last.scatter : null; })()
      : null;

  const commit = useCallback((result: RuneResult, meta: { revealedAsDrawn?: boolean; viaReroll?: boolean }) => {
    if (committedRef.current) return;
    committedRef.current = true;
    setPhase('done');
    engine.completeMinigame(result, meta);
  }, [engine]);

  // Throw the stones: plan the cast, resolve the fall, place governing per mode.
  const cast = useCallback((aim: { angle: number; power: number } | undefined) => {
    const p = plan ?? { mode: 'single' as RuneCastMode, drift: 0, offerRecast: false, sources: [] };
    const useStaged = stagedScatter && !recastUsedRef.current;
    const s = useStaged
      ? stagedScatter!
      : resolveScatter({ affinities: state.affinities, aim, drift: p.drift, reveal: p.mode === 'favored' });
    if (!useStaged) s.governingIndex = engine.resolveGoverning(s, p.mode);
    setScatter(s);
    setPhase('casting');
    clearTimer();
    timerRef.current = setTimeout(() => setPhase('reading'), SETTLE_MS);
  }, [plan, stagedScatter, state.affinities, engine]);

  // ── Aim gesture (pointer = mouse + touch) ──
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== 'idle') return;
    const pln = engine.planRuneCast();
    setPlan(pln);
    recastUsedRef.current = false;
    committedRef.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0 });
    setPhase('aiming');
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [phase, engine]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (phase !== 'aiming' || !dragStart.current) return;
    setDrag({ dx: e.clientX - dragStart.current.x, dy: e.clientY - dragStart.current.y });
  }, [phase]);

  const handlePointerUp = useCallback(() => {
    if (phase !== 'aiming') return;
    const d = drag ?? { dx: 0, dy: 0 };
    const aim = aimFrom(d.dx, d.dy, CLOTH_PX * 0.6);
    setDrag(null);
    dragStart.current = null;
    cast(aim);
  }, [phase, drag, cast]);

  // ── Reading → agency beat ──
  useEffect(() => {
    if (phase !== 'reading' || !scatter || !plan) return;
    if (plan.mode === 'claim') { setPhase('claim'); return; }
    if (plan.offerRecast && !recastUsedRef.current) { setPhase('recast-offer'); return; }
    clearTimer();
    timerRef.current = setTimeout(() => {
      const meta = recastUsedRef.current ? { viaReroll: true } : { revealedAsDrawn: true };
      commit(consolidateScatter(scatter), meta);
    }, REVEAL_DELAY_MS);
  }, [phase, scatter, plan, commit]);

  // ── Claim (Will): pick a face-up stone as governing ──
  const handleClaim = useCallback((index: number) => {
    if (!scatter) return;
    const s: RuneScatter = { ...scatter, governingIndex: index };
    setScatter(s);
    commit(consolidateScatter(s), { viaReroll: true });
  }, [scatter, commit]);

  // ── Turn (Will): flip the merkstave governing upright ──
  const handleTurn = useCallback(() => {
    if (!scatter) return;
    const stones = scatter.stones.map((st, i) =>
      i === scatter.governingIndex
        ? { ...st, orientation: (st.orientation === 'merkstave' ? 'upright' : 'merkstave') as RuneResult['orientation'] }
        : st);
    setScatter({ ...scatter, stones });
  }, [scatter]);

  const handleKeep = useCallback(() => {
    if (!scatter) return;
    commit(consolidateScatter(scatter), { revealedAsDrawn: true });
  }, [scatter, commit]);

  const handleRecast = useCallback(() => {
    recastUsedRef.current = true;
    committedRef.current = false;
    setScatter(null);
    cast(undefined);
  }, [cast]);

  // ── Display: prefer committed slot so responder mutations show ──
  const committedSlot = state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const liveResult = scatter ? consolidateScatter(scatter) : null;
  const result: RuneResult | null =
    (committedSlot && committedSlot.type === 'rune' ? committedSlot : null) ?? liveResult;

  const govStone = scatter ? scatter.stones[scatter.governingIndex] : null;
  const showStones = phase === 'casting' || phase === 'reading' || phase === 'claim' || phase === 'recast-offer' || phase === 'done';
  const showResult = result && (phase === 'reading' || phase === 'claim' || phase === 'recast-offer' || phase === 'done');
  const omenBadge = result?.scatter.omens.find((o) => OMEN_LABEL[o]);

  const heading =
    phase === 'idle' ? 'Take up the lots'
    : phase === 'aiming' ? 'Loose the cast…'
    : phase === 'done' ? 'The lots have spoken'
    : 'The staves are cast';

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>{heading}</h1>
        <OrnamentalBorder width="120px" />
        {plan && plan.sources.length > 0 && phase !== 'idle' && (
          <p style={modeLabelStyle}>{plan.sources[0]}</p>
        )}
        <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />

        {/* The casting cloth */}
        <div
          ref={clothRef}
          style={clothStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Concentric rings + speckle */}
          <svg viewBox="-1 -1 2 2" width={CLOTH_PX} height={CLOTH_PX} style={ringSvgStyle} aria-hidden>
            {CLOTH_RINGS.map((ring) => (
              <circle key={ring.key} cx={0} cy={0} r={ring.radius * CLOTH_RADIUS_SCALE}
                fill="none" stroke={ring.color} strokeWidth={0.006}
                opacity={ring.key === 'heart' ? 0.7 : 0.4} />
            ))}
            <circle cx={0} cy={0} r={CLOTH_RINGS[0].radius * CLOTH_RADIUS_SCALE} fill="#d4a854" opacity={0.06} />
            {CLOTH_SPECKLE.map((s, i) => (
              <circle key={i} cx={s.x * CLOTH_RADIUS_SCALE} cy={s.y * CLOTH_RADIUS_SCALE} r={s.r * 0.012}
                fill={s.gold ? '#d4a854' : '#7b9ec7'} opacity={s.o} />
            ))}
          </svg>

          {/* Aim trajectory preview */}
          {phase === 'aiming' && drag && (
            <svg width={CLOTH_PX} height={CLOTH_PX} style={ringSvgStyle} aria-hidden>
              {(() => {
                const aim = aimFrom(drag.dx, drag.dy, CLOTH_PX * 0.6);
                const cx = CLOTH_PX / 2, cy = CLOTH_PX * 0.86;
                const tx = CLOTH_PX / 2 + Math.cos(aim.angle) * aim.power * CLOTH_PX * 0.4;
                const ty = CLOTH_PX / 2 + Math.sin(aim.angle) * aim.power * CLOTH_PX * 0.4;
                return (
                  <>
                    <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="#d4a854" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
                    <circle cx={tx} cy={ty} r={6 + aim.power * 14} fill="none" stroke="#d4a854" strokeWidth={1} opacity={0.6} />
                  </>
                );
              })()}
            </svg>
          )}

          {/* Stones */}
          {showStones && scatter && scatter.stones.map((stone, i) => {
            const pos = toPixel(stone, CLOTH_PX);
            const isGov = i === scatter.governingIndex;
            const claimable = phase === 'claim' && stone.faceUp;
            return (
              <motion.div
                key={`${stone.rune}-${i}`}
                style={{
                  position: 'absolute', left: pos.left, top: pos.top, translateX: '-50%', translateY: '-50%',
                  cursor: claimable ? 'pointer' : 'default', zIndex: isGov ? 5 : 1,
                }}
                initial={{ opacity: 0, left: CLOTH_PX / 2, top: CLOTH_PX * 0.86, scale: 0.4 }}
                animate={{ opacity: stone.faceUp ? 1 : 0.7, left: pos.left, top: pos.top, scale: isGov ? 1.1 : 1, ...tumble(i, stone.faceUp && stone.orientation === 'merkstave') }}
                transition={throwTransition(i)}
                whileHover={claimable ? { scale: 1.18 } : undefined}
                onClick={() => claimable && handleClaim(i)}
              >
                <RuneSigil rune={stone.rune} orientation={stone.orientation} silent={!stone.faceUp} size={STONE} glow={isGov} />
              </motion.div>
            );
          })}

          {/* Idle / aiming hint overlay */}
          {(phase === 'idle' || phase === 'aiming') && (
            <div style={bagStyle}>
              <motion.div animate={{ scale: phase === 'idle' ? [1, 1.06, 1] : 1 }} transition={{ duration: 2, repeat: Infinity }} style={bagGlyphStyle}>ᚱ</motion.div>
              <span style={bagHintStyle}>{phase === 'idle' ? 'Pull back & loose' : 'Release to cast'}</span>
            </div>
          )}
        </div>

        <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />

        {/* Reading */}
        <AnimatePresence mode="wait">
          {showResult && result && (
            <motion.div key={result.id} style={resultStyle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <RuneSigil rune={result.rune} orientation={result.orientation} size={56} glow />
              <div style={resultNameStyle}>{result.name}</div>
              <div style={ringLabelStyle}>in the {result.ring[0].toUpperCase() + result.ring.slice(1)}</div>
              {veiled && phase !== 'done' ? (
                <p style={interpStyle}>The stones rest, their meaning veiled…</p>
              ) : (
                <>
                  {omenBadge && <span style={omenBadgeStyle}>{OMEN_LABEL[omenBadge].toUpperCase()}</span>}
                  <p style={interpStyle}>{RUNES[result.rune][result.orientation === 'upright' ? 'meaningUpright' : 'meaningReversed']}</p>
                </>
              )}

              {/* Claim (Will): turn the merkstave governing */}
              {phase === 'claim' && (
                <div style={agencyRowStyle}>
                  {govStone && RUNES[govStone.rune].reversible && (
                    <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleTurn}>
                      ↻ Turn the stave
                    </motion.button>
                  )}
                  <span style={claimHintStyle}>Tap a face-up stave to claim it</span>
                </div>
              )}

              {/* Re-cast offer (Will-stirring) */}
              {phase === 'recast-offer' && (
                <div style={agencyRowStyle}>
                  <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleRecast}>↺ Re-cast</motion.button>
                  <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleKeep}>Keep it</motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Styles ──
const containerStyle: React.CSSProperties = { width: '100%', maxWidth: '560px', padding: '1.5rem' };
const contentStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem' };
const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.4rem, 4vw, 1.9rem)',
  color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};
const modeLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7', fontStyle: 'italic', textAlign: 'center', margin: 0,
};
const clothStyle: React.CSSProperties = {
  position: 'relative', width: CLOTH_PX, height: CLOTH_PX, borderRadius: '14px',
  touchAction: 'none', userSelect: 'none', overflow: 'hidden',
  background:
    'radial-gradient(70% 70% at 50% 35%, rgba(42,21,69,0.35), rgba(7,11,20,0.85)),' +
    'radial-gradient(120% 90% at 50% 100%, rgba(15,31,61,0.4), transparent 70%),' +
    '#070b14',
  border: '1px solid #1a2440',
  boxShadow: 'inset 0 0 40px rgba(8,13,24,0.9), 0 0 22px rgba(212,168,84,0.12)',
};
const ringSvgStyle: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const bagStyle: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: '0.3rem', pointerEvents: 'none',
};
const bagGlyphStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#d4a854', lineHeight: 1,
  textShadow: '0 0 12px rgba(212,168,84,0.5)',
};
const bagHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.62rem',
  letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b7290',
};
const resultStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' };
const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)',
  color: '#c8d8f0', letterSpacing: '0.06em',
};
const ringLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.72rem', color: '#7b9ec7', letterSpacing: '0.05em',
};
const omenBadgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem', border: '1px solid #d4a854', borderRadius: '3px', color: '#d4a854',
};
const interpStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)',
  color: '#7b9ec7', fontStyle: 'italic', lineHeight: 1.5, margin: '0.2rem 0 0', maxWidth: '360px',
};
const agencyRowStyle: React.CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.4rem' };
const actionBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440', padding: '0.45rem 1.1rem',
  borderRadius: '4px', cursor: 'pointer', outline: 'none',
};
const claimHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.7rem', color: '#5b7290', letterSpacing: '0.05em',
};
