# Corruption Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the engine-side foundation of the corruption mechanic — a self-correcting predator scalar that seeds from affinity imbalance, grows by eroding hoarded affinities, starves when balance returns, persists across games, and triggers a Rupture that wipes affinities low.

**Architecture:** A dedicated `CorruptionEngine` subsystem (a plain 0–100 scalar with its own bands and rules, deliberately **not** in `AFFINITY_IDS`), composed by `GameEngine` alongside `AffinityEngine`. It reads the affinity vector each reading to compute its "food" (`Σ max(0, value − HIGH_THRESHOLD)`), grows via erosion + a skim on realized affinity gains, and drains the hoarded affinities back through a new `AffinityEngine.erode()`. The Rupture is detected at the reading boundary and performed by `GameEngine`.

**Tech Stack:** TypeScript (strict), Vitest (Node env, `src/engine/__tests__/**` only), in-memory `localStorage` polyfill from `vitest.setup.ts`.

## Global Constraints

- Engine code is framework-free: **zero React/DOM imports** in `src/engine/` and `src/data/`.
- The affinity system (and therefore corruption's scalar) is hidden from the player — no player-facing numbers. This plan is engine-only; UI is out of scope.
- Every mutator that changes snapshot-visible state ends by routing through `GameEngine.notify()` (deep-clones `state` into `cachedSnapshot`).
- Corruption is **not** an affinity: it is never added to `AFFINITY_IDS`, never coupled, never drifted, never paired.
- Carryover rule (matches `affinities`/`history`): corruption **persists** across `reset`, `returnToTitle`, `returnToQuestionSelect`, and the localStorage save; it is cleared only by `clearHistory` and the Rupture.
- Balance invariant: corruption never accelerates affinity accumulation. (No gain-pipeline changes in this plan.)
- Typecheck with `npx tsc -b`; run tests with `npx vitest run <file>`.
- Tuning values in this plan are playtest defaults; they live as named constants in `src/data/corruption.ts` so later tuning is one-file.

---

### Task 1: Corruption types + data module

**Files:**
- Modify: `src/engine/types.ts` (add `CorruptionBand`, `CorruptionSnapshot` near the `AffinityBand` block, ~line 45)
- Create: `src/data/corruption.ts`
- Test: `src/engine/__tests__/CorruptionData.test.ts`

**Interfaces:**
- Produces:
  - `type CorruptionBand = 'dormant' | 'seeded' | 'spreading' | 'virulent' | 'pinnacle'`
  - `interface CorruptionSnapshot { value: number; band: CorruptionBand }`
  - `corruptionFood(affinities: Record<AffinityId, number>): number`
  - `corruptionBandOf(value: number): CorruptionBand`
  - `seedChance(food: number): number`
  - constants: `HIGH_THRESHOLD, SEED_INITIAL, SEED_FOOD_FACTOR, SEED_MAX_CHANCE, EROSION_RATE, SKIM_RATE, DRAIN_RATE, DECAY_RATE, PINNACLE, RUPTURE_RESET`

- [ ] **Step 1: Add the corruption types to `src/engine/types.ts`**

Insert directly after the `export type AffinityBand = ...` line (~line 45):

```typescript
// ── Corruption (a predator from beyond the six affinities; not an AffinityId) ──
export type CorruptionBand = 'dormant' | 'seeded' | 'spreading' | 'virulent' | 'pinnacle';

export interface CorruptionSnapshot {
  value: number;       // 0–100 scalar
  band: CorruptionBand;
}
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/CorruptionData.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  corruptionFood, corruptionBandOf, seedChance,
  HIGH_THRESHOLD, SEED_MAX_CHANCE, PINNACLE,
} from '../../data/corruption';
import type { AffinityId } from '../types';

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> => ({
  chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over,
});

describe('corruptionFood', () => {
  it('is zero when nothing exceeds the high threshold', () => {
    expect(corruptionFood(vec({ chaos: HIGH_THRESHOLD }))).toBe(0);
  });

  it('sums only the excess above the high threshold across all six', () => {
    // chaos 91 → +10, order 86 → +5, rest at/below threshold → +0
    expect(corruptionFood(vec({ chaos: 91, order: 86 }))).toBe(15);
  });

  it('counts two maxed affinities as much as the spread (concentration is punished)', () => {
    const twoMaxed = corruptionFood(vec({ chaos: 100, order: 100 }));     // 19 + 19 = 38
    const fourHigh = corruptionFood(vec({ chaos: 90, order: 90, fate: 90, will: 90 })); // 9*4 = 36
    expect(twoMaxed).toBeGreaterThanOrEqual(fourHigh - 5);
  });
});

describe('corruptionBandOf', () => {
  it('maps the scalar onto escalating bands', () => {
    expect(corruptionBandOf(0)).toBe('dormant');
    expect(corruptionBandOf(5)).toBe('seeded');
    expect(corruptionBandOf(34)).toBe('seeded');
    expect(corruptionBandOf(35)).toBe('spreading');
    expect(corruptionBandOf(66)).toBe('spreading');
    expect(corruptionBandOf(67)).toBe('virulent');
    expect(corruptionBandOf(99)).toBe('virulent');
    expect(corruptionBandOf(PINNACLE)).toBe('pinnacle');
  });
});

describe('seedChance', () => {
  it('is zero with no food (no imbalance → no corruption, ever)', () => {
    expect(seedChance(0)).toBe(0);
  });

  it('scales with food and is capped', () => {
    expect(seedChance(10)).toBeGreaterThan(0);
    expect(seedChance(100_000)).toBe(SEED_MAX_CHANCE);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionData.test.ts`
Expected: FAIL — cannot resolve `../../data/corruption`.

- [ ] **Step 4: Create `src/data/corruption.ts`**

```typescript
import type { AffinityId, CorruptionBand } from '../engine/types';
import { AFFINITY_IDS } from './affinities';

export const CORRUPTION_BANDS: CorruptionBand[] =
  ['dormant', 'seeded', 'spreading', 'virulent', 'pinnacle'];

// ── Imbalance metric ──
// Affinity points above this threshold count as "excess" — the food corruption eats.
export const HIGH_THRESHOLD = 81; // the ascendant boundary

// ── Lifecycle tuning (playtest defaults) ──
export const SEED_INITIAL = 5;         // value the moment corruption spawns
export const SEED_FOOD_FACTOR = 0.004; // per-reading seed chance added per excess point
export const SEED_MAX_CHANCE = 0.25;   // cap on the per-reading seed chance
export const EROSION_RATE = 0.06;      // corruption gained per excess point per reading (primary growth)
export const SKIM_RATE = 0.10;         // corruption gained per realized affinity-gain point (secondary)
export const DRAIN_RATE = 0.04;        // fraction of each affinity's excess drained into corruption per reading
export const DECAY_RATE = 8;           // corruption lost per reading while starved (food === 0)
export const PINNACLE = 100;           // value at/above which the Rupture fires
export const RUPTURE_RESET = 25;       // every affinity is reset to this (latent) after a Rupture

// Σ of how far each affinity sits above the high threshold = distance from the
// natural order = the imbalance corruption feeds on.
export function corruptionFood(affinities: Record<AffinityId, number>): number {
  let food = 0;
  for (const id of AFFINITY_IDS) food += Math.max(0, affinities[id] - HIGH_THRESHOLD);
  return food;
}

export function corruptionBandOf(value: number): CorruptionBand {
  if (value <= 0) return 'dormant';
  if (value >= PINNACLE) return 'pinnacle';
  if (value <= 34) return 'seeded';
  if (value <= 66) return 'spreading';
  return 'virulent';
}

// No imbalance → zero chance. Otherwise scales with food, capped.
export function seedChance(food: number): number {
  if (food <= 0) return 0;
  return Math.min(SEED_MAX_CHANCE, food * SEED_FOOD_FACTOR);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionData.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/data/corruption.ts src/engine/__tests__/CorruptionData.test.ts
git commit -m "feat(corruption): add corruption types, tuning constants, and imbalance metric"
```

---

### Task 2: CorruptionEngine class

**Files:**
- Create: `src/engine/CorruptionEngine.ts`
- Test: `src/engine/__tests__/CorruptionEngine.test.ts`

**Interfaces:**
- Consumes: everything from `src/data/corruption.ts` (Task 1); `AFFINITY_IDS` from `src/data/affinities`; `AffinityId`, `CorruptionBand` from `src/engine/types`.
- Produces:
  - `interface CorruptionTickResult { value: number; band: CorruptionBand; seeded: boolean; drains: Partial<Record<AffinityId, number>>; ruptured: boolean }`
  - `class CorruptionEngine` with:
    - `getValue(): number` (rounded), `getBand(): CorruptionBand`
    - `setValue(v: number): void`, `clear(): void`
    - `tick(affinities: Record<AffinityId, number>, realizedGains: number, rng?: () => number): CorruptionTickResult`
    - `serialize(): string`, `loadFrom(json: string): void`

- [ ] **Step 1: Write the failing test** at `src/engine/__tests__/CorruptionEngine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { CorruptionEngine } from '../CorruptionEngine';
import { SEED_INITIAL, DECAY_RATE, RUPTURE_RESET } from '../../data/corruption';
import type { AffinityId } from '../types';

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> => ({
  chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over,
});
const balanced = vec({});
const hoarded = vec({ chaos: 100, order: 100 }); // food = 38

describe('CorruptionEngine.tick — dormant', () => {
  it('never seeds without imbalance, however the dice fall', () => {
    const e = new CorruptionEngine();
    const r = e.tick(balanced, 0, () => 0); // rng=0 would pass any positive chance
    expect(r.seeded).toBe(false);
    expect(r.value).toBe(0);
    expect(r.band).toBe('dormant');
  });

  it('seeds from imbalance when the roll passes', () => {
    const e = new CorruptionEngine();
    const r = e.tick(hoarded, 0, () => 0); // 0 < seedChance(38)
    expect(r.seeded).toBe(true);
    expect(r.value).toBe(SEED_INITIAL);
    expect(r.band).toBe('seeded');
  });

  it('does not seed when the roll fails', () => {
    const e = new CorruptionEngine();
    const r = e.tick(hoarded, 0, () => 0.99);
    expect(r.seeded).toBe(false);
    expect(e.getValue()).toBe(0);
  });
});

describe('CorruptionEngine.tick — active', () => {
  it('grows while fed (erosion + skim) and reports drains on the hoarded affinities', () => {
    const e = new CorruptionEngine();
    e.setValue(50);
    const r = e.tick(hoarded, 10, () => 0.99); // food 38 → erosion; gains 10 → skim
    expect(r.value).toBeGreaterThan(50);
    expect(r.drains.chaos).toBeGreaterThan(0);
    expect(r.drains.order).toBeGreaterThan(0);
    expect(r.drains.fate).toBeUndefined(); // fate is at baseline, no excess
    expect(r.ruptured).toBe(false);
  });

  it('starves and decays when balance returns, with no drains', () => {
    const e = new CorruptionEngine();
    e.setValue(50);
    const r = e.tick(balanced, 0, () => 0.99);
    expect(r.value).toBe(50 - DECAY_RATE);
    expect(r.drains).toEqual({});
  });

  it('decays to zero over repeated starved readings', () => {
    const e = new CorruptionEngine();
    e.setValue(DECAY_RATE); // one tick from gone
    const r = e.tick(balanced, 0, () => 0.99);
    expect(r.value).toBe(0);
    expect(r.band).toBe('dormant');
  });

  it('flags rupture at the pinnacle', () => {
    const e = new CorruptionEngine();
    e.setValue(99);
    const r = e.tick(hoarded, 5, () => 0.99);
    expect(r.value).toBe(100);
    expect(r.band).toBe('pinnacle');
    expect(r.ruptured).toBe(true);
  });
});

describe('CorruptionEngine persistence', () => {
  it('round-trips through serialize/loadFrom', () => {
    const e = new CorruptionEngine();
    e.setValue(42);
    const blob = e.serialize();
    const e2 = new CorruptionEngine();
    e2.loadFrom(blob);
    expect(e2.getValue()).toBe(42);
  });

  it('loadFrom tolerates garbage and falls back to 0', () => {
    const e = new CorruptionEngine();
    e.setValue(42);
    e.loadFrom('not json');
    expect(e.getValue()).toBe(0);
  });
});

describe('CorruptionEngine.setValue', () => {
  it('clamps to [0, 100]', () => {
    const e = new CorruptionEngine();
    e.setValue(-5);
    expect(e.getValue()).toBe(0);
    e.setValue(250);
    expect(e.getValue()).toBe(RUPTURE_RESET + 75); // 100
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionEngine.test.ts`
Expected: FAIL — cannot resolve `../CorruptionEngine`.

- [ ] **Step 3: Create `src/engine/CorruptionEngine.ts`**

```typescript
import type { AffinityId, CorruptionBand } from './types';
import { AFFINITY_IDS } from '../data/affinities';
import {
  corruptionFood, corruptionBandOf, seedChance,
  SEED_INITIAL, EROSION_RATE, SKIM_RATE, DRAIN_RATE, DECAY_RATE,
  HIGH_THRESHOLD, PINNACLE,
} from '../data/corruption';

export interface CorruptionTickResult {
  value: number;                                 // rounded scalar after the tick
  band: CorruptionBand;
  seeded: boolean;                               // true only on the tick it spawns
  drains: Partial<Record<AffinityId, number>>;   // positive magnitudes to subtract from each affinity
  ruptured: boolean;                             // true once the pinnacle is reached
}

// The predator. A single 0–100 scalar that lives outside the affinity laws.
// Value is kept as a float internally (so slow growth never rounds away) and
// surfaced rounded.
export class CorruptionEngine {
  private value = 0;

  getValue(): number { return Math.round(this.value); }
  getBand(): CorruptionBand { return corruptionBandOf(Math.round(this.value)); }

  setValue(v: number): void { this.value = Math.max(0, Math.min(PINNACLE, v)); }
  clear(): void { this.value = 0; }

  // Advance one completed reading. Pure except for the internal scalar.
  tick(
    affinities: Record<AffinityId, number>,
    realizedGains: number,
    rng: () => number = Math.random,
  ): CorruptionTickResult {
    const food = corruptionFood(affinities);

    // Dormant: corruption appears ONLY as a consequence of imbalance.
    if (this.value <= 0) {
      const seeded = food > 0 && rng() < seedChance(food);
      if (seeded) this.value = SEED_INITIAL;
      return this.report(seeded, {}); // a fresh seed neither drains nor ruptures this tick
    }

    // Active: grow on food, starve without it.
    const drains: Partial<Record<AffinityId, number>> = {};
    if (food > 0) {
      this.value = Math.min(PINNACLE, this.value + EROSION_RATE * food + SKIM_RATE * Math.max(0, realizedGains));
      for (const id of AFFINITY_IDS) {
        const excess = affinities[id] - HIGH_THRESHOLD;
        if (excess > 0) drains[id] = DRAIN_RATE * excess;
      }
    } else {
      this.value = Math.max(0, this.value - DECAY_RATE);
    }

    return this.report(false, drains);
  }

  private report(seeded: boolean, drains: Partial<Record<AffinityId, number>>): CorruptionTickResult {
    return {
      value: this.getValue(),
      band: this.getBand(),
      seeded,
      drains,
      ruptured: this.value >= PINNACLE,
    };
  }

  serialize(): string { return JSON.stringify({ value: this.value }); }

  loadFrom(json: string): void {
    try {
      const parsed = JSON.parse(json) as { value?: unknown };
      this.value = typeof parsed.value === 'number'
        ? Math.max(0, Math.min(PINNACLE, parsed.value))
        : 0;
    } catch {
      this.value = 0;
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/CorruptionEngine.ts src/engine/__tests__/CorruptionEngine.test.ts
git commit -m "feat(corruption): CorruptionEngine seed/grow/starve/rupture lifecycle"
```

---

### Task 3: AffinityEngine — realized-gains accumulation + erode

**Files:**
- Modify: `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/AffinityErode.test.ts`

**Interfaces:**
- Consumes: existing `AffinityEngine` (`shift`, `clamp`, `base`).
- Produces (new public methods on `AffinityEngine`):
  - `consumeRealizedGains(): number` — total positive realized gain since the last consume; resets the accumulator.
  - `erode(deltas: Partial<Record<AffinityId, number>>): void` — direct subtraction from base (no coupling, no mandate, no fan-out), clamped.

- [ ] **Step 1: Write the failing test** at `src/engine/__tests__/AffinityErode.test.ts`

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

afterEach(() => vi.restoreAllMocks());

describe('AffinityEngine.consumeRealizedGains', () => {
  it('accumulates positive realized gains and resets on consume', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter ×1.0, deterministic
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    const g1 = e.shift('order', 10, 'test');
    const g2 = e.shift('order', 10, 'test');
    expect(e.consumeRealizedGains()).toBeCloseTo(g1 + g2, 5);
    expect(e.consumeRealizedGains()).toBe(0); // reset after consume
  });

  it('ignores penalties (negative shifts contribute nothing)', () => {
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.shift('order', -10, 'test');
    expect(e.consumeRealizedGains()).toBe(0);
  });

  it('resets on beginRun', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.shift('order', 10, 'test');
    e.beginRun();
    expect(e.consumeRealizedGains()).toBe(0);
  });
});

describe('AffinityEngine.erode', () => {
  it('subtracts magnitudes directly with no coupling fan-out', () => {
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.setState({ chaos: 90, order: 90 });
    e.erode({ chaos: 10 });
    expect(e.getBase().chaos).toBe(80);
    expect(e.getBase().order).toBe(90); // untouched — no fan-out to the opposite
  });

  it('clamps at zero', () => {
    const e = new AffinityEngine(AFFINITY_DEFINITIONS);
    e.setState({ chaos: 5 });
    e.erode({ chaos: 20 });
    expect(e.getBase().chaos).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityErode.test.ts`
Expected: FAIL — `consumeRealizedGains`/`erode` are not functions.

- [ ] **Step 3: Add the accumulator field**

In `src/engine/AffinityEngine.ts`, add a field beside `fortuneTagFeedThisRun` (~line 31):

```typescript
  private realizedGainsThisReading = 0;
```

- [ ] **Step 4: Accumulate realized gains inside `shift`**

In `shift`, in the gain branch, immediately after `this.base[id] = this.clamp(this.base[id] + gain);` (~line 204), add:

```typescript
    this.realizedGainsThisReading += gain;
```

- [ ] **Step 5: Reset the accumulator where the other per-run counters reset**

In `clearModifiers()`, after `this.fortuneTagFeedThisRun = 0;` (~line 174), add:

```typescript
    this.realizedGainsThisReading = 0;
```

In `beginRun()`, after `this.fortuneTagFeedThisRun = 0;` (~line 300), add:

```typescript
    this.realizedGainsThisReading = 0;
```

- [ ] **Step 6: Add the two public methods**

In `src/engine/AffinityEngine.ts`, add after `applyAction(...)` (~line 232):

```typescript
  // Total positive realized gain since the last consume; resets the accumulator.
  // The CorruptionEngine reads this each reading to apply its skim-on-gain.
  consumeRealizedGains(): number {
    const g = this.realizedGainsThisReading;
    this.realizedGainsThisReading = 0;
    return g;
  }

  // Direct, lawless subtraction from base — no coupling, no mandate, no fan-out.
  // Corruption drains hoarded affinities through this; the world's laws do not apply.
  erode(deltas: Partial<Record<AffinityId, number>>): void {
    for (const [id, mag] of Object.entries(deltas)) {
      if (typeof mag === 'number') {
        this.base[id as AffinityId] = this.clamp(this.base[id as AffinityId] - mag);
      }
    }
  }
```

- [ ] **Step 7: Run the new test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinityErode.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the existing affinity suite to confirm no regressions**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/AffinityActions.test.ts`
Expected: PASS (accumulation is additive-only; no existing behavior changes).

- [ ] **Step 9: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinityErode.test.ts
git commit -m "feat(corruption): AffinityEngine realized-gains accumulator + lawless erode()"
```

---

### Task 4: GameEngine — compose CorruptionEngine, lifecycle tick, Rupture

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Modify: `src/engine/types.ts` (add `corruption` to `GameState`, ~line 559)
- Test: `src/engine/__tests__/CorruptionLifecycle.test.ts`

**Interfaces:**
- Consumes: `CorruptionEngine`, `CorruptionTickResult` (Task 2); `AffinityEngine.consumeRealizedGains`/`erode` (Task 3); `corruptionFood`, `RUPTURE_RESET`, `AFFINITY_IDS`.
- Produces (new public surface on `GameEngine`):
  - `setCorruption(value: number): void` — debug/test setter; notifies.
  - `GameState.corruption: CorruptionSnapshot` on every snapshot.

- [ ] **Step 1: Add `corruption` to `GameState`**

In `src/engine/types.ts`, in the `GameState` interface, add after `affinityBase` (~line 562):

```typescript
  corruption: CorruptionSnapshot;
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/CorruptionLifecycle.test.ts`

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';
import { RUPTURE_RESET } from '../../data/corruption';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

// Drive exactly one completed reading: commit a die, drain any queued effect
// batch (so the deferred review beat actually arms), then release the review beat
// (where advanceAfterCommit — and thus the corruption tick — runs).
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('GameEngine corruption lifecycle', () => {
  it('exposes a dormant corruption snapshot by default', () => {
    const e = new GameEngine(3);
    expect(e.getState().corruption).toEqual({ value: 0, band: 'dormant' });
  });

  it('grows corruption and erodes hoarded affinities across a reading', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // suppress procs + seeding noise
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(50);

    oneReading(e);

    const s = e.getState();
    expect(s.corruption.value).toBeGreaterThan(50); // erosion + skim
    expect(s.affinityBase.chaos).toBeLessThan(100); // hoard bled down
  });

  it('performs the Rupture at the pinnacle: affinities reset low, corruption gone', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 100, will: 100, light: 100, shadow: 100 } });
    e.setCorruption(99);

    oneReading(e);

    const s = e.getState();
    expect(s.corruption.value).toBe(0);
    expect(s.corruption.band).toBe('dormant');
    expect(s.affinityBase.chaos).toBe(RUPTURE_RESET);
    expect(s.affinityBase.shadow).toBe(RUPTURE_RESET);
  });

  it('never seeds corruption from a balanced world', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // would pass any positive seed chance
    const e = new GameEngine(3);
    e.startTurn('self'); // all affinities at baseline 50 → no food
    oneReading(e);
    expect(e.getState().corruption.value).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionLifecycle.test.ts`
Expected: FAIL — `setCorruption` is not a function / `corruption` missing on state.

- [ ] **Step 4: Import and compose the CorruptionEngine**

In `src/engine/GameEngine.ts`:

Add imports near the other engine imports (~line 4) and the affinities import (~line 8):

```typescript
import { CorruptionEngine } from './CorruptionEngine';
```

Change the affinities import (line 8) to also pull `AFFINITY_IDS`:

```typescript
import { AFFINITY_DEFINITIONS, defaultAffinityState, AFFINITY_IDS } from '../data/affinities';
```

Add the corruption tuning import (near line 9):

```typescript
import { RUPTURE_RESET } from '../data/corruption';
```

Add the field beside `affinityEngine` (~line 36):

```typescript
  private corruptionEngine: CorruptionEngine;
```

Instantiate it in the constructor, right after `this.affinityEngine = ...` (~line 57):

```typescript
    this.corruptionEngine = new CorruptionEngine();
```

- [ ] **Step 5: Default the snapshot field**

In `defaultState()`, add after `affinityBase: defaultAffinityState(),` (~line 72):

```typescript
      corruption: { value: 0, band: 'dormant' },
```

- [ ] **Step 6: Populate corruption on every snapshot**

In `notify()`, after the `this.state.affinityEffects = ...` lines (~line 102), add:

```typescript
    this.state.corruption = { value: this.corruptionEngine.getValue(), band: this.corruptionEngine.getBand() };
```

- [ ] **Step 7: Run the corruption tick at the reading boundary**

In `advanceAfterCommit`, immediately after `this.affinityEngine.tickModifiers();` (~line 489), add:

```typescript
    this.applyCorruptionTick();
```

- [ ] **Step 8: Add the tick + Rupture private methods, and the debug setter**

In `src/engine/GameEngine.ts`, add right after `advanceAfterCommit(...)` (~line 525):

```typescript
  // Once per completed reading: grow/seed/starve corruption off the current
  // imbalance, bleed the hoarded affinities down, and fire the Rupture at the pinnacle.
  private applyCorruptionTick(): void {
    const gains = this.affinityEngine.consumeRealizedGains();
    const tick = this.corruptionEngine.tick(this.affinityEngine.getState(), gains);
    if (Object.keys(tick.drains).length > 0) this.affinityEngine.erode(tick.drains);
    if (tick.ruptured) this.performRupture();
  }

  // The Rupture: reality tears, the world re-forms low, and corruption vanishes
  // without a trace. (The between-worlds interstitial is UI, handled in a later plan.)
  private performRupture(): void {
    const reset = AFFINITY_IDS.reduce(
      (acc, id) => ((acc[id] = RUPTURE_RESET), acc),
      {} as Record<AffinityId, number>,
    );
    this.affinityEngine.setState(reset);
    this.affinityEngine.clearModifiers();
    this.corruptionEngine.clear();
    this.bus.emit('corruption-ruptured', {});
  }

  // Debug/test setter for the corruption scalar.
  setCorruption(value: number): void {
    this.corruptionEngine.setValue(value);
    this.notify();
  }
```

- [ ] **Step 9: Add the `corruption-ruptured` event type**

In `src/engine/types.ts`, in the `EventType` union (~line 430), add a member:

```typescript
  | 'corruption-ruptured'
```

- [ ] **Step 10: Clear corruption on fresh-game debug load**

In `loadScenarioById`, after `this.affinityEngine.clearModifiers();` (~line 1324), add:

```typescript
    this.corruptionEngine.clear();
```

- [ ] **Step 11: Run the lifecycle test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionLifecycle.test.ts`
Expected: PASS.

- [ ] **Step 12: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS (the new `GameState.corruption` field is additive; no existing assertions touch it).

- [ ] **Step 13: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/types.ts src/engine/__tests__/CorruptionLifecycle.test.ts
git commit -m "feat(corruption): wire CorruptionEngine into the reading loop + Rupture"
```

---

### Task 5: Persistence carryover

**Files:**
- Modify: `src/engine/GameEngine.ts` (`saveToStorage`, `loadFromStorage`, `clearHistory`)
- Test: `src/engine/__tests__/CorruptionPersistence.test.ts`

**Interfaces:**
- Consumes: `CorruptionEngine.serialize()`/`loadFrom()`/`clear()` (Task 2); `setCorruption` (Task 4).
- Produces: corruption included in the `fate-atlas-save` localStorage blob; preserved by `reset`/`returnToTitle` (which call `saveToStorage` and never touch the engine instance); cleared by `clearHistory`.

- [ ] **Step 1: Write the failing test** at `src/engine/__tests__/CorruptionPersistence.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';

beforeEach(() => localStorage.clear());

describe('corruption persistence', () => {
  it('saves corruption and reloads it into a fresh engine', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.saveToStorage();

    const e2 = new GameEngine(3);
    e2.loadFromStorage();
    expect(e2.getState().corruption.value).toBe(42);
  });

  it('preserves corruption across reset (carryover, like affinities)', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.reset();
    expect(e.getState().corruption.value).toBe(42);
  });

  it('preserves corruption across returnToTitle', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.returnToTitle();
    expect(e.getState().corruption.value).toBe(42);
  });

  it('clears corruption on clearHistory', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.clearHistory();
    expect(e.getState().corruption.value).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionPersistence.test.ts`
Expected: FAIL — reloaded/cleared corruption does not match (not yet persisted).

- [ ] **Step 3: Write corruption into the save blob**

In `saveToStorage()`, add `corruption` to the `data` object (~line 1357):

```typescript
      const data = {
        affinities: this.affinityEngine.serialize(),
        corruption: this.corruptionEngine.serialize(),
        history: this.state.history,
        usedHappeningIds: Array.from(this.usedHappeningIds),
      };
```

- [ ] **Step 4: Read corruption back on load**

In `loadFromStorage()`, after `if (data.affinities) this.affinityEngine.loadFrom(data.affinities);` (~line 1373), add:

```typescript
      if (data.corruption) this.corruptionEngine.loadFrom(data.corruption);
```

- [ ] **Step 5: Clear corruption in `clearHistory`**

In `clearHistory()`, after `this.affinityEngine.clearModifiers();` (~line 1490), add:

```typescript
    this.corruptionEngine.clear();
```

- [ ] **Step 6: Run the persistence test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionPersistence.test.ts`
Expected: PASS. (`reset`/`returnToTitle` already pass because they preserve the `corruptionEngine` instance and re-emit via `notify`.)

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/CorruptionPersistence.test.ts
git commit -m "feat(corruption): persist corruption across saves and carryover boundaries"
```

---

### Task 6: Documentation sync

**Files:**
- Modify: `docs/game-systems.md` (add a top-level Corruption section)
- Modify: `README.md` (add a brief player-facing note)

**Interfaces:** none (docs only). Required by `CLAUDE.md`: affinity/effect system changes update `docs/game-systems.md` and the README in the same change.

- [ ] **Step 1: Add the Corruption section to `docs/game-systems.md`**

Append this section (place it after the affinities/bands material; match the file's existing heading depth):

```markdown
## Corruption (engine foundation)

Corruption is a self-correcting predator that arises from **imbalance** — the
world's six affinities being hoarded far above their natural baseline. It is **not**
an affinity: it has its own 0–100 scalar (`CorruptionEngine`), its own bands, and
is exempt from coupling, diminishing returns, pairing, and baseline-drift.

- **Food = imbalance.** `Σ max(0, affinity − 81)` across the six. Two maxed
  affinities feed it as hard as several merely-high ones — concentration is punished.
- **Seed.** Each completed reading, if there is any food, a chance (scaling with
  food, capped) spawns corruption. No imbalance → it can never appear.
- **Grow.** While fed, corruption rises by erosion (per excess point) plus a skim
  on the reading's realized affinity gains, and drains the hoarded affinities back
  down into itself.
- **Starve.** With no food, corruption decays and vanishes — the only way to be rid
  of it short of the Rupture (and, since affinities are hidden, only by blindly
  lowering one's highest forces).
- **Bands:** dormant → seeded → spreading → virulent → pinnacle.
- **The Rupture** fires at the pinnacle: affinities reset low (every affinity to 25),
  corruption clears to 0, no trace remains.
- **Carryover:** corruption persists across `reset`/`returnToTitle` and the save,
  worsening game-over-game; only `clearHistory` and the Rupture clear it.

> Tuning lives in `src/data/corruption.ts`. The player-facing effects, exploits,
> Light early-warning, and the Rupture interstitial are built in later plans.
```

- [ ] **Step 2: Add a player-facing note to `README.md`**

Add a short paragraph in the affinities/systems area (match surrounding tone — no engine internals, no numbers):

```markdown
**Corruption.** Hoard a few forces too high for too long and something from beyond
the stars takes notice — a red, glitching wrongness that feeds on imbalance and
erodes what you've hoarded. It cannot be fought head-on, only starved by letting
your strongest forces fall. Left unchecked it builds to a Rupture that tears the
reading apart and leaves the world low and quiet again, as if nothing happened.
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(corruption): document the corruption engine foundation"
```

---

## Self-Review

**Spec coverage (foundation scope):**
- Architecture — separate `CorruptionEngine` subsystem → Task 2/4. ✓
- Food metric (total excess / imbalance) → Task 1. ✓
- Seed (food-gated, no-food→no-seed) → Tasks 2, 4. ✓
- Grow (erosion + skim) → Tasks 2, 3, 4. ✓
- Starve/decay → Task 2. ✓
- Bands → Task 1. ✓
- Rupture (affinities reset low, corruption gone) → Task 4. ✓
- Carryover/persistence → Task 5. ✓
- Snapshot exposure → Task 4. ✓
- Docs sync → Task 6. ✓

**Deferred to later plans (intentionally out of scope):** gain-pipeline rebalance
(its real work is recomputing the value-pinned tests in `AffinityShift.test.ts` and
`GameEngine.test.ts`); minigame infection + selection-screen telegraph; corrupted-
variant effects; force-the-weave; forbidden-sight; Light early-warning; results-
screen glitch/intrusion/falsified/corrupted-record; the Rupture interstitial and all
React/glitch rendering.

**Type consistency:** `CorruptionBand`/`CorruptionSnapshot` (types.ts) ↔ `corruptionBandOf`
(corruption.ts) ↔ `CorruptionEngine.getBand()` ↔ `GameState.corruption`. `CorruptionTickResult.drains`
(`Partial<Record<AffinityId, number>>`) ↔ `AffinityEngine.erode(deltas)` signature. `consumeRealizedGains():
number` ↔ `tick(..., realizedGains: number, ...)`. All aligned.

**Placeholder scan:** none — every code/test step carries complete content.
