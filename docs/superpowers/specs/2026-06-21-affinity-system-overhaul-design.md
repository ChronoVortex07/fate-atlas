# Affinity System Overhaul — Design

**Date:** 2026-06-21
**Status:** Approved design, pending implementation plan
**Scope:** `src/engine/AffinityEngine.ts`, `src/data/affinities.ts`, `src/engine/types.ts`, `src/engine/GameEngine.ts`, and the effect hook sites across data + components.

## 1. Goals & non-goals

Today's affinity system is a minimum-viable placeholder: two independent `0.0–1.0` values (`chaos`, `order`), tag-based accumulation at `+0.05` per matching tag, **no decay and no opposition coupling**, and effects that are only partially wired (dice RNG bias, happening frequency, two interaction gates). This overhaul makes affinities a real, run-shaping system.

**Goals**

- Affinities provide **generic, wide-scope variance** to a run — distinct from meta-interactions, which target specific entities.
- Affinities **invoke wonder**: the player never sees values or named causes; they only infer from vague hints and from the effects themselves.
- Runs **stay fresh**: they neither converge to a boring equilibrium nor reward min-maxing a single affinity.
- Add two new opposing pairs alongside Chaos/Order.

**Non-goals (deferred, not in this spec)**

- The **reshuffle event** (a major affinity perturbation). The architecture provides a clean hook; the event itself is future work.
- **Overcharge backlash** (extremes leaking their opposite's effects). Considered and dropped to keep the model lean.
- **Passive per-turn drift.** Rejected in favor of run-start drift (below).

## 2. The affinity set

Three opposing pairs. Both members of a pair can be high at once, but boosting one pulls its opposite down hardest (coupling, §4).

| Pair | Axis it governs |
|---|---|
| **Chaos ↔ Order** | Volatility of outcomes (swingy/extreme vs. centered/steady) |
| **Fate ↔ Will** | Player agency (control taken *from* vs. *given to* the player) |
| **Light ↔ Shadow** | Information (how much the game reveals vs. conceals) |

Light/Shadow is deliberately meta: it modulates the very hint clarity that conveys every other affinity's state.

## 3. Value model

- All six affinities live on an integer-friendly **0–100 scale, baseline 50** (replacing the old `0.0–1.0`).
- **Bands** classify a value into a stage:

  | Band | Range |
  |---|---|
  | Latent | 0–34 |
  | Stirring | 35–59 |
  | Ascendant | 60–81 |
  | Dominant | 82–100 |

  Baseline 50 sits in **Stirring**, so a fresh run shows only subtle effects; **Latent** is effectively dormant.

- **Soft reach-up:** when resolving an affinity's effects, there is a ~12% chance to act **one band higher** than the current value (never lower, never two bands up). This blurs band edges and lets even a Latent affinity occasionally surprise the player.

All numeric constants in this document are **playtest defaults**, not final values.

## 4. The mutation pipeline (`shift`)

Every affinity change — tag accumulation, player-action feeds, happening choices, and the future reshuffle — flows through a **single chokepoint**: `AffinityEngine.shift(affinityId, baseDelta, sourceId)`. One path means one place to test and one home for the reshuffle hook.

For a **gain** `shift(A, +g)`:

1. **Diminishing returns** — multiply by `max(0.3, 1 − 0.08 × feedsThisRun[A])`, then increment `feedsThisRun[A]`. Counters reset each run.
2. **Hidden jitter** — multiply the result by `U(0.85, 1.15)`.
3. **Apply** the realized gain to `A`.
4. **Coupling fan-out** (gains only) — using the *realized* gain from steps 1–2: `opposite(A) −= gain × 0.6`; every **other** affinity `−= gain × 0.35`.
5. **Clamp** every touched affinity to `[0, 100]`.

**Penalties** (an explicit negative delta, e.g. peek-failure) subtract **directly** from the named affinity with **no fan-out** — this keeps the model predictable and avoids surprising opposite-boosts.

**Why this satisfies the design constraints**

- *Anti-equilibrium:* there is no attractor at 50. The coupling makes "whatever you have been feeding" ascendant and everything else low; the ascendant force shifts as your actions shift.
- *Anti-min-max:* you cannot pump everything (every gain taxes the rest), diminishing returns blunt leaning hard one way, and jitter prevents clean cause→effect reverse-engineering.

## 5. Run boundaries

At the start of each run (`GameEngine.startTurn`):

- **Drift toward baseline:** each affinity moves 33% of the way to 50 — `A += (50 − A) × 0.33`. Softens (does not erase) carryover, so each run opens fresher while history still matters.
- **Reset per-run counters:** `feedsThisRun` (diminishing returns) and `peeksThisRun` (peek escalation).
- This method is also the **reshuffle hook**: a future event that perturbs affinities slots in here.

Affinities otherwise persist across runs via `localStorage` (unchanged carryover model).

## 6. Accumulation sources (feeds)

Three feed kinds, all routed through `shift`:

- **Result tags → Chaos/Order.** `random` / `reversed` / `changing-lines` / extreme d20 → Chaos; `upright` / `stable` / `neutral` / centered d20 → Order. (Today's tag model, retained.)
- **Player actions → Fate/Will and Light/Shadow.** These axes are about *how you engage*:
  - Accept what's given (reveal-as-drawn, keep first roll, decline an offered reroll) → **Fate**.
  - Assert control (reverse, take a reroll, swap method, set orientation) → **Will**.
  - Seek clarity (use a peek, "seek the pattern" options) → **Light**.
  - Embrace the unknown (decline a peek, concealment/mystery options) → **Shadow**.
- **Happening choices → any of the six** (data-driven `affinityChanges`, now six-wide).

Some actions intentionally feed two axes (reversing a card feeds **Will** *and* **Chaos**); coupling then redistributes. This overlap is a feature.

## 7. Effects

Effects are gated by band and fire on a **low base probability tuned by power**, so they stay rare and wondrous — the player cannot force them.

**Trigger tiers** (base chance per relevant moment, scaled up by band from Stirring → Dominant):

| Tier | Examples | Base chance |
|---|---|---|
| Ambient | hand +1, hint clarity, minor d20 bias, reading detail | ~35–60% |
| Notable | foresight offer, reroll offer, reversals up, polarized d20 | ~15–30% |
| Major | card-swap, hollow reroll, wild-surge 2nd result, the-hand-chooses, keep-one-of-two | ~5–12% |

### 7.1 Chaos ↔ Order — volatility

| Band | Chaos | Hook | Order | Hook |
|---|---|---|---|---|
| Stirring | d20 drifts slightly to extremes *(Ambient)*; happenings a touch more frequent *(Ambient)* | `dice.ts`; happening trigger in `GameEngine` | d20 nudged toward center *(Ambient)*; reversals rarer *(Ambient)* | `dice.ts`; `tarot.ts` orientation |
| Ascendant | reversals common *(Notable)*; interaction chains likelier *(Notable)*; pool more varied *(Notable)* | `tarot.ts`; `InteractionResolver`; `TurnOrchestrator` | results lean balanced *(Notable)*; +1 clarity line *(Ambient)*; pool steadier/gap-aligned *(Notable)* | `dice.ts`/`tarot.ts`; `NarrativeAssembler`; `ReadingPlanner` |
| Dominant | wild surge: a result can spawn a second *(Major)*; d20 strongly polarized *(Notable)*; a happening can interrupt a minigame *(Major)* | `GameEngine.maybeWildSurge`; `dice.ts`; `GameEngine` | d20 strongly centered *(Notable)*; cards trend upright *(Notable)*; reading reconciles its tensions *(Ambient)* | `dice.ts`; `tarot.ts`; `NarrativeAssembler` |

### 7.2 Fate ↔ Will — agency

Opposites share hooks and push opposite ways; coupling keeps them from both being high, so usually one side dominates.

| Band | Fate | Hook | Will | Hook |
|---|---|---|---|---|
| Stirring | a coin-flip detail (e.g. orientation) occasionally decided *for* you *(Notable)*; pool sometimes one fewer method *(Ambient)* | engine auto-orientation; `methodCount` | small chance a "Reroll?" prompt after an action *(Notable)*; occasional +1 hand → 4 cards *(Ambient)* | `offerReroll`; `handSize` |
| Ascendant | **card-swap**: the card you pick may not be the one revealed *(Major)*; **hollow reroll**: a reroll may return the same result *(Major)* | `resolveTarotPick`; reroll resolution | reroll offered often & on more actions *(Notable)*; larger hand up to 5 *(Ambient)*; free orientation choice *(Ambient)* | `offerReroll`; `handSize`; `setOrientation` |
| Dominant | the hand chooses: sometimes it's picked *for* you *(Major)*; rerolls almost always hollow *(Major)*; method may be forced *(Notable)* | `resolveTarotPick`; reroll resolution; `methodCount` | reroll on nearly anything *(Notable)*; biggest hand *(Ambient)*; keep one of two results *(Major)* | `offerReroll`; `handSize`; `maybeWildSurge`-style keep-choice |

### 7.3 Light ↔ Shadow — information

These also modulate the hint system itself.

| Band | Light | Hook | Shadow | Hook |
|---|---|---|---|---|
| Stirring | hints read a little clearer *(Ambient)*; faint theme hint on a method *(Ambient)* | hint clarity; `poolPreview` | hints get vaguer *(Ambient)*; reading a touch terser *(Ambient)* | hint clarity; `NarrativeAssembler` |
| Ascendant | **foresight (peek)** available *(Notable)*; +1 interpretive line *(Ambient)*; pool previews offerings *(Ambient)* | `usePeek`; `NarrativeAssembler`; `poolPreview` | **veiled**: results show less, threshold hidden till commit *(Notable)*; hints cryptic *(Ambient)*; pool unlabeled *(Ambient)* | minigame display; hint clarity; `MethodSelect` |
| Dominant | **illumination**: rich, explicit reading *(Ambient)*; hints name the forces *(Ambient)*; see an interaction coming *(Notable)* | `NarrativeAssembler`; hint clarity; `InteractionSequencer` | **eclipse**: cryptic, sparse reading *(Ambient)*; a result may stay partly hidden *(Notable)*; hints near-opaque *(Ambient)* | `NarrativeAssembler`; minigame display; hint clarity |

### 7.4 Peek (Light, self-limiting foresight)

Peek is **Light-only** — Will never grants foresight. Peek lets the player glance at a result's leaning before committing.

- Becomes available when Light is **Ascendant** or higher.
- `failChance = min(90%, 18% × peeksThisRun)` → peek #1 = 0% (free), #2 = 18%, #3 = 36%, …
- On **failure**: peek is **disabled for the rest of the run**, and **Light takes a −12 penalty** (direct subtraction, no fan-out).
- `peeksThisRun` resets at run start.

### 7.5 UX caution — Fate

Card-swap and "the hand chooses" deliberately remove control. They must land as **mystical**, never as a bug: a shimmer plus a line like *"your hand moved of its own accord."* The feedback cue is part of the Fate work, not an afterthought.

## 8. Visibility & hints

- The player **never** sees numbers or named causes. State is felt three ways:
  1. **The effects themselves** — volatility, a swapped card, a clearer reading — unlabeled.
  2. **Ambient hints** — an expanded per-band, per-affinity flavor pool, surfaced sparingly (run start, result screen, occasionally between minigames), keyed to the **top 1–2 forces only** to avoid overload.
  3. **Light/Shadow modulation** — Light can make a hint name a force outright; Shadow makes hints cryptic, terse, even misleading.
- The dev **debug panel keeps showing real values** (already gated behind `debug`); no change.

## 9. Architecture

**Principle:** all logic stays in the engine; React only renders state and reports events. The current façade/snapshot contract is preserved (`notify()` deep-clones state to `cachedSnapshot`).

### 9.1 Single mutation chokepoint

`AffinityEngine.shift(affinityId, baseDelta, sourceId)` runs the §4 pipeline. All feeds call it. `setState`/`serialize`/`loadFrom` adapt to 0–100 and six ids.

### 9.2 Effects: static modifiers vs. event-resolved decisions

To keep probability logic out of components, effects split in two:

- **Static modifiers** — no per-event roll. Derived from current bands and exposed via `engine.getAffinityEffects(): AffinityEffects` (and/or carried in the snapshot). Components render them directly:
  - `handSize`, `methodCount`, `hintClarity`, `readingDetail`, `poolPreview`, `peekAvailable`.
- **Event-resolved decisions** — the engine rolls at the decision site (band + power + jitter), exposed as engine methods the component calls at the moment the event happens:
  - `resolveTarotPick(chosenIndex, hand)` → may return a different card (card-swap / the-hand-chooses).
  - reroll resolution → Fate makes it hollow (same result), Will offers/extends it.
  - `maybeWildSurge(result)` → may append a second result.
  - `maybeHappeningInterrupt()` → Chaos-Dominant mid-minigame happening.
  - `usePeek()` → returns foresight or triggers failure (lockout + Light penalty).
  - orientation auto-decide (Fate) / free choice (Will).

### 9.3 Action feeds

Choices report to the engine, which translates them to `shift` calls:

- Extend existing completion calls: `completeMinigame(result, meta?)` where `meta` carries `{ revealedAsDrawn | reversed, viaReroll, peeked }`. `resolveHappening` already has the choice index. `selectMethod` unchanged.
- New action methods (perform the mechanic **and** feed the affinity): `takeReroll()`, `usePeek()`, `swapMethod()`, `setOrientation(orientation)`.

### 9.4 Types & data shapes (`types.ts`, `data/affinities.ts`)

- `AffinityId` → the six ids; add `AFFINITY_PAIRS: Record<AffinityId, AffinityId>` (id ↔ opposite).
- `AffinityDefinition` reworked: `pair`/`opposite`, ordered `bands`, `feeds` (tags + action ids), `bandedEffects` (effect id + tier + band), per-band `hints`.
- New `AffinityEffects` type (the static-modifier snapshot) and an `AffinityAction` enum (the agency/information choices).

## 10. Debug scenarios

Goal: trigger any affinity effect on demand from the debug panel, loading the state **one action before** the effect so it can be observed, with the effect **guaranteed** to fire.

**Sectioned dropdown.** `ScenarioPreset` gains a `group` field. `getScenarioPresets()` returns `{ id, label, group }`; the panel renders one `<optgroup label={group}>` per group. Groups: **Meta-Interactions** (the existing five), **Chaos / Order**, **Fate / Will**, **Light / Shadow**.

**Guaranteed firing.** New `state.debugForcedEffect: string | null`. Every event-resolved decision method (§9.2) checks it first: if it names that method's effect, the effect resolves with probability 1 and the flag is cleared. Scenarios for event-resolved effects set it; static-modifier effects don't need it (they're visible on load).

**Two scenario flavors:**
- *Static* (hand size, methodCount, veiled display, hint clarity, reading detail, pool preview): set affinity band + screen; observe on load.
- *Event-resolved* (card-swap, the-hand-chooses, hollow reroll, offered reroll, wild surge, happening-interrupt, peek + peek-fail, orientation auto/free, keep-one-of-two): set affinity band + screen + `debugForcedEffect`; load → perform the one action → the effect fires.

**Affinity-routing fix (existing bug).** Scenarios currently set `state.affinities.chaos = …` directly, but `notify()` overwrites `state.affinities` from the `AffinityEngine`, silently discarding it. Overhauled scenarios must set affinities through the engine (0–100) — `apply` receives a context (e.g. `{ state, setAffinities }`) or returns an affinity patch that `loadScenarioById` applies via `affinityEngine.setState` **before** `notify()`.

**Coverage:** one scenario per banded effect in §7, named by effect and band and grouped under its pair — e.g. "Card-Swap — Fate Ascendant", "Wild Surge — Chaos Dominant", "Peek Failure — Light".

## 11. Persistence & migration

- Save grows to **six affinities at 0–100**.
- On load: any affinity value `≤ 1` is multiplied by 100 (migrates old `chaos`/`order`); missing affinities default to 50.
- `serialize` / `loadFrom` cover all six.

## 12. Testing

Vitest, engine-only (`src/engine/__tests__/**`), Node env, `Math.random` stubbed for determinism:

- Coupling math: gain → opposite `−0.6g` / others `−0.35g`, with clamps.
- Diminishing-returns curve (successive feeds shrink; floor at 0.3).
- Jitter bounds (realized gain within `±15%`).
- Band classification + soft reach-up distribution.
- Run-start drift (`33%` toward 50) and counter resets.
- Peek escalation → failure → lockout + `−12` Light penalty.
- Effect gating by band/power (stubbed RNG).
- Migration `0–1 → 0–100`; serialize/deserialize round-trip.
- `debugForcedEffect` forces an event-resolved effect to fire (probability → 1, then clears); scenario affinity setup routes through `AffinityEngine.setState` and survives `notify()`.
- Update `AffinityEngine.test.ts`, `scenarios.ts`, and any fixtures pinning chaos/order at 0–1.

## 13. Phasing

Each phase is independently shippable; this spec covers all three. Debug-scenario infrastructure (the sectioned dropdown, `debugForcedEffect`, and the affinity-routing fix) ships in **Phase 1**; each phase then adds debug scenarios for the effects it introduces.

1. **Core model + Chaos/Order rework.** 0–100 migration, `shift` pipeline (DR + jitter + coupling), bands + reach-up, run-start drift/counters, six affinity definitions (new four's effects stubbed), hint-system rework, and wiring Chaos/Order to existing hooks (dice bias, happening frequency, interaction gates, narrative clarity).
2. **Fate/Will (agency).** Action feeds; agency decision hooks in minigames/method-select (card-swap, hollow reroll, offered reroll, hand size, orientation control, keep-one-of-two, method swap); mystical feedback cues.
3. **Light/Shadow (information).** Peek/foresight + escalation; reading detail/terseness; hint-clarity modulation; pool preview; veiled results.

## 14. Files touched (orientation)

`src/engine/types.ts`, `src/data/affinities.ts`, `src/engine/AffinityEngine.ts` (rewrite), `src/engine/GameEngine.ts`, `src/data/dice.ts`, `src/data/tarot.ts`, `src/data/happenings.ts`, `src/engine/InteractionResolver.ts`, `src/engine/NarrativeAssembler.ts`; components `TarotMinigame`, `DiceMinigame`, `IChingMinigame`, `MethodSelect`, `ResultReading` (+ a small peek/reroll UI element); `src/engine/scenarios.ts`, `src/components/debug/DebugPanel.tsx`, and engine tests/fixtures.

## 15. Tuning constants (defaults, for playtest)

| Constant | Default |
|---|---|
| Scale / baseline | 0–100 / 50 |
| Bands | Latent 0–34, Stirring 35–59, Ascendant 60–81, Dominant 82–100 |
| Soft reach-up chance | 12% (one band up) |
| Coupling — opposite | `× 0.6` of realized gain |
| Coupling — each other | `× 0.35` of realized gain |
| Diminishing returns | `max(0.3, 1 − 0.08 × feedsThisRun[A])` |
| Jitter | `× U(0.85, 1.15)` |
| Run-start drift | `33%` toward 50 |
| Effect tiers (base chance) | Ambient 35–60%, Notable 15–30%, Major 5–12% |
| Peek fail step / penalty | `18%` per use / Light `−12` |
