import { motion } from 'framer-motion';

export default function FateForceOverlay({ text }: { text: string }) {
  return (
    <motion.div
      style={overlayStyle}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(2px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div style={scrimStyle} />
      <motion.div
        style={textStyle}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {text}
      </motion.div>

      {/* Spectral hand descends from the top, slams down, withdraws. */}
      <motion.div
        style={handStyle}
        initial={{ y: '-60%', opacity: 0 }}
        animate={{ y: ['-60%', '8%', '8%', '-60%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.8, times: [0, 0.4, 0.7, 1], ease: 'easeInOut' }}
      >
        <svg width="120" height="150" viewBox="0 0 120 150" aria-hidden style={{ display: 'block' }}>
          <g fill="none" stroke="#d4a854" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             style={{ filter: 'drop-shadow(0 0 8px rgba(212,168,84,0.7))' }}>
            {/* palm */}
            <path d="M40 120 Q34 86 42 70 L46 96 Q48 60 56 56 L58 92 Q62 54 70 54 L70 92 Q76 58 82 64 L80 100 Q92 92 92 108 Q92 132 72 140 L52 140 Q42 136 40 120 Z" fill="rgba(212,168,84,0.12)" />
          </g>
        </svg>
      </motion.div>
    </motion.div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 25,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'auto', overflow: 'hidden',
};

const scrimStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(3,5,12,0.55)', pointerEvents: 'none',
};

const textStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600,
  fontSize: 'clamp(1.1rem, 3.4vw, 1.7rem)', color: '#d4a854', letterSpacing: '0.06em',
  textAlign: 'center', textShadow: '0 0 14px rgba(212,168,84,0.5)', maxWidth: '80vw',
};

const handStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1, pointerEvents: 'none',
};
