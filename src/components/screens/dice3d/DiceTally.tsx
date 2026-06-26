import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DiceCheckBreakdown } from '../../../engine/types';

interface Props {
  dc: number;
  breakdown: DiceCheckBreakdown | null;
  veiled: boolean;
  onDone: () => void;
}

interface Step { value: number; delta: number | null; color: string }

// Build the running-total steps: start at the d20, then each bless (+) and bane (-).
function buildSteps(b: DiceCheckBreakdown): Step[] {
  const steps: Step[] = [{ value: b.d20, delta: null, color: '#c8d8f0' }];
  let acc = b.d20;
  for (const n of b.bless) { acc += n; steps.push({ value: acc, delta: n, color: '#d4a854' }); }
  for (const n of b.bane) { acc -= n; steps.push({ value: acc, delta: -n, color: '#c0392b' }); }
  return steps;
}

export default function DiceTally({ dc, breakdown, veiled, onDone }: Props) {
  const [shown, setShown] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!breakdown) return;
    doneRef.current = false;
    const steps = buildSteps(breakdown);
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((s, i) => {
      timers.push(setTimeout(() => {
        setShown(s.value);
        if (s.delta) setFlash(s.color);
      }, 500 + i * 650));
    });
    // Final verdict.
    timers.push(setTimeout(() => {
      const success = breakdown.critical === 'triumph'
        || (breakdown.critical !== 'fumble' && breakdown.total >= dc);
      setFlash(success ? '#5b8c5a' : '#c0392b');
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, 500 + steps.length * 650 + 400));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, dc]);

  return (
    <div style={wrapStyle}>
      <div style={dcStyle}>DC {veiled ? '?' : dc}</div>
      <motion.div
        key={shown ?? 'idle'}
        style={{ ...totalStyle, color: flash ?? '#c8d8f0' }}
        initial={{ scale: 0.7, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      >
        {shown ?? '—'}
      </motion.div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
};
const dcStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.7rem',
  letterSpacing: '0.18em', color: '#7b9ec7', textTransform: 'uppercase',
};
const totalStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '3rem', lineHeight: 1,
  transition: 'color 0.3s ease',
};
