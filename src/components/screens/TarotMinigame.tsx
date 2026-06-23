import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { TarotDraftState, TableCard } from '../../engine/types';
import { DECK_BY_ID } from '../../data/tarot';
import CardSigil from '../cards/CardSigil';

const TABLE_CARD_WIDTH = 58; // px per card face
const TABLE_OVERLAP = 16;   // px overlap between adjacent cards
const FAN_RADIUS = 140;        // px — proximity gate for gap expansion
const MAX_GAP_EXPANSION = 26;  // px — max extra width added to a single gap

type FanState = { centerX: number; active: boolean };

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();
  const draft = state.minigameState as TarotDraftState | null;
  const tableRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(640);
  const [fan, setFan] = useState<FanState>({ centerX: 0, active: false });
  const [peekResult, setPeekResult] = useState<{ index: number; success: boolean; message: string } | null>(null);
  const [dragOverTable, setDragOverTable] = useState(false);
  const [draggingHandIdx, setDraggingHandIdx] = useState<number | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [animatingPick, setAnimatingPick] = useState<{ tableIndex: number; handIndex: number } | null>(null);
  const [animatingReturn, setAnimatingReturn] = useState<number | null>(null);

  // Track container width for correct fan-out math
  useEffect(() => {
    const update = () => { if (tableRef.current) setContainerWidth(tableRef.current.getBoundingClientRect().width); };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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
    setFan({ centerX: 0, active: false });
  }, []);

  // ── Mobile tap-to-fan ──
  const handleTableTouch = useCallback((e: React.TouchEvent) => {
    if (isDesktop || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const touchX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
    if (touchX === undefined) return;
    setFan({ centerX: touchX - rect.left, active: true });
    setTimeout(() => setFan((f) => ({ ...f, active: false })), 1500);
  }, [isDesktop]);

  // ── Actions ──
  const handlePick = useCallback((tableIndex: number) => {
    const emptySlot = draft.hand.findIndex((h) => h === null);
    if (emptySlot < 0) return;
    setAnimatingPick({ tableIndex, handIndex: emptySlot });
    // brief delay so exit animation plays before the card is removed from table
    setTimeout(() => {
      engine.pickForHand(emptySlot, tableIndex);
      setAnimatingPick(null);
    }, 200);
  }, [engine, draft.hand]);

  const handleReturnToDeck = useCallback((handIndex: number) => {
    setAnimatingReturn(handIndex);
    setTimeout(() => {
      engine.returnToDeck(handIndex);
      setAnimatingReturn(null);
    }, 180);
  }, [engine]);

  const handleReturnToTable = useCallback((handIndex: number) => {
    setAnimatingReturn(handIndex);
    setTimeout(() => {
      engine.returnToTable(handIndex);
      setAnimatingReturn(null);
    }, 180);
  }, [engine]);

  const handleShuffle = useCallback(() => {
    if (draft.shufflesRemaining <= 0) return;
    setShuffleKey((k) => k + 1);
    // Delay the actual shuffle so exit animation plays first
    setTimeout(() => {
      engine.shuffleTable();
    }, 250);
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
      handleReturnToTable(sourceIdx);
    }
  }, [handleReturnToTable]);

  const handFull = draft.hand.every((h) => h !== null);
  const peekAvailable = state.affinityEffects.peekAvailable;

  // ── Compute fan displacements (absolute-container coordinate system) ──
  const fanDisplacements = useMemo(() => {
    const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);
    const totalCards = draft.table.length;
    const cardStep = TABLE_CARD_WIDTH - TABLE_OVERLAP;
    const totalSpan = totalCards * cardStep + TABLE_OVERLAP;
    // first card's left edge offset from container center
    const startOffset = -totalSpan / 2;

    // Each card's default center in absolute container coordinates (ascending).
    const centers = activeTableCards.map((card) => {
      const defaultLeftOffset = startOffset + card.originIndex * cardStep;
      return containerWidth / 2 + defaultLeftOffset + TABLE_CARD_WIDTH / 2;
    });

    const offsets = fan.active
      ? computeFanOffsets(centers, fan.centerX, { radius: FAN_RADIUS, maxGapExpansion: MAX_GAP_EXPANSION })
      : centers.map(() => 0);

    return activeTableCards.map((card, i) => {
      const defaultLeftOffset = startOffset + card.originIndex * cardStep;
      const cardCenterAbs = centers[i];
      const offsetX = offsets[i];
      let scale = 1;
      if (fan.active) {
        const dist = Math.abs(cardCenterAbs - fan.centerX);
        if (dist < FAN_RADIUS) scale = 1 + 0.06 * (1 - dist / FAN_RADIUS);
      }
      return { cardId: card.cardId, originIndex: card.originIndex, defaultLeftOffset, offsetX, scale, cardCenterAbs };
    });
  }, [draft.table, fan, containerWidth]);

  // Quick lookup by originIndex
  const dispMap = useMemo(
    () => new Map(fanDisplacements.map((d) => [`${d.cardId}-${d.originIndex}`, d])),
    [fanDisplacements],
  );

  // ── Render ──
  const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);

  // During the review beat the screen stays mounted in the committing phase.
  // Surface the committed Past/Present/Future faces face-up in the hand row.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const committedSpread =
    draft.phase === 'committing' && committedSlot && committedSlot.type === 'tarot'
      ? committedSlot.spread ?? null
      : null;

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <style>{`.snap-scroll-row::-webkit-scrollbar{display:none}`}</style>

      <div style={contentStyle}>
        {/* Heading */}
        <motion.h1
          key={`h-${handFull ? 'full' : 'draft'}-${draft.phase}`}
          style={headingStyle}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {draft.phase === 'drafting' && !handFull && 'Draft your spread...'}
          {draft.phase === 'drafting' && handFull && 'Your spread awaits'}
          {draft.phase === 'committing' && 'The cards are cast'}
        </motion.h1>

        {/* Deck visual */}
        <motion.div style={deckStyle} layout>
          <div style={deckStackStyle}>
            {draft.deck.length > 0 && <div style={deckCardBack(0)} />}
            {draft.deck.length > 1 && <div style={deckCardBack(1)} />}
            {draft.deck.length > 2 && <div style={deckCardBack(2)} />}
          </div>
          <motion.span
            key={`count-${draft.deck.length}`}
            style={deckCountStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {draft.deck.length} cards
          </motion.span>
        </motion.div>

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
          <AnimatePresence mode="popLayout">
            <motion.div key={`table-${shuffleKey}`} style={tableInnerStyle}>
              {activeTableCards.map((card, i) => {
                const cardData = DECK_BY_ID[card.cardId];
                if (!cardData) return null;
                const d = dispMap.get(`${card.cardId}-${card.originIndex}`);
                const defaultLeftOffset = d?.defaultLeftOffset ?? 0;
                const offsetX = d?.offsetX ?? 0;
                const scale = d?.scale ?? 1;
                const leftPx = containerWidth / 2 + defaultLeftOffset + offsetX;

                const isPicking = animatingPick?.tableIndex === card.originIndex;

                return (
                  <motion.div
                    key={`${card.cardId}-${card.originIndex}-${shuffleKey}`}
                    layout
                    style={{
                      ...tableCardStyle,
                      position: 'absolute',
                      left: `${leftPx}px`,
                      marginLeft: `${-TABLE_CARD_WIDTH / 2}px`,
                      width: `${TABLE_CARD_WIDTH}px`,
                      transform: `scale(${scale})`,
                      zIndex: cardIndexZ(d?.cardCenterAbs ?? 0, fan),
                      background: card.faceUp ? '#0d1220' : '#080d18',
                      borderColor: card.faceUp ? '#7b9ec7' : '#1a2440',
                      cursor: handFull ? 'default' : 'pointer',
                      opacity: handFull ? 0.5 : 1,
                    }}
                    whileHover={!handFull ? { borderColor: '#d4a854', y: -3 } : {}}
                    whileTap={!handFull ? { scale: Math.min(scale, 1) * 1.05 } : {}}
                    onClick={() => !handFull && !animatingPick && handlePick(card.originIndex)}
                    initial={
                      shuffleKey > 0
                        ? { opacity: 0, y: -30, scale: 0.8 }
                        : { opacity: 0, y: -20 }
                    }
                    animate={
                      isPicking
                        ? { opacity: 0, scale: 0.5, y: 40, transition: { duration: 0.2 } }
                        : { opacity: handFull ? 0.5 : 1, y: 0, scale: 1 }
                    }
                    exit={{ opacity: 0, y: -30, scale: 0.8, transition: { duration: 0.2 } }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 25,
                      delay: shuffleKey > 0 ? i * 0.04 : i * 0.03,
                    }}
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Shuffle button */}
        <motion.button
          key={`shuffle-${draft.shufflesRemaining}`}
          style={draft.shufflesRemaining > 0 ? shuffleBtnStyle : { ...shuffleBtnStyle, opacity: 0.4, cursor: 'not-allowed' }}
          whileHover={draft.shufflesRemaining > 0 ? { borderColor: '#d4a854', scale: 1.03 } : {}}
          whileTap={draft.shufflesRemaining > 0 ? { scale: 0.97 } : {}}
          onClick={handleShuffle}
          disabled={draft.shufflesRemaining <= 0}
          initial={false}
          animate={draft.shufflesRemaining > 0 ? { opacity: 1 } : { opacity: 0.4 }}
        >
          ↻ Shuffle ({draft.shufflesRemaining})
        </motion.button>

        {/* Hand */}
        <div style={handAreaStyle}>
          <div style={handSlotsStyle}>
            {(['Past', 'Present', 'Future'] as const).map((label, i) => {
              const card = draft.hand[i];
              const isReturning = animatingReturn === i;
              const revealed = committedSpread?.[i]?.card;
              return (
                <div
                  key={label}
                  style={handSlotColumnStyle}
                  onDragOver={handleHandDragOver}
                  onDrop={(e) => handleHandDrop(e, i)}
                >
                  <div style={handLabelStyle}>{label}</div>
                  <AnimatePresence mode="wait">
                    {revealed ? (
                      <motion.div
                        key={`revealed-${revealed.id}-${i}`}
                        style={{ ...handCardStyle, cursor: 'default', borderColor: '#7b9ec7' }}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: i * 0.12 }}
                      >
                        <CardSigil card={revealed} size={22} color="#7b9ec7" />
                        <div style={handCardNameStyle}>{revealed.name}</div>
                        <div style={handCardOrientStyle}>
                          {revealed.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
                        </div>
                      </motion.div>
                    ) : card ? (
                      <div
                        key={`hand-wrap-${card.cardId}-${card.tableOriginIndex}`}
                        draggable
                        onDragStart={(e) => handleHandDragStart(e as unknown as React.DragEvent, i)}
                        style={{
                          ...handCardStyle,
                          opacity: draggingHandIdx === i ? 0.5 : 1,
                        }}
                      >
                        <motion.div
                          key={`hand-${card.cardId}-${card.tableOriginIndex}`}
                          style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          initial={{ opacity: 0, scale: 0.7, y: 30 }}
                          animate={
                            isReturning
                              ? { opacity: 0, scale: 0.7, y: -30 }
                              : { opacity: 1, scale: 1, y: 0 }
                          }
                          exit={{ opacity: 0, scale: 0.7, y: -20 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
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
                      <motion.div
                        key={`empty-${i}`}
                        style={emptyHandSlotStyle}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                      >
                        <span style={emptySlotSymbolStyle}>·</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit buttons */}
        <AnimatePresence>
          {handFull && draft.phase === 'drafting' && (
            <motion.div
              style={commitRowStyle}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            >
              <motion.button style={revealBtnStyle} whileHover={{ borderColor: '#d4a854', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleReveal}>
                ▲ Reveal as Drawn
              </motion.button>
              <motion.button style={{ ...revealBtnStyle, borderColor: '#9b6bb0' }} whileHover={{ borderColor: '#c8a0d0', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleInvert}>
                ▼ Invert Meaning
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

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

// ── Helpers ──

interface FanParams {
  radius: number;          // falloff width in px (proximity gate)
  maxGapExpansion: number; // max extra px added to a single gap
}

/**
 * Gap-expansion fan-out. The cluster of cards near the cursor breathes open:
 * gaps widen most where they are nearest the cursor, so the card under the
 * pointer barely moves and becomes easy to click. Order is always preserved.
 * cardCenters must be ascending. Returns the signed x-delta for each card.
 */
export function computeFanOffsets(
  cardCenters: number[],
  cursorX: number,
  { radius, maxGapExpansion }: FanParams,
): number[] {
  const n = cardCenters.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  // Smooth Gaussian falloff, zero beyond the radius (enforces max repel distance).
  const falloff = (u: number) => (u <= 1 ? Math.exp(-3 * u * u) : 0);

  // Expansion of each adjacent gap (length n-1), gated by its midpoint's distance.
  const gapExpansion: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const midpoint = (cardCenters[i] + cardCenters[i + 1]) / 2;
    const u = Math.abs(midpoint - cursorX) / radius;
    gapExpansion.push(maxGapExpansion * falloff(u));
  }

  // Each card's offset is the signed sum of the expansions of gaps that lie
  // between it and the cursor (cursor-anchored integration).
  const offsets: number[] = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    let offset = 0;
    for (let i = 0; i < n - 1; i++) {
      const midpoint = (cardCenters[i] + cardCenters[i + 1]) / 2;
      // Card k right of gap i, cursor left of gap i → push card right.
      if (k >= i + 1 && cursorX < midpoint) offset += gapExpansion[i];
      // Card k left of gap i, cursor right of gap i → push card left.
      else if (k <= i && cursorX > midpoint) offset -= gapExpansion[i];
    }
    offsets[k] = offset;
  }

  // Re-center: subtract the mean so the cluster's center of mass stays put.
  const mean = offsets.reduce((s, v) => s + v, 0) / n;
  return offsets.map((o) => o - mean);
}

/** Cards closer to the cursor get a higher z-index so the opened-up card layers above its neighbors. */
function cardIndexZ(cardCenterAbs: number, fan: FanState): number {
  if (!fan.active) return 1;
  const dist = Math.abs(cardCenterAbs - fan.centerX);
  return Math.max(1, Math.round(1000 - dist));
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

const deckCardBack = (i: number): React.CSSProperties => ({
  position: 'absolute',
  top: `${i * 2}px`,
  left: `${i * 2}px`,
  width: '46px', height: '62px',
  background: '#080d18', border: '1px solid #1a2440', borderRadius: '4px',
});

const deckCountStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.65rem',
  color: '#5b7290', letterSpacing: '0.05em',
};

const tableAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: '120px', border: '1px dashed #1a2440',
  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', transition: 'border-color 0.3s ease', overflow: 'hidden',
};

const tableInnerStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const tableCardStyle: React.CSSProperties = {
  height: '84px', border: '1px solid #1a2440', borderRadius: '4px',
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
