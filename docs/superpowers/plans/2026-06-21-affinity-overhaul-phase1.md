# Affinity System Overhaul — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the affinity core — migrate to a 0–100 scale with six affinities (Chaos/Order active, Fate/Will/Light/Shadow defined but their effects stubbed), add the single `shift()` mutation pipeline (diminishing returns + jitter + opposition coupling), soft bands with reach-up, run-start drift, the hint rework, wire Chaos/Order to existing hooks, and stand up the debug-scenario infrastructure (sectioned dropdown, guaranteed-fire flag, affinity-routing fix).

**Architecture:** All logic stays in the framework-free engine (`src/engine/`); React only renders the snapshot. `AffinityEngine` becomes the single chokepoint for every affinity mutation via `shift()`. `GameEngine` calls `shift`/`applyResultTags`/`beginRun` and exposes derived state through the existing `notify()` snapshot. Data-layer RNG functions (`dice`, `tarot`, `iching`, `happenings`) and the two engine consumers (`InteractionResolver`, `NarrativeAssembler`) read affinities on the new 0–100 scale.

**Tech Stack:** React 18 + TypeScript (strict) + Vite; Vitest (engine-only tests, Node env, `Math.random` stubbed for determinism). No ESLint/Prettier — `tsc -b` is the typecheck gate (`strict`, `noUnusedLocals`, `noUnusedParameters`).

## Global Constraints

- **Scale / baseline:** all six affinities are integers on `0–100`, baseline `50`. Values stay integers — `clamp()` rounds.
- **Bands:** Latent `0–34`, Stirring `35–59`, Ascendant `60–81`, Dominant `82–100`.
- **Soft reach-up:** `12%` chance to resolve one band higher (never lower, never two up; Dominant never reaches up).
- **Coupling (gains only, on realized gain `g`):** opposite `−= 0.6g`; every other affinity `−= 0.35g`. **Penalties (negative deltas) subtract directly with NO fan-out.**
- **Diminishing returns:** `max(0.3, 1 − 0.08 × feedsThisRun[A])`, applied before jitter; increment `feedsThisRun[A]` per gain.
- **Jitter:** multiply by `U(0.85, 1.15)`.
- **Run-start drift:** `A += (50 − A) × 0.33`; reset `feedsThisRun`.
- **Feed magnitude:** `5` points per matching result tag (the old `0.05 × 100`).
- **All numeric constants are playtest defaults** — define them as named exports so tuning is one edit.
- **Engine purity:** zero React/DOM imports in `src/engine/` and `src/data/`. Every mutator that changes engine state ends with `notify()`.
- **Visibility:** the player never sees numbers or named causes; only the debug panel (already gated behind `state.debug`) shows real values.
- **Tests live only in `src/engine/__tests__/**`** and run under Vitest globals (`describe`/`it`/`expect` are global; no import needed). Stub randomness by reassigning `Math.random` and restoring it (match existing test style).

---

## File Structure

**Create:**
- `src/engine/__tests__/AffinityShift.test.ts` — pipeline (shift/coupling/DR/jitter/penalty), bands, reach-up, drift, migration, hints.

**Rewrite:**
- `src/data/affinities.ts` — band constants, tuning constants, `bandOf`, `AFFINITY_IDS`, `AFFINITY_PAIRS`, `defaultAffinityState`, new `AffinityDefinition` shape, six definitions.
- `src/engine/AffinityEngine.ts` — 0–100 model, `shift`, `applyResultTags`, `beginRun`, bands/reach-up, hints, migration.
- `src/engine/__tests__/AffinityEngine.test.ts` — replace 0–1 assertions with 0–100 equivalents.

**Modify:**
- `src/engine/types.ts` — `AffinityId` (six), `AffinityBand`, `GameState.debugForcedEffect`, comment fixes.
- `src/engine/GameEngine.ts` — construct with six defs, `defaultAffinityState`, `beginRun` in `startTurn`, `applyResultTags`, `shift`-routed happenings, `maybeWildSurge`/`maybeHappeningInterrupt`, `debugForcedEffect`, grouped scenario presets, affinity-routing fix.
- `src/data/dice.ts`, `src/data/tarot.ts`, `src/data/iching.ts`, `src/data/happenings.ts` — read/emit affinities on 0–100.
- `src/engine/InteractionResolver.ts` — band-gate `chaos-dominant`.
- `src/engine/NarrativeAssembler.ts` — band-gate the affinity note + LLM hint line.
- `src/engine/scenarios.ts` — `group` field, affinity patch, `debugForcedEffect`, Chaos/Order scenarios.
- `src/components/debug/DebugPanel.tsx` — `<optgroup>` rendering.
- `src/engine/__tests__/Dice.test.ts`, `Tarot.test.ts`, `IChing.test.ts`, `NarrativeAssembler.test.ts`, `InteractionResolver.test.ts` — rescale `{chaos,order}` fixtures to 0–100.

---

## Task 1: Foundation — types, constants, band helper

Adds the six-id union, band constants, tuning constants, and the pure `bandOf`/`defaultAffinityState` helpers. The `AffinityDefinition` shape is **not** changed yet (the existing two defs stay valid so `AffinityEngine` keeps compiling). Minimal `GameEngine` literal fixes keep `tsc` green under the widened union.

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/data/affinities.ts` (append constants/helpers only)
- Modify: `src/engine/GameEngine.ts` (literal fixes only)

**Interfaces:**
- Produces:
  - `type AffinityId = 'chaos' | 'order' | 'fate' | 'will' | 'light' | 'shadow'`
  - `type AffinityBand = 'latent' | 'stirring' | 'ascendant' | 'dominant'`
  - `GameState.debugForcedEffect: string | null`
  - `AFFINITY_IDS: AffinityId[]`, `AFFINITY_PAIRS: Record<AffinityId, AffinityId>`
  - `bandOf(value: number): AffinityBand`, `defaultAffinityState(): Record<AffinityId, number>`
  - Constants: `BASELINE`, `BAND_BOUNDS`, `BAND_ORDER`, `REACH_UP_CHANCE`, `COUPLING_OPPOSITE`, `COUPLING_OTHER`, `DR_STEP`, `DR_FLOOR`, `JITTER_MIN`, `JITTER_MAX`, `RUN_DRIFT`, `FEED_PER_MATCH`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AffinityShift.test.ts`:

```typescript
import {
  bandOf,
  defaultAffinityState,
  AFFINITY_IDS,
  AFFINITY_PAIRS,
} from '../../data/affinities';

describe('band + foundation helpers', () => {
  it('classifies values into bands at the documented boundaries', () => {
    expect(bandOf(0)).toBe('latent');
    expect(bandOf(34)).toBe('latent');
    expect(bandOf(35)).toBe('stirring');
    expect(bandOf(59)).toBe('stirring');
    expect(bandOf(60)).toBe('ascendant');
    expect(bandOf(81)).toBe('ascendant');
    expect(bandOf(82)).toBe('dominant');
    expect(bandOf(100)).toBe('dominant');
  });

  it('AFFINITY_PAIRS is a symmetric involution over all six ids', () => {
    expect(AFFINITY_IDS).toHaveLength(6);
    for (const id of AFFINITY_IDS) {
      const opp = AFFINITY_PAIRS[id];
      expect(opp).not.toBe(id);
      expect(AFFINITY_PAIRS[opp]).toBe(id);
    }
  });

  it('defaultAffinityState seeds all six affinities at baseline 50', () => {
    const s = defaultAffinityState();
    expect(Object.keys(s).sort()).toEqual([...AFFINITY_IDS].sort());
    for (const id of AFFINITY_IDS) expect(s[id]).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts`
Expected: FAIL — `bandOf`/`defaultAffinityState`/`AFFINITY_IDS`/`AFFINITY_PAIRS` are not exported.

- [ ] **Step 3: Widen `AffinityId` and add `AffinityBand` + `debugForcedEffect` in `types.ts`**

In `src/engine/types.ts`, replace the top affinity block (lines 1–7):

```typescript
// ── Affinities ──
export type AffinityId =
  | 'chaos'
  | 'order'
  | 'fate'
  | 'will'
  | 'light'
  | 'shadow';

export type AffinityBand = 'latent' | 'stirring' | 'ascendant' | 'dominant';

export interface AffinityState {
  id: AffinityId;
  value: number; // 0–100
}
```

In the `GameState` interface, add a field after `debug: boolean;`:

```typescript
  debug: boolean;
  debugForcedEffect: string | null;
```

- [ ] **Step 4: Append constants + helpers to `data/affinities.ts`**

At the top of `src/data/affinities.ts`, update the import and append the new block **above** the existing `AffinityDefinition` interface:

```typescript
import type { AffinityId, AffinityBand } from '../engine/types';

// ── Scale & bands (playtest defaults) ──
export const BASELINE = 50;
export const BAND_BOUNDS = { latentMax: 34, stirringMax: 59, ascendantMax: 81 };
export const BAND_ORDER: AffinityBand[] = ['latent', 'stirring', 'ascendant', 'dominant'];

// ── Pipeline tuning (playtest defaults) ──
export const REACH_UP_CHANCE = 0.12;
export const COUPLING_OPPOSITE = 0.6;
export const COUPLING_OTHER = 0.35;
export const DR_STEP = 0.08;
export const DR_FLOOR = 0.3;
export const JITTER_MIN = 0.85;
export const JITTER_MAX = 1.15;
export const RUN_DRIFT = 0.33;
export const FEED_PER_MATCH = 5;

export const AFFINITY_IDS: AffinityId[] = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];

export const AFFINITY_PAIRS: Record<AffinityId, AffinityId> = {
  chaos: 'order',
  order: 'chaos',
  fate: 'will',
  will: 'fate',
  light: 'shadow',
  shadow: 'light',
};

export function bandOf(value: number): AffinityBand {
  if (value <= BAND_BOUNDS.latentMax) return 'latent';
  if (value <= BAND_BOUNDS.stirringMax) return 'stirring';
  if (value <= BAND_BOUNDS.ascendantMax) return 'ascendant';
  return 'dominant';
}

export function defaultAffinityState(): Record<AffinityId, number> {
  return AFFINITY_IDS.reduce(
    (acc, id) => ((acc[id] = BASELINE), acc),
    {} as Record<AffinityId, number>,
  );
}
```

Leave the existing `AffinityDefinition` interface and `CHAOS_AFFINITY`/`ORDER_AFFINITY` exports unchanged for now (Task 2 reshapes them).

- [ ] **Step 5: Fix `GameEngine` literals broken by the widened union**

In `src/engine/GameEngine.ts`, add to the affinities import (line 9) and use the helper. Change the import line:

```typescript
import { CHAOS_AFFINITY, ORDER_AFFINITY, defaultAffinityState } from '../data/affinities';
```

In `defaultState()` replace the `affinities` line and add `debugForcedEffect`:

```typescript
      screen: 'title',
      affinities: defaultAffinityState(),
```

and at the end of the returned object (after `debug: false,`):

```typescript
      debug: false,
      debugForcedEffect: null,
```

In `clearHistory()` replace the two lines:

```typescript
  clearHistory(): void {
    this.affinityEngine.setState(defaultAffinityState());
    this.state = this.defaultState();
```

(removing the old `const defaultAffinities = { chaos: 0.5, order: 0.5 };` and its use).

> Note: the engine still runs on the old 0–1 scale after this task — that is intentional; Task 2 flips the scale. `setState` already accepts a partial record and only writes provided keys, so passing the six-key `defaultAffinityState()` is safe.

- [ ] **Step 6: Run the foundation test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/engine/types.ts src/data/affinities.ts src/engine/GameEngine.ts src/engine/__tests__/AffinityShift.test.ts
git commit -m "feat(affinity): add six-id union, band helpers, and tuning constants"
```

---

## Task 2: AffinityEngine rewrite + six definitions + engine wiring

The core migration. Reshape `AffinityDefinition`, write all six definitions, rewrite `AffinityEngine` on the 0–100 scale with the `shift` pipeline, and re-wire `GameEngine` to feed through it. After this task the engine runs entirely on 0–100. The data-layer RNG functions still receive 0–100 but interpret it with old 0–1 math — that is corrected in Task 3 (a transient runtime mis-bias only; all tests stay green).

**Files:**
- Rewrite: `src/data/affinities.ts` (definition shape + six defs)
- Rewrite: `src/engine/AffinityEngine.ts`
- Rewrite: `src/engine/__tests__/AffinityEngine.test.ts`
- Modify: `src/engine/GameEngine.ts`
- Modify: `src/data/happenings.ts` (rescale data ×100)
- Test (extend): `src/engine/__tests__/AffinityShift.test.ts`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `AffinityDefinition { id, name, opposite, description, feeds: { tags: string[]; actions: string[] }, hints: Record<AffinityBand, string[]>, bandedEffects: BandedEffect[] }`
  - `BandedEffect { id: string; tier: 'ambient' | 'notable' | 'major'; band: AffinityBand; description: string }`
  - Exports `CHAOS_AFFINITY, ORDER_AFFINITY, FATE_AFFINITY, WILL_AFFINITY, LIGHT_AFFINITY, SHADOW_AFFINITY, AFFINITY_DEFINITIONS`
  - `AffinityEngine`:
    - `constructor(definitions: AffinityDefinition[])`
    - `shift(id: AffinityId, baseDelta: number, sourceId: string): number` (returns realized delta)
    - `applyResultTags(result: Taggable): void`
    - `beginRun(): void`
    - `bandOf(id: AffinityId): AffinityBand`
    - `resolveBand(id: AffinityId): AffinityBand`
    - `getActiveHints(max?: number): string[]`
    - `getHint(id: AffinityId): string | null`
    - `getState(): Record<AffinityId, number>`
    - `setState(values: Partial<Record<AffinityId, number>>): void`
    - `serialize(): string`
    - `loadFrom(json: string): void`

- [ ] **Step 1: Write the failing pipeline tests**

Append to `src/engine/__tests__/AffinityShift.test.ts`:

```typescript
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';
import type { TarotResult } from '../types';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

// jitter = JITTER_MIN + r*(JITTER_MAX-JITTER_MIN); r=0.5 → ×1.0 (no jitter)
function noJitter<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = () => 0.5;
  try { return fn(); } finally { Math.random = orig; }
}

describe('AffinityEngine.shift pipeline', () => {
  it('starts all six at 50', () => {
    const e = make();
    const s = e.getState();
    expect(Object.values(s)).toEqual([50, 50, 50, 50, 50, 50]);
  });

  it('a gain applies coupling: opposite -0.6g, others -0.35g (rounded, clamped)', () => {
    const e = make();
    noJitter(() => e.shift('chaos', 10, 'test')); // dr=1, jitter=1 → g=10
    const s = e.getState();
    expect(s.chaos).toBe(60);            // 50 + 10
    expect(s.order).toBe(44);            // 50 - 6  (opposite)
    expect(s.fate).toBe(47);             // 50 - 3.5 → round 47
    expect(s.will).toBe(47);
    expect(s.light).toBe(47);
    expect(s.shadow).toBe(47);
  });

  it('diminishing returns shrink successive same-run gains and floor at 0.3', () => {
    const e = make();
    const g1 = noJitter(() => e.shift('chaos', 10, 't')); // dr=1.00 → 10
    const g2 = noJitter(() => e.shift('chaos', 10, 't')); // dr=0.92 → 9.2
    const g3 = noJitter(() => e.shift('chaos', 10, 't')); // dr=0.84 → 8.4
    expect(g1).toBeGreaterThan(g2);
    expect(g2).toBeGreaterThan(g3);
    // floor: after many feeds, dr never drops below 0.3 → gain >= 10*0.3
    let last = 0;
    for (let i = 0; i < 50; i++) last = noJitter(() => e.shift('chaos', 10, 't'));
    expect(last).toBeGreaterThanOrEqual(3 - 0.001);
  });

  it('jitter keeps realized gain within +/-15% of the diminished base', () => {
    const e = make();
    const lo = (() => { const o = Math.random; Math.random = () => 0; const g = e.shift('chaos', 10, 't'); Math.random = o; return g; })();
    const e2 = make();
    const hi = (() => { const o = Math.random; Math.random = () => 0.999; const g = e2.shift('chaos', 10, 't'); Math.random = o; return g; })();
    expect(lo).toBeCloseTo(8.5, 5);   // 10 * 1 * 0.85
    expect(hi).toBeCloseTo(11.5, 1);  // 10 * 1 * ~1.15
  });

  it('penalties subtract directly with no fan-out', () => {
    const e = make();
    e.shift('light', -12, 'peek-fail');
    const s = e.getState();
    expect(s.light).toBe(38);   // 50 - 12, direct
    expect(s.shadow).toBe(50);  // opposite untouched
    expect(s.chaos).toBe(50);   // others untouched
  });

  it('applyResultTags raises chaos for a reversed/random result', () => {
    const e = make();
    const reversed = { tags: ['draw', 'random', 'reversed', 'reversible'] } as TarotResult;
    noJitter(() => e.applyResultTags(reversed)); // matches 'random' + 'reversed' = 2 × 5 = 10
    expect(e.getState().chaos).toBe(60);
    expect(e.getState().order).toBe(44);
  });
});

describe('bands, reach-up, and run boundary', () => {
  it('resolveBand reaches one band up at the reach-up chance, never two, never from dominant', () => {
    const e = make();
    e.setState({ chaos: 50 }); // stirring
    const orig = Math.random;
    Math.random = () => 0.05; // < 0.12 → reach up one band
    expect(e.resolveBand('chaos')).toBe('ascendant');
    Math.random = () => 0.5;  // >= 0.12 → stay
    expect(e.resolveBand('chaos')).toBe('stirring');
    e.setState({ chaos: 90 }); // dominant — the ceiling
    Math.random = () => 0.0;   // would reach up, but there is no higher band
    expect(e.resolveBand('chaos')).toBe('dominant');
    Math.random = orig;
  });

  it('beginRun drifts 33% toward 50 (rounded)', () => {
    const e = make();
    e.setState({ chaos: 80, order: 20 });
    e.beginRun();
    expect(e.getState().chaos).toBe(70); // round(80 + (50-80)*0.33) = round(70.1)
    expect(e.getState().order).toBe(30); // round(20 + (50-20)*0.33) = round(29.9)
  });

  it('beginRun resets diminishing-returns counters so the next gain is full', () => {
    const e = make();
    const o = Math.random;
    Math.random = () => 0.5; // no jitter
    e.shift('order', 10, 't'); // feedsThisRun.order = 1 (next would be diminished)
    e.beginRun();
    const g = e.shift('order', 10, 't'); // dr back to 1.0
    Math.random = o;
    expect(g).toBeCloseTo(10, 5);
  });
});
```

> The reach-up/drift/counter-reset behaviors are required engine tests per spec §12; they are written here (failing until Step 4 implements `resolveBand`/`beginRun`) alongside the pipeline tests.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts`
Expected: FAIL — `AFFINITY_DEFINITIONS` and the new `AffinityEngine` API do not exist.

- [ ] **Step 3: Reshape `AffinityDefinition` and write six definitions**

Replace everything **below** the helper block you added in Task 1 (i.e. the old `AffinityDefinition` interface and the two old defs) in `src/data/affinities.ts`:

```typescript
export type EffectTier = 'ambient' | 'notable' | 'major';

export interface BandedEffect {
  id: string;
  tier: EffectTier;
  band: AffinityBand; // minimum band at which it can fire
  description: string;
}

export interface AffinityDefinition {
  id: AffinityId;
  name: string;
  opposite: AffinityId;
  description: string;
  feeds: {
    tags: string[];    // result tags that feed this affinity (Chaos/Order)
    actions: string[]; // player-action ids that feed it (Fate/Will/Light/Shadow — Phase 2/3)
  };
  hints: Record<AffinityBand, string[]>; // per-band flavor, top-forces only
  bandedEffects: BandedEffect[];         // effects this affinity grants (stubbed for the new four)
}

export const CHAOS_AFFINITY: AffinityDefinition = {
  id: 'chaos',
  name: 'Chaos',
  opposite: 'order',
  description: 'Fueled by randomness, reversals, and changing patterns. Volatile, swingy outcomes.',
  feeds: { tags: ['random', 'reversed', 'changing-lines'], actions: [] },
  hints: {
    latent: [],
    stirring: ['The air carries a faint restlessness...'],
    ascendant: ['The currents run unpredictable and quick...', 'The stars shift restlessly above...'],
    dominant: ['Reality frays at the edges — anything may surface...'],
  },
  bandedEffects: [
    { id: 'wild-surge', tier: 'major', band: 'dominant', description: 'A result can spawn a second.' },
    { id: 'happening-interrupt', tier: 'major', band: 'dominant', description: 'A happening can interrupt a minigame.' },
  ],
};

export const ORDER_AFFINITY: AffinityDefinition = {
  id: 'order',
  name: 'Order',
  opposite: 'chaos',
  description: 'Grows through stable, upright, measured results. Steadies and clarifies outcomes.',
  feeds: { tags: ['upright', 'neutral', 'stable'], actions: [] },
  hints: {
    latent: [],
    stirring: ['A quiet steadiness settles in...'],
    ascendant: ['Patterns align with unusual clarity...', 'A sense of steady purpose settles over the reading...'],
    dominant: ['Everything coheres — the weave lies flat and legible...'],
  },
  bandedEffects: [],
};

// The new four are defined now so coupling and migration treat all six uniformly;
// their EFFECTS (bandedEffects) and action feeds are wired in Phases 2–3.
export const FATE_AFFINITY: AffinityDefinition = {
  id: 'fate',
  name: 'Fate',
  opposite: 'will',
  description: 'Control taken from the player — choices decided by the weave.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['The current seems to tug at your hand...'],
    ascendant: ['Something else is choosing alongside you...'],
    dominant: ['The weave moves your hand more than you do...'],
  },
  bandedEffects: [],
};

export const WILL_AFFINITY: AffinityDefinition = {
  id: 'will',
  name: 'Will',
  opposite: 'fate',
  description: 'Agency given to the player — more autonomy over the reading.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['Your choices feel a little freer...'],
    ascendant: ['The reading bends readily to your intent...'],
    dominant: ['The outcome is yours to shape...'],
  },
  bandedEffects: [],
};

export const LIGHT_AFFINITY: AffinityDefinition = {
  id: 'light',
  name: 'Light',
  opposite: 'shadow',
  description: 'The game reveals more — clearer readings and foresight.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['The reading reads a touch clearer...'],
    ascendant: ['Meaning surfaces readily; foresight beckons...'],
    dominant: ['Everything is laid bare and luminous...'],
  },
  bandedEffects: [],
};

export const SHADOW_AFFINITY: AffinityDefinition = {
  id: 'shadow',
  name: 'Shadow',
  opposite: 'light',
  description: 'The game conceals more — terse, cryptic, veiled readings.',
  feeds: { tags: [], actions: [] },
  hints: {
    latent: [],
    stirring: ['The edges of meaning blur...'],
    ascendant: ['Much is withheld; the reading speaks in riddles...'],
    dominant: ['Darkness swallows all but the faintest sign...'],
  },
  bandedEffects: [],
};

export const AFFINITY_DEFINITIONS: AffinityDefinition[] = [
  CHAOS_AFFINITY,
  ORDER_AFFINITY,
  FATE_AFFINITY,
  WILL_AFFINITY,
  LIGHT_AFFINITY,
  SHADOW_AFFINITY,
];
```

- [ ] **Step 4: Rewrite `AffinityEngine.ts`**

Replace the entire contents of `src/engine/AffinityEngine.ts`:

```typescript
import type { AffinityId, AffinityBand, Taggable } from './types';
import type { AffinityDefinition } from '../data/affinities';
import {
  AFFINITY_IDS,
  AFFINITY_PAIRS,
  BASELINE,
  BAND_ORDER,
  bandOf,
  REACH_UP_CHANCE,
  COUPLING_OPPOSITE,
  COUPLING_OTHER,
  DR_STEP,
  DR_FLOOR,
  JITTER_MIN,
  JITTER_MAX,
  RUN_DRIFT,
  FEED_PER_MATCH,
} from '../data/affinities';

export class AffinityEngine {
  private state: Record<AffinityId, number>;
  private feedsThisRun: Record<AffinityId, number>;
  private definitions: AffinityDefinition[];
  private defById: Record<string, AffinityDefinition>;

  constructor(definitions: AffinityDefinition[]) {
    this.definitions = definitions;
    this.defById = {};
    this.state = {} as Record<AffinityId, number>;
    this.feedsThisRun = {} as Record<AffinityId, number>;
    for (const id of AFFINITY_IDS) {
      this.state[id] = BASELINE;
      this.feedsThisRun[id] = 0;
    }
    for (const def of definitions) this.defById[def.id] = def;
  }

  // ── The single mutation chokepoint ──
  // Returns the realized delta actually applied to `id` (signed).
  shift(id: AffinityId, baseDelta: number, _sourceId: string): number {
    if (baseDelta === 0) return 0;

    // Penalty: direct subtraction, no fan-out.
    if (baseDelta < 0) {
      this.state[id] = this.clamp(this.state[id] + baseDelta);
      return baseDelta;
    }

    // Gain: diminishing returns → jitter → apply → coupling fan-out.
    const dr = Math.max(DR_FLOOR, 1 - DR_STEP * this.feedsThisRun[id]);
    this.feedsThisRun[id] += 1;
    const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
    const gain = baseDelta * dr * jitter;

    this.state[id] = this.clamp(this.state[id] + gain);

    const opp = AFFINITY_PAIRS[id];
    this.state[opp] = this.clamp(this.state[opp] - gain * COUPLING_OPPOSITE);
    for (const other of AFFINITY_IDS) {
      if (other === id || other === opp) continue;
      this.state[other] = this.clamp(this.state[other] - gain * COUPLING_OTHER);
    }
    return gain;
  }

  // Result tags → Chaos/Order feeds (the only tag-driven feeds in Phase 1).
  applyResultTags(result: Taggable): void {
    for (const def of this.definitions) {
      if (def.feeds.tags.length === 0) continue;
      const matches = def.feeds.tags.filter((t) => result.tags.includes(t)).length;
      if (matches > 0) this.shift(def.id, matches * FEED_PER_MATCH, `result:${def.id}`);
    }
  }

  // Run boundary: drift toward baseline, reset per-run counters. Reshuffle hook.
  beginRun(): void {
    for (const id of AFFINITY_IDS) {
      this.state[id] = this.clamp(this.state[id] + (BASELINE - this.state[id]) * RUN_DRIFT);
      this.feedsThisRun[id] = 0;
    }
  }

  bandOf(id: AffinityId): AffinityBand {
    return bandOf(this.state[id]);
  }

  // Soft reach-up: ~12% chance to act one band higher (never lower, never two up).
  resolveBand(id: AffinityId): AffinityBand {
    const base = bandOf(this.state[id]);
    const idx = BAND_ORDER.indexOf(base);
    if (idx < BAND_ORDER.length - 1 && Math.random() < REACH_UP_CHANCE) {
      return BAND_ORDER[idx + 1];
    }
    return base;
  }

  // Top 1–2 forces only, keyed to each one's current band hint pool.
  getActiveHints(max = 2): string[] {
    const sorted = [...AFFINITY_IDS].sort((a, b) => this.state[b] - this.state[a]);
    const hints: string[] = [];
    for (const id of sorted.slice(0, max)) {
      const hint = this.getHint(id);
      if (hint) hints.push(hint);
    }
    return hints;
  }

  getHint(id: AffinityId): string | null {
    const def = this.defById[id];
    if (!def) return null;
    const pool = def.hints[bandOf(this.state[id])];
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getState(): Record<AffinityId, number> {
    return { ...this.state };
  }

  setState(values: Partial<Record<AffinityId, number>>): void {
    for (const [id, val] of Object.entries(values)) {
      if (typeof val === 'number') this.state[id as AffinityId] = this.clamp(val);
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  // Migration: any value <= 1 is an old 0–1 figure (×100); missing ids default to baseline.
  loadFrom(json: string): void {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const id of AFFINITY_IDS) {
      const v = parsed[id];
      if (typeof v === 'number') {
        this.state[id] = this.clamp(v <= 1 ? v * 100 : v);
      } else {
        this.state[id] = BASELINE;
      }
    }
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
```

- [ ] **Step 5: Re-wire `GameEngine` to the new engine API**

In `src/engine/GameEngine.ts`:

Update the affinities import (line 9):

```typescript
import { AFFINITY_DEFINITIONS, defaultAffinityState } from '../data/affinities';
```

Construct the engine with all six (line 35):

```typescript
    this.affinityEngine = new AffinityEngine(AFFINITY_DEFINITIONS);
```

In `startTurn`, add `beginRun()` as the first line of the method body (before `const affinities = ...`):

```typescript
  startTurn(question: QuestionType): void {
    this.affinityEngine.beginRun();
    const affinities = this.affinityEngine.getState();
```

In `completeMinigame`, replace the affinity application (line 137–139):

```typescript
    // Apply affinities from the result (Chaos/Order tag feeds, routed through shift)
    if (result.type !== 'happening') {
      this.affinityEngine.applyResultTags(result);
    }
```

In `completeMinigame`, normalize the happening-trigger threshold (the block around line 193–196):

```typescript
      const chaos = this.affinityEngine.getState().chaos;
      if (chaos >= 40 && Math.random() < (chaos / 100) * 0.5) {
        this.triggerHappening();
        return;
```

In `resolveHappening`, replace the manual 0–1 clamp loop (lines 414–425) with `shift` routing:

```typescript
    // Apply affinity changes from chosen option through the shift pipeline.
    for (const [id, delta] of Object.entries(choice.affinityChanges)) {
      this.affinityEngine.shift(id as AffinityId, delta as number, `happening:${this.state.happening.id}`);
    }

    this.state.selectedHappeningChoice = choiceIndex;
    this.state.affinities = this.affinityEngine.getState();
```

In `executeEffect`, the `add-choice` branch builds a bonus choice with `affinityChanges: { chaos: 0.05 }` (line ~320) — rescale to 0–100:

```typescript
            affinityChanges: { chaos: 5 },
```

- [ ] **Step 6: Rescale happenings data to 0–100**

In `src/data/happenings.ts`, multiply every `affinityChanges` value by 100. Replace each `choices` block to use integer point values. The full replacement for the `HAPPENINGS` choice deltas:

```typescript
// crossroads
      { text: 'Take the gleaming path — it feels certain.', affinityChanges: { order: 8 } },
      { text: 'Step into the shadowed stars — uncertainty calls.', affinityChanges: { chaos: 8 } },
      { text: 'Sit at the crossroads and wait for a sign.', affinityChanges: { order: 4, chaos: 4 } },
// falling-star
      { text: 'Make a wish upon the falling light.', affinityChanges: { chaos: 10 } },
      { text: 'Observe its trajectory — seek the pattern.', affinityChanges: { order: 10 } },
// veiled-moon
      { text: 'Read the shapes as portents — they must mean something.', affinityChanges: { chaos: 6 } },
      { text: 'Let them pass — clouds are only clouds.', affinityChanges: { order: 6 } },
      { text: 'Draw the shapes in the dust, fixing them in place.', affinityChanges: { order: 3, chaos: 3 } },
// whispering-thread
      { text: 'Lean in — strain to hear the whispered truth.', affinityChanges: { chaos: 7 } },
      { text: 'Step back — some knowledge is not meant for you.', affinityChanges: { order: 7 } },
// convergence
      { text: 'Align yourself with the convergence — become part of the pattern.', affinityChanges: { order: 9 } },
      { text: 'Stand at an angle to it — see what the pattern hides.', affinityChanges: { chaos: 9 } },
// echo-of-past-reading
      { text: 'Reinterpret the past — its meaning may have changed.', affinityChanges: { chaos: 5 } },
      { text: 'Acknowledge and release — the past is settled.', affinityChanges: { order: 5 } },
// dark-constellation
      { text: 'Study the negative space — what is missing matters.', affinityChanges: { order: 6 } },
      { text: 'Fill the void with your own pattern — create meaning.', affinityChanges: { chaos: 6 } },
// many-threads
      { text: 'Trace one thread backward — understand what shaped it.', affinityChanges: { order: 7 } },
      { text: 'Pluck a thread and see what unravels — test the weave.', affinityChanges: { chaos: 7 } },
```

Apply each pair/triple to its matching happening object in place (the `text` strings are unchanged — match on them).

- [ ] **Step 7: Rewrite `AffinityEngine.test.ts` for the 0–100 model**

Replace the entire contents of `src/engine/__tests__/AffinityEngine.test.ts`:

```typescript
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';
import type { TarotResult } from '../types';

const defs = AFFINITY_DEFINITIONS;

const reversedCard: TarotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'reversed', symbol: '☉',
  meaningUpright: '...', meaningReversed: '...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'reversed'],
  themes: ['stagnation', 'illumination'],
  dimensions: { favorability: -0.5, certainty: -1.5, volatility: 1.5 },
  modifierRoles: ['subject'],
};

const uprightCard: TarotResult = {
  type: 'tarot', id: 'the-star', name: 'The Star', number: 17,
  orientation: 'upright', symbol: '⭐',
  meaningUpright: 'Hope...', meaningReversed: 'Despair...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'star-archetype', 'upright'],
  themes: ['renewal', 'harmony'],
  dimensions: { favorability: 2.0, certainty: -0.5, volatility: 0.5 },
  modifierRoles: ['subject', 'effect'],
};

describe('AffinityEngine', () => {
  it('starts every affinity at baseline 50', () => {
    const e = new AffinityEngine(defs);
    const s = e.getState();
    expect(s.chaos).toBe(50);
    expect(s.order).toBe(50);
    expect(s.fate).toBe(50);
  });

  it('applyResultTags increases chaos for reversed/random results', () => {
    const e = new AffinityEngine(defs);
    e.applyResultTags(reversedCard);
    expect(e.getState().chaos).toBeGreaterThan(50);
  });

  it('applyResultTags increases order for upright results', () => {
    const e = new AffinityEngine(defs);
    e.applyResultTags(uprightCard);
    expect(e.getState().order).toBeGreaterThan(50);
  });

  it('clamps values to 0–100', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 99, order: 1 });
    e.applyResultTags(reversedCard);
    e.applyResultTags(reversedCard);
    expect(e.getState().chaos).toBeLessThanOrEqual(100);
    expect(e.getState().chaos).toBeGreaterThanOrEqual(0);
  });

  it('bandOf reports the current band of an affinity', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 85, order: 20 });
    expect(e.bandOf('chaos')).toBe('dominant');
    expect(e.bandOf('order')).toBe('latent');
  });

  it('getHint returns band flavor when out of latent, null when latent', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 70 });
    expect(e.getHint('chaos')).toBeTruthy();
    e.setState({ chaos: 10 });
    expect(e.getHint('chaos')).toBeNull(); // latent pool is empty
  });

  it('serialize and loadFrom round-trip all six', () => {
    const e = new AffinityEngine(defs);
    e.setState({ chaos: 70, order: 30, fate: 55 });
    const json = e.serialize();
    const e2 = new AffinityEngine(defs);
    e2.loadFrom(json);
    expect(e2.getState()).toEqual(e.getState());
  });
});
```

- [ ] **Step 8: Run the affinity tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/AffinityEngine.test.ts src/engine/__tests__/AffinityShift.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/data/affinities.ts src/engine/AffinityEngine.ts src/engine/GameEngine.ts src/data/happenings.ts src/engine/__tests__/AffinityEngine.test.ts src/engine/__tests__/AffinityShift.test.ts
git commit -m "feat(affinity): 0-100 shift pipeline, six definitions, run-start drift"
```

---

## Task 3: Migrate data-layer RNG consumers to 0–100

The dice/tarot/iching bias functions and `selectHappening` still multiply affinities as if 0–1. Now they receive 0–100, so normalize by dividing by 100 at the boundary. Behavior at equivalent values is preserved; the runtime mis-bias from Task 2 is gone.

**Files:**
- Modify: `src/data/dice.ts`, `src/data/tarot.ts`, `src/data/iching.ts`, `src/data/happenings.ts`
- Test: `src/engine/__tests__/Dice.test.ts`, `Tarot.test.ts`, `IChing.test.ts`

**Interfaces:**
- Consumes: affinities passed as 0–100 (`engine.getState()`).
- Produces: unchanged function signatures; internal normalization only.

- [ ] **Step 1: Update the I Ching fixture to fail on the new scale first**

In `src/engine/__tests__/IChing.test.ts` line 41, change the fixture to 0–100 so the "changing lines" expectation exercises the normalized path:

```typescript
      const result = castHexagram({ chaos: 50, order: 0 });
```

Run: `npx vitest run src/engine/__tests__/IChing.test.ts`
Expected: this test still passes structurally (it asserts validity), but confirm green before editing source. (If it asserts `changing-lines`, the un-normalized source would over-trigger; the normalization keeps it sane.)

- [ ] **Step 2: Normalize `dice.ts`**

In `src/data/dice.ts`, replace the two influence lines (lines 56–57):

```typescript
  const chaosInfluence = ((affinities.chaos ?? 0) / 100) * 4;
  const orderInfluence = ((affinities.order ?? 0) / 100) * 3;
```

- [ ] **Step 3: Normalize `tarot.ts`**

In `src/data/tarot.ts`, replace the reversal-chance lines (lines 80–81):

```typescript
  const reversalChance = 0.5 + ((affinities.chaos ?? 0) / 100) * 0.3;
  const orderMod = ((affinities.order ?? 0) / 100) * 0.2;
```

- [ ] **Step 4: Normalize `iching.ts`**

In `src/data/iching.ts`, replace the changing-bias line (line 147):

```typescript
  const changingBias = ((affinities.chaos ?? 0) / 100) * 0.2;
```

- [ ] **Step 5: Normalize `selectHappening` weighting**

In `src/data/happenings.ts`, `selectHappening` receives `chaosAffinity` on the 0–100 scale now. Normalize it inside the weight calc (lines 124–127):

```typescript
  const chaosNorm = (chaosAffinity ?? 0) / 100;
  const weighted = available.map((h) => ({
    happening: h,
    weight: 1 + (h.choices.length > 2 ? chaosNorm : 0),
  }));
```

- [ ] **Step 6: Update Dice/Tarot fixtures to 0–100**

In `src/engine/__tests__/Tarot.test.ts`, update the biased fixtures (lines 39, 50):

```typescript
      const result = drawTarotCard({ chaos: 90, order: 0 });
```
```typescript
      const result = drawTarotCard({ chaos: 0, order: 90 });
```

(`{ chaos: 0, order: 0 }` fixtures need no change — zero is zero on both scales.)

- [ ] **Step 7: Run the data-layer tests**

Run: `npx vitest run src/engine/__tests__/Dice.test.ts src/engine/__tests__/Tarot.test.ts src/engine/__tests__/IChing.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/data/dice.ts src/data/tarot.ts src/data/iching.ts src/data/happenings.ts src/engine/__tests__/Dice.test.ts src/engine/__tests__/Tarot.test.ts src/engine/__tests__/IChing.test.ts
git commit -m "refactor(affinity): normalize data-layer RNG bias to 0-100 scale"
```

---

## Task 4: Band-gate the resolver and narrative

Move the two remaining `>= 0.5` affinity checks to the band model. The `chaos-dominant` synthetic tag now injects only when Chaos is **Ascendant or higher** (a meaningful elevation, not baseline). The narrative affinity note uses `bandOf` too.

**Files:**
- Modify: `src/engine/InteractionResolver.ts`, `src/engine/NarrativeAssembler.ts`
- Test: `src/engine/__tests__/InteractionResolver.test.ts`, `NarrativeAssembler.test.ts`

**Interfaces:**
- Consumes: `bandOf` from `data/affinities`; affinities passed as 0–100.
- Produces: unchanged method signatures.

- [ ] **Step 1: Update resolver + narrative fixtures to 0–100 (expect them to still pass after source change)**

In `src/engine/__tests__/InteractionResolver.test.ts`, change all four `{ chaos: 0.3, order: 0.5 }` fixtures (lines 48, 59, 75, 94) to:

```typescript
{ chaos: 30, order: 50 }
```

In `src/engine/__tests__/NarrativeAssembler.test.ts`, rescale every `{ chaos, order }` literal by ×100. The two that assert the note (lines 219, 225) become:

```typescript
    const result = assembler.assemble(baseAggregated, [], 'decision', { chaos: 70, order: 30 });
```
```typescript
    const result = assembler.assemble(baseAggregated, [], 'decision', { chaos: 30, order: 70 });
```

All the `{ chaos: 0.4, order: 0.5 }` fixtures become `{ chaos: 40, order: 50 }`.

- [ ] **Step 2: Run to confirm the narrative-note test now fails**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts -t "affinity note"`
Expected: FAIL — source still checks `>= 0.5`, so `chaos: 70` no longer satisfies it.

- [ ] **Step 3: Band-gate `InteractionResolver`**

In `src/engine/InteractionResolver.ts`, add the import at the top:

```typescript
import { bandOf } from '../data/affinities';
```

Replace the chaos-dominant check (lines 34–35):

```typescript
        const sourceTags = [...rule.trigger.sourceTags];
        const chaosBand = bandOf(affinities.chaos ?? 0);
        if (sourceTags.includes('chaos-dominant') && (chaosBand === 'ascendant' || chaosBand === 'dominant')) {
```

- [ ] **Step 4: Band-gate the narrative affinity note**

In `src/engine/NarrativeAssembler.ts`, add the import:

```typescript
import { bandOf } from '../data/affinities';
```

Replace the affinity-note block (lines 147–152):

```typescript
    let affinityNote: string | undefined;
    const chaosBand = bandOf(affinities.chaos ?? 0);
    const orderBand = bandOf(affinities.order ?? 0);
    const isElevated = (b: string) => b === 'ascendant' || b === 'dominant';
    if (isElevated(chaosBand)) {
      affinityNote = 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.';
    } else if (isElevated(orderBand)) {
      affinityNote = 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.';
    }
```

Replace the LLM hint line (line 208) to use bands:

```typescript
    lines.push(`**Affinity hints:** ${isElevatedChaos ? 'High Chaos - volatile and unpredictable' : isElevatedOrder ? 'High Order - steady and clear' : 'Balanced - neutral currents'}`);
```

and define the two locals just above that `lines.push` (after the existing `lines.push` for question type):

```typescript
    const isElevatedChaos = (() => { const b = bandOf(run.affinities.chaos ?? 0); return b === 'ascendant' || b === 'dominant'; })();
    const isElevatedOrder = (() => { const b = bandOf(run.affinities.order ?? 0); return b === 'ascendant' || b === 'dominant'; })();
```

- [ ] **Step 5: Run the resolver + narrative tests**

Run: `npx vitest run src/engine/__tests__/InteractionResolver.test.ts src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/engine/InteractionResolver.ts src/engine/NarrativeAssembler.ts src/engine/__tests__/InteractionResolver.test.ts src/engine/__tests__/NarrativeAssembler.test.ts
git commit -m "refactor(affinity): band-gate chaos-dominant injection and narrative note"
```

---

## Task 5: Event-resolved Chaos effects + guaranteed-fire flag

Add the two Chaos-Dominant event-resolved decisions (`maybeWildSurge`, `maybeHappeningInterrupt`) as engine methods rolled at the decision site, each honoring `state.debugForcedEffect` for guaranteed firing. Wire wild-surge into `completeMinigame` and route the happening trigger through `maybeHappeningInterrupt`.

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: `AffinityEngine.resolveBand`, `BAND_ORDER` from `data/affinities`, `orchestrator.drawSingleResult`.
- Produces:
  - `GameEngine.maybeWildSurge(result: SlotResult): boolean` (appends a second result when it fires)
  - `GameEngine.maybeHappeningInterrupt(): boolean`
  - private `forcedOrRoll(effectId: string, affinity: AffinityId, minBand: AffinityBand, baseChance: number): boolean`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/GameEngine.test.ts` (inside the existing top-level scope; if the file has no helper to reach a minigame, drive the public API as below):

```typescript
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

function diceResult(): DiceResult {
  return {
    type: 'd20', result: 11, threshold: 'neutral',
    interpretation: '...', tags: ['roll', 'random', 'numeric', 'threshold', 'neutral'],
    themes: ['harmony'], dimensions: { favorability: 0, certainty: -1, volatility: 0 }, modifierRoles: ['effect'],
  };
}

describe('GameEngine — event-resolved Chaos effects', () => {
  it('maybeWildSurge fires with probability 1 when debugForcedEffect names it, then clears the flag', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    engine.selectMethod(0);
    // Force the flag via loadState (debug-only path)
    engine.loadState({ debugForcedEffect: 'wild-surge' });
    const before = engine.getState().turnResults.length;
    const fired = engine.maybeWildSurge(diceResult());
    expect(fired).toBe(true);
    expect(engine.getState().turnResults.length).toBe(before + 1);
    expect(engine.getState().debugForcedEffect).toBeNull();
  });

  it('maybeWildSurge does not fire when chaos is latent and unforced', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    engine.loadState({ affinities: { ...engine.getState().affinities, chaos: 10 } });
    const orig = Math.random;
    Math.random = () => 0.99; // above any base chance
    const fired = engine.maybeWildSurge(diceResult());
    Math.random = orig;
    expect(fired).toBe(false);
  });

  it('maybeHappeningInterrupt fires with probability 1 when forced', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    engine.loadState({ debugForcedEffect: 'happening-interrupt' });
    expect(engine.maybeHappeningInterrupt()).toBe(true);
    expect(engine.getState().debugForcedEffect).toBeNull();
  });
});
```

> Note: `loadState({ affinities })` calls `affinityEngine.setState`, so forcing `chaos: 10` lands in the engine. `debugForcedEffect` is a plain `GameState` field, set via `loadState` and read by the methods below.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "event-resolved Chaos"`
Expected: FAIL — methods do not exist.

- [ ] **Step 3: Add `forcedOrRoll` + the two methods**

In `src/engine/GameEngine.ts`, add `BAND_ORDER` and `AFFINITY_DEFINITIONS` (already imported) usage. Add to the affinities import:

```typescript
import { AFFINITY_DEFINITIONS, defaultAffinityState, BAND_ORDER } from '../data/affinities';
```

Add these methods to the class (place them just above `// ---------- State access ----------`):

```typescript
  // ---------- Event-resolved affinity decisions ----------

  // Returns true if the named effect should fire now: guaranteed when the debug
  // flag names it (flag then clears), otherwise band-gated × base chance.
  private forcedOrRoll(
    effectId: string,
    affinity: AffinityId,
    minBand: AffinityBand,
    baseChance: number,
  ): boolean {
    if (this.state.debugForcedEffect === effectId) {
      this.state.debugForcedEffect = null;
      return true;
    }
    const band = this.affinityEngine.resolveBand(affinity);
    if (BAND_ORDER.indexOf(band) < BAND_ORDER.indexOf(minBand)) return false;
    return Math.random() < baseChance;
  }

  // Chaos-Dominant wild surge: a committed result can spawn a second (Major, ~8%).
  maybeWildSurge(result: SlotResult): boolean {
    if (result.type === 'happening') return false;
    if (!this.forcedOrRoll('wild-surge', 'chaos', 'dominant', 0.08)) return false;
    const affinities = this.affinityEngine.getState();
    const second = this.orchestrator.drawSingleResult(
      result.type as 'tarot' | 'd20' | 'iching',
      affinities,
    );
    this.state.turnResults = [...this.state.turnResults, second];
    this.bus.emit('minigame-complete', { result: second, wildSurge: true });
    return true;
  }

  // Chaos-Dominant happening interrupt (Major); folds in the prior frequency roll.
  maybeHappeningInterrupt(): boolean {
    if (this.state.debugForcedEffect === 'happening-interrupt') {
      this.state.debugForcedEffect = null;
      return true;
    }
    const chaos = this.affinityEngine.getState().chaos;
    if (chaos < 40) return false;
    return Math.random() < (chaos / 100) * 0.5;
  }
```

Add the needed imports to the type import on line 1 (extend it):

```typescript
import type { GameState, QuestionType, AffinityId, AffinityBand, SlotResult, RunRecord, PendingEffect, InteractionEvent } from './types';
```

- [ ] **Step 4: Wire wild-surge and the interrupt into `completeMinigame`**

In `completeMinigame`, immediately after `this.affinityEngine.applyResultTags(result);` (the block from Task 2 Step 5), add:

```typescript
      this.affinityEngine.applyResultTags(result);
      this.maybeWildSurge(result);
```

Replace the happening-trigger conditional (the Task 2 normalized block) with the method call:

```typescript
      this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');

      if (this.maybeHappeningInterrupt()) {
        this.triggerHappening();
        return;
      } else {
        const affinities = this.affinityEngine.getState();
```

(The `const chaos = ...; if (chaos >= 40 && ...)` lines are replaced by the `maybeHappeningInterrupt()` call; everything in the `else` branch is unchanged.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(affinity): Chaos-Dominant wild surge + happening interrupt with forced-fire flag"
```

---

## Task 6: Debug scenario infrastructure (sectioned + routed + Chaos/Order)

Add `group` to scenarios, fix the affinity-routing bug (scenario affinities must go through the engine before `notify()`), add `debugForcedEffect` to event-resolved scenarios, build the Chaos/Order scenario set, and render the dropdown as `<optgroup>` sections.

**Files:**
- Modify: `src/engine/scenarios.ts`, `src/engine/GameEngine.ts`, `src/components/debug/DebugPanel.tsx`
- Create: `src/engine/__tests__/Scenarios.test.ts`

**Interfaces:**
- Consumes: `AffinityEngine.setState`, `defaultAffinityState`.
- Produces:
  - `ScenarioPreset { id: string; label: string; group: string; apply: (state: GameState) => ScenarioAffinityPatch | void }`
  - `type ScenarioAffinityPatch = Partial<Record<AffinityId, number>>`
  - `loadScenario(presetId, state): ScenarioAffinityPatch | null` (returns the patch, or `null` if not found)
  - `GameEngine.getScenarioPresets(): { id: string; label: string; group: string }[]`
  - `GameEngine.loadScenarioById(presetId: string): boolean` (applies the patch through the engine before `notify()`)

- [ ] **Step 1: Write the failing scenario-routing test**

Create `src/engine/__tests__/Scenarios.test.ts`:

```typescript
import { GameEngine } from '../GameEngine';

describe('debug scenarios', () => {
  it('exposes a group for every preset', () => {
    const engine = new GameEngine();
    const presets = engine.getScenarioPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) expect(typeof p.group).toBe('string');
  });

  it('scenario affinity setup routes through the engine and survives notify()', () => {
    const engine = new GameEngine();
    let snapshot = engine.getState();
    const unsub = engine.subscribe((s) => { snapshot = s; });
    const ok = engine.loadScenarioById('chaos-wild-surge');
    expect(ok).toBe(true);
    // chaos-wild-surge sets Chaos to Dominant (>= 82); it must NOT be clobbered by notify()
    expect(snapshot.affinities.chaos).toBeGreaterThanOrEqual(82);
    unsub();
  });

  it('event-resolved scenarios set debugForcedEffect', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('chaos-wild-surge');
    expect(engine.getState().debugForcedEffect).toBe('wild-surge');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts`
Expected: FAIL — `group` missing, scenario id unknown, affinity clobbered.

- [ ] **Step 3: Rewrite `scenarios.ts` with groups, patches, and Chaos/Order presets**

Replace `src/engine/scenarios.ts` entirely:

```typescript
import type { GameState, PendingEffect, SlotResult, AffinityId } from './types';
import { MAJOR_ARCANA } from '../data/tarot';

export type ScenarioAffinityPatch = Partial<Record<AffinityId, number>>;

export interface ScenarioPreset {
  id: string;
  label: string;
  group: string;
  // Mutate non-affinity state; return an affinity patch (applied via the engine).
  apply: (state: GameState) => ScenarioAffinityPatch | void;
}

const base = (sourceCard: string, action: PendingEffect['action'], triggerTags: string[], description: string): PendingEffect => ({
  id: `debug-${sourceCard}`,
  sourceRunId: 'debug-run',
  sourceCard,
  sourceSlotIndex: 0,
  triggerTags,
  action,
  description,
  expiresAfter: 3,
  turnsRemaining: 3,
});

const foolTarotResult = (): SlotResult => {
  const card = MAJOR_ARCANA.find((c) => c.id === 'the-fool')!;
  return {
    type: 'tarot', id: card.id, name: card.name, number: card.number,
    orientation: 'upright', symbol: card.symbol,
    meaningUpright: card.meaningUpright, meaningReversed: card.meaningReversed,
    tags: ['draw', 'random', 'major-arcana', 'reversible', card.archetypeTag, 'upright'],
    themes: ['renewal', 'mystery'],
    dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
    modifierRoles: ['subject'],
  } as SlotResult;
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  // ── Meta-Interactions (existing five) ──
  {
    id: 'fools-reroll', label: "Fool's Reroll", group: 'Meta-Interactions',
    apply: (state) => {
      state.turnResults = [foolTarotResult()];
      state.minigamesCompleted = 1;
      state.pendingEffects = [base('The Fool', 'reroll', ['roll', 'numeric'], "The Fool's wild energy ripples through fate — the dice must be cast again.")];
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
    },
  },
  {
    id: 'critical-low-flip', label: 'Critical Flip', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Critical Roll', 'flip', ['major-arcana', 'reversible'], 'A dire omen from the dice — the cards tremble and turn.')];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'iching-boost', label: 'I Ching Boost', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Hexagram', 'add-choice', ['event', 'happening'], 'The changing lines reveal hidden branches — more choices emerge.')];
      state.selectedMethod = 'iching';
      state.screen = 'minigame';
    },
  },
  {
    id: 'mirror-event', label: 'Mirror Event', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Mirrored Card', 'mirror', ['reversible'], 'Two forces reflect each other across the weave — both turn.')];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'chaos-surge', label: 'Chaos Surge (pending)', group: 'Meta-Interactions',
    apply: (state) => {
      state.pendingEffects = [base('Chaos', 'second-result', [], 'Chaos surges — a second possibility emerges from the void.')];
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      return { chaos: 85 };
    },
  },

  // ── Chaos / Order ──
  {
    id: 'chaos-wild-surge', label: 'Wild Surge — Chaos Dominant', group: 'Chaos / Order',
    apply: (state) => {
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      state.debugForcedEffect = 'wild-surge';
      return { chaos: 90, order: 15 };
    },
  },
  {
    id: 'chaos-happening-interrupt', label: 'Happening Interrupt — Chaos Dominant', group: 'Chaos / Order',
    apply: (state) => {
      state.turnResults = [foolTarotResult()];
      state.minigamesCompleted = 1;
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      state.debugForcedEffect = 'happening-interrupt';
      return { chaos: 90, order: 15 };
    },
  },
  {
    id: 'chaos-volatile-dice', label: 'Volatile Dice — Chaos Ascendant', group: 'Chaos / Order',
    apply: (state) => {
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      return { chaos: 75, order: 25 };
    },
  },
  {
    id: 'order-steady-dice', label: 'Steady Dice — Order Ascendant', group: 'Chaos / Order',
    apply: (state) => {
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
      return { order: 75, chaos: 25 };
    },
  },
];

// Returns the affinity patch to route through the engine, or null if id unknown.
export function loadScenario(presetId: string, state: GameState): ScenarioAffinityPatch | null {
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const patch = preset.apply(state);
  return patch ?? {};
}
```

- [ ] **Step 4: Route the patch through the engine in `GameEngine`**

In `src/engine/GameEngine.ts`, replace `loadScenarioById` and `getScenarioPresets`:

```typescript
  loadScenarioById(presetId: string): boolean {
    const patch = loadScenario(presetId, this.state);
    if (patch === null) return false;
    // Affinities must go through the engine BEFORE notify(), which overwrites
    // state.affinities from the engine. Routing here fixes the old clobber bug.
    this.affinityEngine.setState(patch);
    this.notify();
    return true;
  }

  getScenarioPresets() {
    return SCENARIO_PRESETS.map((p) => ({ id: p.id, label: p.label, group: p.group }));
  }
```

(The `loadScenario` import on line 12 is unchanged.)

- [ ] **Step 5: Render `<optgroup>` sections in `DebugPanel`**

In `src/components/debug/DebugPanel.tsx`, replace the `presets` `<select>` body (lines 86–91) with grouped rendering. First, group the presets just after `const presets = engine.getScenarioPresets();` (line 16):

```typescript
  const presets = engine.getScenarioPresets();
  const groupedPresets = presets.reduce<Record<string, typeof presets>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});
```

Then replace the `{presets.map(...)}` block inside the `<select>`:

```tsx
            <option value="">-- Select --</option>
            {Object.entries(groupedPresets).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
```

- [ ] **Step 6: Run the scenario tests**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc -b`
Expected: no errors.

```bash
git add src/engine/scenarios.ts src/engine/GameEngine.ts src/components/debug/DebugPanel.tsx src/engine/__tests__/Scenarios.test.ts
git commit -m "feat(debug): sectioned scenario dropdown, affinity routing fix, Chaos/Order scenarios"
```

---

## Task 7: Integration verification gate

Run the whole suite and the production build to catch cross-file type drift, then commit any straggler fixes.

**Files:**
- Verify only; fix any failures inline in the file that owns them.

- [ ] **Step 1: Run the full engine test suite**

Run: `npm test`
Expected: all suites PASS. If a suite fails because a fixture still pins chaos/order at 0–1, rescale that fixture ×100 and re-run.

- [ ] **Step 2: Full typecheck + bundle**

Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds. If `noUnusedLocals`/`noUnusedParameters` flags a now-unused import (e.g. a removed `isDominant` reference), delete it.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the debug panel, and confirm:
- The Scenario dropdown shows **Meta-Interactions** and **Chaos / Order** sections.
- "Wild Surge — Chaos Dominant" loads to a dice minigame; completing it appends a second result.
- The State tab shows six affinities on a 0–100 scale.

- [ ] **Step 4: Final commit (only if Step 1–2 required fixes)**

```bash
git add -A
git commit -m "test(affinity): rescale remaining fixtures; green full suite + build"
```

---

## Self-Review

**Spec coverage (Phase 1 scope per §13):**
- 0–100 migration → Tasks 1–3, 6 (scenarios), §11 migration in `loadFrom` (Task 2 Step 4, tested Task 2 Step 7).
- `shift` pipeline (DR + jitter + coupling) → Task 2 (tested AffinityShift.test.ts).
- Bands + soft reach-up → Task 1 (`bandOf`), Task 2 (`resolveBand`, tested in the "bands, reach-up, and run boundary" block).
- Run-start drift + counters → Task 2 (`beginRun`, tested); wired in `startTurn` Task 2 Step 5.
- Six affinity definitions (new four stubbed) → Task 2 Step 3.
- Hint-system rework → Task 2 (`getActiveHints`/`getHint` band pools).
- Wire Chaos/Order to existing hooks: dice bias (Task 3), happening frequency (Task 5 `maybeHappeningInterrupt`), interaction gate (Task 4), narrative clarity (Task 4).
- Debug-scenario infra: sectioned dropdown, `debugForcedEffect`, affinity-routing fix → Task 6; guaranteed fire → Task 5 (`forcedOrRoll`) + Task 6 scenarios.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output. ✔

**Type consistency:**
- `shift(id, baseDelta, sourceId)` — same 3-arg shape in engine, tests, and `GameEngine.resolveHappening`/`forcedOrRoll` call sites. ✔
- `resolveBand(id)` / `bandOf(id)` (engine instance methods) vs. `bandOf(value)` (pure data export) — distinct names by receiver; resolver/narrative import the **pure** `bandOf(value)`. ✔
- `applyResultTags(result)` replaces `apply(results[])` everywhere (GameEngine line 138, both tests). ✔
- `loadScenario` now returns `ScenarioAffinityPatch | null`; `loadScenarioById` checks `=== null`. ✔
- `ScenarioPreset.group` consumed by `getScenarioPresets` and `DebugPanel`. ✔
- `debugForcedEffect` added to `GameState` (Task 1), defaulted in `defaultState` (Task 1), read/cleared in `forcedOrRoll`/`maybeHappeningInterrupt` (Task 5), set in scenarios (Task 6). ✔

**Deferred to later phases (intentionally not in this plan):** `AffinityEffects` type + `getAffinityEffects()` (first consumer is Fate/Will hand size — Phase 2); `AffinityAction` enum and action feeds (Phase 2/3); peek/foresight + `peeksThisRun` escalation and the `−12` Light penalty path (Phase 3); Fate/Will/Light/Shadow `bandedEffects` bodies and their debug scenarios (Phases 2–3). Each is named here so the next plan picks them up.
