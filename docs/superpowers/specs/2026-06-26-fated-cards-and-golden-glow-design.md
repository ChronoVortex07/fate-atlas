# Fated Cards & Golden Glow — Design Spec

## Overview

Two new affinity-driven interactions for the tarot minigame:

1. **Fated Card (Fate affinity)** — At ascendant+, Fate has a chance to substitute a card as the player picks it from the table into their hand. The fated card is immutable for the rest of the draft (cannot be returned, swapped, or removed). Visual: chains-of-fate overlay, removed on commit.
2. **Golden Glow (Light affinity)** — At ascendant+, Major Arcana cards on the table and in hand glow gold (even face-down), helping the player identify them. At dominant, the glow color differentiates benevolent/challenging/neutral archetype families.

---

## 1. Fated Card — Engine Layer

### 1a. New responder: `fate-fated-card`

| Field | Value |
|-------|-------|
| `id` | `fate-fated-card` |
| `source` | `affinity` |
| `triggers` | `['tarot:picked']` |
| `group` | `{ kind: 'exclusive', band: 'OVERRIDE' }` |
| `weight` | `w('fate')` |

- **`condition(ctx)`**: The pick succeeded (a hand slot was filled — `handIndex` and `tableIndex` are valid numbers, the target table slot is non-null), and `ctx.draft.fatedDrawnThisDraft !== true` (once-per-draft gate).
- **`roll(ctx)`**: `bandRoll(ctx, 'fate', 'ascendant', T.notable)` — Fate ascendant+ (value ≥ 60), notable tier base chance (0.22), scaled +70% per band above gate. At dominant: ~37%.
- **`apply(ctx)`**: 
  1. Draw a fresh random card from the full deck that is distinct from the original card ID.
  2. Set `ctx.draft.fatedHandIndex` to the hand index being filled.
  3. Set `ctx.draft.fatedCardId` to the new card ID.
  4. Set `ctx.draft.fatedDrawnThisDraft = true`.
  5. Return an `EffectReport` with label "Fate", description "The weave tightens — this card is not yours to refuse.", animation `'shroud'`.

### 1b. HandCard type change

Add optional `fated` flag to `HandCard` in `src/engine/types.ts`:

```typescript
export interface HandCard {
  cardId: string;
  tableOriginIndex: number;
  peeked: boolean;
  revealedFace?: TarotCardFace;
  fated?: boolean; // NEW — immutable, locked into slot by fate
}
```

### 1c. TarotDraftState change

Add `fatedDrawnThisDraft` flag to prevent a second fated card in the same draft:

```typescript
export interface TarotDraftState {
  // ... existing fields ...
  fatedDrawnThisDraft?: boolean; // NEW — once-per-draft gate
}
```

### 1d. GameEngine method changes

**`pickForHand(handIndex, tableIndex)`**:
- After creating the `HandCard`, run `this.dispatchAt('tarot:picked', { handIndex, tableIndex, fatedDrawnThisDraft: draft.fatedDrawnThisDraft })`.
- If `draft.fatedHandIndex === handIndex` and `draft.fatedCardId` is set:
  - Replace `handCard.cardId` with `draft.fatedCardId`.
  - Set `handCard.fated = true`.
  - Set `draft.fatedDrawnThisDraft = true`.
- Remove the original table card from the table and return it to the deck (shuffled).

**`returnToDeck(handIndex)`**: Reject with an error if `draft.hand[handIndex]?.fated`.

**`returnToTable(handIndex)`**: Reject with an error if `draft.hand[handIndex]?.fated`.

**`swapHandCards(a, b)`**: Reject with an error if either card is fated.

**`peekHandCard(handIndex)`**: No change — peek still works on fated cards.

**`commitDraft(reverse)`**: No special handling needed — fated cards commit normally. The `fated` flag is cleared on commit since the draft state is replaced.

### 1e. Error handling

When a fated-card guard rejects an action, the engine throws an error with a descriptive message. The component catches this by checking the `fated` flag before calling the action — buttons/affordances for return/swap are hidden or disabled for fated cards.

---

## 2. Fated Card — Visual Layer

### 2a. Chains of Fate overlay

A new SVG component `ChainsOfFate` (`src/components/cards/ChainsOfFate.tsx`):

- Renders interlocking chain links as an SVG overlay.
- Color: `#9b6bb0` (existing Future/purple accent), 40% opacity.
- Positioned absolutely over the hand card, `pointerEvents: 'none'`.
- Subtle CSS pulse animation (`@keyframes fate-pulse`): opacity breathes between 0.30 and 0.50 over 2.5s.
- Only rendered when `card.fated === true` and `draft.phase === 'drafting'`.
- Removed on commit — the committed spread shows the face-up card cleanly.

### 2b. Hand card UI changes

In `TarotMinigame.tsx`, for each hand slot:

- If `card.fated`, hide the "return to deck" and "return to table" affordances.
- Disable drag (no `draggable` attribute, or cancel `onDragStart`).
- Render `<ChainsOfFate />` overlay inside the card.
- The peek button still appears if Light is ascendant+ and the card hasn't been peeked.

---

## 3. Golden Glow — Visual Layer

### 3a. Major Arcana classification

A new constant in `src/data/tarot.ts`:

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

Colors by family:
| Family | Color | CSS |
|--------|-------|-----|
| `benevolent` | Warm gold | `rgba(212,168,84,0.7)` |
| `challenging` | Pale silver | `rgba(155,180,210,0.6)` |
| `neutral` | Soft white | `rgba(200,216,240,0.55)` |

### 3b. Component integration

In `TarotMinigame.tsx`:

- Read `const lightBand = bandOf(state.affinities.light)`.
- For each table card and hand card, look up `DECK_BY_ID[card.cardId]`.
- If `cardData.arcana === 'major'` and `lightBand` is at least `'ascendant'`:
  - **Ascendant**: apply uniform golden glow (`boxShadow: '0 0 12px rgba(212,168,84,0.6)'`).
  - **Dominant**: apply family-specific glow color from the table above, with slightly stronger intensity (opacity +0.1, spread +2px).
- The glow applies even to face-down cards (card backs on table, unpeeked cards in hand). This is intentional — the player senses the Major Arcana's presence without seeing its face.

---

## 4. Test considerations

### Engine tests

- `fate-fated-card` responder: test that it fires at Fate ascendant+, not below; test once-per-draft gate; test that the replaced card is distinct from the original.
- `pickForHand`: test that fated flag is set when responder fires; test that original card returns to deck.
- `returnToDeck` / `returnToTable` / `swapHandCards`: test that they throw when targeting a fated card.
- `peekHandCard`: test that it still works on fated cards.

### Component tests

Not in scope — there are no existing component tests per project conventions.

### Golden glow

No engine tests needed (purely visual). The `MAJOR_GLOW_FAMILY` map completeness can be validated with a data-layer test.

---

## 5. Documentation

Update `docs/game-systems.md`:
- Add `fate-fated-card` to the responder catalog table in §5.
- Add the golden glow behavior to the Light affinity ladder in §3b.
- Add Major Arcana family classification note to §4a.

Update `src/data/affinities.ts`:
- Add `fate-fated-card` to `FATE_AFFINITY.bandedEffects`.

---

## 6. Files changed

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `fated?: boolean` to `HandCard`; add `fatedDrawnThisDraft?: boolean` to `TarotDraftState` |
| `src/data/affinities.ts` | Add `fate-fated-card` to `FATE_AFFINITY.bandedEffects`; add `id` to `LIGHT_AFFINITY.bandedEffects` for golden glow |
| `src/data/tarot.ts` | Add `MAJOR_GLOW_FAMILY` constant and `MajorGlowFamily` type |
| `src/engine/responders/affinity.ts` | Add `fate-fated-card` responder |
| `src/engine/GameEngine.ts` | Wire `tarot:picked` dispatch in `pickForHand`; add fated guards in `returnToDeck`, `returnToTable`, `swapHandCards`; pass `fatedDrawnThisDraft` through draft |
| `src/components/cards/ChainsOfFate.tsx` | New SVG overlay component |
| `src/components/screens/TarotMinigame.tsx` | Golden glow logic on table + hand cards; chains overlay on fated hand cards; hide affordances for fated cards |
| `docs/game-systems.md` | Catalog entries for new responder + golden glow |
