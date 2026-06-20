import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { InteractionEvent } from '../../../engine/types';

interface Props {
  event: InteractionEvent;
  onComplete: () => void;
}

const STUB_LABELS: Record<string, string> = {
  flip: 'The Critical Flip',
  'add-choice': 'I Ching Boost',
  mirror: 'The Mirror Event',
  'second-result': 'Chaos Surge',
};

export default function StubAnimation({ event, onComplete }: Props) {
  const label = STUB_LABELS[event.effect] ?? event.effect;

  useEffect(() => {
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        style={flashStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        style={cardStyle}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <span style={effectIconStyle}>{String.fromCodePoint(0x2726)}</span>
        <span style={labelStyle}>{label}</span>
        <span style={descriptionStyle}>{event.description}</span>
      </motion.div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const flashStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212,168,84,0.2), transparent 60%)',
};

const cardStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.5rem 2rem',
  background: '#0d1220',
  border: '1px solid #d4a854',
  borderRadius: '6px',
};

const effectIconStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  color: '#d4a854',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1.1rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
};

const descriptionStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: '0.8rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  maxWidth: '280px',
};
