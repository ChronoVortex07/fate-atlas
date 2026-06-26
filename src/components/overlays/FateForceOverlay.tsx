import { motion } from 'framer-motion';

// Viewport-space anchor of the card the player picked, so the hand descends onto
// it rather than from the top of the screen.
export interface HandTarget {
  x: number;     // card centre, px from the left of the viewport
  topY: number;  // card top, px from the top of the viewport
}

export default function FateForceOverlay({ text, target, pressed }:
  { text: string; target: HandTarget | null; pressed: boolean }) {
  // Resting position: hand hovers above the card. Pressed: it drives down so the
  // fingertips overlap the card's top edge.
  const raisedY = -250;
  const pressedY = -118; // hand SVG is 150 tall → bottom lands ~32px onto the card

  return (
    <motion.div
      style={overlayStyle}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(2px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div style={scrimStyle} />

      <motion.div
        style={textStyle}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {text}
      </motion.div>

      {target && (
        <motion.div
          style={{ ...handWrapStyle, left: target.x, top: target.topY }}
          initial={{ x: '-50%', y: raisedY, opacity: 0 }}
          animate={{ x: '-50%', y: pressed ? pressedY : raisedY, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 17 }}
        >
          <svg width="120" height="150" viewBox="0 0 120 150" aria-hidden style={{ display: 'block' }}>
            <g fill="none" stroke="#d4a854" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               style={{ filter: 'drop-shadow(0 0 8px rgba(212,168,84,0.7))' }}>
              {/* palm */}
              <path d="M40 120 Q34 86 42 70 L46 96 Q48 60 56 56 L58 92 Q62 54 70 54 L70 92 Q76 58 82 64 L80 100 Q92 92 92 108 Q92 132 72 140 L52 140 Q42 136 40 120 Z" fill="rgba(212,168,84,0.12)" />
            </g>
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'auto', overflow: 'hidden',
};

const scrimStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(3,5,12,0.55)', pointerEvents: 'none',
};

const textStyle: React.CSSProperties = {
  position: 'absolute', top: '11%', left: 0, right: 0, zIndex: 1,
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600,
  fontSize: 'clamp(1.1rem, 3.4vw, 1.7rem)', color: '#d4a854', letterSpacing: '0.06em',
  textAlign: 'center', textShadow: '0 0 14px rgba(212,168,84,0.5)', padding: '0 1rem',
};

const handWrapStyle: React.CSSProperties = {
  position: 'absolute', zIndex: 1, pointerEvents: 'none',
};
