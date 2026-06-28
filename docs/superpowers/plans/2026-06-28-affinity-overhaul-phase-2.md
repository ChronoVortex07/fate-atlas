# Affinity Overhaul — Phase 2 (Happenings Overhaul) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the happenings' single-`affinityChanges` model with a rich `HappeningEffect[]` model (permanent shifts, decaying **surges**, **costs**, queued **reading effects**, weighted **gambles**, and Phase-3-stubbed **upheavals**), drive happenings on a **decoupled once-per-turn cadence** instead of Chaos-only gating, weight scene **selection by the player's dominant axis**, and surface the new effects in the `HappeningScene` UI — all on top of the Phase 1 base/effective/surge engine.

**Architecture:** A happening choice becomes `{ text, effects: HappeningEffect[] }`. `resolveHappening` walks the effects and routes each to an existing engine primitive: `shift`/`cost` → `AffinityEngine.shift`, `surge` → `GameEngine.grantSurge` (Phase 1), `reading` → a new turn-scoped `state.pendingReadingEffects` queue that the **next reading consumes at its existing dispatch triggers** (no new effect engine — just queued flags seeded into the existing `PhaseDraft`/peek-gate vocabulary), `gamble` → weighted recursion, `upheaval` → a Phase-2 no-op stub (Phase 3 wires it into the unified modifier list). Cadence and selection move into `GameEngine`/`selectHappening`, retiring the `chaos-happening-interrupt` responder.

**Tech Stack:** TypeScript (strict; `noUnusedLocals`/`noUnusedParameters` on), Vitest (engine tests only, Node env, `Math.random` stubbed for randomness), React 18 + framer-motion for the one UI task. No ESLint/Prettier — `tsc -b` enforces types.

## Global Constraints

- Engine stays framework-free: **zero React/DOM imports** in `src/engine/**`.
- Every `GameEngine` mutator that changes visible state ends with `notify()`.
- Affinity values are integers clamped **0–100** via the engine's `clamp` (`Math.round`); surges go through Phase 1's `grantSurge`/`eff()`.
- Tests live only under `src/engine/__tests__/**`; randomness is controlled by stubbing `Math.random`. The one UI task (`HappeningScene`) is verified by `tsc`/`build` (+ optional manual probe) — the repo has **no component tests**.
- **"Never show raw numbers"** holds in the UI: happening choices show atmospheric flavor plus a *fiction-telegraphed* category cue (cost → "a price will be paid", upheaval → "the weave may tear", gamble → "fortune decides"); never numeric deltas.
- A happening choice may carry several effects; trade-offs emerge from combining a reward with a cost. Resolution narrates through the existing report → sequencer pipeline where applicable.
- Tuning values here are **starting playtest numbers** (spec §11); keep them in named constants in `src/data/happenings.ts` so they stay tunable.
- **Docs in sync (CLAUDE.md rule):** `docs/game-systems.md` (§2 feeds note, §6 interactions, §7 happenings, source-of-truth table) and the README happenings section MUST be updated to match (Task 8) before this phase is complete.
- Run a single test file: `npx vitest run <path>`. Run all engine tests: `npm test`. Typecheck: `npx tsc -b`. Full gate: `npm run build`.
- **Phase boundaries:** Upheaval *resolution* (the `transform` modifier, emergent-at-extreme responder, snap-back) is **Phase 3** — Phase 2 only stubs the `upheaval` data kind and no-ops it. The Seed of Corruption is Phase 4. Do not build them here.

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/engine/AffinityEngine.ts` | Affinity state, surge primitive | **Modify** (Task 1) — reset per-run counters in `clearModifiers` |
| `src/engine/types.ts` | Shared engine types | **Modify** (Task 2) — `HappeningEffect` union, `ReadingEffectId`, `AffinityAxis`, `TransformPayload`, new `HappeningChoice`; `pendingReadingEffects` on `GameState` |
| `src/data/happenings.ts` | Happening data, selection, tuning | **Modify** (Task 3) — rework all 8 happenings to `{ text, effects[] }` + `axes`; dominant-axis `selectHappening`; `choiceCue`; tuning constants |
| `src/engine/GameEngine.ts` | Façade; resolution; cadence; consumption | **Modify** (Tasks 4–6) — `applyHappeningEffect`, `pickGambleOutcome`, `pendingReadingEffects` reset/consume, peek override, cadence, retire interrupt |
| `src/engine/responders/affinity.ts` | Affinity responders | **Modify** (Task 6) — remove `chaos-happening-interrupt` |
| `src/components/screens/HappeningScene.tsx` | Happening UI | **Modify** (Task 7) — render category cue/flavor |
| `src/engine/events/scenarios.ts` | Debug scenarios | **Modify** (Tasks 6, 8) — remove interrupt scenario; add happening-effect demo |
| `src/engine/__tests__/Happenings.test.ts` | Happening resolution + selection + cadence | **Create** (Tasks 3–6) |
| `src/engine/__tests__/AffinitySurge.test.ts` | Surge primitive | **Modify** (Task 1) — `clearModifiers` resets counters |
| `src/engine/__tests__/AffinityResponders.test.ts` | Affinity responder tests | **Modify** (Task 6) — drop interrupt tests |
| `docs/game-systems.md`, `README.md` | Hand-maintained references | **Modify** (Task 8) |

---

### Task 1: Pre-Phase-2 hardening — `clearModifiers` resets per-run Fortune/DR counters

The Phase 1 final review recorded a latent issue: `clearModifiers()` wipes surge modifiers but **not** the `fortuneTagFeedThisRun` (Fortune cap) or `feedsThisRun` (diminishing-returns) counters. It's safe today only because `beginRun` always follows a reset — but Phase 2 adds the first real `grantSurge`/feed entry points, exactly the scenario that could expose it. Make the invariant local: a full clear of the temporary layer also zeroes the per-run feed counters.

**Files:**
- Modify: `src/engine/AffinityEngine.ts` (`clearModifiers`)
- Modify: `src/engine/__tests__/AffinitySurge.test.ts` (one test)

**Interfaces:**
- Consumes: `clearModifiers()`, `feedFortuneTag()`, `getState()`/`getBase()` (Phase 1).
- Produces: no new symbols — `clearModifiers()` now also resets `fortuneTagFeedThisRun = 0` and every `feedsThisRun[id] = 0`.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/AffinitySurge.test.ts` inside the `describe('AffinityEngine surges', …)` block:

```ts
  it('clearModifiers also resets the per-run Fortune cap counter', () => {
    const e = make();
    // Exhaust the Fortune tag cap (FORTUNE_TAG_CAP = 8) without a beginRun.
    e.feedFortuneTag('chaos', 8, 't');
    expect(e.feedFortuneTag('chaos', 5, 't')).toBe(0); // cap exhausted
    e.clearModifiers();
    expect(e.feedFortuneTag('chaos', 5, 't')).toBeGreaterThan(0); // counter reset by clear
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinitySurge.test.ts -t "Fortune cap counter"`
Expected: FAIL — second `feedFortuneTag` still returns 0 (counter not reset by `clearModifiers`).

- [ ] **Step 3: Reset the counters in `clearModifiers`**

In `src/engine/AffinityEngine.ts`, replace the `clearModifiers` body:

```ts
  clearModifiers(): void {
    this.modifiers = [];
    // The temporary layer and the per-run feed counters are both run-scoped; a full
    // clear (reset paths) zeroes them together so the Fortune cap / diminishing-returns
    // state can't leak across a reset that doesn't pass back through beginRun().
    this.fortuneTagFeedThisRun = 0;
    for (const id of AFFINITY_IDS) this.feedsThisRun[id] = 0;
  }
```

(`AFFINITY_IDS` is already imported from `../data/affinities`; confirm it is in the existing import list and add it if missing.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinitySurge.test.ts`
Expected: PASS (all surge tests).
Run: `npm test`
Expected: PASS — full suite still green.
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinitySurge.test.ts
git commit -m "fix(affinity): clearModifiers resets per-run Fortune/DR counters"
```

---

### Task 2: Phase 2 type model — `HappeningEffect` union + `pendingReadingEffects`

Pure type scaffolding. Defines the data vocabulary every later task builds on and migrates `HappeningChoice` from `affinityChanges` to `effects`. No behavior yet; the migration will leave `happenings.ts`/`GameEngine.ts` temporarily failing `tsc` — those are repaired in Tasks 3–4. To keep this task independently green, **also** update the two consumers minimally so `tsc` passes at this commit (full data rework is Task 3).

**Files:**
- Modify: `src/engine/types.ts` (add the union + `pendingReadingEffects`; change `HappeningChoice`)
- Modify: `src/data/happenings.ts` (interface only — `choices` type + temporary shim so it compiles)
- Modify: `src/engine/GameEngine.ts` (`defaultState` adds `pendingReadingEffects: []`; `resolveHappening`/`triggerHappening` compile against the new `HappeningChoice`)

**Interfaces:**
- Produces: `AffinityAxis`, `ReadingEffectId`, `TransformPayload`, `HappeningEffect`, the new `HappeningChoice` (`{ text; effects: HappeningEffect[] }`), and `GameState.pendingReadingEffects: ReadingEffectId[]`.
- Consumes: `AffinityId` (existing).

- [ ] **Step 1: Add the types to `src/engine/types.ts`**

Replace the existing `HappeningChoice` interface (currently `{ text; affinityChanges }`) with the block below, and add the new types directly above `HappeningResult`:

```ts
// ── Happening effects (Phase 2) ──
export type AffinityAxis = 'agency' | 'information' | 'fortune';

// Queued flags a happening grants to the NEXT reading; each maps onto existing
// draft/peek vocabulary consumed at that reading's dispatch trigger (no new engine).
export type ReadingEffectId =
  | 'widen-pool'     // next draw: +1 method offered (cf. will-widen-pool)
  | 'guarantee-peek' // next reading: peek gate forced open for one reading
  | 'deny-peek'      // next reading: peek gate forced shut for one reading
  | 'grant-reroll'   // next dice reading: offer a reroll (cf. will-offer-reroll)
  | 'spawn-second'   // next reading commit: spawn a second result (cf. chaos-second-result)
  | 'shroud-card';   // next draw: shroud one method (cf. shadow-shroud)

// Phase 3 applies these to EFFECTIVE values via the unified modifier list. Phase 2
// only carries the data; resolution is a no-op stub.
export type TransformPayload = {
  transform: 'invert-pair' | 'invert-all' | 'scramble';
  axis?: AffinityAxis;
};

export type HappeningEffect =
  | { kind: 'shift';    affinity: AffinityId; amount: number }                              // permanent nudge
  | { kind: 'surge';    deltas: Partial<Record<AffinityId, number>>; readings: number }     // decaying temporary spike
  | { kind: 'reading';  effect: ReadingEffectId }                                           // modify the next reading(s)
  | { kind: 'cost';     affinity: AffinityId; amount: number }                              // positive magnitude, applied as a drain
  | { kind: 'gamble';   outcomes: { weight: number; effects: HappeningEffect[] }[] }        // weighted branch
  | { kind: 'upheaval'; transform: TransformPayload; readings: number };                    // Phase 3 (no-op stub in Phase 2)

export interface HappeningChoice {
  text: string;                 // the cryptic choice text shown to the player
  effects: HappeningEffect[];   // one or more effects applied on choosing
}
```

- [ ] **Step 2: Add `pendingReadingEffects` to `GameState`**

In `interface GameState`, add directly under `selectedHappeningChoice:`:

```ts
  selectedHappeningChoice: number | null;
  pendingReadingEffects: ReadingEffectId[]; // queued by happenings, consumed by the next reading (turn-scoped)
```

- [ ] **Step 3: Make the two consumers compile (temporary shim)**

In `src/data/happenings.ts`, the `HappeningData.choices` type currently is
`{ text: string; affinityChanges: Partial<Record<string, number>> }[]`. Change it to:

```ts
import type { ThemeTag, DimensionValues, ModifierRole, HappeningEffect, AffinityAxis } from '../engine/types';

export interface HappeningData {
  id: string;
  scene: string;
  choices: { text: string; effects: HappeningEffect[] }[];
  axes: AffinityAxis[]; // dominant-axis tags for selection weighting (Task 3)
  tags: string[];
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}
```

To keep THIS task compiling without the full rework, temporarily convert each existing happening's `affinityChanges: { x: n }` to `effects: [{ kind: 'shift', affinity: 'x', amount: n }]` and add `axes: ['fortune']` to each of the 8 (Task 3 replaces all of this with the real content). Mechanical example for `crossroads`:

```ts
    choices: [
      { text: 'Take the gleaming path — it feels certain.', effects: [{ kind: 'shift', affinity: 'order', amount: 8 }] },
      { text: 'Step into the shadowed stars — uncertainty calls.', effects: [{ kind: 'shift', affinity: 'chaos', amount: 8 }] },
      { text: 'Sit at the crossroads and wait for a sign.', effects: [{ kind: 'shift', affinity: 'order', amount: 4 }, { kind: 'shift', affinity: 'chaos', amount: 4 }] },
    ],
    axes: ['fortune'],
```

In `src/engine/GameEngine.ts`:
- In `defaultState()` add under the `selectedHappeningChoice: null,` line: `pendingReadingEffects: [],`.
- In `triggerHappening()` the `bonusChoice` literal becomes effects-shaped:
  ```ts
      const bonusChoice = {
        text: 'A hidden path emerges — ' + this.state.happening.choices[0].text,
        effects: [{ kind: 'shift', affinity: 'chaos', amount: 5 }] as HappeningEffect[],
      };
  ```
- In `resolveHappening()` replace the `for (const [id, delta] of Object.entries(choice.affinityChanges)) { … }` loop with a temporary effects loop so it compiles (Task 4 replaces this with the real dispatcher):
  ```ts
    for (const effect of choice.effects) {
      if (effect.kind === 'shift') {
        this.affinityEngine.shift(effect.affinity, effect.amount, `happening:${this.state.happening.id}`);
      }
    }
  ```
- Add `HappeningEffect` to the type import from `./types` at the top of `GameEngine.ts`.

Also update the `triggerHappening` mapping that copies `data.choices` onto `state.happening` — it currently maps `c.affinityChanges`; change it to carry `effects` and the data's `axes` is NOT part of `HappeningResult` (selection-only), so leave `HappeningResult` as `{ …, choices: HappeningChoice[] }`:

```ts
      choices: data.choices.map((c) => ({ text: c.text, effects: c.effects })),
```

- [ ] **Step 4: Typecheck + full suite**

Run: `npx tsc -b`
Expected: no type errors (the shim keeps everything well-typed).
Run: `npm test`
Expected: PASS — behavior is unchanged (shifts still apply; `pendingReadingEffects` is inert). Note: the existing `selectHappening` still takes `chaosAffinity: number` here — Task 3 changes its signature; do not touch it yet.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/data/happenings.ts src/engine/GameEngine.ts
git commit -m "feat(happenings): add HappeningEffect type model + pendingReadingEffects (shim)"
```

---

### Task 3: Rework the 8 happenings + dominant-axis selection + `choiceCue`

Replace the shim with the real content model: every happening carries `{ text, effects[] }` choices that exercise the full effect vocabulary, plus `axes` tags; `selectHappening` weights by the player's **dominant axis**; a pure `choiceCue` derives the UI category cue from a choice's effects.

**Files:**
- Modify: `src/data/happenings.ts` (data rework, constants, `dominantAxis`, `choiceCue`, new `selectHappening` signature)
- Modify: `src/engine/GameEngine.ts` (`triggerHappening` call site passes full affinities)
- Create: `src/engine/__tests__/Happenings.test.ts` (selection + cue tests)

**Interfaces:**
- Consumes: `HappeningEffect`, `AffinityAxis`, `ReadingEffectId` (Task 2); `AffinityId`.
- Produces:
  - `selectHappening(excludeIds: string[], affinities: Record<AffinityId, number>): HappeningData`
  - `dominantAxis(aff: Record<AffinityId, number>): AffinityAxis`
  - `choiceCue(effects: HappeningEffect[]): 'price' | 'tear' | 'fortune' | null`
  - `AXIS_WEIGHT_BONUS`, `HAPPENING_GAP_CHANCE` constants.

- [ ] **Step 1: Write the failing selection + cue tests**

Create `src/engine/__tests__/Happenings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HAPPENINGS, selectHappening, dominantAxis, choiceCue } from '../../data/happenings';
import { defaultAffinityState } from '../../data/affinities';
import type { HappeningEffect } from '../types';

const aff = (over: Partial<Record<string, number>> = {}) => ({ ...defaultAffinityState(), ...over } as Record<import('../types').AffinityId, number>);

describe('happenings data + selection', () => {
  it('every happening choice carries at least one effect and valid axes', () => {
    for (const h of HAPPENINGS) {
      expect(h.axes.length).toBeGreaterThan(0);
      for (const c of h.choices) expect(c.effects.length).toBeGreaterThan(0);
    }
  });

  it('dominantAxis picks the pair with the widest spread', () => {
    expect(dominantAxis(aff({ chaos: 90, order: 10 }))).toBe('fortune');
    expect(dominantAxis(aff({ light: 88, shadow: 20 }))).toBe('information');
    expect(dominantAxis(aff({ fate: 85, will: 15 }))).toBe('agency');
  });

  it('selectHappening biases toward the dominant axis (information-heavy → an information scene)', () => {
    const orig = Math.random;
    // Information-dominant weights (data order): crossroads 1, falling-star 2, … total 13.
    // roll = 0.1 × 13 = 1.3 → skips crossroads (w1), lands in falling-star's (1,3] band:
    // an `information` scene. (Deterministic given the data as authored in this task.)
    Math.random = () => 0.1;
    try {
      const picked = selectHappening([], aff({ light: 95, shadow: 5 }));
      expect(picked.axes).toContain('information');
    } finally {
      Math.random = orig;
    }
  });

  it('choiceCue derives the fiction cue from effect kinds', () => {
    expect(choiceCue([{ kind: 'cost', affinity: 'order', amount: 10 }] as HappeningEffect[])).toBe('price');
    expect(choiceCue([{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }] as HappeningEffect[])).toBe('tear');
    expect(choiceCue([{ kind: 'gamble', outcomes: [] }] as HappeningEffect[])).toBe('fortune');
    expect(choiceCue([{ kind: 'shift', affinity: 'order', amount: 6 }] as HappeningEffect[])).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts`
Expected: FAIL — `dominantAxis`/`choiceCue` not exported; `selectHappening` signature mismatch; `axes` undefined on shimmed data.

- [ ] **Step 3: Rewrite `src/data/happenings.ts`**

Replace the entire file with:

```ts
import type {
  ThemeTag, DimensionValues, ModifierRole, HappeningEffect, AffinityAxis, AffinityId,
} from '../engine/types';

export interface HappeningData {
  id: string;
  scene: string;
  choices: { text: string; effects: HappeningEffect[] }[];
  axes: AffinityAxis[]; // dominant-axis tags for selection weighting
  tags: string[];
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

// ── Tuning (playtest defaults; spec §11 leaves exact values open) ──
export const AXIS_WEIGHT_BONUS = 1;     // extra selection weight when a scene matches the player's dominant axis
export const HAPPENING_GAP_CHANCE = 0.5; // per-gap fire chance before the guaranteed final gap (cadence, Task 6)

export const HAPPENINGS: HappeningData[] = [
  {
    id: 'crossroads',
    scene: 'A path splits before you beneath the star-field. One fork gleams with known light, the other vanishes into shadowed constellations.',
    choices: [
      { text: 'Take the gleaming path — it feels certain.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
      { text: 'Step into the shadowed stars — uncertainty calls.', effects: [{ kind: 'surge', deltas: { chaos: 25 }, readings: 3 }, { kind: 'cost', affinity: 'order', amount: 8 }] },
      { text: 'Sit at the crossroads and wait for a sign.', effects: [{ kind: 'shift', affinity: 'fate', amount: 4 }, { kind: 'reading', effect: 'deny-peek' }] },
    ],
    axes: ['agency', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'transformation'],
    dimensions: { favorability: 0.0, certainty: -1.5, volatility: 1.5 },
    modifierRoles: ['action'],
  },
  {
    id: 'falling-star',
    scene: 'A star tears across the sky, brilliant and brief. In its trail, a silence settles — the kind that asks a question.',
    choices: [
      { text: 'Make a wish upon the falling light.', effects: [{ kind: 'surge', deltas: { chaos: 30 }, readings: 3 }, { kind: 'cost', affinity: 'order', amount: 10 }] },
      { text: 'Chart its arc — find the pattern.', effects: [{ kind: 'surge', deltas: { light: 25 }, readings: 3 }, { kind: 'reading', effect: 'guarantee-peek' }] },
      { text: 'Look away; let it pass.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
    ],
    axes: ['fortune', 'information'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['upheaval', 'illumination'],
    dimensions: { favorability: 0.5, certainty: -0.5, volatility: 2.0 },
    modifierRoles: ['effect'],
  },
  {
    id: 'veiled-moon',
    scene: 'A veil of cloud drifts across the moon. Shapes form and dissolve — some feel like omens, others like memories.',
    choices: [
      { text: 'Read the shapes as portents — they must mean something.', effects: [{ kind: 'surge', deltas: { shadow: 22 }, readings: 3 }, { kind: 'reading', effect: 'shroud-card' }] },
      { text: 'Let them pass — clouds are only clouds.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
      { text: 'Draw the shapes in the dust, fixing them in place.', effects: [{ kind: 'shift', affinity: 'light', amount: 4 }, { kind: 'shift', affinity: 'order', amount: 3 }] },
    ],
    axes: ['information', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'surrender'],
    dimensions: { favorability: 0.0, certainty: -1.0, volatility: 1.0 },
    modifierRoles: ['subject'],
  },
  {
    id: 'whispering-thread',
    scene: 'A thread of starlight seems to whisper at the edge of hearing. Words form just beyond comprehension, promising secrets.',
    choices: [
      { text: 'Lean in — strain to hear the whispered truth.', effects: [{ kind: 'gamble', outcomes: [
        { weight: 1, effects: [{ kind: 'surge', deltas: { light: 25 }, readings: 3 }, { kind: 'reading', effect: 'guarantee-peek' }] },
        { weight: 1, effects: [{ kind: 'cost', affinity: 'light', amount: 10 }, { kind: 'reading', effect: 'deny-peek' }] },
      ] }] },
      { text: 'Step back — some knowledge is not meant for you.', effects: [{ kind: 'shift', affinity: 'shadow', amount: 6 }] },
    ],
    axes: ['information', 'agency'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'illumination'],
    dimensions: { favorability: 0.0, certainty: -2.0, volatility: 1.0 },
    modifierRoles: ['subject', 'action'],
  },
  {
    id: 'convergence',
    scene: 'Three constellations drift toward alignment above you. The ancients called this a moment when the veil wears thin.',
    choices: [
      { text: 'Align yourself with the convergence — become part of the pattern.', effects: [{ kind: 'surge', deltas: { order: 25 }, readings: 3 }] },
      { text: 'Stand at an angle to it — see what the pattern hides.', effects: [{ kind: 'surge', deltas: { chaos: 22 }, readings: 3 }, { kind: 'reading', effect: 'spawn-second' }] },
    ],
    axes: ['fortune', 'information'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['harmony', 'illumination'],
    dimensions: { favorability: 1.0, certainty: 1.0, volatility: -0.5 },
    modifierRoles: ['effect'],
  },
  {
    id: 'echo-of-past-reading',
    scene: 'The echo of a past divination resurfaces — a card, a number, a symbol — asking to be reconsidered.',
    choices: [
      { text: 'Reinterpret the past — its meaning may have changed.', effects: [{ kind: 'surge', deltas: { chaos: 20 }, readings: 3 }, { kind: 'reading', effect: 'grant-reroll' }] },
      { text: 'Acknowledge and release — the past is settled.', effects: [{ kind: 'shift', affinity: 'fate', amount: 6 }] },
    ],
    axes: ['agency', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['transformation', 'illumination'],
    dimensions: { favorability: 0.0, certainty: -0.5, volatility: 1.5 },
    modifierRoles: ['subject'],
  },
  {
    id: 'dark-constellation',
    scene: 'A gap in the stars catches your eye — not empty, but dark. A constellation made of absence rather than light.',
    choices: [
      { text: 'Study the negative space — what is missing matters.', effects: [{ kind: 'surge', deltas: { shadow: 25 }, readings: 3 }, { kind: 'reading', effect: 'shroud-card' }] },
      { text: 'Fill the void with your own pattern — create meaning.', effects: [{ kind: 'surge', deltas: { will: 22 }, readings: 3 }, { kind: 'cost', affinity: 'fate', amount: 8 }] },
    ],
    axes: ['information', 'agency'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'surrender'],
    dimensions: { favorability: -0.5, certainty: -1.5, volatility: 1.0 },
    modifierRoles: ['subject', 'action'],
  },
  {
    id: 'many-threads',
    scene: 'Countless threads of fate shimmer into view, each one a path not taken. The weave is impossibly complex.',
    choices: [
      { text: 'Trace one thread backward — understand what shaped it.', effects: [{ kind: 'surge', deltas: { order: 22 }, readings: 3 }, { kind: 'reading', effect: 'widen-pool' }] },
      { text: 'Pluck a thread and see what unravels — test the weave.', effects: [{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }, { kind: 'surge', deltas: { chaos: 20 }, readings: 2 }] },
    ],
    axes: ['agency', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'transformation'],
    dimensions: { favorability: 0.0, certainty: -2.0, volatility: 2.0 },
    modifierRoles: ['action', 'effect'],
  },
];

// Which polar pair has the widest spread → the player's dominant axis.
export function dominantAxis(aff: Record<AffinityId, number>): AffinityAxis {
  const agency = Math.abs(aff.fate - aff.will);
  const information = Math.abs(aff.light - aff.shadow);
  const fortune = Math.abs(aff.chaos - aff.order);
  if (agency >= information && agency >= fortune) return 'agency';
  if (information >= fortune) return 'information';
  return 'fortune';
}

// Fiction-telegraphed UI cue derived from a choice's effects (never numeric).
export function choiceCue(effects: HappeningEffect[]): 'price' | 'tear' | 'fortune' | null {
  if (effects.some((e) => e.kind === 'upheaval')) return 'tear';
  if (effects.some((e) => e.kind === 'gamble')) return 'fortune';
  if (effects.some((e) => e.kind === 'cost')) return 'price';
  return null;
}

export function selectHappening(
  excludeIds: string[],
  affinities: Record<AffinityId, number>,
): HappeningData {
  let available = HAPPENINGS.filter((h) => !excludeIds.includes(h.id));
  if (available.length === 0) available = [...HAPPENINGS];

  const axis = dominantAxis(affinities);
  const weighted = available.map((h) => ({
    happening: h,
    weight: 1 + (h.axes.includes(axis) ? AXIS_WEIGHT_BONUS : 0),
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.happening;
  }
  return weighted[weighted.length - 1].happening;
}
```

- [ ] **Step 4: Update the `selectHappening` call site in `GameEngine.ts`**

In `triggerHappening()` change the call from `selectHappening(Array.from(this.usedHappeningIds), affinities.chaos)` to:

```ts
    const data = selectHappening(Array.from(this.usedHappeningIds), affinities);
```

(`affinities` is already `this.affinityEngine.getState()` above the call.)

- [ ] **Step 5: Run to verify green**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS — the temporary shift-only resolution from Task 2 still applies the `shift` effects; surge/cost/reading/gamble/upheaval effects are not yet resolved (Task 4) so they're inert, which does not break existing tests.
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/happenings.ts src/engine/GameEngine.ts src/engine/__tests__/Happenings.test.ts
git commit -m "feat(happenings): rework all 8 to effect model + dominant-axis selection + choiceCue"
```

---

### Task 4: `resolveHappening` applies every effect kind

Replace the temporary shift-only loop with the real dispatcher: `shift`, `cost` (drain), `surge` (Phase 1 `grantSurge`), `reading` (enqueue to `pendingReadingEffects`), `gamble` (weighted recursion), `upheaval` (no-op stub). Reset `pendingReadingEffects` at turn start.

**Files:**
- Modify: `src/engine/GameEngine.ts` (`applyHappeningEffect`, `pickGambleOutcome`, `resolveHappening`, `startTurn`)
- Modify: `src/engine/__tests__/Happenings.test.ts` (resolution tests)

**Interfaces:**
- Consumes: `HappeningEffect` (Task 2); `AffinityEngine.shift`/`grantSurge`/`getBase`/`getState` (Phase 1); `state.pendingReadingEffects` (Task 2).
- Produces: `GameEngine.applyHappeningEffect(effect, source)` (private), `GameEngine.pickGambleOutcome(outcomes)` (private). `resolveHappening` now resolves all kinds.

- [ ] **Step 1: Write the failing resolution tests**

Add to `src/engine/__tests__/Happenings.test.ts` a new block (these drive a happening through the public engine API):

```ts
import { GameEngine } from '../GameEngine';
import type { HappeningResult } from '../types';

// Inject a one-choice happening of the given effects directly onto state, then resolve it.
function resolveWith(engine: GameEngine, effects: import('../types').HappeningEffect[]) {
  const happening: HappeningResult = {
    type: 'happening', id: 'test-happening', scene: 's',
    choices: [{ text: 'c', effects }],
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
  };
  engine.loadState({ screen: 'happening', happening });
  engine.resolveHappening(0);
}

describe('resolveHappening effect resolution', () => {
  it('shift nudges base permanently', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'shift', affinity: 'order', amount: 6 }]);
    expect(engine.getState().affinityBase.order).toBeGreaterThan(50);
  });

  it('cost drains the affinity (applied as a negative shift)', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'cost', affinity: 'order', amount: 10 }]);
    expect(engine.getState().affinityBase.order).toBeLessThan(50);
  });

  it('surge spikes effective without touching base', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'surge', deltas: { chaos: 30 }, readings: 3 }]);
    const s = engine.getState();
    expect(s.affinityBase.chaos).toBe(50);
    expect(s.affinities.chaos).toBe(80);
  });

  it('reading effect is enqueued onto pendingReadingEffects', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'reading', effect: 'guarantee-peek' }]);
    expect(engine.getState().pendingReadingEffects).toContain('guarantee-peek');
  });

  it('gamble resolves exactly one weighted outcome', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random; Math.random = () => 0; // lands on the first outcome
    try {
      resolveWith(engine, [{ kind: 'gamble', outcomes: [
        { weight: 1, effects: [{ kind: 'shift', affinity: 'light', amount: 8 }] },
        { weight: 1, effects: [{ kind: 'shift', affinity: 'shadow', amount: 8 }] },
      ] }]);
    } finally { Math.random = orig; }
    const s = engine.getState();
    expect(s.affinityBase.light).toBeGreaterThan(50);
    expect(s.affinityBase.shadow).toBeLessThanOrEqual(50); // the other outcome did NOT fire
  });

  it('upheaval is a no-op stub in Phase 2 but sibling effects still apply', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [
      { kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 },
      { kind: 'surge', deltas: { chaos: 20 }, readings: 2 },
    ]);
    const s = engine.getState();
    expect(s.affinities.chaos).toBe(70); // surge applied
    expect(s.affinityBase.chaos).toBe(50); // upheaval did NOT transform/mutate anything
  });

  it('startTurn clears pendingReadingEffects', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    // Use guarantee-peek (consumed at reading start, NOT during resolveHappening's
    // buildPool) so this stays queued here and at Task 5 — widen-pool/shroud-card
    // would be drained by the buildPool inside resolveHappening once Task 5 lands.
    resolveWith(engine, [{ kind: 'reading', effect: 'guarantee-peek' }]);
    expect(engine.getState().pendingReadingEffects.length).toBeGreaterThan(0);
    engine.startTurn('self');
    expect(engine.getState().pendingReadingEffects).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts -t "effect resolution"`
Expected: FAIL — `surge`/`cost`/`reading`/`gamble` not yet resolved (only `shift` applies from the Task 2 shim); `pendingReadingEffects` not reset by `startTurn`.

- [ ] **Step 3: Implement the effect dispatcher**

In `src/engine/GameEngine.ts`, add these private methods near `resolveHappening`:

```ts
  // Routes one happening effect to its engine primitive. Recursive for `gamble`.
  private applyHappeningEffect(effect: HappeningEffect, source: string): void {
    switch (effect.kind) {
      case 'shift':
        this.affinityEngine.shift(effect.affinity, effect.amount, source);
        break;
      case 'cost':
        this.affinityEngine.shift(effect.affinity, -Math.abs(effect.amount), source);
        break;
      case 'surge':
        this.affinityEngine.grantSurge(effect.deltas, effect.readings, source);
        break;
      case 'reading':
        this.state.pendingReadingEffects = [...this.state.pendingReadingEffects, effect.effect];
        break;
      case 'gamble':
        for (const e of this.pickGambleOutcome(effect.outcomes)) this.applyHappeningEffect(e, source);
        break;
      case 'upheaval':
        // Phase 3 wires this into the unified modifier list as a `transform`. No-op here.
        break;
    }
  }

  private pickGambleOutcome(outcomes: { weight: number; effects: HappeningEffect[] }[]): HappeningEffect[] {
    if (outcomes.length === 0) return [];
    const total = outcomes.reduce((s, o) => s + o.weight, 0);
    let roll = Math.random() * total;
    for (const o of outcomes) {
      roll -= o.weight;
      if (roll <= 0) return o.effects;
    }
    return outcomes[outcomes.length - 1].effects;
  }
```

Replace the temporary effects loop in `resolveHappening()` with:

```ts
    const source = `happening:${this.state.happening.id}`;
    for (const effect of choice.effects) this.applyHappeningEffect(effect, source);
```

In `startTurn()`, add alongside the other per-turn resets (next to `this.state.selectedHappeningChoice = null;`):

```ts
    this.state.pendingReadingEffects = [];
```

- [ ] **Step 4: Run to verify green**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts`
Expected: PASS (selection + resolution blocks).
Run: `npm test`
Expected: PASS — full suite green.
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/Happenings.test.ts
git commit -m "feat(happenings): resolve shift/cost/surge/reading/gamble effects (upheaval stubbed)"
```

---

### Task 5: The next reading consumes `pendingReadingEffects`

Wire each queued `ReadingEffectId` into the existing dispatch/peek vocabulary so the **next reading** honors it, then drop it. Six effects, six existing seams. A turn-scoped peek override (set at reading start, cleared at reading end) handles the two peek effects; the other four seed the existing `PhaseDraft`/spawn paths.

**Files:**
- Modify: `src/engine/GameEngine.ts` (`consumeReadingEffect`, peek override field + plumbing, seams in `buildPool`/`planDiceRoll`/`completeMinigame`/`beginSelection`/`advanceAfterCommit`/`notify`)
- Modify: `src/engine/__tests__/Happenings.test.ts` (consumption tests)

**Interfaces:**
- Consumes: `state.pendingReadingEffects` (Task 2), `getEffects()` (Phase 1), the existing draft fields `poolTarget`/`shrouded`/`offerReroll`/`spawnSecond`.
- Produces: `GameEngine.consumeReadingEffect(id: ReadingEffectId): boolean` (private); `private peekOverrideThisReading: 'guarantee' | 'deny' | null`.

- [ ] **Step 1: Write the failing consumption tests**

Add to `src/engine/__tests__/Happenings.test.ts`:

```ts
describe('pendingReadingEffects consumption', () => {
  it('widen-pool grows the next draw by one method and is then consumed', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const before = engine.getState().availableMethods.length;
    engine.loadState({ pendingReadingEffects: ['widen-pool'] });
    // Re-deal the pool the way the between-reading flow does.
    (engine as unknown as { buildPool: (b: object, r: boolean) => void }).buildPool({}, true);
    const s = engine.getState();
    expect(s.availableMethods.length).toBe(before + 1);
    expect(s.pendingReadingEffects).not.toContain('widen-pool');
  });

  it('guarantee-peek forces the peek gate open for the next reading regardless of Light', () => {
    const engine = new GameEngine();
    engine.startTurn('self'); // base Light 50 → peek normally unavailable
    expect(engine.getState().affinityEffects.peekAvailable).toBe(false);
    engine.loadState({ pendingReadingEffects: ['guarantee-peek'] });
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    expect(engine.getState().affinityEffects.peekAvailable).toBe(true);
    expect(engine.getState().pendingReadingEffects).not.toContain('guarantee-peek');
  });

  it('deny-peek forces the peek gate shut even when Light would allow it', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    // Lift Light above the peek gate with a surge (public, deterministic) so the
    // override has something to override: effective light 80 → peekAvailable true.
    engine.grantSurge({ light: 30 }, 3, 'test');
    expect(engine.getState().affinityEffects.peekAvailable).toBe(true);
    engine.loadState({ pendingReadingEffects: ['deny-peek'] });
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    expect(engine.getState().affinityEffects.peekAvailable).toBe(false);
  });

  it('grant-reroll makes the next dice roll offer a reroll', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ pendingReadingEffects: ['grant-reroll'] });
    const plan = engine.planDiceRoll();
    expect(plan.offerReroll).toBe(true);
    expect(engine.getState().pendingReadingEffects).not.toContain('grant-reroll');
  });
});
```

> **Note for the implementer:** `loadState` sets fields on the snapshot/engine state directly; if `affinityBase` cannot be set via `loadState` in this codebase, set Light through the affinity engine the way other tests do (e.g. a debug/setState path) — match the existing test helpers in `GameEngine.test.ts`. The behavioral assertions (peek gate open/shut, reroll offered, pool +1) are what matter; adapt the staging to the available helpers.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts -t "consumption"`
Expected: FAIL — `consumeReadingEffect` absent; pool not widened; peek gate ignores the queue; `offerReroll` false.

- [ ] **Step 3: Add the consumer helper + peek override field**

In `src/engine/GameEngine.ts`, add the field near the other private state (e.g. beside `private usedHappeningIds`):

```ts
  private peekOverrideThisReading: 'guarantee' | 'deny' | null = null;
```

Add the helper (place near `applyHappeningEffect`):

```ts
  // Removes one queued reading effect and reports whether it was present.
  private consumeReadingEffect(id: ReadingEffectId): boolean {
    const i = this.state.pendingReadingEffects.indexOf(id);
    if (i < 0) return false;
    this.state.pendingReadingEffects = [
      ...this.state.pendingReadingEffects.slice(0, i),
      ...this.state.pendingReadingEffects.slice(i + 1),
    ];
    return true;
  }
```

Add `ReadingEffectId` to the `./types` import at the top of `GameEngine.ts`.

- [ ] **Step 4: Seed the four draft/spawn effects**

**widen-pool + shroud-card — in `buildPool`,** replace the single existing line `const target = (startDraft.poolTarget as number) ?? baseCount;` with the two lines below (consume widen-pool BEFORE generating the pool):

```ts
    let target = (startDraft.poolTarget as number) ?? baseCount;
    if (this.consumeReadingEffect('widen-pool')) target += 1;
```

Then, after `this.state.shroudedMethods = …` is assigned, add:

```ts
    if (this.consumeReadingEffect('shroud-card')) {
      const free = this.state.availableMethods
        .map((_, i) => i)
        .find((i) => !this.state.shroudedMethods.includes(i));
      if (free !== undefined) this.state.shroudedMethods = [...this.state.shroudedMethods, free];
    }
```

**grant-reroll — in `planDiceRoll`,** change the returned `offerReroll`:

```ts
      offerReroll: (draft.offerReroll ?? false) || this.consumeReadingEffect('grant-reroll'),
```

**spawn-second — in `completeMinigame`,** directly after the commit dispatch line `const { draft } = this.dispatchAt(commitTrigger, { outcome: result });`:

```ts
    if (result.type !== 'happening' && typeof draft.spawnSecond !== 'string'
        && this.consumeReadingEffect('spawn-second')) {
      draft.spawnSecond = result.type;
    }
```

(The existing `if (typeof draft.spawnSecond === 'string') { … }` block then spawns the second result — no other change needed there.)

- [ ] **Step 5: Plumb the peek override (guarantee-peek / deny-peek)**

In `beginSelection()` (reading start), consume the peek effects and record the override (this runs before the minigame and before any peek):

```ts
    // Consume any happening-granted peek override for the reading about to start.
    if (this.consumeReadingEffect('guarantee-peek')) this.peekOverrideThisReading = 'guarantee';
    else if (this.consumeReadingEffect('deny-peek')) this.peekOverrideThisReading = 'deny';
```

Put it at the top of `beginSelection`, before the `dispatchAt('select:pick', …)` call.

In `notify()`, after `this.state.affinityEffects = this.affinityEngine.getEffects();`, apply the override:

```ts
    if (this.peekOverrideThisReading === 'guarantee') this.state.affinityEffects = { ...this.state.affinityEffects, peekAvailable: true };
    else if (this.peekOverrideThisReading === 'deny') this.state.affinityEffects = { ...this.state.affinityEffects, peekAvailable: false };
```

In `advanceAfterCommit()` (reading end), clear it alongside `tickModifiers()`:

```ts
    this.affinityEngine.tickModifiers();
    this.peekOverrideThisReading = null; // peek override lasts exactly one reading
```

Also clear it in `startTurn()` (next to `this.state.pendingReadingEffects = [];`): `this.peekOverrideThisReading = null;`.

- [ ] **Step 6: Run to verify green**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS — full suite green (existing peek/pool/dice tests unaffected when the queue is empty; the override is null by default).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/Happenings.test.ts
git commit -m "feat(happenings): next reading consumes pendingReadingEffects (pool/peek/reroll/spawn/shroud)"
```

---

### Task 6: Decoupled cadence — offer ~once per turn, retire `chaos-happening-interrupt`

Replace Chaos-only gating with a turn-scoped cadence: a happening is offered at most once per turn, in a between-reading gap, never after the final reading; the placement varies but is guaranteed by the last eligible gap. Remove the `chaos-happening-interrupt` responder, its scenario, and its tests.

**Files:**
- Modify: `src/engine/GameEngine.ts` (`shouldOfferHappening`, `happeningOfferedThisTurn`, `advanceAfterCommit`, `startTurn`)
- Modify: `src/engine/responders/affinity.ts` (remove `chaos-happening-interrupt`)
- Modify: `src/engine/events/scenarios.ts` (remove the `chaos-happening-interrupt` scenario)
- Modify: `src/engine/__tests__/AffinityResponders.test.ts` (remove the two interrupt tests)
- Modify: `src/engine/__tests__/Happenings.test.ts` (cadence tests)

**Interfaces:**
- Consumes: `HAPPENING_GAP_CHANCE` (Task 3), `this.minigamesPerTurn`, `triggerHappening()`.
- Produces: `GameEngine.shouldOfferHappening(completed: number): boolean` (private); `private happeningOfferedThisTurn: boolean`. Removes the `interruptHappening` draft field usage and the `minigame:end` dispatch.

- [ ] **Step 1: Write the failing cadence tests**

Add to `src/engine/__tests__/Happenings.test.ts`:

```ts
describe('happening cadence (decoupled from Chaos)', () => {
  // Helper: play one non-happening reading to completion, draining any event batch.
  function playOneReading(engine: GameEngine) {
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    // Cadence cares only about the completed-reading count, so commit a real d20
    // result regardless of the selected method (avoids per-method draw shapes).
    const result = (engine as unknown as { orchestrator: { drawSingleResult: (t: string, a: object) => import('../types').SlotResult } })
      .orchestrator.drawSingleResult('d20', engine.getState().affinities);
    engine.completeMinigame(result);
    if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
    if (engine.getState().awaitingContinue) engine.continueAfterReview();
  }

  it('offers a happening exactly once per turn, never after the final reading', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random;
    Math.random = () => 0.99; // suppress the early-gap chance so it lands on the guaranteed last gap
    try {
      playOneReading(engine);                       // after reading 1 (early gap, chance suppressed)
      expect(engine.getState().screen).not.toBe('happening');
      playOneReading(engine);                       // after reading 2 (last eligible gap → guaranteed)
      expect(engine.getState().screen).toBe('happening');
    } finally {
      Math.random = orig;
    }
  });

  it('does not offer a second happening in the same turn', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random;
    Math.random = () => 0; // fire at the first eligible gap
    try {
      playOneReading(engine);
      expect(engine.getState().screen).toBe('happening');
      engine.resolveHappening(0);                   // back to method-select
      playOneReading(engine);                       // second gap — must NOT offer again
      expect(engine.getState().screen).not.toBe('happening');
    } finally {
      Math.random = orig;
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts -t "cadence"`
Expected: FAIL — happenings still gate on `chaos-happening-interrupt` (Chaos at baseline never fires it), so no happening is offered.

- [ ] **Step 3: Implement the cadence in `GameEngine.ts`**

Add the field near the other private turn state:

```ts
  private happeningOfferedThisTurn = false;
```

Add the predicate (place near `triggerHappening`):

```ts
  // Decoupled cadence: at most one happening per turn, in a between-reading gap,
  // never after the final reading (so its granted effect has a reading to land on).
  // Placement varies (HAPPENING_GAP_CHANCE) but is guaranteed by the last eligible gap.
  private shouldOfferHappening(completed: number): boolean {
    if (this.happeningOfferedThisTurn) return false;
    const remaining = this.minigamesPerTurn - completed;
    if (remaining <= 0) return false;           // no reading left for the effect to land on
    if (remaining === 1) return true;           // last eligible gap → guarantee once/turn
    return Math.random() < HAPPENING_GAP_CHANCE; // earlier gap → chance
  }
```

Import `HAPPENING_GAP_CHANCE` from `../data/happenings` (add to the existing `selectHappening` import line).

In `advanceAfterCommit()`, replace **only** the `minigame:end` dispatch + `interruptHappening` block — i.e. from `const { draft: endDraft } = this.dispatchAt('minigame:end', …)` through the `if (endDraft.interruptHappening === true) { … return; }` — with the snippet below. **Leave the existing `this.orchestrator.removeUsedMethod(...)` line directly above it untouched** (do not duplicate it), and leave the `analyzeGaps`/`getBiasForRefill`/`buildPool` fall-through below it untouched:

```ts
    // Between-minigame transition. Decoupled cadence decides whether a happening interrupts.
    if (this.shouldOfferHappening(completed)) {
      this.happeningOfferedThisTurn = true;
      this.runOrDefer(() => this.triggerHappening());
      return;
    }
```

In `startTurn()`, reset the flag (next to `this.state.pendingReadingEffects = [];`):

```ts
    this.happeningOfferedThisTurn = false;
```

- [ ] **Step 4: Remove `chaos-happening-interrupt`**

In `src/engine/responders/affinity.ts`, delete the entire `chaos-happening-interrupt` responder object (the `{ id: 'chaos-happening-interrupt', … }` block).

In `src/engine/events/scenarios.ts`, delete the `chaos-happening-interrupt` scenario entry (the `{ id: 'chaos-happening-interrupt', … }` line/object).

In `src/engine/__tests__/AffinityResponders.test.ts`, delete the two tests:
`'chaos-happening-interrupt sets interruptHappening when not the last reading'` and
`'chaos-happening-interrupt does not fire on the last reading (condition guard)'`.
If removing them leaves an unused import (e.g. a helper only those tests used), remove the dangling import so `tsc` stays clean.

- [ ] **Step 5: Run to verify green**

Run: `npx vitest run src/engine/__tests__/Happenings.test.ts src/engine/__tests__/AffinityResponders.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS — full suite green. If a `GameEngine.test.ts` integration test relied on the old `chaos-happening-interrupt` to surface a happening, update it to the new cadence (drive two readings; the happening appears at the guaranteed last gap). Recompute nothing numeric — this is control-flow only.
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/responders/affinity.ts src/engine/events/scenarios.ts src/engine/__tests__/AffinityResponders.test.ts src/engine/__tests__/Happenings.test.ts
git commit -m "feat(happenings): decoupled once-per-turn cadence; retire chaos-happening-interrupt"
```

---

### Task 7: `HappeningScene` UI — fiction-telegraphed category cue

Surface the new effect richness without numbers: each choice shows its text plus a subtle, italic, fiction-only cue (cost → "a price will be paid", upheaval → "the weave may tear", gamble → "fortune decides") derived by `choiceCue`. Engine-test-free (no component tests in this repo) — verified by `tsc`/`build` and an optional manual probe.

**Files:**
- Modify: `src/components/screens/HappeningScene.tsx`

**Interfaces:**
- Consumes: `choiceCue` (Task 3); `state.happening.choices[i].effects` (Task 2). No new engine symbols.

- [ ] **Step 1: Render the cue under each choice**

In `src/components/screens/HappeningScene.tsx`:

Add the import:

```ts
import { choiceCue } from '../../data/happenings';
```

Add the cue copy map near the styles:

```ts
const CUE_TEXT: Record<'price' | 'tear' | 'fortune', string> = {
  price: 'a price will be paid',
  tear: 'the weave may tear',
  fortune: 'fortune decides',
};
```

Inside the `happening.choices.map((choice, i) => …)` button, replace the single `<span style={choiceTextStyle}>{choice.text}</span>` with a column that adds the cue when present:

```tsx
                <span style={choiceInnerStyle}>
                  <span style={choiceTextStyle}>{choice.text}</span>
                  {choiceCue(choice.effects) && (
                    <span style={cueStyle}>{CUE_TEXT[choiceCue(choice.effects)!]}</span>
                  )}
                </span>
```

Add the two styles to the styles block:

```ts
const choiceInnerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
};

const cueStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontStyle: 'italic',
  fontSize: 'clamp(0.7rem, 1.5vw, 0.85rem)',
  color: '#5a6b8c',
  letterSpacing: '0.08em',
  opacity: 0.85,
};
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc -b`
Expected: no type errors.
Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 3: (Optional) Manual probe**

If a browser is available: `npm run dev`, open with `?debug`, drive a turn to a happening (or inject a happening via the JSON injector per the repo memory note), and confirm a choice carrying a cost/gamble/upheaval shows the italic cue beneath its text and shifts/surges still resolve on click. Not required to pass the task; the build gate is the hard gate.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/HappeningScene.tsx
git commit -m "feat(happenings): render fiction-telegraphed category cue in HappeningScene"
```

---

### Task 8: Documentation sync + debug scenario + full verification

Finish the CLAUDE.md-required doc sync and run the complete verification gate.

**Files:**
- Modify: `docs/game-systems.md` (§6 interactions table, §7 happenings rewrite, §2 surge/feeds cross-reference, source-of-truth table)
- Modify: `README.md` (happenings section)
- Modify: `src/engine/events/scenarios.ts` (add a happening-effect demo scenario)

**Interfaces:** none (documentation + demo + verification only).

- [ ] **Step 1: Update `docs/game-systems.md`**

- **§7 Happenings:** rewrite the opening to describe the new model: choices are `{ text, effects[] }` carrying `shift` (permanent), `surge` (decaying spike, Phase 1), `reading` (queued `pendingReadingEffects` consumed by the next reading), `cost` (drain), `gamble` (weighted branch), and `upheaval` (Phase 3, data-stubbed/no-op in Phase 2). Document the **decoupled cadence** ("offered at most once per turn, in a between-reading gap, never after the final reading; placement varies via `HAPPENING_GAP_CHANCE`, guaranteed by the last eligible gap") replacing the old Chaos-gated text, and **dominant-axis selection** (`selectHappening` weights scenes whose `axes` include the player's widest polar pair by `AXIS_WEIGHT_BONUS`). Add the `ReadingEffectId` → existing-vocabulary mapping table (widen-pool→poolTarget, guarantee/deny-peek→peek gate, grant-reroll→offer-reroll, spawn-second→spawnSecond, shroud-card→shroud).
- **§6 interactions:** remove the `chaos-happening-interrupt` row from the responder table; note that `iching-happening-boost` (changing-lines hidden bonus choice) is **preserved** and still fires at `happening:start`.
- **§2:** add a one-line cross-reference that happenings now grant surges via `GameEngine.grantSurge` (Phase 1 layer).
- **Source-of-truth table:** ensure `src/data/happenings.ts` row mentions "effect model, dominant-axis selection, cadence tuning" and `GameEngine.ts` row mentions "happening effect resolution + pendingReadingEffects consumption + cadence".

- [ ] **Step 2: Update `README.md`**

Locate the README happenings section and update it to the new model (choices carry multiple effects incl. surges/costs/gambles/reading-effects; once-per-turn cadence; axis-weighted selection). If the README only describes happenings at a high level with no mechanics detail, add a short paragraph and note in the commit body what was/wasn't present.

- [ ] **Step 3: Add a happening-effect debug scenario**

In `src/engine/events/scenarios.ts`, add a scenario that stages a happening screen carrying a surge+cost choice so the panel can demo the new resolution. Follow the existing `iching-happening-boost` staging pattern (`s.screen = 'happening'`), e.g.:

```ts
  { id: 'happening-surge-cost', label: 'Happening: surge + cost choice', group: 'Happening', forced: [], isolate: false,
    setup: (s) => {
      s.screen = 'happening';
      s.happening = {
        type: 'happening', id: 'falling-star',
        scene: 'A star tears across the sky, brilliant and brief.',
        choices: [
          { text: 'Make a wish upon the falling light.', effects: [{ kind: 'surge', deltas: { chaos: 30 }, readings: 3 }, { kind: 'cost', affinity: 'order', amount: 10 }] },
          { text: 'Look away; let it pass.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
        ],
        tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
      };
    } },
```

(Match the actual `DEBUG_SCENARIOS` entry shape and imports in the file; if the `group` union is closed, reuse an existing group such as `'Interaction'` rather than adding `'Happening'`.)

- [ ] **Step 4: Full verification gate**

Run: `npm test`
Expected: PASS — entire engine suite green.
Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 5: Spec-coverage self-check (record the mapping in the commit body)**

Confirm each Phase 2 spec (§6) item maps to a task: data model §6.1 (T2) · reading effects §6.2 (T2 type + T5 consumption) · reworked happenings §6.3 (T3) · cadence + dominant-axis selection §6.4, changing-lines bonus preserved (T6 cadence + T3 selection; `iching-happening-boost` untouched) · UI/narration §6.5 (T7) · docs §10 (T8). Note explicitly that **upheaval resolution (§7/Phase 3), the emergent-at-extreme trigger, and the Seed of Corruption (§8/Phase 4) are out of scope** and only the `upheaval` data kind is stubbed here.

- [ ] **Step 6: Commit**

```bash
git add docs/game-systems.md README.md src/engine/events/scenarios.ts
git commit -m "docs(happenings): sync game-systems + README + debug scenario for Phase 2"
```

---

## Out of scope (later phases — do NOT build here)

- **Phase 3 — Upheavals:** the `transform` modifier in the unified `AffinityModifier` list, applied to **effective** values after surges with a hard cliff/snap-back; the opt-in happening `upheaval` *resolution* (Phase 2 only stubs the data kind and no-ops it); the **emergent** responder (effective affinity ≈95+ and no active upheaval → small per-reading chance) and its "no active upheaval" guard; upheaval narration (`animation: 'upheaval'`) and inverted-reality hints.
- **Phase 4 — Seed of Corruption:** a counter to all six affinities plugging into the same modifier list. Not designed; the base/effective split and modifier list leave room.

## Open tuning questions (playtest, not blocking — spec §11)

- Surge magnitude (+20…+35) and lifetime (~3 readings) per happening.
- Fortune tag-feed cap (~+8/turn, Phase 1) and `HAPPENING_GAP_CHANCE` (0.5) / once-per-turn floor.
- `AXIS_WEIGHT_BONUS` (selection bias strength).
- Which happenings carry costs/gambles/upheavals vs. safe shifts.
