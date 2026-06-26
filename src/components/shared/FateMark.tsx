import { useId } from 'react';

// The Atlas of Fate sigil — a fate-compass: an eight-point celestial star inside
// a double ring, sun-and-moon at its heart (the game's dualities), six outer
// stars for the six affinities. detail={false} drops the rings/ticks so the
// silhouette still reads at favicon size.
export default function FateMark({ size = 64, detail = true, color = '#d4a854' }:
  { size?: number; detail?: boolean; color?: string }) {
  const gid = useId();
  const longPts = 'M50 8 L55 45 L92 50 L55 55 L50 92 L45 55 L8 50 L45 45 Z';
  const diagPts = 'M50 20 L53 47 L80 50 L53 53 L50 80 L47 53 L20 50 L47 47 Z';
  const outerStars = detail ? Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180;
    const x = 50 + Math.cos(a) * 44, y = 50 + Math.sin(a) * 44;
    return <path key={i} d={`M${x} ${y - 2.4} l.7 1.7 1.7.7 -1.7.7 -.7 1.7 -.7-1.7 -1.7-.7 1.7-.7 Z`} fill={color} opacity={0.9} />;
  }) : null;
  const sunTicks = detail ? Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 * Math.PI / 180;
    const x1 = 46 + Math.cos(a) * 8, y1 = 50 + Math.sin(a) * 8;
    const x2 = 46 + Math.cos(a) * 10.5, y2 = 50 + Math.sin(a) * 10.5;
    return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
  }) : null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block' }} role="img" aria-label="Atlas of Fate">
      <defs>
        <radialGradient id={gid} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#f3dca0" /><stop offset="60%" stopColor={color} /><stop offset="100%" stopColor="#9a7330" />
        </radialGradient>
      </defs>
      {detail && (
        <>
          <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="1.4" opacity="0.55" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="0.8" opacity="0.4" />
          {outerStars}
        </>
      )}
      <g transform="rotate(45 50 50)"><path d={diagPts} fill={`url(#${gid})`} opacity={detail ? 0.5 : 0.65} /></g>
      <path d={longPts} fill={`url(#${gid})`} />
      <circle cx="50" cy="50" r={detail ? 14 : 13} fill="#0a0d1c" stroke={color} strokeWidth="1.2" />
      <circle cx="46" cy="50" r="6.5" fill={color} />
      <path d="M53.5 50 a6.8 6.8 0 1 1 -3.6 -6 a5.2 5.2 0 1 0 3.6 6 Z" fill="#0a0d1c" />
      {detail && <g stroke={color} strokeWidth="0.9" opacity="0.85">{sunTicks}</g>}
    </svg>
  );
}
