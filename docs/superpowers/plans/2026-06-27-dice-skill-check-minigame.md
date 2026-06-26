# Dice Skill-Check Minigame — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dice minigame as a D&D *skill check* — a real 3D icosahedron you flick into a casting bowl, resolved against a Difficulty Class set by the rest of the reading, with Bless/Bane d4s, an advantage/disadvantage smash-down, and a Baldur's Gate 3-style projectile tally.

**Architecture:** The engine stays framework-free. New pure check logic (`planDiceCheck`, `resolveCheck`) lives in `src/engine/dice.ts` with the tier/interpretation assembly in `src/data/dice.ts`; both are unit-tested with Vitest. The d20 roll itself (`rollD20`/`rollDicePair`) is unchanged — the check layers on top of the natural value. The 3D scene reuses Astral's proven three.js + cannon-es pattern via an extracted `shared3d/dieKit.ts`, lives in `src/components/screens/dice3d/`, and is verified by typecheck + manual dev-server observation.

**Tech Stack:** React 18 + TypeScript + Vite, three.js (3D rendering), cannon-es (3D physics), framer-motion (2D overlay/tally), Vitest (engine tests).

## Global Constraints

- Engine code (`src/engine/**`) MUST NOT import React, the DOM, three.js, or cannon-es. Pure helpers use plain numbers/objects only. (Per CLAUDE.md engine/React split.)
- Every engine mutator that changes state ends with `notify()`. (Applies to the `GameEngine` method changes here.)
- Vitest runs ONLY `src/engine/__tests__/**` in Node (no DOM). New unit tests go there.
- Typecheck is the lint gate: `npm run build` runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`. No unused vars/params.
- Keep docs in sync: changing the dice systems requires updating `docs/game-systems.md` and `README.md` in the same change (per CLAUDE.md Documentation rule).
- `three`, `cannon-es`, `@types/three`, and `framer-motion` are already dependencies — no install step.
- The DC formula and tier bands are **tunable**; use the exact values in this plan as the first pass.
- The committed result is always a single `DiceResult` (one `SlotResult` per minigame). The natural d20 stays in `result.result`; the check context lives in `result.check`.

---

## File Structure

**Create (engine / data — pure, tested):**
- `src/engine/dice.ts` — `planDiceCheck`, `resolveCheck`, `tierFromMargin` (the `astral.ts` analog).
- `src/engine/__tests__/DiceCheck.test.ts`
- `src/engine/__tests__/DiceCheckResult.test.ts`

**Modify (engine / data — pure, tested):**
- `src/engine/types.ts` — `Threshold`, `DiceCheckPlan`, `DiceCheckBreakdown`; `DiceResult.check`.
- `src/data/dice.ts` — export `THRESHOLD_DATA`; import `Threshold` from types; add `buildDiceResult` + check interpretations + `triumph`/`fumble` tags.
- `src/engine/GameEngine.ts` — extend `planDiceRoll()`; add `resolveDiceCheck()`.
- `src/engine/__tests__/DiceRollPlan.test.ts` — assertions for the new plan fields.

**Create (3D component layer — manual verification):**
- `src/components/screens/shared3d/dieKit.ts` — geometry-agnostic die helpers extracted from `celestial/dice.ts`.
- `src/components/screens/dice3d/die.ts` — `createD20` (icosahedron) + `createD4` (tetrahedron).
- `src/components/screens/dice3d/scene.ts` — `createDiceScene` (flick throw, smash-down, d4 drop, settle).
- `src/components/screens/dice3d/DiceCast.tsx` — React `forwardRef` wrapper + WebGL/reduced-motion fallback.
- `src/components/screens/dice3d/DiceTally.tsx` — BG3 tally overlay + projectile motes.

**Modify (3D / component layer):**
- `src/components/screens/celestial/dice.ts` — re-export from `shared3d/dieKit` (extraction; Astral re-verified).
- `src/components/screens/DiceMinigame.tsx` — full rewrite: phase machine driving `DiceCast` + `DiceTally`.
- `src/components/screens/DiceThrowAnimation.tsx` — repurposed as the 2D fallback reveal.

**Modify (docs):**
- `docs/game-systems.md`, `README.md` — dice subsystem rewrite.

---

## Task 1: Check types + result assembly (engine/data, pure)

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/data/dice.ts`
- Test: `src/engine/__tests__/DiceCheckResult.test.ts`

**Interfaces:**
- Produces:
  - `type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high'` (in `types.ts`)
  - `interface DiceCheckPlan { dc: number; bless: number; bane: number; sources: string[] }`
  - `interface DiceCheckBreakdown { d20: number; bless: number[]; bane: number[]; dc: number; total: number; margin: number; tier: Threshold; critical: 'triumph' | 'fumble' | null }`
  - `DiceResult.check?: DiceCheckBreakdown`
  - `const THRESHOLD_DATA` (now exported) and `function buildDiceResult(breakdown: DiceCheckBreakdown): DiceResult` (in `data/dice.ts`)

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/DiceCheckResult.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildDiceResult } from '../../data/dice';
import type { DiceCheckBreakdown } from '../types';

const base: DiceCheckBreakdown = {
  d20: 14, bless: [], bane: [], dc: 12, total: 14, margin: 2,
  tier: 'high', critical: null,
};

describe('buildDiceResult', () => {
  it('carries the natural d20 as result and the tier as threshold', () => {
    const r = buildDiceResult(base);
    expect(r.type).toBe('d20');
    expect(r.result).toBe(14);
    expect(r.threshold).toBe('high');
    expect(r.check).toEqual(base);
  });

  it('pulls themes/dimensions/modifierRoles from the tier data', () => {
    const r = buildDiceResult(base);
    // 'high' tier in THRESHOLD_DATA: favorability +1.0
    expect(r.dimensions.favorability).toBe(1.0);
    expect(r.themes.length).toBeGreaterThan(0);
    expect(r.modifierRoles).toContain('effect');
  });

  it('emits the relative-tier tag (low/high/neutral)', () => {
    expect(buildDiceResult(base).tags).toContain('high');
    expect(buildDiceResult({ ...base, tier: 'neutral', margin: -2 }).tags).toContain('neutral');
    expect(buildDiceResult({ ...base, tier: 'low', margin: -6 }).tags).toContain('low');
  });

  it('emits a triumph tag and a natural-20 interpretation on a triumph crit', () => {
    const r = buildDiceResult({ ...base, d20: 20, tier: 'critical-high', critical: 'triumph' });
    expect(r.tags).toContain('triumph');
    expect(r.interpretation.toLowerCase()).toContain('natural 20');
  });

  it('emits a fumble tag and a natural-1 interpretation on a fumble crit', () => {
    const r = buildDiceResult({ ...base, d20: 1, tier: 'critical-low', critical: 'fumble' });
    expect(r.tags).toContain('fumble');
    expect(r.interpretation.toLowerCase()).toContain('natural 1');
  });

  it('non-crit interpretation names the DC', () => {
    expect(buildDiceResult(base).interpretation).toContain('12');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DiceCheckResult.test.ts`
Expected: FAIL — `buildDiceResult` is not exported / `DiceCheckBreakdown` not found.

- [ ] **Step 3: Add the types to `src/engine/types.ts`**

Add a `Threshold` type and change `DiceResult` to use it + carry `check`. Replace the existing `DiceResult` block (currently:)
```ts
export interface DiceResult extends ThematicData {
  type: 'd20';
  result: number; // 1-20
  threshold: 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';
  interpretation: string;
  tags: Tag[];
}
```
with:
```ts
// Five outcome tiers shared by the dice dataset and the skill-check breakdown.
export type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';

// Skill-check plan: the Difficulty Class and Bless/Bane d4 counts derived from
// the prior reading. Produced by planDiceCheck, threaded to resolveDiceCheck.
export interface DiceCheckPlan {
  dc: number;          // clamped [5, 17]
  bless: number;       // count of +d4 (0..1 in v1)
  bane: number;        // count of -d4 (0..1 in v1)
  sources: string[];   // human-readable reasons (UI marquee)
}

// Resolved check: the rolled d4 values, the total, and the relative tier.
export interface DiceCheckBreakdown {
  d20: number;                          // the kept natural d20 (1..20)
  bless: number[];                      // rolled d4 values added (each 1..4)
  bane: number[];                       // rolled d4 values subtracted (each 1..4)
  dc: number;
  total: number;                        // d20 + sum(bless) - sum(bane)
  margin: number;                       // total - dc
  tier: Threshold;                      // RELATIVE tier (one of the five)
  critical: 'triumph' | 'fumble' | null;
}

export interface DiceResult extends ThematicData {
  type: 'd20';
  result: number; // 1-20 (the natural kept d20)
  threshold: Threshold;
  interpretation: string;
  tags: Tag[];
  check?: DiceCheckBreakdown; // present for skill-check results
}
```

- [ ] **Step 4: Update `src/data/dice.ts` — export `THRESHOLD_DATA`, import `Threshold`, add `buildDiceResult`**

In `src/data/dice.ts`, change the imports + the local `Threshold` definition. The file currently starts:
```ts
import type { DiceResult, ThemeTag, DimensionValues, ModifierRole } from '../engine/types';

export type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';
```
Replace those two with (import `Threshold`, `Tag`, and `DiceCheckBreakdown` from types; re-export `Threshold` for existing importers):
```ts
import type {
  DiceResult, ThemeTag, DimensionValues, ModifierRole, Tag, Threshold, DiceCheckBreakdown,
} from '../engine/types';

export type { Threshold }; // re-export so existing `from '../data/dice'` imports keep resolving
```
Then change the `THRESHOLD_DATA` declaration to be exported:
```ts
export const THRESHOLD_DATA: Record<Threshold, ThresholdData> = {
```
(leave its contents unchanged). Finally, append the result-assembly helpers at the end of the file:
```ts
// Interpretation text for a resolved check. Criticals override; otherwise the
// line names the DC the reading set so success/failure reads as relative.
function checkInterpretation(b: DiceCheckBreakdown): string {
  if (b.critical === 'triumph') {
    return 'A natural 20 — fate breaks open in your favor, past anything the bar demanded.';
  }
  if (b.critical === 'fumble') {
    return 'A natural 1 — the cast collapses; even a low bar goes unmet.';
  }
  switch (b.tier) {
    case 'critical-high':
      return `The reading set the bar at ${b.dc}; your cast clears it commandingly — momentum is yours.`;
    case 'high':
      return `The reading set the bar at ${b.dc}; your cast meets it — the path holds.`;
    case 'neutral':
      return `The reading set the bar at ${b.dc}; your cast falls just short — the question stays open.`;
    case 'low':
      return `The reading set the bar at ${b.dc}; your cast misses — the trend resists you.`;
    case 'critical-low':
      return `The reading set the bar at ${b.dc}; your cast fails badly — fate counsels another way.`;
  }
}

// Assemble the committed DiceResult from a resolved check breakdown. Tier supplies
// themes/dimensions/modifierRoles; the natural d20 stays in `result`.
export function buildDiceResult(breakdown: DiceCheckBreakdown): DiceResult {
  const data = THRESHOLD_DATA[breakdown.tier];
  const polarity = breakdown.tier.includes('low')
    ? 'low'
    : breakdown.tier.includes('high')
      ? 'high'
      : 'neutral';
  const tags: Tag[] = ['roll', 'random', 'numeric', 'threshold', polarity];
  if (breakdown.critical === 'triumph') tags.push('triumph');
  if (breakdown.critical === 'fumble') tags.push('fumble');
  return {
    type: 'd20',
    result: breakdown.d20,
    threshold: breakdown.tier,
    interpretation: checkInterpretation(breakdown),
    tags,
    themes: data.themes,
    dimensions: data.dimensions,
    modifierRoles: data.modifierRoles,
    check: breakdown,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/DiceCheckResult.test.ts`
Expected: PASS (all six cases).

- [ ] **Step 6: Verify the whole build still typechecks**

Run: `npm run build`
Expected: PASS. If a file imported `Threshold` from `../data/dice`, the re-export keeps it working; if `tsc` flags an unused `Tag` import in `data/dice.ts`, confirm `buildDiceResult` uses it (it does).

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/data/dice.ts src/engine/__tests__/DiceCheckResult.test.ts
git commit -m "feat(dice): check types + relative-tier DiceResult assembly"
```

---

## Task 2: The check — `planDiceCheck` + `resolveCheck` (engine, pure)

**Files:**
- Create: `src/engine/dice.ts`
- Test: `src/engine/__tests__/DiceCheck.test.ts`

**Interfaces:**
- Consumes: `buildDiceResult` from `src/data/dice.ts`; `DiceCheckPlan`, `DiceCheckBreakdown`, `Threshold`, `SlotResult`, `DiceResult` from `src/engine/types.ts`.
- Produces:
  - `function planDiceCheck(priorSlots: SlotResult[]): DiceCheckPlan`
  - `function resolveCheck(d20: number, plan: DiceCheckPlan, rng?: () => number): { result: DiceResult; breakdown: DiceCheckBreakdown }`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/DiceCheck.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { planDiceCheck, resolveCheck } from '../dice';
import type { DiceResult, SlotResult } from '../types';

// Minimal d20-shaped slot carrying a given aggregate favorability.
function slot(favorability: number): DiceResult {
  return {
    type: 'd20', result: 10, threshold: 'neutral', interpretation: '', tags: [],
    themes: [], dimensions: { favorability, certainty: 0, volatility: 0 }, modifierRoles: [],
  };
}
const asSlots = (...s: DiceResult[]) => s as SlotResult[];

describe('planDiceCheck — DC', () => {
  it('no priors → baseline DC 11, no bless/bane', () => {
    const p = planDiceCheck([]);
    expect(p.dc).toBe(11);
    expect(p.bless).toBe(0);
    expect(p.bane).toBe(0);
  });

  it('a strongly favorable reading raises the bar (and grants Bless)', () => {
    const p = planDiceCheck(asSlots(slot(2), slot(1.5)));
    expect(p.dc).toBeGreaterThan(11);
    expect(p.bless).toBe(1);
    expect(p.sources.some((s) => s.includes('+1d4'))).toBe(true);
  });

  it('a grim reading lowers the bar (and imposes Bane)', () => {
    const p = planDiceCheck(asSlots(slot(-2), slot(-1.5)));
    expect(p.dc).toBeLessThan(11);
    expect(p.bane).toBe(1);
    expect(p.sources.some((s) => s.includes('−1d4'))).toBe(true);
  });

  it('a mixed reading can grant both a Bless and a Bane', () => {
    const p = planDiceCheck(asSlots(slot(2), slot(-2)));
    expect(p.bless).toBe(1);
    expect(p.bane).toBe(1);
  });

  it('clamps DC to [5, 17]', () => {
    expect(planDiceCheck(asSlots(slot(2), slot(2), slot(2))).dc).toBeLessThanOrEqual(17);
    expect(planDiceCheck(asSlots(slot(-2), slot(-2), slot(-2))).dc).toBeGreaterThanOrEqual(5);
  });
});

describe('resolveCheck — tiers', () => {
  const plan = (dc: number): { dc: number; bless: number; bane: number; sources: string[] } =>
    ({ dc, bless: 0, bane: 0, sources: [] });

  it('meeting the DC is a success (high)', () => {
    expect(resolveCheck(12, plan(12)).breakdown.tier).toBe('high');
  });
  it('beating the DC by 5+ is a strong success (critical-high)', () => {
    expect(resolveCheck(18, plan(12)).breakdown.tier).toBe('critical-high');
  });
  it('a narrow miss is neutral', () => {
    expect(resolveCheck(10, plan(12)).breakdown.tier).toBe('neutral');
  });
  it('missing by 5..9 is a failure (low)', () => {
    expect(resolveCheck(5, plan(12)).breakdown.tier).toBe('low');
  });
  it('missing by 10+ is a grave failure (critical-low)', () => {
    expect(resolveCheck(2, plan(15)).breakdown.tier).toBe('critical-low');
  });
  it('natural 20 is always Triumph, even under a high DC', () => {
    const { breakdown } = resolveCheck(20, plan(17));
    expect(breakdown.critical).toBe('triumph');
    expect(breakdown.tier).toBe('critical-high');
  });
  it('natural 1 is always Fumble, even under a low DC', () => {
    const { breakdown } = resolveCheck(1, plan(5));
    expect(breakdown.critical).toBe('fumble');
    expect(breakdown.tier).toBe('critical-low');
  });
});

describe('resolveCheck — Bless/Bane math', () => {
  // rng returns 0.5 → floor(0.5*4)+1 = 3 per d4.
  const rng = () => 0.5;
  it('adds Bless and subtracts Bane into the total', () => {
    const { breakdown } = resolveCheck(10, { dc: 12, bless: 1, bane: 1, sources: [] }, rng);
    expect(breakdown.bless).toEqual([3]);
    expect(breakdown.bane).toEqual([3]);
    expect(breakdown.total).toBe(10); // 10 + 3 - 3
    expect(breakdown.margin).toBe(-2);
  });
  it('a Bless can lift a miss into a success', () => {
    const { breakdown } = resolveCheck(11, { dc: 13, bless: 1, bane: 0, sources: [] }, rng);
    expect(breakdown.total).toBe(14); // 11 + 3
    expect(breakdown.tier).toBe('high');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DiceCheck.test.ts`
Expected: FAIL — cannot find module `../dice`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/dice.ts`:
```ts
// Pure D&D skill-check logic for the dice minigame. No DOM / three.js / cannon.
// The d20 roll itself (affinity bias) stays in data/dice.ts (rollD20). This file
// turns a natural d20 into a reading-relative outcome.

import type { DiceCheckPlan, DiceCheckBreakdown, DiceResult, SlotResult, Threshold } from './types';
import { buildDiceResult } from '../data/dice';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Difficulty Class + Bless/Bane from the slots already committed this turn.
// "Balance / rising stakes": a favorable reading raises the bar, a grim one lowers it.
export function planDiceCheck(priorSlots: SlotResult[]): DiceCheckPlan {
  const reading = priorSlots.filter((s) => s.type !== 'happening');

  // Magnitude-weighted mean favorability (strong pulls dominate; matches
  // ReadingPlanner.aggregate's weighting). 0 when there are no priors.
  let num = 0;
  let den = 0;
  for (const s of reading) {
    const f = s.dimensions.favorability;
    num += f * Math.abs(f);
    den += Math.abs(f);
  }
  const priorFav = den > 0 ? num / den : 0;
  const dc = clamp(Math.round(11 + 2.5 * priorFav), 5, 17);

  const sources: string[] = [];
  let bless = 0;
  let bane = 0;
  const favored = reading.find((s) => s.dimensions.favorability >= 1.0);
  const adverse = reading.find((s) => s.dimensions.favorability <= -1.0);
  if (favored) { bless = 1; sources.push(`${slotName(favored)} blesses the cast (+1d4)`); }
  if (adverse) { bane = 1; sources.push(`${slotName(adverse)} curses the cast (−1d4)`); }

  return { dc, bless, bane, sources };
}

function slotName(s: SlotResult): string {
  switch (s.type) {
    case 'd20': return `the d20 (${s.result})`;
    case 'happening': return 'the happening';
    default: return s.name;
  }
}

function tierFromMargin(margin: number): Threshold {
  if (margin >= 5) return 'critical-high';
  if (margin >= 0) return 'high';
  if (margin >= -4) return 'neutral';
  if (margin >= -9) return 'low';
  return 'critical-low';
}

// Roll the Bless/Bane d4s, total against the DC, select the relative tier.
// Natural 20 / natural 1 override the DC with Triumph / Fumble.
export function resolveCheck(
  d20: number,
  plan: DiceCheckPlan,
  rng: () => number = Math.random,
): { result: DiceResult; breakdown: DiceCheckBreakdown } {
  const d4 = () => Math.floor(rng() * 4) + 1;
  const bless = Array.from({ length: plan.bless }, d4);
  const bane = Array.from({ length: plan.bane }, d4);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const total = d20 + sum(bless) - sum(bane);
  const margin = total - plan.dc;

  const critical: DiceCheckBreakdown['critical'] =
    d20 === 20 ? 'triumph' : d20 === 1 ? 'fumble' : null;
  const tier: Threshold =
    critical === 'triumph' ? 'critical-high'
    : critical === 'fumble' ? 'critical-low'
    : tierFromMargin(margin);

  const breakdown: DiceCheckBreakdown = { d20, bless, bane, dc: plan.dc, total, margin, tier, critical };
  return { result: buildDiceResult(breakdown), breakdown };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/DiceCheck.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/dice.ts src/engine/__tests__/DiceCheck.test.ts
git commit -m "feat(dice): planDiceCheck (DC + Bless/Bane) and resolveCheck (relative tiers)"
```

---

## Task 3: Wire the check into `GameEngine`

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/DiceRollPlan.test.ts` (append)

**Interfaces:**
- Consumes: `planDiceCheck`, `resolveCheck` from `src/engine/dice.ts`.
- Produces:
  - `planDiceRoll(): { mode: RollMode; offerReroll: boolean; dc: number; bless: number; bane: number; sources: string[]; reports: EffectReport[] }`
  - `resolveDiceCheck(d20: number, plan: DiceCheckPlan): { result: DiceResult; breakdown: DiceCheckBreakdown }`

- [ ] **Step 1: Write the failing test (append to the existing file)**

Add to `src/engine/__tests__/DiceRollPlan.test.ts`:
```ts
import { resolveCheck as _resolveCheck } from '../dice'; // ensures module resolves

describe('planDiceRoll — check context', () => {
  it('returns baseline DC 11 and no bless/bane with no prior slots', () => {
    const e = new GameEngine();
    e.startTurn('self');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.dc).toBe(11);
    expect(plan.bless).toBe(0);
    expect(plan.bane).toBe(0);
    expect(Array.isArray(plan.sources)).toBe(true);
  });
});

describe('resolveDiceCheck', () => {
  it('produces a committed-shaped DiceResult carrying the breakdown', () => {
    const e = new GameEngine();
    const { result, breakdown } = e.resolveDiceCheck(15, { dc: 12, bless: 0, bane: 0, sources: [] });
    expect(result.type).toBe('d20');
    expect(result.result).toBe(15);
    expect(result.check).toEqual(breakdown);
    expect(breakdown.tier).toBe('high');
  });
});
```
(`_resolveCheck` is imported only to assert the module path is valid; if `noUnusedLocals` complains, reference it: add `expect(typeof _resolveCheck).toBe('function');` inside the first new test.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DiceRollPlan.test.ts`
Expected: FAIL — `plan.dc` is undefined / `resolveDiceCheck` is not a function.

- [ ] **Step 3: Implement the engine changes**

In `src/engine/GameEngine.ts`, add the imports near the other engine-pure imports (after the `iching` import block around line 23):
```ts
import { planDiceCheck, resolveCheck } from './dice';
import type { DiceCheckPlan, DiceCheckBreakdown } from './types';
```
(`DiceResult` is already imported in the existing top-of-file type import.)

Replace the existing `planDiceRoll` method (currently:)
```ts
  planDiceRoll(): { mode: RollMode; offerReroll: boolean; reports: EffectReport[] } {
    const { draft, reports } = this.dispatchAt('dice:roll', { rollMods: [], outcome: undefined });
    this.notify();
    return { mode: draft.rollMode ?? 'single', offerReroll: draft.offerReroll ?? false, reports };
  }
```
with:
```ts
  planDiceRoll(): {
    mode: RollMode; offerReroll: boolean;
    dc: number; bless: number; bane: number; sources: string[];
    reports: EffectReport[];
  } {
    const { draft, reports } = this.dispatchAt('dice:roll', { rollMods: [], outcome: undefined });
    // DC + Bless/Bane from the slots already committed this turn (the active dice
    // slot is not appended until completeMinigame, so turnResults == prior slots).
    const check = planDiceCheck(this.state.turnResults);
    this.notify();
    return {
      mode: draft.rollMode ?? 'single',
      offerReroll: draft.offerReroll ?? false,
      dc: check.dc, bless: check.bless, bane: check.bane, sources: check.sources,
      reports,
    };
  }

  // Resolve a thrown d20 against its check plan: rolls the Bless/Bane d4s and
  // returns the committed-shaped result plus the breakdown for the tally UI.
  resolveDiceCheck(d20: number, plan: DiceCheckPlan): { result: DiceResult; breakdown: DiceCheckBreakdown } {
    return resolveCheck(d20, plan);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/DiceRollPlan.test.ts`
Expected: PASS (existing mode tests + the two new blocks).

- [ ] **Step 5: Run the full engine suite (no regressions)**

Run: `npm test`
Expected: PASS. (Existing dice interaction tests still pass — the committed tier is still one of the five thresholds.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/DiceRollPlan.test.ts
git commit -m "feat(dice): expose DC/Bless/Bane on planDiceRoll + resolveDiceCheck"
```

---

## Task 4: Extract `shared3d/dieKit.ts` (refactor; Astral re-verified)

**Files:**
- Create: `src/components/screens/shared3d/dieKit.ts`
- Modify: `src/components/screens/celestial/dice.ts`

**Interfaces:**
- Produces (in `dieKit.ts`):
  - `interface FaceData { center: Vec3; normal: Vec3 }`
  - `interface DieLike { object: THREE.Group; body: CANNON.Body; faceData: FaceData[]; faceNormals: Vec3[]; faceIds: string[]; radius: number }`
  - `function computeFaceData(geo: THREE.BufferGeometry, parallelDot?: number): FaceData[]`
  - `function glyphTexture(glyph: string, color: string): THREE.CanvasTexture`
  - `function addFacePlane(object: THREE.Group, face: FaceData, radius: number, tex: THREE.Texture): void`
  - `function faceIndexOfId(die: { faceIds: string[] }, id: string): number`
  - `function readTopFace(die: DieLike): string`
  - `function snapToFace(die: DieLike, faceIndex: number): void`

**Goal:** move the geometry-agnostic helpers out of `celestial/dice.ts` so both Astral and the new dice die share them. `celestial/dice.ts` keeps its Astral-specific face loaders (`addPlanetFaces`, `addSignFaces`) and `createDie`, importing the moved helpers.

- [ ] **Step 1: Create `dieKit.ts` with the extracted helpers**

Create `src/components/screens/shared3d/dieKit.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { topFaceIndex, type Vec3 } from '../../../engine/astralGeometry';

export interface FaceData { center: Vec3; normal: Vec3 }

export interface DieLike {
  object: THREE.Group;
  body: CANNON.Body;
  faceData: FaceData[];
  faceNormals: Vec3[];
  faceIds: string[];
  radius: number;
}

// Cluster a geometry's triangles into faces by grouping near-parallel triangle
// normals (default dot > 0.95). Returns { center, normal } per face — works for
// any convex die geometry (dodecahedron → 12, icosahedron → 20, tetrahedron → 4).
export function computeFaceData(geo: THREE.BufferGeometry, parallelDot = 0.95): FaceData[] {
  const pos = geo.getAttribute('position');
  const tris: { c: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    tris.push({ c: center, n });
  }
  const faces: { center: Vec3; normal: Vec3; _ns: THREE.Vector3[]; _cs: THREE.Vector3[] }[] = [];
  for (const t of tris) {
    let f = faces.find((g) => new THREE.Vector3(g.normal.x, g.normal.y, g.normal.z).dot(t.n) > parallelDot);
    if (!f) {
      f = { center: { x: 0, y: 0, z: 0 }, normal: { x: t.n.x, y: t.n.y, z: t.n.z }, _ns: [], _cs: [] };
      faces.push(f);
    }
    f._ns.push(t.n); f._cs.push(t.c);
  }
  for (const f of faces) {
    const n = new THREE.Vector3();
    f._ns.forEach((v) => n.add(v));
    n.normalize();
    const cen = new THREE.Vector3();
    f._cs.forEach((v) => cen.add(v));
    cen.multiplyScalar(1 / f._cs.length);
    f.normal = { x: n.x, y: n.y, z: n.z };
    f.center = { x: cen.x, y: cen.y, z: cen.z };
  }
  return faces.map((f) => ({ center: f.center, normal: f.normal }));
}

// Text-presentation glyph (VS-15 forces the symbol form, not the emoji form).
export function glyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = color;
  ctx.font = `${S * 0.62}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${glyph}︎`, S / 2, S / 2 + 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Attach one outward-facing plane carrying `tex` to a die face.
export function addFacePlane(object: THREE.Group, face: FaceData, radius: number, tex: THREE.Texture): void {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 0.9, radius * 0.9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  const c = new THREE.Vector3(face.center.x, face.center.y, face.center.z);
  const n = new THREE.Vector3(face.normal.x, face.normal.y, face.normal.z);
  plane.position.copy(c).addScaledVector(n, 0.01);
  plane.lookAt(c.clone().add(n));
  object.add(plane);
}

export function faceIndexOfId(die: { faceIds: string[] }, id: string): number {
  return Math.max(0, die.faceIds.indexOf(id));
}

export function readTopFace(die: DieLike): string {
  const q = die.body.quaternion;
  const idx = topFaceIndex(die.faceNormals, { x: q.x, y: q.y, z: q.z, w: q.w });
  return die.faceIds[idx];
}

// Orient the die so the given face points exactly up (+Y); zero its velocities.
export function snapToFace(die: DieLike, faceIndex: number): void {
  const n = die.faceNormals[faceIndex];
  const from = new THREE.Vector3(n.x, n.y, n.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(from, up);
  die.body.quaternion.set(q.x, q.y, q.z, q.w);
  die.body.angularVelocity.set(0, 0, 0);
  die.body.velocity.set(0, 0, 0);
  die.object.quaternion.copy(q);
}
```

- [ ] **Step 2: Refactor `celestial/dice.ts` to import the shared helpers**

In `src/components/screens/celestial/dice.ts`:
1. Delete the local definitions of `computeFaceData`, `glyphTexture`, `addFacePlane`, `faceIndexOfId`, `readTopFace`, `snapToFace`, and the local `FaceData`/`Die` interface field list that duplicates `DieLike`.
2. Add the import at the top:
```ts
import {
  computeFaceData, glyphTexture, addFacePlane, faceIndexOfId, readTopFace, snapToFace,
  type FaceData, type DieLike,
} from '../shared3d/dieKit';
```
3. Make the local `Die` interface extend the shared shape and keep its `kind`:
```ts
export interface Die extends DieLike { kind: 'planet' | 'sign' }
```
4. Re-export the helpers the scene imports from here today, so `scene.ts` needs no edit:
```ts
export { faceIndexOfId, readTopFace, snapToFace };
```
5. In `createDie`, replace the old inline `addFacePlane` body usages with the shared one (it now takes `(object, face, radius, tex)`); `iconTexture` stays local (Astral-specific). The `addPlanetFaces`/`addSignFaces` functions keep calling `addFacePlane(die.object, die.faceData[i], die.radius, tex)`.

(`FaceData` is imported because `Die`/`createDie` reference it; if `noUnusedLocals` flags it, it is used by the `faceData: FaceData[]` field inherited via `DieLike` — keep the import only if referenced directly, otherwise drop it.)

- [ ] **Step 3: Verify typecheck + Astral engine tests**

Run: `npm run build`
Expected: PASS.
Run: `npx vitest run src/engine/__tests__/AstralCast.test.ts`
Expected: PASS (engine tests don't touch the 3D code, but confirm nothing in the astral path broke).

- [ ] **Step 4: Manually re-verify Astral renders**

Run: `npm run dev`, open the app, play through to an Astral cast.
Expected: the celestial board + dice still render and settle exactly as before. If glyphs vanished, check the `glyphTexture` VS-15 escape (`︎`) and that `addFacePlane`'s signature change was applied in both `addPlanetFaces` and `addSignFaces`.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/shared3d/dieKit.ts src/components/screens/celestial/dice.ts
git commit -m "refactor(3d): extract geometry-agnostic dieKit shared by astral + dice"
```

---

## Task 5: Dice die module — d20 + d4 (`dice3d/die.ts`)

**Files:**
- Create: `src/components/screens/dice3d/die.ts`

**Interfaces:**
- Consumes: `computeFaceData`, `glyphTexture`, `addFacePlane`, `snapToFace`, `readTopFace`, `faceIndexOfId`, `DieLike` from `shared3d/dieKit`.
- Produces:
  - `interface DiceDie extends DieLike { kind: 'd20' | 'd4'; tint: string }`
  - `function createD20(world: CANNON.World, radius: number): DiceDie` (faces numbered `'1'..'20'`)
  - `function createD4(world: CANNON.World, radius: number, tint: string): DiceDie` (faces numbered `'1'..'4'`)
  - re-exports `snapToFace`, `readTopFace`, `faceIndexOfId`

- [ ] **Step 1: Implement the dice die module**

Create `src/components/screens/dice3d/die.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  computeFaceData, glyphTexture, addFacePlane, snapToFace, readTopFace, faceIndexOfId,
  type DieLike,
} from '../shared3d/dieKit';

export { snapToFace, readTopFace, faceIndexOfId };

export interface DiceDie extends DieLike { kind: 'd20' | 'd4'; tint: string }

const DIE_COLOR = 0x141c33;

// Build a die from a convex geometry whose faces are numbered 1..N.
function buildDie(
  kind: 'd20' | 'd4',
  geo: THREE.BufferGeometry,
  world: CANNON.World,
  radius: number,
  tint: string,
  colliderScale: number,
): DiceDie {
  const object = new THREE.Group();
  const bodyMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: DIE_COLOR, roughness: 0.5, metalness: 0.35 }),
  );
  bodyMesh.castShadow = true;
  object.add(bodyMesh);

  const faceData = computeFaceData(geo);
  const faceIds = faceData.map((_, i) => String(i + 1)); // face index i → number i+1
  faceData.forEach((f, i) => addFacePlane(object, f, radius, glyphTexture(faceIds[i], tint)));

  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(radius * colliderScale) });
  world.addBody(body);

  return { object, body, faceData, faceNormals: faceData.map((f) => f.normal), faceIds, radius, kind, tint };
}

// d20: icosahedron (20 triangular faces). Gold numerals. Sphere collider sized so
// the snapped face sits ~flush (same approach as the astral d12).
export function createD20(world: CANNON.World, radius: number): DiceDie {
  return buildDie('d20', new THREE.IcosahedronGeometry(radius), world, radius, '#d4a854', 0.86);
}

// d4: tetrahedron (4 faces). Tinted gold (Bless) or red (Bane) by the caller.
export function createD4(world: CANNON.World, radius: number, tint: string): DiceDie {
  return buildDie('d4', new THREE.TetrahedronGeometry(radius), world, radius, tint, 0.62);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS. If `computeFaceData` clustering yields ≠20 faces for the icosahedron, that surfaces at runtime in Task 6 (each icosahedron triangle is already its own face, so default `parallelDot` 0.95 keeps them distinct — no clustering). The tetrahedron yields 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/dice3d/die.ts
git commit -m "feat(dice): 3D d20 (icosahedron) + d4 (tetrahedron) dice"
```

---

## Task 6: Dice scene — flick, smash-down, d4 drop (`dice3d/scene.ts`)

**Files:**
- Create: `src/components/screens/dice3d/scene.ts`

**Interfaces:**
- Consumes: `createD20`, `createD4`, `snapToFace`, `readTopFace`, `faceIndexOfId`, `DiceDie`; `castTuning` (`src/engine/astralPhysics.ts`); `BOARD_RADIUS`, `WALL_RADIUS` (`src/engine/astralGeometry.ts`); `RollMode` (`src/engine/types.ts`).
- Produces:
  - `interface FlickVector { vx: number; vz: number; power: number }`
  - `interface DiceSceneController { rollCheck(targets: number[], mode: RollMode, flick?: FlickVector): void; rollModifiers(blessValues: number[], baneValues: number[]): void; dispose(): void }`
  - `function createDiceScene(opts: { canvas: HTMLCanvasElement; affinities: Record<string, number>; onResolved: (keptD20: number) => void; onChoiceReady: (values: [number, number]) => void; onModifiersResolved: () => void }): DiceSceneController`

**Behavior:** builds a bowl (floor + circular wall, reused from the celestial pattern). `rollCheck` throws one die (`single`) or two (`advantage`/`disadvantage`/`choice`), each snapping to its target face on settle. For `advantage`/`disadvantage` it then runs the **smash-down** (kept die lifts, hovers over the loser, drops; loser is ejected) and fires `onResolved(keptValue)`. For `choice` it fires `onChoiceReady([v0, v1])` and waits. For `single` it fires `onResolved(value)`. `rollModifiers` drops the physical Bless/Bane d4s, snaps them to their values, and fires `onModifiersResolved` when they rest.

- [ ] **Step 1: Confirm `WALL_RADIUS` is exported from `astralGeometry.ts`**

Run: `grep -n "WALL_RADIUS" src/engine/astralGeometry.ts`
Expected: a line exporting `WALL_RADIUS` (the celestial scene imports it). If it is NOT exported, add to `src/engine/astralGeometry.ts`:
```ts
export const WALL_RADIUS = BOARD_RADIUS + 0.4;
```
and re-run `npm test` to confirm no astral geometry test broke. (If it is already exported, skip this step.)

- [ ] **Step 2: Implement the scene**

Create `src/components/screens/dice3d/scene.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { RollMode } from '../../../engine/types';
import { castTuning } from '../../../engine/astralPhysics';
import { BOARD_RADIUS, WALL_RADIUS } from '../../../engine/astralGeometry';
import { createD20, createD4, snapToFace, readTopFace, faceIndexOfId, type DiceDie } from './die';

const DIE_R = 0.6;
const D4_R = 0.4;
const SETTLE_FRAMES = 22;
const SAFETY_CAP = 900;
const CAM_TILT = new THREE.Vector3(0, 9.5, 13);
const CAM_TOP = new THREE.Vector3(0, 18, 0.001);

export interface FlickVector { vx: number; vz: number; power: number }

export interface DiceSceneController {
  rollCheck(targets: number[], mode: RollMode, flick?: FlickVector): void;
  rollModifiers(blessValues: number[], baneValues: number[]): void;
  dispose(): void;
}

export function createDiceScene(opts: {
  canvas: HTMLCanvasElement;
  affinities: Record<string, number>;
  onResolved: (keptD20: number) => void;
  onChoiceReady: (values: [number, number]) => void;
  onModifiersResolved: () => void;
}): DiceSceneController {
  const { canvas, affinities, onResolved, onChoiceReady, onModifiersResolved } = opts;
  const tuning = castTuning(affinities);

  // ── Renderer / scene / camera ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const size = () => Math.min(canvas.clientWidth || 420, 480);
  renderer.setSize(size(), size(), false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.copy(CAM_TILT);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x6b7fb0, 0.7));
  const key = new THREE.DirectionalLight(0xffe6b0, 1.15);
  key.position.set(4, 12, 6);
  key.castShadow = true;
  scene.add(key);

  // ── Bowl: floor + circular wall (24-gon of inward planes), reused pattern ──
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  const floorMat = new CANNON.Material('floor');
  const dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, {
    restitution: tuning.restitution, friction: 0.35,
  }));
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMat });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMat });
    wall.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(-Math.cos(a), 0, -Math.sin(a)));
    wall.position.set(Math.cos(a) * WALL_RADIUS, 0, Math.sin(a) * WALL_RADIUS);
    world.addBody(wall);
  }

  // Visual bowl disc.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b0f1c, roughness: 0.9, metalness: 0.1 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  scene.add(disc);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_RADIUS, 0.12, 16, 80),
    new THREE.MeshStandardMaterial({ color: 0xd4a854, roughness: 0.4, metalness: 0.8 }),
  );
  rim.rotation.x = -Math.PI / 2;
  scene.add(rim);

  // ── Dice ──
  const d20a = mkDie(createD20(world, DIE_R));
  const d20b = mkDie(createD20(world, DIE_R));
  const blessDice: DiceDie[] = [];
  const baneDice: DiceDie[] = [];

  function mkDie(d: DiceDie): DiceDie {
    d.body.material = dieMat;
    d.body.linearDamping = tuning.linearDamping;
    d.body.angularDamping = tuning.angularDamping;
    scene.add(d.object);
    return d;
  }
  const parkY = -10;
  const park = (d: DiceDie) => { d.body.position.set(0, parkY, 0); d.body.velocity.set(0, 0, 0); d.object.visible = false; };
  [d20a, d20b].forEach(park);

  // ── State machine ──
  type Phase = 'idle' | 'rolling' | 'smashing' | 'mods-rolling' | 'done';
  let phase: Phase = 'idle';
  let raf = 0, still = 0, ticks = 0;
  let mode: RollMode = 'single';
  let targets: number[] = [];
  let active: DiceDie[] = [];        // the d20(s) in play this throw
  let kept: DiceDie | null = null;
  let smashT = 0; const smashFrom = new THREE.Vector3(); const smashOver = new THREE.Vector3();

  const syncMesh = (d: DiceDie) => {
    d.object.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
    const q = d.body.quaternion;
    d.object.quaternion.set(q.x, q.y, q.z, q.w);
  };

  const throwDie = (d: DiceDie, dx: number, flick?: FlickVector) => {
    d.object.visible = true;
    d.body.position.set(dx, 6 + Math.random() * 1.2, BOARD_RADIUS * 0.45);
    const s = tuning.scatter;
    const fx = flick ? flick.vx * (1 + flick.power) : (Math.random() - 0.5) * 3 * s;
    const fz = flick ? -2 - flick.power * 4 : -3 - Math.random() * 2 * s;
    d.body.velocity.set(fx, -2 - Math.random() * 2, fz);
    d.body.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    d.body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  };

  const energy = (ds: DiceDie[]) =>
    ds.reduce((e, d) => e + d.body.velocity.length() + d.body.angularVelocity.length(), 0);

  // Snap each active d20 to its target face, then pick the kept die per mode.
  const settleThrow = () => {
    active.forEach((d, i) => snapToFace(d, faceIndexOfId(d, String(targets[i]))));
    active.forEach(syncMesh);

    if (mode === 'single') {
      kept = active[0];
      phase = 'done';
      onResolved(targets[0]);
      return;
    }
    if (mode === 'choice') {
      phase = 'done';
      onChoiceReady([targets[0], targets[1]]);
      return;
    }
    // advantage / disadvantage: choose kept, begin the smash.
    const keepFirst = mode === 'advantage' ? targets[0] >= targets[1] : targets[0] <= targets[1];
    kept = keepFirst ? active[0] : active[1];
    const loser = keepFirst ? active[1] : active[0];
    smashOver.set(loser.body.position.x, DIE_R, loser.body.position.z);
    smashFrom.copy(kept.object.position);
    smashT = 0;
    kept.body.type = CANNON.Body.KINEMATIC;
    kept.body.velocity.set(0, 0, 0);
    kept.body.angularVelocity.set(0, 0, 0);
    (kept as DiceDie & { _loser?: DiceDie })._loser = loser;
    phase = 'smashing';
  };

  // Kinematic lift → hover over loser → smash down; eject the loser on impact.
  const stepSmash = () => {
    if (!kept) return;
    smashT += 1 / 38; // ~0.6s arc
    const t = Math.min(1, smashT);
    const loser = (kept as DiceDie & { _loser?: DiceDie })._loser!;
    // up-and-over for the first 60%, slam down for the last 40%.
    const apex = new THREE.Vector3(smashOver.x, DIE_R + 3, smashOver.z);
    if (t < 0.6) {
      const u = t / 0.6;
      kept.body.position.set(
        smashFrom.x + (apex.x - smashFrom.x) * u,
        smashFrom.y + (apex.y - smashFrom.y) * u,
        smashFrom.z + (apex.z - smashFrom.z) * u,
      );
    } else {
      const u = (t - 0.6) / 0.4;
      kept.body.position.set(apex.x, apex.y + (DIE_R - apex.y) * u, apex.z);
      if (u >= 1 && loser.body.type !== CANNON.Body.KINEMATIC) {
        // Impact: eject the loser outward + up, then it sinks away.
        const dir = new THREE.Vector3(loser.body.position.x, 0, loser.body.position.z).normalize();
        loser.body.velocity.set(dir.x * 7 + 2, 6, dir.z * 7 + 2);
        loser.body.angularVelocity.set(8, 8, 8);
      }
    }
    syncMesh(kept); syncMesh(loser);
    if (t >= 1) {
      kept.body.type = CANNON.Body.DYNAMIC;
      kept.body.position.set(0, DIE_R, 0);
      kept.body.velocity.set(0, 0, 0);
      snapToFace(kept, faceIndexOfId(kept, String(readTopFaceValue(kept))));
      syncMesh(kept);
      loser.object.visible = false;
      const keptValue = readTopFaceValue(kept);
      phase = 'done';
      onResolved(keptValue);
    }
  };

  const readTopFaceValue = (d: DiceDie) => Number(readTopFace(d));

  // Drop the physical Bless/Bane d4s in to their values.
  const startModifiers = (blessValues: number[], baneValues: number[]) => {
    const make = (vals: number[], tint: string, arr: DiceDie[], sideSign: number) => {
      vals.forEach((v, i) => {
        const d = mkDie(createD4(world, D4_R, tint));
        arr.push(d);
        d.object.visible = true;
        d.body.position.set(sideSign * (1.2 + i * 0.6), 5 + i, BOARD_RADIUS * 0.3);
        d.body.velocity.set(sideSign * -1, -3, -2);
        d.body.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        // stash the intended value on the die for the settle snap.
        (d as DiceDie & { _val?: number })._val = v;
      });
    };
    make(blessValues, '#d4a854', blessDice, -1);
    make(baneValues, '#c0392b', baneDice, 1);
    still = 0; ticks = 0;
    phase = 'mods-rolling';
  };

  const settleModifiers = () => {
    [...blessDice, ...baneDice].forEach((d) => {
      const v = (d as DiceDie & { _val?: number })._val ?? 1;
      snapToFace(d, faceIndexOfId(d, String(v)));
      syncMesh(d);
    });
    phase = 'done';
    onModifiersResolved();
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (phase === 'rolling') {
      ticks++;
      world.fixedStep();
      active.forEach(syncMesh);
      still = energy(active) < 0.4 ? still + 1 : 0;
      const t = Math.min(1, ticks / 80);
      camera.position.lerpVectors(CAM_TILT, CAM_TOP, t * t);
      camera.lookAt(0, 0, 0);
      if (still > SETTLE_FRAMES || ticks >= SAFETY_CAP) settleThrow();
    } else if (phase === 'smashing') {
      world.fixedStep();
      stepSmash();
    } else if (phase === 'mods-rolling') {
      ticks++;
      world.fixedStep();
      [...blessDice, ...baneDice].forEach(syncMesh);
      still = energy([...blessDice, ...baneDice]) < 0.4 ? still + 1 : 0;
      if (still > SETTLE_FRAMES || ticks >= SAFETY_CAP) settleModifiers();
    } else {
      camera.position.lerp(CAM_TOP, 0.08);
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const onResize = () => { const s = size(); renderer.setSize(s, s, false); };
  window.addEventListener('resize', onResize);

  return {
    rollCheck(t: number[], m: RollMode, flick?: FlickVector) {
      mode = m; targets = t;
      active = m === 'single' ? [d20a] : [d20a, d20b];
      kept = null; still = 0; ticks = 0;
      active.forEach((d, i) => throwDie(d, (i === 0 ? -1 : 1) * DIE_R * 1.6, flick));
      phase = 'rolling';
    },
    rollModifiers(blessValues: number[], baneValues: number[]) {
      if (blessValues.length === 0 && baneValues.length === 0) { onModifiersResolved(); return; }
      startModifiers(blessValues, baneValues);
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (material) {
          const mats = Array.isArray(material) ? material : [material];
          for (const mm of mats) {
            const map = (mm as THREE.MeshStandardMaterial).map;
            if (map) map.dispose();
            mm.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run build`
Expected: PASS. Likely fixups: `CANNON.Body.KINEMATIC`/`DYNAMIC` are numeric body-type constants (exist in cannon-es); if `_loser`/`_val` stash typing trips `strict`, the `& { _x?: T }` casts shown handle it. Remove the `void firedResolved; void firedMods;` line if `noUnusedLocals` is satisfied without it (they are read inside the throw flow — keep only if the compiler flags them).

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/dice3d/scene.ts
git commit -m "feat(dice): 3D dice scene — flick throw, adv/dis smash-down, d4 drop"
```

---

## Task 7: `DiceCast.tsx` — React wrapper + fallback

**Files:**
- Create: `src/components/screens/dice3d/DiceCast.tsx`

**Interfaces:**
- Consumes: `createDiceScene`, `DiceSceneController`, `FlickVector`.
- Produces:
  - `interface DiceCastHandle { rollCheck(targets: number[], mode: RollMode, flick?: FlickVector): void; rollModifiers(blessValues: number[], baneValues: number[]): void }`
  - default export `DiceCast` (forwardRef) with props `{ affinities: Record<string, number>; idle: boolean; onFlick: (flick: FlickVector) => void; onResolved: (keptD20: number) => void; onChoiceReady: (values: [number, number]) => void; onModifiersResolved: () => void }`
  - named exports `function canUse3D(): boolean`, `type FlickVector`

The **flick gesture** is captured here: while `idle`, a pointer press-drag-release on the canvas becomes a `FlickVector` and is reported via `onFlick` (the parent then throws with it). This is the signature interaction — not a tap.

- [ ] **Step 1: Implement the wrapper**

Create `src/components/screens/dice3d/DiceCast.tsx`:
```tsx
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { RollMode } from '../../../engine/types';
import { createDiceScene, type DiceSceneController, type FlickVector } from './scene';

export type { FlickVector };

export interface DiceCastHandle {
  rollCheck(targets: number[], mode: RollMode, flick?: FlickVector): void;
  rollModifiers(blessValues: number[], baneValues: number[]): void;
}

interface Props {
  affinities: Record<string, number>;
  idle: boolean;                              // capture flick only while idle
  onFlick: (flick: FlickVector) => void;      // press-drag-release on the canvas
  onResolved: (keptD20: number) => void;
  onChoiceReady: (values: [number, number]) => void;
  onModifiersResolved: () => void;
}

export function canUse3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const DiceCast = forwardRef<DiceCastHandle, Props>(function DiceCast(
  { affinities, idle, onFlick, onResolved, onChoiceReady, onModifiersResolved },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<DiceSceneController | null>(null);
  const drag = useRef<{ x: number; y: number; t: number } | null>(null);
  const cbs = useRef({ onResolved, onChoiceReady, onModifiersResolved, onFlick, idle });
  cbs.current = { onResolved, onChoiceReady, onModifiersResolved, onFlick, idle };

  useEffect(() => {
    if (!canvasRef.current) return;
    sceneRef.current = createDiceScene({
      canvas: canvasRef.current,
      affinities,
      onResolved: (v) => cbs.current.onResolved(v),
      onChoiceReady: (v) => cbs.current.onChoiceReady(v),
      onModifiersResolved: () => cbs.current.onModifiersResolved(),
    });
    return () => { sceneRef.current?.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    rollCheck: (targets, mode, flick) => sceneRef.current?.rollCheck(targets, mode, flick),
    rollModifiers: (bless, bane) => sceneRef.current?.rollModifiers(bless, bane),
  }), []);

  // ── Flick gesture: press → drag back → release maps to a throw vector. ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!cbs.current.idle) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!cbs.current.idle || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    const dt = Math.max(16, performance.now() - drag.current.t);
    const power = Math.min(1, Math.hypot(dx, dy) / 200);
    // Screen drag → bowl plane. Pulling DOWN on screen (dy>0) throws AWAY (−z).
    const flick: FlickVector = { vx: (dx / dt) * 8, vz: (dy / dt) * 8, power: Math.max(0.15, power) };
    drag.current = null;
    cbs.current.onFlick(flick);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ width: 420, height: 420, maxWidth: '100%', touchAction: 'none', cursor: idle ? 'grab' : 'default' }}
    />
  );
});

export default DiceCast;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/dice3d/DiceCast.tsx
git commit -m "feat(dice): DiceCast forwardRef wrapper + canUse3D guard"
```

---

## Task 8: `DiceTally.tsx` — BG3 tally + projectile motes

**Files:**
- Create: `src/components/screens/dice3d/DiceTally.tsx`

**Interfaces:**
- Consumes: `DiceCheckBreakdown` from `src/engine/types.ts`.
- Produces: default export `DiceTally` with props `{ dc: number; breakdown: DiceCheckBreakdown | null; veiled: boolean; onDone: () => void }`.

**Behavior:** shows `DC {dc}` (or `DC ?` when veiled) and a running total. When `breakdown` arrives, it animates the total from the d20 value, then ticks each Bless (`+n`, gold) and Bane (`−n`, red) with a color flash, lands on `total`, flashes success (total ≥ dc) or failure, then calls `onDone`. (This first pass conveys each contribution with a count-up + color flash; layering literal projectile *motes* flying from each die's projected screen position is an optional polish on top — see Notes.)

- [ ] **Step 1: Implement the tally**

Create `src/components/screens/dice3d/DiceTally.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DiceCheckBreakdown } from '../../../engine/types';

interface Props {
  dc: number;
  breakdown: DiceCheckBreakdown | null;
  veiled: boolean;
  onDone: () => void;
}

interface Step { value: number; delta: number | null; color: string }

// Build the running-total steps: start at the d20, then each bless (+) and bane (-).
function buildSteps(b: DiceCheckBreakdown): Step[] {
  const steps: Step[] = [{ value: b.d20, delta: null, color: '#c8d8f0' }];
  let acc = b.d20;
  for (const n of b.bless) { acc += n; steps.push({ value: acc, delta: n, color: '#d4a854' }); }
  for (const n of b.bane) { acc -= n; steps.push({ value: acc, delta: -n, color: '#c0392b' }); }
  return steps;
}

export default function DiceTally({ dc, breakdown, veiled, onDone }: Props) {
  const [shown, setShown] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!breakdown) return;
    doneRef.current = false;
    const steps = buildSteps(breakdown);
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((s, i) => {
      timers.push(setTimeout(() => {
        setShown(s.value);
        if (s.delta) setFlash(s.color);
      }, 500 + i * 650));
    });
    // Final verdict.
    timers.push(setTimeout(() => {
      const success = breakdown.critical === 'triumph'
        || (breakdown.critical !== 'fumble' && breakdown.total >= dc);
      setFlash(success ? '#5b8c5a' : '#c0392b');
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, 500 + steps.length * 650 + 400));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, dc]);

  return (
    <div style={wrapStyle}>
      <div style={dcStyle}>DC {veiled ? '?' : dc}</div>
      <motion.div
        key={shown ?? 'idle'}
        style={{ ...totalStyle, color: flash ?? '#c8d8f0' }}
        initial={{ scale: 0.7, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      >
        {shown ?? '—'}
      </motion.div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
};
const dcStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.7rem',
  letterSpacing: '0.18em', color: '#7b9ec7', textTransform: 'uppercase',
};
const totalStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '3rem', lineHeight: 1,
  transition: 'color 0.3s ease',
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/dice3d/DiceTally.tsx
git commit -m "feat(dice): BG3-style DiceTally (running total vs DC marker)"
```

---

## Task 9: Repurpose `DiceThrowAnimation.tsx` as the 2D fallback

**Files:**
- Modify: `src/components/screens/DiceThrowAnimation.tsx`

**Interfaces:**
- Produces: keeps `export const THRESHOLD_COLORS`; default export gains a `dc?` prop and an optional `total?` so the fallback can show the value vs DC without 3D. Existing `{ value, threshold }` props unchanged.

- [ ] **Step 1: Add the DC line to the count-up reveal**

In `src/components/screens/DiceThrowAnimation.tsx`, change the `Props` interface and the render to optionally show the DC/total. Replace the `interface Props` block:
```ts
interface Props {
  value: number; // final die value, 1-20
  threshold: string; // for number color
}
```
with:
```ts
interface Props {
  value: number;      // final die value, 1-20
  threshold: string;  // for number color
  dc?: number;        // when present, shown beneath the die (fallback path)
  total?: number;     // d20 ± bless/bane, when present
}
```
Then in the component signature add `dc, total` and render a small line after the number `<span>`:
```tsx
export default function DiceThrowAnimation({ value, threshold, dc, total }: Props) {
```
Inside the returned `<motion.div>`, after the number `<span>`, add:
```tsx
      {dc !== undefined && (
        <span style={dcLineStyle}>
          {total ?? value} vs DC {dc}
        </span>
      )}
```
And add the style:
```ts
const dcLineStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', letterSpacing: '0.12em',
  color: '#7b9ec7', marginTop: '0.4rem', display: 'block', textAlign: 'center',
};
```
(Adjust the wrapping element to `flexDirection: 'column'` if needed so the line sits below the number.)

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS (the new props are optional; the existing pair-die usage in the rewritten `DiceMinigame` will pass them only on the fallback path).

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/DiceThrowAnimation.tsx
git commit -m "feat(dice): 2D fallback reveal shows total vs DC"
```

---

## Task 10: Rewrite `DiceMinigame.tsx` — phase machine

**Files:**
- Modify: `src/components/screens/DiceMinigame.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useGameEngine`; `rollD20` (`src/data/dice.ts`); `DiceCast` + `canUse3D` + `DiceCastHandle`; `DiceTally`; `DiceThrowAnimation` (fallback); engine `planDiceRoll`, `rollDicePair`, `resolveDiceCheck`, `resolveReroll`, `completeMinigame`.

**Flow:** `idle` → flick → `rollCheck(targets, mode)` → (`smash` for adv/dis is internal to the scene) → `onResolved(keptValue)` → `resolveDiceCheck(keptValue, plan)` → `rollModifiers(bless, bane)` → `onModifiersResolved` → DiceTally animates → `reading` (badge + interpretation) → agency (`choice`/`reroll`/auto) → `completeMinigame`. The `choice` branch pauses after `onChoiceReady` for the player to tap a value.

- [ ] **Step 1: Write the rewrite**

Replace the entire contents of `src/components/screens/DiceMinigame.tsx` with:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import DiceCast, { canUse3D, type DiceCastHandle, type FlickVector } from './dice3d/DiceCast';
import DiceTally from './dice3d/DiceTally';
import DiceThrowAnimation, { THRESHOLD_COLORS } from './DiceThrowAnimation';
import type { DiceResult, DiceCheckPlan, DiceCheckBreakdown, MinigameMeta, RollMode } from '../../engine/types';

type Phase = 'idle' | 'throwing' | 'choice' | 'tally' | 'reading' | 'done';
type Plan = DiceCheckPlan & { mode: RollMode; offerReroll: boolean };

const REVEAL_DELAY_MS = 1200;

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const use3D = useRef(canUse3D()).current;
  const castRef = useRef<DiceCastHandle | null>(null);
  const committedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [choiceValues, setChoiceValues] = useState<[number, number] | null>(null);
  const [breakdown, setBreakdown] = useState<DiceCheckBreakdown | null>(null);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [chose, setChose] = useState(false);

  const veiled = state.affinityEffects.poolPreview === 'hidden';

  const commit = useCallback((r: DiceResult, meta: MinigameMeta) => {
    if (committedRef.current) return;
    committedRef.current = true;
    engine.completeMinigame(r, meta);
  }, [engine]);

  // After the d20 is resolved, run the check + drop the modifier d4s.
  const resolveAndTally = useCallback((keptD20: number, p: DiceCheckPlan) => {
    const { result: r, breakdown: b } = engine.resolveDiceCheck(keptD20, p);
    setResult(r);
    setBreakdown(b);
    setPhase('tally');
    if (use3D) castRef.current?.rollModifiers(b.bless, b.bane);
  }, [engine, use3D]);

  const onResolved = useCallback((keptD20: number) => {
    if (!plan) return;
    resolveAndTally(keptD20, plan);
  }, [plan, resolveAndTally]);

  const onChoiceReady = useCallback((values: [number, number]) => {
    setChoiceValues(values);
    setPhase('choice');
  }, []);

  // For 3D, modifiers settle then DiceTally plays; for the fallback we skip straight in.
  const onModifiersResolved = useCallback(() => {/* DiceTally drives its own timing */}, []);

  // Invoked by the canvas flick (3D) or the tap button (fallback). `flick` is
  // undefined on the fallback path; the scene randomizes the throw then.
  const handleThrow = useCallback((flick?: FlickVector) => {
    if (phase !== 'idle') return;
    const p = engine.planDiceRoll();
    const checkPlan: DiceCheckPlan = { dc: p.dc, bless: p.bless, bane: p.bane, sources: p.sources };
    setPlan({ ...checkPlan, mode: p.mode, offerReroll: p.offerReroll });
    setPhase('throwing');

    if (p.mode === 'single') {
      const value = rollD20(state.affinities).result;
      if (use3D) castRef.current?.rollCheck([value], 'single', flick);
      else { resolveAndTally(value, checkPlan); }
    } else {
      const { dice } = engine.rollDicePair(p.mode);
      const targets = [dice[0].result, dice[1].result];
      if (use3D) castRef.current?.rollCheck(targets, p.mode, flick);
      else if (p.mode === 'choice') onChoiceReady([targets[0], targets[1]]);
      else {
        const keep = p.mode === 'advantage' ? Math.max(targets[0], targets[1]) : Math.min(targets[0], targets[1]);
        resolveAndTally(keep, checkPlan);
      }
    }
  }, [phase, engine, state.affinities, use3D, resolveAndTally, onChoiceReady]);

  const handlePick = useCallback((index: 0 | 1) => {
    if (!choiceValues || !plan) return;
    setChose(true);
    resolveAndTally(choiceValues[index], plan);
  }, [choiceValues, plan, resolveAndTally]);

  // Tally finished → show the reading, then auto-commit unless a reroll is offered.
  const onTallyDone = useCallback(() => setPhase('reading'), []);

  useEffect(() => {
    if (phase !== 'reading' || !result || !plan) return;
    if (plan.offerReroll && !chose) return; // wait for keep/reroll
    const meta: MinigameMeta = chose ? { viaReroll: true } : { revealedAsDrawn: true };
    const t = setTimeout(() => { commit(result, meta); setPhase('done'); }, REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, result, plan, chose, commit]);

  const handleKeep = useCallback(() => {
    if (result) { setChose(true); commit(result, { revealedAsDrawn: true }); setPhase('done'); }
  }, [result, commit]);

  const handleReroll = useCallback(() => {
    if (!result || !plan) return;
    setChose(true);
    const { result: fresh } = engine.resolveReroll(result); // Fool's reroll may apply
    const keptValue = fresh.result;
    setPhase('throwing');
    // Re-throw a single die; for 3D the scene's onResolved drives the single
    // resolveAndTally. For the fallback, resolve directly (no scene).
    if (use3D) castRef.current?.rollCheck([keptValue], 'single');
    else resolveAndTally(keptValue, plan);
  }, [result, plan, engine, use3D, resolveAndTally]);

  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const display: DiceResult | null =
    (committedSlot && committedSlot.type === 'd20' ? committedSlot : null) ?? result;

  const modeLabel =
    plan?.mode === 'advantage' ? 'Advantage — the higher die holds'
    : plan?.mode === 'disadvantage' ? 'Disadvantage — the lower die holds'
    : plan?.mode === 'choice' ? 'Keep one — your will decides'
    : null;

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>{phase === 'idle' ? 'Cast the die' : phase === 'done' ? 'The die is cast' : 'The check'}</h1>
        {modeLabel && phase !== 'idle' && <p style={interpStyle}>{modeLabel}</p>}
        {plan && plan.sources.length > 0 && phase !== 'idle' && (
          <p style={sourceStyle}>{plan.sources.join(' · ')}</p>
        )}

        {/* 3D board (or fallback reveal) */}
        {use3D ? (
          <div style={{ position: 'relative' }}>
            <DiceCast
              ref={castRef}
              affinities={state.affinities}
              idle={phase === 'idle'}
              onFlick={handleThrow}
              onResolved={onResolved}
              onChoiceReady={onChoiceReady}
              onModifiersResolved={onModifiersResolved}
            />
            {/* Non-interactive hint — the flick is captured on the canvas itself. */}
            {phase === 'idle' && (
              <div style={flickHintStyle}>
                <span style={{ fontSize: '1.6rem' }}>{String.fromCodePoint(0x2685)}</span>
                <span style={tapHintStyle}>Drag back &amp; release to flick</span>
              </div>
            )}
          </div>
        ) : (
          phase === 'idle' ? (
            <motion.button style={throwBtnStyle} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={() => handleThrow()}>
              <span style={{ fontSize: '2rem' }}>{String.fromCodePoint(0x2685)}</span>
              <span style={tapHintStyle}>Tap to throw</span>
            </motion.button>
          ) : display && (
            <DiceThrowAnimation
              key={display.result}
              value={display.result}
              threshold={display.threshold}
              dc={breakdown?.dc}
              total={breakdown?.total}
            />
          )
        )}

        {/* Choice: tap a value (Will) */}
        {phase === 'choice' && choiceValues && (
          <div style={choiceRowStyle}>
            {choiceValues.map((v, i) => (
              <motion.button key={i} style={choiceBtnStyle} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} onClick={() => handlePick(i as 0 | 1)}>
                {v}
              </motion.button>
            ))}
          </div>
        )}

        {/* BG3 tally */}
        {(phase === 'tally' || phase === 'reading') && plan && (
          <DiceTally dc={plan.dc} breakdown={breakdown} veiled={veiled} onDone={onTallyDone} />
        )}

        {/* Reading */}
        {phase === 'reading' && display && (
          <motion.div style={readingStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {veiled && !committedRef.current ? (
              <p style={interpStyle}>The die rests, its meaning shrouded…</p>
            ) : (
              <>
                <span style={{ ...badgeStyle, color: THRESHOLD_COLORS[display.threshold], borderColor: THRESHOLD_COLORS[display.threshold] }}>
                  {(display.check?.critical ?? display.threshold.replace(/-/g, ' ')).toUpperCase()}
                </span>
                <p style={interpStyle}>{display.interpretation}</p>
              </>
            )}
            {plan?.offerReroll && !chose && (
              <div style={rerollRowStyle}>
                <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleReroll}>↺ Reroll?</motion.button>
                <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleKeep}>Keep it</motion.button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = { width: '100%', maxWidth: '560px', padding: '2rem' };
const contentStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' };
const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};
const throwBtnStyle: React.CSSProperties = {
  width: 130, height: 130,
  background: 'rgba(13,18,32,0.72)', border: '2px solid #c75b4a', borderRadius: '14px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.4rem', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', color: '#c8d8f0',
};
// 3D idle overlay hint — non-interactive so the canvas underneath receives the flick.
const flickHintStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, margin: 'auto', width: 200, height: 80,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.4rem', color: '#c8d8f0', pointerEvents: 'none',
};
const tapHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.6rem', color: '#5b7290', letterSpacing: '0.1em',
};
const sourceStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', color: '#7b9ec7', letterSpacing: '0.06em', textAlign: 'center', margin: 0,
};
const choiceRowStyle: React.CSSProperties = { display: 'flex', gap: '1.25rem' };
const choiceBtnStyle: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '12px', background: '#0d1220', border: '2px solid #1a2440',
  color: '#c8d8f0', fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.8rem', cursor: 'pointer', outline: 'none',
};
const readingStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' };
const badgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem', border: '1px solid', borderRadius: '3px',
};
const interpStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7', fontStyle: 'italic', textAlign: 'center', margin: 0, maxWidth: '320px',
};
const rerollRowStyle: React.CSSProperties = { display: 'flex', gap: '0.6rem', marginTop: '0.25rem' };
const rerollBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440', padding: '0.45rem 1.1rem', borderRadius: '4px',
  cursor: 'pointer', outline: 'none',
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS. Common fixups: the `plan` state type — if the inline `ReturnType<typeof engine.planDiceRoll>['mode']` is awkward under `strict`, replace it with `import type { RollMode }` and type `mode: RollMode`. Ensure `DiceCheckPlan`/`DiceCheckBreakdown` are exported from `types.ts` (Task 1).

- [ ] **Step 3: Manual verification — play the dice minigame**

Run: `npm run dev`. Start a reading, reach the dice method, and verify:
1. **Single:** flick → the d20 tumbles in the bowl, settles, the tally springs to the value vs the DC, the reading badge + interpretation show, then it commits.
2. **DC from priors:** play dice as the 2nd/3rd method after a strongly favorable vs grim earlier slot — confirm the DC marker differs (higher after good readings).
3. **Bless/Bane:** when `sources` shows a blessing/curse, a gold/red d4 tumbles in after the d20 and the tally ticks `+n`/`−n`.
4. **Advantage/Disadvantage:** in the debug panel (documented in `README.md`), force the existing dice roll-mode responder `light-advantage` (advantage) or `shadow-disadvantage` (disadvantage) — two d20s land, the kept one lifts, hovers, and smashes the other out of the bowl.
5. **Choice:** force `will-choice` the same way — two values appear; tapping one resolves the check.
6. **Criticals:** to verify the Triumph/Fumble choreography deterministically, temporarily edit `rollD20` in `src/data/dice.ts` to `let roll = 20;` (then `1`), play a single throw, confirm the special badge + natural-20/natural-1 interpretation, then **revert the edit** before committing.
7. **Fallback:** toggle OS "reduce motion" (so `canUse3D()` returns false) and reload; confirm the 2D count-up reveal with the `vs DC` line still resolves and commits.

Tune physics constants (`DIE_R`, throw velocity, `SETTLE_FRAMES`, smash timing) in `dice3d/scene.ts` until the throw and smash feel right. Re-run `npm run build` after tuning.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/DiceMinigame.tsx
git commit -m "feat(dice): rewrite minigame as 3D skill-check (flick, smash, tally)"
```

---

## Task 11: Documentation sync

**Files:**
- Modify: `docs/game-systems.md`
- Modify: `README.md`

- [ ] **Step 1: Rewrite the dice subsystem in `docs/game-systems.md`**

Locate the dice/d20 section (search for `d20` / `threshold`). Replace its description with the skill-check model. Include, in prose matching the surrounding style:
- The check loop: flick the d20 → resolve vs a Difficulty Class → Bless/Bane d4s → relative tiers.
- **DC formula:** `clamp(round(11 + 2.5 * priorFav), 5, 17)`, where `priorFav` is the magnitude-weighted mean favorability of the slots already committed this turn; baseline 11 with no priors; "balance / rising stakes" (favorable readings raise the bar).
- **Bless/Bane:** a prior slot with favorability ≥ +1.0 grants +1d4; ≤ −1.0 imposes −1d4.
- **Relative tiers** table (margin = total − DC): `≥ +5` critical-high; `0…+4` high; `−1…−4` neutral; `−5…−9` low; `≤ −10` critical-low.
- **Criticals:** natural 20 → Triumph (critical-high), natural 1 → Fumble (critical-low), overriding the DC; they emit `triumph`/`fumble` tags.
- **Compatibility note:** the committed tier is still one of the five thresholds and still emits `low`/`high`/`neutral`, so existing dice meta-interactions fire as before — now relative to the DC.
- The modes (advantage/disadvantage/choice/reroll) and their affinity gating are unchanged.

- [ ] **Step 2: Update `README.md`**

In the gameplay/method section that describes the d20, replace the old "roll a d20 against fixed thresholds" blurb with the player-facing skill-check description: flick a 3D d20 into the bowl; the rest of your reading sets a Difficulty Class; favorable/grim earlier readings grant Bless/Bane d4s; natural 20 and natural 1 are Triumph and Fumble. Note advantage/disadvantage now show the physical smash-down.

- [ ] **Step 3: Verify the engine suite + build are still green**

Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs: dice skill-check minigame (DC, Bless/Bane, criticals, smash-down)"
```

---

## Notes for the implementer

- **Runnable from a cold start.** This plan assumes no context from the design conversation. Every task lists exact paths, full code, and exact commands. Tasks 1–3 are verified with `npx vitest run <file>` / `npm test`; Tasks 4–10 with `npm run build` + manual `npm run dev`; Task 11 with `npm test` + `npm run build`. Read the spec at `docs/superpowers/specs/2026-06-27-dice-skill-check-minigame-design.md` for the *why*, but you do not need it to execute the tasks.
- **Order matters:** Tasks 1–3 (engine, TDD) are independent of the 3D work and fully testable — land them first. Task 4 (the `dieKit` extraction) touches the working Astral scene; re-verify Astral before moving on. Tasks 5–10 build the UI bottom-up. Task 11 documents the shipped behavior.
- **Physics is tuned, not derived.** The constants in `dice3d/scene.ts` (throw velocity, damping via `castTuning`, `SETTLE_FRAMES`, smash arc timing) are first-pass values. Expect to adjust them at the dev server. The *outcome* never depends on physics — dice snap to engine-chosen faces.
- **The check is the source of truth.** The 3D scene is pure presentation: it shows the natural d20(s) and d4(s) the engine already decided. If the scene and the committed result ever disagree, the bug is in the wiring (which value is passed to `resolveDiceCheck`), not the physics.
- **Choice & criticals in 3D.** Choice is resolved via 2D value buttons (no 3D raycasting), mirroring how Astral handles choice. Criticals are computed in `resolveCheck` from the natural d20; verify them with the temporary-`rollD20` edit in Task 10 Step 3.
- **No new DEBUG_SCENARIOS.** The original spec listed forced debug scenarios for Triumph/Fumble/DC. Those stage forced *responders*, but the DC and criticals are computed in the engine/component, not by responders, so they can't be staged that way. Modes still use the existing dice responders (`light-advantage`/`shadow-disadvantage`/`will-choice`); DC/criticals are verified per Task 10 Step 3.
- **Known polish follow-ups (out of scope for this plan):** (a) sync each `DiceTally` Bless/Bane tick to the physical d4 actually settling (drive the tally from `onModifiersResolved` / per-die callbacks instead of a fixed cadence); (b) literal flying-mote projectile FX from each die's projected screen position; (c) fade the unpicked die in `choice` mode. None of these affect the committed result.
- **Engine-spawned dice keep absolute thresholds (expected, not a bug).** Only the player's dice-minigame throw runs the DC check. Dice produced by `TurnOrchestrator.drawSingleResult('d20')` — the chaos `spawnSecond` and the Fool's-reroll replacement in `completeMinigame` — still use `rollD20`'s absolute `getThreshold`, so they carry no `check`. `rollD20` is intentionally left unchanged; the check layers on in the component/engine wrapper. (If the Fool intercepts a dice commit, it replaces the check result with a plain re-drawn d20 — pre-existing behavior, fine for v1.)
```
