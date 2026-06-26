# Strings of Fate Minigame — Design

**Date:** 2026-06-26
**Status:** Approved (brainstorm) → ready for implementation plan

## Overview

A sixth divination minigame: **Strings of Fate**. The player draws a single
crimson **thread of fate** through a dark, fog-shrouded web of **concept-stars**.
From a fixed **origin** ("the self"), only the immediately adjacent stars are
un-veiled — each shown as a bare **surface hint** (a Sigil-Gem silhouette + one
mood word). The player picks one; the thread pulls taut, the fog **disperses**
along it, and the *next* ring of stars emerges. This repeats until the thread
reaches a **destination** star, at which point the **whole traversed path** is
read as the answer.

The mechanic deliberately makes the **Light ↔ Shadow information axis** the
centerpiece — no existing minigame centers it. How much you can see about a
candidate before committing (and how much fog hides) is the core tension. The
**Fate ↔ Will agency axis** is the secondary control (who chooses, how many
threads, whether you may backtrack). Chaos/Order shape the weave's tangle.

Output is a single `StringsResult` (the path's concepts folded into one
`dimensions`/`themes`/`tags` slot, **governed by the destination**) — matching
the one-`SlotResult`-per-minigame shape the engine expects. The path plays the
modifier role that the spread plays for Tarot or the scatter for Rune.

### Visual identity (locked in brainstorm via the visual companion)

- **Layout:** a **radial bloom** — origin at center, depth-bands as faint
  orbit-rings, destinations on the rim. Underlying graph is a clean **layered
  DAG**; presentation is an organic tangle ("unravel the weave").
- **Red String of Fate:** the drawn thread is a glowing **crimson** string
  (赤い糸 / conspiracy-board red string), pinned at each visited node. The whole
  loom *is* strung with red, but hidden under fog until discovered. On
  **relationship** questions the thread ties off at a second anchor — **"the
  other."**
- **Fog of fate:** a **procedural turbulent cloud** (`feTurbulence` fractal
  noise, tinted dark indigo/maroon, slowly drifting) covers the board. Connecting
  nodes **disperse** the cloud into a cleared corridor with wispy edges; the
  active node emits a **dispersal pulse**. Ghost-gems glint faintly where the
  cloud thins.
- **Nodes:** the **Sigil-Gem** — a faceted lozenge ringed by a faint sigil-circle
  with a glyph at its heart (lit / candidate-rose / veiled-ghost states).
- **Polish bar:** Framer Motion + inline-SVG, on par with the recent draw-phase
  animation work (`MethodCard` flips, `FateForceOverlay`, dispersal/glow
  filters, DOM-measured anchoring).

### Non-goals / scope decisions

- **Layered DAG only**, not a free-form mesh — predictable path length,
  guaranteed reachability, bounded result size. Mesh is the *presentation*, not
  the data.
- **Concepts have no orientation.** A path cannot be "flipped," so Strings emits
  **no** `reversible` / `changing-lines` / arcana tags and stays cleanly **out of
  Mirror / Critical Resonance / Resonant Change**. This is deliberate, not a gap.
- **One path = one slot.** No multi-weave spread; the rare second weave is the
  reused `chaos-second-result`.
- **2D SVG**, no 3D physics.
- **Authored library (~40 concepts)** is good-enough and tunable; balance is
  refined in playtest, not blocking. `feTurbulence` fog gets a reduced-motion /
  low-power static fallback.

## Core loop & phases

Phase machine mirrors the other minigames (`drawing` is the interactive heart):

1. **`drawing`** — the board generates fogged; origin lit at center,
   its first-ring candidates emerging as surface hints. Heading: *"Draw the
   thread."* Each turn the player:
   - **picks** a candidate → thread extends, fog disperses, `strings:pick`
     dispatches, the next ring reveals;
   - optionally **backtracks** (Will) — pull the thread back one node and
     re-choose;
   - optionally **re-draws** the current candidate set once (Will dominant);
   - optionally uses **foresight** (Light) — fully un-veil one candidate's
     identity before committing.
2. **`arrived`** — the thread reaches a destination star. A **review beat** shows
   the full lit path (origin → crossings → destination) through cleared fog;
   advances on explicit **Continue** (the shared `awaitingContinue` gate).
3. **commit** — `commitWeave()` consolidates the path → `StringsResult`,
   dispatches `strings:commit` (path-internal interactions, Woven Echo,
   chaos-second-result), then the standard `minigame:end` / `completeMinigame`
   flow.

## Affinity roles

The full ladder approved in brainstorm. Levers: **width** (threads offered),
**clarity** (what each thread reveals), **veil** (threads hidden), **pull** (Fate
redirecting), **re-thread** (Will backtracking), **tangle** (volatility +
extreme-node bias).

| Affinity | Ascendant | Dominant |
|---|---|---|
| **Chaos** ↑ | concept pool biased toward volatile/extreme dimensions; more crossing edges; `chaos-stray-thread` — a pick may jump to a *different* revealed neighbor | journey lengthens (+1 band); `chaos-second-result` spawns a second weave *(reused)*; `chaos-happening-interrupt` between readings *(reused)* |
| **Order** ↑ | pool biased toward neutral/stable dimensions; fewer crossings; bands reconverge; `order-true-weave` — pulls the committed result's most extreme dimension toward center | a coherent thread is rewarded with clarity |
| **Fate** ↑ | **width −1** (fewer threads offered, floor 2); `fate-pull-thread` (OVERRIDE) — redirects a pick to a different neighbor | `fate-foregone-step` — after a pick, one further step weaves itself along a fated edge; nearing the rim the **destination may be sealed** |
| **Will** ↑ | **width +1**; **backtrack one step** (re-thread); `will-offer-rethread` prompt at stirring | backtrack up to two steps; **re-draw** the candidate set once |
| **Light** ⭐ | **clarity → themes**: candidates show themes + dimension-lean; **look-ahead** silhouettes of the next band appear; **foresight** can fully un-veil one candidate | **clarity → laid-bare**: the whole reachable weave dims into view; benevolent concepts glow |
| **Shadow** ⭐ | **clarity → silhouette**: candidates are bare glyphs (no mood word); `shadow-veil-node` keeps one revealed neighbor **veiled/unpickable** | 2–3 neighbors veiled — choose among fewer visible threads; cryptic reading |

### Affinity feeds (player choices)

Strings is a natural home for the **information-axis** actions, currently
under-fed. Each step the engine calls `affinityEngine.applyAction(...)`:

| Player choice | Action | Affinity |
|---|---|---|
| accept a step on its surface hint (no foresight) | `reveal-as-drawn` | Fate |
| backtrack / re-thread / re-draw | `take-reroll` | Will |
| use foresight / look-ahead | `use-peek` (`seek-pattern`) | Light |
| pick a fully-veiled / silhouette node | `embrace-mystery` (`decline-peek`) | Shadow |

Plus a **path-coherence flat feed** at commit (mirrors tarot's all-upright /
all-reversed rule, applied flat — no jitter/coupling):

- **Coherent** thread (themes cluster; low per-node favorability/volatility
  variance) → **Order +6**.
- **Tangled** thread (an opposed-theme pair present; high variance) → **Chaos
  +6**.
- Otherwise no coherence feed.

Result tags also feed the standard way: `random` → Chaos (Strings is a random
draw, like dice/astral/rune).

## Data model

### Types (`src/engine/types.ts`)

```ts
export type ConceptBandKind = 'origin' | 'crossing' | 'destination';
export type ConceptFamily   = 'benevolent' | 'challenging' | 'neutral';

// A node placed in a generated weave.
export interface WovenNode {
  id: string;          // unique within this weave (e.g. `b2-3`)
  conceptId: string;   // key into CONCEPTS
  band: number;        // 0 = origin … bandCount-1 = destination
  family: ConceptFamily;
  x: number; y: number; // normalized radial-bloom coords for render
}
export interface WovenEdge { from: string; to: string; } // adjacent bands only

export interface WeaveGraph {
  nodes: WovenNode[];
  edges: WovenEdge[];
  originId: string;
  bandCount: number;
}

// Affinity-derived levers, resolved once by planWeave().
export interface WeavePlan {
  bandCount: number;     // 4 base; Chaos dominant → 5
  width: number;         // revealed candidates per step (base 3; Fate −1 floor 2; Will +1)
  clarity: 'silhouette' | 'mood' | 'themes' | 'laid-bare';
  lookAhead: number;     // bands of silhouette look-ahead (Light)
  backtracks: number;    // Will: ascendant 1, dominant 2
  allowRedraw: boolean;  // Will dominant
  extremeBias: number;   // signed: Chaos>0 pulls pool to |dims|, Order<0 to neutral
  crossingDensity: number; // forward edges per node (Chaos more, Order fewer + reconverge)
  foresight: boolean;    // Light ascendant+
  driftSeal: number;     // Fate: chance of foregone-step / sealed destination
  sources: string[];
}

export interface StringsMinigameState {
  method: 'strings';
  graph: WeaveGraph;
  plan: WeavePlan;
  visitedPath: string[];        // ordered node ids, [originId, …]
  activeId: string;             // last of visitedPath
  candidateIds: string[];       // pickable revealed neighbors of active (post width/veil)
  veiledCandidateIds: string[]; // revealed-but-veiled (Shadow) — visible, unpickable
  lookAheadIds: string[];       // silhouettes shown one+ band beyond (Light)
  revealedIds: string[];        // every node ever un-fogged
  foresightId: string | null;   // candidate fully un-veiled this step (Light)
  backtracksRemaining: number;
  redrawUsed: boolean;
  phase: 'drawing' | 'arrived';
}

export interface StringsResult extends ThematicData { // themes/dimensions/modifierRoles
  type: 'strings';
  id: string;            // destination conceptId (the governing answer)
  name: string;          // path name: "The Self · A Rising Tide · The Reckoning"
  symbol: string;        // destination Sigil-Gem icon key
  interpretation: string;
  path: WovenNode[];     // ordered origin→destination (for atomic-signal expansion)
  destinationId: string;
  tags: Tag[];
}
```

- `'strings'` joins `DivinationType`.
- `StringsResult` joins the `DivinationResult` union; `StringsMinigameState`
  joins the `MinigameState` union.

### Concept library (`src/data/strings.ts`, the `runes.ts`/`astromancy.ts` analog)

~40 authored concept-stars. Each:

```ts
export interface ConceptDef {
  id: string; name: string; glyph: string;  // glyph = Sigil-Gem icon key
  bands: ConceptBandKind[];        // which bands this concept may occupy
  family: ConceptFamily;
  themes: ThemeTag[];              // 1–2
  dimensions: DimensionValues;     // favorability / certainty / volatility
  modifierRole: ModifierRole;
  mood: string;                    // one-word surface hint ("doubt", "ardor", "ruin")
  meaning: string;                 // full interpretation on arrival
  questionTypes?: QuestionType[];  // destinations only: which questions they answer
  tags: Tag[];                     // `concept-<id>`, theme tags, family tag
}
export const CONCEPTS: Record<string, ConceptDef>;
```

Pools:

- **Origin** (≈4): question-neutral "the self / the present" anchors; one chosen
  per weave (neutral family, modest dimensions, role `subject`).
- **Crossing** (≈24): the bulk — the forces/turns of the journey (role `action`,
  spread across families and the full dimension range so Chaos/Order biasing has
  signal). Drawn per crossing band, deduped within a weave.
- **Destination** (≈12, **3 per `QuestionType`**): the answers (role `effect`,
  strong dimension signatures). Each tagged with the `questionTypes` it can
  terminate — **decision / relationship / future / self each get their own
  destination set**, so the reachable answers are tailored to the question.
  Relationship destinations include "the other" (the second-anchor flavor).

Content (names/moods/meanings/dimensions/families) is authored good-enough and
refined in playtest.

## Graph generation, reveal & consolidation (`src/engine/strings.ts`)

### `planWeave(affinities) → WeavePlan`

Resolves every lever above from the current affinity bands (see the Affinity
roles table). Pure; deterministic given affinities (no RNG).

### `generateWeave(questionType, plan, rng) → WeaveGraph`

1. **Origin band** — pick 1 origin concept; place at center.
2. **Crossing bands** (`bandCount − 2`) — each gets `N_c` (≈4) distinct crossing
   concepts, sampled with weight skewed by `plan.extremeBias` (Chaos → high
   `|dimensions|`; Order → near-zero). Dedup across the whole weave.
3. **Destination band** — `N_d` (≈3) concepts whose `questionTypes` includes the
   current question.
4. **Edges** — each node gets `k` forward edges (`k` from `crossingDensity`,
   **≥2**) to next-band nodes; Order raises **reconvergence** (shared targets),
   Chaos raises **crossing** (wider fan + jittered overlap). **Invariant:** every
   node has ≥1 forward edge and **at least one origin→destination path exists**
   (post-generation validation + repair; covered by tests).
5. **Layout** — radial-bloom positions: band `b` at radius `R_b`, nodes spread by
   angle with organic jitter (Chaos widens jitter). Render-only.

`drawWeave(questionType, affinities, rng)` wraps generate + an **auto-traversal**
(engine greedily walks a valid path) + `consolidatePath` for **engine-spawned**
results (`chaos-second-result`, `TurnOrchestrator.drawSingleResult`) — the analog
of `drawRuneScatter`/`drawAstralCast`.

### Reveal logic (pure helpers, driven by `GameEngine`)

- `revealFrom(state, activeId)` → recomputes `candidateIds` (forward neighbors,
  capped at `plan.width`), `veiledCandidateIds` (Shadow), `lookAheadIds` (Light),
  honoring `clarity`.
- `GameEngine.stepTo(nodeId)` — validate `nodeId ∈ candidateIds`; dispatch
  `strings:pick` (Fate/Chaos may redirect → OVERRIDE band); push final node;
  recompute reveal; `applyAction` per the feeds table; if the node is a
  destination → `phase = 'arrived'`.
- `GameEngine.backtrack()` / `redrawCandidates()` / `useForesight(nodeId)` —
  gated by `plan`; each `applyAction`s Will/Light; all end in `notify()`.
- `GameEngine.commitWeave()` — `consolidatePath` → result; dispatch
  `strings:commit`; apply path-coherence flat feed; route through
  `completeMinigame`.

### `consolidatePath(path, graph) → StringsResult` (`src/data/strings.ts`)

The `consolidateScatter`/`consolidateCast` analog — **destination-governed**:

- **Weights:** destination ×2, origin ×1, each crossing ×1.
- **Dimensions:** weighted sum ÷ total weight, then `clampDim` (±2 @ 0.5).
- **Themes:** weighted frequency across the path; **destination themes forced
  in**; cap 2.
- **Modifier roles:** origin → `subject`, crossings → `action`, destination →
  `effect` (carried on `path` nodes for `ReadingPlanner` atomic-signal expansion;
  `modifierRoles` union lifted to the result).
- **Tags:** union of every visited concept's tags + `draw random strings weave`.
- **name / symbol / interpretation:** from the destination, prefixed by the path.

`ReadingPlanner.aggregate` expands `StringsResult.path` into **atomic signals**
(one per node, destination weighted) exactly as it already expands the tarot
spread — so synthesis profiles over the real path, not just the average.

## Meta-interactions (`src/engine/responders/strings.ts`)

Registered via `buildStringsResponders()` in `GameEngine`. All tag-matched (new
entities with the right tags auto-participate). Deterministic unless noted.

### Pick-time (compete in OVERRIDE at `strings:pick`)

| Responder | Min band / tier | Effect | Animation |
|---|---|---|---|
| `chaos-stray-thread` | Chaos ascendant · notable | the pick jumps to a different revealed neighbor | `override` |
| `fate-pull-thread` | Fate ascendant · major | redirects the pick to a fated neighbor | `override` |
| `fate-foregone-step` | Fate dominant · major | after the pick, auto-advance one more step along a fated edge | `second-result` |
| `will-offer-rethread` | Will stirring · notable (combine/offer) | surfaces a one-time "pull it back?" prompt | *(offer)* |

### Path-internal (fire at `strings:commit` via a new `weave` combine channel)

Reducer collects all reports into one batch — mirrors the tarot `spread` channel.
Operate on the **unconsolidated** path nodes.

| Interaction | Fires when… | Effect | ≈ tarot analog |
|---|---|---|---|
| **Coherent Weave** | all visited concepts share a theme family | destination's primary dimension ×1.5 | Suit Accord |
| **Tangled Weave** | path contains an opposed-theme pair | volatility +1.0 | Elemental Clash |
| **Luminous Path** | every concept is *benevolent*-family | favorability up / clarity | Spread Aligned |
| **Shrouded Path** | every concept is *challenging*-family | favorability down, force `mystery` | Spread Cascade |
| **`order-true-weave`** | Order ascendant+ (band-gated) | pull the result's most extreme dimension toward center | `anchor` |

### Cross-slot (at `strings:commit`)

| Interaction | Fires when… | Effect | Animation |
|---|---|---|---|
| **Woven Echo** | the destination's dominant theme matches another committed entity's theme | resonance report + amplify the shared theme's dimension | `mirror` |

### Reused, no new responder code

- `chaos-second-result` — add `strings:commit` to its trigger list +
  `spawnSecond = 'strings'`.
- `chaos-happening-interrupt` at `minigame:end` already covers Strings.

Each new responder gets a `DEBUG_SCENARIOS` entry staging its precondition
(`forced`/`isolate` bypasses `roll`, never `condition`).

## Event triggers

| Trigger | Fires when |
|---|---|
| `strings:start` | the weave is generated (reserved extensibility point, like `iching:cast`) |
| `strings:pick` | a candidate is chosen — pick-time responders compete |
| `strings:commit` | the destination is committed — path-internal + Woven Echo + chaos-second-result |

## UI / UX & visuals

### Files

- `src/components/screens/StringsMinigame.tsx` — screen + phase machine (reads
  `minigameState`, calls `stepTo`/`backtrack`/`useForesight`/`commitWeave`).
- `src/components/screens/weave/` (the `celestial/` / `runic/` analog):
  - `board.ts` — radial-bloom geometry (band radii, angle spread, jitter).
  - `fog.ts` — `feTurbulence` cloud filter + dispersal-mask helpers + the
    drifting/dispersal-pulse animation params; reduced-motion static fallback.
  - `thread.ts` — red-string path geometry (taut curves between pins) + the
    candidate-filament and dispersal-pulse helpers.
- `src/components/cards/StringSigil.tsx` — the **Sigil-Gem** renderer
  (lit / candidate-rose / veiled-ghost / origin-gold states); also used in
  `ConstellationFan` + the result reading.

### Visual details

- **Board:** deep indigo→black radial field; faint orbit-ring bands; the
  procedural fog cloud over everything; the lit corridor cleared along the drawn
  thread with a soft red halo.
- **Thread:** crimson (`#d23f57`) glowing string with a pale highlight, pinned at
  each visited Sigil-Gem; a loose "seeking" end curls from the active node.
- **Candidates:** rose dashed filaments to surface-hint gems; the mood word shows
  only at `clarity ≥ 'mood'`; Light adds theme/dimension-lean labels and
  look-ahead silhouettes; Shadow shows bare gems and renders veiled candidates
  unpickable.
- **Dispersal:** picking ignites the new segment, expands the fog mask along it,
  and fires a dispersal pulse (expanding rings) at the new active node.
- **Relationship special-case:** one destination renders as **"the other"** with
  a heart-knot anchor; the thread visibly ties off at both ends on arrival.
- **Review beat / reading panel:** the full lit path through cleared fog, then an
  Astral-style result block — destination `StringSigil`, path name, italic
  interpretation, and a path-internal **badge** ("COHERENT WEAVE" / "TANGLED
  WEAVE"). Shadow shows "the weave keeps its counsel…".
- **Agency affordances:** Will → a "↩ Pull the thread back" control (×
  `backtracksRemaining`) and, at dominant, "↺ Re-draw"; Light → a foresight eye
  on candidates; Fate/none → auto-advance is shown as the thread moving itself.
- Desktop pointer + mobile touch both handled; reduced-motion friendly (fog
  freezes to a static cloud, pulses disabled).

## Engine wiring (integration surface)

**New files:** `data/strings.ts`, `engine/strings.ts`,
`engine/responders/strings.ts`, `screens/StringsMinigame.tsx`,
`screens/weave/{board,fog,thread}.ts`, `cards/StringSigil.tsx`; tests
`Strings.test.ts`, `StringsReveal.test.ts`, `StringsResponders.test.ts`.

**Edited files:**

- `engine/types.ts` — `'strings'` in `DivinationType`; the new types above;
  `StringsResult` in `DivinationResult`; `StringsMinigameState` in
  `MinigameState`.
- `engine/GameEngine.ts` — `startWeave()` on `confirmSelection()` when
  `method === 'strings'` (like `startTarotDraft`); `stepTo` / `backtrack` /
  `redrawCandidates` / `useForesight` / `commitWeave`; register
  `buildStringsResponders()`; widen `spawnSecond` + `removeUsedMethod` unions to
  include `'strings'`.
- `engine/TurnOrchestrator.ts` — `drawSingleResult` `case 'strings'` (via
  `drawWeave`); `QUESTION_WEIGHTS` strings weights.
- `engine/events/reducers.ts` — new `weave` combine-channel reducer (collect
  path-internal reports), mirroring `spread`.
- `engine/events/scenarios.ts` — `DEBUG_SCENARIOS` for each strings responder.
- shared responder — add `'strings:commit'` to `chaos-second-result`'s trigger.
- `engine/ReadingPlanner.ts` + `engine/NarrativeAssembler.ts` — expand
  `StringsResult.path` into atomic signals; `describeSlotBrief`/`describeSlotFull`
  render the path ("From <origin>, through <crossings>, to <destination>").
- `data/divination-profiles.ts` — `strings` profile (all-theme coverage;
  strengths favorability + subject/action/effect, since the path spans roles).
- `data/method-cards.ts` + `cards/MethodEmblem.tsx` — method front: title
  **"Strings of Fate"**, crimson-garnet family color **distinct** from the dice
  terracotta (`#c75b4a`); a knot/thread emblem.
- `components/screens/GameTable.tsx` — `renderMinigame` `case 'strings'`.
- `data/sigils.ts` (or equivalent) — Sigil-Gem icon key(s) for concepts.
- Fan / result display — `ConstellationFan` + `ResultReading` render
  `StringsResult` via `StringSigil` + a path view (origin→…→destination), like
  tarot's positional spread.

**Carryover:** none new persisted. The weave state lives on
`GameState.minigameState` and resets each turn, like every other minigame.

## Testing plan

Engine-only (per `vitest.config.ts`; stub `Math.random` for draws):

- **`Strings.test.ts`** — `generateWeave` (band/node counts; **reachability
  invariant**; extreme-bias affects sampled concepts; Chaos +band, crossing
  density); `consolidatePath` (destination-governed weighting, theme cap +
  destination force-in, role assignment, tags); `planWeave` (every lever by
  band).
- **`StringsReveal.test.ts`** — `stepTo` reveal recompute; width by Fate/Will;
  Shadow veiling; Light clarity + look-ahead + foresight; backtrack / re-draw
  budgets; **affinity feeds** per the table; path-coherence flat feed
  (Order/Chaos).
- **`StringsResponders.test.ts`** — each responder fires on its staged
  precondition; pick-time OVERRIDE competition; the four path-internal
  interactions + `order-true-weave`; Woven Echo theme-match; `chaos-second-result`
  spawns `'strings'`; **assert Strings does *not* match `mirror`** (no
  `reversible`).
- Update `GameEngine.test.ts` / `TurnOrchestrator.test.ts` where they enumerate
  methods.

Then `npm run build` (strict `tsc` — `noUnusedLocals`/`noUnusedParameters`) +
`npm test` green.

## Documentation (required by CLAUDE.md)

- `docs/game-systems.md` — new **§11 Strings of Fate** section: the loom mechanic,
  plan levers, per-affinity behavior, consolidation rules, the full
  interaction/responder catalogue, and the event triggers; add the new
  source-of-truth files to the sync table at the top.
- `README.md` — player-facing Strings-of-Fate blurb in the gameplay/method tables
  + the new debug-scenario entries.

## Open questions / risks (resolve in playtest, not blocking)

- **Tuning:** band count (4), crossing nodes per band (≈4), base width (3), and
  the ~40-concept split are first guesses; expect iteration.
- **Reachability/repair:** generation must guarantee an origin→destination path
  under every affinity skew — the most important invariant to test.
- **Fog performance:** `feTurbulence` + masks can be costly on low-end mobile;
  the static reduced-motion fallback is the mitigation.
- **Content volume:** ~40 concepts + 4 question-specific destination sets is the
  largest authoring lift; can ship a smaller library first and grow it.
