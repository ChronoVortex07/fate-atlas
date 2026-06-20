# Interaction Redesign — Card Tableau & Animation Sequencer

**Date:** 2026-06-20
**Status:** In Review

## Problem Summary

1. **No persistent card display** — drawn results (dice, tarot, I Ching) only appear in their minigame, then vanish. There's no visual record of what's been drawn this turn until the result screen.
2. **Meta interaction animations are broken** — Fool's Reroll and other effects render at center-screen with no connection to the cards that triggered them. The minigame component unmounts before the animation plays, so card positions are lost.
3. **Timing/flow is broken** — `completeMinigame()` transitions the screen to method-select WHILE the interaction animation plays on top. The whole interaction layer is click-to-dismiss. `pendingHappening` triggers a happening immediately after `clearActiveInteraction()` with zero delay and no player input.
4. **Description is unreadable** — the text explaining the interaction is only visible for 500ms during one phase of the animation.

## Design

### 1. Card Tableau (Persistent Draw Display)

A new `CardTableau` component is added to `GameTable`, positioned at the bottom of the viewport. It's always visible during a turn (from method-select through result). As each draw completes, a compact card slides in.

**Layout:** Horizontal row of 3 slots (one per minigame), centered above the bottom edge. Cards are ~120×80px mini-versions showing symbol, name, and type. They sit inside a subtle tray — a thin gold-tinged border-top with soft glow, evoking cards resting on a table edge.

**Card visual states:**
- `idle` — normal display, standard opacity
- `source` — golden glow border, gentle pulse (this card triggered an interaction)
- `target` — highlighted border, the card being affected
- `animating` — mid-effect (number spinning for dice, card flipping for tarot, etc.)

**Data:** Reads `state.turnResults` from the engine. Receives `activeSlots: { sourceIndex: number | null, targetIndex: number | null }` from the sequencer to know which cards to highlight.

**Entry animation:** New cards slide up + fade in (~0.4s, staggered if multiple).

**Result screen integration:** The tableau remains visible but transitions to a "concluded" look — slightly dimmed, no interactivity.

### 2. Animation Sequencer & Engine Timing Fix

**Core change:** Interactions queue instead of firing immediately. The game freezes behind the animation layer until the queue drains.

**New flow:**
1. `completeMinigame()` fires an interaction → pushes onto `interactionQueue` array. Does NOT transition the screen. Current screen stays frozen.
2. `InteractionSequencer` component reads the queue and plays interactions sequentially.
3. Each interaction: sets `activeSlots` → cards glow → description banner shown → visual effect plays → auto-advance or tap-to-fast-forward.
4. When queue drains, `advanceInteractionQueue()` resolves the pending screen transition (method-select, happening, or result).

**Engine state changes:**
- `GameState.activeInteraction: InteractionEvent | null` replaced by `interactionQueue: InteractionEvent[]`
- New method `advanceInteractionQueue()` — removes front; if empty, resolves pending transition
- `startTurn()`, `returnToQuestionSelect()`, `returnToTitle()`, `returnToTitle()` all clear the queue
- `clearActiveInteraction()` replaced by `advanceInteractionQueue()`

**Tap-to-fast-forward:** The sequencer listens for taps on the interaction layer. A single tap during an animation jumps to that animation's end state (skips the visual flourish but briefly shows the description). Tapping during the description phase advances to the next interaction or dismisses. Rapid/repeated tapping effectively skips all animations.

**Happening mid-queue:** If a happening triggers while interactions are queued, `pendingHappening` is set. After queue drain, the sequencer triggers the happening. The tableau stays visible during the happening for continuity.

### 3. Animation Descriptors & Per-Effect Visuals

Each `InteractionEvent` is mapped to a visual `AnimationDescriptor` by the sequencer. All effects share the structure: highlight source → animate → highlight target → resolve.

| Effect | Source indicator | Animation | Target indicator | Target card behavior |
|---|---|---|---|---|
| **reroll** (Fool's Reroll) | Fool card pulses gold, spark gathers at edge | Streak of golden particles arcs from source to target (0.5s) | Dice card flashes, border glows | Dice number spins rapidly then settles to new value |
| **flip** (Critical Flip) | Dice card flashes red | Shadow wave sweeps across tableau from source to target | Tarot card shudders | Card flips (rotateY 180°) to opposite orientation |
| **mirror** (Mirror Event) | Both reversible cards glow simultaneously | No projectile — both pulse in sync, shimmering line connects them | — | Both flip orientation in unison |
| **add-choice** (I Ching Boost) | Hexagram glows teal | Lines extend from hexagram outward, forming branches | Happening card or center indicator | Happening gets a +1 badge (extra choice) |
| **second-result** (Chaos Surge) | No source (chaos itself) | Void ripple emanates from center | Target shimmers purple | Ghost overlay of second result appears, then fades |

**Descriptor type** (defined in `InteractionSequencer.tsx`, NOT in engine types — this is a visual concern):
```typescript
interface AnimationDescriptor {
  effect: 'reroll' | 'flip' | 'mirror' | 'add-choice' | 'second-result';
  sourceIndex: number | null;
  targetIndex: number | null;
  description: string;
  duration: number; // base ms before auto-advance
}
```

Duration is a base — tap halves remaining time; rapid tapping skips entirely.

### 4. Component Architecture

```
GameTable
├── StarField (z-index: 0, background)
├── CardTableau (z-index: 5, persistent bottom row)
├── <screen component> (z-index: 1, center)
│   └── TitleScreen / QuestionSelect / MethodSelect / Minigame / HappeningScene / ResultReading
└── InteractionSequencer (z-index: 20, overlay when queue non-empty)
    └── Per-effect animation components
        ├── RerollAnimation
        ├── FlipAnimation
        ├── MirrorAnimation
        ├── AddChoiceAnimation
        └── SecondResultAnimation
```

## File Changes

| File | Change |
|---|---|
| `src/engine/types.ts` | Replace `activeInteraction` with `interactionQueue: InteractionEvent[]`; add `CardSlotState` type |
| `src/engine/GameEngine.ts` | Replace `clearActiveInteraction()` with `advanceInteractionQueue()`; add `executeEffect()`; fix `targetSlotIndex` in `completeMinigame()`; update state resets |
| `src/engine/InteractionResolver.ts` | Fix `targetSlotIndex` hardcoded to `0` — pass actual result index |
| `src/components/screens/GameTable.tsx` | Add `CardTableau` component below center content; wire `InteractionSequencer` |
| `src/components/overlays/CardTableau.tsx` | **New** — persistent card row with stateful slots |
| `src/components/overlays/InteractionSequencer.tsx` | **New** — replaces `InteractionLayer`, manages queue playback, defines `AnimationDescriptor` |
| `src/components/overlays/InteractionLayer.tsx` | **Remove** — replaced by `InteractionSequencer` |
| `src/components/overlays/InteractionAnimations/FoolsRerollAnimation.tsx` | Rewrite to use card-relative positioning |
| `src/components/overlays/InteractionAnimations/StubAnimations.tsx` | Rewrite with proper per-effect visuals |
| `src/components/overlays/InteractionAnimations/RerollAnimation.tsx` | **New** — reroll-specific animation |
| `src/components/overlays/InteractionAnimations/FlipAnimation.tsx` | **New** — flip-specific animation |
| `src/components/overlays/InteractionAnimations/MirrorAnimation.tsx` | **New** — mirror-specific animation |
| `src/components/overlays/InteractionAnimations/AddChoiceAnimation.tsx` | **New** — add-choice animation |
| `src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx` | **New** — second-result animation |
| `src/engine/__tests__/GameEngine.test.ts` | Update tests for queue-based interaction model; add `executeEffect` tests |
| `src/engine/__tests__/InteractionResolver.test.ts` | Add tests for `targetSlotIndex` fix |

### 5. Engine Effect Resolution

Currently interaction events are purely informational — the engine fires them but never changes game state in response. This must change: the animation shows the effect, and the engine must execute it.

**New method: `executeEffect(event: InteractionEvent): void`**

Called by the sequencer when an animation completes (or is skipped). Mutates `turnResults` to apply the effect:

| Effect | Engine action |
|---|---|
| **reroll** | Re-draws the target slot via `orchestrator.drawSlot()` with current affinities. Replaces the old `SlotResult` at `turnResults[targetIndex]` with the new draw. Affinities are not re-applied (the first roll already nudged them). |
| **flip** | Toggles the orientation of the target Tarot card (upright ↔ reversed). Updates `turnResults[targetIndex]` in place. |
| **mirror** | Toggles both source and target Tarot cards' orientations simultaneously. |
| **add-choice** | If a happening is active, appends one extra choice to `happening.choices`. The choice text is generated by `selectHappening` with a seeded variant. |
| **second-result** | Draws a second result from the same divination type as the target. Appends it to `turnResults` as an additional slot. |

**Bug fix — `targetSlotIndex`:** In `completeMinigame()` line 151, `targetSlotIndex` is hardcoded to `0`. It must be set to `completed - 1` (the index of the just-added result in `turnResults`). The `sourceSlotIndex` from pending effects must also be validated to ensure it points to the correct `turnResults` index.

**Affinity constraint:** Effects do NOT re-apply affinity changes. Affinity is only nudged once when the slot is first revealed in `completeMinigame()`.

**Queue timing:** `executeEffect()` is called after the animation plays (or is skipped). If multiple interactions are queued, effects execute sequentially as each animation completes. This way the player sees the result of each effect before the next one starts.

## Non-Goals

- Making the card tableau interactive (clicking cards to re-roll, re-order, etc.) — deferred
- Dragging cards to rearrange — deferred
- Sound effects for interactions — deferred
- Card tableau animations for the "draw" phase itself (the minigames still own their full-size draw experience)
- Persisting tableau state across turns (it resets each turn like the rest of turn state)
