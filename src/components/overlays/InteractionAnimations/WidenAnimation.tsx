import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

export default function WidenAnimation(_props: Props) {
  return (
    <motion.div style={containerStyle}>
      {/* New slot card fading in from below */}
      <motion.div
        style={newSlotStyle}
        initial={{ opacity: 0, y: 30, scale: 0.85 }}
        animate={{ opacity: [0, 0.8, 0.6, 0], y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
      {/* Expanding aura */}
      <motion.div
        style={auraStyle}
        initial={{ scale: 0.6, opacity: 0.5 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 1.0, delay: 0.1, ease: 'easeOut' }}
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

const newSlotStyle: React.CSSProperties = {
  position: 'absolute',
  width: '120px',
  height: '160px',
  background: 'linear-gradient(135deg, rgba(91, 140, 90, 0.25), rgba(60, 100, 80, 0.15))',
  border: '1px solid rgba(91, 140, 90, 0.5)',
  borderRadius: '6px',
};

const auraStyle: React.CSSProperties = {
  position: 'absolute',
  width: '160px',
  height: '200px',
  borderRadius: '8px',
  border: '2px solid rgba(91, 200, 130, 0.3)',
};
