import { motion } from 'framer-motion';
import { DECK_BY_ID, buildFace } from '../../data/tarot';
import CardSigil from './CardSigil';

// A tiny transparent hole at center keeps the whole card visible; growing the
// hole past the card's far corner (140%) consumes it. Both stops use the same
// value in `style` and `initial` so there is no first-frame discrepancy.
const VISIBLE_MASK = 'radial-gradient(circle at 50% 60%, transparent 0%, #000 2%)';
const BURNT_MASK = 'radial-gradient(circle at 50% 60%, transparent 130%, #000 140%)';
const HOLD_SEC = 1.0; // dwell on the rejected card before it ignites
const BURN_SEC = 1.9; // slow immolation so the burn reads clearly

/**
 * The rejected (swapped-out) card immolates to reveal the real card beneath it.
 * Rendered absolutely over the swapped hand slot; the real committed face is what
 * shows underneath once the burn finishes. The rejected card holds visible for
 * HOLD_SEC (so the player sees what was taken) before the slow mask-burn. Pure
 * CSS mask — no new deps.
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
        WebkitMaskImage: VISIBLE_MASK,
        maskImage: VISIBLE_MASK,
      }}
      initial={{
        WebkitMaskImage: VISIBLE_MASK,
        maskImage: VISIBLE_MASK,
        filter: 'brightness(1)',
      }}
      animate={{
        WebkitMaskImage: BURNT_MASK,
        maskImage: BURNT_MASK,
        filter: ['brightness(1)', 'brightness(1.6)', 'brightness(1)'],
      }}
      // `delay` holds the card fully visible at `initial` before the burn runs.
      transition={{ duration: BURN_SEC, ease: 'easeIn', delay: HOLD_SEC }}
      onAnimationComplete={onDone}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
        <CardSigil card={card} size={22} color="#c75b4a" />
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.6rem', color: '#c8853a' }}>{card.name}</div>
      </div>
      {/* Ember edge that rides the burn outward — only during the burn, not the hold. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
          boxShadow: 'inset 0 0 24px #ff6a2a, inset 0 0 8px #ffd08a' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: BURN_SEC, ease: 'easeIn', delay: HOLD_SEC }}
      />
    </motion.div>
  );
}
