import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useParticles } from '../../../../context/ParticleContext';
import type { PrimitiveProps } from '../AnchoredStage';

/**
 * Screen-level intrusion (NOT card-anchored): a jagged chaos rift tears across
 * the viewport, sprays shard particles, then snaps shut — used by
 * chaos-happening-interrupt ("the weave tears — something intrudes") right
 * before the happening screen appears. `rect` (if any) only seeds the particle
 * origin; the rift itself is full-viewport. An edge vignette keeps the centered
 * info banner legible while the screen frays around it.
 */
export default function InterruptPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const { emit } = useParticles();
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  const W = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;

  useEffect(() => {
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: W / 2, y: H / 2 };
    emit({ origin, count: 100, palette: theme.palette, model: 'shard', spread: Math.max(W, H), blend: 'screen' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A jagged tear across the upper third — clear of the centered banner.
  const yBase = H * 0.3;
  const seg = 9;
  const pts = Array.from({ length: seg + 1 }, (_, i) => {
    const x = (W * i) / seg;
    const jitter = i === 0 || i === seg ? 0 : (i % 2 ? -1 : 1) * (18 + ((i * 17) % 46));
    return `${x},${yBase + jitter}`;
  });
  const d = `M ${pts.join(' L ')}`;

  return createPortal(
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 28, overflow: 'hidden' }}>
      {/* Edge vignette — the world frays at the edges; the banner stays clear. */}
      <motion.div
        style={{ position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 50% 46%, transparent 34%, ${core}33 62%, #080403aa 100%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: sec, times: [0, 0.3, 0.7, 1] }}
      />
      {/* The jagged tear: a glowing rift drawn on, then snapping shut, with a hot core. */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <motion.path
          d={d} fill="none" stroke={accent} strokeWidth={4} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${core})` }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: sec, ease: 'easeInOut', times: [0, 0.4, 0.75, 1] }}
        />
        <motion.path
          d={d} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1], opacity: [0, 0.95, 0] }}
          transition={{ duration: sec * 0.85, ease: 'easeInOut', times: [0, 0.5, 1] }}
        />
      </svg>
    </div>,
    document.body,
  );
}
