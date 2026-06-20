import { useMemo, useCallback } from 'react';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';
import { useGameEngine } from '../../hooks/useGameEngine';

interface DustStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  twinkleDuration: number;
  twinkleDelay: number;
}

interface MediumStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  twinkleDuration: number;
  twinkleDelay: number;
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
      r: rng() * 0.14 + 0.08,
      opacity: rng() * 0.3 + 0.25,
      twinkleDuration: rng() * 4 + 2,
      twinkleDelay: rng() * 6,
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
      r: rng() * 0.12 + 0.10,
      opacity: rng() * 0.3 + 0.35,
      twinkleDuration: rng() * 4 + 2.5,
      twinkleDelay: rng() * 5,
    });
  }
  return stars;
}

export default function StarField() {
  const { state, engine } = useGameEngine();
  const dustStars = useMemo(() => generateDustStars(42, 70), []);
  const mediumStars = useMemo(() => generateMediumStars(137, 18), []);

  const handleAnimationEnd = useCallback((event: React.AnimationEvent<SVGSVGElement>) => {
    if (state.swirlActive && event.animationName === 'star-swirl') {
      engine.finishSwirl();
    }
  }, [state.swirlActive, engine]);

  const swirlClass = state.swirlActive ? ' starfield--swirling' : '';
  const veilOpacity = state.screen !== 'title' ? 0.4 : 0;

  return (
    <div style={containerStyle}>
      <svg
        className={`starfield${swirlClass}`}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
        onAnimationEnd={handleAnimationEnd}
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
          <filter id="glow-dust" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="0.15" />
          </filter>
          <filter id="line-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>

          {/* 8-pointed star template (white) — tiny, crisp */}
          <g id="cstar-white">
            <circle cx="0" cy="0" r="1.0" fill="#c8d8f0" opacity="0.12" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.4" fill="#e8f0ff" opacity="0.35" filter="url(#glow-tight)" />
            <path
              d="M 0,-0.22 L 0.031,-0.074 L 0.156,-0.156 L 0.074,-0.031 L 0.22,0 L 0.074,0.031 L 0.156,0.156 L 0.031,0.074 L 0,0.22 L -0.031,0.074 L -0.156,0.156 L -0.074,0.031 L -0.22,0 L -0.074,-0.031 L -0.156,-0.156 L -0.031,-0.074 Z"
              fill="#e8f0ff"
              opacity="0.95"
            />
          </g>

          {/* 8-pointed star template (gold) — tiny, crisp */}
          <g id="cstar-gold">
            <circle cx="0" cy="0" r="1.0" fill="#d4a854" opacity="0.1" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.4" fill="#f0d878" opacity="0.3" filter="url(#glow-tight)" />
            <path
              d="M 0,-0.22 L 0.031,-0.074 L 0.156,-0.156 L 0.074,-0.031 L 0.22,0 L 0.074,0.031 L 0.156,0.156 L 0.031,0.074 L 0,0.22 L -0.031,0.074 L -0.156,0.156 L -0.074,0.031 L -0.22,0 L -0.074,-0.031 L -0.156,-0.156 L -0.031,-0.074 Z"
              fill="#f0d878"
              opacity="0.95"
            />
          </g>

          {/* Swirl flash overlay — white rectangle covering viewBox, animated by CSS */}
          <rect id="swirl-flash" x="0" y="0" width="100" height="100" fill="#e8f0ff" opacity="0" />
        </defs>

        {/* Embedded styles for twinkle + swirl animations */}
        <style>{`
          /* Twinkle animations — one keyframe reused with staggered delays.
             Group opacity modulates between 1 (full) and 0.55 (dimmed);
             the circles inside already carry their own base opacity. */
          @keyframes twinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
          }

          .starfield--swirling {
            animation: star-swirl 2.5s cubic-bezier(0.25, 0, 0.25, 1) forwards;
          }

          @keyframes star-swirl {
            0% {
              transform: rotate(0deg) scale(1);
            }
            100% {
              transform: rotate(180deg) scale(0.82);
            }
          }

          .starfield--swirling .constellation-lines {
            animation: lines-fade 0.6s ease-in forwards;
          }

          @keyframes lines-fade {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }

          .starfield--swirling .swirl-trail {
            animation: trail-fade 2.5s cubic-bezier(0.25, 0, 0.25, 1) forwards;
          }

          @keyframes trail-fade {
            0% { opacity: 0.3; }
            100% { opacity: 0; }
          }

          .starfield--swirling #swirl-flash {
            animation: peak-flash 0.4s ease-out 2.1s forwards;
          }

          @keyframes peak-flash {
            0% { opacity: 0; }
            50% { opacity: 0.15; }
            100% { opacity: 0; }
          }

        `}</style>

        {/* Base fill */}
        <rect width="100" height="100" fill="#070a12" />

        {/* Nebula washes */}
        <ellipse cx="30" cy="35" rx="55" ry="55" fill="url(#nebula-purple)" />
        <ellipse cx="70" cy="60" rx="55" ry="55" fill="url(#nebula-teal)" />
        <ellipse cx="50" cy="85" rx="50" ry="40" fill="url(#nebula-rose)" />

        {/* Trail layer — offset copies of stars for swirl trail effect, only visible during swirl */}
        <g className="swirl-trail" opacity="0" style={{ transform: 'rotate(-8deg) scale(0.95)', transformOrigin: '50% 50%' }}>
          {dustStars.map((s, i) => (
            <circle key={`td-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#7b9ec7" opacity={s.opacity * 0.5} />
          ))}
          {mediumStars.map((s, i) => (
            <circle key={`tm-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#c8d8f0" opacity={s.opacity * 0.5} />
          ))}
        </g>

        {/* Dust stars — tiny pinpoints with glow and twinkle */}
        {dustStars.map((s, i) => (
          <g key={`d-${i}`} style={{
            animation: `twinkle ${s.twinkleDuration}s ease-in-out infinite`,
            animationDelay: `${s.twinkleDelay}s`,
            willChange: 'opacity',
          } as React.CSSProperties}>
            <circle cx={s.cx} cy={s.cy} r={s.r * 2} fill="#7b9ec7" opacity={s.opacity * 0.3} filter="url(#glow-dust)" />
            <circle cx={s.cx} cy={s.cy} r={s.r} fill="#7b9ec7" opacity={s.opacity} />
          </g>
        ))}

        {/* Medium stars — slightly larger pinpoints with glow and twinkle */}
        {mediumStars.map((s, i) => (
          <g key={`m-${i}`} style={{
            animation: `twinkle ${s.twinkleDuration}s ease-in-out infinite`,
            animationDelay: `${s.twinkleDelay}s`,
            willChange: 'opacity',
          } as React.CSSProperties}>
            <circle cx={s.cx} cy={s.cy} r={s.r * 2} fill="#c8d8f0" opacity={s.opacity * 0.3} filter="url(#glow-dust)" />
            <circle cx={s.cx} cy={s.cy} r={s.r} fill="#c8d8f0" opacity={s.opacity} />
          </g>
        ))}

        {/* Constellations */}
        {CONSTELLATIONS.map((constellation: Constellation) => (
          <g key={constellation.name}>
            {/* Glow lines */}
            <g className="constellation-lines">
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
                    strokeWidth="1.2"
                    strokeOpacity="0.12"
                    filter="url(#line-glow)"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {/* Core lines */}
            <g className="constellation-lines">
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
                    strokeWidth="0.15"
                    strokeOpacity="0.4"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {/* Stars — 8-pointed */}
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

        {/* Dimming veil — dark overlay during gameplay, transparent on title */}
        <rect x="0" y="0" width="100" height="100" fill="#070a12" style={{ opacity: veilOpacity, transition: 'opacity 1.2s ease' }} />

        {/* Swirl flash overlay */}
        <use href="#swirl-flash" />
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
  transformOrigin: '50% 50%',
};
