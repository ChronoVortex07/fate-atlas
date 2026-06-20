import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FanCard, { type FanCardState } from '../cards/FanCard';
import type { SlotResult } from '../../engine/types';

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
              top: '68px',
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
                fontSize: '0.8rem',
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
            right: 0,
            width: '280px',
            height: '220px',
            pointerEvents: 'none',
            zIndex: 15,
            overflow: 'visible',
          }}
        >
          <path
            d="M 252 206 Q 120 175 50 212"
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
          bottom: '56px',
          right: '14px',
          width: '220px',
          height: '220px',
          zIndex: expanded ? 16 : 8,
        }}
      >
        {results
          .map((result, i) => ({ result, i }))
          .reverse()
          .map(({ result, i }) => (
            <FanCard
              key={`fan-${i}`}
              result={result}
              index={i}
              slotState={getSlotState(i, activeSlots)}
              isExpanded={expanded}
              fanAngle={fanAngles[i]}
              isTopCard={i === results.length - 1}
            />
          ))}
      </div>

      {/* ✧ FAB button */}
      <motion.button
        type="button"
        style={{
          position: 'absolute',
          bottom: '14px',
          right: '14px',
          width: '42px',
          height: '42px',
          background: '#0d1220',
          border: '1.5px solid #d4a854',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 17,
          boxShadow: expanded
            ? '0 0 24px rgba(212,168,84,0.5)'
            : '0 0 16px rgba(212,168,84,0.3)',
          cursor: 'pointer',
          outline: 'none',
        }}
        animate={{ rotate: expanded ? 45 : 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleToggle}
        whileTap={{ scale: 0.9 }}
      >
        <span
          style={{
            fontSize: '1rem',
            color: '#d4a854',
            lineHeight: 1,
          }}
        >
          ✧
        </span>

        {/* Count badge */}
        {results.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '18px',
              height: '18px',
              background: '#c75b4a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 18,
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: '0.5rem',
                color: '#fff',
                lineHeight: 1,
              }}
            >
              {results.length}
            </span>
          </div>
        )}
      </motion.button>
    </>
  );
}
