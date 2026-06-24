import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FanCard, { type FanCardState } from '../cards/FanCard';
import CardDetailModal from './CardDetailModal';
import { useInteractionFocus } from '../../context/InteractionFocusContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { SlotResult } from '../../engine/types';

interface Props {
  results: SlotResult[];
}

export default function ConstellationFan({ results }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; startRot: number } | null>(null);
  const movedRef = useRef(false);
  const interactionDrivenRef = useRef(false);

  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { activeReport, phase } = useInteractionFocus();

  const N = results.length;
  const focusSlot = activeReport?.sourceSlot ?? null;
  const targetSlot = activeReport?.targetSlot ?? null;

  // Slight fan for the collapsed mobile pile.
  const arcDegrees = Math.min(140, Math.max(40, N * 18));
  const startAngle = -(arcDegrees / 2);
  const angleStep = N > 1 ? arcDegrees / (N - 1) : 0;
  const fanAngles = useMemo(
    () => results.map((_, i) => (N === 1 ? 0 : startAngle + angleStep * i)),
    [N, startAngle, angleStep],
  );

  // ── Rotating wheel geometry ──
  const ANGLE_STEP = isDesktop ? 24 : 28; // degrees between adjacent cards
  const RADIUS = isDesktop ? 210 : 150;   // px from pivot to card bottom-center
  const MAX_VISIBLE = isDesktop ? 3.2 : 2.4;

  const wrappedOffset = useCallback((i: number, rot: number, n: number): number => {
    let d = (((i - rot) % n) + n) % n; // [0, n)
    if (d > n / 2) d -= n;             // (-n/2, n/2]
    return d;
  }, []);

  const wheelTransform = useCallback((offset: number) => {
    const a = (offset * ANGLE_STEP * Math.PI) / 180;
    const dist = Math.abs(offset);
    return {
      x: RADIUS * Math.sin(a),
      y: -(RADIUS * Math.cos(a)), // front (offset 0) sits highest
      rotate: offset * ANGLE_STEP,
      scale: Math.max(0.5, 1 - dist * 0.16),
      opacity: dist > MAX_VISIBLE ? 0 : Math.max(0.12, 1 - dist * 0.26),
      zIndex: Math.round(100 - dist * 10),
    };
  }, [ANGLE_STEP, RADIUS, MAX_VISIBLE]);

  // ── Drag / wheel scroll (expanded only) ──
  const PX_PER_CARD = 90;

  const onCardPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startRot: rotation };
    movedRef.current = false;
    setDragging(true);
  }, [rotation]);

  const onCardPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 6) movedRef.current = true;
    setRotation(d.startRot - dx / PX_PER_CARD);
  }, []);

  const onCardPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    setRotation((r) => Math.round(r)); // snap-to-front
  }, []);

  const onWheelSpin = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    setRotation((r) => r + delta / 400);
  }, []);

  const onCardSelect = useCallback((i: number) => {
    if (movedRef.current) return; // it was a drag, not a tap
    setDetailIndex(i);
  }, []);

  const handleToggle = useCallback(() => {
    interactionDrivenRef.current = false;
    setExpanded((prev) => !prev);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  const closeExpanded = useCallback(() => {
    interactionDrivenRef.current = false;
    setExpanded(false);
    setDetailIndex(null);
  }, []);

  // Auto-expand + scroll the wheel to the triggering hand card.
  useEffect(() => {
    if (focusSlot === null) return;
    interactionDrivenRef.current = true;
    setExpanded(true);
    setRotation((r) => {
      // Rotate to focusSlot via the shortest looping path.
      let t = focusSlot;
      while (t - r > N / 2) t -= N;
      while (t - r < -N / 2) t += N;
      return t;
    });
  }, [focusSlot, N]);

  // Auto-collapse after an interaction-driven expansion finishes (never collapse
  // a hand the player opened themselves, nor while dragging / inspecting a card).
  useEffect(() => {
    if (
      expanded &&
      interactionDrivenRef.current &&
      activeReport === null &&
      detailIndex === null &&
      !dragging
    ) {
      collapseTimerRef.current = setTimeout(() => {
        setExpanded(false);
        interactionDrivenRef.current = false;
      }, 2500);
    }
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [expanded, activeReport, detailIndex, dragging]);

  const isGlowing = useCallback(
    (i: number) => phase !== null && (i === focusSlot || (targetSlot !== null && i === targetSlot)),
    [phase, focusSlot, targetSlot],
  );

  if (results.length === 0) return null;

  // Collapsed footprint — sized to the FULL visible stack so the whole pile is
  // tappable (the cards translate upward out of a bottom-anchored box).
  const collapsedCardH = isDesktop ? 116 : 72;
  const collapsedStep = isDesktop ? 14 : 6;
  const collapsedBase = isDesktop ? 60 : 36;
  const collapsedStackH = collapsedBase + Math.max(0, N - 1) * collapsedStep + collapsedCardH + 12;
  const collapsedStackW = (isDesktop ? 80 : 50) + 24;

  return (
    <>
      {/* Dimming overlay when expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(7, 10, 18, 0.65)',
              zIndex: 14,
              pointerEvents: 'auto',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeExpanded}
          />
        )}
      </AnimatePresence>

      {/* "Your Constellation" label when expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            style={{
              position: 'absolute',
              top: isDesktop ? '40px' : '68px',
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 20,
              pointerEvents: 'none',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                fontSize: isDesktop ? '1rem' : '0.8rem',
                color: '#d4a854',
                letterSpacing: '0.08em',
              }}
            >
              ✧ Your Constellation
            </span>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 300,
                fontSize: isDesktop ? '0.6rem' : '0.5rem',
                color: '#5b7290',
                letterSpacing: '0.05em',
                marginTop: '2px',
              }}
            >
              drag to scroll · tap a card to inspect
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fan cards */}
      <div
        style={{
          position: 'absolute',
          bottom: isDesktop ? '14px' : '56px',
          // Collapsed: bottom-right on both breakpoints. Expanded: centred wheel.
          right: expanded ? (isDesktop ? undefined : '14px') : (isDesktop ? '20px' : '14px'),
          left: expanded ? '50%' : undefined,
          transform: expanded ? 'translateX(-50%)' : undefined,
          width: expanded ? (isDesktop ? '560px' : '320px') : `${collapsedStackW}px`,
          height: expanded ? (isDesktop ? '340px' : '240px') : `${collapsedStackH}px`,
          zIndex: expanded ? 16 : 8,
          cursor: !expanded ? 'pointer' : undefined,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          pointerEvents: expanded ? 'none' : 'auto',
        }}
        onClick={!expanded ? handleToggle : undefined}
      >
        {results.map((result, i) => {
          const slot = wheelTransform(wrappedOffset(i, rotation, N));
          return (
            <FanCard
              key={`fan-${i}`}
              result={result}
              index={i}
              slotState={'idle' as FanCardState}
              isExpanded={expanded}
              fanAngle={fanAngles[i]}
              isTopCard={i === N - 1}
              isDesktop={isDesktop}
              wheelX={expanded ? slot.x : undefined}
              wheelY={expanded ? slot.y : undefined}
              wheelRotate={expanded ? slot.rotate : undefined}
              wheelScale={expanded ? slot.scale : undefined}
              wheelOpacity={expanded ? slot.opacity : undefined}
              wheelZ={expanded ? slot.zIndex : undefined}
              glowing={expanded && isGlowing(i)}
              instant={dragging}
              onSelect={() => onCardSelect(i)}
              onPointerDown={onCardPointerDown}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onWheelSpin={onWheelSpin}
            />
          );
        })}
      </div>

      {/* Collapsed hint — subtle ✧ indicator near the deck */}
      {!expanded && (
        <motion.div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: isDesktop ? '20px' : '14px',
            zIndex: 9,
            pointerEvents: 'none',
            opacity: 0.4,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              color: '#d4a854',
              lineHeight: 1,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
              letterSpacing: '0.05em',
            }}
          >
            {N} ✧ tap to expand
          </span>
        </motion.div>
      )}

      {/* Tap-to-inspect detail modal */}
      <AnimatePresence>
        {detailIndex !== null && results[detailIndex] && (
          <CardDetailModal result={results[detailIndex]} onClose={() => setDetailIndex(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
