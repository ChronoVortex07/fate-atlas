import { motion } from 'framer-motion';

// Fate's binding is gold, not Shadow's violet — chains of FATE. Two strands of
// interlocking links cross the whole card and lock at the center, so it reads
// unmistakably as "bound by fate," not a faint ornament.

// Lay a run of interlocking links along the segment (x1,y1)→(x2,y2). Alternating
// link sizes give the rhythmic over/under look of a real chain.
function strandLinks(x1: number, y1: number, x2: number, y2: number, keyPrefix: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const step = 12; // links overlap so the strand reads as continuous metal
  const n = Math.max(1, Math.round(len / step));
  const links = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    const broad = i % 2 === 0; // alternate flat / on-edge links
    links.push(
      <rect
        key={`${keyPrefix}-${i}`}
        x={-9}
        y={broad ? -5.5 : -3}
        width={18}
        height={broad ? 11 : 6}
        rx={broad ? 5.5 : 3}
        transform={`translate(${x}, ${y}) rotate(${angle})`}
        fill="none"
        stroke="url(#chainMetal)"
        strokeWidth={2.2}
      />,
    );
  }
  return links;
}

export default function ChainsOfFate() {
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      initial={{ opacity: 0, scale: 1.12 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      aria-hidden
    >
      {/* The chains pulse with a golden fate-glow (depth shadow kept beneath). */}
      <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 100 150"
        preserveAspectRatio="none"
        fill="none"
        style={{ display: 'block' }}
        animate={{
          filter: [
            'drop-shadow(0 0 2px rgba(243,225,166,0.55)) drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
            'drop-shadow(0 0 9px rgba(243,225,166,1)) drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
            'drop-shadow(0 0 2px rgba(243,225,166,0.55)) drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <linearGradient id="chainMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3e1a6" />
            <stop offset="45%" stopColor="#c9a24b" />
            <stop offset="100%" stopColor="#6f5526" />
          </linearGradient>
        </defs>

        {/* Two strands crossing the whole card, anchored just inside the corners. */}
        {strandLinks(12, 20, 88, 130, 'a')}
        {strandLinks(88, 20, 12, 130, 'b')}

        {/* Corner shackle bolts where the chains bite into the card. */}
        {[[12, 20], [88, 20], [12, 130], [88, 130]].map(([cx, cy], i) => (
          <circle key={`bolt-${i}`} cx={cx} cy={cy} r={3.4} fill="url(#chainMetal)" stroke="#4a3a18" strokeWidth={1} />
        ))}

        {/* Central padlock where the strands lock together. */}
        <circle cx={50} cy={75} r={9} fill="#1b150a" stroke="url(#chainMetal)" strokeWidth={2.6} />
        <path d="M45 71 a5 5 0 0 1 10 0 v3" fill="none" stroke="url(#chainMetal)" strokeWidth={2} />
        <circle cx={50} cy={76} r={1.9} fill="#f3e1a6" />
        <rect x={49} y={76} width={2} height={4} rx={1} fill="#f3e1a6" />
      </motion.svg>
    </motion.div>
  );
}
