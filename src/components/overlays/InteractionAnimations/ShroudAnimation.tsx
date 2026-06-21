import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

export default function ShroudAnimation(_props: Props) {
  return (
    <motion.div style={containerStyle}>
      {/* Veil sweep — darkening curtain falling over the target slot */}
      <motion.div
        style={veilStyle}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: [0, 0.7, 0.5, 0] }}
        transition={{ duration: 1.2, ease: 'easeIn' }}
      />
      {/* Edge shimmer */}
      <motion.div
        style={shimmerStyle}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: [0, 0.6, 0], y: 20 }}
        transition={{ duration: 1.0, delay: 0.1, ease: 'easeInOut' }}
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

const veilStyle: React.CSSProperties = {
  position: 'absolute',
  width: '140px',
  height: '180px',
  background: 'linear-gradient(180deg, rgba(2, 4, 10, 0.85) 0%, rgba(20, 10, 40, 0.6) 100%)',
  borderRadius: '6px',
  transformOrigin: 'top center',
};

const shimmerStyle: React.CSSProperties = {
  position: 'absolute',
  width: '140px',
  height: '3px',
  background: 'linear-gradient(90deg, transparent, rgba(100, 60, 180, 0.7), transparent)',
  borderRadius: '2px',
};
