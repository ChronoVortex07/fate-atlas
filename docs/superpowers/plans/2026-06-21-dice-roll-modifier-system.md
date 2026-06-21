# Dice Roll-Modifier System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a declarative roll-modifier layer to the d20 dice minigame so any affinity or interaction can confer advantage, disadvantage, or a player-pick "choice", alongside the existing optional (Will) and forced (Fool) rerolls.

**Architecture:** Before a die is shown, the engine's `planDiceRoll()` aggregates modifiers from a declarative affinity table and from interaction pending effects into one `RollPlan` (`mode` + `offerReroll` + narration `sources`). A pure `resolveRollMode()` applies the combine rule (choice wins; advantage/disadvantage net; ties cancel to single). The `DiceMinigame` renders per `mode`. The Fool's forced reroll stays a post-commit interaction, untouched.

**Tech Stack:** TypeScript (strict), React 18 + framer-motion, Vitest (engine/data tests only; components are build-verified via `tsc -b`).

## Global Constraints

- All game logic lives in `src/engine/` / `src/data/` as framework-free TypeScript — no React/DOM imports there. React only renders state and forwards actions.
- Every engine mutator ends with `notify()` (deep-clones state into the snapshot). A mutator that forgets `notify()` will not re-render.
- Type safety is the lint: `tsc` runs with `strict`, `noUnusedLocals`, `noUnusedParameters`. `npm run build` runs `tsc -b && vite build`.
- Vitest is configured to run only `src/engine/__tests__/**` in Node. Tests that touch `Math.random` stub it.
- Affinity bands: `BAND_ORDER = ['latent','stirring','ascendant','dominant']`; `bandOf(value)` → band (latent ≤34, stirring ≤59, ascendant ≤81, else dominant); `bandIndex(band)` → its index. `AffinityEngine.bandOf(id)` is the deterministic (no reach-up) public accessor.
- d20 result tags from `rollD20`: `['roll','random','numeric','threshold', <low|high|neutral>]`.

---

### Task 1: Roll-modifier types, affinity table, and the pure combine function

**Files:**
- Modify: `src/engine/types.ts` (add `RollModifier`, `RollMode`, `RollPlan`; extend `PendingEffect['action']`)
- Create: `src/data/dice-modifiers.ts`
- Test: `src/engine/__tests__/DiceModifiers.test.ts`

**Interfaces:**
- Produces:
  - `type RollModifier = 'advantage' | 'disadvantage' | 'choice' | 'offer-reroll'`
  - `type RollMode = 'single' | 'advantage' | 'disadvantage' | 'choice'`
  - `interface RollPlan { mode: RollMode; offerReroll: boolean; sources: string[] }`
  - `resolveRollMode(mods: RollModifier[]): { mode: RollMode; offerReroll: boolean }`
  - `AFFINITY_ROLL_MODIFIERS: AffinityRollModifier[]`, `ROLL_MODIFIER_ACTIONS: RollModifier[]`, `DICE_PREROLL_TAGS: string[]`

- [ ] **Step 1: Add types to `src/engine/types.ts`**

After the `Tag`/`Taggable` block (near line 53), add:

```ts
// ── Dice roll modifiers ──
export type RollModifier = 'advantage' | 'disadvantage' | 'choice' | 'offer-reroll';
export type RollMode = 'single' | 'advantage' | 'disadvantage' | 'choice';

export interface RollPlan {
  mode: RollMode;
  offerReroll: boolean;
  sources: string[]; // human-readable, for a caption e.g. "Light favors you"
}
```

Then extend `PendingEffect['action']` (near line 262) — the three new actions are pre-roll modifiers, consumed by `planDiceRoll` rather than `executeEffect`:

```ts
  action: 'reroll' | 'flip' | 'add-choice' | 'mirror' | 'second-result' | 'advantage' | 'disadvantage' | 'choice';
```

Leave `InteractionRule['target'].action` and `InteractionEvent['effect']` unchanged (post-commit effects only).

- [ ] **Step 2: Write the failing test `src/engine/__tests__/DiceModifiers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolveRollMode } from '../../data/dice-modifiers';

describe('resolveRollMode', () => {
  it('no modifiers → single, no reroll', () => {
    expect(resolveRollMode([])).toEqual({ mode: 'single', offerReroll: false });
  });

  it('a single advantage → advantage', () => {
    expect(resolveRollMode(['advantage']).mode).toBe('advantage');
  });

  it('a single disadvantage → disadvantage', () => {
    expect(resolveRollMode(['disadvantage']).mode).toBe('disadvantage');
  });

  it('advantage + disadvantage cancel to single', () => {
    expect(resolveRollMode(['advantage', 'disadvantage']).mode).toBe('single');
  });

  it('net advantage wins when sources are unequal', () => {
    expect(resolveRollMode(['advantage', 'advantage', 'disadvantage']).mode).toBe('advantage');
  });

  it('choice beats both advantage and disadvantage', () => {
    expect(resolveRollMode(['advantage', 'disadvantage', 'choice']).mode).toBe('choice');
  });

  it('offer-reroll surfaces on a single/advantage result', () => {
    expect(resolveRollMode(['offer-reroll'])).toEqual({ mode: 'single', offerReroll: true });
    expect(resolveRollMode(['advantage', 'offer-reroll']).offerReroll).toBe(true);
  });

  it('offer-reroll is suppressed in choice mode', () => {
    expect(resolveRollMode(['choice', 'offer-reroll']).offerReroll).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DiceModifiers.test.ts`
Expected: FAIL — `Cannot find module '../../data/dice-modifiers'`.

- [ ] **Step 4: Create `src/data/dice-modifiers.ts`**

```ts
import type { AffinityId, AffinityBand, RollModifier, RollMode } from '../engine/types';

// Pending-effect actions that are pre-roll dice modifiers (consumed by
// planDiceRoll, not executeEffect). 'offer-reroll' is NOT here — it is not a
// pending-effect action; it rides the existing probabilistic offerReroll().
export const ROLL_MODIFIER_ACTIONS: RollModifier[] = ['advantage', 'disadvantage', 'choice'];

// The stable, type-level tags a d20 carries before it is rolled. A pending
// roll-modifier effect matches the upcoming die when all its triggerTags are here.
export const DICE_PREROLL_TAGS: string[] = ['roll', 'numeric'];

export interface AffinityRollModifier {
  affinity: AffinityId;
  minBand: AffinityBand;   // applies deterministically at or above this band
  modifier: RollModifier;
  source: string;          // caption text
}

// Seed triggers (easily extended — add a row). Deterministic while in-band.
export const AFFINITY_ROLL_MODIFIERS: AffinityRollModifier[] = [
  { affinity: 'light',  minBand: 'ascendant', modifier: 'advantage',    source: 'Light favors you' },
  { affinity: 'shadow', minBand: 'ascendant', modifier: 'disadvantage', source: 'Shadow clouds the cast' },
  { affinity: 'will',   minBand: 'dominant',  modifier: 'choice',       source: 'Your will seizes the cast' },
];

// Pure combine rule:
//  - any 'choice' wins (player pick), and suppresses offer-reroll;
//  - else advantage/disadvantage net by count, ties → single (cancel out).
export function resolveRollMode(mods: RollModifier[]): { mode: RollMode; offerReroll: boolean } {
  if (mods.includes('choice')) return { mode: 'choice', offerReroll: false };
  const net =
    mods.filter((m) => m === 'advantage').length -
    mods.filter((m) => m === 'disadvantage').length;
  const mode: RollMode = net > 0 ? 'advantage' : net < 0 ? 'disadvantage' : 'single';
  return { mode, offerReroll: mods.includes('offer-reroll') };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/DiceModifiers.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/data/dice-modifiers.ts src/engine/__tests__/DiceModifiers.test.ts
git commit -m "feat(dice): roll-modifier types, affinity table, resolveRollMode"
```

---

### Task 2: `rollDicePair` on the engine

**Files:**
- Modify: `src/engine/GameEngine.ts` (add `DiceResult` to type imports if absent; add `rollDicePair`)
- Test: `src/engine/__tests__/DiceRollPlan.test.ts`

**Interfaces:**
- Consumes: `this.orchestrator.drawSingleResult('d20', affinities)`, `this.affinityEngine.getState()`.
- Produces:
  - `rollDicePair(mode: 'advantage' | 'disadvantage' | 'choice'): { dice: [DiceResult, DiceResult]; keptIndex: 0 | 1 | null }`

- [ ] **Step 1: Write the failing test `src/engine/__tests__/DiceRollPlan.test.ts`**

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameEngine } from '../GameEngine';

afterEach(() => vi.restoreAllMocks());

describe('rollDicePair', () => {
  // drawSingleResult → rollD20 consumes Math.random; feed a descending sequence
  // so the two dice land on distinct, predictable values.
  function withRolls(values: number[], fn: () => void) {
    let i = 0;
    // rollD20 uses Math.floor(random*20)+1 for the base roll, then a couple of
    // affinity gates. Returning 0 for the gate calls keeps the base roll intact
    // only when chaos/order are at baseline; at baseline (50) influences are low.
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const v = values[Math.min(i, values.length - 1)];
      i += 1;
      return v;
    });
    fn();
  }

  it('advantage keeps the higher die', () => {
    const e = new GameEngine();
    // base rolls: first ~ (0.90*20)+1=19, gate rolls high (no influence), second ~ (0.10*20)+1=3
    withRolls([0.90, 0.99, 0.99, 0.10, 0.99, 0.99], () => {
      const { dice, keptIndex } = e.rollDicePair('advantage');
      expect(keptIndex).not.toBeNull();
      expect(dice[keptIndex as number].result).toBe(Math.max(dice[0].result, dice[1].result));
    });
  });

  it('disadvantage keeps the lower die', () => {
    const e = new GameEngine();
    withRolls([0.90, 0.99, 0.99, 0.10, 0.99, 0.99], () => {
      const { dice, keptIndex } = e.rollDicePair('disadvantage');
      expect(dice[keptIndex as number].result).toBe(Math.min(dice[0].result, dice[1].result));
    });
  });

  it('choice leaves keptIndex null and returns two dice', () => {
    const e = new GameEngine();
    const { dice, keptIndex } = e.rollDicePair('choice');
    expect(keptIndex).toBeNull();
    expect(dice).toHaveLength(2);
    expect(dice[0].type).toBe('d20');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DiceRollPlan.test.ts`
Expected: FAIL — `e.rollDicePair is not a function`.

- [ ] **Step 3: Ensure `DiceResult` is imported in `GameEngine.ts`**

The first import line should already include `DiceResult` (added during the earlier reroll work):

```ts
import type { GameState, QuestionType, AffinityId, AffinityBand, MinigameMeta, SlotResult, TarotResult, DiceResult, RollModifier, RollMode, RollPlan, RunRecord, PendingEffect, InteractionEvent } from './types';
```

Add `RollModifier`, `RollMode`, `RollPlan` to that import (used in Task 3). If `DiceResult` is missing, add it too.

- [ ] **Step 4: Add `rollDicePair` to `GameEngine.ts`**

Place it in the "Agency (Fate/Will) decisions" region, right after `resolveReroll`:

```ts
  // Rolls two d20s for a two-dice mode. advantage/disadvantage auto-keep the
  // higher/lower die (ties keep index 0); choice keeps neither (player picks).
  rollDicePair(mode: 'advantage' | 'disadvantage' | 'choice'): { dice: [DiceResult, DiceResult]; keptIndex: 0 | 1 | null } {
    const aff = this.affinityEngine.getState();
    const a = this.orchestrator.drawSingleResult('d20', aff) as DiceResult;
    const b = this.orchestrator.drawSingleResult('d20', aff) as DiceResult;
    let keptIndex: 0 | 1 | null;
    if (mode === 'choice') keptIndex = null;
    else if (mode === 'advantage') keptIndex = a.result >= b.result ? 0 : 1;
    else keptIndex = a.result <= b.result ? 0 : 1; // disadvantage
    return { dice: [a, b], keptIndex };
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/DiceRollPlan.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/DiceRollPlan.test.ts
git commit -m "feat(dice): rollDicePair for advantage/disadvantage/choice"
```

---

### Task 3: `planDiceRoll` + remove `maybeKeepOneOfTwo` + keep roll-mods out of post-commit

**Files:**
- Modify: `src/engine/GameEngine.ts` (add `planDiceRoll`; partition pending effects in `completeMinigame`; delete `maybeKeepOneOfTwo`; add `bandIndex` to the affinities import)
- Modify: `src/engine/__tests__/AgencyDecisions.test.ts` (remove the `maybeKeepOneOfTwo` test)
- Test: `src/engine/__tests__/DiceRollPlan.test.ts` (append `planDiceRoll` cases)

**Interfaces:**
- Consumes: `resolveRollMode`, `AFFINITY_ROLL_MODIFIERS`, `ROLL_MODIFIER_ACTIONS`, `DICE_PREROLL_TAGS` (Task 1); `bandIndex` (data/affinities); `this.affinityEngine.bandOf`, `this.tagSystem.hasAllTags`, `this.offerReroll()` (existing).
- Produces:
  - `planDiceRoll(): RollPlan`

- [ ] **Step 1: Append failing tests to `src/engine/__tests__/DiceRollPlan.test.ts`**

```ts
describe('planDiceRoll', () => {
  it('defaults to single mode at baseline affinities', () => {
    const e = new GameEngine();
    e.startTurn('self');
    // Stub RNG high so the probabilistic offerReroll() does not fire.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('single');
  });

  it('Light Ascendant confers advantage', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, light: 75 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.mode).toBe('advantage');
    expect(plan.sources).toContain('Light favors you');
  });

  it('Shadow Ascendant confers disadvantage', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, shadow: 75 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('disadvantage');
  });

  it('Will Dominant confers choice', () => {
    const e = new GameEngine();
    e.loadState({ affinities: { ...e.getState().affinities, will: 92 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('choice');
  });

  it('a forced modifier via debugForcedEffect overrides affinities and clears the flag', () => {
    const e = new GameEngine();
    e.loadState({ debugForcedEffect: 'disadvantage' });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('disadvantage');
    expect(e.getState().debugForcedEffect).toBeNull();
  });

  it('a matching pending effect confers its modifier and is consumed', () => {
    const e = new GameEngine();
    e.loadState({
      pendingEffects: [{
        id: 'x', sourceRunId: 'r', sourceCard: 'The Tower', sourceSlotIndex: 0,
        triggerTags: ['roll'], action: 'disadvantage', description: 'd',
        expiresAfter: 3, turnsRemaining: 3,
      }],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plan = e.planDiceRoll();
    expect(plan.mode).toBe('disadvantage');
    expect(plan.sources).toContain('The Tower');
    expect(e.getState().pendingEffects).toHaveLength(0); // consumed
  });

  it('Light advantage and a card disadvantage cancel to single', () => {
    const e = new GameEngine();
    e.loadState({
      affinities: { ...e.getState().affinities, light: 75 },
      pendingEffects: [{
        id: 'x', sourceRunId: 'r', sourceCard: 'The Tower', sourceSlotIndex: 0,
        triggerTags: ['roll'], action: 'disadvantage', description: 'd',
        expiresAfter: 3, turnsRemaining: 3,
      }],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(e.planDiceRoll().mode).toBe('single');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DiceRollPlan.test.ts -t "planDiceRoll"`
Expected: FAIL — `e.planDiceRoll is not a function`.

- [ ] **Step 3: Add `bandIndex` to the affinities import in `GameEngine.ts`**

```ts
import { AFFINITY_DEFINITIONS, defaultAffinityState, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE, bandIndex } from '../data/affinities';
```

Add the dice-modifiers import near the other data imports:

```ts
import { AFFINITY_ROLL_MODIFIERS, ROLL_MODIFIER_ACTIONS, DICE_PREROLL_TAGS, resolveRollMode } from '../data/dice-modifiers';
```

- [ ] **Step 4: Add `planDiceRoll` to `GameEngine.ts`**

Place it right after `rollDicePair`:

```ts
  // Resolves every active roll modifier (affinity table + interaction pending
  // effects + the optional Will reroll) into one plan for the dice minigame.
  // Consumes any matching roll-modifier pending effects and the forced-modifier
  // debug flag. Affinity modifiers apply deterministically at/above their band.
  planDiceRoll(): RollPlan {
    const mods: RollModifier[] = [];
    const sources: string[] = [];

    // 1. Debug force (a single modifier), cleared on read.
    const forced = this.state.debugForcedEffect;
    if (forced === 'advantage' || forced === 'disadvantage' || forced === 'choice') {
      this.state.debugForcedEffect = null;
      mods.push(forced);
      sources.push(`(debug) ${forced}`);
    }

    // 2. Affinity table — deterministic while in-band.
    for (const rule of AFFINITY_ROLL_MODIFIERS) {
      if (bandIndex(this.affinityEngine.bandOf(rule.affinity)) >= bandIndex(rule.minBand)) {
        mods.push(rule.modifier);
        sources.push(rule.source);
      }
    }

    // 3. Interaction pending effects targeting the upcoming die — consume them.
    const remaining: PendingEffect[] = [];
    for (const effect of this.state.pendingEffects) {
      const isRollMod = ROLL_MODIFIER_ACTIONS.includes(effect.action as RollModifier);
      if (isRollMod && this.tagSystem.hasAllTags({ tags: DICE_PREROLL_TAGS }, effect.triggerTags)) {
        mods.push(effect.action as RollModifier);
        sources.push(effect.sourceCard);
      } else {
        remaining.push(effect);
      }
    }
    this.state.pendingEffects = remaining;

    // 4. Optional Will reroll (existing probabilistic path; honors offer/hollow debug flags).
    if (this.offerReroll()) mods.push('offer-reroll');

    const { mode, offerReroll } = resolveRollMode(mods);
    this.notify();
    return { mode, offerReroll, sources };
  }
```

- [ ] **Step 5: Keep roll-modifier pending effects out of post-commit matching**

In `completeMinigame`, replace the existing block:

```ts
    const { matched, remaining } = this.interactionResolver.checkPendingEffects(
      this.state.pendingEffects,
      result,
    );
    this.state.pendingEffects = remaining;
```

with:

```ts
    // Roll-modifier pending effects are pre-roll (consumed by planDiceRoll); keep
    // them out of the post-commit interaction matcher so they never spawn a
    // meta-event. Anything not consumed pre-roll is preserved untouched.
    const rollMods = this.state.pendingEffects.filter(
      (e) => ROLL_MODIFIER_ACTIONS.includes(e.action as RollModifier),
    );
    const checkable = this.state.pendingEffects.filter(
      (e) => !ROLL_MODIFIER_ACTIONS.includes(e.action as RollModifier),
    );
    const { matched, remaining } = this.interactionResolver.checkPendingEffects(
      checkable,
      result,
    );
    this.state.pendingEffects = [...rollMods, ...remaining];
```

- [ ] **Step 6: Delete `maybeKeepOneOfTwo`**

Remove the whole method (the `// Will (Dominant): offer two candidate results; the player keeps one.` block and its body). It is superseded by `choice` mode + `rollDicePair`.

- [ ] **Step 7: Remove the orphaned `maybeKeepOneOfTwo` test**

In `src/engine/__tests__/AgencyDecisions.test.ts`, delete the test:

```ts
  it('maybeKeepOneOfTwo returns two candidates when forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.loadState({ debugForcedEffect: 'keep-one-of-two' });
    const pair = e.maybeKeepOneOfTwo(dice(9));
    expect(pair).not.toBeNull();
    expect(pair!.length).toBe(2);
  });
```

Leave the rest of the `orientation + keep-one-of-two` describe block intact (rename not required).

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/engine/__tests__/DiceRollPlan.test.ts src/engine/__tests__/AgencyDecisions.test.ts`
Expected: PASS — planDiceRoll cases green; AgencyDecisions green with no `maybeKeepOneOfTwo` reference.

- [ ] **Step 9: Typecheck + full suite**

Run: `npx tsc -b && npx vitest run`
Expected: `tsc` exit 0; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/DiceRollPlan.test.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "feat(dice): planDiceRoll resolves affinity + interaction modifiers; drop maybeKeepOneOfTwo"
```

---

### Task 4: Debug scenarios

**Files:**
- Modify: `src/engine/scenarios.ts` (replace `will-keep-one-of-two`; add four dice scenarios)
- Test: `src/engine/__tests__/Scenarios.test.ts`

**Interfaces:**
- Consumes: the `ScenarioPreset` shape and `base(...)` helper already in `scenarios.ts`.
- Produces: presets `dice-advantage`, `dice-disadvantage`, `dice-choice`, `dice-disadvantage-interaction`.

- [ ] **Step 1: Write the failing test in `src/engine/__tests__/Scenarios.test.ts`**

Append:

```ts
describe('dice roll-modifier scenarios', () => {
  it('dice-advantage loads into a d20 minigame with Light Ascendant', () => {
    const e = new GameEngine();
    expect(e.loadScenarioById('dice-advantage')).toBe(true);
    const s = e.getState();
    expect(s.screen).toBe('minigame');
    expect(s.selectedMethod).toBe('d20');
    expect(s.affinities.light).toBeGreaterThanOrEqual(60);
  });

  it('dice-choice replaces keep-one-of-two and sets Will Dominant', () => {
    const e = new GameEngine();
    expect(e.loadScenarioById('dice-choice')).toBe(true);
    expect(e.getState().affinities.will).toBeGreaterThanOrEqual(82);
    expect(e.loadScenarioById('will-keep-one-of-two')).toBe(false); // removed
  });

  it('dice-disadvantage-interaction seeds a disadvantage pending effect on a die', () => {
    const e = new GameEngine();
    expect(e.loadScenarioById('dice-disadvantage-interaction')).toBe(true);
    const eff = e.getState().pendingEffects.find((p) => p.action === 'disadvantage');
    expect(eff).toBeTruthy();
    expect(eff!.triggerTags).toContain('roll');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts -t "dice roll-modifier"`
Expected: FAIL — `loadScenarioById('dice-advantage')` returns false (unknown id).

- [ ] **Step 3: Edit `src/engine/scenarios.ts`**

Replace the existing `will-keep-one-of-two` preset:

```ts
  {
    id: 'will-keep-one-of-two', label: 'Keep One of Two — Will Dominant', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      state.debugForcedEffect = 'keep-one-of-two';
      return { will: 92, fate: 12 };
    },
  },
```

with:

```ts
  {
    id: 'dice-choice', label: 'Keep One of Two — Will Dominant', group: 'Fate / Will',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      return { will: 92, fate: 12 };
    },
  },
```

Then, at the end of the `Light / Shadow` group (just before the closing `];` of `SCENARIO_PRESETS`), add:

```ts
  // ── Dice roll modifiers ──
  {
    id: 'dice-advantage', label: 'Advantage — Light Ascendant', group: 'Dice Modifiers',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      return { light: 75, will: 20 }; // Will latent → no reroll-offer noise
    },
  },
  {
    id: 'dice-disadvantage', label: 'Disadvantage — Shadow Ascendant', group: 'Dice Modifiers',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      return { shadow: 75, will: 20 };
    },
  },
  {
    id: 'dice-disadvantage-interaction', label: 'Disadvantage — from an Interaction', group: 'Dice Modifiers',
    apply: (state) => {
      state.selectedMethod = 'd20'; state.screen = 'minigame';
      state.pendingEffects = [
        base('The Tower', 'disadvantage', ['roll'], 'The Tower’s omen drags the cast downward.'),
      ];
    },
  },
```

(The `base(...)` helper already exists at the top of the file; `'disadvantage'` is now a valid `PendingEffect['action']` from Task 1.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/scenarios.ts src/engine/__tests__/Scenarios.test.ts
git commit -m "feat(dice): debug scenarios for advantage/disadvantage/choice + interaction"
```

---

### Task 5: DiceMinigame UI — render per roll plan

**Files:**
- Modify: `src/components/screens/DiceMinigame.tsx` (full rewrite of the component body; styles below the component are unchanged and kept)

**Interfaces:**
- Consumes: `engine.planDiceRoll()`, `engine.rollDicePair(mode)`, `engine.resolveReroll(current)`, `engine.completeMinigame(result, meta)`; `RollMode` type; `DiceThrowAnimation` / `THRESHOLD_COLORS`.
- Produces: no engine surface — UI only. **Build-verified** (no component tests per CLAUDE.md).

- [ ] **Step 1: Rewrite the component in `src/components/screens/DiceMinigame.tsx`**

Replace everything from the top `import` lines through the end of the `export default function DiceMinigame()` body (i.e. up to the line `const containerStyle: React.CSSProperties = {` — keep all style constants from that line onward exactly as they are). New top-of-file + component:

```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import type { DiceResult, MinigameMeta, RollMode } from '../../engine/types';
import DiceThrowAnimation, { THRESHOLD_COLORS } from './DiceThrowAnimation';

// Beat that lets a thrown die's reveal animation finish before completeMinigame
// transitions the screen. Matches the auto-commit delay so a reroll's replayed
// throw gets the same time on screen as the first one.
const REVEAL_DELAY_MS = 1500;
// Beat the two advantage/disadvantage dice spend on screen before they collapse
// to the kept die.
const MERGE_DELAY_MS = 1300;

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const [thrown, setThrown] = useState(false);
  const [mode, setMode] = useState<RollMode>('single');
  const [sources, setSources] = useState<string[]>([]);
  const [pair, setPair] = useState<[DiceResult, DiceResult] | null>(null);
  const [keptIndex, setKeptIndex] = useState<0 | 1 | null>(null);
  const [merged, setMerged] = useState(false);
  const [localResult, setLocalResult] = useState<DiceResult | null>(null);
  const [offered, setOffered] = useState(false);
  const [chose, setChose] = useState(false);
  const committedRef = useRef(false);
  const veiled = state.affinityEffects.poolPreview === 'hidden';

  const commit = useCallback((result: DiceResult, meta: MinigameMeta) => {
    if (committedRef.current) return;
    committedRef.current = true;
    engine.completeMinigame(result, meta);
  }, [engine]);

  const handleThrow = useCallback(() => {
    const plan = engine.planDiceRoll();
    setMode(plan.mode);
    setSources(plan.sources);
    setThrown(true);
    if (plan.mode === 'single') {
      setLocalResult(rollD20(state.affinities));
      setOffered(plan.offerReroll);
    } else {
      const { dice, keptIndex: kept } = engine.rollDicePair(plan.mode);
      setPair(dice);
      setKeptIndex(kept);
      setOffered(plan.offerReroll); // suppressed in choice mode (plan.offerReroll === false)
    }
  }, [engine, state.affinities]);

  // Advantage/disadvantage: after the merge beat, collapse to the kept die and
  // fold into the single-result flow.
  useEffect(() => {
    if (mode !== 'advantage' && mode !== 'disadvantage') return;
    if (!pair || keptIndex === null || merged) return;
    const timer = setTimeout(() => {
      setLocalResult(pair[keptIndex]);
      setMerged(true);
    }, MERGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [mode, pair, keptIndex, merged]);

  // Auto-commit (Fate) once a single result is settled and no reroll is offered.
  // Covers single mode and the merged advantage/disadvantage result.
  useEffect(() => {
    if (!localResult || offered) return;
    if (mode === 'choice') return;
    if ((mode === 'advantage' || mode === 'disadvantage') && !merged) return;
    const timer = setTimeout(() => commit(localResult, { revealedAsDrawn: true }), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [localResult, offered, mode, merged, commit]);

  const handleKeep = useCallback(() => {
    setChose(true);
    if (localResult) commit(localResult, { revealedAsDrawn: true }); // accept → Fate
  }, [localResult, commit]);

  const handleReroll = useCallback(() => {
    if (!localResult) return;
    const { result: next } = engine.resolveReroll(localResult); // Fate may make it hollow
    setChose(true);
    setLocalResult(next);
    setTimeout(() => commit(next, { viaReroll: true }), REVEAL_DELAY_MS); // assert control → Will
  }, [localResult, engine, commit]);

  // Choice mode: the player keeps one of the two dice (Will).
  const handlePick = useCallback((index: 0 | 1) => {
    if (!pair) return;
    setKeptIndex(index);
    setLocalResult(pair[index]);
    setChose(true);
    setTimeout(() => commit(pair[index], { viaReroll: true }), REVEAL_DELAY_MS);
  }, [pair, commit]);

  // Once committed, prefer the engine's slot so interaction effects (e.g. Fool's
  // Reroll) are reflected. Before commit, use the local result.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayResult: DiceResult | null =
    committedSlot && committedSlot.type === 'd20' ? committedSlot : localResult;

  // Two dice are on screen while a pair is unresolved: advantage/disadvantage
  // before the merge beat, or choice before the player picks.
  const showingPair = !!pair && (
    ((mode === 'advantage' || mode === 'disadvantage') && !merged) ||
    (mode === 'choice' && !chose)
  );

  const caption = sources.length > 0 ? sources.join(' · ') : null;
  const modeLabel =
    mode === 'advantage' ? 'Advantage — the higher die holds'
    : mode === 'disadvantage' ? 'Disadvantage — the lower die holds'
    : mode === 'choice' ? 'Keep one — your will decides'
    : null;

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>{thrown ? 'The die is cast' : 'Cast the die'}</h1>

        {!thrown ? (
          <motion.button
            style={dieButtonStyle}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleThrow}
          >
            <span style={dieFaceStyle}>{String.fromCodePoint(0x2685)}</span>
            <span style={tapHintStyle}>Tap to throw</span>
          </motion.button>
        ) : showingPair && pair ? (
          <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {modeLabel && <p style={interpretationStyle}>{modeLabel}</p>}
            <div style={pairRowStyle}>
              {pair.map((die, i) => {
                const isHeld = keptIndex === i;
                const interactive = mode === 'choice';
                return (
                  <motion.button
                    key={i}
                    style={{
                      ...pairDieStyle,
                      cursor: interactive ? 'pointer' : 'default',
                      borderColor: isHeld ? THRESHOLD_COLORS[die.threshold] : '#1a2440',
                      opacity: keptIndex !== null && !isHeld ? 0.4 : 1,
                    }}
                    whileHover={interactive ? { scale: 1.05, borderColor: '#c75b4a' } : undefined}
                    whileTap={interactive ? { scale: 0.96 } : undefined}
                    onClick={interactive ? () => handlePick(i as 0 | 1) : undefined}
                    disabled={!interactive}
                  >
                    <DiceThrowAnimation key={die.result} value={die.result} threshold={die.threshold} />
                  </motion.button>
                );
              })}
            </div>
            {caption && <p style={sourceCaptionStyle}>{caption}</p>}
          </motion.div>
        ) : (
          displayResult && (
            <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              {/* key on the value so a reroll remounts and replays the throw */}
              <DiceThrowAnimation key={displayResult.result} value={displayResult.result} threshold={displayResult.threshold} />
              {/* Shadow (veiled): the threshold/meaning stays hidden until commit. */}
              {veiled && !committedRef.current ? (
                <p style={interpretationStyle}>The die rests, its meaning shrouded...</p>
              ) : (
                <motion.div style={thresholdStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <span style={{ ...thresholdBadgeStyle, color: THRESHOLD_COLORS[displayResult.threshold], borderColor: THRESHOLD_COLORS[displayResult.threshold] }}>
                    {displayResult.threshold.replace(/-/g, ' ').toUpperCase()}
                  </span>
                  <p style={interpretationStyle}>{displayResult.interpretation}</p>
                </motion.div>
              )}
              {caption && (mode !== 'single') && <p style={sourceCaptionStyle}>{caption}</p>}
              {offered && !chose && (
                <div style={rerollRowStyle}>
                  <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleReroll}>
                    ↺ Reroll?
                  </motion.button>
                  <motion.button style={rerollBtnStyle} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleKeep}>
                    Keep it
                  </motion.button>
                </div>
              )}
            </motion.div>
          )
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Add the two new style constants**

Immediately after the existing `const rerollBtnStyle: React.CSSProperties = { ... };` (end of file), append:

```tsx

const pairRowStyle: React.CSSProperties = {
  display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center',
};

const pairDieStyle: React.CSSProperties = {
  background: 'transparent', border: '2px solid #1a2440', borderRadius: '12px',
  padding: '0.25rem', outline: 'none', transition: 'border-color 0.3s, opacity 0.4s',
};

const sourceCaptionStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.7rem',
  color: '#7b9ec7', letterSpacing: '0.08em', textAlign: 'center', margin: 0, fontStyle: 'italic',
};
```

- [ ] **Step 3: Typecheck (component build verification)**

Run: `npx tsc -b`
Expected: exit 0 (no unused locals/params; all imports used).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `tsc -b` then `vite build` complete with no errors.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run `npm run dev`, open the debug panel, and load each scenario:
- `dice-advantage` → two dice roll, collapse to the higher; caption "Light favors you".
- `dice-disadvantage` → collapses to the lower.
- `dice-choice` → two dice stay lit; tapping one keeps it; the other dims.
- `dice-disadvantage-interaction` → disadvantage from "The Tower".
- `will-offer-reroll` / `fate-hollow-reroll` → single die, Reroll/Keep prompt still works; hollow returns the same value.
Confirm no scene transitions before the dice animation finishes.

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/DiceMinigame.tsx
git commit -m "feat(dice): render advantage/disadvantage/choice in the dice minigame"
```

---

## Self-Review

**Spec coverage:**
- Roll modifiers + `resolveRollMode` combine rule (choice wins, cancel-out, offer suppressed in choice) → Task 1. ✓
- Affinity table + interaction pending-effect triggers → Task 1 (table), Task 3 (`planDiceRoll` gathering + consumption). ✓
- Seed triggers (Light→advantage, Shadow→disadvantage, Will Dominant→choice, interaction→disadvantage) → Task 1 table + Task 4 scenarios. ✓
- `planDiceRoll` / `rollDicePair` / `resolveReroll` API → Tasks 2–3 (`resolveReroll` already exists). ✓
- `PendingEffect.action` extended; roll-mods kept out of post-commit pipeline → Task 1 + Task 3 Step 5. ✓
- `maybeKeepOneOfTwo` replaced by choice mode → Task 3 Steps 6–7. ✓
- Dice minigame UX (single/advantage/disadvantage/choice, merge collapse, caption, REVEAL_DELAY discipline, veiled interplay, feeds: Fate on accept, Will on reroll/pick) → Task 5. ✓
- Forced reroll (Fool) unchanged (post-commit) → no task touches `executeEffect('reroll')`. ✓
- Tests: `resolveRollMode`, `rollDicePair`, `planDiceRoll`, scenarios → Tasks 1–4. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `RollModifier`/`RollMode`/`RollPlan` defined in Task 1 and imported in Tasks 2–3/5; `planDiceRoll(): RollPlan`, `rollDicePair(...): { dice: [DiceResult, DiceResult]; keptIndex: 0|1|null }`, `resolveReroll(current): { result; hollow }` used consistently in the component; `ROLL_MODIFIER_ACTIONS`/`DICE_PREROLL_TAGS`/`AFFINITY_ROLL_MODIFIERS`/`resolveRollMode` names match between data file and engine. ✓
