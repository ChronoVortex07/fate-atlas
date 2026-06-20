# Interaction Result Display — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)

## Problem

When an interaction effect (Fool's Reroll, Critical Flip, Mirror, Chaos Surge) mutates a
result during the interaction sequence, the change is not reflected in the centered
minigame view. For the Fool's Reroll specifically: the die does not re-roll, the roll
animation does not replay, and the number does not update.

### Root cause

There are **two sources of truth** for a committed result:

1. The minigame component's **local React state** (`result` / `rollValue` in
   [DiceMinigame.tsx](../../../src/components/screens/DiceMinigame.tsx), and the equivalent
   in `TarotMinigame` / `IChingMinigame`) — this is what the player sees centered.
2. `state.turnResults` in the engine — this is what interaction effects mutate
   (`executeEffect` in [GameEngine.ts](../../../src/engine/GameEngine.ts)).

Effects only touch the engine copy. The minigame stays mounted during the interaction
sequence (per the current working copy, which removed the old `screen = 'interaction'`
transition) but keeps rendering its stale local state, so the reroll is invisible there.
The engine's new value only ever surfaces in the small `CardTableau` tray.

This is a **general** problem, not a dice-only one: all three minigames hold results in
local state, so every effect that mutates `turnResults` has the same disconnect.

## Principle

Collapse to **one source of truth for *display*: `state.turnResults`.**

A minigame owns only the *act of drawing*. The moment a result is committed, its on-screen
representation is rendered **from the engine**. Any effect — reroll, flip, mirror,
second-result, or anything added later — is then reflected automatically, with zero
per-effect display code.

## Design

### 1. Engine tracks the active slot

Add `activeSlotIndex: number | null` to `GameState`.

- Initial state: `null`.
- Set in `completeMinigame` to the index of the just-committed result.
- Reset to `null` in `startTurn` and in the run-reset paths (`reset`,
  `returnToTitle`, `returnToQuestionSelect`) — it is turn state, not carryover.

This keeps "which slot is currently in focus" in the engine, where
[CLAUDE.md](../../../CLAUDE.md) says logic belongs. It is explicitly testable and reusable
by the sequencer / tableau for focus and highlighting.

#### Canonical committed index

The committed index must be `this.state.turnResults.length - 1` **after the append**, not
`completed - 1`. The `completed` minigame counter diverges from the `turnResults` index
after a `second-result` effect, which appends a slot to `turnResults` without incrementing
the counter. `completeMinigame` should compute the committed index once and use it for
**both** `activeSlotIndex` **and** the interaction event's `targetSlotIndex`.

This also fixes a latent bug: the existing code maps `targetSlotIndex: completed - 1`
([GameEngine.ts](../../../src/engine/GameEngine.ts)), which would target the wrong slot if
an effect had appended a result earlier in the same turn. Both values must derive from the
same canonical index so the slot the engine rerolls is always the slot the minigame
displays.

Note: `second-result` *appends* a new slot, so `activeSlotIndex` continues to point at the
original minigame's slot, which is correct (the minigame shows its own result; the appended
result shows in the tableau).

### 2. Minigame result display reads from the engine

Each minigame splits cleanly into two phases:

- **Draw phase** — the interaction (cast the die, pick the card, cast the coins). Local
  state only.
- **Result phase** — renders `state.turnResults[activeSlotIndex]`. Local state is no longer
  the display source once committed.

To unify the initial draw and later effects into a **single code path**, the minigame
commits the result to the engine *first*, then the result phase animates toward the
engine value. The initial roll and a reroll then become the same thing: "the engine value
for my slot changed → play the reveal animation."

Re-animation on change is achieved by keying the reveal element on a value-derived key:

- **Dice**: key on the die value → a reroll replays the full throw animation and shows the
  new number.
- **Tarot**: key on `id + orientation` → flip / mirror replays the flip.
- **I Ching**: key on `hexagramNumber + changingLines` → (its own slot is unchanged by
  current effects, so it simply renders correctly).

### 3. Extract the dice throw into a replayable presentational component

Extract the dice reveal animation into a self-contained `DiceThrowAnimation` component:

- **Props:** the die value (and threshold for coloring).
- **Behavior:** plays the throw / count-up toward the value on mount; the parent re-keys it
  by value to replay.
- **Purpose:** this is the single **seam** for the planned Baldur's Gate-style physics
  throw. Swapping the count-up internals for a physics renderer later requires changing
  only this component — not the minigame's commit logic and not the engine.

Tarot and I Ching get the same treatment to the extent their reveals need replay, but the
dice component is the one explicitly designed as the physics swap point.

### 4. Effect application must happen *before* the screen transition

Engine-sourced display is necessary but not sufficient. Today `advanceInteractionQueue`
([GameEngine.ts](../../../src/engine/GameEngine.ts)) applies the effect **and** transitions
the screen (`method-select` / `result`) in the same `notify()`. So the new value lands at
the exact moment the minigame unmounts — the centered view never renders or animates it.

The narrative also requires deferred application: the player must see the *original* roll
first, then watch it re-roll. So the effect cannot be applied eagerly at `completeMinigame`
either; it must apply mid-sequence, at the **reveal** step, while the minigame is still
mounted.

Split the work into two engine methods:

- `applyHeadInteraction(): void` — applies `executeEffect` for the head of the queue (the
  one currently animating), `notify()`, but does **not** dequeue or transition. Guarded by a
  new `interactionApplied: boolean` state flag so it runs **once** per head (protects against
  React re-invocation and effects like `second-result` that would otherwise append twice).
- `advanceInteractionQueue(): void` — unchanged responsibilities (dequeue head; transition
  when the queue drains) **except**: if `interactionApplied` is still `false` it applies the
  effect first (covers a fast tap that skips the reveal beat), then resets
  `interactionApplied = false` after dequeuing.

`interactionApplied` is added to `GameState` (default `false`), reset in `startTurn` and the
run-reset paths.

The `InteractionSequencer` calls `engine.applyHeadInteraction()` once when it enters the
`reveal` step (the existing per-step effect; the `interactionApplied` guard makes repeat
calls safe). The screen transition still happens later, on the tap that triggers
`handleComplete → advanceInteractionQueue`.

### 5. GameTable

Unchanged from the current working copy: the minigame stays mounted during interactions
(`screen` stays `'minigame'`, the sequencer overlays on top). That part of the earlier fix
was correct; it just needed an engine-backed display behind it and the deferred screen
transition above.

## Data flow (Fool's Reroll, after fix)

1. Player throws → `rollD20`; `DiceThrowAnimation` plays the initial count-up from local
   state. After the existing reveal delay, `completeMinigame(result)` commits.
2. Engine appends the result, sets `activeSlotIndex` and the canonical `targetSlotIndex`,
   queues the reroll interaction, and stays on the minigame screen
   (`interactionApplied = false`).
3. Once committed, the result phase renders `DiceThrowAnimation` from
   `turnResults[activeSlotIndex]`; the value matches the local roll, so no replay occurs.
4. Sequencer overlays and runs the reroll steps. On entering `reveal` it calls
   `applyHeadInteraction()`, which replaces `turnResults[activeSlotIndex]` with a freshly
   drawn d20 and sets `interactionApplied = true`. Screen stays `minigame`.
5. The new value flows to `DiceThrowAnimation`, which (re-keyed by value) replays the full
   throw to the new number, visible on the centered die during the reveal step.
6. Player taps → `advanceInteractionQueue` dequeues, resets the flag, and (queue empty)
   transitions to `method-select`. The `CardTableau` retains the rerolled value.

## Testing

- **Engine (Vitest):**
  - `completeMinigame` sets `activeSlotIndex` to the committed index.
  - `startTurn` and reset paths clear `activeSlotIndex`.
  - After a reroll, `activeSlotIndex` still points at the same slot and
    `turnResults[activeSlotIndex]` holds the new value.
  - After a `second-result` append earlier in the turn, the next `completeMinigame` sets
    `activeSlotIndex` and `targetSlotIndex` to the true appended index (not `completed - 1`).
  - `applyHeadInteraction` applies the head effect, sets `interactionApplied = true`, and
    does **not** dequeue or change `screen`.
  - `applyHeadInteraction` called twice for the same head applies the effect only once
    (guard holds; a `second-result` head appends exactly one slot).
  - `advanceInteractionQueue` after `applyHeadInteraction` does not re-apply the effect, and
    transitions the screen only once the queue drains; `interactionApplied` is reset.
  - `advanceInteractionQueue` without a prior `applyHeadInteraction` still applies the head
    effect (fast-tap path).
- **Components:** no component test harness exists (Vitest is engine-only per
  [vitest.config.ts](../../../vitest.config.ts)). The visual behavior is verified manually
  via the debug panel's "Fool's Reroll" scenario.

## Out of scope

- The physics throw engine itself (this design only establishes the seam).
- Any change to interaction matching / effect resolution logic.
- The `CardTableau` tray rendering (already engine-backed and correct).
