import { useRef, useEffect } from 'react';
import MethodCard, { type MethodCardVisual, type MethodCardMotion } from './MethodCard';
import type { CorruptedProp } from './MethodCardFront';
import type { WardProp } from './WardSeal';
import type { DivinationType } from '../../engine/types';

export interface CardSpreadProps {
  methods: DivinationType[];
  visualFor: (index: number) => MethodCardVisual;
  motionFor: (index: number) => MethodCardMotion;
  appearedFor: (index: number) => boolean;
  appearDelayFor: (index: number) => number;
  dissolvingFor: (index: number) => boolean;
  phantomIndex: number; // index of the placeholder "closing path" card, or -1
  interactive: boolean;
  onPick: (index: number) => void;
  // Bumps on each (re)deal — included in the card keys so a refresh/swap remounts
  // the cards and replays their deal-in entrance.
  dealNonce: number;
  // Optional forwarded ref to the scroll row, so a parent can measure individual
  // card positions (children[i]) — used to aim the Fate-force hand at a card.
  containerRef?: React.RefObject<HTMLDivElement>;
  // Optional: returns corruption class for index i (null = normal)
  corruptedFor?: (index: number) => CorruptedProp;
  // Optional: returns Light's ward-seal / lure overlay for index i (null = none)
  wardFor?: (index: number) => WardProp;
}

export default function CardSpread({
  methods, visualFor, motionFor, appearedFor, appearDelayFor, dissolvingFor, phantomIndex,
  interactive, onPick, dealNonce, containerRef, corruptedFor, wardFor,
}: CardSpreadProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = containerRef ?? internalRef;

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
          key={`${dealNonce}-${i}`}
          index={i}
          method={method}
          visual={visualFor(i)}
          motion={motionFor(i)}
          appeared={appearedFor(i)}
          appearDelay={appearDelayFor(i)}
          dissolving={dissolvingFor(i)}
          phantom={i === phantomIndex}
          interactive={interactive}
          onClick={() => onPick(i)}
          corrupted={corruptedFor ? corruptedFor(i) : null}
          ward={wardFor ? wardFor(i) : null}
        />
      ))}
    </div>
  );
}

const spreadStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'safe center',
  gap: 'clamp(0.45rem, 2.2vw, 1.4rem)',
  // Generous vertical padding so the selected/fated card's lift (-22px) + glow
  // (~30px) is not clipped: overflow-x:auto forces overflow-y to compute as auto
  // too, so the scroll box clips at its padding edge. Negative vertical margin
  // keeps the laid-out footprint close to the original so spacing stays tight.
  width: '100%', maxWidth: '100%', padding: '3.6rem 1.5rem', margin: '-1.4rem 0',
  overflowX: 'auto', overflowY: 'visible',
  scrollbarWidth: 'thin', scrollbarColor: '#2a3358 transparent',
};
