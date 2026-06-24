import type { Transition } from 'framer-motion';
import { CLOTH_RADIUS_SCALE } from './cloth';

// Maps a stone's normalized cloth coord (~[-1,1]) to a pixel center within a
// cloth of side `clothPx`. Stones are positioned via translate(-50%,-50%).
export function toPixel(stone: { x: number; y: number }, clothPx: number): { left: number; top: number } {
  const half = clothPx / 2;
  const r = half * CLOTH_RADIUS_SCALE;
  return { left: half + stone.x * r, top: half + stone.y * r };
}

// A slingshot aim: the player pulls BACK from the bag, and the runes fling the
// OPPOSITE way. Returns the cluster aim used by resolveScatter.
export function aimFrom(dragDx: number, dragDy: number, maxDist: number): { angle: number; power: number } {
  const dist = Math.hypot(dragDx, dragDy);
  const power = Math.min(1, dist / Math.max(1, maxDist));
  const angle = Math.atan2(-dragDy, -dragDx); // fling opposite the pull-back
  return { angle, power };
}

// Per-stone tumble during flight: a randomized spin that settles to upright.
export function tumble(index: number, merkstave: boolean): { rotate: number[] } {
  const spins = 360 * (1 + (index % 3));
  const rest = merkstave ? 180 : 0;
  return { rotate: [0, spins * 0.5, rest] };
}

// Settle spring — a snappy arrival with a little bounce, staggered per stone.
export function throwTransition(index: number): Transition {
  return { type: 'spring', stiffness: 320, damping: 18, delay: index * 0.06 };
}
