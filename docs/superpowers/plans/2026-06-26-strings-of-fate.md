# Strings of Fate Minigame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth divination method, **Strings of Fate** — drawing a red thread through a fog-shrouded radial web of authored concept-stars, discovering a question-tailored destination whose full traversed path consolidates (destination-governed) into one `StringsResult`.

**Architecture:** Mirror the existing minigame anatomy (data → pure engine → tag-matched responders → screen → one consolidated `SlotResult`). A layered DAG is generated under a radial-bloom layout; the player steps node-by-node with fog-of-war reveal (Light/Shadow = clarity, Fate/Will = agency, Chaos/Order = tangle). The path consolidates destination-governed and plugs into the existing event/responder/synthesis systems. Reuses `chaos-second-result` / `chaos-happening-interrupt`; adds a new `weave` combine channel for path-internal interactions; stays cleanly out of Mirror (no `reversible` tag).

**Tech Stack:** React 18, TypeScript (strict), Vite, Framer Motion (the project's only animation dependency), inline SVG (incl. `feTurbulence` procedural fog). Engine is framework-free TS; tests are Vitest (engine only, `src/engine/__tests__/**`).

**Spec:** [docs/superpowers/specs/2026-06-26-strings-of-fate-design.md](../specs/2026-06-26-strings-of-fate-design.md)

## Global Constraints

- **Engine purity:** `src/engine/**` and `src/data/**` stay free of React/DOM imports. All new logic-side code is plain TS. (CLAUDE.md)
- **Snapshot contract:** every `GameEngine` mutator ends with `notify()`. `getState()` returns the immutable snapshot; never hand out `this.state`. (CLAUDE.md)
- **Typecheck is the lint gate:** `npm run build` runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`. No unused imports/vars/params. There is no ESLint/Prettier.
- **Tests are engine-only:** Vitest runs only `src/engine/__tests__/**` in Node. Do **not** add component test files — they will not run. Component correctness is gated by `npm run build` plus manual verification (`npm run dev`, `?debug`).
- **Randomness in tests:** draws use `Math.random()`. Stub it (`vi.spyOn(Math, 'random')`) or pass an injected `rng` where the signature allows, for deterministic assertions.
- **Result shape:** every minigame yields exactly one `SlotResult` carrying `themes` / `dimensions` / `modifierRoles` / `tags` (the `ThematicData` contract).
- **Method family colour:** Strings uses crimson-garnet **`#c33b5e`** — distinct from the dice terracotta `#c75b4a`. Thread crimson `#d23f57`, rose filament `#b0566a`, veil indigo `#2a3358`, fog `#06040d`, gold origin `#d4a854`, starlight `#7b9ec7` (match existing palette).
- **Docs sync (CLAUDE.md):** the affinity/effect/interaction/happening behaviour changes here MUST land in `docs/game-systems.md` (new §11) and `README.md` in the same change — Task 24.
- **Trigger namespacing:** responder triggers are namespaced by data type. Strings uses `strings:start`, `strings:pick`, `strings:commit` (the `${result.type}:commit` convention in `completeMinigame` already produces `strings:commit`).

---

## File Structure

**New files**

- `src/data/strings.ts` — `ConceptDef`, the authored `CONCEPTS` library, band/destination lookups, `consolidatePath`, `pathCoherence`. *(Tasks 2–3)*
- `src/engine/strings.ts` — `planWeave`, `generateWeave`, `revealFrom`, `drawWeave` (pure). *(Tasks 4–7)*
- `src/engine/responders/strings.ts` — `buildStringsResponders()`: pick-time + commit-time + path-internal + Woven Echo. *(Tasks 14–15)*
- `src/components/cards/StringSigil.tsx` — the Sigil-Gem node renderer (lit/candidate/veiled/origin states). *(Task 20)*
- `src/components/screens/weave/board.ts` — radial-bloom geometry. *(Task 21)*
- `src/components/screens/weave/fog.ts` — `feTurbulence` cloud + dispersal-mask helpers. *(Task 21)*
- `src/components/screens/weave/thread.ts` — red-string path + dispersal-pulse helpers. *(Task 21)*
- `src/components/screens/StringsMinigame.tsx` — the screen + phase machine. *(Task 22)*
- Tests: `src/engine/__tests__/Strings.test.ts`, `StringsReveal.test.ts`, `StringsResponders.test.ts`.

**Modified files**

- `src/engine/types.ts` — Strings types; `'strings'` in `DivinationType`; `StringsResult` in `DivinationResult`; `StringsMinigameState` in `MinigameState`. *(Task 1)*
- `src/engine/events/types.ts` — `weaveReports?: EffectReport[]` on `PhaseDraft`. *(Task 13)*
- `src/engine/events/reducers.ts` — `weaveReducer` + register `'weave'`. *(Task 13)*
- `src/engine/TurnOrchestrator.ts` — `POOL_TYPES`, `QUESTION_WEIGHTS`, `drawSingleResult` (`case 'strings'` + optional `question`), `removeUsedMethod` union. *(Task 8)*
- `src/engine/GameEngine.ts` — register `buildStringsResponders()`; `startWeave`/`stepTo`/`backtrack`/`redrawCandidates`/`useForesight`/`commitWeave`; `confirmSelection` strings branch; `completeMinigame` strings coherence; widen `spawnSecond` + `removeUsedMethod` unions, pass `question`. *(Tasks 9–12, 16)*
- `src/engine/responders/affinity.ts` — add `'strings:commit'` to `chaos-second-result` triggers. *(Task 16)*
- `src/engine/events/scenarios.ts` — `DEBUG_SCENARIOS` entries for strings responders. *(Task 17)*
- `src/data/divination-profiles.ts` — `strings` profile. *(Task 18)*
- `src/engine/ReadingPlanner.ts` — `atomicSignals` strings branch (path → atomic signals). *(Task 18)*
- `src/data/method-cards.ts` + `src/components/cards/MethodEmblem.tsx` — strings method front + emblem. *(Task 19)*
- `src/components/screens/GameTable.tsx` — `renderMinigame` `case 'strings'`. *(Task 23)*
- `src/components/overlays/ConstellationFan.tsx` + `src/components/screens/ResultReading.tsx` — strings render branch. *(Task 23)*
- `docs/game-systems.md` + `README.md` — §11 + method tables. *(Task 24)*

**Shipping layers** (each ends on a mergeable, test-green or tsc-green state):
- **Layer A — Data + pure engine (Tasks 1–7):** types, concept library, plan/generate/reveal/draw. Fully unit-tested; no UI, no engine wiring.
- **Layer B — Engine integration (Tasks 8–12):** the method joins the pool, the minigame drives via `GameEngine`. Engine tests green.
- **Layer C — Responders (Tasks 13–17):** affinity + interaction effects, the `weave` channel, debug scenarios. Engine tests green.
- **Layer D — Synthesis (Task 18):** profile + atomic-signal expansion. Engine tests green.
- **Layer E — UI (Tasks 19–23):** method card, sigil, board/fog/thread, screen, display surfaces. `tsc` green + manual.
- **Layer F — Docs (Task 24).**

---

## Task 1: Strings types

**Files:**
- Modify: `src/engine/types.ts`

**Interfaces:**
- Produces: `ConceptBandKind`, `ConceptFamily`, `WovenNode`, `WovenEdge`, `WeaveGraph`, `WeavePlan`, `StringsMinigameState`, `StringsResult`; `'strings'` in `DivinationType`; `StringsResult` in `DivinationResult`; `StringsMinigameState` in `MinigameState`. Consumed by every later task.

- [ ] **Step 1: Add `'strings'` to `DivinationType`**

In `src/engine/types.ts`, change the `DivinationType` line:

```typescript
export type DivinationType = 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings' | 'happening';
```

- [ ] **Step 2: Add the Strings type block**

In `src/engine/types.ts`, immediately **before** the `// ── Happening` / `HappeningResult` section (anywhere among the result interfaces is fine; place it after the `RuneResult` block), add:

```typescript
// ── Strings of Fate ──
export type ConceptBandKind = 'origin' | 'crossing' | 'destination';
export type ConceptFamily = 'benevolent' | 'challenging' | 'neutral';

/** A node placed in a generated weave. */
export interface WovenNode {
  id: string;          // unique within a weave, e.g. 'b1-2'
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

/** Affinity-derived levers, resolved once by planWeave(). */
export interface WeavePlan {
  bandCount: number;     // 4 base; Chaos dominant → 5
  width: number;         // pickable candidates per step (base 3; Fate −1 floor 2; Will +1)
  veil: number;          // candidates shown but unpickable (Shadow ascendant 1, dominant 2)
  clarity: 'silhouette' | 'mood' | 'themes' | 'laid-bare';
  lookAhead: number;     // bands of silhouette look-ahead (Light)
  backtracks: number;    // Will: ascendant 1, dominant 2
  allowRedraw: boolean;  // Will dominant
  offerRethread: boolean;// Will stirring+ (UI surfaces a one-time prompt)
  extremeBias: number;   // signed chaosIdx − orderIdx (−3..+3)
  crossingDensity: number; // forward edges per node (2..4)
  foresight: boolean;    // Light ascendant+ — fully un-veil one candidate
  sources: string[];     // human-readable active levers (debug/flavor)
}

export interface StringsMinigameState {
  method: 'strings';
  graph: WeaveGraph;
  plan: WeavePlan;
  visitedPath: string[];        // ordered node ids, [originId, …]
  activeId: string;             // last of visitedPath
  candidateIds: string[];       // pickable revealed neighbors of active
  veiledCandidateIds: string[]; // revealed-but-veiled (Shadow) — visible, unpickable
  lookAheadIds: string[];       // silhouettes one+ band beyond (Light)
  revealedIds: string[];        // every node ever un-fogged
  foresightId: string | null;   // candidate fully un-veiled this step (Light)
  backtracksRemaining: number;
  redrawUsed: boolean;
  phase: 'drawing' | 'arrived';
}

export interface StringsResult extends ThematicData {
  type: 'strings';
  id: string;            // `strings:<destinationConceptId>`
  name: string;          // path name, joined ' · '
  symbol: string;        // destination glyph
  interpretation: string;
  path: WovenNode[];     // ordered origin→destination
  destinationId: string;
  tags: Tag[];
}
```

- [ ] **Step 3: Add `StringsResult` to the `DivinationResult` union**

Change the `DivinationResult` union line to include `StringsResult`:

```typescript
export type DivinationResult = TarotResult | DiceResult | IChingResult | AstralResult | RuneResult | StringsResult;
```

- [ ] **Step 4: Add `StringsMinigameState` to the `MinigameState` union**

Change the `MinigameState` union:

```typescript
export type MinigameState =
  | TarotDraftState
  | DiceMinigameState
  | IChingMinigameState
  | StringsMinigameState;
```

- [ ] **Step 5: Satisfy the one exhaustive `Record<DivinationType, …>`**

`METHOD_FRONTS` in `src/data/method-cards.ts` is typed `Record<DivinationType, MethodFrontConfig>`, so the new union member forces an entry or `tsc` fails. Add it now (the illustrated emblem is refined in Task 19):

```typescript
  strings:   { title: 'Strings of Fate', flavor: 'Follow the red thread through the dark.', color: '#c33b5e', symbol: '✶' },
```

(Switches over `DivinationType`/`MinigameState`/`DivinationResult` — `drawSingleResult`, `MethodEmblem`, `GameTable.renderMinigame` — all have a `default`/fallback branch, so they do **not** break; only the exhaustive `Record` does.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/data/method-cards.ts
git commit -m "feat(engine): add Strings of Fate types"
```

---

## Task 2: Concept library (`data/strings.ts`)

**Files:**
- Create: `src/data/strings.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces: `ConceptDef`, `CONCEPTS: Record<string, ConceptDef>`, `ORIGIN_IDS: string[]`, `CROSSING_IDS: string[]`, `destinationsFor(q: QuestionType): string[]`, `conceptTags(c: ConceptDef): Tag[]`. Consumed by `engine/strings.ts`, responders, ReadingPlanner, scenarios, UI.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/Strings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor } from '../../data/strings';
import type { QuestionType } from '../types';

describe('strings concept library', () => {
  it('has origins, a crossing pool large enough for two bands, and per-question destinations', () => {
    expect(ORIGIN_IDS.length).toBeGreaterThanOrEqual(1);
    // Two crossing bands of 4 distinct nodes each → need ≥ 8.
    expect(CROSSING_IDS.length).toBeGreaterThanOrEqual(8);
    for (const q of ['decision', 'relationship', 'future', 'self'] as QuestionType[]) {
      expect(destinationsFor(q).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every concept is internally consistent', () => {
    for (const [id, c] of Object.entries(CONCEPTS)) {
      expect(c.id).toBe(id);
      expect(c.themes.length).toBeGreaterThanOrEqual(1);
      expect(c.tags).toContain(`concept-${id}`);
      expect(c.tags).toContain(`family-${c.family}`);
      // Destinations must declare which questions they answer.
      if (c.bands.includes('destination')) {
        expect(c.questionTypes && c.questionTypes.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts`
Expected: FAIL — `Cannot find module '../../data/strings'`.

- [ ] **Step 3: Create `src/data/strings.ts`**

```typescript
import type {
  ConceptBandKind, ConceptFamily, DimensionValues, ModifierRole,
  ThemeTag, QuestionType, Tag, WovenNode, StringsResult,
} from '../engine/types';

export interface ConceptDef {
  id: string;
  name: string;
  glyph: string;              // short unicode symbol rendered inside the Sigil-Gem
  bands: ConceptBandKind[];
  family: ConceptFamily;
  themes: ThemeTag[];         // 1–2
  dimensions: DimensionValues;
  modifierRole: ModifierRole;
  mood: string;               // one-word surface hint
  meaning: string;            // full interpretation on arrival
  questionTypes?: QuestionType[]; // destinations only
}

const D = (favorability: number, certainty: number, volatility: number): DimensionValues =>
  ({ favorability, certainty, volatility });

// id, name, glyph, bands, family, themes, dims, role, mood, meaning, questionTypes?
type Row = [
  string, string, string, ConceptBandKind[], ConceptFamily, ThemeTag[],
  DimensionValues, ModifierRole, string, string, QuestionType[]?,
];

const ROWS: Row[] = [
  // ── Origins (role subject) ──
  ['the-self', 'The Self', '✦', ['origin'], 'neutral', ['mystery'], D(0, 0, 0), 'subject', 'here', "Where you stand now — the thread's first knot."],
  ['the-threshold', 'The Threshold', '⟡', ['origin'], 'neutral', ['transformation'], D(0, -0.5, 0.5), 'subject', 'edge', 'You stand at a verge; the weave begins to move.'],
  ['the-hearth', 'The Hearth', '⌂', ['origin'], 'neutral', ['harmony'], D(0.5, 0.5, -0.5), 'subject', 'home', 'From what is familiar, the thread sets out.'],
  ['the-question', 'The Question', '❖', ['origin'], 'neutral', ['mystery'], D(0, -0.5, 0), 'subject', 'why', 'The asking itself, around which fate coils.'],

  // ── Crossings (role action) ──
  ['a-rising-tide', 'A Rising Tide', '〜', ['crossing'], 'benevolent', ['renewal'], D(1, 0, 0.5), 'action', 'flow', 'A force gathers in your favor.'],
  ['the-severance', 'The Severance', '✂', ['crossing'], 'challenging', ['conflict', 'transformation'], D(-1, 0.5, 1), 'action', 'cut', 'Something is cut away.'],
  ['the-witness', 'The Witness', '◉', ['crossing'], 'neutral', ['mystery'], D(0, -0.5, 0), 'action', 'seen', 'You are observed; a presence marks your path.'],
  ['the-ember', 'The Ember', '✶', ['crossing'], 'benevolent', ['illumination'], D(0.5, 0, 0.5), 'action', 'spark', 'A small light insists on burning.'],
  ['the-undertow', 'The Undertow', '≈', ['crossing'], 'challenging', ['surrender'], D(-1, -0.5, 0.5), 'action', 'pull', 'A quiet pull drags beneath the surface.'],
  ['the-keystone', 'The Keystone', '⬢', ['crossing'], 'neutral', ['authority'], D(0.5, 1, -0.5), 'action', 'hold', 'A thing that holds the rest in place.'],
  ['the-reckoning', 'The Reckoning', '⚖', ['crossing'], 'challenging', ['conflict', 'authority'], D(-0.5, 0.5, 0.5), 'action', 'weigh', 'Accounts are called due.'],
  ['the-blossom', 'The Blossom', '❀', ['crossing'], 'benevolent', ['renewal', 'harmony'], D(1.5, 0, 0), 'action', 'bloom', 'What was tended comes to flower.'],
  ['the-fracture', 'The Fracture', '⟁', ['crossing'], 'challenging', ['upheaval'], D(-1, -0.5, 1.5), 'action', 'break', 'A break runs through the foundation.'],
  ['the-current', 'The Current', '➶', ['crossing'], 'neutral', ['transformation'], D(0, 0, 1), 'action', 'drift', 'Motion takes you somewhere not yet named.'],
  ['the-lantern-bearer', 'The Lantern-Bearer', '☼', ['crossing'], 'benevolent', ['illumination', 'authority'], D(1, 0.5, 0), 'action', 'guide', 'One who lights the way ahead.'],
  ['the-shroud', 'The Shroud', '☁', ['crossing'], 'challenging', ['mystery'], D(-0.5, -1, 0.5), 'action', 'veil', 'What is hidden presses close.'],

  // ── Destinations (role effect) — three per question ──
  ['the-chosen-road', 'The Chosen Road', '➤', ['destination'], 'benevolent', ['authority'], D(1, 1, 0), 'effect', 'choose', 'The path you take proves true.', ['decision']],
  ['the-closed-gate', 'The Closed Gate', '⛌', ['destination'], 'challenging', ['stagnation'], D(-1, 0.5, -0.5), 'effect', 'halt', 'This way is shut; turn elsewhere.', ['decision']],
  ['the-double-edge', 'The Double Edge', '⚔', ['destination'], 'neutral', ['conflict'], D(0, 0, 1), 'effect', 'both', 'Either choice cuts; weigh what you can bear to lose.', ['decision']],

  ['the-other', 'The Other', '❤', ['destination'], 'benevolent', ['harmony'], D(1.5, 0.5, 0), 'effect', 'bond', 'Another is bound to you by the thread of fate.', ['relationship']],
  ['the-parting', 'The Parting', '⤞', ['destination'], 'challenging', ['surrender'], D(-1, 0, 0.5), 'effect', 'apart', 'The strings loosen; a way diverges.', ['relationship']],
  ['the-mirror-soul', 'The Mirror-Soul', '☯', ['destination'], 'neutral', ['mystery', 'harmony'], D(0.5, -0.5, 0), 'effect', 'echo', 'You meet yourself in another.', ['relationship']],

  ['the-dawn', 'The Dawn', '☀', ['destination'], 'benevolent', ['renewal'], D(1.5, 0.5, 0), 'effect', 'rise', 'What comes brightens.', ['future']],
  ['the-long-night', 'The Long Night', '☾', ['destination'], 'challenging', ['stagnation', 'mystery'], D(-1, -0.5, 0), 'effect', 'wait', 'A dim stretch lies ahead; endure it.', ['future']],
  ['the-turning', 'The Turning', '☋', ['destination'], 'neutral', ['transformation'], D(0, 0, 1.5), 'effect', 'turn', 'All of it is about to change.', ['future']],

  ['the-true-name', 'The True Name', '✷', ['destination'], 'benevolent', ['illumination'], D(1, 1, 0), 'effect', 'know', 'You recognize what you are.', ['self']],
  ['the-hollow', 'The Hollow', '◍', ['destination'], 'challenging', ['stagnation'], D(-1, -0.5, 0), 'effect', 'empty', 'A lack you have circled for years.', ['self']],
  ['the-becoming', 'The Becoming', '⟰', ['destination'], 'neutral', ['transformation'], D(0.5, 0, 1), 'effect', 'grow', 'You are not finished; you are forming.', ['self']],
];

export const CONCEPTS: Record<string, ConceptDef> = Object.fromEntries(
  ROWS.map(([id, name, glyph, bands, family, themes, dimensions, modifierRole, mood, meaning, questionTypes]) =>
    [id, { id, name, glyph, bands, family, themes, dimensions, modifierRole, mood, meaning, questionTypes }]),
) as Record<string, ConceptDef>;

export const ORIGIN_IDS: string[] = ROWS.filter((r) => r[3].includes('origin')).map((r) => r[0]);
export const CROSSING_IDS: string[] = ROWS.filter((r) => r[3].includes('crossing')).map((r) => r[0]);

export function destinationsFor(q: QuestionType): string[] {
  return ROWS.filter((r) => r[3].includes('destination') && (r[10] ?? []).includes(q)).map((r) => r[0]);
}

/** The tag set a concept contributes to a consolidated path. */
export function conceptTags(c: ConceptDef): Tag[] {
  return [`concept-${c.id}`, `family-${c.family}`, ...c.themes];
}

// consolidatePath / pathCoherence are added in Task 3.
export type { WovenNode, StringsResult };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/data/strings.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(data): Strings of Fate concept library"
```

---

## Task 3: Path consolidation & coherence (`data/strings.ts`)

**Files:**
- Modify: `src/data/strings.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Produces: `consolidatePath(path: WovenNode[]): StringsResult` (destination-governed; destination weight ×2), `pathCoherence(path: WovenNode[]): 'coherent' | 'tangled' | null`. Consumed by `GameEngine.commitWeave`, `drawWeave`, responders, ReadingPlanner.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { consolidatePath, pathCoherence, CONCEPTS as C } from '../../data/strings';
import type { WovenNode } from '../types';

const node = (conceptId: string, band: number): WovenNode =>
  ({ id: `b${band}`, conceptId, band, family: C[conceptId].family, x: 0, y: 0 });

describe('consolidatePath', () => {
  it('is destination-governed and carries the path + tags', () => {
    const path = [node('the-self', 0), node('the-blossom', 1), node('the-dawn', 3)];
    const r = consolidatePath(path);
    expect(r.type).toBe('strings');
    expect(r.destinationId).toBe('the-dawn');
    expect(r.path).toHaveLength(3);
    expect(r.tags).toEqual(expect.arrayContaining(['draw', 'random', 'strings', 'weave']));
    expect(r.tags).toContain('concept-the-dawn');
    // Destination favorability (+1.5, weight 2) dominates the milder origin/crossing.
    expect(r.dimensions.favorability).toBeGreaterThan(0.5);
    // Never emits a reversible/orientation tag (stays out of Mirror).
    expect(r.tags).not.toContain('reversible');
  });
});

describe('pathCoherence', () => {
  it('flags an opposed-theme path tangled and a single-family path coherent', () => {
    // harmony (the-hearth/the-blossom) vs conflict (the-severance) → opposed pair.
    const tangled = [node('the-hearth', 0), node('the-severance', 1), node('the-double-edge', 3)];
    expect(pathCoherence(tangled)).toBe('tangled');
    // all renewal/harmony, low variance → coherent.
    const coherent = [node('the-hearth', 0), node('the-blossom', 1), node('the-dawn', 3)];
    expect(pathCoherence(coherent)).toBe('coherent');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts`
Expected: FAIL — `consolidatePath is not a function`.

- [ ] **Step 3: Implement `consolidatePath` + `pathCoherence`**

In `src/data/strings.ts`, replace the final line `export type { WovenNode, StringsResult };` with:

```typescript
// ── Consolidation ──
const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));

// Theme opposition pairs (mirrors ReadingPlanner's THEME_OPPOSITIONS).
const THEME_OPPOSED: [ThemeTag, ThemeTag][] = [
  ['upheaval', 'harmony'], ['renewal', 'stagnation'],
  ['illumination', 'mystery'], ['conflict', 'surrender'], ['authority', 'surrender'],
];

/** Destination-governed: destination weight 2, origin & crossings weight 1. */
export function consolidatePath(path: WovenNode[]): StringsResult {
  const defs = path.map((n) => CONCEPTS[n.conceptId]);
  const destIdx = path.length - 1;
  const weightOf = (i: number) => (i === destIdx ? 2 : 1);
  const totalW = defs.reduce((s, _d, i) => s + weightOf(i), 0);

  const dims: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };
  for (let i = 0; i < defs.length; i++) {
    for (const a of AXES) dims[a] += defs[i].dimensions[a] * weightOf(i);
  }
  for (const a of AXES) dims[a] = clampDim(dims[a] / totalW);

  // Themes: weighted frequency, destination themes forced in, cap 2.
  const freq = new Map<ThemeTag, number>();
  defs.forEach((d, i) => d.themes.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + weightOf(i))));
  const destThemes = defs[destIdx].themes;
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const themes: ThemeTag[] = [...new Set<ThemeTag>([...destThemes, ...ranked])].slice(0, 2);

  const roles = [...new Set<ModifierRole>(defs.map((d) => d.modifierRole))];
  const tags: Tag[] = [
    'draw', 'random', 'strings', 'weave',
    ...new Set(defs.flatMap((d) => conceptTags(d))),
  ];

  const dest = defs[destIdx];
  return {
    type: 'strings',
    id: `strings:${dest.id}`,
    name: defs.map((d) => d.name).join(' · '),
    symbol: dest.glyph,
    interpretation: `${dest.name} — ${dest.meaning}`,
    path,
    destinationId: dest.id,
    themes,
    dimensions: dims,
    modifierRoles: roles,
    tags,
  };
}

/** A path is `tangled` if it spans an opposed theme pair; else `coherent` if its
 *  themes cluster and favorability is steady; else null. */
export function pathCoherence(path: WovenNode[]): 'coherent' | 'tangled' | null {
  const defs = path.map((n) => CONCEPTS[n.conceptId]);
  const themes = new Set<ThemeTag>(defs.flatMap((d) => d.themes));
  for (const [a, b] of THEME_OPPOSED) if (themes.has(a) && themes.has(b)) return 'tangled';

  const favs = defs.map((d) => d.dimensions.favorability);
  const mean = favs.reduce((s, v) => s + v, 0) / favs.length;
  const variance = favs.reduce((s, v) => s + (v - mean) ** 2, 0) / favs.length;
  const sharedTheme = defs.every((d) => d.themes.some((t) => defs[0].themes.includes(t)));
  if (sharedTheme || Math.sqrt(variance) < 0.6) return 'coherent';
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/data/strings.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(data): destination-governed path consolidation + coherence"
```

---

## Task 4: `planWeave` (`engine/strings.ts`)

**Files:**
- Create: `src/engine/strings.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Produces: `planWeave(affinities: Record<string, number>): WeavePlan`. Consumed by `generateWeave`, `revealFrom`, `drawWeave`, `GameEngine.startWeave`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { planWeave } from '../strings';

const baseAff = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };

describe('planWeave', () => {
  it('defaults at baseline: 4 bands, width 3, mood clarity, no agency extras', () => {
    const p = planWeave(baseAff);
    expect(p.bandCount).toBe(4);
    expect(p.width).toBe(3);
    expect(p.veil).toBe(0);
    expect(p.clarity).toBe('mood');
    expect(p.backtracks).toBe(0);
    expect(p.foresight).toBe(false);
  });

  it('Fate ascendant thins width; Will ascendant widens + grants a backtrack', () => {
    expect(planWeave({ ...baseAff, fate: 70 }).width).toBe(2);
    const will = planWeave({ ...baseAff, will: 70 });
    expect(will.width).toBe(4);
    expect(will.backtracks).toBe(1);
  });

  it('Light raises clarity + foresight; Shadow lowers clarity + veils; Chaos lengthens', () => {
    expect(planWeave({ ...baseAff, light: 70 }).clarity).toBe('themes');
    expect(planWeave({ ...baseAff, light: 70 }).foresight).toBe(true);
    expect(planWeave({ ...baseAff, shadow: 70 }).clarity).toBe('silhouette');
    expect(planWeave({ ...baseAff, shadow: 70 }).veil).toBe(1);
    expect(planWeave({ ...baseAff, chaos: 90 }).bandCount).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t planWeave`
Expected: FAIL — `Cannot find module '../strings'`.

- [ ] **Step 3: Create `src/engine/strings.ts` with `planWeave`**

```typescript
import type { QuestionType, WeaveGraph, WeavePlan, WovenNode, WovenEdge, StringsResult } from './types';
import { bandOf, BAND_ORDER } from '../data/affinities';
import { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor, consolidatePath } from '../data/strings';

const idx = (value: number) => BAND_ORDER.indexOf(bandOf(value));
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function planWeave(affinities: Record<string, number>): WeavePlan {
  const chaosI = idx(affinities.chaos ?? 0);
  const orderI = idx(affinities.order ?? 0);
  const fateI = idx(affinities.fate ?? 0);
  const willI = idx(affinities.will ?? 0);
  const lightI = idx(affinities.light ?? 0);
  const shadowI = idx(affinities.shadow ?? 0);

  const width = willI >= 2 ? 4 : (fateI >= 2 ? 2 : 3);
  const veil = shadowI >= 3 ? 2 : (shadowI >= 2 ? 1 : 0);
  const clarity: WeavePlan['clarity'] =
    shadowI >= 2 ? 'silhouette'
    : lightI >= 3 ? 'laid-bare'
    : lightI >= 2 ? 'themes'
    : 'mood';

  const sources: string[] = [];
  if (willI >= 2) sources.push('Your will widens the weave');
  if (fateI >= 2) sources.push('Fate narrows the threads');
  if (lightI >= 2) sources.push('Light parts the fog');
  if (shadowI >= 2) sources.push('Shadow deepens the veil');
  if (chaosI >= 2) sources.push('Chaos tangles the path');
  if (orderI >= 2) sources.push('Order straightens the weave');

  return {
    bandCount: chaosI >= 3 ? 5 : 4,
    width,
    veil,
    clarity,
    lookAhead: lightI >= 3 ? 2 : (lightI >= 2 ? 1 : 0),
    backtracks: willI >= 3 ? 2 : (willI >= 2 ? 1 : 0),
    allowRedraw: willI >= 3,
    offerRethread: willI >= 1,
    extremeBias: chaosI - orderI,
    crossingDensity: clampN(3 + (chaosI >= 2 ? 1 : 0) - (orderI >= 2 ? 1 : 0), 2, 4),
    foresight: lightI >= 2,
    sources,
  };
}

// generateWeave / revealFrom / drawWeave are added in Tasks 5–7.
export type { WeaveGraph, WeavePlan, WovenNode, WovenEdge, StringsResult, QuestionType };
export { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor, consolidatePath };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t planWeave`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS (the re-exports avoid `noUnusedLocals` on the imports until later tasks use them).

```bash
git add src/engine/strings.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(engine): planWeave affinity levers"
```

---

## Task 5: `generateWeave` + reachability (`engine/strings.ts`)

**Files:**
- Modify: `src/engine/strings.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Produces: `generateWeave(question: QuestionType, plan: WeavePlan, rng?: () => number): WeaveGraph`. **Invariant:** every node has ≥1 forward edge (except destinations) and at least one origin→destination path exists.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { generateWeave } from '../strings';
import type { WeaveGraph } from '../types';

function reaches(graph: WeaveGraph): boolean {
  const last = graph.bandCount - 1;
  const fwd = new Map<string, string[]>();
  for (const e of graph.edges) (fwd.get(e.from) ?? fwd.set(e.from, []).get(e.from)!).push(e.to);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>([graph.originId]);
  const stack = [graph.originId];
  while (stack.length) {
    const id = stack.pop()!;
    if (byId.get(id)!.band === last) return true;
    for (const to of fwd.get(id) ?? []) if (!seen.has(to)) { seen.add(to); stack.push(to); }
  }
  return false;
}

describe('generateWeave', () => {
  it('builds the planned bands with a reachable destination', () => {
    const plan = planWeave(baseAff);
    for (let i = 0; i < 25; i++) {
      const g = generateWeave('relationship', plan, () => (i * 0.37 + 0.13) % 1);
      expect(g.bandCount).toBe(4);
      expect(g.nodes.filter((n) => n.band === 0)).toHaveLength(1);
      expect(g.nodes.filter((n) => n.band === g.bandCount - 1).length).toBeGreaterThanOrEqual(1);
      // every non-destination node has a forward edge
      for (const n of g.nodes) {
        if (n.band < g.bandCount - 1) {
          expect(g.edges.some((e) => e.from === n.id)).toBe(true);
        }
      }
      expect(reaches(g)).toBe(true);
    }
  });

  it('only seeds destinations that answer the question', () => {
    const g = generateWeave('relationship', planWeave(baseAff), Math.random);
    const dests = g.nodes.filter((n) => n.band === g.bandCount - 1);
    for (const d of dests) {
      expect(CONCEPTS[d.conceptId].questionTypes).toContain('relationship');
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t generateWeave`
Expected: FAIL — `generateWeave is not a function`.

- [ ] **Step 3: Implement `generateWeave`**

In `src/engine/strings.ts`, replace the trailing `// generateWeave / revealFrom / drawWeave are added in Tasks 5–7.` comment with the function (keep it **above** the re-export lines):

```typescript
const N_CROSSING = 4; // crossing nodes per band
const N_DEST = 3;     // destination nodes shown

const pick = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// Weighted-without-replacement sample of `n` ids, weight skewed by extremeBias:
// Chaos (>0) favors high-magnitude concepts; Order (<0) favors mild ones.
function sampleCrossings(n: number, extremeBias: number, rng: () => number): string[] {
  const pool = [...CROSSING_IDS];
  const out: string[] = [];
  while (out.length < n && pool.length > 0) {
    const weights = pool.map((id) => {
      const d = CONCEPTS[id].dimensions;
      const mag = (Math.abs(d.favorability) + Math.abs(d.certainty) + Math.abs(d.volatility)) / 3; // 0..2
      return Math.max(0.05, 1 + extremeBias * 0.4 * (mag - 0.5));
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rng() * total;
    let chosen = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) { chosen = i; break; } }
    out.push(pool.splice(chosen, 1)[0]);
  }
  return out;
}

function placeNode(id: string, band: number, indexInBand: number, bandSize: number, bandCount: number, jitter: number, rng: () => number): WovenNode {
  const radius = bandCount > 1 ? band / (bandCount - 1) : 0;
  const baseAngle = bandSize > 1 ? (indexInBand / bandSize) * Math.PI * 2 : 0;
  const wobble = (rng() - 0.5) * jitter;
  return {
    id: `b${band}-${indexInBand}`,
    conceptId: id,
    band,
    family: CONCEPTS[id].family,
    x: Math.cos(baseAngle + wobble) * radius,
    y: Math.sin(baseAngle + wobble) * radius,
  };
}

export function generateWeave(question: QuestionType, plan: WeavePlan, rng: () => number = Math.random): WeaveGraph {
  const bandCount = plan.bandCount;
  const jitter = 0.4 + Math.max(0, plan.extremeBias) * 0.25;
  const bands: WovenNode[][] = [];

  // band 0: origin
  bands.push([placeNode(pick(ORIGIN_IDS, rng), 0, 0, 1, bandCount, 0, rng)]);

  // crossing bands 1..bandCount-2
  for (let b = 1; b < bandCount - 1; b++) {
    const ids = sampleCrossings(N_CROSSING, plan.extremeBias, rng);
    bands.push(ids.map((id, i) => placeNode(id, b, i, ids.length, bandCount, jitter, rng)));
  }

  // destination band
  const destPool = destinationsFor(question);
  const destIds = destPool.length <= N_DEST ? destPool : (() => {
    const copy = [...destPool]; const out: string[] = [];
    while (out.length < N_DEST && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    return out;
  })();
  bands.push(destIds.map((id, i) => placeNode(id, bandCount - 1, i, destIds.length, bandCount, jitter, rng)));

  // edges: every next-band node gets ≥1 incoming (round-robin), every source gets
  // up to crossingDensity distinct forward targets (≥2 when available).
  const edges: WovenEdge[] = [];
  for (let b = 0; b < bandCount - 1; b++) {
    const from = bands[b], to = bands[b + 1];
    const wanted = Math.min(plan.crossingDensity, to.length);
    const minPer = Math.min(Math.max(2, 1), to.length); // ≥2 when possible
    to.forEach((t, i) => edges.push({ from: from[i % from.length].id, to: t.id })); // coverage
    for (const src of from) {
      const have = new Set(edges.filter((e) => e.from === src.id).map((e) => e.to));
      const targets = [...to].sort(() => rng() - 0.5);
      for (const t of targets) {
        if (have.size >= Math.max(wanted, minPer)) break;
        if (!have.has(t.id)) { have.add(t.id); edges.push({ from: src.id, to: t.id }); }
      }
    }
  }

  return { nodes: bands.flat(), edges, originId: bands[0][0].id, bandCount };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t generateWeave`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/strings.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(engine): generateWeave layered DAG with reachability"
```

---

## Task 6: `revealFrom` (`engine/strings.ts`)

**Files:**
- Modify: `src/engine/strings.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Produces: `revealFrom(graph: WeaveGraph, plan: WeavePlan, activeId: string, rng?: () => number): { candidateIds: string[]; veiledCandidateIds: string[]; lookAheadIds: string[] }`. Pickable = `candidateIds`; Shadow's `veiledCandidateIds` are shown but unpickable; `lookAheadIds` are silhouettes Light reveals one+ band ahead. When `rng` is supplied the candidate subset is reshuffled (used by re-draw).

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { revealFrom } from '../strings';

describe('revealFrom', () => {
  const plan = planWeave(baseAff);
  const g = generateWeave('self', plan, () => 0.42);

  it('reveals up to width pickable candidates from the active node', () => {
    const r = revealFrom(g, plan, g.originId);
    const fwd = g.edges.filter((e) => e.from === g.originId).map((e) => e.to);
    expect(r.candidateIds.length).toBe(Math.min(plan.width, fwd.length));
    for (const id of r.candidateIds) expect(fwd).toContain(id);
  });

  it('Shadow veils some candidates but always leaves at least one pickable', () => {
    const shadowPlan = planWeave({ ...baseAff, shadow: 90 }); // veil 2, silhouette
    const sg = generateWeave('self', shadowPlan, () => 0.42);
    const r = revealFrom(sg, shadowPlan, sg.originId);
    expect(r.candidateIds.length).toBeGreaterThanOrEqual(1);
    for (const id of r.veiledCandidateIds) expect(r.candidateIds).not.toContain(id);
  });

  it('Light surfaces look-ahead silhouettes; baseline does not', () => {
    expect(revealFrom(g, plan, g.originId).lookAheadIds).toHaveLength(0);
    const lightPlan = planWeave({ ...baseAff, light: 70 });
    const lg = generateWeave('self', lightPlan, () => 0.42);
    expect(revealFrom(lg, lightPlan, lg.originId).lookAheadIds.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t revealFrom`
Expected: FAIL — `revealFrom is not a function`.

- [ ] **Step 3: Implement `revealFrom`**

In `src/engine/strings.ts`, add above the re-export lines:

```typescript
export function revealFrom(
  graph: WeaveGraph,
  plan: WeavePlan,
  activeId: string,
  rng?: () => number,
): { candidateIds: string[]; veiledCandidateIds: string[]; lookAheadIds: string[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const forward = (id: string) => graph.edges.filter((e) => e.from === id).map((e) => e.to);

  let neighbors = forward(activeId);
  if (rng) neighbors = [...neighbors].sort(() => rng() - 0.5); // re-draw reshuffles
  const windowSize = Math.min(plan.width, neighbors.length);
  const windowIds = neighbors.slice(0, windowSize);

  // Veil the last `veil` of the window, but never the last pickable.
  const veilCount = Math.min(plan.veil, Math.max(0, windowIds.length - 1));
  const veiledCandidateIds = veilCount > 0 ? windowIds.slice(windowIds.length - veilCount) : [];
  const candidateIds = windowIds.filter((id) => !veiledCandidateIds.includes(id));

  // Look-ahead: silhouettes `lookAhead` bands beyond the active node.
  const lookAheadIds: string[] = [];
  if (plan.lookAhead > 0) {
    let frontier = [...windowIds];
    const seen = new Set<string>([activeId, ...windowIds]);
    for (let depth = 0; depth < plan.lookAhead; depth++) {
      const next: string[] = [];
      for (const id of frontier) for (const to of forward(id)) {
        if (!seen.has(to) && byId.has(to)) { seen.add(to); next.push(to); lookAheadIds.push(to); }
      }
      frontier = next;
    }
  }

  return { candidateIds, veiledCandidateIds, lookAheadIds };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t revealFrom`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/strings.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(engine): revealFrom fog-of-war candidate logic"
```

---

## Task 7: `drawWeave` (engine-spawned full path) (`engine/strings.ts`)

**Files:**
- Modify: `src/engine/strings.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Produces: `drawWeave(affinities: Record<string, number>, rng?: () => number, question?: QuestionType): StringsResult`. Generates a weave, auto-traverses a valid origin→destination path, and consolidates it — used by `TurnOrchestrator.drawSingleResult` and `chaos-second-result`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { drawWeave } from '../strings';

describe('drawWeave', () => {
  it('auto-traverses a full path to a question destination and consolidates it', () => {
    const r = drawWeave(baseAff, () => 0.5, 'decision');
    expect(r.type).toBe('strings');
    expect(r.path.length).toBeGreaterThanOrEqual(2);
    expect(r.path[0].band).toBe(0);
    // a full auto-traversal walks one node per band, so the last node sits on the
    // destination band and its band index equals the final path index.
    expect(r.path[r.path.length - 1].band).toBe(r.path.length - 1);
    expect(CONCEPTS[r.destinationId].questionTypes).toContain('decision');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t drawWeave`
Expected: FAIL — `drawWeave is not a function`.

- [ ] **Step 3: Implement `drawWeave`**

In `src/engine/strings.ts`, add above the re-export lines:

```typescript
export function drawWeave(
  affinities: Record<string, number>,
  rng: () => number = Math.random,
  question: QuestionType = 'self',
): StringsResult {
  const plan = planWeave(affinities);
  const graph = generateWeave(question, plan, rng);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const forward = (id: string) => graph.edges.filter((e) => e.from === id).map((e) => e.to);

  const path: WovenNode[] = [byId.get(graph.originId)!];
  let cur = graph.originId;
  // Walk forward until a destination (last band) is reached.
  for (let guard = 0; guard < graph.bandCount + 2; guard++) {
    if (byId.get(cur)!.band === graph.bandCount - 1) break;
    const next = forward(cur);
    if (next.length === 0) break;
    cur = next[Math.floor(rng() * next.length)];
    path.push(byId.get(cur)!);
  }
  return consolidatePath(path);
}
```

- [ ] **Step 4: Run the test + the full Strings file**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/strings.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(engine): drawWeave engine-spawned full path"
```

> **Layer A complete** — concept library + plan/generate/reveal/draw, fully unit-tested. No UI, no engine wiring yet. Mergeable.

---

## Task 8: Orchestrator — pool, weights, `drawSingleResult`

**Files:**
- Modify: `src/engine/TurnOrchestrator.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Consumes: `drawWeave` (Task 7).
- Produces: `'strings'` joins `POOL_TYPES`; `drawSingleResult(method, affinities, question?)` accepts an optional `QuestionType` and handles `case 'strings'`; `removeUsedMethod` accepts `'strings'`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { TurnOrchestrator } from '../TurnOrchestrator';
import { EventBus } from '../EventBus';

describe('TurnOrchestrator strings', () => {
  it('drawSingleResult draws a strings result tailored to the question', () => {
    const orch = new TurnOrchestrator(new EventBus());
    const r = orch.drawSingleResult('strings', baseAff, 'future');
    expect(r.type).toBe('strings');
    if (r.type === 'strings') {
      expect(CONCEPTS[r.destinationId].questionTypes).toContain('future');
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t "TurnOrchestrator strings"`
Expected: FAIL — `drawSingleResult` throws `Unknown divination type: strings`.

- [ ] **Step 3: Add the import + pool membership**

In `src/engine/TurnOrchestrator.ts`, add to the imports at the top:

```typescript
import { drawWeave } from './strings';
```

Change `POOL_TYPES` to include `'strings'`:

```typescript
const POOL_TYPES: DivinationType[] = ['tarot', 'd20', 'iching', 'astral', 'rune', 'strings'];
```

Add a `strings` weight to **every** row of `QUESTION_WEIGHTS` (relationship leans on it — the red thread of fate):

```typescript
const QUESTION_WEIGHTS: Record<QuestionType, Partial<Record<DivinationType, number>>> = {
  decision: { d20: 3, tarot: 1, iching: 1, astral: 2, rune: 1, strings: 1 },
  relationship: { tarot: 3, d20: 1, iching: 1, astral: 1, rune: 1, strings: 3 },
  future: { iching: 3, tarot: 1, d20: 1, astral: 2, rune: 2, strings: 2 },
  self: { tarot: 2, iching: 2, d20: 1, astral: 1, rune: 2, strings: 2 },
};
```

- [ ] **Step 4: Add the optional `question` param + `case 'strings'`**

Change the `drawSingleResult` signature and add the case:

```typescript
  drawSingleResult(
    method: DivinationType,
    affinities: Record<string, number>,
    question?: QuestionType,
  ): SlotResult {
    let result: SlotResult;

    switch (method) {
      case 'tarot':
        result = drawTarotCard(affinities);
        break;
      case 'd20':
        result = rollD20(affinities);
        break;
      case 'iching':
        result = castHexagram(affinities);
        break;
      case 'astral':
        result = consolidateCast(drawAstralCast(affinities));
        break;
      case 'rune':
        result = consolidateScatter(drawRuneScatter(affinities));
        break;
      case 'strings':
        result = drawWeave(affinities, Math.random, question);
        break;
      case 'happening':
        throw new Error('Happening has no drawSingleResult — use triggerHappening instead');
      default:
        throw new Error(`Unknown divination type: ${method}`);
    }

    this.bus.emit('slot-drawn', { type: method, result });
    return result;
  }
```

- [ ] **Step 5: Widen `removeUsedMethod`**

Change the `removeUsedMethod` signature:

```typescript
  removeUsedMethod(method: 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings'): void {
```

- [ ] **Step 6: Run the test + full suite**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t "TurnOrchestrator strings"` → PASS.
Run: `npx vitest run` → PASS. If any pool/method-enumeration test now sees `strings` in the pool and asserts an exact set, widen that assertion to allow `strings`.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/TurnOrchestrator.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(engine): strings joins the method pool + drawSingleResult"
```

---

## Task 9: `GameEngine.startWeave` + selection wiring

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/StringsReveal.test.ts`

**Interfaces:**
- Consumes: `planWeave`, `generateWeave`, `revealFrom` (`engine/strings`); `consolidatePath`, `pathCoherence` (`data/strings`); `StringsMinigameState`, `StringsResult` (types).
- Produces: `GameEngine.startWeave(): void` — seeds `minigameState` as a `drawing` weave; `confirmSelection()` starts it when `method === 'strings'`.

- [ ] **Step 1: Add imports**

In `src/engine/GameEngine.ts`, add after the existing type import on line 1 — extend the `from './types'` import to include the two new types, and add the module imports near the other engine imports:

```typescript
import { planWeave, generateWeave, revealFrom } from './strings';
import { consolidatePath, pathCoherence } from '../data/strings';
import type { StringsResult, StringsMinigameState } from './types';
```

(Note: `buildStringsResponders` is registered in Task 14 — do not import it yet, or `tsc` will fail on the not-yet-created module.)

- [ ] **Step 2: Write the failing test**

Create `src/engine/__tests__/StringsReveal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, StringsMinigameState } from '../types';

const HI = (a: Partial<Record<AffinityId, number>> = {}): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...a });

// startTurn runs beginRun() (drift toward baseline), so set affinities AFTER it.
function startWeaveWith(aff: Record<AffinityId, number>): GameEngine {
  const e = new GameEngine();
  e.startTurn('self');
  e.loadState({ affinities: aff, selectedMethod: 'strings', screen: 'minigame' });
  e.startWeave();
  return e;
}
const weave = (e: GameEngine) => e.getState().minigameState as StringsMinigameState;

describe('strings weave — start', () => {
  it('seeds a drawing weave with an origin and at least one candidate', () => {
    const e = startWeaveWith(HI());
    const s = weave(e);
    expect(s.method).toBe('strings');
    expect(s.phase).toBe('drawing');
    expect(s.visitedPath).toEqual([s.activeId]);
    expect(s.candidateIds.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts`
Expected: FAIL — `engine.startWeave is not a function`.

- [ ] **Step 4: Add `startWeave` + the `confirmSelection` branch**

In `src/engine/GameEngine.ts`, in `confirmSelection()`, change the tarot branch:

```typescript
    if (pending.method === 'tarot') {
      this.startTarotDraft(); // notifies
    } else if (pending.method === 'strings') {
      this.startWeave(); // notifies
    }
```

Then add `startWeave` (place it right after `startTarotDraft()` ends, near the other minigame methods):

```typescript
  // ── Strings of Fate Minigame ──

  startWeave(): void {
    const affinities = this.affinityEngine.getState();
    const plan = planWeave(affinities);
    const graph = generateWeave(this.state.questionType ?? 'self', plan, Math.random);
    const originId = graph.originId;
    const { candidateIds, veiledCandidateIds, lookAheadIds } = revealFrom(graph, plan, originId);
    const weave: StringsMinigameState = {
      method: 'strings',
      graph,
      plan,
      visitedPath: [originId],
      activeId: originId,
      candidateIds,
      veiledCandidateIds,
      lookAheadIds,
      revealedIds: [...new Set([originId, ...candidateIds, ...veiledCandidateIds, ...lookAheadIds])],
      foresightId: null,
      backtracksRemaining: plan.backtracks,
      redrawUsed: false,
      phase: 'drawing',
    };
    this.state.minigameState = weave;
    this.dispatchAt('strings:start', {});
    this.notify();
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/StringsReveal.test.ts
git commit -m "feat(engine): startWeave + strings selection wiring"
```

---

## Task 10: `GameEngine.stepTo` — reveal recompute + affinity feeds

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/StringsReveal.test.ts`

**Interfaces:**
- Produces: `GameEngine.stepTo(nodeId: string): void` (dispatches `strings:pick`, honors Chaos/Fate redirect + Fate foregone step, recomputes reveal, feeds Fate/Shadow); private `advanceWeave(weave, nodeId)`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/StringsReveal.test.ts`:

```typescript
describe('strings weave — stepping', () => {
  it('stepTo advances the path, recomputes candidates, and feeds Fate on a hinted accept', () => {
    const e = startWeaveWith(HI());
    const fateBefore = e.getState().affinities.fate;
    const cand = weave(e).candidateIds[0];
    e.stepTo(cand);
    const s = weave(e);
    expect(s.visitedPath).toContain(cand);
    expect(s.activeId).toBe(cand);
    expect(e.getState().affinities.fate).toBeGreaterThan(fateBefore);
  });

  it('reaching a destination flips the phase to arrived', () => {
    const e = startWeaveWith(HI());
    let guard = 0;
    while (weave(e).phase === 'drawing' && guard++ < 12) {
      e.stepTo(weave(e).candidateIds[0]);
    }
    expect(weave(e).phase).toBe('arrived');
    expect(weave(e).candidateIds).toHaveLength(0);
  });

  it('a blind (Shadow silhouette) accept feeds Shadow instead of Fate', () => {
    const e = startWeaveWith(HI({ shadow: 70 })); // clarity 'silhouette'
    const shadowBefore = e.getState().affinities.shadow;
    e.stepTo(weave(e).candidateIds[0]);
    expect(e.getState().affinities.shadow).toBeGreaterThan(shadowBefore);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts -t stepping`
Expected: FAIL — `engine.stepTo is not a function`.

- [ ] **Step 3: Implement `stepTo` + `advanceWeave`**

In `src/engine/GameEngine.ts`, add after `startWeave`:

```typescript
  stepTo(nodeId: string): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'drawing') throw new Error('Weave already arrived');
    if (!w.candidateIds.includes(nodeId)) throw new Error(`Node ${nodeId} is not a current candidate`);

    const byId = new Map(w.graph.nodes.map((n) => [n.id, n]));
    const hasForwardAfter = byId.get(nodeId)!.band < w.graph.bandCount - 1;

    // strings:pick — Chaos/Fate may redirect (OVERRIDE); Fate may add a foregone step (SPAWN).
    const { draft } = this.dispatchAt('strings:pick', {
      chosenId: nodeId,
      candidateIds: [...w.candidateIds],
      hasForwardAfter,
    });
    const finalId = typeof draft.redirectTo === 'string' && w.candidateIds.includes(draft.redirectTo)
      ? draft.redirectTo : nodeId;

    const usedForesight = w.foresightId !== null;
    this.advanceWeave(w, finalId);

    // Affinity feed for accepting the step.
    if (!usedForesight) {
      if (w.plan.clarity === 'silhouette') this.affinityEngine.applyAction('embrace-mystery'); // blind → Shadow
      else this.affinityEngine.applyAction('reveal-as-drawn');                                  // hinted → Fate
    }
    w.foresightId = null;

    // Fate foregone step: weave one more automatically along a candidate edge.
    if (draft.foregoneStep === true && w.phase === 'drawing' && w.candidateIds.length > 0) {
      const auto = w.candidateIds[Math.floor(Math.random() * w.candidateIds.length)];
      this.advanceWeave(w, auto);
    }

    this.notify();
  }

  private advanceWeave(w: StringsMinigameState, nodeId: string): void {
    const byId = new Map(w.graph.nodes.map((n) => [n.id, n]));
    w.visitedPath = [...w.visitedPath, nodeId];
    w.activeId = nodeId;
    if (byId.get(nodeId)!.band === w.graph.bandCount - 1) {
      w.phase = 'arrived';
      w.candidateIds = [];
      w.veiledCandidateIds = [];
      w.lookAheadIds = [];
      return;
    }
    const r = revealFrom(w.graph, w.plan, nodeId);
    w.candidateIds = r.candidateIds;
    w.veiledCandidateIds = r.veiledCandidateIds;
    w.lookAheadIds = r.lookAheadIds;
    w.revealedIds = [...new Set([...w.revealedIds, nodeId, ...r.candidateIds, ...r.veiledCandidateIds, ...r.lookAheadIds])];
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts -t stepping`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/StringsReveal.test.ts
git commit -m "feat(engine): stepTo with reveal recompute + affinity feeds"
```

---

## Task 11: `GameEngine.backtrack` / `redrawCandidates` / `useForesight`

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/StringsReveal.test.ts`

**Interfaces:**
- Produces: `backtrack()` (Will, decrements `backtracksRemaining`, feeds `take-reroll`), `redrawCandidates()` (Will-dominant, once, reshuffled reveal, feeds `take-reroll`), `useForesight(nodeId)` (Light, sets `foresightId`, feeds `use-peek`).

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/StringsReveal.test.ts`:

```typescript
describe('strings weave — agency', () => {
  it('Will backtrack returns to the previous node and feeds Will', () => {
    const e = startWeaveWith(HI({ will: 70 })); // backtracks 1
    const first = weave(e).candidateIds[0];
    e.stepTo(first);
    const willBefore = e.getState().affinities.will;
    e.backtrack();
    const s = weave(e);
    expect(s.visitedPath).not.toContain(first);
    expect(s.activeId).toBe(s.visitedPath[s.visitedPath.length - 1]);
    expect(s.backtracksRemaining).toBe(0);
    expect(e.getState().affinities.will).toBeGreaterThan(willBefore);
  });

  it('Light foresight marks the candidate and feeds Light', () => {
    const e = startWeaveWith(HI({ light: 70 }));
    const before = e.getState().affinities.light;
    const cand = weave(e).candidateIds[0];
    e.useForesight(cand);
    expect(weave(e).foresightId).toBe(cand);
    expect(e.getState().affinities.light).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts -t agency`
Expected: FAIL — `engine.backtrack is not a function`.

- [ ] **Step 3: Implement the three methods**

In `src/engine/GameEngine.ts`, add after `advanceWeave`:

```typescript
  backtrack(): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'drawing') throw new Error('Cannot backtrack after arrival');
    if (w.backtracksRemaining <= 0 || w.visitedPath.length <= 1) throw new Error('No backtrack available');
    const prev = w.visitedPath[w.visitedPath.length - 2];
    w.visitedPath = w.visitedPath.slice(0, -1);
    w.activeId = prev;
    const r = revealFrom(w.graph, w.plan, prev);
    w.candidateIds = r.candidateIds;
    w.veiledCandidateIds = r.veiledCandidateIds;
    w.lookAheadIds = r.lookAheadIds;
    w.backtracksRemaining -= 1;
    this.affinityEngine.applyAction('take-reroll'); // Will
    this.notify();
  }

  redrawCandidates(): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'drawing') throw new Error('Cannot redraw after arrival');
    if (!w.plan.allowRedraw || w.redrawUsed) throw new Error('No redraw available');
    const r = revealFrom(w.graph, w.plan, w.activeId, Math.random); // rng → reshuffled subset
    w.candidateIds = r.candidateIds;
    w.veiledCandidateIds = r.veiledCandidateIds;
    w.lookAheadIds = r.lookAheadIds;
    w.revealedIds = [...new Set([...w.revealedIds, ...r.candidateIds, ...r.veiledCandidateIds, ...r.lookAheadIds])];
    w.redrawUsed = true;
    this.affinityEngine.applyAction('take-reroll'); // Will
    this.notify();
  }

  useForesight(nodeId: string): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (!w.plan.foresight) throw new Error('Foresight unavailable');
    if (!w.candidateIds.includes(nodeId)) throw new Error('Not a candidate');
    w.foresightId = nodeId;
    this.affinityEngine.applyAction('use-peek'); // Light
    this.notify();
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts -t agency`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/StringsReveal.test.ts
git commit -m "feat(engine): backtrack / redraw / foresight agency methods"
```

---

## Task 12: `GameEngine.commitWeave` + coherence + spawn/remove widening

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/StringsReveal.test.ts`

**Interfaces:**
- Produces: `commitWeave(): void` — consolidates the path and calls `completeMinigame`; `completeMinigame` applies a strings coherence feed (Order/Chaos +6); `spawnSecond` and `removeUsedMethod` accept `'strings'` and pass the current question.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/StringsReveal.test.ts`:

```typescript
describe('strings weave — commit', () => {
  it('commitWeave consolidates the path into a strings slot', () => {
    const e = startWeaveWith(HI());
    let guard = 0;
    while (weave(e).phase === 'drawing' && guard++ < 12) {
      e.stepTo(weave(e).candidateIds[0]);
    }
    expect(weave(e).phase).toBe('arrived');
    e.commitWeave();
    const slot = e.getState().turnResults[e.getState().turnResults.length - 1];
    expect(slot.type).toBe('strings');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts -t commit`
Expected: FAIL — `engine.commitWeave is not a function`.

- [ ] **Step 3: Implement `commitWeave`**

In `src/engine/GameEngine.ts`, add after `useForesight`:

```typescript
  commitWeave(): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'arrived') throw new Error('Weave has not reached a destination');
    const byId = new Map(w.graph.nodes.map((n) => [n.id, n]));
    const path = w.visitedPath.map((id) => byId.get(id)!);
    this.completeMinigame(consolidatePath(path));
  }
```

- [ ] **Step 4: Add the coherence feed in `completeMinigame`**

In `completeMinigame`, immediately after the tarot spread-coherence block (the `if (result.type === 'tarot' && … spread …)` block that shifts `order`/`chaos` by 6), add:

```typescript
    // Strings coherence feeds (mirrors the tarot spread-coherence rule).
    if (result.type === 'strings') {
      const coh = pathCoherence((result as StringsResult).path);
      if (coh === 'coherent') this.affinityEngine.shift('order', 6, 'strings-coherent');
      else if (coh === 'tangled') this.affinityEngine.shift('chaos', 6, 'strings-tangled');
    }
```

- [ ] **Step 5: Widen `spawnSecond` + `removeUsedMethod`**

In `completeMinigame`, in the `if (typeof draft.spawnSecond === 'string')` block, change the `drawSingleResult` call to widen the union and pass the question:

```typescript
      const second = this.orchestrator.drawSingleResult(
        draft.spawnSecond as 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings',
        affinities,
        this.state.questionType ?? undefined,
      );
```

In `advanceAfterCommit`, widen the `removeUsedMethod` cast:

```typescript
    this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings');
```

- [ ] **Step 6: Run the test + full suite**

Run: `npx vitest run src/engine/__tests__/StringsReveal.test.ts` → PASS.
Run: `npx vitest run` → PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/StringsReveal.test.ts
git commit -m "feat(engine): commitWeave + coherence feed + spawn/remove widening"
```

> **Layer B complete** — Strings is selectable, fully playable through the engine, and commits a consolidated slot. Engine tests green. Mergeable (no responders/UI yet).

---

## Task 13: The `weave` combine channel

**Files:**
- Modify: `src/engine/events/types.ts`, `src/engine/events/reducers.ts`
- Test: `src/engine/__tests__/StringsReducer.test.ts`

**Interfaces:**
- Produces: `PhaseDraft.weaveReports?: EffectReport[]`; `weaveReducer` registered under `REDUCERS['weave']` (returns the draft's `weaveReports`, mirroring `spreadReducer`). Consumed by the path-internal responders (Task 14).

- [ ] **Step 1: Add the typed draft field**

In `src/engine/events/types.ts`, in `interface PhaseDraft`, add after the `spreadReports?: EffectReport[];` line:

```typescript
  weaveReports?: EffectReport[];  // reports from weave-channel combine responders
```

- [ ] **Step 2: Write the failing test**

Create `src/engine/__tests__/StringsReducer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { REDUCERS } from '../events/reducers';
import type { PhaseContext, EffectReport } from '../events/types';

describe('weave combine reducer', () => {
  it('collects draft.weaveReports for batch narration', () => {
    const rep: EffectReport = { responderId: 'coherent-weave', label: 'Coherent Weave', description: '', animation: 'amplify' };
    const ctx = { draft: { weaveReports: [rep] } } as unknown as PhaseContext;
    const result = REDUCERS['weave'].reduce(ctx);
    const arr = Array.isArray(result) ? result : (result ? [result] : []);
    expect(arr).toContainEqual(rep);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/StringsReducer.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'reduce')` (`REDUCERS['weave']` is undefined).

- [ ] **Step 4: Add the reducer**

In `src/engine/events/reducers.ts`, add after `spreadReducer`:

```typescript
export const weaveReducer: CombineReducer = {
  channel: 'weave',
  reduce(ctx: PhaseContext): EffectReport[] {
    return (ctx.draft.weaveReports as EffectReport[] | undefined) ?? [];
  },
};
```

And add it to the `REDUCERS` record:

```typescript
export const REDUCERS: Record<string, CombineReducer> = {
  'roll-mode': rollModeReducer,
  'spread': spreadReducer,
  'weave': weaveReducer,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/StringsReducer.test.ts` → PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/events/types.ts src/engine/events/reducers.ts src/engine/__tests__/StringsReducer.test.ts
git commit -m "feat(engine): weave combine channel + reducer"
```

---

## Task 14: Strings responders (`responders/strings.ts`) + registration

**Files:**
- Create: `src/engine/responders/strings.ts`
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/StringsResponders.test.ts`

**Interfaces:**
- Consumes: `bandRoll`, `TIER_BASE_CHANCE`, `CONCEPTS`, the `weave` channel (Task 13).
- Produces: `buildStringsResponders(): Responder[]` — pick-time (`chaos-stray-thread`, `fate-pull-thread`, `fate-foregone-step`) **and** commit-time (`order-true-weave`, `coherent-weave`, `tangled-weave`, `luminous-path`, `shrouded-path`, `woven-echo`); registered in `GameEngine`. Pick-time responders read `draft.chosenId`/`draft.candidateIds`/`draft.hasForwardAfter` and set `draft.redirectTo` / `draft.foregoneStep` (consumed by `GameEngine.stepTo`, Task 10).

> This task writes the **complete** responder file (pick-time + commit-time) so the helpers it shares have no unused symbols. Task 14's tests cover the pick-time responders; Task 15 adds the commit-time tests.

- [ ] **Step 1: Create `src/engine/responders/strings.ts`**

```typescript
import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, StringsResult, DimensionValues, ThemeTag } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';
import { CONCEPTS } from '../../data/strings';

const T = TIER_BASE_CHANCE;
const w = (a: AffinityId) => (c: PhaseContext) => c.affinities[a];
const out = (c: PhaseContext) => (c.draft.outcome?.type === 'strings' ? (c.draft.outcome as StringsResult) : null);
const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}
function addTheme(r: StringsResult, t: ThemeTag) {
  if (!r.themes.includes(t)) r.themes = ([t, ...r.themes] as ThemeTag[]).slice(0, 2);
}

const THEME_OPPOSED: [ThemeTag, ThemeTag][] = [
  ['upheaval', 'harmony'], ['renewal', 'stagnation'],
  ['illumination', 'mystery'], ['conflict', 'surrender'], ['authority', 'surrender'],
];
const pathThemes = (r: StringsResult) => new Set<ThemeTag>(r.path.flatMap((n) => CONCEPTS[n.conceptId].themes));
const sharesCommonTheme = (r: StringsResult): boolean => {
  const sets = r.path.map((n) => new Set(CONCEPTS[n.conceptId].themes));
  if (sets.length === 0) return false;
  let common = sets[0];
  for (const s of sets.slice(1)) common = new Set([...common].filter((x) => s.has(x)));
  return common.size > 0;
};

// Combine 'weave' helper (mirrors interactions.ts spreadEntry): mutate the result
// in place, push a report to the weave channel, return null.
function weaveEntry(
  id: string,
  fires: (r: StringsResult) => boolean,
  apply: (r: StringsResult, push: (rep: EffectReport) => void) => void,
): Responder {
  return {
    id, source: 'interaction', triggers: ['strings:commit'],
    group: { kind: 'combine', channel: 'weave' },
    condition: (c) => { const r = out(c); return !!r && r.path.length > 1 && fires(r); },
    roll: () => true,
    apply: (c) => {
      const r = out(c)!;
      const push = (rep: EffectReport) => { (c.draft.weaveReports ??= []).push(rep); };
      apply(r, push);
      c.draft.outcome = r;
      return null;
    },
  };
}

export function buildStringsResponders(): Responder[] {
  return [
    // ── Pick-time: OVERRIDE redirects (one winner), SPAWN foregone step ──
    {
      id: 'chaos-stray-thread', source: 'affinity', triggers: ['strings:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('chaos'),
      condition: (c) => Array.isArray(c.draft.candidateIds) && (c.draft.candidateIds as string[]).length >= 2 && typeof c.draft.chosenId === 'string',
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.notable),
      apply: (c) => {
        const cand = c.draft.candidateIds as string[];
        const chosen = c.draft.chosenId as string;
        const others = cand.filter((id) => id !== chosen);
        c.draft.redirectTo = others[Math.floor(c.rng() * others.length)];
        return report('chaos-stray-thread', 'Chaos', 'The thread strays — fate pulls it to another star.', 'override');
      },
    },
    {
      id: 'fate-pull-thread', source: 'affinity', triggers: ['strings:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => Array.isArray(c.draft.candidateIds) && (c.draft.candidateIds as string[]).length >= 2 && typeof c.draft.chosenId === 'string',
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const cand = c.draft.candidateIds as string[];
        const chosen = c.draft.chosenId as string;
        const others = cand.filter((id) => id !== chosen);
        c.draft.redirectTo = others[Math.floor(c.rng() * others.length)];
        return report('fate-pull-thread', 'Fate', 'The weave moves your hand — another path is chosen for you.', 'override');
      },
    },
    {
      id: 'fate-foregone-step', source: 'affinity', triggers: ['strings:pick'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('fate'),
      condition: (c) => typeof c.draft.chosenId === 'string' && c.draft.hasForwardAfter === true,
      roll: (c) => bandRoll(c, 'fate', 'dominant', T.major),
      apply: (c) => {
        c.draft.foregoneStep = true;
        return report('fate-foregone-step', 'Fate', 'The weave takes the next step itself.', 'second-result');
      },
    },

    // ── Commit-time: Order straightens (exclusive MUTATE) ──
    {
      id: 'order-true-weave', source: 'affinity', triggers: ['strings:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('order'),
      condition: (c) => !!out(c),
      roll: (c) => bandRoll(c, 'order', 'ascendant', T.notable),
      apply: (c) => {
        const r = out(c)!;
        const axis = dominantAxis(r.dimensions);
        r.dimensions[axis] = clamp(r.dimensions[axis] * 0.5);
        c.draft.outcome = r;
        return report('order-true-weave', 'Order', 'Order straightens the weave — its sharpest pull is tempered.', 'anchor');
      },
    },

    // ── Commit-time: path-internal (combine 'weave', deterministic) ──
    weaveEntry('coherent-weave', (r) => sharesCommonTheme(r), (r, push) => {
      const axis = dominantAxis(r.dimensions);
      r.dimensions[axis] = clamp((r.dimensions[axis] * 1.5) || 0.5);
      push(report('coherent-weave', 'Coherent Weave', 'The thread holds one meaning end to end — its nature deepens.', 'amplify'));
    }),
    weaveEntry('tangled-weave', (r) => { const t = pathThemes(r); return THEME_OPPOSED.some(([a, b]) => t.has(a) && t.has(b)); }, (r, push) => {
      r.dimensions.volatility = clamp(r.dimensions.volatility + 1.0);
      push(report('tangled-weave', 'Tangled Weave', 'Opposed forces knot along the thread — the reading turns turbulent.', 'amplify'));
    }),
    weaveEntry('luminous-path', (r) => r.path.every((n) => n.family === 'benevolent'), (r, push) => {
      r.dimensions.favorability = clamp(r.dimensions.favorability + 0.5);
      push(report('luminous-path', 'Luminous Path', 'Every star on the thread shines kindly — the way is bright.', 'anchor'));
    }),
    weaveEntry('shrouded-path', (r) => r.path.every((n) => n.family === 'challenging'), (r, push) => {
      r.dimensions.favorability = clamp(r.dimensions.favorability - 0.5);
      addTheme(r, 'mystery');
      push(report('shrouded-path', 'Shrouded Path', 'Every star on the thread is a hard one — shadow pools in the weave.', 'shroud'));
    }),

    // ── Commit-time: cross-slot resonance (combine 'weave') ──
    {
      id: 'woven-echo', source: 'interaction', triggers: ['strings:commit'],
      group: { kind: 'combine', channel: 'weave' },
      condition: (c) => {
        const r = out(c);
        if (!r) return false;
        const dom = r.themes[0];
        return !!dom && c.spread.some((s) => s !== r && s.type !== 'happening' && s.themes.includes(dom));
      },
      roll: () => true,
      apply: (c) => {
        const r = out(c)!;
        const axis = dominantAxis(r.dimensions);
        r.dimensions[axis] = clamp((r.dimensions[axis] * 1.25) || r.dimensions[axis]);
        c.draft.outcome = r;
        (c.draft.weaveReports ??= []).push(report('woven-echo', 'Woven Echo', 'The thread echoes a force already drawn — the weave resonates.', 'mirror'));
        return null;
      },
    },
  ];
}
```

- [ ] **Step 2: Register the responders in `GameEngine`**

In `src/engine/GameEngine.ts`, add the import near the other responder imports:

```typescript
import { buildStringsResponders } from './responders/strings';
```

And add it to the `this.responders` array in the constructor:

```typescript
    this.responders = [...buildAffinityResponders(), ...buildInteractionResponders(), ...buildAstralResponders(), ...buildIChingResponders(), ...buildRuneResponders(), ...buildStringsResponders()];
```

- [ ] **Step 3: Write the failing pick-time tests**

Create `src/engine/__tests__/StringsResponders.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildStringsResponders } from '../responders/strings';
import { consolidatePath, CONCEPTS } from '../../data/strings';
import type { PhaseContext, PhaseDraft } from '../events/types';
import type { AffinityId, WovenNode, SlotResult } from '../types';

export const node = (conceptId: string, band: number): WovenNode =>
  ({ id: `b${band}`, conceptId, band, family: CONCEPTS[conceptId].family, x: 0, y: 0 });

export function ctx(
  trigger: string, draft: PhaseDraft,
  opts: { affinities?: Partial<Record<AffinityId, number>>; slots?: SlotResult[]; rng?: () => number } = {},
): PhaseContext {
  const slots = opts.slots ?? [];
  return {
    trigger,
    affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...(opts.affinities ?? {}) },
    slots, hand: null, spread: slots, minigame: null, event: null,
    draft, rng: opts.rng ?? (() => 0.5),
  };
}

const rs = buildStringsResponders();

describe('strings pick-time responders', () => {
  it('chaos-stray-thread redirects the pick to a different candidate', () => {
    const c = ctx('strings:pick', { chosenId: 'b1-0', candidateIds: ['b1-0', 'b1-1', 'b1-2'], hasForwardAfter: true }, { rng: () => 0 });
    dispatch('strings:pick', c, rs, { forced: ['chaos-stray-thread'], isolate: true });
    expect(typeof c.draft.redirectTo).toBe('string');
    expect(c.draft.redirectTo).not.toBe('b1-0');
  });

  it('fate-foregone-step flags a foregone step when a forward step remains', () => {
    const c = ctx('strings:pick', { chosenId: 'b1-0', candidateIds: ['b1-0', 'b1-1'], hasForwardAfter: true });
    dispatch('strings:pick', c, rs, { forced: ['fate-foregone-step'], isolate: true });
    expect(c.draft.foregoneStep).toBe(true);
  });
});
```

- [ ] **Step 4: Run it (it now passes — the file already implements the responders)**

Run: `npx vitest run src/engine/__tests__/StringsResponders.test.ts`
Expected: PASS (responders implemented in Step 1).

- [ ] **Step 5: Run the full suite + typecheck + commit**

Run: `npx vitest run` → PASS.
Run: `npx tsc -b` → PASS.

```bash
git add src/engine/responders/strings.ts src/engine/GameEngine.ts src/engine/__tests__/StringsResponders.test.ts
git commit -m "feat(engine): strings responders (pick + commit) + registration"
```

---

## Task 15: Commit-time responder tests (path-internal + Order + Woven Echo)

**Files:**
- Test: `src/engine/__tests__/StringsResponders.test.ts`

**Interfaces:**
- Consumes: `buildStringsResponders` + the `node`/`ctx` helpers (Task 14). Verifies the commit-time responders written in Task 14.

- [ ] **Step 1: Append the commit-time tests**

Append to `src/engine/__tests__/StringsResponders.test.ts`:

```typescript
const dom = (d: SlotResult['dimensions']) =>
  (['favorability', 'certainty', 'volatility'] as const).reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability' as 'favorability' | 'certainty' | 'volatility');

describe('strings commit-time responders', () => {
  it('coherent-weave amplifies the dominant dimension on a single-theme path', () => {
    // all share 'renewal'
    const outcome = consolidatePath([node('a-rising-tide', 0), node('the-blossom', 1), node('the-dawn', 3)]);
    const before = outcome.dimensions[dom(outcome.dimensions)];
    const c = ctx('strings:commit', { outcome });
    dispatch('strings:commit', c, rs, { forced: ['coherent-weave'], isolate: true });
    const after = (c.draft.outcome as typeof outcome).dimensions[dom(outcome.dimensions)];
    expect(Math.abs(after)).toBeGreaterThan(Math.abs(before));
  });

  it('tangled-weave raises volatility on an opposed-theme path', () => {
    // harmony (the-hearth) vs conflict (the-severance)
    const outcome = consolidatePath([node('the-hearth', 0), node('the-severance', 1), node('the-double-edge', 3)]);
    const before = outcome.dimensions.volatility;
    const c = ctx('strings:commit', { outcome });
    dispatch('strings:commit', c, rs, { forced: ['tangled-weave'], isolate: true });
    expect((c.draft.outcome as typeof outcome).dimensions.volatility).toBeGreaterThan(before);
  });

  it('order-true-weave tempers the most extreme dimension', () => {
    const outcome = consolidatePath([node('the-self', 0), node('the-fracture', 1), node('the-turning', 3)]);
    const before = Math.abs(outcome.dimensions[dom(outcome.dimensions)]);
    const c = ctx('strings:commit', { outcome }, { affinities: { order: 80 } });
    dispatch('strings:commit', c, rs, { forced: ['order-true-weave'], isolate: true });
    const after = Math.abs((c.draft.outcome as typeof outcome).dimensions[dom(outcome.dimensions)]);
    expect(after).toBeLessThan(before);
  });

  it('woven-echo fires when another slot shares the destination theme', () => {
    const outcome = consolidatePath([node('the-self', 0), node('a-rising-tide', 1), node('the-dawn', 3)]); // dominant 'renewal'
    const sharer: SlotResult = {
      type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
      tags: [], themes: ['renewal'], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
    } as SlotResult;
    const c = ctx('strings:commit', { outcome }, { slots: [sharer, outcome] });
    const { reports } = dispatch('strings:commit', c, rs, { forced: ['woven-echo'], isolate: true });
    expect(reports.some((r) => r.responderId === 'woven-echo')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/engine/__tests__/StringsResponders.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/engine/__tests__/StringsResponders.test.ts
git commit -m "test(engine): strings commit-time responder coverage"
```

---

## Task 16: `chaos-second-result` spawns a second weave

**Files:**
- Modify: `src/engine/responders/affinity.ts`
- Test: `src/engine/__tests__/StringsResponders.test.ts`

**Interfaces:**
- Produces: `chaos-second-result` triggers on `strings:commit` and sets `draft.spawnSecond = 'strings'` (the `GameEngine` spawn handler — widened in Task 12 — draws a second weave).

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/StringsResponders.test.ts`:

```typescript
import { buildAffinityResponders } from '../responders/affinity';

describe('chaos-second-result on strings', () => {
  it('spawns a strings second when forced on a strings commit', () => {
    const affRs = buildAffinityResponders();
    const outcome = consolidatePath([node('the-self', 0), node('a-rising-tide', 1), node('the-dawn', 3)]);
    const c = ctx('strings:commit', { outcome });
    dispatch('strings:commit', c, affRs, { forced: ['chaos-second-result'], isolate: true });
    expect(c.draft.spawnSecond).toBe('strings');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/StringsResponders.test.ts -t "chaos-second-result on strings"`
Expected: FAIL — `chaos-second-result` does not trigger on `strings:commit`, so `spawnSecond` is never set.

- [ ] **Step 3: Add the trigger**

In `src/engine/responders/affinity.ts`, change the `chaos-second-result` `triggers` line:

```typescript
      triggers: ['dice:commit', 'tarot:commit', 'iching:commit', 'strings:commit'],
```

(Its `apply` already sets `c.draft.spawnSecond = (c.draft.outcome as SlotResult).type`, which is `'strings'` here. No other change needed; `astral`/`rune` were already covered by the `${family}:commit` dispatch.)

- [ ] **Step 4: Run the test + full suite**

Run: `npx vitest run src/engine/__tests__/StringsResponders.test.ts -t "chaos-second-result on strings"` → PASS.
Run: `npx vitest run` → PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/responders/affinity.ts src/engine/__tests__/StringsResponders.test.ts
git commit -m "feat(engine): chaos-second-result spawns a second weave"
```

---

## Task 17: Debug scenarios

**Files:**
- Modify: `src/engine/events/scenarios.ts`
- Test: `src/engine/__tests__/StringsResponders.test.ts`

**Interfaces:**
- Produces: `DEBUG_SCENARIOS` entries for each strings responder, each staging the precondition + forcing the responder (`forced`/`isolate` bypass `roll`, never `condition`).

> Known limitation (documented in §11, Task 24): the **pick-time** strings scenarios (`chaos-stray-thread`, `fate-pull-thread`, `fate-foregone-step`) require a live `strings:pick` draft (`draft.candidateIds`/`chosenId`), which a cold scenario load cannot supply — exactly like the iching/astral pick-dependent scenarios. They stage screen + method + affinity for the panel, and are validated by the dispatch tests in Tasks 14–15. The **commit-time** scenarios stage a `StringsResult` slot and fire on `strings:commit`.

- [ ] **Step 1: Add the imports + helpers**

In `src/engine/events/scenarios.ts`, add to the imports (near the other `consolidate*` imports):

```typescript
import { consolidatePath, CONCEPTS as STRINGS_CONCEPTS } from '../../data/strings';
import type { WovenNode } from '../types';
```

Add helpers near the other `at*`/builder helpers (after `runeSlot`):

```typescript
const atStrings = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'strings'; };
const wovenNode = (conceptId: string, band: number): WovenNode =>
  ({ id: `b${band}`, conceptId, band, family: STRINGS_CONCEPTS[conceptId].family, x: 0, y: 0 });
const stringsSlot = (ids: string[]): SlotResult =>
  consolidatePath(ids.map((id, i) => wovenNode(id, i))) as SlotResult;
```

- [ ] **Step 2: Add the scenario entries**

In `src/engine/events/scenarios.ts`, add these entries to the `DEBUG_SCENARIOS` array (before the closing `];`):

```typescript
  // ── Strings of Fate ──
  { id: 'chaos-stray-thread', label: 'Strings: Chaos strays the thread', group: 'Strings', forced: ['chaos-stray-thread'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { chaos: 80 }); } },
  { id: 'fate-pull-thread', label: 'Strings: Fate pulls the thread', group: 'Strings', forced: ['fate-pull-thread'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { fate: 90 }); } },
  { id: 'fate-foregone-step', label: 'Strings: Fate weaves a foregone step', group: 'Strings', forced: ['fate-foregone-step'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { fate: 90 }); } },
  { id: 'order-true-weave', label: 'Strings: Order straightens the weave', group: 'Strings', forced: ['order-true-weave'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { order: 80 }); s.slots = [stringsSlot(['the-self', 'the-fracture', 'the-turning'])]; } },
  { id: 'coherent-weave', label: 'Strings: Coherent Weave', group: 'Strings', forced: ['coherent-weave'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['a-rising-tide', 'the-blossom', 'the-dawn'])]; } },
  { id: 'tangled-weave', label: 'Strings: Tangled Weave', group: 'Strings', forced: ['tangled-weave'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-hearth', 'the-severance', 'the-double-edge'])]; } },
  { id: 'luminous-path', label: 'Strings: Luminous Path', group: 'Strings', forced: ['luminous-path'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['a-rising-tide', 'the-blossom', 'the-dawn'])]; } },
  { id: 'shrouded-path', label: 'Strings: Shrouded Path', group: 'Strings', forced: ['shrouded-path'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-undertow', 'the-fracture', 'the-long-night'])]; } },
  { id: 'woven-echo', label: 'Strings: Woven Echo', group: 'Strings', forced: ['woven-echo'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-self', 'a-rising-tide', 'the-dawn']), changingLinesHex]; } },
```

(Note: `changingLinesHex` is the existing `iching` slot literal defined above in the file; here it's reused only as a second slot whose theme can echo. If its themes don't overlap `the-dawn`'s `renewal`, change the second slot to another `stringsSlot([...])` sharing a theme — see the test in Step 3 for the canonical pairing.)

For `woven-echo`, use a guaranteed theme-sharing second slot instead of `changingLinesHex`:

```typescript
  { id: 'woven-echo', label: 'Strings: Woven Echo', group: 'Strings', forced: ['woven-echo'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-self', 'a-rising-tide', 'the-dawn']), stringsSlot(['the-hearth', 'the-blossom', 'the-dawn'])]; } },
```

(Use this second form; delete the `changingLinesHex` variant above.)

- [ ] **Step 3: Write the test**

Append to `src/engine/__tests__/StringsResponders.test.ts`:

```typescript
import { GameEngine } from '../GameEngine';

describe('strings debug scenarios', () => {
  const ids = ['order-true-weave', 'coherent-weave', 'tangled-weave', 'luminous-path', 'shrouded-path', 'woven-echo',
    'chaos-stray-thread', 'fate-pull-thread', 'fate-foregone-step'];
  it('every strings scenario loads and stages its forced responder', () => {
    const e = new GameEngine();
    for (const id of ids) {
      expect(e.loadScenarioById(id)).toBe(true);
      expect(e.getState().debugConfig.forced).toContain(id);
    }
  });
});
```

- [ ] **Step 4: Run the test + full suite**

Run: `npx vitest run src/engine/__tests__/StringsResponders.test.ts -t "debug scenarios"` → PASS.
Run: `npx vitest run` → PASS (if a pre-existing `DebugScenarios.test.ts` enumerates every scenario and dispatches its trigger, the commit-time strings scenarios fire on `strings:commit`; the three pick-time ones are the documented best-effort exceptions — match the existing astral/iching known-limitation handling in that test if it asserts firing).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/engine/events/scenarios.ts src/engine/__tests__/StringsResponders.test.ts
git commit -m "feat(engine): debug scenarios for strings responders"
```

> **Layer C complete** — all affinity/interaction effects, the weave channel, and debug scenarios are in. Engine + responder tests green. Mergeable.

---

## Task 18: Synthesis — profile + atomic-signal expansion

**Files:**
- Modify: `src/data/divination-profiles.ts`, `src/engine/ReadingPlanner.ts`
- Test: `src/engine/__tests__/Strings.test.ts`

**Interfaces:**
- Produces: a `strings` `DivinationProfile`; `ReadingPlanner.atomicSignals` expands a `StringsResult.path` into one atomic signal per concept (so synthesis profiles over the real path, not the destination-governed average).

- [ ] **Step 1: Add the profile**

In `src/data/divination-profiles.ts`, add a `strings` entry to `DIVINATION_PROFILES`:

```typescript
  strings: {
    type: 'strings',
    themeCoverage: 'all',
    themePool: ['mystery', 'transformation', 'harmony', 'conflict', 'renewal', 'authority', 'illumination', 'stagnation', 'surrender', 'upheaval'],
    dimensionStrengths: ['favorability', 'certainty', 'volatility'],
    modifierStrengths: ['subject', 'action', 'effect'],
  },
```

- [ ] **Step 2: Write the failing test**

Append to `src/engine/__tests__/Strings.test.ts`:

```typescript
import { ReadingPlanner } from '../ReadingPlanner';

describe('ReadingPlanner strings expansion', () => {
  it('expands the path into atomic signals so an adverse crossing surfaces', () => {
    const planner = new ReadingPlanner();
    // destination-governed favorability is net-positive (the-dawn ×2), so without
    // path expansion there is NO adverse signal; with expansion the-undertow (−1) shows.
    const result = consolidatePath([node('the-self', 0), node('the-undertow', 1), node('the-dawn', 3)]);
    const agg = planner.aggregate([result], 'self');
    expect(agg.strongestAdverse).not.toBeNull();
    expect(agg.strongestAdverse!.label).toContain('Undertow');
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t "strings expansion"`
Expected: FAIL — `strongestAdverse` is `null` (the consolidated result is net-favorable; no per-node expansion yet).

- [ ] **Step 4: Add the strings branch to `atomicSignals`**

In `src/engine/ReadingPlanner.ts`, add the import at the top:

```typescript
import { CONCEPTS } from '../data/strings';
```

In the private `atomicSignals` method, add a branch **before** the final `else` (which handles single-card tarot / astral / rune):

```typescript
      } else if (r.type === 'strings' && r.path && r.path.length > 1) {
        for (const n of r.path) {
          const def = CONCEPTS[n.conceptId];
          signals.push({
            label: `the ${def.name}`,
            themes: def.themes,
            dimensions: def.dimensions,
            modifierRoles: [def.modifierRole],
          });
        }
```

- [ ] **Step 5: Run the test + full suite**

Run: `npx vitest run src/engine/__tests__/Strings.test.ts -t "strings expansion"` → PASS.
Run: `npx vitest run` → PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/data/divination-profiles.ts src/engine/ReadingPlanner.ts src/engine/__tests__/Strings.test.ts
git commit -m "feat(engine): strings profile + path atomic-signal expansion"
```

> **Layer D complete** — synthesis profiles over the real path. Engine tests green. Mergeable. *(Layers E–F are UI/docs; verification shifts to `tsc` + manual `npm run dev`.)*

---

## Task 19: Method-card emblem

**Files:**
- Modify: `src/components/cards/MethodEmblem.tsx`

**Interfaces:**
- Consumes: `METHOD_FRONTS.strings` (added in Task 1).
- Produces: a `case 'strings'` illustrated emblem (inline SVG, `currentColor`).

- [ ] **Step 1: Add the `strings` case**

In `src/components/cards/MethodEmblem.tsx`, add a `case 'strings'` immediately before `case 'happening':` in the `switch (method)`:

```tsx
    case 'strings':
      return (
        <svg {...common} role="img" aria-label="Strings of Fate">
          {/* a knotted thread threading three nodes */}
          <path d="M12 50 C 24 30, 30 30, 40 40 C 50 50, 54 22, 52 14" opacity="0.9" />
          <path d="M40 40 C 50 56, 30 58, 24 50" opacity="0.6" />
          <circle cx="12" cy="50" r="3" fill="currentColor" />
          <circle cx="40" cy="40" r="3.4" fill="currentColor" />
          <circle cx="52" cy="14" r="3" fill="currentColor" />
          <path d="M40 36 L44 40 L40 44 L36 40 Z" fill="none" />
        </svg>
      );
```

- [ ] **Step 2: Typecheck + verify**

Run: `npx tsc -b` → PASS.
Run: `npm run dev`, open `?debug`, and confirm the **Strings of Fate** method card renders with its crimson emblem (the card front config came from Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/MethodEmblem.tsx
git commit -m "feat(ui): Strings of Fate method emblem"
```

---

## Task 20: `StringSigil` — the Sigil-Gem node

**Files:**
- Create: `src/components/cards/StringSigil.tsx`

**Interfaces:**
- Produces: `StringSigil({ glyph, state, size? })` where `state: 'origin' | 'lit' | 'candidate' | 'veiled' | 'lookahead'`. Self-contained (its own gradient via `useId`). Consumed by `StringsMinigame`, and (optionally) the fan/result surfaces.

- [ ] **Step 1: Create `src/components/cards/StringSigil.tsx`**

```tsx
import { useId } from 'react';

export type SigilState = 'origin' | 'lit' | 'candidate' | 'veiled' | 'lookahead';

// The Sigil-Gem: a faceted lozenge ringed by a faint sigil-circle, glyph at its
// heart. Colour + glow vary by state (origin gold, lit/candidate crimson-rose,
// veiled/lookahead dim ghost). Self-contained — defines its own glow gradient.
export default function StringSigil({ glyph, state, size = 34 }:
  { glyph: string; state: SigilState; size?: number }) {
  const gid = useId();
  const lit = state === 'lit' || state === 'origin';
  const stroke = state === 'origin' ? '#d4a854'
    : lit ? '#d23f57'
    : state === 'candidate' ? '#b0566a'
    : '#3a3560';
  const core = state === 'origin' ? '#1a130a'
    : lit ? '#1a0e16'
    : state === 'candidate' ? '#1a0e16'
    : '#0d0a14';
  const glow = state === 'origin' ? '#f3dca0' : '#ff8095';
  const opacity = state === 'veiled' ? 0.4 : state === 'lookahead' ? 0.28 : 1;
  const showGlyph = state !== 'veiled';

  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" style={{ display: 'block', opacity }} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.9" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit && <ellipse rx="26" ry="24" fill={`url(#${gid})`} opacity={0.55} />}
      <circle r="22" fill="none" stroke={stroke} strokeWidth="1.1" opacity="0.5" strokeDasharray="2 3" />
      <path d="M0 -18 L15 0 L0 18 L-15 0 Z" fill={core} stroke={stroke} strokeWidth="2" />
      <path d="M0 -18 L0 18 M-15 0 L15 0" stroke={stroke} strokeWidth="1" opacity="0.55" />
      {showGlyph && (
        <text x="0" y="0" textAnchor="middle" dominantBaseline="central" fontSize="13"
          fill={lit ? '#ffe9ec' : stroke} style={{ fontFamily: "'Cormorant Garamond', serif" }}>{glyph}</text>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → PASS (compiles even though unused until Task 22).

```bash
git add src/components/cards/StringSigil.tsx
git commit -m "feat(ui): StringSigil sigil-gem node renderer"
```

---

## Task 21: Board / fog / thread geometry (`screens/weave/`)

**Files:**
- Create: `src/components/screens/weave/board.ts`, `src/components/screens/weave/fog.ts`, `src/components/screens/weave/thread.ts`

**Interfaces:**
- Produces (pure, no JSX — the `runic/` analog):
  - `nodePixel(n, px)`, `nodeById(graph)` (board.ts)
  - `fogHoles(points, radius?)`, `FOG_CLOUD` (fog.ts)
  - `threadPath(points)`, `filament(a, b)` (thread.ts)

- [ ] **Step 1: Create `src/components/screens/weave/board.ts`**

```typescript
import type { WeaveGraph, WovenNode } from '../../../engine/types';

// Normalized node coords (x,y in ~[-1,1], origin at 0,0) → pixel positions on a
// square board, origin at centre (radial bloom).
export function nodePixel(n: WovenNode, px: number): { left: number; top: number } {
  return { left: px / 2 + n.x * 0.46 * px, top: px / 2 + n.y * 0.46 * px };
}

export function nodeById(graph: WeaveGraph): Map<string, WovenNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}
```

- [ ] **Step 2: Create `src/components/screens/weave/fog.ts`**

```typescript
export interface FogHole { cx: number; cy: number; r: number; }

// One soft dispersal blob per lit/candidate point — the corridor the fog clears.
export function fogHoles(points: { left: number; top: number }[], radius = 48): FogHole[] {
  return points.map((p) => ({ cx: p.left, cy: p.top, r: radius }));
}

// feTurbulence cloud params (the screen renders the <filter> with these).
export const FOG_CLOUD = { baseFrequency: '0.013 0.021', numOctaves: 5, seed: 5 } as const;
```

- [ ] **Step 3: Create `src/components/screens/weave/thread.ts`**

```typescript
type Pt = { left: number; top: number };

// Smooth crimson thread through the visited node pixels.
export function threadPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  let d = `M${pts[0].left} ${pts[0].top}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const mx = (a.left + b.left) / 2, my = (a.top + b.top) / 2;
    d += ` Q${a.left} ${a.top} ${mx} ${my}`;
  }
  d += ` L${pts[pts.length - 1].left} ${pts[pts.length - 1].top}`;
  return d;
}

// Dashed rose filament from the active node to a candidate (bowed slightly up).
export function filament(a: Pt, b: Pt): string {
  const mx = (a.left + b.left) / 2;
  const my = (a.top + b.top) / 2 - 14;
  return `M${a.left} ${a.top} Q${mx} ${my} ${b.left} ${b.top}`;
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/components/screens/weave/board.ts src/components/screens/weave/fog.ts src/components/screens/weave/thread.ts
git commit -m "feat(ui): weave board/fog/thread geometry helpers"
```

---

## Task 22: `StringsMinigame` screen

**Files:**
- Create: `src/components/screens/StringsMinigame.tsx`

**Interfaces:**
- Consumes: `useGameEngine`, `StringSigil` (Task 20), the `weave/*` helpers (Task 21), `CONCEPTS` (data), engine methods `stepTo`/`backtrack`/`redrawCandidates`/`useForesight`/`commitWeave` (Layer B), `state.minigameState` (a `StringsMinigameState`).
- Produces: the radial fog board with the red thread, candidate gems, agency controls, and the arrival reading. Renders nothing if the active minigame is not strings.

- [ ] **Step 1: Create `src/components/screens/StringsMinigame.tsx`**

```tsx
import { useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import StringSigil from '../cards/StringSigil';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import { CONCEPTS } from '../../data/strings';
import { nodePixel, nodeById } from './weave/board';
import { fogHoles, FOG_CLOUD } from './weave/fog';
import { threadPath, filament } from './weave/thread';
import type { StringsMinigameState } from '../../engine/types';

const BOARD = 320;

export default function StringsMinigame() {
  const { state, engine } = useGameEngine();
  const uid = useId();
  const mg = state.minigameState;
  if (!mg || mg.method !== 'strings') return null;
  const w = mg as StringsMinigameState;

  const byId = nodeById(w.graph);
  const px = (id: string) => nodePixel(byId.get(id)!, BOARD);
  const conceptOf = (id: string) => CONCEPTS[byId.get(id)!.conceptId];

  const visitedPts = w.visitedPath.map(px);
  const activePt = px(w.activeId);
  const candPts = w.candidateIds.map(px);
  const holes = fogHoles([...visitedPts, ...candPts]);
  const arrived = w.phase === 'arrived';
  const destDef = arrived ? conceptOf(w.activeId) : null;

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>{arrived ? 'The thread reaches its end' : 'Draw the thread'}</h1>
        <OrnamentalBorder width="120px" />
        {w.plan.sources.length > 0 && <p style={modeLabelStyle}>{w.plan.sources[0]}</p>}

        <div style={boardStyle}>
          <svg width={BOARD} height={BOARD} viewBox={`0 0 ${BOARD} ${BOARD}`} style={svgStyle} aria-hidden>
            <defs>
              <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff5a72" stopOpacity="0.2" /><stop offset="100%" stopColor="#ff5a72" stopOpacity="0" />
              </radialGradient>
              <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id={`${uid}-cloud`} x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency={FOG_CLOUD.baseFrequency} numOctaves={FOG_CLOUD.numOctaves} seed={FOG_CLOUD.seed} stitchTiles="stitch" result="n" />
                <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.06  0 0 0 0 0.03  0 0 0 0 0.11  0 0 0 1.1 -0.30" />
              </filter>
              <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="10" /></filter>
              <mask id={`${uid}-fog`}>
                <rect x="0" y="0" width={BOARD} height={BOARD} fill="#fff" />
                <g filter={`url(#${uid}-soft)`} fill="#000">
                  {holes.map((h, i) => <ellipse key={i} cx={h.cx} cy={h.cy} rx={h.r} ry={h.r} />)}
                </g>
              </mask>
            </defs>

            {[0.46, 0.31, 0.16].map((rr, i) => (
              <circle key={i} cx={BOARD / 2} cy={BOARD / 2} r={rr * BOARD} fill="none" stroke="#1b2342" strokeWidth="1" opacity="0.7" />
            ))}

            <g stroke="#7d2233" strokeWidth="1" fill="none" opacity="0.5">
              {w.graph.edges.map((e, i) => {
                const a = px(e.from), b = px(e.to);
                return <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} />;
              })}
            </g>

            <g mask={`url(#${uid}-fog)`}>
              <rect x="0" y="0" width={BOARD} height={BOARD} fill="#06040d" opacity="0.88" />
              <motion.rect x="-40" y="-40" width={BOARD + 80} height={BOARD + 80} filter={`url(#${uid}-cloud)`}
                animate={{ x: [-40, -26, -48, -40], y: [-40, -52, -30, -40] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
            </g>

            {holes.map((h, i) => <ellipse key={i} cx={h.cx} cy={h.cy} rx={h.r * 1.1} ry={h.r * 1.1} fill={`url(#${uid}-halo)`} />)}

            <g filter={`url(#${uid}-glow)`}>
              <path d={threadPath(visitedPts)} stroke="#ef4f67" strokeWidth="2.8" fill="none" />
              <path d={threadPath(visitedPts)} stroke="#ffb0bd" strokeWidth="0.9" fill="none" opacity="0.85" />
            </g>

            {!arrived && candPts.map((p, i) => (
              <path key={i} d={filament(activePt, p)} stroke="#c06072" strokeWidth="1.3" fill="none" opacity="0.8" strokeDasharray="3 2" />
            ))}

            {!arrived && (
              <motion.circle cx={activePt.left} cy={activePt.top} r={9} fill="none" stroke="#ff7d92" strokeWidth="2"
                animate={{ r: [9, 46], opacity: [0.5, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }} />
            )}
          </svg>

          {/* look-ahead silhouettes + veiled candidates */}
          {w.lookAheadIds.map((id) => <div key={id} style={nodeBoxStyle(px(id))}><StringSigil glyph="" state="lookahead" size={22} /></div>)}
          {w.veiledCandidateIds.map((id) => <div key={id} style={nodeBoxStyle(px(id))}><StringSigil glyph="" state="veiled" size={28} /></div>)}

          {/* pickable candidates */}
          {!arrived && w.candidateIds.map((id) => {
            const def = conceptOf(id);
            const full = w.foresightId === id || w.plan.clarity === 'laid-bare';
            const silhouette = w.plan.clarity === 'silhouette' && w.foresightId !== id;
            return (
              <button key={id} type="button" style={nodeBtnStyle(px(id))} onClick={() => engine.stepTo(id)} aria-label="candidate star">
                <StringSigil glyph={silhouette ? '·' : def.glyph} state="candidate" />
                <span style={moodStyle}>{full ? def.name : (silhouette ? '' : def.mood)}</span>
                {w.plan.foresight && w.foresightId !== id && !silhouette && (
                  <span style={eyeStyle} role="button" aria-label="foresight" onClick={(e) => { e.stopPropagation(); engine.useForesight(id); }}>◉</span>
                )}
              </button>
            );
          })}

          {/* visited + origin */}
          {w.visitedPath.map((id, i) => (
            <div key={id} style={nodeBoxStyle(px(id))}>
              <StringSigil glyph={conceptOf(id).glyph} state={i === 0 ? 'origin' : 'lit'} size={i === 0 ? 38 : 34} />
            </div>
          ))}
        </div>

        {!arrived && (
          <div style={agencyRowStyle}>
            {w.backtracksRemaining > 0 && w.visitedPath.length > 1 && (
              <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.backtrack()}>↩ Pull the thread back</motion.button>
            )}
            {w.plan.allowRedraw && !w.redrawUsed && (
              <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.redrawCandidates()}>↺ Re-draw the threads</motion.button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {arrived && destDef && (
            <motion.div key={destDef.id} style={resultStyle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <StringSigil glyph={destDef.glyph} state="lit" size={52} />
              <div style={resultNameStyle}>{destDef.name}</div>
              <p style={interpStyle}>{destDef.meaning}</p>
              <motion.button style={actionBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => engine.commitWeave()}>Read the weave →</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = { width: '100%', maxWidth: '560px', padding: '1.5rem' };
const contentStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem' };
const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.4rem, 4vw, 1.9rem)',
  color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};
const modeLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#d98a98', fontStyle: 'italic', textAlign: 'center', margin: 0,
};
const boardStyle: React.CSSProperties = {
  position: 'relative', width: BOARD, height: BOARD, borderRadius: '14px', overflow: 'hidden',
  background: 'radial-gradient(120% 95% at 44% 46%, #0c0a18 0%, #030206 86%)', border: '1px solid #1a2440',
};
const svgStyle: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const nodeBoxStyle = (pos: { left: number; top: number }): React.CSSProperties => ({
  position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 2,
});
const nodeBtnStyle = (pos: { left: number; top: number }): React.CSSProperties => ({
  position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, outline: 'none', zIndex: 3,
});
const moodStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.7rem', color: '#d98a98', whiteSpace: 'nowrap',
};
const eyeStyle: React.CSSProperties = { fontSize: '0.6rem', color: '#8fb0dc', cursor: 'pointer', lineHeight: 1 };
const agencyRowStyle: React.CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' };
const actionBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #c33b5e55', padding: '0.45rem 1.1rem',
  borderRadius: '4px', cursor: 'pointer', outline: 'none',
};
const resultStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' };
const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)', color: '#c8d8f0', letterSpacing: '0.06em',
};
const interpStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)',
  color: '#d98a98', fontStyle: 'italic', lineHeight: 1.5, margin: '0.2rem 0 0', maxWidth: '360px',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b` → PASS. (Not yet routed — Task 23 wires it into `GameTable`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/StringsMinigame.tsx
git commit -m "feat(ui): StringsMinigame fog-board screen"
```

---

## Task 23: Routing + fan/result display

**Files:**
- Modify: `src/components/screens/GameTable.tsx`, `src/components/overlays/ConstellationFan.tsx`, `src/components/screens/ResultReading.tsx`

**Interfaces:**
- Consumes: `StringsMinigame` (Task 22), `StringSigil` (Task 20), `CONCEPTS`.
- Produces: the `minigame` screen routes to `StringsMinigame`; committed `StringsResult`s render in the constellation fan and the result page.

- [ ] **Step 1: Route the screen in `GameTable`**

In `src/components/screens/GameTable.tsx`, add the import:

```tsx
import StringsMinigame from './StringsMinigame';
```

In `renderMinigame()`, add a case before `default`:

```tsx
      case 'strings':
        return <StringsMinigame key="strings-minigame" />;
```

- [ ] **Step 2: Render `StringsResult` in the fan + result page**

Open `src/components/overlays/ConstellationFan.tsx` and `src/components/screens/ResultReading.tsx`. Both pick a per-result renderer keyed on `result.type` (the `tarot` / `d20` / `iching` / `astral` / `rune` branches). Add a **sibling `strings` branch** to each, placed next to the existing `rune` branch.

In `ConstellationFan.tsx`, where a per-result sigil is chosen, render the destination gem:

```tsx
// when result.type === 'strings':
<StringSigil glyph={result.symbol} state="lit" size={36} />
```

In `ResultReading.tsx`, where each result's detail is rendered, show the path as a row of mini-gems plus the existing name/interpretation:

```tsx
// when result.type === 'strings':
<div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
  {result.path.map((n, i) => (
    <StringSigil key={n.id} glyph={CONCEPTS[n.conceptId].glyph}
      state={i === result.path.length - 1 ? 'lit' : 'candidate'} size={24} />
  ))}
</div>
```

Add the imports each file needs:

```tsx
import StringSigil from '../cards/StringSigil';   // path is '../cards/StringSigil' from overlays/ and screens/
import { CONCEPTS } from '../../data/strings';     // ResultReading only (the path row)
```

> If a component has a generic fallback (renders `result.symbol` + `result.name` + `result.interpretation` for any type), Strings already shows acceptably there — in that case the dedicated branch above is a visual upgrade, not a fix. If a component switches on type with **no** fallback, the `strings` branch is **required** so the slot is not blank. Determine which by reading the file; add the branch wherever the switch lives.

- [ ] **Step 3: Typecheck + manual verification**

Run: `npx tsc -b` → PASS.
Run: `npm run dev`. Open `?debug`, start a turn, and pick **Strings of Fate** (or stage affinities so it appears). Verify: the fog board renders; clicking a candidate extends the thread, parts the fog, and reveals the next ring; the agency buttons appear under Will/Light affinities; arrival shows the destination reading; **Read the weave** commits; the result appears in the constellation fan and on the result page. Run the debug scenarios under the **Strings** group.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/GameTable.tsx src/components/overlays/ConstellationFan.tsx src/components/screens/ResultReading.tsx
git commit -m "feat(ui): route StringsMinigame + render StringsResult in fan/result"
```

> **Layer E complete** — Strings of Fate is fully playable end-to-end in the app. `tsc` green; manual flow verified. Mergeable.

---

## Task 24: Documentation (CLAUDE.md requirement)

**Files:**
- Modify: `docs/game-systems.md`, `README.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Add the source-of-truth rows to the `game-systems.md` sync table**

In `docs/game-systems.md`, in the sync table near the top (the `| System | Source of truth |` table), add:

```markdown
> | Strings concept library, consolidation, coherence | [`src/data/strings.ts`](../src/data/strings.ts) |
> | Strings plan/generate/reveal/draw | [`src/engine/strings.ts`](../src/engine/strings.ts) |
> | Strings responders (pick + commit + path-internal + Woven Echo) | [`src/engine/responders/strings.ts`](../src/engine/responders/strings.ts) |
> | Weave combine reducer | [`src/engine/events/reducers.ts`](../src/engine/events/reducers.ts) |
```

- [ ] **Step 2: Add the §11 section**

Append a new section to `docs/game-systems.md` (after §10 Rune Casting):

```markdown
---

## 11. Strings of Fate

Strings of Fate (`type: 'strings'`) is the sixth divination method. The seeker draws a
crimson **thread of fate** through a fog-shrouded radial web of authored
**concept-stars**. From a fixed **origin** ("the self") only adjacent stars are
un-veiled — each a **surface hint** (a Sigil-Gem + one mood word). Picking one pulls the
thread taut, disperses the fog along it, and reveals the next ring. On reaching a
question-tailored **destination**, the whole traversed path consolidates
**destination-governed** into one `StringsResult`.

Sources of truth: [`src/data/strings.ts`](../src/data/strings.ts),
[`src/engine/strings.ts`](../src/engine/strings.ts),
[`src/engine/responders/strings.ts`](../src/engine/responders/strings.ts).

### 11a. The weave (layered DAG under a radial bloom)

`generateWeave` builds a layered DAG: band 0 = a single origin, the middle **crossing**
bands (4 nodes each), and the final **destination** band (3 nodes drawn from the concepts
that answer the current question). Edges connect adjacent bands only; every node has ≥1
forward edge and a path origin→destination always exists. Nodes are placed in a radial
bloom (origin centre, bands as orbit-rings). Base path length is **4 nodes / 3 picks**.

### 11b. Surface-hint reveal (Light/Shadow is the core lever)

`revealFrom` exposes up to `plan.width` pickable candidates from the active node. Clarity
ladders **silhouette → mood → themes → laid-bare** (Shadow … Light). Shadow additionally
**veils** candidates (shown but unpickable); Light adds **look-ahead** silhouettes and
**foresight** (fully un-veil one candidate). The mood word is the only hint at baseline;
full identity resolves on arrival.

### 11c. Plan levers (`planWeave`, by affinity band)

| Lever | Driven by |
|---|---|
| `bandCount` (path length) | Chaos dominant → 5, else 4 |
| `width` (pickable candidates) | Will ascendant+ → 4 · Fate ascendant+ → 2 · else 3 |
| `veil` (unpickable shown) | Shadow ascendant 1 · dominant 2 |
| `clarity` | Shadow ascendant → silhouette · Light ascendant → themes · dominant → laid-bare · else mood |
| `lookAhead` | Light ascendant 1 · dominant 2 |
| `backtracks` / `allowRedraw` | Will ascendant 1 · dominant 2 + redraw |
| `foresight` | Light ascendant+ |
| `extremeBias` / `crossingDensity` | Chaos widens (extreme concepts, more crossings) · Order narrows (mild concepts, reconvergence) |

### 11d. Affinity feeds

Per-step player choices feed via `applyAction`: accept a hinted step → **Fate**
(`reveal-as-drawn`); a blind silhouette accept → **Shadow** (`embrace-mystery`);
backtrack / re-draw → **Will** (`take-reroll`); foresight → **Light** (`use-peek`). At
commit, **path coherence** mirrors the tarot rule: a coherent thread → **Order +6**, a
tangled (opposed-theme) thread → **Chaos +6**. The result's `random` tag also feeds Chaos.

### 11e. Consolidation (`consolidatePath`)

Destination-governed: destination weight ×2, origin & crossings ×1. Dimensions are the
weighted average (clamped ±2 @ 0.5); themes are weighted-frequency with the destination's
themes forced in (cap 2); modifier roles union (origin `subject` → crossings `action` →
destination `effect`). Tags: `draw random strings weave` + each concept's
`concept-<id>` / `family-<family>` / theme tags. **No `reversible` tag is emitted** — a
path has no orientation, so Strings stays out of Mirror / Critical Resonance / Resonant
Change by design. `ReadingPlanner` expands the path into one atomic signal per concept.

### 11f. Event triggers & responders

| Trigger | Fires when |
|---|---|
| `strings:start` | the weave is generated (reserved) |
| `strings:pick` | a candidate is chosen |
| `strings:commit` | the destination is committed |

| Responder | Trigger | Band group | Min band / tier | Effect |
|---|---|---|---|---|
| `chaos-stray-thread` | `strings:pick` | OVERRIDE | Chaos ascendant · notable | the pick jumps to a different revealed neighbor |
| `fate-pull-thread` | `strings:pick` | OVERRIDE | Fate ascendant · major | redirects the pick to a fated neighbor |
| `fate-foregone-step` | `strings:pick` | SPAWN | Fate dominant · major | after the pick, one further step weaves itself |
| `order-true-weave` | `strings:commit` | MUTATE | Order ascendant · notable | tempers the most extreme dimension (×0.5) |
| `coherent-weave` | `strings:commit` | combine `weave` | deterministic | all nodes share a theme → amplify dominant dim ×1.5 |
| `tangled-weave` | `strings:commit` | combine `weave` | deterministic | opposed-theme pair → volatility +1.0 |
| `luminous-path` | `strings:commit` | combine `weave` | deterministic | all benevolent → favorability +0.5 |
| `shrouded-path` | `strings:commit` | combine `weave` | deterministic | all challenging → favorability −0.5, force `mystery` |
| `woven-echo` | `strings:commit` | combine `weave` | deterministic | destination theme matches another slot → amplify dominant dim ×1.25 |
| `chaos-second-result` | `strings:commit` (added) | SPAWN | Chaos dominant · major | spawns a second weave (reused) |

`chaos-happening-interrupt` (`minigame:end`) already covers Strings.

> **Known limitation:** the three **pick-time** strings debug scenarios require a live
> `strings:pick` draft, so they don't fire from a cold scenario load (like the
> iching/astral pick-dependent scenarios); they are validated by the engine test suite.
> The commit-time strings scenarios fire normally.
```

- [ ] **Step 3: Update the README**

In `README.md`, add **Strings of Fate** to the divination-methods list/table (alongside Tarot, Dice, I Ching, Astral, Rune): a one-line description — *"Strings of Fate — trace the red thread through a fog-shrouded web of concepts to a destination that answers your question."* — and add the **Strings** group to the debug-panel scenario list.

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs: Strings of Fate game-systems §11 + README"
```

> **Layer F complete** — docs in sync (CLAUDE.md requirement satisfied).

---

## Done

All six layers complete: Strings of Fate is a fully playable sixth divination method with
its own data, pure engine, responders, screen, synthesis integration, debug scenarios, and
docs. Final gate:

```bash
npx vitest run   # all engine tests green
npx tsc -b       # strict typecheck green
npm run build    # production bundle
```
