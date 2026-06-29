# Corruption — Seed Visibility & Spawn-Odds Design Spec

- **Date:** 2026-06-29
- **Status:** Design approved, pending implementation plan
- **Builds on:** the corruption mechanic (Phases 1–4). The seed/lifecycle, glitch presentation, and gain rebalance already exist; this fills three gaps left around the *silent seeded band*.
- **Scope:** Three small, independent pieces — (1) a divination-flavored omen that makes the otherwise-silent `seeded` band perceptible in-world, (2) corruption observability + controls in the debug panel, (3) a hybrid rebalance of the seed *spawn* chance. Touches one data file, the engine synthesis path, and the debug component.
- **Out of scope:** any change to corruption *growth/drain/decay* rates once seeded (`EROSION_RATE`, `SKIM_RATE`, `DRAIN_RATE`, `DECAY_RATE`); the existing spreading+ glitch presentation; intrusion/rupture behavior; affinity coupling.

## 1. Goal & rationale

The corruption seed spawns at value `5` — the `seeded` band (1–34) — where the design is deliberately silent: [`isVisibleCorruption`](../../src/data/corruption.ts#L84-L86) is false until `spreading`, [`corruptionTextLevel`](../../src/engine/CorruptionGlitch.ts#L5-L12) returns `0` ("gestation"), and the only tell — the [Light warning](../../src/engine/GameEngine.ts#L132-L156) — fires *only* when Light is already Ascendant+. So a non-Light hoarder who seeds corruption gets **no signal at all**, and there is **no way to observe corruption in debug**. Combined, this made a near-certain seed (≈25% capped per reading at full hoard) look like it "never triggered."

Three goals:

> **(1)** A veteran-recognizable, newcomer-innocuous in-world tell that the seed has been planted.
> **(2)** Corruption is observable and forceable from the debug panel.
> **(3)** Broad imbalance (many high affinities) courts the seed far more aggressively than a single spike.

## 2. Part 1 — The seed omen (divination-flavored, every reading while seeded)

A fixed in-world line woven into the reading synthesis whenever the corruption band is **`seeded`**. It reads as closing divination flavor to the clueless; veterans recognize the recurring *theme* (a seventh, uncounted presence — the predator that "was here before the stars" and "counts" you, per the existing `INTRUSION_PHRASES`).

### 2.1 Behavior

- **Trigger:** every completed reading while `corruptionEngine.getBand() === 'seeded'` (value 1–34). Recurs each reading; stops automatically when corruption decays back to `dormant` (silent) or grows into `spreading` (where the existing glitch presentation takes over).
- **Content:** a small pool of 3 thematically-unified lines, one chosen per reading via `Math.random` (chosen over a single verbatim line so it reads as organic flavor rather than a flagged refrain, while the shared theme preserves the veteran tell). Playtest defaults:
  - `"Something uncounted leans in to listen."`
  - `"A seventh shadow settles at the table you set for six."`
  - `"The reading holds its breath, as if it were read in turn."`
- **Presentation:** clean prose — **not** the glitch system. No typos/combining-marks/redaction at `seeded`. The omen is appended as a final entry in `SynthesisResult.paragraphs`.

### 2.2 Integration point

In [`synthesizeAll`](../../src/engine/GameEngine.ts#L710-L732), today the post-assemble branch only mutates text when `corruptionTextLevel > 0` (spreading+). Add a sibling branch:

```
band = corruptionEngine.getBand()
if (band === 'seeded') synthesis = appendOmen(synthesis, rng)   // clean omen line
else if (cLevel > 0)   synthesis = corruptSynthesis(synthesis, cLevel, rng)  // existing glitch path
```

`seeded` and `cLevel > 0` are mutually exclusive by construction (`corruptionTextLevel` is `0` at `seeded`), so the omen and the glitch presentation never co-occur. The omen helper (pool + selection) lives alongside the other text helpers in [`CorruptionGlitch.ts`](../../src/engine/CorruptionGlitch.ts) (e.g. `seedOmen(rng)` returning a line, or `appendOmen(synthesis, rng)`), keeping presentation strings out of the engine façade and injectable `rng` for tests. The pool is exported so a test can assert membership.

## 3. Part 2 — Corruption in the debug panel

[`DebugPanel.tsx`](../../src/components/debug/DebugPanel.tsx) currently has **zero** corruption references. Add a small, purely-additive section:

- **Readout (live):** current value (rounded, via `state.corruption.value`) and band label (`state.corruption.band`). Optionally the read-only `hasIntruded` flag (gates the guaranteed intrusion) via `corruptionEngineForTest().getHasIntruded()`.
- **Setter:** a number input / slider (0–100) wired to the existing [`setCorruption`](../../src/engine/GameEngine.ts#L675-L676), plus quick band-jump buttons — **Clear (0)**, **Seed**, **Spreading**, **Virulent**, **Pinnacle** — setting representative values for each band (e.g. 5 / 50 / 80 / 100, choosing values inside each band per [`corruptionBandOf`](../../src/data/corruption.ts#L30-L36)).
- After any setter call the panel must reflect the new value — `setCorruption` already runs through the engine; ensure it (or the panel action) triggers `notify()` so `state.corruption` updates and the readout re-renders. If `setCorruption` does not currently `notify()`, add the notify (it is a debug-only mutator; surfacing it is the whole point).

No engine *logic* changes beyond ensuring the setter surfaces via `notify()`.

## 4. Part 3 — Hybrid seed-odds rebalance (count gates, excess fills)

Replace [`seedChance`](../../src/data/corruption.ts#L39-L42). Today it is linear in total excess and capped low:

```
seedChance(food) = min(0.25, food × 0.004)
```

New shape — **count of high affinities** gates an exponential multiplier; **total excess** fills the magnitude:

```
highCount = # affinities with value > HIGH_THRESHOLD        // 0–6
seedChance = highCount === 0 ? 0
           : min(CAP, SEED_FOOD_FACTOR × food × GROWTH^(highCount − 1))
```

The signature changes: seed chance now needs both `food` and `highCount` (or the raw affinity vector). Cleanest is a single function `seedChance(affinities)` that computes `food` and `highCount` internally; `CorruptionEngine.tick` already holds the affinity vector and the `food` value, so update the call site in [`CorruptionEngine.tick`](../../src/engine/CorruptionEngine.ts#L46-L49) accordingly (a `highAffinityCount(affinities)` helper mirrors the existing `corruptionFood`).

### 4.1 Constants (playtest defaults)

| Constant | Now | New | Note |
|---|---|---|---|
| `SEED_FOOD_FACTOR` | 0.004 | **0.004** (unchanged) | per-excess fill |
| `SEED_MAX_CHANCE` (`CAP`) | 0.25 | **0.85** | raised so a full hoard can dominate (never a flat 1.0 — a seed is never *guaranteed*) |
| `SEED_COUNT_GROWTH` (`GROWTH`) | — (new) | **1.7** | exponential per additional high affinity |

### 4.2 Resulting curve

| State | food | highCount | chance/reading |
|---|---|---|---|
| one affinity @100 | 19 | 1 | ~8% |
| two @100 | 38 | 2 | ~26% |
| three @100 | 57 | 3 | ~66% |
| four–six @100 | 76–114 | 4–6 | ~85% (cap) |
| six barely over (~84) | 18 | 6 | ~85% (cap) |

Key behavior: **breadth of imbalance dominates** — six affinities just over the line is as damning as several maxed, while a single spike stays rare. A full-hoard playtest now seeds at ~85%/reading (near-certain within a game). These are tunable playtest defaults; they are the values the tests are pinned against.

## 5. Integration points & files

- **Modify** [`src/data/corruption.ts`](../../src/data/corruption.ts): raise `SEED_MAX_CHANCE` (the `CAP`) to 0.85, add `SEED_COUNT_GROWTH` (the `GROWTH`) = 1.7, add `highAffinityCount(affinities)`, rewrite `seedChance` to the hybrid form (`CAP`/`GROWTH` in §4 are these constants, not new names). Add the omen pool constant **here or** in `CorruptionGlitch.ts` (presentation strings — prefer `CorruptionGlitch.ts` to keep `corruption.ts` tuning-only).
- **Modify** [`src/engine/CorruptionGlitch.ts`](../../src/engine/CorruptionGlitch.ts): add the omen helper + exported pool.
- **Modify** [`src/engine/CorruptionEngine.ts`](../../src/engine/CorruptionEngine.ts): update the `seedChance(...)` call in `tick` to the new signature.
- **Modify** [`src/engine/GameEngine.ts`](../../src/engine/GameEngine.ts): add the `seeded`-band omen branch in `synthesizeAll`; ensure `setCorruption` surfaces via `notify()`.
- **Modify** [`src/components/debug/DebugPanel.tsx`](../../src/components/debug/DebugPanel.tsx): corruption readout + setter section.

## 6. Docs to keep in sync

Per `CLAUDE.md`, corruption behavior is documented authoritatively in [`docs/game-systems.md`](../../docs/game-systems.md) (and matching README sections). Update in the same change:
- the **seeded band** description to note the new omen tell (and that it is the *intended* signal, distinct from the spreading+ glitch);
- the **seed spawn-chance** description/table to the hybrid curve (count-gated, excess-filled, cap 0.85);
- any README corruption table listing the old `min(0.25, …)` chance.

## 7. Testing considerations

Vitest runs engine/data only (`src/engine/__tests__/**`) — no component tests, so the debug panel (Part 2) is verified manually.

- **Omen (Part 1):** with a stubbed `Math.random`, assert that at `seeded` band `synthesizeAll` appends an omen line from the exported pool, and that at `dormant`/`spreading`/`virulent` it does **not** (mutual exclusivity with the glitch path). A direct unit test of the omen helper asserts pool membership and rng selection.
- **Odds (Part 3):** recompute the value-pinned expectations in the corruption seed tests against the new constants. Audit **[`CorruptionRoll.test.ts`](../../src/engine/__tests__/CorruptionRoll.test.ts)**, **[`CorruptionLifecycle.test.ts`](../../src/engine/__tests__/CorruptionLifecycle.test.ts)**, and **[`CorruptionData.test.ts`](../../src/engine/__tests__/CorruptionData.test.ts)** for any literal citing `0.25`, `0.004`, or the linear `seedChance` shape; update assertions, arithmetic comments, and any `Math.random` thresholds that assumed the old curve. Add a case pinning the count-gate effect (same `food`, different `highCount` → different chance).
- A full `npm test` must pass, and `npm run build` must typecheck (the `seedChance` signature change ripples to its callers).
