import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * The anchored card is recast: a card-shaped sheath spins over the real card
 * (as if it flips through faces) and settles on the new value, with a themed
 * swirl. Used by fool-reroll and fate-hollow-reroll.
 */
export default function RerollPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 64, model: 'swirl', spread: 110 }}>
      {/* Spinning sheath over the real card — reads as the face being recast. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          border: `1.5px solid ${accent}`,
          background: `linear-gradient(160deg, ${core}bb, ${core}44)`,
          boxShadow: `0 0 22px ${core}aa`,
          transformStyle: 'preserve-3d',
        }}
        initial={{ rotateY: 0, opacity: 0 }}
        animate={{ rotateY: [0, 540], opacity: [0, 1, 1, 0], scale: [1, 1, 1.06, 1] }}
        transition={{ duration: sec, ease: 'easeInOut', times: [0, 0.2, 0.8, 1] }}
      />
      {/* Settle pulse as the new value locks in. */}
      <motion.div
        style={{ position: 'absolute', inset: '-8%', borderRadius: 9, border: `2px solid ${accent}` }}
        initial={{ opacity: 0, scale: 1.2 }}
        animate={{ opacity: [0, 0, 0.9, 0], scale: [1.2, 1.2, 1, 1] }}
        transition={{ duration: sec, ease: 'easeOut', times: [0, 0.75, 0.9, 1] }}
      />
    </AnchoredStage>
  );
}
