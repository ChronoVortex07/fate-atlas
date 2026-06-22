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
| **spreadRedraws** (disliked spread positions the player may redraw) | Will | latent/stirring **0** · ascendant **1** · dominant **2** |
| **methodCount** (methods in the pool) | Fate | ascendant+ → **2**, otherwise **3** |
| **hintClarity** (−2 opaque … +2 names the forces) | Light − Shadow band index | clamped to −2…+2 |
| **readingDetail** (−1 terse … +1 rich) | Light − Shadow band index | clamped to −1…+1 |
| **poolPreview** | Light vs Shadow | Shadow ascendant+ → `hidden`; else Light ascendant+ → `full`; else Light stirring+ & > Shadow → `theme`; else `none` |
| **peekAvailable** | Light | available at Light ascendant+ (unless locked out this run) |

> Note: `poolPreview: 'hidden'` is consumed by the dice "veiled" cue. Method-card
> concealment is driven **only** by `shroudedMethods` (the `shadow-shroud` effect), not by
> `poolPreview`.

### 3b. Per-affinity band ladder

Combining the static effects above with the event-driven responders in §5:

- **Chaos** — *stirring:* restless flavor. *ascendant:* a happening may interrupt between
  readings (`chaos-happening-interrupt`). *dominant:* a committed result may spawn a second
  (`chaos-second-result`).
- **Order** — steadier flavor and clarity as it rises; opposes Chaos via coupling. (Order has
  no dedicated responders; its influence is suppressing Chaos and feeding stable outcomes.)
- **Fate** — *stirring:* the spread-wide orientation may be decided for you (`fate-auto-orient`).
  *ascendant:* the pool narrows to 2 methods; a dealt card may be swapped before reveal
  (`fate-deal-swap`); a reroll may ring hollow (`fate-hollow-reroll`); your method choice
  may be redirected (`fate-force-method`). *dominant:* those effects intensify.
- **Will** — *stirring:* a "reroll?" prompt may appear (`will-offer-reroll`). *ascendant:*
  a disliked spread position may be redrawn (`spreadRedraws = 1`); your will may widen the
  method pool (`will-widen-pool`). *dominant:* up to two disliked positions may be redrawn
  (`spreadRedraws = 2`); you may cast two dice and keep one (`will-choice`).
- **Light** — *ascendant:* foresight (peek) becomes available; pool preview and reading detail
  increase; dice gain advantage (`light-advantage`). *dominant:* the reading is laid bare.
- **Shadow** — *ascendant:* method cards may be shrouded (`shadow-shroud`); results show less;
  dice suffer disadvantage (`shadow-disadvantage`); pool preview hidden. *dominant:* up to
  three method cards shrouded; cryptic, sparse readings.

---

## 4. Tarot spreads & consolidation

The tarot overhaul introduced a full 78-card deck (22 Major + 56 Minor Arcana), a
three-card Past/Present/Future spread, procedural consolidation into a single game slot,
and SVG-based sigils.

### 4a. Deck composition

- **Major Arcana** (22 cards): hand-authored, each with unique archetype, themes, dimensions,
  and modifier roles. Tags include `major-arcana` plus the card's archetype tag (e.g.
  `fool-archetype`).
- **Minor Arcana** (56 cards): procedurally generated from four suits x 14 ranks per suit
  (Ace 1-10, plus Page, Knight, Queen, King courts). Each suit has a dominant element, base
  dimension signature, and a pair of light themes.

| Suit | Element | Base dimensions | Primary axis |
|------|---------|-----------------|-------------|
| Wands | Fire | volatility +0.8 | volatility |
| Cups | Water | favorability +0.8 | favorability |
| Swords | Air | favorability -0.6, certainty +0.5 | favorability |
| Pentacles | Earth | certainty +0.7, volatility -0.5 | certainty |

Minor arcana cards carry `minor-arcana`, `suit-<suit>`, `element-<element>`, and
`rank-<rank>` tags. They are dimension-heavy (every rank contributes favorability/certainty/
volatility) but theme-light (most ranks have 0 themes -- only Aces, court cards, and tens
carry a theme). This makes minor arcana a strong signal for dimension-averaging but a weak
signal for theme-matching interactions, by design.

### 4b. The three-card spread

When the player chooses Tarot, **three cards** are drawn without replacement from
`FULL_DECK` (MAJOR_ARCANA UNION MINOR_ARCANA). Each card is assigned an independent
orientation via `pickOrientation(affinities)` -- biased by Chaos (more reversals) and
Order (fewer reversals).

The positions are **Past**, **Present**, **Future**, each mapping to one drawn card. The
player sees all three face-up (or veiled by Shadow) and may **redraw** disliked positions
if Will's `spreadRedraws` modifier is greater than 0.

### 4c. Consolidation (`consolidateSpread`)

After the player confirms the spread, the three faces are **consolidated into one
`TarotResult` slot** via `consolidateSpread`:

1. **Dimensions averaged** -- each of favorability, certainty, volatility is summed across
   all faces then divided by three, rounded to the nearest 0.5 and clamped to -2...+2.
2. **Themes capped at 2** -- theme tags are counted by frequency; ties broken by the sum
   of absolute dimension values of the cards carrying each theme. The top two survive.
3. **Tags and archetypes lifted** -- all unique tags from every face are merged (excluding
   `upright`/`reversed`); all modifier roles are unioned.
4. **Majority orientation** -- if more than half the faces are reversed, the consolidated
   result is reversed; otherwise upright.
5. **Single-card path** -- the legacy single-card draw (`drawTarotCard`) still uses
   `consolidateSpread` with a single-element array, producing identical behavior.
6. The spread's individual faces remain accessible on the result as `result.spread` (an
   array of `{ position, card }` objects), used by spread-internal responders.

### 4d. Balance rationale

Consolidating the spread into one slot keeps the slot model uniform (one result per
method) and integrates with existing responders without structural changes. Dimension
averaging and theme capping prevent the spread from overwhelming the reading with noise;
the preserved spread array enables the spread-internal interaction channel without
breaking cross-slot interactions that match on the consolidated result.

### 4e. SVG sigils

Each card has an SVG sigil rendered by the `CardSigil` component:

- **Major Arcana** -- a unique per-card sigil drawn from `MAJOR_SIGILS` (with a `GENERIC`
  fallback for cards without authored art).
- **Minor Arcana** -- the suit's emblem glyph (Wands DIAMOND, Cups HEART, Swords SPADE,
  Pentacles CLUB) with rank-based embellishments.
- **Spread icon** -- the consolidated result uses a stellar `SPREAD_GLYPH` glyph.

Sigils appear in the fan (method select), slot views (Past/Present/Future), history
tiles, and result readings.

### 4f. Spread coherence affinity feeds

When a tarot spread is committed, `completeMinigame` checks every face's orientation:

- **All upright** -- Order gains +6 (flat, no jitter or coupling fan-out).
- **All reversed** -- Chaos gains +6 (flat, no jitter or coupling fan-out).
- **Mixed orientations** -- no coherence feed.

These are **flat shifts** applied on top of the normal tag-based feeds (which add +5 per
`upright` or `reversed` tag), rewarding consistent spreads with a predictable affinity
bonus.

---

## 5. Event-driven affinity effects (responder catalog)

All gated by `bandRoll` unless noted. "Min band" is the gate; the chance scales upward in
higher bands (§1).

| Responder | Trigger | Band group | Min band / tier | Effect | Animation |
|-----------|---------|-----------|-----------------|--------|-----------|
| `will-widen-pool` | `select:draw:start` | STRUCTURAL | Will ascendant · notable | +1 method in the pool | `widen` |
| `fate-thin-pool` | `select:draw:start` | STRUCTURAL | Fate ascendant · notable | −1 method (won't drop below 2) | `thin` |
| `shadow-shroud` | `select:draw:end` | MUTATE | Shadow ascendant · flat 20%/step | Shrouds **1–3 distinct** method cards (1 at ascendant, +1 roll at ascendant, +1 at dominant; capped at pool size) | `shroud` |
| `fate-force-method` | `select:pick` | OVERRIDE | Fate ascendant · major | Redirects your method choice to a different one | `override` |
| `fate-deal-swap` | `tarot:deal` | OVERRIDE | Fate ascendant · major | Swaps one dealt face for a fresh distinct draw before reveal | `override` |
| `fate-auto-orient` | `tarot:orient` | OVERRIDE | Fate stirring · notable | Sets the spread-wide orientation for you (coin flip) | `override` |
| `chaos-wild-card` | `tarot:orient` | MUTATE | Chaos ascendant · notable | Flips one random face in the spread to the opposite orientation | `flip` |
| `order-anchor` | `tarot:orient` | MUTATE | Order ascendant · notable | Sets every reversed face upright — coerces the spread to full upright | `anchor` |
| `fate-hollow-reroll` | `dice:reroll` | OVERRIDE | Fate ascendant · major | A reroll returns the previous die unchanged | `override` |
| `chaos-second-result` | `dice/tarot/iching:commit` | SPAWN | Chaos dominant · major | Spawns a second result of the same type (targets the new fan slot) | `second-result` |
| `chaos-happening-interrupt` | `minigame:end` | SPAWN | Chaos ascendant · major | A happening interrupts before the next method (never on the last reading) | `interrupt` |
| `light-advantage` | `dice:roll` | combine `roll-mode` | Light ascendant · ambient | Adds an **advantage** modifier | *(roll-mode)* |
| `shadow-disadvantage` | `dice:roll` | combine `roll-mode` | Shadow ascendant · ambient | Adds a **disadvantage** modifier | *(roll-mode)* |
| `will-choice` | `dice:roll` | combine `roll-mode` | Will dominant · major | Cast two dice, keep one (**choice**) | *(roll-mode)* |
| `will-offer-reroll` | `dice:roll` | combine `roll-mode` | Will stirring · notable | Offers a reroll prompt | *(roll-mode)* |
| `shadow-veil-position` | `tarot:commit` | combine `spread` | Shadow ascendant · notable | Veils one face in the spread — its card stays hidden from the reading | `shroud` |

**Roll-mode combine reducer** (`reducers.ts`): `choice` wins and suppresses offer-reroll;
otherwise advantage/disadvantage net by count (a tie cancels to a single roll); `offer-reroll`
surfaces if present. The collapsed outcome is narrated once as **"The Cast"**.

**Spread combine reducer** (`reducers.ts`): the `spread` reducer collects all
`EffectReport`s emitted by spread-internal responders (including the new ones above and
the spread-internal interactions in §6) and returns them as an array for batch narration.

> **Light Position Foresight** — When `usePeek` is called during a tarot deal, the
> returned `leaning` string names the spread position whose card has the largest sum of
> absolute dimension values, e.g. `"The Future pulls strongest, toward fortune..."`. This
> is driven by `GameEngine.describeLeaning` and works for both single-card and spread
> previews.

---

## 6. Meta-interactions (between divination results)

Meta-interactions use two distinct scopes:

- **Cross-slot interactions** (the original four below) match across *committed slots* — the
  current hand plus previously committed results. They fire on `dice:commit`, `tarot:commit`,
  `iching:commit`, or `happening:start` and operate on the entire spread.
- **Spread-internal interactions** (the five after the table) match *within a single tarot
  spread* — the three faces of the consolidated tarot result (§4). They fire on `tarot:commit`
  via the `spread` combine channel, whose reducer collects all reports and emits them as an
  array. Because they operate on the unconsolidated faces, they can inspect individual cards'
  suits, elements, arcana type, and orientation.

All interaction responders are tag-matched (adding a new entity with the right tags
automatically participates). All are deterministic (`roll → true`) except **Mirror** (85%).

| Interaction | Trigger | Scope | Fires when… | Effect | Animation |
|-------------|---------|-------|-------------|--------|-----------|
| **Fool's Reroll** (`fool-reroll`) | `dice:commit` | cross-slot | The Fool (`major-arcana` + `fool-archetype`) is anywhere in the spread | Recasts the committed d20 (fresh draw) | `reroll` |
| **Critical Resonance** (`critical-resonance`) | `tarot:commit` | cross-slot | Committed tarot majority orientation is **upright + critical-low** die present, or **reversed + critical-high** die present | Flips the whole spread via `reverseSpread` | `flip` |
| **The Mirror** (`mirror`) | any `*:commit` | cross-slot | Exactly **two** `reversible` entities in the spread | Flips orientation on both via `reverseSpread` (85% chance) | `mirror` |
| **I Ching Boost** (`iching-happening-boost`) | `happening:start` | cross-slot | An I Ching with `changing-lines` is in the spread | Adds a hidden bonus choice to the happening | `add-choice` |
| **Suit Accord** (`suit-accord`) | `tarot:commit` (spread) | spread-internal | All faces share the same suit (Wands/Cups/Swords/Pentacles) | Amplifies the suit's primary dimension by ×1.5 | `amplify` |
| **Elemental Clash** (`elemental-clash`) | `tarot:commit` (spread) | spread-internal | Two opposing elements are present (fire↔water, air↔earth) | Increases volatility dimension | `amplify` |
| **Major Convergence** (`major-convergence`) | `tarot:commit` (spread) | spread-internal | Two or more Major Arcana faces in the spread | Emits a fated-current report | `second-result` |
| **Spread Aligned** (`spread-aligned`) | `tarot:commit` (spread) | spread-internal | Every face is upright | Emits a clarity/order report | `anchor` |
| **Spread Cascade** (`spread-cascade`) | `tarot:commit` (spread) | spread-internal | Every face is reversed | Emits an upheaval/chaos report | `flip` |

These spread-internal interactions are deterministic and fire alongside the cross-slot
interactions at the same `tarot:commit` trigger. The `spread` combine reducer gathers
their `EffectReport`s and returns them in a single batch — they appear in the event queue
without blocking the cross-slot resolution flow.

---

## 7. Happenings

Authored cryptic scenes that may appear between readings (triggered by
`chaos-happening-interrupt`). Each presents 2–3 choices; **choosing** an option shifts
Chaos and/or Order (the scene itself is affinity-neutral on reveal, and is filtered out of
synthesis and run records).

`selectHappening` excludes already-seen IDs (resetting once all are used) and, as **Chaos**
rises, weights the 3-choice happenings more heavily. An active I Ching with changing lines
can append a hidden bonus choice (see §6).

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

## 8. Debug scenarios

Each responder has a one-click debug scenario (`DEBUG_SCENARIOS` in `scenarios.ts`) that
stages the precondition and **forces** the effect. Forcing bypasses the probabilistic `roll`
but **never** the structural `condition`, so each scenario stages the slots / screen / affinity
the condition requires. Open the debug panel (`?debug` or `Ctrl+Shift+D`) to run them.

> Known limitation: the `iching-happening-boost` scenario stages a happening screen, but its
> `happening:start` trigger is only dispatched through the live happening flow, so it may not
> visibly fire from a cold scenario load (it still validates in the engine test suite).
