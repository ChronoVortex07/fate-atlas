import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function FlipAnimation({ descriptor: _descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={waveStyle}
        initial={{ x: '-30%', opacity: 0 }}
        animate={{ x: '30%', opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
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

const waveStyle: React.CSSProperties = {
  width: '200px',
  height: '4px',
  background: 'linear-gradient(90deg, transparent, rgba(200, 90, 70, 0.6), transparent)',
  borderRadius: '2px',
};
