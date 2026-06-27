import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * A new card materializes beside the source. Used by chaos-second-result (a
 * duplicate fractures off), will-widen, major-convergence, etc. The ghost card
 * scales/rotates into being out of a themed particle burst.
 */
export default function SpawnPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 90, spread: 130 }}>
      {/* Ghost card emerging to the right of the original. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          left: '60%',
          borderRadius: 8,
          border: `1.5px solid ${accent}`,
          background: `linear-gradient(160deg, ${core}33, ${accent}11)`,
          boxShadow: `0 0 26px ${core}aa, 0 0 60px ${core}55`,
        }}
        initial={{ opacity: 0, scale: 0.2, rotate: -12 }}
        animate={{
          opacity: [0, 1, 1, 0.9],
          scale: [0.2, 1.12, 1],
          rotate: [-12, 4, 0],
        }}
        transition={{ duration: sec * 0.8, ease: 'easeOut', times: [0, 0.5, 0.75, 1] }}
      />
      {/* Fracture flash across the original. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          background: `linear-gradient(105deg, transparent 40%, ${accent}cc 50%, transparent 60%)`,
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0, x: '-30%' }}
        animate={{ opacity: [0, 1, 0], x: ['-30%', '30%', '60%'] }}
        transition={{ duration: sec * 0.4, ease: 'easeOut' }}
      />
    </AnchoredStage>
  );
}
