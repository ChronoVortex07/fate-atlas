# Hand Slot (Constellation) UX Overhaul — Design

**Date:** 2026-06-24
**Status:** Approved
**Area:** `src/components/overlays/ConstellationFan.tsx`, `src/components/cards/FanCard.tsx`, `src/components/overlays/InteractionSequencer.tsx`, `src/components/screens/GameTable.tsx`, `src/components/screens/ResultReading.tsx`, `src/engine/responders/interactions.ts`

## Problem

The hand (the "Constellation" fan of committed results) has three UX problems:

1. **Position:** the collapsed stack sits bottom-center on desktop, where it overlaps minigame UI in some games.
2. **Hitbox:** only the lower half of the collapsed stack is tappable — the click wrapper is anchored at the bottom while the cards translate *upward* out of its bounds, so the visible cards are outside the clickable area.
3. **Expanded state is inert:** it's a static fan. There's no way to scroll through cards, no way to inspect a card's full reading, and meta-interactions that involve a hand card don't draw attention to that card before their animation plays.

## Goals

- Move the collapsed hand to the **bottom-right** on every breakpoint and make the **entire visible stack** tappable.
- Turn the expanded state into a **rotating radial wheel** with **infinite (looping) horizontal-drag scroll** and **snap-to-front**, preserving the current radial look.
- Let the player **tap a card** in the expanded wheel to open a **centered modal** with that card's full reading breakdown (the same content the results page shows).
- When a meta-interaction **involves a hand card**, sequence it as: auto-expand → scroll the wheel to that card → the card **glows** → *then* the effect animation plays. Interactions that don't involve the hand leave it untouched.

## Non-goals

- Rewriting the effect animations (reroll/flip/mirror/…). They remain centered overlays; most effects act on the *field*, not the hand, so a centered canvas is correct. Only the **pre-phase** (expand/scroll/glow) and **sequencing** are new.
- Changing affinity/interaction *game logic* (which effects fire, shift math, bands). We only add presentational metadata (which hand slot triggered an effect).
- Any change to the collapsed hand on mobile beyond the shared hitbox fix (mobile is already bottom-right).

## Design

### 1. Collapsed hand — reposition + hitbox (`ConstellationFan.tsx`)

- Anchor the collapsed footprint to the **bottom-right corner on both desktop and mobile** (remove the desktop `left:50% / translateX(-50%)` centering for the collapsed state). The "N ✧ tap to expand" hint moves with it.
- **Hitbox fix:** size the collapsed clickable wrapper to the **full visual bounds of the rendered stack**. The top card translates up to roughly `index*14 + 60` px (desktop) / `index*6 + 36` px (mobile) plus the card height; the wrapper's height must cover that whole span so every visible card is inside the tap target. The toggle handler and `cursor:pointer` live on the wrapper. Collapsed cards keep `pointerEvents:'none'` so taps fall through to the wrapper.
- Expanded state is **centered** (anchored to the bottom) on both breakpoints so the wheel has symmetric room.

### 2. Expanded hand — rotating radial wheel (`ConstellationFan.tsx` + `FanCard.tsx`)

A coverflow-style rotating carousel replaces the static fan:

- **State:** a single continuous `rotation` value (in card-steps or radians) held in component state, plus a derived `focusIndex` (the card currently nearest front-center).
- **Layout:** each card's angular offset from front-center = `(cardIndex - rotation)` wrapped into `[-N/2, N/2)` **modulo the card count** — this gives infinite looping. From that angular offset, compute the card's `x`, `y` (arc), `rotate` (tangent), `scale`, `opacity`, and `zIndex`. The front card (offset ≈ 0) is largest/brightest/upright; side cards shrink and fade with `|offset|`. This preserves the existing radial silhouette.
- **Input:** horizontal pointer/touch drag updates `rotation`; wheel/trackpad also scrolls. On release, **snap** `rotation` to the nearest integer (snap-to-front) with a spring.
- **Tap vs drag:** a movement threshold disambiguates. Below threshold = **tap** (open that card's detail modal); above = **drag** (scroll). A tap on a non-front card may first rotate it to front, then open — or open directly; either is acceptable as long as drag never opens the modal.
- **`FanCard` changes:** accept the wheel-computed transform (`x/y/rotate/scale/opacity/zIndex`) for the expanded state and a `glowing` flag (the meta-interaction spotlight). The collapsed and existing mobile/desktop static paths can be simplified now that the expanded path is wheel-driven, but the card's *content* rendering (sigils, names, sub-card triangle) is unchanged.

### 3. Click-to-inspect detail modal

- Tapping a card opens a **centered modal** rendering that card's full reading: sigil/symbol, name, orientation, full meaning text, and the three-position sub-spread when the card is a multi-card tarot result. Backdrop click or a close control dismisses it; the wheel stays in place behind the dimmed backdrop.
- **Refactor — shared `CardReadingDetail`:** the per-card breakdown is currently inlined in `ResultReading.tsx` (`getResultDisplay` + the result-card JSX, including the sub-card spread layout). Extract it into a shared presentational component `src/components/cards/CardReadingDetail.tsx` that takes a `SlotResult` and renders the full breakdown. Reuse it in **both** `ResultReading.tsx` and the new modal so there's one source of truth. The modal is a thin wrapper (backdrop + close) around `CardReadingDetail`.

### 4. Meta-interaction sequencing (expand → scroll → glow → animate)

**Engine — report which hand card triggered the effect (`interactions.ts`):**

At a `*:commit` trigger, `ctx.spread === state.turnResults` (the draft has no `pool`, so `spread = [...slots]`), so a responder can find the triggering card's hand index with `findIndex` and stamp it on the `EffectReport`. Extend the `report()` helper to accept `sourceSlot`. Responders that fire **because of a hand card** set `sourceSlot` (and `targetSlot` where two hand cards are involved):

- `fool-reroll` → index of the Fool card in the spread.
- `critical-resonance` → index of the critical die in the spread.
- `mirror` → the two reversible-card indices (`sourceSlot` + `targetSlot`).
- `iching-resonant-change` → index of the reversible non-iching hand card.
- `iching-happening-boost` (`happening:start`, spread still equals `turnResults`) → index of the changing-lines I Ching card.

Responders whose effect is **internal to the committing field card or the pool** (the `spreadEntry` family: suit-accord, elemental-clash, major-convergence, spread-aligned/cascade; and the affinity responders) set **no** `sourceSlot` — they must not expand the hand.

Index stability: at commit the field result is appended to `turnResults` *after* dispatch and at the end of the array, so a `sourceSlot` pointing at a pre-existing card stays valid against the post-commit `turnResults` the fan renders. (`chaos-second-result` already remaps its own `targetSlot` after an insert; inserts are appends, so existing indices are unaffected.)

**UI — coordinate the pre-phase (`InteractionSequencer.tsx` + `ConstellationFan.tsx` + new context):**

- A lightweight React context `InteractionFocusContext` is provided in `GameTable` wrapping both the fan and the sequencer. The sequencer publishes the **current report** (`queue[i]`) and a **phase** (`'focusing' | 'animating' | null`); the fan consumes it.
- Sequencer timing becomes two sub-phases per report:
  - If `queue[i].sourceSlot != null`: enter **`focusing`** for a short `FOCUS_BEAT` (~700 ms) during which the centered effect animation is **not** shown — the fan auto-expands, rotates the wheel to `sourceSlot`, and glows that card — then switch to **`animating`** and render the centered animation for `DURATION[anim]`.
  - If `sourceSlot == null`: skip `focusing`, go straight to `animating` (current behavior), and the fan is left collapsed/untouched.
- The fan derives its glow target from the context's current report (`sourceSlot`/`targetSlot`), replacing the old `deriveActiveSlots(queue[0])` path so multi-report batches re-focus per report. `GameTable.deriveActiveSlots` is removed or folded into the context.
- Auto-collapse after the batch drains stays (existing timer behavior).

### 5. Engine/React split, docs, testing

- Gameplay fact (which slot triggered an effect) lives in the **engine/responders**; the expand/scroll/glow choreography and wheel live in **React**. The split is preserved — no React/DOM in the engine.
- `sourceSlot` is presentational metadata, not a rules change, so **`docs/game-systems.md` needs no change**. Touch the README/animation notes only if the player-visible behavior reads differently.
- **Tests:** extend `src/engine/__tests__/InteractionResponders.test.ts` to assert the hand-triggered responders set the expected `sourceSlot` (and `targetSlot` for mirror), and that field-internal/affinity responders leave `sourceSlot` undefined. Wheel drag, snap, the detail modal, and the meta-interaction choreography are verified manually — per CLAUDE.md the Vitest harness covers the engine/data layer only.

## Decisions (resolved)

- **Snap-to-front** on drag release (confirmed).
- The hand **only expands when a report involves a hand card**; field-only/affinity effects never disturb it (confirmed).
- Collapsed hand **bottom-right** on all breakpoints; expanded wheel **centered**.
- Tap **any** card → its detail modal; the **front-focused** card is the scroll-to / glow target for meta-interactions.

## Risks

- **Tap/drag disambiguation** is the fiddliest part on touch; a movement threshold + only opening the modal on a clean tap mitigates accidental opens.
- **Index drift:** mitigated by the append-only commit ordering noted above; covered by an engine test.
- **Sequencer/fan coordination** adds a context; kept minimal (current report + phase) to avoid a state-sync tangle.
