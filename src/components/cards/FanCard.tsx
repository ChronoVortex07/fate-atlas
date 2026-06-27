import { motion } from 'framer-motion';
import type { SlotResult } from '../../engine/types';
import { SIGNS } from '../../data/astromancy';
import { CONCEPTS } from '../../data/strings';
import { useAnchorRegister, constellationKey } from '../../context/AnchorRegistry';
import CardSigil from './CardSigil';

export type FanCardState = 'idle' | 'source' | 'target' | 'animating' | 'reroll-target';

interface FanCardProps {
  result: SlotResult;
  index: number;
  slotState: FanCardState;
  isExpanded: boolean;
  fanAngle: number;       // rotation angle in degrees for radial fan position
  isTopCard: boolean;     // true when this card is the visible top of the collapsed stack
  // Desktop responsive (collapsed stack)
  isDesktop?: boolean;
  // Expanded rotating wheel — pre-computed transform for this card's arc slot.
  wheelX?: number;
  wheelY?: number;
  wheelRotate?: number;
  wheelScale?: number;
  wheelOpacity?: number;
  wheelZ?: number;
  glowing?: boolean;      // meta-interaction spotlight
  dimmed?: boolean;       // affect signal: card is being veiled/shrouded by an effect
  appearing?: 'pending' | 'materializing' | null; // spawn: hold empty, then pop in
  instant?: boolean;      // disable the spring while actively dragging (1:1 follow)
  // Interaction — wired by the wheel container. Tap-to-inspect is resolved in
  // pointerup (drag-movement aware) rather than a separate click for reliability
  // under pointer capture.
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onWheelSpin?: (e: React.WheelEvent) => void;
}

function getCardDisplay(result: SlotResult): {
  symbol: string;
  name: string;
  detail: string;
  borderColor: string;
  subCards?: { position: string; name: string; orientation: string; face: import('../../engine/types').TarotCardFace }[];
} {
  switch (result.type) {
    case 'tarot': {
      const spread = result.spread;
      if (spread && spread.length > 1) {
        return {
          symbol: result.symbol,
          name: result.name,
          detail: result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
          borderColor: '#9b6bb0',
          subCards: spread.map((sp) => ({
            position: sp.position.charAt(0).toUpperCase() + sp.position.slice(1),
            name: sp.card.name,
            orientation: sp.card.orientation === 'upright' ? '▲' : '▼',
            face: sp.card,
          })),
        };
      }
      return {
        symbol: result.symbol,
        name: result.name,
        detail: result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
        borderColor: '#9b6bb0',
      };
    }
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
    case 'astral':
      return {
        symbol: `${result.symbol}︎`,         // planet glyph, text-presentation form
        name: SIGNS[result.sign].name,            // the sign the planet sits in
        detail: result.aspect.toUpperCase(),
        borderColor: '#6a8fd0',                   // celestial blue
      };
    case 'rune':
      return {
        symbol: result.symbol,                    // the rune glyph
        name: result.name.replace(' — Merkstave', ''),
        detail: result.orientation === 'upright' ? '▲ Upright' : '▼ Merkstave',
        borderColor: '#c8a86a',                   // rune gold
      };
    case 'strings':
      return {
        symbol: result.symbol,                       // destination glyph
        name: CONCEPTS[result.destinationId].name,   // destination name (concise)
        detail: 'WEAVE',
        borderColor: '#c33b5e',                      // crimson-garnet
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

export default function FanCard({
  result,
  index,
  slotState,
  isExpanded,
  fanAngle,
  isTopCard,
  isDesktop: isDesktopProp,
  wheelX,
  wheelY,
  wheelRotate,
  wheelScale,
  wheelOpacity,
  wheelZ,
  glowing,
  dimmed,
  appearing,
  instant,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheelSpin,
}: FanCardProps) {
  const isDesktop = isDesktopProp ?? false;
  // Register this card's live position so anchored effects can play on it.
  const setAnchor = useAnchorRegister(constellationKey(index));

  const isSource = slotState === 'source' || slotState === 'animating';
  const isTarget = slotState === 'target' || slotState === 'animating';
  const isRerollTarget = slotState === 'reroll-target';

  // Expanded uses the rotating wheel when a wheel transform is supplied.
  const wheel = isExpanded && wheelX !== undefined;

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

  // --- Animate ---
  // Wheel (expanded): pre-computed polar slot + tangent rotation, scale/opacity by distance.
  // Collapsed: centered (desktop) / right-anchored (mobile) stack.
  let animateX: number;
  let animateY: number;
  let animateRotate: number;
  let animateScale: number;
  let animateOpacity: number;

  if (wheel) {
    animateX = wheelX as number;
    animateY = wheelY ?? 0;
    animateRotate = wheelRotate ?? 0;
    animateScale = wheelScale ?? 1;
    animateOpacity = wheelOpacity ?? 1;
  } else if (isDesktop) {
    animateX = 0;
    animateY = -(index * 14 + 60);
    animateRotate = 0;
    animateScale = isRerollTarget ? 1.08 : 1;
    animateOpacity = isTopCard ? 0.85 : 0.4 + index * 0.05;
  } else {
    animateX = 0;
    animateY = -(index * 6 + 36);
    animateRotate = fanAngle;
    animateScale = isRerollTarget ? 1.08 : 1;
    animateOpacity = isTopCard ? 0.85 : 0.4 + index * 0.05;
  }

  // Spawn lifecycle: held invisible/tiny in its slot, then springs to full size.
  if (appearing === 'pending') {
    animateOpacity = 0;
    animateScale = 0.08;
  }

  const zIndex = wheel
    ? (wheelZ ?? 1)
    : (isRerollTarget ? 5 : index);

  const pointerEvents: React.CSSProperties['pointerEvents'] = wheel
    ? (animateOpacity <= 0.02 ? 'none' : 'auto')
    : 'none';

  return (
    <motion.div
      ref={setAnchor}
      onPointerDown={wheel ? onPointerDown : undefined}
      onPointerMove={wheel ? onPointerMove : undefined}
      onPointerUp={wheel ? onPointerUp : undefined}
      onPointerCancel={wheel ? onPointerUp : undefined}
      onWheel={wheel ? onWheelSpin : undefined}
      style={{
        position: 'absolute',
        bottom: 0,
        left: isDesktop || wheel ? '50%' : undefined,
        right: isDesktop || wheel ? undefined : 0,
        marginLeft: isDesktop || wheel ? `${-(width / 2)}px` : undefined,
        width: `${width}px`,
        height: `${height}px`,
        background: 'linear-gradient(180deg, #0d1220 0%, #0a1020 100%)',
        border: glowing
          ? '1.5px solid #f0c674'
          : isRerollTarget
            ? '1.5px solid #d4a854'
            : isSource
              ? '1px solid #d4a854'
              : isTarget
                ? '1px solid rgba(200, 120, 80, 0.5)'
                : `1px solid ${display.borderColor}`,
        borderRadius,
        transformOrigin: 'bottom center',
        zIndex,
        overflow: 'hidden',
        filter: dimmed ? 'grayscale(0.85) brightness(0.5)' : undefined,
        transition: 'filter 0.5s ease',
        boxShadow: glowing
          ? '0 0 28px rgba(212,168,84,0.85), 0 0 56px rgba(212,168,84,0.4)'
          : isRerollTarget
            ? '0 0 20px rgba(212,168,84,0.45), 0 0 40px rgba(212,168,84,0.12)'
            : isSource
              ? '0 0 16px rgba(212,168,84,0.5)'
              : isTarget
                ? '0 0 14px rgba(200,120,80,0.5)'
                : 'none',
        pointerEvents,
        cursor: wheel ? 'pointer' : undefined,
        touchAction: wheel ? 'none' : undefined,
      }}
      initial={false}
      animate={{
        x: animateX,
        y: animateY,
        rotate: animateRotate,
        scale: animateScale,
        opacity: animateOpacity,
      }}
      transition={
        instant ? { duration: 0 }
        : appearing === 'pending' ? { duration: 0.12 }
        : appearing === 'materializing' ? { type: 'spring', stiffness: 240, damping: 15 }
        : { type: 'spring', stiffness: wheel ? 260 : 300, damping: 26 }
      }
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
        ·····
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
        {result.type === 'tarot' && display.subCards && display.subCards.length > 1 ? (
          /* Equilateral triangle: vertices at (cx,0), (0,h), (w,h) where h = s·√3/2 */
          (() => {
            const sigil = isDesktop ? 16 : 10;
            const s = isDesktop ? 34 : 22;               // triangle side length in px
            const h = Math.round(s * Math.sqrt(3) / 2);   // triangle height
            const nameH = isDesktop ? 5 : 4;              // approx name line height
            const cw = s + sigil;                         // container width
            const ch = h + sigil + nameH;                 // container height
            const nameStyle: React.CSSProperties = {
              fontFamily: "'Cormorant Garamond', serif", fontWeight: 500,
              fontSize: isDesktop ? '0.33rem' : '0.26rem', color: '#c8d8f0',
              textAlign: 'center', lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: isDesktop ? '26px' : '16px',
            };
            const sigilColor = isRerollTarget || isSource ? '#d4a854' : '#7b9ec7';
            // Sigil centers form the equilateral triangle. Anchor each group by
            // the sigil's intended center with translateX(-50%) so a name label
            // wider than the sigil can't drag the sigil off its vertex.
            const groupStyle: React.CSSProperties = {
              position: 'absolute', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '0px', transform: 'translateX(-50%)',
            };
            // A sub-card the Shadow veiled renders as a shrouded glyph with its
            // name withheld, so the concealment persists after the animation.
            const vertex = (idx: number, pos: React.CSSProperties) => {
              const sub = display.subCards![idx];
              const veiled = !!sub.face.veiled;
              return (
                <div style={{ ...groupStyle, ...pos }}>
                  {veiled ? (
                    <span style={{ fontSize: sigil, lineHeight: 1, color: '#9b6bb0', opacity: 0.85, textShadow: '0 0 6px rgba(155,107,176,0.8)' }}>◈</span>
                  ) : (
                    <CardSigil card={sub.face} size={sigil} color={sigilColor} />
                  )}
                  <span title={veiled ? 'Veiled' : sub.name} style={{ ...nameStyle, ...(veiled ? { color: '#9b6bb0', fontStyle: 'italic', opacity: 0.7 } : null) }}>
                    {veiled ? '—' : sub.name}
                  </span>
                </div>
              );
            };
            return (
              <div style={{ position: 'relative', width: cw, height: ch, lineHeight: 1, marginBottom: isDesktop ? 6 : 4 }}>
                {/* Top — Past (apex) */}
                {vertex(0, { left: cw / 2, top: 0 })}
                {/* Bottom-left — Present */}
                {vertex(1, { left: sigil / 2, top: h })}
                {/* Bottom-right — Future */}
                {vertex(2, { left: cw - sigil / 2, top: h })}
              </div>
            );
          })()
        ) : (
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
            {result.type === 'tarot'
              ? <CardSigil card={result} size={isDesktop ? 22 : 14} color={isRerollTarget || isSource ? '#d4a854' : display.borderColor} />
              : display.symbol}
          </span>
        )}
        {!(result.type === 'tarot' && display.subCards && display.subCards.length > 1) && (
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
        )}
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
        ·····
      </div>
    </motion.div>
  );
}
