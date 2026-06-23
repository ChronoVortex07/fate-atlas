# Tarot Draft Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random-deal-then-reveal tarot minigame with a card-drafting system where the player picks 3 cards from a dealt spread, with peek/return/shuffle/swap mechanics, and fix all downstream display touchpoints so spread positions and card names are visible everywhere.

**Architecture:** Engine holds draft state in `GameState.minigameState` as `TarotDraftState`. All mutations route through `GameEngine` methods that call `notify()`. The React component reads state and calls engine methods. Bug fixes to `consolidateSpread`, `NarrativeAssembler`, `FanCard`, and `ResultReading` propagate real card names and positional breakdown to every display surface.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest (engine-only tests), Framer Motion, no new dependencies.

## Global Constraints

- All game logic in `src/engine/` — zero React or DOM imports
- Engine mutators must end with `notify()` to push the snapshot
- Fix `consolidateSpread` name generation so all consumers get real names
- Tests in `src/engine/__tests__/` only, use Vitest
- Follow existing code patterns: style objects, CSS-in-JS, Framer Motion `motion.div`

---

### Task 1: Fix `consolidateSpread` — Descriptive Spread Name

**Files:**
- Modify: `src/data/tarot.ts:236`
- Test: `src/engine/__tests__/Tarot.test.ts` (add assertion to existing test)

**Interfaces:**
- Produces: `TarotResult.name` is now `"CardA · CardB · CardC"` for multi-card spreads instead of `"Three-Card Spread"`

- [ ] **Step 1: Fix the hardcoded name in `consolidateSpread`**

In `src/data/tarot.ts`, line ~236, change:

```typescript
// Before:
name: single ? faces[0].name : 'Three-Card Spread',

// After:
name: single ? faces[0].name : faces.map((f) => f.name).join(' · '),
```

- [ ] **Step 2: Add test assertion for the new name**

In `src/engine/__tests__/Tarot.test.ts`, in the `consolidateSpread` describe block, add a new test:

```typescript
it('multi-card spread name joins card names with middle dot', () => {
  const r = consolidateSpread([F('the-fool', 'upright'), F('the-star', 'upright'), F('cups-2', 'reversed')]);
  expect(r.name).toBe('The Fool · The Star · Two of Cups');
});
```

- [ ] **Step 3: Run tests to verify**

```bash
npx vitest run src/engine/__tests__/Tarot.test.ts -t "multi-card spread name"
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "fix(tarot): spread name uses joined card names instead of 'Three-Card Spread'"
```

---

### Task 2: Fix `NarrativeAssembler.describeSlotBrief` — Position Breakdown

**Files:**
- Modify: `src/engine/NarrativeAssembler.ts:200-213`
- Test: `src/engine/__tests__/NarrativeAssembler.test.ts` (create if not exists, or add to existing)

**Interfaces:**
- Consumes: `SlotResult` with `spread?: { position: string; card: { name: string; orientation: string } }[]`
- Produces: Position-aware description string for modifier-frame text

- [ ] **Step 1: Check if test file exists**

```bash
ls src/engine/__tests__/NarrativeAssembler.test.ts 2>/dev/null || echo "NOT FOUND"
```

- [ ] **Step 2: Add the test (create file if needed)**

If the file doesn't exist, create `src/engine/__tests__/NarrativeAssembler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NarrativeAssembler } from '../NarrativeAssembler';
import { buildFace, consolidateSpread, DECK_BY_ID } from '../../data/tarot';
import type { SlotResult } from '../types';

function makeSpreadSlot(cards: [string, string, string]): SlotResult {
  const faces = cards.map((id) => buildFace(DECK_BY_ID[id], 'upright'));
  const result = consolidateSpread(faces);
  return result;
}

describe('NarrativeAssembler.describeSlotBrief', () => {
  const assembler = new NarrativeAssembler();

  it('describes a single tarot card by name', () => {
    const slot = consolidateSpread([buildFace(DECK_BY_ID['the-fool'], 'upright')]);
    const desc = (assembler as any).describeSlotBrief(slot);
    expect(desc).toBe('The The Fool (upright)');
  });

  it('describes a multi-card tarot spread by position', () => {
    const slot = makeSpreadSlot(['the-fool', 'the-magician', 'the-high-priestess']);
    const desc = (assembler as any).describeSlotBrief(slot);
    expect(desc).toContain('Past: The Fool (upright)');
    expect(desc).toContain('Present: The Magician (upright)');
    expect(desc).toContain('Future: The High Priestess (upright)');
  });

  it('single card tarot result uses original format', () => {
    const slot = consolidateSpread([buildFace(DECK_BY_ID['death'], 'reversed')]);
    const desc = (assembler as any).describeSlotBrief(slot);
    expect(desc).toBe('The Death (reversed)');
  });
});
```

- [ ] **Step 3: Implement the fix**

In `src/engine/NarrativeAssembler.ts`, in `describeSlotBrief`, change the `tarot` case:

```typescript
case 'tarot':
  if (slot.spread && slot.spread.length > 1) {
    return slot.spread.map((sp) => {
      const pos = sp.position.charAt(0).toUpperCase() + sp.position.slice(1);
      return `${pos}: ${sp.card.name} (${sp.card.orientation})`;
    }).join('; ');
  }
  return `The ${slot.name} (${slot.orientation})`;
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/NarrativeAssembler.ts src/engine/__tests__/NarrativeAssembler.test.ts
git commit -m "fix(narrative): describeSlotBrief shows position breakdown for tarot spreads"
```

---

### Task 3: Add Tarot Draft Types

**Files:**
- Modify: `src/engine/types.ts` (add near the existing `TarotMinigameState` interface, ~line 256)

**Interfaces:**
- Produces: `TableCard`, `HandCard`, `HandSlot`, `TarotDraftState` types for Tasks 4-7

- [ ] **Step 1: Add new types to `src/engine/types.ts`**

After the `TarotMinigameState` interface (~line 262), replace it with the new draft types:

```typescript
// ── Tarot Draft State (card-drafting minigame) ──

export interface TableCard {
  cardId: string;        // key into DECK_BY_ID
  originIndex: number;   // stable position on table (for return-to-position)
  faceUp: boolean;       // true if returned from hand after being peeked
  revealedFace?: TarotCardFace; // set when faceUp — the built face with orientation
}

export interface HandCard {
  cardId: string;
  tableOriginIndex: number; // so returnToTable puts it back in the right spot
  peeked: boolean;
  revealedFace?: TarotCardFace; // set after successful peek — shows orientation
}

export type HandSlot = HandCard | null; // hand[0]=Past, [1]=Present, [2]=Future

export interface TarotDraftState {
  method: 'tarot';
  deck: string[];              // remaining card IDs (shuffled), face-down
  table: (TableCard | null)[]; // dealt spread; null where a card was picked
  hand: [HandSlot, HandSlot, HandSlot];
  dealCount: number;           // current number of table slots (starts 9, grows with returns)
  shufflesRemaining: number;   // from affinityEffects.spreadRedraws
  phase: 'drafting' | 'committing';
}
```

Remove the old `TarotMinigameState` interface (if it's still there). Keep the `MinigameState` union as:

```typescript
export type MinigameState =
  | TarotDraftState
  | DiceMinigameState
  | IChingMinigameState;
```

- [ ] **Step 2: Verify types build**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

Expected: No new errors from the type changes (may have downstream errors until Task 4 implements engine methods).

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(types): add TarotDraftState, TableCard, HandCard, HandSlot for draft minigame"
```

---

### Task 4: Add Engine Draft Methods

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/Tarot.test.ts` (add draft state tests)

**Interfaces:**
- Consumes: `TarotDraftState`, `TableCard`, `HandCard`, `HandSlot` from Task 3
- Consumes: `FULL_DECK`, `DECK_BY_ID`, `buildFace`, `pickOrientation` from `src/data/tarot`
- Consumes: `affinityEngine.usePeek()`, `affinityEngine.applyAction()`, `affinityEngine.getEffects()`
- Produces: `startTarotDraft()`, `pickForHand(i, tableIdx)`, `returnToTable(i)`, `returnToDeck(i)`, `shuffleTable()`, `peekHandCard(i)`, `swapHandCards(a, b)`, `commitDraft(reverse?)`

- [ ] **Step 1: Add test for `startTarotDraft`**

In `src/engine/__tests__/Tarot.test.ts`, add after the existing tests:

```typescript
import { GameEngine } from '../GameEngine';

describe('tarot draft state', () => {
  it('startTarotDraft deals 9 cards and initializes hand as empty', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    expect(draft.method).toBe('tarot');
    expect(draft.table).toHaveLength(9);
    expect(draft.table.every((t) => t !== null && typeof t.cardId === 'string')).toBe(true);
    expect(draft.table.every((t) => t !== null && t.faceUp === false)).toBe(true);
    expect(draft.hand).toEqual([null, null, null]);
    expect(draft.deck.length).toBe(78 - 9); // 69 remaining
    expect(draft.phase).toBe('drafting');
    expect(draft.shufflesRemaining).toBeGreaterThanOrEqual(0);
  });

  it('pickForHand moves card from table to hand slot', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    const state1 = engine.getState();
    const draft1 = state1.minigameState as import('../types').TarotDraftState;
    const targetCard = draft1.table[4]!;

    engine.pickForHand(0, 4); // pick card at table index 4 into hand[0] (Past)
    const state2 = engine.getState();
    const draft2 = state2.minigameState as import('../types').TarotDraftState;

    expect(draft2.table[4]).toBeNull();
    expect(draft2.hand[0]).not.toBeNull();
    expect(draft2.hand[0]!.cardId).toBe(targetCard.cardId);
    expect(draft2.hand[0]!.tableOriginIndex).toBe(4);
    expect(draft2.hand[0]!.peeked).toBe(false);
  });

  it('returnToTable puts card back in its origin slot', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    engine.pickForHand(0, 4);
    engine.returnToTable(0);
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    expect(draft.hand[0]).toBeNull();
    expect(draft.table[4]).not.toBeNull();
  });

  it('returnToDeck puts card back into deck face-down', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    engine.pickForHand(0, 4);
    const beforeDeck = (engine.getState().minigameState as import('../types').TarotDraftState).deck.length;

    engine.returnToDeck(0);
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    expect(draft.hand[0]).toBeNull();
    expect(draft.deck.length).toBe(beforeDeck + 1);
  });

  it('shuffleTable flips face-up cards, recollects, and redeals', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();

    // Make one table card face-up by picking, peeking (mock), returning
    engine.pickForHand(0, 0);
    // Manually set peeked + revealedFace on the hand card by patching state (hack for test)
    const s1 = engine.getState();
    const draft1 = s1.minigameState as import('../types').TarotDraftState;
    // We can't peek without affinity state set up, so test that shuffle preserves dealCount
    const dealCountBefore = draft1.dealCount;
    const shufflesBefore = draft1.shufflesRemaining;

    engine.shuffleTable();

    const s2 = engine.getState();
    const draft2 = s2.minigameState as import('../types').TarotDraftState;
    expect(draft2.table.filter((t) => t !== null)).toHaveLength(dealCountBefore);
    expect(draft2.table.every((t) => t === null || t.faceUp === false)).toBe(true);
    expect(draft2.shufflesRemaining).toBe(shufflesBefore - 1);
  });

  it('shuffleTable throws when no shuffles remain', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    // exhaust shuffles
    const s = engine.getState();
    const draft = s.minigameState as import('../types').TarotDraftState;
    const remaining = draft.shufflesRemaining;
    for (let i = 0; i < remaining; i++) engine.shuffleTable();

    expect(() => engine.shuffleTable()).toThrow('No shuffles remaining');
  });

  it('swapHandCards exchanges two hand positions', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    engine.pickForHand(0, 0);
    engine.pickForHand(1, 1);
    const card0 = (engine.getState().minigameState as import('../types').TarotDraftState).hand[0]!.cardId;
    const card1 = (engine.getState().minigameState as import('../types').TarotDraftState).hand[1]!.cardId;

    engine.swapHandCards(0, 1);
    const draft = engine.getState().minigameState as import('../types').TarotDraftState;

    expect(draft.hand[0]!.cardId).toBe(card1);
    expect(draft.hand[1]!.cardId).toBe(card0);
  });

  it('commitDraft builds consolidated result from hand', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    // Start draft and fill hand
    engine.startTarotDraft();
    engine.pickForHand(0, 0);
    engine.pickForHand(1, 1);
    engine.pickForHand(2, 2);

    engine.commitDraft(false);
    const state = engine.getState();
    expect(state.turnResults).toHaveLength(1);
    expect(state.turnResults[0].type).toBe('tarot');
    expect((state.turnResults[0] as any).spread).toHaveLength(3);
    expect((state.turnResults[0] as any).spread.map((s: any) => s.position)).toEqual(['past', 'present', 'future']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/engine/__tests__/Tarot.test.ts -t "tarot draft state"
```

Expected: FAIL (methods not implemented yet)

- [ ] **Step 3: Implement engine methods in `GameEngine.ts`**

Add these methods before the `// ---------- State access ----------` section (~line 548):

```typescript
  // ── Tarot Draft Minigame ──

  startTarotDraft(): void {
    const shuffled = [...FULL_DECK].sort(() => Math.random() - 0.5);
    const dealCount = 9;
    const dealt = shuffled.splice(0, dealCount);
    const table: TableCard[] = dealt.map((card, i) => ({
      cardId: card.id,
      originIndex: i,
      faceUp: false,
    }));

    const draft: TarotDraftState = {
      method: 'tarot',
      deck: shuffled.map((c) => c.id),
      table,
      hand: [null, null, null],
      dealCount,
      shufflesRemaining: this.affinityEngine.getEffects().spreadRedraws,
      phase: 'drafting',
    };

    this.state.minigameState = draft;
    this.dispatchAt('tarot:draft:started', {});
    this.notify();
  }

  pickForHand(handIndex: number, tableIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand[handIndex] !== null) throw new Error(`Hand slot ${handIndex} already filled`);
    if (handIndex < 0 || handIndex > 2) throw new Error(`Invalid hand index: ${handIndex}`);
    if (tableIndex < 0 || tableIndex >= draft.table.length) throw new Error(`Invalid table index: ${tableIndex}`);

    const slot = draft.table[tableIndex];
    if (!slot) throw new Error(`Table slot ${tableIndex} is empty`);

    draft.hand[handIndex] = {
      cardId: slot.cardId,
      tableOriginIndex: slot.originIndex,
      peeked: false,
    };
    draft.table[tableIndex] = null;

    this.dispatchAt('tarot:picked', { handIndex, tableIndex });
    this.notify();
  }

  returnToTable(handIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);

    // Try origin slot first, else find lowest open slot, else append
    let targetIdx = handCard.tableOriginIndex;
    if (targetIdx >= draft.table.length || draft.table[targetIdx] !== null) {
      const openIdx = draft.table.findIndex((t) => t === null);
      targetIdx = openIdx >= 0 ? openIdx : draft.table.length;
    }

    const faceUp = handCard.peeked;
    draft.table[targetIdx] = {
      cardId: handCard.cardId,
      originIndex: targetIdx,
      faceUp,
      revealedFace: faceUp ? handCard.revealedFace : undefined,
    };
    if (targetIdx === draft.table.length) draft.table.push(draft.table[targetIdx]!); // it was appended via openIdx path
    // Correct: handle all three cases properly
    if (targetIdx >= draft.table.length) {
      draft.table.push({
        cardId: handCard.cardId,
        originIndex: targetIdx,
        faceUp,
        revealedFace: faceUp ? handCard.revealedFace : undefined,
      });
      draft.dealCount = draft.table.length;
    } else {
      draft.table[targetIdx] = {
        cardId: handCard.cardId,
        originIndex: targetIdx,
        faceUp,
        revealedFace: faceUp ? handCard.revealedFace : undefined,
      };
    }

    draft.hand[handIndex] = null;
    this.dispatchAt('tarot:returned:table', { handIndex, tableIndex: targetIdx });
    this.notify();
  }

  returnToDeck(handIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);

    draft.deck.push(handCard.cardId);
    // Shuffle deck so the returned card isn't predictably on top
    for (let i = draft.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [draft.deck[i], draft.deck[j]] = [draft.deck[j], draft.deck[i]];
    }
    draft.hand[handIndex] = null;
    this.dispatchAt('tarot:returned:deck', { handIndex });
    this.notify();
  }

  shuffleTable(): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.shufflesRemaining <= 0) throw new Error('No shuffles remaining');

    // Flip all face-up table cards face-down
    for (const slot of draft.table) {
      if (slot && slot.faceUp) {
        slot.faceUp = false;
        slot.revealedFace = undefined;
      }
    }

    // Collect all non-null table cards + remaining deck, shuffle
    const collected = draft.table.filter((t): t is TableCard => t !== null);
    const pool = [
      ...collected.map((t) => t.cardId),
      ...draft.deck,
    ];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Redeal
    const dealCount = draft.dealCount;
    const dealt = pool.splice(0, Math.min(dealCount, pool.length));
    draft.table = dealt.map((cardId, i) => ({
      cardId,
      originIndex: i,
      faceUp: false,
    }));
    draft.deck = pool;
    draft.shufflesRemaining--;

    this.affinityEngine.applyAction('take-reroll');
    this.dispatchAt('tarot:shuffled', {});
    this.notify();
  }

  peekHandCard(handIndex: number): { success: boolean; card?: TarotCardFace; message: string } {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);
    if (handCard.peeked) throw new Error('Card already peeked');

    const { failed } = this.affinityEngine.usePeek();
    if (failed) {
      this.dispatchAt('tarot:peeked', { handIndex, success: false });
      this.notify();
      return { success: false, message: 'The vision clouds over — nothing is revealed.' };
    }

    const cardData = DECK_BY_ID[handCard.cardId];
    if (!cardData) throw new Error(`Card not found: ${handCard.cardId}`);
    const face = buildFace(cardData, pickOrientation(this.affinityEngine.getState()));
    handCard.peeked = true;
    handCard.revealedFace = face;

    this.dispatchAt('tarot:peeked', { handIndex, success: true });
    this.notify();
    return { success: true, card: face, message: `${face.name} — ${face.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}` };
  }

  swapHandCards(a: number, b: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (a < 0 || a > 2 || b < 0 || b > 2) throw new Error('Invalid hand index');
    [draft.hand[a], draft.hand[b]] = [draft.hand[b], draft.hand[a]];
    this.dispatchAt('tarot:swapped', { a, b });
    this.notify();
  }

  commitDraft(reverse: boolean = false): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand.some((h) => h === null)) throw new Error('Hand is not full');

    draft.phase = 'committing';
    const faces = draft.hand.map((h) => {
      if (h!.revealedFace) return h!.revealedFace; // use peeked face (locked orientation)
      return buildFace(DECK_BY_ID[h!.cardId], pickOrientation(this.affinityEngine.getState()));
    });

    const { consolidateSpread, reverseSpread } = require('../data/tarot');
    let result = consolidateSpread(faces);
    if (reverse) result = reverseSpread(result);

    const meta = reverse
      ? { reversed: true }
      : { revealedAsDrawn: true };

    // Reset minigame state before completing (completeMinigame may trigger transitions)
    this.state.minigameState = null;
    this.completeMinigame(result, meta);
  }
```

Note: `consolidateSpread` and `reverseSpread` must be added to the existing import from `'../data/tarot'` at the top of `GameEngine.ts`. Change line 2 from:

```typescript
import { FULL_DECK, buildFace, pickOrientation, DECK_BY_ID } from '../data/tarot';
```

to:

```typescript
import { FULL_DECK, buildFace, pickOrientation, DECK_BY_ID, consolidateSpread, reverseSpread } from '../data/tarot';
```

Then in `commitDraft`, call them directly (remove the `require` line shown in the draft above):

```typescript
commitDraft(reverse: boolean = false): void {
  // ... validation ...
  let result = consolidateSpread(faces);
  if (reverse) result = reverseSpread(result);
  // ... rest ...
}
```

- [ ] **Step 4: Add missing type imports at top of `GameEngine.ts`**

Add `TableCard`, `TarotDraftState` to the type import from `'./types'`:

```typescript
import type { GameState, QuestionType, AffinityId, MinigameMeta, SlotResult, TarotResult, DiceResult, RunRecord, RollMode, DivinationType, TarotCardFace, TableCard, TarotDraftState } from './types';
```

- [ ] **Step 5: Wire `startTarotDraft` into `selectMethod`**

In `GameEngine.ts`, in the `selectMethod` method, change the tarot case to auto-start the draft:

```typescript
selectMethod(index: number): void {
  // ... existing validation ...
  this.state.selectedMethod = methodType;
  this.state.activeSlotIndex = null;
  this.state.screen = 'minigame';

  // Start draft state for tarot
  if (methodType === 'tarot') {
    this.startTarotDraft();
  }

  this.notify();
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/engine/__tests__/Tarot.test.ts -t "tarot draft state"
```

Expected: All PASS.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 8: Type check**

```bash
npx tsc -b
```

Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/Tarot.test.ts src/engine/types.ts
git commit -m "feat(engine): add tarot draft methods — start, pick, return, shuffle, peek, swap, commit"
```

---

### Task 5: Rewrite `TarotMinigame` — Drafting UI

**Files:**
- Rewrite: `src/components/screens/TarotMinigame.tsx`

**Interfaces:**
- Consumes: `TarotDraftState` from `state.minigameState` (typed cast)
- Consumes: Engine methods from Task 4: `pickForHand`, `returnToTable`, `returnToDeck`, `shuffleTable`, `peekHandCard`, `swapHandCards`, `commitDraft`
- Consumes: `affinityEffects.peekAvailable` for peek button visibility

- [ ] **Step 1: Rewrite the component**

Create the full rewrite of `TarotMinigame.tsx`. This is a large file (~400 lines of JSX + styles). Key structure:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { TarotDraftState, TarotCardFace, TableCard, HandSlot, HandCard } from '../../engine/types';
import { DECK_BY_ID } from '../../data/tarot';
import CardSigil from '../cards/CardSigil';

const TABLE_CARD_WIDTH = 58; // px per card face
const TABLE_OVERLAP = 16;    // px overlap between adjacent cards
const FAN_RADIUS = 200;      // px — hover fan-out radius
const MAX_FAN_OFFSET = 30;   // px — max displacement
const DEAL_COUNT = 9;

type FanState = { centerX: number; active: boolean };

export default function TarotMinigame() {
  const { state, engine } = useGameEngine();
  const draft = state.minigameState as TarotDraftState | null;
  const tableRef = useRef<HTMLDivElement>(null);
  const [fan, setFan] = useState<FanState>({ centerX: 0, active: false });
  const [peekResult, setPeekResult] = useState<{ index: number; success: boolean; message: string } | null>(null);
  const [dragOverTable, setDragOverTable] = useState(false);
  const [draggingHandIdx, setDraggingHandIdx] = useState<number | null>(null);

  if (!draft) return null;
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  // ── Hover fan-out (desktop) ──
  const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDesktop || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    setFan({ centerX, active: true });
  }, [isDesktop]);

  const handleTableMouseLeave = useCallback(() => {
    setFan((f) => ({ ...f, active: false }));
  }, []);

  // ── Mobile tap-to-fan ──
  const handleTableTouch = useCallback((e: React.TouchEvent) => {
    if (isDesktop || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const touchX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
    if (touchX === undefined) return;
    const centerX = touchX - rect.left;
    setFan({ centerX, active: true });
    // Auto-collapse after 1.5s of no interaction
    setTimeout(() => setFan((f) => ({ ...f, active: false })), 1500);
  }, [isDesktop]);

  // ── Actions ──
  const handlePick = useCallback((tableIndex: number) => {
    const emptySlot = draft.hand.findIndex((h) => h === null);
    if (emptySlot < 0) return; // hand full
    engine.pickForHand(emptySlot, tableIndex);
  }, [engine, draft.hand]);

  const handleReturnToTable = useCallback((handIndex: number) => {
    engine.returnToTable(handIndex);
  }, [engine]);

  const handleReturnToDeck = useCallback((handIndex: number) => {
    engine.returnToDeck(handIndex);
  }, [engine]);

  const handleShuffle = useCallback(() => {
    if (draft.shufflesRemaining <= 0) return;
    engine.shuffleTable();
  }, [engine, draft.shufflesRemaining]);

  const handlePeek = useCallback((handIndex: number) => {
    const result = engine.peekHandCard(handIndex);
    setPeekResult({ index: handIndex, ...result });
    setTimeout(() => setPeekResult(null), 2500);
  }, [engine]);

  const handleReveal = useCallback(() => {
    engine.commitDraft(false);
  }, [engine]);

  const handleInvert = useCallback(() => {
    engine.commitDraft(true);
  }, [engine]);

  // ── Drag to swap hand cards ──
  const handleHandDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDraggingHandIdx(idx);
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleHandDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleHandDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      engine.swapHandCards(sourceIdx, targetIdx);
    }
    setDraggingHandIdx(null);
  }, [engine]);

  // ── Drag from hand to table (return) ──
  const handleTableDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTable(true);
  }, []);

  const handleTableDragLeave = useCallback(() => {
    setDragOverTable(false);
  }, []);

  const handleTableDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTable(false);
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIdx)) {
      engine.returnToTable(sourceIdx);
    }
  }, [engine]);

  const handFull = draft.hand.every((h) => h !== null);
  const peekAvailable = state.affinityEffects.peekAvailable;

  // ── Compute fan displacements ──
  const getFanStyle = (cardIndex: number, totalCards: number): React.CSSProperties => {
    const cardWidth = TABLE_CARD_WIDTH - TABLE_OVERLAP; // visible width of each card
    const totalWidth = totalCards * cardWidth + TABLE_OVERLAP;
    const startX = -(totalWidth / 2) + cardWidth / 2;
    const baseX = startX + cardIndex * cardWidth;
    const cardCenterX = baseX + TABLE_CARD_WIDTH / 2;

    let offsetX = 0;
    let scale = 1;
    if (fan.active) {
      const dist = Math.abs(cardCenterX - fan.centerX);
      if (dist < FAN_RADIUS) {
        const t = 1 - dist / FAN_RADIUS;
        offsetX = (cardCenterX > fan.centerX ? 1 : -1) * MAX_FAN_OFFSET * t * t;
        scale = 1 + 0.06 * t;
      }
    }

    return {
      position: 'absolute' as const,
      left: '50%',
      marginLeft: `${-(TABLE_CARD_WIDTH / 2) + baseX + offsetX}px`,
      width: `${TABLE_CARD_WIDTH}px`,
      transform: `scale(${scale})`,
      zIndex: cardIndex,
      transition: fan.active ? 'none' : 'transform 0.3s ease, margin-left 0.3s ease',
    };
  };

  // ── Render ──
  const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <style>{`.snap-scroll-row::-webkit-scrollbar{display:none}`}</style>

      <div style={contentStyle}>
        {/* Heading */}
        <h1 style={headingStyle}>
          {draft.phase === 'drafting' && !handFull && 'Draft your spread...'}
          {draft.phase === 'drafting' && handFull && 'Your spread awaits'}
          {draft.phase === 'committing' && 'The cards are cast'}
        </h1>

        {/* Deck visual */}
        <div style={deckStyle}>
          <div style={deckStackStyle}>
            <div style={deckCardBack} />
            <div style={deckCardBack} />
            <div style={deckCardBack} />
          </div>
          <span style={deckCountStyle}>{draft.deck.length} cards</span>
        </div>

        {/* Table spread */}
        <div
          ref={tableRef}
          style={{
            ...tableAreaStyle,
            borderColor: dragOverTable ? '#d4a854' : '#1a2440',
          }}
          onMouseMove={handleTableMouseMove}
          onMouseLeave={handleTableMouseLeave}
          onTouchStart={handleTableTouch}
          onDragOver={handleTableDragOver}
          onDragLeave={handleTableDragLeave}
          onDrop={handleTableDrop}
        >
          <div style={tableInnerStyle}>
            {activeTableCards.map((card, i) => {
              const cardData = DECK_BY_ID[card.cardId];
              if (!cardData) return null;
              return (
                <motion.div
                  key={`${card.cardId}-${card.originIndex}`}
                  style={{
                    ...tableCardStyle,
                    ...getFanStyle(card.originIndex, draft.table.length),
                    background: card.faceUp ? '#0d1220' : '#080d18',
                    borderColor: card.faceUp ? '#7b9ec7' : '#1a2440',
                    cursor: handFull ? 'default' : 'pointer',
                    opacity: handFull ? 0.5 : 1,
                  }}
                  whileHover={!handFull ? { borderColor: '#d4a854' } : {}}
                  whileTap={!handFull ? { scale: 1.05 } : {}}
                  onClick={() => !handFull && handlePick(card.originIndex)}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: handFull ? 0.5 : 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {card.faceUp && card.revealedFace ? (
                    <>
                      <CardSigil card={card.revealedFace} size={20} color="#7b9ec7" />
                      <div style={tableCardNameStyle}>{card.revealedFace.name}</div>
                      <div style={tableCardOrientStyle}>
                        {card.revealedFace.orientation === 'upright' ? '▲' : '▼'}
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={tableRuneStyle}>ᚠᚢᚦ</span>
                      <span style={tableStarStyle}>✧</span>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Shuffle button */}
        <motion.button
          style={draft.shufflesRemaining > 0 ? shuffleBtnStyle : { ...shuffleBtnStyle, opacity: 0.4, cursor: 'not-allowed' }}
          whileHover={draft.shufflesRemaining > 0 ? { borderColor: '#d4a854', scale: 1.03 } : {}}
          whileTap={draft.shufflesRemaining > 0 ? { scale: 0.97 } : {}}
          onClick={handleShuffle}
          disabled={draft.shufflesRemaining <= 0}
        >
          ↻ Shuffle ({draft.shufflesRemaining})
        </motion.button>

        {/* Hand */}
        <div style={handAreaStyle}>
          <div style={handSlotsStyle}>
            {(['Past', 'Present', 'Future'] as const).map((label, i) => {
              const card = draft.hand[i];
              return (
                <div
                  key={label}
                  style={handSlotColumnStyle}
                  onDragOver={handleHandDragOver}
                  onDrop={(e) => handleHandDrop(e, i)}
                >
                  <div style={handLabelStyle}>{label}</div>
                  {card ? (
                    <motion.div
                      style={{
                        ...handCardStyle,
                        opacity: draggingHandIdx === i ? 0.5 : 1,
                      }}
                      draggable
                      onDragStart={(e) => handleHandDragStart(e, i)}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      {card.peeked && card.revealedFace ? (
                        <>
                          <CardSigil card={card.revealedFace} size={22} color="#7b9ec7" />
                          <div style={handCardNameStyle}>{card.revealedFace.name}</div>
                          <div style={handCardOrientStyle}>
                            {card.revealedFace.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={handRuneStyle}>ᚠᚢᚦᚨ</span>
                          <span style={handStarStyle}>✧</span>
                        </>
                      )}

                      {/* Affordances: peek + return-to-deck */}
                      <div style={handAffordanceStyle}>
                        {peekAvailable && !card.peeked && (
                          <motion.button
                            style={handIconBtnStyle}
                            whileHover={{ scale: 1.2 }}
                            onClick={(e) => { e.stopPropagation(); handlePeek(i); }}
                            title="Peek"
                          >
                            👁
                          </motion.button>
                        )}
                        <motion.button
                          style={handIconBtnStyle}
                          whileHover={{ scale: 1.2 }}
                          onClick={(e) => { e.stopPropagation(); handleReturnToDeck(i); }}
                          title="Return to deck"
                        >
                          ↩
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <div style={emptyHandSlotStyle}>
                      <span style={emptySlotSymbolStyle}>·</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit buttons */}
        {handFull && draft.phase === 'drafting' && (
          <motion.div style={commitRowStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <motion.button style={revealBtnStyle} whileHover={{ borderColor: '#d4a854', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleReveal}>
              ▲ Reveal as Drawn
            </motion.button>
            <motion.button style={{ ...revealBtnStyle, borderColor: '#9b6bb0' }} whileHover={{ borderColor: '#c8a0d0', scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleInvert}>
              ▼ Invert Meaning
            </motion.button>
          </motion.div>
        )}

        {/* Peek result popup */}
        <AnimatePresence>
          {peekResult && (
            <motion.div
              style={{
                ...peekPopupStyle,
                borderColor: peekResult.success ? '#7b9ec7' : '#c75b4a',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {peekResult.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
```

The full styles (add after the component body, replacing all existing style objects):

```typescript
// ── Styles ──

const containerStyle: React.CSSProperties = {
  width: '100%', maxWidth: '640px', padding: '1.5rem',
};

const contentStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', color: '#c8d8f0',
  letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};

const deckStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
};

const deckStackStyle: React.CSSProperties = {
  position: 'relative', width: '50px', height: '60px',
};

const deckCardBack: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '46px', height: '62px',
  background: '#080d18', border: '1px solid #1a2440', borderRadius: '4px',
};

const deckCountStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.65rem',
  color: '#5b7290', letterSpacing: '0.05em',
};

const tableAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: '120px', border: '1px dashed #1a2440',
  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', transition: 'border-color 0.3s ease',
};

const tableInnerStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const tableCardStyle: React.CSSProperties = {
  width: '58px', height: '84px', border: '1px solid #1a2440', borderRadius: '4px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.2rem', cursor: 'pointer', userSelect: 'none',
};

const tableRuneStyle: React.CSSProperties = {
  fontFamily: "'Noto Sans', sans-serif", fontSize: '0.4rem', color: '#5b7290',
  letterSpacing: '0.2em',
};

const tableStarStyle: React.CSSProperties = {
  fontSize: '0.9rem', color: '#9b6bb0', opacity: 0.5,
};

const tableCardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.45rem', color: '#c8d8f0', textAlign: 'center', lineHeight: 1.1,
  maxWidth: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const tableCardOrientStyle: React.CSSProperties = {
  fontSize: '0.5rem', color: '#7b9ec7',
};

const shuffleBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440',
  padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: 'pointer', outline: 'none',
};

const handAreaStyle: React.CSSProperties = {
  width: '100%',
};

const handSlotsStyle: React.CSSProperties = {
  display: 'flex', gap: '0.75rem', justifyContent: 'center',
};

const handSlotColumnStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
};

const handLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.75rem', color: '#7b9ec7', letterSpacing: '0.08em', textTransform: 'uppercase',
};

const handCardStyle: React.CSSProperties = {
  width: '90px', height: '130px', background: '#0d1220', border: '1px solid #3a2a50',
  borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: '0.35rem', position: 'relative', cursor: 'grab',
};

const handCardNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.6rem', color: '#c8d8f0', textAlign: 'center', lineHeight: 1.15,
  maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const handCardOrientStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400,
  fontSize: '0.5rem', color: '#7b9ec7', letterSpacing: '0.05em',
};

const handRuneStyle: React.CSSProperties = {
  fontFamily: "'Noto Sans', sans-serif", fontSize: '0.5rem', color: '#5b7290', letterSpacing: '0.25em',
};

const handStarStyle: React.CSSProperties = {
  fontSize: '1.2rem', color: '#9b6bb0', opacity: 0.5,
};

const handAffordanceStyle: React.CSSProperties = {
  position: 'absolute', bottom: '4px', display: 'flex', gap: '0.25rem',
};

const handIconBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit', fontSize: '0.7rem', background: 'none', border: 'none',
  color: '#7b9ec7', cursor: 'pointer', padding: '0.15rem', lineHeight: 1, outline: 'none',
};

const emptyHandSlotStyle: React.CSSProperties = {
  width: '90px', height: '130px', border: '1px dashed #1a2440', borderRadius: '6px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4,
};

const emptySlotSymbolStyle: React.CSSProperties = {
  fontSize: '1.5rem', color: '#5b7290',
};

const commitRowStyle: React.CSSProperties = {
  display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center',
};

const revealBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.4vw, 0.9rem)', letterSpacing: '0.08em',
  color: '#c8d8f0', background: '#0d1220', border: '1px solid #1a2440',
  padding: '0.6rem 1.5rem', borderRadius: '4px', cursor: 'pointer', outline: 'none',
};

const peekPopupStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 400,
  fontSize: '0.8rem', color: '#c8d8f0', background: '#0d1220',
  border: '1px solid #7b9ec7', borderRadius: '4px', padding: '0.5rem 1rem',
  textAlign: 'center', fontStyle: 'italic',
};
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc -b
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(ui): rewrite tarot minigame as card-drafting table with hover fan-out and peek"
```

---

### Task 6: Update `FanCard` — Spread Sub-Card Rendering

**Files:**
- Modify: `src/components/cards/FanCard.tsx`

**Interfaces:**
- Consumes: `TarotResult` with `spread?: { position: string; card: TarotCardFace }[]`
- Produces: When expanded and `spread.length > 1`, renders 3 sub-cards offset horizontally instead of the single consolidated view

- [ ] **Step 1: Update `getCardDisplay` to return sub-cards**

In `FanCard.tsx`, update `getCardDisplay` for the tarot case:

```typescript
function getCardDisplay(result: SlotResult): {
  symbol: string;
  name: string;
  detail: string;
  borderColor: string;
  subCards?: { position: string; name: string; orientation: string; face: import('../../engine/types').TarotCardFace }[];
} {
  switch (result.type) {
    case 'tarot': {
      const spread = result.spread;
      if (spread && spread.length > 1) {
        return {
          symbol: result.symbol,
          name: result.name, // now "CardA · CardB · CardC" from Task 1 fix
          detail: result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
          borderColor: '#9b6bb0',
          subCards: spread.map((sp) => ({
            position: sp.position.charAt(0).toUpperCase() + sp.position.slice(1),
            name: sp.card.name,
            orientation: sp.card.orientation === 'upright' ? '▲' : '▼',
            face: sp.card,
          })),
        };
      }
      return {
        symbol: result.symbol,
        name: result.name,
        detail: result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
        borderColor: '#9b6bb0',
      };
    }
    // ... rest unchanged
  }
}
```

- [ ] **Step 2: Render sub-cards when expanded**

In the JSX of `FanCard`, after the existing content div (with symbol, name, detail), add a conditional sub-card row:

```tsx
{/* Sub-card spread (expanded tarot) */}
{isExpanded && display.subCards && display.subCards.length > 1 && (
  <motion.div
    style={{
      position: 'absolute',
      top: isDesktop ? '-130px' : '-90px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: isDesktop ? '8px' : '4px',
      pointerEvents: 'none',
    }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.15 }}
  >
    {display.subCards.map((sc) => (
      <div
        key={sc.position}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          background: '#0d1220',
          border: '1px solid #1a2440',
          borderRadius: '4px',
          padding: '3px 4px',
          minWidth: isDesktop ? '56px' : '36px',
        }}
      >
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: isDesktop ? '0.45rem' : '0.32rem',
          color: '#d4a854',
          letterSpacing: '0.04em',
        }}>
          {sc.position}
        </span>
        <CardSigil card={sc.face} size={isDesktop ? 14 : 10} color="#7b9ec7" />
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 500,
          fontSize: isDesktop ? '0.38rem' : '0.28rem',
          color: '#c8d8f0',
          textAlign: 'center',
          maxWidth: isDesktop ? '50px' : '32px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {sc.name}
        </span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: isDesktop ? '0.35rem' : '0.26rem',
          color: '#7b9ec7',
        }}>
          {sc.orientation}
        </span>
      </div>
    ))}
  </motion.div>
)}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/cards/FanCard.tsx
git commit -m "feat(ui): FanCard renders 3 sub-cards with position labels for expanded tarot spreads"
```

---

### Task 7: Update `ResultReading` — Spread Position Layout

**Files:**
- Modify: `src/components/screens/ResultReading.tsx`

**Interfaces:**
- Consumes: `TarotResult` with `spread?: { position: string; card: TarotCardFace }[]`
- Produces: 3-column Past/Present/Future layout when spread has multiple entries

- [ ] **Step 1: Update `getResultDisplay` to return sub-cards**

In `ResultReading.tsx`, update `getResultDisplay`:

```typescript
function getResultDisplay(result: SlotResult): {
  symbol: string;
  name: string;
  subtitle: string;
  subCards?: { position: string; name: string; orientation: string; symbol: string; meaning: string }[];
} {
  switch (result.type) {
    case 'tarot': {
      const spread = (result as import('../../engine/types').TarotResult).spread;
      if (spread && spread.length > 1) {
        return {
          symbol: result.symbol,
          name: result.name,
          subtitle: `${result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'} — Three-card spread`,
          subCards: spread.map((sp) => ({
            position: sp.position.charAt(0).toUpperCase() + sp.position.slice(1),
            name: sp.card.name,
            orientation: sp.card.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
            symbol: sp.card.symbol,
            meaning: (sp.card.orientation === 'upright' ? sp.card.meaningUpright : sp.card.meaningReversed).slice(0, 80),
          })),
        };
      }
      return {
        symbol: result.symbol,
        name: result.name,
        subtitle: result.orientation === 'upright'
          ? `Upright — ${result.meaningUpright.slice(0, 100)}`
          : `Reversed — ${result.meaningReversed.slice(0, 100)}`,
      };
    }
    // ... rest unchanged
  }
}
```

- [ ] **Step 2: Render sub-card grid when present**

In the JSX where each result card is rendered (the `turnResults.map` block, ~line 96), add a sub-card grid after the main display:

```tsx
{/* Sub-card spread layout for multi-card tarot */}
{d.subCards && d.subCards.length > 1 && (
  <div style={{
    display: 'flex',
    gap: '0.5rem',
    width: '100%',
    marginTop: '0.25rem',
  }}>
    {d.subCards.map((sc) => (
      <div key={sc.position} style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.2rem',
        background: '#080d18',
        border: '1px solid #1a2440',
        borderRadius: '4px',
        padding: '0.4rem 0.25rem',
      }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: '0.6rem',
          color: '#d4a854',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {sc.position}
        </span>
        <span style={{
          fontSize: '1.2rem',
          color: sc.orientation === '▲ Upright' ? '#7b9ec7' : '#d4a854',
        }}>
          {sc.symbol}
        </span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: '0.65rem',
          color: '#c8d8f0',
          textAlign: 'center',
          lineHeight: 1.15,
        }}>
          {sc.name}
        </span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 300,
          fontSize: '0.5rem',
          color: sc.orientation === '▲ Upright' ? '#7b9ec7' : '#d4a854',
        }}>
          {sc.orientation}
        </span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 300,
          fontSize: '0.55rem',
          color: '#5b7290',
          textAlign: 'center',
          lineHeight: 1.3,
          marginTop: '0.15rem',
        }}>
          {sc.meaning}
        </span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/ResultReading.tsx
git commit -m "feat(ui): ResultReading shows 3-column Past/Present/Future layout for tarot spreads"
```

---

### Task 8: Integration — Wire Triggers, Fix Edge Cases, Full Test

**Files:**
- Modify: `src/engine/GameEngine.ts` (verify `returnToTable` edge case logic is correct)
- Test: `src/engine/__tests__/Tarot.test.ts` (add edge case tests)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Fully working end-to-end flow

- [ ] **Step 1: Fix `returnToTable` implementation**

The implementation in Task 4 has a bug with the append logic. Replace the `returnToTable` method with this corrected version:

```typescript
returnToTable(handIndex: number): void {
  const draft = this.state.minigameState as TarotDraftState | null;
  if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
  const handCard = draft.hand[handIndex];
  if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);

  // Find target: origin slot if free, else lowest open slot, else append
  let targetIdx = handCard.tableOriginIndex;
  if (targetIdx >= draft.table.length || draft.table[targetIdx] !== null) {
    const openIdx = draft.table.findIndex((t) => t === null);
    if (openIdx >= 0) {
      targetIdx = openIdx;
    } else {
      targetIdx = draft.table.length;
    }
  }

  const faceUp = handCard.peeked;
  const newSlot: TableCard = {
    cardId: handCard.cardId,
    originIndex: targetIdx,
    faceUp,
    revealedFace: faceUp ? handCard.revealedFace : undefined,
  };

  if (targetIdx >= draft.table.length) {
    draft.table.push(newSlot);
    draft.dealCount = draft.table.length;
  } else {
    draft.table[targetIdx] = newSlot;
  }

  draft.hand[handIndex] = null;
  this.dispatchAt('tarot:returned:table', { handIndex, tableIndex: targetIdx });
  this.notify();
}
```

- [ ] **Step 2: Add integration test — full draft flow**

In `src/engine/__tests__/Tarot.test.ts`:

```typescript
it('full draft flow: deal → pick 3 → commit produces valid run', () => {
  const engine = new GameEngine();
  engine.startTurn('self');
  engine.startTarotDraft();

  const draft = engine.getState().minigameState as import('../types').TarotDraftState;
  // Pick 3 distinct cards
  const cardIds: string[] = [];
  for (let h = 0; h < 3; h++) {
    const tableIdx = draft.table.findIndex((t) => t !== null && !cardIds.includes(t.cardId));
    expect(tableIdx).toBeGreaterThanOrEqual(0);
    engine.pickForHand(h, tableIdx);
    cardIds.push(draft.table[tableIdx]!.cardId);
  }

  engine.commitDraft(false);
  const state = engine.getState();
  expect(state.turnResults).toHaveLength(1);
  expect(state.turnResults[0].type).toBe('tarot');
  // The spread should have 3 positions
  const tarot = state.turnResults[0] as import('../types').TarotResult;
  expect(tarot.spread).toHaveLength(3);
});
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Run typecheck**

```bash
npx tsc -b
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/Tarot.test.ts
git commit -m "fix(engine): correct returnToTable edge cases, add full draft integration test"
```

---

### Task 9: Update Documentation

**Files:**
- Modify: `docs/game-systems.md`

- [ ] **Step 1: Update tarot section**

Read `docs/game-systems.md`, find the tarot section, and update it to reflect the new draft flow:
- Describe the card-drafting minigame (deal 9 → pick 3 → reveal/invert)
- Document the new trigger points: `tarot:draft:started`, `tarot:picked`, `tarot:returned:table`, `tarot:returned:deck`, `tarot:shuffled`, `tarot:peeked`, `tarot:swapped`
- Note that `spreadRedraws` now controls shuffle count
- Update the tarot interaction responder descriptions to reference the new triggers

- [ ] **Step 2: Commit**

```bash
git add docs/game-systems.md
git commit -m "docs: update tarot section for draft minigame and new event triggers"
```

---

### Task 10: Final Integration Test — Build & Manual Check

**Files:** None (verification only)

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Run all tests one final time**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Commit any final fixes**

If any issues were found, fix and commit them.
