import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * The anchored card inverts: a card-shaped sheath does a single 3D Y-flip over
 * the real card, a theme-edge light sweeps across, and a radial accent burst
 * punctuates the turn — settling to reveal the now-changed real card. Used by
 * critical-resonance (omen flips the spread) and spread-cascade (all reversed).
 */
export default function FlipPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 40, model: 'radial', spread: 90 }}>
      {/* Card-shaped sheath flipping through its face. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `1.5px solid ${accent}`,
          background: `linear-gradient(160deg, ${core}bb, ${core}33)`, boxShadow: `0 0 22px ${core}aa`,
          transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 0, opacity: 0 }}
        animate={{ rotateY: [0, 180], opacity: [0, 1, 1, 0] }}
        transition={{ duration: sec, ease: 'easeInOut', times: [0, 0.15, 0.85, 1] }}
      />
      {/* Theme-edge light sweep riding across the flip. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6,
          background: `linear-gradient(105deg, transparent 40%, ${accent}cc 50%, transparent 60%)`, mixBlendMode: 'screen' }}
        initial={{ opacity: 0, x: '-40%' }} animate={{ opacity: [0, 1, 0], x: ['-40%', '40%'] }}
        transition={{ duration: sec * 0.5, ease: 'easeOut' }}
      />
    </AnchoredStage>
  );
}
