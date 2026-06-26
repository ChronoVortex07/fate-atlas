import { useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import StringSigil from '../cards/StringSigil';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import { CONCEPTS } from '../../data/strings';
import { nodePixel, nodeById } from './weave/board';
import { fogHoles, FOG_CLOUD } from './weave/fog';
import { threadPath, filament } from './weave/thread';
import type { StringsMinigameState } from '../../engine/types';

const BOARD = 320;

export default function StringsMinigame() {
  const { state, engine } = useGameEngine();
  const uid = useId();
  const mg = state.minigameState;
  if (!mg || mg.method !== 'strings') return null;
  const w = mg as StringsMinigameState;

  const byId = nodeById(w.graph);
  const px = (id: string) => nodePixel(byId.get(id)!, BOARD);
  const conceptOf = (id: string) => CONCEPTS[byId.get(id)!.conceptId];

  const visitedPts = w.visitedPath.map(px);
  const activePt = px(w.activeId);
  const candPts = w.candidateIds.map(px);
  const holes = fogHoles([...visitedPts, ...candPts]);
  const arrived = w.phase === 'arrived';
  const destDef = arrived ? conceptOf(w.activeId) : null;

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>{arrived ? 'The thread reaches its end' : 'Draw the thread'}</h1>
        <OrnamentalBorder width="120px" />
        {w.plan.sources.length > 0 && <p style={modeLabelStyle}>{w.plan.sources[0]}</p>}

        <div style={boardStyle}>
          <svg width={BOARD} height={BOARD} viewBox={`0 0 ${BOARD} ${BOARD}`} style={svgStyle} aria-hidden>
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
                <rect x="0" y="0" width={BOARD} height={BOARD} fill="#fff" />
                <g filter={`url(#${uid}-soft)`} fill="#000">
                  {holes.map((h, i) => <ellipse key={i} cx={h.cx} cy={h.cy} rx={h.r} ry={h.r} />)}
                </g>
              </mask>
            </defs>

            {[0.46, 0.31, 0.16].map((rr, i) => (
              <circle key={i} cx={BOARD / 2} cy={BOARD / 2} r={rr * BOARD} fill="none" stroke="#1b2342" strokeWidth="1" opacity="0.7" />
            ))}

            <g stroke="#7d2233" strokeWidth="1" fill="none" opacity="0.5">
              {w.graph.edges.map((e, i) => {
                const a = px(e.from), b = px(e.to);
                return <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} />;
              })}
            </g>

            <g mask={`url(#${uid}-fog)`}>
              <rect x="0" y="0" width={BOARD} height={BOARD} fill="#06040d" opacity="0.88" />
              <motion.rect x="-40" y="-40" width={BOARD + 80} height={BOARD + 80} filter={`url(#${uid}-cloud)`}
                animate={{ x: [-40, -26, -48, -40], y: [-40, -52, -30, -40] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
            </g>

            {holes.map((h, i) => <ellipse key={i} cx={h.cx} cy={h.cy} rx={h.r * 1.1} ry={h.r * 1.1} fill={`url(#${uid}-halo)`} />)}

            <g filter={`url(#${uid}-glow)`}>
              <path d={threadPath(visitedPts)} stroke="#ef4f67" strokeWidth="2.8" fill="none" />
              <path d={threadPath(visitedPts)} stroke="#ffb0bd" strokeWidth="0.9" fill="none" opacity="0.85" />
            </g>

            {!arrived && candPts.map((p, i) => (
              <path key={i} d={filament(activePt, p)} stroke="#c06072" strokeWidth="1.3" fill="none" opacity="0.8" strokeDasharray="3 2" />
            ))}

            {!arrived && (
              <motion.circle cx={activePt.left} cy={activePt.top} r={9} fill="none" stroke="#ff7d92" strokeWidth="2"
                animate={{ r: [9, 46], opacity: [0.5, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }} />
            )}
          </svg>

          {/* look-ahead silhouettes + veiled candidates */}
          {w.lookAheadIds.map((id) => <div key={id} style={nodeBoxStyle(px(id))}><StringSigil glyph="" state="lookahead" size={22} /></div>)}
          {w.veiledCandidateIds.map((id) => <div key={id} style={nodeBoxStyle(px(id))}><StringSigil glyph="" state="veiled" size={28} /></div>)}

          {/* pickable candidates */}
          {!arrived && w.candidateIds.map((id) => {
            const def = conceptOf(id);
            const full = w.foresightId === id || w.plan.clarity === 'laid-bare';
            const silhouette = w.plan.clarity === 'silhouette' && w.foresightId !== id;
            return (
              <button key={id} type="button" style={nodeBtnStyle(px(id))} onClick={() => engine.stepTo(id)} aria-label="candidate star">
                <StringSigil glyph={silhouette ? '·' : def.glyph} state="candidate" />
                <span style={moodStyle}>{full ? def.name : (silhouette ? '' : def.mood)}</span>
                {w.plan.foresight && w.foresightId !== id && !silhouette && (
                  <span style={eyeStyle} role="button" aria-label="foresight" onClick={(e) => { e.stopPropagation(); engine.useForesight(id); }}>◉</span>
                )}
              </button>
            );
          })}

          {/* visited + origin */}
          {w.visitedPath.map((id, i) => (
            <div key={id} style={nodeBoxStyle(px(id))}>
              <StringSigil glyph={conceptOf(id).glyph} state={i === 0 ? 'origin' : 'lit'} size={i === 0 ? 38 : 34} />
            </div>
          ))}
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
            <motion.div key={destDef.id} style={resultStyle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <StringSigil glyph={destDef.glyph} state="lit" size={52} />
              <div style={resultNameStyle}>{destDef.name}</div>
              <p style={interpStyle}>{destDef.meaning}</p>
              <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.commitWeave()}>Read the weave →</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = { width: '100%', maxWidth: '560px', padding: '1.5rem' };
const contentStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem' };
const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.4rem, 4vw, 1.9rem)',
  color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};
const modeLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#d98a98', fontStyle: 'italic', textAlign: 'center', margin: 0,
};
const boardStyle: React.CSSProperties = {
  position: 'relative', width: BOARD, height: BOARD, borderRadius: '14px', overflow: 'hidden',
  background: 'radial-gradient(120% 95% at 44% 46%, #0c0a18 0%, #030206 86%)', border: '1px solid #1a2440',
};
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
