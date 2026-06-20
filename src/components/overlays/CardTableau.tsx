import { motion, AnimatePresence } from 'framer-motion';
import type { SlotResult } from '../../engine/types';

type CardSlotState = 'idle' | 'source' | 'target' | 'animating';

interface ActiveSlots {
  sourceIndex: number | null;
  targetIndex: number | null;
}

interface Props {
  results: SlotResult[];
  activeSlots: ActiveSlots;
}

function getSlotState(index: number, activeSlots: ActiveSlots): CardSlotState {
  if (activeSlots.sourceIndex === index && activeSlots.targetIndex === index) return 'animating';
  if (activeSlots.sourceIndex === index) return 'source';
  if (activeSlots.targetIndex === index) return 'target';
  return 'idle';
}

function getSlotDisplay(result: SlotResult): { symbol: string; name: string; typeLabel: string } {
  switch (result.type) {
    case 'tarot':
      return {
        symbol: result.symbol,
        name: result.name,
        typeLabel: result.orientation === 'upright' ? '▲' : '▼',
      };
    case 'd20':
      return {
        symbol: String(result.result),
        name: 'D20',
        typeLabel: result.threshold.replace(/-/g, ' '),
      };
    case 'iching':
      return {
        symbol: result.symbol,
        name: `Hex ${result.hexagramNumber}`,
        typeLabel: result.changingLines.length > 0 ? `${result.changingLines.length}Δ` : '',
      };
    case 'happening':
      return {
        symbol: String.fromCodePoint(0x2726),
        name: 'Happening',
        typeLabel: '',
      };
    default:
      return { symbol: '?', name: '—', typeLabel: '' };
  }
}

export default function CardTableau({ results, activeSlots }: Props) {
  if (results.length === 0) return null;

  return (
    <div style={trayStyle}>
      <AnimatePresence>
        {results.map((result, index) => {
          const slotState = getSlotState(index, activeSlots);
          const display = getSlotDisplay(result);
          return (
            <motion.div
              key={index}
              style={{
                ...cardStyle,
                ...(slotState === 'source' ? sourceGlowStyle : {}),
                ...(slotState === 'target' ? targetGlowStyle : {}),
                ...(slotState === 'animating' ? animatingStyle : {}),
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{
                opacity: 1,
                y: 0,
                ...(slotState === 'source' ? { boxShadow: '0 0 16px rgba(212,168,84,0.5)' } : {}),
                ...(slotState === 'target' ? { boxShadow: '0 0 12px rgba(200,120,80,0.45)' } : {}),
              }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div style={cardSymbolStyle}>{display.symbol}</div>
              <div style={cardNameStyle}>{display.name}</div>
              {display.typeLabel && (
                <div style={cardTypeStyle}>{display.typeLabel}</div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const trayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '12px',
  padding: '10px 20px',
  borderTop: '1px solid rgba(212, 168, 84, 0.15)',
  background: 'linear-gradient(180deg, rgba(7,10,18,0.6) 0%, rgba(7,10,18,0.9) 100%)',
  borderRadius: '8px 8px 0 0',
  zIndex: 5,
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  width: '120px',
  minHeight: '80px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  padding: '8px 10px',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
};

const sourceGlowStyle: React.CSSProperties = {
  borderColor: 'rgba(212, 168, 84, 0.6)',
};

const targetGlowStyle: React.CSSProperties = {
  borderColor: 'rgba(200, 120, 80, 0.5)',
};

const animatingStyle: React.CSSProperties = {
  borderColor: 'rgba(212, 168, 84, 0.7)',
};

const cardSymbolStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  color: '#c8d8f0',
  lineHeight: 1,
};

const cardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  letterSpacing: '0.05em',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100px',
};

const cardTypeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.55rem',
  color: '#5b7290',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
