import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useParticles } from '../../../context/ParticleContext';
import type { ParticleModel } from '../ParticleField';
import type { Theme } from './theme';

export interface PrimitiveProps {
  rect: DOMRect | null;
  theme: Theme;
  durationMs: number;
  /** A second card rect (e.g. the mirror's source). Additive; most primitives ignore it. */
  sourceRect?: DOMRect | null;
}

interface StageProps {
  rect: DOMRect | null;
  theme: Theme;
  /** Particle burst fired once on mount. Omit for primitives that emit themselves. */
  burst?: { count: number; model?: ParticleModel; blend?: GlobalCompositeOperation; spread?: number };
  children: ReactNode;
}

// Fallback footprint when an anchor is unresolved — a card-sized box at viewport
// center, so an effect still reads as intentional instead of crashing/blanking.
function fallbackRect(): { left: number; top: number; width: number; height: number } {
  const w = 120, h = 168;
  return {
    left: (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 - w / 2,
    top: (typeof window !== 'undefined' ? window.innerHeight : 600) / 2 - h / 2,
    width: w,
    height: h,
  };
}

/**
 * Positions an effect's visuals over the real card's viewport rect (via a body
 * portal) and fires a themed particle burst there on mount. This is the shared
 * mechanism that makes every primitive play ON the card that changed.
 */
export default function AnchoredStage({ rect, theme, burst, children }: StageProps) {
  const { emit } = useParticles();
  const firedRef = useRef(false);

  const box = rect
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : fallbackRect();

  useEffect(() => {
    if (firedRef.current || !burst) return;
    firedRef.current = true;
    emit({
      origin: rect ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      count: burst.count,
      palette: theme.palette,
      model: burst.model ?? theme.model,
      blend: burst.blend,
      spread: burst.spread ?? Math.max(box.width, box.height),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        pointerEvents: 'none',
        zIndex: 28,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
