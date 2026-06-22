import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { TarotDraftState, TableCard } from '../../engine/types';
import { DECK_BY_ID } from '../../data/tarot';
import CardSigil from '../cards/CardSigil';

const TABLE_CARD_WIDTH = 58; // px per card face
const TABLE_OVERLAP = 16;    // px overlap between adjacent cards
const FAN_RADIUS = 200;      // px — hover fan-out radius
const MAX_FAN_OFFSET = 30;   // px — max displacement
type FanState = { centerX: number; active: boolean };

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();
  const draft = state.minigameState as TarotDraftState | null;
  const tableRef = useRef<HTMLDivElement>(null);
  const [fan, setFan] = useState<FanState>({ centerX: 0, active: false });
  const [peekResult, setPeekResult] = useState<{ index: number; success: boolean; message: string } | null>(null);
  const [dragOverTable, setDragOverTable] = useState(false);
  const [draggingHandIdx, setDraggingHandIdx] = useState<number | null>(null);

  if (!draft) return null;
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  // ── Hover fan-out (desktop) ──
  const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDesktop || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    setFan({ centerX, active: true });
  }, [isDesktop]);

  const handleTableMouseLeave = useCallback(() => {
    setFan((f) => ({ ...f, active: false }));
  }, []);

  // ── Mobile tap-to-fan ──
  const handleTableTouch = useCallback((e: React.TouchEvent) => {
    if (isDesktop || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const touchX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
    if (touchX === undefined) return;
    const centerX = touchX - rect.left;
    setFan({ centerX, active: true });
    // Auto-collapse after 1.5s of no interaction
    setTimeout(() => setFan((f) => ({ ...f, active: false })), 1500);
  }, [isDesktop]);

  // ── Actions ──
  const handlePick = useCallback((tableIndex: number) => {
    const emptySlot = draft.hand.findIndex((h) => h === null);
    if (emptySlot < 0) return; // hand full
    engine.pickForHand(emptySlot, tableIndex);
  }, [engine, draft.hand]);

  const handleReturnToDeck = useCallback((handIndex: number) => {
    engine.returnToDeck(handIndex);
  }, [engine]);

  const handleShuffle = useCallback(() => {
    if (draft.shufflesRemaining <= 0) return;
    engine.shuffleTable();
  }, [engine, draft.shufflesRemaining]);

  const handlePeek = useCallback((handIndex: number) => {
    const result = engine.peekHandCard(handIndex);
    setPeekResult({ index: handIndex, ...result });
    setTimeout(() => setPeekResult(null), 2500);
  }, [engine]);

  const handleReveal = useCallback(() => {
    engine.commitDraft(false);
  }, [engine]);

  const handleInvert = useCallback(() => {
    engine.commitDraft(true);
  }, [engine]);

  // ── Drag to swap hand cards ──
  const handleHandDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDraggingHandIdx(idx);
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleHandDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleHandDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      engine.swapHandCards(sourceIdx, targetIdx);
    }
    setDraggingHandIdx(null);
  }, [engine]);

  // ── Drag from hand to table (return) ──
  const handleTableDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTable(true);
  }, []);

  const handleTableDragLeave = useCallback(() => {
    setDragOverTable(false);
  }, []);

  const handleTableDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTable(false);
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIdx)) {
      engine.returnToTable(sourceIdx);
    }
  }, [engine]);

  const handFull = draft.hand.every((h) => h !== null);
  const peekAvailable = state.affinityEffects.peekAvailable;

  // ── Compute fan displacements ──
  const getFanStyle = (cardIndex: number, totalCards: number): React.CSSProperties => {
    const cardWidth = TABLE_CARD_WIDTH - TABLE_OVERLAP; // visible width of each card
    const totalWidth = totalCards * cardWidth + TABLE_OVERLAP;
    const startX = -(totalWidth / 2) + cardWidth / 2;
    const baseX = startX + cardIndex * cardWidth;
    const cardCenterX = baseX + TABLE_CARD_WIDTH / 2;

    let offsetX = 0;
    let scale = 1;
    if (fan.active) {
      const dist = Math.abs(cardCenterX - fan.centerX);
      if (dist < FAN_RADIUS) {
        const t = 1 - dist / FAN_RADIUS;
        offsetX = (cardCenterX > fan.centerX ? 1 : -1) * MAX_FAN_OFFSET * t * t;
        scale = 1 + 0.06 * t;
      }
    }

    return {
      position: 'absolute' as const,
      left: '50%',
      marginLeft: `${-(TABLE_CARD_WIDTH / 2) + baseX + offsetX}px`,
      width: `${TABLE_CARD_WIDTH}px`,
      transform: `scale(${scale})`,
      zIndex: cardIndex,
      transition: fan.active ? 'none' : 'transform 0.3s ease, margin-left 0.3s ease',
    };
  };

  // ── Render ──
  const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <style>{`.snap-scroll-row::-webkit-scrollbar{display:none}`}</style>

      <div style={contentStyle}>
        {/* Heading */}
        <h1 style={headingStyle}>
          {draft.phase === 'drafting' && !handFull && 'Draft your spread...'}
          {draft.phase === 'drafting' && handFull && 'Your spread awaits'}
          {draft.phase === 'committing' && 'The cards are cast'}
        </h1>

        {/* Deck visual */}
        <div style={deckStyle}>
          <div style={deckStackStyle}>
            <div style={deckCardBack} />
            <div style={deckCardBack} />
            <div style={deckCardBack} />
          </div>
          <span style={deckCountStyle}>{draft.deck.length} cards</span>
        </div>

        {/* Table spread */}
        <div
          ref={tableRef}
          style={{
            ...tableAreaStyle,
            borderColor: dragOverTable ? '#d4a854' : '#1a2440',
          }}
          onMouseMove={handleTableMouseMove}
          onMouseLeave={handleTableMouseLeave}
          onTouchStart={handleTableTouch}
          onDragOver={handleTableDragOver}
          onDragLeave={handleTableDragLeave}
          onDrop={handleTableDrop}
        >
          <div style={tableInnerStyle}>
            {activeTableCards.map((card, i) => {
              const cardData = DECK_BY_ID[card.cardId];
              if (!cardData) return null;
              return (
                <motion.div
                  key={`${card.cardId}-${card.originIndex}`}
                  style={{
                    ...tableCardStyle,
                    ...getFanStyle(card.originIndex, draft.table.length),
                    background: card.faceUp ? '#0d1220' : '#080d18',
                    borderColor: card.faceUp ? '#7b9ec7' : '#1a2440',
                    cursor: handFull ? 'default' : 'pointer',
                    opacity: handFull ? 0.5 : 1,
                  }}
                  whileHover={!handFull ? { borderColor: '#d4a854' } : {}}
                  whileTap={!handFull ? { scale: 1.05 } : {}}
                  onClick={() => !handFull && handlePick(card.originIndex)}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: handFull ? 0.5 : 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {card.faceUp && card.revealedFace ? (
                    <>
                      <CardSigil card={card.revealedFace} size={20} color="#7b9ec7" />
                      <div style={tableCardNameStyle}>{card.revealedFace.name}</div>
                      <div style={tableCardOrientStyle}>
                        {card.revealedFace.orientation === 'upright' ? '▲' : '▼'}
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={tableRuneStyle}>ᚠᚢᚦ</span>
                      <span style={tableStarStyle}>✧</span>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Shuffle button */}
        <motion.button
          style={draft.shufflesRemaining > 0 ? shuffleBtnStyle : { ...shuffleBtnStyle, opacity: 0.4, cursor: 'not-allowed' }}
          whileHover={draft.shufflesRemaining > 0 ? { borderColor: '#d4a854', scale: 1.03 } : {}}
          whileTap={draft.shufflesRemaining > 0 ? { scale: 0.97 } : {}}
          onClick={handleShuffle}
          disabled={draft.shufflesRemaining <= 0}
        >
          ↻ Shuffle ({draft.shufflesRemaining})
        </motion.button>

        {/* Hand */}
        <div style={handAreaStyle}>
          <div style={handSlotsStyle}>
            {(['Past', 'Present', 'Future'] as const).map((label, i) => {
              const card = draft.hand[i];
              return (
                <div
                  key={label}
                  style={handSlotColumnStyle}
                  onDragOver={handleHandDragOver}
                  onDrop={(e) => handleHandDrop(e, i)}
                >
                  <div style={handLabelStyle}>{label}</div>
                  {card ? (
                    <div
                      draggable
                      onDragStart={(e) => handleHandDragStart(e, i)}
                      style={{
                        ...handCardStyle,
                        opacity: draggingHandIdx === i ? 0.5 : 1,
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                      >
                      {card.peeked && card.revealedFace ? (
                        <>
                          <CardSigil card={card.revealedFace} size={22} color="#7b9ec7" />
                          <div style={handCardNameStyle}>{card.revealedFace.name}</div>
                          <div style={handCardOrientStyle}>
                            {card.revealedFace.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={handRuneStyle}>ᚠᚢᚦᚨ</span>
                          <span style={handStarStyle}>✧</span>
                        </>
                      )}

                      {/* Affordances: peek + return-to-deck */}
                      <div style={handAffordanceStyle}>
                        {peekAvailable && !card.peeked && (
                          <motion.button
                            style={handIconBtnStyle}
                            whileHover={{ scale: 1.2 }}
                            onClick={(e) => { e.stopPropagation(); handlePeek(i); }}
                            title="Peek"
                          >
                            👁
                          </motion.button>
                        )}
                        <motion.button
                          style={handIconBtnStyle}
                          whileHover={{ scale: 1.2 }}
                          onClick={(e) => { e.stopPropagation(); handleReturnToDeck(i); }}
                          title="Return to deck"
                        >
                          ↩
                        </motion.button>
                      </div>
                    </motion.div>
                    </div>
                  ) : (
                    <div style={emptyHandSlotStyle}>
                      <span style={emptySlotSymbolStyle}>·</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit buttons */}
        {handFull && draft.phase === 'drafting' && (
          <motion.div style={commitRowStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <motion.button style={revealBtnStyle} whileHover={{ borderColor: '#d4a854', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleReveal}>
              ▲ Reveal as Drawn
            </motion.button>
            <motion.button style={{ ...revealBtnStyle, borderColor: '#9b6bb0' }} whileHover={{ borderColor: '#c8a0d0', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleInvert}>
              ▼ Invert Meaning
            </motion.button>
          </motion.div>
        )}

        {/* Peek result popup */}
        <AnimatePresence>
          {peekResult && (
            <motion.div
              style={{
                ...peekPopupStyle,
                borderColor: peekResult.success ? '#7b9ec7' : '#c75b4a',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {peekResult.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  width: '100%', maxWidth: '640px', padding: '1.5rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', color: '#c8d8f0',
  letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};

const deckStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
};

const deckStackStyle: React.CSSProperties = {
  position: 'relative', width: '50px', height: '60px',
};

const deckCardBack: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '46px', height: '62px',
  background: '#080d18', border: '1px solid #1a2440', borderRadius: '4px',
};

const deckCountStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.65rem',
  color: '#5b7290', letterSpacing: '0.05em',
};

const tableAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: '120px', border: '1px dashed #1a2440',
  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', transition: 'border-color 0.3s ease',
};

const tableInnerStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const tableCardStyle: React.CSSProperties = {
  width: '58px', height: '84px', border: '1px solid #1a2440', borderRadius: '4px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.2rem', cursor: 'pointer', userSelect: 'none',
};

const tableRuneStyle: React.CSSProperties = {
  fontFamily: "'Noto Sans', sans-serif", fontSize: '0.4rem', color: '#5b7290',
  letterSpacing: '0.2em',
};

const tableStarStyle: React.CSSProperties = {
  fontSize: '0.9rem', color: '#9b6bb0', opacity: 0.5,
};

const tableCardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.45rem', color: '#c8d8f0', textAlign: 'center', lineHeight: 1.1,
  maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const tableCardOrientStyle: React.CSSProperties = {
  fontSize: '0.5rem', color: '#7b9ec7',
};

const shuffleBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440',
  padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: 'pointer', outline: 'none',
};

const handAreaStyle: React.CSSProperties = {
  width: '100%',
};

const handSlotsStyle: React.CSSProperties = {
  display: 'flex', gap: '0.75rem', justifyContent: 'center',
};

const handSlotColumnStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
};

const handLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.75rem', color: '#7b9ec7', letterSpacing: '0.08em', textTransform: 'uppercase',
};

const handCardStyle: React.CSSProperties = {
  width: '90px', height: '130px', background: '#0d1220', border: '1px solid #3a2a50',
  borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: '0.35rem', position: 'relative', cursor: 'grab',
};

const handCardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.6rem', color: '#c8d8f0', textAlign: 'center', lineHeight: 1.15,
  maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const handCardOrientStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400,
  fontSize: '0.5rem', color: '#7b9ec7', letterSpacing: '0.05em',
};

const handRuneStyle: React.CSSProperties = {
  fontFamily: "'Noto Sans', sans-serif", fontSize: '0.5rem', color: '#5b7290', letterSpacing: '0.25em',
};

const handStarStyle: React.CSSProperties = {
  fontSize: '1.2rem', color: '#9b6bb0', opacity: 0.5,
};

const handAffordanceStyle: React.CSSProperties = {
  position: 'absolute', bottom: '4px', display: 'flex', gap: '0.25rem',
};

const handIconBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: '0.7rem', background: 'none', border: 'none',
  color: '#7b9ec7', cursor: 'pointer', padding: '0.15rem', lineHeight: 1, outline: 'none',
};

const emptyHandSlotStyle: React.CSSProperties = {
  width: '90px', height: '130px', border: '1px dashed #1a2440', borderRadius: '6px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4,
};

const emptySlotSymbolStyle: React.CSSProperties = {
  fontSize: '1.5rem', color: '#5b7290',
};

const commitRowStyle: React.CSSProperties = {
  display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
};

const revealBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.4vw, 0.9rem)', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440',
  padding: '0.6rem 1.5rem', borderRadius: '4px', cursor: 'pointer', outline: 'none',
};

const peekPopupStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
  fontSize: '0.8rem', color: '#c8d8f0', background: '#0d1220',
  border: '1px solid #7b9ec7', borderRadius: '4px', padding: '0.5rem 1rem',
  textAlign: 'center', fontStyle: 'italic',
};
