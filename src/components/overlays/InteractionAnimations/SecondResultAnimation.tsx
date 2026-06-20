import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function SecondResultAnimation({ descriptor: _descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={rippleStyle}
        initial={{ scale: 0.3, opacity: 0.7 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
      />
      <motion.div
        style={rippleStyle}
        initial={{ scale: 0.3, opacity: 0.5 }}
        animate={{ scale: 2.0, opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
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

const rippleStyle: React.CSSProperties = {
  position: 'absolute',
  width: '120px',
  height: '120px',
  borderRadius: '50%',
  border: '2px solid rgba(140, 100, 200, 0.4)',
};
