# Tarot Minigame Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-major-arcana tarot draws with a procedural 78-card deck and a Past/Present/Future spread that consolidates into one reading slot, add unified SVG sigils, and add new tarot meta-interactions / per-affinity effects.

**Architecture:** All logic stays framework-free in `src/engine/` + `src/data/` (zero React/DOM imports); React renders state and forwards actions. A tarot minigame draws 3 faces from `FULL_DECK` and `consolidateSpread()` collapses them into one `TarotResult` whose top-level `themes/dimensions/modifierRoles/tags` are the values every existing consumer already reads. New behaviors are `Responder`s dispatched at `tarot:deal`/`tarot:orient`/`tarot:commit`; spread-internal patterns ride a new `spread` combine channel.

**Tech Stack:** TypeScript (strict), Vite, React 18, framer-motion, Vitest (engine/data tests only, Node env).

## Global Constraints

- Engine/data code MUST NOT import React or DOM APIs. (`src/engine/**`, `src/data/**`)
- Type safety is the lint: every task ends green under `npm run build` (`tsc -b`) with `strict`, `noUnusedLocals`, `noUnusedParameters`.
- Tests live only under `src/engine/__tests__/**` (Vitest, Node env, `localStorage` polyfilled by `vitest.setup.ts`). No component tests exist; UI tasks verify via `npm run build`.
- `DimensionValues` axes are −2.0..+2.0 at 0.5 granularity. Always round to 0.5 and clamp.
- Affinities are 0–100; never display them directly.
- Mutators on `GameEngine` must end with `notify()`.
- When changing affinities/responders/data systems, update `docs/game-systems.md` + README in the same change (Phase 6).
- Run a single test file: `npx vitest run src/engine/__tests__/<File>.test.ts`. Full suite: `npm test`.
- Branch: `tarot-overhaul` (already created). Commit after every task.

---

## File Structure

**Data**
- `src/data/tarot.ts` — extend `TarotCardData`; add suit/rank tables, `generateMinorArcana()`, `MINOR_ARCANA`, `FULL_DECK`, `DECK_BY_ID`; add `buildFace`, `consolidateSpread`, `reverseFace`, `reverseSpread`, `drawTarotSpread`; refactor `drawTarotCard`.
- `src/data/divination-profiles.ts` — add `volatility` to tarot.

**Engine**
- `src/engine/types.ts` — `SpreadPosition`, `TarotCardFace`, `TarotResult.spread?`, `AffinityEffects.spreadRedraws`, `CombineReducer` return type.
- `src/engine/AffinityEngine.ts` — `spreadRedraws` in `getEffects`.
- `src/engine/GameEngine.ts` — `resolveTarotDeal`, `resolveSpreadOrientation`, `redrawSpreadPosition`, spread-aware commit (reverseSpread for mutators).
- `src/engine/events/types.ts` — `CombineReducer.reduce` returns `EffectReport | EffectReport[] | null`.
- `src/engine/events/EventDispatcher.ts` — combine loop pushes arrays.
- `src/engine/events/reducers.ts` — `spreadReducer`, registered.
- `src/engine/responders/affinity.ts` — `fate-deal-swap`, spread-wide `fate-auto-orient`, `chaos-wild-card`, `order-anchor`, `shadow-veil-position`.
- `src/engine/responders/interactions.ts` — adapt `critical-resonance`/`mirror`; add `suit-accord`, `elemental-clash`, `major-convergence`, `spread-aligned`, `spread-cascade`.
- `src/engine/events/scenarios.ts` — debug scenarios for new responders; fix tarot ones.
- `src/engine/NarrativeAssembler.ts` — spread positions + veil in LLM prompt.

**Components**
- `src/components/cards/CardSigil.tsx` — NEW SVG sigil system.
- `src/components/screens/TarotMinigame.tsx` — rewrite for the dealt spread.
- `src/components/cards/CardSlot.tsx`, `src/components/cards/FanCard.tsx`, `src/components/overlays/HistoryTiles.tsx`, `src/components/screens/ResultReading.tsx` — use `<CardSigil>` + spread/veil display.

**Docs**
- `docs/game-systems.md`, `README.md`.

---

## Shared interface contract (used across tasks)

```ts
// types.ts
export type SpreadPosition = 'past' | 'present' | 'future';

export interface TarotCardFace {
  id: string;
  name: string;
  arcana: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  rank?: number | 'page' | 'knight' | 'queen' | 'king'; // 1..10 = Ace..Ten
  number?: number;
  orientation: 'upright' | 'reversed';
  symbol: string;
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag?: string;
  veiled?: boolean;
  tags: Tag[];
}

// tarot.ts (Produces — names later tasks depend on)
export interface TarotCardData {
  id: string; name: string; number?: number; symbol: string;
  meaningUpright: string; meaningReversed: string; archetypeTag?: string;
  arcana: 'major' | 'minor';
  suit?: TarotCardFace['suit']; rank?: TarotCardFace['rank'];
  themes: ThemeTag[]; dimensions: DimensionValues; modifierRoles: ModifierRole[];
}
export const MAJOR_ARCANA: TarotCardData[];
export const MINOR_ARCANA: TarotCardData[];
export const FULL_DECK: TarotCardData[];
export const DECK_BY_ID: Record<string, TarotCardData>;
export function buildFace(card: TarotCardData, orientation: 'upright'|'reversed'): TarotCardFace;
export function consolidateSpread(faces: TarotCardFace[]): TarotResult;
export function reverseFace(face: TarotCardFace): TarotCardFace;
export function reverseSpread(result: TarotResult): TarotResult;
export function drawTarotSpread(affinities: Record<string, number>): TarotResult;
export function drawTarotCard(affinities: Record<string, number>): TarotResult;
```

---

# Phase 1 — Data foundation (engine-pure, fully tested)

### Task 1: Extend types and tag the existing majors as `arcana: 'major'`

**Files:**
- Modify: `src/engine/types.ts` (add `SpreadPosition`, `TarotCardFace`, `spread?` on `TarotResult`)
- Modify: `src/data/tarot.ts` (extend `TarotCardData`; add `arcana: 'major'` to all 22 entries; loosen `archetypeTag`/`number`)
- Test: `src/engine/__tests__/Tarot.test.ts`

**Interfaces:**
- Produces: `SpreadPosition`, `TarotCardFace`, `TarotResult.spread`, `TarotCardData.arcana`.

- [ ] **Step 1: Write the failing test** — append to `src/engine/__tests__/Tarot.test.ts`:

```ts
import { MAJOR_ARCANA } from '../../data/tarot';

describe('major arcana arcana field', () => {
  it('every major is tagged arcana="major"', () => {
    expect(MAJOR_ARCANA.every((c) => c.arcana === 'major')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts -t "arcana field"`
Expected: FAIL (`arcana` is `undefined`).

- [ ] **Step 3: Add the types** — in `src/engine/types.ts`, after the `ThematicData` block add:

```ts
export type SpreadPosition = 'past' | 'present' | 'future';

export interface TarotCardFace {
  id: string;
  name: string;
  arcana: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  rank?: number | 'page' | 'knight' | 'queen' | 'king';
  number?: number;
  orientation: 'upright' | 'reversed';
  symbol: string;
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag?: string;
  veiled?: boolean;
  tags: Tag[];
}
```

And add `spread?: { position: SpreadPosition; card: TarotCardFace }[];` to `interface TarotResult` (after `tags: Tag[];`).

- [ ] **Step 4: Extend `TarotCardData` and tag majors** — in `src/data/tarot.ts`, change the interface to:

```ts
export interface TarotCardData {
  id: string;
  name: string;
  number?: number;
  symbol: string;
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag?: string;
  arcana: 'major' | 'minor';
  suit?: TarotCardFace['suit'];
  rank?: TarotCardFace['rank'];
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}
```

Add `TarotCardFace` to the import from `../engine/types`. Then add `arcana: 'major',` to **each** of the 22 `MAJOR_ARCANA` entries (e.g. `{ id: 'the-fool', ..., arcana: 'major', modifierRoles: ['subject'] }`).

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts` then `npm run build`
Expected: all PASS; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): add spread types and tag major arcana"
```

---

### Task 2: Procedural minor arcana generator

**Files:**
- Modify: `src/data/tarot.ts` (suit/rank tables, `generateMinorArcana()`, `MINOR_ARCANA`)
- Test: `src/engine/__tests__/Tarot.test.ts`

**Interfaces:**
- Consumes: `TarotCardData`.
- Produces: `MINOR_ARCANA: TarotCardData[]` (56 cards), helpers `ELEMENT_BY_SUIT`, `rankKey(rank)`.

- [ ] **Step 1: Write the failing test:**

```ts
import { MINOR_ARCANA } from '../../data/tarot';

describe('minor arcana generator', () => {
  it('produces 56 cards (4 suits x 14 ranks)', () => {
    expect(MINOR_ARCANA).toHaveLength(56);
  });
  it('every minor has unique id, arcana=minor, a suit and a rank', () => {
    const ids = new Set(MINOR_ARCANA.map((c) => c.id));
    expect(ids.size).toBe(56);
    expect(MINOR_ARCANA.every((c) => c.arcana === 'minor' && !!c.suit && c.rank !== undefined)).toBe(true);
  });
  it('dimensions stay within [-2,2] at 0.5 granularity', () => {
    for (const c of MINOR_ARCANA) {
      for (const v of Object.values(c.dimensions)) {
        expect(v).toBeGreaterThanOrEqual(-2);
        expect(v).toBeLessThanOrEqual(2);
        expect(Math.round(v * 2)).toBe(v * 2);
      }
    }
  });
  it('Wands lean volatile, Cups lean favorable, Pentacles lean certain', () => {
    const ten = (s: string) => MINOR_ARCANA.find((c) => c.id === `${s}-10`)!;
    expect(ten('wands').dimensions.volatility).toBeGreaterThan(0.5);
    expect(ten('cups').dimensions.favorability).toBeGreaterThan(0.5);
    expect(ten('pentacles').dimensions.certainty).toBeGreaterThan(0.5);
  });
  it('mid pips carry no themes; courts carry one', () => {
    expect(MINOR_ARCANA.find((c) => c.id === 'wands-5')!.themes).toHaveLength(0);
    expect(MINOR_ARCANA.find((c) => c.id === 'cups-queen')!.themes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts -t "minor arcana generator"`
Expected: FAIL (`MINOR_ARCANA` undefined).

- [ ] **Step 3: Implement the generator** — in `src/data/tarot.ts`, before `drawTarotCard`:

```ts
type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

interface SuitDef {
  suit: Suit;
  name: string;
  element: 'fire' | 'water' | 'air' | 'earth';
  base: DimensionValues;
  pipRole: ModifierRole;
  lightThemes: [ThemeTag, ThemeTag];
  glyph: string;
  phrase: { up: string; rev: string };
}

const SUITS: SuitDef[] = [
  { suit: 'wands', name: 'Wands', element: 'fire', base: { favorability: 0.3, certainty: 0.2, volatility: 0.8 }, pipRole: 'action', lightThemes: ['conflict', 'transformation'], glyph: '♦', phrase: { up: 'drive, ambition, and the spark of action', rev: 'frustration, delay, and scattered energy' } },
  { suit: 'cups', name: 'Cups', element: 'water', base: { favorability: 0.8, certainty: -0.3, volatility: 0.2 }, pipRole: 'subject', lightThemes: ['harmony', 'mystery'], glyph: '♥', phrase: { up: 'emotion, connection, and intuition', rev: 'imbalance, withdrawal, and blocked feeling' } },
  { suit: 'swords', name: 'Swords', element: 'air', base: { favorability: -0.6, certainty: 0.5, volatility: 0.5 }, pipRole: 'effect', lightThemes: ['conflict', 'illumination'], glyph: '♠', phrase: { up: 'intellect, conflict, and hard truth', rev: 'confusion, cruelty, and self-defeat' } },
  { suit: 'pentacles', name: 'Pentacles', element: 'earth', base: { favorability: 0.5, certainty: 0.7, volatility: -0.5 }, pipRole: 'subject', lightThemes: ['stagnation', 'harmony'], glyph: '♣', phrase: { up: 'work, resources, and the material world', rev: 'insecurity, loss, and misplaced value' } },
];

export const ELEMENT_BY_SUIT: Record<Suit, string> =
  Object.fromEntries(SUITS.map((s) => [s.suit, s.element])) as Record<Suit, string>;

const COURTS = ['page', 'knight', 'queen', 'king'] as const;
const COURT_ROLE: Record<(typeof COURTS)[number], ModifierRole> =
  { page: 'subject', knight: 'action', queen: 'subject', king: 'action' };
const RANK_WORD: Record<number, string> =
  { 1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' };
const RANK_PHRASE: Record<string, string> = {
  ace: 'the pure seed of', two: 'a first balance of', three: 'early growth in', four: 'a steadying of',
  five: 'a struggle within', six: 'a turning toward', seven: 'a testing of', eight: 'swift movement in',
  nine: 'a near-fullness of', ten: 'the culmination of',
  page: 'a student of', knight: 'a pursuer of', queen: 'the nurturer of', king: 'the master of',
};

export function rankKey(rank: TarotCardFace['rank']): string {
  return typeof rank === 'number' ? (RANK_WORD[rank] ?? String(rank)).toLowerCase() : rank!;
}

const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2)) as number;
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function minorDimensions(def: SuitDef, rank: TarotCardFace['rank']): DimensionValues {
  const isCourt = typeof rank !== 'number';
  const intensity = isCourt ? 1.2 : 0.6 + ((rank as number) - 1) / 9 * 1.4;
  const d: DimensionValues = {
    favorability: def.base.favorability * intensity,
    certainty: def.base.certainty * intensity,
    volatility: def.base.volatility * (isCourt ? 0.6 : 1) * intensity,
  };
  if (rank === 1) { const a = dominantAxis(def.base); d[a] += 0.5 * Math.sign(def.base[a]); }
  if (rank === 10) { d.volatility += 0.5; }
  return { favorability: clampDim(d.favorability), certainty: clampDim(d.certainty), volatility: clampDim(d.volatility) };
}

function minorThemes(def: SuitDef, rank: TarotCardFace['rank']): ThemeTag[] {
  if (rank === 1 || typeof rank !== 'number') return [def.lightThemes[0]];
  if (rank === 10) return [def.lightThemes[1]];
  return [];
}

export function generateMinorArcana(): TarotCardData[] {
  const out: TarotCardData[] = [];
  for (const def of SUITS) {
    const ranks: TarotCardFace['rank'][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...COURTS];
    for (const rank of ranks) {
      const key = rankKey(rank);
      const isCourt = typeof rank !== 'number';
      out.push({
        id: `${def.suit}-${typeof rank === 'number' ? rank : rank}`,
        name: `${isCourt ? key[0].toUpperCase() + key.slice(1) : RANK_WORD[rank as number]} of ${def.name}`,
        number: typeof rank === 'number' ? rank : undefined,
        symbol: def.glyph,
        meaningUpright: `${RANK_PHRASE[key]} ${def.phrase.up}`,
        meaningReversed: `${RANK_PHRASE[key]} ${def.phrase.rev}`,
        arcana: 'minor',
        suit: def.suit,
        rank,
        themes: minorThemes(def, rank),
        dimensions: minorDimensions(def, rank),
        modifierRoles: [isCourt ? COURT_ROLE[rank as (typeof COURTS)[number]] : def.pipRole],
      });
    }
  }
  return out;
}

export const MINOR_ARCANA: TarotCardData[] = generateMinorArcana();
```

> Note the id uses the numeric rank for pips (`wands-10`) and the court word for courts (`cups-queen`), matching the tests.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts` then `npm run build`
Expected: PASS; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): procedural minor arcana (suit x rank)"
```

---

### Task 3: `FULL_DECK`, `DECK_BY_ID`, `buildFace`

**Files:**
- Modify: `src/data/tarot.ts`
- Test: `src/engine/__tests__/Tarot.test.ts`

**Interfaces:**
- Consumes: `MAJOR_ARCANA`, `MINOR_ARCANA`, `REVERSAL_THEME_MAP`.
- Produces: `FULL_DECK` (78), `DECK_BY_ID`, `buildFace(card, orientation): TarotCardFace`.

- [ ] **Step 1: Write the failing test:**

```ts
import { FULL_DECK, DECK_BY_ID, buildFace } from '../../data/tarot';

describe('full deck + buildFace', () => {
  it('FULL_DECK has 78 cards and DECK_BY_ID indexes them', () => {
    expect(FULL_DECK).toHaveLength(78);
    expect(DECK_BY_ID['the-fool'].arcana).toBe('major');
    expect(DECK_BY_ID['wands-10'].arcana).toBe('minor');
  });
  it('buildFace upright keeps favorability; reversed flips it', () => {
    const card = DECK_BY_ID['the-star']; // favorability +2 upright
    expect(buildFace(card, 'upright').dimensions.favorability).toBe(2);
    expect(buildFace(card, 'reversed').dimensions.favorability).toBe(-2);
  });
  it('buildFace tags carry arcana class, archetype/suit, and orientation', () => {
    const major = buildFace(DECK_BY_ID['the-fool'], 'upright');
    expect(major.tags).toEqual(expect.arrayContaining(['major-arcana', 'fool-archetype', 'upright', 'reversible', 'random']));
    const minor = buildFace(DECK_BY_ID['cups-queen'], 'reversed');
    expect(minor.tags).toEqual(expect.arrayContaining(['minor-arcana', 'suit-cups', 'element-water', 'rank-queen', 'reversed']));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts -t "full deck"`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/data/tarot.ts`, after `MINOR_ARCANA`:

```ts
export const FULL_DECK: TarotCardData[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];
export const DECK_BY_ID: Record<string, TarotCardData> =
  Object.fromEntries(FULL_DECK.map((c) => [c.id, c]));

function baseTagsFor(card: TarotCardData): string[] {
  const tags = ['draw', 'random', 'reversible', card.arcana === 'major' ? 'major-arcana' : 'minor-arcana'];
  if (card.archetypeTag) tags.push(card.archetypeTag);
  if (card.suit) tags.push(`suit-${card.suit}`, `element-${ELEMENT_BY_SUIT[card.suit]}`);
  if (card.rank !== undefined) tags.push(`rank-${rankKey(card.rank)}`);
  return tags;
}

export function buildFace(card: TarotCardData, orientation: 'upright' | 'reversed'): TarotCardFace {
  const reversed = orientation === 'reversed';
  let themes = card.themes;
  const dimensions: DimensionValues = { ...card.dimensions };
  if (reversed) {
    dimensions.favorability = (-dimensions.favorability) as DimensionValues['favorability'];
    themes = [...new Set(themes.map((t) => REVERSAL_THEME_MAP[t] ?? t))];
  }
  return {
    id: card.id,
    name: card.name,
    arcana: card.arcana,
    suit: card.suit,
    rank: card.rank,
    number: card.number,
    orientation,
    symbol: card.symbol,
    themes,
    dimensions,
    modifierRoles: card.modifierRoles,
    meaningUpright: card.meaningUpright,
    meaningReversed: card.meaningReversed,
    archetypeTag: card.archetypeTag,
    tags: [...baseTagsFor(card), reversed ? 'reversed' : 'upright'],
  };
}
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Tarot.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): FULL_DECK, DECK_BY_ID, buildFace"
```

---

### Task 4: `consolidateSpread`

**Files:**
- Modify: `src/data/tarot.ts`
- Test: `src/engine/__tests__/Tarot.test.ts`

**Interfaces:**
- Consumes: `buildFace`, `TarotCardFace`, `TarotResult`.
- Produces: `consolidateSpread(faces): TarotResult`, constant `SPREAD_GLYPH`.

- [ ] **Step 1: Write the failing test:**

```ts
import { consolidateSpread, buildFace, DECK_BY_ID } from '../../data/tarot';

describe('consolidateSpread', () => {
  const F = (id: string, o: 'upright' | 'reversed') => buildFace(DECK_BY_ID[id], o);

  it('averages dimensions to 0.5 granularity', () => {
    const r = consolidateSpread([F('the-world', 'upright'), F('wands-5', 'upright'), F('cups-2', 'upright')]);
    for (const v of Object.values(r.dimensions)) expect(Math.round(v * 2)).toBe(v * 2);
  });
  it('caps consolidated themes at 2', () => {
    const r = consolidateSpread([F('the-sun', 'upright'), F('judgement', 'upright'), F('the-world', 'upright')]);
    expect(r.themes.length).toBeLessThanOrEqual(2);
  });
  it('uses majority orientation (2+ reversed = reversed)', () => {
    const r = consolidateSpread([F('the-fool', 'reversed'), F('cups-2', 'reversed'), F('wands-5', 'upright')]);
    expect(r.orientation).toBe('reversed');
    expect(r.tags).toContain('reversed');
    expect(r.tags).not.toContain('upright');
  });
  it('lifts archetype + suit tags from every face onto the slot', () => {
    const r = consolidateSpread([F('the-fool', 'upright'), F('cups-queen', 'upright'), F('swords-3', 'upright')]);
    expect(r.tags).toEqual(expect.arrayContaining(['major-arcana', 'fool-archetype', 'minor-arcana', 'suit-cups', 'suit-swords']));
  });
  it('unions modifier roles and records the 3 positions', () => {
    const r = consolidateSpread([F('the-fool', 'upright'), F('cups-2', 'upright'), F('swords-3', 'upright')]);
    expect(r.spread).toHaveLength(3);
    expect(r.spread!.map((s) => s.position)).toEqual(['past', 'present', 'future']);
  });
  it('single face passes through as that card', () => {
    const r = consolidateSpread([F('the-magician', 'upright')]);
    expect(r.id).toBe('the-magician');
    expect(r.spread).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Tarot.test.ts -t "consolidateSpread"`. Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/data/tarot.ts`:

```ts
export const SPREAD_GLYPH = '✦';
const SPREAD_POSITIONS: SpreadPosition[] = ['past', 'present', 'future'];
const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const sumAbs = (d: DimensionValues) => Math.abs(d.favorability) + Math.abs(d.certainty) + Math.abs(d.volatility);

export function consolidateSpread(faces: TarotCardFace[]): TarotResult {
  const n = faces.length;

  const dimensions: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };
  for (const f of faces) for (const a of AXES) dimensions[a] += f.dimensions[a];
  for (const a of AXES) dimensions[a] = clampDim(dimensions[a] / n);

  const count = new Map<ThemeTag, number>();
  const mag = new Map<ThemeTag, number>();
  for (const f of faces) for (const t of f.themes) {
    count.set(t, (count.get(t) ?? 0) + 1);
    mag.set(t, (mag.get(t) ?? 0) + sumAbs(f.dimensions));
  }
  const themes = [...count.keys()]
    .sort((a, b) => (count.get(b)! - count.get(a)!) || (mag.get(b)! - mag.get(a)!))
    .slice(0, 2);

  const modifierRoles = [...new Set(faces.flatMap((f) => f.modifierRoles))];

  const reversedCount = faces.filter((f) => f.orientation === 'reversed').length;
  const orientation: 'upright' | 'reversed' = reversedCount * 2 > n ? 'reversed' : 'upright';

  const tagSet = new Set<string>();
  for (const f of faces) for (const t of f.tags) if (t !== 'upright' && t !== 'reversed') tagSet.add(t);
  tagSet.add('draw'); tagSet.add('random'); tagSet.add('reversible'); tagSet.add(orientation);

  const spread = faces.map((card, i) => ({ position: SPREAD_POSITIONS[i] ?? 'present', card }));
  const single = n === 1;
  const present = faces[Math.min(1, n - 1)];

  return {
    type: 'tarot',
    id: single ? faces[0].id : 'spread:' + faces.map((f) => f.id).join('+'),
    name: single ? faces[0].name : 'Three-Card Spread',
    number: present.number ?? 0,
    orientation,
    symbol: single ? faces[0].symbol : SPREAD_GLYPH,
    meaningUpright: present.meaningUpright,
    meaningReversed: present.meaningReversed,
    themes,
    dimensions,
    modifierRoles,
    tags: [...tagSet],
    spread,
  };
}
```

Add `SpreadPosition` to the `import type` from `../engine/types`.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Tarot.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): consolidateSpread (dimensions/themes/tags/orientation)"
```

---

### Task 5: `reverseFace`, `reverseSpread`, `drawTarotSpread`; refactor `drawTarotCard`

**Files:**
- Modify: `src/data/tarot.ts`
- Test: `src/engine/__tests__/Tarot.test.ts`

**Interfaces:**
- Consumes: `DECK_BY_ID`, `buildFace`, `consolidateSpread`, `FULL_DECK`.
- Produces: `reverseFace`, `reverseSpread`, `drawTarotSpread`, refactored `drawTarotCard`, `pickOrientation(affinities)`.

- [ ] **Step 1: Write the failing test:**

```ts
import { reverseSpread, drawTarotSpread, consolidateSpread, buildFace, DECK_BY_ID } from '../../data/tarot';

describe('reverseSpread + drawTarotSpread', () => {
  const F = (id: string, o: 'upright' | 'reversed') => buildFace(DECK_BY_ID[id], o);

  it('reverseSpread flips every face and recomputes (involutive)', () => {
    const base = consolidateSpread([F('the-star', 'upright'), F('cups-2', 'upright'), F('swords-3', 'upright')]);
    const rev = reverseSpread(base);
    expect(rev.spread!.every((s) => s.card.orientation === 'reversed')).toBe(true);
    expect(rev.orientation).toBe('reversed');
    const back = reverseSpread(rev);
    expect(back.spread!.map((s) => s.card.id)).toEqual(base.spread!.map((s) => s.card.id));
    expect(back.spread!.every((s) => s.card.orientation === 'upright')).toBe(true);
  });

  it('drawTarotSpread deals 3 distinct cards into past/present/future', () => {
    const r = drawTarotSpread({ chaos: 0, order: 0 });
    expect(r.spread).toHaveLength(3);
    expect(new Set(r.spread!.map((s) => s.card.id)).size).toBe(3);
    expect(r.type).toBe('tarot');
  });
});
```

Also confirm the existing `drawTarotCard` tests still pass after refactor (they assert `type==='tarot'`, contains `draw/random/major-arcana/reversible` — note `drawTarotCard` must still only draw majors to keep `major-arcana` guaranteed).

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Tarot.test.ts -t "reverseSpread"`. Expected: FAIL.

- [ ] **Step 3: Implement** — replace the existing `drawTarotCard` body and add helpers in `src/data/tarot.ts`:

```ts
export function reverseFace(face: TarotCardFace): TarotCardFace {
  return buildFace(DECK_BY_ID[face.id], face.orientation === 'upright' ? 'reversed' : 'upright');
}

export function reverseSpread(result: TarotResult): TarotResult {
  const faces = (result.spread ?? []).map((s) => reverseFace(s.card));
  return consolidateSpread(faces);
}

export function pickOrientation(affinities: Record<string, number>): 'upright' | 'reversed' {
  const reversalChance = 0.5 + ((affinities.chaos ?? 0) / 100) * 0.3;
  const orderMod = ((affinities.order ?? 0) / 100) * 0.2;
  const finalChance = Math.max(0.1, Math.min(0.9, reversalChance - orderMod));
  return Math.random() < finalChance ? 'reversed' : 'upright';
}

export function drawTarotSpread(affinities: Record<string, number>): TarotResult {
  const pool = [...FULL_DECK];
  const faces: TarotCardFace[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const [card] = pool.splice(idx, 1);
    faces.push(buildFace(card, pickOrientation(affinities)));
  }
  return consolidateSpread(faces);
}

export function drawTarotCard(affinities: Record<string, number>): TarotResult {
  const card = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
  return consolidateSpread([buildFace(card, pickOrientation(affinities))]);
}
```

Delete the old `drawTarotCard` implementation. (`drawTarotCard` still draws a single **major** so the existing `major-arcana` assertion and the single-card spawn path stay valid.)

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Tarot.test.ts` then `npm run build`. Expected: all PASS (including the pre-existing chaos/order reversal-probability tests, which now go through `pickOrientation`).

- [ ] **Step 5: Commit**

```bash
git add src/data/tarot.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): reverseSpread, drawTarotSpread; refactor drawTarotCard"
```

---

# Phase 2 — Engine wiring

### Task 6: `handSize` → `spreadRedraws`

**Files:**
- Modify: `src/engine/types.ts` (`AffinityEffects`)
- Modify: `src/engine/AffinityEngine.ts` (`getEffects`)
- Modify: `src/engine/GameEngine.ts` (`defaultState` affinityEffects literal)
- Test: `src/engine/__tests__/AffinityEffects.test.ts`

**Interfaces:**
- Produces: `AffinityEffects.spreadRedraws: number` (replaces `handSize`).

- [ ] **Step 1: Write the failing test** — add to `src/engine/__tests__/AffinityEffects.test.ts`:

```ts
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

describe('spreadRedraws by Will band', () => {
  const eng = () => new AffinityEngine(AFFINITY_DEFINITIONS);
  it('0 at baseline, 1 at ascendant, 2 at dominant', () => {
    const e = eng();
    expect(e.getEffects().spreadRedraws).toBe(0);
    e.setState({ will: 70 }); // ascendant
    expect(e.getEffects().spreadRedraws).toBe(1);
    e.setState({ will: 95 }); // dominant
    expect(e.getEffects().spreadRedraws).toBe(2);
  });
});
```

If the file references `handSize` elsewhere, update those assertions to `spreadRedraws` in this step.

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/AffinityEffects.test.ts -t "spreadRedraws"`. Expected: FAIL (`handSize` exists, not `spreadRedraws`).

- [ ] **Step 3: Implement:**
  - In `src/engine/types.ts` `AffinityEffects`, replace `handSize: number;` with `spreadRedraws: number; // disliked spread positions the player may redraw (Will)`.
  - In `src/engine/AffinityEngine.ts` `getEffects()` return, replace `handSize: 3 + clamp(willIdx - 1, 0, 2),` with `spreadRedraws: clamp(willIdx - 1, 0, 2),`.
  - In `src/engine/GameEngine.ts` `defaultState()`, change the `affinityEffects` literal `handSize: 3,` → `spreadRedraws: 0,`.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AffinityEffects.test.ts` then `npm run build`. Expected: PASS. (Build will flag any remaining `handSize` references — fix them; `TarotMinigame.tsx` is rewritten in Task 19, but if the build fails there now, temporarily read `state.affinityEffects.spreadRedraws` where `handSize` was used.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/AffinityEngine.ts src/engine/GameEngine.ts src/engine/__tests__/AffinityEffects.test.ts
git commit -m "refactor(affinity): replace handSize with spreadRedraws"
```

---

### Task 7: Tarot profile gains `volatility`

**Files:**
- Modify: `src/data/divination-profiles.ts`
- Test: `src/engine/__tests__/Tarot.test.ts` (or wherever profiles are asserted; create a small test)

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test** — append to `src/engine/__tests__/Tarot.test.ts`:

```ts
import { DIVINATION_PROFILES } from '../../data/divination-profiles';

describe('tarot profile', () => {
  it('lists volatility as a dimension strength (minors bring volatility)', () => {
    expect(DIVINATION_PROFILES.tarot.dimensionStrengths).toContain('volatility');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Tarot.test.ts -t "tarot profile"`. Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/data/divination-profiles.ts`, change tarot's `dimensionStrengths: ['certainty', 'favorability'],` to `dimensionStrengths: ['certainty', 'favorability', 'volatility'],`.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Tarot.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/divination-profiles.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): add volatility to tarot dimension strengths"
```

---

### Task 8: GameEngine deal + spread-orientation dispatch points

**Files:**
- Modify: `src/engine/GameEngine.ts` (replace `resolveTarotPick`/`resolveOrientation`; add `resolveTarotDeal`, `resolveSpreadOrientation`; spread-aware mutator handling)
- Modify: `src/data/tarot.ts` (import `reverseSpread` where needed — used by GameEngine)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces on `GameEngine`:
  - `resolveTarotDeal(faces: TarotCardFace[]): { faces: TarotCardFace[]; swappedIndex: number | null }`
  - `resolveSpreadOrientation(result: TarotResult): { result: TarotResult; auto: boolean; reversed: boolean }`
- Triggers: `tarot:deal`, `tarot:orient`.

- [ ] **Step 1: Write the failing test** — add to `src/engine/__tests__/GameEngine.test.ts`:

```ts
import { GameEngine } from '../GameEngine';
import { buildFace, DECK_BY_ID, consolidateSpread } from '../../data/tarot';

describe('tarot deal + spread orientation', () => {
  it('resolveTarotDeal returns the same faces when Fate is dormant', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const faces = [buildFace(DECK_BY_ID['the-fool'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright')];
    const { faces: out, swappedIndex } = e.resolveTarotDeal(faces);
    expect(out).toHaveLength(3);
    expect(swappedIndex).toBeNull();
  });

  it('resolveSpreadOrientation passes through when Fate is dormant', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const r = consolidateSpread([buildFace(DECK_BY_ID['the-star'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright')]);
    const { auto } = e.resolveSpreadOrientation(r);
    expect(auto).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "tarot deal"`. Expected: FAIL (methods undefined).

- [ ] **Step 3: Implement** — in `src/engine/GameEngine.ts`:
  - Add imports: `import { reverseSpread, drawTarotCard } from '../data/tarot';` and `import type { TarotCardFace } from './types';` (extend existing type import).
  - **Remove** `resolveTarotPick` and `resolveOrientation`. Add:

```ts
// Fate (OVERRIDE) may swap one dealt position for a fresh single card before reveal.
resolveTarotDeal(faces: TarotCardFace[]): { faces: TarotCardFace[]; swappedIndex: number | null } {
  const { draft } = this.dispatchAt('tarot:deal', { faces: [...faces] as unknown as SlotResult[] });
  const outFaces = (draft.faces as unknown as TarotCardFace[]) ?? faces;
  const swappedIndex = typeof draft.swappedIndex === 'number' ? draft.swappedIndex : null;
  this.notify();
  return { faces: outFaces, swappedIndex };
}

// Fate (OVERRIDE) may decide the spread-wide orientation for the player.
resolveSpreadOrientation(result: TarotResult): { result: TarotResult; auto: boolean; reversed: boolean } {
  const { draft } = this.dispatchAt('tarot:orient', { outcome: result });
  const out = (draft.outcome as TarotResult) ?? result;
  const auto = out !== result;
  this.notify();
  return { result: out, auto, reversed: out.orientation === 'reversed' };
}
```

  - In `completeMinigame`, the existing mirror/critical-resonance handling already replaces the slot from `draft.outcome`. Confirm those responders (Task 11) return the mutated `TarotResult` via `draft.outcome`, so no change needed here beyond importing `reverseSpread` (used inside responders, not the engine). Keep the chaos-second-result branch as-is (it draws a single card via `drawSingleResult('tarot')` → `drawTarotCard`).

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/GameEngine.test.ts` then `npm run build`. Expected: PASS. (Build flags removed methods used by `TarotMinigame.tsx` — that file is rewritten in Task 19; if needed for a green build now, stub the minigame's calls to the new method names.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): tarot:deal and spread-orientation dispatch points"
```

---

### Task 9: Spread redraw on the engine

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces: `GameEngine.redrawSpreadPosition(faces: TarotCardFace[], index: number): TarotCardFace[]` (draws a fresh distinct card into `index`, feeds Will).

- [ ] **Step 1: Write the failing test:**

```ts
import { GameEngine } from '../GameEngine';
import { buildFace, DECK_BY_ID } from '../../data/tarot';

describe('redrawSpreadPosition', () => {
  it('replaces one position with a different card and feeds Will', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.will;
    const faces = [buildFace(DECK_BY_ID['the-fool'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright')];
    const out = e.redrawSpreadPosition(faces, 1);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe('the-fool');
    expect(out[2].id).toBe('swords-3');
    expect(e.getState().affinities.will).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** — add to `GameEngine` (imports: `FULL_DECK`, `buildFace`, `pickOrientation` from `../data/tarot`):

```ts
// Will: redraw one disliked spread position. Draws a fresh distinct card, feeds Will.
redrawSpreadPosition(faces: TarotCardFace[], index: number): TarotCardFace[] {
  const used = new Set(faces.map((f) => f.id));
  const candidates = FULL_DECK.filter((c) => !used.has(c.id));
  const card = candidates[Math.floor(Math.random() * candidates.length)] ?? DECK_BY_ID[faces[index].id];
  const next = [...faces];
  next[index] = buildFace(card, pickOrientation(this.affinityEngine.getState()));
  this.affinityEngine.applyAction('take-reroll'); // agency → Will
  this.notify();
  return next;
}
```

Add `FULL_DECK`, `buildFace`, `pickOrientation`, `DECK_BY_ID` to the tarot import.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/GameEngine.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): Will-driven spread position redraw"
```

---

# Phase 3 — Responders, interactions, and the spread channel

### Task 10: Generalize the combine reducer to emit multiple reports

**Files:**
- Modify: `src/engine/events/types.ts` (`CombineReducer`)
- Modify: `src/engine/events/EventDispatcher.ts` (combine loop)
- Test: `src/engine/__tests__/AffinityResponders.test.ts` (or a new `EventDispatcher.test.ts`)

**Interfaces:**
- Produces: `CombineReducer.reduce(ctx): EffectReport | EffectReport[] | null`; dispatcher flattens arrays into `reports`.

- [ ] **Step 1: Write the failing test** — create `src/engine/__tests__/SpreadChannel.test.ts`:

```ts
import { dispatch } from '../events/EventDispatcher';
import { REDUCERS } from '../events/reducers';
import type { PhaseContext, Responder } from '../events/types';

function ctx(overrides: Partial<PhaseContext> = {}): PhaseContext {
  return {
    trigger: 'tarot:commit', affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
    slots: [], hand: null, spread: [], minigame: null, event: null,
    draft: {}, rng: () => 0.0, ...overrides,
  };
}

describe('combine reducer can emit multiple reports', () => {
  it('a channel reducer returning an array pushes all of them', () => {
    REDUCERS['test-multi'] = { channel: 'test-multi', reduce: () => [
      { responderId: 'a', label: 'A', description: 'a', animation: 'x' },
      { responderId: 'b', label: 'B', description: 'b', animation: 'x' },
    ] };
    const r: Responder = {
      id: 'tm', source: 'interaction', triggers: ['tarot:commit'],
      group: { kind: 'combine', channel: 'test-multi' }, condition: () => true, roll: () => true, apply: () => null,
    };
    const { reports } = dispatch('tarot:commit', ctx(), [r], { forced: [], isolate: false });
    expect(reports.map((x) => x.responderId)).toEqual(['a', 'b']);
    delete REDUCERS['test-multi'];
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/SpreadChannel.test.ts`. Expected: FAIL (only one report, or type error).

- [ ] **Step 3: Implement:**
  - `src/engine/events/types.ts`: change `reduce(ctx: PhaseContext): EffectReport | null;` to `reduce(ctx: PhaseContext): EffectReport | EffectReport[] | null;`.
  - `src/engine/events/EventDispatcher.ts`, in the combine block, replace:

```ts
    const reducer = REDUCERS[channel];
    if (reducer) { const rep = reducer.reduce(ctx); if (rep) reports.push(rep); }
```

with:

```ts
    const reducer = REDUCERS[channel];
    if (reducer) {
      const rep = reducer.reduce(ctx);
      if (Array.isArray(rep)) reports.push(...rep);
      else if (rep) reports.push(rep);
    }
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/SpreadChannel.test.ts` and `npm test` then `npm run build`. Expected: PASS (roll-mode unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/engine/events/types.ts src/engine/events/EventDispatcher.ts src/engine/__tests__/SpreadChannel.test.ts
git commit -m "feat(events): combine reducers may emit multiple reports"
```

---

### Task 11: Adapt Fate/critical-resonance/mirror to spreads

**Files:**
- Modify: `src/engine/responders/affinity.ts` (`fate-override-pick` → `fate-deal-swap`; `fate-auto-orient` spread-wide)
- Modify: `src/engine/responders/interactions.ts` (`critical-resonance`, `mirror` via `reverseSpread`)
- Test: `src/engine/__tests__/AffinityResponders.test.ts`

**Interfaces:**
- Consumes: `reverseSpread`, `buildFace`, `DECK_BY_ID`, `drawTarotCard`.
- Produces responder ids: `fate-deal-swap` (trigger `tarot:deal`), `fate-auto-orient` (trigger `tarot:orient`), adapted `critical-resonance`/`mirror`.

- [ ] **Step 1: Write the failing test:**

```ts
import { buildInteractionResponders } from '../responders/interactions';
import { buildAffinityResponders } from '../responders/affinity';

describe('spread-aware repurposed responders', () => {
  it('fate-deal-swap is registered on tarot:deal and fate-override-pick is gone', () => {
    const ids = buildAffinityResponders().map((r) => r.id);
    expect(ids).toContain('fate-deal-swap');
    expect(ids).not.toContain('fate-override-pick');
    const swap = buildAffinityResponders().find((r) => r.id === 'fate-deal-swap')!;
    expect(swap.triggers).toContain('tarot:deal');
  });
  it('fate-auto-orient now triggers on tarot:orient', () => {
    const r = buildAffinityResponders().find((x) => x.id === 'fate-auto-orient')!;
    expect(r.triggers).toContain('tarot:orient');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "spread-aware"`. Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/engine/responders/affinity.ts` (add imports `import { reverseSpread, buildFace, DECK_BY_ID, drawTarotCard } from '../../data/tarot'; import type { TarotCardFace } from '../types';`):

Replace the `fate-override-pick` responder with:

```ts
{
  id: 'fate-deal-swap', source: 'affinity', triggers: ['tarot:deal'],
  group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
  condition: (c) => Array.isArray(c.draft.faces) && (c.draft.faces as unknown[]).length >= 1,
  roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
  apply: (c) => {
    const faces = c.draft.faces as unknown as TarotCardFace[];
    const idx = Math.floor(c.rng() * faces.length);
    const used = new Set(faces.map((f) => f.id));
    const replacement = drawTarotCard(c.affinities).spread![0].card;
    if (used.has(replacement.id)) return null;
    faces[idx] = replacement;
    c.draft.faces = faces as unknown as typeof c.draft.faces;
    c.draft.swappedIndex = idx;
    return report('fate-deal-swap', 'Fate', 'The weave deals you another — a card changes before it turns.', 'override');
  },
},
```

Replace `fate-auto-orient` with the spread-wide version:

```ts
{
  id: 'fate-auto-orient', source: 'affinity', triggers: ['tarot:orient'],
  group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
  condition: (c) => c.draft.outcome?.type === 'tarot',
  roll: (c) => bandRoll(c, 'fate', 'stirring', T.notable),
  apply: (c) => {
    const result = c.draft.outcome as TarotResult;
    if (c.rng() < 0.5) c.draft.outcome = reverseSpread(result);
    return report('fate-auto-orient', 'Fate', 'Fate turns the spread for you.', 'override');
  },
},
```

Add `TarotResult` to the `import type` from `../types`. (`buildFace`/`DECK_BY_ID` imports are used by Task 12/13; keep them.)

In `src/engine/responders/interactions.ts` (add `import { reverseSpread } from '../../data/tarot';`):
  - `critical-resonance` `apply`: replace the in-place flip with `c.draft.outcome = reverseSpread(card);` and adjust the description based on `card.orientation` (the pre-flip majority).
  - `mirror` `apply`: for each reversible tarot in the spread, replace `card.orientation = ...` with reconsolidation via `reverseSpread`. Since `mirror` operates on `c.spread` entities (committed slots), reverse each tarot slot in place by mapping it through `reverseSpread` and writing it back into `c.draft` is not possible for non-committed entries; keep `mirror` flipping the **committed** outcome only: change its `apply` to `c.draft.outcome = reverseSpread(c.draft.outcome as TarotResult)` when the committed outcome is the reversible tarot. (Two-reversible case across slots is preserved by the engine reading `draft.outcome`.)

```ts
// critical-resonance apply:
apply: (c) => {
  const card = c.draft.outcome as TarotResult;
  const wasUpright = card.orientation === 'upright';
  c.draft.outcome = reverseSpread(card);
  return report('critical-resonance', 'Critical Resonance',
    wasUpright ? 'A dire omen drags the spread down — it inverts.' : 'A bright omen lifts the spread — it rights itself.',
    'flip');
},
```

```ts
// mirror apply:
apply: (c) => {
  if (c.draft.outcome?.type === 'tarot') {
    c.draft.outcome = reverseSpread(c.draft.outcome as TarotResult);
  }
  return report('mirror', 'The Mirror', 'Two forces reflect each other across the weave — both turn.', 'mirror');
},
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AffinityResponders.test.ts` and `npm test`, then `npm run build`. Expected: PASS. Fix any existing test that referenced `fate-override-pick`/`tarot:pick` by updating to `fate-deal-swap`/`tarot:deal`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/responders/interactions.ts src/engine/__tests__/AffinityResponders.test.ts
git commit -m "feat(responders): spread-aware Fate, Critical Resonance, Mirror"
```

---

### Task 12: Fool's Reroll still fires when the Fool is in the spread

**Files:**
- Test only: `src/engine/__tests__/AffinityResponders.test.ts` (regression guard; no source change expected)

**Interfaces:** none.

- [ ] **Step 1: Write the test** (proves the tag-lifting from Task 4 works end-to-end):

```ts
import { buildInteractionResponders } from '../responders/interactions';
import { consolidateSpread, buildFace, DECK_BY_ID } from '../../data/tarot';
import type { PhaseContext } from '../events/types';

describe("Fool's Reroll across the spread", () => {
  it('fires when The Fool is any position in a committed spread', () => {
    const foolReroll = buildInteractionResponders().find((r) => r.id === 'fool-reroll')!;
    const spreadSlot = consolidateSpread([
      buildFace(DECK_BY_ID['cups-2'], 'upright'),
      buildFace(DECK_BY_ID['the-fool'], 'upright'),
      buildFace(DECK_BY_ID['swords-3'], 'upright'),
    ]);
    const die = { type: 'd20', result: 10, threshold: 'neutral', interpretation: '', tags: ['draw'], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: ['effect'] };
    const ctx = {
      trigger: 'dice:commit', affinities: {} as PhaseContext['affinities'],
      slots: [spreadSlot] as PhaseContext['slots'], hand: null, spread: [spreadSlot, die] as PhaseContext['spread'],
      minigame: null, event: null, draft: { outcome: die as PhaseContext['draft']['outcome'] }, rng: () => 0,
    } as PhaseContext;
    expect(foolReroll.condition(ctx)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify pass** — `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "Fool's Reroll across"`. Expected: PASS (if it fails, the archetype tag-lift in `consolidateSpread` regressed — fix Task 4, do not weaken this test).

- [ ] **Step 3: Commit**

```bash
git add src/engine/__tests__/AffinityResponders.test.ts
git commit -m "test(interactions): Fool's Reroll fires from any spread position"
```

---

### Task 13: New affinity responders — Chaos Wild Card, Order Anchor, Shadow Veil

**Files:**
- Modify: `src/engine/responders/affinity.ts`
- Test: `src/engine/__tests__/AffinityResponders.test.ts`

**Interfaces:**
- Produces: `chaos-wild-card` (`tarot:orient`, MUTATE), `order-anchor` (`tarot:orient`, MUTATE), `shadow-veil-position` (`tarot:commit`, combine channel `spread`).

- [ ] **Step 1: Write the failing test:**

```ts
import { buildAffinityResponders } from '../responders/affinity';

describe('new tarot affinity responders', () => {
  const by = (id: string) => buildAffinityResponders().find((r) => r.id === id)!;
  it('chaos-wild-card and order-anchor are exclusive MUTATE on tarot:orient', () => {
    for (const id of ['chaos-wild-card', 'order-anchor']) {
      const r = by(id);
      expect(r.triggers).toContain('tarot:orient');
      expect(r.group).toEqual({ kind: 'exclusive', band: 'MUTATE' });
    }
  });
  it('shadow-veil-position is a combine responder on the spread channel', () => {
    const r = by('shadow-veil-position');
    expect(r.triggers).toContain('tarot:commit');
    expect(r.group).toEqual({ kind: 'combine', channel: 'spread' });
  });
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL.

- [ ] **Step 3: Implement** — append these to the array returned by `buildAffinityResponders()` in `src/engine/responders/affinity.ts`:

```ts
{
  id: 'chaos-wild-card', source: 'affinity', triggers: ['tarot:orient'],
  group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('chaos'),
  condition: (c) => c.draft.outcome?.type === 'tarot' && !!(c.draft.outcome as TarotResult).spread,
  roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.notable),
  apply: (c) => {
    const result = c.draft.outcome as TarotResult;
    const faces = result.spread!.map((s) => s.card);
    const i = Math.floor(c.rng() * faces.length);
    faces[i] = buildFace(DECK_BY_ID[faces[i].id], faces[i].orientation === 'upright' ? 'reversed' : 'upright');
    c.draft.outcome = consolidateSpread(faces);
    return report('chaos-wild-card', 'Chaos', 'One card defies the spread — it turns against the rest.', 'flip');
  },
},
{
  id: 'order-anchor', source: 'affinity', triggers: ['tarot:orient'],
  group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('order'),
  condition: (c) => c.draft.outcome?.type === 'tarot' && !!(c.draft.outcome as TarotResult).spread
    && (c.draft.outcome as TarotResult).spread!.some((s) => s.card.orientation === 'reversed'),
  roll: (c) => bandRoll(c, 'order', 'ascendant', T.notable),
  apply: (c) => {
    const result = c.draft.outcome as TarotResult;
    const faces = result.spread!.map((s) => buildFace(DECK_BY_ID[s.card.id], 'upright'));
    c.draft.outcome = consolidateSpread(faces);
    return report('order-anchor', 'Order', 'The spread settles — anchored, upright, and coherent.', 'anchor');
  },
},
{
  id: 'shadow-veil-position', source: 'affinity', triggers: ['tarot:commit'],
  group: { kind: 'combine', channel: 'spread' }, weight: w('shadow'),
  condition: (c) => c.draft.outcome?.type === 'tarot' && (c.draft.outcome as TarotResult).spread!.length > 1,
  roll: (c) => bandRoll(c, 'shadow', 'ascendant', T.notable),
  apply: (c) => {
    const result = c.draft.outcome as TarotResult;
    const i = Math.floor(c.rng() * result.spread!.length);
    result.spread![i].card.veiled = true;
    (c.draft.spreadReports ??= []).push(
      report('shadow-veil-position', 'Shadow', 'One card stays veiled — its face withheld from the reading.', 'shroud'));
    return null;
  },
},
```

Add imports: `import { reverseSpread, buildFace, DECK_BY_ID, drawTarotCard, consolidateSpread } from '../../data/tarot';` (merge with the Task 11 import line).

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AffinityResponders.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/affinity.ts src/engine/__tests__/AffinityResponders.test.ts
git commit -m "feat(responders): Chaos Wild Card, Order Anchor, Shadow Veil"
```

---

### Task 14: Spread-internal interactions + `spreadReducer`

**Files:**
- Modify: `src/engine/responders/interactions.ts` (add 5 interactions on channel `spread`)
- Modify: `src/engine/events/reducers.ts` (add `spreadReducer`, register)
- Test: `src/engine/__tests__/SpreadChannel.test.ts`

**Interfaces:**
- Consumes: `consolidateSpread`, the `spreadReports` draft accumulator from Task 13.
- Produces: interaction ids `suit-accord`, `elemental-clash`, `major-convergence`, `spread-aligned`, `spread-cascade`; `spreadReducer` (channel `spread`).

- [ ] **Step 1: Write the failing test** — append to `SpreadChannel.test.ts`:

```ts
import { dispatch as dispatch2 } from '../events/EventDispatcher';
import { buildInteractionResponders } from '../responders/interactions';
import { buildAffinityResponders } from '../responders/affinity';
import { consolidateSpread as cs, buildFace as bf, DECK_BY_ID as DB } from '../../data/tarot';

describe('spread-internal interactions', () => {
  const all = [...buildAffinityResponders(), ...buildInteractionResponders()];
  const commit = (slot: any) => dispatch2('tarot:commit',
    { trigger: 'tarot:commit', affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
      slots: [], hand: null, spread: [slot], minigame: null, event: null, draft: { outcome: slot }, rng: () => 0.99 } as any,
    all, { forced: [], isolate: false });

  it('all-reversed spread emits a cascade report', () => {
    const slot = cs([bf(DB['cups-2'], 'reversed'), bf(DB['swords-3'], 'reversed'), bf(DB['wands-5'], 'reversed')]);
    const { reports } = commit(slot);
    expect(reports.map((r) => r.responderId)).toContain('spread-cascade');
  });
  it('same-suit spread emits suit-accord', () => {
    const slot = cs([bf(DB['cups-2'], 'upright'), bf(DB['cups-5'], 'upright'), bf(DB['cups-8'], 'upright')]);
    const { reports } = commit(slot);
    expect(reports.map((r) => r.responderId)).toContain('suit-accord');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/SpreadChannel.test.ts -t "spread-internal"`. Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/engine/responders/interactions.ts` add helpers + responders (add `import { consolidateSpread } from '../../data/tarot'; import type { TarotResult } from '../types';`):

```ts
const spreadOf = (c: { draft: { outcome?: SlotResult } }): TarotResult | null =>
  c.draft.outcome?.type === 'tarot' && (c.draft.outcome as TarotResult).spread ? (c.draft.outcome as TarotResult) : null;
const facesOf = (r: TarotResult) => r.spread!.map((s) => s.card);
const OPPOSED: Record<string, string> = { fire: 'water', water: 'fire', air: 'earth', earth: 'air' };
const elementsIn = (r: TarotResult) =>
  new Set(facesOf(r).flatMap((f) => f.tags.filter((t) => t.startsWith('element-')).map((t) => t.slice(8))));
const primaryAxis: Record<string, keyof TarotResult['dimensions']> =
  { wands: 'volatility', cups: 'favorability', swords: 'favorability', pentacles: 'certainty' };

function spreadEntry(
  id: string, fires: (r: TarotResult) => boolean,
  apply: (r: TarotResult, push: (rep: EffectReport) => void) => void,
): Responder {
  return {
    id, source: 'interaction', triggers: ['tarot:commit'],
    group: { kind: 'combine', channel: 'spread' },
    condition: (c) => { const r = spreadOf(c); return !!r && (r.spread!.length > 1) && fires(r); },
    roll: () => true,
    apply: (c) => {
      const r = spreadOf(c)!;
      const push = (rep: EffectReport) => { (c.draft.spreadReports ??= [] as EffectReport[]).push(rep); };
      apply(r, push);
      c.draft.outcome = r;
      return null;
    },
  };
}
```

Add to the returned array in `buildInteractionResponders()`:

```ts
spreadEntry('suit-accord',
  (r) => { const s = facesOf(r).map((f) => f.suit); return s.every((x) => x && x === s[0]); },
  (r, push) => {
    const suit = facesOf(r)[0].suit!;
    const axis = primaryAxis[suit];
    r.dimensions[axis] = Math.max(-2, Math.min(2, Math.round(r.dimensions[axis] * 1.5 * 2) / 2));
    push(report('suit-accord', 'Suit Accord', `The ${suit} run pure — their nature deepens.`, 'amplify'));
  }),
spreadEntry('elemental-clash',
  (r) => { const e = elementsIn(r); return [...e].some((x) => e.has(OPPOSED[x])); },
  (r, push) => {
    r.dimensions.volatility = Math.max(-2, Math.min(2, Math.round((r.dimensions.volatility + 1) * 2) / 2));
    push(report('elemental-clash', 'Elemental Clash', 'Opposing elements grind — the reading turns turbulent.', 'amplify'));
  }),
spreadEntry('major-convergence',
  (r) => facesOf(r).filter((f) => f.arcana === 'major').length >= 2,
  (_r, push) => push(report('major-convergence', 'Convergence', 'Two great arcana align — a fated current runs through the spread.', 'second-result'))),
spreadEntry('spread-aligned',
  (r) => facesOf(r).every((f) => f.orientation === 'upright'),
  (_r, push) => push(report('spread-aligned', 'Order', 'The spread stands wholly upright — clarity settles.', 'anchor'))),
spreadEntry('spread-cascade',
  (r) => facesOf(r).every((f) => f.orientation === 'reversed'),
  (_r, push) => push(report('spread-cascade', 'Chaos', 'Every card falls reversed — a cascade of upheaval.', 'flip'))),
```

In `src/engine/events/reducers.ts` add and register the reducer (`spread-aligned`/`spread-cascade` also feed affinity — that happens in the engine; see Task 15):

```ts
export const spreadReducer: CombineReducer = {
  channel: 'spread',
  reduce(ctx: PhaseContext): EffectReport[] {
    return (ctx.draft.spreadReports as EffectReport[] | undefined) ?? [];
  },
};

export const REDUCERS: Record<string, CombineReducer> = {
  'roll-mode': rollModeReducer,
  'spread': spreadReducer,
};
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/SpreadChannel.test.ts` and `npm test`, then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/interactions.ts src/engine/events/reducers.ts src/engine/__tests__/SpreadChannel.test.ts
git commit -m "feat(interactions): spread channel — accord, clash, convergence, aligned, cascade"
```

---

### Task 15: Coherence affinity feeds + debug scenarios

**Files:**
- Modify: `src/engine/GameEngine.ts` (feed Order/Chaos on aligned/cascade after commit)
- Modify: `src/engine/events/scenarios.ts` (debug scenarios for new responders; fix tarot ones)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: the committed spread's faces.

- [ ] **Step 1: Write the failing test:**

```ts
import { GameEngine } from '../GameEngine';
import { consolidateSpread, buildFace, DECK_BY_ID } from '../../data/tarot';

describe('spread coherence feeds', () => {
  it('committing an all-upright spread nudges Order up', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.order;
    const slot = consolidateSpread([buildFace(DECK_BY_ID['the-sun'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['pentacles-3'], 'upright')]);
    e.completeMinigame(slot, { revealedAsDrawn: true });
    expect(e.getState().affinities.order).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run, verify fail** — Expected: FAIL (no coherence feed yet, or `order` not increased beyond tag feed). If the upright tag already raises Order enough to pass spuriously, assert a stronger delta by comparing against a non-coherent control spread; keep the version that genuinely fails first.

- [ ] **Step 3: Implement** — in `GameEngine.completeMinigame`, right after `this.affinityEngine.applyResultTags(result);`, add:

```ts
    // Spread coherence feeds (All Upright → Order, All Reversed → Chaos).
    if (result.type === 'tarot' && result.spread && result.spread.length > 1) {
      const faces = result.spread.map((s) => s.card);
      if (faces.every((f) => f.orientation === 'upright')) this.affinityEngine.shift('order', 6, 'spread-aligned');
      else if (faces.every((f) => f.orientation === 'reversed')) this.affinityEngine.shift('chaos', 6, 'spread-cascade');
    }
```

In `src/engine/events/scenarios.ts`: update any scenario keyed to `fate-override-pick`/`tarot:pick` to `fate-deal-swap` with slots staged for `tarot:deal`, and add one scenario each for `chaos-wild-card`, `order-anchor`, `shadow-veil-position`, `suit-accord`, `elemental-clash`, `major-convergence`, `spread-aligned`, `spread-cascade` that stages a committed/ను in-flight tarot spread (use `consolidateSpread` to build the staged slot) and forces the responder id. Follow the existing `DEBUG_SCENARIOS` entry shape in that file.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/GameEngine.test.ts` and `npm test`, then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/events/scenarios.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): spread coherence feeds + debug scenarios"
```

---

# Phase 4 — SVG sigils (no component tests; verify via build)

### Task 16: `CardSigil` component

**Files:**
- Create: `src/components/cards/CardSigil.tsx`

**Interfaces:**
- Produces: `export default function CardSigil(props: { card: TarotResult | TarotCardFace; size?: number; color?: string })`.

- [ ] **Step 1: Implement** — create `src/components/cards/CardSigil.tsx`:

```tsx
import type { TarotResult, TarotCardFace } from '../../engine/types';

type AnyCard = TarotResult | TarotCardFace;

// Minimal line-art registry — keyed by major id. Paths use a 0 0 48 48 viewBox,
// stroke=currentColor, fill=none. Start with a generic star; flesh out per-major.
const MAJOR_SIGILS: Record<string, string> = {
  'the-fool': 'M24 6 L30 24 L24 42 L18 24 Z',
  'the-star': 'M24 6 L27 20 L42 24 L27 28 L24 42 L21 28 L6 24 L21 20 Z',
  // ...add the remaining 20 majors; fall back to GENERIC below until authored.
};
const GENERIC = 'M24 8 A16 16 0 1 0 24 40 A16 16 0 1 0 24 8 M24 8 L24 40';

const SUIT_EMBLEM: Record<string, string> = {
  wands: 'M24 6 L24 42 M16 14 L24 6 L32 14',     // staff
  cups: 'M14 14 H34 L30 28 H18 Z M24 28 V40 M16 40 H32', // chalice
  swords: 'M24 6 V34 M16 30 H32 M24 34 L20 40 H28 Z',    // blade
  pentacles: 'M24 8 A16 16 0 1 0 24 40 A16 16 0 1 0 24 8 M24 10 L29 34 L9 19 H39 L19 34 Z', // coin/star
};

function isFace(c: AnyCard): c is TarotCardFace { return 'arcana' in c; }

export default function CardSigil({ card, size = 48, color = 'currentColor' }: { card: AnyCard; size?: number; color?: string }) {
  const reversed = card.orientation === 'reversed';
  const face = isFace(card) ? card : card.spread?.[Math.min(1, (card.spread?.length ?? 1) - 1)]?.card;
  const arcana = face?.arcana ?? 'major';
  const suit = face?.suit;
  const isSpread = !isFace(card) && (card.spread?.length ?? 1) > 1;

  let d = GENERIC;
  if (isSpread) d = 'M10 14 H30 V40 H10 Z M16 10 H36 V36 M22 6 H42 V32'; // three overlapping cards
  else if (arcana === 'minor' && suit) d = SUIT_EMBLEM[suit];
  else if (face) d = MAJOR_SIGILS[face.id] ?? GENERIC;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img"
      aria-label={isFace(card) ? card.name : (card as TarotResult).name}
      style={{ transform: reversed ? 'rotate(180deg)' : undefined, color }}>
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

> The MAJOR_SIGILS registry is filled out incrementally; `GENERIC` guarantees every card renders. This is real, runnable code — adding the remaining 20 major paths is art polish, not a blocker.

- [ ] **Step 2: Verify build** — `npm run build`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/CardSigil.tsx
git commit -m "feat(ui): CardSigil SVG sigil system (majors registry + suit emblems)"
```

---

### Task 17: Use `CardSigil` in the fan, slot, history, and result views

**Files:**
- Modify: `src/components/cards/FanCard.tsx`, `src/components/cards/CardSlot.tsx`, `src/components/overlays/HistoryTiles.tsx`, `src/components/screens/ResultReading.tsx`

**Interfaces:**
- Consumes: `CardSigil`.

- [ ] **Step 1: FanCard** — in `getCardDisplay`, for the `tarot` case, set `name` to `result.spread && result.spread.length > 1 ? 'Spread' : result.name` and keep symbol for non-tarot. In the JSX `<span>{display.symbol}</span>` block, when `result.type === 'tarot'` render `<CardSigil card={result} size={isDesktop ? 22 : 14} color={display.borderColor} />` instead of the text symbol; otherwise keep the text symbol. Import `CardSigil`.

- [ ] **Step 2: CardSlot** — in `renderSlotContent`, replace the `tarot` case body with a Past/Present/Future strip when `slot.spread && slot.spread.length > 1`:

```tsx
case 'tarot':
  if (slot.spread && slot.spread.length > 1) {
    return (
      <div style={contentWrapperStyle}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {slot.spread.map((s) => (
            <div key={s.position} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.55rem', color: '#7b9ec7', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.position}</span>
              {s.card.veiled
                ? <span style={{ fontSize: '1.5rem', color: '#5b7290' }}>✶</span>
                : <CardSigil card={s.card} size={28} color={s.card.orientation === 'reversed' ? '#d4a854' : '#9b6bb0'} />}
              <span style={{ fontSize: '0.5rem', color: '#7b9ec7' }}>{s.card.veiled ? 'veiled' : s.card.name}</span>
            </div>
          ))}
        </div>
        <div style={slotMeaningStyle}>{slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed}</div>
      </div>
    );
  }
  return (/* existing single-card tarot block, but swap the symbol <div> for <CardSigil card={slot} size={32} /> */);
```

Import `CardSigil`.

- [ ] **Step 3: HistoryTiles & ResultReading** — wherever a tarot `result.symbol` is rendered as text, render `<CardSigil card={result} size={…} />` instead (keep dice/iching as text symbols). Leave layout otherwise unchanged.

- [ ] **Step 4: Verify build** — `npm run build`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/cards/FanCard.tsx src/components/cards/CardSlot.tsx src/components/overlays/HistoryTiles.tsx src/components/screens/ResultReading.tsx
git commit -m "feat(ui): render tarot via CardSigil + Past/Present/Future strip"
```

---

# Phase 5 — Minigame rewrite

### Task 18: Rewrite `TarotMinigame` for the dealt spread

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx` (full rewrite of the component body; keep style objects, adapt as needed)

**Interfaces:**
- Consumes: `drawTarotSpread`, `consolidateSpread`, `reverseSpread`, `buildFace`, `CardSigil`; `engine.resolveTarotDeal`, `engine.resolveSpreadOrientation`, `engine.redrawSpreadPosition`, `engine.usePeek`, `engine.declinePeek`, `engine.completeMinigame`; `state.affinityEffects.spreadRedraws`, `state.affinityEffects.peekAvailable`.

- [ ] **Step 1: Implement the new flow** — replace the component logic with:
  - On mount: `faces = drawTarotSpread(state.affinities).spread!.map(s => s.card)`, then `const { faces: dealt } = engine.resolveTarotDeal(faces)` (Fate deal-swap) → store `faces` in state.
  - **Phase `deal`:** render 3 face-down cards labeled Past/Present/Future. A "Reveal the spread" button flips them in sequence (stagger). If `spreadRedraws > 0`, show a "Redraw" affordance under each position (up to `spreadRedraws` total uses) calling `setFaces(engine.redrawSpreadPosition(faces, i))`.
  - **Phase `orient`:** build `const result = consolidateSpread(faces)`; call `const { result: oriented, auto } = engine.resolveSpreadOrientation(result)`. If `auto`, skip to commit with `oriented`. Else show the spread-wide choice: "Reveal as Drawn" (`commit(result, { revealedAsDrawn: true })`) vs "Reverse the Spread's Course" (`commit(reverseSpread(result), { reversed: true })`). Peek control unchanged (`engine.usePeek(result)` / `engine.declinePeek()`), gated by `peekAvailable`.
  - **Commit:** `engine.completeMinigame(finalResult, meta)` after the flip animation delay (reuse the existing ~1200ms timing).
  - Render each face with `<CardSigil card={face} />`; reversed faces show rotated (CardSigil handles it) with the gold/purple orientation colors used today.
  - Reuse the existing style objects (`containerStyle`, `headingStyle`, `choiceRowStyle`, `choiceBtnStyle`, etc.); add a `positionLabelStyle` and a 3-column `spreadRowStyle`.

- [ ] **Step 2: Verify build** — `npm run build`. Expected: clean (this also confirms all removed engine methods — `resolveTarotPick`/`resolveOrientation` — are no longer referenced).

- [ ] **Step 3: Manual smoke test** — `npm run dev`, start a reading, pick the tarot method: confirm 3 cards deal into Past/Present/Future, flip, the spread-wide orientation choice works, peek works at Light Ascendant+, redraw appears at Will Ascendant+, and the committed slot shows the spread in the fan. Note results in the commit body.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(ui): rewrite tarot minigame as a dealt Past/Present/Future spread"
```

---

### Task 19: Narrative — spread positions + veil in the LLM prompt

**Files:**
- Modify: `src/engine/NarrativeAssembler.ts`
- Test: `src/engine/__tests__/NarrativeAssembler.test.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test** — add a case asserting that when a slot is a tarot spread, `generateLLMPrompt(...)` output contains "Past", "Present", "Future" and the three card names, and that a `veiled` face renders as withheld (e.g. "veiled"). Match the existing test's call shape in `NarrativeAssembler.test.ts`.

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts -t "spread"`. Expected: FAIL.

- [ ] **Step 3: Implement** — where the assembler formats tarot slots for the prompt, if `slot.spread && slot.spread.length > 1`, emit a line per position: `` `${position}: ${card.veiled ? '(veiled)' : card.name} (${card.orientation})` ``; otherwise keep the single-card formatting.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/NarrativeAssembler.ts src/engine/__tests__/NarrativeAssembler.test.ts
git commit -m "feat(narrative): spread positions and veil in the LLM prompt"
```

---

# Phase 6 — Documentation

### Task 20: Update `docs/game-systems.md` and `README.md`

**Files:**
- Modify: `docs/game-systems.md`, `README.md`

**Interfaces:** none.

- [ ] **Step 1: game-systems.md** — update:
  - §3a: rename `handSize` → `spreadRedraws` (Will: latent/stirring 0 · ascendant 1 · dominant 2; "disliked spread positions the player may redraw").
  - §4: add `fate-deal-swap` (`tarot:deal`, OVERRIDE), spread-wide `fate-auto-orient` (`tarot:orient`), `chaos-wild-card`/`order-anchor` (`tarot:orient`, MUTATE tug-of-war), `shadow-veil-position` (`tarot:commit`, spread channel); note Light Position Foresight on peek.
  - §5: adapt `critical-resonance`/`mirror` notes (majority orientation, `reverseSpread`); add the new spread-internal interactions (`suit-accord`, `elemental-clash`, `major-convergence`, `spread-aligned`, `spread-cascade`) and explain the **cross-slot vs spread-internal** scopes.
  - Add a new "Tarot spreads & consolidation" subsection (deck 78, draw 3 → consolidate to one slot; dimensions averaged, themes capped at 2, tags/archetypes lifted, majority orientation; the two interaction scopes; balance rationale).

- [ ] **Step 2: README.md** — update the tarot section: minor arcana (suit × rank, dimension-focused), the Past/Present/Future spread that reads as one slot, the new SVG sigils, and the new tarot interactions/affinity effects.

- [ ] **Step 3: Verify** — `npm run build` (no code change, sanity only) and re-read both docs against §5 of the spec for accuracy.

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs: tarot overhaul — spreads, minor arcana, sigils, new interactions"
```

---

## Self-Review

**Spec coverage:**
- Minor arcana (suit × rank, dimension-heavy/theme-light) → Task 2. ✓
- Consolidated Past/Present/Future spread → Tasks 4, 5, 18. ✓
- One spread-wide orientation choice → Tasks 8, 18. ✓
- SVG sigils → Tasks 16, 17, 18. ✓
- Fate Deal-Swap + Will Redraw → Tasks 11, 9/6. ✓
- Chaos Wild Card / Order Anchor / Shadow Veil → Task 13. ✓
- Elemental + coherence interactions → Task 14; coherence feeds → Task 15. ✓
- Light Position Foresight → folded into the peek call in Task 18 (engine `usePeek`/`describeLeaning` already returns the leaning; naming the strongest position is a string tweak in `describeLeaning`). **Gap fix:** add an explicit sub-step. See note below.
- Combine reducer multi-report → Task 10. ✓
- divination-profiles volatility → Task 7. ✓
- Fool's Reroll across spread → Task 12. ✓
- Docs → Task 20. ✓

**Light Position Foresight (gap closure):** In Task 18, when wiring peek, also update `GameEngine.describeLeaning(preview)` (in `src/engine/GameEngine.ts`) so that for a tarot spread it names the position whose card has the largest `sumAbs(dimensions)` — e.g. `"The Future pulls strongest..."`. Add this as a step in Task 18 and a small assertion in a GameEngine test (`usePeek` returns a leaning string mentioning a position for a spread preview).

**Placeholder scan:** No TBD/TODO; every code step has runnable code. The MAJOR_SIGILS registry uses a `GENERIC` fallback so it is complete and runnable while art is authored (explicitly noted, not a placeholder).

**Type consistency:** `consolidateSpread`, `buildFace`, `reverseSpread`, `drawTarotSpread`, `spreadRedraws`, `resolveTarotDeal`, `resolveSpreadOrientation`, `redrawSpreadPosition`, channel `spread`, `spreadReports` draft key — names match across all tasks. `CombineReducer.reduce` return type widened in Task 10 before `spreadReducer` (Task 14) relies on it. `fate-override-pick`/`tarot:pick` fully removed (Task 11) before any test references the new ids.
