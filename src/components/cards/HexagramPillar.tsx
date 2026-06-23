import { motion } from 'framer-motion';
import type { LineValue } from '../../engine/types';

// A line value renders as solid (yang) when 7 or 9, broken (yin) when 6 or 8.
const isSolid = (v: LineValue): boolean => v === 7 || v === 9;

// The flipped form of a line, used for the relating (transformed) hexagram.
const flipLine = (v: LineValue): LineValue => (isSolid(v) ? 8 : 7);

type PillarPhase = 'building' | 'primary' | 'transforming' | 'relating';

interface HexagramPillarProps {
  lines: LineValue[];               // bottom→top, length up to 6 (partial while building)
  changingLines: number[];          // 1..6 indices that are changing
  relatingLines?: LineValue[];      // optional override for the relating form
  phase: PillarPhase;
}

const BRONZE = '#d4a854';
const JADE = '#5b8c5a';
const INDIGO = '#0d1220';

export default function HexagramPillar({
  lines,
  changingLines,
  relatingLines,
  phase,
}: HexagramPillarProps) {
  // Render top→bottom visually (row 6 at the top), so reverse a bottom→top copy.
  const rows = [...lines].map((value, idx) => ({ value, lineNumber: idx + 1 })).reverse();

  return (
    <div style={pillarStyle}>
      {rows.map(({ value, lineNumber }) => {
        const changing = changingLines.includes(lineNumber);
        // During/after the morph, changing rows show their flipped (relating) form.
        const showRelating = phase === 'transforming' || phase === 'relating';
        const relatingValue =
          relatingLines?.[lineNumber - 1] ?? (changing ? flipLine(value) : value);
        const displayValue = showRelating && changing ? relatingValue : value;

        return (
          <LineRow
            key={lineNumber}
            value={displayValue}
            changing={changing}
            phase={phase}
            index={lineNumber - 1}
            morphing={showRelating && changing}
          />
        );
      })}
    </div>
  );
}

interface LineRowProps {
  value: LineValue;
  changing: boolean;
  phase: PillarPhase;
  index: number;
  morphing: boolean;
}

function LineRow({ value, changing, phase, index, morphing }: LineRowProps) {
  const solid = isSolid(value);
  const stroke = changing ? JADE : BRONZE;

  // Staggered paint-on while building; the most-recent line settles last.
  const paintDelay = phase === 'building' ? index * 0.04 : 0;

  const barBase: React.CSSProperties = {
    height: '14px',
    borderRadius: '2px',
    background: `linear-gradient(180deg, ${stroke}, ${shade(stroke)})`,
    boxShadow: changing
      ? `0 0 10px ${JADE}, inset 0 0 4px rgba(255,255,255,0.15)`
      : `inset 0 0 4px rgba(0,0,0,0.4)`,
  };

  // The ink-bleed morph: fade/scale the row as it swaps to its flipped form.
  const morphKey = `${morphing ? 'rel' : 'pri'}-${solid ? 'solid' : 'broken'}`;

  return (
    <div style={rowStyle}>
      <motion.div
        key={morphKey}
        style={rowInnerStyle}
        initial={
          phase === 'building'
            ? { opacity: 0, scaleX: 0 }
            : morphing
            ? { opacity: 0, scale: 1.12, filter: 'blur(2px)' }
            : false
        }
        animate={{ opacity: 1, scaleX: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{
          duration: morphing ? 0.55 : 0.35,
          delay: paintDelay,
          ease: 'easeOut',
        }}
      >
        {solid ? (
          <div style={{ ...barBase, width: '100%' }} />
        ) : (
          <>
            <div style={{ ...barBase, width: '44%' }} />
            <div style={{ width: '12%' }} />
            <div style={{ ...barBase, width: '44%' }} />
          </>
        )}
      </motion.div>
      {changing && (phase === 'primary' || phase === 'transforming') && (
        <motion.span
          style={changingMarkStyle}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          ○
        </motion.span>
      )}
    </div>
  );
}

// Darken a hex color a touch for the bar gradient base.
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 50);
  const g = Math.max(0, ((n >> 8) & 0xff) - 50);
  const b = Math.max(0, (n & 0xff) - 50);
  return `rgb(${r},${g},${b})`;
}

const pillarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '180px',
  padding: '1.1rem 1rem',
  background: INDIGO,
  border: `1px solid #1a2440`,
  borderRadius: '8px',
  boxShadow: '0 0 24px rgba(212,168,84,0.08)',
};

const rowStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const rowInnerStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  justifyContent: 'space-between',
  transformOrigin: 'center',
};

const changingMarkStyle: React.CSSProperties = {
  position: 'absolute',
  right: '-18px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: JADE,
  fontSize: '0.7rem',
  lineHeight: 1,
};
