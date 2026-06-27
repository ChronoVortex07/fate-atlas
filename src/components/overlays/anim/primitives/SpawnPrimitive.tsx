import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * Punctuates a card arriving in an empty slot — used by chaos-second-result (a
 * second reading manifests), will-widen, etc. The real fan card materializes
 * (see FanCard's `appearing` state); this adds a themed burst + a shock ring so
 * the arrival lands, without drawing a competing card of its own.
 */
export default function SpawnPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 80, model: 'radial', spread: 130 }}>
      {/* Bright flash at the moment of arrival. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '-20%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}aa 0%, ${core}44 40%, transparent 70%)`,
        }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.2, 1.3, 1.6] }}
        transition={{ duration: sec * 0.45, ease: 'easeOut' }}
      />
      {/* Expanding shock ring framing the new card. */}
      <motion.div
        style={{ position: 'absolute', inset: '-10%', borderRadius: 10, border: `2px solid ${accent}` }}
        initial={{ opacity: 0.9, scale: 0.3 }}
        animate={{ opacity: 0, scale: 1.9 }}
        transition={{ duration: sec * 0.55, ease: 'easeOut' }}
      />
    </AnchoredStage>
  );
}
