import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * A veil descends over the card and it dims/desaturates. Used by shadow-shroud,
 * shadow-veil-position, and fate-fated-card. Ink-smoke falls as `source-over`
 * particles so the darkness reads as concealment, not glow.
 */
export default function VeilPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, deep] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <AnchoredStage
      rect={rect}
      theme={theme}
      burst={{ count: 60, model: 'falling', blend: 'source-over', spread: 90 }}
    >
      {/* Curtain falling from the top edge over the card. */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          transformOrigin: 'top center',
          background: `linear-gradient(180deg, ${deep}f2 0%, ${core}cc 100%)`,
          boxShadow: `0 0 22px ${core}88`,
        }}
        initial={{ scaleY: 0, opacity: 0.2 }}
        animate={{ scaleY: [0, 1, 1, 0.9], opacity: [0.2, 0.95, 0.9, 0.7] }}
        transition={{ duration: sec, ease: 'easeIn', times: [0, 0.5, 0.8, 1] }}
      />
      {/* Edge shimmer riding down with the veil. */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${core}, transparent)`,
        }}
        initial={{ top: '0%', opacity: 0 }}
        animate={{ top: ['0%', '100%'], opacity: [0, 0.8, 0] }}
        transition={{ duration: sec * 0.8, ease: 'easeIn' }}
      />
    </AnchoredStage>
  );
}
