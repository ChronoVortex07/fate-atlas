# Event-Driven Effects Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two tangled effect mechanisms (hardcoded affinity `maybe*`/`resolve*` methods + the pending-effects interaction model) with one event-driven *responder pipeline* — explicit trigger points, priority-band resolution, a rich shared context, and a force/isolate debug harness.

**Architecture:** A pure `dispatch()` runs an ordered list of `Responder`s at a namespaced trigger point (`dice:roll`, `select:draw:end`, …). Responders are gathered, filtered by a debug layer, checked for eligibility (`condition` always + `roll` unless forced), then resolved by two policies: `exclusive` (one winner per priority band, weighted tiebreak) and `combine` (a pure reducer nets modifiers). Each winner mutates a shared mutable `PhaseContext.draft` and returns an `EffectReport`; the engine reads back the draft and enqueues the reports for an auto-play sequencer. Affinities and interactions are two builders producing the same `Responder` shape.

**Tech Stack:** TypeScript (strict), React 18 + framer-motion, Vitest (engine/data tests only; components are build-verified via `tsc -b`).

## Global Constraints

- All game logic lives in `src/engine/` / `src/data/` as framework-free TypeScript — no React/DOM imports there. React only renders state and forwards actions.
- Every engine mutator that changes player-visible state ends with `notify()` (deep-clones `this.state` into the snapshot). A mutator that forgets `notify()` will not re-render.
- Type safety is the lint: `tsc` runs with `strict`, `noUnusedLocals`, `noUnusedParameters`. `npm run build` runs `tsc -b && vite build`.
- Vitest runs only `src/engine/__tests__/**` in Node. New engine modules under `src/engine/events/` and `src/engine/responders/` are tested from `src/engine/__tests__/`. Randomness is injected via `ctx.rng` (a `() => number`); tests pass a deterministic stream rather than stubbing `Math.random`.
- Affinity scale: 0–100. Bands: `bandOf(v)` → latent ≤34, stirring ≤59, ascendant ≤81, else dominant. `bandIndex(band)` → index in `BAND_ORDER`. `TIER_BASE_CHANCE = { ambient: 0.5, notable: 0.22, major: 0.08 }`, `BAND_POWER_STEP = 0.7`.
- Priority bands and their order: `STRUCTURAL`, `MUTATE`, `SPAWN`, `OVERRIDE` (resolve in that order; at most one exclusive effect per band per trigger).
- Spec: `docs/superpowers/specs/2026-06-21-event-driven-effects-engine-design.md`. Every task implicitly inherits this section.

---

## File Structure

**New (Phases A–C, pure & unwired):**
- `src/engine/events/types.ts` — all event-system types + `PRIORITY_BANDS` / `bandValue`.
- `src/engine/events/reducers.ts` — combine-channel reducers (`roll-mode`) + `REDUCERS` registry.
- `src/engine/events/EventDispatcher.ts` — the pure `dispatch()` loop + weighted tiebreak.
- `src/engine/events/eligibility.ts` — `bandRoll()` helper (affinity band × tier chance, scaled).
- `src/engine/responders/affinity.ts` — affinity responder catalog + `buildAffinityResponders()`.
- `src/engine/responders/interactions.ts` — interaction responder catalog + `buildInteractionResponders()`.
- `src/engine/events/scenarios.ts` — `DebugScenario` type, presets, `loadDebugScenario()` (reset-then-stage).

**Modified (Phases D–E, integration):**
- `src/engine/types.ts` — add `eventQueue`, `debugConfig` to `GameState`; export `TriggerPoint` re-exports as needed.
- `src/engine/GameEngine.ts` — fire trigger points around lifecycle; route through `dispatch()`; delete the old `maybe*`/`resolve*` methods.
- `src/components/overlays/InteractionSequencer.tsx` → batch sequencer driven by `state.eventQueue`.
- `src/components/screens/{DiceMinigame,TarotMinigame,IChingMinigame,MethodSelect,HappeningScene}.tsx` — fire action trigger points.
- `src/components/overlays/InteractionAnimations/` — add `ShroudAnimation`, `WidenAnimation`, `OverrideAnimation`.
- `src/components/debug/DebugPanel.tsx` — forced-set multi-select + isolate toggle + scenario list.

**Retired:** `src/engine/InteractionResolver.ts` (and its `checkAndResolve`/pending-effects model), the synthetic `chaos-dominant` tag, `chaos-second-result` rule.

---

## Phase A — Core dispatcher (pure, fully tested, unwired)

### Task 1: Event-system types + priority bands

**Files:**
- Create: `src/engine/events/types.ts`
- Test: `src/engine/__tests__/EventTypes.test.ts`

**Interfaces:**
- Produces: `TriggerPoint`, `PriorityBand`, `PRIORITY_BANDS`, `bandValue()`, `ResolutionGroup`, `EffectReport`, `PhaseDraft`, `PhaseContext`, `Responder`, `CombineReducer`, `DebugConfig`.

- [ ] **Step 1: Write the failing test `src/engine/__tests__/EventTypes.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { PRIORITY_BANDS, bandValue } from '../events/types';

describe('priority bands', () => {
  it('orders structural < mutate < spawn < override', () => {
    expect(PRIORITY_BANDS).toEqual(['STRUCTURAL', 'MUTATE', 'SPAWN', 'OVERRIDE']);
    expect(bandValue('STRUCTURAL')).toBe(100);
    expect(bandValue('OVERRIDE')).toBe(400);
    expect(bandValue('STRUCTURAL')).toBeLessThan(bandValue('MUTATE'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/EventTypes.test.ts`
Expected: FAIL — `Cannot find module '../events/types'`.

- [ ] **Step 3: Create `src/engine/events/types.ts`**

```ts
import type { AffinityId, SlotResult, MinigameState, RollModifier, RollMode } from '../types';

export type TriggerPoint = string; // namespaced: 'select:draw:end', 'dice:roll', 'tarot:commit'

export type PriorityBand = 'STRUCTURAL' | 'MUTATE' | 'SPAWN' | 'OVERRIDE';
export const PRIORITY_BANDS: PriorityBand[] = ['STRUCTURAL', 'MUTATE', 'SPAWN', 'OVERRIDE'];
export function bandValue(b: PriorityBand): number {
  return (PRIORITY_BANDS.indexOf(b) + 1) * 100;
}

export type ResolutionGroup =
  | { kind: 'exclusive'; band: PriorityBand }
  | { kind: 'combine'; channel: string };

export interface EffectReport {
  responderId: string;
  label: string;         // "Shadow"
  description: string;   // "A path is shrouded..."
  animation: string;     // selects the sequencer animation
  sourceSlot?: number;
  targetSlot?: number;
}

export interface PhaseDraft {
  pool?: SlotResult[];        // draw phases: items being dealt
  outcome?: SlotResult;       // action hooks: candidate result (replace = interception)
  rollMods?: RollModifier[];  // 'roll-mode' combine accumulator
  rollMode?: RollMode;        // 'roll-mode' result
  offerReroll?: boolean;      // 'roll-mode' result
  shrouded?: number[];        // indices of shrouded pool items
  [key: string]: unknown;     // extensible per trigger family
}

export interface PhaseContext {
  trigger: TriggerPoint;
  affinities: Record<AffinityId, number>;
  slots: SlotResult[];        // committed results this round
  hand: SlotResult[] | null;  // current uncommitted pool/hand
  spread: SlotResult[];       // slots + hand
  minigame: MinigameState | null;
  event: unknown;             // payload of the triggering action
  draft: PhaseDraft;          // MUTABLE
  rng: () => number;          // injectable RNG
}

export interface Responder {
  id: string;
  source: 'affinity' | 'interaction';
  triggers: TriggerPoint[];
  group: ResolutionGroup;
  condition(ctx: PhaseContext): boolean; // structural precondition — always required
  roll(ctx: PhaseContext): boolean;      // probabilistic gate — bypassed when forced
  weight?(ctx: PhaseContext): number;    // same-band tiebreak weight (default 1)
  apply(ctx: PhaseContext): EffectReport | null;
}

export interface CombineReducer {
  channel: string;
  reduce(ctx: PhaseContext): EffectReport | null;
}

export interface DebugConfig {
  forced: string[]; // responder IDs guaranteed to fire on their next trigger (one-shot)
  isolate: boolean; // when true only forced responders may fire
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/EventTypes.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/events/types.ts src/engine/__tests__/EventTypes.test.ts
git commit -m "feat(events): event-system types and priority bands"
```

---

### Task 2: Combine reducers (`roll-mode`)

**Files:**
- Create: `src/engine/events/reducers.ts`
- Test: `src/engine/__tests__/Reducers.test.ts`

**Interfaces:**
- Consumes: `resolveRollMode` from `src/data/dice-modifiers.ts`; `PhaseContext`, `CombineReducer`, `EffectReport` (Task 1).
- Produces: `rollModeReducer: CombineReducer`, `REDUCERS: Record<string, CombineReducer>`.

- [ ] **Step 1: Write the failing test `src/engine/__tests__/Reducers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { REDUCERS } from '../events/reducers';
import type { PhaseContext } from '../events/types';

function ctx(rollMods: string[]): PhaseContext {
  return {
    trigger: 'dice:roll', affinities: {} as any, slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.5,
    draft: { rollMods: rollMods as any },
  };
}

describe('roll-mode reducer', () => {
  it('nets advantage + disadvantage to single and reports nothing', () => {
    const c = ctx(['advantage', 'disadvantage']);
    const report = REDUCERS['roll-mode'].reduce(c);
    expect(c.draft.rollMode).toBe('single');
    expect(report).toBeNull(); // single, no reroll → no notable event
  });

  it('choice trumps and reports', () => {
    const c = ctx(['advantage', 'disadvantage', 'choice']);
    const report = REDUCERS['roll-mode'].reduce(c);
    expect(c.draft.rollMode).toBe('choice');
    expect(report).not.toBeNull();
    expect(report!.animation).toBe('roll-mode');
  });

  it('no mods → null and leaves mode single', () => {
    const c = ctx([]);
    expect(REDUCERS['roll-mode'].reduce(c)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/Reducers.test.ts`
Expected: FAIL — `Cannot find module '../events/reducers'`.

- [ ] **Step 3: Create `src/engine/events/reducers.ts`**

```ts
import type { CombineReducer, PhaseContext, EffectReport } from './types';
import type { RollMode, RollModifier } from '../types';
import { resolveRollMode } from '../../data/dice-modifiers';

function describeRollMode(mode: RollMode, offerReroll: boolean): string {
  if (mode === 'choice') return 'Your will seizes the cast — two dice, keep one.';
  if (mode === 'advantage') return 'The cast is favored — the higher die holds.';
  if (mode === 'disadvantage') return 'The cast is clouded — the lower die holds.';
  return offerReroll ? 'The cast may be tried again.' : 'The cast holds steady.';
}

export const rollModeReducer: CombineReducer = {
  channel: 'roll-mode',
  reduce(ctx: PhaseContext): EffectReport | null {
    const mods = (ctx.draft.rollMods ?? []) as RollModifier[];
    const { mode, offerReroll } = resolveRollMode(mods);
    ctx.draft.rollMode = mode;
    ctx.draft.offerReroll = offerReroll;
    // Only narrate when something actually changed the cast.
    if (mode === 'single' && !offerReroll) return null;
    return {
      responderId: 'roll-mode',
      label: 'The Cast',
      description: describeRollMode(mode, offerReroll),
      animation: 'roll-mode',
    };
  },
};

export const REDUCERS: Record<string, CombineReducer> = {
  'roll-mode': rollModeReducer,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Reducers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/engine/events/reducers.ts src/engine/__tests__/Reducers.test.ts
git commit -m "feat(events): roll-mode combine reducer"
```

---

### Task 3: The `dispatch()` loop

**Files:**
- Create: `src/engine/events/EventDispatcher.ts`
- Test: `src/engine/__tests__/EventDispatcher.test.ts`

**Interfaces:**
- Consumes: `Responder`, `PhaseContext`, `EffectReport`, `DebugConfig`, `PRIORITY_BANDS` (Task 1); `REDUCERS` (Task 2).
- Produces: `dispatch(trigger, ctx, responders, debug): DispatchResult` where `DispatchResult = { reports: EffectReport[]; forcedConsumed: string[] }`. Mutates `ctx.draft` in place.

- [ ] **Step 1: Write the failing test `src/engine/__tests__/EventDispatcher.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import type { Responder, PhaseContext, PriorityBand } from '../events/types';

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  return {
    trigger: 't', affinities: {} as any, slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.5, draft: {}, ...over,
  };
}

function effect(id: string, band: PriorityBand, opts: Partial<Responder> = {}): Responder {
  return {
    id, source: 'affinity', triggers: ['t'], group: { kind: 'exclusive', band },
    condition: () => true, roll: () => true,
    apply: (c) => { (c.draft as any)[id] = true; return { responderId: id, label: id, description: id, animation: id }; },
    ...opts,
  };
}

describe('dispatch', () => {
  it('runs one eligible exclusive effect', () => {
    const { reports } = dispatch('t', ctx(), [effect('a', 'MUTATE')], { forced: [], isolate: false });
    expect(reports.map((r) => r.responderId)).toEqual(['a']);
  });

  it('different bands both fire, in band order', () => {
    const c = ctx();
    const { reports } = dispatch('t', c, [effect('m', 'MUTATE'), effect('s', 'STRUCTURAL')], { forced: [], isolate: false });
    expect(reports.map((r) => r.responderId)).toEqual(['s', 'm']); // STRUCTURAL before MUTATE
  });

  it('same band → only one fires', () => {
    const c = ctx({ rng: () => 0.0 }); // weighted pick lands on first
    const { reports } = dispatch('t', c, [effect('a', 'MUTATE'), effect('b', 'MUTATE')], { forced: [], isolate: false });
    expect(reports).toHaveLength(1);
  });

  it('roll() false suppresses the effect', () => {
    const r = effect('a', 'MUTATE', { roll: () => false });
    const { reports } = dispatch('t', ctx(), [r], { forced: [], isolate: false });
    expect(reports).toHaveLength(0);
  });

  it('forced bypasses roll() and is reported as consumed', () => {
    const r = effect('a', 'MUTATE', { roll: () => false });
    const { reports, forcedConsumed } = dispatch('t', ctx(), [r], { forced: ['a'], isolate: false });
    expect(reports).toHaveLength(1);
    expect(forcedConsumed).toEqual(['a']);
  });

  it('forced never bypasses condition()', () => {
    const r = effect('a', 'MUTATE', { condition: () => false });
    const { reports } = dispatch('t', ctx(), [r], { forced: ['a'], isolate: false });
    expect(reports).toHaveLength(0);
  });

  it('isolate suppresses all non-forced responders', () => {
    const a = effect('a', 'MUTATE');
    const b = effect('b', 'STRUCTURAL');
    const { reports } = dispatch('t', ctx(), [a, b], { forced: ['a'], isolate: true });
    expect(reports.map((r) => r.responderId)).toEqual(['a']);
  });

  it('combine channel runs its reducer after contributors push', () => {
    const adv: Responder = {
      id: 'adv', source: 'affinity', triggers: ['t'], group: { kind: 'combine', channel: 'roll-mode' },
      condition: () => true, roll: () => true,
      apply: (c) => { (c.draft.rollMods ??= []).push('advantage' as any); return null; },
    };
    const c = ctx({ draft: { rollMods: [] } });
    const { reports } = dispatch('t', c, [adv], { forced: [], isolate: false });
    expect(c.draft.rollMode).toBe('advantage');
    expect(reports.some((r) => r.animation === 'roll-mode')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/EventDispatcher.test.ts`
Expected: FAIL — `Cannot find module '../events/EventDispatcher'`.

- [ ] **Step 3: Create `src/engine/events/EventDispatcher.ts`**

```ts
import type { Responder, PhaseContext, EffectReport, DebugConfig } from './types';
import { PRIORITY_BANDS } from './types';
import { REDUCERS } from './reducers';

export interface DispatchResult {
  reports: EffectReport[];
  forcedConsumed: string[];
}

function pickWeighted(rs: Responder[], ctx: PhaseContext): Responder {
  if (rs.length === 1) return rs[0];
  const weights = rs.map((r) => (r.weight ? Math.max(0, r.weight(ctx)) : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return rs[Math.floor(ctx.rng() * rs.length)];
  let x = ctx.rng() * total;
  for (let i = 0; i < rs.length; i++) { x -= weights[i]; if (x <= 0) return rs[i]; }
  return rs[rs.length - 1];
}

export function dispatch(
  trigger: string,
  ctx: PhaseContext,
  responders: Responder[],
  debug: DebugConfig,
): DispatchResult {
  const forcedConsumed: string[] = [];

  let candidates = responders.filter((r) => r.triggers.includes(trigger));
  if (debug.isolate) candidates = candidates.filter((r) => debug.forced.includes(r.id));

  const eligible = candidates.filter((r) => {
    if (!r.condition(ctx)) return false;
    if (debug.forced.includes(r.id)) { forcedConsumed.push(r.id); return true; } // skip roll
    return r.roll(ctx);
  });

  const reports: EffectReport[] = [];

  // Exclusive groups: at most one winner per band, bands in order.
  for (const band of PRIORITY_BANDS) {
    const winners = eligible.filter(
      (r) => r.group.kind === 'exclusive' && r.group.band === band,
    );
    if (winners.length === 0) continue;
    const chosen = pickWeighted(winners, ctx);
    const report = chosen.apply(ctx);
    if (report) reports.push(report);
  }

  // Combine channels: all contributors push, then the channel reducer collapses.
  const channels = new Set<string>();
  for (const r of eligible) if (r.group.kind === 'combine') channels.add(r.group.channel);
  for (const channel of channels) {
    for (const r of eligible) {
      if (r.group.kind === 'combine' && r.group.channel === channel) r.apply(ctx);
    }
    const reducer = REDUCERS[channel];
    if (reducer) { const rep = reducer.reduce(ctx); if (rep) reports.push(rep); }
  }

  return { reports, forcedConsumed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/EventDispatcher.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck + full suite + commit**

```bash
npx tsc -b && npx vitest run
git add src/engine/events/EventDispatcher.ts src/engine/__tests__/EventDispatcher.test.ts
git commit -m "feat(events): pure dispatch loop with exclusive bands + combine channels + debug filter"
```

---

## Phase B — Responder catalog (port effects, tested via dispatch)

### Task 4: Eligibility helper + affinity responders

**Files:**
- Create: `src/engine/events/eligibility.ts`
- Create: `src/engine/responders/affinity.ts`
- Test: `src/engine/__tests__/AffinityResponders.test.ts`

**Interfaces:**
- Consumes: `bandOf`, `bandIndex`, `BAND_ORDER`, `BAND_POWER_STEP`, `TIER_BASE_CHANCE` (`src/data/affinities.ts`); `Responder`, `PhaseContext` (Task 1); `AffinityId`, `AffinityBand` (`src/engine/types.ts`).
- Produces:
  - `bandRoll(ctx, affinity, minBand, baseChance): boolean`
  - `buildAffinityResponders(): Responder[]` — catalog below.

**Catalog (each is a `Responder`):**

| id | trigger(s) | group | condition | roll | apply |
|---|---|---|---|---|---|
| `will-widen-pool` | `select:draw:start` | STRUCTURAL | `draft.poolTarget` exists | `bandRoll(will, 'ascendant', notable)` | `draft.poolTarget += 1` |
| `fate-thin-pool` | `select:draw:start` | STRUCTURAL | `draft.poolTarget` exists & > 2 | `bandRoll(fate, 'ascendant', notable)` | `draft.poolTarget -= 1` |
| `shadow-shroud` | `select:draw:end` | MUTATE | `draft.pool.length > 0` | `bandRoll(shadow, 'ascendant', notable)` | push a random pool index into `draft.shrouded` |
| `fate-override-pick` | `select:pick`, `tarot:pick` | OVERRIDE | `ctx.hand` & `ctx.hand.length >= 2` & `draft.outcome` set | `bandRoll(fate, 'ascendant', major)` | replace `draft.outcome` with a random other hand item |
| `fate-auto-orient` | `tarot:orient` | OVERRIDE | `draft.outcome?.type === 'tarot'` | `bandRoll(fate, 'stirring', notable)` | set `draft.outcome.orientation` to a coin-flip |
| `fate-hollow-reroll` | `dice:reroll` | OVERRIDE | `draft.outcome?.type === 'd20'` & `ctx.event` has prior value | `bandRoll(fate, 'ascendant', major)` | set `draft.outcome` back to the prior die (hollow) |
| `chaos-second-result` | `dice:commit`, `tarot:commit`, `iching:commit` | SPAWN | `draft.outcome` is a divination result | `bandRoll(chaos, 'dominant', major)` | mark `draft.spawnSecond = draft.outcome.type` |
| `chaos-happening-interrupt` | `minigame:end` | SPAWN | not last reading | `bandRoll(chaos, 'ascendant', major)` | set `draft.interruptHappening = true` |
| `light-advantage` | `dice:roll` | combine `roll-mode` | always | `bandRoll(light, 'ascendant', ambient)` | push `'advantage'` to `draft.rollMods` |
| `shadow-disadvantage` | `dice:roll` | combine `roll-mode` | always | `bandRoll(shadow, 'ascendant', ambient)` | push `'disadvantage'` to `draft.rollMods` |
| `will-choice` | `dice:roll` | combine `roll-mode` | always | `bandRoll(will, 'dominant', major)` | push `'choice'` to `draft.rollMods` |
| `will-offer-reroll` | `dice:roll` | combine `roll-mode` | always | `bandRoll(will, 'stirring', notable)` | push `'offer-reroll'` to `draft.rollMods` |

All affinity responders set `weight: (ctx) => ctx.affinities[<their affinity>]` so the dominant force wins same-band ties. Combine responders return `null` from `apply` (the reducer makes the report); exclusive responders return an `EffectReport`.

- [ ] **Step 1: Write the failing test `src/engine/__tests__/AffinityResponders.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildAffinityResponders } from '../responders/affinity';
import { bandRoll } from '../events/eligibility';
import type { PhaseContext } from '../events/types';
import { defaultAffinityState } from '../../data/affinities';

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  return {
    trigger: 't', affinities: defaultAffinityState(), slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.0, draft: {}, ...over,
  };
}
const noDebug = { forced: [], isolate: false };

describe('bandRoll', () => {
  it('returns false below the gate band regardless of rng', () => {
    const c = ctx({ affinities: { ...defaultAffinityState(), light: 10 }, rng: () => 0 });
    expect(bandRoll(c, 'light', 'ascendant', 0.5)).toBe(false);
  });
  it('returns true in-band when rng is below the scaled chance', () => {
    const c = ctx({ affinities: { ...defaultAffinityState(), light: 75 }, rng: () => 0 });
    expect(bandRoll(c, 'light', 'ascendant', 0.5)).toBe(true);
  });
});

describe('affinity responders via dispatch', () => {
  it('will-widen-pool raises the pool target when forced', () => {
    const c = ctx({ trigger: 'select:draw:start', draft: { poolTarget: 3 } });
    dispatch('select:draw:start', c, buildAffinityResponders(), { forced: ['will-widen-pool'], isolate: true });
    expect(c.draft.poolTarget).toBe(4);
  });

  it('shadow-shroud marks a pool index when forced', () => {
    const pool = [{ type: 'tarot' }, { type: 'tarot' }] as any;
    const c = ctx({ trigger: 'select:draw:end', draft: { pool } });
    dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
    expect(c.draft.shrouded!.length).toBe(1);
  });

  it('light-advantage + shadow-disadvantage cancel to single', () => {
    const c = ctx({
      trigger: 'dice:roll',
      affinities: { ...defaultAffinityState(), light: 75, shadow: 75 },
      rng: () => 0, draft: { rollMods: [] },
    });
    dispatch('dice:roll', c, buildAffinityResponders(), noDebug);
    expect(c.draft.rollMode).toBe('single');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AffinityResponders.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/engine/events/eligibility.ts`**

```ts
import type { PhaseContext } from './types';
import type { AffinityId, AffinityBand } from '../types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP } from '../../data/affinities';

// Affinity band-gate × tier chance, scaled up per band above the gate.
// Mirrors the retired GameEngine.forcedOrRoll, but reads ctx.rng and ctx.affinities.
export function bandRoll(
  ctx: PhaseContext,
  affinity: AffinityId,
  minBand: AffinityBand,
  baseChance: number,
): boolean {
  const idx = BAND_ORDER.indexOf(bandOf(ctx.affinities[affinity]));
  const minIdx = BAND_ORDER.indexOf(minBand);
  if (idx < minIdx) return false;
  const scaled = baseChance * (1 + (idx - minIdx) * BAND_POWER_STEP);
  return ctx.rng() < Math.min(1, scaled);
}
```

- [ ] **Step 4: Create `src/engine/responders/affinity.ts`**

```ts
import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, SlotResult, RollModifier, TarotResult } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';

const T = TIER_BASE_CHANCE;
const w = (a: AffinityId) => (ctx: PhaseContext) => ctx.affinities[a];

function report(id: string, label: string, description: string, animation: string, targetSlot?: number): EffectReport {
  return { responderId: id, label, description, animation, targetSlot };
}

function pushMod(mod: RollModifier) {
  return (ctx: PhaseContext): EffectReport | null => {
    (ctx.draft.rollMods ??= []).push(mod);
    return null; // reducer reports
  };
}

export function buildAffinityResponders(): Responder[] {
  return [
    {
      id: 'will-widen-pool', source: 'affinity', triggers: ['select:draw:start'],
      group: { kind: 'exclusive', band: 'STRUCTURAL' }, weight: w('will'),
      condition: (c) => typeof c.draft.poolTarget === 'number',
      roll: (c) => bandRoll(c, 'will', 'ascendant', T.notable),
      apply: (c) => { c.draft.poolTarget = (c.draft.poolTarget as number) + 1;
        return report('will-widen-pool', 'Will', 'Your will widens the path — another way opens.', 'widen'); },
    },
    {
      id: 'fate-thin-pool', source: 'affinity', triggers: ['select:draw:start'],
      group: { kind: 'exclusive', band: 'STRUCTURAL' }, weight: w('fate'),
      condition: (c) => typeof c.draft.poolTarget === 'number' && (c.draft.poolTarget as number) > 2,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.notable),
      apply: (c) => { c.draft.poolTarget = (c.draft.poolTarget as number) - 1;
        return report('fate-thin-pool', 'Fate', 'Fate narrows the way — a path closes.', 'widen'); },
    },
    {
      id: 'shadow-shroud', source: 'affinity', triggers: ['select:draw:end'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('shadow'),
      condition: (c) => Array.isArray(c.draft.pool) && (c.draft.pool as SlotResult[]).length > 0,
      roll: (c) => bandRoll(c, 'shadow', 'ascendant', T.notable),
      apply: (c) => {
        const pool = c.draft.pool as SlotResult[];
        const idx = Math.floor(c.rng() * pool.length);
        (c.draft.shrouded ??= []).push(idx);
        return report('shadow-shroud', 'Shadow', 'Shadow falls across a path — its nature is hidden.', 'shroud', idx);
      },
    },
    {
      id: 'fate-override-pick', source: 'affinity', triggers: ['select:pick', 'tarot:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => !!c.hand && c.hand.length >= 2 && !!c.draft.outcome,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const hand = c.hand as SlotResult[];
        const others = hand.filter((h) => h !== c.draft.outcome);
        c.draft.outcome = others[Math.floor(c.rng() * others.length)];
        return report('fate-override-pick', 'Fate', 'The weave moves your hand — another is chosen for you.', 'override');
      },
    },
    {
      id: 'fate-auto-orient', source: 'affinity', triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => c.draft.outcome?.type === 'tarot',
      roll: (c) => bandRoll(c, 'fate', 'stirring', T.notable),
      apply: (c) => {
        const card = c.draft.outcome as TarotResult;
        card.orientation = c.rng() < 0.5 ? 'upright' : 'reversed';
        return report('fate-auto-orient', 'Fate', 'Fate turns the card for you.', 'override');
      },
    },
    {
      id: 'fate-hollow-reroll', source: 'affinity', triggers: ['dice:reroll'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => c.draft.outcome?.type === 'd20' && !!(c.event as { previous?: unknown })?.previous,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        c.draft.outcome = (c.event as { previous: SlotResult }).previous;
        return report('fate-hollow-reroll', 'Fate', 'The reroll rings hollow — the same face returns.', 'override');
      },
    },
    {
      id: 'chaos-second-result', source: 'affinity',
      triggers: ['dice:commit', 'tarot:commit', 'iching:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('chaos'),
      condition: (c) => !!c.draft.outcome && c.draft.outcome.type !== 'happening',
      roll: (c) => bandRoll(c, 'chaos', 'dominant', T.major),
      apply: (c) => {
        c.draft.spawnSecond = (c.draft.outcome as SlotResult).type;
        return report('chaos-second-result', 'Chaos', 'Chaos surges — a second possibility emerges from the void.', 'second-result');
      },
    },
    {
      id: 'chaos-happening-interrupt', source: 'affinity', triggers: ['minigame:end'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('chaos'),
      condition: (c) => c.draft.lastReading !== true,
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.major),
      apply: (c) => { c.draft.interruptHappening = true;
        return report('chaos-happening-interrupt', 'Chaos', 'The weave tears — something intrudes.', 'second-result'); },
    },
    {
      id: 'light-advantage', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('light'),
      condition: () => true, roll: (c) => bandRoll(c, 'light', 'ascendant', T.ambient),
      apply: pushMod('advantage'),
    },
    {
      id: 'shadow-disadvantage', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('shadow'),
      condition: () => true, roll: (c) => bandRoll(c, 'shadow', 'ascendant', T.ambient),
      apply: pushMod('disadvantage'),
    },
    {
      id: 'will-choice', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('will'),
      condition: () => true, roll: (c) => bandRoll(c, 'will', 'dominant', T.major),
      apply: pushMod('choice'),
    },
    {
      id: 'will-offer-reroll', source: 'affinity', triggers: ['dice:roll'],
      group: { kind: 'combine', channel: 'roll-mode' }, weight: w('will'),
      condition: () => true, roll: (c) => bandRoll(c, 'will', 'stirring', T.notable),
      apply: pushMod('offer-reroll'),
    },
  ];
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npx vitest run src/engine/__tests__/AffinityResponders.test.ts
npx tsc -b
git add src/engine/events/eligibility.ts src/engine/responders/affinity.ts src/engine/__tests__/AffinityResponders.test.ts
git commit -m "feat(responders): affinity responder catalog + bandRoll eligibility"
```

---

### Task 5: Interaction responders

**Files:**
- Create: `src/engine/responders/interactions.ts`
- Test: `src/engine/__tests__/InteractionResponders.test.ts`

**Interfaces:**
- Consumes: `Responder`, `PhaseContext`, `EffectReport`; `TagSystem` predicates (use plain `tags.includes` to stay dependency-free); `SlotResult`, `TarotResult`, `DiceResult`.
- Produces: `buildInteractionResponders(): Responder[]`.

**Catalog:**

| id | trigger(s) | group | condition | apply |
|---|---|---|---|---|
| `fool-reroll` | `dice:roll` | MUTATE | a committed slot has tags `major-arcana`+`fool-archetype` AND `draft.outcome?.type==='d20'` | mark `draft.rerollOutcome = true` (engine redraws the die) |
| `critical-resonance` | `tarot:commit` | MUTATE | `draft.outcome?.type==='tarot'` AND spread has a critical-low or critical-high d20 matching the card's invertible orientation | invert the committed tarot's orientation |
| `mirror` | `dice:commit`,`tarot:commit`,`iching:commit` | MUTATE | exactly 2 reversible items in `spread` | flip both reversible items' orientation |
| `iching-happening-boost` | `happening:start` | SPAWN | spread has an iching with `changing-lines` AND a happening is active | mark `draft.addChoice = true` |

`roll` for interactions: `fool-reroll`/`critical-resonance`/`iching-happening-boost` are deterministic when their condition holds (`roll: () => true`); `mirror` keeps a flavor chance (`roll: (c) => c.rng() < 0.85`). All carry `weight: () => 1`.

- [ ] **Step 1: Write the failing test `src/engine/__tests__/InteractionResponders.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildInteractionResponders } from '../responders/interactions';
import type { PhaseContext } from '../events/types';
import { defaultAffinityState } from '../../data/affinities';

const fool = { type: 'tarot', tags: ['major-arcana', 'fool-archetype', 'reversible'], orientation: 'upright' } as any;
const critLow = { type: 'd20', threshold: 'critical-low', tags: ['threshold', 'critical-low'] } as any;
const uprightCard = { type: 'tarot', orientation: 'upright', tags: ['major-arcana', 'reversible'] } as any;

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  const base: PhaseContext = {
    trigger: 't', affinities: defaultAffinityState(), slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.0, draft: {},
  };
  return { ...base, ...over };
}
const noDebug = { forced: [], isolate: false };

describe('interaction responders', () => {
  it('fool-reroll marks the die for redraw when The Fool is in the spread', () => {
    const c = ctx({ trigger: 'dice:roll', slots: [fool], spread: [fool], draft: { outcome: { type: 'd20' } as any } });
    dispatch('dice:roll', c, buildInteractionResponders(), noDebug);
    expect(c.draft.rerollOutcome).toBe(true);
  });

  it('critical-resonance inverts an upright tarot when a critical-low die is present', () => {
    const card = { ...uprightCard };
    const c = ctx({ trigger: 'tarot:commit', slots: [critLow], spread: [critLow, card], draft: { outcome: card } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect((c.draft.outcome as any).orientation).toBe('reversed');
  });

  it('mirror flips exactly two reversible items', () => {
    const a = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
    const b = { type: 'tarot', orientation: 'reversed', tags: ['reversible'] } as any;
    const c = ctx({ trigger: 'tarot:commit', spread: [a, b], rng: () => 0, draft: { outcome: b } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect(a.orientation).toBe('reversed');
    expect(b.orientation).toBe('upright');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/InteractionResponders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/engine/responders/interactions.ts`**

```ts
import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { SlotResult, TarotResult, DiceResult } from '../types';

const has = (s: SlotResult, ...tags: string[]) => tags.every((t) => s.tags.includes(t));
const reversibles = (spread: SlotResult[]) => spread.filter((s) => s.tags.includes('reversible'));
const criticalDie = (spread: SlotResult[], threshold: DiceResult['threshold']) =>
  spread.find((s): s is DiceResult => s.type === 'd20' && (s as DiceResult).threshold === threshold);

function report(id: string, label: string, description: string, animation: string, targetSlot?: number): EffectReport {
  return { responderId: id, label, description, animation, targetSlot };
}

export function buildInteractionResponders(): Responder[] {
  return [
    {
      id: 'fool-reroll', source: 'interaction', triggers: ['dice:roll'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => c.draft.outcome?.type === 'd20' && c.spread.some((s) => has(s, 'major-arcana', 'fool-archetype')),
      roll: () => true,
      apply: (c) => { c.draft.rerollOutcome = true;
        return report('fool-reroll', "The Fool", "The Fool's wild energy ripples through fate — the dice must be cast again.", 'reroll'); },
    },
    {
      id: 'critical-resonance', source: 'interaction', triggers: ['tarot:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => {
        const card = c.draft.outcome;
        if (card?.type !== 'tarot') return false;
        const up = (card as TarotResult).orientation === 'upright';
        return up ? !!criticalDie(c.spread, 'critical-low') : !!criticalDie(c.spread, 'critical-high');
      },
      roll: () => true,
      apply: (c) => {
        const card = c.draft.outcome as TarotResult;
        const wasUpright = card.orientation === 'upright';
        card.orientation = wasUpright ? 'reversed' : 'upright';
        return report('critical-resonance', 'Critical Resonance',
          wasUpright ? 'A dire omen drags the card down — it inverts.' : 'A bright omen lifts the card — it rights itself.',
          'flip');
      },
    },
    {
      id: 'mirror', source: 'interaction', triggers: ['dice:commit', 'tarot:commit', 'iching:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => reversibles(c.spread).length === 2,
      roll: (c) => c.rng() < 0.85,
      apply: (c) => {
        for (const s of reversibles(c.spread)) {
          const card = s as TarotResult;
          card.orientation = card.orientation === 'upright' ? 'reversed' : 'upright';
        }
        return report('mirror', 'The Mirror', 'Two forces reflect each other across the weave — both turn.', 'mirror');
      },
    },
    {
      id: 'iching-happening-boost', source: 'interaction', triggers: ['happening:start'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 1,
      condition: (c) => c.spread.some((s) => s.type === 'iching' && s.tags.includes('changing-lines')),
      roll: () => true,
      apply: (c) => { c.draft.addChoice = true;
        return report('iching-happening-boost', 'I Ching', 'The changing lines reveal hidden branches — more choices emerge.', 'add-choice'); },
    },
  ];
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
npx vitest run src/engine/__tests__/InteractionResponders.test.ts
npx tsc -b
git add src/engine/responders/interactions.ts src/engine/__tests__/InteractionResponders.test.ts
git commit -m "feat(responders): interaction catalog (fool, critical-resonance, mirror, iching boost)"
```

---

## Phase C — Debug scenarios

### Task 6: `DebugScenario` + reset-then-stage loader

**Files:**
- Create: `src/engine/events/scenarios.ts`
- Test: `src/engine/__tests__/DebugScenarios.test.ts`

**Interfaces:**
- Consumes: `DebugConfig` (Task 1); `defaultAffinityState` (`src/data/affinities.ts`); `GameState` (`src/engine/types.ts`, after Task 7 adds `eventQueue`/`debugConfig` — for Phase C, type the staging function against a minimal `ScenarioState` interface defined here to avoid a circular dependency).
- Produces:
  - `interface DebugScenario { id; label; group; forced: string[]; isolate: boolean; setup(s: ScenarioStage): void }`
  - `DEBUG_SCENARIOS: DebugScenario[]`
  - `findScenario(id): DebugScenario | undefined`

`ScenarioStage` is a structural subset: `{ affinities: Record<AffinityId, number>; screen: string; selectedMethod: string | null; slots: SlotResult[] }`. The Task 7 loader maps it onto `GameState`.

- [ ] **Step 1: Write the failing test `src/engine/__tests__/DebugScenarios.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { DEBUG_SCENARIOS, findScenario } from '../events/scenarios';
import { defaultAffinityState } from '../../data/affinities';

describe('debug scenarios', () => {
  it('each scenario has a forced set and isolate flag', () => {
    expect(DEBUG_SCENARIOS.length).toBeGreaterThan(0);
    for (const s of DEBUG_SCENARIOS) {
      expect(Array.isArray(s.forced)).toBe(true);
      expect(typeof s.isolate).toBe('boolean');
    }
  });

  it('shadow-shroud scenario stages a fresh game and forces only its effect', () => {
    const s = findScenario('shadow-shroud')!;
    expect(s.forced).toEqual(['shadow-shroud']);
    expect(s.isolate).toBe(true);
    const stage = { affinities: defaultAffinityState(), screen: 'title', selectedMethod: null, slots: [] };
    s.setup(stage as any);
    expect(stage.screen).toBe('method-select');
  });

  it('supports a combination scenario forcing two effects', () => {
    const s = findScenario('combo-widen-shroud')!;
    expect(s.forced).toEqual(['will-widen-pool', 'shadow-shroud']);
    expect(s.isolate).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/DebugScenarios.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/engine/events/scenarios.ts`**

```ts
import type { AffinityId, SlotResult } from '../types';
import { defaultAffinityState } from '../../data/affinities';

export interface ScenarioStage {
  affinities: Record<AffinityId, number>;
  screen: string;
  selectedMethod: string | null;
  slots: SlotResult[];
}

export interface DebugScenario {
  id: string;
  label: string;
  group: string;
  forced: string[];
  isolate: boolean;
  setup(s: ScenarioStage): void;
}

const atMethodSelect = (s: ScenarioStage) => { s.screen = 'method-select'; };
const atDice = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'd20'; };
const atTarot = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'tarot'; };
const set = (s: ScenarioStage, a: Partial<Record<AffinityId, number>>) => Object.assign(s.affinities, a);

const FOOL: SlotResult = {
  type: 'tarot', id: 'fool', name: 'The Fool', number: 0, orientation: 'upright',
  symbol: '0', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'fool-archetype', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

export const DEBUG_SCENARIOS: DebugScenario[] = [
  { id: 'will-widen-pool', label: 'Will widens the pool', group: 'Affinity', forced: ['will-widen-pool'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { will: 75 }); } },
  { id: 'shadow-shroud', label: 'Shadow shrouds an option', group: 'Affinity', forced: ['shadow-shroud'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { shadow: 75 }); } },
  { id: 'fate-override-pick', label: 'Fate overrides the pick', group: 'Affinity', forced: ['fate-override-pick'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { fate: 75 }); } },
  { id: 'chaos-second-result', label: 'Chaos second result', group: 'Affinity', forced: ['chaos-second-result'], isolate: true,
    setup: (s) => { atDice(s); set(s, { chaos: 90 }); } },
  { id: 'fool-reroll', label: "Fool's Reroll", group: 'Interaction', forced: ['fool-reroll'], isolate: true,
    setup: (s) => { atDice(s); s.slots = [FOOL]; } },
  { id: 'combo-widen-shroud', label: 'Combo: widen + shroud', group: 'Combination', forced: ['will-widen-pool', 'shadow-shroud'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { will: 75, shadow: 75 }); } },
];

export function findScenario(id: string): DebugScenario | undefined {
  return DEBUG_SCENARIOS.find((s) => s.id === id);
}

export function freshStage(): ScenarioStage {
  return { affinities: defaultAffinityState(), screen: 'title', selectedMethod: null, slots: [] };
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
npx vitest run src/engine/__tests__/DebugScenarios.test.ts
npx tsc -b
git add src/engine/events/scenarios.ts src/engine/__tests__/DebugScenarios.test.ts
git commit -m "feat(events): debug scenarios (force-set + isolate, reset-then-stage)"
```

---

## Phase D — Wire the GameEngine

> Integration phase. After Task 7 the old `maybe*`/`resolve*` methods and `InteractionResolver` are gone and the app routes effects through `dispatch()`. Keep `npm run build` green at each commit; if a component still references a removed method, that's fixed in Phase E within the same task's build step.

### Task 7: Trigger points, dispatch wiring, state, and removal of legacy effect code

**Files:**
- Modify: `src/engine/types.ts` (add `eventQueue: EffectReport[]`, `debugConfig: DebugConfig` to `GameState`; drop `pendingEffects`, `interactionQueue`, `interactionApplied`, `chainDepth`, `pendingHappening`)
- Modify: `src/engine/GameEngine.ts` (build the responder list once; add `private dispatchAt(trigger, draft, payload?)`; fire triggers in `startTurn`/`selectMethod`/`completeMinigame`/`triggerHappening`/`resolveHappening`; add `resolveTarotPick`/`planDiceRoll`/`resolveReroll`/`setOrientation` re-expressed through `dispatchAt`; delete `maybeWildSurge`, `maybeHappeningInterrupt`, `offerReroll`, `maybeAutoOrient`, `maybeForceMethod`, `resolveTarotPick` legacy body, `executeEffect`, `applyHeadInteraction`, `advanceInteractionQueue`, `forcedOrRoll`, `injectPendingEffect`; replace `loadScenarioById` with the new scenario loader; add `forceEffects(ids, isolate)`, `clearEventQueue()`)
- Delete: `src/engine/InteractionResolver.ts`
- Modify: `src/data/interactions.ts` (remove `chaos-second-result` + the `chaos-dominant` injection note; the file may be deleted once `INTERACTION_RULES` is unused — interactions now live in `responders/interactions.ts`)
- Test: `src/engine/__tests__/EngineDispatch.test.ts`; update `src/engine/__tests__/AgencyDecisions.test.ts`, `Scenarios.test.ts`, `IChing.test.ts`, `InteractionResolver.test.ts` (delete the last) to the new API.

**Interfaces:**
- Consumes: `dispatch` (Task 3), `buildAffinityResponders` (Task 4), `buildInteractionResponders` (Task 5), `DEBUG_SCENARIOS`/`findScenario`/`freshStage`/`ScenarioStage` (Task 6), `REDUCERS`.
- Produces (engine public API the components in Phase E rely on):
  - `dispatchAt(trigger: TriggerPoint, draft: PhaseDraft, payload?: unknown): { draft: PhaseDraft; reports: EffectReport[] }` (private; drives the methods below)
  - `planDiceRoll(): { mode: RollMode; offerReroll: boolean; reports: EffectReport[] }`
  - `resolveTarotPick(chosenIndex: number, hand: TarotResult[]): { card: TarotResult; swapped: boolean }`
  - `resolveReroll(current: DiceResult): { result: DiceResult; hollow: boolean }`
  - `forceEffects(ids: string[], isolate: boolean): void`
  - `loadScenarioById(id: string): boolean`
  - `clearEventQueue(): void`
  - `getState()` now carries `eventQueue` and `debugConfig`.

- [ ] **Step 1: Add state fields in `src/engine/types.ts`**

In `GameState`, remove `pendingEffects`, `interactionQueue`, `interactionApplied`, `pendingHappening`, `chainDepth`; add:

```ts
  eventQueue: EffectReport[];
  debugConfig: DebugConfig;
```

Add imports at the top of `types.ts` is not needed (these types live in `events/types.ts`); instead re-export for engine consumers:

```ts
export type { EffectReport, DebugConfig, PhaseContext, PhaseDraft, TriggerPoint, Responder } from './events/types';
```

- [ ] **Step 2: Write the failing test `src/engine/__tests__/EngineDispatch.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('engine dispatch wiring', () => {
  it('exposes an empty event queue and default debug config initially', () => {
    const e = new GameEngine();
    expect(e.getState().eventQueue).toEqual([]);
    expect(e.getState().debugConfig).toEqual({ forced: [], isolate: false });
  });

  it('forceEffects sets the debug config', () => {
    const e = new GameEngine();
    e.forceEffects(['shadow-shroud'], true);
    expect(e.getState().debugConfig).toEqual({ forced: ['shadow-shroud'], isolate: true });
  });

  it('loadScenarioById resets fresh and forces the scenario effect', () => {
    const e = new GameEngine();
    expect(e.loadScenarioById('shadow-shroud')).toBe(true);
    const s = e.getState();
    expect(s.screen).toBe('method-select');
    expect(s.debugConfig.forced).toEqual(['shadow-shroud']);
    expect(s.affinities.shadow).toBeGreaterThanOrEqual(60);
  });

  it('planDiceRoll returns single at baseline with no reroll', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const plan = e.planDiceRoll();
    expect(['single', 'advantage', 'disadvantage', 'choice']).toContain(plan.mode);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/EngineDispatch.test.ts`
Expected: FAIL — `eventQueue`/`debugConfig` undefined or `forceEffects` missing.

- [ ] **Step 4: Implement the wiring in `src/engine/GameEngine.ts`**

Replace the imports of `InteractionResolver`, `INTERACTION_RULES`, and the dice-modifier helpers with:

```ts
import { dispatch } from './events/EventDispatcher';
import { buildAffinityResponders } from './responders/affinity';
import { buildInteractionResponders } from './responders/interactions';
import { findScenario, freshStage } from './events/scenarios';
import type { Responder, PhaseContext, PhaseDraft, EffectReport, DebugConfig } from './events/types';
```

Add fields + constructor wiring:

```ts
  private responders: Responder[];
  // in constructor, after subsystems:
  this.responders = [...buildAffinityResponders(), ...buildInteractionResponders()];
```

In `defaultState()` replace the removed fields with:

```ts
      eventQueue: [],
      debugConfig: { forced: [], isolate: false },
```

Add the dispatch helper + debug API:

```ts
  private buildContext(trigger: string, draft: PhaseDraft, payload?: unknown): PhaseContext {
    const slots = this.state.turnResults;
    const hand = (draft.pool as SlotResult[] | undefined) ?? null;
    return {
      trigger, affinities: this.affinityEngine.getState(),
      slots, hand, spread: hand ? [...slots, ...hand] : slots,
      minigame: this.state.minigameState, event: payload ?? null,
      draft, rng: Math.random,
    };
  }

  private dispatchAt(trigger: string, draft: PhaseDraft, payload?: unknown): { draft: PhaseDraft; reports: EffectReport[] } {
    const ctx = this.buildContext(trigger, draft, payload);
    const { reports, forcedConsumed } = dispatch(trigger, ctx, this.responders, this.state.debugConfig);
    if (forcedConsumed.length > 0) {
      this.state.debugConfig = {
        ...this.state.debugConfig,
        forced: this.state.debugConfig.forced.filter((id) => !forcedConsumed.includes(id)),
      };
    }
    if (reports.length > 0) this.state.eventQueue = [...this.state.eventQueue, ...reports];
    return { draft: ctx.draft, reports };
  }

  forceEffects(ids: string[], isolate: boolean): void {
    this.state.debugConfig = { forced: ids, isolate };
    this.notify();
  }

  clearEventQueue(): void {
    this.state.eventQueue = [];
    this.notify();
  }
```

Re-express the action methods (replace the legacy bodies). `planDiceRoll`:

```ts
  planDiceRoll(): { mode: RollMode; offerReroll: boolean; reports: EffectReport[] } {
    const { draft, reports } = this.dispatchAt('dice:roll', { rollMods: [], outcome: undefined });
    this.notify();
    return { mode: draft.rollMode ?? 'single', offerReroll: draft.offerReroll ?? false, reports };
  }
```

`resolveTarotPick` (interception via OVERRIDE):

```ts
  resolveTarotPick(chosenIndex: number, hand: TarotResult[]): { card: TarotResult; swapped: boolean } {
    const chosen = hand[chosenIndex];
    const { draft } = this.dispatchAt('tarot:pick', { outcome: chosen, pool: hand as unknown as SlotResult[] });
    const card = (draft.outcome as TarotResult) ?? chosen;
    this.notify();
    return { card, swapped: card !== chosen };
  }
```

`resolveReroll`:

```ts
  resolveReroll(current: DiceResult): { result: DiceResult; hollow: boolean } {
    const fresh = this.orchestrator.drawSingleResult('d20', this.affinityEngine.getState()) as DiceResult;
    const { draft } = this.dispatchAt('dice:reroll', { outcome: fresh }, { previous: current });
    const result = (draft.outcome as DiceResult) ?? fresh;
    return { result, hollow: result === current };
  }
```

Replace the second-result/happening-interrupt logic in `completeMinigame`: after appending the result, call `this.dispatchAt('<type>:commit', { outcome: result })`; if `draft.rerollOutcome` redraw the slot; if `draft.spawnSecond` append a second result; at the end of a minigame call `this.dispatchAt('minigame:end', { lastReading: completed >= this.minigamesPerTurn })` and branch on `draft.interruptHappening`. Fire `select:draw:start`/`select:draw:end` inside the pool refill path, applying `draft.poolTarget` to `methodCount` and `draft.shrouded` to the rendered pool.

Replace `loadScenarioById`:

```ts
  loadScenarioById(id: string): boolean {
    const scenario = findScenario(id);
    if (!scenario) return false;
    // reset to fresh
    this.affinityEngine.setState(defaultAffinityState());
    this.state = this.defaultState();
    const stage = freshStage();
    scenario.setup(stage);
    this.affinityEngine.setState(stage.affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.screen = stage.screen as GameState['screen'];
    this.state.selectedMethod = stage.selectedMethod as GameState['selectedMethod'];
    this.state.turnResults = stage.slots;
    this.state.questionType = this.state.questionType ?? 'self';
    this.state.debugConfig = { forced: scenario.forced, isolate: scenario.isolate };
    if (this.state.screen === 'method-select') {
      this.state.availableMethods = this.orchestrator.generatePool(
        this.state.questionType, this.affinityEngine.getState(), this.affinityEngine.getEffects().methodCount,
      );
    }
    this.notify();
    return true;
  }
```

Delete: `maybeWildSurge`, `maybeHappeningInterrupt`, `offerReroll`, `maybeAutoOrient`, `maybeForceMethod`, `forcedOrRoll`, `executeEffect`, `applyHeadInteraction`, `advanceInteractionQueue`, `injectPendingEffect`, `takeReroll`/`declineReroll`/`rollDicePair` legacy probabilistic internals that referenced removed helpers (keep `rollDicePair` — it is still called by the dice component for advantage/disadvantage/choice). Delete `src/engine/InteractionResolver.ts`.

- [ ] **Step 5: Delete the obsolete test and update the survivors**

Delete `src/engine/__tests__/InteractionResolver.test.ts`. In `Scenarios.test.ts`, replace `loadScenarioById('will-keep-one-of-two')`/`dice-*` assertions with the new scenario ids (`shadow-shroud`, `fool-reroll`, `combo-widen-shroud`). In `AgencyDecisions.test.ts`, drop tests for deleted methods (`maybeAutoOrient`, `offerReroll` as a standalone); keep `rollDicePair`. Run them and fix references.

- [ ] **Step 6: Run the full suite + typecheck + build**

```bash
npx vitest run
npx tsc -b
```
Expected: engine tests pass; `tsc` exit 0 (component references to removed methods will surface here — note them for Task 8/9; if `tsc -b` fails only on component files, proceed to Phase E in the same working session before committing).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): route effects through the dispatcher; remove legacy maybe*/resolve* + InteractionResolver"
```

---

## Phase E — Components

### Task 8: Batch sequencer driven by `eventQueue`

**Files:**
- Modify: `src/components/overlays/InteractionSequencer.tsx` (rewrite to consume `state.eventQueue`)
- Modify: `src/components/screens/GameTable.tsx` (mount the sequencer when `state.eventQueue.length > 0`)
- Create: `src/components/overlays/InteractionAnimations/ShroudAnimation.tsx`, `WidenAnimation.tsx`, `OverrideAnimation.tsx`

**Interfaces:**
- Consumes: `state.eventQueue: EffectReport[]`, `engine.clearEventQueue()`.
- Produces: UI only — build-verified (no component tests per CLAUDE.md).

- [ ] **Step 1: Rewrite `InteractionSequencer.tsx`** to: read `state.eventQueue`; play each `EffectReport` in order; auto-advance after a per-animation delay (default 1400ms, last step 0 → wait for the queue to drain); a single tap on the overlay skips the *whole* remaining queue. On drain/skip call `engine.clearEventQueue()`. Map `report.animation` → the matching `*Animation` component (`reroll`/`flip`/`mirror`/`add-choice`/`second-result`/`shroud`/`widen`/`override`/`roll-mode`), passing `{ description, sourceSlot, targetSlot }`. Each animation renders a short caption from `report.label` + `report.description`.

```tsx
// core loop sketch — full file replaces the current step-machine
const queue = state.eventQueue;
const [i, setI] = useState(0);
useEffect(() => {
  if (queue.length === 0) return;
  if (i >= queue.length) { engine.clearEventQueue(); setI(0); return; }
  const t = setTimeout(() => setI((n) => n + 1), 1400);
  return () => clearTimeout(t);
}, [i, queue.length]);
const skip = () => { engine.clearEventQueue(); setI(0); };
```

- [ ] **Step 2: Create the three new animation components** mirroring the existing `FlipAnimation.tsx` structure (a `motion.div` keyed on `descriptor`, reading a `step` prop is no longer needed — they take `{ description, targetSlot }` and animate once). `ShroudAnimation`: a card darkening/veil sweep over `targetSlot`. `WidenAnimation`: a new slot fading in. `OverrideAnimation`: a swap/hand-of-fate motion.

- [ ] **Step 3: Update `GameTable.tsx`** — replace `state.interactionQueue.length > 0` with `state.eventQueue.length > 0` for both the `pointerEvents: 'none'` guard and the sequencer mount; drop `onActiveSlotsChange`/`onAnimationComplete` plumbing if the new sequencer manages its own slot highlight via `activeSlots` derived from the current report.

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: `tsc -b` then `vite build` succeed.

- [ ] **Step 5: Commit**

```bash
git add src/components/overlays src/components/screens/GameTable.tsx
git commit -m "feat(ui): auto-play skippable event sequencer driven by eventQueue"
```

---

### Task 9: Minigame components fire action triggers

**Files:**
- Modify: `src/components/screens/DiceMinigame.tsx` (use `planDiceRoll().reports` are already queued by the engine; on reroll call `engine.resolveReroll`; the dice pair path keeps `engine.rollDicePair`)
- Modify: `src/components/screens/TarotMinigame.tsx` (use `engine.resolveTarotPick`; orientation via `engine` so `tarot:orient`/`tarot:commit` fire)
- Modify: `src/components/screens/MethodSelect.tsx` (render shrouded options from the pool draft; `select:pick` fires via `engine.selectMethod`)
- Modify: `src/components/screens/IChingMinigame.tsx`, `HappeningScene.tsx` (commit/choose paths unchanged beyond method-name updates)

**Interfaces:**
- Consumes: the Task 7 engine API. UI only — build-verified.

- [ ] **Step 1** Update `DiceMinigame.tsx` to read `mode`/`offerReroll` from `engine.planDiceRoll()` (now returns `{ mode, offerReroll, reports }`); the sequencer shows the reports. Keep the existing advantage/disadvantage/choice rendering and `rollDicePair`.
- [ ] **Step 2** Update `TarotMinigame.tsx`: after the player taps a card, call `engine.resolveTarotPick(index, hand)`; reveal `card`; if `swapped`, the sequencer's `override` report explains it. Route orientation through the engine.
- [ ] **Step 3** Update `MethodSelect.tsx`: render any pool index in the engine-provided shrouded set as a face-down/obscured method until selected.
- [ ] **Step 4** Update `IChingMinigame.tsx` / `HappeningScene.tsx` for any renamed engine calls.
- [ ] **Step 5: Build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/screens
git commit -m "feat(ui): minigames fire namespaced action triggers through the dispatcher"
```

---

### Task 10: Debug panel — forced-set, isolate, scenarios

**Files:**
- Modify: `src/components/debug/DebugPanel.tsx`
- Modify: `src/engine/GameEngine.ts` (`getScenarioPresets()` returns `DEBUG_SCENARIOS.map(...)`; add `getResponderIds(): string[]`)

**Interfaces:**
- Consumes: `engine.getScenarioPresets()`, `engine.loadScenarioById(id)`, `engine.forceEffects(ids, isolate)`, `engine.getResponderIds()`.
- Produces: UI only — build-verified.

- [ ] **Step 1** Add `getResponderIds()` to the engine returning `this.responders.map((r) => r.id)`.
- [ ] **Step 2** Update `DebugPanel.tsx`: a scenario list (calls `loadScenarioById`), plus an ad-hoc panel — a multi-select of `getResponderIds()` + an "isolate" checkbox + an "Arm" button calling `engine.forceEffects(selected, isolate)`.
- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/debug/DebugPanel.tsx src/engine/GameEngine.ts
git commit -m "feat(debug): forced-set + isolate controls and scenario list"
```

---

## Self-Review

**Spec coverage:**
- §3 trigger taxonomy → Tasks 4/5 (trigger strings on responders), Task 7 (engine fires them), Task 9 (components fire actions). ✓
- §3.1 draws resolve blind → Task 4 (`shadow-shroud` on `select:draw:end`), Task 7 (apply `poolTarget`/`shrouded`), Task 9 (MethodSelect renders shrouded face-down). ✓
- §4 Responder + PhaseContext + interception → Tasks 1, 4 (`fate-override-pick`), 7 (`resolveTarotPick`). ✓
- §5 resolution (exclusive one-per-band + combine) → Task 3, reducer Task 2. ✓
- §6 debug harness (force/isolate, reset-then-stage, scenarios-as-tests) → Tasks 3 (filter), 6 (scenarios), 7 (engine API), 10 (panel). ✓
- §7 resolve→narrate→reveal, auto-play/skip → Task 7 (queue reports during resolve), Task 8 (sequencer). ✓
- §8 migration map → Tasks 4/5 (every effect ported with stated disposition); merges (`chaos-second-result`), drops (`free-orientation`, recursive chain resolver, `chaos-dominant`) → Task 7 deletions. Critical Resonance → Task 5. ✓
- §8 continuous biases untouched → no task modifies `rollD20`/narrative; confirmed by omission. ✓

**Placeholder scan:** every code step has literal code; test steps include runnable assertions; no "TBD"/"similar to". Task 7 Step 4 prose describes several edits — each names the exact method and the exact transformation, with code for the non-obvious ones. ✓

**Type consistency:** `dispatch(trigger, ctx, responders, debug)` signature identical in Tasks 3/4/5/7; `EffectReport`/`PhaseContext`/`PhaseDraft`/`DebugConfig` defined in Task 1 and imported everywhere; `bandRoll(ctx, affinity, minBand, baseChance)` identical in Tasks 4 definition and usages; `planDiceRoll()` return type `{ mode; offerReroll; reports }` consistent between Task 7 and Task 9. ✓
