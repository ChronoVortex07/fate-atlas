import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { RollMode } from '../../../engine/types';
import { createDiceScene, type DiceSceneController, type FlickVector } from './scene';

export type { FlickVector };

export interface DiceCastHandle {
  rollCheck(targets: number[], mode: RollMode, flick?: FlickVector): void;
  rollModifiers(blessValues: number[], baneValues: number[]): void;
}

interface Props {
  affinities: Record<string, number>;
  idle: boolean;                              // capture flick only while idle
  onFlick: (flick: FlickVector) => void;      // press-drag-release on the canvas
  onResolved: (keptD20: number) => void;
  onChoiceReady: (values: [number, number]) => void;
  onModifiersResolved: () => void;
}

export function canUse3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const DiceCast = forwardRef<DiceCastHandle, Props>(function DiceCast(
  { affinities, idle, onFlick, onResolved, onChoiceReady, onModifiersResolved },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<DiceSceneController | null>(null);
  const drag = useRef<{ x: number; y: number; t: number } | null>(null);
  const cbs = useRef({ onResolved, onChoiceReady, onModifiersResolved, onFlick, idle });
  cbs.current = { onResolved, onChoiceReady, onModifiersResolved, onFlick, idle };

  useEffect(() => {
    if (!canvasRef.current) return;
    sceneRef.current = createDiceScene({
      canvas: canvasRef.current,
      affinities,
      onResolved: (v) => cbs.current.onResolved(v),
      onChoiceReady: (v) => cbs.current.onChoiceReady(v),
      onModifiersResolved: () => cbs.current.onModifiersResolved(),
    });
    return () => { sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    rollCheck: (targets, mode, flick) => sceneRef.current?.rollCheck(targets, mode, flick),
    rollModifiers: (bless, bane) => sceneRef.current?.rollModifiers(bless, bane),
  }), []);

  // ── Flick gesture: press → drag back → release maps to a throw vector. ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!cbs.current.idle) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!cbs.current.idle || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    const dt = Math.max(16, performance.now() - drag.current.t);
    const power = Math.min(1, Math.hypot(dx, dy) / 200);
    // Screen drag → bowl plane. Pulling DOWN on screen (dy>0) throws AWAY (−z).
    // Clamp each axis so a fast flick can't fling a die off the (invisible) ring.
    const clamp = (n: number, m: number) => Math.max(-m, Math.min(m, n));
    const flick: FlickVector = {
      vx: clamp((dx / dt) * 6, 9),
      vz: clamp((dy / dt) * 6, 9),
      power: Math.max(0.15, power),
    };
    drag.current = null;
    cbs.current.onFlick(flick);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ width: 420, height: 420, maxWidth: '100%', touchAction: 'none', cursor: idle ? 'grab' : 'default' }}
    />
  );
});

export default DiceCast;
