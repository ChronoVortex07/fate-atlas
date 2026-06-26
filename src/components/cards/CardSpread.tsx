import { useRef, useEffect } from 'react';
import MethodCard, { type MethodCardVisual, type MethodCardMotion } from './MethodCard';
import type { DivinationType } from '../../engine/types';

export interface CardSpreadProps {
  methods: DivinationType[];
  visualFor: (index: number) => MethodCardVisual;
  motionFor: (index: number) => MethodCardMotion;
  interactive: boolean;
  onPick: (index: number) => void;
}

export default function CardSpread({ methods, visualFor, motionFor, interactive, onPick }: CardSpreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // When the pool grows (Will widen), smooth-scroll to reveal the new card.
  const count = methods.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }
  }, [count]);

  return (
    <div ref={scrollRef} style={spreadStyle}>
      {methods.map((method, i) => (
        <MethodCard
          key={i}
          index={i}
          method={method}
          visual={visualFor(i)}
          motion={motionFor(i)}
          interactive={interactive}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  );
}

const spreadStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'safe center',
  gap: 'clamp(0.6rem, 2.5vw, 1.4rem)',
  width: '100%', maxWidth: '100%', padding: '2.2rem 1rem',
  overflowX: 'auto', overflowY: 'visible',
  scrollbarWidth: 'thin', scrollbarColor: '#2a3358 transparent',
};
