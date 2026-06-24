import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { AstralCast } from '../../engine/types';
import { drawAstralCast } from '../../data/astromancy';
import { createCelestialScene, type CelestialSceneController } from './celestial/scene';

export interface CelestialCastHandle {
  roll: (target?: AstralCast | null) => void;
}

interface Props {
  affinities: Record<string, number>;
  onSettled: (cast: AstralCast) => void;
}

function canUse3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const CelestialCast = forwardRef<CelestialCastHandle, Props>(function CelestialCast(
  { affinities, onSettled },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<CelestialSceneController | null>(null);
  const settledRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const use3DRef = useRef(false);

  // Wrap onSettled so it can only fire once per roll.
  const fireSettled = (cast: AstralCast) => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettledRef.current(cast);
  };

  useEffect(() => {
    use3DRef.current = canUse3D();
    if (use3DRef.current && canvasRef.current) {
      sceneRef.current = createCelestialScene({
        canvas: canvasRef.current,
        affinities,
        onSettled: fireSettled,
      });
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    roll(target?: AstralCast | null) {
      settledRef.current = false;
      if (use3DRef.current && sceneRef.current) {
        sceneRef.current.roll(target ?? null);
      } else {
        // Fallback: resolve instantly with a valid affinity-biased cast.
        const cast = target ?? drawAstralCast(affinities);
        setTimeout(() => fireSettled(cast), 600);
      }
    },
  }));

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
});

export default CelestialCast;

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: 'min(440px, 80vw)',
  height: 'min(440px, 80vw)',
  userSelect: 'none',
};

const canvasStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};
