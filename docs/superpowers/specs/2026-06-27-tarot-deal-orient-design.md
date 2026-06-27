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

## Architecture (Approach A — engine pipeline + thin UI hook)

Game logic stays in the engine. The reveal-time mutations ride the existing `InteractionSequencer` + anchored primitives. The **only** new UI flow is the Fate orientation preempt, which inherently must replace the Reveal/Invert buttons.

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
  - `chaos-wild-card` + `order-anchor` → stay on `tarot:orient`, now dispatched **after** consolidation + orientation so they genuinely post-modify. Their reports ride the sequencer (flip / glow primitives, hand-row anchor).
- **`planReveal()`** (new) — called when the hand fills. Runs the Fate preempt roll; returns `{ preempt: boolean, orientation: 'upright' | 'reversed' | null }`. No side effects beyond the roll.
- **`commitDraft(orientation)`** restructured into the pipeline: build faces → dispatch `tarot:deal` (deal-swap; sets `swappedIndex`) → `tarot:committed` → consolidate → apply orientation → dispatch `tarot:orient` (chaos/order post-modify) → `completeMinigame`. The former test-only `resolveTarotDeal` / `resolveSpreadOrientation` become these internal steps.
- **`fate-deal-swap` guard** — its `condition` excludes any face locked by `fate-fated-card` this draft (a locked card "is not yours to refuse," and equally not Fate's to swap away).
- **Remove the dead `setOrientation()` stub** (the Reveal/Invert choice + Fate preempt fully cover orientation). Will is still fed by the player's Invert action as today.
- Engine purity preserved: no React/DOM in `src/engine/**`. The component reads `planReveal()`'s result and decides whether to render the god-hand.

### Animations

- **Burn-reveal primitive (new)** for `fate-deal-swap`. An `AnchoredStage`-based primitive over the swapped hand slot: a card-shaped sheath of the rejected card immolates — an ember edge eats irregular holes outward via an animated alpha **mask** (canvas or SVG mask, no new deps), with ember/smoke particles from `ParticleField` (`shard` + `rising`, warm Fate-gold→ember palette) — revealing the real card underneath. Replaces the Override card-slide for this effect.
- **God-hand for `fate-auto-orient`.** Generalize the existing `FateForceOverlay` into a reusable god-hand overlay parameterized by **target** (method tile / hand row / card) and **gesture** (point / turn / grasp). Auto-orient uses the "turn the hand row" gesture. This generalization also sets up TODO #5 (out of scope here).
- **Chaos wild-card** → existing **Flip** primitive on the rogue face. **Order anchor** → existing **Glow** (order lattice) over the spread. Both hand-row anchored.

The only genuinely new art is the burn-reveal primitive.

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
- **Visual (no component harness):** the headless Playwright probe recipe (`?debug` + `window.__engine` + report injection) — burn-reveal on the swapped slot, god-hand on the auto-orient preempt, Flip/Glow for chaos/order on the spread.
- **Manual:** a high-Fate tarot reading confirming preempt → buttons suppressed → god-hand → commit, plus a deal-swap burn.

## Documentation to keep in sync (per CLAUDE.md)

- `docs/game-systems.md` — the responder tables (deal/orient rows, triggers, tiers/bands, animations) and the Fate/Chaos/Order agency narrative; note that deal/orient now fire live and the retuned odds.
- README — if it describes the tarot reveal/commit flow or the orientation choice.

## Open risks

- **Timing of multiple reveal effects.** A reading could queue deal-swap + a post-modifier + commit effects. The sequencer already plays a queue in order; the implementation must verify the deferred-transition (`runOrDefer`) timing holds across the longer pipeline and that the hand-row faces are mounted when each animation anchors.
- **God-hand generalization scope.** Parameterizing `FateForceOverlay` must not regress the existing fate-force-method presentation.
