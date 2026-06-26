import { useId } from 'react';
import { motion } from 'framer-motion';
import MethodCardFront from './MethodCardFront';
import FateMark from '../shared/FateMark';
import { METHOD_FRONTS } from '../../data/method-cards';
import type { DivinationType } from '../../engine/types';

export type MethodCardVisual = 'face-down' | 'face-up' | 'shrouded';
export type MethodCardMotion = 'idle' | 'selected' | 'rejected' | 'fated';

export interface MethodCardProps {
  method: DivinationType;
  visual: MethodCardVisual;
  motion?: MethodCardMotion;
  interactive: boolean;
  onClick?: () => void;
  index: number;
}

export default function MethodCard({
  method, visual, motion: emphasis = 'idle', interactive, onClick, index,
}: MethodCardProps) {
  const flipped = visual !== 'face-down'; // face-up OR shrouded → rotated to front

  const motionState =
    emphasis === 'selected' ? { y: -22, scale: 1.06, boxShadow: '0 0 26px rgba(212,168,84,0.55)' }
    : emphasis === 'fated' ? { y: -14, scale: 1.04, boxShadow: '0 0 30px rgba(212,168,84,0.7)' }
    : emphasis === 'rejected' ? { y: 0, scale: 0.97, opacity: 0.4, filter: 'grayscale(0.4)' }
    : { y: 0, scale: 1, opacity: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' };

  return (
    <motion.button
      type="button"
      aria-label={METHOD_FRONTS[method].title}
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      style={cardBoxStyle}
      animate={motionState}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
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
          {visual === 'shrouded' ? <ShroudedFront /> : <MethodCardFront method={method} />}
        </div>
      </motion.div>
    </motion.button>
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

// Shadow-veiled front — drifting purple mist, an intricate 12-tick eye, VEILED.
function ShroudedFront() {
  const uid = useId();
  return (
    <div style={shroudedStyle}>
      <svg width="100%" height="100%" viewBox="0 0 140 210" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`${uid}-mist`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
          <radialGradient id={`${uid}-grad`} cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#2a1d40" stopOpacity="0.55" /><stop offset="100%" stopColor="#050308" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.g
          filter={`url(#${uid}-mist)`} opacity={0.7}
          animate={{ x: [0, 6, -4, 0], y: [0, -4, 3, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="44" cy="70" rx="40" ry="26" fill="#1c1230" />
          <ellipse cx="96" cy="120" rx="46" ry="30" fill="#140d24" />
          <ellipse cx="60" cy="160" rx="50" ry="24" fill="#1a1030" />
        </motion.g>
        <rect x="0" y="0" width="140" height="210" fill={`url(#${uid}-grad)`} />
      </svg>
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

const cardBoxStyle: React.CSSProperties = {
  width: 'var(--card-w)', height: 'var(--card-h)', flex: '0 0 auto',
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
