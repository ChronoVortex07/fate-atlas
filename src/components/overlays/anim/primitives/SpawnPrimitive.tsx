import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * A card materializes into being on the anchored slot — used by
 * chaos-second-result (a second reading manifests), will-widen, etc. A
 * card-shaped sheath forms over the real fan card out of a themed burst, then
 * dissolves to reveal it, reading clearly as "a new card appeared here".
 */
export default function SpawnPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 70, model: 'radial', spread: 110 }}>
      {/* Forming sheath — exactly over the real card, scaling up out of nothing. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          border: `1.5px solid ${accent}`,
          background: `linear-gradient(165deg, ${core}cc, ${core}55)`,
          boxShadow: `0 0 26px ${core}cc, 0 0 60px ${core}66`,
        }}
        initial={{ opacity: 0, scale: 0.05, rotate: -18 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.05, 1.14, 1, 1], rotate: [-18, 6, 0, 0] }}
        transition={{ duration: sec, ease: 'easeOut', times: [0, 0.45, 0.7, 1] }}
      />
      {/* Expanding shock ring punctuating the moment of appearance. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: '-10%',
          borderRadius: 10,
          border: `2px solid ${accent}`,
        }}
        initial={{ opacity: 0.9, scale: 0.2 }}
        animate={{ opacity: 0, scale: 1.8 }}
        transition={{ duration: sec * 0.5, ease: 'easeOut' }}
      />
    </AnchoredStage>
  );
}
