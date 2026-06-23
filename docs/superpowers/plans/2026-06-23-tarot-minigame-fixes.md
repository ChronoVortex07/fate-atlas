# Tarot Minigame Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three problems in the tarot draft minigame and reading synthesis: hover fan-out that pushes the target card away, no review beat after a minigame commits, and balanced-yet-uninformative readings.

**Architecture:** Three independent parts. (1) A pure gap-expansion layout function colocated with `TarotMinigame.tsx` replaces the repel math. (2) A turn-scoped `awaitingContinue` gate in `GameEngine` holds every minigame on a review beat until the player clicks Continue; `GameTable` renders the shared control. (3) `ReadingPlanner` profiles dimensions over *atomic signals* (individual cards/dice/hexagrams) with magnitude-weighted favorability and surfaces opposing poles; `NarrativeAssembler` narrows the favorability band, names opposing forces, emits per-position lines, and de-dupes modifier frames.

**Tech Stack:** React 18 + TypeScript + Vite, framer-motion, Vitest (engine tests only, `src/engine/__tests__/**`, Node env).

## Global Constraints

- Engine code (`src/engine/**`) stays framework-free: zero React/DOM imports.
- Every engine mutator ends with `notify()`.
- `tsc` runs with `strict`, `noUnusedLocals`, `noUnusedParameters`. Typecheck via `npm run build` or `npx tsc -b`.
- Vitest only discovers `src/engine/__tests__/**`; component code has no automated tests.
- Dimension values are `[-2, 2]` with 0.5 granularity; preserve that rounding.
- `awaitingContinue` is turn-scoped (NOT carryover): reset in `startTurn`, `reset`, `returnToTitle`, `returnToQuestionSelect`.
- Keep docs in sync: changes to synthesis/results and the minigame flow update `docs/game-systems.md` and `README.md`.

---

## Task 1: Hover fan-out — gap-expansion layout

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx` (constants L8-11; `fanDisplacements` useMemo L156-185; `cardIndexZ` L466-472; render `zIndex` L268)

**Interfaces:**
- Produces: `computeFanOffsets(cardCenters: number[], cursorX: number, params: { radius: number; maxGapExpansion: number }): number[]` — exported pure function, colocated at the bottom of `TarotMinigame.tsx`.

No automated test (per spec open-decision #1: the repo's Vitest config runs engine tests only; the function is small and pure; verified by running the dev server). Verification is the typecheck plus a manual dev-server check.

- [ ] **Step 1: Replace the fan constants**

In `src/components/screens/TarotMinigame.tsx`, replace lines 10-11:

```typescript
const FAN_RADIUS = 200;     // px — hover fan-out detection radius
const MAX_FAN_OFFSET = 32;  // px — max fan-out displacement
```

with:

```typescript
const FAN_RADIUS = 140;        // px — proximity gate for gap expansion
const MAX_GAP_EXPANSION = 26;  // px — max extra width added to a single gap
```

- [ ] **Step 2: Add the pure `computeFanOffsets` function**

Append to the `// ── Helpers ──` section of `TarotMinigame.tsx` (just above `cardIndexZ`):

```typescript
interface FanParams {
  radius: number;          // falloff width in px (proximity gate)
  maxGapExpansion: number; // max extra px added to a single gap
}

/**
 * Gap-expansion fan-out. The cluster of cards near the cursor breathes open:
 * gaps widen most where they are nearest the cursor, so the card under the
 * pointer barely moves and becomes easy to click. Order is always preserved.
 * cardCenters must be ascending. Returns the signed x-delta for each card.
 */
export function computeFanOffsets(
  cardCenters: number[],
  cursorX: number,
  { radius, maxGapExpansion }: FanParams,
): number[] {
  const n = cardCenters.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  // Smooth Gaussian falloff, zero beyond the radius (enforces max repel distance).
  const falloff = (u: number) => (u <= 1 ? Math.exp(-3 * u * u) : 0);

  // Expansion of each adjacent gap (length n-1), gated by its midpoint's distance.
  const gapExpansion: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const midpoint = (cardCenters[i] + cardCenters[i + 1]) / 2;
    const u = Math.abs(midpoint - cursorX) / radius;
    gapExpansion.push(maxGapExpansion * falloff(u));
  }

  // Each card's offset is the signed sum of the expansions of gaps that lie
  // between it and the cursor (cursor-anchored integration).
  const offsets: number[] = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    let offset = 0;
    for (let i = 0; i < n - 1; i++) {
      const midpoint = (cardCenters[i] + cardCenters[i + 1]) / 2;
      // Card k right of gap i, cursor left of gap i → push card right.
      if (k >= i + 1 && cursorX < midpoint) offset += gapExpansion[i];
      // Card k left of gap i, cursor right of gap i → push card left.
      else if (k <= i && cursorX > midpoint) offset -= gapExpansion[i];
    }
    offsets[k] = offset;
  }

  // Re-center: subtract the mean so the cluster's center of mass stays put.
  const mean = offsets.reduce((s, v) => s + v, 0) / n;
  return offsets.map((o) => o - mean);
}
```

- [ ] **Step 3: Rewrite `fanDisplacements` to use centers + the pure function**

Replace the `fanDisplacements` useMemo body (L157-185) with:

```typescript
  const fanDisplacements = useMemo(() => {
    const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);
    const totalCards = draft.table.length;
    const cardStep = TABLE_CARD_WIDTH - TABLE_OVERLAP;
    const totalSpan = totalCards * cardStep + TABLE_OVERLAP;
    const startOffset = -totalSpan / 2;

    // Each card's default center in absolute container coordinates (ascending).
    const centers = activeTableCards.map((card) => {
      const defaultLeftOffset = startOffset + card.originIndex * cardStep;
      return containerWidth / 2 + defaultLeftOffset + TABLE_CARD_WIDTH / 2;
    });

    const offsets = fan.active
      ? computeFanOffsets(centers, fan.centerX, { radius: FAN_RADIUS, maxGapExpansion: MAX_GAP_EXPANSION })
      : centers.map(() => 0);

    return activeTableCards.map((card, i) => {
      const defaultLeftOffset = startOffset + card.originIndex * cardStep;
      const cardCenterAbs = centers[i];
      const offsetX = offsets[i];
      let scale = 1;
      if (fan.active) {
        const dist = Math.abs(cardCenterAbs - fan.centerX);
        if (dist < FAN_RADIUS) scale = 1 + 0.06 * (1 - dist / FAN_RADIUS);
      }
      return { cardId: card.cardId, originIndex: card.originIndex, defaultLeftOffset, offsetX, scale, cardCenterAbs };
    });
  }, [draft.table, fan, containerWidth]);
```

- [ ] **Step 4: Fix `cardIndexZ` to layer the card nearest the cursor on top**

Replace `cardIndexZ` (L465-472) with:

```typescript
/** Cards closer to the cursor get a higher z-index so the opened-up card layers above its neighbors. */
function cardIndexZ(cardCenterAbs: number, fan: FanState): number {
  if (!fan.active) return 1;
  const dist = Math.abs(cardCenterAbs - fan.centerX);
  return Math.max(1, Math.round(1000 - dist));
}
```

Update the render call at L268 from `zIndex: cardIndexZ(card.originIndex, fan)` to:

```typescript
                      zIndex: cardIndexZ(d?.cardCenterAbs ?? 0, fan),
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (Confirms `cardCenterAbs` is wired and no unused symbols remain — `MAX_FAN_OFFSET` is gone.)

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "fix(tarot): gap-expansion hover fan-out so the targeted card stays put"
```

---

## Task 2: Continue gate — engine

**Files:**
- Modify: `src/engine/types.ts` (`GameState` L340-360)
- Modify: `src/engine/GameEngine.ts` (field L35; `defaultState` L51-76; `startTurn` L176-198; `completeMinigame` end L296-301; new methods; `returnToQuestionSelect` L887-903)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces: `GameState.awaitingContinue: boolean`; `GameEngine.continueAfterReview(): void`.
- Consumes: existing `runOrDefer`, `finishEventBatch`, `advanceAfterCommit`, `notify`.

Behavior: `completeMinigame` stores the real advance and shows a review beat instead of advancing. Once any commit event batch drains (or immediately if none was queued), `awaitingContinue` becomes `true` and the screen stays on `minigame`. `continueAfterReview()` clears the flag and runs the stored advance (→ method-select / happening / result).

- [ ] **Step 1: Write the failing flow test**

Add to `src/engine/__tests__/GameEngine.test.ts` inside the `describe('GameEngine — new lifecycle', …)` block (after the test at L98):

```typescript
  it('completeMinigame holds a review beat; continueAfterReview advances to method-select', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;
    const orig = Math.random; Math.random = () => 0.99;
    engine.completeMinigame(dieResult());
    Math.random = orig;
    // Review beat: result committed, but the screen has NOT advanced.
    expect(engine.getState().awaitingContinue).toBe(true);
    expect(engine.getState().screen).toBe('minigame');
    expect(engine.getState().turnResults.length).toBe(1);
    // Continue advances.
    engine.continueAfterReview();
    expect(engine.getState().awaitingContinue).toBe(false);
    expect(engine.getState().screen).toBe('method-select');
  });

  it('continueAfterReview is a no-op when not awaiting', () => {
    engine.startTurn('self');
    expect(() => engine.continueAfterReview()).not.toThrow();
    expect(engine.getState().screen).toBe('method-select');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "review beat"`
Expected: FAIL — `awaitingContinue` is `undefined`/property missing and the screen is already `method-select`.

- [ ] **Step 3: Add `awaitingContinue` to `GameState`**

In `src/engine/types.ts`, add to the `GameState` interface (after `debug: boolean;` at L356):

```typescript
  awaitingContinue: boolean;
```

- [ ] **Step 4: Add the field and default**

In `src/engine/GameEngine.ts`, add a private field after L35 (`private turnEffects…`):

```typescript
  private pendingAdvance: (() => void) | null = null;
```

In `defaultState()` add to the returned object (after `debug: false,` at L68):

```typescript
      awaitingContinue: false,
```

In `startTurn()`, add after `this.state.eventQueue = [];` (L189):

```typescript
    this.state.awaitingContinue = false;
```

In `returnToQuestionSelect()`, add after `this.state.eventQueue = [];` (L900):

```typescript
    this.state.awaitingContinue = false;
```

(`reset` and `returnToTitle` rebuild via `defaultState()`, so they already reset it.)

- [ ] **Step 5: Replace the advance with the review-beat gate**

In `completeMinigame()`, replace the final lines (L298-300):

```typescript
    // Resolve-first, narrate-second: if the commit queued any events, freeze on
    // the current screen until the sequencer drains them, then transition.
    this.runOrDefer(() => this.advanceAfterCommit(result, completed));
```

with:

```typescript
    // Resolve-first, narrate-second, then hold a review beat: store the real
    // advance and (once any event batch drains) show the Continue gate instead
    // of advancing. continueAfterReview() runs the stored advance.
    this.pendingAdvance = () => this.advanceAfterCommit(result, completed);
    this.runOrDefer(() => this.showReviewBeat());
```

- [ ] **Step 6: Add `showReviewBeat` and `continueAfterReview`**

In `src/engine/GameEngine.ts`, add right after `advanceAfterCommit` (after L334):

```typescript
  // Hold on the committed/revealed minigame view until the player clicks Continue.
  private showReviewBeat(): void {
    this.state.awaitingContinue = true;
    this.notify();
  }

  continueAfterReview(): void {
    if (!this.state.awaitingContinue) return;
    this.state.awaitingContinue = false;
    const advance = this.pendingAdvance;
    this.pendingAdvance = null;
    if (advance) advance();
    else this.notify();
  }
```

- [ ] **Step 7: Run the new flow tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "review beat"`
Expected: PASS. Also run `-t "no-op when not awaiting"` → PASS.

- [ ] **Step 8: Update existing tests that assumed `completeMinigame` auto-advances**

In `src/engine/__tests__/GameEngine.test.ts`:

(a) `completeTurn` helper (L14-33) — advance past each review beat. Change the loop body so that after `engine.completeMinigame(dieResult());` it advances:

```typescript
      engine.completeMinigame(dieResult());
      if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
      if (engine.getState().awaitingContinue) engine.continueAfterReview();
```

(b) Test "completeMinigame between minigames returns to method-select" (L88-98) — add before the assertion at L97:

```typescript
    engine.continueAfterReview();
```

(c) Test "freezes on the minigame screen until the commit event batch is narrated" (L183-206) — after `engine.finishEventBatch();` (L202) the screen now holds the review beat, not method-select. Replace L203-204:

```typescript
    expect(engine.getState().eventQueue.length).toBe(0);
    expect(engine.getState().screen).toBe('method-select');
```

with:

```typescript
    expect(engine.getState().eventQueue.length).toBe(0);
    expect(engine.getState().awaitingContinue).toBe(true);
    expect(engine.getState().screen).toBe('minigame');
    engine.continueAfterReview();
    expect(engine.getState().screen).toBe('method-select');
```

(d) Test "records the turn effects into the run history" (L208-229) — the loop must advance past the review beat. Replace the loop body (L218-223) so each iteration drains then continues:

```typescript
    while (engine.getState().screen !== 'result') {
      if (engine.getState().awaitingContinue) { engine.continueAfterReview(); continue; }
      const methods = engine.getState().availableMethods;
      const idx = methods.findIndex((m) => m !== 'happening');
      engine.selectMethod(idx);
      engine.completeMinigame({ type: 'd20', result: 5, threshold: 'low', interpretation: '',
        tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] } as any);
      if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
    }
```

Also delete the now-redundant `engine.finishEventBatch();` at L215 (the first reading's drain) and replace it so the first iteration is handled by the loop. Concretely, after `engine.completeMinigame(...)` at L213-214 leave `engine.finishEventBatch();` (drains the forced chaos batch → review beat), and the `while` loop above will call `continueAfterReview()` first.

- [ ] **Step 9: Run the full GameEngine + EngineDispatch + AgencyDecisions suites**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts src/engine/__tests__/EngineDispatch.test.ts src/engine/__tests__/AgencyDecisions.test.ts`
Expected: PASS (all).

- [ ] **Step 10: Typecheck and commit**

```bash
npx tsc -b
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): hold a Continue review beat after every minigame commit"
```

---

## Task 3: Continue gate — components

**Files:**
- Modify: `src/components/screens/GameTable.tsx` (render a shared Continue control)
- Modify: `src/components/screens/TarotMinigame.tsx` (render face-up Past/Present/Future during the gate)
- Verify (likely no change): `src/components/screens/DiceMinigame.tsx`, `src/components/screens/IChingMinigame.tsx`

**Interfaces:**
- Consumes: `GameState.awaitingContinue` (Task 2), `engine.continueAfterReview()` (Task 2).

No automated test (component layer). Verify via typecheck + dev server.

- [ ] **Step 1: Render the shared Continue control in `GameTable`**

In `src/components/screens/GameTable.tsx`, add the control inside the hub, after the `InteractionSequencer` block (after L99) and before the closing `</div>` (L100):

```tsx
      {state.screen === 'minigame' && state.awaitingContinue && state.eventQueue.length === 0 && (
        <ContinueBar />
      )}
```

Add a small component above `GameTable`'s `export default` (or below it) that reads the engine:

```tsx
function ContinueBar() {
  const { engine } = useGameEngine();
  return (
    <div style={continueBarStyle}>
      <button
        type="button"
        style={continueBtnStyle}
        onClick={() => engine.continueAfterReview()}
      >
        Continue →
      </button>
    </div>
  );
}
```

Add the styles next to the other style constants:

```tsx
const continueBarStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 15,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'auto',
};

const continueBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.95rem',
  letterSpacing: '0.1em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #d4a854',
  borderRadius: '24px',
  padding: '0.6rem 2rem',
  cursor: 'pointer',
  outline: 'none',
};
```

Note: the existing `centerStyle` sets `pointerEvents: 'none'` only while `state.eventQueue.length > 0`; during the review beat the queue is empty, so the tableau and this bar are interactive.

- [ ] **Step 2: Render the face-up committed spread in `TarotMinigame` during the gate**

The tarot draft sets `phase === 'committing'` at commit; during the review beat the screen stays mounted. Render the committed Past/Present/Future faces face-up instead of the face-down hand.

In `src/components/screens/TarotMinigame.tsx`, just after `const activeTableCards = draft.table.filter(...)` near the render (L194), derive the committed spread:

```typescript
  const committedSlot =
    state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : undefined;
  const committedSpread =
    draft.phase === 'committing' && committedSlot && committedSlot.type === 'tarot'
      ? committedSlot.spread ?? null
      : null;
```

Then in the Hand section, render the revealed spread when `committedSpread` is present. Replace the hand-slot column inner content selection: at the top of the `{(['Past','Present','Future'] as const).map((label, i) => { … })}` callback (L333), add:

```typescript
              const revealed = committedSpread?.[i]?.card;
```

and add a branch as the first child of the `<AnimatePresence mode="wait">` (before the `{card ? (…)}` ternary at L344):

```tsx
                  {revealed ? (
                    <motion.div
                      key={`revealed-${revealed.id}-${i}`}
                      style={{ ...handCardStyle, cursor: 'default', borderColor: '#7b9ec7' }}
                      initial={{ opacity: 0, rotateY: 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: i * 0.12 }}
                    >
                      <CardSigil card={revealed} size={22} color="#7b9ec7" />
                      <div style={handCardNameStyle}>{revealed.name}</div>
                      <div style={handCardOrientStyle}>
                        {revealed.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
                      </div>
                    </motion.div>
                  ) : card ? (
```

and close the extra branch: the existing ternary `{card ? (…) : (…)}` becomes `{revealed ? (…) : card ? (…) : (…)}`. Ensure the closing parentheses match (the empty-slot `: (` branch stays last).

- [ ] **Step 3: Verify Dice & IChing hold their revealed result during the gate**

Read `DiceMinigame.tsx` and `IChingMinigame.tsx`. Because the screen now stays on `minigame` during the gate (instead of unmounting), the committed result derived from `state.turnResults[state.activeSlotIndex]` (`displayResult` / `displayHex`) remains rendered with no further auto-advance. Confirm by inspection that no effect re-fires `completeMinigame` after commit (both guard: Dice via `committedRef`, IChing via `done` + a single `setTimeout` keyed on `done`). If, on the dev server, either collapses to an empty/transitional view during the beat, hold the revealed block by gating its unmount on `!state.awaitingContinue`; otherwise no code change is required. Record the outcome of this check.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Manual dev-server verification**

Run `npm run dev`, play a tarot reading: confirm (a) hover opens a gap around the cursor and the targeted card stays put and clickable; (b) after Reveal/Invert, the three cards show face-up and a Continue button appears; (c) Continue advances to method-select; (d) dice and I Ching also hold their result with a Continue button; (e) the final (3rd) minigame shows Continue, then advances to the Result page.

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/GameTable.tsx src/components/screens/TarotMinigame.tsx
git commit -m "feat(ui): Continue review beat with face-up committed spread"
```

---

## Task 4: Aggregation — atomic signals, magnitude favorability, opposing forces

**Files:**
- Modify: `src/engine/types.ts` (`AggregatedReading` L138-145)
- Modify: `src/engine/ReadingPlanner.ts` (`aggregate` dimension section L153-171; add `atomicSignals` + opposing-force population)
- Test: `src/engine/__tests__/ReadingPlanner.test.ts`

**Interfaces:**
- Produces: `AggregatedReading.strongestFavor: { label: string; value: number } | null` and `AggregatedReading.strongestAdverse: { label: string; value: number } | null`.
- Produces (private): `atomicSignals(results: SlotResult[]): { label: string; themes: ThemeTag[]; dimensions: DimensionValues; modifierRoles: ModifierRole[] }[]`.

- [ ] **Step 1: Write the failing aggregation tests**

Add to `src/engine/__tests__/ReadingPlanner.test.ts` inside `describe('aggregate', …)`:

```typescript
    it('a balanced spread does not wash favorability to zero (magnitude-weighted)', () => {
      // A 3-card spread: strong +fav past, neutral present, mild -fav future.
      const spread = {
        type: 'tarot', id: 's', name: 'Spread', number: 0, orientation: 'upright' as const,
        symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [],
        themes: ['renewal'] as const, modifierRoles: ['subject'] as const,
        dimensions: { favorability: 0.0, certainty: 0, volatility: 0 }, // consolidated ~0
        spread: [
          { position: 'past' as const, card: faceLike({ favorability: 2.0, themes: ['renewal'] }) },
          { position: 'present' as const, card: faceLike({ favorability: 0.0, themes: ['harmony'] }) },
          { position: 'future' as const, card: faceLike({ favorability: -0.5, themes: ['conflict'] }) },
        ],
      } as unknown as SlotResult;
      const agg = planner.aggregate([spread], 'self');
      // Magnitude weighting: (2.0*2.0 + 0 + (-0.5*0.5)) / (2.0 + 0.5) = 3.75/2.5 = 1.5
      expect(agg.dimensionProfile.favorability).toBe(1.5);
    });

    it('surfaces strongest favor and adverse poles from atomic signals', () => {
      const spread = {
        type: 'tarot', id: 's', name: 'Spread', number: 0, orientation: 'upright' as const,
        symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [],
        themes: ['renewal'] as const, modifierRoles: ['subject'] as const,
        dimensions: { favorability: 0.0, certainty: 0, volatility: 0 },
        spread: [
          { position: 'past' as const, card: faceLike({ favorability: 1.5, name: 'Ace of Cups' }) },
          { position: 'present' as const, card: faceLike({ favorability: 0.0, name: 'Two of Coins' }) },
          { position: 'future' as const, card: faceLike({ favorability: -1.5, name: 'Nine of Wands', orientation: 'reversed' }) },
        ],
      } as unknown as SlotResult;
      const agg = planner.aggregate([spread], 'self');
      expect(agg.strongestFavor).toEqual({ label: 'the Ace of Cups (upright)', value: 1.5 });
      expect(agg.strongestAdverse).toEqual({ label: 'the Nine of Wands (reversed)', value: -1.5 });
    });

    it('labels die and hexagram atomic signals', () => {
      const agg = planner.aggregate(
        [makeDice({ dimensions: { favorability: 1.0, certainty: 0, volatility: 0 } }),
         makeIChing({ hexagramNumber: 42, dimensions: { favorability: -1.0, certainty: 0, volatility: 0 } })],
        'self',
      );
      expect(agg.strongestFavor).toEqual({ label: 'the dice (10)', value: 1.0 });
      expect(agg.strongestAdverse).toEqual({ label: 'Hexagram 42', value: -1.0 });
    });
```

Add this helper near the top of the test file (after the `makeIChing` fixture):

```typescript
import type { TarotCardFace } from '../types';
const faceLike = (o: { favorability: number; themes?: string[]; name?: string; orientation?: 'upright' | 'reversed' }): TarotCardFace => ({
  id: (o.name ?? 'card').toLowerCase().replace(/\s+/g, '-'),
  name: o.name ?? 'Card', arcana: 'minor', orientation: o.orientation ?? 'upright', symbol: '✦',
  themes: (o.themes ?? ['mystery']) as TarotCardFace['themes'],
  dimensions: { favorability: o.favorability, certainty: 0, volatility: 0 },
  modifierRoles: ['subject'], meaningUpright: '', meaningReversed: '', tags: [],
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/ReadingPlanner.test.ts -t "magnitude-weighted"`
Expected: FAIL — favorability is `0` (double-averaged), and `strongestFavor`/`strongestAdverse` are missing.

- [ ] **Step 3: Add the opposing-force fields to `AggregatedReading`**

In `src/engine/types.ts`, add to `AggregatedReading` (after `tensionPair` at L144):

```typescript
  strongestFavor: { label: string; value: number } | null;
  strongestAdverse: { label: string; value: number } | null;
```

- [ ] **Step 4: Add the `atomicSignals` helper**

In `src/engine/ReadingPlanner.ts`, add a private method (next to `sumAbsDimensions`):

```typescript
  /**
   * Flatten results into atomic signals for dimension profiling: each die, each
   * hexagram, each astral cast, and each individual card in a multi-card spread.
   * Removes the double-average where a 3-card spread was pre-averaged to ~0.
   */
  private atomicSignals(results: SlotResult[]): {
    label: string; themes: ThemeTag[]; dimensions: DimensionValues; modifierRoles: ModifierRole[];
  }[] {
    const signals: { label: string; themes: ThemeTag[]; dimensions: DimensionValues; modifierRoles: ModifierRole[] }[] = [];
    for (const r of results) {
      if (r.type === 'happening') continue;
      if (r.type === 'tarot' && r.spread && r.spread.length > 1) {
        for (const sp of r.spread) {
          signals.push({
            label: `the ${sp.card.name} (${sp.card.orientation})`,
            themes: sp.card.themes,
            dimensions: sp.card.dimensions,
            modifierRoles: sp.card.modifierRoles,
          });
        }
      } else if (r.type === 'd20') {
        signals.push({ label: `the dice (${r.result})`, themes: r.themes, dimensions: r.dimensions, modifierRoles: r.modifierRoles });
      } else if (r.type === 'iching') {
        signals.push({ label: `Hexagram ${r.hexagramNumber}`, themes: r.themes, dimensions: r.dimensions, modifierRoles: r.modifierRoles });
      } else {
        // single-card tarot or astral: use the result itself
        const label = r.type === 'tarot' && r.spread?.[0]
          ? `the ${r.spread[0].card.name} (${r.spread[0].card.orientation})`
          : `the ${(r as { name?: string }).name ?? r.type}`;
        signals.push({ label, themes: r.themes, dimensions: r.dimensions, modifierRoles: r.modifierRoles });
      }
    }
    return signals;
  }
```

- [ ] **Step 5: Rewrite the dimension-profiling section of `aggregate`**

In `aggregate()`, replace the `// ── Dimension profiling (weighted average) ──` block (L153-171) with:

```typescript
    // ── Dimension profiling over atomic signals ──
    const primaryRole = PRIMARY_ROLE[question];
    const signals = this.atomicSignals(nonHappening);
    const clampDim = (x: number) => Math.max(-2, Math.min(2, Math.round(x * 2) / 2));

    // Favorability: magnitude-weighted so strong pulls dominate rather than cancel.
    let favNum = 0, favDen = 0;
    for (const s of signals) {
      const w = Math.abs(s.dimensions.favorability);
      favNum += s.dimensions.favorability * w;
      favDen += w;
    }

    // Certainty & volatility: primary-role weighted average over atomic signals.
    const weightedAxis = (axis: 'certainty' | 'volatility') => {
      let num = 0, den = 0;
      for (const s of signals) {
        const w = s.modifierRoles.includes(primaryRole) ? 2 : 1;
        num += s.dimensions[axis] * w;
        den += w;
      }
      return den > 0 ? clampDim(num / den) : 0;
    };

    const dimensionProfile: DimensionValues = {
      favorability: favDen > 0 ? clampDim(favNum / favDen) : 0,
      certainty: weightedAxis('certainty'),
      volatility: weightedAxis('volatility'),
    };

    // ── Opposing forces (strongest favorable / adverse atomic signals) ──
    let strongestFavor: { label: string; value: number } | null = null;
    let strongestAdverse: { label: string; value: number } | null = null;
    for (const s of signals) {
      const v = s.dimensions.favorability;
      if (v > 0 && (!strongestFavor || v > strongestFavor.value)) strongestFavor = { label: s.label, value: v };
      if (v < 0 && (!strongestAdverse || v < strongestAdverse.value)) strongestAdverse = { label: s.label, value: v };
    }
```

- [ ] **Step 6: Return the new fields**

In the `return { … }` of `aggregate` (L220-227), add:

```typescript
      strongestFavor,
      strongestAdverse,
```

Remove the now-unused `dimKeys` variable if `tsc` flags it (the new block no longer references it).

- [ ] **Step 7: Run the aggregation tests**

Run: `npx vitest run src/engine/__tests__/ReadingPlanner.test.ts`
Expected: PASS (including the existing "dimension weighted averaging" test, which still yields 1.0).

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc -b
git add src/engine/types.ts src/engine/ReadingPlanner.ts src/engine/__tests__/ReadingPlanner.test.ts
git commit -m "feat(reading): atomic-signal dimension profiling with magnitude-weighted favorability and opposing forces"
```

---

## Task 5: Synthesis — band, opposing forces, per-position, de-dupe

**Files:**
- Modify: `src/engine/NarrativeAssembler.ts` (`getFavorabilityBand` L19-23; `assemble` Stages 3-4 L105-139; per-position line; opposing paragraph; `buildHeadline` keys off the same band)
- Test: `src/engine/__tests__/NarrativeAssembler.test.ts`

**Interfaces:**
- Consumes: `AggregatedReading.strongestFavor/strongestAdverse` (Task 4); the `_results` parameter of `assemble` (rename to `results`, now used).

- [ ] **Step 1: Update the shared aggregated fixture for the new required fields**

In `src/engine/__tests__/NarrativeAssembler.test.ts`, add to `baseAggregated` (L24-31):

```typescript
  strongestFavor: null,
  strongestAdverse: null,
```

(Every inline `agg` in the file spreads `baseAggregated`, so this satisfies the type everywhere.)

- [ ] **Step 2: Write the failing synthesis tests**

Add to `src/engine/__tests__/NarrativeAssembler.test.ts`:

```typescript
  it('narrower band: favorability 0.5 reaches a real verdict (not neutral)', () => {
    const agg = { ...baseAggregated, dimensionProfile: { favorability: 0.5, certainty: 0, volatility: 0 } };
    const r1 = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const aggLow = { ...baseAggregated, dimensionProfile: { favorability: -0.5, certainty: 0, volatility: 0 } };
    assembler.resetRotation();
    const r2 = assembler.assemble(aggLow, [], 'decision', { chaos: 40, order: 50 });
    // The two verdicts must differ (one high band, one low band) — not both neutral.
    expect(r1.headline).not.toBe(r2.headline);
  });

  it('balanced-but-opposed emits a named tension paragraph', () => {
    const agg = {
      ...baseAggregated,
      dimensionProfile: { favorability: 0.0, certainty: 0, volatility: 0 },
      strongestFavor: { label: 'the Ace of Cups (upright)', value: 1.5 },
      strongestAdverse: { label: 'the reversed Nine of Wands', value: -1.5 },
    };
    const result = assembler.assemble(agg, [], 'self', { chaos: 40, order: 50 });
    const para = result.paragraphs.find((p) => p.includes('Ace of Cups') && p.includes('Nine of Wands'));
    expect(para).toBeTruthy();
    expect(para).toMatch(/contest|balance/);
  });

  it('emits a per-position line for a tarot spread', () => {
    const spread = makeSlot('tarot', {
      spread: [
        { position: 'past', card: { name: 'A', orientation: 'upright', themes: ['renewal'], dimensions: { favorability: 1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'a', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'present', card: { name: 'B', orientation: 'upright', themes: ['harmony'], dimensions: { favorability: 0.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'b', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'future', card: { name: 'C', orientation: 'reversed', themes: ['conflict'], dimensions: { favorability: -1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'c', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
      ],
    });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [spread], action: [], effect: [] } };
    const result = assembler.assemble(agg, [spread], 'self', { chaos: 40, order: 50 });
    const line = result.paragraphs.find((p) => p.includes('Past') && p.includes('Future'));
    expect(line).toBeTruthy();
    expect(line).toMatch(/Past leans/);
    expect(line).toMatch(/Future turns adverse/);
  });

  it('de-dupes a result shared across modifier roles to a single frame', () => {
    const shared = makeSlot('tarot', { name: 'The Tower', modifierRoles: ['subject', 'action', 'effect'],
      dimensions: { favorability: -1.0, certainty: 1.0, volatility: 1.0 } });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [shared], action: [shared], effect: [shared] } };
    const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
    const mentions = result.paragraphs.filter((p) => p.includes('The Tower')).length;
    expect(mentions).toBe(1);
  });
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts -t "balanced-but-opposed"`
Expected: FAIL — no opposing-forces paragraph yet.

- [ ] **Step 4: Narrow the favorability band**

In `src/engine/NarrativeAssembler.ts`, replace `getFavorabilityBand` (L19-23):

```typescript
function getFavorabilityBand(value: number): Band {
  if (value >= 0.5) return 'high';
  if (value <= -0.5) return 'low';
  return 'neutral';
}
```

(`buildHeadline` already keys on `${dominantTheme}_${favBand}` via this function — no further change needed there.)

- [ ] **Step 5: Use the `results` parameter and emit per-position lines**

Change the `assemble` signature parameter `_results: SlotResult[]` → `results: SlotResult[]` (L58). After Stage 3 (modifier weaving, before Stage 4 at L125), insert per-position lines:

```typescript
    // Per-position insight: one compact line per multi-card tarot spread.
    for (const r of results) {
      if (r.type !== 'tarot' || !r.spread || r.spread.length <= 1) continue;
      const parts = r.spread.map((sp) => {
        const pos = sp.position.charAt(0).toUpperCase() + sp.position.slice(1);
        const fav = sp.card.dimensions.favorability;
        if (fav >= 0.5) return `${pos} leans ${sp.card.themes[0] ?? 'mystery'}`;
        if (fav <= -0.5) return `${pos} turns adverse`;
        return `${pos} holds steady`;
      });
      paragraphs.push(parts.join(' · '));
    }
```

- [ ] **Step 6: De-dupe modifier frames to disjoint sets**

Replace the Stage 3 modifier-weaving loop (L106-123) with a disjoint assignment. Insert before the loop:

```typescript
    // Assign each result to exactly one modifier role for narration: the role in
    // which it ranks strongest (lowest index after the sumAbsDimensions sort).
    const roleOrder: ModifierRole[] = ['subject', 'action', 'effect'];
    const rankIn = (role: ModifierRole, r: SlotResult) => aggregated.modifierAssignments[role].indexOf(r);
    const uniqueResults = new Set<SlotResult>();
    for (const role of roleOrder) for (const r of aggregated.modifierAssignments[role]) uniqueResults.add(r);
    const narrationByRole: Record<ModifierRole, SlotResult[]> = { subject: [], action: [], effect: [] };
    for (const r of uniqueResults) {
      const roles = roleOrder.filter((role) => rankIn(role, r) >= 0);
      let best = roles[0];
      for (const role of roles.slice(1)) if (rankIn(role, r) < rankIn(best, r)) best = role;
      narrationByRole[best].push(r);
    }
    for (const role of roleOrder) {
      narrationByRole[role].sort((a, b) => rankIn(role, a) - rankIn(role, b));
    }
```

Then change the loop to read `narrationByRole`, but only show the gap fallback when the role is a *true* gap (no result anywhere has that role):

```typescript
    for (const role of roleOrder) {
      const assigned = narrationByRole[role];
      const frameKey = `${role}_${question}`;
      const framePool = this.templates.modifierFrames[frameKey];
      const trueGap = aggregated.modifierAssignments[role].length === 0;

      if (assigned && assigned.length > 0) {
        const resultsText = assigned.map((r) => this.describeSlotBrief(r)).join('; ');
        const frame = this.pick(`modifier_${frameKey}`, framePool ?? [frameKey]);
        paragraphs.push(frame.replace('{results}', resultsText));
      } else if (trueGap) {
        const fallbackPool = this.templates.fallbacks.missingModifier[role];
        if (fallbackPool && fallbackPool.length > 0) {
          paragraphs.push(this.pick(`missing_${role}`, fallbackPool));
        }
      }
    }
```

Remove the now-unused `allRoles` declaration (L106).

- [ ] **Step 7: Emit the opposing-forces paragraph**

In Stage 4, before the existing `if (aggregated.hasTension)` block (L126), add the named-opposition paragraph and let variance tension reuse it:

```typescript
    // Named opposition: when the net is neutral but strong poles oppose, name them.
    const netBand = getFavorabilityBand(aggregated.dimensionProfile.favorability);
    const favPole = aggregated.strongestFavor;
    const advPole = aggregated.strongestAdverse;
    const polesOppose = !!favPole && !!advPole && favPole.value >= 1 && advPole.value <= -1;
    let namedOpposition: string | null = null;
    if (polesOppose) {
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      namedOpposition = `${cap(favPole!.label)} pulls toward fortune while ${advPole!.label} drags against it — the balance you feel is a contest, not a calm.`;
    }
    if (netBand === 'neutral' && namedOpposition) {
      paragraphs.push(namedOpposition);
    }
```

Then, inside the existing `if (aggregated.hasTension)` block, when the tension is variance-based (`tensionPair` is null) and `namedOpposition` exists, push the named paragraph instead of the generic `high_variance` template:

```typescript
    if (aggregated.hasTension) {
      if (!aggregated.tensionPair && namedOpposition) {
        // Variance-based tension names its actual poles.
        if (netBand !== 'neutral') paragraphs.push(namedOpposition);
      } else {
        let tensionKey: string;
        if (aggregated.tensionPair) {
          const [a, b] = aggregated.tensionPair;
          tensionKey = [a, b].sort().join('_');
        } else {
          tensionKey = 'high_variance';
        }
        const tensionPool = this.templates.tensionPatterns[tensionKey];
        if (tensionPool && tensionPool.length > 0) {
          paragraphs.push(this.pick(`tension_${tensionKey}`, tensionPool));
        }
      }
    }
```

(The `netBand !== 'neutral'` guard avoids double-printing `namedOpposition` when the neutral branch above already pushed it.)

- [ ] **Step 8: Run the synthesis tests**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS (new and existing).

- [ ] **Step 9: Run the whole engine suite**

Run: `npm test`
Expected: PASS (all engine tests).

- [ ] **Step 10: Typecheck and commit**

```bash
npx tsc -b
git add src/engine/NarrativeAssembler.ts src/engine/__tests__/NarrativeAssembler.test.ts
git commit -m "feat(synthesis): narrower band, named opposing forces, per-position lines, de-duped frames"
```

---

## Task 6: Documentation sync

**Files:**
- Modify: `docs/game-systems.md` (synthesis/results description; the card-drafting minigame section 4b — note the Continue review beat)
- Modify: `README.md` (synthesis/results + continue-gate mention)

**Interfaces:** none (prose only).

- [ ] **Step 1: Update `docs/game-systems.md`**

In the card-drafting minigame section (`### 4b`), add a sentence: after a spread commits and any meta-interactions narrate, the screen holds a **review beat** showing the face-up Past/Present/Future; play advances only on an explicit **Continue** click (this gate applies to all three minigames and to the final commit before the Result page).

In the consolidation / balance rationale area (`### 4d`/`### 4e`), document that synthesis now profiles dimensions over **atomic signals** (each card/die/hexagram), with **magnitude-weighted favorability** (strong pulls dominate rather than cancelling), surfaces the **strongest favorable and adverse poles**, names them when a neutral net hides opposed forces, emits a **per-position line** per spread, narrates each result under **exactly one** modifier role (disjoint frames), and uses a **narrower symmetric favorability band** (`high ≥ +0.5`, `low ≤ −0.5`).

- [ ] **Step 2: Update `README.md`**

Mirror the same two points in the README's gameplay/synthesis description: the Continue review beat after each minigame, and that balanced readings now name their opposing forces and read per position instead of re-listing the spread.

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs: sync continue-gate and atomic-signal synthesis behavior"
```

---

## Self-Review

**Spec coverage:**
- Part 1 (hover fan-out, pure function, wiring, cardIndexZ, mobile reuse) → Task 1. Mobile tap-to-fan reuses `computeFanOffsets` automatically because `fanDisplacements` is the single code path for both (the `fan.centerX` is set by either mouse-move or touch).
- Part 2.1 (engine gate, `awaitingContinue`, `continueAfterReview`, final-commit gate) → Task 2.
- Part 2.2 (GameTable control, tarot face-up during gate, dice/iching hold) → Task 3.
- Part 3a (atomic-signal expansion, magnitude favorability, modifier/theme unchanged) → Task 4.
- Part 3b (opposing-force fields + paragraph) → Tasks 4 (data) + 5 (prose).
- Part 3c (per-position line, de-dupe frames) → Task 5.
- Part 3d (narrower symmetric band + headline path) → Task 5.
- Docs sync → Task 6.

**Type consistency:** `awaitingContinue` (types + GameEngine + components) consistent. `strongestFavor`/`strongestAdverse` shape `{ label; value } | null` consistent across types, ReadingPlanner, NarrativeAssembler, and tests. `computeFanOffsets` signature matches its call site. `continueAfterReview()` name consistent in engine + GameTable + tests.

**Open decisions (from spec):** Fan math has no unit test (the function lives in the component layer Vitest does not scan; verified by typecheck + dev server). Flagged here per spec open-decision #1.
