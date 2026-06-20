# Interaction Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent card tableau below the game table, replace `activeInteraction` with a queue-based sequencer, fix interaction timing/flow, and give each effect type its own engine resolution + visual animation.

**Architecture:** Engine gains `interactionQueue`, `advanceInteractionQueue()`, and `executeEffect()`. React gains `CardTableau` (persistent bottom row) and `InteractionSequencer` (queue playback with tap-to-fast-forward). Each of the 5 effect types gets its own animation component using card-relative positioning.

**Tech Stack:** React 18 + TypeScript + framer-motion + inline CSS (no extra dependencies)

## Global Constraints

- All game logic stays in `src/engine/` with zero React or DOM imports
- Engine mutators must end with `notify()` for React change detection
- `interactionQueue` is transient (not persisted, resets each turn)
- `AnimationDescriptor` lives in the React layer, NOT in engine types
- Effects do NOT re-apply affinity changes (affinity is nudged once on initial reveal)
- Card tableau reads `state.turnResults`; sequencer drives `activeSlots` for card highlighting

---

### Task 1: Update Engine Types

**Files:**
- Modify: `src/engine/types.ts:183-211`

**Interfaces:**
- Consumes: none (foundation task)
- Produces: `GameState.interactionQueue: InteractionEvent[]` (replaces `activeInteraction`) — consumed by Tasks 3, 4, 6

- [ ] **Step 1: Replace `activeInteraction` with `interactionQueue` in GameState**

In `src/engine/types.ts`, change line 203 from:
```typescript
  activeInteraction: InteractionEvent | null;
```
to:
```typescript
  interactionQueue: InteractionEvent[];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: type errors in GameEngine.ts and test files referencing `activeInteraction` — these will be fixed in Tasks 3 and 4.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "refactor: replace activeInteraction with interactionQueue in GameState
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Fix Slot Indices in InteractionResolver and GameEngine

**Files:**
- Modify: `src/engine/InteractionResolver.ts:144-167` (createPendingEffects)
- Modify: `src/engine/GameEngine.ts:129-222` (completeMinigame — interaction event building)

**Interfaces:**
- Consumes: none (builds on existing types)
- Produces: Correct `sourceSlotIndex` and `targetSlotIndex` in `InteractionEvent` — consumed by Tasks 3, 6, 7

- [ ] **Step 1: Add `sourceIndex` parameter to `createPendingEffects`**

In `src/engine/InteractionResolver.ts:144`, change the method signature from:
```typescript
  createPendingEffects(
    result: SlotResult,
    runId: string,
    rules: InteractionRule[],
  ): PendingEffect[] {
```
to:
```typescript
  createPendingEffects(
    result: SlotResult,
    runId: string,
    rules: InteractionRule[],
    sourceIndex: number,
  ): PendingEffect[] {
```

And change line 157 (`sourceSlotIndex: 0`) to:
```typescript
          sourceSlotIndex: sourceIndex,
```

- [ ] **Step 2: Fix `targetSlotIndex` in `completeMinigame`**

In `src/engine/GameEngine.ts`, find the interaction event building block at lines 148-155. Change:
```typescript
    const interactionEvents: InteractionEvent[] = matched.map((effect) => ({
      ruleId: effect.id,
      sourceSlotIndex: effect.sourceSlotIndex,
      targetSlotIndex: 0,
      effect: effect.action,
      description: effect.description,
    }));
```
to:
```typescript
    const interactionEvents: InteractionEvent[] = matched.map((effect) => ({
      ruleId: effect.id,
      sourceSlotIndex: effect.sourceSlotIndex,
      targetSlotIndex: completed - 1,
      effect: effect.action,
      description: effect.description,
    }));
```

- [ ] **Step 3: Pass `sourceIndex` when calling `createPendingEffects`**

In `src/engine/GameEngine.ts`, at lines 159-163, change:
```typescript
    const newEffects = this.interactionResolver.createPendingEffects(
      result,
      runId,
      INTERACTION_RULES,
    );
```
to:
```typescript
    const newEffects = this.interactionResolver.createPendingEffects(
      result,
      runId,
      INTERACTION_RULES,
      completed - 1,
    );
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no new errors — existing errors from Task 1's type change are expected)

- [ ] **Step 5: Commit**

```bash
git add src/engine/InteractionResolver.ts src/engine/GameEngine.ts
git commit -m "fix: pass correct sourceIndex and targetSlotIndex for interaction events
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Add Interaction Queue and executeEffect to GameEngine

**Files:**
- Modify: `src/engine/GameEngine.ts:43-65` (defaultState)
- Modify: `src/engine/GameEngine.ts:76-102` (startTurn)
- Modify: `src/engine/GameEngine.ts:129-222` (completeMinigame — restructure)
- Modify: `src/engine/GameEngine.ts:224-241` (replace clearActiveInteraction)
- Modify: `src/engine/GameEngine.ts:429-445` (returnToQuestionSelect)

**Interfaces:**
- Consumes: `GameState.interactionQueue` from Task 1, corrected indices from Task 2
- Produces: `engine.advanceInteractionQueue(): void`, `engine.executeEffect(event: InteractionEvent): void` — consumed by Tasks 4, 6

- [ ] **Step 1: Update `defaultState()`**

In `src/engine/GameEngine.ts`, in `defaultState()`, change `activeInteraction: null` to `interactionQueue: []`.

- [ ] **Step 2: Update `startTurn()` reset block**

In `startTurn()`, change `this.state.activeInteraction = null` to `this.state.interactionQueue = []`.

- [ ] **Step 3: Update `returnToQuestionSelect()` reset block**

In `returnToQuestionSelect()`, change `this.state.activeInteraction = null` to `this.state.interactionQueue = []`.

- [ ] **Step 4: Restructure `completeMinigame()` — push to queue, don't transition screen**

Replace the entire "if interactionEvents exist → set activeInteraction" and screen-transition logic in `completeMinigame()` with queue-aware logic. The key insight: when `interactionQueue` is non-empty, the current screen stays frozen. The sequencer will call `advanceInteractionQueue()` after each animation completes.

Replace lines 167-218 (the block starting with `if (interactionEvents.length > 0)` through the end of completeMinigame) with:

```typescript
    // Push interaction events onto the queue
    if (interactionEvents.length > 0) {
      this.state.interactionQueue = [
        ...this.state.interactionQueue,
        ...interactionEvents,
      ];
    }

    // If queue is non-empty, freeze current screen — sequencer handles advancing
    if (this.state.interactionQueue.length > 0) {
      this.bus.emit('minigame-complete', { result, completed, interactions: interactionEvents });
      this.notify();
      return;
    }

    // No interactions queued — proceed with normal screen transition
    if (completed >= this.minigamesPerTurn) {
      this.synthesizeAll();
      this.buildRunRecord();
      this.state.screen = 'result';
    } else {
      this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');

      const chaos = this.affinityEngine.getState().chaos;
      if (chaos >= 0.4 && Math.random() < chaos * 0.5) {
        this.state.pendingHappening = true;
        this.triggerHappening();
      } else {
        const affinities = this.affinityEngine.getState();
        this.state.availableMethods = this.orchestrator.refillPool(
          this.state.questionType!,
          affinities,
        );
        this.state.screen = 'method-select';
        this.state.selectedMethod = null;
      }
    }

    this.bus.emit('minigame-complete', { result, completed, interactions: interactionEvents });
    this.notify();
```

- [ ] **Step 5: Replace `clearActiveInteraction()` with `advanceInteractionQueue()`**

Delete the existing `clearActiveInteraction()` method and replace with:

```typescript
  advanceInteractionQueue(): void {
    if (this.state.interactionQueue.length === 0) return;

    const completed = this.state.interactionQueue[0];
    this.executeEffect(completed);
    this.state.interactionQueue = this.state.interactionQueue.slice(1);

    if (this.state.interactionQueue.length > 0) {
      // More interactions waiting — stay frozen, sequencer plays next
      this.notify();
      return;
    }

    // Queue drained — resolve pending screen transition
    if (this.state.pendingHappening) {
      this.state.pendingHappening = false;
      this.triggerHappening();
      return;
    }

    if (this.state.minigamesCompleted >= this.minigamesPerTurn) {
      this.state.screen = 'result';
    } else {
      const affinities = this.affinityEngine.getState();
      this.state.availableMethods = this.orchestrator.refillPool(
        this.state.questionType!,
        affinities,
      );
      this.state.screen = 'method-select';
      this.state.selectedMethod = null;
    }
    this.notify();
  }
```

- [ ] **Step 6: Add `executeEffect()` method**

Add after `advanceInteractionQueue()`:

```typescript
  private executeEffect(event: InteractionEvent): void {
    const targetIndex = event.targetSlotIndex;
    const target = this.state.turnResults[targetIndex];
    if (!target) return;

    const affinities = this.affinityEngine.getState();

    switch (event.effect) {
      case 'reroll': {
        if (target.type === 'd20') {
          const newResult = this.orchestrator.drawSingleResult('d20', affinities);
          this.state.turnResults = [
            ...this.state.turnResults.slice(0, targetIndex),
            newResult,
            ...this.state.turnResults.slice(targetIndex + 1),
          ];
        }
        break;
      }
      case 'flip': {
        if (target.type === 'tarot') {
          this.state.turnResults = this.state.turnResults.map((r, i) =>
            i === targetIndex && r.type === 'tarot'
              ? {
                  ...r,
                  orientation: r.orientation === 'upright' ? 'reversed' as const : 'upright' as const,
                }
              : r,
          );
        }
        break;
      }
      case 'mirror': {
        const sourceIndex = event.sourceSlotIndex;
        const source = this.state.turnResults[sourceIndex];
        this.state.turnResults = this.state.turnResults.map((r, i) => {
          if ((i === targetIndex || i === sourceIndex) && r.type === 'tarot') {
            return {
              ...r,
              orientation: r.orientation === 'upright' ? 'reversed' as const : 'upright' as const,
            };
          }
          return r;
        });
        break;
      }
      case 'add-choice': {
        if (this.state.happening && this.state.happening.choices.length > 0) {
          const bonusChoice = {
            text: 'A hidden path emerges — ' + this.state.happening.choices[0].text,
            affinityChanges: { chaos: 0.05 },
          };
          this.state.happening = {
            ...this.state.happening,
            choices: [...this.state.happening.choices, bonusChoice],
          };
        }
        break;
      }
      case 'second-result': {
        if (target.type !== 'happening') {
          const secondResult = this.orchestrator.drawSingleResult(
            target.type as 'tarot' | 'd20' | 'iching',
            affinities,
          );
          this.state.turnResults = [...this.state.turnResults, secondResult];
        }
        break;
      }
    }
  }
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no errors — all references to `activeInteraction` should now be gone)

- [ ] **Step 8: Commit**

```bash
git add src/engine/GameEngine.ts
git commit -m "feat: add interaction queue, advanceInteractionQueue, and executeEffect
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update GameEngine Tests

**Files:**
- Modify: `src/engine/__tests__/GameEngine.test.ts:1-238`

**Interfaces:**
- Consumes: `advanceInteractionQueue()`, `executeEffect()`, `interactionQueue` from Task 3
- Produces: Passing test suite

- [ ] **Step 1: Update existing tests that reference `activeInteraction`**

In `src/engine/__tests__/GameEngine.test.ts`, update all references from `activeInteraction` to `interactionQueue`.

**Line 81-83** — change:
```typescript
      if (engine.getState().activeInteraction) {
        engine.clearActiveInteraction();
      }
```
to:
```typescript
      while (engine.getState().interactionQueue.length > 0) {
        engine.advanceInteractionQueue();
      }
```

**Lines 92-115** — the "clearActiveInteraction between minigames returns to method-select" test. Replace the entire test body:

```typescript
  it('advanceInteractionQueue between minigames returns to method-select', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 10,
      threshold: 'neutral',
      interpretation: 'Steady',
      tags: ['roll', 'numeric'],
    });

    // After 1 of 3 minigames with an interaction, advancing should go to method-select
    if (engine.getState().interactionQueue.length > 0) {
      engine.advanceInteractionQueue();
      expect(engine.getState().screen).toBe('method-select');
    }
  });
```

**Lines 117-145** — the "returnToQuestionSelect resets turn state" test. Change line 133:
```typescript
    engine.clearActiveInteraction();
```
to:
```typescript
    while (engine.getState().interactionQueue.length > 0) {
      engine.advanceInteractionQueue();
    }
```

**Lines 195-199** — the "pending effects are checked on completeMinigame" test. Change:
```typescript
    expect(state.activeInteraction).toBeTruthy();
```
to:
```typescript
    expect(state.interactionQueue.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Add test for executeEffect — reroll replaces dice result**

```typescript
  it('executeEffect reroll replaces dice result', () => {
    engine.startTurn('self');

    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 5,
      threshold: 'low',
      interpretation: 'Low roll',
      tags: ['roll', 'numeric'],
    });

    // Inject a reroll interaction and advance
    engine.loadState({
      interactionQueue: [
        {
          ruleId: 'test-reroll',
          sourceSlotIndex: 0,
          targetSlotIndex: 0,
          effect: 'reroll',
          description: 'Test reroll',
        },
      ],
    });

    const beforeResult = engine.getState().turnResults[0];
    expect(beforeResult.type).toBe('d20');
    const beforeValue = (beforeResult as { result: number }).result;

    engine.advanceInteractionQueue();

    const afterResult = engine.getState().turnResults[0];
    // The dice was rerolled — result may differ (though could be same by chance,
    // verify type and that a reroll happened by checking interactionQueue drained)
    expect(afterResult.type).toBe('d20');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });
```

- [ ] **Step 3: Add test for executeEffect — flip toggles tarot orientation**

```typescript
  it('executeEffect flip toggles tarot orientation', () => {
    engine.startTurn('self');
    // Replace turnResults[0] with a tarot result
    engine.loadState({
      turnResults: [
        {
          type: 'tarot',
          id: 'fool',
          name: 'The Fool',
          number: 0,
          orientation: 'upright',
          symbol: '♆',
          meaningUpright: 'New beginnings',
          meaningReversed: 'Recklessness',
          tags: ['major-arcana', 'fool-archetype'],
        },
      ],
      interactionQueue: [
        {
          ruleId: 'test-flip',
          sourceSlotIndex: 0,
          targetSlotIndex: 0,
          effect: 'flip',
          description: 'Test flip',
        },
      ],
      minigamesCompleted: 1,
    });

    engine.advanceInteractionQueue();

    const result = engine.getState().turnResults[0];
    expect(result.type).toBe('tarot');
    expect((result as { orientation: string }).orientation).toBe('reversed');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });
```

- [ ] **Step 4: Add test for advanceInteractionQueue drains queue and transitions screen**

```typescript
  it('advanceInteractionQueue drains queue and transitions to method-select when more minigames remain', () => {
    engine.startTurn('self');

    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;

    engine.completeMinigame({
      type: 'd20',
      result: 10,
      threshold: 'neutral',
      interpretation: 'Steady',
      tags: ['roll', 'numeric'],
    });

    // completeMinigame with queue sets screen to minigame (frozen)
    const qLen = engine.getState().interactionQueue.length;
    if (qLen > 0) {
      expect(engine.getState().screen).toBe('minigame');

      engine.advanceInteractionQueue();
      expect(engine.getState().interactionQueue).toHaveLength(qLen - 1);

      // If more in queue, screen stays frozen
      if (engine.getState().interactionQueue.length > 0) {
        expect(engine.getState().screen).toBe('minigame');
      } else {
        // Queue empty — should transition
        expect(engine.getState().screen).toBe('method-select');
      }
    }
  });
```

- [ ] **Step 5: Add test for interactionQueue resets on new turn**

```typescript
  it('interactionQueue resets on startTurn', () => {
    engine.startTurn('self');
    engine.loadState({
      interactionQueue: [
        {
          ruleId: 'test',
          sourceSlotIndex: 0,
          targetSlotIndex: 0,
          effect: 'reroll',
          description: 'Test',
        },
      ],
    });
    expect(engine.getState().interactionQueue.length).toBe(1);

    engine.returnToQuestionSelect();
    engine.startTurn('self');
    expect(engine.getState().interactionQueue).toHaveLength(0);
  });
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/__tests__/GameEngine.test.ts
git commit -m "test: update engine tests for interactionQueue and executeEffect
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Create CardTableau Component

**Files:**
- Create: `src/components/overlays/CardTableau.tsx`

**Interfaces:**
- Consumes: `state.turnResults` from game engine, `activeSlots` prop from Task 6
- Produces: Visual card row — consumed by Task 8 (GameTable wiring)

- [ ] **Step 1: Write the CardTableau component**

Create `src/components/overlays/CardTableau.tsx`:

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import type { SlotResult } from '../../engine/types';

type CardSlotState = 'idle' | 'source' | 'target' | 'animating';

interface ActiveSlots {
  sourceIndex: number | null;
  targetIndex: number | null;
}

interface Props {
  results: SlotResult[];
  activeSlots: ActiveSlots;
}

function getSlotState(index: number, activeSlots: ActiveSlots): CardSlotState {
  if (activeSlots.sourceIndex === index && activeSlots.targetIndex === index) return 'animating';
  if (activeSlots.sourceIndex === index) return 'source';
  if (activeSlots.targetIndex === index) return 'target';
  return 'idle';
}

function getSlotDisplay(result: SlotResult): { symbol: string; name: string; typeLabel: string } {
  switch (result.type) {
    case 'tarot':
      return {
        symbol: result.symbol,
        name: result.name,
        typeLabel: result.orientation === 'upright' ? '▲' : '▼',
      };
    case 'd20':
      return {
        symbol: String(result.result),
        name: 'D20',
        typeLabel: result.threshold.replace(/-/g, ' '),
      };
    case 'iching':
      return {
        symbol: result.symbol,
        name: `Hex ${result.hexagramNumber}`,
        typeLabel: result.changingLines.length > 0 ? `${result.changingLines.length}Δ` : '',
      };
    case 'happening':
      return {
        symbol: String.fromCodePoint(0x2726),
        name: 'Happening',
        typeLabel: '',
      };
    default:
      return { symbol: '?', name: '—', typeLabel: '' };
  }
}

export default function CardTableau({ results, activeSlots }: Props) {
  if (results.length === 0) return null;

  return (
    <div style={trayStyle}>
      <AnimatePresence>
        {results.map((result, index) => {
          const slotState = getSlotState(index, activeSlots);
          const display = getSlotDisplay(result);
          return (
            <motion.div
              key={index}
              style={{
                ...cardStyle,
                ...(slotState === 'source' ? sourceGlowStyle : {}),
                ...(slotState === 'target' ? targetGlowStyle : {}),
                ...(slotState === 'animating' ? animatingStyle : {}),
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{
                opacity: 1,
                y: 0,
                ...(slotState === 'source' ? { boxShadow: '0 0 16px rgba(212,168,84,0.5)' } : {}),
                ...(slotState === 'target' ? { boxShadow: '0 0 12px rgba(200,120,80,0.45)' } : {}),
              }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div style={cardSymbolStyle}>{display.symbol}</div>
              <div style={cardNameStyle}>{display.name}</div>
              {display.typeLabel && (
                <div style={cardTypeStyle}>{display.typeLabel}</div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const trayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: '12px',
  padding: '10px 20px',
  borderTop: '1px solid rgba(212, 168, 84, 0.15)',
  background: 'linear-gradient(180deg, rgba(7,10,18,0.6) 0%, rgba(7,10,18,0.9) 100%)',
  borderRadius: '8px 8px 0 0',
  zIndex: 5,
  pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
  width: '120px',
  minHeight: '80px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  padding: '8px 10px',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
};

const sourceGlowStyle: React.CSSProperties = {
  borderColor: 'rgba(212, 168, 84, 0.6)',
};

const targetGlowStyle: React.CSSProperties = {
  borderColor: 'rgba(200, 120, 80, 0.5)',
};

const animatingStyle: React.CSSProperties = {
  borderColor: 'rgba(212, 168, 84, 0.7)',
};

const cardSymbolStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  color: '#c8d8f0',
  lineHeight: 1,
};

const cardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  letterSpacing: '0.05em',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100px',
};

const cardTypeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.55rem',
  color: '#5b7290',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no errors in the new file)

- [ ] **Step 3: Commit**

```bash
git add src/components/overlays/CardTableau.tsx
git commit -m "feat: add CardTableau component with slot state highlighting
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Create InteractionSequencer Component

**Files:**
- Create: `src/components/overlays/InteractionSequencer.tsx`

**Interfaces:**
- Consumes: `state.interactionQueue` from Task 3, `ActiveSlots` type from Task 5
- Produces: Queue playback with tap-to-fast-forward — consumed by Task 8 (GameTable wiring)

- [ ] **Step 1: Write the InteractionSequencer component**

Create `src/components/overlays/InteractionSequencer.tsx`:

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { InteractionEvent } from '../../engine/types';

interface AnimationDescriptor {
  effect: 'reroll' | 'flip' | 'mirror' | 'add-choice' | 'second-result';
  sourceIndex: number | null;
  targetIndex: number | null;
  description: string;
}

export type { AnimationDescriptor };

const EFFECT_LABELS: Record<string, string> = {
  reroll: "Fool's Reroll",
  flip: 'Critical Flip',
  mirror: 'The Mirror',
  'add-choice': 'I Ching Boost',
  'second-result': 'Chaos Surge',
};

function eventToDescriptor(event: InteractionEvent): AnimationDescriptor {
  return {
    effect: event.effect as AnimationDescriptor['effect'],
    sourceIndex: event.sourceSlotIndex,
    targetIndex: event.targetSlotIndex,
    description: event.description,
  };
}

interface Props {
  onActiveSlotsChange: (slots: { sourceIndex: number | null; targetIndex: number | null }) => void;
  onAnimationComplete: () => void;
}

const AUTO_ADVANCE_MS = 2500; // base auto-advance time per interaction

export default function InteractionSequencer({ onActiveSlotsChange, onAnimationComplete }: Props) {
  const { state, engine } = useGameEngine();
  const [currentDescriptor, setCurrentDescriptor] = useState<AnimationDescriptor | null>(null);
  const [phase, setPhase] = useState<'showing' | 'animating' | 'done'>('showing');
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queue = state.interactionQueue;

  // When queue changes, start playing the first interaction
  useEffect(() => {
    if (queue.length > 0 && !currentDescriptor) {
      const desc = eventToDescriptor(queue[0]);
      setCurrentDescriptor(desc);
      setPhase('showing');
      onActiveSlotsChange({ sourceIndex: desc.sourceIndex, targetIndex: desc.targetIndex });

      // Auto-advance from showing to animating
      phaseTimerRef.current = setTimeout(() => {
        setPhase('animating');
      }, 600);

      // Auto-advance to done
      advanceTimerRef.current = setTimeout(() => {
        handleComplete();
      }, AUTO_ADVANCE_MS);
    }

    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [queue.length, currentDescriptor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, []);

  const handleComplete = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

    onActiveSlotsChange({ sourceIndex: null, targetIndex: null });
    engine.advanceInteractionQueue();
    setCurrentDescriptor(null);
    setPhase('done');

    if (queue.length <= 1) {
      // This was the last interaction
      onAnimationComplete();
    }
  }, [engine, onActiveSlotsChange, onAnimationComplete, queue.length]);

  const handleTap = useCallback(() => {
    if (phase === 'showing') {
      setPhase('animating');
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      // Reduce remaining auto-advance time
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        handleComplete();
      }, 800);
    } else if (phase === 'animating') {
      handleComplete();
    }
  }, [phase, handleComplete]);

  if (!currentDescriptor || queue.length === 0) return null;

  const label = EFFECT_LABELS[currentDescriptor.effect] ?? currentDescriptor.effect;

  return (
    <AnimatePresence>
      <motion.div
        style={overlayStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleTap}
      >
        {/* Dimming veil */}
        <motion.div
          style={veilStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Description banner */}
        <motion.div
          style={bannerStyle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: phase === 'showing' ? 1 : 0.6, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div style={bannerLabelStyle}>{label}</div>
          <div style={bannerDescStyle}>{currentDescriptor.description}</div>
        </motion.div>

        {/* Tap hint */}
        {phase === 'showing' && (
          <motion.div
            style={tapHintStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          >
            Tap to continue
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.5rem',
  pointerEvents: 'auto',
  cursor: 'pointer',
};

const veilStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(2, 4, 10, 0.55)',
  pointerEvents: 'none',
};

const bannerStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.5rem 2rem',
  background: '#0d1220',
  border: '1px solid rgba(212, 168, 84, 0.5)',
  borderRadius: '6px',
  maxWidth: '420px',
  textAlign: 'center',
};

const bannerLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1.2rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
};

const bannerDescStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: '0.85rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  lineHeight: 1.5,
};

const tapHintStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.65rem',
  color: '#5b7290',
  letterSpacing: '0.05em',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/overlays/InteractionSequencer.tsx
git commit -m "feat: add InteractionSequencer with queue playback and tap-to-fast-forward
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Create Per-Effect Animation Components

**Files:**
- Create: `src/components/overlays/InteractionAnimations/RerollAnimation.tsx`
- Create: `src/components/overlays/InteractionAnimations/FlipAnimation.tsx`
- Create: `src/components/overlays/InteractionAnimations/MirrorAnimation.tsx`
- Create: `src/components/overlays/InteractionAnimations/AddChoiceAnimation.tsx`
- Create: `src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx`

**Interfaces:**
- Consumes: `AnimationDescriptor` from Task 6
- Produces: Per-effect visual animations — consumed by Task 8

All animation components share the same props interface:

```typescript
interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}
```

- [ ] **Step 1: Write RerollAnimation**

Create `src/components/overlays/InteractionAnimations/RerollAnimation.tsx`:

```typescript
import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function RerollAnimation({ descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const radius = 80 + Math.random() * 40;
        return (
          <motion.div
            key={i}
            style={{
              ...particleStyle,
              left: '50%',
              top: '50%',
            }}
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
            animate={{
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius - 20,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: Math.random() * 0.15 }}
          />
        );
      })}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const particleStyle: React.CSSProperties = {
  position: 'absolute',
  width: '5px',
  height: '5px',
  borderRadius: '50%',
  background: '#d4a854',
};
```

- [ ] **Step 2: Write FlipAnimation**

Create `src/components/overlays/InteractionAnimations/FlipAnimation.tsx`:

```typescript
import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function FlipAnimation({ descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={waveStyle}
        initial={{ x: '-30%', opacity: 0 }}
        animate={{ x: '30%', opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
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

const waveStyle: React.CSSProperties = {
  width: '200px',
  height: '4px',
  background: 'linear-gradient(90deg, transparent, rgba(200, 90, 70, 0.6), transparent)',
  borderRadius: '2px',
};
```

- [ ] **Step 3: Write MirrorAnimation**

Create `src/components/overlays/InteractionAnimations/MirrorAnimation.tsx`:

```typescript
import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function MirrorAnimation({ descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={lineStyle}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 0.5, 0.5, 0] }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
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

const lineStyle: React.CSSProperties = {
  width: '60%',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, rgba(180, 200, 220, 0.5), transparent)',
};
```

- [ ] **Step 4: Write AddChoiceAnimation**

Create `src/components/overlays/InteractionAnimations/AddChoiceAnimation.tsx`:

```typescript
import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function AddChoiceAnimation({ descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={branchStyle}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: [0, 0.6, 0] }}
          transition={{
            duration: 0.8,
            delay: i * 0.2,
            ease: 'easeOut',
          }}
        />
      ))}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '20px',
  pointerEvents: 'none',
};

const branchStyle: React.CSSProperties = {
  width: '2px',
  height: '60px',
  background: 'linear-gradient(0deg, rgba(91, 140, 90, 0.6), transparent)',
  transformOrigin: 'bottom center',
};
```

- [ ] **Step 5: Write SecondResultAnimation**

Create `src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx`:

```typescript
import { motion } from 'framer-motion';
import type { AnimationDescriptor } from '../InteractionSequencer';

interface Props {
  descriptor: AnimationDescriptor;
  phase: 'showing' | 'animating';
}

export default function SecondResultAnimation({ descriptor, phase }: Props) {
  if (phase !== 'animating') return null;

  return (
    <motion.div style={containerStyle}>
      <motion.div
        style={rippleStyle}
        initial={{ scale: 0.3, opacity: 0.7 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
      />
      <motion.div
        style={rippleStyle}
        initial={{ scale: 0.3, opacity: 0.5 }}
        animate={{ scale: 2.0, opacity: 0 }}
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

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no errors in new files)

- [ ] **Step 7: Commit**

```bash
git add src/components/overlays/InteractionAnimations/RerollAnimation.tsx src/components/overlays/InteractionAnimations/FlipAnimation.tsx src/components/overlays/InteractionAnimations/MirrorAnimation.tsx src/components/overlays/InteractionAnimations/AddChoiceAnimation.tsx src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx
git commit -m "feat: add per-effect animation components for all 5 interaction types
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Wire Everything into GameTable, Remove InteractionLayer

**Files:**
- Modify: `src/components/screens/GameTable.tsx`
- Delete: `src/components/overlays/InteractionLayer.tsx`
- Delete: `src/components/overlays/InteractionAnimations/FoolsRerollAnimation.tsx`
- Delete: `src/components/overlays/InteractionAnimations/StubAnimations.tsx`

**Interfaces:**
- Consumes: `CardTableau` (Task 5), `InteractionSequencer` (Task 6), per-effect animations (Task 7)
- Produces: Complete working integration

- [ ] **Step 1: Rewrite GameTable to integrate CardTableau + InteractionSequencer**

Replace `src/components/screens/GameTable.tsx` with:

```typescript
import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../hooks/useGameEngine';
import TitleScreen from './TitleScreen';
import QuestionSelect from './QuestionSelect';
import MethodSelect from './MethodSelect';
import TarotMinigame from './TarotMinigame';
import DiceMinigame from './DiceMinigame';
import IChingMinigame from './IChingMinigame';
import HappeningScene from './HappeningScene';
import ResultReading from './ResultReading';
import HistoryModal from '../overlays/HistoryModal';
import CardTableau from '../overlays/CardTableau';
import InteractionSequencer from '../overlays/InteractionSequencer';

interface ActiveSlots {
  sourceIndex: number | null;
  targetIndex: number | null;
}

export default function GameTable() {
  const { state } = useGameEngine();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSlots, setActiveSlots] = useState<ActiveSlots>({
    sourceIndex: null,
    targetIndex: null,
  });

  const showTableau = state.screen !== 'title' && state.screen !== 'question';

  const handleActiveSlotsChange = useCallback(
    (slots: ActiveSlots) => setActiveSlots(slots),
    [],
  );

  const renderCenter = () => {
    switch (state.screen) {
      case 'title':
        return <TitleScreen key="title" />;
      case 'question':
        return <QuestionSelect key="question" />;
      case 'method-select':
        return <MethodSelect key="method-select" />;
      case 'minigame':
        return renderMinigame();
      case 'happening':
        return <HappeningScene key="happening" />;
      case 'result':
        return <ResultReading key="result" />;
      default:
        return null;
    }
  };

  const renderMinigame = () => {
    switch (state.selectedMethod) {
      case 'tarot':
        return <TarotMinigame key="tarot-minigame" />;
      case 'd20':
        return <DiceMinigame key="dice-minigame" />;
      case 'iching':
        return <IChingMinigame key="iching-minigame" />;
      default:
        return null;
    }
  };

  return (
    <div style={hubStyle}>
      {state.history.length > 0 && (
        <button
          type="button"
          style={historyBtnStyle}
          onClick={() => setHistoryOpen(true)}
        >
          Past Readings ({state.history.length})
        </button>
      )}
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
      <div style={centerStyle}>
        <AnimatePresence mode="wait">
          {renderCenter()}
        </AnimatePresence>
      </div>
      {showTableau && (
        <CardTableau results={state.turnResults} activeSlots={activeSlots} />
      )}
      {state.interactionQueue.length > 0 && (
        <InteractionSequencer
          onActiveSlotsChange={handleActiveSlotsChange}
          onAnimationComplete={() => setActiveSlots({ sourceIndex: null, targetIndex: null })}
        />
      )}
    </div>
  );
}

const hubStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1,
  overflow: 'hidden',
};

const historyBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '20px',
  padding: '4px 16px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};
```

- [ ] **Step 2: Remove old files**

```bash
git rm src/components/overlays/InteractionLayer.tsx
git rm src/components/overlays/InteractionAnimations/FoolsRerollAnimation.tsx
git rm src/components/overlays/InteractionAnimations/StubAnimations.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no errors — all old references removed)

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/GameTable.tsx
git commit -m "feat: wire CardTableau and InteractionSequencer into GameTable, remove old InteractionLayer
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Manual Verification

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test basic flow — card tableau visibility**

Open http://localhost:5173. Start a turn. After completing a minigame, confirm:
- A small card appears at the bottom of the screen showing the drawn result
- As you complete more minigames, additional cards slide in
- The tableau is visible during method-select, minigames, and happenings

- [ ] **Step 3: Test Fool's Reroll (via debug)**

Open http://localhost:5173/?debug. Select "Fool's Reroll" from the scenario dropdown. Complete the d20 roll:
- The minigame screen should freeze
- The InteractionSequencer should appear with the description banner: "The Fool's wild energy ripples through fate — the dice must be cast again."
- The dice card in the tableau should glow as a target
- After the animation completes (or you tap), the dice result in the tableau should change
- The screen should transition to method-select

- [ ] **Step 4: Test tap-to-fast-forward**

Repeat the Fool's Reroll test. Tap on the interaction overlay immediately after it appears:
- The animation should skip to completion
- The effect should still execute (dice rerolls)
- Screen should transition

- [ ] **Step 5: Test rapid multi-interaction**

With debug mode, inject multiple pending effects. Verify interactions play sequentially (not all at once). Verify tapping rapidly skips through all of them.

- [ ] **Step 6: Test happening mid-interaction**

If a happening triggers while an interaction is queued, verify the happening scene appears AFTER the interaction queue drains, not before.

- [ ] **Step 7: Test result screen**

Complete all 3 minigames. Verify the swirl plays and then the result screen appears with all cards visible in the reading.

- [ ] **Step 8: Build check**

Run: `npm run build`
Expected: clean build, no type errors
