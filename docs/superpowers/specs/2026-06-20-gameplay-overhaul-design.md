# Gameplay Overhaul Design Spec

**Date:** 2026-06-20
**Status:** Approved
**Scope:** Major rework of the gameplay loop — screen architecture, turn lifecycle, interactions, minigames, and result display.

---

## 1. New Gameplay Flow

```
Title → Question Select → Method Select → [Happening Gate] → Minigame → ResultReading
```

1. **Title** — "CONSULT THE STARS" (unchanged)
2. **Question Select** — pick one of four question types (unchanged)
3. **Method Select** — 3 divination methods are drawn from the pool. User picks **one**. Affinities and pending effects may influence presentation (glow/shadow hints).
4. **Happening Gate** — if chaos ≥ 0.7 (30% chance) or the pool drew `happening` type and user selected it, skip to HappeningScene. Otherwise proceed to minigame.
5. **Minigame** — method-specific interactive experience (see §4). Pending effects fire as inline animations during the minigame via the InteractionLayer.
6. **ResultReading** — merged Interpretation + Result screen, optimized for sharing (see §6).

---

## 2. Component Architecture

### New Tree

```
App
├── StarField                    (unchanged)
├── GameTable                    (NEW — persistent hub, replaces screen router)
│   ├── HistoryTiles             (NEW — past readings as small tiles, always visible at top)
│   ├── [Center Content]         (AnimatePresence transitions)
│   │   ├── TitleScreen          (unchanged)
│   │   ├── QuestionSelect        (unchanged)
│   │   ├── MethodSelect         (NEW)
│   │   ├── TarotMinigame        (NEW)
│   │   ├── DiceMinigame         (NEW)
│   │   ├── IChingMinigame       (NEW)
│   │   ├── HappeningScene       (refactored into center content)
│   │   └── ResultReading        (NEW — merged Interpretation + ResultScreen)
│   └── InteractionLayer         (NEW — overlay on center, animates interaction events)
└── DebugPanel                   (extended with presets dropdown + force-trigger)
```

### Screen Enum (engine)

```ts
type Screen =
  | 'title'
  | 'question'
  | 'method-select'
  | 'minigame'
  | 'happening'
  | 'result';
```

Removed: `draw`, `interaction`, `interpretation` (merged or replaced).

### GameTable Hub

- Always renders `HistoryTiles` across the top
- Center area uses `AnimatePresence mode="wait"` for transitions between views
- `InteractionLayer` is a sibling to center content — renders animations on top without unmounting the minigame
- On wide screens: center content is `max-width: 680px`, history tiles span the full width with generous starfield on sides
- On mobile: center content fills viewport width, history tiles collapse to a horizontal scroll

---

## 3. Engine Changes

### New Turn Lifecycle

```
startTurn(question)
  → generates availableMethods (3 DivinationType, weighted by question + affinities)
  → screen = 'method-select'

selectMethod(index)
  → user picks one method type from the 3 available
  → creates placeholder minigameState
  → checks happening gate
    → YES: screen = 'happening', triggerHappening()
    → NO:  screen = 'minigame'

completeMinigame(result: SlotResult)
  → sets turnResult
  → checkPendingEffects(result) — fires matching effects as activeInteraction events
  → creates new PendingEffects from this result's interaction-eligible tags
  → apply affinities from result
  → synthesize()

synthesizeAndFinish()
  → runs synthesis on turnResult + interactions
  → screen = 'result'
```

### Pending Effects System

Interactions are **prospective only** — they affect future turns, never past readings.

```ts
interface PendingEffect {
  id: string;              // unique id
  sourceRunId: string;     // which past run created this
  sourceCard: string;      // display name, e.g. "The Fool"
  sourceSlotIndex: number; // position in history tiles for animation origin
  triggerTags: string[];   // tags that a future result must have to activate
  action: 'reroll' | 'flip' | 'add-choice' | 'mirror' | 'second-result';
  description: string;     // flavor text shown during animation
  expiresAfter: number;    // turns until expiry (default 3)
  turnsRemaining: number;
}
```

### State Changes

| Field | Change | Purpose |
|-------|--------|---------|
| `screen` | Reduced to 6 values | Removed `draw`, `interaction`, `interpretation` |
| `pool` → `availableMethods` | Renamed | Same 3 `DivinationType` array |
| `slots` → removed | Single result per turn | Replaced by `turnResult` |
| `turnResult` | **New**: `SlotResult \| null` | The single divination result for this turn |
| `selectedMethod` | **New**: `DivinationType \| null` | Which method type the user picked |
| `minigameState` | **New** | Holds face-down cards for tarot, dice state, etc. |
| `pendingEffects` | **New**: `PendingEffect[]` | Waiting to fire on future turns |
| `activeInteraction` | **New**: `InteractionEvent \| null` | Currently animating interaction (consumed by InteractionLayer) |
| `revealedCount` | Removed | No longer relevant |
| `happening` | Unchanged | Still holds active happening data |
| `synthesis` | Unchanged | Still holds synthesis result |
| `history` | Unchanged | Run records, now capped at last 10 for tile display |
| `affinities` | Unchanged | Persist across turns |

### Engine Methods (new/modified)

| Method | Purpose |
|--------|---------|
| `startTurn(question)` | Generates pool, sets screen to `method-select` |
| `selectMethod(index)` | User picks a method; does happening gate |
| `startMinigame()` | Initializes minigameState based on selectedMethod |
| `completeMinigame(result)` | Sets result, checks pending effects, creates new pending effects, synthesizes |
| `injectPendingEffect(effect)` | Debug-only: force-adds a pending effect |
| `clearActiveInteraction()` | Called by InteractionLayer after animation completes |
| `loadScenario(preset)` | Debug-only: loads a premade scenario from presets map |
| `synthesize()` | Internal: runs synthesis on turnResult |
| `triggerHappening()` | Mostly unchanged, now called from selectMethod gate |
| `resolveHappening(idx)` | Unchanged, navigates to `result` screen afterward |
| `returnToQuestionSelect()` | Unchanged: starts fresh turn (question → methods → etc.), preserves carryover |
| `returnToTitle()` | Unchanged |

### Interaction Resolver Changes

`InteractionResolver` gains:

```ts
// Check pending effects against a newly revealed result
checkPendingEffects(
  pendingEffects: PendingEffect[],
  currentResult: SlotResult,
): { matched: PendingEffect[]; remaining: PendingEffect[] }

// Create pending effects from a result's interaction-eligible tags
createPendingEffects(
  result: SlotResult,
  runId: string,
  rules: InteractionRule[],
): PendingEffect[]
```

The tag-matching logic is reused from the existing resolver (`hasAllTags`).

### Happening Gate Logic

In `selectMethod()`:
1. If `availableMethods[index]` is `'happening'` → always trigger happening
2. If chaos ≥ 0.7 → 30% chance to override and trigger happening
3. Otherwise → proceed to minigame

This replaces the old approach of happenings being drawn as placeholder slots.

---

## 4. Minigame Design

All minigames share a common pattern:
1. Interactive gesture (player clicks/taps)
2. Illusion of agency (engine already determined result)
3. Result reveal with animation
4. Pending effects check
5. Affinity shift

### TarotMinigame

1. Three face-down cards appear with Elder Futhark patterns on backs
2. Player taps one to select it
3. Unselected cards **burn away** (golden flame animation, cards crumble to embers)
4. Selected card lifts slightly — reversal prompt appears: "Reveal as drawn" or "Reverse its course"
5. Card flips with glow, orientation icon (▲/▼) pulses
6. Pending effects checked; InteractionLayer fires any matches
7. Affinity: reversed → +chaos, upright → +order

### DiceMinigame

1. Single d20 in center, slowly rotating
2. Player taps to "throw" — die launches upward, tumbles, lands
3. Result fades in with threshold-colored glow

**Extensibility parameters** (for future affinities/interactions):
- `diceCount`: number of dice (default 1)
- `advantageMode`: `null` \| `'advantage'` \| `'disadvantage'` — when set, 2 dice roll and merge
- `dieType`: `'d20'` \| `'d12'` \| `'d10'` \| etc.

Advantage/disadvantage shows two dice rolling, then merging into one with the final result.

### IChingMinigame

1. Three coins appear, yin/yang faces visible
2. Player taps to "cast" — coins flip and settle
3. Sequence repeats 6 times (building hexagram from bottom up)
4. Hexagram symbol and name revealed
5. Pending effects checked

### HappeningScene (refactored)

Moves from standalone full-screen to center content. Same scene text + choice cards layout. The star background stays via GameTable. Resolves to ResultReading afterward.

---

## 5. Interaction Visual System

### InteractionLayer

- Sits above center content in `GameTable` (z-index overlay)
- Subscribes to `state.activeInteraction`
- When non-null, renders animation sequence
- When animation completes or player taps, calls `engine.clearActiveInteraction()`
- Does **not** unmount the minigame underneath

### Fool's Reroll — Full Animation Sequence

| Step | Duration | Description |
|------|----------|-------------|
| Flash | 0.3s | Gold radial flash over The Fool's history tile |
| Glow | 0.5s | Tile pulses with golden light, card art glows |
| Particle | 0.6s | Particles arc from tile down to the dice in center |
| Reroll | 0.8s | Dice result fades out, dice spins rapidly, new result fades in |
| Dismissal | 0.5s | Gold shimmer sweeps, particles fade, tile returns to normal |

Total: ~2.7s. Tapping anywhere during the sequence skips to the end.

Implementation: A `FoolsRerollAnimation` component driven by `AnimationPhase` enum states, animated with Framer Motion.

### Other Interactions — Stubs

| Interaction | Stub Behavior |
|-------------|--------------|
| Critical Flip | Gold flash over triggering tile, card orientation swaps with flip animation |
| I Ching Boost | Hexagram tile glows, "+1 Choice" label appears, choice count increments |
| Mirror Event | Two history tiles flash simultaneously, "The Mirror" label, both cards swap orientations |
| Chaos Surge | Purple/gold flash, "Chaos Surges" label, second result appears |

Each stub shares the flash → label → dismiss pattern, ~1s total.

### Dev/Debug Triggers

**Scenario Presets** — DebugPanel gains a `<select>` dropdown:

| Preset | What it loads |
|--------|--------------|
| "Fool's Reroll" | `pendingEffects` with Fool's Reroll + `selectedMethod: 'd20'` + `screen: 'minigame'` |
| "Critical Flip" | `pendingEffects` with Critical Flip + current state for trigger |
| "I Ching Boost" | As above for I Ching boost |
| "Mirror Event" | Two reversible cards in history + relevant pending effect |
| "Chaos Surge" | `affinities.chaos: 0.8` + pending Chaos Surge effect |

**Keyboard shortcut:** `Alt+F` during dice minigame force-injects Fool's Reroll pending effect.

**Implementation:** `engine.loadScenario(presetId)` loads a pre-built state partial. Presets are defined in a `SCENARIO_PRESETS` map in the engine or a new `src/engine/scenarios.ts`.

---

## 6. ResultReading Screen

Merges the current `Interpretation` and `ResultScreen` into a single scrollable card.

### Layout

```
┌──────────────────────────────────┐
│  ═══════ [Runic Band] ═══════    │
│                                  │
│       "Your Reading"             │
│       Decision · italic          │
│    ─── [Ornamental Border] ───   │
│                                  │
│  ┌─ Divination Result ────────┐  │
│  │  🃏 The Fool               │  │
│  │  ▲ Upright                 │  │
│  │  "A new journey begins…"   │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌─ Interpretation ───────────┐  │
│  │  Headline                  │  │
│  │  Paragraph 1...            │  │
│  │  Paragraph 2...            │  │
│  │  ╎ Tension note            │  │
│  │  Affinity whisper          │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌─ The Crossroads ──────────┐  │  (only if happening)
│  │  Scene text...             │  │
│  │  You chose: "..."         │  │
│  └────────────────────────────┘  │
│                                  │
│  ═══════ [Runic Band] ═══════    │
│                                  │
│      [DRAW AGAIN]                │
│   [SHARE AS IMAGE] [HISTORY]     │
│   [Copy LLM Prompt]              │
└──────────────────────────────────┘
```

### Share Optimization

- The reading card is wrapped in a `data-share-container` element with `max-width: 560px`
- `shareAsImage()` targets only that element — tight crop, no dead space
- On wide screens: card is centered, starfield fills sides (not captured in share)
- On mobile: card fills viewport width with minimal side padding (16px)

### Actions

| Button | Calls |
|--------|-------|
| Draw Again | `engine.returnToQuestionSelect()` |
| Share as Image | `shareAsImage(containerElement)` |
| View History | Opens `HistoryModal` |
| Copy LLM Prompt | `engine.generateLLMPrompt()` → clipboard |

---

## 7. HistoryTiles

Small pill-shaped tiles across the top of `GameTable`, showing the last up to 10 runs.

Each tile shows:
- Method icon (tarot symbol / ⚅ / hexagram symbol)
- Result name truncated to 12 chars
- Affinity indicator (subtle gold glow = order-leaning, purple shimmer = chaos-leaning)
- On hover/tap: expands to show full result name + interaction count

Tiles scroll horizontally on overflow. Current-turn tile has a distinct "active" border.

When an interaction fires, the source tile (where the pending effect came from) glows/flashes — this is the animation origin for the InteractionLayer.

---

## 8. Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/screens/GameTable.tsx` | Hub component, center content router, hosts InteractionLayer + HistoryTiles |
| `src/components/screens/MethodSelect.tsx` | 3 method cards, user picks one |
| `src/components/screens/TarotMinigame.tsx` | Tarot minigame (3 face-down → burn → reversal → reveal) |
| `src/components/screens/DiceMinigame.tsx` | Dice minigame (throw → tumble → result) |
| `src/components/screens/IChingMinigame.tsx` | I Ching minigame (6 coin casts → hexagram) |
| `src/components/screens/ResultReading.tsx` | Merged interpretation + result screen |
| `src/components/overlays/InteractionLayer.tsx` | Interaction animation overlay |
| `src/components/overlays/InteractionAnimations/FoolsRerollAnimation.tsx` | Full Fool's Reroll animation |
| `src/components/overlays/InteractionAnimations/StubAnimations.tsx` | Stub animations for other 4 interactions |
| `src/components/overlays/HistoryTiles.tsx` | Horizontal scrollable past-reading tiles |
| `src/engine/scenarios.ts` | Debug scenario presets |

### Modified Files
| File | Changes |
|------|---------|
| `src/engine/GameEngine.ts` | New turn lifecycle, pending effects, scenario loading, single-result model |
| `src/engine/types.ts` | Updated `Screen`, `GameState`, new `PendingEffect`, `MinigameState` types |
| `src/engine/TurnOrchestrator.ts` | Rename pool→availableMethods, happening gate logic |
| `src/engine/InteractionResolver.ts` | `checkPendingEffects()`, `createPendingEffects()` methods |
| `src/App.tsx` | Replace ScreenRouter with GameTable |
| `src/components/screens/HappeningScene.tsx` | Refactor as center content (remove full-screen styling) |
| `src/components/debug/DebugPanel.tsx` | Scenario presets dropdown, force-trigger button |
| `README.md` | Fix debug URL example, update gameplay flow section |

### Removed Files
| File | Reason |
|------|--------|
| `src/components/screens/DrawPhase.tsx` | Replaced by MethodSelect + minigames |
| `src/components/screens/InteractionOverlay.tsx` | Replaced by InteractionLayer |
| `src/components/screens/Interpretation.tsx` | Merged into ResultReading |
| `src/components/screens/ResultScreen.tsx` | Merged into ResultReading |

---

## 9. Testing Strategy

- Engine tests: Update existing tests for new lifecycle methods (`selectMethod`, `completeMinigame`, pending effect creation/checking)
- New engine tests: `PendingEffect` expiry, deduplication, happening gate logic, scenario loading
- No component tests (consistent with current practice)
- Existing 53 tests must continue to pass after refactor (adjusted for new API surface)

---

## 10. Out of Scope (Future)

- Particle system for Fool's Reroll beyond basic Framer Motion transitions
- Full animations for the other 4 interaction rules
- Advantage/disadvantage dice mechanics (supported by data model, not wired to affinities yet)
- Additional divination methods beyond the current 3
- Method duplication/weighting from affinities (architecture supports it, not implemented)
- Multi-happening runs (balance concern noted, addressed separately)

---

## 11. README Debug URL Fix

The Vite config has `base: '/fate-atlas/'`. The correct debug URL is:

```
http://localhost:5173/fate-atlas/?debug
```

The query parameter `?debug` goes **after** the base path, not before it. The README will be updated to show the full URL including the base path.
