# Tarot Deal & Orient — Design Spec

**Status:** Approved design, ready for implementation planning.
**Date:** 2026-06-27

## Problem

The `tarot:deal` and `tarot:orient` dispatch triggers are **never reached in live gameplay**. They are dispatched only by `GameEngine.resolveTarotDeal()` / `resolveSpreadOrientation()`, which are referenced only in tests. The live commit path is `TarotMinigame.commitDraft()` → `tarot:committed` → `completeMinigame()` → `tarot:commit`, which never fires deal/orient.

As a result these designed-and-documented affinity-agency effects can never happen for a player:

- `fate-deal-swap` (`tarot:deal`) — Fate swaps one dealt card before reveal.
- `fate-auto-orient` (`tarot:orient`) — Fate decides the spread-wide orientation.
- `chaos-wild-card` (`tarot:orient`) — Chaos flips one face rogue.
- `order-anchor` (`tarot:orient`) — Order straightens every face upright.

A vestigial `setOrientation()` stub (feeds Will only; param unused) also exists.

This spec wires these effects into the live tarot reveal flow, gives `fate-deal-swap` a bespoke burn-reveal animation, generalizes the god-hand overlay for `fate-auto-orient`, and retunes the Fate card-substitution odds.

## Goals

- Make deal and orient actually fire in live play, with clear animations on the real cards.
- Establish the reveal as an ordered pipeline with a coherent agency model.
- Keep `fate-deal-swap` and `fate-fated-card` as **independent** effects (both can fire in a reading) but lower their combined rate to ≈ `fate-force-method` (~8%).
- Reuse the anchored-primitive animation system and the existing god-hand overlay; the only new art is a burn-reveal primitive.

## Non-goals

- TODO #5 (give `fate-fated-card` the god-hand + ChainsOfFate redesign) — *enabled* by the god-hand generalization here but implemented separately.
- Any change to the drafting interactions (pick/peek/return/shuffle/swap) or to `tarot:commit` spread interactions.
- A new per-card orientation UI. The Reveal-as-Drawn / Invert-Meaning choice (and Fate's preempt of it) remains the orientation mechanism.

## Architecture (Approach A — engine pipeline + inline reveal choreography)

Game logic stays in the engine. The reveal-time mutations are **narrated inline by `TarotMinigame`** during the `committing` phase, mirroring how `DiceMinigame` consumes `planDiceRoll`/roll-mode — *not* via the `InteractionSequencer`. This is a deliberate refinement of the original "ride the sequencer" sketch: the deal-swap must render swapped card **content** (the original card burning to reveal the real card underneath), the effects are per-hand-slot, and they must be timed against the existing inline face-flip reveal — none of which the sequencer's anchored overlay primitives can do. The post-commit `tarot:commit` fan effects continue to use the sequencer unchanged. Engine rolls happen at commit (resolve-first), and the component reads the recorded outcome to narrate (narrate-second).

### Reveal pipeline (order of operations)

When the hand is full:

1. **Fate orientation preempt** — `fate-auto-orient` (OVERRIDE). Checked first via `planReveal()`. If it fires, Fate seizes the choice: the Reveal/Invert buttons are suppressed, the **god-hand** overlay plays over the hand row, and Fate sets the spread-wide orientation (coin-flip). If it does not fire, the player chooses Reveal-as-Drawn / Invert-Meaning as today.
2. **Deal-swap** — `fate-deal-swap` (OVERRIDE). One **non-fated** face is replaced by a fresh distinct draw (`swappedIndex` recorded); that card **burns away to reveal the real card underneath**. Never targets a `fate-fated-card`-locked face.
3. **Apply spread orientation** — the decided orientation (player's or Fate's) is set on the consolidated spread.
4. **Order/Chaos post-modifiers** — `order-anchor` (MUTATE) straightens every face upright; `chaos-wild-card` (MUTATE) flips one face rogue. They animate on the affected card(s).
5. **Reveal + commit** — faces flip face-up in the Past/Present/Future hand row; then the existing `tarot:commit` effects (spread interactions, chaos-second-result, etc.) play on the committed fan card.

Steps 2–4 anchor to the **hand-slots row** (`outcome`, already registered and mounted during the `committing` phase). Step 5's commit effects anchor to the committed fan card (existing Task 1 behavior).

### Engine changes

- **Split the orient responders by timing.**
  - `fate-auto-orient` → moves to a **preempt** check run before the orientation choice. Rewired to set a `fateOrientation` decision (coin-flip) rather than reversing an already-consolidated spread. Drives the god-hand (component overlay) — does **not** emit a sequencer report.
  - `chaos-wild-card` + `order-anchor` → stay on `tarot:orient`, now dispatched **after** consolidation + orientation so they genuinely post-modify. `commitDraft` records which face flipped / that the spread was straightened onto the draft for the component to animate inline.
- **`planReveal()`** (new) — called when the hand fills. Runs the Fate preempt roll; returns `{ preempt: boolean, orientation: 'upright' | 'reversed' | null }`. No side effects beyond the roll.
- **`commitDraft(orientation)`** restructured into the pipeline: build faces → dispatch `tarot:deal` (deal-swap; sets `swappedIndex`) → `tarot:committed` → consolidate → apply orientation → dispatch `tarot:orient` (chaos/order post-modify) → `completeMinigame`. The former test-only `resolveTarotDeal` / `resolveSpreadOrientation` become these internal steps.
- **`fate-deal-swap` guard** — its `condition` excludes any face locked by `fate-fated-card` this draft (a locked card "is not yours to refuse," and equally not Fate's to swap away).
- **Remove the dead `setOrientation()` stub** (the Reveal/Invert choice + Fate preempt fully cover orientation). Will is still fed by the player's Invert action as today.
- Engine purity preserved: no React/DOM in `src/engine/**`. The component reads `planReveal()`'s result and decides whether to render the god-hand.

### Animations (inline in `TarotMinigame`'s reveal choreography)

`commitDraft` records the reveal outcome on the draft (`revealSwap`, `revealWildCard`, `revealOrderAnchored`, `revealOrientation`); the component reads these in the `committing` phase and animates the affected hand slot(s) as the faces turn up.

- **Burn-reveal (new component)** for `fate-deal-swap`. Over the swapped hand slot the original (rejected) card face is rendered and immolates — an ember edge eats irregular holes outward via an animated alpha **mask** (CSS/SVG mask, no new deps), with ember/smoke particles — revealing the real committed card underneath.
- **God-hand for `fate-auto-orient`.** Reuse the existing `FateForceOverlay` with a hand-row `HandTarget` + auto-orient text (the same component MethodSelect uses for fate-force-method). A richer gesture/parameterization is optional; full generalization (and TODO #5's fated-card god-hand) is out of scope here.
- **Chaos wild-card** → an inline single-face flip on the rogue slot. **Order anchor** → an inline upright-straighten + brief order glow across the row.

The only genuinely new art is the burn-reveal component.

## Odds tuning

Introduce a low base chance `rare ≈ 0.04` for Fate's card-substitution effects so the two stay independent but their combined per-reading rate lands near `fate-force-method` (~8%):

| Effect | Now | Proposed | Per-reading |
|---|---|---|---|
| `fate-deal-swap` | `major` 0.08, one roll at reveal | `rare` ~0.04, one roll at reveal | ~4% |
| `fate-fated-card` | `notable` 0.22, rolled each of ≤3 picks (~53%) | per-pick ~0.014, still one per draft | ~4% |
| **Combined (either)** | ~57% | — | **~8%** |

- **`fate-auto-orient`** (now *seizes* the player's orientation choice): raise the gate from `stirring` to **`ascendant`** and set ~`major` (0.08) — a notable high-Fate event (~1 in 12), not routine. The player's choice stays the default.
- `chaos-wild-card` / `order-anchor` (flavor mutations, not agency removal) keep their current `ascendant` / `notable` (0.22) gates.

Exact constants are tunable in playtest; the targets above are the design intent.

## Testing

- **Engine (Vitest, the only harness):**
  - `planReveal` — preempt fires/doesn't per Fate band; returns the correct orientation; no side effects beyond the roll.
  - `commitDraft` pipeline — deal-swap replaces a **non-fated** face and sets `swappedIndex`; refuses to target a fated card; `chaos-wild-card` flips exactly one face *after* orientation is applied; `order-anchor` straightens all; pipeline ordering is deterministic.
  - Probability gates verified with stubbed `Math.random` (deal-swap ~0.04, fated per-pick ~0.014, auto-orient `ascendant` ~0.08).
  - Regression: update existing `AgencyDecisions` / `Tarot` tests for the new `commitDraft` signature + split orient triggers; the 518-test suite stays green.
- **Visual (no component harness):** the headless Playwright probe recipe (`?debug` + `window.__engine` + `loadState` to stage a `committing`-phase draft with reveal markers) — burn-reveal on the swapped slot, god-hand on the auto-orient preempt, the chaos flip / order straighten on the row.
- **Manual:** a high-Fate tarot reading confirming preempt → buttons suppressed → god-hand → commit, plus a deal-swap burn.

## Documentation to keep in sync (per CLAUDE.md)

- `docs/game-systems.md` — the responder tables (deal/orient rows, triggers, tiers/bands, animations) and the Fate/Chaos/Order agency narrative; note that deal/orient now fire live and the retuned odds.
- README — if it describes the tarot reveal/commit flow or the orientation choice.

## Open risks

- **Timing of multiple reveal effects.** A reading could combine a deal-swap, a post-modifier, *and* the post-commit `tarot:commit` fan effects. The inline reveal choreography (burn/flip/glow in the hand row) must finish before, and not fight with, the deferred sequencer batch that narrates the fan effects. Sequence the inline reveal first, then let the existing `runOrDefer`/review-beat flow run the fan batch.
- **God-hand generalization scope.** Parameterizing `FateForceOverlay` must not regress the existing fate-force-method presentation.
