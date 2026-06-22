import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { drawTarotCard } from '../../data/tarot';
import type { TarotResult } from '../../engine/types';

const RUNE_BAND = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁ';

type Phase = 'pick' | 'reversal-prompt' | 'revealed';

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();
  const [phase, setPhase] = useState<Phase>('pick');
  const faceDownCards = useState<TarotResult[]>(() =>
    Array.from({ length: 3 }, () => drawTarotCard(state.affinities))
  )[0];
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [willReverse, setWillReverse] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [autoDecided, setAutoDecided] = useState(false);

  const reveal = useCallback((reverse: boolean) => {
    setWillReverse(reverse);
    setPhase('revealed');
  }, []);

  // Player-driven choice at the reversal prompt (feeds via completeMinigame meta).
  const handleReveal = useCallback((reverse: boolean) => {
    setAutoDecided(false);
    reveal(reverse);
  }, [reveal]);

  const handlePickCard = useCallback((index: number) => {
    const card = faceDownCards[index];
    setChosenIndex(index);
    setSwapped(false);
    // Fate may decide the spread-wide orientation for you (skip the prompt).
    const { auto, reversed } = engine.resolveSpreadOrientation(card);
    setTimeout(() => {
      if (auto) { setAutoDecided(true); reveal(reversed); }
      else setPhase('reversal-prompt');
    }, 600);
  }, [engine, faceDownCards, reveal]);

  useEffect(() => {
    if (phase !== 'revealed' || chosenIndex === null) return;

    const card = faceDownCards[chosenIndex];
    const finalResult: TarotResult = willReverse
      ? {
          ...card,
          orientation: card.orientation === 'upright' ? 'reversed' : 'upright',
          tags: card.tags.map((t) => t === 'upright' ? 'reversed' : t === 'reversed' ? 'upright' : t),
        }
      : card;

    // Small delay for the flip animation, then complete.
    // Player choice feeds an affinity; a Fate auto-decided orientation does not.
    const meta = autoDecided
      ? {}
      : willReverse
        ? { reversed: true }
        : { revealedAsDrawn: true };
    const timer = setTimeout(() => {
      engine.completeMinigame(finalResult, meta);
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, chosenIndex, willReverse, autoDecided, faceDownCards, engine]);

  // Once committed, the engine owns this slot. Prefer it so flip/mirror are
  // reflected; fall back to the locally chosen card before commit.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const engineCard = committedSlot && committedSlot.type === 'tarot' ? committedSlot : null;
  const localCard = chosenIndex !== null ? faceDownCards[chosenIndex] : null;
  const localOrientation: 'upright' | 'reversed' | null = localCard
    ? (willReverse
        ? (localCard.orientation === 'upright' ? 'reversed' : 'upright')
        : localCard.orientation)
    : null;
  const displaySymbol = engineCard?.symbol ?? localCard?.symbol ?? '';
  const displayName = engineCard?.name ?? localCard?.name ?? '';
  const displayOrientation = engineCard?.orientation ?? localOrientation;

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <style>{`.snap-scroll-row::-webkit-scrollbar { display: none; }`}</style>
      <div style={contentStyle}>
        <h1 style={headingStyle}>
          {phase === 'pick' && 'Draw a card'}
          {phase === 'reversal-prompt' && 'The stars offer a choice'}
          {phase === 'revealed' && 'Your card'}
        </h1>

        {phase === 'pick' && (
          <motion.div style={cardsRowStyle} className="snap-scroll-row" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}>
            {faceDownCards.map((_, i) => (
              <motion.button
                key={i}
                style={faceDownCardStyle}
                variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ y: -8, boxShadow: '0 8px 30px rgba(155,107,176,0.3)', borderColor: '#9b6bb0' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePickCard(i)}
                animate={chosenIndex !== null && chosenIndex !== i ? { opacity: 0, scale: 0.8, rotateY: 90, filter: 'brightness(2)' } : {}}
                transition={chosenIndex !== null && chosenIndex !== i ? { duration: 0.6, ease: 'easeIn' } : {}}
              >
                <span style={runeStyle}>{RUNE_BAND}</span>
                <span style={cardBackSymbolStyle}>✧</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {phase === 'reversal-prompt' && chosenIndex !== null && (
          <motion.div style={promptStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.div style={singleCardStyle} animate={{ y: -5 }} transition={{ yoyo: Infinity, duration: 2 }}>
              <span style={runeStyle}>{RUNE_BAND}</span>
              <span style={cardBackSymbolStyle}>✧</span>
            </motion.div>
            <p style={promptTextStyle}>Reveal as drawn, or reverse its course?</p>
            {state.affinityEffects.peekAvailable && chosenIndex !== null && (
              <PeekControl
                onPeek={() => engine.usePeek(faceDownCards[chosenIndex])}
                onDecline={() => engine.declinePeek()}
              />
            )}
            <div style={choiceRowStyle}>
              <motion.button style={choiceBtnStyle} whileHover={{ borderColor: '#d4a854', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleReveal(false)}>
                ▲ Reveal as Drawn
              </motion.button>
              <motion.button style={{ ...choiceBtnStyle, borderColor: '#9b6bb0' }} whileHover={{ borderColor: '#c8a0d0', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleReveal(true)}>
                ▼ Reverse its Course
              </motion.button>
            </div>
          </motion.div>
        )}

        {phase === 'revealed' && displayOrientation && (
          <motion.div
            key={`${displayName}-${displayOrientation}`}
            style={revealStyle}
            initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div style={revealedSymbolStyle}>{displaySymbol}</div>
            <div style={revealedNameStyle}>{displayName}</div>
            <div style={{ ...revealedOrientStyle, color: displayOrientation === 'reversed' ? '#d4a854' : '#7b9ec7' }}>
              {displayOrientation === 'reversed' ? '▼ Reversed' : '▲ Upright'}
            </div>
            {swapped && (
              <motion.div
                style={{ ...revealedOrientStyle, color: '#9b6bb0', marginTop: '0.4rem' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.7] }}
                transition={{ duration: 1.6 }}
              >
                ✶ your hand moved of its own accord
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Light foresight: glimpse the chosen card's leaning, or embrace the unknown (Shadow).
function PeekControl({ onPeek, onDecline }: {
  onPeek: () => { failed: boolean; leaning: string };
  onDecline: () => void;
}) {
  const [line, setLine] = useState<string | null>(null);
  if (line) return <p style={{ ...promptTextStyle, color: '#7b9ec7', fontStyle: 'italic' }}>{line}</p>;
  return (
    <div style={choiceRowStyle}>
      <motion.button style={{ ...choiceBtnStyle, borderColor: '#d4c068' }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setLine(onPeek().leaning)}>
        ✦ Seek a glimpse
      </motion.button>
      <motion.button style={choiceBtnStyle} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { onDecline(); setLine('You let the mystery stand.'); }}>
        Embrace the unknown
      </motion.button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.12em',
  margin: 0,
  textAlign: 'center',
};

const cardsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.25rem',
  justifyContent: 'center',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch',
  padding: '10px 40px',
  margin: '0 -40px',
  // Invisible scrollbar
  scrollbarWidth: 'none',          // Firefox
  msOverflowStyle: 'none',         // IE/Edge
  // Chrome/Safari: handled via injected style below
};

const faceDownCardStyle: React.CSSProperties = {
  width: '100px',
  height: '150px',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  scrollSnapAlign: 'center',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const runeStyle: React.CSSProperties = {
  fontFamily: "'Noto Sans', sans-serif",
  fontSize: '0.55rem',
  color: '#5b7290',
  letterSpacing: '0.3em',
  userSelect: 'none',
};

const cardBackSymbolStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  color: '#9b6bb0',
  opacity: 0.6,
};

const promptStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.25rem',
};

const singleCardStyle: React.CSSProperties = {
  width: '100px',
  height: '150px',
  background: '#0d1220',
  border: '1px solid #9b6bb0',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
};

const promptTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  color: '#c8d8f0',
  letterSpacing: '0.05em',
  margin: 0,
  textAlign: 'center',
};

const choiceRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const choiceBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  letterSpacing: '0.1em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #1a2440',
  padding: '0.7rem 1.5rem',
  borderRadius: '4px',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.3s ease',
};

const revealStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const revealedSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
  color: '#d4a854',
};

const revealedNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const revealedOrientStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  letterSpacing: '0.1em',
};
