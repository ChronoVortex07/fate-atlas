import { motion } from 'framer-motion';
import type { SlotResult } from '../../engine/types';

export type FanCardState = 'idle' | 'source' | 'target' | 'animating' | 'reroll-target';

interface FanCardProps {
  result: SlotResult;
  index: number;
  slotState: FanCardState;
  isExpanded: boolean;
  fanAngle: number;       // rotation angle in degrees for radial fan position
  isTopCard: boolean;     // true when this card is the visible top of the collapsed stack
  // New — desktop responsive
  isDesktop?: boolean;
  polarX?: number;      // pre-computed x offset in px from center (desktop expanded)
  polarY?: number;      // pre-computed y offset in px upward from bottom (desktop expanded)
  polarAngle?: number;  // pre-computed rotation in degrees (desktop expanded)
}

function getCardDisplay(result: SlotResult): {
  symbol: string;
  name: string;
  detail: string;
  borderColor: string;
} {
  switch (result.type) {
    case 'tarot':
      return {
        symbol: result.symbol,
        name: result.name,
        detail: result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
        borderColor: '#9b6bb0',
      };
    case 'd20':
      return {
        symbol: getDieFace(result.result),
        name: `D20 · ${result.result}`,
        detail: result.threshold.replace(/-/g, ' ').toUpperCase(),
        borderColor: '#c75b4a',
      };
    case 'iching':
      return {
        symbol: result.symbol,
        name: `Hex ${result.hexagramNumber}`,
        detail: result.changingLines.length > 0
          ? `${result.changingLines.length} changing`
          : '',
        borderColor: '#5b8c5a',
      };
    case 'happening':
      return {
        symbol: String.fromCodePoint(0x2726),
        name: 'Event',
        detail: '',
        borderColor: '#d4a854',
      };
    default:
      return { symbol: '?', name: '—', detail: '', borderColor: '#1a2440' };
  }
}

function getDieFace(n: number): string {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return faces[n] ?? String(n);
}

// Rune sets for variety across cards
const RUNE_SETS = ['ᚠᚢᚦᚨ', 'ᚱᚲᚷᚹ', 'ᚺᚾᛁᛃ', 'ᛇᛈᛉᛊ', 'ᛏᛒᛖᛗ', 'ᛚᛜᛞᛟ'];

export default function FanCard({
  result,
  index,
  slotState,
  isExpanded,
  fanAngle,
  isTopCard,
  isDesktop: isDesktopProp,
  polarX,
  polarY,
  polarAngle,
}: FanCardProps) {
  const isDesktop = isDesktopProp ?? false;

  const isSource = slotState === 'source' || slotState === 'animating';
  const isTarget = slotState === 'target' || slotState === 'animating';
  const isRerollTarget = slotState === 'reroll-target';

  // Desktop sizes vs mobile
  const width = isDesktop
    ? (isRerollTarget ? 84 : 80)
    : (isRerollTarget ? 52 : 50);
  const height = isDesktop
    ? (isRerollTarget ? 122 : 116)
    : (isRerollTarget ? 74 : 72);

  const symbolFontSize = isDesktop
    ? (isRerollTarget ? '1.5rem' : '1.3rem')
    : (isRerollTarget ? '1.05rem' : '0.85rem');

  const nameFontSize = isDesktop
    ? (isRerollTarget ? '0.65rem' : '0.6rem')
    : (isRerollTarget ? '0.44rem' : '0.4rem');

  const detailFontSize = isDesktop ? '0.45rem' : '0.3rem';
  const runeFontSize = isDesktop ? '0.45rem' : '0.32rem';
  const borderRadius = isDesktop
    ? (isRerollTarget ? '7px' : '6px')
    : (isRerollTarget ? '5px' : '4px');
  const nameMaxWidth = isDesktop ? '74px' : '46px';

  const display = getCardDisplay(result);
  const runes = RUNE_SETS[index % RUNE_SETS.length];

  // --- Animate target ---
  // Mobile: rotate + vertical stack offset (unchanged)
  // Desktop collapsed: centered stack with larger vertical offsets
  // Desktop expanded: polar-coordinate position + tangent rotation

  let animateX: number;
  let animateY: number;
  let animateRotate: number;

  if (isDesktop && isExpanded && polarX !== undefined && polarY !== undefined && polarAngle !== undefined) {
    // Desktop expanded: use pre-computed polar position
    animateX = polarX;
    animateY = polarY;
    animateRotate = polarAngle;
  } else if (isDesktop) {
    // Desktop collapsed: centered stack
    animateX = 0;
    animateY = -(index * 14 + 60);
    animateRotate = 0;
  } else {
    // Mobile (unchanged)
    animateX = 0;
    animateY = isExpanded ? -(index * 10 + 42) : -(index * 6 + 36);
    animateRotate = fanAngle;
  }

  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: 0,
        left: isDesktop ? '50%' : undefined,
        right: isDesktop ? undefined : 0,
        marginLeft: isDesktop ? `${-(width / 2)}px` : undefined,
        width: `${width}px`,
        height: `${height}px`,
        background: 'linear-gradient(180deg, #0d1220 0%, #0a1020 100%)',
        border: isRerollTarget
          ? '1.5px solid #d4a854'
          : isSource
            ? '1px solid #d4a854'
            : isTarget
              ? '1px solid rgba(200, 120, 80, 0.5)'
              : `1px solid ${display.borderColor}`,
        borderRadius,
        transformOrigin: 'bottom center',
        opacity: isExpanded ? 1 : isTopCard ? 0.85 : 0.4 + (index * 0.05),
        zIndex: isRerollTarget ? 5 : isExpanded ? 1 : index,
        overflow: 'hidden',
        boxShadow: isRerollTarget
          ? '0 0 20px rgba(212,168,84,0.45), 0 0 40px rgba(212,168,84,0.12)'
          : isSource
            ? '0 0 16px rgba(212,168,84,0.5)'
            : isTarget
              ? '0 0 14px rgba(200,120,80,0.5)'
              : 'none',
        pointerEvents: 'auto',
      }}
      initial={false}
      animate={{
        x: animateX,
        y: animateY,
        rotate: animateRotate,
        scale: isRerollTarget ? 1.08 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Reroll pulse ring */}
      {isRerollTarget && (
        <motion.div
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '8px',
            border: '2px solid rgba(212, 168, 84, 0.4)',
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.3, 0, 0.3], scale: [1, 1.15, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Runic band — top */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: runeFontSize,
          color: display.borderColor,
          letterSpacing: '0.15em',
          opacity: 0.4,
          fontFamily: "'Noto Sans', sans-serif",
          userSelect: 'none',
        }}
      >
        {runes}
      </div>

      {/* Content area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1px',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: symbolFontSize,
            color: isRerollTarget || isSource ? '#d4a854' : display.borderColor,
            lineHeight: 1,
            textShadow: isRerollTarget
              ? '0 0 10px rgba(212,168,84,0.4)'
              : 'none',
            fontFamily: display.borderColor === '#c75b4a'
              ? "'Cormorant Garamond', serif"
              : 'inherit',
            fontWeight: display.borderColor === '#c75b4a' ? 700 : 400,
          }}
        >
          {display.symbol}
        </span>
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 600,
            fontSize: nameFontSize,
            color: isRerollTarget ? '#d4a854' : '#c8d8f0',
            letterSpacing: '0.04em',
            textAlign: 'center',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: nameMaxWidth,
          }}
        >
          {display.name}
        </span>
        {display.detail && (
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
              fontSize: detailFontSize,
              color: isRerollTarget ? '#d4a854' : display.borderColor,
              letterSpacing: '0.06em',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            {display.detail}
          </span>
        )}
      </div>

      {/* Runic band — bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '4px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: runeFontSize,
          color: display.borderColor,
          letterSpacing: '0.15em',
          opacity: 0.4,
          fontFamily: "'Noto Sans', sans-serif",
          userSelect: 'none',
        }}
      >
        {runes}
      </div>
    </motion.div>
  );
}
