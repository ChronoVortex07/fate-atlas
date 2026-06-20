import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  step: string;
}

export default function AddChoiceAnimation({ descriptor: _descriptor, step }: Props) {
  if (step === 'desc') return null;

  return (
    <motion.div style={containerStyle}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={branchStyle}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: [0, 0.6, 0] }}
          transition={{
            duration: 0.8,
            delay: i * 0.2,
            ease: 'easeOut',
          }}
        />
      ))}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '20px',
  pointerEvents: 'none',
};

const branchStyle: React.CSSProperties = {
  width: '2px',
  height: '60px',
  background: 'linear-gradient(0deg, rgba(91, 140, 90, 0.6), transparent)',
  transformOrigin: 'bottom center',
};
