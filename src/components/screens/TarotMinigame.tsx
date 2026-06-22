import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { drawTarotSpread, consolidateSpread, reverseSpread } from '../../data/tarot';
import type { TarotCardFace, TarotResult } from '../../engine/types';
import CardSigil from '../cards/CardSigil';

const RUNE_BAND = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁ';

type Phase = 'deal' | 'orient' | 'committing';

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();

  // Initialize the spread on mount: draw + Fate deal-swap.
  const [faces, setFaces] = useState<TarotCardFace[]>(() => {
    const raw = drawTarotSpread(state.affinities);
    const initialFaces = raw.spread!.map((s) => s.card);
    const { faces: dealt } = engine.resolveTarotDeal(initialFaces);
    return dealt;
  });

  const [phase, setPhase] = useState<Phase>('deal');
  const [revealedCount, setRevealedCount] = useState(0);
  const [redrawsLeft, setRedrawsLeft] = useState(state.affinityEffects.spreadRedraws);
  const [orientResult, setOrientResult] = useState<TarotResult | null>(null);
  const [autoReverse, setAutoReverse] = useState(false);
  const [willReverse, setWillReverse] = useState(false);

  const allRevealed = revealedCount >= 3;

  // ── Reveal spread with stagger ──
  const handleRevealSpread = useCallback(() => {
    let i = 1;
    const revealNext = () => {
      if (i <= 3) {
        setRevealedCount(i);
        i++;
        if (i <= 3) setTimeout(revealNext, 400);
      }
    };
    revealNext();
  }, []);

  // When all cards revealed, build the orient result and transition.
  useEffect(() => {
    if (!allRevealed || phase !== 'deal' || faces.length === 0) return;

    const result = consolidateSpread(faces);
    const { result: oriented, auto, reversed } = engine.resolveSpreadOrientation(result);
    setOrientResult(oriented);

    const timer = setTimeout(() => {
      if (auto) {
        setAutoReverse(true);
        setWillReverse(reversed);
        setPhase('committing');
      } else {
        setPhase('orient');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [allRevealed, phase, faces, engine]);

  // ── Commit after flip animation ──
  useEffect(() => {
    if (phase !== 'committing' || !orientResult) return;

    const finalResult = willReverse ? reverseSpread(orientResult) : orientResult;
    const meta = autoReverse
      ? {}
      : willReverse
        ? { reversed: true }
        : { revealedAsDrawn: true };

    const timer = setTimeout(() => {
      engine.completeMinigame(finalResult, meta);
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, orientResult, willReverse, autoReverse, engine]);

  // ── Redraw one position ──
  const handleRedraw = useCallback(
    (index: number) => {
      if (redrawsLeft <= 0) return;
      setFaces((prev) => engine.redrawSpreadPosition(prev, index));
      setRedrawsLeft((r) => r - 1);
    },
    [redrawsLeft, engine],
  );

  // ── Orientation choice ──
  const handleOrientationChoice = useCallback((reverse: boolean) => {
    setWillReverse(reverse);
    setPhase('committing');
  }, []);

  // ── Peek ──
  const handlePeek = useCallback(() => {
    const preview = orientResult ?? consolidateSpread(faces);
    return engine.usePeek(preview);
  }, [engine, orientResult, faces]);

  const handleDeclinePeek = useCallback(() => {
    engine.declinePeek();
  }, [engine]);

  const hasAction = phase === 'deal' && !allRevealed;

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
          {phase === 'deal' && !allRevealed && 'The spread awaits...'}
          {phase === 'deal' && allRevealed && phase === 'deal' && 'Reading the spread...'}
          {phase === 'orient' && 'The stars offer a choice'}
          {phase === 'committing' && 'Your reading'}
        </h1>

        {/* ── Spread cards (always visible once dealt) ── */}
        {faces.length > 0 && (
          <motion.div
            style={spreadRowStyle}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.15 } },
            }}
          >
            {[
              { label: 'Past', index: 0 },
              { label: 'Present', index: 1 },
              { label: 'Future', index: 2 },
            ].map((pos) => {
              const card = faces[pos.index];
              const revealed =
                phase === 'deal' ? pos.index < revealedCount : true;

              return (
                <div key={pos.index} style={positionColumnStyle}>
                  <div style={positionLabelStyle}>{pos.label}</div>

                  {revealed ? (
                    <motion.div
                      key={card.id}
                      style={revealedCardStyle}
                      initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                      <CardSigil
                        card={card}
                        size={28}
                        color={
                          card.orientation === 'reversed'
                            ? '#d4a854'
                            : '#7b9ec7'
                        }
                      />
                      <div style={revealedNameStyle}>{card.name}</div>
                      <div
                        style={{
                          ...revealedOrientStyle,
                          color:
                            card.orientation === 'reversed'
                              ? '#d4a854'
                              : '#7b9ec7',
                        }}
                      >
                        {card.orientation === 'reversed'
                          ? '▼ Reversed'
                          : '▲ Upright'}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      style={faceDownCardStyle}
                      variants={{
                        hidden: { opacity: 0, y: 40 },
                        visible: { opacity: 1, y: 0 },
                      }}
                    >
                      <span style={runeStyle}>{RUNE_BAND}</span>
                      <span style={cardBackSymbolStyle}>{'✧'}</span>
                    </motion.div>
                  )}

                  {/* Redraw affordance — only during deal, before reveal */}
                  {hasAction && redrawsLeft > 0 && (
                    <motion.button
                      style={redrawBtnStyle}
                      whileHover={{ borderColor: '#d4a854' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRedraw(pos.index)}
                    >
                      Redraw ({redrawsLeft})
                    </motion.button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Reveal button (deal phase, before any cards flipped) ── */}
        {phase === 'deal' && !allRevealed && revealedCount === 0 && (
          <motion.button
            style={revealBtnStyle}
            whileHover={{ borderColor: '#d4a854', scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleRevealSpread}
          >
            Reveal the Spread
          </motion.button>
        )}

        {/* ── Orientation choice ── */}
        {phase === 'orient' && orientResult && (
          <motion.div
            style={promptStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p style={promptTextStyle}>
              Reveal as drawn, or reverse the spread&rsquo;s course?
            </p>

            {state.affinityEffects.peekAvailable && (
              <PeekControl
                onPeek={handlePeek}
                onDecline={handleDeclinePeek}
              />
            )}

            <div style={choiceRowStyle}>
              <motion.button
                style={choiceBtnStyle}
                whileHover={{ borderColor: '#d4a854', scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleOrientationChoice(false)}
              >
                {'▲'} Reveal as Drawn
              </motion.button>
              <motion.button
                style={{ ...choiceBtnStyle, borderColor: '#9b6bb0' }}
                whileHover={{ borderColor: '#c8a0d0', scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleOrientationChoice(true)}
              >
                {'▼'} Reverse the Spread&rsquo;s Course
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Commit flash ── */}
        {phase === 'committing' && orientResult && (
          <motion.div
            key={`${orientResult.id}-${willReverse ? 'reversed' : 'upright'}`}
            style={commitFlashStyle}
            initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div style={revealedSymbolStyle}>
              <CardSigil
                card={orientResult}
                size={48}
                color={willReverse ? '#d4a854' : '#7b9ec7'}
              />
            </div>
            <div style={revealedNameStyle}>
              {orientResult.name}
            </div>
            <div
              style={{
                ...revealedOrientStyle,
                color: willReverse ? '#d4a854' : '#7b9ec7',
              }}
            >
              {willReverse ? '▼ Reversed' : '▲ Upright'}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ── Peek Control ──
function PeekControl({
  onPeek,
  onDecline,
}: {
  onPeek: () => { failed: boolean; leaning: string };
  onDecline: () => void;
}) {
  const [line, setLine] = useState<string | null>(null);
  if (line) {
    return (
      <p
        style={{
          ...promptTextStyle,
          color: '#7b9ec7',
          fontStyle: 'italic',
        }}
      >
        {line}
      </p>
    );
  }
  return (
    <div style={choiceRowStyle}>
      <motion.button
        style={{ ...choiceBtnStyle, borderColor: '#d4c068' }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setLine(onPeek().leaning)}
      >
        {'✦'} Seek a glimpse
      </motion.button>
      <motion.button
        style={choiceBtnStyle}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          onDecline();
          setLine('You let the mystery stand.');
        }}
      >
        Embrace the unknown
      </motion.button>
    </div>
  );
}

// ── Style Objects ──

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

const spreadRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.25rem',
  justifyContent: 'center',
  alignItems: 'flex-start',
};

const positionColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const positionLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.85rem, 2vw, 1rem)',
  color: '#7b9ec7',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
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
  cursor: 'default',
  outline: 'none',
  fontFamily: 'inherit',
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

const revealedCardStyle: React.CSSProperties = {
  width: '100px',
  height: '150px',
  background: '#0d1220',
  border: '1px solid #9b6bb0',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0.25rem',
};

const revealedNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)',
  color: '#c8d8f0',
  letterSpacing: '0.04em',
  textAlign: 'center',
  lineHeight: 1.15,
  maxWidth: '90px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const revealedOrientStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: 'clamp(0.5rem, 1.2vw, 0.6rem)',
  letterSpacing: '0.08em',
};

const revealBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.9rem, 1.5vw, 1rem)',
  letterSpacing: '0.12em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #1a2440',
  padding: '0.8rem 2rem',
  borderRadius: '4px',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.3s ease',
};

const redrawBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)',
  letterSpacing: '0.08em',
  color: '#9b6bb0',
  background: '#0d1220',
  border: '1px solid #3a2a50',
  padding: '0.25rem 0.7rem',
  borderRadius: '3px',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.3s ease',
};

const promptStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.25rem',
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

const commitFlashStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const revealedSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
  color: '#d4a854',
};
