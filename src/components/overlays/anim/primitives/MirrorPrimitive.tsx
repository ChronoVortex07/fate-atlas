import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

/**
 * Two forces reflect across the weave: the target card (`rect`) and the source
 * card (`sourceRect`) each do a synchronized flip-pulse, and a shimmering
 * reflection arc is drawn between their centers. Used by `mirror` (two
 * reversibles flip) and `iching-resonant-change` (changing lines stir a kindred
 * reversible). With no source rect it degrades to a single-card flip on `rect`.
 */
export default function MirrorPrimitive({ rect, theme, durationMs, sourceRect }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;

  return (
    <>
      <AnchoredStage rect={rect} theme={theme} burst={{ count: 44, model: 'swirl', spread: 90 }}>
        <MirrorFlash core={core} accent={accent} sec={sec} />
      </AnchoredStage>
      {sourceRect && (
        <AnchoredStage rect={sourceRect} theme={theme} burst={{ count: 44, model: 'swirl', spread: 90 }}>
          <MirrorFlash core={core} accent={accent} sec={sec} />
        </AnchoredStage>
      )}
      {rect && sourceRect && (
        <ReflectionArc rect={rect} sourceRect={sourceRect} core={core} accent={accent} sec={sec} />
      )}
    </>
  );
}

// A card-shaped sheath flipping over the real card — both cards run it in sync.
function MirrorFlash({ core, accent, sec }: { core: string; accent: string; sec: number }) {
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `1.5px solid ${accent}`,
        background: `linear-gradient(160deg, ${core}aa, ${core}22)`, boxShadow: `0 0 20px ${core}99`,
        transformStyle: 'preserve-3d' }}
      initial={{ rotateY: 0, opacity: 0 }}
      animate={{ rotateY: [0, 180], opacity: [0, 1, 1, 0] }}
      transition={{ duration: sec, ease: 'easeInOut', times: [0, 0.2, 0.8, 1] }}
    />
  );
}

const centerOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// A bowed gradient line drawn between the two card centers, in its own
// full-viewport body portal, that draws on and shimmers out.
function ReflectionArc({ rect, sourceRect, core, accent, sec }: {
  rect: DOMRect; sourceRect: DOMRect; core: string; accent: string; sec: number;
}) {
  const a = centerOf(rect);
  const b = centerOf(sourceRect);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Bow the arc perpendicular to the chord so it reads as a reflection, not a tie.
  const nx = -dy / len, ny = dx / len;
  const bow = Math.min(120, len * 0.25);
  const d = `M ${a.x} ${a.y} Q ${mx + nx * bow} ${my + ny * bow} ${b.x} ${b.y}`;

  return createPortal(
    <svg
      aria-hidden
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 27 }}
    >
      <defs>
        <linearGradient id="mirror-arc" x1={a.x} y1={a.y} x2={b.x} y2={b.y} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={accent} />
          <stop offset="50%" stopColor={core} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>
      <motion.path
        d={d} fill="none" stroke="url(#mirror-arc)" strokeWidth={2.5} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${core})` }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
        transition={{ duration: sec, ease: 'easeInOut', times: [0, 0.5, 1] }}
      />
    </svg>,
    document.body,
  );
}
