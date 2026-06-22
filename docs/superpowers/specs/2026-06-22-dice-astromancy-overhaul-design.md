# New Divination Method — "Casting the Heavens" (Astromancy) — Design

**Date:** 2026-06-22
**Status:** Draft (design); pending user review before implementation planning
**Scope:** A **new, standalone divination method** (`astral`), its data layer, its engine glue, and its physics-based minigame. The existing d20 method is **left entirely intact and untouched** — no refactor, no shims, no reuse of its code. The user will retire d20 at a later point. **No changes to Tarot or I Ching** (the tarot overhaul is in active development on another branch — this work must not touch tarot files).

## Problem

The d20 dice method is the shallowest of the three pillars: a single die → one of five fixed thresholds → a canned interpretation, presented as a count-up number animation. It reads neither *relationships* nor *where the dice land* — the two things real dice divination (cleromancy) is built on — and its presentation reads as a UI widget, not a ritual.

Rather than overhaul the d20 in place (which would entangle new ideas with old code and create tech debt), we build a **fresh method** beside it and let the old one be removed cleanly later.

## Goal

Introduce **astromancy** — casting glyph-carved dice onto a zodiacal house board, read as **Planet-in-Sign-in-House** with astrological **aspects** emerging from where the dice physically land — rendered with a genuine **physics throw** (bouncing, rolling, settling) in which **affinities are physical forces**. It reaches the depth bar set by the tarot overhaul (procedural reading, multi-signal consolidation, named meta-interactions) and reuses the existing **event/responder system** verbatim.

Delivered as **one phased spec**. Other future methods are an appendix only — not built here.

### Relationship to the old d20 method

- The new method has its own type, data file, engine glue, and component. Nothing imports or mutates `src/data/dice.ts`, `src/data/dice-modifiers.ts`, `rollD20`, or `DiceMinigame.tsx`.
- Both methods coexist in the orchestrator pool during the transition. The user removes d20 (its profile entry, data, component, and pool registration) in a later, separate change — at which point **nothing in astromancy needs to change**, because astromancy never depended on it.

---

## The cast

Two twelve-faced dice are cast onto a **12-house zodiac board** (a wheel of twelve 30° sectors):

- **Planet die** — twelve faces: ☉ Sun · ☽ Moon · ☿ Mercury · ♀ Venus · ♂ Mars · ♃ Jupiter · ♄ Saturn · ♅ Uranus · ♆ Neptune · ♇ Pluto · ☊ North Node · ☋ South Node. The planet is **the energy** — *what* acts.
- **Sign die** — the twelve zodiac signs ♈ Aries … ♓ Pisces. The sign is **the manner** — *how* it acts.

The **house** — *where* it acts (the life-arena) — is **read from where the Planet die settles** on the board, not from a third die. This is the deliberate marriage of "symbolic astrological dice" with "the landing position matters": the physical throw genuinely determines the arena.

The reading is the classical **Planet-in-Sign-in-House**, plus a fourth signal — the **aspect** — derived from the *angular relationship* between where the two dice land.

### The four signals read from one cast

| Signal | Source | Feeds |
|---|---|---|
| **Planet** | Planet-die face | primary energy → a `modifierRole` + a `theme` + a dimension signature |
| **Sign** | Sign-die face | the manner → element + modality → dimension lean + a `theme` |
| **House** | the house the **Planet die lands in** (1–12) | the arena → a `theme` |
| **Aspect** | the angle between the Planet die's house and the Sign die's house | `certainty` / `volatility` + a `theme` |

The **aspect** is the depth gem: astrological aspects (conjunction, sextile, square, trine, opposition) fall out *naturally* from two physics positions, so the board is never decorative.

---

## Architecture: physics in React, rules in the pure engine

Mirrors the tarot overhaul's `consolidateSpread` pattern and obeys the core constraint (`src/engine/**` and `src/data/**` import no React/DOM).

```
 React (physics)                    pure data / engine (Vitest-tested)
 ───────────────                    ──────────────────────────────────
 CelestialCast component            consolidateCast(cast): AstralResult
   runs 2D physics sim       ──►     drawAstralCast(affinities): AstralCast   (engine-side, no physics)
   reads landing house + aspect      resolveCastSelection(casts, mode): pick  (favored/clouded/choice)
   emits plain-data AstralCast       symbolic-resonance Responders (event system)
```

- **Physics lives only in the component.** It produces a plain-data `AstralCast` and hands it to the engine. No physics types cross into `src/engine`.
- **`consolidateCast(cast)` is pure** and fully unit-tested — the single place the four signals become an `AstralResult` (`themes / dimensions / modifierRoles / tags` + astrological detail).
- **`drawAstralCast(affinities)` is a pure, physics-free generator** used wherever a cast is produced without a UI throw (interaction spawns / "second result"). Both the physics path and this path converge on `consolidateCast`.

### A new result type (no d20 reuse)

A new member is added to the `SlotResult` union:

```ts
type PlanetId = 'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto'|'north-node'|'south-node';
type SignId   = 'aries'|'taurus'|'gemini'|'cancer'|'leo'|'virgo'|'libra'|'scorpio'|'sagittarius'|'capricorn'|'aquarius'|'pisces';
type OmenTag  = 'errant-star' | 'crowned-conjunction' | 'veiled-oracle';
type AspectName = 'conjunction'|'sextile'|'square'|'trine'|'opposition'|'minor';

interface AstralCast {           // plain data emitted by the physics component
  planet: PlanetId;
  planetHouse: number;           // 1..12 — arena; where the Planet die settled
  sign: SignId;
  signHouse: number;             // 1..12 — used only to derive the aspect
  omens: OmenTag[];              // physical landing states (see Meta-interactions)
}

interface AstralResult {         // the consolidated reading; a SlotResult union member
  type: 'astral';
  id: string;                    // e.g. 'astral:mars-aries-h7'
  name: string;                  // e.g. 'Mars in Aries'
  symbol: string;                // a sigil/glyph for slots & history
  interpretation: string;
  planet: PlanetId; sign: SignId; house: number; aspect: AspectName;
  themes: ThemeTag[];            // common divination-result surface (consumed everywhere)
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
  tags: Tag[];
  cast: AstralCast;
}
```

`AstralResult` carries the **same common surface** (`type/id/name/symbol/interpretation/themes/dimensions/modifierRoles/tags`) that generic consumers already read, so `NarrativeAssembler`, `ReadingPlanner.aggregate`, the LLM prompt, history, and synthesis work without special cases. Only the few **type-narrowed display branches** need an `astral` case: `ResultReading`, `HistoryTiles`/`HistoryModal`, `GameTable`/`CardSlot` (slot rendering), and the minigame switch. These are additive — d20's branches are left as-is.

> No `result: number` / `threshold` field exists on `AstralResult` — those were d20 concepts. Astromancy stands on its own surface.

---

## Data layer (`src/data/astromancy.ts`)

One new file. Three tables, a dignity table, and an aspect table. Numbers are **starter values**, locked by tests in the plan.

### Planets — each defines its energy

| Planet | `theme` | `modifierRole` | favorability | certainty | volatility |
|---|---|---|---|---|---|
| Sun ☉ | illumination | subject | +1.0 | +0.5 | 0 |
| Moon ☽ | mystery | subject | +0.5 | −1.0 | +0.5 |
| Mercury ☿ | illumination | action | 0 | +0.5 | +0.5 |
| Venus ♀ | harmony | subject | +1.5 | 0 | −0.5 |
| Mars ♂ | conflict | action | −1.0 | +0.5 | +1.5 |
| Jupiter ♃ | renewal | subject | +1.5 | 0 | +0.5 |
| Saturn ♄ | authority | effect | −0.5 | +1.5 | −0.5 |
| Uranus ♅ | upheaval | effect | 0 | −0.5 | +1.5 |
| Neptune ♆ | mystery | effect | 0 | −1.0 | +0.5 |
| Pluto ♇ | transformation | effect | −0.5 | 0 | +1.5 |
| North Node ☊ | renewal | action | +1.0 | −0.5 | +0.5 |
| South Node ☋ | surrender | effect | −1.0 | 0 | 0 |

### Signs — element + modality drive a dimension lean and a theme

- **Element** — fire `{volatility +, favorability +}` (Aries, Leo, Sagittarius); earth `{certainty +, volatility −}` (Taurus, Virgo, Capricorn); air `{certainty +}` (Gemini, Libra, Aquarius); water `{favorability +, certainty −}` (Cancer, Scorpio, Pisces).
- **Modality** — cardinal `{volatility +}`; fixed `{certainty +, volatility −}`; mutable `{volatility +, certainty −}`.
- Each sign carries the shared `element-*` tag (`element-fire|earth|air|water`) so **cross-method resonance reuses the same element tags tarot suits / trigrams emit** — automatic participation, no special-casing.
- Sign `theme` derives from element (fire→`transformation`, earth→`stagnation`, air→`illumination`, water→`harmony`).

### Houses — board sectors 1–12 → a life-arena theme

| House | Arena | `theme` | | House | Arena | `theme` |
|---|---|---|---|---|---|---|
| 1 | Self | authority | | 7 | Partnership | harmony |
| 2 | Resources | stagnation | | 8 | Death/Rebirth | transformation |
| 3 | Communication | illumination | | 9 | Journeys | illumination |
| 4 | Roots | harmony | | 10 | Career | authority |
| 5 | Creativity | renewal | | 11 | Community | renewal |
| 6 | Work/Health | stagnation | | 12 | The Hidden | mystery |

### Aspects — derived, not stored

`aspectBetween(houseA, houseB)` → `degrees = min(d, 12−d) × 30` where `d = |houseA − houseB|`:

| Degrees | Aspect | Dimension contribution | `theme` |
|---|---|---|---|
| 0 | conjunction | certainty +1.5, volatility +0.5 | — |
| 60 | sextile | favorability +1.0, certainty +0.5 | harmony |
| 90 | square | favorability −0.5, volatility +1.0 | conflict |
| 120 | trine | favorability +1.0, certainty +0.5 | harmony |
| 180 | opposition | certainty +1.0, volatility +1.0 | upheaval |
| 30 / 150 | minor (semi-sextile / quincunx) | volatility +0.5, certainty −0.5 | mystery |

### Dignities — the specific planet↔sign table

A precise table powering the named "Dignity"/"Debility" interactions. Classical rulerships/exaltations and detriments/falls, e.g.:

| Relationship | Examples |
|---|---|
| **Dignified** (rulership/exaltation) | Sun-in-Leo, Moon-in-Cancer, Mars-in-Aries, Venus-in-Taurus/Libra, Jupiter-in-Sagittarius, Saturn-in-Capricorn |
| **Debilitated** (detriment/fall) | Mars-in-Libra, Saturn-in-Aries, Venus-in-Scorpio, Moon-in-Capricorn, Sun-in-Aquarius |

### `consolidateCast(cast): AstralResult` (pure)

1. **dimensions** — sum planet signature + sign element/modality leans + house lean + aspect contribution; normalize for scale; clamp to [−2, +2] at 0.5 granularity.
2. **themes** — gather planet/sign/house/aspect themes; rank by relevance (house arena → planet → aspect → sign) and **cap at 2** (matching tarot's cap).
3. **modifierRoles** — from the planet (union with sign's role if distinct).
4. **tags** — `['draw','random','astral', 'planet-<id>','sign-<id>','house-<n>','element-<el>','aspect-<name>', ...dignityTag, ...omenTags]`. (Uses the generic `draw`/`random` tags so existing tag-matched interaction responders — mirror, critical-resonance, etc. — can apply where appropriate.)
5. **interpretation** — composed line, e.g. *"Mars in Aries, in the House of Partnership — drive meets its arena; the cast runs hot."*

---

## Engine glue (`src/engine/`)

Self-contained for the new method — does **not** touch the d20 roll-modifier layer.

### Registration

- Add `'astral'` to the `DivinationType` union and `DIVINATION_PROFILES` (`themeCoverage`, `themePool`, `dimensionStrengths: ['favorability','volatility','certainty']`, `modifierStrengths`).
- Register `astral` in the `TurnOrchestrator` pool weighting / `QUESTION_WEIGHTS` (alongside, not replacing, `d20`).
- `drawSingleResult('astral')` → `consolidateCast(drawAstralCast(affinities))` for engine-side spawns.

### Cast planning & selection (fresh, astral-owned)

Because physics is authoritative, the engine does not roll — the component runs one or two physics casts and asks the engine to **select**. A small, self-contained planner (no dependency on `dice-modifiers.ts`):

| Mode | Trigger (astral affinity table) | Meaning |
|---|---|---|
| `single` | default | One cast holds. |
| `favored` | Light Ascendant | Two casts thrown; the **more auspicious** holds (higher favorability; tiebreak: more harmonious aspect). |
| `clouded` | Shadow Ascendant | Two casts thrown; the **less auspicious** holds (+ veiled until commit). |
| `choice` | Will Dominant | Two casts thrown; **the player picks** which chart stands (Will). |
| `offer-recast` | Will Stirring (probabilistic) | After a cast, offer a **re-cast** (Will); suppressed in `choice` mode. |

```ts
planAstralCast(): { mode: AstralCastMode; offerRecast: boolean; sources: string[] }
resolveCastSelection(casts: AstralCast[], mode: AstralCastMode): { chosen: AstralCast; index: 0|1; auto: boolean }
```

`completeMinigame` receives the consolidated `AstralResult` + `MinigameMeta`; affinity **feeds** match the existing convention (accept → Fate; recast/pick → Will; a conferred mode does not itself feed an affinity).

### Affinity-as-force (component-level; documented, not unit-tested)

Affinities become **forces in the sim**; the landing house + aspect are read from where dice settle:

- **Chaos** → launch turbulence (randomized impulse/spin); more scatter → more extreme aspects, more off-board omens.
- **Order** → a centering pull toward balanced houses; calmer settle, tighter aspects.
- **Light** → a subtle bias toward benefic houses / harmonious aspects.
- **Shadow** → bias toward malefic houses **and** sets the veiled state (`poolPreview === 'hidden'`) so the reading stays shrouded until commit.

**House & aspect are physics-authoritative** (read from final resting positions). **The glyph faces** (which planet / which sign) are drawn via `drawAstralCast` (affinity-biased) and revealed as the die settles — a 2D top-down die cannot physically tumble through twelve faces, so the *position* carries the physical truth while the *face* is the drawn symbol. (A future 3D renderer could make faces physical too; not required.)

**Fairness / settle handling:** the component detects rest (sleeping body), reads the landing house from position (angular sector) and computes the aspect. A die resting **off the board** or **overlapping the other** becomes an **omen** (below); a hard cap prevents pathological scatter.

---

## Meta-interactions = specific symbolic resonances

Discrete, named, condition-matched `Responder`s — unique effects between *specific* things, like tarot's `suit-accord` / `elemental-clash` / `major-convergence` — **not** broad affinity-band nudges. Dispatched at new triggers (`astral:cast`, `astral:commit`) through the **existing event system**. Final roster/effects locked in the plan; the catalogue:

**Within the cast:**
- **Dignity** — planet in a sign it rules/is exalted in (dignity table). Amplifies that planet's dominant dimension.
- **Debility** — planet in detriment/fall. A specific twist/weakening.
- **The Great Trine** — `trine` aspect with a benefic planet (Jupiter/Venus). A strong favorable resonance.
- **The Duel** — planet `mars` at `square`/`opposition`. A specific conflict/upheaval effect.
- **Saturn's Gate** — planet `saturn` landing in House 1 or 10. A gating/cost effect.

**Physical omens (each its own named interaction):**
- **The Errant Star** — a die rests **off the board** → one specific effect.
- **Conjunction Crowned** — dice **stacked / touching** → one specific effect.
- **The Veiled Oracle** — a die **cocked / overlapping** → one specific effect (ambiguity; re-read or shroud).

**Cross-method (resonance with already-committed slots):**
- Reuses shared `element-*` tags so a fiery planet/sign resonates with a committed **Wands**-suit (fire) tarot slot or a fire trigram — automatic participation through tag matching.

Omens surface through the existing `InteractionSequencer` (resolve-then-narrate), like all event-driven effects.

---

## Components (`src/components/`)

- **NEW `CelestialCast`** — a **2D physics** world (recommended: `matter.js`) rendering two glyph dice and the 12-house wheel from above. Real rigid-body **bounce, roll, and spin**; throws on tap; applies affinity forces; detects settle; reads the landing house + aspect; reveals the drawn faces; emits the `AstralCast`. This is the dedicated physics seam — the minigame and engine are not coupled to the renderer.
- **NEW `AstralMinigame`** — drives the cast: `planAstralCast()` → one or two physics casts → `resolveCastSelection` (favored/clouded auto, choice = player taps a chart) → offered re-cast → `completeMinigame`. Honors the veiled (Shadow) state; keeps a reveal-delay discipline so animation finishes before transitions. (Modeled on `DiceMinigame` *structure* but a separate file; d20's component is untouched.)
- A **glyph/sigil set** for planets, signs, and houses (SVG, in the spirit of tarot's `CardSigil`), used on dice faces, the result display, and history.
- Wire the new minigame into the screen switch (`GameTable`) for `method === 'astral'`, alongside the existing d20 case.

### Dependencies

- Add **`matter.js`** (2D rigid-body physics — genuine bounce/roll/spin at low bundle cost). The engine/data layer stays renderer-agnostic; only `CelestialCast` imports it. Note bundle-size impact in the plan.

---

## Testing

Vitest covers **engine/data only** (Node env); components are **build-verified** (`tsc -b`). Physics is not unit-tested; the *mapping* from a settled cast to a reading is.

**Pure unit tests:**
- `consolidateCast` — dimensions clamp to [−2,2] at 0.5; themes cap at 2 and rank by relevance; tags include `astral/planet-*/sign-*/house-*/element-*/aspect-*`; `type: 'astral'`; id/name composed.
- `aspectBetween` — every house pair → correct degree bucket; symmetric.
- dignity lookup — known dignified/debilitated pairs flagged; neutral not.
- `drawAstralCast` — valid faces/houses; affinity bias directionally correct (stub `Math.random`).
- `resolveCastSelection` — favored picks higher favorability; clouded lower; tie → harmonious-aspect tiebreak; choice → `auto:false`.
- `planAstralCast` — affinity table → mode (Light→favored, Shadow→clouded, Will Dominant→choice); debug-forceable.
- responders — each symbolic resonance fires on its precise condition and not otherwise; omen responders fire on their omen tag; cross-method element resonance matches a committed fire slot.
- registration — `DIVINATION_PROFILES.astral` exists; orchestrator can pool `astral`.

**Debug scenarios** (`src/engine/events/scenarios.ts`): one per symbolic resonance and omen (staging the precondition the `condition` needs), plus favored/clouded/choice/offer-recast casts.

**Documentation:** update [docs/game-systems.md](../../game-systems.md) and the README in the same change (per CLAUDE.md) — the new method, the reading model, the symbolic-resonance catalogue, and the cast modes.

---

## Phasing (single spec, tarot-style phases)

1. **Data + pure reading** — `astromancy.ts` tables (planets/signs/houses/dignities/aspects), `AstralCast`/`AstralResult` types, `consolidateCast`, `aspectBetween`, `drawAstralCast`. Fully tested. No UI.
2. **Engine registration + cast logic** — `DivinationType`/profile/orchestrator registration; `planAstralCast`, `resolveCastSelection`; affinity feeds. Tested.
3. **Symbolic-resonance responders + omens** — named interaction `Responder`s at `astral:*` triggers + debug scenarios. Tested.
4. **2D physics component** — `CelestialCast` (matter.js), affinity-as-force, settle/house/aspect detection, face reveal, omen emission; `AstralMinigame`; glyph sigils; wire into `GameTable` + the additive `astral` display branches. Build-verified.
5. **Docs** — `game-systems.md` + README.

Each phase ends green under `npm run build` and `npm test`; commit per task (TDD where logic is involved).

---

## Scope / non-goals

- **A new method beside d20**, not a d20 rewrite. The old d20 code is untouched and removed by the user later; astromancy never depends on it.
- **No changes to Tarot or I Ching**, and nothing that touches files the in-flight `tarot-overhaul` branch edits. This work proceeds on its own branch/worktree and integrates later.
- Happenings remain affinity-only (no gameplay effects).
- Physics is presentation; all *rules* live in pure, tested engine/data code.
- No generalized cross-divination effect bus (separate future work).

## Appendix — future divination methods (menu, not built here)

The user intends to expand the number of methods. Candidates that fit the `consolidate*`-into-one-slot pattern and the affinity/tag systems:

- **Astragalomancy (casting the lots)** — throw five marked oracle-bones; each combination maps to a named oracle line. Reuses the matter.js cast setup.
- **Tibetan "Mo" dice** — one or two dice index a calm, verse-based oracle; a slow, ritual counterpart to the energetic astromancy cast.
- **Geomancy** — four "Mothers" from random odd/even marks → sixteen figures → a shield chart; deeply procedural, pairs with I Ching's binary feel.
- **Scrying / pendulum** — a continuous-motion (non-dice) method for variety; needs its own input model.

Each future method gets its own spec → plan → implementation cycle, reusing this method's physics seam and the pure-`consolidate` pattern.
