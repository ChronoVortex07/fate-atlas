# Atlas of Fate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Atlas of Fate divination game — a web-based roguelike reading loop where players draw tarot cards, roll dice, and cast I Ching hexagrams, with hidden meta interactions and affinities creating emergent chain reactions.

**Architecture:** React SPA shell (Vite + Framer Motion) renders UI, while a pure TypeScript game engine owns all logic. React communicates with the engine through a single context/hook. The engine uses a tag-based rule system so interactions match by tag rather than hard-coded IDs, making the game inherently expandable.

**Tech Stack:** Vite, React 18, TypeScript, Framer Motion, html2canvas, Vitest, localStorage, Cormorant Garamond + Inter fonts

## Global Constraints

- Game engine must be pure TypeScript — no React, no DOM, no `window`/`document` references
- All game data (tarot deck, dice thresholds, hexagrams, happenings, interaction rules) stored as typed TS objects, not code paths
- Interactions match by tags, never by hard-coded entity IDs
- Affinity values range 0.0–1.0, hidden from players, persist across runs
- MVP: 22 Major Arcana, 1d20, 64 I Ching hexagrams (3-coin method), 8-10 happenings, 5 interaction rules
- Visual: "Stellar Divination" — palette `#070a12` (deepest bg), `#7b9ec7` (steel blue text), `#c8d8f0` (starlight headings), `#d4a854` (gold accents). Cormorant Garamond serif for display, Inter light for body. Runic bands on cards, constellation motifs, Elder Futhark Unicode decorative only.
- Debug panel togglable via `?debug` param or keyboard shortcut, JSON state injection for testing specific interactions

---

## File Structure Plan

```
fate-atlas/
├── src/
│   ├── engine/
│   │   ├── types.ts              # All game types & interfaces
│   │   ├── EventBus.ts           # Typed event emitter + history log
│   │   ├── TagSystem.ts          # Tag matching, querying, evaluation
│   │   ├── AffinityEngine.ts     # Accumulate, decay, threshold checks
│   │   ├── InteractionResolver.ts # Rule matching + chain execution
│   │   ├── SynthesisEngine.ts    # Template synthesis + LLM prompt export
│   │   ├── TurnOrchestrator.ts   # Pool gen → draw → resolve → interpret
│   │   └── GameEngine.ts         # Facade: owns state, exposes public API
│   ├── data/
│   │   ├── tarot.ts              # 22 Major Arcana cards
│   │   ├── dice.ts               # d20 thresholds & interpretations
│   │   ├── iching.ts             # 64 hexagrams + 3-coin line generation
│   │   ├── happenings.ts         # 8-10 authored happenings
│   │   ├── interactions.ts       # 5 MVP interaction rules
│   │   └── affinities.ts         # Chaos & Order definitions
│   ├── components/
│   │   ├── screens/
│   │   │   ├── TitleScreen.tsx
│   │   │   ├── QuestionSelect.tsx
│   │   │   ├── DrawPhase.tsx
│   │   │   ├── InteractionOverlay.tsx
│   │   │   ├── Interpretation.tsx
│   │   │   ├── HappeningScene.tsx
│   │   │   └── ResultScreen.tsx
│   │   ├── cards/
│   │   │   ├── CardSlot.tsx       # Face-down/face-up card container
│   │   │   ├── TarotCard.tsx
│   │   │   ├── DiceCard.tsx
│   │   │   └── IChingCard.tsx
│   │   ├── overlays/
│   │   │   ├── HistoryBar.tsx     # Top bar of past readings
│   │   │   └── StarField.tsx      # Background star field
│   │   ├── debug/
│   │   │   ├── DebugPanel.tsx
│   │   │   ├── StateViewer.tsx
│   │   │   ├── JsonInjector.tsx
│   │   │   └── StepControls.tsx
│   │   └── shared/
│   │       ├── RunicBand.tsx      # Reusable runic header/footer
│   │       ├── OrnamentalBorder.tsx
│   │       └── MysticButton.tsx
│   ├── hooks/
│   │   └── useGameEngine.ts
│   ├── context/
│   │   └── EngineContext.tsx
│   ├── utils/
│   │   ├── persistence.ts
│   │   └── shareExport.ts
│   ├── styles/
│   │   └── theme.css             # CSS variables, font imports, base styles
│   ├── App.tsx
│   └── main.tsx
├── src/engine/__tests__/         # Engine unit tests (Vitest)
│   ├── EventBus.test.ts
│   ├── TagSystem.test.ts
│   ├── AffinityEngine.test.ts
│   ├── InteractionResolver.test.ts
│   ├── SynthesisEngine.test.ts
│   ├── TurnOrchestrator.test.ts
│   └── GameEngine.test.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Phase 1: Project Scaffold

### Task 1: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Test: none (scaffold verification via `npm run dev`)

**Interfaces:**
- Produces: Runnable Vite dev server with React + TypeScript

- [ ] **Step 1: Create package.json**

```json
{
  "name": "fate-atlas",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "framer-motion": "^11.0.0",
    "html2canvas": "^1.4.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/engine/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Atlas of Fate</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✧</text></svg>" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 6: Create minimal src/App.tsx**

```typescript
function App() {
  return <div>Atlas of Fate</div>;
}

export default App;
```

- [ ] **Step 7: Install dependencies and verify**

```bash
npm install
npm run dev
```

Expected: Vite dev server starts without errors, browser shows "Atlas of Fate"

- [ ] **Step 8: Install Vitest types and verify test command**

```bash
npx vitest run
```

Expected: "No test files found" (exit 0)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

## Phase 2: Engine Core Types & Event Bus

### Task 2: Define all engine types

**Files:**
- Create: `src/engine/types.ts`
- Test: none (type-only, verified by compilation)

**Interfaces:**
- Produces: All interfaces and type aliases used by every subsequent engine task

- [ ] **Step 1: Write src/engine/types.ts**

```typescript
// ── Affinities ──
export type AffinityId = 'chaos' | 'order';

export interface AffinityState {
  id: AffinityId;
  value: number; // 0.0–1.0
}

// ── Tags ──
export type Tag = string;

export interface Taggable {
  tags: Tag[];
}

// ── Question ──
export type QuestionType = 'decision' | 'relationship' | 'future' | 'self';

// ── Divination Methods ──
export type DivinationType = 'tarot' | 'd20' | 'iching' | 'happening';

// ── Divination Results ──
export interface TarotResult {
  type: 'tarot';
  id: string;
  name: string;
  number: number; // 0-21 for Major Arcana
  orientation: 'upright' | 'reversed';
  symbol: string; // Unicode symbol or emoji
  meaningUpright: string;
  meaningReversed: string;
  tags: Tag[];
}

export interface DiceResult {
  type: 'd20';
  result: number; // 1-20
  threshold: 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';
  interpretation: string;
  tags: Tag[];
}

export interface IChingResult {
  type: 'iching';
  hexagramNumber: number; // 1-64
  name: string;
  symbol: string; // Unicode hexagram symbol
  judgment: string;
  changingLines: number[]; // 0-6 line indices that are changing
  tags: Tag[];
}

export interface HappeningResult {
  type: 'happening';
  id: string;
  scene: string; // atmospheric description
  choices: HappeningChoice[];
  tags: Tag[];
}

export interface HappeningChoice {
  text: string; // the cryptic choice text shown to player
  affinityChanges: Partial<Record<AffinityId, number>>;
}

export type DivinationResult = TarotResult | DiceResult | IChingResult;

export type SlotResult = DivinationResult | HappeningResult;

// ── Events ──
export type EventType =
  | 'turn-started'
  | 'question-selected'
  | 'pool-generated'
  | 'slot-drawn'
  | 'slot-revealed'
  | 'interaction-triggered'
  | 'interaction-chain-complete'
  | 'synthesis-complete'
  | 'happening-triggered'
  | 'happening-resolved'
  | 'turn-complete'
  | 'affinity-changed'
  | 'state-loaded';

export interface GameEvent {
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

// ── Interaction Rules ──
export interface InteractionRule {
  id: string;
  trigger: {
    on: EventType;
    sourceTags: Tag[];
  };
  target: {
    tags: Tag[];
    action: 'reroll' | 'flip' | 'add-choice' | 'mirror' | 'second-result';
  };
  modifier?: {
    tags: Tag[];
    evaluate: 'contextual';
  };
  display: {
    flashSource: boolean;
    flashTarget: boolean;
    description: string;
  };
}

// ── Synthesis ──
export interface SynthesisResult {
  headline: string;
  paragraphs: string[];
  tensionNote?: string;
  affinityNote?: string;
}

// ── Run ──
export interface RunRecord {
  id: string;
  timestamp: number;
  question: QuestionType;
  slots: SlotResult[];
  interactions: InteractionEvent[];
  synthesis: SynthesisResult;
  happening?: HappeningResult;
  happeningChoice?: number; // index of chosen happening option
}

export interface InteractionEvent {
  ruleId: string;
  sourceSlotIndex: number;
  targetSlotIndex: number;
  effect: string;
  description: string;
}

// ── Engine State ──
export type Screen =
  | 'title'
  | 'question'
  | 'draw'
  | 'interaction'
  | 'interpretation'
  | 'happening'
  | 'result';

export interface GameState {
  screen: Screen;
  affinities: Record<AffinityId, number>;
  questionType: QuestionType | null;
  pool: DivinationType[];
  slots: (SlotResult | null)[];
  revealedCount: number;
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

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: define all engine types and interfaces"
```

### Task 3: Build EventBus

**Files:**
- Create: `src/engine/EventBus.ts`
- Test: `src/engine/__tests__/EventBus.test.ts`

**Interfaces:**
- Consumes: `GameEvent`, `EventType` from `types.ts`
- Produces: `EventBus` class — `emit(type, data)`, `on(type, handler): unsubscribe`, `getHistory(): GameEvent[]`, `clear()`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/EventBus.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../EventBus';

describe('EventBus', () => {
  it('emits an event and calls subscribed handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('turn-started', handler);
    bus.emit('turn-started', { question: 'decision' });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe('turn-started');
    expect(event.data).toEqual({ question: 'decision' });
    expect(event.timestamp).toBeTypeOf('number');
  });

  it('records events in history', () => {
    const bus = new EventBus();
    bus.emit('slot-drawn', { index: 0 });
    bus.emit('slot-drawn', { index: 1 });

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].data.index).toBe(0);
    expect(history[1].data.index).toBe(1);
  });

  it('returns unsubscribe function that stops handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on('affinity-changed', handler);
    bus.emit('affinity-changed', { chaos: 0.1 });
    unsubscribe();
    bus.emit('affinity-changed', { chaos: 0.2 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not throw when emitting event with no subscribers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('turn-complete', {})).not.toThrow();
  });

  it('clear() empties history', () => {
    const bus = new EventBus();
    bus.emit('turn-started', {});
    expect(bus.getHistory()).toHaveLength(1);
    bus.clear();
    expect(bus.getHistory()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/__tests__/EventBus.test.ts
```

Expected: FAIL — cannot import `EventBus`

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/EventBus.ts`:

```typescript
import type { GameEvent, EventType } from './types';

type EventHandler = (event: GameEvent) => void;

export class EventBus {
  private handlers = new Map<EventType, Set<EventHandler>>();
  private history: GameEvent[] = [];

  emit(type: EventType, data: Record<string, unknown>): void {
    const event: GameEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.history.push(event);
    const subs = this.handlers.get(type);
    if (subs) {
      subs.forEach((fn) => fn(event));
    }
  }

  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  getHistory(): GameEvent[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/engine/__tests__/EventBus.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/EventBus.ts src/engine/__tests__/EventBus.test.ts
git commit -m "feat: add EventBus with emit/subscribe/history"
```

---

## Phase 3: Tag System

### Task 4: Build TagSystem

**Files:**
- Create: `src/engine/TagSystem.ts`
- Test: `src/engine/__tests__/TagSystem.test.ts`

**Interfaces:**
- Consumes: `Taggable`, `Tag` from `types.ts`
- Produces: `TagSystem` class — `hasAllTags(entity, tags)`, `hasAnyTag(entity, tags)`, `findMatching(entities, tags, mode)`, `hasOpposingTags(a, b, opposingPairs)`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/TagSystem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TagSystem } from '../TagSystem';
import type { Taggable } from '../types';

const fool: Taggable = {
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype'],
};

const dice: Taggable = {
  tags: ['roll', 'random', 'numeric', 'threshold', 'low'],
};

const hexagram: Taggable = {
  tags: ['draw', 'random', 'binary', 'reversible'],
};

describe('TagSystem', () => {
  const system = new TagSystem();

  describe('hasAllTags', () => {
    it('returns true when entity has all specified tags', () => {
      expect(system.hasAllTags(fool, ['major-arcana', 'fool-archetype'])).toBe(true);
    });

    it('returns false when entity is missing any tag', () => {
      expect(system.hasAllTags(fool, ['major-arcana', 'numeric'])).toBe(false);
    });

    it('returns true for empty tag list', () => {
      expect(system.hasAllTags(fool, [])).toBe(true);
    });
  });

  describe('hasAnyTag', () => {
    it('returns true when entity has at least one specified tag', () => {
      expect(system.hasAnyTag(dice, ['binary', 'numeric'])).toBe(true);
    });

    it('returns false when entity has none of the specified tags', () => {
      expect(system.hasAnyTag(dice, ['binary', 'major-arcana'])).toBe(false);
    });

    it('returns false for empty tag list', () => {
      expect(system.hasAnyTag(dice, [])).toBe(false);
    });
  });

  describe('findMatching', () => {
    const entities = [fool, dice, hexagram];

    it('finds all entities matching all tags', () => {
      const result = system.findMatching(entities, ['draw', 'random'], 'all');
      expect(result).toHaveLength(2); // fool + hexagram
    });

    it('finds all entities matching any tags', () => {
      const result = system.findMatching(entities, ['numeric', 'binary'], 'any');
      expect(result).toHaveLength(2); // dice + hexagram
    });

    it('returns empty array when no match', () => {
      const result = system.findMatching(entities, ['nonexistent'], 'all');
      expect(result).toHaveLength(0);
    });
  });

  describe('hasOpposingTags', () => {
    const opposingPairs: [string, string][] = [
      ['high', 'low'],
      ['order', 'chaos'],
    ];

    it('returns true when entities have opposing tags', () => {
      const highRoll: Taggable = { tags: ['roll', 'high'] };
      const lowRoll: Taggable = { tags: ['roll', 'low'] };
      expect(system.hasOpposingTags(highRoll, lowRoll, opposingPairs)).toBe(true);
    });

    it('returns false when entities have no opposing tags', () => {
      const a: Taggable = { tags: ['draw', 'random'] };
      const b: Taggable = { tags: ['draw', 'random'] };
      expect(system.hasOpposingTags(a, b, opposingPairs)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/__tests__/TagSystem.test.ts
```

Expected: FAIL — cannot import `TagSystem`

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/TagSystem.ts`:

```typescript
import type { Taggable, Tag } from './types';

export class TagSystem {
  hasAllTags(entity: Taggable, tags: Tag[]): boolean {
    return tags.every((t) => entity.tags.includes(t));
  }

  hasAnyTag(entity: Taggable, tags: Tag[]): boolean {
    return tags.some((t) => entity.tags.includes(t));
  }

  findMatching(
    entities: Taggable[],
    tags: Tag[],
    mode: 'all' | 'any',
  ): Taggable[] {
    const check = mode === 'all' ? this.hasAllTags.bind(this) : this.hasAnyTag.bind(this);
    return entities.filter((e) => check(e, tags));
  }

  hasOpposingTags(
    a: Taggable,
    b: Taggable,
    opposingPairs: [string, string][],
  ): boolean {
    return opposingPairs.some(([t1, t2]) => {
      return (
        (a.tags.includes(t1) && b.tags.includes(t2)) ||
        (a.tags.includes(t2) && b.tags.includes(t1))
      );
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/engine/__tests__/TagSystem.test.ts
```

Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/TagSystem.ts src/engine/__tests__/TagSystem.test.ts
git commit -m "feat: add TagSystem with matching and opposing-tag detection"
```

---

## Phase 4: Game Data

### Task 5: Define tarot deck data

**Files:**
- Create: `src/data/tarot.ts`

**Interfaces:**
- Produces: `MAJOR_ARCANA: TarotCardData[]`, `drawTarotCard(affinityState): TarotResult`

```typescript
import type { TarotResult, AffinityState } from '../engine/types';

export interface TarotCardData {
  id: string;
  name: string;
  number: number;
  symbol: string;
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag: string;
}

export const MAJOR_ARCANA: TarotCardData[] = [
  { id: 'the-fool', name: 'The Fool', number: 0, symbol: '☉', meaningUpright: 'New beginnings, spontaneity, a leap of faith into the unknown', meaningReversed: 'Recklessness, hesitation, fear of the new', archetypeTag: 'fool-archetype' },
  { id: 'the-magician', name: 'The Magician', number: 1, symbol: '☿', meaningUpright: 'Willpower, mastery, manifestation of desires', meaningReversed: 'Manipulation, untapped potential, trickery', archetypeTag: 'magician-archetype' },
  { id: 'the-high-priestess', name: 'The High Priestess', number: 2, symbol: '☽', meaningUpright: 'Intuition, mystery, the subconscious mind', meaningReversed: 'Secrets revealed, disconnection from intuition', archetypeTag: 'priestess-archetype' },
  { id: 'the-empress', name: 'The Empress', number: 3, symbol: '♀', meaningUpright: 'Abundance, nurturing, connection to nature', meaningReversed: 'Dependence, creative block, neglect', archetypeTag: 'empress-archetype' },
  { id: 'the-emperor', name: 'The Emperor', number: 4, symbol: '♃', meaningUpright: 'Authority, structure, stability and control', meaningReversed: 'Tyranny, rigidity, abuse of power', archetypeTag: 'emperor-archetype' },
  { id: 'the-hierophant', name: 'The Hierophant', number: 5, symbol: '♆', meaningUpright: 'Tradition, spiritual guidance, conformity', meaningReversed: 'Rebellion, unconventionality, hypocrisy', archetypeTag: 'hierophant-archetype' },
  { id: 'the-lovers', name: 'The Lovers', number: 6, symbol: '⚤', meaningUpright: 'Love, harmony, choices and alignment', meaningReversed: 'Disharmony, imbalance, misalignment of values', archetypeTag: 'lovers-archetype' },
  { id: 'the-chariot', name: 'The Chariot', number: 7, symbol: '♈', meaningUpright: 'Determination, willpower, triumph through control', meaningReversed: 'Lack of direction, aggression, loss of control', archetypeTag: 'chariot-archetype' },
  { id: 'strength', name: 'Strength', number: 8, symbol: '♌', meaningUpright: 'Courage, inner strength, compassion over force', meaningReversed: 'Self-doubt, weakness, insecurity', archetypeTag: 'strength-archetype' },
  { id: 'the-hermit', name: 'The Hermit', number: 9, symbol: '♍', meaningUpright: 'Solitude, introspection, seeking inner truth', meaningReversed: 'Isolation, loneliness, withdrawal from life', archetypeTag: 'hermit-archetype' },
  { id: 'wheel-of-fortune', name: 'Wheel of Fortune', number: 10, symbol: '☸', meaningUpright: 'Change, cycles, destiny and turning points', meaningReversed: 'Bad luck, resistance to change, setbacks', archetypeTag: 'fortune-archetype' },
  { id: 'justice', name: 'Justice', number: 11, symbol: '♎', meaningUpright: 'Fairness, truth, consequence and clarity', meaningReversed: 'Injustice, dishonesty, lack of accountability', archetypeTag: 'justice-archetype' },
  { id: 'the-hanged-man', name: 'The Hanged Man', number: 12, symbol: '♓', meaningUpright: 'Surrender, new perspective, letting go', meaningReversed: 'Stalling, resistance, refusal to see', archetypeTag: 'hanged-archetype' },
  { id: 'death', name: 'Death', number: 13, symbol: '♏', meaningUpright: 'Transformation, endings, inevitable change', meaningReversed: 'Stagnation, fear of change, holding on', archetypeTag: 'death-archetype' },
  { id: 'temperance', name: 'Temperance', number: 14, symbol: '♐', meaningUpright: 'Balance, moderation, patience and purpose', meaningReversed: 'Excess, imbalance, lack of harmony', archetypeTag: 'temperance-archetype' },
  { id: 'the-devil', name: 'The Devil', number: 15, symbol: '♑', meaningUpright: 'Bondage, materialism, facing oneʼs shadow', meaningReversed: 'Release, breaking free, reclaiming power', archetypeTag: 'devil-archetype' },
  { id: 'the-tower', name: 'The Tower', number: 16, symbol: '♇', meaningUpright: 'Upheaval, sudden change, revelation through destruction', meaningReversed: 'Averting disaster, fear of change, delayed collapse', archetypeTag: 'tower-archetype' },
  { id: 'the-star', name: 'The Star', number: 17, symbol: '⭐', meaningUpright: 'Hope, renewal, faith in the future', meaningReversed: 'Despair, disconnection, lack of faith', archetypeTag: 'star-archetype' },
  { id: 'the-moon', name: 'The Moon', number: 18, symbol: '☾', meaningUpright: 'Illusion, the unconscious, navigating uncertainty', meaningReversed: 'Clarity emerging, fear dispelled, truths revealed', archetypeTag: 'moon-archetype' },
  { id: 'the-sun', name: 'The Sun', number: 19, symbol: '☀', meaningUpright: 'Joy, success, vitality and enlightenment', meaningReversed: 'Temporary setbacks, diminished joy, blocked success', archetypeTag: 'sun-archetype' },
  { id: 'judgement', name: 'Judgement', number: 20, symbol: '♒', meaningUpright: 'Rebirth, inner calling, absolution and awakening', meaningReversed: 'Self-doubt, refusal of the call, guilt', archetypeTag: 'judgement-archetype' },
  { id: 'the-world', name: 'The World', number: 21, symbol: '♾', meaningUpright: 'Completion, fulfillment, wholeness and achievement', meaningReversed: 'Incompletion, lack of closure, delays in fulfillment', archetypeTag: 'world-archetype' },
];

export function drawTarotCard(affinities: Record<string, number>): TarotResult {
  const index = Math.floor(Math.random() * MAJOR_ARCANA.length);
  const card = MAJOR_ARCANA[index];

  // Chaos affinity increases chance of reversal
  const reversalChance = 0.5 + (affinities.chaos ?? 0) * 0.3;
  // Order affinity decreases reversal chance
  const orderMod = (affinities.order ?? 0) * 0.2;
  const finalChance = Math.max(0.1, Math.min(0.9, reversalChance - orderMod));
  const orientation = Math.random() < finalChance ? 'reversed' : 'upright';

  const tags: string[] = [
    'draw', 'random', 'major-arcana', 'reversible',
    card.archetypeTag,
    orientation === 'reversed' ? 'reversed' : 'upright',
  ];

  return {
    type: 'tarot',
    id: card.id,
    name: card.name,
    number: card.number,
    orientation,
    symbol: card.symbol,
    meaningUpright: card.meaningUpright,
    meaningReversed: card.meaningReversed,
    tags,
  };
}
```

- [ ] **Step 1: Write the test**

Create test alongside: (since tarot is data + simple logic, we test `drawTarotCard`)

Create `src/engine/__tests__/Tarot.test.ts` (test file placed with engine tests):

```typescript
import { describe, it, expect } from 'vitest';
import { drawTarotCard, MAJOR_ARCANA } from '../../data/tarot';
import type { TarotResult } from '../types';

describe('tarot data', () => {
  it('has 22 Major Arcana cards', () => {
    expect(MAJOR_ARCANA).toHaveLength(22);
  });

  it('each card has required fields', () => {
    for (const card of MAJOR_ARCANA) {
      expect(card.id).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.number).toBeGreaterThanOrEqual(0);
      expect(card.number).toBeLessThanOrEqual(21);
    }
  });

  it('all card ids are unique', () => {
    const ids = MAJOR_ARCANA.map((c) => c.id);
    expect(new Set(ids).size).toBe(22);
  });
});

describe('drawTarotCard', () => {
  it('returns a valid TarotResult', () => {
    const result = drawTarotCard({ chaos: 0, order: 0 });
    expect(result.type).toBe('tarot');
    expect(result.tags).toContain('draw');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('major-arcana');
    expect(result.tags).toContain('reversible');
    expect(['upright', 'reversed']).toContain(result.orientation);
  });

  it('high chaos increases reversal probability', () => {
    let reversals = 0;
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      const result = drawTarotCard({ chaos: 0.9, order: 0 });
      if (result.orientation === 'reversed') reversals++;
    }
    // With chaos at 0.9, reversal chance ≈ 0.5 + 0.27 = 0.77
    expect(reversals).toBeGreaterThan(iterations * 0.6);
  });

  it('high order decreases reversal probability', () => {
    let reversals = 0;
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      const result = drawTarotCard({ chaos: 0, order: 0.9 });
      if (result.orientation === 'reversed') reversals++;
    }
    // Order 0.9 gives -0.18 mod, so chance ≈ 0.32, but clamped to 0.1 min
    expect(reversals).toBeLessThan(iterations * 0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** (file doesn't exist yet)

```bash
npx vitest run src/engine/__tests__/Tarot.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the data file** (content shown above in Step 1)

Write `src/data/tarot.ts` with the code shown above.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/engine/__tests__/Tarot.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat: add 22 Major Arcana tarot deck with draw logic"
```

### Task 6: Define dice data

**Files:**
- Create: `src/data/dice.ts`
- Test: `src/engine/__tests__/Dice.test.ts`

**Interfaces:**
- Produces: `rollD20(affinities): DiceResult`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/Dice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rollD20, getThreshold } from '../../data/dice';

describe('rollD20', () => {
  it('returns a valid DiceResult', () => {
    const result = rollD20({ chaos: 0, order: 0 });
    expect(result.type).toBe('d20');
    expect(result.result).toBeGreaterThanOrEqual(1);
    expect(result.result).toBeLessThanOrEqual(20);
    expect(result.tags).toContain('roll');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('numeric');
    expect(result.tags).toContain('threshold');
    expect(['critical-low', 'low', 'neutral', 'high', 'critical-high']).toContain(result.threshold);
  });

  it('result 1-5 is critical-low', () => {
    // Mock Math.random to return 0 → roll of 1
    const orig = Math.random;
    Math.random = () => 0;
    const result = rollD20({ chaos: 0, order: 0 });
    Math.random = orig;
    expect(result.threshold).toBe('critical-low');
    expect(result.tags).toContain('low');
  });

  it('result 17-20 is critical-high', () => {
    const orig = Math.random;
    Math.random = () => 0.95; // roll of 20
    const result = rollD20({ chaos: 0, order: 0 });
    Math.random = orig;
    expect(result.threshold).toBe('critical-high');
    expect(result.tags).toContain('high');
  });
});

describe('getThreshold', () => {
  it('classifies correctly', () => {
    expect(getThreshold(1)).toBe('critical-low');
    expect(getThreshold(8)).toBe('low');
    expect(getThreshold(10)).toBe('neutral');
    expect(getThreshold(14)).toBe('high');
    expect(getThreshold(19)).toBe('critical-high');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/__tests__/Dice.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/data/dice.ts`:

```typescript
import type { DiceResult } from '../engine/types';

export type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';

const THRESHOLD_INTERPRETATIONS: Record<Threshold, string> = {
  'critical-low': 'The odds are starkly against you — patience is counseled above all.',
  'low': 'The currents run against favorable winds. Proceed with measured steps.',
  'neutral': 'The balance holds, neither for nor against. The choice remains truly yours.',
  'high': 'Fortune inclines toward you. The path ahead bears promise.',
  'critical-high': 'The stars align decisively in your favor. A rare and potent moment.',
};

export function getThreshold(value: number): Threshold {
  if (value <= 5) return 'critical-low';
  if (value <= 9) return 'low';
  if (value <= 11) return 'neutral';
  if (value <= 16) return 'high';
  return 'critical-high';
}

export function rollD20(affinities: Record<string, number>): DiceResult {
  // Order affinity pulls result toward the middle (10-11)
  // Chaos pushes toward extremes
  let roll = Math.floor(Math.random() * 20) + 1;

  const chaosInfluence = (affinities.chaos ?? 0) * 4; // up to ±4
  const orderInfluence = (affinities.order ?? 0) * 3; // pull toward 10.5

  if (chaosInfluence > 0 && Math.random() < chaosInfluence / 10) {
    // Chaos: push toward extreme
    roll = roll <= 10 ? Math.max(1, roll - Math.ceil(chaosInfluence)) : Math.min(20, roll + Math.ceil(chaosInfluence));
  }
  if (orderInfluence > 0 && Math.random() < orderInfluence / 10) {
    // Order: pull toward center
    const center = 10.5;
    roll = Math.round(roll + (center - roll) * (orderInfluence / 10));
    roll = Math.max(1, Math.min(20, roll));
  }

  const threshold = getThreshold(roll);

  return {
    type: 'd20',
    result: roll,
    threshold,
    interpretation: THRESHOLD_INTERPRETATIONS[threshold],
    tags: ['roll', 'random', 'numeric', 'threshold', threshold.includes('low') ? 'low' : threshold.includes('high') ? 'high' : 'neutral'],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/engine/__tests__/Dice.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/dice.ts src/engine/__tests__/Dice.test.ts
git commit -m "feat: add d20 dice roll with threshold classification"
```

### Task 7: Define I Ching data

**Files:**
- Create: `src/data/iching.ts`
- Test: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Produces: `castHexagram(): IChingResult`

- [ ] **Step 1: Write test then data file**

Create `src/engine/__tests__/IChing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { castHexagram, HEXAGRAMS } from '../../data/iching';

describe('I Ching data', () => {
  it('has 64 hexagrams', () => {
    expect(HEXAGRAMS).toHaveLength(64);
  });

  it('each hexagram has required fields', () => {
    for (const h of HEXAGRAMS) {
      expect(h.number).toBeGreaterThanOrEqual(1);
      expect(h.number).toBeLessThanOrEqual(64);
      expect(h.name).toBeTruthy();
      expect(h.symbol).toBeTruthy();
      expect(h.judgment).toBeTruthy();
    }
  });

  it('all hexagram numbers are unique', () => {
    const numbers = HEXAGRAMS.map((h) => h.number);
    expect(new Set(numbers).size).toBe(64);
  });
});

describe('castHexagram', () => {
  it('returns a valid IChingResult', () => {
    const result = castHexagram({ chaos: 0, order: 0 });
    expect(result.type).toBe('iching');
    expect(result.hexagramNumber).toBeGreaterThanOrEqual(1);
    expect(result.hexagramNumber).toBeLessThanOrEqual(64);
    expect(result.tags).toContain('draw');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('binary');
    expect(result.changingLines.length).toBeGreaterThanOrEqual(0);
    expect(result.changingLines.length).toBeLessThanOrEqual(6);
  });

  it('includes [reversible] tag when there are changing lines', () => {
    let hadChanging = false;
    for (let i = 0; i < 50; i++) {
      const result = castHexagram({ chaos: 0.5, order: 0 });
      if (result.changingLines.length > 0) {
        hadChanging = true;
        expect(result.tags).toContain('reversible');
        break;
      }
    }
    // Should find at least one with changing lines in 50 attempts
    expect(hadChanging).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**, then create `src/data/iching.ts`:

```typescript
import type { IChingResult } from '../engine/types';

export interface HexagramData {
  number: number;
  name: string;
  symbol: string;
  judgment: string;
}

// Abbreviated to first 16 for plan conciseness — full 64 in actual file
export const HEXAGRAMS: HexagramData[] = [
  { number: 1, name: 'The Creative', symbol: '䷀', judgment: 'The creative principle brings success through perseverance. Sublime and initiative.' },
  { number: 2, name: 'The Receptive', symbol: '䷁', judgment: 'The receptive brings supreme success through devotion to what is right.' },
  { number: 3, name: 'Difficulty at the Beginning', symbol: '䷂', judgment: 'Initial challenges bring growth. Perseverance furthers.' },
  { number: 4, name: 'Youthful Folly', symbol: '䷃', judgment: 'The inexperienced must seek guidance. It is not the teacher who seeks the student.' },
  { number: 5, name: 'Waiting', symbol: '䷄', judgment: 'Patience and sincere waiting bring success. The timing is not yet ripe.' },
  { number: 6, name: 'Conflict', symbol: '䷅', judgment: 'Conflict arises when truth is contested. Seek impartial resolution.' },
  { number: 7, name: 'The Army', symbol: '䷆', judgment: 'Disciplined collective action brings success. Leadership is required.' },
  { number: 8, name: 'Holding Together', symbol: '䷇', judgment: 'Union and cohesion bring strength. Those uncertain will find their way.' },
  { number: 9, name: 'Small Taming', symbol: '䷈', judgment: 'Gentle restraint yields progress. Small forces shape great outcomes.' },
  { number: 10, name: 'Treading', symbol: '䷉', judgment: 'Conduct yourself with care. Even dangerous paths can be walked safely.' },
  { number: 11, name: 'Peace', symbol: '䷊', judgment: 'Harmony between heaven and earth. The small departs, the great approaches.' },
  { number: 12, name: 'Standstill', symbol: '䷋', judgment: 'Stagnation and blockage. The great departs, the small approaches. Endure.' },
  { number: 13, name: 'Fellowship', symbol: '䷌', judgment: 'Community and shared purpose bring clarity. Openness unites.' },
  { number: 14, name: 'Great Possession', symbol: '䷍', judgment: 'Abundance in harmony. Generosity ensures continued prosperity.' },
  { number: 15, name: 'Modesty', symbol: '䷎', judgment: 'Humility elevates. The modest are carried forward by the flow of things.' },
  { number: 16, name: 'Enthusiasm', symbol: '䷏', judgment: 'Enthusiastic movement inspires others. But enthusiasm must be grounded.' },
  // ... (plan continues with full 64 in implementation)
];

export function castHexagram(affinities: Record<string, number>): IChingResult {
  // 3-coin method: 3 coins flipped 6 times
  // Each flip: heads=3, tails=2 → sum 6,7,8,9
  // 6 (old yin, changing), 7 (young yang, stable), 8 (young yin, stable), 9 (old yang, changing)
  const changingLines: number[] = [];

  // Chaos increases chance of changing lines
  const changingBias = (affinities.chaos ?? 0) * 0.2;

  for (let line = 0; line < 6; line++) {
    let sum = 0;
    for (let coin = 0; coin < 3; coin++) {
      sum += Math.random() < 0.5 ? 2 : 3;
    }
    // With chaos bias, push toward changing values (6 or 9)
    if (Math.random() < changingBias && (sum === 7 || sum === 8)) {
      sum = sum === 7 ? 6 : 9;
    }
    if (sum === 6 || sum === 9) {
      changingLines.push(line + 1); // 1-indexed lines
    }
  }

  const hexagramIndex = Math.floor(Math.random() * 64);
  const hexagram = HEXAGRAMS[hexagramIndex];

  const tags: string[] = ['draw', 'random', 'binary'];
  if (changingLines.length > 0) {
    tags.push('reversible', 'changing-lines');
  }

  return {
    type: 'iching',
    hexagramNumber: hexagram.number,
    name: hexagram.name,
    symbol: hexagram.symbol,
    judgment: hexagram.judgment,
    changingLines,
    tags,
  };
}
```

- [ ] **Step 3: Run test to verify**

```bash
npx vitest run src/engine/__tests__/IChing.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/iching.ts src/engine/__tests__/IChing.test.ts
git commit -m "feat: add I Ching 64 hexagrams with 3-coin casting method"
```

### Task 8: Define happenings and affinities data

**Files:**
- Create: `src/data/happenings.ts`, `src/data/affinities.ts`
- Test: name resolution and shape verification embedded in engine tests

**Interfaces:**
- Produces: `HAPPENINGS: HappeningData[]`, `ChaosAffinity` and `OrderAffinity` configs

- [ ] **Step 1: Create src/data/happenings.ts**

```typescript
import type { HappeningResult } from '../engine/types';

export interface HappeningData {
  id: string;
  scene: string;
  choices: { text: string; affinityChanges: Partial<Record<string, number>> }[];
  tags: string[];
}

export const HAPPENINGS: HappeningData[] = [
  {
    id: 'crossroads',
    scene: 'A path splits before you beneath the star-field. One fork gleams with known light, the other vanishes into shadowed constellations.',
    choices: [
      { text: 'Take the gleaming path — it feels certain.', affinityChanges: { order: 0.08 } },
      { text: 'Step into the shadowed stars — uncertainty calls.', affinityChanges: { chaos: 0.08 } },
      { text: 'Sit at the crossroads and wait for a sign.', affinityChanges: { order: 0.04, chaos: 0.04 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'falling-star',
    scene: 'A star tears across the sky, brilliant and brief. In its trail, a silence settles — the kind that asks a question.',
    choices: [
      { text: 'Make a wish upon the falling light.', affinityChanges: { chaos: 0.1 } },
      { text: 'Observe its trajectory — seek the pattern.', affinityChanges: { order: 0.1 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'veiled-moon',
    scene: 'A veil of cloud drifts across the moon. Shapes form and dissolve — some feel like omens, others like memories.',
    choices: [
      { text: 'Read the shapes as portents — they must mean something.', affinityChanges: { chaos: 0.06 } },
      { text: 'Let them pass — clouds are only clouds.', affinityChanges: { order: 0.06 } },
      { text: 'Draw the shapes in the dust, fixing them in place.', affinityChanges: { order: 0.03, chaos: 0.03 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'whispering-thread',
    scene: 'A thread of starlight seems to whisper at the edge of hearing. Words form just beyond comprehension, promising secrets.',
    choices: [
      { text: 'Lean in — strain to hear the whispered truth.', affinityChanges: { chaos: 0.07 } },
      { text: 'Step back — some knowledge is not meant for you.', affinityChanges: { order: 0.07 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'convergence',
    scene: 'Three constellations drift toward alignment above you. The ancients called this a moment when the veil wears thin.',
    choices: [
      { text: 'Align yourself with the convergence — become part of the pattern.', affinityChanges: { order: 0.09 } },
      { text: 'Stand at an angle to it — see what the pattern hides.', affinityChanges: { chaos: 0.09 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'echo-of-past-reading',
    scene: 'The echo of a past divination resurfaces — a card, a number, a symbol — asking to be reconsidered.',
    choices: [
      { text: 'Reinterpret the past — its meaning may have changed.', affinityChanges: { chaos: 0.05 } },
      { text: 'Acknowledge and release — the past is settled.', affinityChanges: { order: 0.05 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'dark-constellation',
    scene: 'A gap in the stars catches your eye — not empty, but dark. A constellation made of absence rather than light.',
    choices: [
      { text: 'Study the negative space — what is missing matters.', affinityChanges: { order: 0.06 } },
      { text: 'Fill the void with your own pattern — create meaning.', affinityChanges: { chaos: 0.06 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
  {
    id: 'many-threads',
    scene: 'Countless threads of fate shimmer into view, each one a path not taken. The weave is impossibly complex.',
    choices: [
      { text: 'Trace one thread backward — understand what shaped it.', affinityChanges: { order: 0.07 } },
      { text: 'Pluck a thread and see what unravels — test the weave.', affinityChanges: { chaos: 0.07 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
  },
];

export function selectHappening(
  excludeIds: string[],
  chaosAffinity: number,
): HappeningData {
  const available = HAPPENINGS.filter((h) => !excludeIds.includes(h.id));
  // High chaos slightly weights toward happenings with more choices
  const weighted = available.map((h) => ({
    happening: h,
    weight: 1 + (h.choices.length > 2 ? chaosAffinity : 0),
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.happening;
  }
  return weighted[weighted.length - 1].happening;
}
```

- [ ] **Step 2: Create src/data/affinities.ts**

```typescript
import type { AffinityId } from '../engine/types';

export interface AffinityDefinition {
  id: AffinityId;
  name: string;
  description: string;
  accumulateFrom: string[]; // tags that increase this affinity
  dominantThreshold: number; // value at which effects kick in
  dominantHints: string[]; // flavor text shown when dominant
  effects: {
    description: string;
    magnitude: string; // for tooltip/debug
  }[];
}

export const CHAOS_AFFINITY: AffinityDefinition = {
  id: 'chaos',
  name: 'Chaos',
  description: 'Fueled by randomness, reversals, and changing patterns. Makes outcomes more volatile and unpredictable.',
  accumulateFrom: ['random', 'reversed', 'changing-lines'],
  dominantThreshold: 0.5,
  dominantHints: [
    'The air feels charged with unpredictability...',
    'The stars shift restlessly above...',
  ],
  effects: [
    { description: 'Increased chance of wild modifiers', magnitude: 'moderate' },
    { description: 'Interaction chains more likely', magnitude: 'significant' },
    { description: 'Happenings appear more often', magnitude: 'moderate' },
  ],
};

export const ORDER_AFFINITY: AffinityDefinition = {
  id: 'order',
  name: 'Order',
  description: 'Grows through stable results and measured choices. Steadies outcomes and brings clarity.',
  accumulateFrom: ['upright', 'neutral', 'stable'],
  dominantThreshold: 0.5,
  dominantHints: [
    'Patterns align with unusual clarity...',
    'A sense of steady purpose settles over the reading...',
  ],
  effects: [
    { description: 'Reduced chance of negative reversals', magnitude: 'moderate' },
    { description: 'Results lean toward balanced outcomes', magnitude: 'significant' },
    { description: 'Extra clarity in interpretation', magnitude: 'moderate' },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/data/happenings.ts src/data/affinities.ts
git commit -m "feat: add 8 happenings and Chaos/Order affinity definitions"
```

### Task 9: Define interaction rules data

**Files:**
- Create: `src/data/interactions.ts`

**Interfaces:**
- Produces: `INTERACTION_RULES: InteractionRule[]` (5 MVP rules)

- [ ] **Step 1: Create src/data/interactions.ts**

```typescript
import type { InteractionRule } from '../engine/types';

export const INTERACTION_RULES: InteractionRule[] = [
  {
    id: 'fool-reroll',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['major-arcana', 'fool-archetype'],
    },
    target: {
      tags: ['roll', 'pending'],
      action: 'reroll',
    },
    modifier: {
      tags: ['reversed', 'upright'],
      evaluate: 'contextual',
    },
    display: {
      flashSource: true,
      flashTarget: true,
      description: "The Fool's wild energy ripples through fate — the dice must be cast again.",
    },
  },
  {
    id: 'critical-low-flip',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['critical-low', 'threshold'],
    },
    target: {
      tags: ['major-arcana', 'reversible'],
      action: 'flip',
    },
    display: {
      flashSource: true,
      flashTarget: true,
      description: 'A dire omen from the dice — the cards tremble and turn.',
    },
  },
  {
    id: 'iching-happening-boost',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['iching', 'changing-lines'],
    },
    target: {
      tags: ['event', 'happening'],
      action: 'add-choice',
    },
    display: {
      flashSource: true,
      flashTarget: false,
      description: 'The changing lines reveal hidden branches — more choices emerge.',
    },
  },
  {
    id: 'mirror-event',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['reversible'],
    },
    target: {
      tags: ['reversible'],
      action: 'mirror',
    },
    display: {
      flashSource: true,
      flashTarget: true,
      description: 'Two forces reflect each other across the weave — both turn.',
    },
  },
  {
    id: 'chaos-second-result',
    trigger: {
      on: 'slot-revealed',
      sourceTags: ['chaos-dominant'], // injected by engine when chaos ≥ 0.5
    },
    target: {
      tags: ['random'],
      action: 'second-result',
    },
    display: {
      flashSource: false,
      flashTarget: true,
      description: 'Chaos surges — a second possibility emerges from the void.',
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/interactions.ts
git commit -m "feat: add 5 MVP interaction rules (fool-reroll, critical-flip, iching-boost, mirror, chaos-second)"
```

---

## Phase 5: Affinity Engine

### Task 10: Build AffinityEngine

**Files:**
- Create: `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/AffinityEngine.test.ts`

**Interfaces:**
- Consumes: `AffinityState`, `AffinityId`, `Taggable`, `AffinityDefinition` from types/data
- Produces: `AffinityEngine` class — `apply(result, definitions)`, `isDominant(id)`, `getHint(id)`, `getState()`, `setState(state)`, `serialize()`, `deserialize(json)`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AffinityEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { CHAOS_AFFINITY, ORDER_AFFINITY } from '../../data/affinities';
import type { TarotResult } from '../types';

const definitions = [CHAOS_AFFINITY, ORDER_AFFINITY];

const reversedCard: TarotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'reversed', symbol: '☉',
  meaningUpright: '...', meaningReversed: '...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'reversed'],
};

const uprightCard: TarotResult = {
  type: 'tarot', id: 'the-star', name: 'The Star', number: 17,
  orientation: 'upright', symbol: '⭐',
  meaningUpright: 'Hope...', meaningReversed: 'Despair...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'star-archetype', 'upright'],
};

describe('AffinityEngine', () => {
  it('starts with both affinities at 0.5', () => {
    const engine = new AffinityEngine(definitions);
    const state = engine.getState();
    expect(state.chaos).toBe(0.5);
    expect(state.order).toBe(0.5);
  });

  it('apply() increases chaos for reversed/random results', () => {
    const engine = new AffinityEngine(definitions);
    engine.apply([reversedCard]);
    expect(engine.getState().chaos).toBeGreaterThan(0.5);
  });

  it('apply() increases order for upright/stable results', () => {
    const engine = new AffinityEngine(definitions);
    engine.apply([uprightCard]);
    expect(engine.getState().order).toBeGreaterThan(0.5);
  });

  it('clamps values to 0.0–1.0', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.99, order: 0.01 });
    engine.apply([reversedCard]); // chaos should not exceed 1.0
    engine.apply([reversedCard]);
    expect(engine.getState().chaos).toBeLessThanOrEqual(1.0);
  });

  it('isDominant() returns true when affinity ≥ threshold', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.6, order: 0.3 });
    expect(engine.isDominant('chaos')).toBe(true);
    expect(engine.isDominant('order')).toBe(false);
  });

  it('getHint() returns flavor text for dominant affinity', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.6, order: 0.3 });
    expect(engine.getHint('chaos')).toBeTruthy();
    expect(engine.getHint('order')).toBeNull();
  });

  it('serialize() and loadFrom() round-trip', () => {
    const engine = new AffinityEngine(definitions);
    engine.setState({ chaos: 0.7, order: 0.3 });
    const json = engine.serialize();

    const engine2 = new AffinityEngine(definitions);
    engine2.loadFrom(json);
    expect(engine2.getState()).toEqual({ chaos: 0.7, order: 0.3 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/engine/__tests__/AffinityEngine.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/engine/AffinityEngine.ts`:

```typescript
import type { AffinityId, Taggable } from './types';
import type { AffinityDefinition } from '../data/affinities';

const DEFAULT_VALUE = 0.5;
const CHANGE_PER_MATCH = 0.05;

export class AffinityEngine {
  private state: Record<string, number> = {};
  private definitions: AffinityDefinition[];

  constructor(definitions: AffinityDefinition[]) {
    this.definitions = definitions;
    for (const def of definitions) {
      this.state[def.id] = DEFAULT_VALUE;
    }
  }

  apply(results: Taggable[]): void {
    for (const def of this.definitions) {
      let delta = 0;
      for (const result of results) {
        const matches = def.accumulateFrom.filter((tag) => result.tags.includes(tag)).length;
        delta += matches * CHANGE_PER_MATCH;
      }
      this.state[def.id] = this.clamp(this.state[def.id] + delta);
    }
  }

  isDominant(id: AffinityId): boolean {
    const def = this.definitions.find((d) => d.id === id);
    if (!def) return false;
    return this.state[id] >= def.dominantThreshold;
  }

  getHint(id: AffinityId): string | null {
    if (!this.isDominant(id)) return null;
    const def = this.definitions.find((d) => d.id === id);
    if (!def || !def.dominantHints.length) return null;
    return def.dominantHints[Math.floor(Math.random() * def.dominantHints.length)];
  }

  getState(): Record<AffinityId, number> {
    return { ...this.state } as Record<AffinityId, number>;
  }

  setState(values: Record<AffinityId, number>): void {
    for (const [id, val] of Object.entries(values)) {
      this.state[id] = this.clamp(val);
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  loadFrom(json: string): void {
    const parsed = JSON.parse(json);
    for (const [id, val] of Object.entries(parsed)) {
      if (typeof val === 'number') {
        this.state[id] = this.clamp(val);
      }
    }
  }

  private clamp(value: number): number {
    return Math.max(0.0, Math.min(1.0, Math.round(value * 100) / 100));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/engine/__tests__/AffinityEngine.test.ts
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/AffinityEngine.ts src/engine/__tests__/AffinityEngine.test.ts
git commit -m "feat: add AffinityEngine with accumulate, dominance checks, hints, and serialization"
```

---

## Phase 6: Turn Orchestrator

### Task 11: Build TurnOrchestrator

**Files:**
- Create: `src/engine/TurnOrchestrator.ts`
- Test: `src/engine/__tests__/TurnOrchestrator.test.ts`

**Interfaces:**
- Consumes: `TagSystem`, `AffinityEngine`, event bus, all data modules
- Produces: `TurnOrchestrator` — `generatePool(question)`, `drawSlot(index)`, `revealSlot(index)`, `getSlots()`, `getPool()`

- [ ] **Step 1: Write test**

Create `src/engine/__tests__/TurnOrchestrator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TurnOrchestrator } from '../TurnOrchestrator';
import { TagSystem } from '../TagSystem';
import { EventBus } from '../EventBus';

describe('TurnOrchestrator', () => {
  const tagSystem = new TagSystem();
  const bus = new EventBus();
  const affinities = { chaos: 0.5, order: 0.5 };

  it('generates a pool of 3+ divination types', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    const pool = orchestrator.generatePool('decision', affinities);
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(pool.every((t) => ['tarot', 'd20', 'iching', 'happening'].includes(t))).toBe(true);
  });

  it('decision question favors d20', () => {
    let d20Count = 0;
    for (let i = 0; i < 100; i++) {
      const orchestrator = new TurnOrchestrator(tagSystem, bus);
      const pool = orchestrator.generatePool('decision', affinities);
      if (pool.includes('d20')) d20Count++;
    }
    expect(d20Count).toBeGreaterThan(50); // d20 should appear most of the time
  });

  it('draws 3 slots from the pool', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    orchestrator.generatePool('self', affinities);
    for (let i = 0; i < 3; i++) {
      orchestrator.drawSlot(i, affinities);
    }
    const slots = orchestrator.getSlots();
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s !== null)).toBe(true);
  });

  it('revealSlot marks a slot as revealed', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    orchestrator.generatePool('self', affinities);
    orchestrator.drawSlot(0, affinities);
    orchestrator.revealSlot(0);
    // Reveal should have emitted a slot-revealed event
    const history = bus.getHistory();
    const revealEvents = history.filter((e) => e.type === 'slot-revealed');
    expect(revealEvents.length).toBe(1);
  });

  it('throws if drawing beyond pool size', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    orchestrator.generatePool('self', affinities);
    expect(() => orchestrator.drawSlot(5, affinities)).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/engine/__tests__/TurnOrchestrator.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/engine/TurnOrchestrator.ts`:

```typescript
import type { DivinationType, QuestionType, SlotResult } from './types';
import type { TagSystem } from './TagSystem';
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
  private pool: DivinationType[] = [];
  private slots: (SlotResult | null)[] = [];

  constructor(
    private tagSystem: TagSystem,
    private bus: EventBus,
  ) {}

  generatePool(
    question: QuestionType,
    affinities: Record<string, number>,
  ): DivinationType[] {
    this.pool = [];
    this.slots = [];
    const weights = QUESTION_WEIGHTS[question];

    // Build weighted list
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

    while (this.pool.length < POOL_SIZE) {
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          this.pool.push(entry.type);
          break;
        }
      }
    }

    this.bus.emit('pool-generated', {
      question,
      pool: [...this.pool],
    });

    return [...this.pool];
  }

  drawSlot(index: number, affinities: Record<string, number>): SlotResult {
    if (index >= this.pool.length) {
      throw new Error(`Slot ${index} out of bounds (pool size ${this.pool.length})`);
    }
    const type = this.pool[index];
    let result: SlotResult;

    switch (type) {
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
        // Happenings are drawn during the happenings phase, not during draw phase
        // Return null-like placeholder that gets resolved later
        result = {
          type: 'happening',
          id: 'pending',
          scene: '',
          choices: [],
          tags: ['event', 'pending', 'happening', 'choice', 'affinity-shift'],
        } as SlotResult; // Will be replaced during happening phase
        break;
      default:
        throw new Error(`Unknown divination type: ${type}`);
    }

    this.slots[index] = result;
    this.bus.emit('slot-drawn', { index, type: result.type });

    return result;
  }

  revealSlot(index: number): SlotResult {
    const result = this.slots[index];
    if (!result) {
      throw new Error(`Slot ${index} not yet drawn`);
    }
    this.bus.emit('slot-revealed', {
      index,
      type: result.type,
      tags: (result as { tags?: string[] }).tags ?? [],
      result,
    });
    return result;
  }

  getSlots(): (SlotResult | null)[] {
    return [...this.slots];
  }

  getPool(): DivinationType[] {
    return [...this.pool];
  }
}
```

- [ ] **Step 4: Run test to verify**

```bash
npx vitest run src/engine/__tests__/TurnOrchestrator.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/TurnOrchestrator.ts src/engine/__tests__/TurnOrchestrator.test.ts
git commit -m "feat: add TurnOrchestrator with weighted pool generation and slot drawing"
```

---

## Phase 7: Interaction Resolver

### Task 12: Build InteractionResolver

**Files:**
- Create: `src/engine/InteractionResolver.ts`
- Test: `src/engine/__tests__/InteractionResolver.test.ts`

**Interfaces:**
- Consumes: `TagSystem`, `EventBus`, `InteractionRule`, `SlotResult`
- Produces: `InteractionResolver` — `checkAndResolve(slots, revealedIndex, affinities, rules): InteractionEvent[]`

- [ ] **Step 1: Write test**

Create `src/engine/__tests__/InteractionResolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { InteractionResolver } from '../InteractionResolver';
import { TagSystem } from '../TagSystem';
import { EventBus } from '../EventBus';
import { INTERACTION_RULES } from '../../data/interactions';
import type { SlotResult } from '../types';

const foolCard: SlotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'upright', symbol: '☉',
  meaningUpright: '...', meaningReversed: '...',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'upright'],
};

const diceRoll: SlotResult = {
  type: 'd20', result: 3, threshold: 'critical-low',
  interpretation: '...',
  tags: ['roll', 'random', 'numeric', 'threshold', 'low', 'critical-low', 'pending'],
};

const ichingHex: SlotResult = {
  type: 'iching', hexagramNumber: 27, name: 'Nourishment',
  symbol: '䷛', judgment: '...', changingLines: [3, 5],
  tags: ['draw', 'random', 'binary', 'reversible', 'changing-lines'],
};

describe('InteractionResolver', () => {
  const tagSystem = new TagSystem();
  const bus = new EventBus();

  it('triggers fool-reroll when Fool is revealed and pending dice exists', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const slots: (SlotResult | null)[] = [foolCard, diceRoll, null];

    const events = resolver.checkAndResolve(slots, 0, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);

    const rerollEvent = events.find((e) => e.ruleId === 'fool-reroll');
    expect(rerollEvent).toBeTruthy();
    expect(rerollEvent!.targetSlotIndex).toBe(1);
  });

  it('triggers critical-low-flip when low dice is revealed and reversible tarot exists', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const slots: (SlotResult | null)[] = [foolCard, diceRoll, null];

    const events = resolver.checkAndResolve(slots, 1, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);

    const flipEvent = events.find((e) => e.ruleId === 'critical-low-flip');
    expect(flipEvent).toBeTruthy();
    expect(flipEvent!.targetSlotIndex).toBe(0);
  });

  it('triggers iching-happening-boost when iching with changing lines is revealed', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const happeningSlot: SlotResult = {
      type: 'happening', id: 'crossroads', scene: '...', choices: [],
      tags: ['event', 'happening', 'choice', 'affinity-shift', 'pending'],
    };
    const slots: (SlotResult | null)[] = [ichingHex, happeningSlot, null];

    const events = resolver.checkAndResolve(slots, 0, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);

    const boostEvent = events.find((e) => e.ruleId === 'iching-happening-boost');
    expect(boostEvent).toBeTruthy();
  });

  it('does not trigger interactions when no rules match', () => {
    const resolver = new InteractionResolver(tagSystem, bus);
    const noMatch: SlotResult = {
      type: 'tarot', id: 'the-star', name: 'The Star', number: 17,
      orientation: 'upright', symbol: '⭐',
      meaningUpright: 'Hope...', meaningReversed: 'Despair...',
      tags: ['draw', 'random', 'major-arcana', 'reversible', 'star-archetype'],
    };
    const slots: (SlotResult | null)[] = [noMatch, null, null];

    const events = resolver.checkAndResolve(slots, 0, { chaos: 0.3, order: 0.5 }, INTERACTION_RULES);
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**, then write `src/engine/InteractionResolver.ts`:

```typescript
import type { InteractionRule, InteractionEvent, SlotResult } from './types';
import type { TagSystem } from './TagSystem';
import type { EventBus } from './EventBus';

const MAX_CHAIN_DEPTH = 3;

export class InteractionResolver {
  constructor(
    private tagSystem: TagSystem,
    private bus: EventBus,
  ) {}

  checkAndResolve(
    slots: (SlotResult | null)[],
    revealedIndex: number,
    affinities: Record<string, number>,
    rules: InteractionRule[],
    chainDepth: number = 0,
  ): InteractionEvent[] {
    if (chainDepth >= MAX_CHAIN_DEPTH) return [];

    const sourceResult = slots[revealedIndex];
    if (!sourceResult) return [];

    const events: InteractionEvent[] = [];

    for (const rule of rules) {
      // Check if trigger matches the revealed entity
      if (!this.tagSystem.hasAllTags(sourceResult, rule.trigger.sourceTags)) {
        // Also check if the source itself carries the affinity-dominant tag
        const sourceTags = [...rule.trigger.sourceTags];
        if (sourceTags.includes('chaos-dominant') && affinities.chaos >= 0.5) {
          // Matched via affinity injection — continue
        } else {
          continue;
        }
      }

      // Find targets
      for (let ti = 0; ti < slots.length; ti++) {
        if (ti === revealedIndex) continue; // don't target self (except mirror)
        if (rule.target.action === 'mirror' && ti === revealedIndex) continue;

        const targetResult = slots[ti];
        if (!targetResult) continue;

        if (!this.tagSystem.hasAllTags(targetResult, rule.target.tags)) continue;

        // Apply chance-based filtering
        if (rule.id === 'chaos-second-result' && Math.random() > 0.15) continue;

        // Build the interaction event
        const effectDescription = this.describeEffect(rule, sourceResult, targetResult);

        const event: InteractionEvent = {
          ruleId: rule.id,
          sourceSlotIndex: revealedIndex,
          targetSlotIndex: ti,
          effect: rule.target.action,
          description: rule.display.description,
        };

        events.push(event);
        this.bus.emit('interaction-triggered', {
          ruleId: rule.id,
          sourceIndex: revealedIndex,
          targetIndex: ti,
          action: rule.target.action,
          description: effectDescription,
        });

        // Check for chain reactions from the target
        const chainEvents = this.checkAndResolve(
          slots, ti, affinities, rules, chainDepth + 1,
        );
        events.push(...chainEvents);

        if (chainEvents.length > 0) {
          this.bus.emit('interaction-chain-complete', {
            depth: chainDepth + 1,
            totalEvents: chainEvents.length,
          });
        }
      }
    }

    return events;
  }

  private describeEffect(
    rule: InteractionRule,
    source: SlotResult,
    target: SlotResult,
  ): string {
    const sourceName = 'name' in source ? (source as { name: string }).name : source.type;
    const targetName = 'name' in target ? (target as { name: string }).name : target.type;
    return `${sourceName} → ${rule.target.action} → ${targetName}`;
  }
}
```

- [ ] **Step 3: Run test to verify**

```bash
npx vitest run src/engine/__tests__/InteractionResolver.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/InteractionResolver.ts src/engine/__tests__/InteractionResolver.test.ts
git commit -m "feat: add InteractionResolver with rule matching, chain reactions (capped at 3)"
```

---

## Phase 8: Synthesis Engine

### Task 13: Build SynthesisEngine

**Files:**
- Create: `src/engine/SynthesisEngine.ts`
- Test: `src/engine/__tests__/SynthesisEngine.test.ts`

**Interfaces:**
- Consumes: `SlotResult[]`, `QuestionType`, `InteractionEvent[]`, `AffinityState`
- Produces: `SynthesisEngine` — `synthesize(slots, question, interactions, affinities): SynthesisResult`, `generateLLMPrompt(run): string`

- [ ] **Step 1: Write test**

Create `src/engine/__tests__/SynthesisEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SynthesisEngine } from '../SynthesisEngine';
import type { SlotResult, InteractionEvent, QuestionType } from '../types';

const foolCard: SlotResult = {
  type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
  orientation: 'upright', symbol: '☉',
  meaningUpright: 'A leap of faith awaits.', meaningReversed: 'Hesitation before the leap.',
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'upright'],
};

const diceRoll: SlotResult = {
  type: 'd20', result: 17, threshold: 'critical-high',
  interpretation: 'Fortune favors boldness.',
  tags: ['roll', 'random', 'numeric', 'threshold', 'high'],
};

const ichingHex: SlotResult = {
  type: 'iching', hexagramNumber: 27, name: 'Nourishment',
  symbol: '䷛', judgment: 'Nourish what is worthy within.',
  changingLines: [3, 5],
  tags: ['draw', 'random', 'binary', 'reversible', 'changing-lines'],
};

describe('SynthesisEngine', () => {
  const engine = new SynthesisEngine();

  it('produces a synthesis with headline and paragraphs', () => {
    const result = engine.synthesize(
      [foolCard, diceRoll, ichingHex],
      'decision',
      [],
      { chaos: 0.4, order: 0.5 },
    );
    expect(result.headline).toBeTruthy();
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });

  it('detects tension between opposing results', () => {
    const cautionDice: SlotResult = {
      ...diceRoll, result: 3, threshold: 'critical-low',
      interpretation: 'The odds are against you.',
      tags: ['roll', 'random', 'numeric', 'threshold', 'low', 'critical-low'],
    };
    const result = engine.synthesize(
      [foolCard, cautionDice, ichingHex],
      'decision',
      [],
      { chaos: 0.4, order: 0.5 },
    );
    expect(result.tensionNote).toBeTruthy();
  });

  it('generates LLM prompt markdown with all elements', () => {
    const prompt = engine.generateLLMPrompt({
      question: 'decision' as QuestionType,
      slots: [foolCard, diceRoll, ichingHex],
      interactions: [],
      affinities: { chaos: 0.4, order: 0.5 },
    });
    expect(prompt).toContain('Atlas of Fate');
    expect(prompt).toContain('The Fool');
    expect(prompt).toContain('17');
    expect(prompt).toContain('Nourishment');
    expect(prompt).toContain('```');
  });
});
```

- [ ] **Step 2: Run to verify failure**, then write `src/engine/SynthesisEngine.ts`:

```typescript
import type { SlotResult, SynthesisResult, QuestionType, InteractionEvent } from './types';

export class SynthesisEngine {
  synthesize(
    slots: SlotResult[],
    question: QuestionType,
    interactions: InteractionEvent[],
    affinities: Record<string, number>,
  ): SynthesisResult {
    const paragraphs: string[] = [];
    let tensionNote: string | undefined;
    let affinityNote: string | undefined;

    // Build individual interpretation lines
    for (const slot of slots) {
      if (!slot) continue;
      const para = this.describeSlot(slot);
      paragraphs.push(para);
    }

    // Check for tension: opposing tags between results
    const hasHigh = slots.some((s) => s?.tags.includes('high'));
    const hasLow = slots.some((s) => s?.tags.includes('low'));
    if (hasHigh && hasLow) {
      tensionNote = 'The forces revealed are in tension — fortune and caution pull in opposite directions. The path forward requires balancing boldness with prudence.';
    }

    const hasReversed = slots.some((s) => s?.tags.includes('reversed'));
    const hasUpright = slots.some((s) => s?.tags.includes('upright'));
    if (hasReversed && hasUpright) {
      tensionNote = (tensionNote ?? '') + ' Reversed and upright influences intertwine — what appears straightforward may carry hidden dimensions.';
    }

    // Affinity note
    if (affinities.chaos >= 0.5) {
      affinityNote = 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.';
    } else if (affinities.order >= 0.5) {
      affinityNote = 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.';
    }

    // Question framing
    const questionFrames: Record<QuestionType, string> = {
      decision: 'As you weigh your decision, consider how these forces illuminate the choice before you.',
      relationship: 'In matters of connection, these signs reveal the deeper currents at play.',
      future: 'When gazing ahead, these threads of fate offer glimpses of what may come.',
      self: 'In the mirror of divination, these symbols reflect aspects of your inner landscape.',
    };

    const headline = this.buildHeadline(slots, question);

    return {
      headline,
      paragraphs: [...paragraphs, questionFrames[question]],
      tensionNote,
      affinityNote,
    };
  }

  private describeSlot(slot: SlotResult): string {
    switch (slot.type) {
      case 'tarot':
        return `The ${slot.name} appears ${slot.orientation} — ${slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed}`;
      case 'd20':
        return `The dice settle on ${slot.result} (${slot.threshold.replace('-', ' ')}) — ${slot.interpretation}`;
      case 'iching':
        return `Hexagram ${slot.hexagramNumber}, "${slot.name}" ${slot.symbol} emerges — ${slot.judgment}${slot.changingLines.length ? ` Changing lines at ${slot.changingLines.join(', ')} suggest transformation in progress.` : ''}`;
      default:
        return '';
    }
  }

  private buildHeadline(slots: SlotResult[], question: QuestionType): string {
    const questionNouns: Record<QuestionType, string> = {
      decision: 'your path forward',
      relationship: 'the bonds you share',
      future: 'the horizon ahead',
      self: 'your inner nature',
    };
    const cards = slots.filter(Boolean);
    if (cards.length === 0) return `The stars are silent on ${questionNouns[question]}.`;
    const firstSlot = cards[0];
    const firstWord = firstSlot.type === 'tarot' ? (firstSlot as { name: string }).name :
      firstSlot.type === 'd20' ? `The number ${(firstSlot as { result: number }).result}` :
      (firstSlot as { name: string }).name;
    return `${firstWord} illuminates ${questionNouns[question]}.`;
  }

  generateLLMPrompt(run: {
    question: QuestionType;
    slots: SlotResult[];
    interactions: InteractionEvent[];
    affinities: Record<string, number>;
  }): string {
    const lines: string[] = [];
    lines.push('## Atlas of Fate Reading');
    lines.push('');
    lines.push(`**Question type:** ${run.question}`);
    lines.push(`**Affinity hints:** ${run.affinities.chaos >= 0.5 ? 'High Chaos - volatile and unpredictable' : run.affinities.order >= 0.5 ? 'High Order - steady and clear' : 'Balanced - neutral currents'}`);
    lines.push('');
    lines.push('### Divinations');
    run.slots.forEach((slot, i) => {
      if (!slot) return;
      lines.push(`${i + 1}. ${this.describeSlot(slot)}`);
    });
    lines.push('');
    if (run.interactions.length > 0) {
      lines.push('### Meta Events');
      run.interactions.forEach((ev) => {
        lines.push(`- ${ev.description}`);
      });
      lines.push('');
    }
    lines.push('### Instructions');
    lines.push('Synthesize these divination results into a cohesive, mystical reading. Consider:');
    lines.push('- How the divinations reinforce or contradict each other');
    lines.push('- The question context and what is at stake');
    lines.push('- The affinity state and how it colors the interpretation');
    lines.push('- The meta events and their implications');
    lines.push('');
    lines.push('Write in an atmospheric, insightful tone — as if divining the stars themselves. Avoid generic fortune-cookie phrasing. Be specific to the cards, numbers, and hexagrams drawn.');

    return lines.join('\n');
  }
}
```

- [ ] **Step 3: Run test to verify**

```bash
npx vitest run src/engine/__tests__/SynthesisEngine.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/SynthesisEngine.ts src/engine/__tests__/SynthesisEngine.test.ts
git commit -m "feat: add SynthesisEngine with template synthesis and LLM prompt export"
```

---

## Phase 9: GameEngine Facade

### Task 14: Build GameEngine

**Files:**
- Create: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: All engine modules, all data modules
- Produces: `GameEngine` class — the single public API that React will use:
  - `startTurn(question)`, `drawSlot(index)`, `revealSlot(index)`, `resolveAllInteractions()`, `synthesize()`, `triggerHappening()`, `resolveHappening(choiceIndex)`, `getState(): GameState`, `loadState(json)`, `saveToStorage()`, `loadFromStorage()`, `subscribe(fn): unsubscribe`

- [ ] **Step 1: Write test**

Create `src/engine/__tests__/GameEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('GameEngine', () => {
  it('starts in title screen', () => {
    const engine = new GameEngine();
    const state = engine.getState();
    expect(state.screen).toBe('title');
  });

  it('full run: question → draw → reveal → interactions → synthesis → result', () => {
    const engine = new GameEngine();

    // Start turn
    engine.startTurn('self');
    let state = engine.getState();
    expect(state.screen).toBe('draw');
    expect(state.pool.length).toBe(3);

    // Draw 3 slots
    for (let i = 0; i < 3; i++) {
      engine.drawSlot(i);
    }
    state = engine.getState();
    expect(state.slots.filter(Boolean)).toHaveLength(3);

    // Reveal each slot
    for (let i = 0; i < 3; i++) {
      engine.revealSlot(i);
    }

    // Synthesize
    engine.synthesize();
    state = engine.getState();
    expect(state.synthesis).toBeTruthy();
    expect(state.screen).toBe('interpretation');
  });

  it('loadState() sets exact game state for debugging', () => {
    const engine = new GameEngine();
    engine.loadState({
      affinities: { chaos: 0.8, order: 0.2 },
      questionType: 'decision',
      pool: ['tarot', 'd20'],
      slots: [
        { type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
          orientation: 'upright', symbol: '☉',
          meaningUpright: '...', meaningReversed: '...',
          tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'upright'] },
        { type: 'd20', result: 17, threshold: 'critical-high',
          interpretation: '...',
          tags: ['roll', 'random', 'numeric', 'threshold', 'high'] },
        null,
      ],
      revealedCount: 2,
      interactions: [],
      synthesis: null,
      happening: null,
      selectedHappeningChoice: null,
    });

    const state = engine.getState();
    expect(state.affinities.chaos).toBe(0.8);
    expect(state.questionType).toBe('decision');
    expect(state.slots.filter(Boolean)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**, then write `src/engine/GameEngine.ts` (facade wiring all modules together, ~80 lines)

- [ ] **Step 3: Run test to verify**

```bash
npx vitest run src/engine/__tests__/GameEngine.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat: add GameEngine facade wiring all systems together"
```

---

## Phase 10: React Integration

### Task 15: Create persistence utility, engine context, and hook

**Files:**
- Create: `src/utils/persistence.ts`, `src/context/EngineContext.tsx`, `src/hooks/useGameEngine.ts`
- Modify: `src/App.tsx` (wrap with provider)

**Interfaces:**
- Consumes: `GameEngine`, `GameState`
- Produces: React context + hook pattern for consuming engine state

Details omitted for plan conciseness — follows standard React Context pattern: `EngineProvider` creates a `GameEngine` instance, stores it in ref, uses `useSyncExternalStore` for subscription, exposes via `useGameEngine()` hook.

---

## Phase 11: UI Screens

### Tasks 16–22: Build each screen

One task per screen component (7 tasks), each with Framer Motion animations:

- **Task 16:** `TitleScreen.tsx` — star field background, title, "CONSULT THE STARS" button, runic elements
- **Task 17:** `QuestionSelect.tsx` — 4 question type cards, hover animations
- **Task 18:** `DrawPhase.tsx` + `CardSlot.tsx` — 3 face-down cards, click-to-flip with Framer Motion `rotateY`
- **Task 19:** `InteractionOverlay.tsx` + `HistoryBar.tsx` — flash effects, chain animation sequencing
- **Task 20:** `Interpretation.tsx` — synthesis display, expandable divination details, "Copy LLM Prompt" button
- **Task 21:** `HappeningScene.tsx` — cryptic scene with choice buttons
- **Task 22:** `ResultScreen.tsx` — summary, "Draw Again", "Share as Image", "View History"

Each follows the same pattern: read from `useGameEngine()`, call engine methods, animate with Framer Motion.

---

## Phase 12: Debug Panel & Share

### Task 23: Build DebugPanel

**Files:**
- Create: `src/components/debug/DebugPanel.tsx`, `StateViewer.tsx`, `JsonInjector.tsx`, `StepControls.tsx`

### Task 24: Build share export utility

**Files:**
- Create: `src/utils/shareExport.ts`

---

## Phase 13: Visual Theme & Polish

### Task 25: Apply Stellar Divination theme

**Files:**
- Create: `src/styles/theme.css`
- Modify: `index.html` (font imports)
- Create: `src/components/overlays/StarField.tsx`, `src/components/shared/RunicBand.tsx`, `OrnamentalBorder.tsx`, `MysticButton.tsx`

---

## Self-Review

**Spec coverage:**
- Architecture (section 2): Engine built tasks 2-14, React integration tasks 15-25 ✓
- Tag system (3): Task 4 ✓
- Affinity system (4): Task 10 + data task 8 ✓
- Game flow (5): TurnOrchestrator task 11, GameEngine task 14, UI tasks 16-22 ✓
- Divination methods (6): Data tasks 5-7 ✓
- Interpretation (7): Task 13 ✓
- Debug panel (8): Task 23 ✓
- Persistence (9): Task 15 ✓
- Visual design (10): Task 25 ✓
- Tech stack (11): Task 1 ✓
- Out of scope (12): Respected — no backend, no full deck, no LLM API ✓

**Placeholder scan:** Tasks 15-25 contain abbreviated descriptions. Full implementation must fill in complete component code per the design spec and visual mockups.

**Type consistency:** Verified — `types.ts` defines all core interfaces; data files produce those types; engine modules consume them. `SlotResult` union used consistently across TurnOrchestrator, InteractionResolver, SynthesisEngine, and GameEngine.
