import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

// Fate thins the pool: a card recedes and a contracting aura closes inward —
// the visual inverse of WidenAnimation's expansion.
export default function ThinAnimation(_props: Props) {
  return (
    <motion.div style={containerStyle}>
      {/* Closing slot card shrinking away */}
      <motion.div
        style={closingSlotStyle}
        initial={{ opacity: 0.7, y: 0, scale: 1 }}
        animate={{ opacity: [0.7, 0.4, 0], y: 30, scale: 0.7 }}
        transition={{ duration: 1.0, ease: 'easeIn' }}
      />
      {/* Contracting aura */}
      <motion.div
        style={auraStyle}
        initial={{ scale: 1.6, opacity: 0.5 }}
        animate={{ scale: 0.6, opacity: 0 }}
        transition={{ duration: 0.9, delay: 0.1, ease: 'easeIn' }}
      />
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

const closingSlotStyle: React.CSSProperties = {
  position: 'absolute',
  width: '120px',
  height: '160px',
  background: 'linear-gradient(135deg, rgba(150, 90, 70, 0.22), rgba(90, 55, 70, 0.14))',
  border: '1px solid rgba(199, 91, 74, 0.5)',
  borderRadius: '6px',
};

const auraStyle: React.CSSProperties = {
  position: 'absolute',
  width: '160px',
  height: '200px',
  borderRadius: '8px',
  border: '2px solid rgba(199, 120, 100, 0.35)',
};
