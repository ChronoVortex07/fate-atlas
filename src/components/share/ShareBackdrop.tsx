// Static SVG star-field backdrop for the share card. Self-contained — no engine /
// React-context dependency — so the off-screen, html2canvas-rasterised ShareCard stays
// deterministic. html2canvas renders inline SVG faithfully, unlike the CSS
// repeating-gradient + inset box-shadow this replaces (which exported as a solid red block).

interface Star { cx: number; cy: number; r: number; opacity: number }
interface ClusterStar { cx: number; cy: number; r: number }
interface Cluster { stars: ClusterStar[]; lines: [number, number][]; gold: boolean }

const W = 380, H = 475;

// Mirrors StarField's seeded RNG so the field looks composed, not noisy, and is identical
// on every render (the share card is rasterised off-screen — determinism matters).
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeStars(seed: number, count: number, rMin: number, rRange: number, oMin: number, oRange: number): Star[] {
  const rng = seededRandom(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cx: rng() * W,
      cy: rng() * H,
      r: rng() * rRange + rMin,
      opacity: rng() * oRange + oMin,
    });
  }
  return out;
}

// A few small constellation-like clusters: 4-5 points joined by a hairline path.
function makeClusters(seed: number): Cluster[] {
  const rng = seededRandom(seed);
  const anchors = [{ x: 70, y: 80 }, { x: 290, y: 150 }, { x: 150, y: 340 }];
  return anchors.map((a, c) => {
    const n = 4 + Math.floor(rng() * 2); // 4-5 points
    const stars: ClusterStar[] = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        cx: a.x + (rng() - 0.5) * 90,
        cy: a.y + (rng() - 0.5) * 90,
        r: rng() * 0.8 + 0.9,
      });
    }
    const lines: [number, number][] = [];
    for (let i = 1; i < n; i++) lines.push([i - 1, i]);
    return { stars, lines, gold: c === 1 };
  });
}

const DUST = makeStars(42, 90, 0.4, 0.5, 0.18, 0.32);
const MEDIUM = makeStars(137, 22, 0.7, 0.6, 0.32, 0.3);
const CLUSTERS = makeClusters(311);

const SCANLINES = Array.from({ length: Math.ceil(H / 4) }, (_, i) => i * 4);
const MOSH = [
  { y: Math.round(H * 0.24), h: 3, o: 0.5 },
  { y: Math.round(H * 0.47), h: 5, o: 0.4 },
  { y: Math.round(H * 0.70), h: 2, o: 0.45 },
];

export default function ShareBackdrop({ corrupted }: { corrupted: boolean }) {
  const starWhite = corrupted ? '#ff8a98' : '#c8d8f0';
  const starGold = corrupted ? '#ff2d4a' : '#d4a854';
  const lineWhite = corrupted ? '#ff2d4a' : '#c8d8f0';
  const lineGold = corrupted ? '#ff2d4a' : '#d4a854';

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'block' }}
    >
      <defs>
        <radialGradient id="sb-neb-a" cx="30%" cy="32%">
          <stop offset="0%" stopColor={corrupted ? '#3a0a14' : '#2a1545'} stopOpacity={corrupted ? 0.5 : 0.28} />
          <stop offset="100%" stopColor={corrupted ? '#3a0a14' : '#2a1545'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-neb-b" cx="72%" cy="60%">
          <stop offset="0%" stopColor={corrupted ? '#1a0006' : '#0f1f3d'} stopOpacity={corrupted ? 0.5 : 0.2} />
          <stop offset="100%" stopColor={corrupted ? '#1a0006' : '#0f1f3d'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-neb-c" cx="50%" cy="88%">
          <stop offset="0%" stopColor={corrupted ? '#2a0608' : '#1a0a1e'} stopOpacity={corrupted ? 0.45 : 0.14} />
          <stop offset="100%" stopColor={corrupted ? '#2a0608' : '#1a0a1e'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-vignette" cx="50%" cy="46%" r="62%">
          <stop offset="55%" stopColor="#ff2d4a" stopOpacity="0" />
          <stop offset="100%" stopColor="#ff2d4a" stopOpacity="0.22" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={corrupted ? '#0c0306' : '#070a12'} />
      <rect width={W} height={H} fill="url(#sb-neb-a)" />
      <rect width={W} height={H} fill="url(#sb-neb-b)" />
      <rect width={W} height={H} fill="url(#sb-neb-c)" />

      {DUST.map((s, i) => (
        <circle key={`d${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={starWhite} opacity={s.opacity} />
      ))}
      {MEDIUM.map((s, i) => (
        <circle key={`m${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={starWhite} opacity={s.opacity} />
      ))}

      {CLUSTERS.map((cl, ci) => (
        <g key={`c${ci}`}>
          {cl.lines.map(([a, b], li) => (
            <line
              key={`l${li}`}
              x1={cl.stars[a].cx} y1={cl.stars[a].cy}
              x2={cl.stars[b].cx} y2={cl.stars[b].cy}
              stroke={cl.gold ? lineGold : lineWhite}
              strokeWidth="0.6" strokeOpacity="0.32"
            />
          ))}
          {cl.stars.map((s, si) => (
            <circle key={`s${si}`} cx={s.cx} cy={s.cy} r={s.r} fill={cl.gold ? starGold : starWhite} opacity="0.9" />
          ))}
        </g>
      ))}

      {corrupted && (
        <>
          {SCANLINES.map((y, i) => (
            <rect key={`sl${i}`} x="0" y={y} width={W} height="1" fill="#ff2d4a" opacity="0.07" />
          ))}
          {MOSH.map((m, i) => (
            <rect key={`mo${i}`} x="0" y={m.y} width={W} height={m.h} fill="#ff2d4a" opacity={m.o} />
          ))}
          <rect width={W} height={H} fill="url(#sb-vignette)" />
        </>
      )}
    </svg>
  );
}
