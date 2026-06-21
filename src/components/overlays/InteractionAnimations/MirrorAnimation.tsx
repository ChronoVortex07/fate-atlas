import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

export default function MirrorAnimation(_props: Props) {
  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={lineStyle}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 0.5, 0.5, 0] }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
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

const lineStyle: React.CSSProperties = {
  width: '60%',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, rgba(180, 200, 220, 0.5), transparent)',
};
