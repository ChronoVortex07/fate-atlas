import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * The target's value scatters into particles and a fresh face snaps back in.
 * Used by fool-reroll (themed off the triggering card) and fate-hollow-reroll.
 */
export default function RerollPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 70, model: 'radial', spread: 120 }}>
      {/* Spinning ring that collapses, then a pulse as the new value snaps in. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '-12%',
          borderRadius: '50%',
          border: `2px solid ${accent}`,
          boxShadow: `0 0 24px ${core}aa`,
        }}
        initial={{ opacity: 0, scale: 1.3, rotate: 0 }}
        animate={{ opacity: [0, 0.9, 0], scale: [1.3, 0.5, 1.3], rotate: 220 }}
        transition={{ duration: sec * 0.7, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          border: `1.5px solid ${core}`,
          boxShadow: `inset 0 0 26px ${core}66`,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.8, 0.8, 1.06, 1] }}
        transition={{ duration: sec, ease: 'easeOut', times: [0, 0.55, 0.75, 1] }}
      />
    </AnchoredStage>
  );
}
