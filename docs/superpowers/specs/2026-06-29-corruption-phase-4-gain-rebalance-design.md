# Corruption Phase 4 — Gain-Pipeline Rebalance Design Spec

- **Date:** 2026-06-29
- **Status:** Design approved, pending implementation plan
- **Builds on:** the corruption mechanic (Phases 1–3). This is the §14 rebalance the whole corruption design was predicated on.
- **Scope:** Loosen the affinity-gain throttles that exist *only* to fight runaway hoarding, now that **corruption** polices excess instead of friction. Three tuning constants change; the bulk of the work is **recomputing the value-pinned tests**. Engine-only, no UI.
- **Out of scope:** Phase 3 presentation (its own spec); any change to corruption's own constants; opposite-axis coupling (deliberately preserved). To be implemented **together with Phase 3** after both specs + plans are approved.

## 1. Goal & rationale

Players hoard a few affinities to max. The pre-corruption throttles (coupling fan-out, diminishing returns, run-drift) only *slowed* accumulation and made committing to a force feel self-defeating. With corruption now providing a real corrective force (it erodes the hoard and ruptures at the pinnacle), these throttles can be **loosened** so that:

> **Affinities become rewarding to build; corruption — not friction — polices excess.**

## 2. The gain pipeline (what we're touching)

`AffinityEngine.shift()` ([src/engine/AffinityEngine.ts:190-216](../../src/engine/AffinityEngine.ts#L190-L216)):

```
gain = baseDelta × DR × jitter           // DR = max(DR_FLOOR, 1 − DR_STEP × feedsThisRun[id])
base[id]   += gain
base[opp]  -= gain × COUPLING_OPPOSITE    // opposite axis
base[other]-= gain × COUPLING_OTHER       // each of the other four
```

`beginRun()` drifts every affinity toward baseline by `RUN_DRIFT` each run. All constants live in [src/data/affinities.ts](../../src/data/affinities.ts).

## 3. The changes

| Constant | Now | New | Effect |
|----------|-----|-----|--------|
| `COUPLING_OTHER` | 0.15 | **0.09** | Building one affinity drains the other four by 0.36× total (was 0.6×) — committing to a force no longer guts the rest. |
| `DR_FLOOR` | 0.5 | **0.67** | Sustained same-run feeds floor at 67% instead of 50% — stacking a theme stays rewarding. |
| `RUN_DRIFT` | 0.12 | **0.08** | Highs erode toward 50 more slowly across runs (an 80 → ~77.6/run, was ~76.4) — gains persist, but still decay. |
| `COUPLING_OPPOSITE` | 0.35 | **0.35** (unchanged) | Opposites suppressing each other (chaos↔order) is core thematic identity, not anti-hoard friction. |

`DR_STEP` (0.05), `REACH_UP_CHANCE`, `JITTER_*`, and all feed amounts are unchanged. These are **playtest defaults** — tunable, but they are the values the tests are recomputed against.

## 4. Balance invariant (non-negotiable)

**The starve lever must remain viable** — the player must still be able to drive `corruptionFood` to 0 (drop every affinity below `HIGH_THRESHOLD = 81`) so corruption decays and vanishes. `COUPLING_OTHER` and `RUN_DRIFT` are *dual-purpose* (anti-hoard friction **and** part of how the hoard comes down), so they are softened only **moderately**, not removed. The starve lever survives on three legs:

1. **Opposite-coupling (0.35, unchanged)** still pulls the paired axis down hard when you build.
2. **Residual run-drift (0.08)** still erodes highs over runs.
3. **Corruption's own erosion** (`DRAIN_RATE`, Phase 1) actively bleeds the hoard down as corruption grows.

These three together must keep food→0 reachable. If playtest shows the hoard has become un-starvable (corruption can't be fought off short of the Rupture), the fix is to walk these values back toward the originals — corruption-side constants are **not** changed here.

## 5. The real work — recomputing value-pinned tests

The engine change is three numbers; the effort is updating the tests that hard-code the old constants in both assertions **and** their arithmetic comments. These must be recomputed against `COUPLING_OTHER=0.09`, `DR_FLOOR=0.67`, `RUN_DRIFT=0.08`:

- **[src/engine/__tests__/AffinityShift.test.ts](../../src/engine/__tests__/AffinityShift.test.ts):**
  - `:63` "a gain applies coupling: opposite −0.35g, others **−0.15g**" — the `others` expectations (e.g. `fate` 49) and the test title recompute against 0.09.
  - `:75-84` diminishing-returns floor test — the "floor at 0.5" expectations recompute against 0.67.
  - `:139-144` "beginRun drifts **12%** toward 50" — recompute against 0.08 (e.g. `chaos` 76 / `order` 24 change), update the title.
  - Any other `0.15` / `0.5` / `0.12` literals and arithmetic comments in this file.
- **[src/engine/__tests__/GameEngine.test.ts](../../src/engine/__tests__/GameEngine.test.ts):**
  - `:369-409` and `:424-430` step-by-step coupling/coherence arithmetic (the `Order=58` / `Chaos=58` / `Order=55` expectations and their multi-line comments currently citing "COUPLING_OTHER=0.15, DR_FLOOR=0.5") recompute against the new constants; update the comments so they document the new math.

**Approach:** change the three constants first (RED — these tests now fail), then recompute each pinned expectation by hand from the documented arithmetic, updating both the literal and its comment, until green. The comments are part of the deliverable: a future reader must be able to re-derive the number.

## 6. Integration points & files

- **Modify:** [src/data/affinities.ts](../../src/data/affinities.ts) — `COUPLING_OTHER`, `DR_FLOOR`, `RUN_DRIFT`.
- **Recompute:** `AffinityShift.test.ts`, `GameEngine.test.ts` (above). A full `npm test` must pass.
- No changes to `AffinityEngine.ts` logic, corruption constants, or any component.

## 7. Docs to keep in sync

Per `CLAUDE.md`: update the affinity tuning values wherever documented — `docs/game-systems.md` (affinity bands/feeds/tuning section) and any README table listing coupling/DR/drift — in the same change.

## 8. Testing considerations

- After the change, `npm test` passes with recomputed expectations.
- No new randomness paths; existing `Math.random` stubs in the affected tests stay valid (only the multiplied-through values change).
- Optional sanity check (manual or a small added test): from a maxed hoard with no further feeds, confirm affinities trend downward over successive `beginRun`s + corruption erosion — i.e. the starve lever still bottoms out food. Documented as a playtest check, not a hard unit assertion (it spans both engines).
