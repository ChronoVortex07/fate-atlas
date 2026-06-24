# Rune Casting Minigame — Design

**Date:** 2026-06-25
**Status:** Approved (brainstorm) → ready for implementation plan

## Overview

A fifth divination minigame: **Rune Casting**. The player flings a fistful of
rune-stones onto a dark casting cloth marked with three concentric rings — the
**Heart**, the **Field**, and the **Margin**. The stones tumble out and settle
scattered: some land face-up and **upright**, some **reversed (merkstave)**, some
**face-down and silent**. The reading is read *off the scatter* — a single
**governing rune** (the face-up stone nearest the Heart) modified by the
supporting and crossing stones around it.

The minigame must match the polish of Tarot / I Ching / Astral and stay clearly
distinct from them. The **Fate ↔ Will** agency axis is the centerpiece: it
governs how much of the throw is honored and who reads the scatter. The other
four affinities each get a distinct, non-overlapping job.

Output is a single `RuneResult` (governing rune + scatter modifiers folded into
its `dimensions`/`themes`/`tags`) — matching the one-`SlotResult`-per-minigame
shape the engine expects. The scatter plays the modifier role that
aspect/dignity/omens play for Astral.

### Non-goals / scope decisions

- **Lightweight 2D physics, not 3D.** The throw/scatter uses Framer-Motion
  springs to engine-computed target positions plus tumble rotation. It is *not* a
  3D rigid-body board like Astral's Three.js scene. Deliberate scope choice to
  keep the build tractable while still feeling tactile.
- One governing result per cast (no multi-rune spread — that space is Tarot's).
- Content (per-rune meanings/dimensions) is authored to be good-enough and
  tunable; balance is refined during playtest, not blocking.

## Core loop & phases

Phase machine mirrors `AstralMinigame` / `IChingMinigame`:

1. **`idle`** — the cloth breathes; a glowing rune-bag sits at the bottom edge.
   Heading: "Take up the lots."
2. **`aiming`** — press-and-drag back from the bag. A pull-back vector shows
   angle + power (a dashed-gold trajectory arc over the cloth, a filling power
   ring). This is the player-involvement hook.
3. **`casting`** — release. 6 stones fling out along the arc, tumbling, and
   spring toward their settle points. Chaos widens & energizes the scatter; Order
   pulls it into a tight cluster.
4. **`settling`** — each stone resolves to **upright / merkstave / silent** and a
   ring (Heart/Field/Margin). A "fated pull" ghost-drags stones toward the Heart
   in proportion to **Fate** (the throw being taken out of the player's hands).
5. **`reading`** — the scatter resolves into the governing rune plus supporting /
   crossing stones. Governing sigil, orientation, ring, and interpretation
   surface like Astral's result block.
6. **agency beat** — depends on Fate/Will standing (see Plan modes): `claim`
   (Will) / `offerRecast` (Will-stirring) / carried-as-fallen (Fate/single).
7. **`done`** — committed; the governing rune becomes the turn's `SlotResult`.

## Affinity roles

| Affinity | Role in rune casting |
|---|---|
| **Fate** ↑ | The hand is moved: the fling **drifts** toward fated spots; at high Fate the cast **picks** the governing rune and carries it as-fallen (no claim, no re-cast). |
| **Will** ↑ | Aim is **honored** (tight, where pointed); player **claims** which face-up stone governs and may **turn** one merkstave upright; a Re-cast offer appears. |
| **Light** ↑ | **Silent** (face-down) stones turn face-up so they can be read; peek/foresight of a stone before commit. |
| **Shadow** ↑ | The scatter stays **veiled** — even face-up stones read cryptically; threshold hidden until commit. |
| **Chaos** ↑ | Wide, energetic scatter; **more merkstave**; stones may reach the Margin or fly off-cloth. |
| **Order** ↑ | Tight cluster toward the Heart; **more upright**; calmer, legible casts. |

Affinity feeds (the standard `MinigameMeta` → `applyAction` path, identical to
Astral): `revealedAsDrawn` → Fate, `viaReroll` → Will, plus the result's
`upright`/`reversed` tags feeding Order/Chaos and `random` feeding Chaos.

## Data model

### Types (`src/engine/types.ts`)

```ts
export type RuneId = /* 24 Elder Futhark ids */ 'fehu' | 'uruz' | ... ;
export type RuneOrientation = 'upright' | 'merkstave';
export type RuneRing = 'heart' | 'field' | 'margin';
export type RuneOmenTag = 'bindrune' | 'merkstave-cascade' | 'true-cast' | 'silent-field' | 'errant-rune';

export interface LandedRune {
  rune: RuneId;
  faceUp: boolean;               // false = silent
  orientation: RuneOrientation;  // meaningful only when faceUp
  ring: RuneRing;                // derived from distance to center
  x: number; y: number;          // normalized cloth coords (~[-1,1]); proximity + render
}

export interface RuneScatter {
  stones: LandedRune[];          // length = cast size (6)
  governingIndex: number;        // index into stones
  omens: RuneOmenTag[];
}

export interface RuneResult extends ThematicData {  // themes/dimensions/modifierRoles
  type: 'rune';
  id: string;
  name: string;
  symbol: string;                // governing rune glyph
  rune: RuneId;
  orientation: RuneOrientation;
  ring: RuneRing;
  interpretation: string;
  tags: Tag[];
  scatter: RuneScatter;
}
```

- `'rune'` joins `DivinationType`.
- `RuneResult` joins the `DivinationResult` union.

### Rune dataset (`src/data/runes.ts`, the `astromancy.ts` analog)

All 24 Elder Futhark runes, grouped into the **3 aettir** (Freyr's, Heimdall's,
Tyr's — 8 each, used like Tarot suits for grouping interactions). Each def:

```ts
export interface RuneDef {
  id: RuneId; glyph: string; name: string;
  aett: 'freyr' | 'heimdall' | 'tyr';
  reversible: boolean;            // false → never falls merkstave (symmetric stave)
  theme: ThemeTag; modifierRole: ModifierRole;
  dimensions: DimensionValues;    // upright dimensions
  meaningUpright: string; meaningReversed: string;
}
export const RUNES: Record<RuneId, RuneDef>;
```

**Symmetric (non-reversible) runes** — `reversible: false`, tagged
`non-reversible`, never fall merkstave; natural Order/stability anchors and
interaction hooks: **Gebo, Hagalaz, Isa, Jera, Eihwaz, Sowilo, Ingwaz, Dagaz**.

Authored content (dimensions = favorability / certainty / volatility; refined in
playtest). Abbreviated table — full values live in the data file:

| Aett | Rune | Glyph | Rev? | Theme | Role | Dims (f/c/v) | Upright → Merkstave |
|---|---|---|---|---|---|---|---|
| Freyr | Fehu | ᚠ | ✓ | renewal | effect | +1 / +0.5 / 0 | wealth earned → loss, greed |
| Freyr | Uruz | ᚢ | ✓ | transformation | subject | +0.5 / 0 / +1 | raw vitality → weakness |
| Freyr | Thurisaz | ᚦ | ✓ | conflict | action | −0.5 / 0 / +1.5 | reactive force → danger |
| Freyr | Ansuz | ᚨ | ✓ | illumination | subject | +1 / +0.5 / 0 | insight, message → deception |
| Freyr | Raidho | ᚱ | ✓ | authority | action | +0.5 / +0.5 / 0 | right action, journey → crisis |
| Freyr | Kenaz | ᚲ | ✓ | illumination | effect | +1 / +0.5 / +0.5 | the torch → loss of vision |
| Freyr | Gebo | ᚷ | ✗ | harmony | subject | +1.5 / +0.5 / 0 | gift, partnership (no merkstave) |
| Freyr | Wunjo | ᚹ | ✓ | harmony | effect | +1.5 / +0.5 / 0 | joy → sorrow, discord |
| Heimdall | Hagalaz | ᚺ | ✗ | upheaval | effect | −1 / +0.5 / +1.5 | hail, the reset-storm |
| Heimdall | Nauthiz | ᚾ | ✓ | stagnation | effect | −1 / +0.5 / 0 | need, constraint → deprivation |
| Heimdall | Isa | ᛁ | ✗ | stagnation | effect | −0.5 / +1 / −1.5 | standstill, ice |
| Heimdall | Jera | ᛃ | ✗ | renewal | effect | +1 / +1 / 0 | harvest, reward in time |
| Heimdall | Eihwaz | ᛇ | ✗ | transformation | subject | +0.5 / +1 / −0.5 | the world-axis, endurance |
| Heimdall | Perthro | ᛈ | ✓ | mystery | subject | 0 / −1 / +1 | the lot-cup, fate, chance → secrets withheld |
| Heimdall | Algiz | ᛉ | ✓ | authority | effect | +1 / +0.5 / 0 | protection, warding → vulnerability |
| Heimdall | Sowilo | ᛋ | ✗ | illumination | subject | +1.5 / +1 / 0 | the sun, victory, wholeness |
| Tyr | Tiwaz | ᛏ | ✓ | authority | action | +1 / +1 / 0 | victory, justice → defeat |
| Tyr | Berkano | ᛒ | ✓ | renewal | subject | +1 / 0 / +0.5 | growth, new beginnings → stagnation |
| Tyr | Ehwaz | ᛖ | ✓ | harmony | action | +1 / +0.5 / +0.5 | trust, partnership → disharmony |
| Tyr | Mannaz | ᛗ | ✓ | authority | subject | +0.5 / +0.5 / 0 | the self, humanity → isolation |
| Tyr | Laguz | ᛚ | ✓ | mystery | effect | +0.5 / −1 / +0.5 | flow, intuition → confusion, fear |
| Tyr | Ingwaz | ᛜ | ✗ | renewal | effect | +1 / +0.5 / −0.5 | gestation, stored potential |
| Tyr | Othala | ᛟ | ✓ | authority | subject | +1 / +1 / 0 | heritage, home → rootlessness |
| Tyr | Dagaz | ᛞ | ✗ | transformation | effect | +1.5 / +0.5 / +0.5 | breakthrough, dawn |

### Cloth ring geometry

Normalized radius `r = hypot(x, y)`. **Heart** `r < 0.33`, **Field** `0.33 ≤ r <
0.75`, **Margin** `r ≥ 0.75`. A stone with `r > 1.1` is **off-cloth** → contributes
the `errant-rune` omen.

## Scatter resolution & consolidation

### `resolveScatter({ aim, power, affinities, rng })` (`src/engine/runes.ts`)

Framework-free "fall" resolver shared by the component (player aim) and the pure
generator (no aim). Produces a complete `RuneScatter`:

1. Draw 6 distinct runes (shuffle, take 6).
2. **Positions:** base cluster centroid from `aim`+`power` (centered when no aim);
   per-stone jitter whose spread **widens with Chaos, tightens with Order**. Apply
   **Fate drift**: lerp each stone toward the Heart center by `drift` (0..1).
3. **faceUp** roll: base ~0.6; **Light raises**, **Shadow lowers**.
4. **orientation** roll (only if `reversible` && faceUp): base merkstave ~0.35;
   **Chaos raises**, **Order lowers**; non-reversible always upright.
5. **ring** per stone from final `r`.
6. **governingIndex:** nearest-Heart face-up stone (favored = brighter of the two
   nearest; clouded = dimmer). If no stone is face-up, the nearest is
   force-revealed.
7. **omens:** `bindrune` (≥2 face-up upright stones of the same aett near the
   governing), `merkstave-cascade` (all face-up stones merkstave),
   `true-cast` (governing upright in the Heart), `silent-field` (≥ half
   face-down), `errant-rune` (a stone off-cloth, `r > 1.1`).

`drawRuneScatter(affinities)` (in `data/runes.ts`) wraps `resolveScatter` with no
aim — used by `TurnOrchestrator.drawSingleResult` for engine-spawned results
(spawn-second / reroll), exactly like `drawAstralCast`.

### `consolidateScatter(scatter) → RuneResult` (`data/runes.ts`)

The `consolidateCast` analog. Sum contributions, then ÷2, then `clampDim` (±2 @
0.5 granularity):

- **Governing** stone: full `dimensions` + `theme` + `modifierRole`. If
  **merkstave**, apply a fixed shadow transform first: `favorability −1.0,
  volatility +0.5, certainty −0.5` (always more adverse/volatile — uniform for any
  rune).
- **Supporting** stones (other face-up **upright** stones in Heart/Field): add
  **half** their dimensions; add their theme (deduped, capped at 2 themes total).
- **Crossing** stones (face-up **merkstave**, or any stone in the **Margin**): tax
  `favorability −0.5, volatility +0.5` each (capped).
- **Silent** (face-down) stones contribute nothing unless Light revealed them.

**Tags emitted:** `draw`, `rune`, `random`, `rune-<id>`, `aett-<x>`,
`ring-<heart|field|margin>`, `orientation-<upright|merkstave>`, then `upright`
**or** `reversed` (feeds Order vs Chaos — a lever Astral lacks), `reversible`
**or** `non-reversible`, plus any omen tags. These drive responders + affinity
feeds.

## Plan modes (`src/engine/runes.ts`, the `astral.ts` analog)

```ts
export type RuneCastMode = 'single' | 'favored' | 'clouded' | 'claim';

planRuneCast(affinities, offerRecast): {
  mode: RuneCastMode;
  drift: number;        // 0 / .33 / .66 / 1.0 from Fate band
  offerRecast: boolean;
  sources: string[];
}
```

Modifier scan (priority like `planAstralCast`):

| Source | Trigger | Effect |
|---|---|---|
| `single` | default | nearest-Heart governs, as-fallen |
| **Will** dominant → `claim` | player **picks** governing + **turns** one merkstave | suppresses Re-cast offer |
| **Light** ascendant → `favored` | silent stones revealed; **brighter** nearest governs |
| **Shadow** ascendant → `clouded` | reading **veiled**; **dimmer** nearest governs |
| **Fate** band → `drift` | fling pulled toward Heart; high Fate carries as-fallen, no Re-cast |
| **Will** stirring+ → `offerRecast` | probabilistic Re-cast / Keep (reuse `shouldOfferRecast`) |

`resolveGoverning(scatter, mode)` mirrors `resolveCastSelection`: engine
auto-picks for single/favored/clouded; the component handles the pick for
`claim`. (`resolveScatter` sets a *default* `governingIndex` = nearest-Heart
face-up; `resolveGoverning` returns the final index given the mode — the
component writes it back to `scatter.governingIndex` before `consolidateScatter`,
exactly as Astral does with `resolveCastSelection` → `consolidateCast`.)

**`offerRecast` gating (explicit):** `offerRecast = shouldOfferRecast(will) &&
mode !== 'claim' && fateBand < 'ascendant'`. Will dominant already grants agency
via `claim`; Fate ascendant+ "moves the hand," so no Keep/Re-cast prompt is
shown. (Because Fate and Will are opposites and coupling suppresses the opposite
axis, these conditions rarely collide — the gate just makes the edge explicit.)

## Meta-interactions (`src/engine/responders/runes.ts`)

Registered in `GameEngine` alongside `buildAstralResponders()`. Internal
responders fire at `rune:commit`, keyed on the governing result's tags — same
density (8) and named-icon marquee style as `astral.ts`:

| Responder | Fires when | Effect (band / animation) |
|---|---|---|
| **Bindrune** | `bindrune` omen | amplify governing's dominant axis ×1.5 · MUTATE `amplify` |
| **Merkstave Cascade** | `merkstave-cascade` | volatility +1.0, fav −0.5, +`upheaval` · MUTATE `flip` (feeds Chaos) |
| **True Cast** | `true-cast` | certainty +1.0, +`illumination` · MUTATE `anchor` (feeds Order) |
| **The Silent Field** | `silent-field` | certainty −1.0, +`mystery` · MUTATE `shroud` |
| **The Errant Rune** | `errant-rune` | `spawnSecond: 'rune'` · SPAWN `second-result` |
| **Perthro, the Lot-Cup** | governing = Perthro (the rune *of casting*) | `spawnSecond: 'rune'` · SPAWN, weight 2 (marquee) |
| **Hagalaz, the Hailstone** | governing = Hagalaz + ≥1 other face-up stone | volatility +1.0, fav −0.5, +`upheaval` · MUTATE `flip` |
| **Isa, the Standstill** | governing = Isa | volatility −1.0, certainty +0.5, +`stagnation` · MUTATE `override` |

**Cross-type:**
- **Tiwaz's Victory** — a Tiwaz rune + a `critical-high` d20 in the spread →
  favorability +1.0 (triggers `dice:commit` + `rune:commit`).
- **Free participation** — because rune results emit `reversible` and `reversed`,
  they automatically join the existing **`mirror`** (two reversibles flip
  together) and **`iching-resonant-change`** interactions with **no new code**.
  Verified by tests rather than new responders.

Each new responder gets a `DEBUG_SCENARIOS` entry (`events/scenarios.ts`) staging
its precondition — `forced`/`isolate` bypasses `roll` but never `condition`.

## UI / UX & visuals

Same component vocabulary and palette as the existing minigames (bg
`#070b14`/`#0d1220`, gold `#d4a854`, blue `#7b9ec7`, purple `#9b6bb0`; Cormorant
Garamond + Inter).

### Files

- `src/components/screens/RuneMinigame.tsx` — screen + phase machine (like
  `AstralMinigame`).
- `src/components/screens/runic/` (the `celestial/` analog):
  - `cloth.ts` — concentric-ring cloth SVG geometry + engraved runic rim.
  - `runeArt.ts` — per-rune glyph rendering (the `constellationArt.ts` analog).
  - `scatter.ts` — aim→target geometry + tumble-spring animation helpers
    (imports the engine `resolveScatter` for the canonical fall).
- `src/components/cards/RuneSigil.tsx` — reusable stone face (upright / merkstave
  / silent), the `AstralSigil`/`CardSigil` analog; also rendered in
  `ConstellationFan` and the result reading.

### Visual details

- **Cloth:** dark radial field, three engraved gold rings (Heart softly glowing),
  a faint **`RunicBand`** around the rim + the **corner-flourish** SVG pattern
  (both reused from existing minigames), and a starfield speckle like Tarot's
  tableau.
- **Rune-stones:** rounded stone tablets, glyph carved in gold; **merkstave** =
  glyph inverted with a dim red-violet cast; **silent** = blank knotwork back;
  governing stone wears the strongest gold halo.
- **Aim gesture:** press the bag → pull-back line + dashed-gold trajectory arc +
  filling power ring; **Fate-drift** renders as a translucent vector bending the
  arc toward the Heart (the hand visibly being moved). Release → stones fling and
  tumble, then spring-settle with a scale-bounce; merkstave stones do a half-flip
  reveal. Desktop pointer-drag + mobile touch both handled (as Tarot already
  does); reduced-motion friendly.
- **Reading panel:** Astral-style block — governing `RuneSigil`, name +
  orientation ("Sowilo — Merkstave"), ring label ("in the Heart"), italic
  interpretation, and a scatter-omen **badge** ("BINDRUNE" / "TRUE CAST") styled
  like Astral's aspect badge. Shadow/veiled shows "The stones rest, their meaning
  veiled…".
- **Agency beat UI:** `claim` (Will) → face-up stones tappable + a "↻ Turn"
  affordance on a merkstave governing; `offerRecast` → reuse Astral's "↺ Re-cast /
  Keep it" row; `favored`/`clouded` → a mode-label line; Fate/`single` →
  auto-commit after the reveal beat (`REVEAL_DELAY_MS`).

## Engine wiring (integration surface)

**New files:** `data/runes.ts`, `engine/runes.ts`, `engine/responders/runes.ts`,
`screens/RuneMinigame.tsx`, `screens/runic/{cloth,runeArt,scatter}.ts`,
`cards/RuneSigil.tsx`; tests `Runes.test.ts`, `RuneCast.test.ts`,
`RuneResponders.test.ts`.

**Edited files:**
- `engine/types.ts` — `'rune'` in `DivinationType`; new rune types; `RuneResult`
  in `DivinationResult`.
- `engine/TurnOrchestrator.ts` — `drawSingleResult` `case 'rune'`;
  `QUESTION_WEIGHTS` rune weights.
- `data/divination-profiles.ts` — `rune` profile (all-theme coverage; strengths
  favorability/volatility + subject/effect).
- `engine/GameEngine.ts` — register `buildRuneResponders()`; add `planRuneCast()`
  + `resolveGoverning()` methods; widen the `spawnSecond` and `removeUsedMethod`
  type unions to include `'rune'`.
- `engine/events/scenarios.ts` — `DEBUG_SCENARIOS` for each rune responder.
- `components/screens/GameTable.tsx` — `renderMinigame` `case 'rune'`.
- `components/screens/MethodSelect.tsx` — rune method metadata (glyph, label,
  blurb).
- Fan/result display — `ConstellationFan` + result reading render `RuneResult`
  via `RuneSigil`.

## Testing plan

Engine-only (per `vitest.config.ts`; stub `Math.random` for rolls):

- **`Runes.test.ts`** — `consolidateScatter` (governing/supporting/crossing math,
  merkstave transform, tags, omens); `drawRuneScatter` affinity bias (Chaos
  widens / Order tightens; Light raises face-up; Shadow lowers; non-reversible
  never merkstave).
- **`RuneCast.test.ts`** — `planRuneCast` (mode by band; drift by Fate band;
  offerRecast gating; claim suppresses recast); `resolveGoverning`
  (favored=brighter, clouded=dimmer, single=nearest-Heart).
- **`RuneResponders.test.ts`** — each responder fires on its staged precondition;
  plus assertions that runes auto-participate in `mirror` /
  `iching-resonant-change`.
- Update `GameEngine.test.ts` / `TurnOrchestrator.test.ts` where they enumerate
  methods.

Then `npm run build` (strict tsc — `noUnusedLocals`/`noUnusedParameters`) +
`npm test` green.

## Documentation (required by CLAUDE.md)

- `docs/game-systems.md` — new **Rune Casting** subsystem section: mechanic, plan
  modes, per-affinity behavior, consolidation rules, full interaction catalogue.
- `README.md` — player-facing rune-casting blurb in the gameplay/method tables +
  debug scenario entries.
