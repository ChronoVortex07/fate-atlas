# Light's Corruption Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Light a visible early-warning system for corruption — a seed-omen popup that escalates per corruption band, a ward-seal treatment on tainted method cards, a guaranteed taunt where corruption interrupts Light at the virulent crossing, and the hijack into a grasping lure.

**Architecture:** The engine already computes `state.corruptionWarning`; this plan adds three small engine signals (an escalating seed-omen, a `warnedBand` high-water mark on `CorruptionEngine`, and a taunt that interrupts at the virulent crossing) plus pure presentation: a new `OmenOverlay`, an extended `IntrusionOverlay`, new CSS in `corruption.css`, and a `WardSeal` overlay rendered on tainted cards in `MethodSelect`. No new dependencies.

**Tech Stack:** React 18 + TypeScript + Vite, framer-motion, Vitest (engine-only tests), plain CSS.

## Global Constraints

- Engine code stays framework-free (zero React/DOM imports) — all logic in `src/engine/`, copied verbatim from the spec.
- Vitest runs **only** `src/engine/__tests__/**` in Node; there are NO component tests. Presentation tasks are verified by `npm run build` (tsc typecheck) plus a manual visual checklist.
- `tsc` runs with `strict`, `noUnusedLocals`, `noUnusedParameters` — no unused symbols.
- The mutator contract: every engine method that changes `this.state` ends by reaching `notify()` (these run inside existing flows that already call it — do not add stray `notify()`).
- Corruption band thresholds (do not change): dormant ≤0, seeded 1–34, spreading 35–66, virulent 67–99, pinnacle 100. `NEAR_PINNACLE = 90`.
- Copy is exact and final: seed-omen = `Something has taken root in the weave that should not be. Say nothing — do not let it know I warned you.` ; taunt lead-in (Light) = `There is something in the —` ; taunt (corruption) = `i let it warn you. watch how little it matters.` (lowercase, matching `INTRUSION_PHRASES`).
- Visual fidelity reference (locked during brainstorming): `.superpowers/brainstorm/9848-1782709960/content/ward-seal-v3.html` and `hijack-v3.html`. **No feelers** (dropped in review).
- Keep docs in sync: any behavior change here updates `docs/game-systems.md` (Task 10) per CLAUDE.md.

---

### Task 1: `CorruptionEngine.warnedBand` — the escalation high-water mark

**Files:**
- Modify: `src/engine/CorruptionEngine.ts`
- Test: `src/engine/__tests__/CorruptionWarnedBand.test.ts` (create)

**Interfaces:**
- Produces: `CorruptionEngine.getWarnedBand(): CorruptionBand`, `CorruptionEngine.markWarned(band: CorruptionBand): void`. Resets to `'dormant'` on `clear()` and when the value starves to 0. Round-trips through `serialize()`/`loadFrom()`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/CorruptionWarnedBand.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CorruptionEngine } from '../CorruptionEngine';

describe('CorruptionEngine.warnedBand', () => {
  it('defaults to dormant', () => {
    expect(new CorruptionEngine().getWarnedBand()).toBe('dormant');
  });

  it('records the highest band warned', () => {
    const e = new CorruptionEngine();
    e.markWarned('spreading');
    expect(e.getWarnedBand()).toBe('spreading');
  });

  it('resets to dormant on clear()', () => {
    const e = new CorruptionEngine();
    e.markWarned('virulent');
    e.clear();
    expect(e.getWarnedBand()).toBe('dormant');
  });

  it('resets to dormant when corruption starves to 0', () => {
    const e = new CorruptionEngine();
    e.setValue(8); // DECAY_RATE = 8 → one starved tick reaches 0
    e.markWarned('spreading');
    const balanced = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };
    e.tick(balanced, 0); // no food → starve
    expect(e.getValue()).toBe(0);
    expect(e.getWarnedBand()).toBe('dormant');
  });

  it('round-trips warnedBand through serialize/loadFrom', () => {
    const e = new CorruptionEngine();
    e.setValue(40);
    e.markWarned('spreading');
    const json = e.serialize();
    const e2 = new CorruptionEngine();
    e2.loadFrom(json);
    expect(e2.getWarnedBand()).toBe('spreading');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/CorruptionWarnedBand.test.ts`
Expected: FAIL — `getWarnedBand is not a function`.

- [ ] **Step 3: Implement**

In `src/engine/CorruptionEngine.ts`:

Add `CORRUPTION_BANDS` to the existing import from `'../data/corruption'`:

```ts
import {
  corruptionFood, corruptionBandOf, seedChance, highAffinityCount,
  SEED_INITIAL, EROSION_RATE, SKIM_RATE, DRAIN_RATE, DECAY_RATE,
  HIGH_THRESHOLD, PINNACLE, CORRUPTION_BANDS,
} from '../data/corruption';
```

Add the field beside `private hasIntruded = false;`:

```ts
  private warnedBand: CorruptionBand = 'dormant';
```

Add accessors beside `markIntruded`/`getHasIntruded`:

```ts
  getWarnedBand(): CorruptionBand { return this.warnedBand; }
  markWarned(band: CorruptionBand): void { this.warnedBand = band; }
```

In `clear()`, also reset it:

```ts
  clear(): void { this.value = 0; this.hasIntruded = false; this.warnedBand = 'dormant'; }
```

In `tick()`, in the starve branch where it already resets `hasIntruded`, also reset `warnedBand`:

```ts
      if (this.value === 0) { this.hasIntruded = false; this.warnedBand = 'dormant'; }
```

In `serialize()`, include it:

```ts
  serialize(): string { return JSON.stringify({ value: this.value, hasIntruded: this.hasIntruded, warnedBand: this.warnedBand }); }
```

In `loadFrom()`, parse it with validation. Replace the body's parsed-handling so it also reads `warnedBand`:

```ts
  loadFrom(json: string): void {
    try {
      const parsed = JSON.parse(json) as { value?: unknown; hasIntruded?: unknown; warnedBand?: unknown };
      this.value = typeof parsed.value === 'number'
        ? Math.max(0, Math.min(PINNACLE, parsed.value))
        : 0;
      this.hasIntruded = !!parsed.hasIntruded;
      this.warnedBand = typeof parsed.warnedBand === 'string'
        && CORRUPTION_BANDS.includes(parsed.warnedBand as CorruptionBand)
        ? parsed.warnedBand as CorruptionBand
        : 'dormant';
    } catch {
      this.value = 0;
      this.hasIntruded = false;
      this.warnedBand = 'dormant';
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/CorruptionWarnedBand.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/CorruptionEngine.ts src/engine/__tests__/CorruptionWarnedBand.test.ts
git commit -m "feat(corruption): track warnedBand high-water mark on CorruptionEngine"
```

---

### Task 2: Corruption copy + seal-stage helper

**Files:**
- Modify: `src/data/corruption.ts`
- Test: `src/engine/__tests__/SealStage.test.ts` (create)

**Interfaces:**
- Produces: `SEED_OMEN: string`, `LIGHT_LEAD_IN: string`, `TAUNT_LIGHT: string[]`, `SealStage = 'none' | 'intact' | 'strain' | 'shattered'`, `SEAL_INTACT_MAX = 56`, `SEAL_STRAIN_MAX = 78`, `sealStageForValue(value: number): SealStage`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/SealStage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sealStageForValue, SEED_OMEN, LIGHT_LEAD_IN, TAUNT_LIGHT } from '../../data/corruption';

describe('sealStageForValue', () => {
  it('is none below spreading (dormant/seeded — no card seal yet)', () => {
    expect(sealStageForValue(0)).toBe('none');
    expect(sealStageForValue(20)).toBe('none');  // seeded
    expect(sealStageForValue(34)).toBe('none');  // top of seeded
  });
  it('is intact in early/mid spreading', () => {
    expect(sealStageForValue(35)).toBe('intact');
    expect(sealStageForValue(56)).toBe('intact');
  });
  it('strains from late spreading into early virulent', () => {
    expect(sealStageForValue(57)).toBe('strain'); // late spreading
    expect(sealStageForValue(66)).toBe('strain'); // top of spreading
    expect(sealStageForValue(78)).toBe('strain'); // early virulent
  });
  it('shatters from mid virulent onward', () => {
    expect(sealStageForValue(79)).toBe('shattered');
    expect(sealStageForValue(99)).toBe('shattered');
    expect(sealStageForValue(100)).toBe('shattered');
  });
});

describe('warning copy', () => {
  it('exposes the seed omen, light lead-in, and at least one taunt', () => {
    expect(SEED_OMEN).toContain('weave');
    expect(LIGHT_LEAD_IN).toBe('There is something in the —');
    expect(TAUNT_LIGHT.length).toBeGreaterThan(0);
    expect(TAUNT_LIGHT[0]).toBe('i let it warn you. watch how little it matters.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/SealStage.test.ts`
Expected: FAIL — `sealStageForValue` not exported.

- [ ] **Step 3: Implement**

Append to `src/data/corruption.ts` (after the existing exports):

```ts
// ── Light's corruption warning (presentation copy + seal staging) ──

// Light's seed-omen — fired once per perceived band escalation (sentence-case,
// formal: the scared protector). See docs/game-systems.md.
export const SEED_OMEN =
  'Something has taken root in the weave that should not be. Say nothing — do not let it know I warned you.';

// Light's furtive, cut-off line that corruption interrupts at the virulent crossing.
export const LIGHT_LEAD_IN = 'There is something in the —';

// Corruption's taunt, drawn when it interrupts Light at the virulent crossing.
// Lowercase, matching INTRUSION_PHRASES.
export const TAUNT_LIGHT = [
  'i let it warn you. watch how little it matters.',
];

// Ward-seal visual stage as a pure function of corruption value (deterministic,
// reload-safe). 'none' below spreading; intact → strain → shattered as it worsens.
export type SealStage = 'none' | 'intact' | 'strain' | 'shattered';
export const SEAL_INTACT_MAX = 56; // ≤ this (within spreading) the seal is calm
export const SEAL_STRAIN_MAX = 78; // ≤ this the seal strains; above → shattered

export function sealStageForValue(value: number): SealStage {
  const band = corruptionBandOf(value);
  if (band === 'dormant' || band === 'seeded') return 'none';
  if (value <= SEAL_INTACT_MAX) return 'intact';
  if (value <= SEAL_STRAIN_MAX) return 'strain';
  return 'shattered';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/SealStage.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/corruption.ts src/engine/__tests__/SealStage.test.ts
git commit -m "feat(corruption): add light-warning copy + sealStageForValue helper"
```

---

### Task 3: Engine — seed-omen on perceived escalation

**Files:**
- Modify: `src/engine/types.ts` (add `omen` to `GameState`)
- Modify: `src/engine/GameEngine.ts` (init `omen`, fire on escalation, `clearOmen`)
- Test: `src/engine/__tests__/LightOmen.test.ts` (create)

**Interfaces:**
- Consumes: `CorruptionEngine.getWarnedBand`/`markWarned` (Task 1), `SEED_OMEN` (Task 2).
- Produces: `GameState.omen: { text: string } | null`; `GameEngine.clearOmen(): void`. The omen fires inside `applyCorruptionTick` when Light effective band ≥ ascendant and the current corruption band is higher than `warnedBand` AND the escalation is *below* virulent (the virulent crossing is Task 4's taunt instead).

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/LightOmen.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, DiceResult } from '../types';
import { SEED_OMEN } from '../../data/corruption';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

// Light high + a hoard for corruption food (so it grows, never starves).
const litHoard = (light: number): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light, shadow: 50 });

function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('Light seed-omen', () => {
  it('fires SEED_OMEN on first perception at spreading with Dominant Light', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no procs/intrusions
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) }); // dominant + light=100 is food
    e.setCorruption(40); // spreading

    oneReading(e);

    expect(e.getState().omen).toEqual({ text: SEED_OMEN });
    expect(e.corruptionEngineForTest().getWarnedBand()).toBe('spreading');
  });

  it('does NOT fire when Light is below ascendant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } }); // food, but Light stirring
    e.setCorruption(40);

    oneReading(e);

    expect(e.getState().omen).toBeNull();
    expect(e.corruptionEngineForTest().getWarnedBand()).toBe('dormant');
  });

  it('does not re-fire for a band already warned', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) });
    e.setCorruption(40);

    oneReading(e);            // fires at spreading
    e.clearOmen();            // player saw it
    oneReading(e);            // still spreading → no new omen

    expect(e.getState().omen).toBeNull();
  });

  it('clearOmen() clears the transient', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) });
    e.setCorruption(40);
    oneReading(e);
    expect(e.getState().omen).not.toBeNull();
    e.clearOmen();
    expect(e.getState().omen).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/LightOmen.test.ts`
Expected: FAIL — `omen` does not exist on state / `clearOmen` is not a function.

- [ ] **Step 3: Implement**

In `src/engine/types.ts`, add to `GameState` directly beneath the `intrusion` line:

```ts
  omen: { text: string } | null;     // Light's transient seed-warning popup; React animates then clears
```

In `src/engine/GameEngine.ts`:

Extend the corruption-data import (it already imports several names on one line near the top) to also include `SEED_OMEN`:

```ts
import { RUPTURE_RESET, rollInfectedCount, INFECTION_GAIN_MULT, CORRUPTED_TAG, CORRUPTION_BANDS, SIGHT_COST, LIE_OFFSET, NEAR_PINNACLE, INTRUSION_PHRASES, intrusionChance, isVisibleCorruption, SEED_OMEN } from '../data/corruption';
```

In the initial-state object (where `intrusion: null,` is set, ~line 89), add:

```ts
      omen: null,
```

In `applyCorruptionTick()`, after the existing rupture-flag line (`if (tick.ruptured) this.pendingRupture = true;`) and before the method closes, append the escalation check:

```ts
    // Light's escalating warning: each time Light perceives corruption entering a
    // worse band, it warns. Below virulent it is a furtive omen popup; the virulent
    // crossing is the interrupted taunt (handled in maybeIntrude via the flag below).
    this.suppressIntrusionThisPass = false;
    const cband = this.corruptionEngine.getBand();
    const warned = this.corruptionEngine.getWarnedBand();
    const lightPerceives =
      BAND_ORDER.indexOf(this.affinityEngine.bandOf('light')) >= BAND_ORDER.indexOf('ascendant');
    if (lightPerceives && CORRUPTION_BANDS.indexOf(cband) > CORRUPTION_BANDS.indexOf(warned)) {
      const enteringVirulent =
        CORRUPTION_BANDS.indexOf(cband) >= CORRUPTION_BANDS.indexOf('virulent');
      if (!enteringVirulent) {
        this.state.omen = { text: SEED_OMEN };
      }
      // (the virulent-crossing taunt is set in maybeIntrude — Task 4)
      this.corruptionEngine.markWarned(cband);
    }
```

Add the private field near the other private flags (e.g. beside `private pendingRupture`):

```ts
  private suppressIntrusionThisPass = false;
```

Add the `clearOmen` method beside `clearIntrusion` (~line 657):

```ts
  clearOmen(): void {
    if (!this.state.omen) return;
    this.state.omen = null;
    this.notify();
  }
```

> Note: `BAND_ORDER` and `CORRUPTION_BANDS` are already imported in `GameEngine.ts`. The `omen` is transient UI state (never serialized) — it does not need carryover handling; `OmenOverlay` clears it after its animation (Task 5).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/LightOmen.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full engine suite to confirm no regressions**

Run: `npm test`
Expected: PASS (all existing tests still green; `noUnusedLocals` happy because `suppressIntrusionThisPass` is consumed in Task 4 — it is read in this same task is NOT yet true, so temporarily reference it: see note).

> If `npm test`/`tsc` flags `suppressIntrusionThisPass` as written-but-never-read, that is expected until Task 4 reads it. To keep this task self-contained and green, also add the guard line in `maybeIntrude` now (it is harmless before Task 4): at the very top of `maybeIntrude`, add `if (this.suppressIntrusionThisPass) return;`.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/LightOmen.test.ts
git commit -m "feat(corruption): fire Light seed-omen on perceived band escalation"
```

---

### Task 4: Engine — the interrupting taunt at the virulent crossing

**Files:**
- Modify: `src/engine/types.ts` (extend `intrusion` shape)
- Modify: `src/engine/GameEngine.ts` (set taunt in `applyCorruptionTick`, guard `maybeIntrude`)
- Test: `src/engine/__tests__/LightTaunt.test.ts` (create)

**Interfaces:**
- Consumes: `warnedBand` (Task 1), `LIGHT_LEAD_IN`, `TAUNT_LIGHT` (Task 2), `suppressIntrusionThisPass` (Task 3).
- Produces: `GameState.intrusion` becomes `{ text: string; lead?: string } | null`. When the escalation crosses into virulent with Light ≥ ascendant, `intrusion = { text: <taunt>, lead: LIGHT_LEAD_IN }` is set **guaranteed**, and the generic `maybeIntrude` roll is suppressed for that pass.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/LightTaunt.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, DiceResult } from '../types';
import { LIGHT_LEAD_IN, TAUNT_LIGHT } from '../../data/corruption';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});
const litHoard = (light: number): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light, shadow: 50 });
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('Light taunt at the virulent crossing', () => {
  it('interrupts Light with a chained lead-in + taunt when crossing into virulent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // suppress the generic intrusion roll
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) }); // dominant
    e.setCorruption(80); // already virulent
    e.corruptionEngineForTest().markWarned('spreading'); // simulate the earlier spreading omen

    oneReading(e);

    const intr = e.getState().intrusion!;
    expect(intr.lead).toBe(LIGHT_LEAD_IN);
    expect(TAUNT_LIGHT).toContain(intr.text);
    expect(e.corruptionEngineForTest().getWarnedBand()).toBe('virulent');
    // The virulent escalation does NOT also pop a separate omen.
    expect(e.getState().omen).toBeNull();
  });

  it('does not taunt when Light is below ascendant at the crossing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(80); // virulent, but Light only stirring
    e.corruptionEngineForTest().markWarned('spreading');

    oneReading(e);

    const intr = e.getState().intrusion;
    // No taunt lead-in; whatever the generic path did, it is not a chained taunt.
    expect(intr?.lead).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/LightTaunt.test.ts`
Expected: FAIL — `intr.lead` is `undefined` (no taunt wired yet).

- [ ] **Step 3: Implement**

In `src/engine/types.ts`, change the `intrusion` field of `GameState`:

```ts
  intrusion: { text: string; lead?: string } | null; // transient phantom line; `lead` set when corruption interrupts Light (taunt chain)
```

In `src/engine/GameEngine.ts`, extend the corruption import to include `LIGHT_LEAD_IN` and `TAUNT_LIGHT`:

```ts
import { RUPTURE_RESET, rollInfectedCount, INFECTION_GAIN_MULT, CORRUPTED_TAG, CORRUPTION_BANDS, SIGHT_COST, LIE_OFFSET, NEAR_PINNACLE, INTRUSION_PHRASES, intrusionChance, isVisibleCorruption, SEED_OMEN, LIGHT_LEAD_IN, TAUNT_LIGHT } from '../data/corruption';
```

In `applyCorruptionTick()`, replace the placeholder comment `// (the virulent-crossing taunt is set in maybeIntrude — Task 4)` and the surrounding `if (!enteringVirulent)` block with the full handling:

```ts
      if (enteringVirulent) {
        // Corruption is finally strong enough to notice Light. The escalation
        // warning is interrupted: a guaranteed chained taunt, and the generic
        // intrusion roll is suppressed this pass so it cannot overwrite it.
        const text = TAUNT_LIGHT[Math.floor(Math.random() * TAUNT_LIGHT.length)];
        this.state.intrusion = { text, lead: LIGHT_LEAD_IN };
        this.suppressIntrusionThisPass = true;
      } else {
        this.state.omen = { text: SEED_OMEN };
      }
      this.corruptionEngine.markWarned(cband);
```

Confirm the guard added in Task 3 is at the top of `maybeIntrude` (add it if not already there):

```ts
  private maybeIntrude(rng: () => number = Math.random): void {
    if (this.suppressIntrusionThisPass) return;
    const band = this.corruptionEngine.getBand();
    // ...unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/LightTaunt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full engine suite**

Run: `npm test`
Expected: PASS — all green, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/LightTaunt.test.ts
git commit -m "feat(corruption): corruption interrupts Light with a taunt at the virulent crossing"
```

---

### Task 5: `OmenOverlay` component + mount

**Files:**
- Create: `src/components/overlays/corruption/OmenOverlay.tsx`
- Modify: `src/components/screens/GameTable.tsx`
- Modify: `src/styles/corruption.css` (omen popup styles)

**Interfaces:**
- Consumes: `state.omen` + `engine.clearOmen()` (Task 3).

- [ ] **Step 1: Add the omen CSS**

Append to `src/styles/corruption.css`:

```css
/* ── Light's seed-omen (a hushed, frightened warning popup — Light's voice) ── */
.cx-omen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:62;pointer-events:none;animation:cx-omen-wash 4.2s ease-out forwards}
@keyframes cx-omen-wash{0%{background:radial-gradient(60% 40% at 50% 50%,#cfe0ff00,transparent)}18%{background:radial-gradient(60% 40% at 50% 50%,#cfe0ff14,transparent)}100%{background:radial-gradient(60% 40% at 50% 50%,#cfe0ff00,transparent)}}
.cx-omen span{max-width:min(80vw,560px);text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:clamp(1.05rem,3.2vw,1.45rem);line-height:1.4;letter-spacing:.02em;color:#eaf2ff;text-shadow:0 0 10px #9fc0ff88;animation:cx-omen-line 4.2s ease-out forwards}
@keyframes cx-omen-line{0%{opacity:0;transform:translateY(6px)}14%{opacity:1;transform:translateY(0)}82%{opacity:1}100%{opacity:0;transform:translateY(-4px)}}
```

- [ ] **Step 2: Create the component**

Create `src/components/overlays/corruption/OmenOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { useGameEngine } from '../../../hooks/useGameEngine';

// Light's frightened seed-warning. Mirrors IntrusionOverlay: watches a transient
// state field, animates, then clears it after the animation runs.
export default function OmenOverlay() {
  const { state, engine } = useGameEngine();
  const omen = state.omen;
  useEffect(() => {
    if (!omen) return;
    const t = setTimeout(() => engine.clearOmen(), 4200); // matches cx-omen duration
    return () => clearTimeout(t);
  }, [omen, engine]);
  if (!omen) return null;
  return (
    <div className="cx-omen" aria-hidden>
      <span key={omen.text}>{omen.text}</span>
    </div>
  );
}
```

- [ ] **Step 3: Mount it in GameTable**

In `src/components/screens/GameTable.tsx`, add the import beside the `IntrusionOverlay` import:

```tsx
import OmenOverlay from '../overlays/corruption/OmenOverlay';
```

And mount it directly after `<IntrusionOverlay />`:

```tsx
      <IntrusionOverlay />
      <OmenOverlay />
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: `tsc -b` passes, Vite bundles with no errors.

- [ ] **Step 5: Manual visual check**

Run `npm run dev`, open the debug panel, set Light to Dominant and corruption into spreading, complete a reading. Confirm a centered, pale, italic warning blooms and fades (~4s) over the method-select screen, distinct from the red intrusion line.

- [ ] **Step 6: Commit**

```bash
git add src/components/overlays/corruption/OmenOverlay.tsx src/components/screens/GameTable.tsx src/styles/corruption.css
git commit -m "feat(corruption): OmenOverlay surfaces Light's seed-warning"
```

---

### Task 6: `IntrusionOverlay` — chained lead-in → taunt

**Files:**
- Modify: `src/components/overlays/corruption/IntrusionOverlay.tsx`
- Modify: `src/styles/corruption.css` (lead-in style)

**Interfaces:**
- Consumes: `state.intrusion.lead` (Task 4).

- [ ] **Step 1: Add the lead-in CSS**

Append to `src/styles/corruption.css`:

```css
/* ── taunt lead-in: Light's cut-off line that precedes corruption's taunt ── */
.cx-intrusion .cx-lead{display:block;font-style:italic;font-weight:500;color:#dfe8ff;text-shadow:0 0 6px #9fc0ff66;opacity:.85;margin-bottom:.5rem;font-size:clamp(1.05rem,3.4vw,1.4rem);animation:cx-lead-in 2.4s ease-out forwards}
@keyframes cx-lead-in{0%{opacity:0}10%{opacity:.9}55%{opacity:.9}70%{opacity:.25}100%{opacity:0}}
```

- [ ] **Step 2: Render the chain**

Replace the body of `src/components/overlays/corruption/IntrusionOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { useGameEngine } from '../../../hooks/useGameEngine';

export default function IntrusionOverlay() {
  const { state, engine } = useGameEngine();
  const intrusion = state.intrusion;
  useEffect(() => {
    if (!intrusion) return;
    const t = setTimeout(() => engine.clearIntrusion(), 2400); // matches cx-intr duration
    return () => clearTimeout(t);
  }, [intrusion, engine]);
  if (!intrusion) return null;
  return (
    <div className="cx-intrusion" aria-hidden>
      <span key={intrusion.text}>
        {intrusion.lead && <span className="cx-lead">{intrusion.lead}</span>}
        {intrusion.text}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Manual visual check**

In `npm run dev`, with Light Dominant, push corruption from spreading across the 67 boundary (debug band-jump). Confirm the intrusion shows Light's faint cut-off line *"There is something in the —"* above the red taunt *"i let it warn you. watch how little it matters."*

- [ ] **Step 5: Commit**

```bash
git add src/components/overlays/corruption/IntrusionOverlay.tsx src/styles/corruption.css
git commit -m "feat(corruption): IntrusionOverlay chains Light's cut-off lead into the taunt"
```

---

### Task 7: `corruption.css` — ward seal (barrier + embryo + strain + shatter)

**Files:**
- Modify: `src/styles/corruption.css`

**Interfaces:**
- Produces: CSS classes consumed by `WardSeal` (Task 9): root `.cx-ward` + stage modifiers `.cx-ward-intact`, `.cx-ward-strain`; barrier parts `.cx-ward-frame`, `.cx-ward-lattice`, `.cx-ward-sheen`, `.cx-ward-rune`, `.cx-ward-lock`, `.cx-ward-ring`; embryo `.cx-emb`, `.cx-emb-core`, `.cx-emb-nucleus`, `.cx-emb-tendril` (`.t1/.t2/.t3`); strain cracks `.cx-ward-crack` (`.c1..c4`); shatter `.cx-ward-shatter` + `.cx-shard` (`.s1..s6`).

- [ ] **Step 1: Add the ward-seal CSS**

Append to `src/styles/corruption.css` (transplanted from `ward-seal-v3.html` / `hijack-v3.html`, scoped to a `.cx-ward` overlay that fills the card front):

```css
/* ════════ Light's WARD SEAL (overlay on a tainted method card) ════════ */
.cx-ward{position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:8px;overflow:visible}

/* gestating embryo, revealed behind the seal */
.cx-emb{position:absolute;top:46%;left:50%;width:62%;height:46%;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle,#ff5a6e 0%,#ff2d4a 26%,#c20f2255 50%,transparent 72%);
  filter:drop-shadow(0 0 12px #ff2d4a88);animation:cx-emb-beat 2s ease-in-out infinite}
@keyframes cx-emb-beat{0%,100%{transform:translate(-50%,-50%) scale(.8);opacity:.7}16%{transform:translate(-50%,-50%) scale(1.02);opacity:1}30%{transform:translate(-50%,-50%) scale(.9);opacity:.82}48%{transform:translate(-50%,-50%) scale(1.06);opacity:1}64%{transform:translate(-50%,-50%) scale(.82);opacity:.72}}
.cx-emb-nucleus{position:absolute;top:46%;left:50%;width:13px;height:13px;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle,#fff 0%,#ffd2d8 35%,#ff2d4a 70%,transparent 100%);filter:drop-shadow(0 0 6px #fff);animation:cx-emb-beat 2s ease-in-out infinite}
.cx-emb-tendril{position:absolute;top:46%;left:50%;width:2px;height:40%;background:linear-gradient(#ff2d4abb,transparent);transform-origin:top center;opacity:.45}
.cx-emb-tendril.t1{transform:translate(-50%,0) rotate(28deg);animation:cx-emb-writhe 3.6s ease-in-out infinite}
.cx-emb-tendril.t2{transform:translate(-50%,0) rotate(150deg);animation:cx-emb-writhe 4.1s ease-in-out infinite .5s}
.cx-emb-tendril.t3{transform:translate(-50%,0) rotate(250deg);animation:cx-emb-writhe 3.2s ease-in-out infinite .9s}
@keyframes cx-emb-writhe{0%,100%{opacity:.3}50%{opacity:.6}}

/* the warded pane: frame + lattice + sheen + scattered runes + central lock */
.cx-ward-frame{position:absolute;inset:5px;border:1.5px solid #cfe0ff;border-radius:6px;opacity:.7;box-shadow:inset 0 0 14px #cfe0ff22}
.cx-ward-lattice{position:absolute;inset:5px;border-radius:6px;opacity:.16;background:repeating-linear-gradient(45deg,#cfe0ff 0 1px,transparent 1px 13px),repeating-linear-gradient(-45deg,#cfe0ff 0 1px,transparent 1px 13px)}
.cx-ward-sheen{position:absolute;top:-30%;left:-50%;width:55%;height:170%;transform:rotate(12deg);background:linear-gradient(100deg,transparent,#dce9ff44,transparent);animation:cx-ward-sheen 5s ease-in-out infinite}
@keyframes cx-ward-sheen{0%,72%,100%{left:-50%;opacity:0}80%{opacity:.8}92%{left:130%;opacity:0}}
.cx-ward-rune{position:absolute;color:#eef5ff;font-size:.85rem;text-shadow:0 0 6px #cfe0ffaa;opacity:.82}
.cx-ward-ring{position:absolute;top:46%;left:50%;width:62%;height:44%;transform:translate(-50%,-50%);border-radius:50%;border:1px dashed #aebfe6;opacity:.45;animation:cx-ward-spin 18s linear infinite}
@keyframes cx-ward-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
.cx-ward-lock{position:absolute;top:46%;left:50%;width:30px;height:30px;transform:translate(-50%,-50%);border-radius:50%;border:1.5px solid #cfe0ff;box-shadow:0 0 9px #cfe0ff77,inset 0 0 8px #cfe0ff44;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(from 0deg,#cfe0ff1f 0 7deg,transparent 7deg 20deg)}
.cx-ward-lock span{font-size:1.1rem;color:#fff;text-shadow:0 0 8px #cfe0ff}

/* STRAIN (late spreading → early virulent): barrier flickers, embryo swells, cracks */
.cx-ward-strain .cx-emb,.cx-ward-strain .cx-emb-nucleus{animation:cx-emb-strain 1.15s ease-in-out infinite}
@keyframes cx-emb-strain{0%,100%{transform:translate(-50%,-50%) scale(.92);opacity:.85}20%{transform:translate(-50%,-50%) scale(1.22);opacity:1}40%{transform:translate(-50%,-50%) scale(1.0);opacity:.9}60%{transform:translate(-50%,-50%) scale(1.28);opacity:1}}
.cx-ward-strain .cx-ward-frame{animation:cx-ward-flick 3.4s steps(1) infinite;border-color:#e9d3a0}
@keyframes cx-ward-flick{0%,58%,100%{opacity:.85}60%{opacity:.25}63%{opacity:.85}74%{opacity:.4}76%{opacity:.85}88%{opacity:.25}90%{opacity:.85}}
.cx-ward-strain .cx-ward-rune{animation:cx-ward-runered 2.2s steps(1) infinite}
@keyframes cx-ward-runered{0%,70%,100%{color:#eef5ff;text-shadow:0 0 6px #cfe0ffaa;transform:translate(0,0)}74%{color:#ff5a6e;text-shadow:0 0 9px #ff2d4a;transform:translate(1px,-1px)}80%{color:#eef5ff}86%{color:#ff2d4a;transform:translate(-1px,0)}}
.cx-ward-crack{position:absolute;top:46%;left:50%;width:1.6px;height:0;background:linear-gradient(#ff5a6e,transparent);transform-origin:top center;filter:drop-shadow(0 0 3px #ff2d4a)}
.cx-ward-strain .cx-ward-crack.c1{transform:translate(-50%,0) rotate(40deg);animation:cx-ward-crackgrow 2.3s ease-out infinite}
.cx-ward-strain .cx-ward-crack.c2{transform:translate(-50%,0) rotate(155deg);animation:cx-ward-crackgrow 2.3s ease-out infinite .7s}
.cx-ward-strain .cx-ward-crack.c3{transform:translate(-50%,0) rotate(265deg);animation:cx-ward-crackgrow 2.3s ease-out infinite 1.4s}
.cx-ward-strain .cx-ward-crack.c4{transform:translate(-50%,0) rotate(330deg);animation:cx-ward-crackgrow 2.3s ease-out infinite 1.9s}
@keyframes cx-ward-crackgrow{0%,55%{height:0;opacity:0}60%{opacity:1}100%{height:70%;opacity:0}}

/* SHATTER one-shot (plays once as the seal breaks at the hijack) */
.cx-ward-shatter{position:absolute;inset:0;z-index:4;pointer-events:none}
.cx-shard{position:absolute;top:50%;left:50%;width:22px;height:3px;background:linear-gradient(90deg,#cfe0ff,transparent);border-radius:2px;opacity:0}
.cx-shard.s1{--a:20deg;animation:cx-shard-fly 1.1s ease-out forwards}
.cx-shard.s2{--a:75deg;animation:cx-shard-fly 1.1s ease-out forwards .03s}
.cx-shard.s3{--a:140deg;animation:cx-shard-fly 1.1s ease-out forwards .06s}
.cx-shard.s4{--a:205deg;animation:cx-shard-fly 1.1s ease-out forwards .02s}
.cx-shard.s5{--a:270deg;animation:cx-shard-fly 1.1s ease-out forwards .05s}
.cx-shard.s6{--a:325deg;animation:cx-shard-fly 1.1s ease-out forwards .08s}
@keyframes cx-shard-fly{0%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateX(0)}15%{opacity:.95;transform:translate(-50%,-50%) rotate(var(--a)) translateX(10px)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateX(90px)}}
```

- [ ] **Step 2: Typecheck (CSS is not type-checked, but confirm the build still bundles)**

Run: `npm run build`
Expected: passes (CSS is imported globally; a syntax error would surface at bundle time).

- [ ] **Step 3: Commit**

```bash
git add src/styles/corruption.css
git commit -m "feat(corruption): ward-seal CSS (barrier, embryo, strain, shatter)"
```

---

### Task 8: `corruption.css` — grasping lure + ambient unease

**Files:**
- Modify: `src/styles/corruption.css`

**Interfaces:**
- Produces: lure classes consumed by `WardSeal`/`MethodCardFront` (Task 9): `.cx-lure` (root overlay), `.cx-lure-eye` (`.e1..e5`), `.cx-lure-whisper` (`.w1/.w2`), and `.cx-lure-lunge` (applied to the card front at near-pinnacle). Plus `.cx-ambient` for the spread-wide Ascendant unease.

- [ ] **Step 1: Add the lure + ambient CSS**

Append to `src/styles/corruption.css` (transplanted from `hijack-v3.html`, no feelers):

```css
/* ════════ GRASPING LURE (layers over cx-card-virulent on a tainted card) ════════ */
.cx-lure{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;border-radius:8px}
/* eyes: closed by default (a faint red seam); blink open sporadically at random spots */
.cx-lure-eye{position:absolute;width:24px;height:9px;opacity:.5;transform:scaleY(.06);border-radius:50%;
  background:radial-gradient(ellipse at center,#ffe9ec 0%,#ff2d4a 34%,#3a0008 74%,transparent 100%);box-shadow:0 0 9px #ff2d4a}
.cx-lure-eye::after{content:"";position:absolute;top:50%;left:50%;width:7px;height:7px;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle,#fff 0%,#ffd2d8 28%,#1a0006 82%);animation:cx-lure-dart 4s ease-in-out infinite}
@keyframes cx-lure-dart{0%,100%{transform:translate(-70%,-50%)}50%{transform:translate(-30%,-50%)}}
.cx-lure-eye.e1{top:30%;left:22%;animation:cx-lure-wake 8.5s ease-in-out infinite}
.cx-lure-eye.e2{top:44%;right:18%;animation:cx-lure-wake 11s ease-in-out infinite 2.3s}
.cx-lure-eye.e3{top:64%;left:38%;animation:cx-lure-wake 9.5s ease-in-out infinite 4.1s}
.cx-lure-eye.e4{top:22%;right:32%;animation:cx-lure-wake 12.5s ease-in-out infinite 6.2s}
.cx-lure-eye.e5{top:56%;left:16%;animation:cx-lure-wake 10.5s ease-in-out infinite 1.2s}
@keyframes cx-lure-wake{0%,90%,100%{opacity:0;transform:scaleY(.06)}92%{opacity:.95;transform:scaleY(1)}96%{opacity:.85;transform:scaleY(1)}98.5%{opacity:0;transform:scaleY(.06)}}
.cx-lure-whisper{position:absolute;left:50%;transform:translateX(-50%);color:#ffb3bc;font-style:italic;text-shadow:0 0 7px #ff2d4a;white-space:nowrap;opacity:0;font-size:.85rem}
.cx-lure-whisper.w1{top:16%;animation:cx-lure-flick 5s steps(1) infinite}
.cx-lure-whisper.w2{bottom:14%;animation:cx-lure-flick 5s steps(1) infinite 2.5s}
@keyframes cx-lure-flick{0%,80%,100%{opacity:0}83%{opacity:.95}87%{opacity:.2}90%{opacity:1}96%{opacity:0}}
/* near-pinnacle: the held-back manic lunge + quicker eyes */
.cx-lure-lunge{animation:cx-lure-lunge 1.7s ease-in-out infinite}
@keyframes cx-lure-lunge{0%,100%{transform:scale(1)}42%{transform:scale(1.06) translateY(-3px)}60%{transform:scale(1.02)}74%{transform:scale(1.07) translateY(-4px)}}
.cx-lure-lunge .cx-lure-eye.e1{animation-duration:4.5s}.cx-lure-lunge .cx-lure-eye.e2{animation-duration:5.5s}
.cx-lure-lunge .cx-lure-eye.e3{animation-duration:5s}.cx-lure-lunge .cx-lure-eye.e4{animation-duration:6s}.cx-lure-lunge .cx-lure-eye.e5{animation-duration:5.2s}

/* ════════ AMBIENT UNEASE (Light Ascendant — vague, spread-wide, no pinpoint) ════════ */
.cx-ambient{position:absolute;inset:0;pointer-events:none;z-index:1;border-radius:12px;
  box-shadow:inset 0 0 60px #9fc0ff14;animation:cx-ambient 6s ease-in-out infinite}
@keyframes cx-ambient{0%,100%{opacity:.4}50%{opacity:.85}}
```

- [ ] **Step 2: Confirm the build still bundles**

Run: `npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/styles/corruption.css
git commit -m "feat(corruption): grasping-lure + ambient-unease CSS"
```

---

### Task 9: `WardSeal` component + wire the seal/lure/ambient into `MethodSelect`

**Files:**
- Create: `src/components/cards/WardSeal.tsx`
- Modify: `src/components/cards/MethodCardFront.tsx`
- Modify: `src/components/cards/MethodCard.tsx`
- Modify: `src/components/cards/CardSpread.tsx`
- Modify: `src/components/screens/MethodSelect.tsx`

**Interfaces:**
- Consumes: `state.corruptionWarning`, `state.infectedMethods`, `state.corruption.value/band` (existing), `sealStageForValue`, `NEAR_PINNACLE` (Tasks 2 / existing), CSS classes (Tasks 7–8).
- Produces: a `WardProp` threaded through the card chain. `WardProp = { kind: 'seal'; stage: 'intact' | 'strain' } | { kind: 'lure'; lunging: boolean } | null`.

> Verification is `npm run build` (tsc) + a manual visual checklist — there are no component tests by project convention.

- [ ] **Step 1: Create the WardSeal component**

Create `src/components/cards/WardSeal.tsx`:

```tsx
// Light's warning overlay on a tainted method card. Two shapes:
//  - seal (Light Dominant, pre-hijack): the warded pane + gestating embryo.
//    `intact` (early/mid spreading) → calm; `strain` (late spreading/early virulent) → failing.
//  - lure (virulent hijack): the seal has shattered; corruption openly beckons.
//    Layers over the existing cx-card-virulent look. `lunging` adds the near-pinnacle manic pulse.
export type WardProp =
  | { kind: 'seal'; stage: 'intact' | 'strain' }
  | { kind: 'lure'; lunging: boolean }
  | null;

const RUNES = ['ᚠ', 'ᚹ', 'ᛉ', 'ᚱ', 'ᚦ', 'ᛟ', 'ᛇ']; // scattered barrier inscription
const RUNE_POS: React.CSSProperties[] = [
  { top: 8, left: 10 }, { top: 10, right: 12 }, { top: '50%', left: 6 },
  { top: '50%', right: 6 }, { bottom: 26, left: 12 }, { bottom: 28, right: 14 }, { top: 18, left: '50%' },
];

export default function WardSeal({ ward }: { ward: WardProp }) {
  if (!ward) return null;

  if (ward.kind === 'lure') {
    return (
      <div className="cx-lure" aria-hidden>
        <span className="cx-lure-eye e1" /><span className="cx-lure-eye e2" /><span className="cx-lure-eye e3" />
        <span className="cx-lure-eye e4" /><span className="cx-lure-eye e5" />
        <span className="cx-lure-whisper w1">come closer</span>
        <span className="cx-lure-whisper w2">choose me</span>
      </div>
    );
  }

  const cls = ward.stage === 'strain' ? 'cx-ward cx-ward-strain' : 'cx-ward cx-ward-intact';
  return (
    <div className={cls} aria-hidden>
      <div className="cx-emb" />
      <span className="cx-emb-nucleus" />
      <span className="cx-emb-tendril t1" /><span className="cx-emb-tendril t2" /><span className="cx-emb-tendril t3" />
      {ward.stage === 'strain' && (
        <>
          <span className="cx-ward-crack c1" /><span className="cx-ward-crack c2" />
          <span className="cx-ward-crack c3" /><span className="cx-ward-crack c4" />
        </>
      )}
      <div className="cx-ward-ring" />
      <div className="cx-ward-lattice" /><div className="cx-ward-frame" /><div className="cx-ward-sheen" />
      {RUNES.map((r, i) => (
        <span key={i} className="cx-ward-rune" style={RUNE_POS[i]}>{r}</span>
      ))}
      <div className="cx-ward-lock"><span>✦</span></div>
    </div>
  );
}
```

- [ ] **Step 2: Render WardSeal inside MethodCardFront**

In `src/components/cards/MethodCardFront.tsx`, import the component and type, accept a `ward` prop, and render it. Replace the import block and signature:

```tsx
import MethodEmblem from './MethodEmblem';
import WardSeal, { type WardProp } from './WardSeal';
import { METHOD_FRONTS } from '../../data/method-cards';
import type { DivinationType } from '../../engine/types';

export type CorruptedProp = 'spreading' | 'virulent' | null;

export default function MethodCardFront({ method, corrupted = null, ward = null }: { method: DivinationType; corrupted?: CorruptedProp; ward?: WardProp }) {
```

Add `<WardSeal ward={ward} />` as the last child inside the `frontStyle` container (right before its closing `</div>`):

```tsx
      <div className={corrupted ? 'cx-name' : undefined} style={titleStyle}>{cfg.title}</div>
      <div style={flavorStyle}>{cfg.flavor}</div>
      <WardSeal ward={ward} />
    </div>
```

- [ ] **Step 3: Thread `ward` (and the lunge class) through MethodCard**

In `src/components/cards/MethodCard.tsx`:

Import the type alongside `CorruptedProp`:

```tsx
import MethodCardFront, { type CorruptedProp } from './MethodCardFront';
import type { WardProp } from './WardSeal';
```

Add `ward` to `MethodCardProps`:

```tsx
  corrupted?: CorruptedProp; // telegraph infection band; null/undefined = normal
  ward?: WardProp;           // Light's ward-seal / corruption's lure overlay
```

Add it to the destructure (with default):

```tsx
  appeared = true, appearDelay = 0, dissolving = false, phantom = false, corrupted = null, ward = null,
}: MethodCardProps) {
```

Add the near-pinnacle lunge class to the button's `className` (compose with the existing corruption class). Replace the existing `className=` line on the `motion.button`:

```tsx
        className={[
          corrupted === 'virulent' ? 'cx-card-virulent' : corrupted === 'spreading' ? 'cx-card-spreading' : '',
          ward && ward.kind === 'lure' && ward.lunging ? 'cx-lure-lunge' : '',
        ].filter(Boolean).join(' ') || undefined}
```

Pass `ward` into the face-up `MethodCardFront` (the `else` branch that renders `<MethodCardFront method={method} corrupted={corrupted} />`):

```tsx
              <MethodCardFront method={method} corrupted={corrupted} ward={ward} />
```

- [ ] **Step 4: Thread `ward` through CardSpread**

In `src/components/cards/CardSpread.tsx`:

Import the type:

```tsx
import type { CorruptedProp } from './MethodCardFront';
import type { WardProp } from './WardSeal';
```

Add to `CardSpreadProps`:

```tsx
  // Optional: returns corruption class for index i (null = normal)
  corruptedFor?: (index: number) => CorruptedProp;
  // Optional: returns Light's ward-seal / lure overlay for index i (null = none)
  wardFor?: (index: number) => WardProp;
```

Add to the destructure:

```tsx
  interactive, onPick, dealNonce, containerRef, corruptedFor, wardFor,
}: CardSpreadProps) {
```

Pass it to `MethodCard`:

```tsx
          corrupted={corruptedFor ? corruptedFor(i) : null}
          ward={wardFor ? wardFor(i) : null}
```

- [ ] **Step 5: Derive ward state + ambient in MethodSelect**

In `src/components/screens/MethodSelect.tsx`:

Add imports near the top:

```tsx
import type { WardProp } from '../cards/WardSeal';
import { sealStageForValue, NEAR_PINNACLE } from '../../data/corruption';
```

Just after the existing `corruptedFor` definition (around line 233), add the ward derivation and the ambient flag:

```tsx
  // Light's warning overlay per card. Precision comes from corruptionWarning
  // (Dominant → methods named; Ascendant → vague, handled by the spread-wide
  // ambient shimmer instead). State comes from the corruption value.
  const warning = state.corruptionWarning;
  const corruptionValue = state.corruption.value;
  const wardFor = (i: number): WardProp => {
    if (!state.infectedMethods.includes(i)) return null;
    // Virulent hijack: the seal is broken — corruption openly lures.
    if (band === 'virulent' || band === 'pinnacle') {
      return { kind: 'lure', lunging: corruptionValue >= NEAR_PINNACLE };
    }
    // Spreading + Light Dominant (names the tainted paths): the ward seal.
    if (warning && warning.methods.includes(i)) {
      const stage = sealStageForValue(corruptionValue);
      if (stage === 'intact' || stage === 'strain') return { kind: 'seal', stage };
    }
    return null;
  };

  // Ascendant Light senses a predator but cannot pinpoint it → vague spread-wide unease.
  const showAmbientUnease = !!warning && warning.present && !warning.tainted && warning.methods.length === 0;
```

Pass `wardFor` to the `<CardSpread .../>` (add the prop beside `corruptedFor={corruptedFor}`):

```tsx
            corruptedFor={corruptedFor}
            wardFor={wardFor}
```

Render the ambient shimmer over the spread. The spread is wrapped by `<div ref={spreadWrapRef} style={spreadWrapStyle}>`; add the overlay as its first child, before `<CardSpread ... />`:

```tsx
        <div ref={spreadWrapRef} style={spreadWrapStyle}>
          {showAmbientUnease && <div className="cx-ambient" aria-hidden />}
          <CardSpread
```

> The infected-pick ascend overlay (lines ~303–319) already passes `corrupted={corruptedFor(infectedPickIndex)}` to its own `MethodCard`; leave that as-is — the ward overlay there is not needed during the ascend animation.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: `tsc -b` passes with no unused-symbol errors.

- [ ] **Step 7: Manual visual checklist (`npm run dev`, debug panel)**

- Light **Dominant**, corruption **40** (spreading, intact): the named tainted card shows the warded pane (frame, runes, lock-sigil, dashed ring) with a calm red embryo heartbeat behind it.
- Push corruption to **62** (late spreading) then **72** (early virulent): the seal **strains** — frame flickers, runes flash red, cracks spider out, embryo swells.
- Corruption **85** (virulent): the seal is gone; the tainted card wears `cx-card-virulent` + the grasping lure (eyes blink open sporadically, whispers drift). Push ≥ **90**: the card **lunges**.
- Light **Ascendant** (e.g. 70), corruption spreading: **no** per-card seal, but a faint cold shimmer breathes over the whole spread.
- Light **below Ascendant**: no seal, no shimmer; the card still shows the plain corruption telegraph as before.

- [ ] **Step 8: Commit**

```bash
git add src/components/cards/WardSeal.tsx src/components/cards/MethodCardFront.tsx src/components/cards/MethodCard.tsx src/components/cards/CardSpread.tsx src/components/screens/MethodSelect.tsx
git commit -m "feat(corruption): render Light's ward-seal, lure, and ambient unease on method cards"
```

---

### Task 10: Documentation

**Files:**
- Modify: `docs/game-systems.md` (corruption section)
- Modify: `README.md` (corruption/debug sections, if present)

**Interfaces:** none (docs only).

- [ ] **Step 1: Locate the corruption section**

Run: `npx vitest --version` is not needed; instead open the file and find the heading:
Search `docs/game-systems.md` for the corruption/warning section (e.g. the "Rupture-interstitial" and corruption-band material updated in recent commits).

- [ ] **Step 2: Document the Light warning system**

Add a subsection to `docs/game-systems.md` describing, in prose consistent with the surrounding style:
- the two axes (Light band = precision: below Ascendant nothing, Ascendant vague/ambient, Dominant pinpoints; corruption value = seal stage: none < spreading, intact ≤56, strain ≤78, shattered/lure above);
- Light's **escalating** seed-omen (fires once per perceived band escalation; `SEED_OMEN` copy; tracked by `warnedBand`, reset on starve-to-0);
- the **virulent-crossing taunt** (`LIGHT_LEAD_IN` → `TAUNT_LIGHT`, guaranteed, suppresses the generic intrusion that pass) and the false-reassurance banner kept at virulent;
- the lure (grasping eyes/whispers + near-pinnacle lunge) layering on `cx-card-virulent` for any infected card at virulent, vs. the seal+shatter ceremony being Light-Dominant-only.

Also note in the same doc that the **affinity-vs-corruption framework** (Shadow veils / Fate redirects / others) is specced but not yet built (cross-reference `docs/superpowers/specs/2026-06-29-light-corruption-warning-design.md` §10).

- [ ] **Step 3: Mirror any player-facing notes in README**

If `README.md` documents corruption bands or the debug panel, add a one-line mention of the Light warning/omen so the player-facing docs stay accurate. If there is no corresponding section, skip.

- [ ] **Step 4: Typecheck + full suite (sanity, nothing should have changed)**

Run: `npm test && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(corruption): document Light's warning system + seal/lure arc"
```

---

## Self-Review

**1. Spec coverage:**
- §3a precision (Ascendant ambient / Dominant pinpoint / below-Ascendant nothing) → Task 9 `wardFor` + `showAmbientUnease`. ✓
- §3b seal stages by value → Task 2 `sealStageForValue` + Task 7 CSS + Task 9 rendering. ✓
- §4 Beat 1 escalating omen → Task 3. ✓
- §4 Beat 2 guaranteed taunt at virulent crossing (+ collapse case) → Task 4. ✓
- §5 hijack: false-reassurance banner kept (existing `deriveCorruptionWarning`, unchanged — no task needed), shatter + grasping lure, lure-for-all vs seal-ceremony-for-Dominant → Tasks 7–9. ✓
- §6 engine additions: `warnedBand` (Task 1), `TAUNT_LIGHT` collision (Tasks 2/4), seal-state helper (Task 2), no `gestatingMethod` (honored — seal starts at spreading in Task 9). ✓
- §7 components: `OmenOverlay` (Task 5), `IntrusionOverlay` chain (Task 6), `corruption.css` (Tasks 7–8), `MethodSelect` wiring (Task 9). ✓
- §8 copy → Task 2 constants, exact strings. ✓
- §9 tests (omen first-perception/escalation, not below Ascendant, taunt guaranteed at virulent, seal-state thresholds) → Tasks 1–4. ✓
- §9 docs → Task 10. ✓
- §10 framework deferral noted in docs → Task 10. ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to" — all code inlined. ✓

**3. Type consistency:** `WardProp` defined in `WardSeal.tsx` (Task 9 Step 1) and consumed identically in `MethodCardFront`/`MethodCard`/`CardSpread`/`MethodSelect`. `SealStage`/`sealStageForValue` defined in Task 2, consumed in Task 9. `state.omen: { text: string } | null` and `clearOmen()` defined in Task 3, consumed in Task 5. `intrusion: { text; lead? }` defined in Task 4, consumed in Task 6. `getWarnedBand`/`markWarned` defined in Task 1, consumed in Tasks 3–4. `suppressIntrusionThisPass` introduced and read within Tasks 3–4. ✓

> Note on `WardProp` `stage` types: `sealStageForValue` returns `'none' | 'intact' | 'strain' | 'shattered'`; `WardProp`'s seal variant only accepts `'intact' | 'strain'`. Task 9's `wardFor` narrows correctly — it returns a seal only when `stage === 'intact' || stage === 'strain'`, and returns the lure (not a seal) at virulent where the value would be `'shattered'`. No type leak.
