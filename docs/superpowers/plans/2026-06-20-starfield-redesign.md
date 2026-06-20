# Starfield Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the StarField with proper aspect-ratio handling, pinpoint stars with twinkle, 8-pointed constellation stars, non-overlapping constellations, and a swirl convergence effect before results.

**Architecture:** All visual changes live in `StarField.tsx` (SVG with embedded CSS). Engine changes are minimal — a `swirlActive` boolean added to `GameState`, toggled during synthesis, with a `finishSwirl()` callback wired to `onAnimationEnd`. Debug trigger via a new button in `DebugPanel.tsx`.

**Tech Stack:** React 18 + TypeScript + inline SVG + CSS `@keyframes` (no extra dependencies)

## Global Constraints

- All game logic stays in `src/engine/` with zero React or DOM imports
- Engine mutators must end with `notify()` for React change detection
- `swirlActive` is transient (not persisted, resets each turn)
- `preserveAspectRatio="xMidYMid slice"` on the SVG
- Constellation coordinates use percentage-based 0–100 viewBox space

---

### Task 1: Add `swirlActive` to GameState type

**Files:**
- Modify: `src/engine/types.ts:191-211`

**Interfaces:**
- Produces: `GameState.swirlActive: boolean` — consumed by Tasks 2, 4, 5

- [ ] **Step 1: Add `swirlActive` field to `GameState`**

```typescript
export interface GameState {
  screen: Screen;
  affinities: Record<AffinityId, number>;
  questionType: QuestionType | null;
  availableMethods: DivinationType[];
  selectedMethod: DivinationType | null;
  turnResults: SlotResult[];
  minigamesCompleted: number;
  minigameState: MinigameState | null;
  pendingEffects: PendingEffect[];
  activeInteraction: InteractionEvent | null;
  pendingHappening: boolean;
  interactions: InteractionEvent[];
  synthesis: SynthesisResult | null;
  happening: HappeningResult | null;
  selectedHappeningChoice: number | null;
  history: RunRecord[];
  eventLog: GameEvent[];
  chainDepth: number;
  debug: boolean;
  swirlActive: boolean;  // <-- ADD THIS
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: type errors in GameEngine.ts (missing `swirlActive` initializations) — these will be fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add swirlActive to GameState type
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add Engine Methods for Swirl

**Files:**
- Modify: `src/engine/GameEngine.ts:43-65` (defaultState)
- Modify: `src/engine/GameEngine.ts:76-102` (startTurn — add swirlActive reset)
- Modify: `src/engine/GameEngine.ts:170-175` (completeMinigame — set swirlActive instead of screen=result)
- Modify: `src/engine/GameEngine.ts:257-274` (synthesizeAll — remove direct screen set, let swirl gate it)
- Modify: `src/engine/GameEngine.ts:429-445` (returnToQuestionSelect — add swirlActive reset)
- Modify: `src/engine/GameEngine.ts:447-460` (returnToTitle — covered by defaultState)

**Interfaces:**
- Consumes: `GameState.swirlActive` from Task 1
- Produces: `engine.finishSwirl(): void`, `engine.startDebugSwirl(): void`

- [ ] **Step 1: Add `swirlActive: false` to `defaultState()`**

In `defaultState()`, add the field after `debug: false`:

```typescript
private defaultState(): GameState {
  return {
    screen: 'title',
    affinities: { chaos: 0.5, order: 0.5 },
    questionType: null,
    availableMethods: [],
    selectedMethod: null,
    turnResults: [],
    minigamesCompleted: 0,
    minigameState: null,
    pendingEffects: [],
    activeInteraction: null,
    pendingHappening: false,
    interactions: [],
    synthesis: null,
    happening: null,
    selectedHappeningChoice: null,
    history: [],
    eventLog: [],
    chainDepth: 0,
    debug: false,
    swirlActive: false,  // <-- ADD
  };
}
```

- [ ] **Step 2: Add `swirlActive: false` to `startTurn()` reset block**

In `startTurn()`, add after `this.state.chainDepth = 0;`:

```typescript
this.state.swirlActive = false;  // <-- ADD
```

- [ ] **Step 3: Add `swirlActive: false` to `returnToQuestionSelect()` reset block**

In `returnToQuestionSelect()`, add after `this.state.chainDepth = 0;`:

```typescript
this.state.swirlActive = false;  // <-- ADD
```

- [ ] **Step 4: Set `swirlActive: true` during synthesis instead of going directly to result**

In `completeMinigame()`, find the block where `completed >= this.minigamesPerTurn` (around line 171). Currently it calls `synthesizeAll()`, `buildRunRecord()`, then sets `this.state.screen = 'result'`. Change it to set `swirlActive: true` instead of setting screen to result:

```typescript
if (completed >= this.minigamesPerTurn) {
  // All minigames done — synthesize and trigger swirl (swirl completion → result)
  this.synthesizeAll();
  this.buildRunRecord();
  if (this.state.activeInteraction) {
    // InteractionLayer will clear and we need to go to result
  } else {
    this.state.swirlActive = true;  // CHANGED: was this.state.screen = 'result'
  }
}
```

Also update the `clearActiveInteraction()` method (line 224) so when all minigames are done and there's no pending happening, it triggers swirl instead of going directly to result:

In `clearActiveInteraction()`, change the block at line 234:
```typescript
if (this.state.minigamesCompleted >= this.minigamesPerTurn) {
  this.state.swirlActive = true;  // CHANGED: was this.state.screen = 'result'
} else {
```

- [ ] **Step 5: Add `finishSwirl()` method**

Add a new public method after `clearActiveInteraction()`:

```typescript
finishSwirl(): void {
  this.state.swirlActive = false;
  this.state.screen = 'result';
  this.notify();
}
```

- [ ] **Step 6: Add `startDebugSwirl()` method**

Add after `finishSwirl()`:

```typescript
startDebugSwirl(): void {
  this.state.swirlActive = true;
  this.notify();
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no errors)

- [ ] **Step 8: Run existing tests**

Run: `npx vitest run`
Expected: Some tests may fail because the engine now sets `swirlActive` instead of `screen = 'result'` directly. Note which tests fail — we'll fix them in Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/engine/GameEngine.ts
git commit -m "feat: add swirlActive gating and finishSwirl/startDebugSwirl methods
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Update Constellation Positions (Overlap Fix)

**Files:**
- Modify: `src/data/constellations.ts:20-122`

**Interfaces:**
- Produces: Updated `CONSTELLATIONS` array with non-overlapping positions — consumed by Task 4

- [ ] **Step 1: Replace constellation star coordinates with new non-overlapping positions**

Replace the `CONSTELLATIONS` array with:

```typescript
export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'The Eye',
    theme: 'Divine sight, awareness',
    color: 'white',
    stars: [
      { x: 72, y: 15, brightness: 0.85 },
      { x: 78, y: 27, brightness: 0.7 },
      { x: 80, y: 38, brightness: 0.85 },
      { x: 72, y: 40, brightness: 0.7 },
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
      { x: 40, y: 5, brightness: 0.8 },
      { x: 44, y: 14, brightness: 0.65 },
      { x: 50, y: 9, brightness: 0.8 },
      { x: 49, y: 18, brightness: 0.6 },
      { x: 42, y: 18, brightness: 0.6 },
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
      { x: 78, y: 68, brightness: 0.75 },
      { x: 78, y: 78, brightness: 0.65 },
      { x: 88, y: 70, brightness: 0.75 },
      { x: 88, y: 80, brightness: 0.65 },
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
      { x: 40, y: 35, brightness: 0.8 },
      { x: 36, y: 46, brightness: 0.65 },
      { x: 34, y: 51, brightness: 0.55 },
      { x: 62, y: 35, brightness: 0.8 },
      { x: 58, y: 46, brightness: 0.65 },
      { x: 56, y: 51, brightness: 0.55 },
      { x: 51, y: 35, brightness: 0.6 },
      { x: 51, y: 55, brightness: 0.55 },
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
      { x: 62, y: 65, brightness: 0.75 },
      { x: 64, y: 71, brightness: 0.75 },
      { x: 66, y: 77, brightness: 0.75 },
    ],
    lines: [
      { from: 0, to: 1 }, { from: 1, to: 2 },
    ],
  },
];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS (no type changes, only value changes)

- [ ] **Step 3: Commit**

```bash
git add src/data/constellations.ts
git commit -m "fix: reposition constellations to eliminate overlap
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Rewrite StarField Component

**Files:**
- Modify: `src/components/overlays/StarField.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CONSTELLATIONS` from Task 3, `GameState.swirlActive` + `engine.finishSwirl()` from Task 2
- Produces: Visual starfield with proper scaling, 8-pointed stars, twinkle, and swirl effect

- [ ] **Step 1: Write the full rewritten StarField.tsx**

```typescript
import { useMemo, useCallback } from 'react';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';
import { useGameEngine } from '../../hooks/useGameEngine';

interface DustStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  twinkleDuration: number;
  twinkleDelay: number;
}

interface MediumStar {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  twinkleDuration: number;
  twinkleDelay: number;
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
      r: rng() * 0.12 + 0.06,
      opacity: rng() * 0.3 + 0.25,
      twinkleDuration: rng() * 4 + 2,
      twinkleDelay: rng() * 6,
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
      r: rng() * 0.18 + 0.12,
      opacity: rng() * 0.3 + 0.35,
      twinkleDuration: rng() * 4 + 2.5,
      twinkleDelay: rng() * 5,
    });
  }
  return stars;
}

export default function StarField() {
  const { state, engine } = useGameEngine();
  const dustStars = useMemo(() => generateDustStars(42, 70), []);
  const mediumStars = useMemo(() => generateMediumStars(137, 18), []);

  const handleAnimationEnd = useCallback(() => {
    if (state.swirlActive) {
      engine.finishSwirl();
    }
  }, [state.swirlActive, engine]);

  const swirlClass = state.swirlActive ? ' starfield--swirling' : '';

  return (
    <div style={containerStyle}>
      <svg
        className={`starfield${swirlClass}`}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
        onAnimationEnd={handleAnimationEnd}
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
          <filter id="glow-dust" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="0.15" />
          </filter>
          <filter id="line-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.25" />
          </filter>

          {/* 8-pointed star template (white) */}
          <g id="cstar-white">
            <circle cx="0" cy="0" r="2.0" fill="#c8d8f0" opacity="0.1" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.6" fill="#e8f0ff" opacity="0.3" filter="url(#glow-tight)" />
            <path
              d="M 0,-0.35 L 0.046,-0.111 L 0.247,-0.247 L 0.111,-0.046 L 0.35,0 L 0.111,0.046 L 0.247,0.247 L 0.046,0.111 L 0,0.35 L -0.046,0.111 L -0.247,0.247 L -0.111,0.046 L -0.35,0 L -0.111,-0.046 L -0.247,-0.247 L -0.046,-0.111 Z"
              fill="#e8f0ff"
              opacity="0.95"
            />
          </g>

          {/* 8-pointed star template (gold) */}
          <g id="cstar-gold">
            <circle cx="0" cy="0" r="2.0" fill="#d4a854" opacity="0.08" filter="url(#glow-outer)" />
            <circle cx="0" cy="0" r="0.6" fill="#f0d878" opacity="0.25" filter="url(#glow-tight)" />
            <path
              d="M 0,-0.35 L 0.046,-0.111 L 0.247,-0.247 L 0.111,-0.046 L 0.35,0 L 0.111,0.046 L 0.247,0.247 L 0.046,0.111 L 0,0.35 L -0.046,0.111 L -0.247,0.247 L -0.111,0.046 L -0.35,0 L -0.111,-0.046 L -0.247,-0.247 L -0.046,-0.111 Z"
              fill="#f0d878"
              opacity="0.95"
            />
          </g>

          {/* Swirl flash overlay — white rectangle covering viewBox, animated by CSS */}
          <rect id="swirl-flash" x="0" y="0" width="100" height="100" fill="#e8f0ff" opacity="0" />
        </defs>

        {/* Embedded styles for twinkle + swirl animations */}
        <style>{`
          /* Twinkle animations — one keyframe reused with staggered delays.
             Group opacity modulates between 1 (full) and 0.55 (dimmed);
             the circles inside already carry their own base opacity. */
          @keyframes twinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
          }

          .starfield--swirling {
            animation: star-swirl 2.5s cubic-bezier(0.25, 0, 0.25, 1) forwards;
          }

          @keyframes star-swirl {
            0% {
              transform: rotate(0deg) scale(1);
            }
            100% {
              transform: rotate(180deg) scale(0.82);
            }
          }

          .starfield--swirling .constellation-lines {
            animation: lines-fade 0.6s ease-in forwards;
          }

          @keyframes lines-fade {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }

          .starfield--swirling .swirl-trail {
            animation: trail-fade 2.5s cubic-bezier(0.25, 0, 0.25, 1) forwards;
          }

          @keyframes trail-fade {
            0% { opacity: 0.3; }
            100% { opacity: 0; }
          }

          .starfield--swirling #swirl-flash {
            animation: peak-flash 0.4s ease-out 2.1s forwards;
          }

          @keyframes peak-flash {
            0% { opacity: 0; }
            50% { opacity: 0.15; }
            100% { opacity: 0; }
          }
        `}</style>

        {/* Base fill */}
        <rect width="100" height="100" fill="#070a12" />

        {/* Nebula washes */}
        <ellipse cx="30" cy="35" rx="55" ry="55" fill="url(#nebula-purple)" />
        <ellipse cx="70" cy="60" rx="55" ry="55" fill="url(#nebula-teal)" />
        <ellipse cx="50" cy="85" rx="50" ry="40" fill="url(#nebula-rose)" />

        {/* Trail layer — offset copies of stars for swirl trail effect, only visible during swirl */}
        <g className="swirl-trail" opacity="0" style={{ transform: 'rotate(-8deg) scale(0.95)', transformOrigin: '50% 50%' }}>
          {dustStars.map((s, i) => (
            <circle key={`td-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#7b9ec7" opacity={s.opacity * 0.5} />
          ))}
          {mediumStars.map((s, i) => (
            <circle key={`tm-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#c8d8f0" opacity={s.opacity * 0.5} />
          ))}
        </g>

        {/* Dust stars — tiny pinpoints with glow and twinkle */}
        {dustStars.map((s, i) => (
          <g key={`d-${i}`} style={{
            animation: `twinkle ${s.twinkleDuration}s ease-in-out infinite`,
            animationDelay: `${s.twinkleDelay}s`,
          } as React.CSSProperties}>
            <circle cx={s.cx} cy={s.cy} r={s.r * 2} fill="#7b9ec7" opacity={s.opacity * 0.3} filter="url(#glow-dust)" />
            <circle cx={s.cx} cy={s.cy} r={s.r} fill="#7b9ec7" opacity={s.opacity} />
          </g>
        ))}

        {/* Medium stars — slightly larger pinpoints with glow and twinkle */}
        {mediumStars.map((s, i) => (
          <g key={`m-${i}`} style={{
            animation: `twinkle ${s.twinkleDuration}s ease-in-out infinite`,
            animationDelay: `${s.twinkleDelay}s`,
          } as React.CSSProperties}>
            <circle cx={s.cx} cy={s.cy} r={s.r * 2} fill="#c8d8f0" opacity={s.opacity * 0.3} filter="url(#glow-dust)" />
            <circle cx={s.cx} cy={s.cy} r={s.r} fill="#c8d8f0" opacity={s.opacity} />
          </g>
        ))}

        {/* Constellations */}
        {CONSTELLATIONS.map((constellation: Constellation) => (
          <g key={constellation.name}>
            {/* Glow lines */}
            <g className="constellation-lines">
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
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {/* Core lines */}
            <g className="constellation-lines">
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
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
            {/* Stars — 8-pointed */}
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

        {/* Swirl flash overlay */}
        <use href="#swirl-flash" />
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
  transformOrigin: '50% 50%',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/overlays/StarField.tsx
git commit -m "feat: rewrite StarField with pinpoint stars, 8-pointed constellations, twinkle, and swirl effect
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Add Debug "Trigger Swirl" Button

**Files:**
- Modify: `src/components/debug/DebugPanel.tsx:95-98`

**Interfaces:**
- Consumes: `engine.startDebugSwirl()` from Task 2

- [ ] **Step 1: Add the button handler and UI**

Add the callback after `handleForceFoolsReroll` (around line 37):

```typescript
const handleTriggerSwirl = useCallback(() => {
  engine.startDebugSwirl();
}, [engine]);
```

Add the button after the "Force Fool's Reroll" button (after line 97):

```tsx
<button onClick={handleTriggerSwirl} style={{ ...btnStyle, marginTop: '8px' }}>
  Trigger Swirl
</button>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/debug/DebugPanel.tsx
git commit -m "feat: add Trigger Swirl debug button
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Update Engine Tests for Swirl

**Files:**
- Modify: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: `finishSwirl()`, `startDebugSwirl()`, `swirlActive` from Task 2

- [ ] **Step 1: Add test for `swirlActive` is false by default**

```typescript
it('swirlActive defaults to false', () => {
  expect(engine.getState().swirlActive).toBe(false);
});
```

- [ ] **Step 2: Add test for `startDebugSwirl()`**

```typescript
it('startDebugSwirl sets swirlActive to true', () => {
  engine.startDebugSwirl();
  expect(engine.getState().swirlActive).toBe(true);
});
```

- [ ] **Step 3: Add test for `finishSwirl()` transitions to result**

```typescript
it('finishSwirl clears swirlActive and goes to result', () => {
  engine.startDebugSwirl();
  expect(engine.getState().swirlActive).toBe(true);

  engine.finishSwirl();
  const state = engine.getState();
  expect(state.swirlActive).toBe(false);
  expect(state.screen).toBe('result');
});
```

- [ ] **Step 4: Add test for swirl activates after 3 minigames instead of direct result**

```typescript
it('sets swirlActive instead of going directly to result after 3 minigames', () => {
  engine.startTurn('self');

  const makeResult = (): SlotResult => ({
    type: 'd20',
    result: 10,
    threshold: 'neutral',
    interpretation: 'Steady',
    tags: ['roll', 'numeric'],
  });

  // Complete 3 minigames
  for (let i = 0; i < 3; i++) {
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen === 'happening') {
      engine.resolveHappening(0);
      const m2 = engine.getState().availableMethods;
      const ix2 = m2.findIndex((m) => m !== 'happening');
      if (ix2 === -1) return;
      engine.selectMethod(ix2);
    }
    engine.completeMinigame(makeResult());
    if (engine.getState().activeInteraction) {
      engine.clearActiveInteraction();
    }
  }

  const state = engine.getState();
  expect(state.turnResults.length).toBe(3);
  expect(state.synthesis).toBeTruthy();
  expect(state.swirlActive).toBe(true);
  expect(state.screen).not.toBe('result');

  // finishSwirl should transition to result
  engine.finishSwirl();
  expect(engine.getState().swirlActive).toBe(false);
  expect(engine.getState().screen).toBe('result');
});
```

- [ ] **Step 5: Add test for `swirlActive` resets on new turn**

```typescript
it('swirlActive resets on startTurn', () => {
  engine.startDebugSwirl();
  expect(engine.getState().swirlActive).toBe(true);

  engine.startTurn('self');
  expect(engine.getState().swirlActive).toBe(false);
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/__tests__/GameEngine.test.ts
git commit -m "test: add swirl lifecycle tests
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Manual Verification

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the starfield visually**

Open http://localhost:5173 and confirm:
- Stars are tiny pinpoints with glow, not big circles
- Stars twinkle asynchronously
- Constellations have 8-pointed stars
- Constellations do not overlap
- Resize the browser window — stars maintain their shape (no stretching)

- [ ] **Step 3: Test swirl via debug**

Open http://localhost:5173/?debug and click "Trigger Swirl":
- Stars rotate clockwise and shrink inward
- Constellation lines fade out
- White flash at peak convergence (~2.1s in)
- Animation completes and state returns to normal

- [ ] **Step 4: Test swirl via gameplay**

Play through a full turn (3 minigames):
- After the 3rd minigame completes, the swirl should play
- After swirl finishes, the result screen appears
