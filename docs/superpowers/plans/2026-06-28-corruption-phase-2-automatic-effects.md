# Corruption Phase 2 — Automatic Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the *automatic* corruption layer on top of the Phase-1 engine — corruption is now visible to the effect system, infects minigames (telegraphed + amplified growth), fires corrupted-variant effects at high bands, and surfaces a Light-gated early warning. All engine-only and Vitest-testable; rendering and player-initiated exploits (force-the-weave, forbidden-sight) are out of scope (Phase 3 / Phase 2b).

**Architecture:** Corruption joins `PhaseContext` (optional) so responders can gate on its band via a new `corruptionRoll` (mirrors `bandRoll`). `GameEngine` computes which offered methods are *infected* at draw time (`state.infectedMethods`), tracks whether the selected method was infected, and feeds an amplification multiplier into `CorruptionEngine.tick`. A new `src/engine/responders/corruption.ts` adds band-gated corrupted-variant responders, registered alongside the existing responder sets. A Light-gated `corruptionWarning` is derived on every snapshot.

**Tech Stack:** TypeScript (strict), Vitest (Node env, `src/engine/__tests__/**` only).

## Global Constraints

- Engine code is framework-free: **zero React/DOM imports** in `src/engine/` and `src/data/`. This plan is engine-only.
- The affinity/corruption scalars are hidden from the player; all signals are diegetic (tags, flavor text, band-derived data) — never raw numbers.
- `PhaseContext.corruption` is **optional** — existing tests construct `PhaseContext` literals without it, and `corruptionRoll` must treat its absence as `dormant`.
- Corruption responders gate through `corruptionRoll` only (never on raw values); `forced`/`isolate` debug still bypasses the roll, never the condition.
- The balance invariant from Phase 1 holds: corruption effects never accelerate raw affinity accumulation. Infected games amplify *corruption growth*, not affinity gain.
- A result the player should be able to tell was tampered with carries the `CORRUPTED_TAG` (`'corrupted'`) tag — the durable, Phase-3-renderable signal.
- Tuning lives in `src/data/corruption.ts`.
- Typecheck with `npx tsc -b`; run tests with `npx vitest run <file>`; full suite with `npm test`.

## Reference: Phase-1-as-built (do not re-derive)

- `CorruptionEngine` (`src/engine/CorruptionEngine.ts`): `getValue()/getBand()/setValue()/clear()`, and `tick(affinities, realizedGains, rng = Math.random): CorruptionTickResult` where `CorruptionTickResult = { value; band; seeded; drains; ruptured }`.
- `src/data/corruption.ts`: `corruptionFood`, `corruptionBandOf`, `seedChance`, `CORRUPTION_BANDS`, `HIGH_THRESHOLD`, `PINNACLE`, `RUPTURE_RESET`, rate constants.
- `GameEngine`: composes `corruptionEngine`; `notify()` (line ~104) sets `state.corruption`; `buildContext()` (line ~148) builds `PhaseContext`; `buildPool()` (line ~213) sets `state.shroudedMethods`; `confirmSelection()` (line ~328); `advanceAfterCommit()` (line ~490) calls `applyCorruptionTick()` (line ~539) after `tickModifiers()`; `setCorruption()` (line ~560).
- `bandRoll(ctx, affinity, minBand, baseChance)` in `src/engine/events/eligibility.ts`; band scaling uses `BAND_POWER_STEP` from `src/data/affinities`.
- Responder shape in `src/engine/events/types.ts`; build-functions composed in the `GameEngine` constructor `this.responders = [...]` (line ~61).

---

### Task 1: Corruption in PhaseContext + `corruptionRoll` gate

**Files:**
- Modify: `src/engine/events/types.ts` (`PhaseContext`, ~line 36)
- Modify: `src/engine/events/eligibility.ts`
- Modify: `src/engine/GameEngine.ts` (`buildContext`, ~line 148)
- Test: `src/engine/__tests__/CorruptionRoll.test.ts`

**Interfaces:**
- Consumes: `CorruptionSnapshot`, `CorruptionBand` (types.ts, Phase 1); `CORRUPTION_BANDS` (corruption.ts); `BAND_POWER_STEP` (affinities.ts).
- Produces: `PhaseContext.corruption?: CorruptionSnapshot`; `corruptionRoll(ctx: PhaseContext, minBand: CorruptionBand, baseChance: number): boolean`.

- [ ] **Step 1: Add `corruption` to `PhaseContext`**

In `src/engine/events/types.ts`, change the top import (line 1):

```typescript
import type { AffinityId, SlotResult, MinigameState, RollModifier, RollMode, CorruptionSnapshot } from '../types';
```

In the `PhaseContext` interface, add after `affinities: Record<AffinityId, number>;` (~line 38):

```typescript
  corruption?: CorruptionSnapshot; // optional: absent in unit-test contexts → treated as dormant
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/CorruptionRoll.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { corruptionRoll } from '../events/eligibility';
import { defaultAffinityState } from '../../data/affinities';
import type { PhaseContext } from '../events/types';
import type { CorruptionBand } from '../types';

function ctx(band: CorruptionBand | undefined, rng: () => number): PhaseContext {
  return {
    trigger: 't',
    affinities: defaultAffinityState(),
    corruption: band ? { value: 50, band } : undefined,
    slots: [], hand: null, spread: [], minigame: null, event: null,
    draft: {}, rng,
  };
}

describe('corruptionRoll', () => {
  it('never fires below the minimum band', () => {
    expect(corruptionRoll(ctx('spreading', () => 0), 'virulent', 0.5)).toBe(false);
  });

  it('fires at the minimum band when the roll passes', () => {
    expect(corruptionRoll(ctx('virulent', () => 0), 'virulent', 0.5)).toBe(true);
  });

  it('treats absent corruption as dormant (never fires)', () => {
    expect(corruptionRoll(ctx(undefined, () => 0), 'seeded', 0.9)).toBe(false);
  });

  it('scales the chance up for bands above the gate', () => {
    // pinnacle is one band above virulent → strictly higher effective chance.
    const r = 0.6; // above base 0.5, below the scaled pinnacle chance
    expect(corruptionRoll(ctx('virulent', () => r), 'virulent', 0.5)).toBe(false);
    expect(corruptionRoll(ctx('pinnacle', () => r), 'virulent', 0.5)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionRoll.test.ts`
Expected: FAIL — `corruptionRoll` is not exported.

- [ ] **Step 4: Add `corruptionRoll` to `eligibility.ts`**

In `src/engine/events/eligibility.ts`, update the imports and append the function:

```typescript
import type { PhaseContext } from './types';
import type { AffinityId, AffinityBand, CorruptionBand } from '../types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP } from '../../data/affinities';
import { CORRUPTION_BANDS } from '../../data/corruption';
```

(Keep the existing `bandRoll` function unchanged; add below it:)

```typescript
// Corruption band-gate × tier chance, scaled up per band above the gate.
// Mirrors bandRoll but reads ctx.corruption (absent → dormant, never fires).
export function corruptionRoll(
  ctx: PhaseContext,
  minBand: CorruptionBand,
  baseChance: number,
): boolean {
  const band = ctx.corruption?.band ?? 'dormant';
  const idx = CORRUPTION_BANDS.indexOf(band);
  const minIdx = CORRUPTION_BANDS.indexOf(minBand);
  if (idx < minIdx) return false;
  const scaled = baseChance * (1 + (idx - minIdx) * BAND_POWER_STEP);
  return ctx.rng() < Math.min(1, scaled);
}
```

- [ ] **Step 5: Expose corruption on the live `PhaseContext`**

In `src/engine/GameEngine.ts`, in `buildContext` (~line 151), add `corruption` to the returned object, right after `affinities: this.affinityEngine.getState(),`:

```typescript
      corruption: { value: this.corruptionEngine.getValue(), band: this.corruptionEngine.getBand() },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionRoll.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + full suite (confirm optional field broke nothing)**

Run: `npx tsc -b && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/engine/events/types.ts src/engine/events/eligibility.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionRoll.test.ts
git commit -m "feat(corruption): expose corruption on PhaseContext + corruptionRoll gate"
```

---

### Task 2: Minigame infection — infected-method data on the snapshot

**Files:**
- Modify: `src/data/corruption.ts` (add `infectedCountForBand`)
- Modify: `src/engine/types.ts` (`GameState.infectedMethods`, ~line 559)
- Modify: `src/engine/GameEngine.ts` (`defaultState`, `buildPool`, `returnToQuestionSelect`, new `rollInfectedMethods`)
- Test: `src/engine/__tests__/CorruptionInfection.test.ts`

**Interfaces:**
- Consumes: `CorruptionEngine.getBand()`; `CorruptionBand`.
- Produces: `infectedCountForBand(band: CorruptionBand): number`; `GameState.infectedMethods: number[]` (indices into `availableMethods`, like `shroudedMethods`).

- [ ] **Step 1: Add `infectedCountForBand` to `src/data/corruption.ts`**

Append:

```typescript
// How many offered methods corruption taints at each band. Infection (the
// amplified-growth mechanic + its selection-screen telegraph) begins at spreading.
export function infectedCountForBand(band: CorruptionBand): number {
  switch (band) {
    case 'spreading': return 1;
    case 'virulent':
    case 'pinnacle': return 2;
    default: return 0; // dormant, seeded — no infected methods yet
  }
}
```

- [ ] **Step 2: Add `infectedMethods` to `GameState`**

In `src/engine/types.ts`, in `GameState`, add after `shroudedMethods: number[];` (~line 565):

```typescript
  infectedMethods: number[]; // indices of offered methods tainted by corruption (parallels shroudedMethods)
```

- [ ] **Step 3: Write the failing test** at `src/engine/__tests__/CorruptionInfection.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('minigame infection — infected method data', () => {
  it('marks no methods when corruption is dormant', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    expect(e.getState().infectedMethods).toEqual([]);
  });

  it('marks no methods at the seeded band', () => {
    const e = new GameEngine(3);
    e.setCorruption(20); // seeded
    e.startTurn('self');
    expect(e.getState().infectedMethods).toEqual([]);
  });

  it('taints one method at the spreading band', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    e.startTurn('self');
    const infected = e.getState().infectedMethods;
    expect(infected).toHaveLength(1);
    expect(infected[0]).toBeGreaterThanOrEqual(0);
    expect(infected[0]).toBeLessThan(e.getState().availableMethods.length);
  });

  it('taints two distinct methods at the virulent band', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    e.startTurn('self');
    const infected = e.getState().infectedMethods;
    expect(infected).toHaveLength(2);
    expect(new Set(infected).size).toBe(2); // distinct
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionInfection.test.ts`
Expected: FAIL — `infectedMethods` is `undefined`.

- [ ] **Step 5: Default the field**

In `src/engine/GameEngine.ts`, in `defaultState()`, add after `shroudedMethods: [],` (~line 80):

```typescript
      infectedMethods: [],
```

- [ ] **Step 6: Add the infection roller**

In `src/engine/GameEngine.ts`, add a private method just above `buildPool` (~line 211):

```typescript
  // Pick which offered methods corruption taints this draw — count scales with the
  // corruption band; indices are distinct and within the pool.
  private rollInfectedMethods(poolSize: number): number[] {
    const count = Math.min(poolSize, infectedCountForBand(this.corruptionEngine.getBand()));
    if (count <= 0) return [];
    const chosen: number[] = [];
    while (chosen.length < count) {
      let i = Math.floor(Math.random() * poolSize);
      while (chosen.includes(i)) i = (i + 1) % poolSize; // linear-probe to a free index
      chosen.push(i);
    }
    return chosen.sort((a, b) => a - b);
  }
```

- [ ] **Step 7: Compute infection in `buildPool`**

In `buildPool`, after the `consumeReadingEffect('shroud-card')` block, immediately before the `this.state.eventQueue = this.state.eventQueue.slice(0, queueBefore);` line (~line 247), add:

```typescript
    this.state.infectedMethods = this.rollInfectedMethods(pool.length);
```

- [ ] **Step 8: Import `infectedCountForBand`**

In `src/engine/GameEngine.ts`, extend the corruption import (currently `import { RUPTURE_RESET } from '../data/corruption';`, ~line 10):

```typescript
import { RUPTURE_RESET, infectedCountForBand } from '../data/corruption';
```

- [ ] **Step 9: Clear infection on `returnToQuestionSelect`**

In `returnToQuestionSelect`, after `this.state.shroudedMethods = [];`, add:

```typescript
    this.state.infectedMethods = [];
```

- [ ] **Step 10: Run the infection test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionInfection.test.ts`
Expected: PASS.

- [ ] **Step 11: Typecheck + full suite**

Run: `npx tsc -b && npm test`
Expected: no errors; all pass.

- [ ] **Step 12: Commit**

```bash
git add src/data/corruption.ts src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionInfection.test.ts
git commit -m "feat(corruption): compute infected methods per draw, scaling with band"
```

---

### Task 3: Amplified corruption growth in infected games

**Files:**
- Modify: `src/data/corruption.ts` (`INFECTION_GAIN_MULT`)
- Modify: `src/engine/CorruptionEngine.ts` (`tick` gains an `infectionMult` param)
- Modify: `src/engine/GameEngine.ts` (`confirmSelection`, `applyCorruptionTick`, new field)
- Test: `src/engine/__tests__/CorruptionInfectionGain.test.ts`

**Interfaces:**
- Consumes: `state.infectedMethods` (Task 2); `PendingSelection.finalIndex`.
- Produces: `CorruptionEngine.tick(affinities, realizedGains, rng?, infectionMult?)`; `INFECTION_GAIN_MULT`.

- [ ] **Step 1: Add the multiplier constant**

In `src/data/corruption.ts`, append:

```typescript
export const INFECTION_GAIN_MULT = 2; // corruption growth multiplier when an infected method is played
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/CorruptionInfectionGain.test.ts`

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CorruptionEngine } from '../CorruptionEngine';
import type { AffinityId, DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> => ({
  chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over,
});
const hoarded = vec({ chaos: 100, order: 100 }); // food = 38

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('CorruptionEngine.tick infection multiplier', () => {
  it('grows more when the multiplier is higher', () => {
    const a = new CorruptionEngine(); a.setValue(50);
    const b = new CorruptionEngine(); b.setValue(50);
    const ra = a.tick(hoarded, 0, () => 0.99, 1);
    const rb = b.tick(hoarded, 0, () => 0.99, 2);
    expect(rb.value - 50).toBeGreaterThan(ra.value - 50);
  });
});

describe('infected games amplify corruption growth (GameEngine)', () => {
  // Math.random pinned to 0.99: deterministic pool, infected = [2], all rolls suppressed.
  function setup(): GameEngine {
    const e = new GameEngine(3);
    e.setCorruption(50);      // spreading → 1 infected method
    e.startTurn('self');      // buildPool computes infectedMethods = [2]
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } });
    return e;
  }

  it('an infected selection grows corruption more than an uninfected one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const infectedEngine = setup();
    expect(infectedEngine.getState().infectedMethods).toEqual([2]);
    infectedEngine.selectMethod(2); // infected
    oneReading(infectedEngine);

    const controlEngine = setup();
    controlEngine.selectMethod(0); // not infected
    oneReading(controlEngine);

    expect(infectedEngine.getState().corruption.value)
      .toBeGreaterThan(controlEngine.getState().corruption.value);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionInfectionGain.test.ts`
Expected: FAIL — `tick` ignores a 4th arg / infected and control grow equally.

- [ ] **Step 4: Add the `infectionMult` parameter to `tick`**

In `src/engine/CorruptionEngine.ts`, change the `tick` signature and the growth line:

```typescript
  tick(
    affinities: Record<AffinityId, number>,
    realizedGains: number,
    rng: () => number = Math.random,
    infectionMult = 1,
  ): CorruptionTickResult {
```

In the `if (food > 0)` branch, change the growth line to apply the multiplier:

```typescript
      this.value = Math.min(PINNACLE, this.value + (EROSION_RATE * food + SKIM_RATE * Math.max(0, realizedGains)) * infectionMult);
```

- [ ] **Step 5: Track whether the selected method was infected**

In `src/engine/GameEngine.ts`, add a field beside the other per-turn flags (near `private happeningOfferedThisTurn = false;`, ~line 52):

```typescript
  private selectedMethodInfected = false;
```

In `confirmSelection`, after `const pending = this.state.drawPhase?.pendingSelection;` and the `if (!pending) return;` guard (~line 330), add:

```typescript
    this.selectedMethodInfected = this.state.infectedMethods.includes(pending.finalIndex);
```

- [ ] **Step 6: Feed the multiplier into the corruption tick**

In `applyCorruptionTick` (~line 539), replace the body with:

```typescript
  private applyCorruptionTick(): void {
    const gains = this.affinityEngine.consumeRealizedGains();
    const mult = this.selectedMethodInfected ? INFECTION_GAIN_MULT : 1;
    const tick = this.corruptionEngine.tick(this.affinityEngine.getBase(), gains, Math.random, mult);
    this.selectedMethodInfected = false; // applies to exactly one reading
    if (Object.keys(tick.drains).length > 0) this.affinityEngine.erode(tick.drains);
    if (tick.ruptured) this.performRupture();
  }
```

- [ ] **Step 7: Import `INFECTION_GAIN_MULT`**

Extend the corruption import in `src/engine/GameEngine.ts` (~line 10):

```typescript
import { RUPTURE_RESET, infectedCountForBand, INFECTION_GAIN_MULT } from '../data/corruption';
```

- [ ] **Step 8: Run the gain test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionInfectionGain.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the Phase-1 corruption suite to confirm `tick`'s new optional arg broke nothing**

Run: `npx vitest run src/engine/__tests__/CorruptionEngine.test.ts src/engine/__tests__/CorruptionLifecycle.test.ts`
Expected: PASS (existing `tick(...)` calls omit the 4th arg → defaults to 1).

- [ ] **Step 10: Typecheck + full suite**

Run: `npx tsc -b && npm test`
Expected: no errors; all pass.

- [ ] **Step 11: Commit**

```bash
git add src/data/corruption.ts src/engine/CorruptionEngine.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionInfectionGain.test.ts
git commit -m "feat(corruption): infected games amplify corruption growth"
```

---

### Task 4: Corrupted-variant effects (responders)

**Files:**
- Modify: `src/data/corruption.ts` (`CORRUPTED_TAG`)
- Create: `src/engine/responders/corruption.ts`
- Modify: `src/engine/GameEngine.ts` (register responders; tag the corrupted spawn)
- Test: `src/engine/__tests__/CorruptionResponders.test.ts`

**Interfaces:**
- Consumes: `corruptionRoll` (Task 1); `TIER_BASE_CHANCE` (affinities.ts); `buildFace`, `DECK_BY_ID`, `consolidateSpread`, `FULL_DECK` (tarot.ts).
- Produces: `CORRUPTED_TAG`; `buildCorruptionResponders(): Responder[]`; on the corrupted-spawn path, the spawned result carries `CORRUPTED_TAG`.

- [ ] **Step 1: Add the corrupted tag constant**

In `src/data/corruption.ts`, append:

```typescript
export const CORRUPTED_TAG = 'corrupted'; // marks a result the player can tell was tampered with
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/CorruptionResponders.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildCorruptionResponders } from '../responders/corruption';
import { defaultAffinityState } from '../../data/affinities';
import { buildFace, FULL_DECK, consolidateSpread } from '../../data/tarot';
import { CORRUPTED_TAG } from '../../data/corruption';
import { GameEngine } from '../GameEngine';
import type { PhaseContext } from '../events/types';
import type { CorruptionBand, DiceResult } from '../types';

function ctx(band: CorruptionBand, over: Partial<PhaseContext>): PhaseContext {
  return {
    trigger: 't', affinities: defaultAffinityState(),
    corruption: { value: band === 'virulent' ? 80 : 50, band },
    slots: [], hand: null, spread: [], minigame: null, event: null,
    rng: () => 0, draft: {}, ...over,
  };
}
const byId = (id: string) => buildCorruptionResponders().find((r) => r.id === id)!;

describe('corruption-extra-result', () => {
  const r = byId('corruption-extra-result');

  it('spawns a corrupted second result at virulent', () => {
    const c = ctx('virulent', { trigger: 'dice:commit', draft: { outcome: { type: 'd20' } as any } });
    expect(r.condition(c)).toBe(true);
    expect(r.roll(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('d20');
    expect(c.draft.corruptSpawn).toBe(true);
  });

  it('does not fire below virulent', () => {
    const c = ctx('spreading', { trigger: 'dice:commit', draft: { outcome: { type: 'd20' } as any } });
    expect(r.roll(c)).toBe(false);
  });
});

describe('corruption-false-orientation', () => {
  const r = byId('corruption-false-orientation');

  it('flips the spread and tags it corrupted at virulent', () => {
    const spread = consolidateSpread([
      buildFace(FULL_DECK[0], 'upright'),
      buildFace(FULL_DECK[1], 'upright'),
    ]);
    const c = ctx('virulent', { trigger: 'tarot:orient', draft: { outcome: spread } });
    expect(r.condition(c)).toBe(true);
    expect(r.roll(c)).toBe(true);
    r.apply(c);
    const out = c.draft.outcome as typeof spread;
    expect(out.tags).toContain(CORRUPTED_TAG);
    expect(out.spread!.every((s) => s.card.orientation === 'reversed')).toBe(true);
    expect(c.draft.corruptOrient).toBe(true);
  });
});

describe('corrupted spawn is tagged on the committed result (GameEngine)', () => {
  const dice = (): DiceResult => ({
    type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
  });

  it('attaches the corrupted tag to the spawned second result', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.setCorruption(80); // virulent (so the report queues like the live path)
    e.forceEffects(['corruption-extra-result'], true); // isolate: only this responder fires
    e.completeMinigame(dice());
    const tags = e.getState().turnResults.flatMap((r) => r.tags);
    expect(tags).toContain(CORRUPTED_TAG);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionResponders.test.ts`
Expected: FAIL — cannot resolve `../responders/corruption`.

- [ ] **Step 4: Create `src/engine/responders/corruption.ts`**

```typescript
import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { SlotResult, TarotResult } from '../types';
import { corruptionRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';
import { CORRUPTED_TAG } from '../../data/corruption';
import { buildFace, DECK_BY_ID, consolidateSpread } from '../../data/tarot';

const T = TIER_BASE_CHANCE;

function report(id: string, description: string, animation: string): EffectReport {
  return { responderId: id, label: 'Corruption', description, animation };
}

// The double-edged corrupted variants: potent but visibly wrong. They fire
// unbidden at virulent+ (the curse), and are exactly what a knowing player farms
// in infected games (the exploit). Every output they touch carries CORRUPTED_TAG.
export function buildCorruptionResponders(): Responder[] {
  return [
    {
      id: 'corruption-extra-result', source: 'interaction',
      triggers: ['dice:commit', 'tarot:commit', 'iching:commit', 'strings:commit', 'astral:commit', 'rune:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' },
      condition: (c) => !!c.draft.outcome && c.draft.outcome.type !== 'happening',
      roll: (c) => corruptionRoll(c, 'virulent', T.major),
      apply: (c) => {
        c.draft.spawnSecond = (c.draft.outcome as SlotResult).type;
        c.draft.corruptSpawn = true; // GameEngine tags the spawned result
        return report('corruption-extra-result', 'Something that should not be claws its way into the reading.', 'second-result');
      },
    },
    {
      id: 'corruption-false-orientation', source: 'interaction',
      triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'MUTATE' },
      condition: (c) => c.draft.outcome?.type === 'tarot' && !!(c.draft.outcome as TarotResult).spread,
      roll: (c) => corruptionRoll(c, 'virulent', T.notable),
      apply: (c) => {
        const result = c.draft.outcome as TarotResult;
        const faces = result.spread!.map((s) =>
          buildFace(DECK_BY_ID[s.card.id], s.card.orientation === 'upright' ? 'reversed' : 'upright'));
        const next = consolidateSpread(faces);
        if (!next.tags.includes(CORRUPTED_TAG)) next.tags = [...next.tags, CORRUPTED_TAG];
        c.draft.outcome = next;
        c.draft.corruptOrient = true;
        return report('corruption-false-orientation', 'The faces turn wrong — the spread reads as something it is not.', 'flip');
      },
    },
  ];
}
```

- [ ] **Step 5: Register the responders**

In `src/engine/GameEngine.ts`, add the import beside the other responder builders (~line 12):

```typescript
import { buildCorruptionResponders } from './responders/corruption';
```

Extend the `this.responders = [...]` composition in the constructor (~line 61) to append `...buildCorruptionResponders()`:

```typescript
    this.responders = [...buildAffinityResponders(), ...buildInteractionResponders(), ...buildAstralResponders(), ...buildIChingResponders(), ...buildRuneResponders(), ...buildStringsResponders(), ...buildCorruptionResponders()];
```

- [ ] **Step 6: Tag the spawned result on the corrupted-spawn path**

In `completeMinigame`, inside the `if (typeof draft.spawnSecond === 'string') { ... }` block, after `this.state.turnResults = [...this.state.turnResults, second];` (~line 443), add:

```typescript
      if (draft.corruptSpawn === true && !second.tags.includes(CORRUPTED_TAG)) {
        second.tags = [...second.tags, CORRUPTED_TAG];
      }
```

- [ ] **Step 7: Import `CORRUPTED_TAG` in GameEngine**

Extend the corruption import (~line 10):

```typescript
import { RUPTURE_RESET, infectedCountForBand, INFECTION_GAIN_MULT, CORRUPTED_TAG } from '../data/corruption';
```

- [ ] **Step 8: Run the responders test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionResponders.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + full suite**

Run: `npx tsc -b && npm test`
Expected: no errors; all pass.

- [ ] **Step 10: Commit**

```bash
git add src/data/corruption.ts src/engine/responders/corruption.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionResponders.test.ts
git commit -m "feat(corruption): corrupted-variant responders (extra result, false orientation)"
```

---

### Task 5: Light early-warning data

**Files:**
- Modify: `src/engine/types.ts` (`CorruptionWarning` interface; `GameState.corruptionWarning`)
- Modify: `src/engine/GameEngine.ts` (`defaultState`, `notify`, new `deriveCorruptionWarning`)
- Test: `src/engine/__tests__/CorruptionWarning.test.ts`

**Interfaces:**
- Consumes: `CorruptionEngine.getBand()`; `AffinityEngine.bandOf('light')`; `state.infectedMethods`; `BAND_ORDER`, `CORRUPTION_BANDS`.
- Produces: `interface CorruptionWarning { present: boolean; tainted: boolean; methods: number[]; text: string }`; `GameState.corruptionWarning: CorruptionWarning | null`.

- [ ] **Step 1: Add the warning type and the GameState field**

In `src/engine/types.ts`, add near `CorruptionSnapshot` (Phase 1, ~line 49):

```typescript
// Light's read on corruption. Null when Light cannot perceive a predator.
export interface CorruptionWarning {
  present: boolean;   // a predator is sensed
  tainted: boolean;   // the warning itself is corrupted (terminal lucidity, virulent+)
  methods: number[];  // indices of methods named as tainted (empty unless Light is Dominant)
  text: string;       // diegetic flavor line for the UI
}
```

In `GameState`, add after `corruption: CorruptionSnapshot;` (~line 562):

```typescript
  corruptionWarning: CorruptionWarning | null;
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/CorruptionWarning.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId } from '../types';

const lit = (light: number): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light, shadow: 50 });

describe('Light early-warning', () => {
  it('is null while corruption is dormant', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    expect(e.getState().corruptionWarning).toBeNull();
  });

  it('is null when Light is below ascendant (cannot perceive a predator)', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    e.startTurn('self');
    e.loadState({ affinities: lit(50) }); // stirring
    expect(e.getState().corruptionWarning).toBeNull();
  });

  it('gives a vague warning at ascendant Light (no methods named)', () => {
    const e = new GameEngine(3);
    e.setCorruption(50);
    e.startTurn('self');
    e.loadState({ affinities: lit(70) }); // ascendant
    const w = e.getState().corruptionWarning!;
    expect(w.present).toBe(true);
    expect(w.tainted).toBe(false);
    expect(w.methods).toEqual([]);
  });

  it('names the tainted methods at dominant Light', () => {
    const e = new GameEngine(3);
    e.setCorruption(50);
    e.startTurn('self'); // infectedMethods computed (spreading → 1)
    e.loadState({ affinities: lit(100) }); // dominant
    const s = e.getState();
    expect(s.corruptionWarning!.present).toBe(true);
    expect(s.corruptionWarning!.tainted).toBe(false);
    expect(s.corruptionWarning!.methods).toEqual(s.infectedMethods);
  });

  it('taints the warning itself at virulent (terminal lucidity)', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    e.startTurn('self');
    e.loadState({ affinities: lit(100) }); // dominant, but it no longer matters
    const w = e.getState().corruptionWarning!;
    expect(w.present).toBe(true);
    expect(w.tainted).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionWarning.test.ts`
Expected: FAIL — `corruptionWarning` is `undefined`.

- [ ] **Step 4: Default the field**

In `defaultState()`, add after `corruption: { value: 0, band: 'dormant' },` (~line 77):

```typescript
      corruptionWarning: null,
```

- [ ] **Step 5: Derive the warning on every snapshot**

In `notify()`, after the `this.state.corruption = ...` line (~line 108), add:

```typescript
    this.state.corruptionWarning = this.deriveCorruptionWarning();
```

- [ ] **Step 6: Add the derivation method**

In `src/engine/GameEngine.ts`, add right after `notify()` closes (~line 114):

```typescript
  // Light's read on corruption. Below Ascendant, Light "cannot recognize a predator
  // of itself" → null. Ascendant warns vaguely; Dominant names the tainted methods.
  // At virulent+, the warning itself is corrupted (terminal lucidity): visibly false
  // reassurance, after the danger is already obvious. Following Light never removes
  // corruption — Light high enough to warn you is itself the excess that feeds it.
  private deriveCorruptionWarning(): import('./types').CorruptionWarning | null {
    const cband = this.corruptionEngine.getBand();
    if (cband === 'dormant') return null;

    const lightIdx = BAND_ORDER.indexOf(this.affinityEngine.bandOf('light'));
    if (lightIdx < BAND_ORDER.indexOf('ascendant')) return null;

    if (CORRUPTION_BANDS.indexOf(cband) >= CORRUPTION_BANDS.indexOf('virulent')) {
      return {
        present: true, tainted: true, methods: [],
        text: 'The light swells, certain and warm: there is nothing wrong here. All is well. All is well.',
      };
    }

    const namesMethods = this.affinityEngine.bandOf('light') === 'dominant';
    return {
      present: true, tainted: false,
      methods: namesMethods ? [...this.state.infectedMethods] : [],
      text: namesMethods
        ? 'The light picks out the tainted paths — something feeds where they lead.'
        : 'The light wavers — something here does not belong, though its shape stays hidden.',
    };
  }
```

- [ ] **Step 7: Import `BAND_ORDER` and `CORRUPTION_BANDS`**

In `src/engine/GameEngine.ts`, extend the affinities import (~line 8) to include `BAND_ORDER`:

```typescript
import { AFFINITY_DEFINITIONS, defaultAffinityState, AFFINITY_IDS, BAND_ORDER } from '../data/affinities';
```

Extend the corruption import (~line 10) to include `CORRUPTION_BANDS`:

```typescript
import { RUPTURE_RESET, infectedCountForBand, INFECTION_GAIN_MULT, CORRUPTED_TAG, CORRUPTION_BANDS } from '../data/corruption';
```

- [ ] **Step 8: Run the warning test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionWarning.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + full suite**

Run: `npx tsc -b && npm test`
Expected: no errors; all pass.

- [ ] **Step 10: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionWarning.test.ts
git commit -m "feat(corruption): Light-gated early-warning with terminal-lucidity taint"
```

---

### Task 6: Documentation sync

**Files:**
- Modify: `docs/game-systems.md` (extend the Corruption section)
- Modify: `README.md` (extend the corruption note)

**Interfaces:** none (docs only). Required by `CLAUDE.md`.

- [ ] **Step 1: Extend the Corruption section in `docs/game-systems.md`**

Append under the existing Corruption section:

```markdown
### Automatic corruption effects (Phase 2)

- **Visible to the effect system.** Corruption rides on `PhaseContext.corruption`;
  responders gate on it via `corruptionRoll` (the corruption analog of `bandRoll`).
- **Minigame infection.** At each draw, corruption taints offered methods
  (`state.infectedMethods`): one at *spreading*, two at *virulent+*. Playing an
  infected method amplifies that reading's corruption growth (`INFECTION_GAIN_MULT`)
  — farming spends the hoard into corruption rather than growing affinities.
- **Corrupted-variant effects** (`src/engine/responders/corruption.ts`) fire at
  *virulent+*: e.g. `corruption-extra-result` (an unbidden extra, garbled result)
  and `corruption-false-orientation` (the spread turns wrong). Anything they touch
  carries the `corrupted` tag — potent but visibly wrong, double-edged (curse at
  high bands, farmable payoff in infected games).
- **Light early-warning** (`state.corruptionWarning`). Below Ascendant Light: nothing.
  Ascendant: a vague "something is wrong". Dominant: names the tainted methods. At
  *virulent+* the warning is itself corrupted (terminal lucidity — false reassurance
  after the danger is already obvious). The catch-22: Light high enough to warn you
  is itself excess that feeds corruption, so its guidance can never remove the threat.
```

- [ ] **Step 2: Extend the README corruption note**

Add a sentence to the existing corruption paragraph in `README.md`:

```markdown
As it grows, corruption begins to taint the methods you're offered — and if your
inner Light burns bright enough, you may catch a warning of where the wrongness
festers, though heeding it will never be enough to drive corruption out.
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(corruption): document the automatic corruption effects layer"
```

---

## Self-Review

**Spec coverage (Phase 2 automatic-layer scope):**
- Corruption in PhaseContext + `corruptionRoll` → Task 1. ✓
- Minigame infection data (telegraph source) → Task 2. ✓
- Amplified corruption growth in infected games → Task 3. ✓
- Corrupted-variant effects (double-edged) → Task 4. ✓
- Light early-warning incl. terminal-lucidity taint + the catch-22 → Task 5. ✓
- Docs sync → Task 6. ✓

**Deferred (intentionally out of scope):** force-the-weave + forbidden-sight (Phase 2b — new player-action surface); all rendering — selection-screen glitch telegraph, results-screen glitch/intrusion/falsified/corrupted-record, the Rupture interstitial (Phase 3); gain-pipeline rebalance (its own plan). Refinement noted for later: "occasional" method-naming at Ascendant Light (Task 5 implements Ascendant=vague / Dominant=named); affinity-feed *dampening* in infected games (Task 3 implements growth amplification only).

**Type consistency:** `PhaseContext.corruption?` (`CorruptionSnapshot`) ↔ `corruptionRoll` reads `ctx.corruption?.band`. `CorruptionEngine.tick(..., infectionMult?)` ↔ `applyCorruptionTick` passes `(base, gains, Math.random, mult)`. `GameState.infectedMethods: number[]` ↔ `rollInfectedMethods(): number[]` ↔ `selectedMethodInfected` check ↔ `corruptionWarning.methods`. `CORRUPTED_TAG` ↔ responder apply + `completeMinigame` spawn tagging. `buildCorruptionResponders` registered in the constructor responder list.

**Placeholder scan:** none — every code/test step carries complete content.

**Fallout note:** `PhaseContext.corruption` is optional, so the existing `ctx()` test helpers (e.g. `AffinityResponders.test.ts`) still type-check unchanged; `tick`'s 4th arg is optional, so Phase-1 corruption tests still pass. Both are guarded by the `npm test` step in each task.
