# Affinity Overhaul — Phase 3 (Upheavals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add **upheavals** — temporary `transform` modifiers (`invert-pair`, `invert-all`, `scramble`) that bend the **effective** affinity values for a fixed number of readings and then **snap back** (a cliff, not a decay) — on top of Phase 1's unified modifier list, fired by **opt-in** happening choices and **emergent** at extremes, narrated through the existing report→sequencer pipeline.

**Architecture:** Phase 1 built the modifier list with `kind: 'surge' | 'transform'` reserved; Phase 2 added the `upheaval` `HappeningEffect` kind as a **no-op data stub**. Phase 3 makes transforms real: a new `AffinityTransformModifier` joins the union; `AffinityEngine` computes one **effective vector** (`base + Σ surges`, then transforms applied **in list order**) so every `getState`/`bandOf`/`getEffects`/hint consumer inverts automatically; `grantUpheaval` pushes a transform (precomputing the `scramble` permutation once so reads are stable); `tickModifiers` already expires it as a cliff. The **opt-in** trigger wires `applyHappeningEffect`'s `upheaval` case to `grantUpheaval` (silent, like a surge — the drama is the inverted reality + the Phase 2 "the weave may tear" cue). The **emergent** trigger is an `emergent-upheaval` responder at `*:commit` whose condition is "an *effective* affinity ≥ `EMERGENT_THRESHOLD` **and** no active upheaval"; it sets a `requestUpheaval` draft flag (the `spawnSecond` pattern) and returns an `animation: 'upheaval'` report, while the GameEngine applies the grant **after** `tickModifiers` so opt-in and emergent share one lifetime. The **base-untouched invariant** holds because `shift()` only ever writes `base`; transforms bend only what `eff()` returns.

**Tech Stack:** TypeScript (strict; `noUnusedLocals`/`noUnusedParameters` on), Vitest (engine tests only, Node env, `Math.random` stubbed for randomness), React 18 + framer-motion for the one narration task. No ESLint/Prettier — `tsc -b` enforces types.

## Global Constraints

- Engine stays framework-free: **zero React/DOM imports** in `src/engine/**` and `src/data/**`.
- Every `GameEngine` mutator that changes visible state ends with `notify()`.
- Affinity values are integers clamped **0–100** via the engine's `clamp` (`Math.round`).
- **Effective = `clamp(base + Σ surge deltas)`, then transform modifiers applied in list order** (spec §5.2). Transforms operate on the post-surge **effective vector**, never on `base`.
- **Base-untouched invariant:** `shift()` writes `base` only, even during an active upheaval. `getBase()` is never transformed. (spec §7.2)
- **Cliff expiry:** a transform is full-strength every reading until it expires, then values **snap back** — no step-down decay (contrast surges). (spec §7.1)
- **`scramble` permutation is fixed at modifier creation** and stored on the modifier, so repeated `eff()` reads within a reading are stable and deterministic.
- **Emergent guard:** the emergent condition requires **no active upheaval** (prevents flapping) and an *effective* affinity at/above `EMERGENT_THRESHOLD`; the per-reading chance is `EMERGENT_CHANCE` (rare). (spec §7.3)
- **"Never show raw numbers"** holds in the UI: upheaval narration is fiction/animation only.
- Tuning values here are **starting playtest numbers** (spec §11); keep them in named constants in `src/data/affinities.ts` so they stay tunable.
- **Docs in sync (CLAUDE.md rule):** `docs/game-systems.md` (new Upheavals section, §2 effective/transform note, §3 bands-read-effective note, §6 responder table, source-of-truth table) and the README MUST be updated to match (Task 6) before this phase is complete.
- Run a single test file: `npx vitest run <path>`. Run all engine tests: `npm test`. Typecheck: `npx tsc -b`. Full gate: `npm run build`.
- **Phase boundary:** the **Seed of Corruption** (Phase 4 — a counter to all six affinities) is **out of scope**. The modifier list and base/effective split already leave room; do not build it here.

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/engine/types.ts` | Shared engine types | **Modify** (Task 1) — add `AffinityTransformModifier`; widen `AffinityModifier` union |
| `src/data/affinities.ts` | Affinity data + tuning + axis helpers | **Modify** (Task 1) — `AXIS_AFFINITIES`, `axisOf`, `EMERGENT_*` tuning constants |
| `src/engine/AffinityEngine.ts` | Affinity state, modifier list | **Modify** (Tasks 1–2) — kind-aware `getModifiers`; `effectiveVector`/`applyTransform`; `grantUpheaval`; `hasActiveTransform` |
| `src/engine/GameEngine.ts` | Façade; resolution; triggers | **Modify** (Tasks 3–4) — opt-in `applyHappeningEffect`; public `grantUpheaval`; emergent seed/store/apply + `pendingEmergentUpheaval` |
| `src/engine/responders/affinity.ts` | Affinity responders | **Modify** (Task 4) — `emergent-upheaval` responder |
| `src/components/overlays/anim/theme.ts` | Animation primitive mapping | **Modify** (Task 5) — map `'upheaval'`; add an Upheaval theme |
| `src/engine/__tests__/AffinityUpheaval.test.ts` | Transform math + invariant + expiry | **Create** (Tasks 1–2) |
| `src/engine/__tests__/Upheaval.test.ts` | Opt-in + emergent integration | **Create** (Tasks 3–4) |
| `src/engine/__tests__/AffinityResponders.test.ts` | Affinity responder unit tests | **Modify** (Task 4) — `emergent-upheaval` unit tests |
| `src/engine/events/scenarios.ts` | Debug scenarios | **Modify** (Task 6) — upheaval demo |
| `docs/game-systems.md`, `README.md` | Hand-maintained references | **Modify** (Task 6) |

---

### Task 1: Transform type model + axis/tuning helpers

Pure scaffolding the rest of Phase 3 builds on: the `transform` modifier type joins the union, the axis↔pair helpers and the emergent tuning constants land, and `getModifiers` becomes kind-aware so the widened union still compiles. No transform *behavior* yet (that is Task 2) — `eff()` still only reads surges, so the full suite stays green.

**Files:**
- Modify: `src/engine/types.ts` (add `AffinityTransformModifier`; widen `AffinityModifier`)
- Modify: `src/data/affinities.ts` (`AXIS_AFFINITIES`, `axisOf`, `EMERGENT_*`)
- Modify: `src/engine/AffinityEngine.ts` (`getModifiers` kind-aware)
- Create: `src/engine/__tests__/AffinityUpheaval.test.ts` (axis-helper tests)

**Interfaces:**
- Consumes: `AffinityId`, `AffinityAxis` (existing in `types.ts`); `AFFINITY_IDS` (existing).
- Produces:
  - `AffinityTransformModifier`, widened `AffinityModifier = AffinitySurgeModifier | AffinityTransformModifier`.
  - `AXIS_AFFINITIES: Record<AffinityAxis, [AffinityId, AffinityId]>`, `axisOf(id: AffinityId): AffinityAxis`.
  - `EMERGENT_THRESHOLD`, `EMERGENT_CHANCE`, `EMERGENT_READINGS` constants.

- [ ] **Step 1: Write the failing axis-helper test**

Create `src/engine/__tests__/AffinityUpheaval.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AXIS_AFFINITIES, axisOf } from '../../data/affinities';

describe('axis helpers', () => {
  it('AXIS_AFFINITIES maps each axis to its polar pair', () => {
    expect(AXIS_AFFINITIES.agency).toEqual(['fate', 'will']);
    expect(AXIS_AFFINITIES.information).toEqual(['light', 'shadow']);
    expect(AXIS_AFFINITIES.fortune).toEqual(['chaos', 'order']);
  });

  it('axisOf returns the axis each affinity belongs to', () => {
    expect(axisOf('fate')).toBe('agency');
    expect(axisOf('will')).toBe('agency');
    expect(axisOf('light')).toBe('information');
    expect(axisOf('shadow')).toBe('information');
    expect(axisOf('chaos')).toBe('fortune');
    expect(axisOf('order')).toBe('fortune');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityUpheaval.test.ts`
Expected: FAIL — `AXIS_AFFINITIES` / `axisOf` are not exported from `../../data/affinities`.

- [ ] **Step 3: Add the transform modifier type**

In `src/engine/types.ts`, directly after the `AffinitySurgeModifier` interface and the `AffinityModifier` alias (currently `export type AffinityModifier = AffinitySurgeModifier;`), replace that alias block with:

```ts
// Phase 3: a transform upheaval modifier — bends EFFECTIVE values (after surges)
// for a fixed number of readings, then expires as a cliff. `scramble` stores its
// permutation, fixed at creation, so repeated effective reads stay stable.
export interface AffinityTransformModifier {
  id: string;
  kind: 'transform';
  transform: 'invert-pair' | 'invert-all' | 'scramble';
  axis?: AffinityAxis;                                  // required for 'invert-pair'
  permutation?: Record<AffinityId, AffinityId>;         // 'scramble' only: result[id] = preVector[permutation[id]]
  readingsRemaining: number;
  initialReadings: number;
  source: string;                                       // e.g. 'happening:falling-star' / 'emergent:chaos'
}

export type AffinityModifier = AffinitySurgeModifier | AffinityTransformModifier;
```

(`AffinityAxis` is declared lower in this same module at `export type AffinityAxis = …`; TypeScript hoists type declarations within a module, so the forward reference compiles.)

- [ ] **Step 4: Add the axis helpers + tuning constants**

In `src/data/affinities.ts`, change the top import to also pull `AffinityAxis`:

```ts
import type { AffinityId, AffinityBand, AffinityAction, AffinityAxis } from '../engine/types';
```

Then, directly below the existing `AFFINITY_PAIRS` constant, add:

```ts
// Which polar pair each axis owns (selection + transform target).
export const AXIS_AFFINITIES: Record<AffinityAxis, [AffinityId, AffinityId]> = {
  agency: ['fate', 'will'],
  information: ['light', 'shadow'],
  fortune: ['chaos', 'order'],
};

// Which axis a single affinity belongs to.
export function axisOf(id: AffinityId): AffinityAxis {
  if (id === 'fate' || id === 'will') return 'agency';
  if (id === 'light' || id === 'shadow') return 'information';
  return 'fortune';
}
```

And in the `// ── Pipeline tuning (playtest defaults) ──` block (near `RUN_DRIFT`, `FORTUNE_TAG_CAP`), add:

```ts
// ── Upheaval tuning (Phase 3; playtest defaults) ──
export const EMERGENT_THRESHOLD = 95;  // effective affinity at/above which reality may flip
export const EMERGENT_CHANCE = 0.04;   // per-reading roll once at the extreme (rare)
export const EMERGENT_READINGS = 2;    // readings an emergent upheaval stays active
```

- [ ] **Step 5: Make `getModifiers` kind-aware**

In `src/engine/AffinityEngine.ts`, the current `getModifiers` does `{ ...m, deltas: { ...m.deltas } }`, which no longer type-checks because `deltas` exists only on the surge variant. Replace the method body:

```ts
  getModifiers(): AffinityModifier[] {
    return this.modifiers.map((m) =>
      m.kind === 'surge'
        ? { ...m, deltas: { ...m.deltas } }
        : { ...m, permutation: m.permutation ? { ...m.permutation } : undefined },
    );
  }
```

- [ ] **Step 6: Run to verify green**

Run: `npx vitest run src/engine/__tests__/AffinityUpheaval.test.ts`
Expected: PASS (axis helpers).
Run: `npm test`
Expected: PASS — no behavior changed; `eff()` still reads only surges (transform modifiers cannot exist yet — nothing grants them until Task 2).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/data/affinities.ts src/engine/AffinityEngine.ts src/engine/__tests__/AffinityUpheaval.test.ts
git commit -m "feat(upheaval): add transform modifier type + axis helpers + emergent tuning"
```

---

### Task 2: Transform application — `effectiveVector`, `grantUpheaval`, cliff expiry

The core engine mechanic. `eff()` is refactored to delegate to a single `effectiveVector()` that builds `base + Σ surges` for all six ids, then applies each `transform` modifier **in list order**. `grantUpheaval` pushes a transform (precomputing the `scramble` permutation). `hasActiveTransform` reports whether any transform is live. `tickModifiers` already expires modifiers by `readingsRemaining`, which makes transforms a **cliff** automatically (full-strength until filtered out).

**Files:**
- Modify: `src/engine/AffinityEngine.ts` (`eff`→`effectiveVector`, `applyTransform`, `grantUpheaval`, `hasActiveTransform`, `makeScramblePermutation`)
- Modify: `src/engine/__tests__/AffinityUpheaval.test.ts` (transform math + invariant + expiry)

**Interfaces:**
- Consumes: `AffinityModifier` (Task 1), `AXIS_AFFINITIES`, `AFFINITY_IDS`, `TransformPayload` (existing in `types.ts`).
- Produces:
  - `AffinityEngine.grantUpheaval(payload: TransformPayload, readings: number, source: string): void`
  - `AffinityEngine.hasActiveTransform(): boolean`
  - `effectiveVector()` / `applyTransform()` / `makeScramblePermutation()` (private). `eff(id)` now reflects transforms.

- [ ] **Step 1: Write the failing transform tests**

Add to `src/engine/__tests__/AffinityUpheaval.test.ts`. Put the imports at the top of the file with the existing import, then add the new `describe` block:

```ts
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const makeEngine = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('AffinityEngine transforms (upheavals)', () => {
  it('invert-pair flips both poles of one axis on EFFECTIVE, leaving others and base untouched', () => {
    const e = makeEngine();
    e.setState({ chaos: 90, order: 20, fate: 70 });
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 2, 'test');
    const eff = e.getState();
    expect(eff.chaos).toBe(10);   // 100 - 90
    expect(eff.order).toBe(80);   // 100 - 20
    expect(eff.fate).toBe(70);    // other axis untouched
    // base is never transformed
    expect(e.getBase().chaos).toBe(90);
    expect(e.getBase().order).toBe(20);
  });

  it('invert-all flips every affinity on EFFECTIVE', () => {
    const e = makeEngine();
    e.setState({ chaos: 80, order: 30, fate: 60, will: 40, light: 70, shadow: 10 });
    e.grantUpheaval({ transform: 'invert-all' }, 2, 'test');
    const eff = e.getState();
    expect(eff).toEqual({ chaos: 20, order: 70, fate: 40, will: 60, light: 30, shadow: 90 });
    expect(e.getBase().chaos).toBe(80); // base intact
  });

  it('scramble fixes its permutation at creation: repeated reads are identical and value-preserving', () => {
    const e = makeEngine();
    e.setState({ chaos: 10, order: 20, fate: 30, will: 40, light: 50, shadow: 60 });
    const orig = Math.random; Math.random = () => 0.42; // deterministic shuffle
    try {
      e.grantUpheaval({ transform: 'scramble' }, 2, 'test');
    } finally { Math.random = orig; }
    const a = e.getState();
    const b = e.getState();
    expect(a).toEqual(b); // stable across reads (permutation NOT re-rolled per eff)
    // a permutation preserves the multiset of base values
    expect(Object.values(a).sort((x, y) => x - y)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(e.getBase().light).toBe(50); // base intact
  });

  it('surge then transform compose: surge applies first, transform bends the surged value', () => {
    const e = makeEngine();
    // base chaos 50, surge +30 → effective-pre-transform 80, then invert → 20
    e.grantSurge({ chaos: 30 }, 3, 'surge');
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 2, 'up');
    expect(e.getState().chaos).toBe(20);
  });

  it('cliff expiry: full-strength every reading, then snaps back (no step-down)', () => {
    const e = makeEngine();
    e.setState({ chaos: 90, order: 20 });
    e.grantUpheaval({ transform: 'invert-pair', axis: 'fortune' }, 2, 'test');
    expect(e.getState().chaos).toBe(10);  // reading 1: full invert
    e.tickModifiers();
    expect(e.getState().chaos).toBe(10);  // reading 2: STILL full invert (cliff, not decayed)
    e.tickModifiers();
    expect(e.getState().chaos).toBe(90);  // expired → snaps back to base
  });

  it('hasActiveTransform reflects whether any transform is live', () => {
    const e = makeEngine();
    expect(e.hasActiveTransform()).toBe(false);
    e.grantUpheaval({ transform: 'invert-all' }, 1, 'test');
    expect(e.hasActiveTransform()).toBe(true);
    e.tickModifiers();
    expect(e.hasActiveTransform()).toBe(false);
  });
});
```

> **Note for the implementer:** `AFFINITY_DEFINITIONS` is the array of all six `AffinityDefinition`s the `AffinityEngine` constructor takes (the same one the existing `AffinitySurge.test.ts` / `AffinityShift.test.ts` helpers use — mirror their `const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);` pattern).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityUpheaval.test.ts -t "transforms"`
Expected: FAIL — `grantUpheaval` / `hasActiveTransform` are not defined; `getState()` does not yet apply transforms.

- [ ] **Step 3: Refactor `eff` into `effectiveVector` + `applyTransform`**

In `src/engine/AffinityEngine.ts`, add `AXIS_AFFINITIES` to the existing import from `../data/affinities`:

```ts
import {
  AFFINITY_IDS,
  AFFINITY_PAIRS,
  AXIS_AFFINITIES,
  // …existing imports…
} from '../data/affinities';
```

Also add `TransformPayload` to the type import at the top:

```ts
import type { AffinityId, AffinityBand, AffinityAction, AffinityEffects, Taggable, AffinityMandate, AffinityModifier, TransformPayload } from './types';
```

Replace the existing `private eff(id)` method with the vector-based implementation below (keep its position):

```ts
  // The full effective vector: base + Σ active surge contributions (step-down
  // decayed), then transform modifiers applied IN LIST ORDER (upheaval layer).
  private effectiveVector(): Record<AffinityId, number> {
    const v = {} as Record<AffinityId, number>;
    for (const id of AFFINITY_IDS) {
      let x = this.base[id];
      for (const m of this.modifiers) {
        if (m.kind === 'surge') {
          const factor = m.readingsRemaining / m.initialReadings;
          x += (m.deltas[id] ?? 0) * factor;
        }
      }
      v[id] = this.clamp(x);
    }
    for (const m of this.modifiers) {
      if (m.kind === 'transform') this.applyTransform(v, m);
    }
    return v;
  }

  // Bends the effective vector in place. invert-pair flips one axis's two poles;
  // invert-all flips all six; scramble redistributes by the modifier's fixed permutation.
  private applyTransform(v: Record<AffinityId, number>, m: Extract<AffinityModifier, { kind: 'transform' }>): void {
    if (m.transform === 'invert-all') {
      for (const id of AFFINITY_IDS) v[id] = this.clamp(100 - v[id]);
      return;
    }
    if (m.transform === 'invert-pair') {
      const pair = AXIS_AFFINITIES[m.axis ?? 'fortune'];
      for (const id of pair) v[id] = this.clamp(100 - v[id]);
      return;
    }
    // scramble: result[id] = pre-scramble[ permutation[id] ]
    if (m.permutation) {
      const src = { ...v };
      for (const id of AFFINITY_IDS) v[id] = src[m.permutation[id]];
    }
  }

  // Effective value for one id (delegates to the shared vector).
  private eff(id: AffinityId): number {
    return this.effectiveVector()[id];
  }
```

Then update `getState()` to build the vector once (instead of six `eff()` calls):

```ts
  getState(): Record<AffinityId, number> {
    return this.effectiveVector();
  }
```

- [ ] **Step 4: Add `grantUpheaval`, `hasActiveTransform`, `makeScramblePermutation`**

In `src/engine/AffinityEngine.ts`, directly below `grantSurge`, add:

```ts
  // ── Upheaval (transform) layer ──
  grantUpheaval(payload: TransformPayload, readings: number, source: string): void {
    if (readings <= 0) return;
    const mod: Extract<AffinityModifier, { kind: 'transform' }> = {
      id: `transform:${source}:${this.modSeq++}`,
      kind: 'transform',
      transform: payload.transform,
      axis: payload.axis,
      readingsRemaining: readings,
      initialReadings: readings,
      source,
    };
    if (payload.transform === 'scramble') mod.permutation = this.makeScramblePermutation();
    this.modifiers.push(mod);
  }

  hasActiveTransform(): boolean {
    return this.modifiers.some((m) => m.kind === 'transform');
  }

  // Fisher–Yates over the six ids → a fixed mapping result-id → source-id.
  private makeScramblePermutation(): Record<AffinityId, AffinityId> {
    const sources = [...AFFINITY_IDS];
    for (let i = sources.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sources[i], sources[j]] = [sources[j], sources[i]];
    }
    const perm = {} as Record<AffinityId, AffinityId>;
    AFFINITY_IDS.forEach((id, i) => { perm[id] = sources[i]; });
    return perm;
  }
```

- [ ] **Step 5: Run to verify green**

Run: `npx vitest run src/engine/__tests__/AffinityUpheaval.test.ts`
Expected: PASS (axis helpers + transforms).
Run: `npm test`
Expected: PASS — surge math, bands, hints, peek all still pass (no transform exists in those flows; `effectiveVector` is identical to the old `eff` when no transform modifiers are present).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinityUpheaval.test.ts
git commit -m "feat(upheaval): apply transforms to effective values (invert-pair/all/scramble) with cliff expiry"
```

---

### Task 3: Opt-in trigger — wire the happening `upheaval` effect

Replace the Phase 2 no-op stub in `applyHappeningEffect` so an `upheaval` happening effect grants a transform. Resolution is **silent** (consistent with how `surge`/`cost` resolve in Phase 2 — no per-effect sequencer report during `resolveHappening`); the upheaval surfaces as inverted reality on the next readings, telegraphed by the Phase 2 "the weave may tear" choice cue. Also expose a **public** `GameEngine.grantUpheaval` passthrough (mirrors `grantSurge`) for tests and the Task 6 debug scenario.

**Files:**
- Modify: `src/engine/GameEngine.ts` (`applyHappeningEffect` upheaval case; public `grantUpheaval`)
- Create: `src/engine/__tests__/Upheaval.test.ts` (opt-in resolution tests)

**Interfaces:**
- Consumes: `AffinityEngine.grantUpheaval` (Task 2); `HappeningEffect` upheaval variant (`{ transform: TransformPayload; readings: number }`).
- Produces: `GameEngine.grantUpheaval(transform: TransformPayload, readings: number, source: string): void` (public, notifies). `applyHappeningEffect` now resolves `upheaval`.

- [ ] **Step 1: Write the failing opt-in tests**

Create `src/engine/__tests__/Upheaval.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { HappeningEffect, HappeningResult } from '../types';

// Inject a one-choice happening of the given effects, then resolve it.
function resolveWith(engine: GameEngine, effects: HappeningEffect[]) {
  const happening: HappeningResult = {
    type: 'happening', id: 'test-happening', scene: 's',
    choices: [{ text: 'c', effects }],
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
  };
  engine.loadState({ screen: 'happening', happening });
  engine.resolveHappening(0);
}

describe('opt-in upheaval (happening effect)', () => {
  it('an upheaval choice inverts EFFECTIVE values without touching base', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { chaos: 90, order: 20, fate: 50, will: 50, light: 50, shadow: 50 } });
    resolveWith(engine, [{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }]);
    const s = engine.getState();
    expect(s.affinities.chaos).toBe(10);     // 100 - 90 (effective inverted)
    expect(s.affinities.order).toBe(80);     // 100 - 20
    expect(s.affinityBase.chaos).toBe(90);   // base untouched
    expect(s.affinityBase.order).toBe(20);
  });

  it('public grantUpheaval applies a transform and surfaces it on the snapshot', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { chaos: 50, order: 50, fate: 88, will: 12, light: 50, shadow: 50 } });
    engine.grantUpheaval({ transform: 'invert-pair', axis: 'agency' }, 2, 'test');
    expect(engine.getState().affinities.fate).toBe(12); // 100 - 88
    expect(engine.getState().affinityBase.fate).toBe(88);
  });
});
```

> **Note for the implementer:** `loadState({ affinities })` routes through `setState`, which writes **base** (so with no transform yet, effective == base). The assertions check that after the upheaval, `affinities` (effective) inverts while `affinityBase` stays at the values you set. If `loadState`'s affinity staging differs in this codebase, match the existing `GameEngine` test helpers — the behavioral assertions (effective inverted, base intact) are what matter.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/Upheaval.test.ts -t "opt-in"`
Expected: FAIL — the `upheaval` case is a no-op (effective not inverted); `grantUpheaval` is not a public method on `GameEngine`.

- [ ] **Step 3: Wire the opt-in case + public passthrough**

In `src/engine/GameEngine.ts`, in `applyHappeningEffect`, replace the `upheaval` case body:

```ts
      case 'upheaval':
        this.affinityEngine.grantUpheaval(effect.transform, effect.readings, source);
        break;
```

Confirm `TransformPayload` is available to the file: it is re-exported through `./types`. If `grantUpheaval`'s signature needs the type named in `GameEngine.ts`, add `TransformPayload` to the existing `import type { … } from './types';` line.

Add the public passthrough directly below the existing `grantSurge` method:

```ts
  // Public entry point for granting an upheaval (transform) modifier. The Task 6
  // debug scenario and tests call this; it notifies so the inverted effective
  // values surface on the snapshot.
  grantUpheaval(transform: TransformPayload, readings: number, source: string): void {
    this.affinityEngine.grantUpheaval(transform, readings, source);
    this.notify();
  }
```

- [ ] **Step 4: Run to verify green**

Run: `npx vitest run src/engine/__tests__/Upheaval.test.ts`
Expected: PASS (opt-in block).
Run: `npm test`
Expected: PASS — full suite green (the Phase 2 `many-threads` happening's existing `upheaval` choice now resolves to a real transform instead of a no-op; no test asserted the old no-op, so nothing breaks).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/Upheaval.test.ts
git commit -m "feat(upheaval): opt-in happening upheaval grants a transform (silent resolution) + public grantUpheaval"
```

---

### Task 4: Emergent trigger — `emergent-upheaval` responder + deferred grant

Lean too hard into one pole and reality flips. An `emergent-upheaval` responder fires at `*:commit` when an **effective** affinity is at the extreme (`≥ EMERGENT_THRESHOLD`) **and no upheaval is active**, rolling `EMERGENT_CHANCE`. Following the `spawnSecond` pattern, it sets a `requestUpheaval` draft flag and returns an `animation: 'upheaval'` report (which the dispatch pipeline auto-queues → the sequencer narrates it at the review beat). The GameEngine reads the flag and applies the grant **after `tickModifiers`** in `advanceAfterCommit`, so an emergent upheaval (like an opt-in one) is visible for exactly `EMERGENT_READINGS` subsequent readings. The "no active upheaval" guard is seeded into the commit draft as `upheavalActive` so it survives across readings (no flapping); the responder is suppressed on the **last reading** (no reading left for it to land on).

**Files:**
- Modify: `src/engine/responders/affinity.ts` (`emergent-upheaval` responder)
- Modify: `src/engine/GameEngine.ts` (seed draft flags; store + apply the request; `pendingEmergentUpheaval` field + resets)
- Modify: `src/engine/__tests__/AffinityResponders.test.ts` (responder unit tests)
- Modify: `src/engine/__tests__/Upheaval.test.ts` (deferred-grant + guard integration test)

**Interfaces:**
- Consumes: `axisOf`, `AFFINITY_IDS`, `EMERGENT_THRESHOLD`, `EMERGENT_CHANCE`, `EMERGENT_READINGS` (Tasks 1); `AffinityEngine.hasActiveTransform`/`grantUpheaval` (Tasks 2); the `spawnSecond`/draft-flag pattern (`completeMinigame`).
- Produces:
  - Responder `emergent-upheaval` (STRUCTURAL, exclusive) at the six `*:commit` triggers; sets `ctx.draft.requestUpheaval = { transform, readings, source }`.
  - `GameEngine` seeds `ctx.draft.upheavalActive` and `ctx.draft.lastReading` into the commit dispatch; `private pendingEmergentUpheaval`; applies the grant after `tickModifiers`.

- [ ] **Step 1: Write the failing responder unit tests**

In `src/engine/__tests__/AffinityResponders.test.ts`, follow the file's existing pattern for building a `PhaseContext` and invoking a responder's `condition`/`roll`/`apply` directly. Find the `emergent-upheaval` responder via the array `buildAffinityResponders()` returns (match how other tests in this file locate a responder by `id`). Add:

```ts
  describe('emergent-upheaval', () => {
    const find = () => buildAffinityResponders().find((r) => r.id === 'emergent-upheaval')!;
    const baseAff = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };
    const ctx = (over: Partial<typeof baseAff>, draft: Record<string, unknown> = {}) => ({
      trigger: 'dice:commit', affinities: { ...baseAff, ...over }, slots: [], hand: null, spread: [],
      minigame: null, event: null, draft, rng: () => 0,
    }) as unknown as Parameters<ReturnType<typeof find>['condition']>[0];

    it('condition true at the extreme when no upheaval is active and not the last reading', () => {
      expect(find().condition(ctx({ chaos: 96 }))).toBe(true);
    });
    it('condition false when no affinity is at the extreme', () => {
      expect(find().condition(ctx({ chaos: 94 }))).toBe(false);
    });
    it('condition false when an upheaval is already active (guard)', () => {
      expect(find().condition(ctx({ chaos: 96 }, { upheavalActive: true }))).toBe(false);
    });
    it('condition false on the last reading', () => {
      expect(find().condition(ctx({ chaos: 96 }, { lastReading: true }))).toBe(false);
    });
    it('apply requests an invert-pair on the extreme affinity’s axis and returns an upheaval report', () => {
      const c = ctx({ chaos: 96 });
      const r = find().apply(c);
      expect((c.draft as { requestUpheaval?: { transform: { transform: string; axis: string } } }).requestUpheaval)
        .toEqual({ transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2, source: 'emergent:chaos' });
      expect(r?.animation).toBe('upheaval');
      expect(r?.label).toBe('Upheaval');
    });
  });
```

> **Note for the implementer:** match the import of `buildAffinityResponders` and the exact `PhaseContext` shape already used by the other responder tests in this file (the `ctx` helper above mirrors `eligibility`/`PhaseContext`: `affinities`, `draft`, `rng`, plus the structural fields). If the file has a shared ctx factory, reuse it and pass the `affinities`/`draft` overrides.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "emergent-upheaval"`
Expected: FAIL — no responder with id `emergent-upheaval` exists.

- [ ] **Step 3: Add the `emergent-upheaval` responder**

In `src/engine/responders/affinity.ts`, add to the imports:

```ts
import { TIER_BASE_CHANCE, bandOf, BAND_ORDER, AFFINITY_IDS, axisOf, EMERGENT_THRESHOLD, EMERGENT_CHANCE, EMERGENT_READINGS } from '../../data/affinities';
```

(merge with the existing `from '../../data/affinities'` import — do not duplicate it.)

Add this responder object inside the array returned by `buildAffinityResponders()` (place it next to `chaos-second-result`, the other `*:commit` SPAWN-family responder):

```ts
    {
      id: 'emergent-upheaval', source: 'affinity',
      triggers: ['dice:commit', 'tarot:commit', 'iching:commit', 'strings:commit', 'astral:commit', 'rune:commit'],
      group: { kind: 'exclusive', band: 'STRUCTURAL' },
      // Extreme effective affinity AND no active upheaval AND a reading remains.
      condition: (c) => c.draft.upheavalActive !== true && c.draft.lastReading !== true
        && AFFINITY_IDS.some((id) => c.affinities[id] >= EMERGENT_THRESHOLD),
      roll: (c) => c.rng() < EMERGENT_CHANCE,
      apply: (c) => {
        const extreme = AFFINITY_IDS.find((id) => c.affinities[id] >= EMERGENT_THRESHOLD)!;
        c.draft.requestUpheaval = {
          transform: { transform: 'invert-pair', axis: axisOf(extreme) },
          readings: EMERGENT_READINGS,
          source: `emergent:${extreme}`,
        };
        return report('emergent-upheaval', 'Upheaval', 'Reality strains against itself — the weave inverts.', 'upheaval');
      },
    },
```

(The unused-import guard is satisfied: `bandOf`/`BAND_ORDER`/`TIER_BASE_CHANCE` were already imported for other responders; the new names are all used here.)

- [ ] **Step 4: Seed the draft flags + store + apply the request in `GameEngine`**

In `src/engine/GameEngine.ts`:

Add the field next to the other private per-turn state (beside `private peekOverrideThisReading`):

```ts
  private pendingEmergentUpheaval: { transform: TransformPayload; readings: number; source: string } | null = null;
```

In `completeMinigame`, change the commit dispatch to seed the two flags the responder reads (`completed` is already in scope from `const completed = this.state.minigamesCompleted + 1;` above):

```ts
    const { draft } = this.dispatchAt(commitTrigger, {
      outcome: result,
      upheavalActive: this.affinityEngine.hasActiveTransform(),
      lastReading: completed >= this.minigamesPerTurn,
    });
```

Directly after the existing `spawnSecond` consume block (the `if (result.type !== 'happening' && typeof draft.spawnSecond !== 'string' …)` block), add:

```ts
    if (draft.requestUpheaval) {
      this.pendingEmergentUpheaval = draft.requestUpheaval as { transform: TransformPayload; readings: number; source: string };
    }
```

In `advanceAfterCommit`, **after** the `this.affinityEngine.tickModifiers();` line and the final-reading early-return block, apply the deferred grant (so it lands only when a reading remains, and is not ticked this cycle → active for the full `readings`). Place it directly after the `if (completed >= this.minigamesPerTurn) { … return; }` block, before `removeUsedMethod`:

```ts
    // Apply any emergent upheaval requested at this reading's commit. Deferred to
    // here (after tick, past the final-reading guard) so it stays active for its
    // full `readings` and only when a subsequent reading exists.
    if (this.pendingEmergentUpheaval) {
      const u = this.pendingEmergentUpheaval;
      this.pendingEmergentUpheaval = null;
      this.affinityEngine.grantUpheaval(u.transform, u.readings, u.source);
    }
```

Reset the field for turn/abandon symmetry — add `this.pendingEmergentUpheaval = null;` next to each existing `this.peekOverrideThisReading = null;` in `startTurn`, `returnToQuestionSelect`, `returnToTitle`, and `reset` (four sites). Confirm `TransformPayload` is in the `./types` import at the top of `GameEngine.ts` (add it if not already present from Task 3).

- [ ] **Step 5: Write + run the deferred-grant integration test**

Add to `src/engine/__tests__/Upheaval.test.ts` a block that drives readings through the public API and forces the responder (bypassing the rare roll). Reuse the reading-driving helper pattern from `src/engine/__tests__/Happenings.test.ts` (the `playOneReading` helper that selects a non-happening method, commits a `d20` result via `orchestrator.drawSingleResult`, drains the event batch, and continues the review beat):

```ts
describe('emergent upheaval (integration)', () => {
  // Mirror the playOneReading helper from Happenings.test.ts.
  function playOneReading(engine: GameEngine) {
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    const result = (engine as unknown as { orchestrator: { drawSingleResult: (t: string, a: object) => import('../types').SlotResult } })
      .orchestrator.drawSingleResult('d20', engine.getState().affinities);
    engine.completeMinigame(result);
    if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
    if (engine.getState().awaitingContinue) engine.continueAfterReview();
  }

  it('forced at an extreme: inverts the next reading, leaves base intact, and does not re-fire while active', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { chaos: 96, order: 30, fate: 50, will: 50, light: 50, shadow: 50 } });
    engine.forceEffects(['emergent-upheaval'], false); // bypass the rare roll; condition still required

    playOneReading(engine); // reading 1 commits → requests upheaval → granted after tick
    const afterFirst = engine.getState();
    // Assert the invariant (effective is the inverted base), not a literal — a d20
    // commit must not move base chaos, but relational assertions are robust either way.
    expect(afterFirst.affinityBase.chaos).toBeGreaterThanOrEqual(90); // base stays high (transform never touches base)
    expect(afterFirst.affinities.chaos).toBe(100 - afterFirst.affinityBase.chaos); // effective = inverted base
    expect(afterFirst.affinities.chaos).toBeLessThan(15); // visibly inverted for reading 2

    engine.forceEffects(['emergent-upheaval'], false); // try to force a second upheaval
    playOneReading(engine); // reading 2: the no-active-upheaval guard blocks it
    // Still a SINGLE inversion (low). A stacked second invert-pair would have flipped
    // chaos back near its base (~96); the guard prevents that.
    expect(engine.getState().affinities.chaos).toBeLessThan(15);
  });
});
```

> **Note for the implementer:** `forceEffects` bypasses only the responder's `roll`, never its `condition` — so the staged effective `chaos: 96` (no active upheaval, not the last reading) is required for the force to take. The exact post-invert number depends only on the staged base; assert the inversion (`100 - base`) and the base-intact invariant, not internal counts. If `continueAfterReview`/`finishEventBatch` names differ, match `Happenings.test.ts`.

Run: `npx vitest run src/engine/__tests__/Upheaval.test.ts src/engine/__tests__/AffinityResponders.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS — full suite green (the new STRUCTURAL responder fires only at the extreme + forced/rolled, so normal-play tests are unaffected; the rare `EMERGENT_CHANCE` never trips at baseline affinities).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/GameEngine.ts src/engine/__tests__/AffinityResponders.test.ts src/engine/__tests__/Upheaval.test.ts
git commit -m "feat(upheaval): emergent-upheaval responder + deferred grant with no-active-upheaval guard"
```

---

### Task 5: Narration — map the `upheaval` animation

Give the upheaval a dramatic beat. `EffectReport`s with `animation: 'upheaval'` already render (the `primitiveFor` fallback is `'glow'`), so nothing is broken today — this task upgrades the mapping to a fitting inversion visual and themes the banner. UI-only; no engine tests (the repo has none) — the hard gate is `tsc`/`build`.

**Files:**
- Modify: `src/components/overlays/anim/theme.ts`

**Interfaces:**
- Consumes: `EffectReport.animation === 'upheaval'` / `.label === 'Upheaval'` (Task 4). No new engine symbols.

- [ ] **Step 1: Map `'upheaval'` to a primitive + add an Upheaval theme**

In `src/components/overlays/anim/theme.ts`:

Add the animation→primitive mapping inside `PRIMITIVE_BY_ANIMATION` (the `mirror` primitive's reflect/flip reads as inversion — fitting for a transform):

```ts
  upheaval: 'mirror',
```

Add an `Upheaval` entry to the `AFFINITY` theme map (so `themeFor` colors the banner dramatically off `report.label === 'Upheaval'` instead of the fate-gold fallback) — a fractured violet/red palette:

```ts
  Upheaval: { palette: ['#7a2d8c', '#c75b4a'], model: 'shard', key: 'upheaval' },
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc -b`
Expected: no type errors.
Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 3: (Optional) Manual probe**

If a browser is available: `npm run dev`, open with `?debug`, run the `upheaval` debug scenario added in Task 6 (resolve its upheaval choice), and confirm the inversion beat plays (mirror primitive, violet/red banner) and the affinity bands visibly invert for the following readings. Not required to pass; the build gate is the hard gate.

- [ ] **Step 4: Commit**

```bash
git add src/components/overlays/anim/theme.ts
git commit -m "feat(upheaval): map the upheaval animation to the mirror primitive + Upheaval theme"
```

---

### Task 6: Documentation sync + debug scenario + full verification

Finish the CLAUDE.md-required doc sync, add a forceable upheaval demo, and run the complete verification gate.

**Files:**
- Modify: `docs/game-systems.md` (new Upheavals section; §2 effective/transform note; §3 bands-read-effective note; §6 responder table; source-of-truth table)
- Modify: `README.md` (affinity/upheaval section)
- Modify: `src/engine/events/scenarios.ts` (upheaval demo scenario)

**Interfaces:** none (documentation + demo + verification only).

- [ ] **Step 1: Update `docs/game-systems.md`**

First READ the existing `docs/game-systems.md` to match its section structure and voice (Phase 1/2 already added base/effective + surge + happenings content there). Then:

- **New Upheavals section** (place after the happenings section, §7): describe the mechanic — a `transform` modifier in the unified list applied to **effective** values *after* surges, for a fixed number of readings, then a **cliff** snap-back. Document the three transforms (`invert-pair: <axis>` flips one polar pair `v → 100 − v`; `invert-all` flips all three pairs; `scramble` redistributes effective values by a permutation fixed at creation). State the **base-untouched invariant** (shift writes base during an upheaval; only effective bends; real values resurface on expiry). Document both triggers: **opt-in** (a happening choice `{ kind: 'upheaval', transform, readings }`, resolved silently and telegraphed by the "the weave may tear" cue) and **emergent** (the `emergent-upheaval` responder at `*:commit`: an *effective* affinity ≥ `EMERGENT_THRESHOLD` and no active upheaval, `EMERGENT_CHANCE` per reading, suppressed on the last reading, granted after the reading's tick for `EMERGENT_READINGS` readings). Note narration via the report→sequencer pipeline (`animation: 'upheaval'`) and that active-upheaval hints/bands reflect the inverted reality automatically (they read effective).
- **§2** (feeds / base-effective): add a one-line note that the effective value is `base + Σ surges`, **then** transform modifiers in list order (the upheaval layer).
- **§3** (bands): note bands read the **transformed effective** value, so an active upheaval shifts which band each affinity acts in.
- **§6** (interactions / responder table): add the `emergent-upheaval` row (trigger `*:commit`, STRUCTURAL, condition "effective extreme + no active upheaval", effect "grants a transform upheaval").
- **Source-of-truth table:** ensure the `AffinityEngine.ts` row mentions "transform/upheaval layer (effectiveVector, grantUpheaval)" and the `GameEngine.ts` row mentions "opt-in + emergent upheaval triggers".

- [ ] **Step 2: Update `README.md`**

Locate the README affinity/happenings section and add a short paragraph on upheavals (temporary inversions/scrambles of the *displayed* affinities for a few readings, opt-in via risky happening choices and emergent at extremes, with progression preserved underneath). If the README has no mechanics detail at this depth, add a brief paragraph and note in the commit body what was/wasn't present.

- [ ] **Step 3: Add a forceable upheaval debug scenario**

In `src/engine/events/scenarios.ts`, FIRST READ the file to match the actual `DEBUG_SCENARIOS` entry shape and the `group` union (reuse an existing group such as `'Interaction'` if the union is closed — do not invent a new member). Add a scenario that stages a happening carrying an upheaval choice (resolving it grants the transform end-to-end and the inverted bands become visible), following the Phase 2 `happening-surge-cost` staging pattern (`s.screen = 'happening'`):

```ts
  { id: 'happening-upheaval', label: 'Happening: opt-in upheaval (invert Fortune)', group: 'Interaction', forced: [], isolate: false,
    setup: (s) => {
      s.screen = 'happening';
      s.happening = {
        type: 'happening', id: 'many-threads',
        scene: 'Countless threads of fate shimmer into view — pluck one and the weave may tear.',
        choices: [
          { text: 'Pluck a thread and see what unravels.', effects: [
            { kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 },
            { kind: 'surge', deltas: { chaos: 20 }, readings: 2 },
          ] },
          { text: 'Leave the weave be.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
        ],
        tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
      };
    } },
```

(Match the real `DEBUG_SCENARIOS` entry shape and imports in the file; the effect literals must satisfy the `HappeningEffect` union and the happening object the `HappeningResult` shape.)

- [ ] **Step 4: Full verification gate**

Run: `npm test`
Expected: PASS — entire engine suite green.
Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 5: Spec-coverage self-check (record the mapping in the commit body)**

Confirm each Phase 3 spec (§7) item maps to a task: transform mechanic §7.1 (T1 type + T2 application) · base-untouched invariant §7.2 (T2 — `effectiveVector` reads base into a fresh vector; tested) · opt-in trigger §7.3 (T3) · emergent trigger + no-active-upheaval guard §7.3 (T4) · narration `animation:'upheaval'` + inverted hints §7.4 (T4 report + T5 mapping; hints invert automatically via effective) · docs §10 (T6). Note explicitly that the **Seed of Corruption (§8/Phase 4) is out of scope** — the modifier list already accommodates it.

- [ ] **Step 6: Commit**

```bash
git add docs/game-systems.md README.md src/engine/events/scenarios.ts
git commit -m "docs(upheaval): sync game-systems + README + debug scenario for Phase 3"
```

---

## Out of scope (later phase — do NOT build here)

- **Phase 4 — Seed of Corruption:** a counter to all six affinities plugging into the same modifier list (as another modifier kind and/or a base-side drain). Not designed; the unified modifier list and the base/effective split leave room.

## Open tuning questions (playtest, not blocking — spec §11)

- Emergent threshold (`EMERGENT_THRESHOLD` 95) and per-reading odds (`EMERGENT_CHANCE` 0.04).
- Upheaval lifetime (`EMERGENT_READINGS` 2; opt-in `readings` per happening).
- Which transform the emergent trigger uses (currently `invert-pair` on the extreme affinity's axis) vs. occasionally `invert-all`/`scramble` at the very top.
- Which happenings carry upheaval choices, and their risk framing.
```
