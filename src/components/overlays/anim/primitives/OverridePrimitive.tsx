import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * The weave overrides a card: the rejected card greys out and slides away while
 * a fresh themed card sheath rises into its place. Two stacked layers over the
 * real card. Used by fate-deal-swap (a dealt card is changed before it turns)
 * and the other Fate OVERRIDE-band effects.
 */
export default function OverridePrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 48, model: 'shard', spread: 100 }}>
      {/* Rejected card: desaturates and slides off. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, border: '1.5px solid #555',
          background: 'linear-gradient(160deg, #3a3a44dd, #15151acc)', filter: 'grayscale(1)' }}
        initial={{ opacity: 0, x: 0, rotate: 0 }}
        animate={{ opacity: [0, 0.9, 0.7, 0], x: [0, 8, -64], rotate: [0, 2, -12] }}
        transition={{ duration: sec * 0.6, ease: 'easeIn' }}
      />
      {/* Replacement card: rises into its place in the theme color. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `1.5px solid ${accent}`,
          background: `linear-gradient(160deg, ${core}cc, ${core}44)`, boxShadow: `0 0 24px ${core}aa` }}
        initial={{ opacity: 0, y: '60%', scale: 0.9 }}
        animate={{ opacity: [0, 1, 1, 0], y: ['60%', '0%', '0%', '0%'], scale: [0.9, 1, 1, 1] }}
        transition={{ duration: sec, ease: 'easeOut', times: [0, 0.5, 0.85, 1] }}
      />
    </AnchoredStage>
  );
}
