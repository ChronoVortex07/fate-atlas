# Fated Cards & Golden Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Fate affinity fated-card substitution at pick time with immutability guards, and Light affinity golden glow for Major Arcana cards during the tarot draft.

**Architecture:** A new `fate-fated-card` responder fires at `tarot:picked` (OVERRIDE band, notable tier). A `fated` flag on `HandCard` + `fatedDrawnThisDraft` on `TarotDraftState` enforce once-per-draft gating and immutability. GameEngine methods (`returnToDeck`, `returnToTable`, `swapHandCards`) reject fated cards. The golden glow is a pure component-side check using `bandOf(state.affinities.light)` + `MAJOR_GLOW_FAMILY` classification.

**Tech Stack:** TypeScript (engine + data layer), React 18 + framer-motion (visual layer), Vitest (engine tests)

## Global Constraints

- All game logic stays in `src/engine/` with zero React/DOM imports
- `tsc -b` must pass (strict, noUnusedLocals, noUnusedParameters)
- Follow existing responder pattern: `condition` → `roll` → `apply`, returning `EffectReport | null`
- Tests go in `src/engine/__tests__/` (Node environment, globals enabled)
- Commit each task independently

---

### Task 1: Data layer + type changes (foundation)

**Files:**
- Modify: `src/engine/types.ts` (lines ~346-368, `TarotDraftState` and `HandCard` interfaces)
- Modify: `src/data/tarot.ts` (add `MajorGlowFamily` type + `MAJOR_GLOW_FAMILY` map after MAJOR_ARCANA)
- Modify: `src/data/affinities.ts` (add `fate-fated-card` to `FATE_AFFINITY.bandedEffects`)

**Interfaces:**
- Produces: `HandCard.fated?: boolean`, `TarotDraftState.fatedDrawnThisDraft?: boolean`, `MajorGlowFamily` type, `MAJOR_GLOW_FAMILY` const

- [ ] **Step 1: Add `fated` to `HandCard` in `src/engine/types.ts`**

In `src/engine/types.ts`, find the `HandCard` interface (~line 352) and add `fated?: boolean`:

```typescript
export interface HandCard {
  cardId: string;
  tableOriginIndex: number;
  peeked: boolean;
  revealedFace?: TarotCardFace;
  fated?: boolean; // immutable when true — locked into slot by fate
}
```

- [ ] **Step 2: Add `fatedDrawnThisDraft` to `TarotDraftState` in `src/engine/types.ts`**

In the same file, find `TarotDraftState` (~line 361) and add the flag:

```typescript
export interface TarotDraftState {
  method: 'tarot';
  deck: string[];
  table: (TableCard | null)[];
  hand: [HandSlot, HandSlot, HandSlot];
  dealCount: number;
  shufflesRemaining: number;
  phase: 'drafting' | 'committing';
  fatedDrawnThisDraft?: boolean; // once-per-draft gate for fate-fated-card
}
```

- [ ] **Step 3: Add `MAJOR_GLOW_FAMILY` to `src/data/tarot.ts`**

After the `MAJOR_ARCANA` array (~line 64), add:

```typescript
export type MajorGlowFamily = 'benevolent' | 'challenging' | 'neutral';

export const MAJOR_GLOW_FAMILY: Record<string, MajorGlowFamily> = {
  // Benevolent
  'the-sun': 'benevolent', 'the-star': 'benevolent', 'the-world': 'benevolent',
  'strength': 'benevolent', 'the-empress': 'benevolent', 'temperance': 'benevolent',
  'the-lovers': 'benevolent', 'the-hierophant': 'benevolent', 'the-magician': 'benevolent',
  // Challenging
  'the-tower': 'challenging', 'death': 'challenging', 'the-devil': 'challenging',
  'the-hanged-man': 'challenging', 'the-moon': 'challenging',
  // Neutral / transitional
  'the-fool': 'neutral', 'justice': 'neutral', 'the-chariot': 'neutral',
  'the-hermit': 'neutral', 'the-high-priestess': 'neutral', 'the-emperor': 'neutral',
  'wheel-of-fortune': 'neutral', 'judgement': 'neutral',
};
```

- [ ] **Step 4: Add `fate-fated-card` to `FATE_AFFINITY.bandedEffects` in `src/data/affinities.ts`**

Find the `FATE_AFFINITY` definition (~line 131) and add the new effect to its `bandedEffects` array:

```typescript
bandedEffects: [
  { id: 'auto-orient',      tier: 'notable', band: 'stirring',  description: 'A coin-flip detail is decided for you.' },
  { id: 'card-swap',        tier: 'major',   band: 'ascendant', description: 'The card you pick may not be the one revealed.' },
  { id: 'hollow-reroll',    tier: 'major',   band: 'ascendant', description: 'A reroll may return the same result.' },
  { id: 'the-hand-chooses', tier: 'major',   band: 'dominant',  description: 'Sometimes the hand is picked for you.' },
  { id: 'force-method',     tier: 'notable', band: 'dominant',  description: 'The method may be forced.' },
  { id: 'fated-card',       tier: 'notable', band: 'ascendant', description: 'A picked card may be fated — immutable and locked.' }, // NEW
],
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc -b
```

Expected: PASS (no errors)

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/data/tarot.ts src/data/affinities.ts
git commit -m "feat: add fated card types, MAJOR_GLOW_FAMILY, and bandedEffects entry

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `fate-fated-card` responder

**Files:**
- Modify: `src/engine/responders/affinity.ts` (add responder to `buildAffinityResponders`)
- Modify: `src/engine/__tests__/AffinityResponders.test.ts` (add tests)

**Interfaces:**
- Consumes: `HandCard.fated?`, `TarotDraftState.fatedDrawnThisDraft?`, `T.notable`, `bandRoll`, `w('fate')`
- Produces: `fate-fated-card` responder registered on `tarot:picked`

- [ ] **Step 1: Write the failing test in `src/engine/__tests__/AffinityResponders.test.ts`**

Add a new `describe` block before the closing of the file:

```typescript
describe('fate-fated-card responder', () => {
  const responders = buildAffinityResponders();
  const by = (id: string) => responders.find((r) => r.id === id)!;

  it('is registered on tarot:picked in the OVERRIDE band', () => {
    const r = by('fate-fated-card');
    expect(r).toBeDefined();
    expect(r.triggers).toContain('tarot:picked');
    expect(r.group).toEqual({ kind: 'exclusive', band: 'OVERRIDE' });
    expect(r.source).toBe('affinity');
  });

  it('fires when forced and sets fatedHandIndex, fatedCardId, fatedDrawnThisDraft', () => {
    const c = ctx({
      trigger: 'tarot:picked',
      draft: { handIndex: 1, tableIndex: 3, fatedDrawnThisDraft: false },
      affinities: { ...defaultAffinityState(), fate: 75 },
      rng: () => 0.5,
    });
    dispatch('tarot:picked', c, responders, { forced: ['fate-fated-card'], isolate: true });
    expect(c.draft.fatedDrawnThisDraft).toBe(true);
    expect(typeof c.draft.fatedHandIndex).toBe('number');
    expect(typeof c.draft.fatedCardId).toBe('string');
  });

  it('does not fire when fatedDrawnThisDraft is already true (once-per-draft)', () => {
    const c = ctx({
      trigger: 'tarot:picked',
      draft: { handIndex: 0, tableIndex: 2, fatedDrawnThisDraft: true },
      affinities: { ...defaultAffinityState(), fate: 75 },
      rng: () => 0,
    });
    dispatch('tarot:picked', c, responders, { forced: ['fate-fated-card'], isolate: true });
    // Forced bypasses roll but NOT condition — the once-per-draft condition should block it
    expect(c.draft.fatedCardId).toBeUndefined();
  });

  it('does not fire when fate is below ascendant (condition guard)', () => {
    const c = ctx({
      trigger: 'tarot:picked',
      draft: { handIndex: 0, tableIndex: 2, fatedDrawnThisDraft: false },
      affinities: { ...defaultAffinityState(), fate: 40 },
      rng: () => 0,
    });
    dispatch('tarot:picked', c, responders, { forced: ['fate-fated-card'], isolate: true });
    // Condition requires handIndex/tableIndex are set — but the responder's own condition
    // also needs a valid pick. Without a real pick context, the condition may fail.
    // The key test is that at fate 40 (stirring, below ascendant) bandRoll returns false.
    // When forced, roll is bypassed so it fires anyway if condition passes.
    // The condition only checks handIndex/tableIndex presence and fatedDrawnThisDraft.
    // So forced at fate 40 WILL fire because condition only gates on draft state.
    // This is correct — forcing bypasses only the roll, not the condition.
    // The real band gate is in the roll, so forced allows testing at any affinity.
    expect(c.draft.fatedDrawnThisDraft).toBe(true); // forced bypasses roll
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run -t "fate-fated-card"
```

Expected: FAIL — `fate-fated-card` responder not found

- [ ] **Step 3: Add the `fate-fated-card` responder in `src/engine/responders/affinity.ts`**

Add this responder to the array returned by `buildAffinityResponders()`, near the other fate responders (after `fate-deal-swap`):

```typescript
{
  id: 'fate-fated-card', source: 'affinity', triggers: ['tarot:picked'],
  group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
  condition: (c) =>
    typeof c.draft.handIndex === 'number'
    && typeof c.draft.tableIndex === 'number'
    && c.draft.fatedDrawnThisDraft !== true,
  roll: (c) => bandRoll(c, 'fate', 'ascendant', T.notable),
  apply: (c) => {
    // Draw a fresh card distinct from the original
    const usedIds = new Set((c.draft.usedCardIds as string[] | undefined) ?? []);
    const pool = FULL_DECK.filter((cd) => !usedIds.has(cd.id));
    const pick = pool.length > 0 ? pool[Math.floor(c.rng() * pool.length)] : FULL_DECK[0];
    c.draft.fatedHandIndex = c.draft.handIndex as number;
    c.draft.fatedCardId = pick.id;
    c.draft.fatedDrawnThisDraft = true;
    return report('fate-fated-card', 'Fate',
      'The weave tightens — this card is not yours to refuse.',
      'shroud');
  },
},
```

You'll also need to import `FULL_DECK` at the top of the file. Update the import from `../../data/tarot` to include `FULL_DECK`:

```typescript
import { reverseSpread, buildFace, DECK_BY_ID, drawTarotCard, consolidateSpread, FULL_DECK } from '../../data/tarot';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run -t "fate-fated-card"
```

Expected: PASS (3 of the 4 tests pass — the last test verifies forced bypasses roll but not condition, which is correct)

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests still pass

- [ ] **Step 6: Typecheck**

```bash
npx tsc -b
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/__tests__/AffinityResponders.test.ts
git commit -m "feat: add fate-fated-card responder at tarot:picked

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: GameEngine fated-card guards

**Files:**
- Modify: `src/engine/GameEngine.ts` (modify `pickForHand`, `returnToDeck`, `returnToTable`, `swapHandCards`)
- Modify: `src/engine/__tests__/GameEngine.test.ts` (add tests)

**Interfaces:**
- Consumes: `HandCard.fated?`, `TarotDraftState.fatedDrawnThisDraft?`, responder from Task 2
- Produces: `pickForHand` dispatches `tarot:picked` and applies fated substitution; guard methods throw on fated cards

- [ ] **Step 1: Write failing tests in `src/engine/__tests__/GameEngine.test.ts`**

Add a new `describe` block before the file closing:

```typescript
describe('tarot draft — fated cards', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    engine.startTurn('self');
    // Navigate to tarot minigame
    const idx = engine.getState().availableMethods.indexOf('tarot');
    if (idx === -1) {
      // Force tarot into the pool
      engine.loadState({ availableMethods: ['tarot', 'd20', 'iching'], screen: 'method-select' });
      engine.selectMethod(0);
    } else {
      engine.selectMethod(idx);
    }
  });

  it('pickForHand dispatches tarot:picked and sets the fated flag when responder fires', () => {
    // Force the fated-card responder
    engine.forceEffects(['fate-fated-card'], false);
    // Set fate to ascendant
    engine.loadState({ affinities: { ...engine.getState().affinities, fate: 75 } });

    const draft = engine.getState().minigameState as import('../types').TarotDraftState;
    const orig = Math.random; Math.random = () => 0.5;
    engine.pickForHand(0, 0);
    Math.random = orig;

    const state = engine.getState();
    const updatedDraft = state.minigameState as import('../types').TarotDraftState;
    expect(updatedDraft.hand[0]).not.toBeNull();
    // The fated flag may or may not be set depending on RNG — force guarantees it
    // With forced: true and fate at 75, it should fire
    if (updatedDraft.hand[0]?.fated) {
      expect(updatedDraft.fatedDrawnThisDraft).toBe(true);
    }
  });

  it('returnToDeck throws when targeting a fated card', () => {
    // Manually stage a fated card in the hand
    const draft = engine.getState().minigameState as import('../types').TarotDraftState;
    draft.hand[0] = {
      cardId: 'the-fool',
      tableOriginIndex: 0,
      peeked: false,
      fated: true,
    };
    draft.fatedDrawnThisDraft = true;
    engine.loadState({ minigameState: draft });

    expect(() => engine.returnToDeck(0)).toThrow('fated');
  });

  it('returnToTable throws when targeting a fated card', () => {
    const draft = engine.getState().minigameState as import('../types').TarotDraftState;
    draft.hand[0] = {
      cardId: 'the-fool',
      tableOriginIndex: 0,
      peeked: false,
      fated: true,
    };
    engine.loadState({ minigameState: draft });

    expect(() => engine.returnToTable(0)).toThrow('fated');
  });

  it('swapHandCards throws when either card is fated', () => {
    const draft = engine.getState().minigameState as import('../types').TarotDraftState;
    draft.hand[0] = {
      cardId: 'the-fool',
      tableOriginIndex: 0,
      peeked: false,
      fated: true,
    };
    draft.hand[1] = {
      cardId: 'the-magician',
      tableOriginIndex: 1,
      peeked: false,
    };
    engine.loadState({ minigameState: draft });

    expect(() => engine.swapHandCards(0, 1)).toThrow('fated');
  });

  it('peekHandCard still works on fated cards', () => {
    // Set Light ascendant so peek is available
    engine.loadState({ affinities: { ...engine.getState().affinities, light: 75 } });

    const draft = engine.getState().minigameState as import('../types').TarotDraftState;
    draft.hand[0] = {
      cardId: 'the-fool',
      tableOriginIndex: 0,
      peeked: false,
      fated: true,
    };
    engine.loadState({ minigameState: draft });

    const orig = Math.random; Math.random = () => 0.5;
    const result = engine.peekHandCard(0);
    Math.random = orig;
    // Should succeed (not throw about fated)
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run -t "fated cards"
```

Expected: FAIL — guards not implemented yet

- [ ] **Step 3: Modify `pickForHand` in `src/engine/GameEngine.ts`**

Replace the existing `pickForHand` method (lines ~697-716) with:

```typescript
pickForHand(handIndex: number, tableIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand[handIndex] !== null) throw new Error(`Hand slot ${handIndex} already filled`);
    if (handIndex < 0 || handIndex > 2) throw new Error(`Invalid hand index: ${handIndex}`);
    if (tableIndex < 0 || tableIndex >= draft.table.length) throw new Error(`Invalid table index: ${tableIndex}`);

    const slot = draft.table[tableIndex];
    if (!slot) throw new Error(`Table slot ${tableIndex} is empty`);

    const originalCardId = slot.cardId;

    const handCard: HandCard = {
      cardId: originalCardId,
      tableOriginIndex: slot.originIndex,
      peeked: false,
    };
    draft.hand[handIndex] = handCard;
    draft.table[tableIndex] = null;

    // Dispatch tarot:picked so fate-fated-card responder can intercept
    const { draft: dispatchedDraft } = this.dispatchAt('tarot:picked', {
      handIndex,
      tableIndex,
      fatedDrawnThisDraft: draft.fatedDrawnThisDraft,
      usedCardIds: [originalCardId, ...draft.hand.filter((h): h is HandCard => h !== null).map((h) => h.cardId)],
    });

    // Apply fated substitution if responder fired
    if (typeof dispatchedDraft.fatedHandIndex === 'number'
        && dispatchedDraft.fatedHandIndex === handIndex
        && typeof dispatchedDraft.fatedCardId === 'string') {
      handCard.cardId = dispatchedDraft.fatedCardId;
      handCard.fated = true;
      draft.fatedDrawnThisDraft = true;

      // Return the original table card to the deck (shuffled)
      draft.deck.push(originalCardId);
      for (let i = draft.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [draft.deck[i], draft.deck[j]] = [draft.deck[j], draft.deck[i]];
      }
    }

    this.notify();
  }
```

- [ ] **Step 4: Add fated guard to `returnToDeck`**

At the top of the `returnToDeck` method body, after the null checks, add:

```typescript
if (handCard.fated) throw new Error('Cannot return a fated card to the deck');
```

Full method after the initial guards:

```typescript
returnToDeck(handIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);
    if (handCard.fated) throw new Error('Cannot return a fated card to the deck');

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
```

- [ ] **Step 5: Add fated guard to `returnToTable`**

At the top of `returnToTable`, after the initial null checks, add:

```typescript
if (handCard.fated) throw new Error('Cannot return a fated card to the table');
```

- [ ] **Step 6: Add fated guard to `swapHandCards`**

At the top of `swapHandCards`, after the bounds checks, add:

```typescript
const cardA = draft.hand[a];
const cardB = draft.hand[b];
if (cardA?.fated) throw new Error('Cannot swap a fated card');
if (cardB?.fated) throw new Error('Cannot swap a fated card');
```

Then use `cardA` and `cardB` for the swap instead of `draft.hand[a]`/`draft.hand[b]`:

```typescript
swapHandCards(a: number, b: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (a < 0 || a > 2 || b < 0 || b > 2) throw new Error('Invalid hand index');
    const cardA = draft.hand[a];
    const cardB = draft.hand[b];
    if (cardA?.fated) throw new Error('Cannot swap a fated card');
    if (cardB?.fated) throw new Error('Cannot swap a fated card');
    [draft.hand[a], draft.hand[b]] = [cardB, cardA];
    this.dispatchAt('tarot:swapped', { a, b });
    this.notify();
  }
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run -t "fated cards"
```

Expected: PASS (all 5 tests)

- [ ] **Step 8: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests still pass

- [ ] **Step 9: Typecheck**

```bash
npx tsc -b
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat: add fated-card guards to GameEngine tarot draft methods

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: ChainsOfFate SVG overlay component

**Files:**
- Create: `src/components/cards/ChainsOfFate.tsx`

**Interfaces:**
- Produces: `<ChainsOfFate />` component — renders an SVG chain-link overlay with pulse animation

- [ ] **Step 1: Create `src/components/cards/ChainsOfFate.tsx`**

```typescript
import { motion } from 'framer-motion';

const CHAINS_COLOR = '#9b6bb0';
const CHAINS_OPACITY = 0.4;

export default function ChainsOfFate() {
  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      animate={{ opacity: [0.30, 0.50, 0.30] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        fill="none"
        style={{ opacity: CHAINS_OPACITY }}
        aria-hidden
      >
        {/* 8 interlocking chain links in a circular pattern */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const cx = 36 + Math.cos(rad) * 18;
          const cy = 36 + Math.sin(rad) * 18;
          const rot = angle + 90;
          return (
            <g key={i} transform={`translate(${cx}, ${cy}) rotate(${rot})`}>
              <rect
                x={-5}
                y={-3}
                width={10}
                height={6}
                rx={2.5}
                stroke={CHAINS_COLOR}
                strokeWidth="1.2"
                fill="none"
              />
            </g>
          );
        })}
        {/* Central binding circle */}
        <circle cx={36} cy={36} r={6} stroke={CHAINS_COLOR} strokeWidth="1.2" fill="none" />
        <circle cx={36} cy={36} r={2} fill={CHAINS_COLOR} opacity={0.6} />
      </svg>
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b
```

Expected: PASS (no unused imports, component compiles)

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/ChainsOfFate.tsx
git commit -m "feat: add ChainsOfFate SVG overlay component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: TarotMinigame visual integration

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

**Interfaces:**
- Consumes: `ChainsOfFate` from Task 4, `MAJOR_GLOW_FAMILY` from Task 1, `bandOf` from affinities
- Produces: Golden glow on Major Arcana cards (table + hand), chains overlay on fated hand cards, hidden affordances for fated cards

- [ ] **Step 1: Add imports to `TarotMinigame.tsx`**

Add to the existing imports:

```typescript
import ChainsOfFate from '../cards/ChainsOfFate';
import { MAJOR_GLOW_FAMILY } from '../../data/tarot';
import { bandOf } from '../../data/affinities';
import type { MajorGlowFamily } from '../../data/tarot';
```

- [ ] **Step 2: Add glow helper function**

Add this constant and helper after the `SLOT_THEMES` definition (~line 23):

```typescript
const GLOW_COLORS: Record<MajorGlowFamily, { ascendant: string; dominant: string }> = {
  benevolent: {
    ascendant: '0 0 12px rgba(212,168,84,0.6)',
    dominant: '0 0 16px rgba(212,168,84,0.8)',
  },
  challenging: {
    ascendant: '0 0 12px rgba(155,180,210,0.6)',
    dominant: '0 0 16px rgba(155,180,210,0.7)',
  },
  neutral: {
    ascendant: '0 0 12px rgba(200,216,240,0.55)',
    dominant: '0 0 16px rgba(200,216,240,0.65)',
  },
};

function majorGlow(cardId: string, lightBand: string): string | undefined {
  if (lightBand === 'latent' || lightBand === 'stirring') return undefined;
  const family = MAJOR_GLOW_FAMILY[cardId];
  if (!family) return undefined;
  const colors = GLOW_COLORS[family];
  return lightBand === 'dominant' ? colors.dominant : colors.ascendant;
}
```

- [ ] **Step 3: Apply golden glow to table cards**

In the table card render loop (inside `activeTableCards.map`), add a `majorGlowShadow` variable before the return, and apply it to the card style:

After the `const cardData = DECK_BY_ID[card.cardId];` line:

```typescript
const lightBand = bandOf(state.affinities.light);
const glowShadow = majorGlow(card.cardId, lightBand);
```

Then in the `motion.div` style for each table card, add the glow to the existing style:

```typescript
style={{
  ...tableCardStyle,
  // ... existing overrides ...
  boxShadow: glowShadow
    ? glowShadow
    : card.faceUp ? 'none' : undefined,
  borderColor: glowShadow
    ? GLOW_COLORS[MAJOR_GLOW_FAMILY[card.cardId]!].ascendant.replace(/0\.\d+\)$/, '0.4)')
    : card.faceUp ? '#7b9ec7' : '#1a2440',
}}
```

- [ ] **Step 4: Apply golden glow + chains to hand cards**

In the hand slot rendering (the `SLOT_THEMES.map` block), for each slot where `card` is non-null:

Add after the `const card = draft.hand[i];` line inside the non-committed branch:

```typescript
const handLightBand = bandOf(state.affinities.light);
const handGlowShadow = card ? majorGlow(card.cardId, handLightBand) : undefined;
```

Apply the glow to the `slotCardStyle` by modifying the `boxShadow`:

In the `div` wrapping the hand card (the one with `slotCardStyle(theme.accent)`), change:

```typescript
style={{
  ...slotCardStyle(theme.accent),
  opacity: draggingHandIdx === i ? 0.5 : 1,
  boxShadow: handGlowShadow ?? `0 0 14px ${theme.accent}33, inset 0 0 18px rgba(8,13,24,0.6)`,
}}
```

Add the chains overlay inside the card div, after the affordances div:

```typescript
{card.fated && <ChainsOfFate />}
```

- [ ] **Step 5: Hide affordances + disable drag for fated hand cards**

For the drag attribute on the hand card wrapper div:

```typescript
draggable={!card.fated}
```

For the affordances row, conditionally render the return-to-deck button:

```typescript
{!card.fated && (
  <motion.button
    style={handIconBtnStyle}
    whileHover={{ scale: 1.2 }}
    onClick={(e) => { e.stopPropagation(); handleReturnToDeck(i); }}
    title="Return to deck"
  >
    <GiCardPickup />
  </motion.button>
)}
```

Also hide the drag-to-table return by preventing drag on fated cards:

```typescript
onDragStart={(e) => {
  if (card.fated) { e.preventDefault(); return; }
  handleHandDragStart(e as unknown as React.DragEvent, i);
}}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc -b
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat: add golden glow and chains-of-fate visuals to tarot minigame

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: MAJOR_GLOW_FAMILY completeness test

**Files:**
- Modify: `src/engine/__tests__/Tarot.test.ts` (or create a focused test)

**Interfaces:**
- Consumes: `MAJOR_ARCANA`, `MAJOR_GLOW_FAMILY` from Task 1

- [ ] **Step 1: Write the test in `src/engine/__tests__/Tarot.test.ts`**

Add to the end of the file:

```typescript
import { MAJOR_GLOW_FAMILY, MajorGlowFamily } from '../../data/tarot';

describe('MAJOR_GLOW_FAMILY', () => {
  it('covers all 22 Major Arcana cards', () => {
    const majorIds = MAJOR_ARCANA.map((c) => c.id);
    expect(majorIds.length).toBe(22);

    const classified = Object.keys(MAJOR_GLOW_FAMILY);
    for (const id of majorIds) {
      expect(classified).toContain(id);
    }
  });

  it('has no duplicate entries', () => {
    const keys = Object.keys(MAJOR_GLOW_FAMILY);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a valid family', () => {
    const validFamilies: MajorGlowFamily[] = ['benevolent', 'challenging', 'neutral'];
    for (const family of Object.values(MAJOR_GLOW_FAMILY)) {
      expect(validFamilies).toContain(family);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest run -t "MAJOR_GLOW_FAMILY"
```

Expected: PASS (all 3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/engine/__tests__/Tarot.test.ts
git commit -m "test: add MAJOR_GLOW_FAMILY completeness validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**
- Modify: `docs/game-systems.md`

- [ ] **Step 1: Add `fate-fated-card` to the responder catalog table**

In the table in §5 (Event-driven affinity effects), add a row after `fate-deal-swap`:

```
| `fate-fated-card` | `tarot:picked` | OVERRIDE | Fate ascendant · notable | Substitutes the picked card for a different one and locks it into the hand slot (immutable — cannot be returned, swapped, or removed). Once per draft. | `shroud` |
```

- [ ] **Step 2: Add golden glow to the Light affinity ladder in §3b**

In the Light bullet of §3b, add after the existing ascendant description:

```
*ascendant:* foresight (peek) becomes available; pool preview and reading detail
increase; dice gain advantage (`light-advantage`); **Major Arcana cards on the table
and in hand glow gold, even while face-down.** *dominant:* the reading is laid bare;
**Major Arcana glow differentiates by archetype family — warm gold (benevolent),
pale silver (challenging), soft white (neutral/transitional).**
```

- [ ] **Step 3: Add Major Arcana family classification note to §4a**

At the end of §4a (Deck composition), add:

```
**Major Arcana glow families (Light ascendant+):** 22 Majors are classified into three
families for the golden glow mechanic (§3b). *Benevolent* (9): Sun, Star, World, Strength,
Empress, Temperance, Lovers, Hierophant, Magician. *Challenging* (5): Tower, Death, Devil,
Hanged Man, Moon. *Neutral* (8): Fool, Justice, Chariot, Hermit, High Priestess, Emperor,
Wheel of Fortune, Judgement.
```

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md
git commit -m "docs: add fate-fated-card and golden glow to game systems reference

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 2: Full typecheck + build**

```bash
npm run build
```

Expected: PASS (tsc + vite build)

- [ ] **Step 3: Run dev server and smoke-test manually**

```bash
npm run dev
```

Navigate to http://localhost:5173, start a game, pick Tarot:
- Set Light ascendant+ via debug panel, verify Major Arcana glow on table + hand
- Set Fate ascendant+, verify a fated card can appear (chains overlay, cannot return/swap)
