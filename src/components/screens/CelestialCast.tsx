import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import type { AstralCast, OmenTag } from '../../engine/types';
import AstralSigil from '../cards/AstralSigil';

// ── Geometry constants ──────────────────────────────────────────────────────
const SIZE = 400;
const CENTER = { x: SIZE / 2, y: SIZE / 2 };
const BOARD_R = 168;      // inner edge of the bowl wall ring
const DIE_R = 20;         // radius of each die circle body
const WALL_SEGS = 28;     // number of wall segments approximating the circle

// ── House calculation ────────────────────────────────────────────────────────
// Returns 1..12 based on (x, y) position relative to CENTER.
// House 1 starts at the top (12 o'clock) and increases clockwise.
function sectorOf(x: number, y: number): number {
  const a = Math.atan2(y - CENTER.y, x - CENTER.x); // -π..π, 0=right, -π/2=top
  const t = ((a + Math.PI * 2.5) % (Math.PI * 2));  // rotate so 0=top, increases CW
  return (Math.floor(t / (Math.PI / 6)) % 12) + 1;  // 12 sectors → 1..12
}

// ── House label positions (for the ring display) ────────────────────────────
const HOUSE_LABEL_R = BOARD_R + 22;

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  affinities: Record<string, number>;
  faces: AstralCast;       // drawn planet/sign to display
  onSettled: (cast: AstralCast) => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CelestialCast({ affinities, faces, onSettled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [settled, setSettled] = useState(false);
  const [planetPos, setPlanetPos] = useState<{ x: number; y: number } | null>(null);
  const [signPos,   setSignPos]   = useState<{ x: number; y: number } | null>(null);

  // Guard: onSettled must fire exactly once.
  const settledRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Matter.js setup ───────────────────────────────────────────────────────
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    const world = engine.world;

    // Bowl: ring of static wall segments just outside BOARD_R
    const wallR = BOARD_R + DIE_R + 2;
    const walls = Array.from({ length: WALL_SEGS }, (_, i) => {
      const a = (i / WALL_SEGS) * Math.PI * 2;
      const segLen = (2 * Math.PI * wallR) / WALL_SEGS + 2; // slight overlap
      return Matter.Bodies.rectangle(
        CENTER.x + Math.cos(a) * wallR,
        CENTER.y + Math.sin(a) * wallR,
        segLen, 14,
        { isStatic: true, angle: a, friction: 0.3, restitution: 0.55,
          render: { visible: false } },
      );
    });

    // Affinity parameters
    const chaos  = (affinities['chaos']  ?? 50) / 100;
    const order  = (affinities['order']  ?? 50) / 100;
    const light  = (affinities['light']  ?? 50) / 100;
    const shadow = (affinities['shadow'] ?? 50) / 100;

    // Lateral drift: light pushes right, shadow pushes left
    const lateralBias = (light - shadow) * 0.000015;

    // Create a die body, started near the top, offset left/right
    const mkDie = (dx: number): Matter.Body => {
      const b = Matter.Bodies.circle(
        CENTER.x + dx,
        CENTER.y - BOARD_R * 0.6,
        DIE_R,
        { restitution: 0.58, frictionAir: 0.018, friction: 0.2, density: 0.002 },
      );
      // Launch impulse — chaos widens scatter, order tightens it
      const scatterScale = 0.5 + chaos * 1.5;
      Matter.Body.setVelocity(b, {
        x: (Math.random() - 0.5) * 8 * scatterScale + dx * 0.04,
        y: 5 + Math.random() * 5 * scatterScale,
      });
      Matter.Body.setAngularVelocity(b, (Math.random() - 0.5) * (0.5 + chaos * 1.2));
      return b;
    };

    const planetBody = mkDie(-30);
    const signBody   = mkDie(+30);
    Matter.Composite.add(world, [...walls, planetBody, signBody]);

    // ── Canvas rendering helpers ──────────────────────────────────────────────
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawBoard = (c: CanvasRenderingContext2D) => {
      // Deep background
      c.clearRect(0, 0, SIZE, SIZE);

      // Outer glow ring
      const grad = c.createRadialGradient(CENTER.x, CENTER.y, BOARD_R - 8, CENTER.x, CENTER.y, BOARD_R + 20);
      grad.addColorStop(0, 'rgba(212, 168, 84, 0.18)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(CENTER.x, CENTER.y, BOARD_R + 20, 0, Math.PI * 2);
      c.fill();

      // Board fill
      const fill = c.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, BOARD_R);
      fill.addColorStop(0, '#0a0d18');
      fill.addColorStop(0.6, '#0d1220');
      fill.addColorStop(1, '#131a30');
      c.fillStyle = fill;
      c.beginPath();
      c.arc(CENTER.x, CENTER.y, BOARD_R, 0, Math.PI * 2);
      c.fill();

      // House dividers (spoke lines for 12 sectors)
      c.save();
      c.strokeStyle = 'rgba(212, 168, 84, 0.2)';
      c.lineWidth = 0.8;
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2 - Math.PI / 2; // start top
        c.beginPath();
        c.moveTo(CENTER.x + Math.cos(a) * (BOARD_R * 0.18), CENTER.y + Math.sin(a) * (BOARD_R * 0.18));
        c.lineTo(CENTER.x + Math.cos(a) * BOARD_R,          CENTER.y + Math.sin(a) * BOARD_R);
        c.stroke();
      }
      c.restore();

      // House numbers (1..12 around the ring)
      c.save();
      c.fillStyle = 'rgba(212, 168, 84, 0.55)';
      c.font = '11px "Cormorant Garamond", serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let h = 1; h <= 12; h++) {
        // Mid-angle of sector h: sector 1 starts at -π/2, each sector is π/6 wide
        const midA = ((h - 1) / 12) * Math.PI * 2 - Math.PI / 2 + Math.PI / 12;
        const lx = CENTER.x + Math.cos(midA) * HOUSE_LABEL_R;
        const ly = CENTER.y + Math.sin(midA) * HOUSE_LABEL_R;
        c.fillText(String(h), lx, ly);
      }
      c.restore();

      // Board rim
      c.save();
      c.strokeStyle = 'rgba(212, 168, 84, 0.5)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(CENTER.x, CENTER.y, BOARD_R, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      // Centre star glyph
      c.save();
      c.fillStyle = 'rgba(212, 168, 84, 0.12)';
      c.font = '28px "Cormorant Garamond", serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('✦', CENTER.x, CENTER.y);
      c.restore();
    };

    const drawDie = (
      c: CanvasRenderingContext2D,
      body: Matter.Body,
      color: string,
      label: string,
      angle: number,
      isSettled: boolean,
    ) => {
      const { x, y } = body.position;
      c.save();
      c.translate(x, y);
      c.rotate(angle);

      // Die shadow
      c.shadowColor = color;
      c.shadowBlur = isSettled ? 14 : 6;

      // Die body (rounded square)
      const s = DIE_R;
      const r = 5;
      c.beginPath();
      c.moveTo(-s + r, -s);
      c.lineTo(s - r,  -s);
      c.quadraticCurveTo(s, -s, s, -s + r);
      c.lineTo(s,  s - r);
      c.quadraticCurveTo(s, s, s - r, s);
      c.lineTo(-s + r, s);
      c.quadraticCurveTo(-s, s, -s, s - r);
      c.lineTo(-s, -s + r);
      c.quadraticCurveTo(-s, -s, -s + r, -s);
      c.closePath();

      // Fill
      const dg = c.createRadialGradient(-4, -4, 0, 0, 0, s * 1.4);
      dg.addColorStop(0, '#1a2440');
      dg.addColorStop(1, '#0d1220');
      c.fillStyle = dg;
      c.fill();

      // Border
      c.strokeStyle = color;
      c.lineWidth = isSettled ? 1.8 : 1.2;
      c.stroke();

      // Glyph (always visible; the "reveal" is the color brightening on settle)
      c.shadowBlur = 0;
      c.fillStyle = isSettled ? color : 'rgba(212, 168, 84, 0.35)';
      c.font = `${s * 0.9}px "Cormorant Garamond", serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 0, 1);

      c.restore();
    };

    // ── Simulation loop ───────────────────────────────────────────────────────
    let still = 0, ticks = 0, rafId = 0;
    let lastPlanetAngle = 0, lastSignAngle = 0;

    const centreForce = (b: Matter.Body, k: number) =>
      Matter.Body.applyForce(b, b.position, {
        x: (CENTER.x - b.position.x) * k,
        y: (CENTER.y - b.position.y) * k,
      });

    const finalize = () => {
      if (settledRef.current) return;
      settledRef.current = true;

      const dist = (b: Matter.Body) =>
        Math.hypot(b.position.x - CENTER.x, b.position.y - CENTER.y);
      const omens: OmenTag[] = [];
      if (dist(planetBody) > BOARD_R || dist(signBody) > BOARD_R)
        omens.push('errant-star');
      if (Math.hypot(
        planetBody.position.x - signBody.position.x,
        planetBody.position.y - signBody.position.y,
      ) < DIE_R * 2.3)
        omens.push('crowned-conjunction');
      if (ticks > 600)
        omens.push('veiled-oracle');

      const pPos = { x: planetBody.position.x, y: planetBody.position.y };
      const sPos = { x: signBody.position.x,   y: signBody.position.y };
      setPlanetPos(pPos);
      setSignPos(sPos);
      setSettled(true);

      onSettled({
        planet:      faces.planet,
        sign:        faces.sign,
        planetHouse: sectorOf(pPos.x, pPos.y),
        signHouse:   sectorOf(sPos.x, sPos.y),
        omens,
      });
    };

    const step = () => {
      ticks++;

      // Order: centering pull, scaled by affinity (0.00001..0.00004)
      const orderK = 0.000008 + order * 0.000025;
      centreForce(planetBody, orderK);
      centreForce(signBody,   orderK);

      // Lateral bias from light/shadow imbalance
      if (Math.abs(lateralBias) > 0) {
        Matter.Body.applyForce(planetBody, planetBody.position, { x: lateralBias, y: 0 });
        Matter.Body.applyForce(signBody,   signBody.position,   { x: lateralBias, y: 0 });
      }

      // Chaos: random turbulence kick, proportional to chaos affinity
      if (chaos > 0.4 && ticks % 8 === 0) {
        const kick = (chaos - 0.4) * 0.0004;
        Matter.Body.applyForce(planetBody, planetBody.position, {
          x: (Math.random() - 0.5) * kick,
          y: (Math.random() - 0.5) * kick,
        });
        Matter.Body.applyForce(signBody, signBody.position, {
          x: (Math.random() - 0.5) * kick,
          y: (Math.random() - 0.5) * kick,
        });
      }

      Matter.Engine.update(engine, 1000 / 60);

      // Track angles for drawing
      lastPlanetAngle = planetBody.angle;
      lastSignAngle   = signBody.angle;

      // Draw frame
      if (ctx) {
        drawBoard(ctx);
        drawDie(ctx, planetBody, '#d4a854', '⊙', lastPlanetAngle, false);
        drawDie(ctx, signBody,   '#7ba7c7', '☽', lastSignAngle,   false);
      }

      // Settle detection: both bodies near-still for N ticks
      const speed = planetBody.speed + signBody.speed;
      still = speed < 0.35 ? still + 1 : 0;

      if (still > 40 || ticks > 700) {
        finalize();
        // Draw one final settled frame
        if (ctx) {
          drawBoard(ctx);
          drawDie(ctx, planetBody, '#d4a854', '⊙', lastPlanetAngle, true);
          drawDie(ctx, signBody,   '#7ba7c7', '☽', lastSignAngle,   true);
        }
        return;
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={containerStyle}>
      {/* Physics canvas */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={canvasStyle}
      />

      {/* House labels overlay — hidden until settled */}
      {settled && (
        <div style={overlayStyle} aria-label="Cast results">
          {planetPos && (
            <div
              style={{
                ...glyphOverlayStyle,
                left: planetPos.x - 18,
                top:  planetPos.y - 18,
              }}
            >
              <AstralSigil kind="planet" id={faces.planet} size={36} />
            </div>
          )}
          {signPos && (
            <div
              style={{
                ...glyphOverlayStyle,
                left: signPos.x - 18,
                top:  signPos.y - 18,
              }}
            >
              <AstralSigil kind="sign" id={faces.sign} size={36} />
            </div>
          )}
        </div>
      )}

      {/* Settling indicator */}
      {!settled && (
        <div style={settlingStyle}>
          casting…
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: SIZE,
  height: SIZE,
  userSelect: 'none',
};

const canvasStyle: React.CSSProperties = {
  display: 'block',
  borderRadius: '50%',
  background: 'transparent',
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const glyphOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
};

const settlingStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 8,
  left: 0,
  right: 0,
  textAlign: 'center',
  fontSize: '0.75rem',
  color: 'rgba(212, 168, 84, 0.5)',
  fontFamily: "'Cormorant Garamond', serif",
  letterSpacing: '0.15em',
  pointerEvents: 'none',
};
