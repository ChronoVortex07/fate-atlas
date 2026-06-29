import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { shareCard } from '../../utils/shareExport';
import ShareCard from '../share/ShareCard';
import RunicBand from '../shared/RunicBand';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import MysticButton from '../shared/MysticButton';
import HistoryModal from '../overlays/HistoryModal';
import ResultTile from '../cards/ResultTile';
import CardDetailModal from '../overlays/CardDetailModal';
import type { GlitchSegment, SlotResult } from '../../engine/types';

// Corruption treatment → CSS class. The word stays in the DOM and legible (except
// `redact`, which is covered); the styling is what reads as ominous.
const GLITCH_CLASS: Record<string, string> = {
  ca: 'cx-w-ca',
  'ca-fast': 'cx-w-ca cx-w-fast',
  red: 'cx-w-red',
  flick: 'cx-w-flick',
  hot: 'cx-w-hot',
  stut: 'cx-w-stut',
  ghost: 'cx-w-ghost',
  redact: 'cx-w-redact',
};

const COMBINING = ['̵', '̶', '̷', '̸'];
function garbleWord(s: string): string {
  let out = '';
  for (const ch of s) { out += ch; if (/\w/.test(ch) && ch.charCodeAt(0) % 3 === 0) out += COMBINING[ch.charCodeAt(0) % COMBINING.length]; }
  return out;
}
function GlitchText({ segments, swap }: { segments: GlitchSegment[]; swap?: boolean }) {
  let swapN = 0;
  return (
    <>
      {segments.map((s, i) => {
        if (!s.style) return <span key={i}>{s.text}</span>;
        const cls = GLITCH_CLASS[s.style];
        if (swap && (s.style === 'hot' || s.style === 'ca-fast')) {
          const lane = ['a', 'b', 'c'][swapN++ % 3];
          return (
            <span key={i} className={`${cls} cx-swap ${lane}`}>
              <span className="cx-v0">{s.text}</span>
              <span className="cx-v1">{garbleWord(s.text)}</span>
            </span>
          );
        }
        return <span key={i} className={cls}>{s.text}</span>;
      })}
    </>
  );
}

function formatQuestionType(qt: string): string {
  switch (qt) {
    case 'decision': return 'Decision';
    case 'relationship': return 'Relationship';
    case 'future': return 'Future / Forecast';
    case 'self': return 'Self-Analysis';
    default: return qt;
  }
}

export default function ResultReading() {
  const { state, engine } = useGameEngine();
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openResult, setOpenResult] = useState<SlotResult | null>(null);

  const { turnResults, synthesis, synthesisSegments, happening, selectedHappeningChoice, questionType, corruption } = state;

  const corrupted = corruption.band === 'virulent' || corruption.band === 'pinnacle';
  const seg = synthesisSegments;

  const handleDrawAgain = useCallback(() => engine.returnToQuestionSelect(), [engine]);
  const handleShare = useCallback(async () => {
    if (shareCardRef.current) {
      try { await shareCard(shareCardRef.current.firstElementChild as HTMLElement); } catch { /* silent */ }
    }
  }, []);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(engine.generateLLMPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }, [engine]);

  const questionLabel = questionType ? formatQuestionType(questionType) : 'the unknown';

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={corrupted ? { ...cardStyle, position: 'relative', overflow: 'hidden' } : cardStyle} className={corrupted ? 'cx-results' : undefined}>
        {corrupted && <>
          <div className="cx-scan"/>
          <div className="cx-vignette"/>
          <div className="cx-mosh m1"/>
          <div className="cx-mosh m2"/>
          <div className="cx-mosh m3"/>
        </>}
        <RunicBand opacity={0.3} />
        <h1 style={titleStyle}>Your Reading</h1>
        <div style={questionStyle}>{questionLabel}</div>
        {state.affinityEffects.readingDetail > 0 && (
          <div style={{ ...questionStyle, color: '#d4c068' }}>✦ illuminated</div>
        )}
        {state.affinityEffects.readingDetail < 0 && (
          <div style={{ ...questionStyle, color: '#5b6680' }}>☾ eclipsed</div>
        )}
        <OrnamentalBorder margin="0.25rem 0" />

        {/* THE CARDS — compact, tap-to-expand tiles */}
        {turnResults.length > 0 && (
          <div style={cardsBlockStyle}>
            <div style={cardsHeaderStyle}>The Cards · {turnResults.length}</div>
            <div style={tileGridStyle}>
              {turnResults.map((r, i) => (
                <ResultTile key={i} result={r} index={i} corruptionBand={corruption.band} onOpen={() => setOpenResult(r)} />
              ))}
            </div>
          </div>
        )}

        {/* Synthesis */}
        {synthesis && (
          <div style={synthesisHeroStyle}>
            <h2 style={sectionTitleStyle}>Interpretation</h2>
            <h3 style={headlineStyle}>
              {seg ? <GlitchText segments={seg.headline} swap={corrupted} /> : synthesis.headline}
            </h3>
            {seg
              ? seg.paragraphs.map((segs, i) => (
                  <p key={i} style={paraStyle}><GlitchText segments={segs} swap={corrupted} /></p>
                ))
              : synthesis.paragraphs.map((p, i) => (
                  <p key={i} style={paraStyle}>{p}</p>
                ))}
            {(seg?.tensionNote ?? synthesis.tensionNote) && (
              <div style={tensionBoxStyle}>
                <div style={tensionBarStyle} />
                <p style={tensionTextStyle}>
                  {seg?.tensionNote ? <GlitchText segments={seg.tensionNote} swap={corrupted} /> : synthesis.tensionNote}
                </p>
              </div>
            )}
            {(seg?.affinityNote ?? synthesis.affinityNote) && (
              <p style={affinityStyle}>
                {seg?.affinityNote ? <GlitchText segments={seg.affinityNote} /> : synthesis.affinityNote}
              </p>
            )}
          </div>
        )}

        {/* Happening */}
        {happening && selectedHappeningChoice !== null && (
          <div style={happeningSectionStyle}>
            <h2 style={sectionTitleStyle}>The Crossroads</h2>
            <p style={sceneStyle}>{happening.scene}</p>
            <div style={chosenStyle}>
              <span style={chosenLabelStyle}>You chose:</span>
              <span style={chosenTextStyle}>{happening.choices[selectedHappeningChoice]?.text}</span>
            </div>
          </div>
        )}

        <RunicBand opacity={0.2} />

        {/* Actions */}
        <div style={actionsStyle}>
          <MysticButton onClick={handleDrawAgain}>DRAW AGAIN</MysticButton>
          <div style={secondaryRowStyle}>
            <MysticButton variant="secondary" onClick={handleShare}>SHARE AS IMAGE</MysticButton>
            <MysticButton variant="secondary" onClick={() => setHistoryOpen(true)}>HISTORY ({state.history.length})</MysticButton>
          </div>
          <MysticButton variant="secondary" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy LLM Prompt'}</MysticButton>
        </div>
      </div>
      <div ref={shareCardRef} aria-hidden style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <ShareCard state={state} />
      </div>
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
      {openResult && <CardDetailModal result={openResult} onClose={() => setOpenResult(null)} />}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  padding: '1rem',
  maxHeight: '100vh',
  overflowY: 'auto',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '2rem 1.5rem',
  background: '#070a12',
  border: '1px solid #1a2440',
  borderRadius: '8px',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', color: '#c8d8f0',
  letterSpacing: '0.12em', margin: 0,
};

const questionStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 500,
  fontSize: 'clamp(0.8rem, 1.8vw, 0.95rem)', color: '#d4a854',
  fontStyle: 'italic', letterSpacing: '0.08em',
};

const cardsBlockStyle: React.CSSProperties = {
  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
};
const cardsHeaderStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', letterSpacing: '0.26em',
  textTransform: 'uppercase', color: '#5b7290',
};
const tileGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
  gap: '0.55rem', width: '100%',
};
const synthesisHeroStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%',
  background: 'linear-gradient(180deg, rgba(20,28,52,0.45), rgba(13,18,32,0.15))',
  border: '1px solid rgba(40,54,92,0.7)', borderRadius: '8px',
  padding: '1.1rem 1.05rem 1.15rem', boxSizing: 'border-box',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.85rem, 1.8vw, 1rem)', color: '#d4a854',
  letterSpacing: '0.15em', margin: 0,
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(1rem, 2.2vw, 1.3rem)', color: '#c8d8f0',
  letterSpacing: '0.05em', margin: 0, textAlign: 'center',
};

const paraStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: 'clamp(0.78rem, 1.5vw, 0.9rem)', color: '#7b9ec7',
  lineHeight: 1.65, margin: 0, width: '100%',
};

const tensionBoxStyle: React.CSSProperties = {
  position: 'relative', background: '#0d1220', borderRadius: '6px',
  padding: '0.75rem 1rem', width: '100%', boxSizing: 'border-box',
};

const tensionBarStyle: React.CSSProperties = {
  position: 'absolute', left: 0, top: 0, bottom: 0,
  width: '3px', background: '#d4a854', borderRadius: '3px 0 0 3px',
};

const tensionTextStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: '0.8rem', color: '#c8d8f0', fontStyle: 'italic',
  lineHeight: 1.5, margin: 0,
};

const affinityStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
  fontSize: '0.8rem', color: '#7b9ec7', fontStyle: 'italic',
  textAlign: 'center', margin: 0,
};

const happeningSectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.5rem', width: '100%', padding: '0.75rem',
  background: '#0d1220', border: '1px solid #1a2440',
  borderRadius: '6px', boxSizing: 'border-box',
};

const sceneStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
  fontSize: '0.85rem', color: '#7b9ec7', fontStyle: 'italic',
  textAlign: 'center', lineHeight: 1.5, margin: 0,
};

const chosenStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
};

const chosenLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400,
  fontSize: '0.65rem', color: '#d4a854', letterSpacing: '0.1em',
};

const chosenTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.9rem', color: '#c8d8f0', textAlign: 'center',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.6rem',
  alignItems: 'center', marginTop: '0.25rem',
};

const secondaryRowStyle: React.CSSProperties = {
  display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center',
};
