# Affinity Overhaul — Phase 1 (Engine Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect `AffinityEngine` into a permanent **base** + decaying **surge** model, rebalance the feeds so no affinity rides free on RNG, and retune the accumulation constants so high bands are reachable — without changing any consuming code outside the engine.

**Architecture:** All six affinities keep a permanent `base` value (0–100, persisted) plus a run-scoped list of timed **modifiers**. `getState()` now returns the **effective** value (`base + active surge contributions`), so every existing band/effect/hint consumer keeps working untouched. Surges are the headline temporary boost (Phase 2 happenings will grant them); this phase builds and unit-tests the primitive, the rebalanced feeds, and the retune. Upheaval `transform` modifiers and happening callers are later phases.

**Tech Stack:** TypeScript (strict), Vitest (engine tests only, Node env, `Math.random` stubbed for randomness). No ESLint/Prettier — `tsc -b` enforces types.

## Global Constraints

- Engine stays framework-free: **zero React/DOM imports** in `src/engine/**`.
- Every `GameEngine` mutator that changes visible state ends with `notify()`.
- Affinity values are integers clamped to **0–100** via the engine's `clamp` (`Math.round`).
- Tests live only under `src/engine/__tests__/**`; there are no component tests.
- Randomness in tests is controlled by stubbing `Math.random` (see the `noJitter` helper pattern).
- **Docs in sync (CLAUDE.md rule):** `docs/game-systems.md` and the README affinity sections MUST be updated to match (done in Task 6) before this phase is considered complete.
- Tuning values in this plan are the spec's **starting playtest numbers**; keep them in named constants in `src/data/affinities.ts` so they stay tunable.
- Run a single test file: `npx vitest run <path>`. Run all engine tests: `npm test`. Typecheck: `npx tsc -b`.

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/engine/types.ts` | Shared engine types | **Modify** — add `AffinityModifier`/`AffinitySurgeModifier`; add `affinityBase` to `GameState` |
| `src/data/affinities.ts` | Affinity definitions, feeds, tuning constants | **Modify** — drop `random` from Chaos tags; `take-reroll` secondary; add `FORTUNE_TAG_CAP`; retune coupling/drift/DR |
| `src/engine/AffinityEngine.ts` | Affinity state, shift math, effects | **Modify** — base/effective split, surge primitive, capped Fortune feed |
| `src/engine/GameEngine.ts` | Façade; snapshot; turn lifecycle | **Modify** — tick surges per reading, route coherence feeds through cap, expose `affinityBase`, public `grantSurge`, clear modifiers on reset |
| `src/engine/__tests__/AffinityShift.test.ts` | Shift/coupling/DR/drift/tag tests | **Modify** — update expected values for the retune + feed changes |
| `src/engine/__tests__/AffinitySurge.test.ts` | Surge primitive tests | **Create** |
| `src/engine/__tests__/AffinityActions.test.ts` | Action-feed tests | **Modify** — add `take-reroll → Chaos` secondary test |
| `src/engine/__tests__/GameEngine.test.ts` | Lifecycle/integration tests | **Modify** — add surge-tick + `affinityBase` snapshot tests |
| `docs/game-systems.md`, `README.md` | Hand-maintained references | **Modify** (Task 6) |

---

### Task 1: Base/effective split + modifier type + `getBase()`

Pure refactor. With no modifiers granted yet, **effective == base**, so the entire existing suite must stay green. Adds the type and the `getState`→effective indirection that every later task builds on.

**Files:**
- Modify: `src/engine/types.ts` (add modifier types near the other affinity types, around line 12–16)
- Modify: `src/engine/AffinityEngine.ts` (rename field `state`→`base`; add `eff`, `getBase`; route game-facing reads through `eff`)
- Test: `src/engine/__tests__/AffinityShift.test.ts` (add one `getBase` test)

**Interfaces:**
- Produces: `AffinityModifier` (union, currently just `AffinitySurgeModifier`); `AffinityEngine.getBase(): Record<AffinityId, number>`; `AffinityEngine.getState()` now returns **effective** values.
- Consumes: existing `AFFINITY_IDS`, `BASELINE`, `bandOf`, `bandIndex`, coupling/DR/drift constants from `src/data/affinities.ts`.

- [ ] **Step 1: Add the modifier types to `src/engine/types.ts`**

Insert after the `AffinityMandate` interface (after line 16):

```ts
// A run-scoped temporary modifier on the affinity reading. Phase 1 defines the
// additive `surge`; Phase 3 will extend the union with an upheaval `transform`.
export interface AffinitySurgeModifier {
  id: string;
  kind: 'surge';
  deltas: Partial<Record<AffinityId, number>>;
  readingsRemaining: number;
  initialReadings: number;
  source: string;
}

export type AffinityModifier = AffinitySurgeModifier;
```

- [ ] **Step 2: Write the failing `getBase` / effective test**

Add to `src/engine/__tests__/AffinityShift.test.ts` (inside the `AffinityEngine.shift pipeline` describe, after the first test):

```ts
  it('getBase returns the permanent values; with no surges effective equals base', () => {
    const e = make();
    e.setState({ chaos: 70 });
    expect(e.getBase().chaos).toBe(70);
    expect(e.getState().chaos).toBe(70); // effective == base when no modifiers
  });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts -t "getBase returns the permanent"`
Expected: FAIL — `e.getBase is not a function`.

- [ ] **Step 4: Refactor `AffinityEngine` — rename `state`→`base`, add `eff`/`getBase`, route reads**

In `src/engine/AffinityEngine.ts`:

Rename the field and add the new ones:

```ts
  private base: Record<AffinityId, number>;
  private modifiers: AffinityModifier[] = [];
  private modSeq = 0;
  private feedsThisRun: Record<AffinityId, number>;
```

Import the type (add `AffinityModifier` to the existing `./types` import). In the constructor, replace `this.state` with `this.base` (the `for` loop seeding baseline).

Add the effective helper and `getBase` (place near `getState`):

```ts
  // Effective value = permanent base + active surge contributions (step-down decayed).
  // Phase 3 will apply transform modifiers here, after surges.
  private eff(id: AffinityId): number {
    let v = this.base[id];
    for (const m of this.modifiers) {
      if (m.kind === 'surge') {
        const factor = m.readingsRemaining / m.initialReadings;
        v += (m.deltas[id] ?? 0) * factor;
      }
    }
    return this.clamp(v);
  }

  getBase(): Record<AffinityId, number> {
    return { ...this.base };
  }
```

Now update every method. **Mutation/persistence reads `base`; game-facing reads use `eff`:**

```ts
  shift(id: AffinityId, baseDelta: number, _sourceId: string): number {
    if (baseDelta === 0) return 0;
    baseDelta *= this.mandateFactor(id);
    if (baseDelta < 0) {
      this.base[id] = this.clamp(this.base[id] + baseDelta);
      return baseDelta;
    }
    const dr = Math.max(DR_FLOOR, 1 - DR_STEP * this.feedsThisRun[id]);
    this.feedsThisRun[id] += 1;
    const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
    const gain = baseDelta * dr * jitter;
    this.base[id] = this.clamp(this.base[id] + gain);
    const opp = AFFINITY_PAIRS[id];
    this.base[opp] = this.clamp(this.base[opp] - gain * COUPLING_OPPOSITE);
    for (const other of AFFINITY_IDS) {
      if (other === id || other === opp) continue;
      this.base[other] = this.clamp(this.base[other] - gain * COUPLING_OTHER);
    }
    return gain;
  }
```

```ts
  peekAvailable(): boolean {
    if (this.peekLocked) return false;
    return BAND_ORDER.indexOf(bandOf(this.eff('light'))) >= BAND_ORDER.indexOf('ascendant');
  }
```

In `getEffects()` replace the three reads:

```ts
    const willIdx   = bandIndex(bandOf(this.eff('will')));
    const lightIdx  = bandIndex(bandOf(this.eff('light')));
    const shadowIdx = bandIndex(bandOf(this.eff('shadow')));
```

```ts
  beginRun(): void {
    for (const id of AFFINITY_IDS) {
      this.base[id] = this.clamp(this.base[id] + (BASELINE - this.base[id]) * RUN_DRIFT);
      this.feedsThisRun[id] = 0;
    }
    this.peeksThisRun = 0;
    this.peekLocked = false;
    this.clearMandate();
    // NOTE: modifiers are intentionally NOT cleared here — surges decay per reading
    // and survive turn boundaries within a session.
  }

  bandOf(id: AffinityId): AffinityBand {
    return bandOf(this.eff(id));
  }

  resolveBand(id: AffinityId): AffinityBand {
    const cur = bandOf(this.eff(id));
    const idx = BAND_ORDER.indexOf(cur);
    if (idx < BAND_ORDER.length - 1 && Math.random() < REACH_UP_CHANCE) {
      return BAND_ORDER[idx + 1];
    }
    return cur;
  }

  getActiveHints(max = 2, clarity = 0): string[] {
    const sorted = [...AFFINITY_IDS].sort((a, b) => this.eff(b) - this.eff(a));
    const hints: string[] = [];
    for (const id of sorted.slice(0, max)) {
      const base = this.getHint(id);
      if (!base) continue;
      if (clarity >= 2) hints.push(`${this.defById[id]?.name ?? id}: ${base}`);
      else if (clarity <= -2) hints.push('…');
      else hints.push(base);
    }
    return hints;
  }

  getHint(id: AffinityId): string | null {
    const def = this.defById[id];
    if (!def) return null;
    const pool = def.hints[bandOf(this.eff(id))];
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getState(): Record<AffinityId, number> {
    return AFFINITY_IDS.reduce(
      (acc, id) => ((acc[id] = this.eff(id)), acc),
      {} as Record<AffinityId, number>,
    );
  }

  setState(values: Partial<Record<AffinityId, number>>): void {
    for (const [id, val] of Object.entries(values)) {
      if (typeof val === 'number') this.base[id as AffinityId] = this.clamp(val);
    }
  }

  serialize(): string {
    return JSON.stringify(this.base);
  }

  loadFrom(json: string): void {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const id of AFFINITY_IDS) {
      const v = parsed[id];
      if (typeof v === 'number') {
        this.base[id] = this.clamp(v <= 1 ? v * 100 : v);
      } else {
        this.base[id] = BASELINE;
      }
    }
  }
```

Leave `applyResultTags`, `applyAction`, `usePeek`, mandate methods, and `clamp` as they are (they call `shift`/read nothing renamed beyond `base`). Verify no remaining `this.state` references: search the file for `this.state` — there should be **zero**.

- [ ] **Step 5: Run the new test + full suite to verify green**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts`
Expected: PASS (including the new `getBase` test).
Run: `npm test`
Expected: PASS — the whole suite still green (effective == base everywhere, no behavior change).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/AffinityEngine.ts src/engine/__tests__/AffinityShift.test.ts
git commit -m "refactor(affinity): split base vs effective, add modifier type and getBase"
```

---

### Task 2: Surge primitive (grant / tick / decay / stack / expire / clear)

Adds the additive temporary layer. Pure `AffinityEngine` API with thorough unit tests; no consumer wires it yet (that's Task 5 / Phase 2).

**Files:**
- Modify: `src/engine/AffinityEngine.ts` (add `grantSurge`, `tickModifiers`, `clearModifiers`, `getModifiers`)
- Create: `src/engine/__tests__/AffinitySurge.test.ts`

**Interfaces:**
- Consumes: `AffinityModifier` (Task 1), `eff`/`getBase`/`getState` (Task 1).
- Produces:
  - `grantSurge(deltas: Partial<Record<AffinityId, number>>, readings: number, source: string): void`
  - `tickModifiers(): void`
  - `clearModifiers(): void`
  - `getModifiers(): AffinityModifier[]`

- [ ] **Step 1: Write the failing surge tests**

Create `src/engine/__tests__/AffinitySurge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('AffinityEngine surges', () => {
  it('a fresh surge adds its full delta to effective, leaving base untouched', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'test');
    expect(e.getState().chaos).toBe(80); // 50 + 30 × (3/3)
    expect(e.getBase().chaos).toBe(50);  // base untouched
  });

  it('step-down decays the contribution each tick, then expires', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'test'); // factor 3/3 → +30
    e.tickModifiers();
    expect(e.getState().chaos).toBe(70);    // factor 2/3 → +20
    e.tickModifiers();
    expect(e.getState().chaos).toBe(60);    // factor 1/3 → +10
    e.tickModifiers();
    expect(e.getState().chaos).toBe(50);    // expired → +0
    expect(e.getModifiers()).toHaveLength(0);
  });

  it('surges stack additively and expire independently', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'a'); // +30
    e.grantSurge({ chaos: 30 }, 1, 'b'); // +30, single reading
    expect(e.getState().chaos).toBe(100); // 50 + 30 + 30, clamped
    e.tickModifiers();                    // a → +20, b expired
    expect(e.getState().chaos).toBe(70);
    expect(e.getModifiers()).toHaveLength(1);
  });

  it('a Light surge lifts the effective band so peek becomes available', () => {
    const e = make(); // base light 50 = stirring → no peek
    expect(e.peekAvailable()).toBe(false);
    e.grantSurge({ light: 20 }, 3, 'test'); // effective 70 = ascendant
    expect(e.peekAvailable()).toBe(true);
    expect(e.getEffects().peekAvailable).toBe(true);
  });

  it('beginRun preserves modifiers; clearModifiers empties them', () => {
    const e = make();
    e.grantSurge({ chaos: 30 }, 3, 'test');
    e.beginRun();
    expect(e.getModifiers()).toHaveLength(1); // survives the turn boundary
    e.clearModifiers();
    expect(e.getModifiers()).toHaveLength(0);
    expect(e.getState().chaos).toBe(e.getBase().chaos);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinitySurge.test.ts`
Expected: FAIL — `e.grantSurge is not a function`.

- [ ] **Step 3: Implement the surge API**

Add to `src/engine/AffinityEngine.ts` (place after `getBase`):

```ts
  // ── Temporary surge layer ──
  grantSurge(deltas: Partial<Record<AffinityId, number>>, readings: number, source: string): void {
    if (readings <= 0) return;
    this.modifiers.push({
      id: `surge:${source}:${this.modSeq++}`,
      kind: 'surge',
      deltas: { ...deltas },
      readingsRemaining: readings,
      initialReadings: readings,
      source,
    });
  }

  // Advance every modifier one reading; drop the expired ones. Called once per
  // completed reading by the GameEngine (Task 5).
  tickModifiers(): void {
    for (const m of this.modifiers) m.readingsRemaining -= 1;
    this.modifiers = this.modifiers.filter((m) => m.readingsRemaining > 0);
  }

  clearModifiers(): void {
    this.modifiers = [];
  }

  getModifiers(): AffinityModifier[] {
    return this.modifiers.map((m) => ({ ...m, deltas: { ...m.deltas } }));
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinitySurge.test.ts`
Expected: PASS (all five tests).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 5: Document the surge model in game-systems.md**

In `docs/game-systems.md` §2, add a subsection after "Shift mechanics":

```markdown
### Base vs. effective + surges

Each affinity has a permanent **base** (persisted, drifts toward baseline at turn start)
and a run-scoped list of **surge** modifiers. The **effective** value the game acts on is
`base + Σ surge contributions`, clamped 0–100. A surge carries a per-affinity delta and a
lifetime in **readings**; its contribution decays step-down (`readingsRemaining /
initialReadings`, e.g. 100% → 66% → 33% → gone) and expires. Surges survive turn
boundaries within a session and are **not** serialized (only base persists). `getState()`
and all bands/effects/hints read **effective**; `getBase()` exposes the permanent values.
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinitySurge.test.ts docs/game-systems.md
git commit -m "feat(affinity): add decaying surge primitive (base+effective temporary layer)"
```

---

### Task 3: Feed model — drop `random` from Chaos, `take-reroll`→Chaos, capped Fortune feeds

Fixes the runaway and gives Chaos a behavior feed. Order's behavior feeds and the
Light/Shadow study affordance are **deferred to Phase 2** (they need new UI/caller context);
Phase 1 rebalances via dropping `random`, capping passive Fortune feeds, and the Task 4 retune.

**Files:**
- Modify: `src/data/affinities.ts` (Chaos tags; `take-reroll` secondary; add `FORTUNE_TAG_CAP`)
- Modify: `src/engine/AffinityEngine.ts` (add `feedFortuneTag`, `fortuneTagFeedThisRun` counter; route `applyResultTags` through it; reset the counter in `beginRun`)
- Modify: `src/engine/__tests__/AffinityShift.test.ts` (rewrite the `applyResultTags` test; add a cap test)
- Modify: `src/engine/__tests__/AffinityActions.test.ts` (add `take-reroll`→Chaos test)

**Interfaces:**
- Consumes: `shift` (Task 1), `FEED_PER_MATCH`.
- Produces: `AffinityEngine.feedFortuneTag(id: AffinityId, amount: number, source: string): number` (capped; non-Fortune ids fall back to `shift`); `FORTUNE_TAG_CAP` constant.

- [ ] **Step 1: Write the failing tests**

In `src/engine/__tests__/AffinityShift.test.ts`, **replace** the existing test
`'applyResultTags raises chaos for a reversed/random result'` (the one asserting
`chaos` 60 / `order` 44) with:

```ts
  it('applyResultTags raises chaos for a reversed result; random no longer feeds it', () => {
    const e = make();
    // 'random' is on nearly every draw and no longer feeds Chaos — only 'reversed' counts.
    const reversed = { tags: ['draw', 'random', 'reversed', 'reversible'] } as TarotResult;
    noJitter(() => e.applyResultTags(reversed)); // 1 match ('reversed') × 5 = 5
    expect(e.getState().chaos).toBe(55);
    expect(e.getState().order).toBeLessThan(50); // coupling taxes the opposite
  });

  it('caps Fortune tag feeds at +8 per run; beginRun resets the cap', () => {
    const e = make();
    noJitter(() => e.feedFortuneTag('chaos', 5, 't')); // +5 (counter 5)
    noJitter(() => e.feedFortuneTag('chaos', 5, 't')); // +3 (counter hits 8)
    expect(noJitter(() => e.feedFortuneTag('chaos', 5, 't'))).toBe(0); // cap exhausted
    e.beginRun();
    expect(noJitter(() => e.feedFortuneTag('chaos', 5, 't'))).toBeGreaterThan(0); // reset
  });
```

In `src/engine/__tests__/AffinityActions.test.ts`, add inside the
`AffinityEngine.applyAction` describe:

```ts
  it('take-reroll also feeds Chaos as a secondary (courting a swing)', () => {
    const e = make();
    noJitter(() => e.applyAction('take-reroll'));
    expect(e.getState().chaos).toBeGreaterThan(50);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/AffinityActions.test.ts`
Expected: FAIL — `feedFortuneTag is not a function`; `chaos` expected 55 but got 60; `take-reroll` chaos not > 50.

- [ ] **Step 3: Edit `src/data/affinities.ts`**

Drop `random` from Chaos's tag feeds (in `CHAOS_AFFINITY`):

```ts
  feeds: { tags: ['reversed', 'changing-lines'], actions: [] },
```

Give `take-reroll` a Chaos secondary (in `ACTION_FEEDS`):

```ts
  'take-reroll':     { primary: 'will', secondary: 'chaos' },
```

Add the cap constant next to the other tuning constants (after `FEED_PER_ACTION`):

```ts
export const FORTUNE_TAG_CAP = 8; // max base Fortune gain from result tags + coherence per run
```

- [ ] **Step 4: Add `feedFortuneTag` + counter to `AffinityEngine`**

Add the field next to `feedsThisRun`:

```ts
  private fortuneTagFeedThisRun = 0;
```

Import `FORTUNE_TAG_CAP` from `../data/affinities` (add to the existing import list).

Add the capped feed method (place after `applyAction`):

```ts
  // Capped entry point for Fortune (Chaos/Order) tag + coherence feeds. Bounds how
  // much passive RNG outcomes can move Fortune per run; behavior feeds (applyAction)
  // bypass this cap. Non-Fortune ids fall back to a plain shift. Returns realized gain.
  feedFortuneTag(id: AffinityId, amount: number, source: string): number {
    if (id !== 'chaos' && id !== 'order') return this.shift(id, amount, source);
    const remaining = Math.max(0, FORTUNE_TAG_CAP - this.fortuneTagFeedThisRun);
    const allowed = Math.min(amount, remaining);
    if (allowed <= 0) return 0;
    this.fortuneTagFeedThisRun += allowed;
    return this.shift(id, allowed, source);
  }
```

Route `applyResultTags` through it:

```ts
  applyResultTags(result: Taggable): void {
    for (const def of this.definitions) {
      if (def.feeds.tags.length === 0) continue;
      const matches = def.feeds.tags.filter((t) => result.tags.includes(t)).length;
      if (matches > 0) this.feedFortuneTag(def.id, matches * FEED_PER_MATCH, `result:${def.id}`);
    }
  }
```

Reset the counter in `beginRun` (add alongside the `feedsThisRun` reset, inside the loop body is wrong — reset once after the loop):

```ts
    this.peeksThisRun = 0;
    this.peekLocked = false;
    this.fortuneTagFeedThisRun = 0;
    this.clearMandate();
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/AffinityActions.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS — confirm `AffinityEngine.test.ts` still green (its `applyResultTags increases chaos` test uses a card with `reversed`, so Chaos still rises; `random` removal does not break it).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Update the feeds documentation**

In `docs/game-systems.md` §2 "What feeds each affinity":
- Change the **Chaos** "Fed by (result tags)" cell from `random`, `reversed`, `changing-lines` to **`reversed`, `changing-lines`**.
- Change the **Will** "Fed by (player actions)" note so `take-reroll` reads `take-reroll` **(+Chaos)**.
- Add a sentence under the table: "Fortune **tag** feeds (Chaos/Order from result tags **and** the spread/strings coherence bonuses) are capped at **+8 base per run** (`FORTUNE_TAG_CAP`); behavior feeds (player actions) are uncapped (diminishing returns still applies)."

- [ ] **Step 7: Commit**

```bash
git add src/data/affinities.ts src/engine/AffinityEngine.ts src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/AffinityActions.test.ts docs/game-systems.md
git commit -m "feat(affinity): drop random→Chaos, take-reroll→Chaos secondary, cap Fortune tag feeds"
```

---

### Task 4: Retune accumulation constants

Make high bands reachable: weaker drift and cross-pair coupling, gentler diminishing
returns. Only constants change in `affinities.ts`; the four value-asserting tests in
`AffinityShift.test.ts` are updated to the recomputed expectations.

**Files:**
- Modify: `src/data/affinities.ts` (five constants)
- Modify: `src/engine/__tests__/AffinityShift.test.ts` (coupling, DR-floor, drift tests)

**Interfaces:**
- Consumes/Produces: no new symbols — values of `COUPLING_OPPOSITE`, `COUPLING_OTHER`, `DR_STEP`, `DR_FLOOR`, `RUN_DRIFT` change.

- [ ] **Step 1: Update the affected tests first (they will fail against current constants)**

In `src/engine/__tests__/AffinityShift.test.ts`:

Replace the coupling test body assertions (the `'a gain applies coupling'` test) with:

```ts
    expect(s.chaos).toBe(60);  // 50 + 10
    expect(s.order).toBe(47);  // 50 - 10×0.35 = 46.5 → round 47 (opposite)
    expect(s.fate).toBe(49);   // 50 - 10×0.15 = 48.5 → round 49 (other)
    expect(s.will).toBe(49);
    expect(s.light).toBe(49);
    expect(s.shadow).toBe(49);
```

In the `'diminishing returns shrink successive same-run gains and floor at 0.3'` test,
update the comments and the floor assertion (rename the test to `'... floor at 0.5'`):

```ts
    const g1 = noJitter(() => e.shift('chaos', 10, 't')); // dr=1.00 → 10
    const g2 = noJitter(() => e.shift('chaos', 10, 't')); // dr=0.95 → 9.5
    const g3 = noJitter(() => e.shift('chaos', 10, 't')); // dr=0.90 → 9.0
    expect(g1).toBeGreaterThan(g2);
    expect(g2).toBeGreaterThan(g3);
    let last = 0;
    for (let i = 0; i < 50; i++) last = noJitter(() => e.shift('chaos', 10, 't'));
    expect(last).toBeGreaterThanOrEqual(5 - 0.001); // floor 0.5 → 10 × 0.5
```

In the `'beginRun drifts 33% toward 50 (rounded)'` test, rename to `'... drifts 12% ...'`
and update:

```ts
    e.setState({ chaos: 80, order: 20 });
    e.beginRun();
    expect(e.getState().chaos).toBe(76); // round(80 + (50-80)×0.12) = round(76.4)
    expect(e.getState().order).toBe(24); // round(20 + (50-20)×0.12) = round(23.6)
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts`
Expected: FAIL — coupling/DR/drift still use the old constants (e.g. `order` is 44, not 47).

- [ ] **Step 3: Retune the constants in `src/data/affinities.ts`**

```ts
export const COUPLING_OPPOSITE = 0.35;
export const COUPLING_OTHER = 0.15;
export const DR_STEP = 0.05;
export const DR_FLOOR = 0.5;
// (REACH_UP_CHANCE unchanged)
export const RUN_DRIFT = 0.12;
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS — the rest of the suite uses direction/threshold assertions and is unaffected. If any other test asserts an exact post-shift affinity number and now fails, recompute it with the new constants and update it (none are expected from the audit; AffinityEngine.test.ts and AffinityActions.test.ts use `toBeGreaterThan`/`toBeLessThan`).
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 5: Document the retune**

In `docs/game-systems.md` §2 "Shift mechanics", update the numbers: coupling is now
**opposite −35%, others −15%**; diminishing returns **−5% per prior feed, floored at 50%**;
and §2's run-drift sentence to **drifts 12% back toward baseline** at run start.

- [ ] **Step 6: Commit**

```bash
git add src/data/affinities.ts src/engine/__tests__/AffinityShift.test.ts docs/game-systems.md
git commit -m "balance(affinity): retune coupling/drift/DR so high bands are reachable"
```

---

### Task 5: GameEngine integration — tick per reading, coherence via cap, `affinityBase` snapshot, `grantSurge` API, clear-on-reset

Wires the engine into the turn lifecycle: surges decay once per completed reading, the
permanent values are exposed on the snapshot, coherence feeds count toward the Fortune cap,
a public `grantSurge` (Phase 2's entry point) exists, and full resets clear surges.

**Files:**
- Modify: `src/engine/types.ts` (add `affinityBase` to `GameState`)
- Modify: `src/engine/GameEngine.ts` (snapshot, lifecycle, coherence routing, `grantSurge`, reset clears)
- Modify: `src/engine/__tests__/GameEngine.test.ts` (surge-tick + snapshot tests)

**Interfaces:**
- Consumes: `AffinityEngine.tickModifiers/grantSurge/clearModifiers/getBase/feedFortuneTag` (Tasks 1–3).
- Produces: `GameState.affinityBase: Record<AffinityId, number>`; `GameEngine.grantSurge(deltas: Partial<Record<AffinityId, number>>, readings: number, source: string): void`.

- [ ] **Step 1: Add `affinityBase` to the `GameState` type**

In `src/engine/types.ts`, in `interface GameState`, add directly under `affinities:`:

```ts
  affinities: Record<AffinityId, number>;     // effective (base + surges)
  affinityBase: Record<AffinityId, number>;   // permanent base only (for surge transparency/debug)
```

- [ ] **Step 2: Write the failing GameEngine tests**

In `src/engine/__tests__/GameEngine.test.ts`, add a new describe block at the end of the file:

```ts
describe('GameEngine — affinity surges', () => {
  it('exposes affinityBase on the snapshot and reflects a granted surge in effective affinities', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.grantSurge({ chaos: 30 }, 3, 'test');
    const s = engine.getState();
    expect(s.affinityBase.chaos).toBe(50);     // permanent base
    expect(s.affinities.chaos).toBe(80);       // effective = base + 30 (factor 1.0)
  });

  it('ticks surges once per completed reading (step-down decay)', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.grantSurge({ chaos: 30 }, 3, 'test');
    const orig = Math.random; Math.random = () => 0.99; // suppress probabilistic responders/happenings
    try {
      const methods = engine.getState().availableMethods;
      const idx = methods.findIndex((m) => m !== 'happening');
      engine.selectMethod(idx);
      engine.completeMinigame(dieResult()); // dieResult carries no Fortune tags → base unchanged
      if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
      if (engine.getState().awaitingContinue) engine.continueAfterReview();
    } finally {
      Math.random = orig;
    }
    const s = engine.getState();
    expect(s.affinityBase.chaos).toBe(50);   // base still untouched by the surge
    expect(s.affinities.chaos).toBe(70);     // surge decayed one step: +20 (factor 2/3)
  });

  it('clears surges on reset', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.grantSurge({ chaos: 30 }, 3, 'test');
    engine.reset();
    const s = engine.getState();
    expect(s.affinities.chaos).toBe(s.affinityBase.chaos); // no surge contribution
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "affinity surges"`
Expected: FAIL — `engine.grantSurge is not a function`; `affinityBase` undefined.

- [ ] **Step 4: Implement the GameEngine wiring**

In `src/engine/GameEngine.ts`:

Add `affinityBase` to `defaultState()` (directly under the `affinities:` line):

```ts
      affinities: defaultAffinityState(),
      affinityBase: defaultAffinityState(),
```

Set it in `notify()` (add under the existing `this.state.affinities` line):

```ts
    this.state.affinities = this.affinityEngine.getState();
    this.state.affinityBase = this.affinityEngine.getBase();
```

Tick surges once per completed reading — in `advanceAfterCommit`, alongside `decayMandate()`:

```ts
    this.affinityEngine.decayMandate();
    this.affinityEngine.tickModifiers(); // decay/expire surges once per completed reading
```

Route the spread/strings coherence feeds through the Fortune cap — in `completeMinigame`,
replace the four `this.affinityEngine.shift('order'|'chaos', 6, ...)` calls (the spread and
strings coherence blocks) with `feedFortuneTag`:

```ts
      if (faces.every((f) => f.orientation === 'upright')) this.affinityEngine.feedFortuneTag('order', 6, 'spread-aligned');
      else if (faces.every((f) => f.orientation === 'reversed')) this.affinityEngine.feedFortuneTag('chaos', 6, 'spread-cascade');
```

```ts
      if (coh === 'coherent') this.affinityEngine.feedFortuneTag('order', 6, 'strings-coherent');
      else if (coh === 'tangled') this.affinityEngine.feedFortuneTag('chaos', 6, 'strings-tangled');
```

Add the public `grantSurge` (place near `getAffinityEffects`, around line 1175):

```ts
  // Public entry point for granting a temporary affinity surge. Phase 2 happenings and
  // responders call this; it notifies so the effective affinities surface on the snapshot.
  grantSurge(deltas: Partial<Record<AffinityId, number>>, readings: number, source: string): void {
    this.affinityEngine.grantSurge(deltas, readings, source);
    this.notify();
  }
```

Clear surges on full resets — add `this.affinityEngine.clearModifiers();` immediately after
each `this.affinityEngine.setState(...)` in `returnToTitle()`, `reset()`, and
`clearHistory()`, and after the second `setState(stage.affinities)` in `loadScenarioById()`.

**Also**, in `reset()` and `returnToTitle()` the affinity carryover is currently captured
with `this.affinityEngine.getState()` (which returns **effective** — it would bake a live
surge into the permanent base). Change those two captures to `getBase()` so only the
permanent value carries across the reset. Example (in `reset()`, line ~1343):

```ts
    const affinities = this.affinityEngine.getBase(); // permanent only, not effective
    const history = this.state.history;
    const usedIds = Array.from(this.usedHappeningIds);
    this.state = this.defaultState();
    this.state.debug = debug;
    this.state.debugConfig = debugConfig;
    this.affinityEngine.setState(affinities);
    this.affinityEngine.clearModifiers();
```

And in `returnToTitle()` (line ~1321) change `affinities: this.affinityEngine.getState()`
in the `saved` object to `affinities: this.affinityEngine.getBase()`, then add
`this.affinityEngine.clearModifiers();` after its `setState(saved.affinities)`.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts`
Expected: PASS (including the new "affinity surges" block).
Run: `npm test`
Expected: PASS — full suite green.
Run: `npx tsc -b`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(affinity): wire surges into the turn lifecycle and snapshot"
```

---

### Task 6: Documentation sync + full verification

Finish the CLAUDE.md-required doc sync (README + source-of-truth pointers) and run the
complete verification gate against the spec.

**Files:**
- Modify: `docs/game-systems.md` (source-of-truth table; §3 effective note)
- Modify: `README.md` (affinity tuning numbers)

**Interfaces:** none (documentation + verification only).

- [ ] **Step 1: Finish game-systems.md cross-cutting edits**

- In §3 (Effects of each band) add a note: "Bands are read from the **effective** value
  (`base + surges`), so a surge can temporarily grant a higher band's effects."
- In the source-of-truth table at the top, the `AffinityEngine.ts` row already covers shift
  math and effects — append "base/effective split + surge layer" to its description.

- [ ] **Step 2: Update README affinity numbers**

Locate the README affinity section and update any stated tuning values to match the new
constants. Find the spots:
Run: `grep -nE "33%|60%|35%|random" README.md`
For each affinity-tuning hit, update: drift **33% → 12%**; coupling **opposite 60% → 35%,
others 35% → 15%**; and remove `random` from any "feeds Chaos" list (Chaos is fed by
`reversed`, `changing-lines`). If the README does not enumerate these numbers, no change is
needed — note that in the commit body.

- [ ] **Step 3: Full verification gate**

Run: `npm test`
Expected: PASS — entire engine suite green.
Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 4: Spec-coverage self-check**

Confirm each Phase 1 spec item maps to a task (record the mapping in the commit body):
base/effective split + getBase (T1) · surge primitive/decay/stack/expiry (T2) · drop
`random`, `take-reroll`→Chaos, Fortune cap (T3) · drift/coupling/DR retune (T4) · per-reading
tick + `affinityBase` snapshot + `grantSurge` + clear-on-reset (T5) · docs (T2/T3/T4/T6).
Note explicitly that **Order behavior feeds, the contextual Shadow-on-unused-peek feed, and
the ungated "study" Light affordance are deferred to Phase 2** (they need new UI/caller
context and the happenings surface).

- [ ] **Step 5: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(affinity): sync game-systems + README for the Phase 1 affinity overhaul"
```

---

## Out of scope (later phases — do NOT build here)

- **Phase 2:** happenings overhaul (the `HappeningEffect` union, `pendingReadingEffects`,
  cadence/selection, UI), Order behavior feeds, contextual Shadow feed, the "study" Light
  affordance, and the production callers of `grantSurge`.
- **Phase 3:** upheaval `transform` modifiers (extend the `AffinityModifier` union), the
  emergent-at-extreme responder, opt-in happening upheavals.
- **Phase 4:** Seed of Corruption.
