import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

export default function OverrideAnimation(_props: Props) {
  return (
    <motion.div style={containerStyle}>
      {/* Hand-of-fate: descending swoosh */}
      <motion.div
        style={handStyle}
        initial={{ y: -60, opacity: 0, rotate: -15 }}
        animate={{ y: 0, opacity: [0, 0.9, 0.7, 0], rotate: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      {/* Displaced card flying off */}
      <motion.div
        style={swapCardStyle}
        initial={{ x: 0, y: 0, opacity: 0.8, rotate: 0 }}
        animate={{ x: 80, y: -50, opacity: 0, rotate: 25 }}
        transition={{ duration: 0.7, delay: 0.2, ease: 'easeIn' }}
      />
      {/* Impact flash */}
      <motion.div
        style={flashStyle}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.6, 0], scale: 1.4 }}
        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
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

const handStyle: React.CSSProperties = {
  position: 'absolute',
  width: '80px',
  height: '120px',
  background: 'linear-gradient(180deg, rgba(212, 168, 84, 0.35), rgba(180, 120, 40, 0.15))',
  border: '1px solid rgba(212, 168, 84, 0.5)',
  borderRadius: '6px',
};

const swapCardStyle: React.CSSProperties = {
  position: 'absolute',
  width: '70px',
  height: '100px',
  background: 'rgba(30, 20, 60, 0.5)',
  border: '1px solid rgba(120, 90, 160, 0.4)',
  borderRadius: '4px',
};

const flashStyle: React.CSSProperties = {
  position: 'absolute',
  width: '100px',
  height: '100px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(212, 168, 84, 0.3) 0%, transparent 70%)',
};
