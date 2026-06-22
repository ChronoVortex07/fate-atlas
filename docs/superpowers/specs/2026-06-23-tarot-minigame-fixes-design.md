# Tarot Minigame Fixes — Design Spec

**Date:** 2026-06-23
**Status:** Spec 1 of 2. This spec covers the **functional fixes**. A
follow-up spec (`tarot-visual-redesign`) will cover the **visual redesign** —
the systematic card-sigil icon system and broader tarot UI polish — brainstormed
separately with visual tooling.

## Motivation

A review of the new tarot draft minigame surfaced three problems:

1. **Hover fan-out fights the player.** Cards are pushed *directly away from the
   cursor*, so the card you aim at flees the pointer — the opposite of "fan apart
   so one is easy to pick."
2. **No time to read the cards after commit.** After the spread commits, the
   screen advances to the next method-select (or result) immediately — and when
   meta-interactions trigger, the sequencer drains them and auto-advances. The
   player never gets to study the revealed Past/Present/Future.
3. **Results are almost always "balanced," and balance says nothing.** Readings
   that contain a 3-card tarot spread wash out to a neutral verdict, and the
   synthesis then just re-lists the cards — twice (the same spread appears under
   multiple modifier-role frames).

---

## Part 1 — Hover fan-out: expand-the-local-cluster model

**Current behavior** ([TarotMinigame.tsx:171-182](../../../src/components/screens/TarotMinigame.tsx#L171-L182)):
each card's displacement is `offsetX = sign(cardCenter − cursorX) · MAX_FAN_OFFSET · t`,
where `t = 1 − dist/FAN_RADIUS`. Every card is shoved away from the cursor point,
so the target card moves off the pointer.

**New behavior:** the cluster of cards near the cursor *breathes open* — the gaps
between adjacent cards widen most where they are nearest the cursor, so a gap
forms around the pointer and the card under it stays put and becomes easy to
click. Card order is always preserved.

### 1.1 Pure layout function

Extract a framework-free pure function (no React/DOM), colocated with the
component:

```typescript
interface FanParams {
  radius: number;            // falloff width in px (proximity gate)
  maxGapExpansion: number;   // max extra px added to a single gap (the "max repel distance")
}

// cardCenters: each card's default x-center in container coords, ascending.
// Returns the signed x-delta to apply to each card.
function computeFanOffsets(
  cardCenters: number[],
  cursorX: number,
  { radius, maxGapExpansion }: FanParams,
): number[];
```

**Algorithm (gap-expansion, integrated from the cursor outward):**

1. For each adjacent pair `(i, i+1)`, take the gap midpoint
   `m = (center[i] + center[i+1]) / 2` and compute an expansion
   `e_i = maxGapExpansion · falloff(|m − cursorX| / radius)`, where
   `falloff(u) = exp(−3·u²)` for `u ≤ 1`, else `0` (smooth Gaussian, zero beyond
   the radius — this enforces the maximum repel distance).
2. Each card's offset is the signed sum of the expansions of the gaps lying
   between it and the cursor:
   - card right of cursor → `offset = +Σ e_g` for gaps between cursor and card;
   - card left of cursor → `offset = −Σ e_g` for gaps between card and cursor.
3. Re-center: subtract the mean offset so the cluster's center of mass stays put
   (prevents drift off-screen).

This guarantees: order preserved; the card nearest the cursor barely moves (few,
small intervening gaps); displacement bounded (only gaps within `radius`
contribute, each `≤ maxGapExpansion`); smooth return to rest when `falloff → 0`.

Suggested starting params: `radius ≈ 140`, `maxGapExpansion ≈ 26`. Tune by
running the app.

### 1.2 Component wiring

- `fanDisplacements` (useMemo) calls `computeFanOffsets` with the cards' default
  centers and `fan.centerX`, replacing the inline repel math.
- Keep a small `scale` bump on the card nearest the cursor.
- Fix `cardIndexZ`: raise the z-index of cards nearest the cursor (currently it
  returns natural order and the comment admits it can't tell distance) so the
  opened-up card layers above its neighbors and is clickable.
- Mobile tap-to-fan reuses the same function with the tap point as `cursorX`
  (unchanged otherwise).

### 1.3 Testing

Pure-math verification by running the dev server and confirming the cluster opens
*around* the cursor with the targeted card stationary. (No automated test — the
repo's Vitest config runs engine tests only and there are no component tests; the
function is small and pure.)

---

## Part 2 — Click-to-continue after every minigame

After a minigame commits and any meta-interactions narrate, hold on a review beat
showing the committed result; advance only on an explicit **Continue** click.
Applies to all three minigame types.

### 2.1 Engine changes ([GameEngine.ts](../../../src/engine/GameEngine.ts))

- Add `awaitingContinue: boolean` to `GameState` (resets to `false` in
  `startTurn`, `reset`, `returnToTitle`, `returnToQuestionSelect`; it is
  turn-scoped, not carryover).
- In `completeMinigame`, the existing `runOrDefer(() => this.advanceAfterCommit(...))`
  call is replaced by a gate: once the event batch has drained (or immediately if
  none was queued), set `awaitingContinue = true` and `notify()` **instead of**
  advancing. Concretely, wrap the advance so the deferred work is "show the review
  beat," and store the real advance as the pending action.
- New method `continueAfterReview()`: guards on `awaitingContinue`, clears it, and
  runs the stored advance (`advanceAfterCommit` → method-select / happening /
  result). Ends with `notify()`.
- **Final minigame:** when `completed >= minigamesPerTurn`, the advance goes to
  the Result page, which already affords unlimited viewing — so the gate is
  **skipped** for the final commit (no redundant double-review). The gate applies
  to the 1→2 and 2→3 transitions, including before an interrupting happening.

### 2.2 Component changes

- `GameTable` renders a shared **Continue** affordance when
  `state.screen === 'minigame' && state.awaitingContinue`, calling
  `engine.continueAfterReview()`. While awaiting, the tableau pointer-events
  stay enabled for the Continue control.
- The minigame components remain mounted on their committed/revealed view during
  the gate:
  - `TarotMinigame` already has `phase === 'committing'` ("The cards are cast"); it
    must render the **face-up Past/Present/Future** during the gate rather than an
    empty/transitional state.
  - `DiceMinigame` and `IChingMinigame` must hold their revealed result on screen
    while `awaitingContinue` (small tweak — keep the result visible instead of
    immediately appearing "done").

---

## Part 3 — Results rework

Three coordinated changes so balanced readings are both rarer and informative.

### 3a. Fix the aggregation math ([ReadingPlanner.ts](../../../src/engine/ReadingPlanner.ts))

**Root cause:** `aggregate()` averages each result's `dimensions`, but a 3-card
tarot spread is *already* an average of 3 cards — so a spread washes to ~0, then
gets averaged again with the die. Favorability lands in the wide neutral band
(`−0.9 < v < 1.0`) nearly every time.

**Changes:**

1. **Atomic-signal expansion.** Add a private method that flattens results into
   *atomic signals* for dimension profiling: each die, each hexagram, and each
   **individual** `TarotCardFace` in a spread (each carries its own `themes` and
   `dimensions`). Profile dimensions over atomic signals, not over pre-averaged
   consolidated spreads. This removes the double-average.
2. **Magnitude-weighted favorability.** Weight each atomic signal's favorability
   by its own magnitude so strong pulls dominate instead of cancelling to zero.
   (Certainty/volatility keep the existing primary-role weighting, now over atomic
   signals.) Keep the `[−2, 2]`, 0.5-granularity rounding.
3. Modifier assignment and theme ranking continue to operate over the
   **consolidated** results (modifier roles live on the result, not the card) — no
   change there beyond 3c.

### 3b. Surface opposing forces

Add to `AggregatedReading` (in [types.ts](../../../src/engine/types.ts)):

```typescript
strongestFavor: { label: string; value: number } | null;   // highest +favorability atomic signal
strongestAdverse: { label: string; value: number } | null; // lowest −favorability atomic signal
```

`aggregate()` populates these from the atomic signals. `label` is a short human
name: `"the {name} ({orientation})"` for a tarot card, `"the dice ({result})"`
for a die, `"Hexagram {n}"` for a hexagram.

In `NarrativeAssembler`, when the net favorability is neutral **but** the poles
are strong and opposed (`strongestFavor.value ≥ +1` and
`strongestAdverse.value ≤ −1`), emit a tension paragraph that *names* them, e.g.
"The Ace of Cups pulls toward fortune while the reversed Nine of Wands drags
against it — the balance you feel is a contest, not a calm." This replaces the
"nothing is happening" reading of balance. It also lets variance-based tension
(today `tensionPair: null`, [ReadingPlanner.ts:216](../../../src/engine/ReadingPlanner.ts#L216))
name its actual poles.

### 3c. Per-position insight + de-dupe

- **Per-position line.** For each tarot spread, `NarrativeAssembler` emits one
  compact line derived from each card's dominant theme + favorability sign, e.g.
  "Past leans renewal · Present holds steady · Future turns adverse." Keeps a
  balanced whole legible internally. (The Result page already renders the
  per-position sub-cards; this is the *prose* counterpart.)
- **De-dupe modifier frames.** Today a tarot result assigned to multiple modifier
  roles is described in full under each frame, producing the repeated spread
  listing seen in the sample output. Fix: assign each result to **exactly one**
  modifier role for narration (its strongest role by `sumAbsDimensions`), so the
  subject/action/effect frames describe **disjoint** sets. Multi-role data is
  retained for analysis; only the prose is de-duplicated.

### 3d. Narrower, symmetric favorability band

In `NarrativeAssembler`, change `getFavorabilityBand` thresholds from
(`high ≥ 1.0`, `low ≤ −0.9`) to a symmetric, narrower band (`high ≥ +0.5`,
`low ≤ −0.5`; neutral only in `(−0.5, 0.5)`), so readings reach a real verdict
more often. Also fix the headline path
([NarrativeAssembler.ts:189-197](../../../src/engine/NarrativeAssembler.ts#L189-L197)),
which keys on `${dominantTheme}_${favBand}` and currently lands on neutral almost
always.

---

## Files affected

| File | Change |
|------|--------|
| `src/components/screens/TarotMinigame.tsx` | Replace repel math with `computeFanOffsets`; fix `cardIndexZ`; render face-up spread during the continue gate |
| `src/components/screens/DiceMinigame.tsx` | Hold revealed result on screen during the continue gate |
| `src/components/screens/IChingMinigame.tsx` | Hold revealed result on screen during the continue gate |
| `src/components/screens/GameTable.tsx` | Render shared Continue control when `awaitingContinue` |
| `src/engine/GameEngine.ts` | `awaitingContinue` gating; `continueAfterReview()`; skip gate on final commit |
| `src/engine/types.ts` | Add `GameState.awaitingContinue`; `AggregatedReading.strongestFavor/strongestAdverse` |
| `src/engine/ReadingPlanner.ts` | Atomic-signal expansion; magnitude-weighted favorability; populate opposing forces |
| `src/engine/NarrativeAssembler.ts` | Narrower symmetric band; opposing-forces paragraph; per-position line; de-dupe modifier frames |
| `src/engine/__tests__/` | Aggregation tests (no double-average, opposing forces); synthesis tests (de-dupe, balanced-but-tense, per-position); continue-gate flow test |
| `docs/game-systems.md` / `README.md` | Sync the synthesis/results description and note the continue gate |

## Out of scope (deferred to Spec #2)

- The systematic card-sigil icon system (22 bespoke majors + composed minors)
  replacing emoji `symbol` usage.
- Broader tarot UI visual polish / added visual elements.

## Open decisions (resolved as defaults — flag on review if wrong)

1. Final minigame advances straight to the Result page (no separate continue
   beat), since the Result page already affords unlimited viewing.
2. Fan math is a pure function verified by running the app, not a unit test
   (consistent with the repo having no component tests).
