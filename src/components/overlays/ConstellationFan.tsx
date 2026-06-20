import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FanCard, { type FanCardState } from '../cards/FanCard';
import type { SlotResult } from '../../engine/types';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface ActiveSlots {
  sourceIndex: number | null;
  targetIndex: number | null;
  effect: string | null;
}

interface Props {
  results: SlotResult[];
  activeSlots: ActiveSlots;
}

function getSlotState(index: number, activeSlots: ActiveSlots): FanCardState {
  if (activeSlots.sourceIndex === index && activeSlots.targetIndex === index) {
    return 'animating';
  }
  if (
    activeSlots.targetIndex === index &&
    activeSlots.effect === 'reroll'
  ) {
    return 'reroll-target';
  }
  if (activeSlots.sourceIndex === index) {
    return 'source';
  }
  if (activeSlots.targetIndex === index) {
    return 'target';
  }
  return 'idle';
}

export default function ConstellationFan({ results, activeSlots }: Props) {
  const [expanded, setExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveRef = useRef(activeSlots);

  // Calculate fan angles — spread cards evenly in an arc
  const arcDegrees = Math.min(140, Math.max(40, results.length * 18));
  const startAngle = -(arcDegrees / 2);
  const angleStep = results.length > 1 ? arcDegrees / (results.length - 1) : 0;

  const fanAngles = useMemo(() => {
    return results.map((_, i) =>
      results.length === 1 ? 0 : startAngle + angleStep * i,
    );
  }, [results.length, startAngle, angleStep]);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Desktop polar fan positions — non-overlapping arc
  const desktopPolarPositions = useMemo(() => {
    if (!isDesktop) return null;

    const degreesPerCard = 26;
    const arcDeg = Math.min(120, Math.max(40, (results.length - 1) * degreesPerCard));
    const startAngleDeg = -(arcDeg / 2);
    const angleStepDeg = results.length > 1 ? arcDeg / (results.length - 1) : 0;
    const radius = 180; // px from pivot to card bottom-center

    return results.map((_, i) => {
      const angleDeg = results.length === 1 ? 0 : startAngleDeg + angleStepDeg * i;
      const angleRad = (angleDeg * Math.PI) / 180;
      return {
        x: radius * Math.sin(angleRad),
        y: -(radius * Math.cos(angleRad)), // negative = upward from bottom
        angleDeg,
      };
    });
  }, [isDesktop, results.length]);

  // Auto-expand when an interaction targets a fan card
  useEffect(() => {
    const prev = prevActiveRef.current;
    const curr = activeSlots;

    const hasNewHighlight =
      (curr.sourceIndex !== null || curr.targetIndex !== null) &&
      (curr.sourceIndex !== prev.sourceIndex ||
        curr.targetIndex !== prev.targetIndex);

    if (hasNewHighlight) {
      setExpanded(true);
    }

    prevActiveRef.current = curr;
  }, [activeSlots]);

  // Auto-collapse after interactions finish
  useEffect(() => {
    if (
      expanded &&
      activeSlots.sourceIndex === null &&
      activeSlots.targetIndex === null
    ) {
      collapseTimerRef.current = setTimeout(() => {
        setExpanded(false);
      }, 3000);
    }

    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [expanded, activeSlots]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
  }, []);

  if (results.length === 0) return null;

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
            onClick={() => setExpanded(false)}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle arc guide line when expanded */}
      {expanded && results.length > 1 && (
        <svg
          style={{
            position: 'absolute',
            bottom: 0,
            right: isDesktop ? undefined : 0,
            left: isDesktop ? '50%' : undefined,
            transform: isDesktop ? 'translateX(-50%)' : undefined,
            width: isDesktop ? '600px' : '280px',
            height: isDesktop ? '340px' : '220px',
            pointerEvents: 'none',
            zIndex: 15,
            overflow: 'visible',
          }}
        >
          <path
            d={isDesktop
              ? "M 540 326 Q 300 260 60 326"
              : "M 252 206 Q 120 175 50 212"
            }
            fill="none"
            stroke="rgba(212,168,84,0.08)"
            strokeWidth="1"
            strokeDasharray="3,5"
          />
        </svg>
      )}

      {/* Fan cards — rendered in reverse so first-drawn is on top of stack */}
      <div
        style={{
          position: 'absolute',
          bottom: isDesktop ? '14px' : '56px',
          right: isDesktop ? undefined : '14px',
          left: isDesktop ? 0 : undefined,
          width: isDesktop ? '100%' : '220px',
          height: isDesktop ? '320px' : '220px',
          zIndex: expanded ? 16 : 8,
          cursor: !expanded ? 'pointer' : undefined,
        }}
        onClick={!expanded ? handleToggle : undefined}
      >
        {results
          .map((result, i) => ({ result, i }))
          .reverse()
          .map(({ result, i }) => {
            const polar = desktopPolarPositions?.[i];
            return (
              <FanCard
                key={`fan-${i}`}
                result={result}
                index={i}
                slotState={getSlotState(i, activeSlots)}
                isExpanded={expanded}
                fanAngle={fanAngles[i]}
                isTopCard={i === results.length - 1}
                isDesktop={isDesktop}
                polarX={polar?.x}
                polarY={polar?.y}
                polarAngle={polar?.angleDeg}
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
            left: isDesktop ? '50%' : undefined,
            right: isDesktop ? undefined : '14px',
            transform: isDesktop ? 'translateX(-50%)' : undefined,
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
            {results.length} ✧ tap to expand
          </span>
        </motion.div>
      )}
    </>
  );
}
