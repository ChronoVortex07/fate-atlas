import { useMemo } from 'react';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';

interface DustStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

interface MediumStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

// Seeded pseudo-random based on a simple hash
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDustStars(seed: number, count: number): DustStar[] {
  const rng = seededRandom(seed);
  const stars: DustStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      cx: rng() * 100,
      cy: rng() * 100,
      r: rng() * 0.4 + 0.4,
      opacity: rng() * 0.3 + 0.15,
    });
  }
  return stars;
}

function generateMediumStars(seed: number, count: number): MediumStar[] {
  const rng = seededRandom(seed + 9999);
  const stars: MediumStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      cx: rng() * 100,
      cy: rng() * 100,
      r: rng() * 0.5 + 0.8,
      opacity: rng() * 0.3 + 0.35,
    });
  }
  return stars;
}

export default function StarField() {
  const dustStars = useMemo(() => generateDustStars(42, 60), []);
  const mediumStars = useMemo(() => generateMediumStars(137, 15), []);

  return (
    <div style={containerStyle}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
      >
        <defs>
          {/* Nebula gradients */}
          <radialGradient id="nebula-purple" cx="30%" cy="35%">
            <stop offset="0%" stopColor="#2a1545" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2a1545" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula-teal" cx="70%" cy="60%">
            <stop offset="0%" stopColor="#0f1f3d" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0f1f3d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula-rose" cx="50%" cy="85%">
            <stop offset="0%" stopColor="#1a0a1e" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1a0a1e" stopOpacity="0" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="glow-tight" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="0.3" />
          </filter>
          <filter id="glow-outer" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <filter id="line-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>

          {/* Constellation star template (white) */}
          <g id="cstar-white">
            <circle cx="0" cy="0" r="2.0" fill="#c8d8f0" opacity="0.1" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.8" fill="#e8f0ff" opacity="0.3" filter="url(#glow-tight)" />
            <circle cx="0" cy="0" r="0.25" fill="#e8f0ff" opacity="0.95" />
          </g>

          {/* Constellation star template (gold) */}
          <g id="cstar-gold">
            <circle cx="0" cy="0" r="2.0" fill="#d4a854" opacity="0.08" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.8" fill="#f0d878" opacity="0.25" filter="url(#glow-tight)" />
            <circle cx="0" cy="0" r="0.3" fill="#f0d878" opacity="0.95" />
          </g>
        </defs>

        {/* Base fill */}
        <rect width="100" height="100" fill="#070a12" />

        {/* Nebula washes */}
        <ellipse cx="30" cy="35" rx="55" ry="55" fill="url(#nebula-purple)" />
        <ellipse cx="70" cy="60" rx="55" ry="55" fill="url(#nebula-teal)" />
        <ellipse cx="50" cy="85" rx="50" ry="40" fill="url(#nebula-rose)" />

        {/* Dust stars */}
        {dustStars.map((s, i) => (
          <circle key={`d-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#7b9ec7" opacity={s.opacity} />
        ))}

        {/* Medium stars */}
        {mediumStars.map((s, i) => (
          <circle key={`m-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#c8d8f0" opacity={s.opacity} />
        ))}

        {/* Constellations */}
        {CONSTELLATIONS.map((constellation: Constellation) => (
          <g key={constellation.name}>
            {/* Glow lines */}
            {constellation.lines.map((line, i) => {
              const from = constellation.stars[line.from];
              const to = constellation.stars[line.to];
              return (
                <line
                  key={`lg-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={constellation.color === 'gold' ? '#d4a854' : '#c8d8f0'}
                  strokeWidth="0.5"
                  strokeOpacity="0.06"
                  filter="url(#line-glow)"
                />
              );
            })}
            {/* Core lines */}
            {constellation.lines.map((line, i) => {
              const from = constellation.stars[line.from];
              const to = constellation.stars[line.to];
              return (
                <line
                  key={`cl-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={constellation.color === 'gold' ? '#d4a854' : '#e8f0ff'}
                  strokeWidth="0.08"
                  strokeOpacity="0.25"
                />
              );
            })}
            {/* Stars */}
            {constellation.stars.map((star, i) => (
              <use
                key={`cs-${i}`}
                href={constellation.color === 'gold' ? '#cstar-gold' : '#cstar-white'}
                x={star.x}
                y={star.y}
                opacity={star.brightness}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 0,
  overflow: 'hidden',
};

const svgStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};
