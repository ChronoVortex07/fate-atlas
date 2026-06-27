import { useEffect, useRef } from 'react';

// Motion archetypes a burst can use. The theme picks one to match its vibe.
export type ParticleModel =
  | 'radial'   // fly outward in all directions (bursts, light bloom)
  | 'rising'   // drift upward (life-motes, embers)
  | 'falling'  // sink downward (ink-smoke, stone-dust)
  | 'swirl'    // tangential orbit (threads, ripples)
  | 'implode'  // start on a ring, rush inward (order locking, amplify)
  | 'shard';   // few, fast, long streaks (chaos fracture)

export interface BurstSpec {
  origin: DOMRect | { x: number; y: number };
  count: number;
  palette: string[];
  model: ParticleModel;
  gravity?: number;      // px/s² applied to vy
  lifetimeMs?: number;   // base particle life
  spread?: number;       // px radius particles can reach
  size?: number;         // base particle radius
  blend?: GlobalCompositeOperation;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number; color: string;
  gravity: number;
  streak: boolean;
  blend: GlobalCompositeOperation;
}

const MAX_PER_BURST = 200;

// Module-level so the imperative `emit` (exposed through context) and the single
// rAF loop in the mounted <ParticleField/> share one particle pool.
let particles: Particle[] = [];
let drawHook: (() => void) | null = null;

function centerOf(origin: BurstSpec['origin']): { x: number; y: number } {
  return 'width' in origin
    ? { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 }
    : { x: origin.x, y: origin.y };
}

export function emitBurst(spec: BurstSpec): void {
  const c = centerOf(spec.origin);
  const n = Math.min(spec.count, MAX_PER_BURST);
  const spread = spec.spread ?? 90;
  const baseLife = spec.lifetimeMs ?? 900;
  const baseSize = spec.size ?? 3;
  const gravity = spec.gravity ?? 0;
  const blend = spec.blend ?? 'lighter';
  const half = 'width' in spec.origin ? spec.origin.height / 2 : 0;

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const color = spec.palette[i % spec.palette.length];
    const speed = (spread / (baseLife / 1000)) * (0.4 + Math.random() * 0.6);
    let vx = 0, vy = 0, x = c.x, y = c.y, streak = false;

    switch (spec.model) {
      case 'radial': {
        const a = t * Math.PI * 2 + Math.random() * 0.5;
        vx = Math.cos(a) * speed; vy = Math.sin(a) * speed;
        break;
      }
      case 'rising': {
        x = c.x + (Math.random() - 0.5) * spread;
        vx = (Math.random() - 0.5) * speed * 0.4;
        vy = -speed * (0.5 + Math.random());
        break;
      }
      case 'falling': {
        x = c.x + (Math.random() - 0.5) * spread;
        y = c.y - half;
        vx = (Math.random() - 0.5) * speed * 0.4;
        vy = speed * (0.3 + Math.random() * 0.7);
        break;
      }
      case 'swirl': {
        const a = t * Math.PI * 2;
        vx = -Math.sin(a) * speed; vy = Math.cos(a) * speed * 0.6;
        x = c.x + Math.cos(a) * spread * 0.3;
        y = c.y + Math.sin(a) * spread * 0.3;
        break;
      }
      case 'implode': {
        const a = t * Math.PI * 2;
        x = c.x + Math.cos(a) * spread;
        y = c.y + Math.sin(a) * spread;
        vx = -Math.cos(a) * speed; vy = -Math.sin(a) * speed;
        break;
      }
      case 'shard': {
        const a = t * Math.PI * 2 + Math.random() * 0.3;
        const fast = speed * (1.6 + Math.random());
        vx = Math.cos(a) * fast; vy = Math.sin(a) * fast;
        streak = true;
        break;
      }
    }

    const max = baseLife * (0.6 + Math.random() * 0.6);
    particles.push({
      x, y, vx, vy, life: max, max,
      size: baseSize * (0.6 + Math.random() * 0.8),
      color, gravity, streak, blend,
    });
  }
  if (particles.length > 0) drawHook?.();
}

/**
 * One shared full-viewport canvas driven by a single rAF loop. Invisible and
 * idle (rAF cancelled) when no particles are live. This is the substrate that
 * lets bursts use hundreds of GPU-composited particles instead of a handful of
 * DOM divs — the difference between "a few dots" and embers/shards/smoke.
 */
export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000 || 0);
      lastRef.current = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt * 1000;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        const px = p.x, py = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = Math.max(0, Math.min(1, p.life / p.max));
        ctx.globalCompositeOperation = p.blend;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.fillStyle = p.color;
        if (p.streak) {
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha + 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
      }
    };

    // Let emitBurst wake the loop when particles arrive while it's asleep.
    drawHook = () => {
      if (rafRef.current === null) {
        lastRef.current = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      drawHook = null;
      particles = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    />
  );
}
