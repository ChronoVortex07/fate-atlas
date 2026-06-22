# Event-Driven Effects Engine — Follow-ups & Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the reported bugs (Part A) and deferred follow-ups (Part B) in the event-driven effects engine — animation timing/freeze, fan hit-area, shadow-shroud concealment + progressive count, chaos second-result legibility, debug scenarios + test coverage, "Fate forces the method", and `RunRecord` interaction re-wiring.

**Architecture:** Game logic stays framework-free in `src/engine/`; `GameEngine` is the single mutable source of truth that ends every mutator with `notify()`. Effects are `Responder`s run by `dispatch()` at namespaced triggers, resolve synchronously into `state.eventQueue: EffectReport[]`, then the `InteractionSequencer` auto-plays them ("resolve first, narrate second"). React renders state and forwards actions only.

**Tech Stack:** React 18 + TypeScript (strict) + Vite; Vitest (engine-only) + framer-motion.

## Global Constraints

- All game logic lives in `src/engine/` with **zero React/DOM imports**. Logic changes go in the engine, not components — verbatim from CLAUDE.md.
- Every engine mutator must end with `notify()`, or React will not re-render.
- Type safety is the only linter: `npm run build` (`tsc -b && vite build`) must pass with `strict`, `noUnusedLocals`, `noUnusedParameters` all on. No unused imports/locals/params may remain.
- Vitest runs **only `src/engine/__tests__/**`** in Node (no jsdom). There is **no component test harness** — UI-only changes are verified by `npm run build` (typecheck) plus manual dev-server checks, never by fabricated component tests.
- Tests that depend on `Math.random()` must stub it (inject via `ctx.rng` for responders, or stub `Math.random` for engine-level draws).
- Responders namespace dice as `dice`, not the data-layer `d20` type (e.g. `dice:commit`).
- Run the engine suite with `npm test`; a single file with `npx vitest run src/engine/__tests__/<File>.test.ts`.

---

## File Structure

**Phase 1 — A3 bug half + A2**
- Modify `src/components/screens/MethodSelect.tsx` — drop the `isHidden`/`poolPreview === 'hidden'` concealment branch; keep only `isShrouded`.
- Modify `src/components/overlays/ConstellationFan.tsx` — constrain the collapsed clickable footprint; add tap-highlight suppression.

**Phase 2 — A1 + B3**
- Modify `src/components/overlays/InteractionSequencer.tsx` — per-animation duration map; call `engine.finishEventBatch()` on drain/skip; expose current report's slots.
- Modify `src/engine/GameEngine.ts` — defer the post-commit phase transition until the event batch drains (`finishEventBatch()` / `runOrDefer`).
- Modify `src/components/screens/GameTable.tsx` — derive `activeSlots` from the sequencer's current report and thread to `ConstellationFan`.

**Phase 3 — A4**
- Modify `src/engine/responders/affinity.ts` — pass `targetSlot` on `chaos-second-result`; strengthen banner copy.
- Modify `src/engine/GameEngine.ts` — compute the new slot index for `chaos-second-result`'s report.
- Modify `src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx` — spotlight the target fan slot.

**Phase 4 — A3 mechanic half**
- Modify `src/engine/responders/affinity.ts` — progressive `shadow-shroud` (1–3 distinct indices, per-band).

**Phase 5 — A6 + A5**
- Modify `src/engine/events/scenarios.ts` — fixtures + one `DebugScenario` per responder.
- Modify `src/engine/__tests__/AffinityResponders.test.ts`, `InteractionResponders.test.ts`, `EngineDispatch.test.ts` — cover the remaining responders.

**Phase 6 — B1, B2, B4, B5, B6**
- B1: `src/engine/responders/affinity.ts`, `src/engine/GameEngine.ts`, `src/components/screens/MethodSelect.tsx`.
- B2: `src/engine/types.ts`, `src/engine/GameEngine.ts`, `src/engine/NarrativeAssembler.ts`, `src/components/overlays/HistoryTiles.tsx`.
- B4: `src/engine/types.ts` (+ any remaining readers).
- B5: `src/engine/responders/affinity.ts`, `src/components/overlays/InteractionSequencer.tsx`, new animation component(s).
- B6: `src/engine/events/types.ts`, `src/engine/__tests__/Reducers.test.ts`, `src/engine/responders/*`.

---

# Phase 1 — A3 (bug half) + A2

> Small, high-impact: stop the all-hidden concealment and stop the fan from blocking method selection. **Review checkpoint after Phase 1.**

### Task 1: A3 fix part A — method concealment is the discrete shroud only

The `isHidden` branch hides every non-shrouded method whenever Shadow is Ascendant+ (because `getEffects()` sets `poolPreview = 'hidden'` at the same band the shroud fires). Method-card concealment must be driven **only** by `state.shroudedMethods`. `poolPreview` stays in the type and elsewhere (the dice "veiled" cue reads it) — only its use in `MethodSelect` is removed.

**Files:**
- Modify: `src/components/screens/MethodSelect.tsx:59,74,77,80-85`

**Interfaces:**
- Consumes: `state.shroudedMethods: number[]` (already populated by the `shadow-shroud` responder via `GameEngine.buildPool`).
- Produces: nothing new.

- [ ] **Step 1: Remove the `isHidden` const**

In `MethodSelect.tsx`, delete line 59:

```tsx
const isHidden = state.affinityEffects.poolPreview === 'hidden';
```

- [ ] **Step 2: Drop `isHidden` from the symbol/title/description**

Replace the card body (the `cardSymbolStyle` div through the `cardDescStyle` div, lines ~73-85) with:

```tsx
<div style={{ ...cardSymbolStyle, color: isShrouded ? '#4a5a7a' : card.color }}>
  {isShrouded ? '?' : card.symbol}
</div>
<div style={cardTitleStyle}>
  {isShrouded ? '???' : card.title}
</div>
<div style={cardDescStyle}>
  {isShrouded
    ? 'Shadow conceals this path — its nature is hidden.'
    : card.description}
</div>
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS, no `noUnusedLocals` error for `isHidden` (it is gone), no other type errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open the debug panel, run the `shadow-shroud` scenario. Expected: exactly the shrouded card shows "Shadow conceals this path"; all other cards render their normal symbol/title/description (no "An unmarked path awaits").

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/MethodSelect.tsx
git commit -m "fix(ui): method concealment is discrete shroud only, not poolPreview"
```

---

### Task 2: A2 — constrain ConstellationFan collapsed hit-area

The collapsed deck's clickable box is huge (`width:100%, height:320px` desktop; `220×220` mobile) and overlaps the centered method grid, blocking the third method. Shrink the click target to the visible deck footprint and suppress the mobile tap-highlight. The expanded overlay stays full-screen.

**Files:**
- Modify: `src/components/overlays/ConstellationFan.tsx:206-218`

**Interfaces:**
- Consumes: `expanded`, `isDesktop`, `handleToggle` (existing locals).
- Produces: nothing new.

- [ ] **Step 1: Constrain the collapsed container and suppress tap-highlight**

Replace the fan-cards container `<div style={{...}} onClick={...}>` (lines 206-218) with a version whose collapsed footprint is small and which never carries `onClick` while expanded:

```tsx
<div
  style={{
    position: 'absolute',
    bottom: isDesktop ? '14px' : '56px',
    right: isDesktop ? undefined : '14px',
    left: isDesktop ? '50%' : undefined,
    transform: !expanded && isDesktop ? 'translateX(-50%)' : isDesktop ? 'translateX(-50%)' : undefined,
    // Collapsed: footprint hugs the real card stack so it can't cover the method grid.
    // Expanded: span the area so polar-positioned cards have room.
    width: expanded ? (isDesktop ? '100%' : '220px') : (isDesktop ? '120px' : '70px'),
    height: expanded ? (isDesktop ? '320px' : '220px') : (isDesktop ? '130px' : '90px'),
    zIndex: expanded ? 16 : 8,
    cursor: !expanded ? 'pointer' : undefined,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    pointerEvents: expanded ? 'none' : 'auto',
  }}
  onClick={!expanded ? handleToggle : undefined}
>
```

> Note: when `expanded`, `pointerEvents:'none'` lets the full-screen dimming overlay (zIndex 14, already `pointerEvents:'auto'`) own the collapse-on-click. The collapsed footprint sits bottom-center (desktop) / bottom-right (mobile), clear of the centered method grid (`gridStyle maxWidth:420px`).

- [ ] **Step 2: Verify card positioning still reads inside the smaller box**

The desktop polar positions are computed from a pivot and use `position:absolute` offsets inside this container; the collapsed stack renders near the bottom. Confirm by reading `FanCard.tsx` that collapsed cards anchor to the container bottom (they do — collapsed cards stack at the container's bottom edge). No `FanCard` change needed.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS. (`WebkitTapHighlightColor` and `touchAction` are valid `React.CSSProperties`.)

- [ ] **Step 4: Manual verification**

Run `npm run dev`. On `method-select` with 3 methods, confirm the third method is clickable (the fan no longer intercepts it). Tap the collapsed deck → it expands. Tap outside → it collapses. On a narrow viewport, confirm no blue tap-highlight flashes on empty space near the deck.

- [ ] **Step 5: Commit**

```bash
git add src/components/overlays/ConstellationFan.tsx
git commit -m "fix(ui): constrain collapsed fan hit-area; suppress mobile tap-highlight"
```

---

# Phase 2 — A1 + B3

> Animation timing + freeze-until-narrated, plus restoring fan slot-highlight. These go together and unblock A4. **Review checkpoint after Phase 2.**

### Task 3: A1 part 1 — per-animation duration map in the sequencer

The sequencer advances every report after a flat `1400` ms. Several animations need longer. Replace the flat timeout with a per-animation duration lookup.

**Files:**
- Modify: `src/components/overlays/InteractionSequencer.tsx:20-29`

**Interfaces:**
- Consumes: `report.animation: string` from `state.eventQueue[i]`.
- Produces: a module-level `DURATION` map (used again in Task 5's context only as reference).

- [ ] **Step 1: Add the duration map**

Near the top of `InteractionSequencer.tsx` (after imports, before the component), add:

```tsx
// Per-animation on-screen durations (ms). Animations with ripples/delays need
// longer than the old flat 1400 so the reveal lands after the motion settles.
const DURATION: Record<string, number> = {
  reroll: 2600,
  'second-result': 2400,
  flip: 1800,
  mirror: 1800,
  override: 1800,
  shroud: 1600,
  widen: 1500,
  'add-choice': 1800,
};
const DEFAULT_DURATION = 1400;
```

- [ ] **Step 2: Drive the timeout from the map**

Replace the `useEffect` body (lines 20-29) so the timeout reads the current report's duration:

```tsx
useEffect(() => {
  if (queue.length === 0) return;
  if (i >= queue.length) {
    engine.finishEventBatch();
    setI(0);
    return;
  }
  const anim = queue[Math.min(i, queue.length - 1)]?.animation;
  const ms = DURATION[anim] ?? DEFAULT_DURATION;
  const t = setTimeout(() => setI((n) => n + 1), ms);
  return () => clearTimeout(t);
}, [i, queue.length, engine]);
```

> `engine.finishEventBatch()` is introduced in Task 4; until then it does not exist. Implement Task 4 in the same phase before typechecking the build. (Within this task, also update `skip` — Step 3.)

- [ ] **Step 3: Route skip through `finishEventBatch` too**

Replace `skip` (lines 31-34):

```tsx
const skip = useCallback(() => {
  engine.finishEventBatch();
  setI(0);
}, [engine]);
```

- [ ] **Step 4: Defer typecheck to Task 4**

`finishEventBatch` does not exist yet; the build will fail until Task 4 lands. Do not commit this task alone — commit Tasks 3 + 4 together at the end of Task 4.

---

### Task 4: A1 part 2 — freeze the screen until the commit batch is narrated

The engine resolves the commit, then synchronously transitions to the next phase and `notify()`s — so the screen is already the next `method-select`/`happening` by the time the sequencer plays. Restore "freeze until narrated" under the resolve-first model: when a commit produces queued events, **defer** the phase transition; the sequencer runs it on drain via `finishEventBatch()`.

**Files:**
- Modify: `src/engine/GameEngine.ts` (field + `clearEventQueue` neighbourhood ~118-121, `completeMinigame` 184-271)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces:
  - `engine.finishEventBatch(): void` — clears `state.eventQueue` and runs any deferred transition, then `notify()`s.
  - `private runOrDefer(transition: () => void): void` — runs `transition()` immediately if the queue is empty, else stores it and `notify()`s.
  - `private advanceAfterCommit(): void` — the post-commit transition logic extracted from `completeMinigame`.
- Consumes: `state.eventQueue` (existing).

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/GameEngine.test.ts` (follow the file's existing setup for constructing an engine and forcing effects; use `engine.forceEffects([...], true)` to guarantee a queued report on commit):

```ts
it('freezes on the minigame screen until the commit event batch is narrated', () => {
  const engine = new GameEngine();
  engine.startTurn('decision');
  engine.selectMethod(0); // not the final reading (minigamesPerTurn = 3)
  // Force a commit-phase responder so the commit enqueues an EffectReport.
  engine.forceEffects(['chaos-second-result'], true);

  const die = engine.getState().turnResults; // baseline length
  engine.completeMinigame({
    type: 'd20', result: 11, threshold: 'neutral', interpretation: '',
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
    modifierRoles: [],
  } as any);

  // Deferred: queue has events, screen has NOT advanced past minigame.
  expect(engine.getState().eventQueue.length).toBeGreaterThan(0);
  expect(engine.getState().screen).toBe('minigame');

  // Draining the batch runs the deferred transition.
  engine.finishEventBatch();
  expect(engine.getState().eventQueue.length).toBe(0);
  expect(engine.getState().screen).toBe('method-select');
  expect(die).toBeDefined();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "freezes on the minigame screen"`
Expected: FAIL — `finishEventBatch` is not a function / screen is already `method-select`.

- [ ] **Step 3: Add the deferred-transition field**

In `GameEngine.ts`, add a private instance field near the other private fields (e.g. beside `usedHappeningIds`):

```ts
private pendingTransition: (() => void) | null = null;
```

- [ ] **Step 4: Add `runOrDefer` and `finishEventBatch`**

Add these methods next to `clearEventQueue` (~line 118):

```ts
clearEventQueue(): void {
  this.state.eventQueue = [];
  this.notify();
}

// Runs the transition now if nothing is queued for narration; otherwise stores
// it and lets the sequencer run it once the batch drains (freeze-until-narrated).
private runOrDefer(transition: () => void): void {
  if (this.state.eventQueue.length > 0) {
    this.pendingTransition = transition;
    this.notify();
  } else {
    transition();
  }
}

// Called by InteractionSequencer when the queue finishes (or is skipped):
// clear the queue and run any transition that was deferred behind it.
finishEventBatch(): void {
  this.state.eventQueue = [];
  const t = this.pendingTransition;
  this.pendingTransition = null;
  if (t) t();
  else this.notify();
}
```

- [ ] **Step 5: Split `completeMinigame` into resolve + deferred transition**

Replace the tail of `completeMinigame` — from the `this.bus.emit('minigame-complete', ...)` line (241) through the end of the method (271) — with an emit followed by a deferred call to a new `advanceAfterCommit`:

```ts
    this.bus.emit('minigame-complete', { result, completed });

    // Resolve-first, narrate-second: if the commit queued any events, freeze on
    // the current screen until the sequencer drains them, then transition.
    this.runOrDefer(() => this.advanceAfterCommit(result, completed));
  }

  private advanceAfterCommit(result: SlotResult, completed: number): void {
    // Final reading?
    if (completed >= this.minigamesPerTurn) {
      this.synthesizeAll();
      this.buildRunRecord();
      this.state.screen = 'result';
      this.saveToStorage();
      this.notify();
      return;
    }

    // Between-minigame transition. Ask the minigame:end trigger whether a
    // happening interrupts the flow.
    this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');
    const { draft: endDraft } = this.dispatchAt('minigame:end', {
      lastReading: completed >= this.minigamesPerTurn,
    });

    if (endDraft.interruptHappening === true) {
      // The minigame:end dispatch may itself have queued the interrupt report;
      // narrate it on the current screen, then open the happening.
      this.runOrDefer(() => this.triggerHappening());
      return;
    }

    const gaps = this.readingPlanner.analyzeGaps(this.state.turnResults);
    const bias = this.readingPlanner.getBiasForRefill(gaps);
    this.buildPool(bias, true);
    this.state.screen = 'method-select';
    this.state.selectedMethod = null;
    this.notify();
  }
```

> The earlier synchronous resolve steps (turnResults push, affinity feeds, commit dispatch, `draft.outcome` swap, fool-reroll, `spawnSecond`) stay exactly where they are (lines 184-239). Only the post-emit transition moves into `advanceAfterCommit`. `buildPool` enqueues shroud/widen reports for the *next* pool; those play over the freshly-set `method-select`, which is the correct screen for them, so they are not deferred.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "freezes on the minigame screen"`
Expected: PASS.

- [ ] **Step 7: Run the full engine suite + build**

Run: `npm test`
Expected: all pass (201+ tests).
Run: `npm run build`
Expected: PASS — `finishEventBatch` now exists, sequencer typechecks.

- [ ] **Step 8: Manual verification**

Run `npm run dev`. Force `fool-reroll` (or `chaos-second-result`) via the debug panel and complete a non-final reading. Expected: the reroll/second-result animation plays to completion **on the minigame screen** before the method-select appears.

- [ ] **Step 9: Commit (Tasks 3 + 4 together)**

```bash
git add src/components/overlays/InteractionSequencer.tsx src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "fix(engine): freeze screen until event batch narrated; per-animation durations"
```

---

### Task 5: B3 — restore fan slot-highlight during playback

`GameTable` passes a constant empty `activeSlots`, so the fan never highlights the source/target during an event. Derive `activeSlots` from the sequencer's current report and thread it down. Move the sequencer's "current report" up so `GameTable` can read it, by lifting the slot derivation into `GameTable` from `state.eventQueue` + an index, OR expose the active report's slots. Simplest: render the fan's active slots from the **first** queued report's slots while a batch is in flight (the common case is one report per commit; multi-report batches still highlight meaningfully).

**Files:**
- Modify: `src/components/screens/GameTable.tsx:75-80`

**Interfaces:**
- Consumes: `state.eventQueue: EffectReport[]` (each has optional `sourceSlot`/`targetSlot`).
- Produces: a real `activeSlots` object for `ConstellationFan`.

- [ ] **Step 1: Derive activeSlots from the live queue**

In `GameTable.tsx`, replace the `ConstellationFan` render (lines 75-77) with:

```tsx
{showTableau && (
  <ConstellationFan
    results={state.turnResults}
    activeSlots={deriveActiveSlots(state.eventQueue)}
  />
)}
```

And add this helper above the component (after imports):

```tsx
import type { EffectReport } from '../../engine/types';

function deriveActiveSlots(queue: EffectReport[]) {
  const r = queue[0];
  if (!r) return { sourceIndex: null, targetIndex: null, effect: null };
  return {
    sourceIndex: r.sourceSlot ?? null,
    targetIndex: r.targetSlot ?? null,
    effect: r.animation ?? null,
  };
}
```

> `ConstellationFan` already auto-expands when a new highlight appears and auto-collapses 3s after `sourceIndex`/`targetIndex` return to `null` — which happens when `finishEventBatch()` empties the queue. No `ConstellationFan` change required.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS. (`EffectReport` is re-exported from `src/engine/types.ts`.)

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Force `shadow-shroud` and a `reroll`. Expected: the fan auto-expands and the targeted slot highlights (`reroll-target` styling for reroll) while the animation plays, then collapses after the batch drains.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/GameTable.tsx
git commit -m "feat(ui): restore fan slot-highlight during event playback (B3)"
```

---

# Phase 3 — A4

> Builds on A1 (timing) + B3 (fan highlight). **Review checkpoint after Phase 3.**

### Task 6: A4 engine — point the second-result report at the new slot

`chaos-second-result` sets `draft.spawnSecond` but its report carries no `targetSlot`, so the animation can't spotlight the new fan card. The new slot index is known only in `GameEngine` (where the slot is appended). Compute it there and patch the queued report.

**Files:**
- Modify: `src/engine/responders/affinity.ts:92-95` (banner copy only)
- Modify: `src/engine/GameEngine.ts:231-239` (set `targetSlot` on the queued report)
- Test: `src/engine/__tests__/EngineDispatch.test.ts`

**Interfaces:**
- Consumes: `draft.spawnSecond`, `state.turnResults`, `state.eventQueue`.
- Produces: the `chaos-second-result` report in `state.eventQueue` gains `targetSlot = <new slot index>`.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/EngineDispatch.test.ts` (match the file's engine-construction style):

```ts
it('chaos-second-result spawns a slot and points its report at the new index', () => {
  const engine = new GameEngine();
  engine.startTurn('decision');
  engine.selectMethod(0);
  engine.forceEffects(['chaos-second-result'], true);

  const before = engine.getState().turnResults.length;
  engine.completeMinigame({
    type: 'd20', result: 7, threshold: 'low', interpretation: '',
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
    modifierRoles: [],
  } as any);

  const s = engine.getState();
  expect(s.turnResults.length).toBe(before + 2); // committed + spawned second
  const report = s.eventQueue.find((r) => r.responderId === 'chaos-second-result');
  expect(report).toBeDefined();
  expect(report!.targetSlot).toBe(s.turnResults.length - 1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/EngineDispatch.test.ts -t "chaos-second-result spawns a slot"`
Expected: FAIL — `report.targetSlot` is `undefined`.

- [ ] **Step 3: Patch the queued report when spawning the second slot**

In `GameEngine.completeMinigame`, replace the `spawnSecond` block (lines 232-239):

```ts
    // Chaos surge: spawn a second result of the same type.
    if (typeof draft.spawnSecond === 'string') {
      const affinities = this.affinityEngine.getState();
      const second = this.orchestrator.drawSingleResult(
        draft.spawnSecond as 'tarot' | 'd20' | 'iching',
        affinities,
      );
      this.state.turnResults = [...this.state.turnResults, second];
      const newIndex = this.state.turnResults.length - 1;
      // The responder cannot know the post-append index; patch its queued report
      // so the animation can spotlight the new fan slot.
      this.state.eventQueue = this.state.eventQueue.map((r) =>
        r.responderId === 'chaos-second-result' ? { ...r, targetSlot: newIndex } : r,
      );
    }
```

- [ ] **Step 4: Strengthen the banner copy**

In `affinity.ts`, update the `chaos-second-result` report (line 94):

```ts
return report('chaos-second-result', 'Chaos', 'Chaos surges — a second reading manifests.', 'second-result');
```

- [ ] **Step 5: Run the test + suite**

Run: `npx vitest run src/engine/__tests__/EngineDispatch.test.ts -t "chaos-second-result spawns a slot"`
Expected: PASS.
Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/GameEngine.ts src/engine/__tests__/EngineDispatch.test.ts
git commit -m "feat(engine): chaos-second-result targets the new slot; clearer copy (A4)"
```

---

### Task 7: A4 UI — spotlight the new slot in SecondResultAnimation

`SecondResultAnimation` ignores `targetSlot` and just ripples in the screen center. Make it read `targetSlot` and pulse toward the fan; with B3 the fan already expands and highlights the slot, so this animation just needs to read as "a new card arrives" rather than a generic center ripple.

**Files:**
- Modify: `src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx`

**Interfaces:**
- Consumes: `targetSlot?: number | null` (already in `Props`).
- Produces: nothing new.

- [ ] **Step 1: Use targetSlot to color/position the burst**

Replace the component body so it acknowledges the target (the fan, expanded by B3, sits bottom-center desktop / bottom-right mobile). A downward-resolving burst reads as "manifesting into the constellation":

```tsx
import { motion } from 'framer-motion';

interface Props {
  description?: string;
  sourceSlot?: number | null;
  targetSlot?: number | null;
}

export default function SecondResultAnimation({ targetSlot }: Props) {
  const hasTarget = targetSlot !== null && targetSlot !== undefined;
  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={rippleStyle}
        initial={{ scale: 0.3, opacity: 0.7, y: 0 }}
        animate={{ scale: 2.5, opacity: 0, y: hasTarget ? 120 : 0 }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
      />
      <motion.div
        style={rippleStyle}
        initial={{ scale: 0.3, opacity: 0.5, y: 0 }}
        animate={{ scale: 2.0, opacity: 0, y: hasTarget ? 80 : 0 }}
        transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
      />
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

const rippleStyle: React.CSSProperties = {
  position: 'absolute',
  width: '120px',
  height: '120px',
  borderRadius: '50%',
  border: '2px solid rgba(140, 100, 200, 0.4)',
};
```

> `sourceSlot` is intentionally unused in `Props`; destructuring only `targetSlot` avoids `noUnusedParameters` because the other props are not bound to locals.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS, no unused-local warnings.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, force `chaos-second-result`, complete a reading. Expected: the burst resolves downward toward the (now-expanded, B3-highlighted) fan, the banner reads "a second reading manifests", and the full animation plays before transition (A1).

- [ ] **Step 4: Commit**

```bash
git add src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx
git commit -m "feat(ui): second-result animation resolves toward the new fan slot (A4)"
```

---

# Phase 4 — A3 (mechanic half)

> **Review checkpoint after Phase 4.**

### Task 8: progressive shadow-shroud count (1–3 distinct indices)

`shadow-shroud` shrouds exactly one random index and is gated at Ascendant+. Rewrite to per-band escalation with a flat per-step chance: Stirring+ gate at 20% (the firing roll); Ascendant+ rerolls 20% for a second distinct index; Dominant rerolls 20% for a third. Capped at `pool.length`.

**Files:**
- Modify: `src/engine/responders/affinity.ts:38-49`
- Test: `src/engine/__tests__/AffinityResponders.test.ts`

**Interfaces:**
- Consumes: `c.affinities.shadow`, `c.rng`, `c.draft.pool`, `bandOf`/`BAND_ORDER` (import as needed).
- Produces: `draft.shrouded` containing 1–3 distinct indices; report label reflects the count.

- [ ] **Step 1: Write the failing tests**

Replace the existing single `shadow-shroud` assertion in `AffinityResponders.test.ts` (lines 34-39) with band-specific cases. `bandOf` thresholds: confirm against `src/data/affinities.ts` and pick shadow values landing in stirring / ascendant / dominant (the existing tests use `75` for ascendant-range; use a clearly-dominant value such as `95` and a stirring value such as `40` — verify both against `bandOf` before finalizing):

```ts
it('shadow-shroud: at Stirring with all rolls passing, shrouds exactly one', () => {
  const pool = [{ type: 'tarot' }, { type: 'tarot' }, { type: 'tarot' }] as any;
  const c = ctx({
    trigger: 'select:draw:end', draft: { pool },
    affinities: { ...defaultAffinityState(), shadow: 40 }, // Stirring
    rng: () => 0, // every roll passes
  });
  dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
  expect(new Set(c.draft.shrouded!).size).toBe(1);
});

it('shadow-shroud: at Dominant with all rolls passing, shrouds three distinct indices', () => {
  const pool = [{ type: 'tarot' }, { type: 'tarot' }, { type: 'tarot' }] as any;
  const c = ctx({
    trigger: 'select:draw:end', draft: { pool },
    affinities: { ...defaultAffinityState(), shadow: 95 }, // Dominant
    rng: () => 0,
  });
  dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
  expect(new Set(c.draft.shrouded!).size).toBe(3);
});

it('shadow-shroud: caps shroud count at pool length', () => {
  const pool = [{ type: 'tarot' }, { type: 'tarot' }] as any; // only 2
  const c = ctx({
    trigger: 'select:draw:end', draft: { pool },
    affinities: { ...defaultAffinityState(), shadow: 95 },
    rng: () => 0,
  });
  dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
  expect(new Set(c.draft.shrouded!).size).toBe(2);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "shadow-shroud"`
Expected: FAIL — current responder shrouds exactly one and is gated at ascendant (Stirring case fires nothing under forced? note: forcing bypasses `roll`, so even the Stirring case would currently shroud 1, but the Dominant/cap cases expect 3/2 and fail).

- [ ] **Step 3: Rewrite the responder**

In `affinity.ts`, add a named constant near the top (after `const T = ...`):

```ts
const SHROUD_STEP_CHANCE = 0.20; // flat per-step chance (not bandRoll-scaled — see A3 note)
```

Add the band imports at the top of the file:

```ts
import { bandOf, BAND_ORDER } from '../../data/affinities';
```

Replace the `shadow-shroud` responder (lines 38-49):

```ts
    {
      id: 'shadow-shroud', source: 'affinity', triggers: ['select:draw:end'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('shadow'),
      condition: (c) => Array.isArray(c.draft.pool) && (c.draft.pool as SlotResult[]).length > 0,
      // Firing roll: Shadow at Stirring+ AND a flat 20% chance.
      roll: (c) => {
        const idx = BAND_ORDER.indexOf(bandOf(c.affinities.shadow));
        return idx >= BAND_ORDER.indexOf('stirring') && c.rng() < SHROUD_STEP_CHANCE;
      },
      apply: (c) => {
        const pool = c.draft.pool as SlotResult[];
        const band = BAND_ORDER.indexOf(bandOf(c.affinities.shadow));
        const shrouded = (c.draft.shrouded ??= []);
        const pickDistinct = (): number | null => {
          if (shrouded.length >= pool.length) return null;
          let idx = Math.floor(c.rng() * pool.length);
          // linear-probe to a free index (small pools)
          while (shrouded.includes(idx)) idx = (idx + 1) % pool.length;
          return idx;
        };
        // First shroud always lands (the firing roll already passed / was forced).
        const first = pickDistinct();
        if (first !== null) shrouded.push(first);
        // Ascendant+: 20% for a second distinct index.
        if (band >= BAND_ORDER.indexOf('ascendant') && c.rng() < SHROUD_STEP_CHANCE) {
          const second = pickDistinct();
          if (second !== null) shrouded.push(second);
        }
        // Dominant: 20% for a third distinct index.
        if (band >= BAND_ORDER.indexOf('dominant') && c.rng() < SHROUD_STEP_CHANCE) {
          const third = pickDistinct();
          if (third !== null) shrouded.push(third);
        }
        const n = shrouded.length;
        return report('shadow-shroud', 'Shadow',
          n > 1 ? `Shadow falls across ${n} paths — their nature is hidden.`
                : 'Shadow falls across a path — its nature is hidden.',
          'shroud', shrouded[0]);
      },
    },
```

> Note (document in code, as above): this responder intentionally uses a flat per-step chance, not the band-scaled `bandRoll` pattern. `forced` bypasses only the firing `roll`, so a forced fire always yields ≥1 shroud plus probabilistic extras — correct for the demo scenario.

- [ ] **Step 4: Run the tests + suite**

Run: `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "shadow-shroud"`
Expected: PASS.
Run: `npm test`
Expected: all pass. (Check `EngineDispatch.test.ts` and `Scenarios.test.ts` for any assertion that `shadow-shroud` shrouds exactly one — update to "≥1" / "≤ pool.length" if present.)

- [ ] **Step 5: Manual verification**

Run `npm run dev`, set Shadow to Dominant (debug), run the `shadow-shroud` scenario a few times. Expect 1–3 distinct cards shrouded; the rest render normally (Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/__tests__/AffinityResponders.test.ts
git commit -m "feat(engine): progressive shadow-shroud count by band (A3 mechanic)"
```

---

# Phase 5 — A6 + A5

> Add the missing debug scenarios (staging preconditions), then lock everything in with tests. Scenarios double as integration fixtures. **Review checkpoint after Phase 5.**

### Task 9: A6 — a debug scenario per responder

`DEBUG_SCENARIOS` covers only 6 of ~16 responders. Forcing bypasses the probabilistic `roll()` but **never** the structural `condition()`, so precondition-gated effects need a scenario that stages the precondition. Add fixtures + one scenario per responder, grouped by `Affinity` / `Interaction` / `Combination`.

**Files:**
- Modify: `src/engine/events/scenarios.ts`
- Test: `src/engine/__tests__/Scenarios.test.ts` (and/or `DebugScenarios.test.ts` — match whichever asserts scenario integrity)

**Interfaces:**
- Consumes: `ScenarioStage` (`affinities`, `screen`, `selectedMethod`, `slots`), `DebugScenario`.
- Produces: new exported entries in `DEBUG_SCENARIOS`; new fixtures (`criticalLowDie`, `reversibleCardA`, `reversibleCardB`, `changingLinesHex`).

- [ ] **Step 1: Add fixtures**

After the `FOOL` fixture in `scenarios.ts`, add (mirror `FOOL`'s shape; verify field names against `DiceResult`/`IChingResult`/`TarotResult` in `types.ts`):

```ts
const reversibleCardA: SlotResult = {
  type: 'tarot', id: 'tower', name: 'The Tower', number: 16, orientation: 'upright',
  symbol: 'XVI', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const reversibleCardB: SlotResult = {
  type: 'tarot', id: 'star', name: 'The Star', number: 17, orientation: 'upright',
  symbol: 'XVII', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const criticalLowDie: SlotResult = {
  type: 'd20', result: 1, threshold: 'critical-low', interpretation: '',
  tags: ['critical-low'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const changingLinesHex: SlotResult = {
  type: 'iching', hexagramNumber: 1, name: 'Qian', symbol: '䷀', judgment: '',
  changingLines: [0, 2], tags: ['changing-lines'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;
```

> Verify `critical-resonance` and `mirror` precondition tags against `src/engine/responders/interactions.ts` (`reversibles(spread)` and the critical-threshold check) and adjust the fixture tags to match exactly before finalizing.

- [ ] **Step 2: Add the missing scenarios**

Append to `DEBUG_SCENARIOS` (keep the existing 6). Each `setup` stages affinities + screen + the precondition slots:

```ts
  // ── Affinity ──
  { id: 'fate-thin-pool', label: 'Fate thins the pool', group: 'Affinity', forced: ['fate-thin-pool'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { fate: 75 }); } },
  { id: 'fate-auto-orient', label: 'Fate orients the card', group: 'Affinity', forced: ['fate-auto-orient'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { fate: 75 }); } },
  { id: 'fate-hollow-reroll', label: 'Fate: hollow reroll', group: 'Affinity', forced: ['fate-hollow-reroll'], isolate: true,
    setup: (s) => { atDice(s); set(s, { fate: 90 }); } },
  { id: 'chaos-happening-interrupt', label: 'Chaos interrupts with a happening', group: 'Affinity', forced: ['chaos-happening-interrupt'], isolate: true,
    setup: (s) => { atDice(s); set(s, { chaos: 75 }); } },
  { id: 'light-advantage', label: 'Light grants advantage', group: 'Affinity', forced: ['light-advantage'], isolate: true,
    setup: (s) => { atDice(s); set(s, { light: 75 }); } },
  { id: 'shadow-disadvantage', label: 'Shadow imposes disadvantage', group: 'Affinity', forced: ['shadow-disadvantage'], isolate: true,
    setup: (s) => { atDice(s); set(s, { shadow: 75 }); } },
  { id: 'will-choice', label: 'Will: choose your roll', group: 'Affinity', forced: ['will-choice'], isolate: true,
    setup: (s) => { atDice(s); set(s, { will: 90 }); } },
  { id: 'will-offer-reroll', label: 'Will: offered a reroll', group: 'Affinity', forced: ['will-offer-reroll'], isolate: true,
    setup: (s) => { atDice(s); set(s, { will: 60 }); } },
  // ── Interaction ──
  { id: 'mirror', label: 'Mirror: two reversibles flip', group: 'Interaction', forced: ['mirror'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [reversibleCardA, reversibleCardB]; } },
  { id: 'critical-resonance', label: 'Critical resonance', group: 'Interaction', forced: ['critical-resonance'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [criticalLowDie]; } },
  { id: 'iching-happening-boost', label: 'I Ching boosts the happening', group: 'Interaction', forced: ['iching-happening-boost'], isolate: true,
    setup: (s) => { s.screen = 'happening'; s.slots = [changingLinesHex]; } },
```

> Verify each `forced` id against the actual responder ids in `affinity.ts` / `interactions.ts`. `iching-happening-boost`, `mirror`, `critical-resonance` ids come from `interactions.ts`.

- [ ] **Step 3: Run the scenario integrity tests**

Run: `npx vitest run src/engine/__tests__/Scenarios.test.ts`
Expected: PASS (every scenario's `forced` ids resolve to a real responder; `setup` runs without throwing). If `DebugScenarios.test.ts` asserts a count, update it.

- [ ] **Step 4: Typecheck + manual**

Run: `npm run build` → PASS.
Run `npm run dev`, open the debug panel, run each new scenario, confirm each fires its effect (banner + animation).

- [ ] **Step 5: Commit**

```bash
git add src/engine/events/scenarios.ts src/engine/__tests__/Scenarios.test.ts
git commit -m "feat(debug): a scenario per responder, staging preconditions (A6)"
```

---

### Task 10: A5 — cover the remaining responders in the test suite

Add unit/integration tests for responders not yet covered. Use `dispatch()` with forced/isolate or a constructed `PhaseContext` (per the `AffinityResponders.test.ts` `ctx()` helper); stub `rng` for determinism.

**Files:**
- Modify: `src/engine/__tests__/AffinityResponders.test.ts`, `src/engine/__tests__/InteractionResponders.test.ts`, `src/engine/__tests__/EngineDispatch.test.ts`

**Interfaces:**
- Consumes: `dispatch`, `buildAffinityResponders`, `buildInteractionResponders`, `ctx()` helper.
- Produces: new passing test cases.

- [ ] **Step 1: Add affinity-responder tests**

In `AffinityResponders.test.ts`, add cases (forced + staged draft) for each:

```ts
it('fate-thin-pool decrements poolTarget, guarded above 2', () => {
  const c = ctx({ trigger: 'select:draw:start', draft: { poolTarget: 4 },
    affinities: { ...defaultAffinityState(), fate: 75 } });
  dispatch('select:draw:start', c, buildAffinityResponders(), { forced: ['fate-thin-pool'], isolate: true });
  expect(c.draft.poolTarget).toBe(3);
});

it('fate-thin-pool does not fire at poolTarget 2 (condition guard)', () => {
  const c = ctx({ trigger: 'select:draw:start', draft: { poolTarget: 2 },
    affinities: { ...defaultAffinityState(), fate: 75 } });
  dispatch('select:draw:start', c, buildAffinityResponders(), { forced: ['fate-thin-pool'], isolate: true });
  expect(c.draft.poolTarget).toBe(2);
});

it('fate-auto-orient sets a deterministic orientation', () => {
  const card = { type: 'tarot', id: 'fool', orientation: 'upright' } as any;
  const c = ctx({ trigger: 'tarot:orient', draft: { outcome: card },
    affinities: { ...defaultAffinityState(), fate: 75 }, rng: () => 0.9 });
  dispatch('tarot:orient', c, buildAffinityResponders(), { forced: ['fate-auto-orient'], isolate: true });
  expect((c.draft.outcome as any).orientation).toBe('reversed'); // rng 0.9 >= 0.5
});

it('fate-hollow-reroll reverts to the previous die', () => {
  const prev = { type: 'd20', result: 3 } as any;
  const curr = { type: 'd20', result: 18 } as any;
  const c = ctx({ trigger: 'dice:reroll', draft: { outcome: curr }, event: { previous: prev },
    affinities: { ...defaultAffinityState(), fate: 90 } });
  dispatch('dice:reroll', c, buildAffinityResponders(), { forced: ['fate-hollow-reroll'], isolate: true });
  expect(c.draft.outcome).toBe(prev);
});

it('chaos-second-result sets spawnSecond to the committed type', () => {
  const c = ctx({ trigger: 'dice:commit', draft: { outcome: { type: 'd20' } as any },
    affinities: { ...defaultAffinityState(), chaos: 95 } });
  dispatch('dice:commit', c, buildAffinityResponders(), { forced: ['chaos-second-result'], isolate: true });
  expect(c.draft.spawnSecond).toBe('d20');
});

it('chaos-happening-interrupt sets interruptHappening when not the last reading', () => {
  const c = ctx({ trigger: 'minigame:end', draft: { lastReading: false },
    affinities: { ...defaultAffinityState(), chaos: 75 } });
  dispatch('minigame:end', c, buildAffinityResponders(), { forced: ['chaos-happening-interrupt'], isolate: true });
  expect(c.draft.interruptHappening).toBe(true);
});

it('chaos-happening-interrupt does not fire on the last reading (condition guard)', () => {
  const c = ctx({ trigger: 'minigame:end', draft: { lastReading: true },
    affinities: { ...defaultAffinityState(), chaos: 75 } });
  dispatch('minigame:end', c, buildAffinityResponders(), { forced: ['chaos-happening-interrupt'], isolate: true });
  expect(c.draft.interruptHappening).toBeUndefined();
});

it('will-choice trumps offer-reroll in the roll-mode reducer', () => {
  const c = ctx({ trigger: 'dice:roll', draft: { rollMods: [] },
    affinities: { ...defaultAffinityState(), will: 95 }, rng: () => 0 });
  dispatch('dice:roll', c, buildAffinityResponders(), noDebug);
  expect(c.draft.rollMode).toBe('choice');
});

it('will-offer-reroll surfaces offerReroll without forcing a mode', () => {
  const c = ctx({ trigger: 'dice:roll', draft: { rollMods: [] },
    affinities: { ...defaultAffinityState(), will: 50 }, rng: () => 0 });
  dispatch('dice:roll', c, buildAffinityResponders(), { forced: ['will-offer-reroll'], isolate: true });
  expect(c.draft.offerReroll).toBe(true);
});
```

> Verify the `will-choice`/`will-offer-reroll` affinity thresholds against `bandOf` so `will: 95` lands Dominant and `will: 50` lands Stirring; adjust if needed. For `fate-auto-orient`, confirm the `rng < 0.5 ? upright : reversed` mapping in `affinity.ts:71`.

- [ ] **Step 2: Add interaction-responder tests**

In `InteractionResponders.test.ts`, add `critical-resonance` negative/non-firing paths and `iching-happening-boost` (match the file's existing construction of spreads/contexts):

```ts
it('critical-resonance: reversed + critical-high flips to upright', () => {
  // construct a spread with a critical-high die and a reversed tarot commit; force the responder
  // then assert the committed tarot orientation becomes 'upright'. (Mirror the upright+critical-low case already covered.)
});

it('critical-resonance: non-matching pairing (upright + critical-high) does not fire', () => {
  // assert orientation unchanged and no report.
});

it('iching-happening-boost: changing-lines hexagram in spread sets addChoice at happening:start', () => {
  // stage a spread containing a changing-lines I Ching; dispatch 'happening:start' forced; expect draft.addChoice === true.
});
```

> Fill these in concretely by copying the existing `critical-resonance` (upright + critical-low → reversed) and `mirror` test bodies in this file and inverting the orientation/threshold; the file already establishes the exact spread-construction pattern. Do not leave them as comments — the comment blocks above are scaffolding to be replaced with the mirrored assertions.

- [ ] **Step 3: Add the shadow-shroud progressive integration assertion (post-A3)**

This is covered by Task 8's tests; confirm those exist and pass. If `EngineDispatch.test.ts` exercises a full `buildPool` shroud path, add an assertion that `state.shroudedMethods.length` is between 1 and the pool length when Shadow is Dominant and the responder is forced.

- [ ] **Step 4: Run the full suite + build**

Run: `npm test`
Expected: all pass, with the new cases included.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/__tests__/AffinityResponders.test.ts src/engine/__tests__/InteractionResponders.test.ts src/engine/__tests__/EngineDispatch.test.ts
git commit -m "test(engine): cover remaining responders (A5)"
```

---

# Phase 6 — B1, B2, B4, B5, B6

> Deferred follow-ups, as capacity allows. **Review checkpoint after each task in this phase** (they are independent).

### Task 11: B1 — "Fate forces the method" (tap → reveal redirect)

The method pool is `DivinationType[]` (strings), incompatible with the `SlotResult`-shaped `fate-override-pick`, and `select:pick` is never dispatched. Add a method-pool-shaped override: dispatch `select:pick` in `selectMethod` with the chosen index + available methods; a new responder may redirect the index; `selectMethod` reads the redirected index. UX: the player taps a method; an override report's animation/banner reveals Fate chose a different one (the existing `override` animation + sequencer banner already provide the reveal).

**Files:**
- Modify: `src/engine/responders/affinity.ts` (new `fate-force-method` responder; remove the dead `select:pick` note at 51-53)
- Modify: `src/engine/GameEngine.ts:172-182` (`selectMethod` dispatches `select:pick`)
- Test: `src/engine/__tests__/EngineDispatch.test.ts`

**Interfaces:**
- Produces: responder `fate-force-method` reading `draft.methodIndex: number` + `draft.methodPool: DivinationType[]`, redirecting `draft.methodIndex`.
- Consumes (in `GameEngine`): the redirected `draft.methodIndex`.

- [ ] **Step 1: Write the failing test**

In `EngineDispatch.test.ts`:

```ts
it('fate-force-method redirects the selected method index when forced', () => {
  const engine = new GameEngine();
  engine.startTurn('decision');
  // ensure at least two distinct methods in availableMethods, else the redirect is a no-op
  engine.forceEffects(['fate-force-method'], true);
  const chosen = 0;
  engine.selectMethod(chosen);
  const s = engine.getState();
  // selectedMethod should match availableMethods at the (possibly redirected) index,
  // and an override report should be queued.
  expect(s.eventQueue.some((r) => r.responderId === 'fate-force-method')).toBe(true);
});
```

> If `availableMethods` can contain duplicates, the redirect may pick the same type; assert on the queued report rather than a guaranteed type change.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/EngineDispatch.test.ts -t "fate-force-method"`
Expected: FAIL — responder/dispatch does not exist.

- [ ] **Step 3: Add the responder**

In `affinity.ts`, replace the dead `select:pick` comment block (51-53) with a real responder:

```ts
    {
      id: 'fate-force-method', source: 'affinity', triggers: ['select:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => Array.isArray(c.draft.methodPool)
        && (c.draft.methodPool as unknown[]).length >= 2
        && typeof c.draft.methodIndex === 'number',
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const pool = c.draft.methodPool as string[];
        const chosen = c.draft.methodIndex as number;
        const others = pool.map((_, i) => i).filter((i) => i !== chosen);
        if (others.length === 0) return null;
        c.draft.methodIndex = others[Math.floor(c.rng() * others.length)];
        return report('fate-force-method', 'Fate', 'The weave moves your hand — another path is chosen for you.', 'override');
      },
    },
```

- [ ] **Step 4: Dispatch `select:pick` in `selectMethod`**

Replace `selectMethod` (172-182):

```ts
selectMethod(index: number): void {
  if (!this.state.availableMethods[index]) {
    throw new Error(`Method index ${index} out of bounds`);
  }
  // Fate (OVERRIDE) may redirect the chosen method.
  const { draft } = this.dispatchAt('select:pick', {
    methodIndex: index,
    methodPool: this.state.availableMethods,
  });
  const finalIndex = typeof draft.methodIndex === 'number' ? draft.methodIndex : index;
  const methodType = this.state.availableMethods[finalIndex];
  if (!methodType) {
    throw new Error(`Method index ${finalIndex} out of bounds`);
  }
  this.state.selectedMethod = methodType;
  this.state.activeSlotIndex = null;
  this.state.screen = 'minigame';
  this.notify();
}
```

> `dispatchAt` enqueues the override report; the freeze-until-narrated path from Task 4 only gates the post-*commit* transition, not `selectMethod`. The override report plays over the minigame screen via the sequencer. If you want it to play before the minigame opens, wrap the screen change in `runOrDefer` as in Task 4 — note this as an optional polish, default is the simpler immediate transition.

- [ ] **Step 5: Run the test + suite + build**

Run: `npx vitest run src/engine/__tests__/EngineDispatch.test.ts -t "fate-force-method"` → PASS.
Run: `npm test` → all pass.
Run: `npm run build` → PASS.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, add a `fate-force-method` debug scenario (Task 9 pattern: `atMethodSelect`, `fate: 90`), tap a method, confirm the override banner appears and a different method opens.

- [ ] **Step 7: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/GameEngine.ts src/engine/__tests__/EngineDispatch.test.ts
git commit -m "feat(engine): Fate forces the method via select:pick redirect (B1)"
```

---

### Task 12: B2 — re-wire RunRecord effects (restore badge + LLM prompt)

`state.interactions` is fed by the deleted `InteractionResolver` and is always `[]`, so the `HistoryTiles` badge never renders and the LLM prompt's interaction section is empty. Accumulate the turn's `EffectReport`s and store them on `RunRecord` as `effects`; point the badge + prompt at that.

**Files:**
- Modify: `src/engine/types.ts` (add `RunRecord.effects: EffectReport[]`)
- Modify: `src/engine/GameEngine.ts` (accumulate per-turn effects; store in `buildRunRecord`; pass to prompt)
- Modify: `src/engine/NarrativeAssembler.ts` (prompt reads `effects`)
- Modify: `src/components/overlays/HistoryTiles.tsx` (badge reads `effects`)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces: `RunRecord.effects: EffectReport[]`; `GameEngine` private `turnEffects: EffectReport[]` accumulator.
- Consumes: `state.eventQueue` reports (accumulated as they are produced in `dispatchAt`).

- [ ] **Step 1: Write the failing test**

In `GameEngine.test.ts`:

```ts
it('records the turn effects into the run history', () => {
  const engine = new GameEngine();
  engine.startTurn('decision');
  engine.selectMethod(0);
  engine.forceEffects(['chaos-second-result'], true);
  engine.completeMinigame({ type: 'd20', result: 5, threshold: 'low', interpretation: '',
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] } as any);
  engine.finishEventBatch();
  // ... complete remaining readings to build a RunRecord (loop selectMethod/completeMinigame ×2) ...
  const hist = engine.getState().history;
  const last = hist[hist.length - 1];
  expect(last.effects.length).toBeGreaterThan(0);
});
```

> Fill in the loop to reach the final reading (3 completions) using the file's existing helpers for completing readings; assert the final `RunRecord.effects` includes the `chaos-second-result` report.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "records the turn effects"`
Expected: FAIL — `RunRecord.effects` does not exist / is undefined.

- [ ] **Step 3: Add the field to the type**

In `types.ts`, add to `RunRecord` (keep `interactions` for now; B4 removes it):

```ts
export interface RunRecord {
  id: string;
  timestamp: number;
  question: QuestionType;
  turnResults: SlotResult[];
  interactions: InteractionEvent[];
  effects: EffectReport[];
  synthesis: SynthesisResult;
  happening?: HappeningResult;
  happeningChoice?: number;
}
```

- [ ] **Step 4: Accumulate per-turn effects in GameEngine**

Add a private field `private turnEffects: EffectReport[] = [];`. In `dispatchAt`, where reports are appended to the queue (line 109), also accumulate:

```ts
if (reports.length > 0) {
  this.state.eventQueue = [...this.state.eventQueue, ...reports];
  this.turnEffects = [...this.turnEffects, ...reports];
}
```

Reset `this.turnEffects = []` in `startTurn` (alongside `eventQueue = []`, line 162) and in `returnToQuestionSelect` (line 597). Store it in `buildRunRecord`:

```ts
const run: RunRecord = {
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: Date.now(),
  question: this.state.questionType!,
  turnResults: this.state.turnResults,
  interactions: this.state.interactions,
  effects: this.turnEffects,
  synthesis: this.state.synthesis!,
  happening: this.state.happening ?? undefined,
  happeningChoice: this.state.selectedHappeningChoice ?? undefined,
};
```

- [ ] **Step 5: Point the LLM prompt at effects**

In `GameEngine.generateLLMPrompt` (556-570), pass effects instead of the empty interactions, and update `NarrativeAssembler.generateLLMPrompt`'s param + body:

In `GameEngine.ts`:

```ts
return this.narrativeAssembler.generateLLMPrompt({
  question,
  slots: results,
  effects: this.turnEffects,
  affinities,
  aggregated,
});
```

In `NarrativeAssembler.ts` (219-265), change the `interactions: InteractionEvent[]` param to `effects: EffectReport[]` and the Meta Events block:

```ts
generateLLMPrompt(run: {
  question: QuestionType;
  slots: SlotResult[];
  effects: EffectReport[];
  affinities: Record<string, number>;
  aggregated?: AggregatedReading;
}): string {
  // ...
  if (run.effects.length > 0) {
    lines.push('### Meta Events');
    run.effects.forEach((ev) => {
      lines.push(`- ${ev.label}: ${ev.description}`);
    });
    lines.push('');
  }
```

Add `import type { EffectReport } from './events/types';` (or from `./types`) to `NarrativeAssembler.ts`; remove the now-unused `InteractionEvent` import if nothing else uses it.

- [ ] **Step 6: Point the HistoryTiles badge at effects**

In `HistoryTiles.tsx` (46-48):

```tsx
{run.effects.length > 0 && (
  <span style={badgeStyle}>{run.effects.length}</span>
)}
```

- [ ] **Step 7: Run the test + suite + build**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "records the turn effects"` → PASS.
Run: `npm test` → all pass (check `NarrativeAssembler.test.ts` for the old `interactions` param shape and update its call sites).
Run: `npm run build` → PASS.

- [ ] **Step 8: Manual verification**

Run `npm run dev`, force an effect during a full turn, finish the reading, open Past Readings → the tile shows a count badge; copy the LLM prompt → it lists a "Meta Events" section.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/NarrativeAssembler.ts src/components/overlays/HistoryTiles.tsx src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): record turn effects into RunRecord; restore badge + prompt (B2)"
```

---

### Task 13: B4 — remove orphaned legacy types

`PendingEffect`, `InteractionRule`, `RollPlan`, `InteractionEvent`, and the `GameState.debugForcedEffect` field remain in `types.ts` but the engine no longer uses them. Remove once readers are gone. **Do this after B2** (which removes the prompt's last `InteractionEvent` reader) and the `interactions` field on `RunRecord`/`GameState`.

**Files:**
- Modify: `src/engine/types.ts`
- Modify: any remaining readers surfaced by grep (`GameEngine.ts` sets `state.interactions`/`debugForcedEffect`).

**Interfaces:**
- Removes: `PendingEffect`, `InteractionRule`, `RollPlan`, `InteractionEvent`, `RunRecord.interactions`, `GameState.interactions`, `GameState.debugForcedEffect`.

- [ ] **Step 1: Find all readers**

Run: `npx grep` equivalents (use the Grep tool): search for `interactions`, `InteractionEvent`, `InteractionRule`, `PendingEffect`, `RollPlan`, `debugForcedEffect` across `src/`. Expected readers: `GameEngine.ts` (`state.interactions` assignments at 57,158,279→removed,566→removed in B2,593; `debugForcedEffect` in `defaultState`), `types.ts`.

- [ ] **Step 2: Remove the fields and types**

- In `GameState`, delete `interactions: InteractionEvent[];` and `debugForcedEffect: string | null;`.
- In `RunRecord`, delete `interactions: InteractionEvent[];`.
- Delete the `InteractionEvent`, `PendingEffect`, `InteractionRule`, `RollPlan` interface declarations.
- In `GameEngine.ts`, delete every `this.state.interactions = [];` / `interactions: this.state.interactions,` and the `debugForcedEffect: null` initializer. Remove now-unused imports.

- [ ] **Step 3: Build to find dangling references**

Run: `npm run build`
Expected: PASS after all readers removed. Fix each `noUnusedLocals`/missing-property error the compiler reports; iterate until green.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all pass (update any test that constructed a `RunRecord`/`GameState` with `interactions`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(engine): remove orphaned legacy types and dead interactions field (B4)"
```

---

### Task 14: B5 — distinct animation keys for reused effects

`fate-thin-pool` reuses `animation: 'widen'`; `chaos-happening-interrupt` reuses `'second-result'`. Give them distinct visuals so the effects read differently.

**Files:**
- Modify: `src/engine/responders/affinity.ts` (change the two `animation` strings)
- Create: `src/components/overlays/InteractionAnimations/ThinAnimation.tsx`, `src/components/overlays/InteractionAnimations/InterruptAnimation.tsx`
- Modify: `src/components/overlays/InteractionSequencer.tsx` (register the new keys + durations)

**Interfaces:**
- Produces: animation keys `'thin'` and `'interrupt'`.

- [ ] **Step 1: Change the responder animation keys**

In `affinity.ts`: `fate-thin-pool` report → `'thin'` (line 36); `chaos-happening-interrupt` report → `'interrupt'` (line 103).

- [ ] **Step 2: Create the two components**

Create `ThinAnimation.tsx` (mirror `WidenAnimation`'s prop shape, but a contracting motion) and `InterruptAnimation.tsx` (a sharp tear/flash). Each accepts `{ description?, sourceSlot?, targetSlot? }` and returns a `motion.div`. Copy `SecondResultAnimation.tsx`'s structure and invert/retune the motion (contracting ripple for thin; a quick opacity-flash bar for interrupt).

- [ ] **Step 3: Register them in the sequencer**

In `InteractionSequencer.tsx`: import both; add `case 'thin':` and `case 'interrupt':` to `renderAnimation`; add `thin: 1500, interrupt: 2000` to the `DURATION` map.

- [ ] **Step 4: Typecheck + manual**

Run: `npm run build` → PASS.
Run `npm run dev`, force `fate-thin-pool` and `chaos-happening-interrupt`, confirm distinct visuals.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/affinity.ts src/components/overlays/InteractionAnimations/ThinAnimation.tsx src/components/overlays/InteractionAnimations/InterruptAnimation.tsx src/components/overlays/InteractionSequencer.tsx
git commit -m "feat(ui): distinct animations for thin-pool and happening-interrupt (B5)"
```

---

### Task 15: B6 — minor / cosmetic cleanups

Low-risk polish. Each is independent; skip any that no longer apply.

**Files:**
- Modify: `src/engine/events/types.ts` (`PRIORITY_BANDS` → `readonly`)
- Modify: `src/engine/responders/affinity.ts` (remove unreachable `describeRollMode` branch if present)
- Modify: `src/engine/__tests__/Reducers.test.ts` (assert the `draft` mutation in the empty-mods case)

**Interfaces:** none changed externally.

- [ ] **Step 1: Make PRIORITY_BANDS readonly**

In `events/types.ts`:

```ts
export const PRIORITY_BANDS: readonly PriorityBand[] = ['STRUCTURAL', 'MUTATE', 'SPAWN', 'OVERRIDE'];
```

Run `npm run build`; fix any consumer that mutated/indexed it incompatibly (indexing is fine; `.indexOf` is fine).

- [ ] **Step 2: Remove the unreachable describeRollMode branch**

Locate `describeRollMode` (search the engine); if the `single && !offerReroll` branch is preceded by a null-return guard making it unreachable, delete the dead branch. If it is not actually unreachable, leave it. Run `npm test`.

- [ ] **Step 3: Strengthen the Reducers empty-mods test**

In `Reducers.test.ts`, in the empty-mods case, add an assertion that the reducer left `draft.rollMode`/`draft.offerReroll` at their expected defaults (i.e. the `draft` mutation is correct), not only that the return is null.

- [ ] **Step 4: Run suite + build**

Run: `npm test` → all pass.
Run: `npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(engine): minor cleanups — readonly bands, dead branch, reducer test (B6)"
```

---

## Notes carried from the handover (do not re-litigate)

- `chaos-dominant` is a synthetic source tag the resolver injects at `chaos >= 0.5`; `chaos-second-result` is additionally gated by its `bandRoll`. Affinities are 0–100 internally (`bandOf`), not 0.0–1.0 — verify band thresholds against `src/data/affinities.ts` when choosing test affinity values.
- Happening slots never accumulate affinity on reveal; only happening *choices* shift affinity. Synthesis/run-records filter happening slots.
- `forced` bypasses `roll()` only, never `condition()` — every debug scenario must stage the precondition (Task 9).
- Carryover (`affinities`, `history`, `usedHappeningIds`) persists across runs; everything else resets per turn. The new `turnEffects` accumulator (Task 12) is per-turn, not carryover.

## Self-Review (completed during authoring)

- **Spec coverage:** A1 (Tasks 3–4), A2 (Task 2), A3 bug (Task 1) + mechanic (Task 8), A4 (Tasks 6–7), A5 (Task 10), A6 (Task 9), B1 (Task 11), B2 (Task 12), B3 (Task 5), B4 (Task 13), B5 (Task 14), B6 (Task 15). All 12 items mapped.
- **Sequencing:** matches the handover's 6-step order; review checkpoints between phases.
- **Open forks resolved:** scope = all of A+B; phased structure; B2 = re-wire; B1 = tap→reveal redirect.
- **Testing honesty:** engine changes use TDD via Vitest; UI-only changes are verified by typecheck + manual dev-server checks because there is no component test harness — no fabricated component tests.
- **Verification flags:** several steps say "verify against `bandOf`/`interactions.ts`/`affinities.ts` before finalizing" because exact band thresholds and precondition tags must be read at implementation time; these are not placeholders for behavior but guards against drift in fixture values.
