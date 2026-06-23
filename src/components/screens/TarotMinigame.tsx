import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { TarotDraftState, TableCard } from '../../engine/types';
import { DECK_BY_ID } from '../../data/tarot';
import CardSigil from '../cards/CardSigil';
import CardBack from '../cards/CardBack';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import RunicBand from '../shared/RunicBand';
import { restCenters, computeFanLayout } from '../../engine/fanLayout';
import { GiCardRandom, GiCardPickup, GiEyeball } from 'react-icons/gi';

const TABLE_CARD_WIDTH = 58;          // px per card face (max repulsion = side by side)
const TABLE_REST_STEP = 42;           // center-to-center at rest (overlapped)
const TABLE_MIN_STEP = 30;            // deepest compression center-to-center
const FAN_RADIUS = 140;               // px — proximity falloff

type FanState = { centerX: number; active: boolean };

const SLOT_THEMES = [
  { key: 'past',    accent: '#7b9ec7', label: 'Past',    glow: 'rgba(123,158,199,0.30)' },
  { key: 'present', accent: '#d4a854', label: 'Present', glow: 'rgba(212,168,84,0.30)' },
  { key: 'future',  accent: '#9b6bb0', label: 'Future',  glow: 'rgba(155,107,176,0.30)' },
] as const;

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();
  const draft = state.minigameState as TarotDraftState | null;
  const tableRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingXRef = useRef<number | null>(null);
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

  // Cancel any pending rAF on unmount
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  if (!draft) return null;
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  // ── Hover fan-out (desktop) — rAF-throttled ──
  const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDesktop || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    pendingXRef.current = e.clientX - rect.left;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingXRef.current != null) setFan({ centerX: pendingXRef.current, active: true });
    });
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

  // ── Render ──
  const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);

  // ── Compute fan centers via fanLayout module ──
  const fanCenters = useMemo(() => {
    const count = activeTableCards.length;
    const params = {
      count, containerWidth, cardWidth: TABLE_CARD_WIDTH,
      restStep: TABLE_REST_STEP, minStep: TABLE_MIN_STEP, radius: FAN_RADIUS,
    };
    const rest = restCenters({ count, containerWidth, restStep: TABLE_REST_STEP });
    const live = computeFanLayout(fan.centerX, fan.active, params);
    return activeTableCards.map((_, i) => ({ rest: rest[i], center: live[i] }));
  }, [activeTableCards.length, fan, containerWidth]);

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
        <OrnamentalBorder width="120px" />

        {/* Deck rail + table spread in a horizontal row */}
        <div style={tableRowStyle}>
          {/* Deck rail */}
          <div style={deckRailStyle}>
            <div style={deckStackStyle}>
              {draft.deck.length > 2 && <div style={deckCardBack(2)} />}
              {draft.deck.length > 1 && <div style={deckCardBack(1)} />}
              {draft.deck.length > 0 && (
                <div style={{ ...deckCardBack(0), display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none' }}>
                  <CardBack size={46} />
                </div>
              )}
            </div>
            <motion.span
              key={`count-${draft.deck.length}`}
              style={deckCountStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {draft.deck.length} cards
            </motion.span>
          </div>

          {/* Spread column */}
          <div style={spreadColStyle}>
            <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />
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
          {/* Celestial backdrop + arcane corner flourishes */}
          <svg
            viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.5 }}
          >
            {TABLE_STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.gold ? '#d4a854' : '#7b9ec7'} opacity={s.o} />
            ))}
          </svg>
          {CORNER_FLOURISHES.map((transform, i) => (
            <svg
              key={i} width="22" height="22" viewBox="0 0 22 22" aria-hidden
              style={{ position: 'absolute', pointerEvents: 'none', color: '#d4a854', opacity: 0.55, ...cornerPos(i), transform }}
            >
              <path d="M1 1 H9 M1 1 V9 M1 1 Q11 11 21 11 M1 1 Q11 11 11 21" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
            </svg>
          ))}
          <AnimatePresence mode="popLayout">
            <motion.div key={`table-${shuffleKey}`} style={tableInnerStyle}>
              {activeTableCards.map((card, i) => {
                const cardData = DECK_BY_ID[card.cardId];
                if (!cardData) return null;
                const fc = fanCenters[i];
                const restLeft = fc?.rest ?? containerWidth / 2;
                const dx = (fc?.center ?? restLeft) - restLeft;
                const dist = fan.active ? Math.abs((fc?.center ?? 0) - fan.centerX) : Infinity;
                const scale = fan.active && dist < FAN_RADIUS ? 1 + 0.06 * (1 - dist / FAN_RADIUS) : 1;
                const isPicking = animatingPick?.tableIndex === card.originIndex;

                return (
                  <motion.div
                    key={`${card.cardId}-${card.originIndex}-${shuffleKey}`}
                    style={{
                      ...tableCardStyle,
                      position: 'absolute',
                      left: `${restLeft}px`,
                      marginLeft: `${-TABLE_CARD_WIDTH / 2}px`,
                      width: `${TABLE_CARD_WIDTH}px`,
                      transform: `translateX(${dx}px) scale(${scale})`,
                      transition: 'transform 70ms ease-out',
                      zIndex: fan.active ? Math.max(1, Math.round(1000 - dist)) : 1,
                      background: card.faceUp ? '#0d1220' : '#080d18',
                      borderColor: card.faceUp ? '#7b9ec7' : '#1a2440',
                      cursor: handFull ? 'default' : 'pointer',
                      opacity: handFull ? 0.5 : 1,
                    }}
                    whileHover={!handFull ? { y: -3, boxShadow: '0 0 14px rgba(212,168,84,0.5)' } : {}}
                    onClick={() => !handFull && !animatingPick && handlePick(card.originIndex)}
                    initial={shuffleKey > 0 ? { opacity: 0, y: -30 } : { opacity: 0, y: -20 }}
                    animate={isPicking ? { opacity: 0, y: 40 } : { opacity: handFull ? 0.5 : 1, y: 0 }}
                    exit={{ opacity: 0, y: -30, transition: { duration: 0.2 } }}
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
                      <CardBack size={44} />
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
            </div>
            <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />
          </div>
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
          <GiCardRandom style={{ verticalAlign: '-2px' }} /> Shuffle ({draft.shufflesRemaining})
        </motion.button>

        {/* Hand */}
        <div style={handAreaStyle}>
          <div style={handSlotsStyle}>
            {SLOT_THEMES.map((theme, i) => {
              const label = theme.label;
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
                  <div style={{ ...handLabelStyle, color: theme.accent, textShadow: `0 0 8px ${theme.glow}` }}>
                    {label}
                  </div>
                  <AnimatePresence mode="wait">
                    {revealed ? (
                      <motion.div
                        key={`revealed-${revealed.id}-${i}`}
                        style={{ ...slotCardStyle(theme.accent), cursor: 'default' }}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: i * 0.12 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden
                          style={{ position: 'absolute', top: 4, left: 4, color: theme.accent, opacity: 0.6 }}>
                          <path d="M1 1 H9 M1 1 V9 M1 1 Q11 11 21 11 M1 1 Q11 11 11 21"
                            stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                        </svg>
                        <CardSigil card={revealed} size={22} color={theme.accent} />
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
                          ...slotCardStyle(theme.accent),
                          opacity: draggingHandIdx === i ? 0.5 : 1,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 22 22" aria-hidden
                          style={{ position: 'absolute', top: 4, left: 4, color: theme.accent, opacity: 0.6 }}>
                          <path d="M1 1 H9 M1 1 V9 M1 1 Q11 11 21 11 M1 1 Q11 11 11 21"
                            stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                        </svg>
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
                            <CardSigil card={card.revealedFace} size={22} color={theme.accent} />
                            <div style={handCardNameStyle}>{card.revealedFace.name}</div>
                            <div style={handCardOrientStyle}>
                              {card.revealedFace.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
                            </div>
                          </>
                        ) : (
                          <CardBack size={64} />
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
                              <GiEyeball />
                            </motion.button>
                          )}
                          <motion.button
                            style={handIconBtnStyle}
                            whileHover={{ scale: 1.2 }}
                            onClick={(e) => { e.stopPropagation(); handleReturnToDeck(i); }}
                            title="Return to deck"
                          >
                            <GiCardPickup />
                          </motion.button>
                        </div>
                      </motion.div>
                      </div>
                    ) : (
                      <motion.div
                        key={`empty-${i}`}
                        style={slotEmptyStyle(theme.accent)}
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

// Static decorative starfield for the tableau backdrop (viewBox 0 0 200 100).
const TABLE_STARS: { x: number; y: number; r: number; o: number; gold?: boolean }[] = [
  { x: 18, y: 22, r: 0.7, o: 0.7 }, { x: 46, y: 12, r: 0.5, o: 0.5 },
  { x: 80, y: 30, r: 0.6, o: 0.6, gold: true }, { x: 120, y: 18, r: 0.5, o: 0.55 },
  { x: 150, y: 36, r: 0.7, o: 0.65 }, { x: 182, y: 24, r: 0.5, o: 0.5, gold: true },
  { x: 30, y: 70, r: 0.6, o: 0.55 }, { x: 70, y: 82, r: 0.5, o: 0.5 },
  { x: 110, y: 74, r: 0.7, o: 0.6, gold: true }, { x: 160, y: 80, r: 0.5, o: 0.5 },
  { x: 100, y: 50, r: 0.4, o: 0.4 }, { x: 138, y: 58, r: 0.5, o: 0.45 },
];

// Four corner flourish rotations (TL, TR, BL, BR).
const CORNER_FLOURISHES = ['none', 'scaleX(-1)', 'scaleY(-1)', 'scale(-1,-1)'];

function cornerPos(i: number): React.CSSProperties {
  const v = i < 2 ? { top: '6px' } : { bottom: '6px' };
  const h = i % 2 === 0 ? { left: '6px' } : { right: '6px' };
  return { ...v, ...h };
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

const tableRowStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.85rem',
  width: '100%', flexWrap: 'wrap', justifyContent: 'center',
};

const deckRailStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
  padding: '0.75rem 0.6rem', flex: '0 0 auto',
  background: 'radial-gradient(80% 80% at 50% 30%, rgba(42,21,69,0.35), rgba(7,11,20,0.6))',
  border: '1px solid #2a2150', borderRadius: '10px',
  boxShadow: '0 0 16px rgba(212,168,84,0.18), inset 0 0 18px rgba(8,13,24,0.8)',
};

const spreadColStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem',
  flex: '1 1 360px', minWidth: '260px',
};

const deckStackStyle: React.CSSProperties = {
  position: 'relative', width: '54px', height: '66px',
  filter: 'drop-shadow(0 0 8px rgba(212,168,84,0.35))',
};

// Symmetric stack: back cards inset on both sides so the front face (i=0)
// sits centred on the stack's center line.
const deckCardBack = (i: number): React.CSSProperties => ({
  position: 'absolute',
  top: `${4 - i * 2}px`,
  left: `${4 - i * 2}px`,
  width: '46px', height: '62px',
  background: '#080d18', border: '1px solid #1a2440', borderRadius: '4px',
});

const deckCountStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.65rem',
  color: '#5b7290', letterSpacing: '0.05em',
};

const tableAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: '120px', border: '1px solid #1a2440',
  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', transition: 'border-color 0.3s ease', overflow: 'hidden',
  position: 'relative',
  background:
    'radial-gradient(120% 90% at 50% 0%, rgba(42,21,69,0.28), transparent 60%),' +
    'radial-gradient(80% 70% at 20% 100%, rgba(15,31,61,0.25), transparent 70%),' +
    '#070b14',
  boxShadow: 'inset 0 0 36px rgba(8,13,24,0.9)',
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
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: '0.78rem', color: '#d4a854', letterSpacing: '0.18em', textTransform: 'uppercase',
  textShadow: '0 0 8px rgba(212,168,84,0.25)',
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


const handAffordanceStyle: React.CSSProperties = {
  position: 'absolute', bottom: '4px', display: 'flex', gap: '0.25rem',
};

const handIconBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: '0.85rem', background: 'none', border: 'none',
  color: '#7b9ec7', cursor: 'pointer', padding: '0.15rem', lineHeight: 1, outline: 'none',
};

function slotCardStyle(accent: string): React.CSSProperties {
  return {
    ...handCardStyle, borderColor: accent,
    boxShadow: `0 0 14px ${accent}33, inset 0 0 18px rgba(8,13,24,0.6)`,
  };
}

function slotEmptyStyle(accent: string): React.CSSProperties {
  return {
    ...emptyHandSlotStyle, borderColor: accent,
    background: `radial-gradient(60% 60% at 50% 40%, ${accent}1f, transparent)`,
  };
}

const emptyHandSlotStyle: React.CSSProperties = {
  width: '90px', height: '130px', border: '1px dashed #3a2a50', borderRadius: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5,
  background: 'radial-gradient(60% 60% at 50% 40%, rgba(155,107,176,0.08), transparent)',
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
