import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import MethodCardFront, { type CorruptedProp } from './MethodCardFront';
import FateMark from '../shared/FateMark';
import { METHOD_FRONTS } from '../../data/method-cards';
import type { DivinationType } from '../../engine/types';

export type MethodCardVisual = 'face-down' | 'face-up' | 'shrouded' | 'revealing';
export type MethodCardMotion = 'idle' | 'selected' | 'rejected' | 'fated' | 'pressed';

export interface MethodCardProps {
  method: DivinationType;
  visual: MethodCardVisual;
  motion?: MethodCardMotion;
  interactive: boolean;
  onClick?: () => void;
  index: number;
  appeared?: boolean;     // deal-in gate: false → off-screen, true → dealt into place
  appearDelay?: number;   // stagger (seconds) for the deal-in
  dissolving?: boolean;   // Fate-thin: the card dissolves into gold motes and is removed
  phantom?: boolean;      // a placeholder card (the closing path) — never revealed, aria-hidden
  corrupted?: CorruptedProp; // telegraph infection band; null/undefined = normal
}

// Deal-in entrance: the card drops in from below, faded and small, with a slight
// tilt — played on the initial deal, on a refresh/swap (re-keyed by nonce), and
// when a Will-widened card arrives at its banner.
const DEAL_HIDDEN = { opacity: 0, y: 56, scale: 0.82, rotateZ: -5 };
const DEAL_SHOWN = { opacity: 1, y: 0, scale: 1, rotateZ: 0 };
// Fate-thin: the card brightens and shrinks away as it sheds motes.
const DISSOLVE = { opacity: 0, scale: 0.84, filter: 'brightness(1.6)' };

export default function MethodCard({
  method, visual, motion: emphasis = 'idle', interactive, onClick, index,
  appeared = true, appearDelay = 0, dissolving = false, phantom = false, corrupted = null,
}: MethodCardProps) {
  const flipped = visual !== 'face-down'; // face-up OR shrouded → rotated to front

  const motionState =
    emphasis === 'selected' ? { y: -22, scale: 1.06, boxShadow: '0 0 26px rgba(212,168,84,0.55)' }
    : emphasis === 'fated' ? { y: -14, scale: 1.04, boxShadow: '0 0 30px rgba(212,168,84,0.7)' }
    // pressed: the hand of fate forces the chosen card down before it is rejected.
    : emphasis === 'pressed' ? { y: 20, scale: 0.95, filter: 'brightness(0.6)', boxShadow: '0 10px 20px rgba(0,0,0,0.55)' }
    : emphasis === 'rejected' ? { y: 0, scale: 0.97, opacity: 0.4, filter: 'grayscale(0.5)' }
    : { y: 0, scale: 1, opacity: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' };

  return (
    <motion.div
      style={dealWrapStyle}
      initial={DEAL_HIDDEN}
      animate={appeared ? DEAL_SHOWN : DEAL_HIDDEN}
      transition={{ duration: 0.5, ease: [0.16, 0.84, 0.36, 1], delay: appeared ? appearDelay : 0 }}
    >
      <motion.button
        type="button"
        aria-label={phantom ? undefined : METHOD_FRONTS[method].title}
        aria-hidden={phantom || undefined}
        disabled={!interactive}
        onClick={interactive ? onClick : undefined}
        style={cardBoxStyle}
        className={corrupted === 'virulent' ? 'cx-card-virulent' : corrupted === 'spreading' ? 'cx-card-spreading' : undefined}
        animate={dissolving ? DISSOLVE : motionState}
        transition={dissolving ? { duration: 0.55, ease: 'easeIn' } : { type: 'spring', stiffness: 320, damping: 26 }}
        whileHover={interactive ? { y: -8, scale: 1.03 } : undefined}
        whileTap={interactive ? { scale: 0.99 } : undefined}
      >
        <motion.div
          style={flipInnerStyle}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut', delay: flipped ? index * 0.05 : 0 }}
        >
          {/* back */}
          <div style={faceStyle}>
            <CelestialVeilBack />
          </div>
          {/* front (rotated 180 so it reads correctly when flipped) */}
          <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
            {visual === 'shrouded' ? (
              <ShroudedFront />
            ) : visual === 'revealing' ? (
              // The real front beneath, with the fog dispersing over the top.
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <MethodCardFront method={method} />
                <ShroudFog dispersing />
              </div>
            ) : (
              <MethodCardFront method={method} corrupted={corrupted} />
            )}
          </div>
        </motion.div>
      </motion.button>
      {dissolving && <DissolveMotes />}
    </motion.div>
  );
}

// Unified card back — Celestial Veil: deep indigo, gold corner brackets,
// constellations filling the field, and the FateMark sigil at center.
function CelestialVeilBack() {
  const constellations = [
    [[14, 20], [22, 30], [18, 42], [30, 38]],
    [[70, 24], [78, 34], [68, 40]],
    [[16, 100], [26, 106], [20, 116], [32, 114]],
    [[66, 102], [74, 112], [64, 118]],
  ];
  return (
    <div style={backStyle}>
      <svg width="100%" height="100%" viewBox="0 0 88 132" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0 }}>
        <rect x="4" y="4" width="80" height="124" rx="8" fill="none" stroke="#d4a854" strokeWidth="0.7" opacity="0.4" />
        <g stroke="#d4a854" strokeWidth="1" opacity="0.7" fill="none">
          <path d="M9 9 h7 M9 9 v7" /><path d="M79 9 h-7 M79 9 v7" />
          <path d="M9 123 h7 M9 123 v-7" /><path d="M79 123 h-7 M79 123 v-7" />
        </g>
        {constellations.map((c, ci) => (
          <g key={ci}>
            {c.slice(1).map(([x, y], i) => (
              <line key={i} x1={c[i][0]} y1={c[i][1]} x2={x} y2={y} stroke="#5b7ec7" strokeWidth="0.4" opacity="0.5" />
            ))}
            {c.map(([x, y], i) => <circle key={`d${i}`} cx={x} cy={y} r="0.8" fill="#9fb6e0" opacity="0.9" />)}
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FateMark size={72} />
      </div>
    </div>
  );
}

// Drifting fractal-noise shroud cloud — violet-tinted dense mist (mirrors the
// strings-minigame fog approach). When `dispersing`, it fades, swells, and blurs
// away over ~0.6s to reveal whatever sits beneath it.
function ShroudFog({ dispersing = false }: { dispersing?: boolean }) {
  const uid = useId();
  const reduce = useReducedMotion();
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      initial={dispersing ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : false}
      animate={
        dispersing
          ? { opacity: 0, scale: 1.18, filter: 'blur(8px)' }
          : { opacity: 1, scale: 1, filter: 'blur(0px)' }
      }
      transition={dispersing ? { duration: 0.6, ease: 'easeOut' } : { duration: 0 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 140 210" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`${uid}-cloud`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves={5} seed={7} stitchTiles="stitch" result="n" />
            {/* violet shroud tint with a hard alpha ramp so the noise reads as dense mist */}
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.11  0 0 0 0 0.07  0 0 0 0 0.20  0 0 0 1.2 -0.35" />
          </filter>
          <radialGradient id={`${uid}-grad`} cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#2a1d40" stopOpacity="0.5" /><stop offset="100%" stopColor="#050308" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.rect
          x="-20" y="-20" width="180" height="250" filter={`url(#${uid}-cloud)`}
          animate={reduce ? undefined : { x: [-20, -8, -28, -20], y: [-20, -32, -10, -20] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <rect x="0" y="0" width="140" height="210" fill={`url(#${uid}-grad)`} />
      </svg>
    </motion.div>
  );
}

// Shadow-veiled front — fractal mist, an intricate 12-tick eye, VEILED.
function ShroudedFront() {
  return (
    <div style={shroudedStyle}>
      <ShroudFog />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '38%', display: 'flex', justifyContent: 'center' }}>
        <VeiledEye />
      </div>
      <span style={veiledLabelStyle}>VEILED</span>
    </div>
  );
}

// The veiled eye — an almond with a 12-tick iris, in muted violet.
function VeiledEye() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180;
    const x1 = 37 + Math.cos(a) * 8.5, y1 = 24 + Math.sin(a) * 8.5;
    const x2 = 37 + Math.cos(a) * 11, y2 = 24 + Math.sin(a) * 11;
    return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
  });
  return (
    <svg width="74" height="48" viewBox="0 0 74 48" aria-label="Veiled" style={{ opacity: 0.85 }}>
      <g stroke="#8a73b8" fill="none" strokeWidth="1.3" opacity="0.75">
        <path d="M4 24 C 18 4, 56 4, 70 24 C 56 44, 18 44, 4 24 Z" />
        <circle cx="37" cy="24" r="8.5" />
        {ticks}
      </g>
      <circle cx="37" cy="24" r="3.2" fill="#8a73b8" /><circle cx="37" cy="24" r="1.2" fill="#050308" />
    </svg>
  );
}

// Gold motes shed when a Fate-thinned card dissolves — small embers that drift
// up and outward from the card and wink out.
function DissolveMotes() {
  return (
    <div style={moteLayerStyle} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => {
        const ang = (i / 9) * Math.PI * 2;
        const dx = Math.cos(ang) * (16 + (i % 3) * 9);
        const dy = -36 - (i % 4) * 12; // bias the drift upward
        return (
          <motion.span
            key={i}
            style={moteStyle}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], x: dx, y: dy, scale: [0.4, 1, 0.2] }}
            transition={{ duration: 0.75, delay: (i % 5) * 0.04, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

const dealWrapStyle: React.CSSProperties = {
  position: 'relative', width: 'var(--card-w)', height: 'var(--card-h)', flex: '0 0 auto',
};

const moteLayerStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
};

const moteStyle: React.CSSProperties = {
  position: 'absolute', left: '50%', top: '45%', width: 5, height: 5, borderRadius: '50%',
  background: 'radial-gradient(circle, #f6e3a8, #d4a854)', boxShadow: '0 0 7px 2px rgba(212,168,84,0.7)',
};

const cardBoxStyle: React.CSSProperties = {
  display: 'block', width: '100%', height: '100%',
  padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
  perspective: '900px', borderRadius: '8px', outline: 'none',
};

const flipInnerStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
};

const faceStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '8px', overflow: 'hidden',
};

const backStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
  background: 'radial-gradient(120% 90% at 50% 32%, #1a1f3e 0%, #0a0d1c 80%)',
  border: '1px solid #2a3358', borderRadius: '8px', boxSizing: 'border-box',
};

const shroudedStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
  background: 'radial-gradient(120% 100% at 50% 45%, #160f24 0%, #050308 85%)',
  border: '1px solid #241c38', borderRadius: '8px', boxSizing: 'border-box',
};

const veiledLabelStyle: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: '16px', textAlign: 'center',
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.6rem',
  letterSpacing: '0.3em', color: '#6a5d88',
};
