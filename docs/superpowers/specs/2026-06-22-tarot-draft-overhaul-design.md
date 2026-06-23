# Tarot Draft Overhaul — Design Spec

## Motivation

Three problems with the current tarot minigame:
1. **No agency in card selection** — cards are randomly drawn, player only sees them at reveal.
2. **Spread is invisible in results** — the Past/Present/Future positions aren't shown.
3. **Analysis is broken** — `consolidateSpread` hardcodes `name: 'Three-Card Spread'`, so all narrative text and LLM prompts reference "The Three-Card Spread" instead of actual card names.

## Overview

Replace the random-deal-then-reveal flow with a **card-drafting minigame**. The full deck is shuffled and ~9 cards are dealt face-down onto the table. The player drafts 3 cards into their hand (Past / Present / Future), with affordances for reshuffling, peeking, returning cards, and swapping hand positions. The hover system fans cards apart near the cursor on desktop; on mobile, a two-tap interaction achieves the same.

---

## 1. Engine Layer

### 1.1 New Types (`src/engine/types.ts`)

```typescript
export interface TableCard {
  cardId: string;        // key into DECK_BY_ID
  originIndex: number;   // stable position on table (for return-to-position)
  faceUp: boolean;       // true if returned from hand after being peeked
}

export interface HandCard {
  cardId: string;
  tableOriginIndex: number;
  peeked: boolean;
  revealedFace?: TarotCardFace; // set after successful peek — shows orientation
}

export type HandSlot = HandCard | null; // hand[0]=Past, [1]=Present, [2]=Future

export interface TarotDraftState {
  deck: string[];              // remaining card IDs (shuffled), face-down
  table: (TableCard | null)[]; // dealt spread; null where card was picked
  hand: [HandSlot, HandSlot, HandSlot];
  dealCount: number;           // current number of active slots on table (starts 9, grows with returns)
  shufflesRemaining: number;   // from affinityEffects.spreadRedraws
}
```

### 1.2 New Engine Methods (`GameEngine`)

| Method | Behavior |
|--------|----------|
| `startTarotDraft()` | Shuffle FULL_DECK. Deal `dealCount` (9) cards onto `table` as `TableCard` entries. Empty hand. Set `shufflesRemaining` from `affinityEffects.spreadRedraws`. |
| `pickForHand(handIndex, tableIndex)` | Move card from `table[tableIndex]` → `hand[handIndex]`. Null the table slot. Dispatch `tarot:picked` trigger for meta-interactions. |
| `returnToTable(handIndex)` | Move card from `hand[handIndex]` back to its `tableOriginIndex`. Preserves `faceUp` state from peeked flag. If the origin slot is occupied, place in the lowest-index open slot. If no open slots exist, append a new slot at the end of `table` and increment `dealCount`. |
| `returnToDeck(handIndex)` | Move card from `hand[handIndex]` back into `deck` (shuffled in). Always face-down. |
| `shuffleTable()` | Flip all face-up table cards to face-down. Collect all non-null table cards + remaining deck. Shuffle. Redeal `dealCount` cards. Decrement `shufflesRemaining`. Dispatch `tarot:shuffled`. |
| `peekHandCard(handIndex)` | If `affinityEffects.peekAvailable`: roll chance gate. On success → call `buildFace(card, pickOrientation(affinities))`, set `revealedFace`, `peeked: true`. On failure → emit `EffectReport` ("The veil holds fast..."). Feed Light/Shadow affinity. |
| `swapHandCards(a, b)` | Swap `hand[a]` with `hand[b]`. No orientation changes. |
| `commitDraft(reverse?: boolean)` | For each filled hand slot, use `revealedFace` if peeked (locked orientation) or call `buildFace(card, pickOrientation(affinities))`. Call `consolidateSpread(faces)`. If `reverse`, call `reverseSpread(result)`. Feed affinity actions. Dispatch `tarot:commit` and proceed to normal post-commit flow. |

### 1.3 New Event Triggers

| Trigger | Fires when |
|---------|-----------|
| `tarot:draft:started` | `startTarotDraft()` called |
| `tarot:picked` | Player picks card from table → hand |
| `tarot:returned:table` | Player returns card from hand → table |
| `tarot:returned:deck` | Player returns card from hand → deck |
| `tarot:shuffled` | `shuffleTable()` completes |
| `tarot:peeked` | Successful peek on hand card |
| `tarot:swapped` | Player swaps two hand positions |
| `tarot:committed` | Player commits the spread (pre-orientation resolution) |

Responders can hook into these for meta-interactions (e.g., `tarot:picked` → Chaos responder forces a replacement card).

---

## 2. Spread Visibility — All Display Touchpoints

The spread composition must be visible in four places after the minigame commits.
Today all of them show the hardcoded `'Three-Card Spread'` name and none show
positional breakdown. Each touchpoint is fixed below.

### 2.1 Root Fix: `consolidateSpread` — Descriptive Name

In `src/data/tarot.ts`, change the hardcoded name so every downstream consumer
automatically gets real card names:

```typescript
// Before:
name: single ? faces[0].name : 'Three-Card Spread',

// After:
name: single ? faces[0].name : faces.map(f => f.name).join(' · '),
```

The `spread` array already carries `{position, card}` — no change needed there.

---

### 2.2 ConstellationFan / FanCard (between-minigame tableau)

After the tarot minigame commits, the result is added to `turnResults` and
rendered in the `ConstellationFan` at the bottom of the screen. Today `FanCard`
shows `'Spread'` for multi-card tarot slots.

**Collapsed (fan unexpanded):** Show the 3-position sigil (three overlapping
cards from `CardSigil`) + the joined card names. One line, truncated.

```
┌──────────────┐
│  ᚠᚢᚦᚨ       │
│  ◈◈◈        │  ← 3-card spread sigil
│ Fool · Magi…│  ← first two card names + ellipsis
│  ▲ Upright  │  ← consolidated orientation
│  ᚠᚢᚦᚨ       │
└──────────────┘
```

**Expanded (fan open):** The tarot slot fans into its 3 constituent cards, each
rendered as a mini `FanCard`-sized sub-card with position label, sigil, name,
and orientation. These sub-cards sit in the same fan arc as the other slots —
the spread "unfolds" in place.

```
     Past         Present       Future
   ┌──────┐     ┌──────┐     ┌──────┐
   │  ♅   │     │  ☿   │     │  ☽   │
   │ Fool │     │Magician│   │Priestess│
   │  ▲   │     │  ▼   │     │  ▲   │
   └──────┘     └──────┘     └──────┘
```

When the fan collapses again, the sub-cards fold back into the single
consolidated card.

Implementation: `FanCard` gains a `subCards` prop (the `spread` array entries).
When `isExpanded && subCards.length > 1`, it renders the 3 sub-cards positioned
with gentle horizontal offsets in the fan arc instead of the single card body.

---

### 2.3 ResultReading (final results page)

When a `TarotResult` has `spread.length > 1`, the result card expands into a
3-column positional layout. Single-card tarot results render as today.

```
┌──────────────────────────────────────────┐
│  1                                        │
│                                           │
│   Past        Present        Future      │  ← position labels, small caps
│  ┌──────┐    ┌──────┐      ┌──────┐     │
│  │  ♅   │    │  ☿   │      │  ☽   │     │  ← CardSigil per card
│  │ Fool │    │Magician│    │Priestess│   │  ← card name
│  │  ▲   │    │  ▼   │      │  ▲   │     │  ← orientation indicator
│  └──────┘    └──────┘      └──────┘     │
│                                           │
│  New beginnings  Manipulation  Intuition  │  ← meaning snippet per card
│  ...            ...           ...         │     (truncated to ~60 chars)
└──────────────────────────────────────────┘
```

`getResultDisplay()` in `ResultReading.tsx` is extended to return a `subCards`
array when `result.spread.length > 1`. The render path detects this and switches
from the single-card layout to the 3-column layout.

---

### 2.4 NarrativeAssembler — Text Synthesis & LLM Prompt

**`describeSlotBrief()`** (used in modifier-frame text like "The cards at play: ___"):

```typescript
case 'tarot':
  if (slot.spread && slot.spread.length > 1) {
    return slot.spread.map(sp =>
      `${sp.position.charAt(0).toUpperCase() + sp.position.slice(1)}: ${sp.card.name} (${sp.card.orientation})`
    ).join('; ');
  }
  return `The ${slot.name} (${slot.orientation})`;
```

**`describeSlotFull()`** (used in the LLM prompt's Divinations section) —
already handles this correctly (lines 283–290 of the current code). No change
needed.

**Synthesis paragraphs** — the `assemble()` method draws from
`aggregated.dominantTheme`, `dimensionProfile`, and `modifierAssignments`. The
modifier frames use `describeSlotBrief()` above, so fixing that one function
repairs the synthesis text for all tarot spreads. The thematic/dimension
analysis is already position-agnostic (it uses the consolidated dimensions),
which is correct — the synthesis speaks to the spread as a whole.

**LLM prompt** — `generateLLMPrompt()` already calls `describeSlotFull()` which
renders per-position card details with the `Past: / Present: / Future:` prefix.
After the `consolidateSpread` name fix, the prompt will show real card names in
both the single-card and spread paths.

---

## 3. UI — Tarot Draft Component (`TarotMinigame.tsx`)

### 3.1 Layout

```
┌─────────────────────────────────────────┐
│  "Draft your spread..."                 │  ← heading
│                                         │
│  ┌─ Deck ─┐                            │
│  │  ████  │  (face-down deck stack)    │
│  │  ████  │                            │
│  └────────┘                            │
│                                         │
│  ┌─ Table (overlapping spread) ────────┐│
│  │  [0][1][2][3][4][5][6][7][8]       ││  ← single row, overlapping
│  │   ██ ██ ██ ██ ██ ██ ██ ██ ██      ││     fan apart near cursor
│  └─────────────────────────────────────┘│
│                                         │
│  [↻ Shuffle (N remaining)]              │  ← enabled when shuffles > 0
│                                         │
│  ┌─ Hand ──────────────────────────────┐│
│  │  Past         Present       Future  ││
│  │ ┌────┐       ┌────┐       ┌────┐   ││
│  │ │    │  👁   │    │       │    │   ││  ← eye icon on hover/tap
│  │ │ ██ │       │ ██ │       │ ██ │   ││  ← face-down unless peeked
│  │ └────┘       └────┘       └────┘   ││
│  │  drag to swap ←→                   ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Reveal as Drawn]  [Invert Meaning]   │  ← only when hand is full
└─────────────────────────────────────────┘
```

### 3.2 Desktop Hover Fan-Out

- `mousemove` listener on the table container.
- For each table card, compute distance from cursor to card center.
- Closer cards get a larger `translateX` push away from cursor (direction-aware) and a small `scale` bump.
- Uses `requestAnimationFrame` throttling. CSS `transition` on `transform` for smooth return when cursor leaves.
- Fan-out radius: ~200px from cursor center. Maximum spread offset: ~30px.

### 3.3 Mobile Tap-to-Fan

- First tap on a cluttered area of the spread → that zone fans out using the same displacement math, driven by tap position.
- Second tap on an individual card → selects it (calls `pickForHand`).
- Tapping elsewhere on the table (not on a card) deactivates the fan after a short timeout.
- No hover states — the eye icon and return affordance use the tap mechanics below.

### 3.4 Hand Card Affordances

**Desktop:**
- Hover over a hand card → reveals an eye icon (peek, if available) and a deck icon (return to deck).
- Drag from hand to the table spread → shows a drop highlight on the table; dropping performs `returnToTable`.

**Mobile:**
- Eye icon is always visible on filled hand cards when peek is available.
- Tap eye icon → triggers peek (success = card flips face-up; failure = shimmer animation + event popup).
- Drag hand card toward the spread area → a drop zone appears on the table; releasing performs `returnToTable`.
- Deck icon (small, near eye icon) → tap to `returnToDeck`.

### 3.5 Hand Drag-to-Swap

HTML5 drag-and-drop between the 3 hand slots. `draggable` on filled slots, `onDragOver` + `onDrop` for reordering. Cards slide horizontally with a transition on swap.

### 3.6 Peek Behavior

- **Success**: Card flips from face-down to face-up via a 180° Y-rotation animation. The `revealedFace` (sigil + name + orientation) is displayed. Card stays face-up in hand. Can still be returned to table (stays face-up) or deck (goes face-down).
- **Failure**: Card shimmers with a brief golden glow that fizzles out. An `EffectReport` popup displays "The veil holds fast..." or similar. Peek still consumes the chance for that card (one peek attempt per card).
- Peeked cards that are returned to the **table** remain face-up (the table slot shows the revealed card).
- Peeked cards that are returned to the **deck** go back face-down.

### 3.7 Shuffle Behavior

- Before shuffle animation: all face-up table cards flip face-down.
- All table cards collect toward deck (collapse animation).
- Deck wiggles/shuffles briefly.
- Cards redeal from deck to table positions (staggered fly-out).
- Disabled when `shufflesRemaining <= 0`.

---

## 4. Animation Details

| Transition | Animation |
|-----------|----------|
| Deck → Table (initial deal) | Cards fly from deck position to spread positions, staggered (50ms each) |
| Table → Hand (pick) | Card lifts from spread (scale 1.0→1.15), translates to hand slot, lands |
| Hand → Table (return) | Card flies back to origin position on table, scale returns to normal |
| Hand → Deck (return) | Card flies to deck stack and disappears beneath it |
| Table → Deck → Table (shuffle) | Cards collapse to deck (converge animation), deck wiggles, cards redeal with stagger |
| Peek success | Card performs 180° Y-rotation, reveals face, stops |
| Peek failure | Card glows briefly (golden shimmer), then fizzles; event popup appears |
| Hand swap | Cards slide horizontally (translateX) to exchange positions |
| Reveal | All 3 hand cards flip simultaneously (180° Y-rotation) into the Past/Present/Future spread |
| Invert | All 3 revealed cards rotate 180° in place (orientation reversal) |
| Pre-shuffle face-down flip | Any face-up table cards flip 180° Y-rotation back to face-down before shuffle |

---

## 5. Meta-Interaction Points

During the draft phase, the event dispatcher can trigger responders at the new trigger points (see 1.3). Examples:

- **Chaos responder** at `tarot:picked`: "The fates intervene — a different card takes its place." Forces the picked card back to table and picks a random adjacent card instead.
- **Order responder** at `tarot:shuffled`: "The deck settles into a clear pattern." Reveals a subtle hint about what themes dominate the current table.
- **Fate responder** at `tarot:committed`: accepts the spread as-is and feeds Fate affinity.

These are data-defined via the existing `Responder` system — no special-case code in the draft component.

---

## 6. Files Affected

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `TableCard`, `HandCard`, `HandSlot`, `TarotDraftState` types |
| `src/engine/GameEngine.ts` | Add draft methods, wire new triggers to `EventDispatcher` |
| `src/data/tarot.ts` | Fix `consolidateSpread` name generation |
| `src/engine/NarrativeAssembler.ts` | Fix `describeSlotBrief` for spread position breakdown |
| `src/components/screens/TarotMinigame.tsx` | Full rewrite → drafting UI |
| `src/components/cards/FanCard.tsx` | Add `subCards` prop, 3-card expanded rendering for tarot spreads |
| `src/components/screens/ResultReading.tsx` | Add 3-column positional sub-layout for tarot spreads |
| `src/engine/__tests__/Tarot.test.ts` | Add draft state tests |
| `docs/game-systems.md` | Update tarot section with new draft flow |
