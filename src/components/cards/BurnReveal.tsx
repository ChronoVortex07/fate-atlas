import { motion } from 'framer-motion';
import { DECK_BY_ID, buildFace } from '../../data/tarot';
import CardSigil from './CardSigil';

/**
 * The rejected (swapped-out) card immolates to reveal the real card beneath it.
 * Rendered absolutely over the swapped hand slot; the real committed face is what
 * shows underneath once the burn finishes. Pure CSS mask — no new deps.
 */
export default function BurnReveal({ cardId, accent, onDone }:
  { cardId: string; accent: string; onDone?: () => void }) {
  const card = buildFace(DECK_BY_ID[cardId], 'upright');
  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, borderRadius: 6, zIndex: 3,
        background: 'linear-gradient(160deg, #14101a, #0a0710)',
        border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitMaskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 0%)',
        maskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 0%)',
      }}
      initial={{
        WebkitMaskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 2%)',
        maskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 2%)',
        filter: 'brightness(1)',
      }}
      animate={{
        WebkitMaskImage: 'radial-gradient(circle at 50% 60%, transparent 130%, #000 140%)',
        maskImage: 'radial-gradient(circle at 50% 60%, transparent 130%, #000 140%)',
        filter: ['brightness(1)', 'brightness(1.6)', 'brightness(1)'],
      }}
      transition={{ duration: 1.1, ease: 'easeIn' }}
      onAnimationComplete={onDone}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
        <CardSigil card={card} size={22} color="#c75b4a" />
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.6rem', color: '#c8853a' }}>{card.name}</div>
      </div>
      {/* Ember edge that rides the burn outward. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
          boxShadow: 'inset 0 0 24px #ff6a2a, inset 0 0 8px #ffd08a' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.1, ease: 'easeIn' }}
      />
    </motion.div>
  );
}
