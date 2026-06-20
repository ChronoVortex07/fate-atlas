# Starfield Redesign

**Date:** 2026-06-20
**Status:** Approved

## Problem Summary

The current StarField has four issues:

1. **Non-constellation stars render as big circles** — dust stars (r: 0.4–0.8) and medium stars (r: 0.8–1.3) become large blobs on big screens.
2. **Aspect-ratio stretching** — `preserveAspectRatio="none"` causes the SVG to stretch non-uniformly when the viewport aspect ratio changes.
3. **Constellation overlap** — The Scales spans x:20–64, y:20–58, overlapping with The Eye, The Serpent, The Crown, and The Spindle.
4. **Constellation stars are circles** — the templates `cstar-white` and `cstar-gold` use stacked `<circle>` elements; no pointed-star shape.

## Design

### 1. Viewport & Scaling Fix

- Change `preserveAspectRatio` from `"none"` to `"xMidYMid slice"` so the SVG fills the viewport without stretching (maintains square aspect ratio, crops edges as needed).
- Add `vector-effect="non-scaling-stroke"` on constellation lines so they remain hairline-thin regardless of screen size.

### 2. Dust & Medium Stars → Pinpoints

- Shrink radii 5–8×:
  - Dust: `r: 0.06–0.18`, `opacity: 0.25–0.55`
  - Medium: `r: 0.12–0.30`, `opacity: 0.35–0.65`
- Each star gets a subtle glow via a second circle behind it with `feGaussianBlur stdDeviation="0.15"` and radius 2× the core.
- **Twinkle animation:** CSS `@keyframes` in an embedded `<style>` block inside the SVG. Each star cycles opacity ±30% over 2–6s (randomized) with staggered `animation-delay`. Use `will-change: opacity` for compositing performance.

### 3. Constellation Stars → 8-Pointed Stars

Replace the `cstar-white` and `cstar-gold` `<g>` templates:

- **Outer glow circle** — r: 2.0, low opacity, `feGaussianBlur stdDeviation="0.6"` (same as current outer glow)
- **Inner glow circle** — r: 0.6, medium opacity, `feGaussianBlur stdDeviation="0.3"` (same as current tight glow)
- **8-pointed star core** — a `<path>` with 8 points (tip radius ~0.35 from center, inner radius ~0.12), bright fill. Path geometry: 16-point polygon alternating between tip and inner radii at 45° intervals.

The glow footprint matches the current circle-based templates; only the core shape changes.

### 4. Constellation Positions (Overlap Fix)

Each constellation gets a non-overlapping bounding box with ~5-unit margin. New positions:

| Constellation | Stars (x, y, brightness) |
|---|---|
| **The Crown** | (40,5, 0.8), (44,14, 0.65), (50,9, 0.8), (49,18, 0.6), (42,18, 0.6) |
| **The Eye** | (72,15, 0.85), (78,27, 0.7), (80,38, 0.85), (72,40, 0.7) |
| **The Serpent** | (5,72, 0.85), (12,62, 0.7), (17,66, 0.75), (22,52, 0.85), (25,43, 0.7), (21,34, 0.75), (19,27, 0.85), (15,22, 0.7) |
| **The Scales** | (40,35, 0.8), (36,46, 0.65), (34,51, 0.55), (62,35, 0.8), (58,46, 0.65), (56,51, 0.55), (51,35, 0.6), (51,55, 0.55) |
| **The Spindle** | (62,65, 0.75), (64,71, 0.75), (66,77, 0.75) |
| **The Gate** | (78,68, 0.75), (78,78, 0.65), (88,70, 0.75), (88,80, 0.65) |

Visual quadrant assignments preserved; each bounding box now has clear separation.

### 5. Swirl Convergence Effect

A dramatic swirling-star-trail animation that plays when the engine enters the synthesizing phase, before results appear. Duration: ~2.5s.

**Visual:**
- Rotation surge — all stars rotate clockwise around viewport center, accelerating from 0 to ~180° over 2s. CSS `transform: rotate()` on the SVG with `cubic-bezier(0.25, 0, 0.25, 1)` easing.
- Radial convergence — stars shrink toward center via `scale(0.82)` over the same 2.5s, as if pulled into a focal point.
- Trails — a second copy of each star layer offset slightly behind in rotation with fading opacity, creating the long-exposure trail look.
- Constellation dissolve — constellation lines fade to zero opacity during the swirl.
- Peak flash — a white overlay at maximum convergence: opacity 0 → 0.15 → 0 over ~0.4s.

**Implementation:**
- The StarField SVG gets a CSS class `starfield--swirling` toggled by React when `state.swirlActive === true`.
- All swirl animations live in a `@keyframes star-swirl` block inside the SVG `<style>`.
- `transform-origin: 50% 50%` on the SVG for the rotation+scale pivot.
- After `onAnimationEnd` fires on the SVG, React calls `engine.finishSwirl()` which sets `swirlActive: false` and advances to results.

### 6. State Wiring

**Engine changes (`GameEngine.ts`):**
- Add transient `swirlActive: boolean` to `GameState` (not persisted — resets each turn).
- Set `swirlActive: true` during `synthesize()`.
- New method `finishSwirl()`: sets `swirlActive: false`, advances phase to `'result'`.

**React changes (`StarField.tsx`):**
- Read `state.swirlActive` from game engine.
- Toggle CSS class `starfield--swirling` on the SVG element.
- On `onAnimationEnd`, call `engine.finishSwirl()`.

### 7. Debug Trigger

In `DebugPanel.tsx`, add a **"Trigger Swirl"** button that calls `engine.startDebugSwirl()`:
- Sets `swirlActive: true` without requiring a full turn play-through.
- The swirl plays its 2.5s animation, then `onAnimationEnd` calls `finishSwirl()` as normal.
- After swirl finishes, the state returns to idle — no side effects on game state.

## File Changes

| File | Change |
|---|---|
| `src/components/overlays/StarField.tsx` | Rewrite — fix aspect ratio, shrink stars, add 8-pointed constellation templates, add twinkle CSS, add swirl class + keyframes, wire animation end callback |
| `src/data/constellations.ts` | Update — new non-overlapping positions for all 6 constellations |
| `src/engine/GameEngine.ts` | Add `swirlActive` to state, `finishSwirl()` method, `startDebugSwirl()` method |
| `src/engine/types.ts` | Add `swirlActive: boolean` to `GameState` |
| `src/components/debug/DebugPanel.tsx` | Add "Trigger Swirl" button |

## Non-Goals

- Shooting stars (deferred)
- Slow rotation of the entire starfield (deferred; swirl replaces this as the motion element)
- Making dust/medium star positions deterministic across sessions (current seeded approach is already fine)
