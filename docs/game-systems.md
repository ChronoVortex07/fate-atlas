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
> | I Ching hexagram data (King Wen table, cast, consolidation) | [`src/data/iching.ts`](../src/data/iching.ts) |
> | I Ching resolution modes, Mandate derivation, nudge | [`src/engine/iching.ts`](../src/engine/iching.ts) |
> | I Ching line-mutation responders | [`src/engine/responders/iching.ts`](../src/engine/responders/iching.ts) |

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

### 4b. The card-drafting minigame

When the player chooses Tarot, a **card-drafting minigame** begins:

1. **Deal** — 9 cards are dealt face-down from the shuffled 78-card deck onto the table.
   The remaining cards stay in the deck (visible as a face-down stack).
2. **Draft** — the player picks 3 cards from the table into their hand, one per position:
   **Past** (hand[0]), **Present** (hand[1]), **Future** (hand[2]). Cards are inserted in
   order — the first empty slot is filled first.
3. **Table interaction** — on desktop, hovering near table cards fans them apart for easier
   clicking. On mobile, the first tap fans out a zone, the second tap selects a card.
4. **Peek** — if Light is Ascendant+, an eye icon appears on hand cards. Successful peek
   reveals the card's identity and orientation; failure shows a "veil holds fast" message.
   Peeked cards stay face-up in hand. Returning a peeked card to the table keeps it face-up;
   returning it to the deck makes it face-down again.
5. **Shuffle** — the player may reshuffle the table at any time (up to `spreadRedraws` times).
   All face-up table cards flip face-down, all table cards + deck are shuffled, and a fresh
   set of cards is dealt. Uses the `take-reroll` affinity action (feeds Will).
6. **Swap** — cards in hand can be drag-swapped between Past/Present/Future positions at any
   time before reveal. Peeked cards keep their revealed identity when swapped.
7. **Return** — hand cards can be dragged back to the table (stays face-up if peeked) or
   returned to the deck via a button (always face-down).
8. **Reveal** — when all 3 hand slots are filled, the player may **Reveal as Drawn**
   (accepts the dealt orientations, feeds Fate) or **Invert Meaning** (reverses every
   card's orientation, feeds Will + Chaos).

The draft engine state (`TarotDraftState`) is managed entirely on `GameState.minigameState`.
All mutations route through `GameEngine` methods that call `notify()`.

9. **Review beat** — after a spread commits and any meta-interactions finish narrating, the
   screen holds a **review beat** showing the face-up Past/Present/Future faces; play advances
   only on an explicit **Continue** click. This gate (`GameState.awaitingContinue`, cleared by
   `GameEngine.continueAfterReview()`) applies to all three minigames and to the final commit
   before the Result page.

### 4c. New event triggers

The draft minigame introduces seven new event dispatch points for meta-interactions:

| Trigger | Fires when |
|---------|-----------|
| `tarot:draft:started` | The draft begins (9 cards dealt) |
| `tarot:picked` | Player picks a card from table → hand |
| `tarot:returned:table` | Player returns a card from hand → table |
| `tarot:returned:deck` | Player returns a card from hand → deck |
| `tarot:shuffled` | Table is reshuffled and redealt |
| `tarot:peeked` | Peek attempt completes (success or failure) |
| `tarot:swapped` | Player swaps two hand positions |

Responders can hook into these to trigger meta-interactions during the draft phase (e.g.,
Chaos responder at `tarot:picked` could force a different card).

### 4d. Consolidation (`consolidateSpread`)

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

### 4e. Balance rationale

Consolidating the spread into one slot keeps the slot model uniform (one result per
method) and integrates with existing responders without structural changes. Dimension
averaging and theme capping prevent the spread from overwhelming the reading with noise;
the preserved spread array enables the spread-internal interaction channel without
breaking cross-slot interactions that match on the consolidated result.

**Synthesis profiles over atomic signals, not the consolidated averages.** To avoid the
double-average that washed a balanced spread out to a flat "balanced" verdict, the
`ReadingPlanner.aggregate` step expands results into **atomic signals** — each individual
card in a multi-card spread, each die, each hexagram, each astral cast — and profiles the
reading over those. Favorability is **magnitude-weighted** (`Σ v·|v| / Σ|v|`) so strong
pulls dominate rather than cancelling, and the planner surfaces the **strongest favorable
and adverse poles** (`strongestFavor` / `strongestAdverse`). `NarrativeAssembler` then uses
a **narrower symmetric favorability band** (`high ≥ +0.5`, `low ≤ −0.5`), **names the
opposing poles** when a neutral net hides opposed forces, emits one **per-position line**
per spread (instead of re-listing the spread inside the modifier frames), and narrates each
result under **exactly one** modifier role (disjoint frames — the role where it ranks
strongest).

### 4f. SVG sigils

Sigil **resolution** lives in the pure, framework-free module `src/data/sigils.ts`
(`resolveSigil`), which the engine test suite covers (`src/engine/__tests__/Sigils.test.ts`
asserts completeness). `resolveSigil` returns an **icon key** (a stable string) rather than
geometry; `CardSigil` is a thin renderer that maps each key to a **`react-icons` Game-Icons**
(`react-icons/gi`) component via a `Record<IconKey, IconType>` (so TypeScript enforces that
every key has a component). Icons render as `currentColor` SVGs sized by the `size` prop.

- **Major Arcana** -- all 22 majors map to a **bespoke Game-Icon** (`MAJOR_ICON_KEYS`,
  keyed by major id). Every id resolves to a real icon export — the completeness test fails
  if any major is missing.
- **Minor Arcana** -- composed as a **suit icon** (`SUIT_ICON_KEYS`) plus a small corner
  **rank cartouche**: a roman numeral (`A` for aces, `II`–`X` for pips) or a court letter
  (`P/N/Q/K`); courts also render a small **crown** above the icon.
- **Spread crest** -- a multi-card spread resolves to a dedicated crest icon key (`'spread'`).
- **Reversed** cards keep the 180° rotation convention.

Tarot no longer renders the emoji `symbol` data field — the Result page sub-cards use
`CardSigil`. Face-down cards across the draft (table, hand, deck) and the fan use a
standardized **constellation-crest** `CardBack`. Sigils appear in the fan (method select),
slot views (Past/Present/Future), history tiles, and result readings.

### 4g. Spread coherence affinity feeds

When a tarot spread is committed, `completeMinigame` checks every face's orientation:

- **All upright** -- Order gains +6 (flat, no jitter or coupling fan-out).
- **All reversed** -- Chaos gains +6 (flat, no jitter or coupling fan-out).
- **Mixed orientations** -- no coherence feed.

These are **flat shifts** applied on top of the normal tag-based feeds (which add +5 per
`upright` or `reversed` tag), rewarding consistent spreads with a predictable affinity
bonus.

### 4h. Display touchpoints

The spread composition is visible at every display surface:

- **consolidateSpread name** — multi-card spreads join card names with ` · ` (e.g.
  "The Fool · The Star · Two of Cups") instead of the old "Three-Card Spread" placeholder.
- **FanCard (ConstellationFan)** — when the fan expands, a tarot spread slot renders 3
  sub-cards above the consolidated card with Past/Present/Future labels, sigils, names,
  and orientation indicators.
- **ResultReading** — the final results page shows a 3-column positional layout for each
  multi-card tarot slot, with per-card symbol, name, orientation, and meaning snippet.
- **NarrativeAssembler** — `describeSlotBrief` renders position breakdowns
  ("Past: The Fool (upright); Present: The Magician (upright); Future: The High Priestess
  (upright)") for modifier-frame text. `describeSlotFull` (LLM prompt) already handles
  per-position rendering with veiled-card support.

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
| `chaos-line-cascade` | `iching:transform` | MUTATE | Chaos ascendant · notable | Adds one new changing line (chosen from the still lines) and recomputes the relating hexagram | `amplify` |
| `order-still-hexagram` | `iching:transform` | MUTATE | Order ascendant · notable | Removes one changing line (chosen at random) and recomputes the relating hexagram | `anchor` |
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
| **I Ching Resonant Change** (`iching-resonant-change`) | `iching:commit` | cross-slot | The committed I Ching has `changing-lines` **and** another `reversible` entity (non-I Ching) is in the spread | Report-only: narrates that the changing lines resonated outward through the spread | `mirror` |
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

> Known limitation (astral): astral debug scenarios reliably fire only planet/sign-tag-dependent
> responders (dignity, debility); omen/house/aspect-dependent scenarios depend on non-deterministic
> physics landing and may not fire from a cold load.

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
| Aries | ♈ | fire | cardinal | transformation | authority |
| Taurus | ♉ | earth | fixed | stagnation | stagnation |
| Gemini | ♊ | air | mutable | illumination | illumination |
| Cancer | ♋ | water | cardinal | harmony | authority |
| Leo | ♌ | fire | fixed | transformation | stagnation |
| Virgo | ♍ | earth | mutable | stagnation | illumination |
| Libra | ♎ | air | cardinal | illumination | authority |
| Scorpio | ♏ | water | fixed | harmony | stagnation |
| Sagittarius | ♐ | fire | mutable | transformation | illumination |
| Capricorn | ♑ | earth | cardinal | stagnation | authority |
| Aquarius | ♒ | air | fixed | illumination | stagnation |
| Pisces | ♓ | water | mutable | harmony | illumination |

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

---

## 9. I Ching

I Ching (`type: 'iching'`) is the third divination method. The seeker casts three coins
six times to build a **primary hexagram** from the bottom line up; changing lines transform
it into a **relating hexagram** that shows where the present moment is moving.

Sources of truth: [`src/data/iching.ts`](../src/data/iching.ts),
[`src/engine/iching.ts`](../src/engine/iching.ts),
[`src/engine/responders/iching.ts`](../src/engine/responders/iching.ts).

### 9a. Authentic coin-cast (`drawHexagramCast`)

Each of the six lines is determined by summing three virtual coin tosses (heads=3, tails=2),
producing a line value of **6, 7, 8, or 9**:

| Sum | Line type | Yang/Yin | Changing? |
|-----|-----------|----------|-----------|
| 6 | old yin | yin | yes → transforms to yang |
| 7 | young yang | yang | no |
| 8 | young yin | yin | no |
| 9 | old yang | yang | yes → transforms to yin |

Lines 6 and 9 are **changing lines** (their position recorded, 1-indexed bottom-up). The
primary hexagram reads the current state; the relating hexagram flips every changing line
to its opposite, revealing where the situation is heading.

**Chaos bias** — when Chaos is above 0, there is up to a 20% chance per line that a young
(stable) line is promoted to its changing counterpart (Chaos ×0.2 probability). This makes
changing lines more frequent as Chaos rises.

### 9b. King Wen mapping

Primary and relating hexagrams are identified by mapping the six bits (bottom→top,
yang=`1`, yin=`0`) against the **King Wen binary table** (`HEX_BY_BINARY` in
`src/data/iching.ts`). All 64 hexagrams are authored with hand-tuned dimensions
(favorability, certainty, volatility in −2 … +2) and 1–3 themes drawn from the shared
theme vocabulary.

### 9c. Primary → Relating transformation

When a cast has no changing lines, only the primary hexagram is produced. When changing
lines exist, the relating hexagram is also computed. The player's choice of which to commit
determines the **governing hexagram** — the single `IChingResult` that enters the spread.

Changing lines also shift the governing hexagram's **volatility dimension** upward
(`+0.5 × changingLineCount`, capped at +2.0) before the result is consolidated.

Tags emitted by `consolidateHexagram`:

| Tag | Always emitted? | Meaning |
|-----|-----------------|---------|
| `draw` | yes | result was drawn (not authored) |
| `random` | yes | result involves randomness |
| `binary` | yes | result is a binary (hexagram) structure |
| `governing-primary` | if governing = primary | primary hexagram was chosen |
| `governing-relating` | if governing = relating | relating hexagram was chosen |
| `changing-lines` | only if ≥1 changing line | cast produced changing lines |
| `reversible` | only if ≥1 changing line | can participate in Mirror / Resonant Change |

> Note: `reversible` and `changing-lines` are emitted together and only when the cast
> actually produced changing lines — they are not always present on an I Ching result.

### 9d. Resolution modes (`planHexagramResolution`)

The UI offers different choices depending on which affinities are ascendant. Will takes
priority over Fate when both qualify.

| Mode | Condition | What the player experiences |
|------|-----------|------------------------------|
| `willed` | Will ascendant+ (and changing lines present) | **Accept the Change** (commits relating; feeds Will+Chaos via `reversed`) · **Hold the Moment** (commits primary; feeds Fate via `revealedAsDrawn`) |
| `fated` | Fate ascendant+ (Will below ascendant; and changing lines present) | Fate carries the cast forward — the relating hexagram is committed automatically (feeds Fate via `revealedAsDrawn`) |
| `unaligned` | Neither Will nor Fate ascendant (or no changing lines) | One **Re-cast** offer is extended; if declined or absent the engine resolves automatically |

When there are no changing lines, `mode` is always `unaligned` and no re-cast is offered.

After a successful re-cast the affinity feed action `viaReroll` applies (`take-reroll`
→ Will).

### 9e. New event triggers

| Trigger | Fires when |
|---------|-----------|
| `iching:cast` | Reserved — fires when the cast is drawn (currently unused by responders) |
| `iching:transform` | Before commit — `chaos-line-cascade` and `order-still-hexagram` compete here to mutate the changing-line set |
| `iching:commit` | The governing hexagram is committed — `mirror`, `iching-resonant-change`, and `chaos-second-result` fire here |

### 9f. The Mandate of Change

When an I Ching result is committed, two effects are applied to the `AffinityEngine`:

**1 — One-time nudge (`hexagramNudge`):** Direct signed shifts applied *before* the mandate
is set, so the nudge itself is not scaled by the freshly-created mandate. The nudge is
derived from the governing hexagram's dimensions:

| Dimension | Direction | Affinity shifted | Scale |
|-----------|-----------|-----------------|-------|
| volatility > 0 | positive | Chaos | `round(volatility × 4)` |
| volatility < 0 | negative | Order | `round(−volatility × 4)` |
| favorability > 0 | positive | Light | `round(favorability × 3)` |
| favorability < 0 | negative | Shadow | `round(−favorability × 3)` |
| certainty > 0 | positive | Order | `round(certainty × 2)` |
| certainty < 0 | negative | Shadow | `round(−certainty × 2)` |

**2 — Lingering Mandate (`deriveMandate` → `AffinityEngine.setMandate`):** Sets a
per-affinity multiplier on the `baseDelta` of every future `shift()` call — scaling both
gains **and** penalties until the mandate decays. The player never sees the mandate
as numbers; it surfaces only as atmospheric flavor.

#### Global multiplier formula

Derived from the governing hexagram's **volatility** dimension, clamped to [0.5, 1.6]:

```
volatility >= 0 : globalMult = 1 + (volatility / 2) * 0.6   → range [1.0, 1.6]
volatility < 0  : globalMult = 1 + (volatility / 2) * 0.5   → range [0.5, 1.0]
```

All six per-affinity factors start at `globalMult`, then thematic tilts are applied
(each tilt is clamped independently to [0.4, 2.0]):

| Governing hexagram has… | Affinity tilted up | Affinity tilted down |
|-------------------------|--------------------|----------------------|
| A change theme (`transformation`, `upheaval`, `renewal`) | Chaos ×1.25, Will ×1.20 | Order ×0.80 |
| An order theme (`stagnation`, `harmony`, `authority`) | Order ×1.20, Fate ×1.15 | Chaos ×0.85 |
| favorability > 0 | Light ×1.15 | Shadow ×0.90 |
| favorability < 0 | Shadow ×1.15 | Light ×0.90 |
| certainty > 0 | Order ×1.10, Light ×1.05 | — |
| certainty < 0 | Chaos ×1.05, Shadow ×1.10 | — |

Multiple tilt conditions stack multiplicatively (applied in order above).

#### Decay and lifecycle

- **No-op on the commit that sets it** (`mandateFresh = true`): the first subsequent
  commit after the I Ching is when decay begins.
- **Decay rate:** each commit (via `decayMandate()` in `advanceAfterCommit`) moves every
  factor **40% of the way toward 1.0**: `factor → factor + (1 − factor) × 0.4`.
- **Turn-scoped:** the mandate is **never serialized** to localStorage; it is cleared by
  `beginRun()` at the start of every run and does not carry over between turns.
- **Replacement:** a second I Ching cast in the same turn replaces the mandate entirely.
- **Cleared at run start:** `AffinityEngine.beginRun()` calls `clearMandate()`.
- **Secrecy:** the mandate values are not exposed in the game UI. Only atmospheric flavor
  text hints at the hexagram's influence on the reading.

### 9g. Line-mutation responders (`iching:transform`)

Before the result is committed, `GameEngine.runHexagramTransform` dispatches the
`iching:transform` trigger, allowing Chaos or Order to alter the cast:

| Responder | Min band / tier | Condition | Effect |
|-----------|-----------------|-----------|--------|
| `chaos-line-cascade` | Chaos ascendant · notable | Cast has ≥1 still line (< 6 changing lines) | Adds one new changing line (random from the still lines); recomputes relating hexagram |
| `order-still-hexagram` | Order ascendant · notable | Cast has ≥1 changing line | Removes one changing line (random); recomputes relating hexagram |

Both compete in the `MUTATE` exclusive band (weighted by their affinity value); at most one
fires per transform. The relating hexagram is always recomputed after any line change
(`recomputeRelating`).

Note: `chaos-line-cascade` can *create* a transformation from scratch — its condition is
`< 6 changing lines` (not `≥ 1`), so Chaos can add the very first changing line to an
otherwise stable cast, producing a relating hexagram where none would have existed.

See §5 for the full responder catalog entry.
