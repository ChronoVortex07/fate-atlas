# ConstellationFan Responsive Layout

**Date:** 2026-06-21
**Status:** approved

## Problem

The `ConstellationFan` component looks good on mobile but is too small and tucked away in the bottom-right corner on desktop screens, making it easy to miss. Its hardcoded pixel sizes (50×72px cards, 220×220px container anchored to `bottom-right`) don't scale with available screen space.

## Design

### Breakpoint

Use **768px** as the mobile/desktop threshold. Below 768px, the component behaves exactly as it does today — no regressions. At 768px+, the desktop layout activates.

### Positioning

| State | Mobile (< 768px) | Desktop (≥ 768px) |
|---|---|---|
| Collapsed | Stacked cards + FAB, bottom-right corner | Stacked cards + FAB, bottom-center |
| Expanded | Arc from bottom-right corner | Horizontal arc centered across lower portion of viewport |

On desktop, the FAB moves from `bottom: 14px, right: 14px` to `bottom: 14px, left: 50%, transform: translateX(-50%)`. The card container stretches to full viewport width and is centered.

### Sizing (desktop)

| Element | Mobile (unchanged) | Desktop |
|---|---|---|
| Card dimensions | 50×72px | 80×116px |
| Container | 220×220px fixed | viewport-width responsive |
| Symbol font | 0.85rem | 1.3rem |
| Name font | 0.4rem | 0.6rem |
| Detail font | 0.3rem | 0.45rem |
| Rune font | 0.32rem | 0.45rem |
| FAB button | 42px diameter | 48px diameter |
| FAB icon | 1rem | 1.15rem |
| Count badge | 18px | 20px |
| "Your Constellation" label font | 0.8rem | 1rem |

### Non-overlapping spread (desktop only)

On mobile, cards fan out via pure rotation (`rotate: fanAngle` with `transformOrigin: bottom center`) from a shared pivot, which naturally overlaps at wider angles.

On desktop, cards switch to **polar-coordinate positioning** to guarantee non-overlap:

1. A pivot point is defined below the card area (center-bottom of the fan container)
2. Each card is placed at `(x, y)` along a circular arc of radius `R`:
   - `x = R * sin(θᵢ)`
   - `y = -R * cos(θᵢ)` (from pivot upward)
3. Each card rotates by `θᵢ` to stay tangent to the arc
4. **Angular spacing** between cards is calculated dynamically: `arcDegrees = max(minArc, cardCount * degreesPerCard)` where `degreesPerCard` is wide enough that card edges don't touch at radius `R`
5. The `transformOrigin` changes to `bottom center` of each card

Parameters for desktop:
- `R` (radius): ~160–200px, scales with container height
- `minArc`: 40°
- `degreesPerCard`: sufficient to prevent overlap (~18–22°, tuned visually)
- Result: 3 cards ≈ 40–60° spread, 5 cards ≈ 70–100° spread

The arc guide SVG also widens to match the larger spread.

### Responsive detection

Use a lightweight custom hook wrapping `window.matchMedia('(min-width: 768px)')` with a `change` event listener. Both `ConstellationFan` and `FanCard` receive an `isDesktop` boolean prop derived from this hook.

### Constraint: mobile must not change

Every style and layout change is gated behind `isDesktop`. The mobile rendering path (including all pixel values, rotation logic, and positioning) is untouched.

## Implementation plan (summary)

1. Add a `useMediaQuery('(min-width: 768px)')` hook to `ConstellationFan`
2. Pass `isDesktop` down to each `FanCard`
3. In `ConstellationFan`: compute separate desktop fan geometry (polar coordinates); adjust container/FAB positioning per breakpoint
4. In `FanCard`: scale dimensions, fonts, and use polar-positioned x/y/rotate when `isDesktop`
5. Adjust the arc guide SVG for desktop width
6. Visual QA on both mobile and desktop viewports
