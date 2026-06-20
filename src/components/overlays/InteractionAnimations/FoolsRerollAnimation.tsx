import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { InteractionEvent } from '../../../engine/types';

type AnimPhase = 'flash' | 'glow' | 'particle' | 'reroll' | 'dismissal';

interface Props {
  event: InteractionEvent;
  onComplete: () => void;
}

export default function FoolsRerollAnimation({ event, onComplete }: Props) {
  const [phase, setPhase] = useState<AnimPhase>('flash');

  useEffect(() => {
    const sequence: { phase: AnimPhase; delay: number }[] = [
      { phase: 'flash', delay: 300 },
      { phase: 'glow', delay: 500 },
      { phase: 'particle', delay: 600 },
      { phase: 'reroll', delay: 800 },
      { phase: 'dismissal', delay: 500 },
    ];

    let currentIdx = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advance = () => {
      currentIdx++;
      if (currentIdx < sequence.length) {
        setPhase(sequence[currentIdx].phase);
        timeoutId = setTimeout(advance, sequence[currentIdx].delay);
      } else {
        timeoutId = setTimeout(onComplete, sequence[currentIdx - 1].delay);
      }
    };

    timeoutId = setTimeout(advance, sequence[0].delay);

    return () => clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <motion.div style={containerStyle}>
      {phase === 'flash' && (
        <motion.div
          style={flashStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 0.3 }}
        />
      )}

      {phase === 'glow' && (
        <motion.div style={glowContentStyle}>
          <motion.div
            style={glowOrbStyle}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
          <span style={glowTextStyle}>{event.description}</span>
        </motion.div>
      )}

      {phase === 'particle' && (
        <motion.div style={particleContainerStyle}>
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              style={particleStyle}
              initial={{ x: 0, y: -80, opacity: 1 }}
              animate={{
                x: (Math.random() - 0.5) * 120,
                y: 30 + Math.random() * 40,
                opacity: 0,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </motion.div>
      )}

      {phase === 'reroll' && (
        <motion.div style={rerollContentStyle}>
          <motion.span
            style={rerollDieStyle}
            animate={{ rotate: [0, 720, 1440], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            {String.fromCodePoint(0x2685)}
          </motion.span>
          <span style={rerollLabelStyle}>The dice are recast...</span>
        </motion.div>
      )}

      {phase === 'dismissal' && (
        <motion.div
          style={dismissalStyle}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto',
};

const flashStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212,168,84,0.3), transparent 70%)',
};

const glowContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
};

const glowOrbStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(212,168,84,0.5), transparent 70%)',
};

const glowTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: '1.1rem',
  color: '#d4a854',
  textAlign: 'center',
  fontStyle: 'italic',
  maxWidth: '340px',
};

const particleContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: '200px',
  height: '150px',
};

const particleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  background: '#d4a854',
};

const rerollContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const rerollDieStyle: React.CSSProperties = {
  fontSize: '3rem',
  display: 'inline-block',
};

const rerollLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1rem',
  color: '#c8d8f0',
  letterSpacing: '0.1em',
};

const dismissalStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212,168,84,0.15), transparent 60%)',
};
