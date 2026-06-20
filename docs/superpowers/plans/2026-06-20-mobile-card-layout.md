# Mobile Draw Phase Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal bottom-tray CardTableau with a collapsible "Constellation Fan" of portrait cards radiating from a ✧ FAB button in the bottom-right corner, add horizontal snap-scroll to selection areas, and anchor headings — all while preserving the existing interaction animation system intact.

**Architecture:** Two new components (`FanCard.tsx` and `ConstellationFan.tsx`) replace the old `CardTableau.tsx` tray. `GameTable.tsx` is restructured into a zoned fixed-viewport layout. Minigame screens get snap-scroll selection rows. The `activeSlots` prop contract between `InteractionSequencer` and the fan is preserved exactly — no engine or sequencer changes needed.

**Tech Stack:** React 18, TypeScript (strict), Framer Motion, inline CSSProperties (no CSS modules)

## Global Constraints

- All game logic stays in `src/engine/` — zero React imports there
- Strict TypeScript: `strict`, `noUnusedLocals`, `noUnusedParameters` all on
- No new dependencies — use existing Framer Motion + React
- `activeSlots` interface must remain unchanged (`{ sourceIndex: number | null; targetIndex: number | null; effect: string | null }`)
- Desktop layout should continue working (no regression)
- Tests: `npm run build` (typecheck) must pass; `npm test` (engine tests) must pass
- Commit granularity: one commit per task

---

### Task 1: Create `FanCard.tsx` — Individual Portrait Fan Card

**Files:**
- Create: `src/components/cards/FanCard.tsx`

**Interfaces:**
- Consumes: `SlotResult` from `src/engine/types.ts`, `ActiveSlots` (defined inline in ConstellationFan)
- Produces: `FanCard` component — props: `result: SlotResult`, `index: number`, `slotState: FanCardState`, `isExpanded: boolean`, `fanAngle: number`, `isTopCard: boolean`

- [ ] **Step 1: Create the file with type definitions and content helper**

Create `src/components/cards/FanCard.tsx`:

```tsx
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
}: FanCardProps) {
  const display = getCardDisplay(result);
  const runes = RUNE_SETS[index % RUNE_SETS.length];

  const isSource = slotState === 'source' || slotState === 'animating';
  const isTarget = slotState === 'target' || slotState === 'animating';
  const isRerollTarget = slotState === 'reroll-target';

  // Determine card dimensions
  const width = isRerollTarget ? 52 : 50;
  const height = isRerollTarget ? 74 : 72;

  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
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
        borderRadius: isRerollTarget ? '5px' : '4px',
        transformOrigin: 'bottom center',
        transform: isExpanded
          ? `rotate(${fanAngle}deg) translateY(-${height}px)`
          : `rotate(${fanAngle}deg)`,
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
        pointerEvents: isExpanded ? 'auto' : 'none',
      }}
      initial={false}
      animate={{
        rotate: isExpanded ? fanAngle : fanAngle,
        y: isExpanded ? -(index * 10 + 42) : -(index * 6 + 36),
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
          fontSize: '0.32rem',
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
            fontSize: isRerollTarget ? '1.05rem' : '0.85rem',
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
            fontSize: isRerollTarget ? '0.44rem' : '0.4rem',
            color: isRerollTarget ? '#d4a854' : '#c8d8f0',
            letterSpacing: '0.04em',
            textAlign: 'center',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '46px',
          }}
        >
          {display.name}
        </span>
        {display.detail && (
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
              fontSize: '0.3rem',
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
          fontSize: '0.32rem',
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | Select-Object -First 20`
Expected: No errors in `FanCard.tsx` (may have pre-existing errors elsewhere)

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/FanCard.tsx
git commit -m "feat: add FanCard component for Constellation Fan

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create `ConstellationFan.tsx` — Collapsible Fan Container

**Files:**
- Create: `src/components/overlays/ConstellationFan.tsx`

**Interfaces:**
- Consumes: `SlotResult` from `src/engine/types.ts`, `FanCard` / `FanCardState` from `src/components/cards/FanCard.tsx`, `ActiveSlots` from `src/components/screens/GameTable.tsx` (move to shared types or redefine inline)
- Produces: `ConstellationFan` component — props: `results: SlotResult[]`, `activeSlots: ActiveSlots`

- [ ] **Step 1: Create ConstellationFan.tsx**

Create `src/components/overlays/ConstellationFan.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
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

  const fanAngles = results.map((_, i) =>
    results.length === 1 ? 0 : startAngle + angleStep * i,
  );

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
              key={i}
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | Select-Object -First 20`
Expected: No errors in `ConstellationFan.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/overlays/ConstellationFan.tsx
git commit -m "feat: add ConstellationFan collapsible fan component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Update `GameTable.tsx` — Wire ConstellationFan and Restructure Layout

**Files:**
- Modify: `src/components/screens/GameTable.tsx`

**Interfaces:**
- Consumes: `ConstellationFan` from `src/components/overlays/ConstellationFan.tsx`
- Produces: Updated `hubStyle`, `centerStyle`; replaces `CardTableau` import with `ConstellationFan`

- [ ] **Step 1: Update GameTable.tsx imports and JSX**

Replace the import and component usage in `src/components/screens/GameTable.tsx`:

Change line 13:
```tsx
import CardTableau from '../overlays/CardTableau';
```
to:
```tsx
import ConstellationFan from '../overlays/ConstellationFan';
```

Change lines 95-97 (the `showTableau` block):
```tsx
      {showTableau && (
        <CardTableau results={state.turnResults} activeSlots={activeSlots} />
      )}
```
to:
```tsx
      {showTableau && (
        <ConstellationFan results={state.turnResults} activeSlots={activeSlots} />
      )}
```

- [ ] **Step 2: Update centerStyle to give fan breathing room on mobile**

In `GameTable.tsx`, add a media-query-aware bottom padding to `centerStyle`:

```tsx
const centerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  paddingBottom: '100px', // leave room for the fan area at bottom
};
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npm run build`
Expected: Build succeeds, no type errors

- [ ] **Step 4: Remove the old CardTableau.tsx**

The old `CardTableau` component is fully replaced by `ConstellationFan`.

Run:
```powershell
Remove-Item "src/components/overlays/CardTableau.tsx"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/GameTable.tsx
git add src/components/overlays/CardTableau.tsx
git commit -m "feat: replace CardTableau with ConstellationFan in GameTable

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update `TarotMinigame.tsx` — Horizontal Snap-Scroll Selection

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

**Interfaces:**
- Consumes: None new
- Produces: Updated `cardsRowStyle` with snap-scroll behavior

- [ ] **Step 1: Update cardsRowStyle for snap-scroll**

In `src/components/screens/TarotMinigame.tsx`, replace the existing `cardsRowStyle` (lines 162-166):

```tsx
const cardsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.25rem',
  justifyContent: 'center',
};
```

with:

```tsx
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
```

- [ ] **Step 2: Add scrollbar-hide style injection at component level**

Add at the top of the component body (after hooks):

```tsx
// Hide scrollbar on the selection row for Chrome/Safari
const scrollbarHideStyle = `
  .tarot-selection-row::-webkit-scrollbar { display: none; }
`;
```

And add a `className="tarot-selection-row"` to the `cardsRowStyle` div (line 82). Also wrap with a `<style>` tag in the JSX.

Actually, to keep it simpler — handle the scrollbar invisibility inline. Add to the `cardsRowStyle` div (line 82):

Change:
```tsx
<motion.div style={cardsRowStyle} ...>
```
to:
```tsx
<motion.div
  style={cardsRowStyle}
  className="snap-scroll-row"
  ...
>
```

And in the return, add after the component wrapper opens:

```tsx
<style>{`
  .snap-scroll-row::-webkit-scrollbar { display: none; }
`}</style>
```

Place this right after the opening `<motion.div style={containerStyle} ...>` tag.

- [ ] **Step 3: Add snap-align to each face-down card**

Ensure each card in the row has `scrollSnapAlign: 'center'` added to its style. The `faceDownCardStyle` (lines 168-183) needs:

Add to the style object:
```tsx
scrollSnapAlign: 'center',
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat: add horizontal snap-scroll to Tarot selection cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Consistent Heading Positioning in Minigames

**Files:**
- Modify: `src/components/screens/DiceMinigame.tsx`
- Modify: `src/components/screens/IChingMinigame.tsx`

**Interfaces:**
- Consumes: None new
- Produces: Consistent `headingStyle` padding/position across all minigames

- [ ] **Step 1: Update DiceMinigame heading for consistency**

In `src/components/screens/DiceMinigame.tsx`, the `headingStyle` (lines 90-98) is already using `clamp` and centered. No structural change needed — just verify the existing `padding: '2rem'` on `containerStyle` creates consistency with the new layout.

The heading is already well-positioned. No changes needed to DiceMinigame.tsx.

- [ ] **Step 2: Update IChingMinigame heading for consistency**

Same as DiceMinigame — the `containerStyle` at line 100-104 already has `padding: '2rem'` and `maxWidth: '500px'`. The heading is consistent.

No changes needed to IChingMinigame.tsx either — both minigames were already using the same container pattern.

- [ ] **Step 3: Verify consistency**

Run: `npm run build`
Expected: Build succeeds (no actual code changes made — this is a verification step)

- [ ] **Step 4: Skip commit — no changes needed**

---

### Task 6: Integration Verification

**Files:**
- All files from Tasks 1-4

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: `tsc -b && vite build` succeeds with no errors

- [ ] **Step 2: Run engine tests**

Run: `npm test`
Expected: All engine tests pass (no engine changes made, but verify nothing broke)

- [ ] **Step 3: Manual check — dev server**

Run: `npm run dev`
- Open in browser at http://localhost:5173
- Verify on mobile viewport (375×667 Chrome DevTools):
  - Start a reading, enter draw phase
  - Cards should appear in Constellation Fan (bottom-right) instead of horizontal tray
  - Selection cards should snap-scroll in Tarot minigame
  - ✧ FAB button should toggle fan expand/collapse
  - Fan badge shows correct count
- Verify on desktop (> 768px):
  - Layout still works
  - Fan is positioned correctly

- [ ] **Step 4: Interaction test**

In the dev server, use debug panel to trigger interactions and verify:
- When an interaction fires that targets a fan card, the fan auto-expands
- Source/target cards highlight correctly with glow
- Reroll shows pulse ring on target
- Fan auto-collapses ~3s after interaction completes
- Collapse timer resets if another interaction fires

- [ ] **Step 5: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: final integration adjustments for mobile layout

Co-Authored-By: Claude <noreply@anthropic.com>"
```
