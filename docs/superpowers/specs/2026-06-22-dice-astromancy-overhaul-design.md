# Dice Minigame Overhaul — "Casting the Heavens" (Astromancy) — Design

**Date:** 2026-06-22
**Status:** Draft (design); pending user review before implementation planning
**Scope:** The d20 dice minigame, its data layer, and the engine that drives it. **No changes to Tarot or I Ching** (the tarot overhaul is in active development on another branch — this work must not touch tarot data, responders, or components).

## Problem

The dice minigame is the shallowest of the three pillars. It is a single d20 whose only output is one of five fixed thresholds (`critical-low` … `critical-high`) → a canned interpretation, themes, and dimensions ([src/data/dice.ts](../../../src/data/dice.ts)). Its presentation is a count-up number animation ([src/components/screens/DiceThrowAnimation.tsx](../../../src/components/screens/DiceThrowAnimation.tsx)) — explicitly marked in-code as "the single seam for a future physics-based throw."

Two gaps:

1. **Feel.** Numbers ticking up read as a UI widget, not a divination ritual — out of step with the depth the tarot overhaul is bringing.
2. **Depth.** Real dice divination (cleromancy) reads *relationships and where the dice land*, not a lone number. The current method reads neither.

A roll-*modifier* layer already exists (single / advantage / disadvantage / choice / offer-reroll) from the [dice-roll-modifier system](2026-06-21-dice-roll-modifier-system-design.md). That layer is healthy; what is thin is the **reading itself**.

## Goal

Reimagine the d20 method as **astromancy** — casting glyph-carved dice onto a zodiacal house board, read as **Planet-in-Sign-in-House** with astrological **aspects** emerging from where the dice physically land — rendered with a **real 3D physics throw** in which **affinities are physical forces**. Reach the depth bar set by the tarot overhaul (procedural reading, multi-signal consolidation, named meta-interactions), while keeping the engine framework-free and testable.

This is delivered as **one phased spec** (no decomposition). Other future divination methods are listed in an appendix only — not built here.

---

## The cast

Two twelve-faced dice are cast onto a **12-house zodiac board** (a wheel of twelve 30° sectors):

- **Planet die** — twelve faces, the classical seven plus the modern three plus the two lunar nodes:
  ☉ Sun · ☽ Moon · ☿ Mercury · ♀ Venus · ♂ Mars · ♃ Jupiter · ♄ Saturn · ♅ Uranus · ♆ Neptune · ♇ Pluto · ☊ North Node · ☋ South Node.
  The planet is **the energy** — *what* acts.
- **Sign die** — the twelve zodiac signs ♈ Aries … ♓ Pisces. The sign is **the manner** — *how* it acts.

The **house** — *where* it acts (the life-arena) — is **read from where the Planet die settles** on the board, not from a third die. This is the deliberate marriage of "symbolic astrological dice" with "the landing position matters": the physical throw genuinely determines the arena.

The reading is therefore the classical **Planet-in-Sign-in-House**, plus a fourth signal — the **aspect** — derived from the *angular relationship* between where the two dice land.

### The four signals read from one cast

| Signal | Source | Feeds |
|---|---|---|
| **Planet** | Planet-die face-up | primary energy → a `modifierRole` + a `theme` + a dimension signature |
| **Sign** | Sign-die face-up | the manner → element + modality → dimension lean + a `theme` |
| **House** | the house the **Planet die lands in** (1–12) | the arena → a `theme` |
| **Aspect** | the angle between the Planet die's house and the Sign die's house | `certainty` / `volatility` + a `theme` |

The **aspect** is the depth gem: astrological aspects (conjunction, sextile, square, trine, opposition) fall out *naturally* from two physics positions, so the board is never decorative.

---

## Architecture: physics in React, rules in the pure engine

This mirrors the tarot overhaul's `consolidateSpread` pattern and obeys the core constraint (`src/engine/**` and `src/data/**` import no React/DOM).

```
 React (physics)                    pure data / engine (Vitest-tested)
 ───────────────                    ──────────────────────────────────
 CelestialCast component            consolidateCast(cast): DiceResult
   runs cannon-es 3D sim    ──►     drawAstralCast(affinities): AstralCast   (engine-side, no physics)
   reads face + landing house       resolveCastSelection(casts, mode): pick  (advantage/disadvantage/choice)
   emits plain-data AstralCast       symbolic-resonance Responders
```

- **Physics lives only in the component.** It produces a plain-data `AstralCast` and hands it to the engine. No physics types cross into `src/engine`.
- **`consolidateCast(cast)` is pure** and fully unit-tested — it is the single place the four signals become `themes / dimensions / modifierRoles / tags`. Affinity-as-force is emergent in the sim; this function only maps *what landed*.
- **`drawAstralCast(affinities)` is a pure, physics-free generator** used by the engine wherever a cast must be produced without a UI throw (interaction spawns / "second result"), carrying the affinity bias the old `rollD20` had. Both the physics path and this path converge on `consolidateCast`.

### The plain-data cast

```ts
type PlanetId = 'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto'|'north-node'|'south-node';
type SignId   = 'aries'|'taurus'|'gemini'|'cancer'|'leo'|'virgo'|'libra'|'scorpio'|'sagittarius'|'capricorn'|'aquarius'|'pisces';
type OmenTag  = 'errant-star' | 'crowned-conjunction' | 'veiled-oracle';

interface AstralCast {
  planet: PlanetId;
  planetHouse: number;   // 1..12 — arena; where the Planet die settled
  sign: SignId;
  signHouse: number;     // 1..12 — used only to derive the aspect
  omens: OmenTag[];      // physical landing states (see Meta-interactions)
}
```

### Backward compatibility

`consolidateCast` returns the existing `DiceResult` shape so every current consumer keeps working — exactly how the tarot overhaul kept `type: 'tarot'` and added an optional `spread?`:

- `type` stays `'d20'` (no change to the `SlotResult` union, the orchestrator pool, `DIVINATION_PROFILES.d20`, history, or the reroll path).
- `result: number` and `threshold: Threshold` are **derived from the consolidated `favorability`** so `THRESHOLD_COLORS`, history badges, and any numeric/threshold consumer still function.
- New **optional** fields carry the astrological detail for display and for responders:
  `planet?, sign?, house?, aspect?, cast?: AstralCast`.

> Renaming the type to `'astral'`/`'dice'` was rejected for this spec: it ripples through the union and every consumer for no functional gain, and risks colliding with the in-flight tarot work. Kept as `'d20'`.

---

## Data layer (`src/data/`)

New file **`src/data/astromancy.ts`** (the dice data file `src/data/dice.ts` is refactored to delegate to it; `rollD20`'s numeric-bias role is superseded by `drawAstralCast`). Three tables plus a dignity table and an aspect table.

### Planets

Each planet defines its energy. Numbers below are **starter values**, finalized and locked by tests in the plan.

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

### Signs

Element and modality drive a dimension lean and a theme.

- **Element** — fire `{volatility +, favorability +}` (Aries, Leo, Sagittarius); earth `{certainty +, volatility −}` (Taurus, Virgo, Capricorn); air `{certainty +}` (Gemini, Libra, Aquarius); water `{favorability +, certainty −}` (Cancer, Scorpio, Pisces).
- **Modality** — cardinal `{volatility +}`; fixed `{certainty +, volatility −}`; mutable `{volatility +, certainty −}`.
- Each sign carries the shared `element-*` tag (`element-fire|earth|air|water`) so **cross-method resonance reuses the same element tags the tarot suits emit** — automatic participation, no special-casing.
- Sign `theme` derives from element (fire→`transformation`, earth→`stagnation`, air→`illumination`, water→`harmony`).

### Houses (board sectors 1–12)

Each house maps to a life-arena theme. Houses are arranged on the wheel in order, 30° apart, so house index drives aspect geometry.

| House | Arena | `theme` | | House | Arena | `theme` |
|---|---|---|---|---|---|---|
| 1 | Self | authority | | 7 | Partnership | harmony |
| 2 | Resources | stagnation | | 8 | Death/Rebirth | transformation |
| 3 | Communication | illumination | | 9 | Journeys | illumination |
| 4 | Roots | harmony | | 10 | Career | authority |
| 5 | Creativity | renewal | | 11 | Community | renewal |
| 6 | Work/Health | stagnation | | 12 | The Hidden | mystery |

### Aspects (derived, not stored)

`aspectBetween(houseA, houseB)` → `degrees = min(d, 12−d) × 30` where `d = |houseA − houseB|`:

| Degrees | Aspect | Dimension contribution | `theme` |
|---|---|---|---|
| 0 | conjunction | certainty +1.5, volatility +0.5 | — |
| 60 | sextile | favorability +1.0, certainty +0.5 | harmony |
| 90 | square | favorability −0.5, volatility +1.0 | conflict |
| 120 | trine | favorability +1.0, certainty +0.5 | harmony |
| 180 | opposition | certainty +1.0, volatility +1.0 | upheaval |
| 30 / 150 | minor (semi-sextile / quincunx) | volatility +0.5, certainty −0.5 | mystery |

### Dignities (the specific planet↔sign table)

A precise table of planet-in-sign relationships, powering the named "Dignity"/"Debility" interactions (below). Classical rulerships/exaltations and detriments/falls, e.g.:

| Relationship | Examples |
|---|---|
| **Dignified** (rulership/exaltation) | Sun-in-Leo, Moon-in-Cancer, Mars-in-Aries, Venus-in-Taurus/Libra, Jupiter-in-Sagittarius, Saturn-in-Capricorn |
| **Debilitated** (detriment/fall) | Mars-in-Libra, Saturn-in-Aries, Venus-in-Scorpio, Moon-in-Capricorn, Sun-in-Aquarius |

### `consolidateCast(cast): DiceResult` (pure)

1. **dimensions** — sum the planet signature + sign element/modality leans + house lean + aspect contribution; divide to keep scale sane; clamp to [−2, +2] at 0.5 granularity.
2. **themes** — gather planet/sign/house/aspect themes; rank by relevance (house arena first, then planet, then aspect, then sign) and **cap at 2** (matching tarot's consolidation cap).
3. **modifierRoles** — from the planet (union with sign's role if distinct).
4. **tags** — `['roll','random', 'planet-<id>','sign-<id>','house-<n>','element-<el>','aspect-<name>', ...dignityTag, ...omenTags]` plus a derived threshold tag for backward compat.
5. **result / threshold** — derive a 1–20 score and `Threshold` from `favorability` so legacy consumers and `THRESHOLD_COLORS` keep working.
6. **interpretation** — composed line, e.g. *"Mars in Aries, in the House of Partnership — drive meets its arena; the cast runs hot."*

---

## Engine wiring (`src/engine/`)

### Reshaping the existing modifier modes (confirmed)

The roll-modifier layer (`resolveRollMode`, `AFFINITY_ROLL_MODIFIERS`, `planDiceRoll`) **stays**; only its *meaning in the dice domain* changes. Because physics is authoritative, the engine no longer rolls the dice — the component runs one or two physics casts and hands the resulting `AstralCast`(s) to the engine for **selection**:

| Mode | Source (unchanged trigger table) | New cast-domain meaning |
|---|---|---|
| `single` | default | One cast holds. |
| `advantage` | Light Ascendant | Two casts thrown; the **more auspicious** holds (higher consolidated favorability; tiebreak: more harmonious aspect). |
| `disadvantage` | Shadow Ascendant | Two casts thrown; the **less auspicious** holds (+ veiled). |
| `choice` | Will Dominant | Two casts thrown; **the player picks** which whole chart stands (Will). |
| `offer-reroll` | Will Stirring (probabilistic) | After a cast, offer a **re-cast** (Will); suppressed in `choice` mode as today. |

New/changed engine API (pure where possible):

```ts
resolveRollMode(mods): { mode: RollMode; offerReroll: boolean }   // UNCHANGED
planDiceRoll(): RollPlan                                          // unchanged shape; sources captioned astrologically
resolveCastSelection(casts: AstralCast[], mode: RollMode): { chosen: AstralCast; index: 0|1; auto: boolean }
drawAstralCast(affinities): AstralCast                            // pure engine-side generator (spawns / second-result)
```

`completeMinigame` still receives a consolidated `DiceResult` + `MinigameMeta`; the affinity **feeds** are unchanged (accept → Fate; reroll/pick → Will; a *conferred* mode does not itself feed an affinity).

### Affinity-as-force (component-level; documented, not unit-tested)

Affinities stop being numeric fudges and become **forces in the sim** (the result is read from where dice settle):

- **Chaos** → launch turbulence (randomized angular/linear impulses); higher Chaos = wider scatter → more extreme aspects and more off-board omens.
- **Order** → a radial spring pulling dice toward the board's centre / balanced houses; calmer settle, tighter aspects.
- **Light** → a subtle table tilt toward benefic houses; nudges toward harmonious aspects.
- **Shadow** → tilt toward malefic houses **and** sets the existing veiled state (`poolPreview === 'hidden'`) so the reading stays shrouded until commit (same rule the current die and I Ching already honor).

**Fairness / settle handling:** the component detects when each die has come to rest (sleeping body), reads the up-face (body quaternion → nearest face normal) and the landing house (xz-position → angular sector). A die that comes to rest **cocked** or **off the board** becomes an **omen** (below) rather than an invalid read; a hard cap prevents pathological infinite scatter.

---

## Meta-interactions = specific symbolic resonances (confirmed)

Per the decision, the meta layer is **discrete, named, condition-matched `Responder`s** — unique effects between *specific* things, the way `suit-accord` / `elemental-clash` / `major-convergence` work for tarot — **not** broad affinity-band nudges (those remain in the affinity responders). Each has a precise `condition`, not a band gate. Final roster and effects are locked in the plan; the catalogue:

**Within the cast (planet/sign/house/aspect combinations):**
- **Dignity** — planet in a sign it rules/is exalted in (from the dignity table). Effect: amplifies that planet's dominant dimension (a focused, potent reading).
- **Debility** — planet in detriment/fall. Effect: a specific twist/weakening of the reading.
- **The Great Trine** — aspect `trine` with a benefic planet (Jupiter/Venus). Effect: a strong favorable resonance.
- **The Duel** — planet `mars` at `square`/`opposition`. Effect: a specific conflict/upheaval effect.
- **Saturn's Gate** — planet `saturn` landing in House 1 or 10. Effect: a gating/cost effect.

**Physical omens (each its own named interaction, not a generic nudge):**
- **The Errant Star** — a die comes to rest **off the board** → one specific effect (a force beyond the chart).
- **Conjunction Crowned** — dice **stacked / touching** → one specific effect (an intensified union).
- **The Veiled Oracle** — a die **cocked** (not flat) → one specific effect (an ambiguous reading; re-read or shroud).

**Cross-method (resonance with already-committed slots):**
- Reuses the shared `element-*` tags so a fiery planet/sign resonates with a committed **Wands**-suit (fire) tarot slot or a fire trigram — automatic participation through tag matching, exactly as tarot interactions already do. No bespoke cross-wiring.

Omens are surfaced through the existing `InteractionSequencer` (resolve-then-narrate), consistent with how all event-driven effects already play.

---

## Components (`src/components/`)

- **NEW `CelestialCast` component** (replaces the count-up `DiceThrowAnimation` internals at the established seam): a cannon-es physics world + a thin three.js (or 2D-canvas-projected) renderer of two glyph dice and the house-wheel board. Throws on tap, applies affinity forces, detects settle, reads `AstralCast`, and reports it up. Reusing the seam means `DiceMinigame` and the engine are not coupled to the renderer.
- **`DiceMinigame` rewrite** — drives the cast through `planDiceRoll()` → one or two physics casts → `resolveCastSelection` (advantage/disadvantage auto, choice = player taps a chart) → offered re-cast → `completeMinigame`. Honors the veiled (Shadow) state. Keeps the `REVEAL_DELAY_MS` discipline so animations finish before the screen transitions.
- A small **glyph/sigil set** for planets, signs, and houses (SVG, in the spirit of the tarot overhaul's `CardSigil`), used both on the dice faces and in the result display / history.

### Dependencies

- Add **`cannon-es`** (3D physics) and a minimal renderer (`three`, or a hand-rolled 2D canvas projection if we keep bundle small). Exact renderer choice is a plan-time decision; the engine/data layer is renderer-agnostic. Note bundle-size impact in the plan.

---

## Testing

Per CLAUDE.md, Vitest covers **engine/data only** (Node env); components are **build-verified** (`tsc -b`). Physics is not unit-tested; the *mapping* from a settled cast to a reading is.

**Pure unit tests:**
- `consolidateCast` — dimensions clamp to [−2,2] at 0.5; themes cap at 2 and rank by relevance; tags include `planet-*/sign-*/house-*/element-*/aspect-*`; derived `result`/`threshold` track favorability; single-signal edge cases.
- `aspectBetween` — every house pair yields the correct degree bucket; symmetric.
- dignity lookup — known dignified/debilitated pairs flagged; neutral pairs not.
- `drawAstralCast` — returns valid faces/houses; affinity bias is directionally correct (stub `Math.random`).
- `resolveCastSelection` — advantage picks higher favorability; disadvantage lower; tie → harmonious-aspect tiebreak; choice returns `auto:false`.
- `resolveRollMode` — unchanged behavior preserved (regression).
- responders — each symbolic resonance fires on its precise condition and not otherwise; omen responders fire on their omen tag; cross-method element resonance matches a committed fire slot.

**Debug scenarios** (`src/engine/events/scenarios.ts`): one per symbolic resonance and omen (staging the precondition the `condition` needs, per the forced≠unconditional rule), plus advantage/disadvantage/choice/offer-reroll casts.

**Documentation:** update [docs/game-systems.md](../../game-systems.md) and the README dice sections in the same change (per CLAUDE.md), covering the new reading model, the symbolic-resonance catalogue, and the reshaped modifier meanings.

---

## Phasing (single spec, tarot-style phases)

1. **Data + pure reading** — `astromancy.ts` tables (planets/signs/houses/dignities/aspects), `AstralCast`, `consolidateCast`, `aspectBetween`, `drawAstralCast`; refactor `dice.ts` to delegate. Fully tested. No UI.
2. **Engine wiring** — `DiceResult` optional astrological fields; `resolveCastSelection`; reshape the modifier modes onto casts; affinity feeds confirmed. Tested.
3. **Symbolic-resonance responders + omens** — named interaction `Responder`s + debug scenarios. Tested.
4. **3D physics component** — `CelestialCast` (cannon-es + renderer), affinity-as-force, settle/face/house detection, omen emission; `DiceMinigame` rewrite; glyph sigils. Build-verified.
5. **Docs** — `game-systems.md` + README.

Each phase ends green under `npm run build` and `npm test`; commit per task (TDD where logic is involved).

---

## Scope / non-goals

- **No changes to Tarot or I Ching** — and specifically nothing that touches files the in-flight `tarot-overhaul` branch is editing. This work proceeds on its own branch/worktree and integrates later.
- Happenings remain affinity-only (no gameplay effects).
- Physics is presentation; all *rules* live in pure, tested engine/data code.
- No generalized cross-divination effect bus (that remains the separate "Approach B" future work noted in the dice-modifier spec).

## Appendix — future divination methods (menu, not built here)

The user intends to expand the number of divination methods. Candidates that fit the engine's `consolidate*`-into-one-slot pattern and the affinity/tag systems:

- **Astragalomancy (casting the lots)** — throw five marked knucklebones/oracle-bones; each combination maps to a named oracle line (ancient Greek temple oracles). Very tag-friendly; light physics reuse of the cannon-es setup.
- **Tibetan "Mo" dice** — one or two dice index a calm, verse-based oracle; a deliberately *slow, ritual* counterpart to the energetic astromancy cast.
- **Geomancy** — generate four "Mothers" from random odd/even marks → sixteen figures → a shield chart; deeply procedural, pairs naturally with I Ching's binary feel.
- **Scrying / pendulum** — a continuous-motion (non-dice) method for variety; would need its own input model.

Each future method would get its own spec → plan → implementation cycle, reusing this overhaul's physics seam and the pure-`consolidate` pattern.
