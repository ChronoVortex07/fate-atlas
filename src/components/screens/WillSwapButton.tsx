import { motion } from 'framer-motion';

export default function WillSwapButton({ onSwap, disabled = false }: { onSwap: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      style={{ ...swapStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}
      whileHover={disabled ? undefined : { borderColor: '#9b6bb0', scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onSwap}
      disabled={disabled}
    >
      ↺ Call for different methods
    </motion.button>
  );
}

const swapStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.4vw, 0.9rem)', letterSpacing: '0.08em',
  color: '#c8a0d0', background: '#0d1220', border: '1px solid #9b6bb040',
  borderRadius: '6px', padding: '0.6rem 1.25rem', outline: 'none', marginTop: '0.25rem',
};
