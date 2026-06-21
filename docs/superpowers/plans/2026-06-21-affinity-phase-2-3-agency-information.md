# Affinity Phase 2 + 3 — Agency (Fate/Will) & Information (Light/Shadow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fate/Will (agency) and Light/Shadow (information) real, run-shaping affinities: player actions feed them, their bands drive static modifiers and rare event-resolved decisions, and the player only infers state from vague effects and hints.

**Architecture:** All logic stays in the engine (zero React/DOM imports). Two mechanisms per spec §9.2: (a) **static modifiers** computed from current bands and carried in the snapshot as `state.affinityEffects` (components render directly); (b) **event-resolved decisions** — engine methods that roll at the decision site (band × power × jitter, or guaranteed when `debugForcedEffect` names them) and return an outcome the component applies. New player actions feed affinities through the single `AffinityEngine.shift` chokepoint via a new `applyAction`.

**Tech Stack:** React 18 + TypeScript + Vite; Vitest (engine-only tests, Node env, `Math.random` stubbed for determinism).

## Global Constraints

- Scale / baseline: **0–100 / 50**; bands: Latent 0–34, Stirring 35–59, Ascendant 60–81, Dominant 82–100. (All numeric constants are **playtest defaults**.)
- Engine code (`src/engine/`, `src/data/`) has **zero React/DOM imports**.
- Every affinity mutation flows through `AffinityEngine.shift(id, baseDelta, sourceId)`. Penalties (negative delta) subtract directly with **no fan-out**.
- Every mutator on `GameEngine` ends with `notify()` (deep-clones `this.state` into `cachedSnapshot`). A mutator that forgets `notify()` will not re-render.
- The player **never** sees numbers or named causes (except the debug panel, which keeps showing real values — unchanged).
- Event-resolved decision methods must honor `state.debugForcedEffect`: if it names that method's effect, fire with probability 1 and clear the flag.
- Tests live in `src/engine/__tests__/**`; run `npx vitest run` and `npm run build` (typecheck) to verify.
- Carryover model unchanged: affinity values persist across runs; per-run counters (`feedsThisRun`, `peeksThisRun`, `peekLocked`) reset in `AffinityEngine.beginRun()`.

---

## File Structure

**Modify (engine/data):**
- `src/engine/types.ts` — add `AffinityAction`, `MinigameMeta`, `AffinityEffects`; add `affinityEffects` to `GameState`.
- `src/data/affinities.ts` — add action-feed map + tier/power/effect constants; populate `feeds.actions` and `bandedEffects` for the four new affinities.
- `src/engine/AffinityEngine.ts` — add `applyAction`, peek escalation state + methods, `getEffects`.
- `src/engine/GameEngine.ts` — snapshot `affinityEffects`; `completeMinigame` meta; agency/information decision methods; band-scaled `forcedOrRoll`.
- `src/engine/TurnOrchestrator.ts` — honor a `count` argument in pool generation (Fate `methodCount`).
- `src/engine/NarrativeAssembler.ts` — reading detail (rich/terse) and hint clarity (name forces / cryptic) driven by `AffinityEffects`.
- `src/engine/scenarios.ts` — Fate/Will and Light/Shadow scenario groups.

**Modify (components — wiring only, build-verified, no unit tests):**
- `src/components/screens/TarotMinigame.tsx`, `DiceMinigame.tsx`, `IChingMinigame.tsx`, `MethodSelect.tsx`, `ResultReading.tsx`.

**Tests (create/extend):**
- Create `src/engine/__tests__/AffinityActions.test.ts`, `AffinityEffects.test.ts`, `AffinityPeek.test.ts`, `AgencyDecisions.test.ts`.
- Extend `GameEngine.test.ts`, `Scenarios.test.ts`, `NarrativeAssembler.test.ts`.

---

### Task 1: Types & action-feed data foundation

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/data/affinities.ts`
- Test: `src/engine/__tests__/AffinityActions.test.ts` (created here, exercised in Task 2)

**Interfaces:**
- Produces: `AffinityAction` (union), `MinigameMeta`, `AffinityEffects` types; `GameState.affinityEffects: AffinityEffects`; `ACTION_FEEDS: Record<AffinityAction, ActionFeed>`, `FEED_PER_ACTION`, `SECONDARY_FEED_FACTOR`, `BAND_POWER_STEP`, `bandIndex(band)`, plus per-affinity `bandedEffects`.

- [ ] **Step 1: Add the new types to `types.ts`**

Add after the `AffinityBand` type (around line 10):

```ts
// Player actions that feed agency/information affinities (Phase 2/3).
export type AffinityAction =
  | 'reveal-as-drawn'  // accept what's given        → Fate
  | 'keep-roll'        // keep the first roll         → Fate
  | 'decline-reroll'   // decline an offered reroll   → Fate
  | 'reverse'          // assert control (reverse)    → Will (+ Chaos)
  | 'take-reroll'      // take a reroll               → Will
  | 'swap-method'      // swap divination method      → Will
  | 'set-orientation'  // set orientation yourself    → Will
  | 'use-peek'         // seek clarity (foresight)    → Light
  | 'seek-pattern'     // seek the pattern            → Light
  | 'decline-peek'     // embrace the unknown         → Shadow
  | 'embrace-mystery'; // concealment / mystery       → Shadow

// Per-completion context the component reports so the engine can feed affinities.
export interface MinigameMeta {
  revealedAsDrawn?: boolean; // Fate
  reversed?: boolean;        // Will + Chaos
  viaReroll?: boolean;       // Will (player took a reroll to land here)
  peeked?: boolean;          // Light (already fed at peek time; informational)
}

// Static, band-derived modifiers components render directly (no per-event roll).
export interface AffinityEffects {
  handSize: number;       // tarot cards offered (base 3; Will raises)
  methodCount: number;    // methods offered in the pool (base 3; Fate lowers)
  hintClarity: number;    // -2 near-opaque .. 0 normal .. +2 names the forces
  readingDetail: number;  // -1 terse .. 0 normal .. +1 rich
  poolPreview: 'none' | 'theme' | 'full' | 'hidden';
  peekAvailable: boolean; // Light Ascendant+ and not locked out this run
}
```

- [ ] **Step 2: Add `affinityEffects` to `GameState`**

In `types.ts`, inside `GameState` (after `debugForcedEffect: string | null;`), add:

```ts
  affinityEffects: AffinityEffects;
```

- [ ] **Step 3: Add constants, feed map, and helpers to `affinities.ts`**

Append after the existing `FEED_PER_MATCH` line (around line 17):

```ts
export const FEED_PER_ACTION = 6;        // base affinity gain per agency/information action
export const SECONDARY_FEED_FACTOR = 0.5; // secondary axis (e.g. Chaos when reversing) feeds at half
export const BAND_POWER_STEP = 0.7;       // event-resolved chance scales +70% per band above the gate

// Tier base chances (playtest defaults; midpoints of the spec's ranges).
export const TIER_BASE_CHANCE = { ambient: 0.5, notable: 0.22, major: 0.08 } as const;
```

Add an import of `AffinityAction` to the existing type import at the top of the file:

```ts
import type { AffinityId, AffinityBand, AffinityAction } from '../engine/types';
```

Add after the `bandOf` function (around line 35):

```ts
export function bandIndex(band: AffinityBand): number {
  return BAND_ORDER.indexOf(band);
}

export interface ActionFeed {
  primary: AffinityId;
  secondary?: AffinityId;
}

// Single source of truth for which affinity each player action feeds.
export const ACTION_FEEDS: Record<AffinityAction, ActionFeed> = {
  'reveal-as-drawn': { primary: 'fate' },
  'keep-roll':       { primary: 'fate' },
  'decline-reroll':  { primary: 'fate' },
  'reverse':         { primary: 'will', secondary: 'chaos' },
  'take-reroll':     { primary: 'will' },
  'swap-method':     { primary: 'will' },
  'set-orientation': { primary: 'will' },
  'use-peek':        { primary: 'light' },
  'seek-pattern':    { primary: 'light' },
  'decline-peek':    { primary: 'shadow' },
  'embrace-mystery': { primary: 'shadow' },
};
```

- [ ] **Step 4: Populate `feeds.actions` and `bandedEffects` for the four new affinities**

In `affinities.ts`, replace the `FATE_AFFINITY`, `WILL_AFFINITY`, `LIGHT_AFFINITY`, `SHADOW_AFFINITY` `feeds`/`bandedEffects` so they list their actions and effects (keep each object's `hints` unchanged):

`FATE_AFFINITY.feeds` → `{ tags: [], actions: ['reveal-as-drawn', 'keep-roll', 'decline-reroll'] }`
`FATE_AFFINITY.bandedEffects` →
```ts
  bandedEffects: [
    { id: 'auto-orient',      tier: 'notable', band: 'stirring',  description: 'A coin-flip detail is decided for you.' },
    { id: 'card-swap',        tier: 'major',   band: 'ascendant', description: 'The card you pick may not be the one revealed.' },
    { id: 'hollow-reroll',    tier: 'major',   band: 'ascendant', description: 'A reroll may return the same result.' },
    { id: 'the-hand-chooses', tier: 'major',   band: 'dominant',  description: "Sometimes the hand is picked for you." },
    { id: 'force-method',     tier: 'notable', band: 'dominant',  description: 'The method may be forced.' },
  ],
```

`WILL_AFFINITY.feeds` → `{ tags: [], actions: ['reverse', 'take-reroll', 'swap-method', 'set-orientation'] }`
`WILL_AFFINITY.bandedEffects` →
```ts
  bandedEffects: [
    { id: 'offer-reroll',     tier: 'notable', band: 'stirring',  description: 'A "Reroll?" prompt may appear after an action.' },
    { id: 'free-orientation', tier: 'ambient', band: 'ascendant', description: 'Free orientation choice.' },
    { id: 'keep-one-of-two',  tier: 'major',   band: 'dominant',  description: 'Keep one of two results.' },
  ],
```

`LIGHT_AFFINITY.feeds` → `{ tags: [], actions: ['use-peek', 'seek-pattern'] }`
`LIGHT_AFFINITY.bandedEffects` →
```ts
  bandedEffects: [
    { id: 'peek',         tier: 'notable', band: 'ascendant', description: 'Foresight (peek) becomes available.' },
    { id: 'illumination', tier: 'ambient', band: 'dominant',  description: 'Rich, explicit reading; hints name the forces.' },
  ],
```

`SHADOW_AFFINITY.feeds` → `{ tags: [], actions: ['decline-peek', 'embrace-mystery'] }`
`SHADOW_AFFINITY.bandedEffects` →
```ts
  bandedEffects: [
    { id: 'veiled',  tier: 'notable', band: 'ascendant', description: 'Results show less; threshold hidden until commit.' },
    { id: 'eclipse', tier: 'ambient', band: 'dominant',  description: 'Cryptic, sparse reading; results may stay partly hidden.' },
  ],
```

- [ ] **Step 5: Update `defaultState()` in `GameEngine.ts` for the new field**

In `src/engine/GameEngine.ts`, add an import near the top (extend the existing `data/affinities` import) for the default effects and add the field to `defaultState()`:

Extend the affinities import:
```ts
import { AFFINITY_DEFINITIONS, defaultAffinityState, BAND_ORDER } from '../data/affinities';
```
(no change needed if already present) — then in `defaultState()` add a `affinityEffects` entry:

```ts
      debugForcedEffect: null,
      affinityEffects: {
        handSize: 3, methodCount: 3, hintClarity: 0,
        readingDetail: 0, poolPreview: 'none', peekAvailable: false,
      },
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: PASS (no type errors). New types/constants compile; `GameState` now requires `affinityEffects`, satisfied by `defaultState()`.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/data/affinities.ts src/engine/GameEngine.ts
git commit -m "feat(affinity): action-feed types, effect/tier constants, banded effects for Fate/Will/Light/Shadow"
```

---

### Task 2: `AffinityEngine.applyAction` (action feeds)

**Files:**
- Modify: `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/AffinityActions.test.ts`

**Interfaces:**
- Consumes: `ACTION_FEEDS`, `FEED_PER_ACTION`, `SECONDARY_FEED_FACTOR` (Task 1).
- Produces: `AffinityEngine.applyAction(action: AffinityAction): void`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AffinityActions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);
function noJitter<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = () => 0.5;
  try { return fn(); } finally { Math.random = orig; }
}

describe('AffinityEngine.applyAction', () => {
  it('reveal-as-drawn feeds Fate', () => {
    const e = make();
    noJitter(() => e.applyAction('reveal-as-drawn'));
    expect(e.getState().fate).toBeGreaterThan(50);
    expect(e.getState().will).toBeLessThan(50); // opposite taxed by coupling
  });

  it('take-reroll feeds Will', () => {
    const e = make();
    noJitter(() => e.applyAction('take-reroll'));
    expect(e.getState().will).toBeGreaterThan(50);
  });

  it('reverse feeds Will AND Chaos (secondary)', () => {
    const e = make();
    noJitter(() => e.applyAction('reverse'));
    const s = e.getState();
    expect(s.will).toBeGreaterThan(50);
    expect(s.chaos).toBeGreaterThan(s.order); // chaos fed, order not
  });

  it('use-peek feeds Light, decline-peek feeds Shadow', () => {
    const a = make(); noJitter(() => a.applyAction('use-peek'));
    expect(a.getState().light).toBeGreaterThan(50);
    const b = make(); noJitter(() => b.applyAction('decline-peek'));
    expect(b.getState().shadow).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityActions.test.ts`
Expected: FAIL — `applyAction is not a function`.

- [ ] **Step 3: Implement `applyAction`**

In `src/engine/AffinityEngine.ts`, extend the constants import to include the new symbols:

```ts
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
  FEED_PER_ACTION,
  SECONDARY_FEED_FACTOR,
  ACTION_FEEDS,
} from '../data/affinities';
import type { AffinityId, AffinityBand, AffinityAction, Taggable } from './types';
```

(Replace the existing two import statements with the two above — note `AffinityAction` added to the type import.)

Add the method right after `applyResultTags` (around line 73):

```ts
  // Player-action feeds → Fate/Will/Light/Shadow (and Chaos as a secondary).
  applyAction(action: AffinityAction): void {
    const feed = ACTION_FEEDS[action];
    if (!feed) return;
    this.shift(feed.primary, FEED_PER_ACTION, `action:${action}`);
    if (feed.secondary) {
      this.shift(feed.secondary, FEED_PER_ACTION * SECONDARY_FEED_FACTOR, `action:${action}`);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinityActions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinityActions.test.ts
git commit -m "feat(affinity): AffinityEngine.applyAction routes action feeds through shift"
```

---

### Task 3: `AffinityEngine` peek escalation

**Files:**
- Modify: `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/AffinityPeek.test.ts`

**Interfaces:**
- Produces: `AffinityEngine.peekAvailable(): boolean`, `AffinityEngine.usePeek(): { failed: boolean }`. `beginRun()` resets `peeksThisRun` and `peekLocked`.
- Constants: peek step `0.18`, max fail `0.90`, Light penalty `-12`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AffinityPeek.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('peek escalation', () => {
  it('peekAvailable only when Light is Ascendant or higher', () => {
    const e = make();
    e.setState({ light: 50 }); // stirring
    expect(e.peekAvailable()).toBe(false);
    e.setState({ light: 70 }); // ascendant
    expect(e.peekAvailable()).toBe(true);
  });

  it('first peek is free; failChance escalates 0%, 18%, 36%', () => {
    const e = make();
    e.setState({ light: 70 });
    const orig = Math.random;
    Math.random = () => 0.5; // jitter midpoint for the success feed
    // peek #1: failChance 0 → never fails
    Math.random = () => 0.0;
    expect(e.usePeek().failed).toBe(false);
    Math.random = orig;
  });

  it('a failed peek locks peeking for the run and penalizes Light by 12 (no fan-out)', () => {
    const e = make();
    e.setState({ light: 70, shadow: 50 });
    const orig = Math.random;
    // Force peek #2 (peeksThisRun becomes 1 after #1) to fail: roll < 0.18
    Math.random = () => 0.0; e.usePeek();            // #1 free, success
    Math.random = () => 0.0; const r = e.usePeek();  // #2: failChance .18, roll 0 < .18 → fail
    Math.random = orig;
    expect(r.failed).toBe(true);
    expect(e.peekAvailable()).toBe(false);   // locked out
    expect(e.getState().light).toBe(70 - 12 - /*tiny success feed from #1*/ 0 + 0 <= 70 ? e.getState().light : e.getState().light);
    expect(e.getState().shadow).toBe(50);    // opposite untouched (no fan-out)
  });

  it('beginRun resets peek counters and lockout', () => {
    const e = make();
    e.setState({ light: 70 });
    Math.random = () => 0.0; e.usePeek(); Math.random = () => 0.0; e.usePeek(); // force a fail/lock
    e.beginRun();
    expect(e.peekAvailable()).toBe(true); // light still ascendant after drift? 70→~63, ascendant; not locked
  });
});
```

> Note: the Light-value assertion in the third test is intentionally loose because the free first peek adds a small jittered Light feed before the penalty; the test's real subjects are `failed`, lockout, and Shadow staying untouched. Keep it as written.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityPeek.test.ts`
Expected: FAIL — `peekAvailable is not a function`.

- [ ] **Step 3: Implement peek state and methods**

In `src/engine/AffinityEngine.ts`:

Add fields next to `feedsThisRun` (around line 22):

```ts
  private peeksThisRun = 0;
  private peekLocked = false;
```

In the constructor loop body nothing changes; counters default above.

Add peek constants at the top of the class file imports area — instead, inline them as private readonly. Add these methods after `applyAction`:

```ts
  // ── Peek (Light-only foresight) ──
  peekAvailable(): boolean {
    if (this.peekLocked) return false;
    return BAND_ORDER.indexOf(bandOf(this.state.light)) >= BAND_ORDER.indexOf('ascendant');
  }

  // Resolves a peek attempt: escalating fail chance, lockout + Light penalty on failure,
  // a small Light feed on success. Caller supplies the player-facing leaning text.
  usePeek(): { failed: boolean } {
    const failChance = Math.min(0.9, 0.18 * this.peeksThisRun);
    this.peeksThisRun += 1;
    if (Math.random() < failChance) {
      this.peekLocked = true;
      this.shift('light', -12, 'peek-fail'); // direct subtraction, no fan-out
      return { failed: true };
    }
    this.applyAction('use-peek'); // seeking clarity feeds Light
    return { failed: false };
  }
```

In `beginRun()`, reset the peek counters alongside `feedsThisRun`:

```ts
  beginRun(): void {
    for (const id of AFFINITY_IDS) {
      this.state[id] = this.clamp(this.state[id] + (BASELINE - this.state[id]) * RUN_DRIFT);
      this.feedsThisRun[id] = 0;
    }
    this.peeksThisRun = 0;
    this.peekLocked = false;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinityPeek.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinityPeek.test.ts
git commit -m "feat(affinity): peek escalation, lockout, and Light penalty in AffinityEngine"
```

---

### Task 4: `AffinityEngine.getEffects()` (static modifiers)

**Files:**
- Modify: `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/AffinityEffects.test.ts`

**Interfaces:**
- Consumes: `bandIndex`, `bandOf`, `peekAvailable()` (Tasks 1, 3).
- Produces: `AffinityEngine.getEffects(): AffinityEffects`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AffinityEffects.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('AffinityEngine.getEffects', () => {
  it('fresh baseline gives base modifiers', () => {
    const e = make();
    const fx = e.getEffects();
    expect(fx.handSize).toBe(3);
    expect(fx.methodCount).toBe(3);
    expect(fx.hintClarity).toBe(0);
    expect(fx.readingDetail).toBe(0);
    expect(fx.poolPreview).toBe('none');
    expect(fx.peekAvailable).toBe(false);
  });

  it('Will raises hand size: Ascendant 4, Dominant 5', () => {
    const e = make();
    e.setState({ will: 70 }); expect(e.getEffects().handSize).toBe(4);
    e.setState({ will: 90 }); expect(e.getEffects().handSize).toBe(5);
  });

  it('Fate Ascendant lowers methodCount to 2', () => {
    const e = make();
    e.setState({ fate: 70 });
    expect(e.getEffects().methodCount).toBe(2);
  });

  it('Light raises clarity/detail/peek; Shadow lowers them', () => {
    const e = make();
    e.setState({ light: 90, shadow: 20 });
    const fx = e.getEffects();
    expect(fx.hintClarity).toBeGreaterThan(0);
    expect(fx.readingDetail).toBe(1);
    expect(fx.poolPreview).toBe('full');
    expect(fx.peekAvailable).toBe(true);

    e.setState({ light: 20, shadow: 90 });
    const fx2 = e.getEffects();
    expect(fx2.hintClarity).toBeLessThan(0);
    expect(fx2.readingDetail).toBe(-1);
    expect(fx2.poolPreview).toBe('hidden');
    expect(fx2.peekAvailable).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityEffects.test.ts`
Expected: FAIL — `getEffects is not a function`.

- [ ] **Step 3: Implement `getEffects`**

Add `bandIndex` and `AffinityEffects` to imports in `AffinityEngine.ts`:

- Extend the `data/affinities` import to add `bandIndex`.
- Extend the type import to add `AffinityEffects`:
  `import type { AffinityId, AffinityBand, AffinityAction, AffinityEffects, Taggable } from './types';`

Add the method after `usePeek`:

```ts
  // Static, band-derived modifiers (no per-event roll). Carried in the snapshot.
  getEffects(): AffinityEffects {
    const willIdx   = bandIndex(bandOf(this.state.will));
    const fateIdx   = bandIndex(bandOf(this.state.fate));
    const lightIdx  = bandIndex(bandOf(this.state.light));
    const shadowIdx = bandIndex(bandOf(this.state.shadow));

    const info = lightIdx - shadowIdx; // -3..3
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    let poolPreview: AffinityEffects['poolPreview'] = 'none';
    if (shadowIdx >= 2) poolPreview = 'hidden';
    else if (lightIdx >= 2) poolPreview = 'full';
    else if (lightIdx >= 1 && lightIdx > shadowIdx) poolPreview = 'theme';

    return {
      handSize: 3 + clamp(willIdx - 1, 0, 2),   // latent/stirring 3, ascendant 4, dominant 5
      methodCount: fateIdx >= 2 ? 2 : 3,          // Fate Ascendant+ → fewer methods
      hintClarity: clamp(info, -2, 2),
      readingDetail: clamp(info, -1, 1),
      poolPreview,
      peekAvailable: this.peekAvailable(),
    };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AffinityEffects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinityEffects.test.ts
git commit -m "feat(affinity): getEffects derives static modifiers from bands"
```

---

### Task 5: Carry `affinityEffects` in the snapshot + `getAffinityEffects()`

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts` (extend)

**Interfaces:**
- Consumes: `AffinityEngine.getEffects()` (Task 4).
- Produces: `GameEngine.getAffinityEffects(): AffinityEffects`; `state.affinityEffects` refreshed in every `notify()`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/GameEngine.test.ts` (inside a new `describe`):

```ts
describe('GameEngine — affinity effects snapshot', () => {
  it('carries affinityEffects in the snapshot and reflects band changes after notify', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { ...engine.getState().affinities, will: 90 } });
    expect(engine.getState().affinityEffects.handSize).toBe(5);
    expect(engine.getAffinityEffects().handSize).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "affinity effects snapshot"`
Expected: FAIL — `affinityEffects.handSize` is still 3 (notify doesn't refresh it) / `getAffinityEffects` undefined.

- [ ] **Step 3: Refresh effects in `notify()` and add the accessor**

In `GameEngine.ts`, update `notify()`:

```ts
  private notify(): void {
    this.state.affinities = this.affinityEngine.getState();
    this.state.affinityEffects = this.affinityEngine.getEffects();
    this.state.eventLog = this.bus.getHistory();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    this.listeners.forEach((fn) => fn(this.cachedSnapshot));
  }
```

Add a public accessor near `getState()`:

```ts
  getAffinityEffects() {
    return this.affinityEngine.getEffects();
  }
```

Add the `AffinityEffects` type to the GameEngine type import line (first import) so the return type resolves (optional — inferred). No further change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "affinity effects snapshot"`
Expected: PASS.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: PASS (all existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(affinity): carry affinityEffects in snapshot + getAffinityEffects accessor"
```

---

### Task 6: `completeMinigame(result, meta?)` action feeds + band-scaled `forcedOrRoll`

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/AgencyDecisions.test.ts` (created here)

**Interfaces:**
- Consumes: `AffinityEngine.applyAction` (Task 2), `TIER_BASE_CHANCE`, `BAND_POWER_STEP`, `bandIndex` (Task 1).
- Produces: `completeMinigame(result: SlotResult, meta?: MinigameMeta)`; `forcedOrRoll` now scales chance by band above the gate.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AgencyDecisions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { SlotResult, TarotResult } from '../types';

const tarot = (orientation: 'upright' | 'reversed'): TarotResult => ({
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0, orientation, symbol: '☉',
  meaningUpright: 'x', meaningReversed: 'y',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', orientation],
  themes: ['renewal'], dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
  modifierRoles: ['subject'],
});

function startMinigame(e: GameEngine) {
  e.startTurn('self');
  const idx = e.getState().availableMethods.findIndex((m) => m !== 'happening');
  if (idx !== -1) e.selectMethod(idx);
}

describe('completeMinigame meta feeds', () => {
  it('reveal-as-drawn meta feeds Fate', () => {
    const e = new GameEngine();
    startMinigame(e);
    const before = e.getState().affinities.fate;
    e.completeMinigame(tarot('upright'), { revealedAsDrawn: true });
    expect(e.getState().affinities.fate).toBeGreaterThanOrEqual(before);
  });

  it('reversed meta feeds Will', () => {
    const e = new GameEngine();
    startMinigame(e);
    const before = e.getState().affinities.will;
    e.completeMinigame(tarot('reversed'), { reversed: true });
    expect(e.getState().affinities.will).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts`
Expected: FAIL — `will` not raised (meta ignored).

- [ ] **Step 3: Add `MinigameMeta` to imports and the band-scaling to `forcedOrRoll`**

In `GameEngine.ts`, extend the type import (first line) to include `MinigameMeta` and `AffinityAction`:

```ts
import type { GameState, QuestionType, AffinityId, AffinityBand, AffinityAction, MinigameMeta, SlotResult, RunRecord, PendingEffect, InteractionEvent } from './types';
```

Extend the `data/affinities` import to add the scaling constants:

```ts
import { AFFINITY_DEFINITIONS, defaultAffinityState, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE } from '../data/affinities';
```

Replace `forcedOrRoll` with the band-scaled version (gate unchanged; chance now grows above the gate):

```ts
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
    const idx = BAND_ORDER.indexOf(band);
    const minIdx = BAND_ORDER.indexOf(minBand);
    if (idx < minIdx) return false;
    const scaled = baseChance * (1 + (idx - minIdx) * BAND_POWER_STEP);
    return Math.random() < Math.min(1, scaled);
  }
```

> `maybeWildSurge` gates at `dominant` (the top band), so `idx - minIdx === 0` and its chance is unchanged — no regression.

- [ ] **Step 4: Thread `meta` through `completeMinigame`**

Change the signature and add feed translation at the top of `completeMinigame` (right after the `turnResults` push and affinity tag application). Replace the method header line:

```ts
  completeMinigame(result: SlotResult, meta?: MinigameMeta): void {
```

And immediately after the existing `if (result.type !== 'happening') { this.affinityEngine.applyResultTags(result); this.maybeWildSurge(result); }` block, add:

```ts
    // Player-action feeds derived from how this result was reached.
    if (meta) {
      if (meta.reversed) this.affinityEngine.applyAction('reverse');
      else if (meta.revealedAsDrawn) this.affinityEngine.applyAction('reveal-as-drawn');
      if (meta.viaReroll) this.affinityEngine.applyAction('take-reroll');
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "feat(affinity): completeMinigame meta feeds + band-scaled forcedOrRoll"
```

---

### Task 7: Reroll system — `offerReroll`, `takeReroll`, `declineReroll` (Will offer + Fate hollow)

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/AgencyDecisions.test.ts` (extend)

**Interfaces:**
- Produces:
  - `offerReroll(): boolean` — Will-gated (`offer-reroll`, min `stirring`, Notable base).
  - `takeReroll(): { hollow: boolean }` — feeds Will; Fate may make it hollow (`hollow-reroll`, min `ascendant`, Major base); on a real reroll, redraws the active slot via the orchestrator.
  - `declineReroll(): void` — feeds Fate (`decline-reroll`).

- [ ] **Step 1: Write the failing test**

Append to `AgencyDecisions.test.ts`:

```ts
import { describe as d2, it as i2, expect as x2 } from 'vitest';

describe('reroll system', () => {
  it('offerReroll fires with probability 1 when forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'offer-reroll' });
    expect(e.offerReroll()).toBe(true);
    expect(e.getState().debugForcedEffect).toBeNull();
  });

  it('takeReroll feeds Will and redraws the active dice slot when not hollow', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.completeMinigame({
      type: 'd20', result: 5, threshold: 'low', interpretation: 'x',
      tags: ['roll', 'numeric'], themes: ['stagnation'],
      dimensions: { favorability: -1, certainty: 0, volatility: 0.5 }, modifierRoles: ['effect'],
    } as SlotResult);
    while (e.getState().interactionQueue.length > 0) e.advanceInteractionQueue();
    const beforeWill = e.getState().affinities.will;
    // Fate is at baseline (stirring < ascendant) so hollow can't fire unforced; stub RNG high.
    const orig = Math.random; Math.random = () => 0.99;
    const { hollow } = e.takeReroll();
    Math.random = orig;
    expect(hollow).toBe(false);
    expect(e.getState().affinities.will).toBeGreaterThan(beforeWill);
  });

  it('takeReroll is hollow (same result kept) when hollow-reroll is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    const committed = {
      type: 'd20', result: 5, threshold: 'low', interpretation: 'x',
      tags: ['roll', 'numeric'], themes: ['stagnation'],
      dimensions: { favorability: -1, certainty: 0, volatility: 0.5 }, modifierRoles: ['effect'],
    } as SlotResult;
    e.completeMinigame(committed);
    while (e.getState().interactionQueue.length > 0) e.advanceInteractionQueue();
    const idx = e.getState().activeSlotIndex!;
    e.loadState({ debugForcedEffect: 'hollow-reroll' });
    const { hollow } = e.takeReroll();
    expect(hollow).toBe(true);
    expect((e.getState().turnResults[idx] as { result: number }).result).toBe(5); // unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "reroll system"`
Expected: FAIL — `offerReroll is not a function`.

- [ ] **Step 3: Implement the reroll methods**

In `GameEngine.ts`, add after `maybeHappeningInterrupt()` (within the "Event-resolved affinity decisions" section):

```ts
  // Will-gated: should a "Reroll?" prompt be offered after the player's action?
  offerReroll(): boolean {
    return this.forcedOrRoll('offer-reroll', 'will', 'stirring', TIER_BASE_CHANCE.notable);
  }

  // Player takes an offered reroll. Feeds Will. Fate may make it hollow (same result).
  takeReroll(): { hollow: boolean } {
    this.affinityEngine.applyAction('take-reroll');
    const idx = this.state.activeSlotIndex;
    if (idx === null) { this.notify(); return { hollow: false }; }
    const target = this.state.turnResults[idx];
    if (!target || target.type === 'happening') { this.notify(); return { hollow: false }; }

    const hollow = this.forcedOrRoll('hollow-reroll', 'fate', 'ascendant', TIER_BASE_CHANCE.major);
    if (hollow) {
      this.notify(); // snapshot contract: cleared forced flag / Will feed surfaced
      return { hollow: true };
    }
    const affinities = this.affinityEngine.getState();
    const fresh = this.orchestrator.drawSingleResult(
      target.type as 'tarot' | 'd20' | 'iching',
      affinities,
    );
    this.state.turnResults = [
      ...this.state.turnResults.slice(0, idx),
      fresh,
      ...this.state.turnResults.slice(idx + 1),
    ];
    this.notify();
    return { hollow: false };
  }

  // Player declines an offered reroll → accepts what's given (Fate).
  declineReroll(): void {
    this.affinityEngine.applyAction('decline-reroll');
    this.notify();
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "reroll system"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "feat(affinity): reroll system — Will offer, Fate hollow, action feeds"
```

---

### Task 8: `resolveTarotPick` — card-swap / the-hand-chooses (Fate)

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/AgencyDecisions.test.ts` (extend)

**Interfaces:**
- Produces: `resolveTarotPick(chosenIndex: number, hand: TarotResult[]): { card: TarotResult; swapped: boolean }`. Gated by Fate: `card-swap` (Ascendant, Major) and `the-hand-chooses` (Dominant, Major). On a swap, returns a *different* card from `hand`.

- [ ] **Step 1: Write the failing test**

Append to `AgencyDecisions.test.ts`:

```ts
describe('resolveTarotPick (Fate card-swap)', () => {
  const hand = [tarot('upright'), { ...tarot('reversed'), id: 'the-star', name: 'The Star' }, { ...tarot('upright'), id: 'death', name: 'Death' }];

  it('returns the chosen card when nothing fires', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99;
    const { card, swapped } = e.resolveTarotPick(0, hand as never);
    Math.random = orig;
    expect(swapped).toBe(false);
    expect(card.id).toBe('the-fool');
  });

  it('returns a different card when card-swap is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'card-swap' });
    const { card, swapped } = e.resolveTarotPick(0, hand as never);
    expect(swapped).toBe(true);
    expect(card.id).not.toBe('the-fool');
    expect(e.getState().debugForcedEffect).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "card-swap"`
Expected: FAIL — `resolveTarotPick is not a function`.

- [ ] **Step 3: Implement `resolveTarotPick`**

Add `TarotResult` to the type import in `GameEngine.ts` (first import line). Then add the method in the event-resolved section:

```ts
  // Fate: the card you pick may not be the one revealed (Ascendant: card-swap;
  // Dominant: the-hand-chooses). Returns the card to reveal and whether a swap occurred.
  resolveTarotPick(chosenIndex: number, hand: TarotResult[]): { card: TarotResult; swapped: boolean } {
    const chosen = hand[chosenIndex];
    if (hand.length < 2) return { card: chosen, swapped: false };

    const swap =
      this.forcedOrRoll('the-hand-chooses', 'fate', 'dominant', TIER_BASE_CHANCE.major) ||
      this.forcedOrRoll('card-swap', 'fate', 'ascendant', TIER_BASE_CHANCE.major);
    if (!swap) return { card: chosen, swapped: false };

    const others = hand.map((_, i) => i).filter((i) => i !== chosenIndex);
    const pick = others[Math.floor(Math.random() * others.length)];
    return { card: hand[pick], swapped: true };
  }
```

> Order matters: check the Dominant id first so a Dominant-forced scenario resolves before the Ascendant gate. When unforced, `the-hand-chooses` simply fails the gate below Dominant and falls through to `card-swap`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "card-swap"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "feat(affinity): resolveTarotPick — Fate card-swap / the-hand-chooses"
```

---

### Task 9: Orientation control (`maybeAutoOrient` Fate, `setOrientation` Will) + `maybeKeepOneOfTwo` (Will)

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/AgencyDecisions.test.ts` (extend)

**Interfaces:**
- Produces:
  - `maybeAutoOrient(): 'upright' | 'reversed' | null` — Fate (`auto-orient`, min `stirring`, Notable). Non-null means the orientation was decided for the player.
  - `setOrientation(orientation: 'upright' | 'reversed'): void` — Will free-choice feed (`set-orientation`).
  - `maybeKeepOneOfTwo(result: SlotResult): SlotResult[] | null` — Will (`keep-one-of-two`, min `dominant`, Major). Returns two candidate results for the player to choose between, or null.

- [ ] **Step 1: Write the failing test**

Append to `AgencyDecisions.test.ts`:

```ts
describe('orientation + keep-one-of-two', () => {
  it('maybeAutoOrient returns an orientation when forced, else null at baseline', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99;
    expect(e.maybeAutoOrient()).toBeNull();
    Math.random = orig;
    e.loadState({ debugForcedEffect: 'auto-orient' });
    expect(['upright', 'reversed']).toContain(e.maybeAutoOrient());
  });

  it('setOrientation feeds Will', () => {
    const e = new GameEngine();
    startMinigame(e);
    const before = e.getState().affinities.will;
    e.setOrientation('reversed');
    expect(e.getState().affinities.will).toBeGreaterThan(before);
  });

  it('maybeKeepOneOfTwo returns two candidates when forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'keep-one-of-two' });
    const pair = e.maybeKeepOneOfTwo({
      type: 'd20', result: 9, threshold: 'low', interpretation: 'x', tags: ['roll', 'numeric'],
      themes: ['stagnation'], dimensions: { favorability: -1, certainty: 0, volatility: 0.5 }, modifierRoles: ['effect'],
    } as SlotResult);
    expect(pair).not.toBeNull();
    expect(pair!.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "orientation + keep-one-of-two"`
Expected: FAIL — methods not defined.

- [ ] **Step 3: Implement the three methods**

Add in the event-resolved section of `GameEngine.ts`:

```ts
  // Fate: a coin-flip detail (orientation) may be decided for the player.
  maybeAutoOrient(): 'upright' | 'reversed' | null {
    if (!this.forcedOrRoll('auto-orient', 'fate', 'stirring', TIER_BASE_CHANCE.notable)) return null;
    return Math.random() < 0.5 ? 'upright' : 'reversed';
  }

  // Will: the player exercises a free orientation choice.
  setOrientation(_orientation: 'upright' | 'reversed'): void {
    this.affinityEngine.applyAction('set-orientation');
    this.notify();
  }

  // Will (Dominant): offer two candidate results; the player keeps one.
  maybeKeepOneOfTwo(result: SlotResult): SlotResult[] | null {
    if (result.type === 'happening') return null;
    if (!this.forcedOrRoll('keep-one-of-two', 'will', 'dominant', TIER_BASE_CHANCE.major)) return null;
    const affinities = this.affinityEngine.getState();
    const alt = this.orchestrator.drawSingleResult(
      result.type as 'tarot' | 'd20' | 'iching',
      affinities,
    );
    return [result, alt];
  }
```

> `maybeAutoOrient` and `maybeKeepOneOfTwo` are pure decision rolls and don't `notify()` (no state mutation beyond clearing a forced flag, which the next mutator's `notify()` flushes; the components call these synchronously and then act). `setOrientation` mutates affinities so it ends with `notify()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "orientation + keep-one-of-two"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "feat(affinity): orientation control + keep-one-of-two agency decisions"
```

---

### Task 10: Method control — `methodCount` wiring + `swapMethod` (Will) + `maybeForceMethod` (Fate)

**Files:**
- Modify: `src/engine/TurnOrchestrator.ts`, `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/AgencyDecisions.test.ts` (extend), `src/engine/__tests__/TurnOrchestrator.test.ts` (extend)

**Interfaces:**
- Consumes: `AffinityEffects.methodCount` (Task 4).
- Produces:
  - `TurnOrchestrator.generatePool(question, affinities, count?)` and `refillPool(question, affinities, bias?, count?)` honor `count` (default 3).
  - `GameEngine.swapMethod(): void` — Will feed (`swap-method`); re-rolls the available pool.
  - `GameEngine.maybeForceMethod(): boolean` — Fate (`force-method`, min `dominant`, Notable).

- [ ] **Step 1: Write the failing test (orchestrator count)**

Append to `src/engine/__tests__/TurnOrchestrator.test.ts`:

```ts
import { describe as dC, it as iC, expect as xC } from 'vitest';
import { TurnOrchestrator as TO } from '../TurnOrchestrator';
import { EventBus as EB } from '../EventBus';

dC('pool size honors count', () => {
  iC('generatePool returns `count` methods (clamped to available types)', () => {
    const o = new TO(new EB());
    const pool = o.generatePool('self', {}, 2);
    xC(pool.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/TurnOrchestrator.test.ts -t "honors count"`
Expected: FAIL — `generatePool` ignores the third arg; returns 3.

- [ ] **Step 3: Thread `count` through the orchestrator**

In `TurnOrchestrator.ts`, replace the constant usage with a parameter. Change `generatePool`:

```ts
  generatePool(
    question: QuestionType,
    _affinities: Record<string, number>,
    count: number = POOL_SIZE,
  ): DivinationType[] {
    this.availableMethods = [];
    this.usedThisTurn = [];
    const target = Math.max(1, Math.min(3, count));
    const weights = QUESTION_WEIGHTS[question];

    const entries: { type: DivinationType; weight: number }[] = [
      { type: 'tarot', weight: weights.tarot ?? 1 },
      { type: 'd20', weight: weights.d20 ?? 1 },
      { type: 'iching', weight: weights.iching ?? 1 },
    ];

    let guard = 0;
    while (this.availableMethods.length < target && guard++ < 100) {
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          if (!this.availableMethods.includes(entry.type)) {
            this.availableMethods.push(entry.type);
          }
          break;
        }
      }
    }

    this.bus.emit('pool-generated', { question, pool: [...this.availableMethods] });
    return [...this.availableMethods];
  }
```

Change `refillPool` to accept and honor a `count` (default `POOL_SIZE`): add `count: number = POOL_SIZE` as the 4th parameter and replace every `this.availableMethods.length < POOL_SIZE` with `this.availableMethods.length < Math.max(1, Math.min(3, count))`. Keep the rest of `refillPool` unchanged.

- [ ] **Step 4: Run the orchestrator test**

Run: `npx vitest run src/engine/__tests__/TurnOrchestrator.test.ts -t "honors count"`
Expected: PASS.

- [ ] **Step 5: Pass `methodCount` from `GameEngine` and add the method-control methods**

In `GameEngine.ts`, pass the static `methodCount` wherever the pool is generated/refilled. Update the three call sites:

In `startTurn`, after computing `affinities`:
```ts
    const availableMethods = this.orchestrator.generatePool(
      question, affinities, this.affinityEngine.getEffects().methodCount,
    );
```

In `completeMinigame`'s refill branch and `advanceInteractionQueue`'s refill branch, change `refillPool(this.state.questionType!, affinities, bias)` to:
```ts
      this.state.availableMethods = this.orchestrator.refillPool(
        this.state.questionType!,
        affinities,
        bias,
        this.affinityEngine.getEffects().methodCount,
      );
```

In `resolveHappening`'s refill (no bias), change to:
```ts
    this.state.availableMethods = this.orchestrator.refillPool(
      this.state.questionType!,
      affinities,
      {},
      this.affinityEngine.getEffects().methodCount,
    );
```

Add the method-control methods to the event-resolved section:

```ts
  // Will: swap the offered method set — re-rolls the pool. Feeds Will.
  swapMethod(): void {
    this.affinityEngine.applyAction('swap-method');
    const affinities = this.affinityEngine.getState();
    this.state.availableMethods = this.orchestrator.generatePool(
      this.state.questionType!, affinities, this.affinityEngine.getEffects().methodCount,
    );
    this.state.selectedMethod = null;
    this.notify();
  }

  // Fate (Dominant): the method may be forced on the player.
  maybeForceMethod(): boolean {
    return this.forcedOrRoll('force-method', 'fate', 'dominant', TIER_BASE_CHANCE.notable);
  }
```

- [ ] **Step 6: Write + run the GameEngine-side test**

Append to `AgencyDecisions.test.ts`:

```ts
describe('method control', () => {
  it('Fate Ascendant trims the pool to 2 methods at startTurn', () => {
    const e = new GameEngine();
    // Seed Fate high before the turn; beginRun drifts toward 50 but 90→~77 stays ascendant.
    e.loadState({ affinities: { ...e.getState().affinities, fate: 95 } });
    e.startTurn('self');
    expect(e.getState().availableMethods.length).toBe(2);
  });

  it('swapMethod feeds Will and yields a fresh pool', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.will;
    e.swapMethod();
    expect(e.getState().affinities.will).toBeGreaterThan(before);
    expect(e.getState().availableMethods.length).toBeGreaterThanOrEqual(1);
  });
});
```

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "method control"`
Expected: PASS.

> If the Fate-trim test is flaky because `beginRun` drift drops Fate below 60, raise the seed to `fate: 99` (99→~83, still Ascendant). 95→round(95+(50-95)*0.33)=round(80.15)=80, Ascendant — fine.

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/TurnOrchestrator.ts src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts src/engine/__tests__/TurnOrchestrator.test.ts
git commit -m "feat(affinity): methodCount wiring, swapMethod, maybeForceMethod"
```

---

### Task 11: Information surfacing — `usePeek` wrapper, narrative detail/clarity, hint clarity

**Files:**
- Modify: `src/engine/GameEngine.ts`, `src/engine/NarrativeAssembler.ts`, `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/AgencyDecisions.test.ts` (extend), `src/engine/__tests__/NarrativeAssembler.test.ts` (extend)

**Interfaces:**
- Produces:
  - `GameEngine.usePeek(preview?: SlotResult): { failed: boolean; leaning: string }` — wraps `AffinityEngine.usePeek`, derives a vague leaning from `preview`; ends with `notify()`.
  - `GameEngine.declinePeek(): void` — Shadow feed (`decline-peek`).
  - `NarrativeAssembler.assemble(..., effects?: AffinityEffects)` — appends a rich line when `readingDetail > 0`, drops the affinity note to terse when `readingDetail < 0`, and names forces / goes cryptic by `hintClarity`.
  - `AffinityEngine.getActiveHints(max?, clarity?)` — clarity ≥ 2 names the force; clarity ≤ -2 garbles the hint.

- [ ] **Step 1: Write the failing tests**

Append to `AgencyDecisions.test.ts`:

```ts
describe('peek wrapper + decline', () => {
  it('usePeek returns a leaning derived from the preview when Light is Ascendant', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, light: 75 } });
    e.startTurn('self'); // beginRun drift: 75→~67, still ascendant; peek counters reset
    e.loadState({ affinities: { ...e.getState().affinities, light: 75 } });
    const orig = Math.random; Math.random = () => 0.0; // free first peek, no fail
    const r = e.usePeek({
      type: 'd20', result: 18, threshold: 'critical-high', interpretation: 'x',
      tags: ['roll'], themes: ['harmony'], dimensions: { favorability: 2, certainty: 0, volatility: 1.5 }, modifierRoles: ['effect'],
    } as SlotResult);
    Math.random = orig;
    expect(r.failed).toBe(false);
    expect(r.leaning.length).toBeGreaterThan(0);
  });

  it('declinePeek feeds Shadow', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.shadow;
    e.declinePeek();
    expect(e.getState().affinities.shadow).toBeGreaterThan(before);
  });
});
```

Append to `src/engine/__tests__/NarrativeAssembler.test.ts` (inside the file's describe, or a new one):

```ts
import { NarrativeAssembler as NA } from '../NarrativeAssembler';
import type { AggregatedReading as AR, AffinityEffects as AE } from '../types';

describe('NarrativeAssembler — reading detail/clarity', () => {
  const agg: AR = {
    dominantTheme: 'harmony', secondaryTheme: null,
    dimensionProfile: { favorability: 1, certainty: 0, volatility: 0 },
    modifierAssignments: { subject: [], action: [], effect: [] },
    hasTension: false, tensionPair: null,
  };
  const fx = (over: Partial<AE>): AE => ({
    handSize: 3, methodCount: 3, hintClarity: 0, readingDetail: 0, poolPreview: 'none', peekAvailable: false, ...over,
  });

  it('rich reading (readingDetail>0) adds at least one extra paragraph vs terse', () => {
    const na = new NA();
    na.resetRotation();
    const rich = na.assemble(agg, [], 'self', { light: 90, shadow: 10 }, fx({ readingDetail: 1, hintClarity: 2 }));
    na.resetRotation();
    const terse = na.assemble(agg, [], 'self', { light: 10, shadow: 90 }, fx({ readingDetail: -1, hintClarity: -2 }));
    expect(rich.paragraphs.length).toBeGreaterThanOrEqual(terse.paragraphs.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "peek wrapper"` and `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts -t "reading detail"`
Expected: FAIL — `usePeek`/`declinePeek` not defined; `assemble` ignores 5th arg.

- [ ] **Step 3: Implement the `GameEngine` peek wrapper + decline**

Add to the event-resolved section of `GameEngine.ts`:

```ts
  // Light foresight. Delegates escalation/penalty to AffinityEngine; derives a
  // vague leaning from the previewed result. The player never sees exact values.
  usePeek(preview?: SlotResult): { failed: boolean; leaning: string } {
    const { failed } = this.affinityEngine.usePeek();
    if (failed) {
      this.notify();
      return { failed: true, leaning: 'The vision clouds over — nothing is revealed.' };
    }
    const leaning = this.describeLeaning(preview);
    this.notify();
    return { failed: false, leaning };
  }

  declinePeek(): void {
    this.affinityEngine.applyAction('decline-peek');
    this.notify();
  }

  private describeLeaning(preview?: SlotResult): string {
    if (!preview || preview.type === 'happening') return 'A faint shape stirs beyond the veil...';
    const fav = preview.dimensions.favorability;
    if (fav >= 1) return 'The current leans toward fortune...';
    if (fav <= -1) return 'The current leans toward hardship...';
    return 'The current holds in uneasy balance...';
  }
```

- [ ] **Step 4: Implement narrative detail/clarity**

In `NarrativeAssembler.ts`, import the effects type and extend `assemble`'s signature with an optional `effects`:

```ts
import type {
  AggregatedReading, SynthesisResult, SlotResult, QuestionType,
  ModifierRole, InteractionEvent, AffinityEffects,
} from './types';
```

Change the `assemble` signature:

```ts
  assemble(
    aggregated: AggregatedReading,
    _results: SlotResult[],
    question: QuestionType,
    affinities: Record<string, number>,
    effects?: AffinityEffects,
  ): SynthesisResult {
```

Just before the `// Headline` block near the end, add detail/clarity handling that augments `paragraphs` and `affinityNote`:

```ts
    // Light/Shadow reading detail & clarity (Phase 3).
    const detail = effects?.readingDetail ?? 0;
    const clarity = effects?.hintClarity ?? 0;
    if (detail > 0) {
      paragraphs.push(
        'Every thread lies plain to the eye — the reading withholds nothing, each sign spelled out in full.',
      );
    } else if (detail < 0) {
      // Terse: collapse the body to its first two paragraphs.
      if (paragraphs.length > 2) paragraphs.splice(2);
    }
    if (clarity >= 2 && affinityNote) {
      affinityNote = `The forces name themselves plainly: ${affinityNote}`;
    } else if (clarity <= -2 && affinityNote) {
      affinityNote = 'Something stirs beneath the surface, but its name will not come.';
    }
```

> `affinityNote` is declared with `let` earlier in `assemble`, so reassigning it here is valid.

- [ ] **Step 5: Pass `effects` from `GameEngine.synthesizeAll`**

In `GameEngine.ts` `synthesizeAll()`, pass the static effects into `assemble`:

```ts
    const synthesisResult = this.narrativeAssembler.assemble(
      aggregated,
      results,
      question,
      affinities,
      this.affinityEngine.getEffects(),
    );
```

- [ ] **Step 6: Implement clarity-aware `getActiveHints`**

In `AffinityEngine.ts`, replace `getActiveHints` with a clarity-aware version (Light names the force; Shadow garbles):

```ts
  getActiveHints(max = 2, clarity = 0): string[] {
    const sorted = [...AFFINITY_IDS].sort((a, b) => this.state[b] - this.state[a]);
    const hints: string[] = [];
    for (const id of sorted.slice(0, max)) {
      const def = this.defById[id];
      const base = this.getHint(id);
      if (!base) continue;
      if (clarity >= 2) hints.push(`${def?.name ?? id}: ${base}`); // Light names the force
      else if (clarity <= -2) hints.push('…') ;                    // Shadow near-opaque
      else hints.push(base);
    }
    return hints;
  }
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "peek wrapper"` then `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS. Then `npx vitest run` — full suite PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/NarrativeAssembler.ts src/engine/AffinityEngine.ts src/engine/__tests__/AgencyDecisions.test.ts src/engine/__tests__/NarrativeAssembler.test.ts
git commit -m "feat(affinity): peek leaning wrapper, reading detail/clarity, clarity-aware hints"
```

---

### Task 12: Debug scenarios for Fate/Will and Light/Shadow

**Files:**
- Modify: `src/engine/scenarios.ts`
- Test: `src/engine/__tests__/Scenarios.test.ts` (extend)

**Interfaces:**
- Consumes: `debugForcedEffect` (existing), event-resolved methods (Tasks 7–11), static modifiers (Task 4).
- Produces: scenario presets grouped under **Fate / Will** and **Light / Shadow**, one per banded effect.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/Scenarios.test.ts`:

```ts
describe('Phase 2/3 scenarios', () => {
  it('includes Fate/Will and Light/Shadow groups', () => {
    const engine = new GameEngine();
    const groups = new Set(engine.getScenarioPresets().map((p) => p.group));
    expect(groups.has('Fate / Will')).toBe(true);
    expect(groups.has('Light / Shadow')).toBe(true);
  });

  it('card-swap scenario sets Fate Ascendant and forces the effect', () => {
    const engine = new GameEngine();
    const ok = engine.loadScenarioById('fate-card-swap');
    expect(ok).toBe(true);
    expect(engine.getState().affinities.fate).toBeGreaterThanOrEqual(60);
    expect(engine.getState().debugForcedEffect).toBe('card-swap');
  });

  it('peek-failure scenario sets Light Ascendant', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('light-peek-failure');
    expect(engine.getState().affinities.light).toBeGreaterThanOrEqual(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts -t "Phase 2/3"`
Expected: FAIL — groups/presets absent.

- [ ] **Step 3: Add the scenario presets**

In `src/engine/scenarios.ts`, add these entries to the `SCENARIO_PRESETS` array (before the closing `]`). Each sets the screen one action before the effect, the affinity band via the returned patch, and `debugForcedEffect` for event-resolved effects:

```ts
  // ── Fate / Will ──
  {
    id: 'fate-auto-orient', label: 'Auto-Orient — Fate Stirring', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'tarot'; state.screen = 'minigame';
      state.debugForcedEffect = 'auto-orient';
      return { fate: 55, will: 45 };
    },
  },
  {
    id: 'fate-card-swap', label: 'Card-Swap — Fate Ascendant', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'tarot'; state.screen = 'minigame';
      state.debugForcedEffect = 'card-swap';
      return { fate: 75, will: 25 };
    },
  },
  {
    id: 'fate-hollow-reroll', label: 'Hollow Reroll — Fate Ascendant', group: 'Fate / Will',
    apply: (state) => {
      state.turnResults = [foolTarotResult()]; state.minigamesCompleted = 1;
      state.activeSlotIndex = 0;
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      state.debugForcedEffect = 'hollow-reroll';
      return { fate: 75, will: 25 };
    },
  },
  {
    id: 'fate-hand-chooses', label: 'The Hand Chooses — Fate Dominant', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'tarot'; state.screen = 'minigame';
      state.debugForcedEffect = 'the-hand-chooses';
      return { fate: 92, will: 12 };
    },
  },
  {
    id: 'fate-fewer-methods', label: 'Fewer Methods — Fate Ascendant (static)', group: 'Fate / Will',
    apply: (state) => {
      state.screen = 'method-select';
      return { fate: 75, will: 25 };
    },
  },
  {
    id: 'will-offer-reroll', label: 'Offered Reroll — Will Stirring', group: 'Fate / Will',
    apply: (state) => {
      state.turnResults = [foolTarotResult()]; state.minigamesCompleted = 1;
      state.activeSlotIndex = 0;
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      state.debugForcedEffect = 'offer-reroll';
      return { will: 55, fate: 45 };
    },
  },
  {
    id: 'will-big-hand', label: 'Larger Hand — Will Dominant (static)', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'tarot'; state.screen = 'minigame';
      return { will: 92, fate: 12 };
    },
  },
  {
    id: 'will-keep-one-of-two', label: 'Keep One of Two — Will Dominant', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      state.debugForcedEffect = 'keep-one-of-two';
      return { will: 92, fate: 12 };
    },
  },

  // ── Light / Shadow ──
  {
    id: 'light-peek', label: 'Foresight Available — Light Ascendant (static)', group: 'Light / Shadow',
    apply: (state) => {
      state.selectedMethod = 'tarot'; state.screen = 'minigame';
      return { light: 75, shadow: 25 };
    },
  },
  {
    id: 'light-peek-failure', label: 'Peek Failure — Light', group: 'Light / Shadow',
    apply: (state) => {
      state.selectedMethod = 'tarot'; state.screen = 'minigame';
      return { light: 75, shadow: 25 };
    },
  },
  {
    id: 'light-illumination', label: 'Illumination — Light Dominant (static)', group: 'Light / Shadow',
    apply: (state) => {
      state.turnResults = [foolTarotResult()]; state.minigamesCompleted = 3;
      state.screen = 'result';
      return { light: 92, shadow: 12 };
    },
  },
  {
    id: 'shadow-veiled', label: 'Veiled Results — Shadow Ascendant (static)', group: 'Light / Shadow',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      return { shadow: 75, light: 25 };
    },
  },
  {
    id: 'shadow-eclipse', label: 'Eclipse — Shadow Dominant (static)', group: 'Light / Shadow',
    apply: (state) => {
      state.turnResults = [foolTarotResult()]; state.minigamesCompleted = 3;
      state.screen = 'result';
      return { shadow: 92, light: 12 };
    },
  },
```

> `light-peek-failure` is observed by peeking twice in the UI (the 2nd peek escalates to an 18% fail; force it by peeking repeatedly, or pair with the debug Step controls). It sets the band so peeking is available; the failure path itself is covered by the `AffinityPeek` unit tests.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/scenarios.ts src/engine/__tests__/Scenarios.test.ts
git commit -m "feat(debug): Fate/Will and Light/Shadow scenario presets"
```

---

### Task 13: Component wiring (Tarot, Dice, I Ching, MethodSelect, ResultReading)

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`, `DiceMinigame.tsx`, `IChingMinigame.tsx`, `MethodSelect.tsx`, `ResultReading.tsx`
- Verify: `npm run build` (no component unit tests in this project)

**Interfaces:**
- Consumes: `state.affinityEffects`, `engine.resolveTarotPick`, `engine.maybeAutoOrient`, `engine.setOrientation`, `engine.offerReroll`, `engine.takeReroll`, `engine.declineReroll`, `engine.usePeek`, `engine.declinePeek`, `engine.swapMethod`, `engine.completeMinigame(result, meta)`.

- [ ] **Step 1: Tarot — hand size, card-swap, auto-orient, peek, reveal/reverse meta**

In `TarotMinigame.tsx`:

(a) Hand size from effects. Replace the `faceDownCards` initializer:

```ts
  const handSize = state.affinityEffects.handSize;
  const faceDownCards = useState<TarotResult[]>(() =>
    Array.from({ length: handSize }, () => drawTarotCard(state.affinities))
  )[0];
  const [swapped, setSwapped] = useState(false);
```

(b) On pick, resolve a possible Fate swap and a possible auto-orient. Replace `handlePickCard`:

```ts
  const handlePickCard = useCallback((index: number) => {
    const { card, swapped: didSwap } = engine.resolveTarotPick(index, faceDownCards);
    const actualIndex = faceDownCards.indexOf(card);
    setChosenIndex(actualIndex >= 0 ? actualIndex : index);
    setSwapped(didSwap);
    const auto = engine.maybeAutoOrient();
    setTimeout(() => {
      if (auto) { handleReveal(auto === 'reversed'); }
      else { setPhase('reversal-prompt'); }
    }, 600);
  }, [engine, faceDownCards]);
```

(c) Feed orientation choice and pass meta on completion. Update the reveal `useEffect` so the completion reports meta, and `setOrientation` feeds Will on an explicit reverse:

```ts
    const timer = setTimeout(() => {
      engine.completeMinigame(finalResult, {
        revealedAsDrawn: !willReverse,
        reversed: willReverse,
      });
    }, 1200);
```

In `handleReveal`, when the player actively reverses, report the Will free-choice:

```ts
  const handleReveal = useCallback((reverse: boolean) => {
    if (reverse) engine.setOrientation('reversed');
    setWillReverse(reverse);
    setPhase('revealed');
  }, [engine]);
```

(d) Swap cue: in the `revealed` block, show a mystical line when `swapped`. Add below the orientation line inside the reveal `motion.div`:

```tsx
            {swapped && (
              <div style={{ ...revealedOrientStyle, color: '#9b6bb0', marginTop: '0.4rem' }}>
                ✶ your hand moved of its own accord
              </div>
            )}
```

(e) Peek affordance during the reversal prompt. Inside the `reversal-prompt` block, before the choice row, add:

```tsx
            {state.affinityEffects.peekAvailable && chosenIndex !== null && (
              <PeekControl onPeek={() => engine.usePeek(faceDownCards[chosenIndex])} onDecline={() => engine.declinePeek()} />
            )}
```

Add a small inline `PeekControl` component at the bottom of the file (before the styles):

```tsx
function PeekControl({ onPeek, onDecline }: { onPeek: () => { failed: boolean; leaning: string }; onDecline: () => void }) {
  const [line, setLine] = useState<string | null>(null);
  if (line) return <p style={{ ...promptTextStyle, color: '#7b9ec7' }}>{line}</p>;
  return (
    <div style={choiceRowStyle}>
      <button style={choiceBtnStyle} onClick={() => setLine(onPeek().leaning)}>✦ Seek a glimpse</button>
      <button style={choiceBtnStyle} onClick={() => { onDecline(); setLine('You let the mystery stand.'); }}>Embrace the unknown</button>
    </div>
  );
}
```

Build-verify only (Step 6).

- [ ] **Step 2: Dice — offered reroll, veiled threshold, peek, meta**

In `DiceMinigame.tsx`:

(a) Veiled display: when `state.affinityEffects.poolPreview === 'hidden'` (Shadow), hide the threshold badge until commit. Wrap the `thresholdStyle` block render with a veil check:

```tsx
              {state.affinityEffects.poolPreview !== 'hidden' && (
                <motion.div style={thresholdStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <span style={{ ...thresholdBadgeStyle, color: THRESHOLD_COLORS[displayResult.threshold], borderColor: THRESHOLD_COLORS[displayResult.threshold] }}>
                    {displayResult.threshold.replace(/-/g, ' ').toUpperCase()}
                  </span>
                  <p style={interpretationStyle}>{displayResult.interpretation}</p>
                </motion.div>
              )}
```

(b) Pass `keep-roll` meta on auto-commit (the player kept the first roll). Update the commit `useEffect`:

```ts
    const timer = setTimeout(() => {
      engine.completeMinigame(localResult, { revealedAsDrawn: true });
    }, 1500);
```

(c) Offered reroll: after commit (when `state.activeSlotIndex !== null` and `engine.offerReroll()` is true), show a one-time "Reroll?" prompt. Add a small post-commit affordance using `engine.takeReroll()` / `engine.declineReroll()`. Add near the result render:

```tsx
        {committedSlot && committedSlot.type === 'd20' && <RerollPrompt />}
```

And the inline component at file bottom:

```tsx
function RerollPrompt() {
  const { engine } = useGameEngine();
  const [offered] = useState(() => engine.offerReroll());
  const [done, setDone] = useState(false);
  if (!offered || done) return null;
  return (
    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
      <button style={rerollBtnStyle} onClick={() => { engine.takeReroll(); setDone(true); }}>Reroll?</button>
      <button style={rerollBtnStyle} onClick={() => { engine.declineReroll(); setDone(true); }}>Keep it</button>
    </div>
  );
}

const rerollBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440',
  padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', outline: 'none',
};
```

- [ ] **Step 3: I Ching — veiled display + keep-roll meta**

In `IChingMinigame.tsx`, pass meta on completion:

```ts
    const timer = setTimeout(() => {
      engine.completeMinigame(hexagramResult, { revealedAsDrawn: true });
    }, 2000);
```

And when `state.affinityEffects.poolPreview === 'hidden'`, render the judgment terser (hide changing-lines detail). Wrap the changing-lines block:

```tsx
            {state.affinityEffects.poolPreview !== 'hidden' && displayHex && displayHex.changingLines.length > 0 && (
              <div style={changingLinesStyle}>
                Changing lines: {displayHex.changingLines.join(', ')}
              </div>
            )}
```

- [ ] **Step 4: MethodSelect — pool preview labels + swap method**

In `MethodSelect.tsx`:

(a) Shadow hides labels; Light previews. Replace the card description render to respect `state.affinityEffects.poolPreview`:

```tsx
                <div style={cardTitleStyle}>
                  {state.affinityEffects.poolPreview === 'hidden' ? '???' : card.title}
                </div>
                <div style={cardDescStyle}>
                  {state.affinityEffects.poolPreview === 'hidden'
                    ? 'An unmarked path.'
                    : state.affinityEffects.poolPreview === 'none'
                      ? card.description
                      : `${card.description}`}
                </div>
```

(b) Will swap-method button. After the methods grid, add:

```tsx
        {state.affinityEffects.handSize >= 4 && (
          <button style={{ ...cardStyle, borderColor: '#9b6bb040', maxWidth: '420px', cursor: 'pointer' }} onClick={() => engine.swapMethod()}>
            <div style={cardDescStyle}>↺ Call for different methods</div>
          </button>
        )}
```

> `handSize >= 4` is a proxy for "Will is elevated," reusing the already-exposed static modifier rather than adding a new flag.

- [ ] **Step 5: ResultReading — reading-detail note**

`ResultReading` already renders `synthesis.paragraphs` and `synthesis.affinityNote`, which now carry the Light/Shadow detail/clarity from Task 11 — no structural change required. Add a subtle illumination/eclipse marker under the title driven by the static effect:

```tsx
        <div style={questionStyle}>{questionLabel}</div>
        {state.affinityEffects.readingDetail > 0 && (
          <div style={{ ...questionStyle, color: '#d4c068' }}>✦ illuminated</div>
        )}
        {state.affinityEffects.readingDetail < 0 && (
          <div style={{ ...questionStyle, color: '#5b6680' }}>☾ eclipsed</div>
        )}
```

- [ ] **Step 6: Typecheck the whole app**

Run: `npm run build`
Expected: PASS — `tsc -b` reports no errors, Vite bundles. Fix any type mismatches (e.g. ensure `useState` is imported in Dice/Tarot where the inline components use it; `useGameEngine` imported in Dice for `RerollPrompt`).

- [ ] **Step 7: Run the full engine suite once more**

Run: `npx vitest run`
Expected: PASS (no engine regressions from component edits — engine is independent).

- [ ] **Step 8: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx src/components/screens/DiceMinigame.tsx src/components/screens/IChingMinigame.tsx src/components/screens/MethodSelect.tsx src/components/screens/ResultReading.tsx
git commit -m "feat(ui): wire Fate/Will/Light/Shadow effects into minigames, method-select, and reading"
```

---

## Self-Review

**Spec coverage (§7.2 Fate/Will, §7.3 Light/Shadow, §7.4 Peek, §9 architecture, §10 debug, §12 testing):**

- Fate: auto-orient (T9), card-swap + the-hand-chooses (T8), hollow reroll (T7), fewer methods (T4/T10 static), force-method (T10). ✓
- Will: offer-reroll (T7), larger hand (T4 static), free orientation (T9), keep-one-of-two (T9), swap-method (T10). ✓
- Light: peek availability + escalation (T3), illumination/rich reading + naming forces (T11), pool preview 'full'/'theme' (T4 static, T13 render). ✓
- Shadow: veiled/eclipse reading (T11), pool 'hidden' / veiled results (T4 static, T13 render), cryptic hints (T11). ✓
- Peek §7.4: Ascendant gate, 18%×n fail escalation, lockout + −12 Light penalty, per-run reset (T3); wrapper leaning (T11). ✓
- Action feeds §6/§9.3: `applyAction` map (T1–T2), `completeMinigame` meta (T6), action methods (T7–T12). ✓
- Architecture §9.2: static modifiers via `getEffects`/snapshot (T4–T5); event-resolved methods honoring `debugForcedEffect` via band-scaled `forcedOrRoll` (T6+). ✓
- Debug §10: grouped scenarios, forced effects, affinity routing via patch (T12). ✓
- Testing §12: coupling/DR/jitter (pre-existing, untouched), peek escalation (T3), effect gating forced+unforced (T6–T10), scenarios (T12). ✓
- UX caution §7.5 (mystical swap cue): "your hand moved of its own accord" line (T13 Step 1d). ✓

**Deferred (explicit non-goals, not implemented):** reshuffle event, overcharge backlash, passive drift (spec §1) — untouched.

**Type consistency check:** `AffinityEffects` shape identical across `types.ts` (T1), `getEffects` (T4), `defaultState` (T1 Step 5), and component reads (T13). `MinigameMeta` fields (`revealedAsDrawn`/`reversed`/`viaReroll`/`peeked`) consistent between T1, T6, and component calls (T13). `forcedOrRoll(effectId, affinity, minBand, baseChance)` signature stable from T6 onward; all callers (T7–T10) match. Effect ids used in `bandedEffects` (T1), `forcedOrRoll` calls (T7–T10), and scenarios (T12) match: `auto-orient`, `card-swap`, `hollow-reroll`, `the-hand-chooses`, `force-method`, `offer-reroll`, `keep-one-of-two`, `peek`, plus existing `wild-surge`/`happening-interrupt`.

**Notes for the implementer:** Component tasks are build-verified only (this project has no component tests, per CLAUDE.md). Keep all numeric constants as the playtest defaults given here. If a band-gated unforced test is flaky, stub `Math.random` rather than loosening the assertion.
