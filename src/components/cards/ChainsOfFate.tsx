import { motion } from 'framer-motion';

const CHAINS_COLOR = '#9b6bb0';
const CHAINS_OPACITY = 0.4;

export default function ChainsOfFate() {
  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      animate={{ opacity: [0.30, 0.50, 0.30] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        fill="none"
        style={{ opacity: CHAINS_OPACITY }}
        aria-hidden
      >
        {/* 8 interlocking chain links in a circular pattern */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const cx = 36 + Math.cos(rad) * 18;
          const cy = 36 + Math.sin(rad) * 18;
          const rot = angle + 90;
          return (
            <g key={i} transform={`translate(${cx}, ${cy}) rotate(${rot})`}>
              <rect
                x={-5}
                y={-3}
                width={10}
                height={6}
                rx={2.5}
                stroke={CHAINS_COLOR}
                strokeWidth="1.2"
                fill="none"
              />
            </g>
          );
        })}
        {/* Central binding circle */}
        <circle cx={36} cy={36} r={6} stroke={CHAINS_COLOR} strokeWidth="1.2" fill="none" />
        <circle cx={36} cy={36} r={2} fill={CHAINS_COLOR} opacity={0.6} />
      </svg>
    </motion.div>
  );
}
