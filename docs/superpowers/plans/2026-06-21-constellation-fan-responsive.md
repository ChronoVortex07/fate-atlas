# ConstellationFan Responsive Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ConstellationFan responsive — center-bottom on desktop (≥768px) with larger, non-overlapping cards, while keeping mobile unchanged.

**Architecture:** A custom `useMediaQuery` hook detects the breakpoint. `ConstellationFan` computes polar-coordinate positions for desktop and passes them + `isDesktop` to `FanCard`. `FanCard` conditionally switches dimensions, fonts, and positioning. No new dependencies.

**Tech Stack:** React 18, TypeScript, framer-motion (already in project)

## Global Constraints

- Mobile (< 768px) must not change — every style gate is behind `isDesktop`
- Desktop card dimensions: 80×116px (vs mobile 50×72px)
- Desktop cards must not overlap in expanded state (polar arc with ≥26° angular separation per card)
- Desktop FAB is bottom-center; mobile FAB remains bottom-right
- No new npm dependencies

---

### Task 1: Create `useMediaQuery` hook

**Files:**
- Create: `src/hooks/useMediaQuery.ts`

**Interfaces:**
- Produces: `export function useMediaQuery(query: string): boolean`

- [ ] **Step 1: Write the hook**

```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMediaQuery.ts
git commit -m "feat: add useMediaQuery hook for responsive breakpoints"
```

---

### Task 2: Add desktop sizing and polar positioning to FanCard

**Files:**
- Modify: `src/components/cards/FanCard.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 (FanCard is a pure presentational component)
- Produces: Updated `FanCard` accepts `isDesktop: boolean` and polar position `{ x: number; y: number; angleDeg: number }` or `null` when collapsed/not-desktop

- [ ] **Step 1: Update imports and props interface**

No imports change needed. Add the new props to `FanCardProps`:

```typescript
interface FanCardProps {
  result: SlotResult;
  index: number;
  slotState: FanCardState;
  isExpanded: boolean;
  fanAngle: number;
  isTopCard: boolean;
  // New — desktop responsive
  isDesktop?: boolean;
  polarX?: number;      // pre-computed x offset in px from center (desktop expanded)
  polarY?: number;      // pre-computed y offset in px upward from bottom (desktop expanded)
  polarAngle?: number;  // pre-computed rotation in degrees (desktop expanded)
}
```

Make `FanCardProps` an actual named export (currently it's declared inline but not exported — keep it inline; just add the new optional fields).

- [ ] **Step 2: Add desktop dimension/font constants in the component body**

Add at the top of the component function body, before the `const display = ...` line:

```typescript
const isDesktop = isDesktopProp ?? false;

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
```

- [ ] **Step 3: Compute the `animate` target based on desktop vs mobile**

Replace the current `animate` prop (the `initial={false}` block) with logic that switches between desktop polar and mobile rotation:

```typescript
// --- Animate target ---
// Mobile: rotate + vertical stack offset (unchanged)
// Desktop collapsed: centered stack with larger vertical offsets
// Desktop expanded: polar-coordinate position + tangent rotation

let animateX: number;
let animateY: number;
let animateRotate: number;

if (isDesktop && isExpanded && polarX !== undefined) {
  // Desktop expanded: use pre-computed polar position
  animateX = polarX!;
  animateY = polarY!;
  animateRotate = polarAngle!;
} else if (isDesktop) {
  // Desktop collapsed: centered stack
  animateX = 0;
  animateY = -(index * 14 + 60);
  animateRotate = 0;
} else {
  // Mobile (unchanged)
  animateX = 0;
  animateY = isExpanded ? -(index * 10 + 42) : -(index * 6 + 36);
  animateRotate = isExpanded ? fanAngle : 0;
}
```

- [ ] **Step 4: Update the motion.div style and animate props**

Change the `motion.div`:

- `style` — use the desktop/mobile variables from Step 2 for `width`, `height`, `borderRadius`, and the interior elements' `fontSize`/`maxWidth`
- Remove the current `initial={false}` and `animate={{ rotate, y, scale }}` block; replace with:

```typescript
initial={false}
animate={{
  x: animateX,
  y: animateY,
  rotate: animateRotate,
  scale: isRerollTarget ? 1.08 : 1,
}}
transition={{ type: 'spring', stiffness: 300, damping: 25 }}
```

- Update the container's `style` for desktop — change `right: 0` to `left: '50%'` on desktop (so `x` value works from center):

The card is `position: absolute; bottom: 0`. On mobile keep `right: 0`. On desktop change to `left: '50%'` with a `marginLeft: -width/2` (or use `translateX(-50%)` — but framer-motion's `x` does `translateX`, so we'd get double translation). Instead:

For desktop, use `left: '50%'` and adjust `x` to include the centering offset. Simpler: keep `right: 0` for mobile, `left: 0` for desktop with proper offset. Actually, the cleanest: set `left: '50%'` on the motion.div and `marginLeft: -(width / 2)` so the card is centered. Then `x` from framer-motion shifts from center.

```typescript
style={{
  position: 'absolute',
  bottom: 0,
  left: isDesktop ? '50%' : undefined,
  right: isDesktop ? undefined : 0,
  marginLeft: isDesktop ? `${-(width / 2)}px` : undefined,
  width: `${width}px`,
  height: `${height}px`,
  // ... rest of styles unchanged, but use variables from Step 2 for fonts etc.
  borderRadius,
  // opacity, zIndex, boxShadow, pointerEvents — all unchanged
}}
```

- [ ] **Step 5: Update interior elements to use the font-size variables**

Replace hardcoded font sizes in the JSX:

- Rune bands (top and bottom): change `fontSize: '0.32rem'` → `fontSize: runeFontSize`
- Symbol span: change `fontSize: isRerollTarget ? '1.05rem' : '0.85rem'` → `fontSize: symbolFontSize`
- Name span: change `fontSize: isRerollTarget ? '0.44rem' : '0.4rem'` and `maxWidth: '46px'` → `fontSize: nameFontSize` and `maxWidth: nameMaxWidth`
- Detail span: change `fontSize: '0.3rem'` → `fontSize: detailFontSize`

- [ ] **Step 6: Verify the component compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors (there may be unused-var warnings for the new props until Task 3 wires them — that's fine, they're optional)

- [ ] **Step 7: Commit**

```bash
git add src/components/cards/FanCard.tsx
git commit -m "feat: add desktop sizing and polar positioning support to FanCard"
```

---

### Task 3: Add responsive layout to ConstellationFan

**Files:**
- Modify: `src/components/overlays/ConstellationFan.tsx`

**Interfaces:**
- Consumes: `useMediaQuery` from Task 1, updated `FanCard` from Task 2
- Produces: Fully responsive ConstellationFan

- [ ] **Step 1: Add import and hook call**

Add at top:

```typescript
import { useMediaQuery } from '../../hooks/useMediaQuery';
```

Add inside the component, after the existing `useState`/`useRef`/`useMemo` hooks:

```typescript
const isDesktop = useMediaQuery('(min-width: 768px)');
```

- [ ] **Step 2: Add desktop fan geometry computation**

Add a new `useMemo` for desktop polar positions, right after the existing `fanAngles` memo:

```typescript
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
```

Note: `results` in the dependency array changes by reference every render. Since `results.length` is the actual dependency and we know engine state is immutable per turn, using `results.length` avoids unnecessary recomputation. Add `results` to the deps too since we map over it — actually `results` is fine as a dependency since it's stable per render cycle.

- [ ] **Step 3: Update the card container styles for desktop**

Replace the fan cards container `<div>` style. Currently:

```typescript
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
```

Change to responsive:

```typescript
<div
  style={{
    position: 'absolute',
    bottom: isDesktop ? '76px' : '56px',
    right: isDesktop ? undefined : '14px',
    left: isDesktop ? 0 : undefined,
    width: isDesktop ? '100%' : '220px',
    height: isDesktop ? '320px' : '220px',
    zIndex: expanded ? 16 : 8,
    pointerEvents: isDesktop && !expanded ? 'none' : undefined,
  }}
>
```

- [ ] **Step 4: Pass isDesktop and polar position props to FanCard**

In the `.map()` rendering FanCards, update the JSX to pass the new props:

```typescript
{[results
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
```

- [ ] **Step 5: Update the FAB button for desktop centering**

Change the FAB `<motion.button>` style from bottom-right to responsive:

```typescript
style={{
  position: 'absolute',
  bottom: '14px',
  left: isDesktop ? '50%' : undefined,
  right: isDesktop ? undefined : '14px',
  transform: isDesktop ? 'translateX(-50%)' : undefined,
  width: isDesktop ? '48px' : '42px',
  height: isDesktop ? '48px' : '42px',
  // ... rest unchanged (background, border, borderRadius, display, zIndex, etc.)
}}
```

And the icon span:

```typescript
<span
  style={{
    fontSize: isDesktop ? '1.15rem' : '1rem',
    color: '#d4a854',
    lineHeight: 1,
  }}
>
  ✧
</span>
```

The count badge grows slightly too:

```typescript
style={{
  // ...
  width: isDesktop ? '20px' : '18px',
  height: isDesktop ? '20px' : '18px',
  // ... rest unchanged
}}
```

And badge font:

```typescript
style={{
  // ...
  fontSize: isDesktop ? '0.55rem' : '0.5rem',
  // ...
}}
```

- [ ] **Step 6: Update the "Your Constellation" label for desktop**

Change `top: '68px'` to responsive and bump font size:

```typescript
style={{
  position: 'absolute',
  top: isDesktop ? '40px' : '68px',
  // ... rest unchanged
}}
```

And the inner span font size:

```typescript
style={{
  // ...
  fontSize: isDesktop ? '1rem' : '0.8rem',
  // ... rest unchanged
}}
```

- [ ] **Step 7: Update the arc guide SVG for desktop**

The SVG currently is `width: 280px; height: 220px` positioned `bottom: 0; right: 0`. On desktop, make it wider and centered:

```typescript
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
```

- [ ] **Step 8: Adjust the collapse timer for desktop**

No change needed — the 3-second auto-collapse works the same.

- [ ] **Step 9: Type-check and verify**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/overlays/ConstellationFan.tsx
git commit -m "feat: add responsive desktop layout to ConstellationFan"
```

---

### Task 4: Visual QA

**Files:** (none — testing only)

- [ ] **Step 1: Build and launch the dev server**

```bash
npm run build
npm run dev
```

- [ ] **Step 2: Mobile QA checklist (< 768px viewport)**

Open Chrome DevTools responsive mode at 375px width:
- [ ] FAB button appears in bottom-right corner
- [ ] Tapping FAB expands cards in arc from bottom-right
- [ ] Cards overlap slightly (same as current behavior)
- [ ] Dim overlay appears when expanded
- [ ] "Your Constellation" label shows
- [ ] Tapping overlay or FAB collapses fan
- [ ] Interaction highlights (source/target/reroll) look correct

- [ ] **Step 3: Desktop QA checklist (≥ 768px viewport)**

Open at 1440px width:
- [ ] FAB button is centered at bottom
- [ ] When collapsed, stacked cards peek from behind FAB at center
- [ ] Tapping FAB expands cards in a horizontal fan arc
- [ ] Cards do NOT overlap in expanded state
- [ ] Cards are visually larger (80×116px vs 50×72px)
- [ ] All fonts are proportionally larger
- [ ] Arc guide line spans wider
- [ ] "Your Constellation" label is higher and larger
- [ ] Dim overlay covers full screen
- [ ] Tapping overlay or FAB collapses fan
- [ ] Interaction highlights work correctly

- [ ] **Step 4: Resize test**

While expanded, resize from desktop to mobile width and back:
- [ ] Layout switches at 768px breakpoint cleanly (may need a refresh — expected)
- [ ] No visual glitches or stuck animations

- [ ] **Step 5: Commit any fixes if needed**

Only if QA revealed issues requiring code changes.
