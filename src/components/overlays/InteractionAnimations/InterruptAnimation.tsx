import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

// Chaos interrupts: a sharp horizontal tear flashes across the weave, then a
// quick chromatic shudder — distinct from the second-result ripple it reused.
export default function InterruptAnimation(_props: Props) {
  return (
    <motion.div style={containerStyle}>
      {/* The tear: a thin bright bar that snaps open then collapses */}
      <motion.div
        style={tearStyle}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 1, 0.9, 0] }}
        transition={{ duration: 0.7, times: [0, 0.25, 0.6, 1], ease: 'easeInOut' }}
      />
      {/* Shudder flash filling the area briefly */}
      <motion.div
        style={flashStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.35, 0] }}
        transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
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

const tearStyle: React.CSSProperties = {
  position: 'absolute',
  width: '70%',
  height: '3px',
  background: 'linear-gradient(90deg, transparent, rgba(212, 84, 84, 0.9), rgba(255, 220, 160, 0.9), rgba(212, 84, 84, 0.9), transparent)',
  boxShadow: '0 0 18px rgba(212, 84, 84, 0.6)',
};

const flashStyle: React.CSSProperties = {
  position: 'absolute',
  width: '60%',
  height: '180px',
  background: 'radial-gradient(ellipse at center, rgba(199, 91, 74, 0.25), transparent 70%)',
};
