import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { SlotResult } from '../../engine/types';
import CardSigil from './CardSigil';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

const CARD_WIDTH = 220;
const CARD_HEIGHT = 330;

interface CardSlotProps {
  slot: SlotResult | null;
  index: number;
  onReveal: (index: number) => void;
}

export default function CardSlot({ slot, index, onReveal }: CardSlotProps) {
  const [flipped, setFlipped] = useState(false);

  const handleClick = useCallback(() => {
    if (flipped) return;
    onReveal(index);
    setFlipped(true);
  }, [flipped, index, onReveal]);

  return (
    <div style={perspectiveStyle} onClick={handleClick}>
      <motion.div
        style={cardContainerStyle}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        {/* Face-down side */}
        <div style={frontFaceStyle}>
          <div style={faceDownInnerStyle}>
            <div style={cardRunicBandStyle}>{RUNES.slice(0, 8)}</div>
            <div style={constellationStyle}>
              <span style={dotStyle} />
              <span style={dotLineStyle} />
              <span style={dotStyle} />
              <span style={dotLineStyle} />
              <span style={dotStyle} />
            </div>
            <div style={cardRunicBandStyle}>{RUNES.slice(0, 8)}</div>
          </div>
          <motion.div
            style={glowStyle}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Face-up side */}
        <div style={backFaceStyle}>
          <div style={faceUpInnerStyle}>
            {slot ? renderSlotContent(slot) : <div style={placeholderStyle}>Revealing...</div>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function renderSlotContent(slot: SlotResult) {
  switch (slot.type) {
    case 'tarot':
      if (slot.spread && slot.spread.length > 1) {
        return (
          <div style={contentWrapperStyle}>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              {slot.spread.map((s) => (
                <div key={s.position} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.55rem', color: '#7b9ec7', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.position}</span>
                  {s.card.veiled
                    ? <span style={{ fontSize: '1.5rem', color: '#5b7290' }}>✶</span>
                    : <CardSigil card={s.card} size={28} color={s.card.orientation === 'reversed' ? '#d4a854' : '#9b6bb0'} />}
                  <span style={{ fontSize: '0.5rem', color: '#7b9ec7' }}>{s.card.veiled ? 'veiled' : s.card.name}</span>
                </div>
              ))}
            </div>
            <div style={slotMeaningStyle}>{slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed}</div>
          </div>
        );
      }
      return (
        <div style={contentWrapperStyle}>
          <div style={slotSymbolStyle}>
            <CardSigil card={slot} size={32} />
          </div>
          <div style={slotNameStyle}>{slot.name}</div>
          <div style={
            slot.orientation === 'upright'
              ? uprightLabelStyle
              : reversedLabelStyle
          }>
            {slot.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
          </div>
          <div style={slotMeaningStyle}>
            {slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed}
          </div>
        </div>
      );

    case 'd20':
      return (
        <div style={contentWrapperStyle}>
          <div style={diceNumberStyle}>{slot.result}</div>
          <div style={thresholdLabelStyle}>{formatThreshold(slot.threshold)}</div>
          <div style={slotMeaningStyle}>{slot.interpretation}</div>
        </div>
      );

    case 'iching':
      return (
        <div style={contentWrapperStyle}>
          <div style={hexagramSymbolStyle}>{slot.symbol}</div>
          <div style={slotNameStyle}>
            {slot.name}
            <span style={hexagramNumberStyle}> #{slot.hexagramNumber}</span>
          </div>
          <div style={slotMeaningStyle}>{slot.judgment}</div>
        </div>
      );

    case 'happening':
      return (
        <div style={contentWrapperStyle}>
          <div style={slotNameStyle}>Happening</div>
          <div style={slotMeaningStyle}>{slot.scene}</div>
        </div>
      );

    default:
      return <div style={placeholderStyle}>Unknown</div>;
  }
}

function formatThreshold(threshold: string): string {
  switch (threshold) {
    case 'critical-low': return 'Critical Low';
    case 'low': return 'Low';
    case 'neutral': return 'Neutral';
    case 'high': return 'High';
    case 'critical-high': return 'Critical High';
    default: return threshold;
  }
}

// ── Styles ──

const perspectiveStyle: React.CSSProperties = {
  perspective: '1000px',
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  cursor: 'pointer',
};

const cardContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  transformStyle: 'preserve-3d',
  position: 'relative',
};

const faceBaseStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  borderRadius: '6px',
  overflow: 'hidden',
};

const frontFaceStyle: React.CSSProperties = {
  ...faceBaseStyle,
  background: '#0a1020',
  border: '1px solid #1a2440',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const backFaceStyle: React.CSSProperties = {
  ...faceBaseStyle,
  background: '#0d1220',
  border: '1px solid #1a2440',
  transform: 'rotateY(180deg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const faceDownInnerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '1.25rem',
  height: '100%',
  boxSizing: 'border-box',
  position: 'relative',
  zIndex: 1,
};

const faceUpInnerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  height: '100%',
  boxSizing: 'border-box',
  overflowY: 'auto',
};

const cardRunicBandStyle: React.CSSProperties = {
  color: '#7b9ec7',
  fontSize: '0.6rem',
  letterSpacing: '0.3em',
  opacity: 0.3,
  userSelect: 'none',
  textAlign: 'center',
  fontFamily: "'Cormorant Garamond', serif",
};

const constellationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  flex: 1,
};

const dotStyle: React.CSSProperties = {
  width: '3px',
  height: '3px',
  borderRadius: '50%',
  background: '#7b9ec7',
  opacity: 0.6,
};

const dotLineStyle: React.CSSProperties = {
  width: '20px',
  height: '1px',
  background: 'linear-gradient(90deg, transparent, #7b9ec7, transparent)',
  opacity: 0.3,
};

const glowStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  border: '1px solid rgba(212, 168, 84, 0.2)',
  borderRadius: '6px',
  pointerEvents: 'none',
};

// ── Card content styles ──

const contentWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  textAlign: 'center',
};

const slotSymbolStyle: React.CSSProperties = {
  fontSize: '2rem',
  lineHeight: 1,
  marginBottom: '0.25rem',
};

const slotNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1.1rem',
  color: '#c8d8f0',
  letterSpacing: '0.05em',
};

const slotMeaningStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.75rem',
  color: '#7b9ec7',
  lineHeight: 1.5,
};

const uprightLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  letterSpacing: '0.1em',
};

const reversedLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.7rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
};

const diceNumberStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: '3rem',
  color: '#d4a854',
  textShadow: '0 0 15px rgba(212, 168, 84, 0.5)',
  lineHeight: 1,
};

const thresholdLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const hexagramSymbolStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  lineHeight: 1,
  color: '#c8d8f0',
  marginBottom: '0.25rem',
};

const hexagramNumberStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#7b9ec7',
};

const placeholderStyle: React.CSSProperties = {
  color: '#7b9ec7',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.8rem',
};
