import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DiceCheckBreakdown } from '../../../engine/types';

interface Props {
  dc: number;
  breakdown: DiceCheckBreakdown | null;
  veiled: boolean;
  onDone: () => void;
}

interface Step { value: number; delta: number | null; color: string }
interface Verdict { label: string; color: string; success: boolean }

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
  const [faceoff, setFaceoff] = useState(false);  // total slides beside the DC
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!breakdown) return;
    doneRef.current = false;
    setFaceoff(false);
    setVerdict(null);
    const steps = buildSteps(breakdown);
    const timers: ReturnType<typeof setTimeout>[] = [];

    // 1. Tick the running total: d20, then each bless (+) / bane (-).
    steps.forEach((s, i) => {
      timers.push(setTimeout(() => {
        setShown(s.value);
        if (s.delta) setFlash(s.color);
      }, 500 + i * 650));
    });

    // 2. Face-off: total slides beside the DC and holds a beat.
    const faceoffAt = 500 + steps.length * 650;
    timers.push(setTimeout(() => setFaceoff(true), faceoffAt));

    // 3. Verdict: flash green/red with the outcome label, then finish.
    timers.push(setTimeout(() => {
      const crit = breakdown.critical;
      const success = crit === 'triumph' || (crit !== 'fumble' && breakdown.total >= dc);
      const label = crit === 'triumph' ? 'TRIUMPH'
        : crit === 'fumble' ? 'FUMBLE'
        : success ? 'SUCCESS' : 'FAILURE';
      const color = success ? '#5b8c5a' : '#c0392b';
      setVerdict({ label, color, success });
      setFlash(color);
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, faceoffAt + 600));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, dc]);

  return (
    <div style={wrapStyle}>
      {/* During the count: a single big running total above DC. On face-off the
          total and DC sit side by side; the verdict label flashes beneath. */}
      <div style={rowStyle}>
        <div style={colStyle}>
          <div style={dcStyle}>Total</div>
          <motion.div
            key={shown ?? 'idle'}
            style={{ ...totalStyle, color: flash ?? '#c8d8f0' }}
            initial={{ scale: 0.7, opacity: 0.4 }}
            animate={{ scale: faceoff ? 1.1 : 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          >
            {shown ?? '—'}
          </motion.div>
        </div>

        <AnimatePresence>
          {faceoff && (
            <motion.div
              style={colStyle}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div style={vsStyle}>vs</div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {faceoff && (
            <motion.div
              style={colStyle}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div style={dcStyle}>DC</div>
              <div style={{ ...totalStyle, color: '#7b9ec7' }}>{veiled ? '?' : dc}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {verdict && !veiled && (
          <motion.div
            key={verdict.label}
            style={{ ...verdictStyle, color: verdict.color, borderColor: verdict.color }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: [0.6, 1.15, 1] }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {verdict.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '1rem',
};
const colStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
};
const dcStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.7rem',
  letterSpacing: '0.18em', color: '#7b9ec7', textTransform: 'uppercase',
};
const totalStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '3rem', lineHeight: 1,
  transition: 'color 0.3s ease',
};
const vsStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '1.1rem', color: '#5b7290',
};
const verdictStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.22em',
  padding: '0.35rem 1.1rem', border: '1px solid', borderRadius: '3px',
};
