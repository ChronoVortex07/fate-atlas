# Interaction Result Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `state.turnResults` the single source of truth for displaying committed results so interaction effects (Fool's Reroll, etc.) are reflected — with animation — in the centered minigame view.

**Architecture:** The engine tracks which slot is in focus (`activeSlotIndex`) and applies an interaction's effect at the sequencer's *reveal* step (while the minigame is still mounted) rather than coupled to the screen transition. Minigames render their committed result from the engine slot; the dice reveal becomes a self-contained, replayable `DiceThrowAnimation` component (the future physics-throw seam).

**Tech Stack:** React 18, TypeScript (strict), Vite, Framer Motion, Vitest (engine tests only).

## Global Constraints

- Engine code in `src/engine/` stays framework-free: zero React/DOM imports.
- Every engine mutator ends with `notify()`.
- Typecheck with `npm run build` (or `npx tsc -b`); `noUnusedLocals`/`noUnusedParameters` are on — no unused symbols.
- Engine tests live under `src/engine/__tests__/`; run with `npm test`. There is no component test harness — component tasks are verified by typecheck + manual run.
- Reference the design: `docs/superpowers/specs/2026-06-20-interaction-result-display-design.md`.

---

### Task 1: Engine — `activeSlotIndex` and canonical committed index

**Files:**
- Modify: `src/engine/types.ts` (add field to `GameState`, ~line 192-212)
- Modify: `src/engine/GameEngine.ts` (`defaultState` ~43-65, `startTurn` ~76-101, `completeMinigame` ~129-155, `returnToQuestionSelect` ~504-520)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces: `GameState.activeSlotIndex: number | null` — index into `turnResults` of the result the active minigame just produced; set on commit, `null` otherwise. The interaction event's `targetSlotIndex` is derived from the same canonical index (`turnResults.length - 1` after append).

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/GameEngine.test.ts`, inside the top-level `describe('GameEngine — new lifecycle', ...)` block (before its closing `});`):

```ts
  it('completeMinigame sets activeSlotIndex to the committed slot index', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20', result: 10, threshold: 'neutral',
      interpretation: 'Steady', tags: ['roll', 'numeric'],
    });

    const state = engine.getState();
    expect(state.activeSlotIndex).toBe(state.turnResults.length - 1);
  });

  it('startTurn resets activeSlotIndex to null', () => {
    engine.startTurn('self');
    engine.loadState({ activeSlotIndex: 2 });
    expect(engine.getState().activeSlotIndex).toBe(2);
    engine.startTurn('self');
    expect(engine.getState().activeSlotIndex).toBeNull();
  });

  it('activeSlotIndex and targetSlotIndex use the real appended index after a prior append', () => {
    engine.startTurn('self');
    // Simulate a turn where a second-result already appended an extra slot:
    // turnResults has 2 entries but only 1 counted minigame.
    engine.loadState({
      turnResults: [
        { type: 'd20', result: 10, threshold: 'neutral', interpretation: 'x', tags: ['roll', 'numeric'] },
        { type: 'd20', result: 11, threshold: 'neutral', interpretation: 'x', tags: ['roll', 'numeric'] },
      ],
      minigamesCompleted: 1,
      pendingEffects: [{
        id: 'pe', sourceRunId: 'r', sourceCard: 'c', sourceSlotIndex: 0,
        triggerTags: ['roll', 'numeric'], action: 'reroll', description: 'd',
        expiresAfter: 3, turnsRemaining: 3,
      }],
    });

    engine.completeMinigame({
      type: 'd20', result: 7, threshold: 'low', interpretation: 'x', tags: ['roll', 'numeric'],
    });

    const state = engine.getState();
    expect(state.activeSlotIndex).toBe(2); // new slot is at index 2, not completed-1 (=1)
    const ev = state.interactions[state.interactions.length - 1];
    expect(ev.targetSlotIndex).toBe(2);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "activeSlotIndex"`
Expected: FAIL — `activeSlotIndex` is not on the state object / is `undefined` (and the targetSlotIndex assertion expects 2 but gets 1).

- [ ] **Step 3: Add the field to `GameState`**

In `src/engine/types.ts`, inside `interface GameState`, add after `minigamesCompleted: number;`:

```ts
  activeSlotIndex: number | null;
```

- [ ] **Step 4: Initialize and reset the field**

In `src/engine/GameEngine.ts`:

In `defaultState()`, add after `minigamesCompleted: 0,`:
```ts
      activeSlotIndex: null,
```

In `startTurn()`, add after `this.state.minigamesCompleted = 0;`:
```ts
    this.state.activeSlotIndex = null;
```

In `returnToQuestionSelect()`, add after `this.state.minigamesCompleted = 0;`:
```ts
    this.state.activeSlotIndex = null;
```

(`reset()` and `returnToTitle()` rebuild from `defaultState()`, so they are already covered.)

- [ ] **Step 5: Set the canonical committed index in `completeMinigame`**

In `src/engine/GameEngine.ts`, replace the top of `completeMinigame` (the append + counter lines):

```ts
    // Add result to the turn's results array
    this.state.turnResults = [...this.state.turnResults, result];
    const completed = this.state.minigamesCompleted + 1;
    this.state.minigamesCompleted = completed;
```

with:

```ts
    // Add result to the turn's results array
    this.state.turnResults = [...this.state.turnResults, result];
    // Canonical index of the just-committed result. NOTE: not `completed - 1`,
    // which diverges from the array index after a `second-result` append.
    const committedIndex = this.state.turnResults.length - 1;
    this.state.activeSlotIndex = committedIndex;
    const completed = this.state.minigamesCompleted + 1;
    this.state.minigamesCompleted = completed;
```

Then in the `interactionEvents` map a few lines below, change:
```ts
      targetSlotIndex: completed - 1,
```
to:
```ts
      targetSlotIndex: committedIndex,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts`
Expected: PASS (all existing tests still pass; the three new ones pass).

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat: track activeSlotIndex with canonical committed index"
```

---

### Task 2: Engine — deferred effect application (`applyHeadInteraction` + guard)

**Files:**
- Modify: `src/engine/types.ts` (add field to `GameState`)
- Modify: `src/engine/GameEngine.ts` (`defaultState`, `startTurn`, `returnToQuestionSelect`, new `applyHeadInteraction`, `advanceInteractionQueue` ~210-242)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: `GameState.turnResults`, `GameState.interactionQueue`, `executeEffect` (existing private).
- Produces:
  - `GameState.interactionApplied: boolean` — true once the head interaction's effect has been applied; prevents double application.
  - `applyHeadInteraction(): void` — applies the head interaction's effect once (no dequeue, no screen change). Safe to call repeatedly.
  - `advanceInteractionQueue(): void` — now dequeues + transitions; applies the head effect only if not already applied, then resets `interactionApplied`.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/GameEngine.test.ts` inside the same top-level `describe`:

```ts
  // Shared helper: a frozen-on-minigame state with one second-result interaction
  // queued against slot 0. second-result appends exactly one slot per application,
  // which makes double-application observable via turnResults.length.
  const loadQueuedSecondResult = (e: GameEngine) => {
    e.startTurn('self');
    e.loadState({
      screen: 'minigame',
      minigamesCompleted: 1,
      activeSlotIndex: 0,
      interactionApplied: false,
      turnResults: [
        { type: 'd20', result: 10, threshold: 'neutral', interpretation: 'x', tags: ['roll', 'numeric'] },
      ],
      interactionQueue: [
        { ruleId: 'sr', sourceSlotIndex: 0, targetSlotIndex: 0, effect: 'second-result', description: 'd' },
      ],
    });
  };

  it('applyHeadInteraction applies the head effect without dequeuing or transitioning', () => {
    loadQueuedSecondResult(engine);
    engine.applyHeadInteraction();
    const s = engine.getState();
    expect(s.turnResults).toHaveLength(2);      // one slot appended
    expect(s.interactionQueue).toHaveLength(1); // not dequeued
    expect(s.screen).toBe('minigame');          // no transition
    expect(s.interactionApplied).toBe(true);
  });

  it('applyHeadInteraction is idempotent for the same head', () => {
    loadQueuedSecondResult(engine);
    engine.applyHeadInteraction();
    engine.applyHeadInteraction();
    expect(engine.getState().turnResults).toHaveLength(2); // still only one append
  });

  it('advanceInteractionQueue after apply does not re-apply, resets flag, and transitions', () => {
    loadQueuedSecondResult(engine);
    engine.applyHeadInteraction();
    engine.advanceInteractionQueue();
    const s = engine.getState();
    expect(s.turnResults).toHaveLength(2);       // no second append
    expect(s.interactionQueue).toHaveLength(0);
    expect(s.interactionApplied).toBe(false);
    expect(s.screen).toBe('method-select');      // 1 < 3 minigames
  });

  it('advanceInteractionQueue applies the head effect when not yet applied (fast tap)', () => {
    loadQueuedSecondResult(engine);
    engine.advanceInteractionQueue();
    const s = engine.getState();
    expect(s.turnResults).toHaveLength(2);       // applied during advance
    expect(s.interactionQueue).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "applyHeadInteraction"`
Expected: FAIL — `engine.applyHeadInteraction is not a function` / `interactionApplied` undefined.

- [ ] **Step 3: Add the `interactionApplied` field**

In `src/engine/types.ts`, inside `interface GameState`, add after the `activeSlotIndex` line from Task 1:
```ts
  interactionApplied: boolean;
```

In `src/engine/GameEngine.ts` `defaultState()`, add after `activeSlotIndex: null,`:
```ts
      interactionApplied: false,
```

In `startTurn()` and `returnToQuestionSelect()`, add after the `this.state.activeSlotIndex = null;` line added in Task 1:
```ts
    this.state.interactionApplied = false;
```

- [ ] **Step 4: Add `applyHeadInteraction` and update `advanceInteractionQueue`**

In `src/engine/GameEngine.ts`, add this method immediately above `advanceInteractionQueue`:

```ts
  // Apply the head interaction's effect while the minigame is still mounted
  // (called by the sequencer at its reveal step). Does not dequeue or change
  // the screen; the guard makes repeat calls safe.
  applyHeadInteraction(): void {
    if (this.state.interactionQueue.length === 0) return;
    if (this.state.interactionApplied) return;
    this.executeEffect(this.state.interactionQueue[0]);
    this.state.interactionApplied = true;
    this.notify();
  }
```

Then in `advanceInteractionQueue`, replace the opening lines:

```ts
    const completed = this.state.interactionQueue[0];
    this.executeEffect(completed);
    this.state.interactionQueue = this.state.interactionQueue.slice(1);
```

with:

```ts
    const completed = this.state.interactionQueue[0];
    // The effect is normally applied earlier at the sequencer's reveal step;
    // apply here only if that didn't happen (e.g. a fast tap skipped the beat).
    if (!this.state.interactionApplied) {
      this.executeEffect(completed);
    }
    this.state.interactionApplied = false;
    this.state.interactionQueue = this.state.interactionQueue.slice(1);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts`
Expected: PASS (new tests pass; the existing `executeEffect reroll replaces dice result` and other advance tests still pass because `interactionApplied` defaults to `false`, so `advanceInteractionQueue` still applies).

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat: apply interaction effects at reveal step, decoupled from screen transition"
```

---

### Task 3: DiceMinigame renders its result from the engine via `DiceThrowAnimation`

**Files:**
- Create: `src/components/screens/DiceThrowAnimation.tsx`
- Modify: `src/components/screens/DiceMinigame.tsx`
- Verification: typecheck + manual run (no component test harness)

**Interfaces:**
- Consumes: `GameState.activeSlotIndex` (Task 1), `GameState.turnResults`.
- Produces: `DiceThrowAnimation` — `default export function DiceThrowAnimation({ value, threshold }: { value: number; threshold: string })`; also `export const THRESHOLD_COLORS: Record<string, string>`. Plays a count-up to `value` on mount; the parent remounts it via `key={value}` to replay on a reroll. This is the seam where a future physics throw replaces the internals.

- [ ] **Step 1: Create `DiceThrowAnimation.tsx`**

Create `src/components/screens/DiceThrowAnimation.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const THRESHOLD_COLORS: Record<string, string> = {
  'critical-low': '#c0392b',
  'low': '#c75b4a',
  'neutral': '#7b9ec7',
  'high': '#5b8c5a',
  'critical-high': '#d4a854',
};

interface Props {
  value: number; // final die value, 1-20
  threshold: string; // for number color
}

// Presentational dice reveal: counts up to `value` on mount. The parent
// remounts this (key={value}) so a reroll replays the throw. This component
// is the single seam for a future physics-based throw — swap the internals
// here without touching DiceMinigame or the engine.
export default function DiceThrowAnimation({ value, threshold }: Props) {
  const [rollValue, setRollValue] = useState(0);

  useEffect(() => {
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= value) {
        clearInterval(interval);
        setRollValue(value);
      } else {
        setRollValue(Math.min(count, 20));
      }
    }, 50);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <motion.div
      style={dieResultStyle}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
    >
      <span style={{ ...resultNumberStyle, color: THRESHOLD_COLORS[threshold] ?? '#c8d8f0' }}>
        {rollValue}
      </span>
    </motion.div>
  );
}

const dieResultStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  background: '#0d1220',
  border: '2px solid #1a2440',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const resultNumberStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: '3rem',
  transition: 'color 0.5s ease',
};
```

- [ ] **Step 2: Rewrite `DiceMinigame.tsx` to source its result from the engine**

Replace the entire contents of `src/components/screens/DiceMinigame.tsx` with:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import type { DiceResult } from '../../engine/types';
import DiceThrowAnimation, { THRESHOLD_COLORS } from './DiceThrowAnimation';

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const [thrown, setThrown] = useState(false);
  const [localResult, setLocalResult] = useState<DiceResult | null>(null);

  const handleThrow = useCallback(() => {
    setThrown(true);
    setLocalResult(rollD20(state.affinities));
  }, [state.affinities]);

  // Commit after a beat so the player sees the initial roll before any
  // interaction sequence begins.
  useEffect(() => {
    if (!localResult || !thrown) return;
    const timer = setTimeout(() => {
      engine.completeMinigame(localResult);
    }, 1500);
    return () => clearTimeout(timer);
  }, [localResult, thrown, engine]);

  // Once committed, the engine owns this slot — display from it so interaction
  // effects (e.g. Fool's Reroll) are reflected. Before commit, use local roll.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayResult: DiceResult | null =
    committedSlot && committedSlot.type === 'd20' ? committedSlot : localResult;

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
        ) : (
          displayResult && (
            <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              {/* key on the value so a reroll remounts and replays the throw */}
              <DiceThrowAnimation key={displayResult.result} value={displayResult.result} threshold={displayResult.threshold} />
              <motion.div style={thresholdStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <span style={{ ...thresholdBadgeStyle, color: THRESHOLD_COLORS[displayResult.threshold], borderColor: THRESHOLD_COLORS[displayResult.threshold] }}>
                  {displayResult.threshold.replace(/-/g, ' ').toUpperCase()}
                </span>
                <p style={interpretationStyle}>{displayResult.interpretation}</p>
              </motion.div>
            </motion.div>
          )
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '500px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.12em',
  margin: 0,
  textAlign: 'center',
};

const dieButtonStyle: React.CSSProperties = {
  width: '120px',
  height: '120px',
  background: '#0d1220',
  border: '2px solid #c75b4a',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
};

const dieFaceStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  lineHeight: 1,
};

const tapHintStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.6rem',
  color: '#5b7290',
  letterSpacing: '0.1em',
};

const resultContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
};

const thresholdStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const thresholdBadgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.7rem',
  letterSpacing: '0.15em',
  padding: '0.3rem 0.8rem',
  border: '1px solid',
  borderRadius: '3px',
};

const interpretationStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  margin: 0,
  maxWidth: '300px',
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors (no unused locals — the old `result`/`rollValue` state and `getThreshold` usages are gone).

- [ ] **Step 4: Run the engine tests (regression guard)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/DiceThrowAnimation.tsx src/components/screens/DiceMinigame.tsx
git commit -m "feat: dice minigame renders committed result from engine via DiceThrowAnimation"
```

---

### Task 4: InteractionSequencer applies the head effect at the reveal step

**Files:**
- Modify: `src/components/overlays/InteractionSequencer.tsx`
- Verification: typecheck + manual run

**Interfaces:**
- Consumes: `engine.applyHeadInteraction()` (Task 2), existing `currentStep`, `stepIndex`, `currentDescriptor` locals.

- [ ] **Step 1: Apply the effect when the reveal step begins**

In `src/components/overlays/InteractionSequencer.tsx`, add a new effect immediately after the existing "Update activeSlots based on current step" `useEffect` (the one ending around the `}, [stepIndex, currentDescriptor]);` near line 170):

```tsx
  // Apply the head interaction's effect when the reveal step begins, so the
  // change lands while the minigame is still mounted and can animate it.
  // The engine guards against double application.
  useEffect(() => {
    if (currentStep?.id === 'reveal') {
      engine.applyHeadInteraction();
    }
    // Deps mirror the sibling step-effect above; `currentStep` is derived from
    // these and read from the closure. The engine guard makes repeats safe.
  }, [stepIndex, currentDescriptor]);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Manual verification — the headline scenario**

Run: `npm run dev`, open http://localhost:5173.
- Open the debug panel and load the **Fool's Reroll** scenario.
- Throw the die; note the initial number.
- Tap through the interaction sequence to the reveal step.

Expected:
- The centered die **re-rolls with the count-up animation** and shows a (usually) new number at the reveal step, *before* you tap to continue.
- The threshold badge/interpretation update to match.
- After continuing, the bottom CardTableau shows the same rerolled value.

- [ ] **Step 4: Commit**

```bash
git add src/components/overlays/InteractionSequencer.tsx
git commit -m "feat: apply interaction effect at sequencer reveal step"
```

---

### Task 5: Tarot and I Ching minigames render their result from the engine

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx` (`revealed` phase, ~104-114)
- Modify: `src/components/screens/IChingMinigame.tsx` (`done` result block, ~58-69)
- Verification: typecheck + manual run

**Interfaces:**
- Consumes: `GameState.activeSlotIndex` (Task 1), `GameState.turnResults`.

This generalizes the fix so flip/mirror (tarot) and any future effect on these types are reflected in the centered view, and the displays stop relying on stale local state once committed.

- [ ] **Step 1: TarotMinigame — derive the revealed card from the engine when committed**

In `src/components/screens/TarotMinigame.tsx`, add this just before the `return (` statement (after the reveal `useEffect`):

```tsx
  // Once committed, the engine owns this slot. Prefer it so flip/mirror are
  // reflected; fall back to the locally chosen card before commit.
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const engineCard = committedSlot && committedSlot.type === 'tarot' ? committedSlot : null;
  const localCard = chosenIndex !== null ? faceDownCards[chosenIndex] : null;
  const localOrientation: 'upright' | 'reversed' | null = localCard
    ? (willReverse
        ? (localCard.orientation === 'upright' ? 'reversed' : 'upright')
        : localCard.orientation)
    : null;
  const displaySymbol = engineCard?.symbol ?? localCard?.symbol ?? '';
  const displayName = engineCard?.name ?? localCard?.name ?? '';
  const displayOrientation = engineCard?.orientation ?? localOrientation;
```

Then replace the `phase === 'revealed'` block (the `<motion.div style={revealStyle} ...>` through its closing `</motion.div>`) with:

```tsx
        {phase === 'revealed' && displayOrientation && (
          <motion.div
            key={`${displayName}-${displayOrientation}`}
            style={revealStyle}
            initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div style={revealedSymbolStyle}>{displaySymbol}</div>
            <div style={revealedNameStyle}>{displayName}</div>
            <div style={{ ...revealedOrientStyle, color: displayOrientation === 'reversed' ? '#d4a854' : '#7b9ec7' }}>
              {displayOrientation === 'reversed' ? '▼ Reversed' : '▲ Upright'}
            </div>
          </motion.div>
        )}
```

The `key` makes a flip/mirror remount the card so the reveal animation replays.

- [ ] **Step 2: IChingMinigame — derive the revealed hexagram from the engine when committed**

In `src/components/screens/IChingMinigame.tsx`, add just before `return (` (after the commit `useEffect`):

```tsx
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const displayHex =
    committedSlot && committedSlot.type === 'iching' ? committedSlot : hexagramResult;
```

Then replace the `done` result block (the `<motion.div style={hexagramResultStyle} ...>` through its closing `</motion.div>`) with:

```tsx
          <motion.div
            key={displayHex ? `${displayHex.hexagramNumber}-${displayHex.changingLines.join(',')}` : 'hex'}
            style={hexagramResultStyle}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div style={hexagramSymbolStyle}>{displayHex?.symbol}</div>
            <div style={hexagramNameStyle}>{displayHex?.name}</div>
            <div style={hexagramNumberStyle}>Hexagram #{displayHex?.hexagramNumber}</div>
            <p style={hexagramJudgmentStyle}>{displayHex?.judgment}</p>
            {displayHex && displayHex.changingLines.length > 0 && (
              <div style={changingLinesStyle}>
                Changing lines: {displayHex.changingLines.join(', ')}
              </div>
            )}
          </motion.div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors (no unused locals — confirm `hexagramResult` is still referenced via `displayHex`'s fallback, and `willReverse`/`faceDownCards`/`chosenIndex` are still used).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`.
- Load the **Critical Flip** scenario, play the tarot draw. When the flip interaction reaches its reveal step, the centered card's orientation flips (and re-animates) while still on the minigame screen.
- Load the **Mirror Event** scenario; confirm reflected cards update.
- Load the **I Ching Boost** scenario; confirm the hexagram still renders correctly through the interaction.

- [ ] **Step 5: Run engine tests + commit**

```bash
npm test
git add src/components/screens/TarotMinigame.tsx src/components/screens/IChingMinigame.tsx
git commit -m "feat: tarot and iching minigames render committed result from engine"
```

---

## Self-Review

**Spec coverage:**
- §1 engine `activeSlotIndex` + canonical committed index → Task 1. ✓
- §2 minigame display reads from engine + value-keyed replay → Tasks 3 (dice), 5 (tarot/iching). ✓
- §3 `DiceThrowAnimation` replayable seam → Task 3. ✓
- §4 deferred effect application (`applyHeadInteraction`, `interactionApplied`, reveal-step apply) → Task 2 (engine) + Task 4 (sequencer call). ✓
- §5 GameTable unchanged → no task needed (working copy already correct). ✓
- Testing bullets → covered by Task 1 tests (activeSlotIndex/targetSlotIndex) and Task 2 tests (apply/idempotency/advance). ✓

**Type consistency:** `activeSlotIndex: number | null`, `interactionApplied: boolean`, `applyHeadInteraction(): void`, `DiceThrowAnimation({ value, threshold })`, exported `THRESHOLD_COLORS` — names match across tasks.

**Placeholder scan:** none — every step has concrete code/commands.

**Note for the implementer:** the working tree already contains uncommitted changes from the earlier attempt (GameTable, CardTableau, InteractionSequencer, etc.). These are the correct baseline this plan builds on — do not revert them. Commit them or leave them staged alongside the task commits per your workflow.
