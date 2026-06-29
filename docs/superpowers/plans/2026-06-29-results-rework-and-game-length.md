# Results Rework, Game Length, Corruption Presentation & Narrative Voice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the results page compact and scalable to 3/5/7-method readings, let players pick game length, enrich corruption presentation, give every affinity (and the corruption entity) a narrative voice, and export a fixed-ratio shareable reading image.

**Architecture:** Engine stays framework-free; game length becomes a per-turn parameter to `startTurn`, and narrative voice is added in `NarrativeAssembler`/`CorruptionGlitch`. The React results screen is rebuilt as a synthesis "hero" + a reflowing grid of uniform tap-to-expand tiles (with a triangle spread tile), reusing the existing `CardDetailModal`. Corruption presentation is CSS-only primitives layered on the new tiles. The share image is a dedicated off-screen `ShareCard` captured by `html2canvas`.

**Tech Stack:** React 18 + TypeScript (strict) + Vite, framer-motion, html2canvas, Vitest (engine tests only).

## Global Constraints

- **Engine purity:** no React/DOM imports in `src/engine/**`. Logic in the engine, rendering in React. (CLAUDE.md)
- **Snapshot contract:** every engine mutator ends with `this.notify()`. (CLAUDE.md)
- **Typecheck:** `npm run build` runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters` — must stay green. No ESLint/Prettier.
- **Tests:** Vitest runs only `src/engine/__tests__/**` (Node env). There are **no component tests** — React tasks verify via `npm run build` + manual `?debug` state injection (see the repro-game-state memory). Randomness in tests is stubbed via `vi.spyOn(Math,'random')`.
- **Docs in sync (same change):** edits to affinities / `NarrativeAssembler` / corruption systems MUST update `docs/game-systems.md` (and matching README sections). (CLAUDE.md)
- **No corruption wording anywhere in the question-select / length UI.** Players discover corruption only by experiencing it.
- **Corruption chromatic stays red↔void, never cyan.** (existing kit in `src/styles/corruption.css`)
- **Affinity ids:** `chaos, order, fate, will, light, shadow` (three opposed pairs). Elevated band = `'ascendant' | 'dominant'`.
- **Game-length tiers:** Glimpse=3, Reading=5 (default), Deep Divination=7.
- **Share image:** fixed 4:5 portrait, exported at 1080×1350.
- Branch: `feat/results-rework` (already checked out; the design spec commit is its first commit).

---

## File Structure

**Engine (modify)**
- `src/engine/GameEngine.ts` — per-turn `minigamesPerTurn`; entity-voice replacement in synthesis step.
- `src/engine/types.ts` — `minigamesPerTurn` on `GameState`.
- `src/engine/NarrativeAssembler.ts` — per-affinity note selection (all six).
- `src/engine/CorruptionGlitch.ts` — `entityVoiceNote(rng)` helper (entity declarations pool).

**React (create)**
- `src/components/cards/ResultTile.tsx` — one uniform result tile (single-method or spread), tap to open detail.
- `src/components/share/ShareCard.tsx` — the 4:5 export composition (clean + corrupted-static).

**React (modify)**
- `src/components/screens/QuestionSelect.tsx` — segmented depth control + `startTurn(type, count)`.
- `src/components/screens/ResultReading.tsx` — hero panel + tile grid + tap-to-expand + share wiring.
- `src/components/cards/CardReadingDetail.tsx` — render position labels/colors on the expanded spread (Past/Present/Future accents) — small enhancement.
- `src/utils/shareExport.ts` — off-screen render of `ShareCard` at fixed size.
- `src/styles/corruption.css` — `cx-sig*`, `cx-swap*`, tainted-tile, and static-share primitives.

**Docs (modify)**
- `docs/game-systems.md`, `README.md`.

---

# Phase 1 — Game length

### Task 1: Per-turn `minigamesPerTurn` (engine)

**Files:**
- Modify: `src/engine/GameEngine.ts` (constructor ~63-74; `defaultState` ~78-113; `startTurn` ~325-353)
- Modify: `src/engine/types.ts` (`GameState` ~613-644)
- Test: `src/engine/__tests__/GameLength.test.ts` (create)

**Interfaces:**
- Produces: `GameEngine.startTurn(question: QuestionType, methodCount?: number): void` — sets the turn's method count (defaults to the constructor value); `GameState.minigamesPerTurn: number`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/GameLength.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});

// Drive exactly one completed reading (mirrors the corruption-test helper).
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('game length', () => {
  it('startTurn records the chosen method count on state', () => {
    const e = new GameEngine();
    e.startTurn('self', 7);
    expect(e.getState().minigamesPerTurn).toBe(7);
  });

  it('a 7-method turn does not finalize at the old default of 3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine();
    e.startTurn('self', 7);
    for (let i = 0; i < 3; i++) oneReading(e);
    expect(e.getState().synthesis).toBeNull(); // would be set if it thought 3 was final
  });

  it('a 7-method turn finalizes on the 7th reading', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine();
    e.startTurn('self', 7);
    for (let i = 0; i < 7; i++) oneReading(e);
    expect(e.getState().synthesis).toBeTruthy();
    expect(e.getState().screen).toBe('result');
  });

  it('omitting the count falls back to the constructor default', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    expect(e.getState().minigamesPerTurn).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/GameLength.test.ts`
Expected: FAIL — `minigamesPerTurn` is not on `GameState` (type error / undefined).

- [ ] **Step 3: Add the field to `GameState`**

In `src/engine/types.ts`, inside `interface GameState`, add after `minigamesCompleted: number;`:

```ts
  minigamesCompleted: number;
  minigamesPerTurn: number;   // methods required this turn (3/5/7 — set by startTurn)
```

- [ ] **Step 4: Track the default and the active count in the engine**

In `src/engine/GameEngine.ts`, change the field + constructor. Replace:

```ts
  constructor(minigamesPerTurn = 3) {
    this.minigamesPerTurn = minigamesPerTurn;
```

with:

```ts
  private defaultMinigamesPerTurn: number;

  constructor(minigamesPerTurn = 3) {
    this.defaultMinigamesPerTurn = minigamesPerTurn;
    this.minigamesPerTurn = minigamesPerTurn;
```

(Keep the existing `private minigamesPerTurn: number;` field declaration above the constructor.)

In `defaultState()`, add the field next to `minigamesCompleted: 0,`:

```ts
      minigamesCompleted: 0,
      minigamesPerTurn: this.defaultMinigamesPerTurn,
```

- [ ] **Step 5: Set the count in `startTurn`**

In `startTurn`, change the signature and set both the field and state. Replace:

```ts
  startTurn(question: QuestionType): void {
    this.affinityEngine.beginRun();

    this.state.screen = 'method-select';
    this.state.questionType = question;
```

with:

```ts
  startTurn(question: QuestionType, methodCount?: number): void {
    this.affinityEngine.beginRun();

    this.minigamesPerTurn = methodCount ?? this.defaultMinigamesPerTurn;
    this.state.minigamesPerTurn = this.minigamesPerTurn;
    this.state.screen = 'method-select';
    this.state.questionType = question;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/GameLength.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Full engine suite + typecheck stay green**

Run: `npm test`
Expected: PASS (no regressions).
Run: `npm run build`
Expected: typecheck passes.

- [ ] **Step 8: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/types.ts src/engine/__tests__/GameLength.test.ts
git commit -m "feat(engine): per-turn method count (game length)"
```

---

### Task 2: Question-select segmented depth control (UI)

**Files:**
- Modify: `src/components/screens/QuestionSelect.tsx` (whole file)
- Verify: `npm run build` + manual

**Interfaces:**
- Consumes: `engine.startTurn(type, count)` from Task 1.

- [ ] **Step 1: Add the tier model + depth state**

In `src/components/screens/QuestionSelect.tsx`, add below the existing `QUESTIONS` constant:

```tsx
interface DepthTier { count: number; name: string; flavor: string; }
const DEPTH_TIERS: DepthTier[] = [
  { count: 3, name: 'Glimpse',         flavor: 'A brief glance through the veil.' },
  { count: 5, name: 'Reading',         flavor: 'A measured consultation.' },
  { count: 7, name: 'Deep Divination', flavor: 'A long descent into deeper waters.' },
];
const DEFAULT_TIER_INDEX = 1; // Reading (5)
```

- [ ] **Step 2: Hold the selected tier and pass it to `startTurn`**

Replace the component body up to the `return (`:

```tsx
export default function QuestionSelect() {
  const { engine } = useGameEngine();
  const [tierIndex, setTierIndex] = useState(DEFAULT_TIER_INDEX);
  const tier = DEPTH_TIERS[tierIndex];

  const handleSelect = (questionType: QuestionType) => {
    engine.startTurn(questionType, tier.count);
  };
```

Add `useState` to the React import at the top:

```tsx
import { useState } from 'react';
```

- [ ] **Step 3: Insert the segmented depth control between heading and grid**

In the JSX, after the `headingSectionStyle` block (the `</div>` that closes the heading section) and before the `motion.div` with `gridStyle`, insert:

```tsx
        <div style={depthBlockStyle}>
          <div style={depthLabelStyle}>— Depth of the Reading —</div>
          <div style={tierBarStyle} role="radiogroup" aria-label="Depth of the reading">
            {DEPTH_TIERS.map((t, i) => (
              <button
                key={t.name}
                type="button"
                role="radio"
                aria-checked={i === tierIndex}
                onClick={() => setTierIndex(i)}
                style={{ ...segStyle, ...(i > 0 ? segDividerStyle : null), ...(i === tierIndex ? segSelStyle : null) }}
              >
                <span style={{ ...segNameStyle, ...(i === tierIndex ? segNameSelStyle : null) }}>{t.name}</span>
                <span style={pipsStyle}>
                  {Array.from({ length: t.count }).map((_, p) => (
                    <span key={p} style={{ ...pipStyle, ...(i === tierIndex ? pipSelStyle : null) }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <div style={depthDescStyle}>{tier.flavor}</div>
        </div>
```

- [ ] **Step 4: Add the styles**

Append these style constants at the end of the `// ── Styles ──` block:

```tsx
const depthBlockStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
};
const depthLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.58rem', letterSpacing: '0.26em',
  textTransform: 'uppercase', color: '#5b7290',
};
const tierBarStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'stretch', border: '1px solid #2a3354',
  borderRadius: '999px', overflow: 'hidden', background: '#0a0e18',
  boxShadow: 'inset 0 0 26px rgba(0,0,0,0.5)',
};
const segStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  padding: '0.5rem 1.4rem 0.55rem', cursor: 'pointer', background: 'transparent',
  border: 'none', outline: 'none', fontFamily: 'inherit',
  transition: 'background 0.25s ease',
};
const segDividerStyle: React.CSSProperties = { borderLeft: '1px solid #1c2238' };
const segSelStyle: React.CSSProperties = {
  background: 'radial-gradient(120% 130% at 50% 0%, rgba(212,168,84,0.16), rgba(212,168,84,0.03) 70%)',
};
const segNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.92rem',
  letterSpacing: '0.05em', color: '#9fb2cf', whiteSpace: 'nowrap',
};
const segNameSelStyle: React.CSSProperties = {
  color: '#f0d595', textShadow: '0 0 10px rgba(212,168,84,0.4)',
};
const pipsStyle: React.CSSProperties = { display: 'flex', gap: '3px' };
const pipStyle: React.CSSProperties = {
  width: '4px', height: '4px', borderRadius: '50%', background: '#39435f',
};
const pipSelStyle: React.CSSProperties = {
  background: '#d4a854', boxShadow: '0 0 5px rgba(212,168,84,0.7)',
};
const depthDescStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#7b9ec7',
  fontSize: '0.82rem', textAlign: 'center', minHeight: '1.2em', letterSpacing: '0.02em',
};
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. On the question-select screen: confirm the segmented control shows Glimpse/Reading/Deep Divination with Reading preselected, the flavor line updates on click, no card/corruption wording appears, and picking a question starts the turn. With the debug panel (`?debug`) confirm `state.minigamesPerTurn` matches the chosen tier.

- [ ] **Step 7: Commit**

```bash
git add src/components/screens/QuestionSelect.tsx
git commit -m "feat(ui): game-length depth selector on question-select"
```

---

# Phase 2 — Narrative voice (engine)

### Task 3: Per-affinity notes for all six affinities

**Files:**
- Modify: `src/engine/NarrativeAssembler.ts` (`assemble`, ~53-68)
- Modify: `docs/game-systems.md`
- Test: `src/engine/__tests__/NarrativeAssembler.test.ts` (add cases)

**Interfaces:**
- Produces: `assemble(...)` returns `affinityNote` chosen from the most-elevated of the six affinities (tie-break order chaos, order, fate, will, light, shadow); clarity reframe preserved.

- [ ] **Step 1: Write the failing tests**

In `src/engine/__tests__/NarrativeAssembler.test.ts`, add inside the existing top-level `describe` (after the "high order" test ~216):

```ts
  it('affinity note appears for high fate', () => {
    const r = assembler.assemble(baseAggregated, [], 'decision', { fate: 80, will: 20 });
    expect(r.affinityNote).toContain('Fate');
  });

  it('affinity note appears for high will', () => {
    const r = assembler.assemble(baseAggregated, [], 'decision', { will: 80, fate: 20 });
    expect(r.affinityNote).toContain('will');
  });

  it('the most-elevated affinity wins when several are high', () => {
    const r = assembler.assemble(baseAggregated, [], 'decision', { chaos: 70, fate: 95 });
    expect(r.affinityNote).toContain('Fate'); // fate (95) outranks chaos (70)
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts -t "high fate"`
Expected: FAIL — affinityNote is undefined for fate.

- [ ] **Step 3: Generalize the note selection**

In `src/engine/NarrativeAssembler.ts`, replace the affinity-note block (currently lines ~53-68):

```ts
    // Affinity note — elevated when Chaos/Order reach Ascendant or higher.
    let affinityNote: string | undefined;
    const chaosBand = bandOf(affinities.chaos ?? 0);
    const orderBand = bandOf(affinities.order ?? 0);
    const isElevated = (b: string) => b === 'ascendant' || b === 'dominant';
    if (isElevated(chaosBand)) {
      affinityNote = 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.';
    } else if (isElevated(orderBand)) {
      affinityNote = 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.';
    }
    const clarity = effects?.hintClarity ?? 0;
    if (clarity >= 2 && affinityNote) {
      affinityNote = `The forces name themselves plainly: ${affinityNote}`;
    } else if (clarity <= -2 && affinityNote) {
      affinityNote = 'Something stirs beneath the surface, but its name will not come.';
    }
```

with:

```ts
    // Affinity note — the most-elevated of the six affinities speaks (Ascendant+).
    const affinityNote = pickAffinityNote(affinities, effects?.hintClarity ?? 0);
```

Then add, above the `class NarrativeAssembler` declaration (after the imports):

```ts
import type { AffinityId } from './types';

// Each affinity's voice, surfaced when it is the most-elevated force in the reading.
const AFFINITY_NOTES: Record<AffinityId, string> = {
  chaos: 'The currents of chaos run strong. Expect the unexpected — these readings carry extra volatility.',
  order: 'Order shapes this reading with unusual clarity. The patterns are steady and reliable.',
  fate:  'Fate draws the thread taut — what is shown here carries the weight of the already-written.',
  will:  'Your will presses against the omens; nothing here is fixed that your own hand cannot move.',
  light: 'Light lies plainly across the reading — the forces consent to be named.',
  shadow:'Shadow keeps its counsel; what is shown is the smaller truth, the larger one withheld.',
};
// Tie-break order when several affinities share the top value.
const AFFINITY_PRIORITY: AffinityId[] = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];

function pickAffinityNote(affinities: Record<string, number>, clarity: number): string | undefined {
  const elevated = AFFINITY_PRIORITY
    .map((id) => ({ id, value: affinities[id] ?? 0, band: bandOf(affinities[id] ?? 0) }))
    .filter((a) => a.band === 'ascendant' || a.band === 'dominant')
    .sort((a, b) => b.value - a.value); // priority order is preserved on ties (stable sort)
  if (elevated.length === 0) return undefined;
  let note = AFFINITY_NOTES[elevated[0].id];
  // Light's clarity reframe (preserved): plainly-named at high clarity, occluded at low.
  if (clarity >= 2) note = `The forces name themselves plainly: ${note}`;
  else if (clarity <= -2) note = 'Something stirs beneath the surface, but its name will not come.';
  return note;
}
```

- [ ] **Step 4: Run the narrative tests**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS — including the existing chaos/order/`name themselves` cases (unchanged behavior) and the three new ones.

- [ ] **Step 5: Update `docs/game-systems.md`**

In the affinities/synthesis section that documents the affinity note, replace the chaos/order-only description with: all six affinities now have a note; the most-elevated (Ascendant+) speaks, tie-broken in the order chaos→order→fate→will→light→shadow; Light's high `hintClarity` still prefixes "The forces name themselves plainly:", low clarity still replaces with the "Something stirs beneath the surface" line. (Match the file's existing prose style.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/NarrativeAssembler.ts src/engine/__tests__/NarrativeAssembler.test.ts docs/game-systems.md
git commit -m "feat(engine): every affinity gets a synthesis voice"
```

---

### Task 4: Entity voice replaces the note at Virulent+

**Files:**
- Modify: `src/engine/CorruptionGlitch.ts` (add `entityVoiceNote`)
- Modify: `src/engine/GameEngine.ts` (synthesis step ~774-787)
- Modify: `docs/game-systems.md`
- Test: `src/engine/__tests__/CorruptionGlitch.test.ts` (add) + `src/engine/__tests__/NarrativeVoice.test.ts` (create)

**Interfaces:**
- Produces: `entityVoiceNote(rng: () => number): string` — returns one of the entity declarations.
- Behavior: at corruption band `virulent`/`pinnacle`, `state.synthesis.affinityNote` is replaced by an entity declaration before glitch segmentation.

- [ ] **Step 1: Write the failing helper test**

In `src/engine/__tests__/CorruptionGlitch.test.ts`, add:

```ts
import { entityVoiceNote } from '../CorruptionGlitch';

describe('entity voice', () => {
  it('returns one of the entity declarations', () => {
    const pool = [
      'It watches. It is pleased.',
      'Expect us.',
      'The card you did not draw speaks the loudest.',
      'This reading was never yours.',
    ];
    expect(pool).toContain(entityVoiceNote(() => 0));
    expect(pool).toContain(entityVoiceNote(() => 0.99));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitch.test.ts -t "entity voice"`
Expected: FAIL — `entityVoiceNote` is not exported.

- [ ] **Step 3: Add the helper**

In `src/engine/CorruptionGlitch.ts`, after the `WHISPERS` constant (~27), add:

```ts
// The entity speaking in its own voice — replaces the affinity note at Virulent+.
const ENTITY_VOICE = [
  'It watches. It is pleased.',
  'Expect us.',
  'The card you did not draw speaks the loudest.',
  'This reading was never yours.',
];

export function entityVoiceNote(rng: () => number): string {
  return ENTITY_VOICE[Math.floor(rng() * ENTITY_VOICE.length)];
}
```

- [ ] **Step 4: Write the failing engine integration test**

Create `src/engine/__tests__/NarrativeVoice.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

const ENTITY = [
  'It watches. It is pleased.',
  'Expect us.',
  'The card you did not draw speaks the loudest.',
  'This reading was never yours.',
];

describe('entity voice replaces the affinity note at Virulent+', () => {
  it('a Virulent reading speaks in the entity voice, not the affinity line', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const e = new GameEngine(1); // single reading IS the final reading
    e.startTurn('self', 1);
    e.loadState({ affinities: { chaos: 95, order: 50, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); // virulent
    oneReading(e);
    expect(ENTITY).toContain(e.getState().synthesis?.affinityNote);
  });

  it('below Virulent the affinity line is unchanged', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // suppress seeding
    const e = new GameEngine(1);
    e.startTurn('self', 1);
    e.loadState({ affinities: { chaos: 95, order: 50, fate: 50, will: 50, light: 50, shadow: 50 } });
    oneReading(e);
    expect(e.getState().synthesis?.affinityNote).toContain('chaos');
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/NarrativeVoice.test.ts`
Expected: FAIL on the Virulent case — affinityNote still the chaos line.

- [ ] **Step 6: Wire the replacement into the synthesis step**

In `src/engine/GameEngine.ts`, import the helper (extend the existing import on line 11):

```ts
import { corruptionTextLevel, corruptSynthesisSegments, corruptText, appendSeedOmen, entityVoiceNote } from './CorruptionGlitch';
```

Then in the synthesis step, replace:

```ts
    } else {
      const cLevel = corruptionTextLevel(band, this.corruptionEngine.getValue());
      if (cLevel > 0) {
```

with:

```ts
    } else {
      // Virulent+: the entity speaks over the affinity note before glitch segmentation.
      if ((band === 'virulent' || band === 'pinnacle') && this.state.synthesis.affinityNote !== undefined) {
        this.state.synthesis = { ...this.state.synthesis, affinityNote: entityVoiceNote(Math.random) };
      }
      const cLevel = corruptionTextLevel(band, this.corruptionEngine.getValue());
      if (cLevel > 0) {
```

> Note: the entity line only replaces when an affinity note already exists (an affinity is elevated). If no affinity is elevated there is no note to overwrite — acceptable for this scope; a guaranteed entity line regardless of affinity is out of scope (see spec §11).

- [ ] **Step 7: Run all the new + existing corruption/narrative tests**

Run: `npx vitest run src/engine/__tests__/NarrativeVoice.test.ts src/engine/__tests__/CorruptionGlitch.test.ts`
Expected: PASS.
Run: `npm test`
Expected: PASS (no regressions).

- [ ] **Step 8: Update `docs/game-systems.md`**

Document: at corruption Virulent/Pinnacle the affinity note is replaced by the corruption entity's own voice (a short declaration), distinct from the per-word glitch styling applied to the rest of the reading.

- [ ] **Step 9: Commit**

```bash
git add src/engine/CorruptionGlitch.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionGlitch.test.ts src/engine/__tests__/NarrativeVoice.test.ts docs/game-systems.md
git commit -m "feat(engine): corruption entity voice replaces the affinity note at Virulent+"
```

---

# Phase 3 — Results presentation rework (UI)

### Task 5: `ResultTile` component (uniform tile + Design-A spread)

**Files:**
- Create: `src/components/cards/ResultTile.tsx`
- Verify: `npm run build`

**Interfaces:**
- Produces: `export default function ResultTile({ result, index, onOpen }: { result: SlotResult; index: number; onOpen: () => void })` — one uniform grid tile; a multi-position tarot spread renders the triangle, everything else renders one sigil + name + meta.

- [ ] **Step 1: Create the component**

```tsx
import type { SlotResult, TarotResult } from '../../engine/types';
import CardSigil from './CardSigil';
import AstralSigil from './AstralSigil';
import RuneSigil from './RuneSigil';
import StringSigil from './StringSigil';
import { HOUSES } from '../../data/astromancy';

const POS = [
  { key: 'present', color: '#d4a854' },
  { key: 'past', color: '#7b9ec7' },
  { key: 'future', color: '#9b6bb0' },
] as const;

// Sigil node for a result (mirrors CardReadingDetail's symbol logic).
function Sigil({ result, size }: { result: SlotResult; size: number }) {
  switch (result.type) {
    case 'astral': return <AstralSigil kind="planet" id={result.planet} size={size} />;
    case 'rune': return <RuneSigil rune={result.rune} orientation={result.orientation} size={size} />;
    case 'tarot': return <CardSigil card={result} size={size - 4} color="#d4a854" />;
    case 'strings': return <StringSigil glyph={result.symbol} state="lit" size={size - 2} />;
    default: return <span style={{ fontSize: size, color: '#d4a854', lineHeight: 1 }}>{symbolFor(result)}</span>;
  }
}

function symbolFor(r: SlotResult): string {
  switch (r.type) {
    case 'd20': return String.fromCodePoint(0x2685);
    case 'iching': return r.symbol;
    case 'happening': return String.fromCodePoint(0x2726);
    default: return '✦';
  }
}

function nameFor(r: SlotResult): string {
  switch (r.type) {
    case 'd20': return `D20 · ${r.result}`;
    case 'iching': return `Hexagram ${r.hexagramNumber}`;
    case 'happening': return 'Happening';
    default: return (r as { name?: string }).name ?? '—';
  }
}

function metaFor(r: SlotResult): { text: string; rev?: boolean } {
  switch (r.type) {
    case 'tarot': return { text: r.orientation === 'upright' ? '▲ Upright' : '▼ Reversed', rev: r.orientation === 'reversed' };
    case 'd20': return { text: r.threshold.replace('-', ' ') };
    case 'iching': return { text: r.name };
    case 'rune': return { text: `${r.orientation === 'upright' ? '▲' : '▼'} ${r.ring}` , rev: r.orientation !== 'upright' };
    case 'astral': return { text: HOUSES[r.house - 1]?.arena ?? `House ${r.house}` };
    case 'strings': return { text: 'Woven' };
    default: return { text: '' };
  }
}

export default function ResultTile({ result, index, onOpen }: { result: SlotResult; index: number; onOpen: () => void }) {
  const spread = result.type === 'tarot' ? (result as TarotResult).spread : undefined;
  const isSpread = !!spread && spread.length > 1;

  return (
    <button type="button" onClick={onOpen} style={tileStyle} className="result-tile">
      <span style={idxStyle}>{index + 1}</span>
      {isSpread ? (
        <div style={triStyle}>
          {/* Present (apex), then Past + Future on the base row. */}
          {(() => {
            const byPos = (k: string) => spread!.find((s) => s.position === k)?.card;
            const present = byPos('present');
            const past = byPos('past');
            const future = byPos('future');
            const cluster = (face: typeof present, color: string) => face && (
              <div style={cluStyle}>
                <CardSigil card={face} size={20} color={color} />
                <span style={cluNameStyle}>{face.name}</span>
                <span style={{ ...cluOrientStyle, color }}>{face.orientation === 'upright' ? '▲' : '▼'}</span>
              </div>
            );
            return (
              <>
                {cluster(present, POS[0].color)}
                <div style={triRowStyle}>
                  {cluster(past, POS[1].color)}
                  {cluster(future, POS[2].color)}
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <>
          <div style={sigilStyle}><Sigil result={result} size={32} /></div>
          <span style={nameStyle}>{nameFor(result)}</span>
          {(() => { const m = metaFor(result); return <span style={{ ...metaStyle, ...(m.rev ? metaRevStyle : null) }}>{m.text}</span>; })()}
        </>
      )}
    </button>
  );
}

const tileStyle: React.CSSProperties = {
  position: 'relative', minHeight: '112px', background: '#0d1220', border: '1px solid #1a2440',
  borderRadius: '7px', padding: '0.7rem 0.45rem', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease',
};
const idxStyle: React.CSSProperties = {
  position: 'absolute', top: '6px', left: '8px', fontFamily: "'Inter', sans-serif",
  fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: '#5b7290',
};
const sigilStyle: React.CSSProperties = { fontSize: '1.95rem', color: '#d4a854', lineHeight: 1 };
const nameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.82rem',
  color: '#c8d8f0', textAlign: 'center', lineHeight: 1.12,
};
const metaStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '0.52rem', letterSpacing: '0.13em',
  textTransform: 'uppercase', color: '#7b9ec7', textAlign: 'center',
};
const metaRevStyle: React.CSSProperties = { color: '#d4a854' };
const triStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.34rem' };
const triRowStyle: React.CSSProperties = { display: 'flex', gap: '0.85rem' };
const cluStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 };
const cluNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.52rem',
  color: '#c8d8f0', lineHeight: 1.04, textAlign: 'center', maxWidth: '52px', marginTop: '1px',
};
const cluOrientStyle: React.CSSProperties = { fontSize: '0.5rem', lineHeight: 1 };
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS. (If `SlotResult` field names differ for a type, fix against `src/engine/types.ts` — confirm `result.symbol`/`name`/`orientation`/`ring`/`house`/`planet`/`rune` per the `getResultDisplay` switch in `CardReadingDetail.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/ResultTile.tsx
git commit -m "feat(ui): uniform ResultTile with Design-A triangle spread tile"
```

---

### Task 6: Rework `ResultReading` (hero + tile grid + tap-to-expand)

**Files:**
- Modify: `src/components/screens/ResultReading.tsx`
- Modify: `src/components/cards/CardReadingDetail.tsx` (position accents on the expanded spread)
- Verify: `npm run build` + manual `?debug`

**Interfaces:**
- Consumes: `ResultTile` (Task 5), existing `CardDetailModal({ result, onClose })`, `state.minigamesPerTurn` (Task 1).

- [ ] **Step 1: Add modal + hero state and the tile grid**

In `src/components/screens/ResultReading.tsx`:

Add imports:

```tsx
import ResultTile from '../cards/ResultTile';
import CardDetailModal from '../overlays/CardDetailModal';
import type { SlotResult } from '../../engine/types';
```

Add open-result state next to the existing `useState` hooks:

```tsx
  const [openResult, setOpenResult] = useState<SlotResult | null>(null);
```

Replace the existing Divination Results block:

```tsx
        {/* Divination Results */}
        {turnResults.length > 0 && (
          <div style={resultsGridStyle}>
            {turnResults.map((r, i) => (
              <CardReadingDetail key={i} result={r} index={i} />
            ))}
          </div>
        )}
```

with:

```tsx
        {/* THE CARDS — compact, tap-to-expand tiles */}
        {turnResults.length > 0 && (
          <div style={cardsBlockStyle}>
            <div style={cardsHeaderStyle}>The Cards · {turnResults.length}</div>
            <div style={tileGridStyle}>
              {turnResults.map((r, i) => (
                <ResultTile key={i} result={r} index={i} onOpen={() => setOpenResult(r)} />
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 2: Render the detail modal**

Just before the final closing of the component (next to `{historyOpen && <HistoryModal ... />}`), add:

```tsx
      {openResult && <CardDetailModal result={openResult} onClose={() => setOpenResult(null)} />}
```

- [ ] **Step 3: Wrap the synthesis in the hero panel**

Wrap the existing `{synthesis && (...)}` block's inner content so the synthesis section uses `synthesisHeroStyle` instead of `synthesisSectionStyle` (rename the style applied to that container), and keep the `INTERPRETATION` title, headline, paragraphs, tension, affinity-note exactly as they are.

- [ ] **Step 4: Add/replace styles**

Replace `resultsGridStyle` and add the new styles:

```tsx
const cardsBlockStyle: React.CSSProperties = {
  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
};
const cardsHeaderStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', letterSpacing: '0.26em',
  textTransform: 'uppercase', color: '#5b7290',
};
const tileGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
  gap: '0.55rem', width: '100%',
};
const synthesisHeroStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%',
  background: 'linear-gradient(180deg, rgba(20,28,52,0.45), rgba(13,18,32,0.15))',
  border: '1px solid rgba(40,54,92,0.7)', borderRadius: '8px',
  padding: '1.1rem 1.05rem 1.15rem', boxSizing: 'border-box',
};
```

Add a hover rule for tiles via a one-line style tag is not idiomatic here; instead add this to `src/styles/corruption.css` is wrong scope. Add a small global rule in `src/index.css` (or the existing global stylesheet):

```css
.result-tile:hover { border-color: #d4a854 !important; box-shadow: 0 0 18px rgba(212,168,84,0.22); transform: translateY(-2px); }
```

(Confirm the global stylesheet path; the project imports a global CSS in `src/main.tsx` — add the rule there.)

- [ ] **Step 5: Position accents on the expanded spread (CardReadingDetail)**

In `src/components/cards/CardReadingDetail.tsx`, in the `d.subCards` map, color each position by accent: Past `#7b9ec7`, Present `#d4a854`, Future `#9b6bb0`. Change the `position` label color and the `CardSigil` color to use a lookup:

```tsx
const POS_ACCENT: Record<string, string> = { Past: '#7b9ec7', Present: '#d4a854', Future: '#9b6bb0' };
```

and apply `POS_ACCENT[sc.position] ?? '#d4a854'` to the position-label `color` and the `CardSigil` `color`. (Keep all other markup.)

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Manual verification (?debug injection)**

Run `npm run dev`, open with `?debug`, inject a finished 7-method reading (one tarot spread + 6 others) via the JsonInjector + `engine.loadState` (repro-game-state memory). Confirm: synthesis is a framed hero; tiles are uniform and reflow 2-up at narrow widths; the spread tile shows the triangle with names; tapping any tile opens `CardDetailModal` with the full breakdown (spread shows Past/Present/Future with accents); `The Cards · 7` header is correct.

- [ ] **Step 8: Commit**

```bash
git add src/components/screens/ResultReading.tsx src/components/cards/CardReadingDetail.tsx src/main.tsx
git commit -m "feat(ui): compact results — synthesis hero + tap-to-expand tile grid"
```

---

# Phase 4 — Corruption presentation (UI/CSS)

### Task 7: Corruption tile primitives (CSS)

**Files:**
- Modify: `src/styles/corruption.css` (append)
- Verify: `npm run build`

- [ ] **Step 1: Append the primitives**

At the end of `src/styles/corruption.css`:

```css
/* ════════ Phase-3b results-tile corruption ════════ */
/* tainted result tile (a corrupted draw) */
.cx-tile-tainted{border-color:var(--cx-red) !important;box-shadow:0 0 18px #ff2d4a55,inset 0 0 22px #ff2d4a22;background:#160810 !important}
.cx-tile-tainted .cx-tile-name{color:#fff;text-shadow:0 0 7px var(--cx-red);animation:cx-capulse 2.4s ease-in-out infinite}

/* random sigil chromatic aberration (red↔void, never cyan); staggered = feels random */
.cx-sig{animation:cx-sig-ca 6.5s ease-in-out infinite}
.cx-sig.d1{animation-duration:5.2s;animation-delay:.6s}
.cx-sig.d2{animation-duration:7.8s;animation-delay:1.9s}
.cx-sig.d3{animation-duration:4.4s;animation-delay:3.1s}
@keyframes cx-sig-ca{
  0%,80%,100%{filter:drop-shadow(0 0 6px rgba(255,45,74,.3))}
  84%{filter:drop-shadow(-2px 0 var(--cx-red)) drop-shadow(2px 0 #1a0006)}
  88%{filter:drop-shadow(2px 0 var(--cx-red-deep)) drop-shadow(-2px 0 var(--cx-void))}
  92%{filter:drop-shadow(-1px 0 var(--cx-red))}
}

/* live word-swap: a clean word briefly replaced by a more-distorted variant */
.cx-swap{position:relative;display:inline-block;white-space:nowrap}
.cx-swap .cx-v1{position:absolute;left:0;top:0;opacity:0;color:#fff;text-shadow:0 0 6px var(--cx-red)}
.cx-swap.a .cx-v0{animation:cx-sw0 6.2s steps(1) infinite}.cx-swap.a .cx-v1{animation:cx-sw1 6.2s steps(1) infinite}
.cx-swap.b .cx-v0{animation:cx-sw0 8.1s steps(1) infinite 2.4s}.cx-swap.b .cx-v1{animation:cx-sw1 8.1s steps(1) infinite 2.4s}
.cx-swap.c .cx-v0{animation:cx-sw0 5.3s steps(1) infinite 1.2s}.cx-swap.c .cx-v1{animation:cx-sw1 5.3s steps(1) infinite 1.2s}
@keyframes cx-sw0{0%,85%,100%{opacity:1}87%{opacity:0}95%{opacity:0}97%{opacity:1}}
@keyframes cx-sw1{0%,85%,100%{opacity:0}87%{opacity:1}95%{opacity:1}97%{opacity:0}}
```

- [ ] **Step 2: Typecheck/build (CSS imported, no TS impact)**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/corruption.css
git commit -m "feat(css): corruption tile primitives — tainted tile, sigil aberration, word-swap"
```

---

### Task 8: Wire corruption presentation into the tiles + synthesis

**Files:**
- Modify: `src/components/cards/ResultTile.tsx`
- Modify: `src/components/screens/ResultReading.tsx` (GlitchText)
- Verify: `npm run build` + manual

**Interfaces:**
- Consumes: `CORRUPTED_TAG` from `../../data/corruption`; the `cx-*` classes from Task 7; `state.corruption.band`.

- [ ] **Step 1: Tainted tile + random sigil aberration in `ResultTile`**

In `src/components/cards/ResultTile.tsx`, extend props and apply classes:

```tsx
import { CORRUPTED_TAG } from '../../data/corruption';
```

Change the signature to accept the corruption band:

```tsx
export default function ResultTile({ result, index, onOpen, corruptionBand }:
  { result: SlotResult; index: number; onOpen: () => void; corruptionBand: string }) {
  const tainted = result.tags?.includes(CORRUPTED_TAG);
  const virulent = corruptionBand === 'virulent' || corruptionBand === 'pinnacle';
  // Deterministic-ish "random" aberration: a few tiles by index parity.
  const sigCa = virulent ? ['', ' cx-sig', ' cx-sig d1', '', ' cx-sig d2', ' cx-sig d3'][index % 6] : '';
```

Apply on the `button`: `className={`result-tile${tainted ? ' cx-tile-tainted' : ''}`}`. Add `cx-tile-name` to the single-method `nameStyle` span: `className="cx-tile-name"`. Wrap the single sigil node so the aberration class lands on it:

```tsx
          <div style={sigilStyle} className={sigCa.trim() || undefined}><Sigil result={result} size={32} /></div>
```

- [ ] **Step 2: Pass the band from `ResultReading`**

In `ResultReading.tsx` update the tile render:

```tsx
                <ResultTile key={i} result={r} index={i} corruptionBand={corruption.band} onOpen={() => setOpenResult(r)} />
```

(`corruption` is already destructured from `state`.)

- [ ] **Step 3: Live word-swap in `GlitchText`**

In `ResultReading.tsx`, extend `GlitchText` so segments styled `hot` or `ca-fast` (the "loud" ones) also live-swap to a garbled variant at Virulent+. Replace the `GlitchText` function:

```tsx
const COMBINING = ['̵', '̶', '̷', '̸'];
function garbleWord(s: string): string {
  let out = '';
  for (const ch of s) { out += ch; if (/\w/.test(ch) && ch.charCodeAt(0) % 3 === 0) out += COMBINING[ch.charCodeAt(0) % COMBINING.length]; }
  return out;
}
function GlitchText({ segments, swap }: { segments: GlitchSegment[]; swap?: boolean }) {
  let swapN = 0;
  return (
    <>
      {segments.map((s, i) => {
        if (!s.style) return <span key={i}>{s.text}</span>;
        const cls = GLITCH_CLASS[s.style];
        if (swap && (s.style === 'hot' || s.style === 'ca-fast')) {
          const lane = ['a', 'b', 'c'][swapN++ % 3];
          return (
            <span key={i} className={`${cls} cx-swap ${lane}`}>
              <span className="cx-v0">{s.text}</span>
              <span className="cx-v1">{garbleWord(s.text)}</span>
            </span>
          );
        }
        return <span key={i} className={cls}>{s.text}</span>;
      })}
    </>
  );
}
```

Pass `swap={corrupted}` to the headline/paragraph/tension `GlitchText` calls (the `corrupted` boolean already exists in the component).

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Inject a Virulent reading (`engine.setCorruption(80)` then a completed reading via `?debug`, or `loadState`). Confirm: scanline/vignette/mosh overlay present (existing); a couple of tile sigils chromatically split on a stagger; tainted draws show red border + white-hot name; "hot"/"ca-fast" synthesis words briefly swap to a garbled variant; everything stays legible. Confirm a clean (dormant) reading shows none of it.

- [ ] **Step 6: Commit**

```bash
git add src/components/cards/ResultTile.tsx src/components/screens/ResultReading.tsx
git commit -m "feat(ui): corruption presentation on results — tainted tiles, sigil aberration, live word-swap"
```

---

# Phase 5 — Share image (UI)

### Task 9: `ShareCard` component (clean 4:5)

**Files:**
- Create: `src/components/share/ShareCard.tsx`
- Verify: `npm run build`

**Interfaces:**
- Produces: `export default function ShareCard({ state }: { state: GameState })` — a fixed 380×475 (4:5) node rendering the reading.

- [ ] **Step 1: Create the component**

```tsx
import type { GameState, SlotResult, TarotResult } from '../../engine/types';
import { bandOf } from '../../data/affinities';

const W = 380, H = 475;

function questionLabel(qt: string | null): string {
  switch (qt) {
    case 'decision': return 'Decision';
    case 'relationship': return 'Relationship';
    case 'future': return 'Future / Forecast';
    case 'self': return 'Self-Analysis';
    default: return 'A Reading';
  }
}
function firstSentence(p?: string): string | undefined {
  if (!p) return undefined;
  const m = p.match(/^[^.!?]+[.!?]/);
  return (m ? m[0] : p).trim();
}
function rowFor(r: SlotResult): { sigil: string; name: string; meta: string } {
  switch (r.type) {
    case 'tarot': {
      const sp = (r as TarotResult).spread;
      if (sp && sp.length > 1) {
        const by = (k: string) => sp.find((s) => s.position === k)?.card;
        const o = (c?: { orientation: string }) => c ? (c.orientation === 'upright' ? '▲' : '▼') : '';
        return { sigil: '✶', name: 'Tarot Spread', meta: `${by('past')?.name} ${o(by('past'))} · ${by('present')?.name} ${o(by('present'))} · ${by('future')?.name} ${o(by('future'))}` };
      }
      return { sigil: r.symbol, name: r.name, meta: r.orientation === 'upright' ? '▲ Upright' : '▼ Reversed' };
    }
    case 'd20': return { sigil: '⚅', name: `D20 · ${r.result}`, meta: r.threshold.replace('-', ' ') };
    case 'iching': return { sigil: r.symbol, name: `Hexagram ${r.hexagramNumber} · ${r.name}`, meta: 'Judgment' };
    case 'astral': return { sigil: r.symbol, name: r.name, meta: r.aspect };
    case 'rune': return { sigil: r.symbol, name: r.name, meta: r.orientation === 'upright' ? '▲ Upright' : '▼ Merkstave' };
    case 'strings': return { sigil: r.symbol, name: r.name, meta: 'Woven' };
    default: return { sigil: '✦', name: '—', meta: '' };
  }
}
function affinityBadge(aff: Record<string, number>): string | null {
  const ids = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];
  const top = ids
    .map((id) => ({ id, v: aff[id] ?? 0, band: bandOf(aff[id] ?? 0) }))
    .filter((a) => a.band === 'ascendant' || a.band === 'dominant')
    .sort((a, b) => b.v - a.v)[0];
  if (!top) return null;
  return `${top.id[0].toUpperCase()}${top.id.slice(1)} ${top.band}`;
}

export default function ShareCard({ state }: { state: GameState }) {
  const { turnResults, synthesis, questionType, affinities } = state;
  const reading = turnResults.filter((r) => r.type !== 'happening');
  const interp = synthesis?.tensionNote ?? firstSentence(synthesis?.paragraphs?.[0]);
  const badge = affinityBadge(affinities);

  return (
    <div style={cardStyle}>
      <div style={padStyle}>
        <div style={qStyle}>{questionLabel(questionType)}</div>
        <div style={ornStyle}><span style={ornStarStyle}>✦</span></div>
        <div style={headlineStyle}>{synthesis?.headline ?? 'Your Reading'}</div>
        {interp && <div style={tensionStyle}><p style={tensionTextStyle}>{interp}</p></div>}
        <div style={cardsHdrStyle}>The Cards · {reading.length}</div>
        <div style={listStyle}>
          {reading.map((r, i) => {
            const row = rowFor(r);
            return (
              <div key={i} style={rowStyle}>
                <span style={rowSigilStyle}>{row.sigil}</span>
                <span style={rowNameStyle}>{row.name}</span>
                <span style={rowMetaStyle}>{row.meta}</span>
              </div>
            );
          })}
        </div>
        {badge && <div style={badgeStyle}>{badge}</div>}
        <div style={spacerStyle} />
        <div style={footerStyle}>
          <div style={wmStyle}>
            <span style={wmAtlasStyle}>ATLAS</span><span style={wmOfStyle}>of</span><span style={wmFateStyle}>FATE</span>
          </div>
          <div style={footTagStyle}>the stars await your question</div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  position: 'relative', overflow: 'hidden', width: W, height: H, borderRadius: 14, border: '1px solid #1a2440',
  background: 'radial-gradient(120% 55% at 50% -6%, rgba(40,60,110,0.28), transparent 55%), radial-gradient(90% 50% at 50% 112%, rgba(150,110,50,0.14), transparent 60%), linear-gradient(180deg,#080c16,#05070e)',
};
const padStyle: React.CSSProperties = { padding: '22px 22px 16px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const qStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#d4a854', fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase' };
const ornStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', width: '64%', color: '#d4a854', opacity: 0.6, margin: '2px 0' };
const ornStarStyle: React.CSSProperties = { fontSize: '0.5rem' };
const headlineStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: '#eaf1ff', fontSize: '1.26rem', lineHeight: 1.22, textAlign: 'center', margin: '4px 2px 2px' };
const tensionStyle: React.CSSProperties = { position: 'relative', width: '100%', background: '#0d1220', borderRadius: 6, padding: '0.55rem 0.8rem', marginTop: 4 };
const tensionTextStyle: React.CSSProperties = { margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: 300, fontStyle: 'italic', color: '#cdd9ec', fontSize: '0.72rem', lineHeight: 1.5, textAlign: 'left' };
const cardsHdrStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#5b7290', marginTop: 9 };
const listStyle: React.CSSProperties = { width: '100%', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 5 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '5px 9px', background: '#0a1018', border: '1px solid #1a2440', borderRadius: 6 };
const rowSigilStyle: React.CSSProperties = { fontSize: '1.05rem', lineHeight: 1, width: 20, textAlign: 'center', color: '#d4a854', flex: 'none' };
const rowNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.82rem', color: '#c8d8f0', flex: 1, textAlign: 'left' };
const rowMetaStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b9ec7', flex: 'none' };
const badgeStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: '0.54rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7b9ec7', border: '1px solid #1a2440', borderRadius: 999, padding: '3px 9px', marginTop: 6 };
const spacerStyle: React.CSSProperties = { flex: 1 };
const footerStyle: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 9, borderTop: '1px solid rgba(212,168,84,0.18)' };
const wmStyle: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6 };
const wmAtlasStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, letterSpacing: '0.18em', color: '#c8d8f0', fontSize: '0.78rem' };
const wmOfStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.62rem', color: '#c8a060' };
const wmFateStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, letterSpacing: '0.18em', fontSize: '0.78rem', background: 'linear-gradient(180deg,#f0d595,#c08f3c)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
const footTagStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#5b7290', fontSize: '0.6rem' };
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (confirm `r.symbol`/`r.aspect`/`r.name` exist per `types.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/components/share/ShareCard.tsx
git commit -m "feat(ui): ShareCard — fixed 4:5 reading composition"
```

---

### Task 10: Corrupted static mode for `ShareCard`

**Files:**
- Modify: `src/components/share/ShareCard.tsx`
- Verify: `npm run build`

- [ ] **Step 1: Add a corrupted-static branch**

In `ShareCard`, derive `const corrupted = state.corruption.band === 'virulent' || state.corruption.band === 'pinnacle';` and apply static (non-animated) corruption: a red border/vignette overlay, baked chromatic on the headline via `textShadow`, redaction bars on a budgeted word, and the entity tagline. Replace the footer tag with the entity line when corrupted, and apply these overrides (add after the existing styles):

```tsx
const cardCxOverlay: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 14,
  boxShadow: 'inset 0 0 70px rgba(255,45,74,0.16), inset 0 0 0 1px rgba(255,45,74,0.4)',
  background: 'repeating-linear-gradient(0deg, rgba(255,45,74,0.06) 0 1px, transparent 1px 4px)',
};
const headlineCx: React.CSSProperties = { color: '#fff', textShadow: '-1.4px 0 #ff2d4a, 1.4px 0 #1a0006' };
```

Render `{corrupted && <div style={cardCxOverlay} />}` inside `cardStyle`, merge `headlineCx` into the headline style when corrupted, switch `footTagStyle` text to `'It watches. It is pleased.'` when corrupted, and tint the card background to the corrupted gradient (reuse the `.card.cx` background from the mockup). Use `synthesis.affinityNote` (already the entity line at Virulent+ from Task 4) for the footer tag instead of a hardcoded string:

```tsx
const footTag = corrupted ? (synthesis?.affinityNote ?? 'It watches. It is pleased.') : 'the stars await your question';
```

> Static-only: no CSS animation classes here — `html2canvas` captures a frozen frame. Chromatic = static `textShadow`; redactions = solid bars; no `cx-*` animated classes.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/share/ShareCard.tsx
git commit -m "feat(ui): ShareCard corrupted static variant"
```

---

### Task 11: Off-screen export + wire the Share button

**Files:**
- Modify: `src/utils/shareExport.ts`
- Modify: `src/components/screens/ResultReading.tsx` (share handler)
- Verify: `npm run build` + manual

**Interfaces:**
- Produces: `shareCardImage(node: HTMLElement): Promise<void>` — captures a fixed 380×475 node at scale 2.84 → ~1080×1350.

- [ ] **Step 1: Add a fixed-size capture path**

In `src/utils/shareExport.ts`, add:

```ts
// 380×475 logical → ~1080×1350 (4:5). Capture at a scale that hits the target.
export async function exportShareCard(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, { backgroundColor: '#05070e', scale: 1080 / 380, width: 380, height: 475 });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))), 'image/png');
  });
}

export async function shareCard(element: HTMLElement): Promise<void> {
  const blob = await exportShareCard(element);
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'atlas-of-fate-reading.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Atlas of Fate Reading' });
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'atlas-of-fate-reading.png'; a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Render `ShareCard` off-screen and capture on Share**

In `ResultReading.tsx`, add an off-screen container and point the Share button at it. Add import:

```tsx
import ShareCard from '../share/ShareCard';
import { shareCard } from '../../utils/shareExport';
```

Add an off-screen ref:

```tsx
  const shareCardRef = useRef<HTMLDivElement>(null);
```

Replace `handleShare`:

```tsx
  const handleShare = useCallback(async () => {
    if (shareCardRef.current) {
      try { await shareCard(shareCardRef.current.firstElementChild as HTMLElement); } catch { /* silent */ }
    }
  }, []);
```

Render the off-screen card once, near the end of the component JSX (absolutely positioned off-canvas so it lays out for capture but is invisible):

```tsx
      <div ref={shareCardRef} aria-hidden style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <ShareCard state={state} />
      </div>
```

Remove the now-unused `shareRef`/`data-share-container` usage from the main reading card and the old `shareAsImage` import if no longer referenced. (Keep `shareAsImage` in the util file for safety, or delete if nothing imports it — confirm with a search.)

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS (no unused imports — `noUnusedLocals`).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, finish (or inject) a reading, click **SHARE AS IMAGE**. Confirm the downloaded/share-sheet PNG is 4:5 (~1080×1350), shows the headline + tension line + the full card list + wordmark footer, and for a Virulent reading shows the frozen corrupted variant with the entity tagline. Verify on a narrow viewport that the export is identical (it renders from the fixed-size off-screen node, independent of screen width).

- [ ] **Step 5: Commit**

```bash
git add src/utils/shareExport.ts src/components/screens/ResultReading.tsx
git commit -m "feat(ui): export the 4:5 ShareCard instead of a page screenshot"
```

---

# Phase 6 — Docs

### Task 12: README + game-systems doc for length & corruption presentation

**Files:**
- Modify: `README.md`
- Modify: `docs/game-systems.md`

- [ ] **Step 1: Document game length**

In `README.md` (gameplay flow) and `docs/game-systems.md`, add: readings come in three depths — **Glimpse (3)**, **Reading (5, default)**, **Deep Divination (7)** — chosen on the question-select screen; the count is set per turn via `startTurn(question, count)`. Note the deliberate, undocumented-in-game consequence: longer readings expose the player to more corruption growth (value-based accrual across more draws). Do not surface corruption in the UI.

- [ ] **Step 2: Document corruption presentation additions**

In `docs/game-systems.md`'s corruption section, add the results-presentation behaviors: tainted result tiles, random sigil chromatic aberration (red↔void) at Virulent+, live word-swaps on "loud" synthesis words, and the 4:5 share image (clean + frozen corrupted variant). (The per-affinity notes and entity voice were documented in Tasks 3 & 4.)

- [ ] **Step 3: Commit**

```bash
git add README.md docs/game-systems.md
git commit -m "docs: game-length tiers + corruption presentation"
```

---

## Self-Review

**Spec coverage:**
- A (length tiers) → Tasks 1, 2, 12. ✓
- B (results rework) → Tasks 5, 6. ✓
- C (corruption presentation) → Tasks 7, 8. ✓
- D (narrative voice: per-affinity + entity) → Tasks 3, 4. ✓
- E (share image) → Tasks 9, 10, 11. ✓
- Docs (game-systems/README in sync) → Tasks 3, 4, 12. ✓
- Spec open questions: affinity copy + entity pool are now concrete (Tasks 3, 4); html2canvas scale set (Task 11, `1080/380`); pool-refill for 7 verified by Task 1's 7-reading test; entity-overrides-sign-off left out of scope and noted (Task 4 Step 6 note).

**Placeholder scan:** no TBD/TODO; every code step shows complete code; manual-verify steps name the exact `?debug` injection path. React tasks honestly use build+manual verification (no component-test harness per Global Constraints).

**Type consistency:** `startTurn(question, methodCount?)`, `GameState.minigamesPerTurn`, `entityVoiceNote(rng)`, `ResultTile({ result, index, onOpen, corruptionBand })`, `ShareCard({ state })`, `shareCard(element)` / `exportShareCard(element)` are used consistently across tasks. `pickAffinityNote` is module-private to NarrativeAssembler. `CORRUPTED_TAG` imported from `../../data/corruption` (matches engine import).

**Risk note for the implementer:** `ResultTile`/`ShareCard` read `SlotResult` union fields directly — cross-check each against `src/engine/types.ts` and the existing `CardReadingDetail.tsx` switch while implementing; fix any field-name drift (e.g. exact `aspect`/`ring`/`house`/`planet` names) at build time.
