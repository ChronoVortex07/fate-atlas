# Atlas of Fate — Game Systems Reference

Authoritative reference for the hidden **affinity** system, the per-band **effects**,
the **meta-interactions** between divination results, and the **happenings**.

> **⚠️ Keep this in sync.** This document is hand-maintained — it is *not* generated.
> Whenever you change any of the source-of-truth files below, update the matching
> section here in the same change:
>
> | System | Source of truth |
> |--------|-----------------|
> | Affinities, bands, feeds, tuning constants | [`src/data/affinities.ts`](../src/data/affinities.ts) |
> | Affinity shift math, static band-derived effects | [`src/engine/AffinityEngine.ts`](../src/engine/AffinityEngine.ts) |
> | Event-driven affinity effects (responders) | [`src/engine/responders/affinity.ts`](../src/engine/responders/affinity.ts) |
> | Meta-interactions (responders) | [`src/engine/responders/interactions.ts`](../src/engine/responders/interactions.ts) |
> | Roll-mode combine reducer | [`src/engine/events/reducers.ts`](../src/engine/events/reducers.ts) |
> | Dispatch / band ordering / chance scaling | [`src/engine/events/EventDispatcher.ts`](../src/engine/events/EventDispatcher.ts), [`src/engine/events/eligibility.ts`](../src/engine/events/eligibility.ts) |
> | Happenings | [`src/data/happenings.ts`](../src/data/happenings.ts) |
> | Debug scenarios | [`src/engine/events/scenarios.ts`](../src/engine/events/scenarios.ts) |

---

## 1. How effects are resolved

Game logic is framework-free (`src/engine/`). Effects are **Responders** invoked by
`dispatch()` at namespaced trigger points during the turn (e.g. `select:draw:start`,
`tarot:commit`, `dice:roll`, `minigame:end`). Each responder has:

- **`condition(ctx)`** — a structural precondition that is *always* required.
- **`roll(ctx)`** — a probabilistic gate (bypassed when an effect is *forced* via the debug panel).
- **`apply(ctx)`** — mutates the draft and returns an optional `EffectReport` (banner + animation).

Reports are pushed onto `state.eventQueue`; the `InteractionSequencer` then auto-plays
them ("**resolve first, narrate second**"). A commit that queues events **freezes** the
screen until the batch finishes narrating, then the deferred transition runs.

### Priority bands (resolution order)

Exclusive responders are grouped into bands resolved in this order; **at most one winner
fires per band** (ties broken by the responder's affinity value):

| Band | Purpose |
|------|---------|
| `STRUCTURAL` | Pool sizing (widen / thin) |
| `MUTATE` | In-place changes to a result (flip, reroll, mirror) |
| `SPAWN` | New content (second result, happening interrupt, bonus choice) |
| `OVERRIDE` | Replacing a player choice (force method, override pick, auto-orient) |

`combine` responders (channel `roll-mode`) are different: **all** contributors push a
modifier and a reducer collapses them into one outcome.

### Probabilistic chance scaling

The probabilistic gate `bandRoll(affinity, minBand, baseChance)` fires when the affinity
is at/above `minBand` and `rng() < baseChance × (1 + bandsAboveGate × 0.70)` (capped at 1).
Base chances by tier (`TIER_BASE_CHANCE`): **ambient 0.50**, **notable 0.22**, **major 0.08**.

---

## 2. Affinities

Six hidden affinities form three opposed pairs. Values are **0–100**, baseline **50**, and
are **never shown directly** — only hinted through atmospheric flavor text. They persist
across runs (localStorage `fate-atlas-save`); at the start of each run every affinity
**drifts 33% back toward baseline**.

| Pair | Affinity | Theme | Opposite |
|------|----------|-------|----------|
| Fortune | **Chaos** | randomness, reversals, volatility | Order |
| | **Order** | stability, upright, measured outcomes | Chaos |
| Agency | **Fate** | control taken from the player | Will |
| | **Will** | agency given to the player | Fate |
| Information | **Light** | the game reveals more | Shadow |
| | **Shadow** | the game conceals more | Light |

### Bands

`bandOf(value)` maps a value to one of four bands:

| Band | Range |
|------|-------|
| `latent` | 0 – 34 |
| `stirring` | 35 – 59 *(baseline 50 sits here)* |
| `ascendant` | 60 – 81 |
| `dominant` | 82 – 100 |

### What feeds each affinity

| Affinity | Fed by (result tags) | Fed by (player actions) |
|----------|----------------------|--------------------------|
| **Chaos** | `random`, `reversed`, `changing-lines` | *(secondary, from `reverse`)* |
| **Order** | `upright`, `neutral`, `stable` | — |
| **Fate** | — | `reveal-as-drawn`, `keep-roll`, `decline-reroll` |
| **Will** | — | `reverse` (+Chaos), `take-reroll`, `swap-method`, `set-orientation` |
| **Light** | — | `use-peek`, `seek-pattern` |
| **Shadow** | — | `decline-peek`, `embrace-mystery` |

Result-tag feeds grant `+5` per matching tag; action feeds grant `+6` (`+3` to a secondary
axis). Happening *slots* do **not** feed affinity on reveal — only the **chosen** happening
option shifts affinity.

### Shift mechanics (`AffinityEngine.shift`)

- **Gains** pass through *diminishing returns* (−8% per prior feed this run, floored at 30%),
  then random *jitter* (×0.85–1.15), then **coupling fan-out**: the opposite affinity loses
  60% of the realized gain and each of the other four loses 35%.
- **Penalties** (negative deltas) apply directly with **no** fan-out.

---

## 3. Effects of each band

Two kinds of effect derive from a band: **static** modifiers (always on at that band, no
roll) and **event-driven** effects (probabilistic responders, see §4).

### 3a. Static band-derived modifiers (`AffinityEngine.getEffects`)

| Modifier | Driven by | Value by band |
|----------|-----------|---------------|
| **handSize** (tarot cards offered) | Will | latent/stirring **3** · ascendant **4** · dominant **5** |
| **methodCount** (methods in the pool) | Fate | ascendant+ → **2**, otherwise **3** |
| **hintClarity** (−2 opaque … +2 names the forces) | Light − Shadow band index | clamped to −2…+2 |
| **readingDetail** (−1 terse … +1 rich) | Light − Shadow band index | clamped to −1…+1 |
| **poolPreview** | Light vs Shadow | Shadow ascendant+ → `hidden`; else Light ascendant+ → `full`; else Light stirring+ & > Shadow → `theme`; else `none` |
| **peekAvailable** | Light | available at Light ascendant+ (unless locked out this run) |

> Note: `poolPreview: 'hidden'` is consumed by the dice "veiled" cue. Method-card
> concealment is driven **only** by `shroudedMethods` (the `shadow-shroud` effect), not by
> `poolPreview`.

### 3b. Per-affinity band ladder

Combining the static effects above with the event-driven responders in §4:

- **Chaos** — *stirring:* restless flavor. *ascendant:* a happening may interrupt between
  readings (`chaos-happening-interrupt`). *dominant:* a committed result may spawn a second
  (`chaos-second-result`).
- **Order** — steadier flavor and clarity as it rises; opposes Chaos via coupling. (Order has
  no dedicated responders; its influence is suppressing Chaos and feeding stable outcomes.)
- **Fate** — *stirring:* a coin-flip detail may be decided for you (`fate-auto-orient`).
  *ascendant:* the pool narrows to 2 methods; the card you pick may be swapped
  (`fate-override-pick`); a reroll may ring hollow (`fate-hollow-reroll`); your method choice
  may be redirected (`fate-force-method`). *dominant:* those effects intensify.
- **Will** — *stirring:* a "reroll?" prompt may appear (`will-offer-reroll`). *ascendant:*
  hand grows to 4 cards; your will may widen the method pool (`will-widen-pool`). *dominant:*
  hand grows to 5; you may cast two dice and keep one (`will-choice`).
- **Light** — *ascendant:* foresight (peek) becomes available; pool preview and reading detail
  increase; dice gain advantage (`light-advantage`). *dominant:* the reading is laid bare.
- **Shadow** — *ascendant:* method cards may be shrouded (`shadow-shroud`); results show less;
  dice suffer disadvantage (`shadow-disadvantage`); pool preview hidden. *dominant:* up to
  three method cards shrouded; cryptic, sparse readings.

---

## 4. Event-driven affinity effects (responder catalog)

All gated by `bandRoll` unless noted. "Min band" is the gate; the chance scales upward in
higher bands (§1).

| Responder | Trigger | Band group | Min band / tier | Effect | Animation |
|-----------|---------|-----------|-----------------|--------|-----------|
| `will-widen-pool` | `select:draw:start` | STRUCTURAL | Will ascendant · notable | +1 method in the pool | `widen` |
| `fate-thin-pool` | `select:draw:start` | STRUCTURAL | Fate ascendant · notable | −1 method (won't drop below 2) | `thin` |
| `shadow-shroud` | `select:draw:end` | MUTATE | Shadow ascendant · flat 20%/step | Shrouds **1–3 distinct** method cards (1 at ascendant, +1 roll at ascendant, +1 at dominant; capped at pool size) | `shroud` |
| `fate-force-method` | `select:pick` | OVERRIDE | Fate ascendant · major | Redirects your method choice to a different one | `override` |
| `fate-override-pick` | `tarot:pick` | OVERRIDE | Fate ascendant · major | Replaces the tarot you picked with another from the hand | `override` |
| `fate-auto-orient` | `tarot:orient` | OVERRIDE | Fate stirring · notable | Sets the card's orientation for you (coin flip) | `override` |
| `fate-hollow-reroll` | `dice:reroll` | OVERRIDE | Fate ascendant · major | A reroll returns the previous die unchanged | `override` |
| `chaos-second-result` | `dice/tarot/iching:commit` | SPAWN | Chaos dominant · major | Spawns a second result of the same type (targets the new fan slot) | `second-result` |
| `chaos-happening-interrupt` | `minigame:end` | SPAWN | Chaos ascendant · major | A happening interrupts before the next method (never on the last reading) | `interrupt` |
| `light-advantage` | `dice:roll` | combine `roll-mode` | Light ascendant · ambient | Adds an **advantage** modifier | *(roll-mode)* |
| `shadow-disadvantage` | `dice:roll` | combine `roll-mode` | Shadow ascendant · ambient | Adds a **disadvantage** modifier | *(roll-mode)* |
| `will-choice` | `dice:roll` | combine `roll-mode` | Will dominant · major | Cast two dice, keep one (**choice**) | *(roll-mode)* |
| `will-offer-reroll` | `dice:roll` | combine `roll-mode` | Will stirring · notable | Offers a reroll prompt | *(roll-mode)* |

**Roll-mode combine reducer** (`reducers.ts`): `choice` wins and suppresses offer-reroll;
otherwise advantage/disadvantage net by count (a tie cancels to a single roll); `offer-reroll`
surfaces if present. The collapsed outcome is narrated once as **"The Cast"**.

---

## 5. Meta-interactions (between divination results)

These are **interaction** responders — they match the *spread* (committed slots + current
hand) rather than an affinity band, so adding a new entity with the right tags automatically
participates. All are deterministic (`roll → true`) except **Mirror** (85%).

| Interaction | Trigger | Fires when… | Effect | Animation |
|-------------|---------|-------------|--------|-----------|
| **Fool's Reroll** (`fool-reroll`) | `dice:commit` | The Fool (`major-arcana` + `fool-archetype`) is anywhere in the spread | Recasts the committed d20 (fresh draw) | `reroll` |
| **Critical Resonance** (`critical-resonance`) | `tarot:commit` | committed tarot is **upright + critical-low** die present, or **reversed + critical-high** die present | Flips the tarot's orientation | `flip` |
| **The Mirror** (`mirror`) | any `*:commit` | exactly **two** `reversible` entities in the spread | Both tarot reversibles flip orientation (85% chance) | `mirror` |
| **I Ching Boost** (`iching-happening-boost`) | `happening:start` | an I Ching with `changing-lines` is in the spread | Adds a hidden bonus choice to the happening | `add-choice` |

---

## 6. Happenings

Authored cryptic scenes that may appear between readings (triggered by
`chaos-happening-interrupt`). Each presents 2–3 choices; **choosing** an option shifts
Chaos and/or Order (the scene itself is affinity-neutral on reveal, and is filtered out of
synthesis and run records).

`selectHappening` excludes already-seen IDs (resetting once all are used) and, as **Chaos**
rises, weights the 3-choice happenings more heavily. An active I Ching with changing lines
can append a hidden bonus choice (see §5).

| ID | Scene (gist) | Choices → affinity shift |
|----|--------------|---------------------------|
| `crossroads` | A path splits beneath the stars | Order +8 · Chaos +8 · (wait) Order +4/Chaos +4 |
| `falling-star` | A star tears across the sky | Chaos +10 · Order +10 |
| `veiled-moon` | Cloud drifts across the moon | Chaos +6 · Order +6 · (fix shapes) Order +3/Chaos +3 |
| `whispering-thread` | A thread of starlight whispers | Chaos +7 · Order +7 |
| `convergence` | Three constellations align | Order +9 · Chaos +9 |
| `echo-of-past-reading` | A past divination resurfaces | Chaos +5 · Order +5 |
| `dark-constellation` | A constellation of absence | Order +6 · Chaos +6 |
| `many-threads` | Countless threads of fate shimmer | Order +7 · Chaos +7 |

---

## 7. Debug scenarios

Each responder has a one-click debug scenario (`DEBUG_SCENARIOS` in `scenarios.ts`) that
stages the precondition and **forces** the effect. Forcing bypasses the probabilistic `roll`
but **never** the structural `condition`, so each scenario stages the slots / screen / affinity
the condition requires. Open the debug panel (`?debug` or `Ctrl+Shift+D`) to run them.

> Known limitation: the `iching-happening-boost` scenario stages a happening screen, but its
> `happening:start` trigger is only dispatched through the live happening flow, so it may not
> visibly fire from a cold scenario load (it still validates in the engine test suite).
