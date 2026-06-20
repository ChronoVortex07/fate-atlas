# Mobile Draw Phase Layout Redesign

**Date:** 2026-06-20
**Status:** Approved

## Problem

On mobile screens, the `CardTableau` (absolutely positioned at `bottom: 20px`) overlaps with the selection area in the draw phase — particularly the third option. Additionally, future affinity or interaction bonuses may increase the number of selectable cards from 3 to 4–5, and the number of drawn cards in the tableau could grow to 7+. The current layout has no responsive design whatsoever (zero media queries).

## Design Decisions

### Approach: Constellation Fan (Approach B, Revised)

A collapsible fan of **portrait-oriented cards** radiating from a ✧ FAB button in the bottom-right corner. Selection area uses horizontal snap-scroll. Layout is a fixed viewport with an anchored heading — no page-level scrolling.

### Layout Zones (top to bottom)

| Zone | Position | Behavior |
|------|----------|----------|
| Heading | Fixed, top of viewport | Always anchored. Shows "Draw a card" / contextual text |
| Selection area | Center, flex-fills remaining space | Horizontal snap-scroll (`scroll-snap-type: x mandatory`) with invisible scrollbar. Contains 3–5 stylized face-down cards |
| Projectile flight zone | Between selection and fan | Clear space for interaction animations (projectiles, particles, glow trails). No UI elements occupy this zone |
| Constellation Fan | Bottom-right corner | Collapsible radial fan of drawn cards anchored to ✧ FAB button |

### Constellation Fan — Collapsed State

- **✧ FAB button**: 42×42px circle, `#0d1220` fill, 1.5px `#d4a854` border, glow box-shadow
- Red badge (top-right of FAB) shows drawn card count
- Cards stack **vertically** (portrait orientation) immediately above the FAB
- Stacked cards: 44×66px, ~6px vertical offset per card, ±4° random slight rotation for natural "hand" feel
- Only the **top card** shows full content (symbol + name + detail)
- **Buried cards** show only: colored type-border + runic bands (top/bottom), 35–75% opacity gradient (bottom cards more transparent)
- Total stack footprint: ~44×80px (compact, never overlaps selection)

### Constellation Fan — Expanded State

**Triggered by:**
- Player taps the ✧ FAB button
- An interaction fires that targets a card in the tableau (auto-expand)

**Visual:**
- Background dims (`rgba(7,10,18,0.65)` overlay) over selection area
- Heading fades to 35% opacity
- "Your Constellation" label appears above the fan
- Cards spring out from the stack into a radial fan pattern
- Each card's **bottom-center** is anchored to the ✧ pivot point
- Cards rotate outward around the pivot (CSS `transform-origin: bottom center`)
- Subtle dashed arc guide line behind the fan

**Interaction target highlight:**
- Target card: slightly larger (52×74px vs 50×72px), gold border, gold glow box-shadow, pulse ring animation, z-index elevated
- Remains clearly visible among other fan cards

**Collapse:**
- Tap ✧ again, or auto-collapse after 3 seconds of inactivity

**Animation sequence (Framer Motion):**
1. ✧ rotates 45° with expanding glow
2. Cards sequentially spring upward from the stack (stagger ~80ms per card)
3. Cards settle into their radial positions with spring physics
4. Interaction target (if any) pulses with gold pulse-ring animation

### Card Design System (Fan Cards)

All fan cards share a common structure:

```
┌─────────────────────┐
│ ᚠᚢᚦᚨ  (runic band)  │  ← type-colored, 0.32rem, 40-50% opacity
│                     │
│       SYMBOL        │  ← largest element (0.7–1.2rem)
│       Name          │  ← Cormorant Garamond, 0.38-0.42rem, #c8d8f0
│      Detail         │  ← Inter, 0.3-0.35rem, type-colored
│                     │
│ ᚠᚢᚦᚨ  (runic band)  │
└─────────────────────┘
```

- **Dimensions**: 50×72px (collapsed/fan), 52×74px (interaction target)
- **Background**: `linear-gradient(180deg, #0d1220, #0a1020)` — matches `--color-bg-card`
- **Border radius**: 4px (5px for target)
- **Gap between cards in fan**: ~18° rotation increment (adjusts with card count to keep arc under ~140°)

**Type colors** (border + runic bands):

| Type | Color | Symbol example |
|------|-------|----------------|
| Tarot | `#9b6bb0` (purple) | ✧ symbol, ▲/▼ orientation |
| D20 | `#c75b4a` (red) | Die face unicode (⚀-⚅), numeric value, threshold label |
| I Ching | `#5b8c5a` (green) | Hexagram unicode (e.g. ䷀), hex number, changing line count |
| Happening | `#d4a854` (gold) | ✦ star, "Event" label |

### Selection Area (Draw Phase)

- Horizontally scrollable row of face-down cards
- `scroll-snap-type: x mandatory` — cards snap to center
- Center card glows gold (`border-color: #d4a854`, subtle box-shadow)
- Outer cards are dimmed (50% opacity at edges)
- Invisible scrollbar (standard `-webkit-overflow-scrolling: touch`)
- Cards: 88–100px wide × 130–150px tall (responsive clamping)
- Face-down design: runic band top + ✧ symbol center + runic band bottom (matching existing `TarotMinigame` style)
- Accommodates 3–5 cards; at 5 cards, outer cards overflow and require horizontal scroll

### Viewport & Responsive Behavior

- **Mobile (< 768px)**: Full Constellation Fan layout as described
- **Tablet/Desktop (≥ 768px)**: Cards can be larger, fan can spread wider. Exact breakpoint behavior TBD in implementation — current desktop layout is acceptable as-is
- **Fixed viewport**: `position: fixed; inset: 0; overflow: hidden` — no body scroll
- **Internal scroll**: only the selection card row scrolls horizontally

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/screens/GameTable.tsx` | Replace `centerStyle` flex behavior; add heading anchoring; restructure to zoned layout |
| `src/components/overlays/CardTableau.tsx` | **Major rewrite**: replace horizontal tray with collapsible fan system. New component or heavily refactored to support collapsed/expanded states, radial positioning, interaction highlight |
| `src/components/screens/TarotMinigame.tsx` | Update `cardsRowStyle` to use horizontal snap-scroll; adjust card sizing for 4–5 card support |
| `src/components/screens/DiceMinigame.tsx` | Minor: ensure consistent heading positioning |
| `src/components/screens/IChingMinigame.tsx` | Minor: ensure consistent heading positioning |
| `src/styles/theme.css` | Add media query breakpoints and responsive variables if needed |

### New Components

- `src/components/overlays/ConstellationFan.tsx` — the collapsible fan (extracted from or replacing CardTableau)
- `src/components/cards/FanCard.tsx` — individual portrait fan card with type styling, runic bands, interaction highlight state

## Interaction Animation Compatibility

### How Current Animations Work

All five interaction animations (`Reroll`, `Flip`, `Mirror`, `AddChoice`, `SecondResult`) render as **full-screen abstract overlays** positioned at `position: absolute; inset: 0` with `display: flex; align-items: center; justify-content: center`. They do NOT animate between specific card positions — there are no literal projectiles traversing from source card to target card. Instead:

| Animation | Visual | Duration |
|-----------|--------|----------|
| **Reroll** | 16 gold particles burst radially from screen center (radius 80–120px) | ~600ms |
| **Flip** | Horizontal red-orange wave sweeps across screen center (200px wide) | ~700ms |
| **Mirror** | Silver line expands horizontally across 60% of screen width | ~1.2s |
| **Add Choice** | 3 vertical green branch lines grow upward from center | ~800ms staggered |
| **Second Result** | 2 expanding purple ripple rings from center | ~1s |

**This is good for the fan design** — the animation overlays naturally play through the clear center zone between the selection area and the fan. The "projectile flight zone" in the layout serves as unobstructed stage space for these abstract effects.

### activeSlots Contract (Unchanged)

The `InteractionSequencer` communicates card highlight state to the tableau/fan via the `activeSlots` object:

```ts
interface ActiveSlots {
  sourceIndex: number | null;  // which slot glows gold (source of interaction)
  targetIndex: number | null;  // which slot glows warm/orange (target)
  effect: string | null;       // 'reroll' | null — triggers pulse ring on target
}
```

The fan component receives this via the same `activeSlots` prop that `CardTableau` currently uses. No changes to the `InteractionSequencer` or the callback wiring in `GameTable.tsx`.

### Fan Card Highlight States

Each fan card maps its slot index against `activeSlots` to determine its visual state:

| State | Condition | Visual |
|-------|-----------|--------|
| `idle` | index not in activeSlots | Default styling (type-colored border, no glow) |
| `source` | `sourceIndex === index` | Gold border glow (`box-shadow: 0 0 16px rgba(212,168,84,0.5)`), border-color `#d4a854` |
| `target` | `targetIndex === index && effect !== 'reroll'` | Warm orange border glow (`box-shadow: 0 0 14px rgba(200,120,80,0.5)`), border-color `rgba(200,120,80,0.5)` |
| `animating` | both sourceIndex AND targetIndex === same index | Combined gold + warm glow, border-color `rgba(212,168,84,0.7)` |
| `reroll-target` | `targetIndex === index && effect === 'reroll'` | Gold glow + pulse ring animation + slightly larger (52×74px) + scale 1.15 |

These match the existing `getSlotState()` logic in `CardTableau.tsx` (lines 17–22) — the fan reuses the same state machine.

### Auto-Expand on Interaction

The fan auto-expands when **either** `sourceIndex` or `targetIndex` in `activeSlots` matches a fan card index. This covers all interaction patterns:

- **Source in selection, target in fan** (most common): Target card auto-expands and highlights with target glow
- **Source in fan, target in fan** (e.g., two already-drawn cards interact): Both cards highlight; fan auto-expands to show both
- **Source in fan, target in selection** (rare, e.g., reverse interaction): Source card in fan highlights; fan auto-expands

**Timing contract with InteractionSequencer:**
1. `onActiveSlotsChange` fires → fan reads `activeSlots`, auto-expands if needed
2. Interaction animation plays (full-screen overlay, center stage)
3. `onAnimationComplete` fires → fan starts 3s auto-collapse timer
4. If another interaction fires before the timer elapses, timer resets

### Per-Effect Fan Behavior

| Effect | Source highlight? | Target highlight? | Fan expand? | Notes |
|--------|-------------------|-------------------|-------------|-------|
| **Reroll** | Source glows gold | Target glows gold + pulse ring | Yes, if either slot in fan | Target card pulses with `pulseRingStyle` during the particle burst |
| **Flip** | Source glows gold | — | Yes, if source in fan | No target highlight (flip affects the source card itself) |
| **Mirror** | Source glows gold | — | Yes, if source in fan | Mirror creates a duplicate — source card highlighted during reflection |
| **Add Choice** | Source glows gold | — | Yes, if source in fan | Adds a new selection card — fan highlights the source |
| **Second Result** | Source glows gold | — | Yes, if source in fan | Chaos surge gives second draw — fan highlights the source |

**Key insight:** Only `reroll` has both a source and a distinct target highlight. The other four effects highlight only the source card. The `InteractionSequencer` step timing (lines 156–169) controls when highlights appear and clear.

### Fan Does NOT Interfere With Animations

Since all animation overlays are `position: absolute; inset: 0; z-index: 20` and the fan is at `z-index: 15` (expanded) or `z-index: 8` (collapsed), the animation overlays always render **above** the fan. The fan's auto-expand brings cards into view **before** the overlay plays, so the player sees highlighted cards through semi-transparent effects (particles, ripples, waves).

## Non-Goals

- Changing the interaction system logic (engine remains untouched)
- Redesigning the Happening screen, Result screen, or Title screen
- Adding component tests (existing test infrastructure tests engine only)
- Changing the desktop layout significantly — focus is mobile

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Radial transform math is complex | Use Framer Motion `animate` with calculated `rotate` + `translateY` values; test with 3, 5, 7, 10 cards |
| Small tap targets on fanned cards | Enlarge touch target zone (padding/margin) beyond visual card size; tap-jack the fan area |
| Performance on low-end devices | Framer Motion GPU-accelerated transforms; no layout-triggering animations |
| InteractionSequencer timing with auto-expand | Expand happens before animation starts; collapse happens well after animation completes |
