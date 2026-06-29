import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import RunicBand from '../shared/RunicBand';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import type { QuestionType } from '../../engine/types';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

interface QuestionCard {
  type: QuestionType;
  symbol: string;
  title: string;
  description: string;
}

const QUESTIONS: QuestionCard[] = [
  { type: 'decision', symbol: '☉', title: 'Decision', description: 'A choice weighs on you' },
  { type: 'relationship', symbol: '⚤', title: 'Relationship', description: 'A bond calls for understanding' },
  { type: 'future', symbol: '☽', title: 'Future', description: 'The horizon beckons' },
  { type: 'self', symbol: '☾', title: 'Self-Analysis', description: 'Look within' },
];

interface DepthTier { count: number; name: string; flavor: string; }
const DEPTH_TIERS: DepthTier[] = [
  { count: 3, name: 'Glimpse',         flavor: 'A brief glance through the veil.' },
  { count: 5, name: 'Reading',         flavor: 'A measured consultation.' },
  { count: 7, name: 'Deep Divination', flavor: 'A long descent into deeper waters.' },
];
const DEFAULT_TIER_INDEX = 1; // Reading (5)

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

export default function QuestionSelect() {
  const { engine } = useGameEngine();
  const [tierIndex, setTierIndex] = useState(DEFAULT_TIER_INDEX);
  const tier = DEPTH_TIERS[tierIndex];

  const handleSelect = (questionType: QuestionType) => {
    engine.startTurn(questionType, tier.count);
  };

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <div style={headingSectionStyle}>
          <RunicBand opacity={0.4} fontSize="clamp(0.6rem, 1.2vw, 0.85rem)" />
          <h1 style={headingStyle}>What do you seek?</h1>
          <OrnamentalBorder />
        </div>

        <div style={depthBlockStyle}>
          <div style={depthLabelStyle}>— Depth of the Reading —</div>
          <div style={tierBarStyle} role="radiogroup" aria-label="Depth of the reading">
            {DEPTH_TIERS.map((t, i) => (
              <button
                key={t.name}
                type="button"
                role="radio"
                aria-checked={i === tierIndex}
                onClick={() => setTierIndex(i)}
                style={{ ...segStyle, ...(i > 0 ? segDividerStyle : null), ...(i === tierIndex ? segSelStyle : null) }}
              >
                <span style={{ ...segNameStyle, ...(i === tierIndex ? segNameSelStyle : null) }}>{t.name}</span>
                <span style={pipsStyle}>
                  {Array.from({ length: t.count }).map((_, p) => (
                    <span key={p} style={{ ...pipStyle, ...(i === tierIndex ? pipSelStyle : null) }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <div style={depthDescStyle}>{tier.flavor}</div>
        </div>

        <motion.div
          style={gridStyle}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {QUESTIONS.map((q) => (
            <motion.button
              key={q.type}
              style={cardStyle}
              variants={cardVariants}
              whileHover={{
                borderColor: '#d4a854',
                boxShadow: '0 0 20px rgba(212, 168, 84, 0.25)',
                scale: 1.02,
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(q.type)}
            >
              <div style={cardRunicBandStyle}>{RUNES.slice(0, 6)}</div>
              <div style={cardSymbolStyle}>{q.symbol}</div>
              <div style={cardTitleStyle}>{q.title}</div>
              <div style={cardDescriptionStyle}>{q.description}</div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'auto',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2.5rem',
  padding: '2rem',
  maxWidth: '720px',
  width: '100%',
};

const headingSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.8rem, 5vw, 3rem)',
  color: '#c8d8f0',
  letterSpacing: '0.15em',
  margin: 0,
  textAlign: 'center',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1.25rem',
  width: '100%',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.75rem 1.25rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  outline: 'none',
};

const cardRunicBandStyle: React.CSSProperties = {
  color: '#7b9ec7',
  fontSize: '0.65rem',
  letterSpacing: '0.3em',
  opacity: 0.35,
  userSelect: 'none',
  marginBottom: '0.25rem',
};

const cardSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
  color: '#d4a854',
  lineHeight: 1,
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
  color: '#c8d8f0',
  letterSpacing: '0.1em',
};

const cardDescriptionStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.75rem, 1.5vw, 0.9rem)',
  color: '#7b9ec7',
  textAlign: 'center',
  lineHeight: 1.4,
};

const depthBlockStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
};
const depthLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.58rem', letterSpacing: '0.26em',
  textTransform: 'uppercase', color: '#5b7290',
};
const tierBarStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'stretch', border: '1px solid #2a3354',
  borderRadius: '999px', overflow: 'hidden', background: '#0a0e18',
  boxShadow: 'inset 0 0 26px rgba(0,0,0,0.5)',
};
const segStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  padding: '0.5rem 1.4rem 0.55rem', cursor: 'pointer', background: 'transparent',
  border: 'none', outline: 'none', fontFamily: 'inherit',
  transition: 'background 0.25s ease',
};
const segDividerStyle: React.CSSProperties = { borderLeft: '1px solid #1c2238' };
const segSelStyle: React.CSSProperties = {
  background: 'radial-gradient(120% 130% at 50% 0%, rgba(212,168,84,0.16), rgba(212,168,84,0.03) 70%)',
};
const segNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.92rem',
  letterSpacing: '0.05em', color: '#9fb2cf', whiteSpace: 'nowrap',
};
const segNameSelStyle: React.CSSProperties = {
  color: '#f0d595', textShadow: '0 0 10px rgba(212,168,84,0.4)',
};
const pipsStyle: React.CSSProperties = { display: 'flex', gap: '3px' };
const pipStyle: React.CSSProperties = {
  width: '4px', height: '4px', borderRadius: '50%', background: '#39435f',
};
const pipSelStyle: React.CSSProperties = {
  background: '#d4a854', boxShadow: '0 0 5px rgba(212,168,84,0.7)',
};
const depthDescStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#7b9ec7',
  fontSize: '0.82rem', textAlign: 'center', minHeight: '1.2em', letterSpacing: '0.02em',
};
