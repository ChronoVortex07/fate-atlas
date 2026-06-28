import { useEffect, useMemo } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import '../../styles/corruption.css';

const RUPTURE_MS = 8000; // matches the 8s keyframe timeline

interface Star {
  left: string;
  top: string;
  big: boolean;
}

export default function RuptureInterstitial() {
  const { engine } = useGameEngine();

  useEffect(() => {
    const t = setTimeout(() => engine.completeRupture(), RUPTURE_MS);
    return () => clearTimeout(t);
  }, [engine]);

  // Replicate the 46-star JS generation from the mockup
  const stars = useMemo<Star[]>(() => {
    const out: Star[] = [];
    for (let i = 0; i < 46; i++) {
      out.push({
        left: (Math.random() * 100).toFixed(1) + '%',
        top: (Math.random() * 100).toFixed(1) + '%',
        big: Math.random() < 0.25,
      });
    }
    return out;
  }, []);

  return (
    <div className="cx-rupt-screen cx-rupt-tremor">
      {/* Starfield */}
      <div className="cx-rupt-stars">
        {stars.map((s, i) => (
          <i
            key={i}
            className={s.big ? 'cx-rupt-star cx-rupt-star--big' : 'cx-rupt-star'}
            style={{ left: s.left, top: s.top }}
          />
        ))}
      </div>

      {/* Red edge creep */}
      <div className="cx-rupt-creep" />

      {/* Eye-rift SVG */}
      <svg className="cx-rupt-eyerift" viewBox="-10 -14 90 124">
        <defs>
          <radialGradient id="cx-ir" cx="52%" cy="48%">
            <stop offset="0%" stopColor="#ff6678" />
            <stop offset="45%" stopColor="#c20f22" />
            <stop offset="100%" stopColor="#3a0410" />
          </radialGradient>
          <radialGradient id="cx-vd">
            <stop offset="0%" stopColor="#180108" />
            <stop offset="100%" stopColor="#07010c" />
          </radialGradient>
          <clipPath id="cx-rc">
            <path d="M32,5 L38,16 L34,24 L44,34 L40,42 L54,47 L44,52 L48,62 L38,70 L42,80 L32,88 L24,80 L26,70 L18,60 L22,50 L10,47 L20,40 L24,30 L16,22 L26,16 Z" />
          </clipPath>
        </defs>

        {/* Maw: the seam that pulls apart */}
        <g className="cx-rupt-maw">
          <rect className="cx-rupt-seg cx-rupt-seg--w1" x="8"  y="34" width="1.8" height="9" />
          <rect className="cx-rupt-seg cx-rupt-seg--w2" x="50" y="40" width="1.8" height="7" />
          <rect className="cx-rupt-seg cx-rupt-seg--w3" x="14" y="58" width="1.8" height="6" />
          <rect className="cx-rupt-seg cx-rupt-seg--w4" x="46" y="60" width="1.8" height="8" />
          <path
            className="cx-rupt-rip"
            d="M32,5 L38,16 L34,24 L44,34 L40,42 L54,47 L44,52 L48,62 L38,70 L42,80 L32,88 L24,80 L26,70 L18,60 L22,50 L10,47 L20,40 L24,30 L16,22 L26,16 Z"
          />
        </g>

        {/* Eye inside the rift */}
        <g clipPath="url(#cx-rc)">
          <g className="cx-rupt-iris-grp">
            <ellipse cx="32" cy="47" rx="14" ry="8" fill="#ff2d4a" fillOpacity=".18" />
            <path d="M20,47 Q32,38 44,47 Q32,56 20,47 Z" fill="#0c0306" />
            <circle cx="34" cy="47" r="6" fill="url(#cx-ir)" />
            <circle cx="34" cy="47" r="2.4" fill="#0a0002" />
            <circle cx="35.6" cy="44.8" r="1.2" fill="#ffd9dd" />
            <path className="cx-rupt-lid" d="M20,47 Q32,38 44,47 Q32,56 20,47 Z" fill="#0c0306" />
          </g>
          <circle className="cx-rupt-core" cx="34" cy="47" r="3" fill="#fff" />
        </g>
      </svg>

      {/* Full-screen cracks SVG */}
      <svg className="cx-rupt-cracks" viewBox="0 0 100 167" preserveAspectRatio="none">
        <path d="M50,70 L72,40 L80,18" />
        <path d="M50,70 L30,44 L16,22" />
        <path d="M50,70 L78,92 L96,110" />
        <path d="M50,70 L26,96 L8,128" />
        <path d="M50,70 L54,30 L48,2" />
        <path d="M50,70 L46,110 L52,150" />
      </svg>

      {/* Overlay layers: flash, void, thread, reform */}
      <div className="cx-rupt-flash" />
      <div className="cx-rupt-void" />
      <div className="cx-rupt-thread" />
      <div className="cx-rupt-reform" />
    </div>
  );
}
