import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * The card's nature intensifies: particles implode inward to the card center and
 * a card-framed pulse brightens then deepens. Used by suit-accord (a pure suit
 * deepens) and elemental-clash (opposing elements grind) — both themed off the
 * triggering card's element via `themeFor`.
 */
export default function AmplifyPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 60, model: 'implode', spread: 120 }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `2px solid ${accent}`,
          boxShadow: `inset 0 0 24px ${core}aa, 0 0 26px ${core}88` }}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [1.1, 1.04, 1, 1] }}
        transition={{ duration: sec, ease: 'easeIn', times: [0, 0.55, 0.8, 1] }}
      />
    </AnchoredStage>
  );
}
