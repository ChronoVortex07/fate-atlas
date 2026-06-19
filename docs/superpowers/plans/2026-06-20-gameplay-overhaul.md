# Gameplay Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the gameplay loop from a 3-card spread into a single-method selection to minigame to merged result flow, with a pending-effects interaction system, SVG starfield with constellations, and interaction visual animations.

**Architecture:** Hub-and-spoke with `GameTable` as the persistent parent hosting always-visible `HistoryTiles` and `InteractionLayer`. Center content transitions between `MethodSelect`, 3 minigames, `HappeningScene`, and `ResultReading`. Engine shifts from multi-slot to single-result-per-turn with prospective `PendingEffect` matching.

**Tech Stack:** React 18, TypeScript, Framer Motion, Vitest, html2canvas, Vite

## Global Constraints

- All game logic stays in `src/engine/` — zero React/DOM imports
- React only renders state and forwards user actions
- Every engine mutator must call `notify()` to push snapshots
- `tsc` strict mode, `noUnusedLocals`, `noUnusedParameters` all on
- Tests run with Vitest in Node environment, globals enabled
- Tests cover engine and data layer only — no component tests
- localStorage key `fate-atlas-save` for carryover persistence
- Base URL `/fate-atlas/` in Vite config
- Tag-based interactions, never ID-based

---

### Task 1: Update Engine Types

**Files:**
- Modify: `src/engine/types.ts`

**Interfaces:**
- Produces: `Screen`, `PendingEffect`, `InteractionEvent`, `GameState`, `DivinationType`, `MinigameState`

- [ ] **Step 1: Update the Screen type**

Replace lines 143-150 in `src/engine/types.ts`:

```ts
export type Screen =
  | 'title'
  | 'question'
  | 'method-select'
  | 'minigame'
  | 'happening'
  | 'result';
```

- [ ] **Step 2: Add PendingEffect interface**

After the `InteractionEvent` interface (line 140), add:

```ts
export interface PendingEffect {
  id: string;
  sourceRunId: string;
  sourceCard: string;
  sourceSlotIndex: number;
  triggerTags: string[];
  action: 'reroll' | 'flip' | 'add-choice' | 'mirror' | 'second-result';
  description: string;
  expiresAfter: number;
  turnsRemaining: number;
}
```

- [ ] **Step 3: Add MinigameState type**

After PendingEffect:

```ts
export interface TarotMinigameState {
  method: 'tarot';
  faceDownCards: TarotResult[];
  chosenIndex: number | null;
  reversed: boolean;
  revealed: boolean;
}

export interface DiceMinigameState {
  method: 'd20';
  result: DiceResult;
  thrown: boolean;
}

export interface IChingMinigameState {
  method: 'iching';
  lines: number[]; // 6 lines built up during casting
  castCount: number;
  result: IChingResult | null;
}

export type MinigameState =
  | TarotMinigameState
  | DiceMinigameState
  | IChingMinigameState;
```

- [ ] **Step 4: Update GameState interface**

Replace the GameState interface (lines 152-167) with:

```ts
export interface GameState {
  screen: Screen;
  affinities: Record<AffinityId, number>;
  questionType: QuestionType | null;
  availableMethods: DivinationType[];
  selectedMethod: DivinationType | null;
  turnResult: SlotResult | null;
  minigameState: MinigameState | null;
  pendingEffects: PendingEffect[];
  activeInteraction: InteractionEvent | null;
  interactions: InteractionEvent[];
  synthesis: SynthesisResult | null;
  happening: HappeningResult | null;
  selectedHappeningChoice: number | null;
  history: RunRecord[];
  eventLog: GameEvent[];
  chainDepth: number;
  debug: boolean;
}
```

- [ ] **Step 5: Update RunRecord to use turnResult**

Change `slots: SlotResult[]` to `turnResult: SlotResult | null` in `RunRecord` (line 128):

```ts
export interface RunRecord {
  id: string;
  timestamp: number;
  question: QuestionType;
  turnResult: SlotResult | null;
  interactions: InteractionEvent[];
  synthesis: SynthesisResult;
  happening?: HappeningResult;
  happeningChoice?: number;
}
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc -b --noEmit`
Expected: Many errors (downstream consumers not yet updated — that comes in later tasks)

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: update engine types for single-result gameplay overhaul

Add PendingEffect, MinigameState. Update Screen enum, GameState,
RunRecord for new turn lifecycle.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Update Interaction Resolver

**Files:**
- Modify: `src/engine/InteractionResolver.ts`
- Test: `src/engine/__tests__/InteractionResolver.test.ts` (NEW)

**Interfaces:**
- Consumes: `PendingEffect`, `SlotResult`, `InteractionRule`, `InteractionEvent` from types.ts
- Produces: `checkPendingEffects()`, `createPendingEffects()`

- [ ] **Step 1: Write failing tests for pending effect methods**

Create `src/engine/__tests__/InteractionResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { InteractionResolver } from '../InteractionResolver';
import { TagSystem } from '../TagSystem';
import { EventBus } from '../EventBus';
import type { PendingEffect, SlotResult, InteractionRule } from '../types';

function makeResolver() {
  return new InteractionResolver(new TagSystem(), new EventBus());
}

describe('InteractionResolver — pending effects', () => {
  const tarotResult: SlotResult = {
    type: 'tarot',
    id: 'the-fool',
    name: 'The Fool',
    number: 0,
    orientation: 'upright',
    symbol: 'X',
    meaningUpright: 'New beginnings',
    meaningReversed: 'Recklessness',
    tags: ['major-arcana', 'fool-archetype', 'reversible'],
  };

  const diceResult: SlotResult = {
    type: 'd20',
    result: 3,
    threshold: 'critical-low',
    interpretation: 'Dire outcome',
    tags: ['roll', 'numeric', 'threshold', 'critical-low'],
  };

  it('checkPendingEffects: matches tags and returns matched + remaining', () => {
    const resolver = makeResolver();
    const pending: PendingEffect[] = [
      {
        id: 'eff-1',
        sourceRunId: 'run-1',
        sourceCard: 'The Fool',
        sourceSlotIndex: 0,
        triggerTags: ['roll', 'numeric'],
        action: 'reroll',
        description: "The Fool's Reroll",
        expiresAfter: 3,
        turnsRemaining: 2,
      },
      {
        id: 'eff-2',
        sourceRunId: 'run-1',
        sourceCard: 'The Hermit',
        sourceSlotIndex: 0,
        triggerTags: ['iching', 'changing-lines'],
        action: 'add-choice',
        description: 'I Ching boost',
        expiresAfter: 3,
        turnsRemaining: 2,
      },
    ];

    const { matched, remaining } = resolver.checkPendingEffects(pending, diceResult);

    expect(matched).toHaveLength(1);
    expect(matched[0].id).toBe('eff-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('eff-2');
  });

  it('checkPendingEffects: no match returns empty matched, all remaining', () => {
    const resolver = makeResolver();
    const pending: PendingEffect[] = [
      {
        id: 'eff-1',
        sourceRunId: 'run-1',
        sourceCard: 'The Fool',
        sourceSlotIndex: 0,
        triggerTags: ['iching'],
        action: 'reroll',
        description: 'Test',
        expiresAfter: 3,
        turnsRemaining: 2,
      },
    ];

    const { matched, remaining } = resolver.checkPendingEffects(pending, diceResult);

    expect(matched).toHaveLength(0);
    expect(remaining).toHaveLength(1);
  });

  it('createPendingEffects: creates effects from interaction-eligible result', () => {
    const resolver = makeResolver();
    const rules: InteractionRule[] = [
      {
        id: 'fool-reroll',
        trigger: { on: 'slot-revealed', sourceTags: ['major-arcana', 'fool-archetype'] },
        target: { tags: ['roll', 'pending'], action: 'reroll' },
        display: { flashSource: true, flashTarget: true, description: 'Test reroll' },
      },
    ];

    const effects = resolver.createPendingEffects(tarotResult, 'run-1', rules);

    expect(effects).toHaveLength(1);
    expect(effects[0].action).toBe('reroll');
    expect(effects[0].sourceCard).toBe('The Fool');
    expect(effects[0].triggerTags).toEqual(['roll', 'pending']);
    expect(effects[0].turnsRemaining).toBe(3);
  });

  it('createPendingEffects: result with no matching rules returns empty', () => {
    const resolver = makeResolver();
    const nonTriggering: SlotResult = {
      ...tarotResult,
      tags: ['nothing-relevant'],
    };

    const rules: InteractionRule[] = [
      {
        id: 'fool-reroll',
        trigger: { on: 'slot-revealed', sourceTags: ['major-arcana', 'fool-archetype'] },
        target: { tags: ['roll', 'pending'], action: 'reroll' },
        display: { flashSource: true, flashTarget: true, description: 'Test' },
      },
    ];

    const effects = resolver.createPendingEffects(nonTriggering, 'run-1', rules);
    expect(effects).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/InteractionResolver.test.ts`
Expected: FAIL — `checkPendingEffects` and `createPendingEffects` not defined

- [ ] **Step 3: Implement checkPendingEffects and createPendingEffects**

In `src/engine/InteractionResolver.ts`, add these methods after `describeEffect` (after line 124):

```ts
  checkPendingEffects(
    pendingEffects: PendingEffect[],
    currentResult: SlotResult,
  ): { matched: PendingEffect[]; remaining: PendingEffect[] } {
    const matched: PendingEffect[] = [];
    const remaining: PendingEffect[] = [];

    for (const effect of pendingEffects) {
      if (this.tagSystem.hasAllTags(currentResult, effect.triggerTags)) {
        matched.push(effect);
      } else {
        remaining.push(effect);
      }
    }

    return { matched, remaining };
  }

  createPendingEffects(
    result: SlotResult,
    runId: string,
    rules: InteractionRule[],
  ): PendingEffect[] {
    const effects: PendingEffect[] = [];

    for (const rule of rules) {
      if (this.tagSystem.hasAllTags(result, rule.trigger.sourceTags)) {
        effects.push({
          id: `${rule.id}-${runId}-${Date.now()}`,
          sourceRunId: runId,
          sourceCard: 'name' in result ? (result as { name: string }).name : result.type,
          sourceSlotIndex: 0,
          triggerTags: [...rule.target.tags],
          action: rule.target.action,
          description: rule.display.description,
          expiresAfter: 3,
          turnsRemaining: 3,
        });
      }
    }

    return effects;
  }
```

Add imports at the top of InteractionResolver.ts:
```ts
import type { PendingEffect, InteractionRule } from './types';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/InteractionResolver.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/InteractionResolver.ts src/engine/__tests__/InteractionResolver.test.ts
git commit -m "feat: add pending effect checking and creation to InteractionResolver

checkPendingEffects matches current result tags against pending effects.
createPendingEffects generates PendingEffect from interaction-eligible results.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create Scenario Presets

**Files:**
- Create: `src/engine/scenarios.ts`

**Interfaces:**
- Produces: `SCENARIO_PRESETS`, `ScenarioPreset`, `loadScenario()`

- [ ] **Step 1: Write the scenarios module**

Create `src/engine/scenarios.ts`:

```ts
import type { GameState, PendingEffect } from './types';

export interface ScenarioPreset {
  id: string;
  label: string;
  apply: (state: GameState) => void;
}

const foolsRerollEffect: PendingEffect = {
  id: 'debug-fools-reroll',
  sourceRunId: 'debug-run',
  sourceCard: 'The Fool',
  sourceSlotIndex: 0,
  triggerTags: ['roll', 'numeric'],
  action: 'reroll',
  description: "The Fool's wild energy ripples through fate — the dice must be cast again.",
  expiresAfter: 3,
  turnsRemaining: 3,
};

const criticalFlipEffect: PendingEffect = {
  id: 'debug-critical-flip',
  sourceRunId: 'debug-run',
  sourceCard: 'Critical Roll',
  sourceSlotIndex: 0,
  triggerTags: ['major-arcana', 'reversible'],
  action: 'flip',
  description: 'A dire omen from the dice — the cards tremble and turn.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

const ichingBoostEffect: PendingEffect = {
  id: 'debug-iching-boost',
  sourceRunId: 'debug-run',
  sourceCard: 'Hexagram',
  sourceSlotIndex: 0,
  triggerTags: ['event', 'happening'],
  action: 'add-choice',
  description: 'The changing lines reveal hidden branches — more choices emerge.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

const mirrorEffect: PendingEffect = {
  id: 'debug-mirror',
  sourceRunId: 'debug-run',
  sourceCard: 'Mirrored Card',
  sourceSlotIndex: 0,
  triggerTags: ['reversible'],
  action: 'mirror',
  description: 'Two forces reflect each other across the weave — both turn.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

const chaosSurgeEffect: PendingEffect = {
  id: 'debug-chaos-surge',
  sourceRunId: 'debug-run',
  sourceCard: 'Chaos',
  sourceSlotIndex: 0,
  triggerTags: [], // always triggers on any result
  action: 'second-result',
  description: 'Chaos surges — a second possibility emerges from the void.',
  expiresAfter: 3,
  turnsRemaining: 3,
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'fools-reroll',
    label: "Fool's Reroll",
    apply: (state) => {
      state.pendingEffects = [foolsRerollEffect];
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
    },
  },
  {
    id: 'critical-low-flip',
    label: 'Critical Flip',
    apply: (state) => {
      state.pendingEffects = [criticalFlipEffect];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'iching-boost',
    label: 'I Ching Boost',
    apply: (state) => {
      state.pendingEffects = [ichingBoostEffect];
      state.selectedMethod = 'iching';
      state.screen = 'minigame';
    },
  },
  {
    id: 'mirror-event',
    label: 'Mirror Event',
    apply: (state) => {
      state.pendingEffects = [mirrorEffect];
      state.selectedMethod = 'tarot';
      state.screen = 'minigame';
    },
  },
  {
    id: 'chaos-surge',
    label: 'Chaos Surge',
    apply: (state) => {
      state.pendingEffects = [chaosSurgeEffect];
      state.affinities.chaos = 0.8;
      state.selectedMethod = 'd20';
      state.screen = 'minigame';
    },
  },
];

export function loadScenario(presetId: string, state: GameState): boolean {
  const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  preset.apply(state);
  return true;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc -b --noEmit src/engine/scenarios.ts`
Expected: Compiles clean (may show errors from unrelated files still needing updates)

- [ ] **Step 3: Commit**

```bash
git add src/engine/scenarios.ts
git commit -m "feat: add debug scenario presets for interaction testing

Five presets: Fools Reroll, Critical Flip, I Ching Boost, Mirror Event,
Chaos Surge. Each pre-configures state to trigger a specific interaction.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update TurnOrchestrator

**Files:**
- Modify: `src/engine/TurnOrchestrator.ts`

**Interfaces:**
- Consumes: `DivinationType`, `QuestionType`, `SlotResult` from types.ts
- Produces: `generatePool()` (renamed `availableMethods`), `drawSingleResult()`, `getAvailableMethods()`

- [ ] **Step 1: Rewrite TurnOrchestrator for single-result model**

Replace the entire content of `src/engine/TurnOrchestrator.ts`:

```ts
import type { DivinationType, QuestionType, SlotResult } from './types';
import type { EventBus } from './EventBus';
import { drawTarotCard } from '../data/tarot';
import { rollD20 } from '../data/dice';
import { castHexagram } from '../data/iching';

const POOL_SIZE = 3;

const QUESTION_WEIGHTS: Record<QuestionType, Partial<Record<DivinationType, number>>> = {
  decision: { d20: 3, tarot: 1, iching: 1, happening: 1 },
  relationship: { tarot: 3, d20: 1, iching: 1, happening: 1 },
  future: { iching: 3, tarot: 1, d20: 1, happening: 1 },
  self: { tarot: 2, iching: 2, d20: 1, happening: 1 },
};

export class TurnOrchestrator {
  private availableMethods: DivinationType[] = [];

  constructor(
    private bus: EventBus,
  ) {}

  generatePool(
    question: QuestionType,
    affinities: Record<string, number>,
  ): DivinationType[] {
    this.availableMethods = [];
    const weights = QUESTION_WEIGHTS[question];

    const entries: { type: DivinationType; weight: number }[] = [
      { type: 'tarot', weight: weights.tarot ?? 1 },
      { type: 'd20', weight: weights.d20 ?? 1 },
      { type: 'iching', weight: weights.iching ?? 1 },
      { type: 'happening', weight: weights.happening ?? 1 },
    ];

    // High chaos can add extra happening to pool
    if ((affinities.chaos ?? 0) >= 0.5 && Math.random() < 0.3) {
      entries.find((e) => e.type === 'happening')!.weight += 2;
    }

    while (this.availableMethods.length < POOL_SIZE) {
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          this.availableMethods.push(entry.type);
          break;
        }
      }
    }

    this.bus.emit('pool-generated', {
      question,
      pool: [...this.availableMethods],
    });

    return [...this.availableMethods];
  }

  drawSingleResult(
    method: DivinationType,
    affinities: Record<string, number>,
  ): SlotResult {
    let result: SlotResult;

    switch (method) {
      case 'tarot':
        result = drawTarotCard(affinities);
        break;
      case 'd20':
        result = rollD20(affinities);
        break;
      case 'iching':
        result = castHexagram(affinities);
        break;
      case 'happening':
        // Happenings are resolved separately — this should not be called for happening
        throw new Error('Happening has no drawSingleResult — use triggerHappening instead');
      default:
        throw new Error(`Unknown divination type: ${method}`);
    }

    this.bus.emit('slot-drawn', { type: method, result });
    return result;
  }

  getAvailableMethods(): DivinationType[] {
    return [...this.availableMethods];
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc -b --noEmit`
Expected: Errors reduced to GameEngine and component files only

- [ ] **Step 3: Commit**

```bash
git add src/engine/TurnOrchestrator.ts
git commit -m "refactor: TurnOrchestrator for single-result model

Replaces drawSlot/revealSlot with drawSingleResult per method type.
generatePool renamed to availableMethods. Removes happening placeholder
logic — happenings now resolved via selectMethod gate.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 5: Rewrite GameEngine

**Files:**
- Modify: `src/engine/GameEngine.ts`

**Interfaces:**
- Consumes: All types from types.ts, TurnOrchestrator, InteractionResolver, AffinityEngine, SynthesisEngine, scenarios.ts, interactions.ts, happenings.ts
- Produces: `startTurn()`, `selectMethod()`, `completeMinigame()`, `clearActiveInteraction()`, `injectPendingEffect()`, `loadScenario()`, `getState()`, `subscribe()`, plus all existing navigation/persistence methods

- [ ] **Step 1: Rewrite GameEngine.ts**

Replace the entire content of `src/engine/GameEngine.ts`:

```ts
import type { GameState, QuestionType, AffinityId, SlotResult, RunRecord, DivinationType, PendingEffect, InteractionEvent } from './types';
import { EventBus } from './EventBus';
import { TagSystem } from './TagSystem';
import { AffinityEngine } from './AffinityEngine';
import { TurnOrchestrator } from './TurnOrchestrator';
import { InteractionResolver } from './InteractionResolver';
import { SynthesisEngine } from './SynthesisEngine';
import { CHAOS_AFFINITY, ORDER_AFFINITY } from '../data/affinities';
import { INTERACTION_RULES } from '../data/interactions';
import { selectHappening } from '../data/happenings';
import { loadScenario, SCENARIO_PRESETS } from './scenarios';

const STORAGE_KEY = 'fate-atlas-save';

export class GameEngine {
  private bus: EventBus;
  private tagSystem: TagSystem;
  private affinityEngine: AffinityEngine;
  private orchestrator: TurnOrchestrator;
  private interactionResolver: InteractionResolver;
  private synthesisEngine: SynthesisEngine;

  private state: GameState;
  private cachedSnapshot: GameState;
  private listeners = new Set<(state: GameState) => void>();
  private usedHappeningIds = new Set<string>();
  private turnFiredPairs = new Set<string>();

  constructor() {
    this.bus = new EventBus();
    this.tagSystem = new TagSystem();
    this.affinityEngine = new AffinityEngine([CHAOS_AFFINITY, ORDER_AFFINITY]);
    this.orchestrator = new TurnOrchestrator(this.bus);
    this.interactionResolver = new InteractionResolver(this.tagSystem, this.bus);
    this.synthesisEngine = new SynthesisEngine();
    this.state = this.defaultState();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  // ---------- Private helpers ----------

  private defaultState(): GameState {
    return {
      screen: 'title',
      affinities: { chaos: 0.5, order: 0.5 },
      questionType: null,
      availableMethods: [],
      selectedMethod: null,
      turnResult: null,
      minigameState: null,
      pendingEffects: [],
      activeInteraction: null,
      interactions: [],
      synthesis: null,
      happening: null,
      selectedHappeningChoice: null,
      history: [],
      eventLog: [],
      chainDepth: 0,
      debug: false,
    };
  }

  private notify(): void {
    this.state.affinities = this.affinityEngine.getState();
    this.state.eventLog = this.bus.getHistory();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    this.listeners.forEach((fn) => fn(this.cachedSnapshot));
  }

  // ---------- Turn lifecycle ----------

  startTurn(question: QuestionType): void {
    const affinities = this.affinityEngine.getState();
    const availableMethods = this.orchestrator.generatePool(question, affinities);

    // Decrement turnsRemaining on all pending effects; remove expired
    this.state.pendingEffects = this.state.pendingEffects
      .map((e) => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
      .filter((e) => e.turnsRemaining > 0);

    this.state.screen = 'method-select';
    this.state.questionType = question;
    this.state.availableMethods = availableMethods;
    this.state.selectedMethod = null;
    this.state.turnResult = null;
    this.state.minigameState = null;
    this.state.activeInteraction = null;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.chainDepth = 0;
    this.turnFiredPairs = new Set<string>();

    this.bus.emit('turn-started', { question, availableMethods });
    this.notify();
  }

  selectMethod(index: number): void {
    const methodType = this.state.availableMethods[index];
    if (!methodType) {
      throw new Error(`Method index ${index} out of bounds`);
    }

    this.state.selectedMethod = methodType;

    // Happening gate check
    const chaos = this.affinityEngine.getState().chaos;
    if (methodType === 'happening') {
      // Always trigger happening if happening was drawn and selected
      this.triggerHappening();
      return;
    }

    if (chaos >= 0.7 && Math.random() < 0.3) {
      // Chaos override — replace with happening
      this.triggerHappening();
      return;
    }

    this.state.screen = 'minigame';
    this.notify();
  }

  completeMinigame(result: SlotResult): void {
    this.state.turnResult = result;

    // Apply affinities from result
    if (result.type !== 'happening') {
      this.affinityEngine.apply([result]);
    }

    // Check pending effects against this result
    const { matched, remaining } = this.interactionResolver.checkPendingEffects(
      this.state.pendingEffects,
      result,
    );
    this.state.pendingEffects = remaining;

    // Build interaction events from matched pending effects
    const interactionEvents: InteractionEvent[] = matched.map((effect, i) => ({
      ruleId: effect.id,
      sourceSlotIndex: effect.sourceSlotIndex,
      targetSlotIndex: 0,
      effect: effect.action,
      description: effect.description,
    }));
    this.state.interactions = [...this.state.interactions, ...interactionEvents];

    // Create new pending effects from this result's tags
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newEffects = this.interactionResolver.createPendingEffects(
      result,
      runId,
      INTERACTION_RULES,
    );
    this.state.pendingEffects = [...this.state.pendingEffects, ...newEffects];

    // If any matched effects, set activeInteraction for the InteractionLayer
    if (interactionEvents.length > 0) {
      this.state.activeInteraction = interactionEvents[0];
    }

    // Synthesize
    this.synthesize();

    this.bus.emit('minigame-complete', { result, interactions: interactionEvents });
    this.notify();
  }

  clearActiveInteraction(): void {
    this.state.activeInteraction = null;
    this.state.screen = 'result';
    this.notify();
  }

  private synthesize(): void {
    const result = this.state.turnResult;
    if (!result || result.type === 'happening') return;

    const affinities = this.affinityEngine.getState();
    const synthesisResult = this.synthesisEngine.synthesize(
      [result],
      this.state.questionType!,
      this.state.interactions,
      affinities,
    );

    this.state.synthesis = synthesisResult;

    this.bus.emit('synthesis-complete', { result: synthesisResult });
  }

  triggerHappening(): void {
    const affinities = this.affinityEngine.getState();
    const data = selectHappening(Array.from(this.usedHappeningIds), affinities.chaos);
    this.usedHappeningIds.add(data.id);

    this.state.happening = {
      type: 'happening',
      id: data.id,
      scene: data.scene,
      choices: data.choices.map((c) => ({
        text: c.text,
        affinityChanges: c.affinityChanges as Partial<Record<AffinityId, number>>,
      })),
      tags: data.tags,
    };
    this.state.screen = 'happening';

    this.bus.emit('happening-triggered', { happening: this.state.happening });
    this.notify();
  }

  resolveHappening(choiceIndex: number): void {
    if (!this.state.happening) {
      throw new Error('No happening active');
    }
    const choice = this.state.happening.choices[choiceIndex];
    if (!choice) {
      throw new Error(`Choice ${choiceIndex} not found in happening`);
    }

    // Apply affinity changes from chosen option
    const current = this.affinityEngine.getState();
    for (const [id, delta] of Object.entries(choice.affinityChanges)) {
      const key = id as AffinityId;
      current[key] = Math.max(0, Math.min(1,
        Math.round((current[key] + (delta as number)) * 100) / 100,
      ));
    }
    this.affinityEngine.setState(current);

    this.state.selectedHappeningChoice = choiceIndex;

    // If we came from selectMethod gate, we still need to synthesize
    // Use the happening itself as the "result" for the reading
    if (!this.state.synthesis) {
      this.synthesize();
    }

    this.state.screen = 'result';
    this.state.affinities = this.affinityEngine.getState();

    // Build run record
    const run: RunRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      question: this.state.questionType!,
      turnResult: this.state.turnResult ?? this.state.happening,
      interactions: this.state.interactions,
      synthesis: this.state.synthesis!,
      happening: this.state.happening,
      happeningChoice: choiceIndex,
    };
    this.state.history = [...this.state.history, run].slice(-10);

    this.bus.emit('happening-resolved', { choiceIndex });

    this.saveToStorage();
    this.notify();
  }

  // ---------- State access ----------

  getState(): GameState {
    return this.cachedSnapshot;
  }

  loadState(json: Partial<GameState>): void {
    Object.assign(this.state, json);
    if (json.affinities) {
      this.affinityEngine.setState(json.affinities);
    }
    this.bus.emit('state-loaded', json);
    this.notify();
  }

  // ---------- Debug ----------

  injectPendingEffect(effect: PendingEffect): void {
    this.state.pendingEffects = [...this.state.pendingEffects, effect];
    this.notify();
  }

  loadScenarioById(presetId: string): boolean {
    const success = loadScenario(presetId, this.state);
    if (success) {
      this.notify();
    }
    return success;
  }

  getScenarioPresets() {
    return SCENARIO_PRESETS.map((p) => ({ id: p.id, label: p.label }));
  }

  // ---------- Persistence ----------

  saveToStorage(): void {
    try {
      const data = {
        affinities: this.affinityEngine.serialize(),
        history: this.state.history,
        usedHappeningIds: Array.from(this.usedHappeningIds),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable or full — silently ignore
    }
  }

  loadFromStorage(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.affinities) this.affinityEngine.loadFrom(data.affinities);
      if (data.history) this.state.history = data.history;
      if (data.usedHappeningIds) this.usedHappeningIds = new Set(data.usedHappeningIds);
      this.state.affinities = this.affinityEngine.getState();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  // ---------- LLM Prompt ----------

  generateLLMPrompt(): string {
    const result = this.state.turnResult;
    if (!result || result.type === 'happening') return '';
    return this.synthesisEngine.generateLLMPrompt({
      question: this.state.questionType!,
      slots: [result],
      interactions: this.state.interactions,
      affinities: this.affinityEngine.getState(),
    });
  }

  // ---------- Subscription ----------

  subscribe(fn: (state: GameState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  // ---------- Navigation helpers ----------

  returnToQuestionSelect(): void {
    this.state.screen = 'question';
    this.state.questionType = null;
    this.state.availableMethods = [];
    this.state.selectedMethod = null;
    this.state.turnResult = null;
    this.state.minigameState = null;
    this.state.activeInteraction = null;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.chainDepth = 0;
    this.turnFiredPairs = new Set<string>();
    this.notify();
  }

  returnToTitle(): void {
    const saved = {
      affinities: this.affinityEngine.getState(),
      history: this.state.history,
      usedHappeningIds: Array.from(this.usedHappeningIds),
    };
    this.state = this.defaultState();
    this.affinityEngine.setState(saved.affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.history = saved.history;
    this.usedHappeningIds = new Set(saved.usedHappeningIds);
    this.turnFiredPairs = new Set<string>();
    this.bus.clear();
    this.notify();
  }

  reset(): void {
    const affinities = this.affinityEngine.getState();
    const history = this.state.history;
    const usedIds = Array.from(this.usedHappeningIds);
    this.state = this.defaultState();
    this.affinityEngine.setState(affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.history = history;
    this.usedHappeningIds = new Set(usedIds);
    this.turnFiredPairs = new Set<string>();
    this.bus.clear();
    this.notify();
  }

  clearHistory(): void {
    const defaultAffinities = { chaos: 0.5, order: 0.5 };
    this.affinityEngine.setState(defaultAffinities);
    this.state = this.defaultState();
    this.state.affinities = this.affinityEngine.getState();
    this.usedHappeningIds = new Set();
    this.turnFiredPairs = new Set<string>();
    this.bus.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore
    }
    this.notify();
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc -b --noEmit`
Expected: Errors only in component files (App.tsx, screen components, DebugPanel)

- [ ] **Step 3: Commit**

```bash
git add src/engine/GameEngine.ts
git commit -m "refactor: GameEngine for single-result turn lifecycle

New flow: startTurn → selectMethod → completeMinigame →
clearActiveInteraction → result. Pending effects are checked on
minigame completion, new effects created from interaction tags.
Happening gate in selectMethod, scenario loading for debug.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 6: Update Engine Tests

**Files:**
- Modify: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: `GameEngine` from GameEngine.ts

- [ ] **Step 1: Rewrite GameEngine tests for new lifecycle**

Replace the entire content of `src/engine/__tests__/GameEngine.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('GameEngine — new lifecycle', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('starts in title screen', () => {
    expect(engine.getState().screen).toBe('title');
  });

  it('startTurn generates availableMethods and goes to method-select', () => {
    engine.startTurn('self');
    const state = engine.getState();
    expect(state.screen).toBe('method-select');
    expect(state.availableMethods).toHaveLength(3);
    expect(state.questionType).toBe('self');
  });

  it('selectMethod with valid index goes to minigame screen', () => {
    engine.startTurn('self');
    engine.selectMethod(0);
    const state = engine.getState();
    // If happening was selected, may go to happening instead
    expect(['minigame', 'happening']).toContain(state.screen);
  });

  it('selectMethod with out-of-bounds index throws', () => {
    engine.startTurn('self');
    expect(() => engine.selectMethod(99)).toThrow('out of bounds');
  });

  it('selectMethod with happening type always triggers happening', () => {
    engine.startTurn('self');
    // Find happening index if any
    const methods = engine.getState().availableMethods;
    const happeningIdx = methods.indexOf('happening');
    if (happeningIdx !== -1) {
      engine.selectMethod(happeningIdx);
      expect(engine.getState().screen).toBe('happening');
    }
  });

  it('completeMinigame sets turnResult, checks pending effects, synthesizes', () => {
    engine.startTurn('self');
    // Find a non-happening method
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return; // all happenings, skip

    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return; // happening override

    const tarotResult = {
      type: 'tarot' as const,
      id: 'the-star',
      name: 'The Star',
      number: 17,
      orientation: 'upright' as const,
      symbol: '*',
      meaningUpright: 'Hope',
      meaningReversed: 'Despair',
      tags: ['major-arcana', 'reversible', 'star-archetype'],
    };

    engine.completeMinigame(tarotResult);
    const state = engine.getState();
    expect(state.turnResult).toBeTruthy();
    expect(state.synthesis).toBeTruthy();
    // activeInteraction may be null if no pending effects matched
  });

  it('clearActiveInteraction clears interaction and goes to result', () => {
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

    engine.clearActiveInteraction();
    expect(engine.getState().screen).toBe('result');
  });

  it('returnToQuestionSelect resets turn state, preserves history and affinities', () => {
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
    engine.clearActiveInteraction();

    const beforeAffinities = { ...engine.getState().affinities };
    const beforeHistory = [...engine.getState().history];

    engine.returnToQuestionSelect();
    const state = engine.getState();
    expect(state.screen).toBe('question');
    expect(state.turnResult).toBeNull();
    expect(state.synthesis).toBeNull();
    expect(state.affinities).toEqual(beforeAffinities);
    expect(state.history).toEqual(beforeHistory);
  });

  it('resolveHappening fails with invalid index', () => {
    engine.startTurn('self');
    const methods = engine.getState().availableMethods;
    const happeningIdx = methods.indexOf('happening');
    if (happeningIdx === -1) return;

    engine.selectMethod(happeningIdx);
    if (engine.getState().screen !== 'happening') return;

    expect(() => engine.resolveHappening(99)).toThrow('Choice 99 not found');
    expect(engine.getState().screen).toBe('happening');
  });

  it('resolveHappening throws when no happening active', () => {
    expect(() => engine.resolveHappening(0)).toThrow('No happening active');
  });

  it('pending effects are checked on completeMinigame', () => {
    engine.startTurn('self');

    // Inject a pending effect that matches d20
    engine.injectPendingEffect({
      id: 'test-effect',
      sourceRunId: 'test-run',
      sourceCard: 'Test Card',
      sourceSlotIndex: 0,
      triggerTags: ['roll'],
      action: 'reroll',
      description: 'Test reroll',
      expiresAfter: 3,
      turnsRemaining: 3,
    });

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
      tags: ['roll', 'numeric', 'low'],
    });

    const state = engine.getState();
    // The pending effect should have matched
    expect(state.activeInteraction).toBeTruthy();
    // Pending effects list should be empty (the injected one was consumed)
    expect(state.pendingEffects).toHaveLength(0);
  });

  it('pending effects expire after turnsRemaining reaches zero', () => {
    engine.startTurn('self');

    engine.injectPendingEffect({
      id: 'expiring-effect',
      sourceRunId: 'test-run',
      sourceCard: 'Test',
      sourceSlotIndex: 0,
      triggerTags: ['roll'],
      action: 'reroll',
      description: 'Should expire',
      expiresAfter: 1,
      turnsRemaining: 1,
    });

    // Start another turn — effect should decrement and expire
    engine.returnToQuestionSelect();
    engine.startTurn('self');

    expect(engine.getState().pendingEffects).toHaveLength(0);
  });

  it('loadScenario loads a preset into state', () => {
    engine.startTurn('self');
    const ok = engine.loadScenarioById('fools-reroll');
    expect(ok).toBe(true);
    const state = engine.getState();
    expect(state.pendingEffects.length).toBeGreaterThan(0);
    expect(state.screen).toBe('minigame');
  });

  it('loadScenario returns false for unknown preset', () => {
    const ok = engine.loadScenarioById('nonexistent');
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run engine tests**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts`
Expected: Tests pass (some may skip if random method selection gives all happenings — that's OK)

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: Engine tests pass. InteractionResolver tests pass. Old tests that reference removed methods will fail — we'll fix those next.

- [ ] **Step 4: Commit**

```bash
git add src/engine/__tests__/GameEngine.test.ts
git commit -m "test: rewrite GameEngine tests for new single-result lifecycle

Tests cover startTurn, selectMethod, completeMinigame, pending effects,
happening gate, scenario loading, and navigation.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Remove Old Engine Test References

**Files:**
- Modify: `src/engine/__tests__/GameEngine.test.ts`
- Modify: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Consumes: Updated GameEngine API

- [ ] **Step 1: Fix IChing test if it references old state shape**

Run: `npx vitest run`
Check for failing tests. If IChing.test.ts references `state.slots` or `state.pool`, update:

```ts
// Replace state.pool references with state.availableMethods
// Replace state.slots references with state.turnResult
```

Run: `npx vitest run`
Expected: All engine tests pass

- [ ] **Step 2: Commit**

```bash
git add src/engine/__tests__/
git commit -m "test: update remaining engine tests for new API surface

Replace pool/slots references with availableMethods/turnResult.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Create Constellation Data

**Files:**
- Create: `src/data/constellations.ts`

**Interfaces:**
- Produces: `Constellation`, `CONSTELLATIONS`

- [ ] **Step 1: Write constellation data**

Create `src/data/constellations.ts`:

```ts
export interface ConstellationStar {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  brightness: number; // 0-1
}

export interface ConstellationLine {
  from: number; // index into stars array
  to: number;
}

export interface Constellation {
  name: string;
  stars: ConstellationStar[];
  lines: ConstellationLine[];
  color: 'white' | 'gold';
  theme: string;
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'The Eye',
    theme: 'Divine sight, awareness',
    color: 'white',
    stars: [
      { x: 68, y: 18, brightness: 0.85 },
      { x: 74, y: 30, brightness: 0.7 },
      { x: 76, y: 48, brightness: 0.85 },
      { x: 68, y: 52, brightness: 0.7 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
      { from: 2, to: 3 }, { from: 3, to: 0 },
      { from: 2, to: 0 },
    ],
  },
  {
    name: 'The Serpent',
    theme: 'Chaos, transformation',
    color: 'white',
    stars: [
      { x: 5, y: 72, brightness: 0.85 },
      { x: 12, y: 62, brightness: 0.7 },
      { x: 17, y: 66, brightness: 0.75 },
      { x: 22, y: 52, brightness: 0.85 },
      { x: 25, y: 43, brightness: 0.7 },
      { x: 21, y: 34, brightness: 0.75 },
      { x: 19, y: 27, brightness: 0.85 },
      { x: 15, y: 22, brightness: 0.7 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 },
      { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 },
      { from: 6, to: 7 },
    ],
  },
  {
    name: 'The Crown',
    theme: 'Order, authority',
    color: 'gold',
    stars: [
      { x: 42, y: 8, brightness: 0.8 },
      { x: 46, y: 16, brightness: 0.65 },
      { x: 50, y: 12, brightness: 0.8 },
      { x: 49, y: 22, brightness: 0.6 },
      { x: 44, y: 23, brightness: 0.6 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
      { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 0 },
    ],
  },
  {
    name: 'The Gate',
    theme: 'Threshold, choice',
    color: 'white',
    stars: [
      { x: 82, y: 68, brightness: 0.75 },
      { x: 82, y: 78, brightness: 0.65 },
      { x: 90, y: 70, brightness: 0.75 },
      { x: 90, y: 80, brightness: 0.65 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 2, to: 3 },
      { from: 0, to: 2 },
    ],
  },
  {
    name: 'The Scales',
    theme: 'Judgment, balance',
    color: 'white',
    stars: [
      { x: 30, y: 20, brightness: 0.8 },
      { x: 22, y: 42, brightness: 0.65 },
      { x: 20, y: 48, brightness: 0.55 },
      { x: 55, y: 20, brightness: 0.8 },
      { x: 62, y: 42, brightness: 0.65 },
      { x: 64, y: 48, brightness: 0.55 },
      { x: 42, y: 20, brightness: 0.6 },
      { x: 42, y: 58, brightness: 0.55 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
      { from: 3, to: 4 }, { from: 4, to: 5 },
      { from: 0, to: 6 }, { from: 6, to: 3 },
      { from: 6, to: 7 },
    ],
  },
  {
    name: 'The Spindle',
    theme: "The Fates' thread",
    color: 'white',
    stars: [
      { x: 58, y: 62, brightness: 0.75 },
      { x: 58, y: 68, brightness: 0.75 },
      { x: 58, y: 74, brightness: 0.75 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
    ],
  },
];
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc -b --noEmit src/data/constellations.ts`
Expected: Compiles clean

- [ ] **Step 3: Commit**

```bash
git add src/data/constellations.ts
git commit -m "feat: add 6 divination-themed constellations data

The Eye, Serpent, Crown, Gate, Scales, Spindle — each with star positions,
connection lines, color (white/gold), and thematic meaning.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 9: Rewrite StarField Component

**Files:**
- Modify: `src/components/overlays/StarField.tsx`

**Interfaces:**
- Consumes: `CONSTELLATIONS` from `src/data/constellations.ts`

- [ ] **Step 1: Rewrite StarField.tsx as SVG-based celestial field**

Replace the entire content of `src/components/overlays/StarField.tsx`:

```tsx
import { useMemo } from 'react';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';

interface DustStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

interface MediumStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

// Seeded pseudo-random based on a simple hash
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDustStars(seed: number, count: number): DustStar[] {
  const rng = seededRandom(seed);
  const stars: DustStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      cx: rng() * 100,
      cy: rng() * 100,
      r: rng() * 0.4 + 0.4,
      opacity: rng() * 0.3 + 0.15,
    });
  }
  return stars;
}

function generateMediumStars(seed: number, count: number): MediumStar[] {
  const rng = seededRandom(seed + 9999);
  const stars: MediumStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      cx: rng() * 100,
      cy: rng() * 100,
      r: rng() * 0.5 + 0.8,
      opacity: rng() * 0.3 + 0.35,
    });
  }
  return stars;
}

export default function StarField() {
  const dustStars = useMemo(() => generateDustStars(42, 60), []);
  const mediumStars = useMemo(() => generateMediumStars(137, 15), []);

  return (
    <div style={containerStyle}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
      >
        <defs>
          {/* Nebula gradients */}
          <radialGradient id="nebula-purple" cx="30%" cy="35%">
            <stop offset="0%" stopColor="#2a1545" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2a1545" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula-teal" cx="70%" cy="60%">
            <stop offset="0%" stopColor="#0f1f3d" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0f1f3d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nebula-rose" cx="50%" cy="85%">
            <stop offset="0%" stopColor="#1a0a1e" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1a0a1e" stopOpacity="0" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="glow-tight" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="0.3" />
          </filter>
          <filter id="glow-outer" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <filter id="line-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>

          {/* Constellation star template (white) */}
          <g id="cstar-white">
            <circle cx="0" cy="0" r="2.0" fill="#c8d8f0" opacity="0.1" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.8" fill="#e8f0ff" opacity="0.3" filter="url(#glow-tight)" />
            <circle cx="0" cy="0" r="0.25" fill="#e8f0ff" opacity="0.95" />
          </g>

          {/* Constellation star template (gold) */}
          <g id="cstar-gold">
            <circle cx="0" cy="0" r="2.0" fill="#d4a854" opacity="0.08" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.8" fill="#f0d878" opacity="0.25" filter="url(#glow-tight)" />
            <circle cx="0" cy="0" r="0.3" fill="#f0d878" opacity="0.95" />
          </g>
        </defs>

        {/* Base fill */}
        <rect width="100" height="100" fill="#070a12" />

        {/* Nebula washes */}
        <ellipse cx="30" cy="35" rx="55" ry="55" fill="url(#nebula-purple)" />
        <ellipse cx="70" cy="60" rx="55" ry="55" fill="url(#nebula-teal)" />
        <ellipse cx="50" cy="85" rx="50" ry="40" fill="url(#nebula-rose)" />

        {/* Dust stars */}
        {dustStars.map((s, i) => (
          <circle key={`d-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#7b9ec7" opacity={s.opacity} />
        ))}

        {/* Medium stars */}
        {mediumStars.map((s, i) => (
          <circle key={`m-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#c8d8f0" opacity={s.opacity} />
        ))}

        {/* Constellations */}
        {CONSTELLATIONS.map((constellation: Constellation) => (
          <g key={constellation.name}>
            {/* Glow lines */}
            {constellation.lines.map((line, i) => {
              const from = constellation.stars[line.from];
              const to = constellation.stars[line.to];
              return (
                <line
                  key={`lg-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={constellation.color === 'gold' ? '#d4a854' : '#c8d8f0'}
                  strokeWidth="0.5"
                  strokeOpacity="0.06"
                  filter="url(#line-glow)"
                />
              );
            })}
            {/* Core lines */}
            {constellation.lines.map((line, i) => {
              const from = constellation.stars[line.from];
              const to = constellation.stars[line.to];
              return (
                <line
                  key={`cl-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={constellation.color === 'gold' ? '#d4a854' : '#e8f0ff'}
                  strokeWidth="0.08"
                  strokeOpacity="0.25"
                />
              );
            })}
            {/* Stars */}
            {constellation.stars.map((star, i) => (
              <use
                key={`cs-${i}`}
                href={constellation.color === 'gold' ? '#cstar-gold' : '#cstar-white'}
                x={star.x}
                y={star.y}
                opacity={star.brightness}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 0,
  overflow: 'hidden',
};

const svgStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};
```

- [ ] **Step 2: Verify the app renders**

Start dev server (`npm run dev`), visit `http://localhost:5173/fate-atlas/`. You should see the new starfield with constellations on the title screen.

- [ ] **Step 3: Commit**

```bash
git add src/components/overlays/StarField.tsx
git commit -m "feat: rewrite StarField as SVG celestial field with constellations

Replaces 100 random CSS dots with full SVG sky: 60 dust stars, 15 medium
stars, 6 constellations (Eye, Serpent, Crown, Gate, Scales, Spindle) with
two-layer glow stars and connecting lines. Seeded pseudo-random positions
for consistent rendering. Three nebula washes in purple/teal/rose.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Create HistoryTiles Component

**Files:**
- Create: `src/components/overlays/HistoryTiles.tsx`

**Interfaces:**
- Consumes: `GameState.history` via `useGameEngine()`
- Produces: HistoryTiles component

- [ ] **Step 1: Write HistoryTiles component**

Create `src/components/overlays/HistoryTiles.tsx`:

```tsx
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { RunRecord } from '../../engine/types';

function getTileIcon(run: RunRecord): string {
  if (!run.turnResult || run.turnResult.type === 'happening') return '*';
  switch (run.turnResult.type) {
    case 'tarot': return run.turnResult.symbol;
    case 'd20': return String.fromCodePoint(0x2685); // D20 die face
    case 'iching': return run.turnResult.symbol;
    default: return '*';
  }
}

function getTileLabel(run: RunRecord): string {
  if (!run.turnResult || run.turnResult.type === 'happening') return 'Happening';
  switch (run.turnResult.type) {
    case 'tarot': return run.turnResult.name;
    case 'd20': return `D20 ${run.turnResult.result}`;
    case 'iching': return run.turnResult.name;
    default: return 'Unknown';
  }
}

export default function HistoryTiles() {
  const { state } = useGameEngine();
  const history = state.history;
  const activeInteraction = state.activeInteraction;

  if (history.length === 0) return null;

  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>
        {history.map((run, i) => {
          const isSource = activeInteraction && run.id === activeInteraction.ruleId.split('-').slice(1, -1).join('-');
          return (
            <motion.div
              key={run.id}
              style={{
                ...tileStyle,
                borderColor: isSource ? '#d4a854' : '#1a2440',
                boxShadow: isSource ? '0 0 12px rgba(212, 168, 84, 0.4)' : 'none',
              }}
              animate={isSource ? { boxShadow: ['0 0 12px rgba(212,168,84,0.4)', '0 0 24px rgba(212,168,84,0.7)', '0 0 12px rgba(212,168,84,0.4)'] } : {}}
              transition={isSource ? { duration: 1.5, repeat: Infinity } : {}}
              title={getTileLabel(run)}
            >
              <span style={iconStyle}>{getTileIcon(run)}</span>
              <span style={labelStyle}>{getTileLabel(run).slice(0, 12)}</span>
              {run.interactions.length > 0 && (
                <span style={badgeStyle}>{run.interactions.length}</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: '10px 16px',
  pointerEvents: 'none',
};

const scrollStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  justifyContent: 'center',
  flexWrap: 'nowrap',
};

const tileStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '20px',
  fontSize: '0.7rem',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  color: '#7b9ec7',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  pointerEvents: 'auto',
};

const iconStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#d4a854',
};

const labelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '80px',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '0.55rem',
  background: 'rgba(212,168,84,0.2)',
  color: '#d4a854',
  borderRadius: '50%',
  width: '14px',
  height: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: No new errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/components/overlays/HistoryTiles.tsx
git commit -m "feat: add HistoryTiles component for past reading display

Horizontal scrollable pill-shaped tiles showing past run results with
method icon, truncated name, and interaction count badge. Tiles glow
when they are the source of an active interaction.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 11: Create GameTable Hub Component

**Files:**
- Create: `src/components/screens/GameTable.tsx`

**Interfaces:**
- Consumes: `useGameEngine()`, all center content components, `HistoryTiles`, `InteractionLayer`
- Produces: `GameTable` component (replaces `ScreenRouter` in App.tsx)

- [ ] **Step 1: Write GameTable component**

Create `src/components/screens/GameTable.tsx`:

```tsx
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import TitleScreen from './TitleScreen';
import QuestionSelect from './QuestionSelect';
import MethodSelect from './MethodSelect';
import TarotMinigame from './TarotMinigame';
import DiceMinigame from './DiceMinigame';
import IChingMinigame from './IChingMinigame';
import HappeningScene from './HappeningScene';
import ResultReading from './ResultReading';
import HistoryTiles from '../overlays/HistoryTiles';
import InteractionLayer from '../overlays/InteractionLayer';

export default function GameTable() {
  const { state } = useGameEngine();

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
      <HistoryTiles />
      <div style={centerStyle}>
        <AnimatePresence mode="wait">
          {renderCenter()}
        </AnimatePresence>
      </div>
      <InteractionLayer />
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

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/GameTable.tsx
git commit -m "feat: add GameTable hub component replacing screen router

Persistent hub with HistoryTiles at top, AnimatePresence center content,
InteractionLayer overlay. Routes via state.screen and state.selectedMethod.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Create MethodSelect Component

**Files:**
- Create: `src/components/screens/MethodSelect.tsx`

- [ ] **Step 1: Write MethodSelect component**

Create `src/components/screens/MethodSelect.tsx`:

```tsx
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { DivinationType } from '../../engine/types';

const METHOD_CARDS: Record<DivinationType, { symbol: string; title: string; description: string; color: string }> = {
  tarot: { symbol: 'XXI', title: 'Tarot', description: 'Draw from the Major Arcana — the ancient cards reveal hidden truths.', color: '#9b6bb0' },
  d20: { symbol: String.fromCodePoint(0x2685), title: 'Dice', description: 'Cast the twenty-sided die — fate speaks through numbers.', color: '#c75b4a' },
  iching: { symbol: String.fromCodePoint(0x4DC0), title: 'I Ching', description: 'Consult the Book of Changes — the hexagram illuminates your path.', color: '#5b8c5a' },
  happening: { symbol: String.fromCodePoint(0x2726), title: 'Happening', description: 'Something stirs in the weave — a cryptic event awaits.', color: '#d4a854' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function MethodSelect() {
  const { state, engine } = useGameEngine();

  const handleSelect = (index: number) => {
    engine.selectMethod(index);
  };

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>Choose your divination</h1>
        <p style={subtitleStyle}>The stars have dealt three methods — pick one to reveal your fate</p>
        <div style={goldRuleStyle} />

        <motion.div style={gridStyle} variants={containerVariants} initial="hidden" animate="visible">
          {state.availableMethods.map((method, i) => {
            const card = METHOD_CARDS[method];
            return (
              <motion.button
                key={i}
                style={{ ...cardStyle, borderColor: card.color + '40' }}
                variants={cardVariants}
                whileHover={{ borderColor: card.color, boxShadow: `0 0 20px ${card.color}20`, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(i)}
              >
                <div style={{ ...cardSymbolStyle, color: card.color }}>{card.symbol}</div>
                <div style={cardTitleStyle}>{card.title}</div>
                <div style={cardDescStyle}>{card.description}</div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '660px',
  padding: '2rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.12em',
  margin: 0,
  textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  letterSpacing: '0.05em',
  margin: 0,
  textAlign: 'center',
};

const goldRuleStyle: React.CSSProperties = {
  width: '40px',
  height: '2px',
  background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
};

const gridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
  maxWidth: '420px',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '1.25rem 1.5rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  outline: 'none',
  width: '100%',
};

const cardSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(1rem, 2vw, 1.2rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const cardDescStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
  color: '#7b9ec7',
  textAlign: 'center',
  lineHeight: 1.4,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/MethodSelect.tsx
git commit -m "feat: add MethodSelect screen component

Shows 3 available divination methods as cards with method-specific
colors and icons. User picks one, calling engine.selectMethod(index).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 13: Create TarotMinigame Component

**Files:**
- Create: `src/components/screens/TarotMinigame.tsx`

- [ ] **Step 1: Write TarotMinigame component**

Create `src/components/screens/TarotMinigame.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { drawTarotCard } from '../../data/tarot';
import type { TarotResult } from '../../engine/types';

const RUNE_BAND = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁ';

type Phase = 'pick' | 'reversal-prompt' | 'revealed';

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();
  const [phase, setPhase] = useState<Phase>('pick');
  const [faceDownCards, setFaceDownCards] = useState<TarotResult[]>(() =>
    Array.from({ length: 3 }, () => drawTarotCard(state.affinities))
  );
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [willReverse, setWillReverse] = useState(false);

  const handlePickCard = useCallback((index: number) => {
    setChosenIndex(index);
    // Small delay so the burn animation plays before reversal prompt
    setTimeout(() => setPhase('reversal-prompt'), 600);
  }, []);

  const handleReveal = useCallback((reverse: boolean) => {
    setWillReverse(reverse);
    setPhase('revealed');
  }, []);

  useEffect(() => {
    if (phase !== 'revealed' || chosenIndex === null) return;

    const card = faceDownCards[chosenIndex];
    const finalResult: TarotResult = willReverse
      ? {
          ...card,
          orientation: card.orientation === 'upright' ? 'reversed' : 'upright',
          tags: card.tags.map((t) => t === 'upright' ? 'reversed' : t === 'reversed' ? 'upright' : t),
        }
      : card;

    // Small delay for the flip animation, then complete
    const timer = setTimeout(() => {
      engine.completeMinigame(finalResult);
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, chosenIndex, willReverse, faceDownCards, engine]);

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>
          {phase === 'pick' && 'Draw a card'}
          {phase === 'reversal-prompt' && 'The stars offer a choice'}
          {phase === 'revealed' && 'Your card'}
        </h1>

        {phase === 'pick' && (
          <motion.div style={cardsRowStyle} initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}>
            {faceDownCards.map((_, i) => (
              <motion.button
                key={i}
                style={faceDownCardStyle}
                variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ y: -8, boxShadow: '0 8px 30px rgba(155,107,176,0.3)', borderColor: '#9b6bb0' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePickCard(i)}
                animate={chosenIndex !== null && chosenIndex !== i ? { opacity: 0, scale: 0.8, rotateY: 90, filter: 'brightness(2)' } : {}}
                transition={chosenIndex !== null && chosenIndex !== i ? { duration: 0.6, ease: 'easeIn' } : {}}
              >
                <span style={runeStyle}>{RUNE_BAND}</span>
                <span style={cardBackSymbolStyle}>✧</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {phase === 'reversal-prompt' && chosenIndex !== null && (
          <motion.div style={promptStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.div style={singleCardStyle} animate={{ y: -5 }} transition={{ yoyo: Infinity, duration: 2 }}>
              <span style={runeStyle}>{RUNE_BAND}</span>
              <span style={cardBackSymbolStyle}>✧</span>
            </motion.div>
            <p style={promptTextStyle}>Reveal as drawn, or reverse its course?</p>
            <div style={choiceRowStyle}>
              <motion.button style={choiceBtnStyle} whileHover={{ borderColor: '#d4a854', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleReveal(false)}>
                ▲ Reveal as Drawn
              </motion.button>
              <motion.button style={{ ...choiceBtnStyle, borderColor: '#9b6bb0' }} whileHover={{ borderColor: '#c8a0d0', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleReveal(true)}>
                ▼ Reverse its Course
              </motion.button>
            </div>
          </motion.div>
        )}

        {phase === 'revealed' && chosenIndex !== null && (
          <motion.div style={revealStyle} initial={{ opacity: 0, scale: 0.8, rotateY: 180 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
            <div style={revealedSymbolStyle}>{faceDownCards[chosenIndex].symbol}</div>
            <div style={revealedNameStyle}>{faceDownCards[chosenIndex].name}</div>
            <div style={{ ...revealedOrientStyle, color: willReverse !== (faceDownCards[chosenIndex].orientation === 'reversed') ? '#d4a854' : '#7b9ec7' }}>
              {willReverse !== (faceDownCards[chosenIndex].orientation === 'reversed')
                ? `▼ ${faceDownCards[chosenIndex].orientation === 'upright' ? 'Reversed' : 'Upright'}`
                : `▲ ${faceDownCards[chosenIndex].orientation === 'upright' ? 'Upright' : 'Reversed'}`}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
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

const cardsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.25rem',
  justifyContent: 'center',
};

const faceDownCardStyle: React.CSSProperties = {
  width: '100px',
  height: '150px',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const runeStyle: React.CSSProperties = {
  fontFamily: "'Noto Sans', sans-serif",
  fontSize: '0.55rem',
  color: '#5b7290',
  letterSpacing: '0.3em',
  userSelect: 'none',
};

const cardBackSymbolStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  color: '#9b6bb0',
  opacity: 0.6,
};

const promptStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.25rem',
};

const singleCardStyle: React.CSSProperties = {
  width: '100px',
  height: '150px',
  background: '#0d1220',
  border: '1px solid #9b6bb0',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
};

const promptTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  color: '#c8d8f0',
  letterSpacing: '0.05em',
  margin: 0,
  textAlign: 'center',
};

const choiceRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const choiceBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  letterSpacing: '0.1em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #1a2440',
  padding: '0.7rem 1.5rem',
  borderRadius: '4px',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.3s ease',
};

const revealStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const revealedSymbolStyle: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
  color: '#d4a854',
};

const revealedNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const revealedOrientStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  letterSpacing: '0.1em',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat: add TarotMinigame with card picking and reversal choice

Three face-down cards, user picks one, unselected cards burn away,
reversal prompt with Reveal/Reverse buttons, card flip reveal.
Illusion of agency — engine draws cards, player provides the gesture.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 14: Create DiceMinigame Component

**Files:**
- Create: `src/components/screens/DiceMinigame.tsx`

- [ ] **Step 1: Write DiceMinigame component**

Create `src/components/screens/DiceMinigame.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { rollD20 } from '../../data/dice';
import type { DiceResult } from '../../engine/types';

const THRESHOLD_COLORS: Record<string, string> = {
  'critical-low': '#c0392b',
  'low': '#c75b4a',
  'neutral': '#7b9ec7',
  'high': '#5b8c5a',
  'critical-high': '#d4a854',
};

export default function DiceMinigame() {
  const { state, engine } = useGameEngine();
  const [thrown, setThrown] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [rollValue, setRollValue] = useState(10);

  const handleThrow = useCallback(() => {
    setThrown(true);
    const finalResult = rollD20(state.affinities);
    setResult(finalResult);
    // Animate the count-up
    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (count >= finalResult.result) {
        clearInterval(interval);
        setRollValue(finalResult.result);
      } else {
        setRollValue(Math.min(count, 20));
      }
    }, 50);
  }, [state.affinities]);

  useEffect(() => {
    if (!result || !thrown) return;
    const timer = setTimeout(() => {
      engine.completeMinigame(result);
    }, 1500);
    return () => clearTimeout(timer);
  }, [result, thrown, engine]);

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
          <motion.div style={resultContainerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <motion.div
              style={dieResultStyle}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            >
              <span style={{ ...resultNumberStyle, color: result ? THRESHOLD_COLORS[result.threshold] : '#c8d8f0' }}>
                {rollValue}
              </span>
            </motion.div>
            {result && (
              <motion.div style={thresholdStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <span style={{ ...thresholdBadgeStyle, color: THRESHOLD_COLORS[result.threshold], borderColor: THRESHOLD_COLORS[result.threshold] }}>
                  {result.threshold.replace(/-/g, ' ').toUpperCase()}
                </span>
                <p style={interpretationStyle}>{result.interpretation}</p>
              </motion.div>
            )}
          </motion.div>
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

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/DiceMinigame.tsx
git commit -m "feat: add DiceMinigame with tap-to-throw animation

Rotating d20, tap to throw, animated count-up to result, threshold
badge with color coding. Illusion of agency via the throw gesture.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: Create IChingMinigame Component

**Files:**
- Create: `src/components/screens/IChingMinigame.tsx`

- [ ] **Step 1: Write IChingMinigame component**

Create `src/components/screens/IChingMinigame.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { castHexagram } from '../../data/iching';
import type { IChingResult } from '../../engine/types';

const LINE_LABELS = ['1st (bottom)', '2nd', '3rd', '4th', '5th', '6th (top)'];

export default function IChingMinigame() {
  const { state, engine } = useGameEngine();
  const [castCount, setCastCount] = useState(0);
  const [hexagramResult, setHexagramResult] = useState<IChingResult | null>(null);
  const [done, setDone] = useState(false);

  const handleCast = useCallback(() => {
    if (done) return;
    const next = castCount + 1;
    setCastCount(next);
    if (next >= 6) {
      const result = castHexagram(state.affinities);
      setHexagramResult(result);
      setDone(true);
    }
  }, [castCount, done, state.affinities]);

  useEffect(() => {
    if (!done || !hexagramResult) return;
    const timer = setTimeout(() => {
      engine.completeMinigame(hexagramResult);
    }, 2000);
    return () => clearTimeout(timer);
  }, [done, hexagramResult, engine]);

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={contentStyle}>
        <h1 style={headingStyle}>
          {!done ? `Cast ${castCount + 1} of 6` : 'The hexagram is revealed'}
        </h1>

        {!done ? (
          <motion.button
            style={castButtonStyle}
            whileHover={{ scale: 1.05, borderColor: '#5b8c5a', boxShadow: '0 0 20px rgba(91,140,90,0.2)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCast}
          >
            <span style={coinStyle}>{String.fromCodePoint(0x26AA)} {String.fromCodePoint(0x26AB)} {String.fromCodePoint(0x26AA)}</span>
            <span style={castLabelStyle}>Tap to cast coins</span>
            <span style={lineLabelStyle}>{LINE_LABELS[castCount]}</span>
          </motion.button>
        ) : (
          <motion.div style={hexagramResultStyle} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            <div style={hexagramSymbolStyle}>{hexagramResult?.symbol}</div>
            <div style={hexagramNameStyle}>{hexagramResult?.name}</div>
            <div style={hexagramNumberStyle}>Hexagram #{hexagramResult?.hexagramNumber}</div>
            <p style={hexagramJudgmentStyle}>{hexagramResult?.judgment}</p>
            {hexagramResult && hexagramResult.changingLines.length > 0 && (
              <div style={changingLinesStyle}>
                Changing lines: {hexagramResult.changingLines.join(', ')}
              </div>
            )}
          </motion.div>
        )}

        {/* Casting progress */}
        <div style={progressStyle}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              style={{
                ...progressDotStyle,
                background: i < castCount ? '#5b8c5a' : '#1a2440',
              }}
            />
          ))}
        </div>
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
  gap: '1.5rem',
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

const castButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.5rem 2rem',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '8px',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const coinStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  letterSpacing: '0.3em',
};

const castLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const lineLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#5b7290',
};

const hexagramResultStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  textAlign: 'center',
};

const hexagramSymbolStyle: React.CSSProperties = {
  fontSize: '3rem',
  color: '#d4a854',
};

const hexagramNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 700,
  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
  color: '#c8d8f0',
  letterSpacing: '0.08em',
};

const hexagramNumberStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.8rem',
  color: '#5b8c5a',
};

const hexagramJudgmentStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
  color: '#7b9ec7',
  fontStyle: 'italic',
  lineHeight: 1.5,
  margin: '0.5rem 0 0',
  maxWidth: '360px',
};

const changingLinesStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.75rem',
  color: '#d4a854',
  marginTop: '0.25rem',
};

const progressStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const progressDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  transition: 'background 0.3s ease',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/IChingMinigame.tsx
git commit -m "feat: add IChingMinigame with 6 coin-cast hexagram building

User taps to cast coins 6 times, building hexagram from bottom up.
Progress dots show casting progress. Hexagram symbol, name, number,
and judgment revealed after final cast.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 16: Refactor HappeningScene

**Files:**
- Modify: `src/components/screens/HappeningScene.tsx`

**Changes:** Remove full-screen styling (position:fixed, inset:0, background), replace with centered content. The GameTable provides background now.

- [ ] **Step 1: Update HappeningScene**

The existing HappeningScene is already mostly center content. Simply remove the full-screen container and background. Change the outer `containerStyle` from position:fixed to position:relative with max-width, and remove the backgroundImage with star points.

Edit `src/components/screens/HappeningScene.tsx`:
- Change `containerStyle` from `position: 'fixed', inset: 0, ...` to `position: 'relative', maxWidth: '680px', width: '100%', padding: '2rem'`
- Remove `background: '#070a12'` and `backgroundImage: STAR_POINTS` from containerStyle
- Remove the `STAR_POINTS` constant (lines 6-25) — StarField handles this now

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/HappeningScene.tsx
git commit -m "refactor: HappeningScene as center content instead of full-screen

Removes full-screen overlay styling — GameTable provides the background.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 17: Create InteractionLayer Component

**Files:**
- Create: `src/components/overlays/InteractionLayer.tsx`

- [ ] **Step 1: Write InteractionLayer**

Create `src/components/overlays/InteractionLayer.tsx`:

```tsx
import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import FoolsRerollAnimation from './InteractionAnimations/FoolsRerollAnimation';
import StubAnimation from './InteractionAnimations/StubAnimations';

export default function InteractionLayer() {
  const { state, engine } = useGameEngine();
  const active = state.activeInteraction;

  const handleComplete = useCallback(() => {
    engine.clearActiveInteraction();
  }, [engine]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          style={layerStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleComplete}
        >
          {active.effect === 'reroll' ? (
            <FoolsRerollAnimation event={active} onComplete={handleComplete} />
          ) : (
            <StubAnimation event={active} onComplete={handleComplete} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const layerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/overlays/InteractionLayer.tsx
git commit -m "feat: add InteractionLayer overlay for in-minigame interaction animations

Subscribes to state.activeInteraction, renders FoolsRerollAnimation or
StubAnimation depending on effect type. Tap to dismiss.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 18: Create FoolsRerollAnimation

**Files:**
- Create: `src/components/overlays/InteractionAnimations/FoolsRerollAnimation.tsx`

- [ ] **Step 1: Create directory and write animation component**

Create `src/components/overlays/InteractionAnimations/` directory, then create `FoolsRerollAnimation.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { InteractionEvent } from '../../../engine/types';

type AnimPhase = 'flash' | 'glow' | 'particle' | 'reroll' | 'dismissal';

interface Props {
  event: InteractionEvent;
  onComplete: () => void;
}

export default function FoolsRerollAnimation({ event, onComplete }: Props) {
  const [phase, setPhase] = useState<AnimPhase>('flash');

  useEffect(() => {
    const sequence: { phase: AnimPhase; delay: number }[] = [
      { phase: 'flash', delay: 300 },
      { phase: 'glow', delay: 500 },
      { phase: 'particle', delay: 600 },
      { phase: 'reroll', delay: 800 },
      { phase: 'dismissal', delay: 500 },
    ];

    let currentIdx = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advance = () => {
      currentIdx++;
      if (currentIdx < sequence.length) {
        setPhase(sequence[currentIdx].phase);
        timeoutId = setTimeout(advance, sequence[currentIdx].delay);
      } else {
        timeoutId = setTimeout(onComplete, sequence[currentIdx - 1].delay);
      }
    };

    timeoutId = setTimeout(advance, sequence[0].delay);

    return () => clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <motion.div style={containerStyle}>
      {phase === 'flash' && (
        <motion.div
          style={flashStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 0.3 }}
        />
      )}

      {phase === 'glow' && (
        <motion.div style={glowContentStyle}>
          <motion.div
            style={glowOrbStyle}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
          <span style={glowTextStyle}>{event.description}</span>
        </motion.div>
      )}

      {phase === 'particle' && (
        <motion.div style={particleContainerStyle}>
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              style={particleStyle}
              initial={{ x: 0, y: -80, opacity: 1 }}
              animate={{
                x: (Math.random() - 0.5) * 120,
                y: 30 + Math.random() * 40,
                opacity: 0,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </motion.div>
      )}

      {phase === 'reroll' && (
        <motion.div style={rerollContentStyle}>
          <motion.span
            style={rerollDieStyle}
            animate={{ rotate: [0, 720, 1440], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            {String.fromCodePoint(0x2685)}
          </motion.span>
          <span style={rerollLabelStyle}>The dice are recast...</span>
        </motion.div>
      )}

      {phase === 'dismissal' && (
        <motion.div
          style={dismissalStyle}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto',
};

const flashStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212,168,84,0.3), transparent 70%)',
};

const glowContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
};

const glowOrbStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(212,168,84,0.5), transparent 70%)',
};

const glowTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
  fontSize: '1.1rem',
  color: '#d4a854',
  textAlign: 'center',
  fontStyle: 'italic',
  maxWidth: '340px',
};

const particleContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: '200px',
  height: '150px',
};

const particleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  background: '#d4a854',
};

const rerollContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const rerollDieStyle: React.CSSProperties = {
  fontSize: '3rem',
  display: 'inline-block',
};

const rerollLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1rem',
  color: '#c8d8f0',
  letterSpacing: '0.1em',
};

const dismissalStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212,168,84,0.15), transparent 60%)',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/overlays/InteractionAnimations/FoolsRerollAnimation.tsx
git commit -m "feat: add FoolsRerollAnimation with 5-phase sequence

Flash → Glow → Particle → Reroll → Dismissal phases driven by
useEffect timer. Framer Motion animations for each phase: gold flash
overlay, pulsing glow orb with description text, 12 gold particles
arcing downward, spinning d20, fade-out dismissal.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 19: Create StubAnimations

**Files:**
- Create: `src/components/overlays/InteractionAnimations/StubAnimations.tsx`

- [ ] **Step 1: Write StubAnimations**

Create `src/components/overlays/InteractionAnimations/StubAnimations.tsx`:

```tsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { InteractionEvent } from '../../../engine/types';

interface Props {
  event: InteractionEvent;
  onComplete: () => void;
}

const STUB_LABELS: Record<string, string> = {
  flip: 'The Critical Flip',
  'add-choice': 'I Ching Boost',
  mirror: 'The Mirror Event',
  'second-result': 'Chaos Surge',
};

export default function StubAnimation({ event, onComplete }: Props) {
  const label = STUB_LABELS[event.effect] ?? event.effect;

  useEffect(() => {
    const timer = setTimeout(onComplete, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        style={flashStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        style={cardStyle}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <span style={effectIconStyle}>{String.fromCodePoint(0x2726)}</span>
        <span style={labelStyle}>{label}</span>
        <span style={descriptionStyle}>{event.description}</span>
      </motion.div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const flashStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, rgba(212,168,84,0.2), transparent 60%)',
};

const cardStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '1.5rem 2rem',
  background: '#0d1220',
  border: '1px solid #d4a854',
  borderRadius: '6px',
};

const effectIconStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  color: '#d4a854',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1.1rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
};

const descriptionStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: '0.8rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  maxWidth: '280px',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/overlays/InteractionAnimations/StubAnimations.tsx
git commit -m "feat: add stub interaction animations for flip, boost, mirror, chaos

Flash → card with label and description → auto-dismiss after 1.2s.
Covers Critical Flip, I Ching Boost, Mirror Event, and Chaos Surge.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 20: Create ResultReading Component

**Files:**
- Create: `src/components/screens/ResultReading.tsx`

- [ ] **Step 1: Write ResultReading component**

Create `src/components/screens/ResultReading.tsx`. This merges Interpretation and ResultScreen into a single share-optimized card:

```tsx
import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { shareAsImage } from '../../utils/shareExport';
import RunicBand from '../shared/RunicBand';
import OrnamentalBorder from '../shared/OrnamentalBorder';
import MysticButton from '../shared/MysticButton';
import HistoryModal from '../overlays/HistoryModal';
import type { SlotResult } from '../../engine/types';

function formatQuestionType(qt: string): string {
  switch (qt) {
    case 'decision': return 'Decision';
    case 'relationship': return 'Relationship';
    case 'future': return 'Future / Forecast';
    case 'self': return 'Self-Analysis';
    default: return qt;
  }
}

function getResultDisplay(result: SlotResult): { symbol: string; name: string; subtitle: string } {
  switch (result.type) {
    case 'tarot':
      return {
        symbol: result.symbol,
        name: result.name,
        subtitle: result.orientation === 'upright' ? `Upright — ${result.meaningUpright.slice(0, 100)}` : `Reversed — ${result.meaningReversed.slice(0, 100)}`,
      };
    case 'd20':
      return { symbol: String.fromCodePoint(0x2685), name: `D20 — ${result.result}`, subtitle: result.interpretation.slice(0, 100) };
    case 'iching':
      return { symbol: result.symbol, name: `Hexagram #${result.hexagramNumber} — ${result.name}`, subtitle: result.judgment.slice(0, 100) };
    case 'happening':
      return { symbol: String.fromCodePoint(0x2726), name: 'Happening', subtitle: result.scene.slice(0, 100) };
    default:
      return { symbol: '?', name: 'Unknown', subtitle: '' };
  }
}

export default function ResultReading() {
  const { state, engine } = useGameEngine();
  const shareRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { turnResult, synthesis, happening, selectedHappeningChoice, affinities, questionType } = state;

  const handleDrawAgain = useCallback(() => engine.returnToQuestionSelect(), [engine]);
  const handleShare = useCallback(async () => {
    if (shareRef.current) {
      try { await shareAsImage(shareRef.current); } catch { /* silent */ }
    }
  }, []);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(engine.generateLLMPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }, [engine]);

  const resultDisplay = turnResult ? getResultDisplay(turnResult) : null;
  const questionLabel = questionType ? formatQuestionType(questionType) : 'the unknown';

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div ref={shareRef} data-share-container style={cardStyle}>
        <RunicBand opacity={0.3} />
        <h1 style={titleStyle}>Your Reading</h1>
        <div style={questionStyle}>{questionLabel}</div>
        <OrnamentalBorder margin="0.25rem 0" />

        {/* Divination Result */}
        {resultDisplay && (
          <div style={resultCardStyle}>
            <div style={resultSymbolStyle}>{resultDisplay.symbol}</div>
            <div style={resultNameStyle}>{resultDisplay.name}</div>
            <div style={resultSubtitleStyle}>{resultDisplay.subtitle}</div>
          </div>
        )}

        {/* Synthesis */}
        {synthesis && (
          <div style={synthesisSectionStyle}>
            <h2 style={sectionTitleStyle}>Interpretation</h2>
            <h3 style={headlineStyle}>{synthesis.headline}</h3>
            {synthesis.paragraphs.map((p, i) => (
              <p key={i} style={paraStyle}>{p}</p>
            ))}
            {synthesis.tensionNote && (
              <div style={tensionBoxStyle}>
                <div style={tensionBarStyle} />
                <p style={tensionTextStyle}>{synthesis.tensionNote}</p>
              </div>
            )}
            {synthesis.affinityNote && (
              <p style={affinityStyle}>{synthesis.affinityNote}</p>
            )}
          </div>
        )}

        {/* Happening */}
        {happening && selectedHappeningChoice !== null && (
          <div style={happeningSectionStyle}>
            <h2 style={sectionTitleStyle}>The Crossroads</h2>
            <p style={sceneStyle}>{happening.scene}</p>
            <div style={chosenStyle}>
              <span style={chosenLabelStyle}>You chose:</span>
              <span style={chosenTextStyle}>{happening.choices[selectedHappeningChoice]?.text}</span>
            </div>
          </div>
        )}

        <RunicBand opacity={0.2} />

        {/* Actions */}
        <div style={actionsStyle}>
          <MysticButton onClick={handleDrawAgain}>DRAW AGAIN</MysticButton>
          <div style={secondaryRowStyle}>
            <MysticButton variant="secondary" onClick={handleShare}>SHARE AS IMAGE</MysticButton>
            <MysticButton variant="secondary" onClick={() => setHistoryOpen(true)}>HISTORY ({state.history.length})</MysticButton>
          </div>
          <MysticButton variant="secondary" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy LLM Prompt'}</MysticButton>
        </div>
      </div>
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  padding: '1rem',
  maxHeight: '100vh',
  overflowY: 'auto',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '2rem 1.5rem',
  background: '#070a12',
  border: '1px solid #1a2440',
  borderRadius: '8px',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', color: '#c8d8f0',
  letterSpacing: '0.12em', margin: 0,
};

const questionStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 500,
  fontSize: 'clamp(0.8rem, 1.8vw, 0.95rem)', color: '#d4a854',
  fontStyle: 'italic', letterSpacing: '0.08em',
};

const resultCardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.3rem', padding: '1rem', background: '#0d1220',
  border: '1px solid #1a2440', borderRadius: '6px', width: '100%',
  boxSizing: 'border-box',
};

const resultSymbolStyle: React.CSSProperties = { fontSize: '2rem', color: '#d4a854' };
const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '1rem', color: '#c8d8f0', letterSpacing: '0.05em',
};
const resultSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: '0.75rem', color: '#7b9ec7', textAlign: 'center', lineHeight: 1.4,
};

const synthesisSectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.5rem', width: '100%',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.85rem, 1.8vw, 1rem)', color: '#d4a854',
  letterSpacing: '0.15em', margin: 0,
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(1rem, 2.2vw, 1.3rem)', color: '#c8d8f0',
  letterSpacing: '0.05em', margin: 0, textAlign: 'center',
};

const paraStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: 'clamp(0.78rem, 1.5vw, 0.9rem)', color: '#7b9ec7',
  lineHeight: 1.65, margin: 0, width: '100%',
};

const tensionBoxStyle: React.CSSProperties = {
  position: 'relative', background: '#0d1220', borderRadius: '6px',
  padding: '0.75rem 1rem', width: '100%', boxSizing: 'border-box',
};

const tensionBarStyle: React.CSSProperties = {
  position: 'absolute', left: 0, top: 0, bottom: 0,
  width: '3px', background: '#d4a854', borderRadius: '3px 0 0 3px',
};

const tensionTextStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: '0.8rem', color: '#c8d8f0', fontStyle: 'italic',
  lineHeight: 1.5, margin: 0,
};

const affinityStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
  fontSize: '0.8rem', color: '#7b9ec7', fontStyle: 'italic',
  textAlign: 'center', margin: 0,
};

const happeningSectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.5rem', width: '100%', padding: '0.75rem',
  background: '#0d1220', border: '1px solid #1a2440',
  borderRadius: '6px', boxSizing: 'border-box',
};

const sceneStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
  fontSize: '0.85rem', color: '#7b9ec7', fontStyle: 'italic',
  textAlign: 'center', lineHeight: 1.5, margin: 0,
};

const chosenStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
};

const chosenLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400,
  fontSize: '0.65rem', color: '#d4a854', letterSpacing: '0.1em',
};

const chosenTextStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.9rem', color: '#c8d8f0', textAlign: 'center',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.6rem',
  alignItems: 'center', marginTop: '0.25rem',
};

const secondaryRowStyle: React.CSSProperties = {
  display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/screens/ResultReading.tsx
git commit -m "feat: add ResultReading — merged interpretation and result screen

Single scrollable card with divination result, synthesis, optional
happening outcome, and actions. Wrapped in data-share-container for
tight image export. Replaces Interpretation.tsx and ResultScreen.tsx.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---


### Task 21: Update DebugPanel with Scenario Presets

**Files:**
- Modify: `src/components/debug/DebugPanel.tsx`

- [ ] **Step 1: Add scenario preset dropdown to DebugPanel**

Add a `<select>` dropdown and "Load" button in the DebugPanel. The presets are fetched from `engine.getScenarioPresets()`. On load, calls `engine.loadScenarioById(selectedPreset)`. Also add a "Force Fool's Reroll" button that calls `engine.injectPendingEffect(...)`.

```tsx
// Add inside DebugPanel component:
const [scenarioId, setScenarioId] = useState('');
const presets = engine.getScenarioPresets();

const handleLoadScenario = useCallback(() => {
  if (scenarioId) engine.loadScenarioById(scenarioId);
}, [scenarioId, engine]);

const handleForceFoolsReroll = useCallback(() => {
  engine.injectPendingEffect({
    id: 'debug-fools-reroll-' + Date.now(),
    sourceRunId: 'debug',
    sourceCard: 'The Fool',
    sourceSlotIndex: 0,
    triggerTags: ['roll', 'numeric'],
    action: 'reroll',
    description: "The Fool's wild energy ripples through fate — the dice must be cast again.",
    expiresAfter: 3,
    turnsRemaining: 3,
  });
}, [engine]);
```

Add JSX in the debug panel render:
```tsx
<div style={{ marginTop: '12px' }}>
  <label style={labelStyle}>Scenario Preset</label>
  <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} style={selectStyle}>
    <option value="">-- Select --</option>
    {presets.map((p) => (
      <option key={p.id} value={p.id}>{p.label}</option>
    ))}
  </select>
  <button onClick={handleLoadScenario} style={btnStyle}>Load Scenario</button>
  <button onClick={handleForceFoolsReroll} style={{ ...btnStyle, marginTop: '8px' }}>
    Force Fool's Reroll
  </button>
</div>
```

- [ ] **Step 2: Verify DebugPanel compiles**

Run: `npx tsc -b --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/debug/DebugPanel.tsx
git commit -m "feat: add scenario preset dropdown and force-trigger to DebugPanel"
```

---

### Task 22: Update App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace ScreenRouter with GameTable**

Replace the entire content of `src/App.tsx`:

```tsx
import { EngineProvider } from './context/EngineContext';
import GameTable from './components/screens/GameTable';
import StarField from './components/overlays/StarField';
import DebugPanel from './components/debug/DebugPanel';

function App() {
  return (
    <EngineProvider>
      <StarField />
      <GameTable />
      <DebugPanel />
    </EngineProvider>
  );
}

export default App;
```

Remove all old screen imports and the `ScreenRouter` function.

- [ ] **Step 2: Verify the app compiles**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: replace ScreenRouter with GameTable in App.tsx"
```

---

### Task 23: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update gameplay flow section**

Replace the gameplay flow section with:

```
1. **Title** — click **CONSULT THE STARS**
2. **Question** — pick one of four question types
3. **Method Select** — choose one of 3 divination methods dealt by the stars
4. **Minigame** — play a short interactive experience (pick a tarot card, roll the dice, cast coins)
5. **Result** — read the interpretation. Happenings may appear as cryptic events between turns
```

Fix the debug URL example from `?debug` to:
```
http://localhost:5173/fate-atlas/?debug
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for new gameplay flow and debug URL"
```

---

### Task 24: Remove Old Files

**Files:**
- Remove: `src/components/screens/DrawPhase.tsx`
- Remove: `src/components/screens/InteractionOverlay.tsx`
- Remove: `src/components/screens/Interpretation.tsx`
- Remove: `src/components/screens/ResultScreen.tsx`

- [ ] **Step 1: Delete old screen files**

```bash
git rm src/components/screens/DrawPhase.tsx
git rm src/components/screens/InteractionOverlay.tsx
git rm src/components/screens/Interpretation.tsx
git rm src/components/screens/ResultScreen.tsx
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove old screen components replaced by new flow"
```

---

### Task 25: Final Integration — Build, Test, Verify

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: All engine tests pass.

- [ ] **Step 2: Run full build**

```bash
npm run build
```
Expected: Clean build with zero TypeScript errors.

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Manual verification checklist:
1. Title screen loads with new SVG starfield with constellations
2. Click CONSULT THE STARS, pick a question type
3. Method Select shows 3 method cards with color-coded icons
4. Pick Tarot: 3 face-down cards, pick one, unselected burn away
5. Reversal prompt appears, choose orientation, card flips to reveal
6. ResultReading shows divination result, synthesis, actions
7. Click DRAW AGAIN returns to Question Select
8. Add `?debug` to URL, verify DebugPanel opens
9. Pick "Fool's Reroll" preset, load it, verify it sets up the scenario
10. Verify history tiles appear at top after completing one reading
11. Test sharing: click SHARE AS IMAGE, verify cropped tight card export

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final integration fixes from smoke testing"
```

---

## Plan Summary

| # | Task | Files |
|---|------|-------|
| 1 | Update engine types | `types.ts` (modify) |
| 2 | Update InteractionResolver | `InteractionResolver.ts` (modify), test (new) |
| 3 | Create scenario presets | `scenarios.ts` (new) |
| 4 | Update TurnOrchestrator | `TurnOrchestrator.ts` (modify) |
| 5 | Rewrite GameEngine | `GameEngine.ts` (modify) |
| 6 | Update engine tests | `GameEngine.test.ts` (modify) |
| 7 | Fix remaining test references | Various test files |
| 8 | Create constellation data | `constellations.ts` (new) |
| 9 | Rewrite StarField | `StarField.tsx` (modify) |
| 10 | Create HistoryTiles | `HistoryTiles.tsx` (new) |
| 11 | Create GameTable | `GameTable.tsx` (new) |
| 12 | Create MethodSelect | `MethodSelect.tsx` (new) |
| 13 | Create TarotMinigame | `TarotMinigame.tsx` (new) |
| 14 | Create DiceMinigame | `DiceMinigame.tsx` (new) |
| 15 | Create IChingMinigame | `IChingMinigame.tsx` (new) |
| 16 | Refactor HappeningScene | `HappeningScene.tsx` (modify) |
| 17 | Create InteractionLayer | `InteractionLayer.tsx` (new) |
| 18 | Create FoolsRerollAnimation | `FoolsRerollAnimation.tsx` (new) |
| 19 | Create StubAnimations | `StubAnimations.tsx` (new) |
| 20 | Create ResultReading | `ResultReading.tsx` (new) |
| 21 | Update DebugPanel | `DebugPanel.tsx` (modify) |
| 22 | Update App.tsx | `App.tsx` (modify) |
| 23 | Update README | `README.md` (modify) |
| 24 | Remove old files | 4 files (delete) |
| 25 | Final integration | Build, test, smoke test |
