// Plays once when a corrupted method card is picked: mimics the gold ascend, then
// shears the card into displaced GPU-artifact slices and un-renders it. ~3s, then onDone.
import { useEffect } from 'react';

const SLICES: Array<{ clip: string; dx: string; dis?: boolean }> = [
  { clip: 'inset(0 0 91% 0)', dx: '7px' },
  { clip: 'inset(9% 0 74% 0)', dx: '-19px', dis: true },
  { clip: 'inset(26% 0 66% 0)', dx: '4px' },
  { clip: 'inset(34% 0 45% 0)', dx: '-11px', dis: true },
  { clip: 'inset(55% 0 37% 0)', dx: '22px' },
  { clip: 'inset(63% 0 18% 0)', dx: '-6px', dis: true },
  { clip: 'inset(82% 0 0 0)', dx: '10px' },
];

export default function CorruptedAscend({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="cx-ca-root" style={{ position: 'relative' }}>
      <div className="cx-ca-base">{children}</div>
      {SLICES.map((s, i) => (
        <div key={i} className={`cx-ca-slice${s.dis ? ' dis' : ''}`}
             style={{ position: 'absolute', inset: 0, clipPath: s.clip, ['--dx' as string]: s.dx }}>
          {children}
        </div>
      ))}
    </div>
  );
}
