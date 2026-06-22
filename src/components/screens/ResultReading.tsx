import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { shareAsImage } from '../../utils/shareExport';
import RunicBand from '../shared/RunicBand';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import MysticButton from '../shared/MysticButton';
import HistoryModal from '../overlays/HistoryModal';
import CardSigil from '../cards/CardSigil';
import type { SlotResult } from '../../engine/types';

function formatQuestionType(qt: string): string {
  switch (qt) {
    case 'decision': return 'Decision';
    case 'relationship': return 'Relationship';
    case 'future': return 'Future / Forecast';
    case 'self': return 'Self-Analysis';
    default: return qt;
  }
}

function getResultDisplay(result: SlotResult): { symbol: string; name: string; subtitle: string } {
  switch (result.type) {
    case 'tarot':
      return {
        symbol: result.symbol,
        name: result.name,
        subtitle: result.orientation === 'upright'
          ? `Upright — ${result.meaningUpright.slice(0, 100)}`
          : `Reversed — ${result.meaningReversed.slice(0, 100)}`,
      };
    case 'd20':
      return {
        symbol: String.fromCodePoint(0x2685),
        name: `D20 — ${result.result}`,
        subtitle: result.interpretation.slice(0, 100),
      };
    case 'iching':
      return {
        symbol: result.symbol,
        name: `Hexagram #${result.hexagramNumber} — ${result.name}`,
        subtitle: result.judgment.slice(0, 100),
      };
    case 'happening':
      return {
        symbol: String.fromCodePoint(0x2726),
        name: 'Happening',
        subtitle: result.scene.slice(0, 100),
      };
    default:
      return { symbol: '?', name: 'Unknown', subtitle: '' };
  }
}

export default function ResultReading() {
  const { state, engine } = useGameEngine();
  const shareRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { turnResults, synthesis, happening, selectedHappeningChoice, questionType } = state;

  const handleDrawAgain = useCallback(() => engine.returnToQuestionSelect(), [engine]);
  const handleShare = useCallback(async () => {
    if (shareRef.current) {
      try { await shareAsImage(shareRef.current); } catch { /* silent */ }
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
      <div ref={shareRef} data-share-container style={cardStyle}>
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

        {/* Divination Results */}
        {turnResults.length > 0 && (
          <div style={resultsGridStyle}>
            {turnResults.map((r, i) => {
              const d = getResultDisplay(r);
              return (
                <div key={i} style={resultCardStyle}>
                  <div style={resultIndexStyle}>{i + 1}</div>
                  <div style={resultSymbolStyle}>
                    {r.type === 'tarot'
                      ? <CardSigil card={r} size={28} color="#d4a854" />
                      : d.symbol}
                  </div>
                  <div style={resultNameStyle}>{d.name}</div>
                  <div style={resultSubtitleStyle}>{d.subtitle}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Synthesis */}
        {synthesis && (
          <div style={synthesisSectionStyle}>
            <h2 style={sectionTitleStyle}>Interpretation</h2>
            <h3 style={headlineStyle}>{synthesis.headline}</h3>
            {synthesis.paragraphs.map((p, i) => (
              <p key={i} style={paraStyle}>{p}</p>
            ))}
            {synthesis.tensionNote && (
              <div style={tensionBoxStyle}>
                <div style={tensionBarStyle} />
                <p style={tensionTextStyle}>{synthesis.tensionNote}</p>
              </div>
            )}
            {synthesis.affinityNote && (
              <p style={affinityStyle}>{synthesis.affinityNote}</p>
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
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
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

const resultsGridStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%',
};

const resultIndexStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600,
  fontSize: '0.6rem', color: '#5b7290', letterSpacing: '0.1em',
  position: 'absolute', top: '0.5rem', left: '0.5rem',
};

const resultCardStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.3rem', padding: '1rem', background: '#0d1220',
  border: '1px solid #1a2440', borderRadius: '6px', width: '100%',
  boxSizing: 'border-box',
};

const resultSymbolStyle: React.CSSProperties = { fontSize: '2rem', color: '#d4a854' };
const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '1rem', color: '#c8d8f0', letterSpacing: '0.05em',
};
const resultSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: '0.75rem', color: '#7b9ec7', textAlign: 'center', lineHeight: 1.4,
};

const synthesisSectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.5rem', width: '100%',
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
