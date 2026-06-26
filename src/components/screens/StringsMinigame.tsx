import { useId, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import StringSigil from '../cards/StringSigil';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import { CONCEPTS } from '../../data/strings';
import { nodePixel, nodeById, fieldRadius } from './weave/board';
import { fogHoles, FOG_CLOUD } from './weave/fog';
import { threadPath, threadDrawnFraction, filament } from './weave/thread';
import type { StringsMinigameState } from '../../engine/types';

const MAX_BOARD = 460; // desktop cap
const MIN_BOARD = 280; // phone floor
const TRAVEL = 0.55;   // thread node→node draw duration (s)
const REVEAL = 0.5;    // candidate / fog-clear fade-in duration (s)

// Keep the -50%,-50% centering when framer-motion drives an element's transform
// (a bare `scale` animation would otherwise overwrite the static translate).
const centerNode = (_latest: unknown, generated: string) => `translate(-50%, -50%) ${generated}`;

export default function StringsMinigame() {
  const { state, engine } = useGameEngine();
  const uid = useId();
  const reduce = useReducedMotion();

  // The board grows to fill the available width (large on desktop) but is capped
  // so the rim labels keep their margin, and floored so it never overflows a phone.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState(MIN_BOARD + 80);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = (width: number) => setBoard(Math.round(Math.max(MIN_BOARD, Math.min(MAX_BOARD, width))));
    measure(el.clientWidth);
    const ro = new ResizeObserver((entries) => measure(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mg = state.minigameState;
  if (!mg || mg.method !== 'strings') return null;
  const w = mg as StringsMinigameState;

  // While reduced-motion is requested, collapse the travel + reveal beats to 0 so
  // the board updates instantly (no thread crawl, no fog crossfade).
  const travel = reduce ? 0 : TRAVEL;
  const reveal = reduce ? 0 : REVEAL;
  const R = fieldRadius(board);
  const holeR = board * 0.15; // cleared-corridor radius scales with the board

  const byId = nodeById(w.graph);
  const px = (id: string) => nodePixel(byId.get(id)!, board);
  const conceptOf = (id: string) => CONCEPTS[byId.get(id)!.conceptId];

  const visitedPts = w.visitedPath.map(px);
  const activePt = px(w.activeId);
  const candPts = w.candidateIds.map(px);
  const visitedHoles = fogHoles(visitedPts, holeR); // already-cleared corridor (static)
  const candHoles = fogHoles(candPts, holeR);        // clears as the next ring emerges
  const startFraction = threadDrawnFraction(visitedPts); // settled portion before the new leg
  const arrived = w.phase === 'arrived';
  const destDef = arrived ? conceptOf(w.activeId) : null;

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>{arrived ? 'The thread reaches its end' : 'Draw the thread'}</h1>
        <OrnamentalBorder width="120px" />
        {w.plan.sources.length > 0 && <p style={modeLabelStyle}>{w.plan.sources[0]}</p>}

        <div ref={wrapRef} style={boardWrapStyle}>
          <div style={boardStyle(board)}>
            <svg width={board} height={board} viewBox={`0 0 ${board} ${board}`} style={svgStyle} aria-hidden>
              <defs>
                <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff5a72" stopOpacity="0.2" /><stop offset="100%" stopColor="#ff5a72" stopOpacity="0" />
                </radialGradient>
                <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id={`${uid}-cloud`} x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence type="fractalNoise" baseFrequency={FOG_CLOUD.baseFrequency} numOctaves={FOG_CLOUD.numOctaves} seed={FOG_CLOUD.seed} stitchTiles="stitch" result="n" />
                  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.06  0 0 0 0 0.03  0 0 0 0 0.11  0 0 0 1.1 -0.30" />
                </filter>
                <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="10" /></filter>
                <mask id={`${uid}-fog`}>
                  <rect x="0" y="0" width={board} height={board} fill="#fff" />
                  <g filter={`url(#${uid}-soft)`} fill="#000">
                    {visitedHoles.map((h, i) => <ellipse key={`v${i}`} cx={h.cx} cy={h.cy} rx={h.r} ry={h.r} />)}
                    {candHoles.map((h, i) => (
                      <motion.ellipse key={`c-${w.activeId}-${i}`} cx={h.cx} cy={h.cy}
                        initial={{ rx: 0, ry: 0 }} animate={{ rx: h.r, ry: h.r }}
                        transition={{ delay: travel, duration: reveal, ease: 'easeOut' }} />
                    ))}
                  </g>
                </mask>
              </defs>

              {[1, 0.667, 0.333].map((f, i) => (
                <circle key={i} cx={board / 2} cy={board / 2} r={f * R} fill="none" stroke="#1b2342" strokeWidth="1" opacity="0.7" />
              ))}

              <g stroke="#7d2233" strokeWidth="1" fill="none" opacity="0.5">
                {w.graph.edges.map((e, i) => {
                  const a = px(e.from), b = px(e.to);
                  return <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} />;
                })}
              </g>

              <g mask={`url(#${uid}-fog)`}>
                <rect x="0" y="0" width={board} height={board} fill="#06040d" opacity="0.88" />
                <motion.rect x="-40" y="-40" width={board + 80} height={board + 80} filter={`url(#${uid}-cloud)`}
                  animate={reduce ? undefined : { x: [-40, -26, -48, -40], y: [-40, -52, -30, -40] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
              </g>

              {visitedHoles.map((h, i) => <ellipse key={`vh${i}`} cx={h.cx} cy={h.cy} rx={h.r * 1.1} ry={h.r * 1.1} fill={`url(#${uid}-halo)`} />)}
              {candHoles.map((h, i) => (
                <motion.ellipse key={`ch-${w.activeId}-${i}`} cx={h.cx} cy={h.cy} fill={`url(#${uid}-halo)`}
                  initial={{ rx: 0, ry: 0, opacity: 0 }} animate={{ rx: h.r * 1.1, ry: h.r * 1.1, opacity: 1 }}
                  transition={{ delay: travel, duration: reveal, ease: 'easeOut' }} />
              ))}

              {/* the red thread draws its newest leg from the prior pin to the new node */}
              <g filter={`url(#${uid}-glow)`}>
                <motion.path key={`thread-${w.visitedPath.length}`} d={threadPath(visitedPts)} stroke="#ef4f67" strokeWidth="2.8" fill="none"
                  initial={{ pathLength: startFraction }} animate={{ pathLength: 1 }} transition={{ duration: travel, ease: 'easeInOut' }} />
                <motion.path key={`thread-hi-${w.visitedPath.length}`} d={threadPath(visitedPts)} stroke="#ffb0bd" strokeWidth="0.9" fill="none" opacity="0.85"
                  initial={{ pathLength: startFraction }} animate={{ pathLength: 1 }} transition={{ duration: travel, ease: 'easeInOut' }} />
              </g>

              {/* tentative filaments to the candidates, woven in once the thread arrives */}
              {!arrived && candPts.map((p, i) => (
                <motion.path key={`fil-${w.activeId}-${i}`} d={filament(activePt, p)} stroke="#c06072" strokeWidth="1.3" fill="none" strokeDasharray="3 2"
                  initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: travel, duration: reveal }} />
              ))}

              {!arrived && (
                <motion.circle key={`pulse-${w.activeId}`} cx={activePt.left} cy={activePt.top} r={9} fill="none" stroke="#ff7d92" strokeWidth="2"
                  initial={{ opacity: 0 }} animate={{ r: [9, 46], opacity: [0.5, 0] }}
                  transition={{ delay: travel, duration: 2.8, repeat: Infinity, ease: 'easeOut' }} />
              )}
            </svg>

            {/* look-ahead silhouettes + veiled candidates (emerge with the next ring) */}
            {w.lookAheadIds.map((id) => (
              <motion.div key={id} style={nodeBoxStyle(px(id))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: travel, duration: reveal }}>
                <StringSigil glyph="" state="lookahead" size={22} />
              </motion.div>
            ))}
            {w.veiledCandidateIds.map((id) => (
              <motion.div key={id} style={nodeBoxStyle(px(id))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: travel, duration: reveal }}>
                <StringSigil glyph="" state="veiled" size={28} />
              </motion.div>
            ))}

            {/* pickable candidates */}
            {!arrived && w.candidateIds.map((id) => {
              const def = conceptOf(id);
              const full = w.foresightId === id || w.plan.clarity === 'laid-bare';
              const silhouette = w.plan.clarity === 'silhouette' && w.foresightId !== id;
              return (
                <motion.button key={id} type="button" style={nodeBtnStyle(px(id))} onClick={() => engine.stepTo(id)} aria-label="candidate star"
                  initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: travel, duration: reveal }} transformTemplate={centerNode}>
                  <StringSigil glyph={silhouette ? '·' : def.glyph} state="candidate" />
                  <span style={moodStyle}>{full ? def.name : (silhouette ? '' : def.mood)}</span>
                  {w.plan.foresight && w.foresightId !== id && !silhouette && (
                    <span style={eyeStyle} role="button" aria-label="foresight" onClick={(e) => { e.stopPropagation(); engine.useForesight(id); }}>◉</span>
                  )}
                </motion.button>
              );
            })}

            {/* visited + origin (the newest pin lands as the thread arrives) */}
            {w.visitedPath.map((id, i) => {
              const isLatest = i === w.visitedPath.length - 1 && i !== 0;
              return (
                <motion.div key={id} style={nodeBoxStyle(px(id))}
                  initial={isLatest ? { opacity: 0, scale: 0.6 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={isLatest ? { delay: travel, duration: reveal } : { duration: 0 }}
                  transformTemplate={centerNode}>
                  <StringSigil glyph={conceptOf(id).glyph} state={i === 0 ? 'origin' : 'lit'} size={i === 0 ? 38 : 34} />
                </motion.div>
              );
            })}
          </div>
        </div>

        {!arrived && (
          <div style={agencyRowStyle}>
            {w.backtracksRemaining > 0 && w.visitedPath.length > 1 && (
              <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.backtrack()}>↩ Pull the thread back</motion.button>
            )}
            {w.plan.allowRedraw && !w.redrawUsed && (
              <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.redrawCandidates()}>↺ Re-draw the threads</motion.button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {arrived && destDef && (
            <motion.div key={destDef.id} style={resultStyle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: travel, duration: reveal }}>
              <StringSigil glyph={destDef.glyph} state="lit" size={52} />
              <div style={resultNameStyle}>{destDef.name}</div>
              <p style={interpStyle}>{destDef.meaning}</p>
              {!w.committed && (
                <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.commitWeave()}>Read the weave →</motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = { width: '100%', maxWidth: '600px', padding: '1.5rem' };
const contentStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem' };
const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.4rem, 4vw, 1.9rem)',
  color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};
const modeLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#d98a98', fontStyle: 'italic', textAlign: 'center', margin: 0,
};
const boardWrapStyle: React.CSSProperties = { width: '100%', display: 'flex', justifyContent: 'center' };
const boardStyle = (size: number): React.CSSProperties => ({
  position: 'relative', width: size, height: size, borderRadius: '14px', overflow: 'hidden',
  background: 'radial-gradient(120% 95% at 44% 46%, #0c0a18 0%, #030206 86%)', border: '1px solid #1a2440',
});
const svgStyle: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const nodeBoxStyle = (pos: { left: number; top: number }): React.CSSProperties => ({
  position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 2,
});
const nodeBtnStyle = (pos: { left: number; top: number }): React.CSSProperties => ({
  position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, outline: 'none', zIndex: 3,
});
const moodStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.7rem', color: '#d98a98', whiteSpace: 'nowrap',
};
const eyeStyle: React.CSSProperties = { fontSize: '0.6rem', color: '#8fb0dc', cursor: 'pointer', lineHeight: 1 };
const agencyRowStyle: React.CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' };
const actionBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #c33b5e55', padding: '0.45rem 1.1rem',
  borderRadius: '4px', cursor: 'pointer', outline: 'none',
};
const resultStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' };
const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)', color: '#c8d8f0', letterSpacing: '0.06em',
};
const interpStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)',
  color: '#d98a98', fontStyle: 'italic', lineHeight: 1.5, margin: '0.2rem 0 0', maxWidth: '360px',
};
