import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function RerollAnimation({ descriptor: _descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const radius = 80 + Math.random() * 40;
        return (
          <motion.div
            key={i}
            style={{
              ...particleStyle,
              left: '50%',
              top: '50%',
            }}
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius - 20,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: Math.random() * 0.15 }}
          />
        );
      })}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const particleStyle: React.CSSProperties = {
  position: 'absolute',
  width: '5px',
  height: '5px',
  borderRadius: '50%',
  background: '#d4a854',
};
