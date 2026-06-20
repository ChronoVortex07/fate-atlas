import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function MirrorAnimation({ descriptor: _descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

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
