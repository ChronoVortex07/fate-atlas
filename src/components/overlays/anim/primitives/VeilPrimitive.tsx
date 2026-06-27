import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * A shadow curtain falls over the anchored card and stays — used by
 * shadow-shroud, shadow-veil-position, fate-fated-card. The card's own veiled
 * state (rendered by FanCard / the minigame spread) persists the concealment
 * after the curtain settles.
 */
export default function VeilPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, deep] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage
      rect={rect}
      theme={theme}
      burst={{ count: 70, model: 'falling', blend: 'source-over', spread: 80 }}
    >
      {/* Opaque curtain falling from the top edge, concealing the card. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          transformOrigin: 'top center',
          background: `linear-gradient(180deg, #05030a 0%, ${deep} 55%, ${core}dd 100%)`,
          boxShadow: `0 0 24px ${core}aa, inset 0 0 20px #000`,
        }}
        initial={{ scaleY: 0, opacity: 0.6 }}
        animate={{ scaleY: 1, opacity: [0.6, 1, 1, 0.92] }}
        transition={{ duration: sec, ease: 'easeIn', times: [0, 0.5, 0.8, 1] }}
      />
      {/* Leading shimmer edge riding down with the curtain. */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${core}, transparent)`,
        }}
        initial={{ top: '0%', opacity: 0 }}
        animate={{ top: ['0%', '100%'], opacity: [0, 0.9, 0] }}
        transition={{ duration: sec * 0.7, ease: 'easeIn' }}
      />
    </AnchoredStage>
  );
}
