# Dice Skill-Check Minigame — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm) → ready for implementation plan

## Overview

The dice minigame is the game's oldest and least-polished method — a flat
count-up of a single d20 inside a box, while Tarot, I Ching, Astral, and Rune all
have a physical play surface and a richer reading. The original "overhaul"
diverged so far it became a *separate* method (Astral). This redesign instead
**doubles down on the d20's identity** — the game's pure chance/odds pillar and
its tabletop-RPG anchor — and gives it the tactile object and resolution drama
the others have, without wandering into another symbol system.

The reframed dice minigame is a **D&D skill check**:

1. A real 3D **icosahedron** you **flick** into a casting bowl; it tumbles and
   settles on a face (three.js + cannon-es, reusing Astral's proven scene
   pattern).
2. The roll is resolved against a **Difficulty Class set by the rest of your
   reading** — dice becomes the *only* method that responds to the other slots.
3. **Bless/Bane dice** (d4s granted/imposed by the reading-so-far) add to or
   subtract from the roll — the faithful D&D way to introduce "more dice types."
4. A **Baldur's Gate 3-style tally**: each die fires a projectile into a running
   total that races a **DC marker** and punches dramatically on success/failure.
5. **Natural 20 / Natural 1** are Triumph / Fumble critical events with their own
   flourish — dice's answer to Rune omens / Astral aspects.

Output remains a single `DiceResult` (one `SlotResult` per minigame, as the
engine expects). What changes is that its threshold tier is computed **relative
to the DC** instead of from absolute value bands, and it carries a check
`breakdown` for narration.

### What stays (unchanged behavior)

- The d20 itself: a single value 1–20, affinity-biased (chaos→extremes,
  order→center) via `rollD20` in [src/data/dice.ts](../../../src/data/dice.ts).
- The five threshold tiers (`critical-low … critical-high`) and their
  `themes`/`dimensions`/`modifierRoles` — only the *interpretation strings* and
  *how the tier is selected* change.
- The four roll modes — **advantage / disadvantage / choice / reroll** — and
  their affinity gating (light→advantage, shadow→disadvantage, will→choice,
  via the `dice:roll` responder pipeline in
  [responders/affinity.ts](../../../src/engine/responders/affinity.ts)).
- The affinity feed path (`revealedAsDrawn`→Fate, `viaReroll`→Will; result tags
  feed Order/Chaos), and the **veiled-until-commit** Shadow mechanic.
- Existing meta-interactions keyed on the dice tier (e.g. a `critical-high` d20)
  keep working — the tier is still one of the five (see Compatibility below).

### Non-goals / scope decisions

- **No spatial/positional reading.** Where the die rests adds no meaning — that
  was the "too different" drift that became Astral, and it overlaps Astral's
  house system. The face value + the check is the whole reading.
- **No player-chosen check die.** The d20 is always the check die; the other dice
  are Bless/Bane modifiers, never alternative check dice. (Avoids the
  scaling mess of rolling a d6 against a d20 DC.)
- **No new affinity behaviors / no change to the affinity→mode mapping.**
  Affinities shape *how you roll* (the modes, as today); the reading shapes *the
  bar and the blessing* (DC + Bless/Bane). Clean separation of concerns.
- **Bless/Bane are reading-driven in v1.** They derive from the prior committed
  slots, not from affinity responders. The `dice:roll` draft is widened so
  responders *could* contribute them later (extensibility seam), but no affinity
  responder does so in v1.
- DC bands and tier margins are authored to be good-enough and **tunable** in
  playtest; balance is not blocking.

## Core loop & phases

Phase machine mirrors `AstralMinigame` / `RuneMinigame`. The new beat is the
**tally resolution** between the physical settle and the outcome.

1. **`idle`** — the casting bowl breathes; the **DC marker** is shown ("DC 14"),
   veiled to "DC ?" under Shadow. A flick affordance sits over the bowl. Heading:
   "Cast the die."
2. **`aiming`** — press-and-drag back; a pull-back vector previews
   direction + power (the flick).
3. **`throwing`** — release. Pointer velocity maps to a cannon-es impulse + spin;
   the icosahedron flies in, tumbles, rattles the rim, and settles. In
   adv/dis/choice, **two** dice are thrown.
4. **`smash`** *(advantage / disadvantage only)* — both dice settle face-up; the
   **kept die** (higher for advantage, lower for disadvantage) lifts
   kinematically, hovers over the other, then **smashes down** — a downward
   impulse ejects the loser from the bowl as the kept die lands center. (Choice:
   no smash; the player taps a die and it rises in victory. Single: skipped.)
5. **`tally`** — the BG3 resolution. The kept d20 **fires a mote into the tally**
   → the total springs to the d20 value. Then, **if the reading granted any**,
   the **Bless/Bane d4s physically tumble into the bowl as their own beat** (after
   the d20 is resolved, so the d20 stays the star), settle on their face, and each
   then fires its mote: **Bless** a **gold** `+n`, **Bane** a **red** `−n`, the
   running total counting up/down per impact. (Most throws have no d4 — a d4
   *appearing* signals the reading is tilting the roll.) The total lands hard
   against the **DC marker**: cross → gold/green success flare; short → red
   failure. **Nat-20 / Nat-1** override the whole beat with a Triumph / Fumble
   flourish.
6. **`reading`** — the relative tier resolves into the badge + interpretation
   (Astral-style result block). Shadow shows "The die rests, its meaning
   shrouded…" until commit.
7. **agency beat** — `choice` (Will: tap a die) / `offerReroll` (Will-stirring:
   "↺ Reroll / Keep it") / auto-commit (Fate / single) after the reveal beat.
8. **`done`** — committed; the `DiceResult` becomes the turn's `SlotResult`.

## The check (engine — `src/engine/dice.ts`, the `astral.ts`/`runes.ts` analog)

Framework-free. `data/dice.ts` keeps the dataset (`rollD20`, threshold data);
`engine/dice.ts` is new and owns the *check* (plan + resolve).

### Difficulty Class — `planDiceCheck(priorSlots)`

```ts
export interface DiceCheckPlan {
  dc: number;          // clamped to [5, 17]
  bless: number;       // count of +d4 (0..1 in v1)
  bane: number;        // count of -d4 (0..1 in v1)
  sources: string[];   // human-readable reasons for the UI marquee
}

planDiceCheck(priorSlots: SlotResult[]): DiceCheckPlan
```

- **`priorSlots`** = the committed, non-happening slots already revealed *this
  turn* (`state.turnResults` minus the active slot and happenings). When dice is
  drawn first, this is empty.
- **DC formula (balance / rising stakes):**

  ```
  // magnitude-weighted mean of each prior slot's dimensions.favorability,
  // same weighting ReadingPlanner.aggregate uses so strong pulls dominate.
  priorFav = sum(f * |f|) / sum(|f|)   for f = slot.dimensions.favorability  // ~[-2, +2]
  dc = clamp(round(11 + 2.5 * priorFav), 5, 17)                              // 0 priors → DC 11
  ```

  Baseline 11 = the d20's neutral center. A **favorable** reading-so-far **raises**
  the bar (fate demands proof of the trend); a **grim** one **lowers** it (room to
  recover). Empty priors → DC 11 (near coin-flip). *(An optional small
  order/chaos nudge term is left out of v1 for clarity; affinities already bias
  the roll and the modes.)*

- **Bless / Bane (reading-driven, bounded):**
  - any prior slot with `favorability ≥ +1.0` → **`bless = 1`** (+1d4), source =
    that slot's name ("The Sun blesses the cast, +1d4").
  - any prior slot with `favorability ≤ −1.0` → **`bane = 1`** (−1d4), source =
    that slot's name ("The Tower curses the cast, −1d4").
  - both may be true on a mixed reading → a +d4 *and* a −d4 both fire into the
    tally (the tug-of-war reads well in the BG3 animation).

### Resolution — `resolveCheck(d20, plan, rng?)`

```ts
export interface DiceCheckBreakdown {
  d20: number;                          // the kept natural d20 (1..20)
  bless: number[];                      // rolled d4 values added (each 1..4)
  bane: number[];                       // rolled d4 values subtracted (each 1..4)
  dc: number;
  total: number;                        // d20 + sum(bless) - sum(bane)
  margin: number;                       // total - dc
  tier: Threshold;                      // RELATIVE tier (one of the existing five)
  critical: 'triumph' | 'fumble' | null;
}

resolveCheck(d20: number, plan: DiceCheckPlan, rng?): {
  result: DiceResult; breakdown: DiceCheckBreakdown;
}
```

Rolls the Bless/Bane d4s (uniform; `rng` injectable for tests), computes the
total and margin, then selects the tier:

- **`d20 === 20`** → tier `critical-high`, `critical: 'triumph'` (overrides DC).
- **`d20 === 1`** → tier `critical-low`, `critical: 'fumble'` (overrides DC).
- otherwise by `margin = total − dc`:

  | margin | tier |
  |---|---|
  | `≥ +5` | `critical-high` (strong success) |
  | `0 … +4` | `high` (success — meets or beats DC) |
  | `−1 … −4` | `neutral` (narrow miss) |
  | `−5 … −9` | `low` (failure) |
  | `≤ −10` | `critical-low` (grave failure) |

The selected tier supplies `themes`/`dimensions`/`modifierRoles` from the
existing `THRESHOLD_DATA`; the **interpretation** comes from a new check-flavored
string set (e.g. `high` → "The reading set the bar at {dc}; your cast clears it
— the path holds."). `result.result` stays the **natural d20** (so criticals and
the `the dice (N)` atomic-signal label are unchanged); the total/DC live in
`result.check`.

### Type changes (`src/engine/types.ts`)

- Add `DiceCheckBreakdown` (above).
- `DiceResult` gains `check?: DiceCheckBreakdown` (present for check results).
- `DiceResult.tags` gain `'triumph'` / `'fumble'` on criticals (additive).
- `RollModifier` *may* gain `'bless' | 'bane'` and `PhaseDraft` gains
  `dc?` / `blessDice?` / `baneDice?` — the extensibility seam so a future
  responder can contribute Bless/Bane through the `dice:roll` pipeline. v1 seeds
  these from `planDiceCheck`; no responder pushes them yet.

### Compatibility

Because the tier is still one of the five thresholds and the `low`/`high`/
`neutral`/`critical-*` tags are still emitted, **existing dice meta-interactions
keep working** — they now simply fire relative to the DC. `triumph`/`fumble` are
new, additive tags. `rollD20`'s affinity bias is untouched; only its *threshold
selection* is bypassed in favor of `resolveCheck`'s relative tier.

## Engine wiring (`src/engine/GameEngine.ts`)

- **`planDiceRoll()`** — extended to also compute the check context: gather prior
  committed slots, call `planDiceCheck`, seed `dc`/`blessDice`/`baneDice` into the
  `dice:roll` draft (so responders may adjust), and return
  `{ mode, offerReroll, dc, bless, bane, sources, reports }`.
- **New `resolveDiceCheck(d20, plan)`** — thin wrapper over `resolveCheck`,
  returning `{ result, breakdown }` for the component to animate then commit.
- **`rollDicePair(mode)`** — unchanged in shape; the component takes the **kept**
  die's natural value into `resolveDiceCheck`. Per-die absolute thresholds are
  used only for the face number during the tumble.
- **`resolveReroll(current)`** — re-rolls the d20 (Will), then re-resolves the
  check against the **same** DC + Bless/Bane, returning the new breakdown.
- `planDiceCheck`/`resolveCheck` are pure and unit-tested directly.

## 3D throw & tally (UI)

Same component vocabulary and palette as the other minigames (bg
`#070b14`/`#0d1220`, gold `#d4a854`, blue `#7b9ec7`; threshold colors from
`THRESHOLD_COLORS`; Cormorant Garamond + Inter).

### Files

- **`src/components/screens/shared3d/dieKit.ts`** *(new, extracted)* — the
  geometry-agnostic helpers currently in `celestial/dice.ts`:
  `computeFaceData`, `snapToFace`, `readTopFace`, `faceIndexOfId`, the
  face-plane builder, and `glyphTexture`. **Both** `celestial/dice.ts` and the
  new dice die import these. *(Refactor; see Risks — Astral must be re-verified.)*
- **`src/components/screens/dice3d/die.ts`** *(new, the `celestial/dice.ts`
  analog)* — `createD20(world, radius)`: a `THREE.IcosahedronGeometry` (20
  triangular faces) with number textures **1–20** (standard opposing-faces-sum-21
  layout for authenticity), a sphere collider (proven in celestial), and
  `faceIds = ['1'..'20']` mapping face index → value. Also `createD4(world,
  radius)`: a `THREE.TetrahedronGeometry` (4 faces) with number textures **1–4**,
  tinted gold (Bless) or red (Bane); same `dieKit` face/snap machinery.
- **`src/components/screens/dice3d/scene.ts`** *(new, the `celestial/scene.ts`
  analog)* — `createDiceScene({ canvas, affinities, onSettled })`. Owns: the bowl
  floor + 24-gon collision rim (reused), the **flick** impulse, the tumble/settle
  loop, the **smash-down** sequence, and snap-to-target-face. Two handles so the
  d4s are a sequenced beat, not crowding the d20:
  - `rollCheck(targets)` — the d20 throw; one target (single) or two
    (adv/dis/choice). Fires `onSettled(keptD20)` after the smash/pick resolves.
  - `rollModifiers(blessValues, baneValues)` — *after* the d20 resolves, drops the
    physical Bless/Bane d4s in and snaps each to its **engine-determined** value
    (from `resolveCheck`'s `breakdown.bless`/`.bane`), exactly as the d20 snaps to
    its target face; fires `onModifierSettled()` when they rest. No-op (skipped)
    when both lists are empty.
- **`src/components/screens/DiceCast.tsx`** *(new, the `CelestialCast.tsx`
  analog)* — forwardRef wrapper with the `canUse3D()` guard and a `roll()`
  imperative handle; falls back to the 2D path when WebGL/reduced-motion is
  unavailable.
- **`src/components/screens/dice3d/DiceTally.tsx`** *(new)* — the BG3 tally: a
  framer-motion 2D overlay above the canvas showing the **DC marker** and the
  running total, with **projectile motes** fired from each die's projected screen
  position into the tally, a count-up that reacts per impact, and the
  success/failure punch. Veiled DC renders "?" until commit.
- **`src/components/screens/DiceMinigame.tsx`** *(rewritten)* — the phase machine
  (mirrors `AstralMinigame`), driving `DiceCast` + `DiceTally`, then the reading
  block + agency beat.
- **`src/components/screens/DiceThrowAnimation.tsx`** *(repurposed)* — becomes the
  **2D fallback**: the existing count-up for the kept d20 plus a static
  total-vs-DC readout (no projectiles). Used by `DiceCast` when `!canUse3D`.

### Flick gesture

Press the bowl → drag back (a pull-back line + power indicator) → release.
Release velocity → cannon-es impulse direction/magnitude + random spin. The flick
controls **feel only** — `roll(target)` snaps the die to the engine-computed
face via `snapToFace`, so the outcome is never the physics'. Desktop pointer +
mobile touch both handled; reduced-motion → fallback path.

### Smash-down (advantage / disadvantage)

After both dice settle face-up, the scene flags the kept die (higher/lower per
mode) and runs a scripted sequence: switch the kept body to kinematic, tween it
up and translate it over the loser, then drop it with a downward velocity; on
impact apply an ejecting impulse to the loser (and fade/despawn it) while the
kept die snaps to center and to its face. Only then does `onSettled` fire with
the kept value, advancing to the tally.

### Reading panel

Astral-style block: the settled number with its tier color, a tier badge
(e.g. `SUCCESS` / `STRONG SUCCESS`, or `TRIUMPH` / `FUMBLE` for criticals),
the `vs DC {dc}` line, and the italic interpretation. The bowl rim is
**DC-centric** (a clear marker the tally races toward) rather than the old
absolute five-color bands, since outcomes are now relative; gold-triumph /
red-fumble criticals keep their colors.

## Debug scenarios (`src/engine/events/scenarios.ts`)

Add `DEBUG_SCENARIOS` entries staging: a **Triumph** (nat-20), a **Fumble**
(nat-1), a **high-DC** check (favorable priors staged), a **Blessed** check
(+1d4 source), and a **Baned** check (−1d4). `forced`/`isolate` bypasses a
responder's `roll` but never its `condition`, so each entry stages the prior
slots / d20 value its path needs.

## Testing plan

Engine-only (per `vitest.config.ts`; stub `Math.random`/inject `rng` for rolls):

- **`DiceCheck.test.ts`** *(new)* —
  - `planDiceCheck`: DC formula across empty / favorable / grim priors; clamp to
    [5, 17]; Bless on `favorability ≥ +1`, Bane on `≤ −1`, both on a mixed
    reading; `sources` populated.
  - `resolveCheck`: tier by margin at each boundary; nat-20→Triumph and
    nat-1→Fumble override DC; `total`/`margin` math with Bless/Bane; `triumph`/
    `fumble` tags emitted.
- **Update `DiceRollPlan.test.ts`** — `planDiceRoll` now also returns
  `dc`/`bless`/`bane`/`sources`; modes/offerReroll unchanged.
- **Update `GameEngine.test.ts`** — `resolveReroll` re-resolves the check against
  the same DC; committed `DiceResult` carries `check`.
- Confirm existing dice interaction tests still pass (tier still one of five).

Then `npm run build` (strict tsc — `noUnusedLocals`/`noUnusedParameters`) +
`npm test` green, **and re-verify Astral** (visual + `AstralCast.test.ts`) after
the `dieKit` extraction.

## Documentation (required by CLAUDE.md)

- **`docs/game-systems.md`** — rewrite the dice subsystem: the skill-check model,
  the DC formula and "balance/rising-stakes" direction, Bless/Bane derivation,
  the relative tier table, nat-20/nat-1 criticals and their `triumph`/`fumble`
  tags, and the compatibility note for existing dice interactions.
- **`README.md`** — player-facing dice blurb (flick the d20, the reading sets the
  DC, Bless/Bane, criticals) in the gameplay/method tables + the new debug
  scenario entries.

## Risks & mitigations

- **Shared-helper refactor (`dieKit`) touches the working Astral scene.** Mitigate
  by extracting only the geometry-agnostic, side-effect-free helpers, and
  re-verifying Astral (tests + a manual cast) before merge. Fallback: a parallel
  copy in `dice3d/` if the extraction proves hairy.
- **DC balance feeling punishing.** It's a *reading*, not a win/lose — a miss
  against a high DC is narrated as nuance ("strong omens, but the final test
  counsels humility"), not failure. Bands are tunable; first pass uses the table
  above.
- **Projectile origin in screen space.** Fire motes from each die's
  `camera.project`-ed screen position; if flaky, fall back to firing from the
  canvas center toward the tally. Tally remains correct regardless of FX.
