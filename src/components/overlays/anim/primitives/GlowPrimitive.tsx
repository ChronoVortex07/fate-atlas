import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * A themed aura blooms over the card and fades, with no structural change to the
 * card itself — used by clarity/order effects (spread-aligned, order-anchor) and
 * the dice roll-mode cast. Order (`theme.key === 'order'`) reads as a crisp
 * lattice lock: a square frame snapping inward. Other themes read as a radiant
 * bloom that swells and dissipates.
 */
export default function GlowPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  const lattice = theme.key === 'order';
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 36, spread: 80 }}>
      <motion.div
        style={{ position: 'absolute', inset: '-12%', borderRadius: lattice ? 4 : '50%',
          background: `radial-gradient(circle, ${accent}88 0%, ${core}22 45%, transparent 70%)`,
          border: lattice ? `1.5px solid ${accent}` : 'none' }}
        initial={{ opacity: 0, scale: lattice ? 1.4 : 0.6 }}
        animate={{ opacity: [0, 0.9, 0], scale: lattice ? [1.4, 1, 1] : [0.6, 1.2, 1.4] }}
        transition={{ duration: sec, ease: 'easeOut', times: [0, lattice ? 0.4 : 0.5, 1] }}
      />
    </AnchoredStage>
  );
}
