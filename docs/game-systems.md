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
> | Astromancy data tables (planets, signs, houses, aspects, dignity) | [`src/data/astromancy.ts`](../src/data/astromancy.ts) |
> | Astromancy cast modes and affinity modifiers | [`src/engine/astral.ts`](../src/engine/astral.ts) |
> | Astromancy symbolic-resonance + omen responders | [`src/engine/responders/astral.ts`](../src/engine/responders/astral.ts) |

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

---

## 8. Astromancy

Astromancy (`type: 'astral'`) is the fourth divination method. The cast throws two physical
dice onto a 12-house zodiac board: a **Planet die** (12 faces) and a **Sign die** (12 faces).
Where each die lands determines a house; the angle between the two houses produces an
**aspect**. The reading is **Planet-in-Sign-in-House** plus the aspect between them — four
signals combined into a single `AstralResult`.

The legacy d20 method coexists with astromancy in the pool; both are available.

Sources of truth: [`src/data/astromancy.ts`](../src/data/astromancy.ts),
[`src/engine/astral.ts`](../src/engine/astral.ts),
[`src/engine/responders/astral.ts`](../src/engine/responders/astral.ts).

### 8a. Planet die (12 planets)

| Planet | Glyph | Theme | Modifier role | Favorability | Certainty | Volatility |
|--------|-------|-------|---------------|:------------:|:---------:|:----------:|
| Sun | ☉ | illumination | subject | +1.0 | +0.5 | 0 |
| Moon | ☽ | mystery | subject | +0.5 | −1.0 | +0.5 |
| Mercury | ☿ | illumination | action | 0 | +0.5 | +0.5 |
| Venus | ♀ | harmony | subject | +1.5 | 0 | −0.5 |
| Mars | ♂ | conflict | action | −1.0 | +0.5 | +1.5 |
| Jupiter | ♃ | renewal | subject | +1.5 | 0 | +0.5 |
| Saturn | ♄ | authority | effect | −0.5 | +1.5 | −0.5 |
| Uranus | ♅ | upheaval | effect | 0 | −0.5 | +1.5 |
| Neptune | ♆ | mystery | effect | 0 | −1.0 | +0.5 |
| Pluto | ♇ | transformation | effect | −0.5 | 0 | +1.5 |
| North Node | ☊ | renewal | action | +1.0 | −0.5 | +0.5 |
| South Node | ☋ | surrender | effect | −1.0 | 0 | 0 |

### 8b. Sign die (12 signs)

Signs contribute **element lean** and **modality lean** to the combined dimensions; their
element and modality also supply theme candidates.

| Sign | Glyph | Element | Modality | Element theme | Modality theme |
|------|-------|---------|----------|---------------|----------------|
| Aries | ♈ | fire | cardinal | conflict | authority |
| Taurus | ♉ | earth | fixed | stagnation | stagnation |
| Gemini | ♊ | air | mutable | illumination | illumination |
| Cancer | ♋ | water | cardinal | mystery | authority |
| Leo | ♌ | fire | fixed | conflict | stagnation |
| Virgo | ♍ | earth | mutable | stagnation | illumination |
| Libra | ♎ | air | cardinal | illumination | authority |
| Scorpio | ♏ | water | fixed | mystery | stagnation |
| Sagittarius | ♐ | fire | mutable | conflict | illumination |
| Capricorn | ♑ | earth | cardinal | stagnation | authority |
| Aquarius | ♒ | air | fixed | illumination | stagnation |
| Pisces | ♓ | water | mutable | mystery | illumination |

Element dimension leans: **fire** +0.5 vol/+0.5 fav · **earth** +0.5 cer/−0.5 vol ·
**air** +0.5 cer · **water** +0.5 fav/−0.5 cer.

Modality dimension leans: **cardinal** +0.5 vol · **fixed** +0.5 cer/−0.5 vol ·
**mutable** +0.5 vol/−0.5 cer.

### 8c. House board (12 houses)

The Planet die's landing house determines the arena. The Sign die's landing house is used only
to compute the aspect (see §8d).

| House | Arena | Theme |
|-------|-------|-------|
| 1 | Self | authority |
| 2 | Resources | stagnation |
| 3 | Communication | illumination |
| 4 | Roots | harmony |
| 5 | Creativity | renewal |
| 6 | Work | stagnation |
| 7 | Partnership | harmony |
| 8 | Rebirth | transformation |
| 9 | Journeys | illumination |
| 10 | Career | authority |
| 11 | Community | renewal |
| 12 | The Hidden | mystery |

### 8d. Aspects

`aspectBetween(houseA, houseB)` computes the minimum arc (0–6 steps of 30°) between the two
landing houses and maps it to an aspect name. A step of 6 is opposition (180°).

| Step | Aspect | Favorability | Certainty | Volatility | Theme |
|------|--------|:------------:|:---------:|:----------:|-------|
| 0 | conjunction | 0 | +1.5 | +0.5 | *(none)* |
| 2 | sextile | +1.0 | +0.5 | 0 | harmony |
| 3 | square | −0.5 | 0 | +1.0 | conflict |
| 4 | trine | +1.0 | +0.5 | 0 | harmony |
| 6 | opposition | 0 | +1.0 | +1.0 | upheaval |
| 1, 5 | minor | 0 | −0.5 | +0.5 | mystery |

### 8e. How `consolidateCast` combines the four signals

1. **Dimensions** — sum planet + element lean + modality lean + aspect dims, then halve and
   clamp to −2 … +2 (in 0.5 steps).
2. **Themes** — ranked by priority: house → planet → aspect → element; deduplicated, capped
   at 2.
3. **Tags** emitted: `draw`, `random`, `astral`, `planet-<id>`, `sign-<id>`,
   `house-<N>`, `element-<element>`, `aspect-<name>`, `dignified` or `debilitated`
   (if applicable), plus any omen tags from the cast.

### 8f. Dignity and debility

A planet is **dignified** when it lands in one of its home signs; **debilitated** in a hostile
sign. Both tag the result and activate dedicated responders (§8h).

| Planet | Dignified in | Debilitated in |
|--------|-------------|----------------|
| Sun | Leo | Aquarius |
| Moon | Cancer | Capricorn |
| Mercury | Gemini, Virgo | Sagittarius, Pisces |
| Venus | Taurus, Libra | Scorpio, Aries |
| Mars | Aries, Scorpio | Libra, Taurus |
| Jupiter | Sagittarius, Pisces | Gemini, Virgo |
| Saturn | Capricorn, Aquarius | Cancer, Aries |
| Uranus | Aquarius | Leo |
| Neptune | Pisces | Virgo |
| Pluto | Scorpio | Taurus |
| North Node | *(none)* | *(none)* |
| South Node | *(none)* | *(none)* |

### 8g. Cast modes (affinity-driven)

Before the dice are thrown `planAstralCast` resolves a cast mode from the current affinities.
A **separate** probabilistic check (`shouldOfferRecast`) may additionally offer the player a
chance to recast.

| Mode | Affinity required | What happens |
|------|-------------------|--------------|
| `single` | *(default — no qualifying affinity)* | One cast, auto-accepted |
| `favored` | Light ascendant+ | Two casts drawn; the one scoring higher on `favorability * 10 + harmonyRank` (favorability dominates, aspect harmony breaks ties) is kept automatically |
| `clouded` | Shadow ascendant+ | Two casts drawn; the one with the *lower* such score is kept automatically |
| `choice` | Will dominant | Two casts drawn; the player picks which to keep (suppresses offer-recast) |

`choice` wins over `favored`/`clouded`; among `favored`/`clouded`, the first match in list
order wins (Will dominant checked first, then Light ascendant, then Shadow ascendant).

**Offer-recast** — when mode is not `choice`, `shouldOfferRecast` may fire: it replicates
`bandRoll('will', 'stirring', T.notable)` — Will stirring minimum, notable tier base chance
(0.22), scaling +70% per band above gate.

### 8h. Symbolic-resonance + omen responders

All eight responders trigger at `astral:commit`. All are deterministic (`roll → true`).
Seven compete in the `MUTATE` exclusive band; the eighth (`astral-errant-star`) is in
`SPAWN`. Among the MUTATE seven, `astral-conjunction-crowned` carries weight 2 (beats
weight-1 MUTATE rivals in a tie); the rest are weight 1.

#### Symbolic-resonance responders (tag-matched, always fire when condition is true)

| Responder | Condition | Band | Effect | Animation |
|-----------|-----------|------|--------|-----------|
| `astral-dignity` | result has tag `dignified` | MUTATE | Amplifies the dominant dimension by +0.5 (in the direction of its sign) | `override` |
| `astral-debility` | result has tag `debilitated` | MUTATE | −0.5 favorability, +0.5 volatility | `shroud` |
| `astral-great-trine` | `aspect-trine` + planet is Jupiter or Venus | MUTATE | +1.0 favorability; forces `harmony` into themes (index 1) | `add-choice` |
| `astral-duel` | planet is Mars + aspect is square or opposition | MUTATE | +1.0 volatility, −0.5 favorability; forces `conflict` into themes (index 0) | `flip` |
| `astral-saturns-gate` | planet is Saturn + house is 1 or 10 | MUTATE | +1.0 certainty, −0.5 favorability; forces `authority` into themes (index 0) | `override` |
| `astral-conjunction-crowned` | result has omen tag `crowned-conjunction` | MUTATE (weight 2) | Amplifies the dominant dimension by +1.0 | `override` |
| `astral-veiled-oracle` | result has omen tag `veiled-oracle` | MUTATE | −1.0 certainty; forces `mystery` into themes (index 1) | `shroud` |

#### Omen responder (physics-sourced tag)

| Responder | Condition | Band | Effect | Animation |
|-----------|-----------|------|--------|-----------|
| `astral-errant-star` | result has omen tag `errant-star` | SPAWN | Spawns a second astral result (`spawnSecond = 'astral'`) | `second-result` |

**Omen tags** (`OmenTag`) are set by the physics renderer on the `AstralCast` before
`consolidateCast` is called. Three omens are defined:

| Omen tag | Physics trigger | Responder activated |
|----------|----------------|---------------------|
| `errant-star` | A die slides off the board | `astral-errant-star` (SPAWN) |
| `crowned-conjunction` | Both dice come to rest in the same house | `astral-conjunction-crowned` (MUTATE weight 2) |
| `veiled-oracle` | A die lands askew / on an edge | `astral-veiled-oracle` (MUTATE) |

> **Physics is presentation only.** The engine-side generator `drawAstralCast` produces a
> plain `AstralCast` with `omens: []`; the React physics renderer populates the omen tags
> before passing the cast to `consolidateCast`. Affinities act as physical forces during the
> throw: **Chaos** adds turbulence (wider scatter, more extreme aspects), **Order** centers
> the dice (smaller separation between the two landing houses). This is cosmetic — the
> same affinity influence is already baked into the engine-side `drawAstralCast` fallback.
