# Astromancy Divination Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new standalone divination method, **astromancy** — casting a Planet die and a Sign die onto a 12-house zodiac board, read as Planet-in-Sign-in-House plus an emergent aspect, with a 2D-physics throw where affinities are forces.

**Architecture:** All rules are framework-free, pure TypeScript in `src/data/` + `src/engine/` (zero React/DOM). A physics component (`CelestialCast`, matter.js) produces a plain-data `AstralCast`; the pure `consolidateCast()` collapses it into one `AstralResult` (a new `SlotResult` union member) whose `themes/dimensions/modifierRoles/tags` every existing consumer already reads. New behaviors are `Responder`s dispatched at `astral:commit`. The legacy `d20` method is left **entirely untouched** and removed by the user later.

**Tech Stack:** TypeScript (strict), Vite, React 18, framer-motion, **matter.js** (new — 2D rigid-body physics), Vitest (engine/data tests only, Node env).

## Global Constraints

- Engine/data code MUST NOT import React or DOM APIs (`src/engine/**`, `src/data/**`).
- Type safety is the lint: every task ends green under `npm run build` (`tsc -b`) with `strict`, `noUnusedLocals`, `noUnusedParameters`.
- Tests live only under `src/engine/__tests__/**` (Vitest, Node env, `localStorage` polyfilled by `vitest.setup.ts`). No component tests; UI tasks verify via `npm run build`.
- `DimensionValues` axes are −2.0..+2.0 at 0.5 granularity. Always round to 0.5 and clamp.
- Affinities are 0–100; never display them directly.
- Mutators on `GameEngine` must end with `notify()`.
- **Do NOT modify Tarot or I Ching files, and do NOT modify the legacy d20 files** (`src/data/dice.ts`, `src/data/dice-modifiers.ts`, `src/components/screens/DiceMinigame.tsx`, `src/components/screens/DiceThrowAnimation.tsx`). Astromancy is additive.
- When changing affinities/responders/data systems, update `docs/game-systems.md` + README in the same change (Phase 5).
- Run a single test file: `npx vitest run src/engine/__tests__/<File>.test.ts`. Full suite: `npm test`.
- Branch/worktree: `worktree-dice-overhaul` (already created). Commit after every task.

---

## File Structure

**Data**
- `src/data/astromancy.ts` — NEW. Planet/sign/house/dignity tables; `aspectBetween`; `consolidateCast`; `drawAstralCast`; constants.

**Engine**
- `src/engine/types.ts` — add `'astral'` to `DivinationType`; add `PlanetId`, `SignId`, `OmenTag`, `AspectName`, `AstralCast`, `AstralResult`; add `AstralResult` to `DivinationResult`.
- `src/engine/astral.ts` — NEW. `AstralCastMode`, `AFFINITY_ASTRAL_MODIFIERS`, `planAstralCast` helper, `resolveCastSelection`.
- `src/engine/AstralPlanner.ts` is NOT used — planning lives in `astral.ts` to keep one focused file.
- `src/engine/TurnOrchestrator.ts` — register `astral` in `POOL_TYPES`, `QUESTION_WEIGHTS`, `drawSingleResult`.
- `src/engine/GameEngine.ts` — register `buildAstralResponders()`; widen `removeUsedMethod`/`spawnSecond` casts to include `'astral'`; add `planAstralCast`/`resolveCastSelection` façade methods.
- `src/engine/responders/astral.ts` — NEW. Symbolic-resonance + omen responders.
- `src/engine/events/scenarios.ts` — debug scenarios for the new responders.
- `src/data/divination-profiles.ts` — add the `astral` profile.

**Components**
- `src/components/screens/CelestialCast.tsx` — NEW. matter.js physics throw + house-wheel renderer.
- `src/components/screens/AstralMinigame.tsx` — NEW. Drives the cast.
- `src/components/cards/AstralSigil.tsx` — NEW. SVG glyphs for planets/signs/houses.
- `src/components/screens/GameTable.tsx` — add the `astral` minigame case.
- `src/components/screens/ResultReading.tsx`, `src/components/overlays/HistoryTiles.tsx` — additive `astral` display branch.

**Docs**
- `docs/game-systems.md`, `README.md`.

---

## Shared interface contract (used across tasks)

```ts
// types.ts
export type PlanetId = 'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto'|'north-node'|'south-node';
export type SignId   = 'aries'|'taurus'|'gemini'|'cancer'|'leo'|'virgo'|'libra'|'scorpio'|'sagittarius'|'capricorn'|'aquarius'|'pisces';
export type OmenTag  = 'errant-star' | 'crowned-conjunction' | 'veiled-oracle';
export type AspectName = 'conjunction'|'sextile'|'square'|'trine'|'opposition'|'minor';

export interface AstralCast {
  planet: PlanetId; planetHouse: number; sign: SignId; signHouse: number; omens: OmenTag[];
}
export interface AstralResult extends ThematicData {
  type: 'astral';
  id: string; name: string; symbol: string; interpretation: string;
  planet: PlanetId; sign: SignId; house: number; aspect: AspectName;
  tags: Tag[]; cast: AstralCast;
}

// data/astromancy.ts
export const PLANETS: Record<PlanetId, PlanetDef>;
export const SIGNS: Record<SignId, SignDef>;
export const HOUSES: HouseDef[];           // index 0 = house 1
export const DIGNITY: Record<PlanetId, { dignified: SignId[]; debilitated: SignId[] }>;
export function aspectBetween(houseA: number, houseB: number): AspectName;
export function consolidateCast(cast: AstralCast): AstralResult;
export function drawAstralCast(affinities: Record<string, number>): AstralCast;

// engine/astral.ts
export type AstralCastMode = 'single' | 'favored' | 'clouded' | 'choice';
export function planAstralCast(affinities: Record<string, number>, offerRecast: boolean):
  { mode: AstralCastMode; offerRecast: boolean; sources: string[] };
export function resolveCastSelection(casts: AstralCast[], mode: AstralCastMode):
  { chosen: AstralCast; index: 0 | 1; auto: boolean };

// engine/responders/astral.ts
export function buildAstralResponders(): Responder[];
```

---

# Phase 1 — Data foundation (engine-pure, fully tested)

### Task 1: Types — register `astral` and the cast/result shapes

**Files:**
- Modify: `src/engine/types.ts`
- Test: `src/engine/__tests__/Astromancy.test.ts` (NEW)

**Interfaces:**
- Produces: `DivinationType` includes `'astral'`; `PlanetId`, `SignId`, `OmenTag`, `AspectName`, `AstralCast`, `AstralResult`; `DivinationResult` includes `AstralResult`.

- [ ] **Step 1: Write the failing test** — create `src/engine/__tests__/Astromancy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { AstralResult, AstralCast } from '../types';

describe('astral types', () => {
  it('an AstralResult is assignable with the required surface', () => {
    const cast: AstralCast = { planet: 'mars', planetHouse: 7, sign: 'aries', signHouse: 7, omens: [] };
    const r: AstralResult = {
      type: 'astral', id: 'astral:mars-aries-h7', name: 'Mars in Aries', symbol: '♂',
      interpretation: 'x', planet: 'mars', sign: 'aries', house: 7, aspect: 'conjunction',
      themes: ['conflict'], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
      modifierRoles: ['action'], tags: ['astral'], cast,
    };
    expect(r.type).toBe('astral');
  });
});
```

- [ ] **Step 2: Run test, verify it fails** — `npx vitest run src/engine/__tests__/Astromancy.test.ts`. Expected: FAIL (types not exported).

- [ ] **Step 3: Add the types** — in `src/engine/types.ts`:
  - Change `export type DivinationType = 'tarot' | 'd20' | 'iching' | 'happening';` to `export type DivinationType = 'tarot' | 'd20' | 'iching' | 'astral' | 'happening';`.
  - After the `IChingResult` interface, add:

```ts
// ── Astromancy Types ──
export type PlanetId = 'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto'|'north-node'|'south-node';
export type SignId   = 'aries'|'taurus'|'gemini'|'cancer'|'leo'|'virgo'|'libra'|'scorpio'|'sagittarius'|'capricorn'|'aquarius'|'pisces';
export type OmenTag  = 'errant-star' | 'crowned-conjunction' | 'veiled-oracle';
export type AspectName = 'conjunction'|'sextile'|'square'|'trine'|'opposition'|'minor';

export interface AstralCast {
  planet: PlanetId;
  planetHouse: number; // 1..12 — arena (where the Planet die settled)
  sign: SignId;
  signHouse: number;   // 1..12 — used only to derive the aspect
  omens: OmenTag[];
}

export interface AstralResult extends ThematicData {
  type: 'astral';
  id: string;
  name: string;
  symbol: string;
  interpretation: string;
  planet: PlanetId;
  sign: SignId;
  house: number;     // 1..12
  aspect: AspectName;
  tags: Tag[];
  cast: AstralCast;
}
```

  - Change `export type DivinationResult = TarotResult | DiceResult | IChingResult;` to `export type DivinationResult = TarotResult | DiceResult | IChingResult | AstralResult;`.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Astromancy.test.ts` then `npm run build`. Expected: test PASS; build may report non-exhaustive `switch` over `SlotResult` in consumers — if so, **leave them for Task 14**, but if `tsc -b` fails now, add a temporary `case 'astral':` that mirrors a sibling branch in any file that breaks (the real branches land in Task 14). Prefer to verify only the test here and run the full build at Task 14; if build is required green now, the only likely breakers are exhaustive switches in `NarrativeAssembler`/`ReadingPlanner` — those read the common surface and usually have a default. Confirm `npm run build` is green before committing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): add astral divination types and result union member"
```

---

### Task 2: Planet / sign / house / dignity tables

**Files:**
- Create: `src/data/astromancy.ts`
- Test: `src/engine/__tests__/Astromancy.test.ts`

**Interfaces:**
- Consumes: `PlanetId`, `SignId`, `ThemeTag`, `DimensionValues`, `ModifierRole`.
- Produces: `PLANETS`, `SIGNS`, `HOUSES`, `DIGNITY`, `ELEMENT_BY_SIGN`, plus `PlanetDef`/`SignDef`/`HouseDef`.

- [ ] **Step 1: Write the failing test** — append to `src/engine/__tests__/Astromancy.test.ts`:

```ts
import { PLANETS, SIGNS, HOUSES, DIGNITY } from '../../data/astromancy';

describe('astromancy tables', () => {
  it('defines all 12 planets and 12 signs', () => {
    expect(Object.keys(PLANETS)).toHaveLength(12);
    expect(Object.keys(SIGNS)).toHaveLength(12);
  });
  it('defines 12 houses, indexed 1..12 with a theme each', () => {
    expect(HOUSES).toHaveLength(12);
    expect(HOUSES[0].house).toBe(1);
    expect(HOUSES[11].house).toBe(12);
    expect(HOUSES.every((h) => typeof h.theme === 'string')).toBe(true);
  });
  it('every sign has an element and modality', () => {
    expect(Object.values(SIGNS).every((s) => !!s.element && !!s.modality)).toBe(true);
  });
  it('dignity table marks Mars dignified in Aries and debilitated in Libra', () => {
    expect(DIGNITY.mars.dignified).toContain('aries');
    expect(DIGNITY.mars.debilitated).toContain('libra');
  });
  it('planet dimension signatures stay within [-2,2]', () => {
    for (const p of Object.values(PLANETS)) {
      for (const v of Object.values(p.dimensions)) {
        expect(v).toBeGreaterThanOrEqual(-2);
        expect(v).toBeLessThanOrEqual(2);
      }
    }
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Astromancy.test.ts -t "astromancy tables"`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — create `src/data/astromancy.ts`:

```ts
import type {
  PlanetId, SignId, ThemeTag, DimensionValues, ModifierRole,
} from '../engine/types';

export interface PlanetDef {
  id: PlanetId; glyph: string; name: string;
  theme: ThemeTag; modifierRole: ModifierRole; dimensions: DimensionValues;
}
export interface SignDef {
  id: SignId; glyph: string; name: string;
  element: 'fire' | 'earth' | 'air' | 'water';
  modality: 'cardinal' | 'fixed' | 'mutable';
}
export interface HouseDef { house: number; arena: string; theme: ThemeTag; }

const D = (favorability: number, certainty: number, volatility: number): DimensionValues =>
  ({ favorability, certainty, volatility });

export const PLANETS: Record<PlanetId, PlanetDef> = {
  sun:        { id: 'sun',        glyph: '☉', name: 'Sun',        theme: 'illumination',   modifierRole: 'subject', dimensions: D(1.0, 0.5, 0) },
  moon:       { id: 'moon',       glyph: '☽', name: 'Moon',       theme: 'mystery',        modifierRole: 'subject', dimensions: D(0.5, -1.0, 0.5) },
  mercury:    { id: 'mercury',    glyph: '☿', name: 'Mercury',    theme: 'illumination',   modifierRole: 'action',  dimensions: D(0, 0.5, 0.5) },
  venus:      { id: 'venus',      glyph: '♀', name: 'Venus',      theme: 'harmony',        modifierRole: 'subject', dimensions: D(1.5, 0, -0.5) },
  mars:       { id: 'mars',       glyph: '♂', name: 'Mars',       theme: 'conflict',       modifierRole: 'action',  dimensions: D(-1.0, 0.5, 1.5) },
  jupiter:    { id: 'jupiter',    glyph: '♃', name: 'Jupiter',    theme: 'renewal',        modifierRole: 'subject', dimensions: D(1.5, 0, 0.5) },
  saturn:     { id: 'saturn',     glyph: '♄', name: 'Saturn',     theme: 'authority',      modifierRole: 'effect',  dimensions: D(-0.5, 1.5, -0.5) },
  uranus:     { id: 'uranus',     glyph: '♅', name: 'Uranus',     theme: 'upheaval',       modifierRole: 'effect',  dimensions: D(0, -0.5, 1.5) },
  neptune:    { id: 'neptune',    glyph: '♆', name: 'Neptune',    theme: 'mystery',        modifierRole: 'effect',  dimensions: D(0, -1.0, 0.5) },
  pluto:      { id: 'pluto',      glyph: '♇', name: 'Pluto',      theme: 'transformation', modifierRole: 'effect',  dimensions: D(-0.5, 0, 1.5) },
  'north-node': { id: 'north-node', glyph: '☊', name: 'North Node', theme: 'renewal',     modifierRole: 'action',  dimensions: D(1.0, -0.5, 0.5) },
  'south-node': { id: 'south-node', glyph: '☋', name: 'South Node', theme: 'surrender',   modifierRole: 'effect',  dimensions: D(-1.0, 0, 0) },
};

const SIGN_ROWS: [SignId, string, string, SignDef['element'], SignDef['modality']][] = [
  ['aries', '♈', 'Aries', 'fire', 'cardinal'],
  ['taurus', '♉', 'Taurus', 'earth', 'fixed'],
  ['gemini', '♊', 'Gemini', 'air', 'mutable'],
  ['cancer', '♋', 'Cancer', 'water', 'cardinal'],
  ['leo', '♌', 'Leo', 'fire', 'fixed'],
  ['virgo', '♍', 'Virgo', 'earth', 'mutable'],
  ['libra', '♎', 'Libra', 'air', 'cardinal'],
  ['scorpio', '♏', 'Scorpio', 'water', 'fixed'],
  ['sagittarius', '♐', 'Sagittarius', 'fire', 'mutable'],
  ['capricorn', '♑', 'Capricorn', 'earth', 'cardinal'],
  ['aquarius', '♒', 'Aquarius', 'air', 'fixed'],
  ['pisces', '♓', 'Pisces', 'water', 'mutable'],
];
export const SIGNS: Record<SignId, SignDef> = Object.fromEntries(
  SIGN_ROWS.map(([id, glyph, name, element, modality]) => [id, { id, glyph, name, element, modality }]),
) as Record<SignId, SignDef>;

export const ELEMENT_BY_SIGN: Record<SignId, SignDef['element']> =
  Object.fromEntries(SIGN_ROWS.map(([id, , , element]) => [id, element])) as Record<SignId, SignDef['element']>;

export const HOUSES: HouseDef[] = [
  { house: 1,  arena: 'Self',          theme: 'authority' },
  { house: 2,  arena: 'Resources',     theme: 'stagnation' },
  { house: 3,  arena: 'Communication', theme: 'illumination' },
  { house: 4,  arena: 'Roots',         theme: 'harmony' },
  { house: 5,  arena: 'Creativity',    theme: 'renewal' },
  { house: 6,  arena: 'Work',          theme: 'stagnation' },
  { house: 7,  arena: 'Partnership',   theme: 'harmony' },
  { house: 8,  arena: 'Rebirth',       theme: 'transformation' },
  { house: 9,  arena: 'Journeys',      theme: 'illumination' },
  { house: 10, arena: 'Career',        theme: 'authority' },
  { house: 11, arena: 'Community',     theme: 'renewal' },
  { house: 12, arena: 'The Hidden',    theme: 'mystery' },
];

export const DIGNITY: Record<PlanetId, { dignified: SignId[]; debilitated: SignId[] }> = {
  sun:        { dignified: ['leo'],                debilitated: ['aquarius'] },
  moon:       { dignified: ['cancer'],             debilitated: ['capricorn'] },
  mercury:    { dignified: ['gemini', 'virgo'],    debilitated: ['sagittarius', 'pisces'] },
  venus:      { dignified: ['taurus', 'libra'],    debilitated: ['scorpio', 'aries'] },
  mars:       { dignified: ['aries', 'scorpio'],   debilitated: ['libra', 'taurus'] },
  jupiter:    { dignified: ['sagittarius', 'pisces'], debilitated: ['gemini', 'virgo'] },
  saturn:     { dignified: ['capricorn', 'aquarius'], debilitated: ['cancer', 'aries'] },
  uranus:     { dignified: ['aquarius'],           debilitated: ['leo'] },
  neptune:    { dignified: ['pisces'],             debilitated: ['virgo'] },
  pluto:      { dignified: ['scorpio'],            debilitated: ['taurus'] },
  'north-node': { dignified: [],                   debilitated: [] },
  'south-node': { dignified: [],                   debilitated: [] },
};
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Astromancy.test.ts` then `npm run build`. Expected: PASS; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/astromancy.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): planet/sign/house/dignity tables"
```

---

### Task 3: `aspectBetween`

**Files:**
- Modify: `src/data/astromancy.ts`
- Test: `src/engine/__tests__/Astromancy.test.ts`

**Interfaces:**
- Produces: `aspectBetween(houseA, houseB): AspectName`, `ASPECT_EFFECT: Record<AspectName, { dims: Partial<DimensionValues>; theme?: ThemeTag }>`.

- [ ] **Step 1: Write the failing test:**

```ts
import { aspectBetween } from '../../data/astromancy';

describe('aspectBetween', () => {
  it('maps house separations to the right aspect', () => {
    expect(aspectBetween(1, 1)).toBe('conjunction');   // 0°
    expect(aspectBetween(1, 3)).toBe('sextile');        // 60°
    expect(aspectBetween(1, 4)).toBe('square');         // 90°
    expect(aspectBetween(1, 5)).toBe('trine');          // 120°
    expect(aspectBetween(1, 7)).toBe('opposition');     // 180°
    expect(aspectBetween(1, 2)).toBe('minor');          // 30°
    expect(aspectBetween(1, 6)).toBe('minor');          // 150°
  });
  it('is symmetric and wraps the wheel', () => {
    expect(aspectBetween(12, 1)).toBe('minor');         // 30° across the wrap
    expect(aspectBetween(2, 8)).toBe('opposition');     // 180°
    expect(aspectBetween(7, 1)).toBe(aspectBetween(1, 7));
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Astromancy.test.ts -t "aspectBetween"`. Expected: FAIL.

- [ ] **Step 3: Implement** — append to `src/data/astromancy.ts` (add `AspectName` to the type import):

```ts
import type { /* existing… */ AspectName } from '../engine/types';

const ASPECT_BY_STEP: Record<number, AspectName> = {
  0: 'conjunction', 1: 'minor', 2: 'sextile', 3: 'square', 4: 'trine', 5: 'minor', 6: 'opposition',
};

export function aspectBetween(houseA: number, houseB: number): AspectName {
  const d = Math.abs(houseA - houseB);
  const step = Math.min(d, 12 - d); // 0..6
  return ASPECT_BY_STEP[step];
}

export const ASPECT_EFFECT: Record<AspectName, { dims: Partial<DimensionValues>; theme?: ThemeTag }> = {
  conjunction: { dims: { certainty: 1.5, volatility: 0.5 } },
  sextile:     { dims: { favorability: 1.0, certainty: 0.5 }, theme: 'harmony' },
  square:      { dims: { favorability: -0.5, volatility: 1.0 }, theme: 'conflict' },
  trine:       { dims: { favorability: 1.0, certainty: 0.5 }, theme: 'harmony' },
  opposition:  { dims: { certainty: 1.0, volatility: 1.0 }, theme: 'upheaval' },
  minor:       { dims: { volatility: 0.5, certainty: -0.5 }, theme: 'mystery' },
};
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Astromancy.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/astromancy.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): aspectBetween + aspect effect table"
```

---

### Task 4: `consolidateCast`

**Files:**
- Modify: `src/data/astromancy.ts`
- Test: `src/engine/__tests__/Astromancy.test.ts`

**Interfaces:**
- Consumes: `PLANETS`, `SIGNS`, `HOUSES`, `DIGNITY`, `ELEMENT_BY_SIGN`, `aspectBetween`, `ASPECT_EFFECT`.
- Produces: `consolidateCast(cast): AstralResult`; helpers `elementLean`, `modalityLean`, `dignityOf`.

- [ ] **Step 1: Write the failing test:**

```ts
import { consolidateCast } from '../../data/astromancy';
import type { AstralCast } from '../types';

const C = (over: Partial<AstralCast> = {}): AstralCast =>
  ({ planet: 'mars', planetHouse: 7, sign: 'aries', signHouse: 7, omens: [], ...over });

describe('consolidateCast', () => {
  it('returns an astral result with house from the planet die', () => {
    const r = consolidateCast(C({ planetHouse: 10 }));
    expect(r.type).toBe('astral');
    expect(r.house).toBe(10);
    expect(r.planet).toBe('mars');
    expect(r.sign).toBe('aries');
  });
  it('derives the aspect from planet vs sign house', () => {
    expect(consolidateCast(C({ planetHouse: 1, signHouse: 5 })).aspect).toBe('trine');
    expect(consolidateCast(C({ planetHouse: 1, signHouse: 1 })).aspect).toBe('conjunction');
  });
  it('clamps dimensions to [-2,2] at 0.5 granularity', () => {
    const r = consolidateCast(C());
    for (const v of Object.values(r.dimensions)) {
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
      expect(Math.round(v * 2)).toBe(v * 2);
    }
  });
  it('caps themes at 2', () => {
    expect(consolidateCast(C()).themes.length).toBeLessThanOrEqual(2);
  });
  it('emits identifying + dignity + element tags', () => {
    const r = consolidateCast(C()); // Mars in Aries = dignified
    expect(r.tags).toEqual(expect.arrayContaining(['astral', 'planet-mars', 'sign-aries', 'house-7', 'element-fire', 'aspect-conjunction', 'dignified']));
  });
  it('flags debility (Mars in Libra)', () => {
    const r = consolidateCast(C({ sign: 'libra' }));
    expect(r.tags).toContain('debilitated');
    expect(r.tags).not.toContain('dignified');
  });
  it('carries omen tags through', () => {
    const r = consolidateCast(C({ omens: ['errant-star'] }));
    expect(r.tags).toContain('errant-star');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Astromancy.test.ts -t "consolidateCast"`. Expected: FAIL.

- [ ] **Step 3: Implement** — append to `src/data/astromancy.ts` (add `AstralCast`, `AstralResult`, `Tag` to the type import):

```ts
const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));

const ELEMENT_LEAN: Record<SignDef['element'], Partial<DimensionValues>> = {
  fire:  { volatility: 0.5, favorability: 0.5 },
  earth: { certainty: 0.5, volatility: -0.5 },
  air:   { certainty: 0.5 },
  water: { favorability: 0.5, certainty: -0.5 },
};
const MODALITY_LEAN: Record<SignDef['modality'], Partial<DimensionValues>> = {
  cardinal: { volatility: 0.5 },
  fixed:    { certainty: 0.5, volatility: -0.5 },
  mutable:  { volatility: 0.5, certainty: -0.5 },
};
const ELEMENT_THEME: Record<SignDef['element'], ThemeTag> = {
  fire: 'transformation', earth: 'stagnation', air: 'illumination', water: 'harmony',
};

export function dignityOf(planet: PlanetId, sign: SignId): 'dignified' | 'debilitated' | null {
  if (DIGNITY[planet].dignified.includes(sign)) return 'dignified';
  if (DIGNITY[planet].debilitated.includes(sign)) return 'debilitated';
  return null;
}

function addDims(target: DimensionValues, src: Partial<DimensionValues>) {
  for (const a of AXES) target[a] += src[a] ?? 0;
}

export function consolidateCast(cast: AstralCast): AstralResult {
  const planet = PLANETS[cast.planet];
  const sign = SIGNS[cast.sign];
  const house = HOUSES[cast.planetHouse - 1];
  const aspect = aspectBetween(cast.planetHouse, cast.signHouse);

  const dims: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };
  addDims(dims, planet.dimensions);
  addDims(dims, ELEMENT_LEAN[sign.element]);
  addDims(dims, MODALITY_LEAN[sign.modality]);
  addDims(dims, ASPECT_EFFECT[aspect].dims);
  for (const a of AXES) dims[a] = clampDim(dims[a] / 2); // normalize so a single cast stays mid-scale

  // theme ranking: arena (house) → planet → aspect → sign element; cap 2, dedupe
  const ranked: ThemeTag[] = [house.theme, planet.theme];
  if (ASPECT_EFFECT[aspect].theme) ranked.push(ASPECT_EFFECT[aspect].theme!);
  ranked.push(ELEMENT_THEME[sign.element]);
  const themes = [...new Set(ranked)].slice(0, 2);

  const modifierRoles = [...new Set<ModifierRole>([planet.modifierRole])];

  const dignity = dignityOf(cast.planet, cast.sign);
  const tags: Tag[] = [
    'draw', 'random', 'astral',
    `planet-${cast.planet}`, `sign-${cast.sign}`, `house-${cast.planetHouse}`,
    `element-${sign.element}`, `aspect-${aspect}`,
    ...(dignity ? [dignity] : []),
    ...cast.omens,
  ];

  return {
    type: 'astral',
    id: `astral:${cast.planet}-${cast.sign}-h${cast.planetHouse}`,
    name: `${planet.name} in ${sign.name}`,
    symbol: planet.glyph,
    interpretation: `${planet.name} in ${sign.name}, in the House of ${house.arena} — ${planet.theme} meets its arena.`,
    planet: cast.planet, sign: cast.sign, house: cast.planetHouse, aspect,
    themes, dimensions: dims, modifierRoles, tags, cast,
  };
}
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Astromancy.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/astromancy.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): consolidateCast (dimensions/themes/tags/aspect/dignity)"
```

---

### Task 5: `drawAstralCast` (pure, affinity-biased generator)

**Files:**
- Modify: `src/data/astromancy.ts`
- Test: `src/engine/__tests__/Astromancy.test.ts`

**Interfaces:**
- Produces: `drawAstralCast(affinities): AstralCast`.

- [ ] **Step 1: Write the failing test:**

```ts
import { drawAstralCast, consolidateCast } from '../../data/astromancy';

describe('drawAstralCast', () => {
  it('produces a valid, consolidatable cast', () => {
    const c = drawAstralCast({ chaos: 0, order: 0 });
    expect(c.planetHouse).toBeGreaterThanOrEqual(1);
    expect(c.planetHouse).toBeLessThanOrEqual(12);
    expect(c.signHouse).toBeGreaterThanOrEqual(1);
    expect(c.signHouse).toBeLessThanOrEqual(12);
    expect(() => consolidateCast(c)).not.toThrow();
    expect(c.omens).toEqual([]);
  });
  it('order biases the two houses toward the same arena (tighter aspects)', () => {
    const orig = Math.random;
    try {
      // force the raw houses far apart; order should pull signHouse toward planetHouse
      let calls = 0;
      Math.random = () => { calls++; return calls === 3 ? 0.99 : 0.01; };
      const c = drawAstralCast({ order: 100, chaos: 0 });
      expect(Math.abs(c.planetHouse - c.signHouse)).toBeLessThanOrEqual(6);
    } finally { Math.random = orig; }
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Astromancy.test.ts -t "drawAstralCast"`. Expected: FAIL.

- [ ] **Step 3: Implement** — append to `src/data/astromancy.ts`:

```ts
const PLANET_IDS = Object.keys(PLANETS) as PlanetId[];
const SIGN_IDS = Object.keys(SIGNS) as SignId[];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const house = () => Math.floor(Math.random() * 12) + 1;

// Engine-side generator (no physics). Order tightens the two houses (calmer aspects);
// chaos widens them (more extreme aspects). Faces are uniform.
export function drawAstralCast(affinities: Record<string, number>): AstralCast {
  const order = (affinities.order ?? 0) / 100;
  const chaos = (affinities.chaos ?? 0) / 100;
  const planetHouse = house();
  let signHouse = house();
  if (order > chaos && Math.random() < order - chaos) {
    // pull signHouse toward planetHouse (smaller separation)
    const toward = planetHouse + (Math.random() < 0.5 ? 1 : -1);
    signHouse = ((toward + 11) % 12) + 1;
  } else if (chaos > order && Math.random() < chaos - order) {
    // push toward opposition
    signHouse = ((planetHouse + 5) % 12) + 1;
  }
  return { planet: pick(PLANET_IDS), planetHouse, sign: pick(SIGN_IDS), signHouse, omens: [] };
}
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/Astromancy.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/astromancy.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): drawAstralCast affinity-biased generator"
```

---

# Phase 2 — Engine registration + cast logic

### Task 6: Register `astral` in profiles + orchestrator

**Files:**
- Modify: `src/data/divination-profiles.ts`
- Modify: `src/engine/TurnOrchestrator.ts`
- Modify: `src/engine/GameEngine.ts` (widen two `as` casts to include `'astral'`)
- Test: `src/engine/__tests__/Astromancy.test.ts`

**Interfaces:**
- Produces: `DIVINATION_PROFILES.astral`; orchestrator pools/draws `astral`.

- [ ] **Step 1: Write the failing test:**

```ts
import { DIVINATION_PROFILES } from '../../data/divination-profiles';
import { TurnOrchestrator } from '../TurnOrchestrator';
import { EventBus } from '../EventBus';

describe('astral registration', () => {
  it('has a divination profile', () => {
    expect(DIVINATION_PROFILES.astral).toBeDefined();
    expect(DIVINATION_PROFILES.astral.type).toBe('astral');
  });
  it('orchestrator can draw an astral result', () => {
    const o = new TurnOrchestrator(new EventBus());
    const r = o.drawSingleResult('astral', { chaos: 0, order: 0 });
    expect(r.type).toBe('astral');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/Astromancy.test.ts -t "astral registration"`. Expected: FAIL.

- [ ] **Step 3: Implement:**
  - `src/data/divination-profiles.ts` — add to the record:

```ts
  astral: {
    type: 'astral',
    themeCoverage: 'all',
    themePool: ['authority', 'harmony', 'conflict', 'transformation', 'illumination', 'mystery', 'renewal', 'stagnation', 'upheaval', 'surrender'],
    dimensionStrengths: ['favorability', 'volatility', 'certainty'],
    modifierStrengths: ['subject', 'action', 'effect'],
  },
```

  - `src/engine/TurnOrchestrator.ts`:
    - Add the import: `import { consolidateCast, drawAstralCast } from '../data/astromancy';`
    - Change `const POOL_TYPES: DivinationType[] = ['tarot', 'd20', 'iching'];` to `['tarot', 'd20', 'iching', 'astral'];`
    - In `QUESTION_WEIGHTS`, add `astral` to each row: `decision: { d20: 3, tarot: 1, iching: 1, astral: 2 }`, `relationship: { tarot: 3, d20: 1, iching: 1, astral: 1 }`, `future: { iching: 3, tarot: 1, d20: 1, astral: 2 }`, `self: { tarot: 2, iching: 2, d20: 1, astral: 1 }`.
    - In `drawSingleResult`'s `switch`, add before `case 'happening'`:

```ts
      case 'astral':
        result = consolidateCast(drawAstralCast(affinities));
        break;
```

  - `src/engine/GameEngine.ts`:
    - Line ~267: change `draft.spawnSecond as 'tarot' | 'd20' | 'iching'` to `draft.spawnSecond as 'tarot' | 'd20' | 'iching' | 'astral'`.
    - Line ~299: change `result.type as 'tarot' | 'd20' | 'iching'` to `result.type as 'tarot' | 'd20' | 'iching' | 'astral'`.

- [ ] **Step 4: Run tests, verify pass** — `npm test` then `npm run build`. Expected: PASS; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/data/divination-profiles.ts src/engine/TurnOrchestrator.ts src/engine/GameEngine.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): register method in profiles + orchestrator"
```

---

### Task 7: `planAstralCast` (mode planning)

**Files:**
- Create: `src/engine/astral.ts`
- Test: `src/engine/__tests__/AstralCast.test.ts` (NEW)

**Interfaces:**
- Consumes: `bandOf`, `BAND_ORDER`, `BAND_POWER_STEP`, `TIER_BASE_CHANCE` from `../data/affinities` (all confirmed exported; `eligibility.ts` imports them the same way).
- Produces: `AstralCastMode`, `AFFINITY_ASTRAL_MODIFIERS`, `planAstralCast(affinities, offerRecast)`, `shouldOfferRecast(affinities, rng?)`.

- [ ] **Step 1: Write the failing test** — create `src/engine/__tests__/AstralCast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planAstralCast } from '../astral';

describe('planAstralCast', () => {
  it('is single by default', () => {
    const p = planAstralCast({ light: 50, shadow: 50, will: 50 }, false);
    expect(p.mode).toBe('single');
    expect(p.offerRecast).toBe(false);
  });
  it('Light ascendant → favored', () => {
    expect(planAstralCast({ light: 70 }, false).mode).toBe('favored');
  });
  it('Shadow ascendant → clouded', () => {
    expect(planAstralCast({ shadow: 70 }, false).mode).toBe('clouded');
  });
  it('Will dominant → choice, and choice suppresses recast', () => {
    const p = planAstralCast({ will: 95 }, true);
    expect(p.mode).toBe('choice');
    expect(p.offerRecast).toBe(false);
  });
  it('offerRecast passes through outside choice mode', () => {
    expect(planAstralCast({}, true).offerRecast).toBe(true);
  });
});

describe('shouldOfferRecast', () => {
  it('never offers below Will Stirring', () => {
    expect(shouldOfferRecast({ will: 10 }, () => 0)).toBe(false);
  });
  it('offers at Will Stirring+ when the roll passes', () => {
    expect(shouldOfferRecast({ will: 45 }, () => 0)).toBe(true);   // stirring band, rng 0 < chance
    expect(shouldOfferRecast({ will: 45 }, () => 0.99)).toBe(false); // roll fails
  });
});
```

> Add `shouldOfferRecast` to the import: `import { planAstralCast, shouldOfferRecast } from '../astral';`. Band cutoffs come from `bandOf` in `src/data/affinities.ts` — if `will: 45` is not Stirring there, use a value that is (read `bandOf`'s thresholds).

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/AstralCast.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — create `src/engine/astral.ts`:

```ts
import type { AffinityBand, AffinityId } from './types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE } from '../data/affinities';

export type AstralCastMode = 'single' | 'favored' | 'clouded' | 'choice';

interface AstralModifier { affinity: AffinityId; minBand: AffinityBand; mode: Exclude<AstralCastMode, 'single'>; source: string; }

export const AFFINITY_ASTRAL_MODIFIERS: AstralModifier[] = [
  { affinity: 'will',   minBand: 'dominant',  mode: 'choice',  source: 'Your will seizes the cast' },
  { affinity: 'light',  minBand: 'ascendant', mode: 'favored', source: 'Light favors the heavens' },
  { affinity: 'shadow', minBand: 'ascendant', mode: 'clouded', source: 'Shadow clouds the chart' },
];

const atLeast = (value: number, band: AffinityBand) =>
  BAND_ORDER.indexOf(bandOf(value)) >= BAND_ORDER.indexOf(band);

export function planAstralCast(
  affinities: Record<string, number>,
  offerRecast: boolean,
): { mode: AstralCastMode; offerRecast: boolean; sources: string[] } {
  const sources: string[] = [];
  let mode: AstralCastMode = 'single';
  for (const m of AFFINITY_ASTRAL_MODIFIERS) {
    if (atLeast(affinities[m.affinity] ?? 0, m.minBand)) {
      // choice wins over favored/clouded; first matching choice locks it
      if (m.mode === 'choice') { mode = 'choice'; sources.push(m.source); break; }
      if (mode === 'single') { mode = m.mode; sources.push(m.source); }
    }
  }
  return { mode, offerRecast: mode === 'choice' ? false : offerRecast, sources };
}

// Probabilistic offer-recast (Will). Replicates bandRoll(c,'will','stirring',T.notable)
// exactly, so balance matches the legacy offered-reroll without depending on the
// dice:roll dispatch or dice-modifiers.ts.
export function shouldOfferRecast(affinities: Record<string, number>, rng: () => number = Math.random): boolean {
  const idx = BAND_ORDER.indexOf(bandOf(affinities.will ?? 0));
  const minIdx = BAND_ORDER.indexOf('stirring');
  if (idx < minIdx) return false;
  const scaled = TIER_BASE_CHANCE.notable * (1 + (idx - minIdx) * BAND_POWER_STEP);
  return rng() < Math.min(1, scaled);
}
```

> `AffinityId` and `AffinityBand` are confirmed exported from `src/engine/types.ts` (lines 4 and 12). `BAND_ORDER`, `bandOf`, `BAND_POWER_STEP`, and `TIER_BASE_CHANCE` are confirmed exported from `src/data/affinities.ts`.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AstralCast.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/astral.ts src/engine/__tests__/AstralCast.test.ts
git commit -m "feat(astral): planAstralCast mode planning"
```

---

### Task 8: `resolveCastSelection`

**Files:**
- Modify: `src/engine/astral.ts`
- Test: `src/engine/__tests__/AstralCast.test.ts`

**Interfaces:**
- Consumes: `consolidateCast` from `../data/astromancy`.
- Produces: `resolveCastSelection(casts, mode)`.

- [ ] **Step 1: Write the failing test:**

```ts
import { resolveCastSelection } from '../astral';
import type { AstralCast } from '../types';

const fav = (planet: AstralCast['planet']): AstralCast =>
  ({ planet, planetHouse: 1, sign: 'leo', signHouse: 5, omens: [] }); // trine

describe('resolveCastSelection', () => {
  const benefic = fav('venus');   // high favorability
  const malefic = fav('mars');    // low favorability
  it('favored keeps the more auspicious cast', () => {
    const { chosen, auto } = resolveCastSelection([malefic, benefic], 'favored');
    expect(chosen.planet).toBe('venus');
    expect(auto).toBe(true);
  });
  it('clouded keeps the less auspicious cast', () => {
    expect(resolveCastSelection([benefic, malefic], 'clouded').chosen.planet).toBe('mars');
  });
  it('choice does not auto-pick (auto=false), defaults to index 0', () => {
    const { auto, index } = resolveCastSelection([benefic, malefic], 'choice');
    expect(auto).toBe(false);
    expect(index).toBe(0);
  });
  it('single returns the only cast', () => {
    expect(resolveCastSelection([benefic], 'single').chosen.planet).toBe('venus');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/AstralCast.test.ts -t "resolveCastSelection"`. Expected: FAIL.

- [ ] **Step 3: Implement** — append to `src/engine/astral.ts`:

```ts
import type { AstralCast } from './types';
import { consolidateCast } from '../data/astromancy';

const HARMONY_RANK: Record<string, number> = { trine: 2, sextile: 1, conjunction: 0, minor: -1, square: -2, opposition: -2 };

export function resolveCastSelection(
  casts: AstralCast[],
  mode: AstralCastMode,
): { chosen: AstralCast; index: 0 | 1; auto: boolean } {
  if (mode === 'single' || casts.length === 1) return { chosen: casts[0], index: 0, auto: true };
  if (mode === 'choice') return { chosen: casts[0], index: 0, auto: false };

  const score = (c: AstralCast) => {
    const r = consolidateCast(c);
    return r.dimensions.favorability * 10 + (HARMONY_RANK[r.aspect] ?? 0);
  };
  const s0 = score(casts[0]);
  const s1 = score(casts[1]);
  const keepFirst = mode === 'favored' ? s0 >= s1 : s0 <= s1;
  return keepFirst
    ? { chosen: casts[0], index: 0, auto: true }
    : { chosen: casts[1], index: 1, auto: true };
}
```

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AstralCast.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/astral.ts src/engine/__tests__/AstralCast.test.ts
git commit -m "feat(astral): resolveCastSelection (favored/clouded/choice)"
```

---

### Task 9: GameEngine façade methods for the cast

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces on `GameEngine`: `planAstralCast(): { mode; offerRecast; sources }`, `resolveCastSelection(casts, mode)`.

- [ ] **Step 1: Write the failing test** — add to `src/engine/__tests__/GameEngine.test.ts`:

```ts
import { GameEngine } from '../GameEngine';
import { drawAstralCast } from '../../data/astromancy';

describe('astral cast façade', () => {
  it('planAstralCast returns single when dormant', () => {
    const e = new GameEngine();
    e.startTurn('self');
    expect(e.planAstralCast().mode).toBe('single');
  });
  it('resolveCastSelection delegates to the pure selector', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const a = drawAstralCast({}); const b = drawAstralCast({});
    const { chosen } = e.resolveCastSelection([a, b], 'single');
    expect(chosen).toBe(a);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "astral cast façade"`. Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/engine/GameEngine.ts`:
  - Add imports: `import { planAstralCast, resolveCastSelection, shouldOfferRecast } from './astral'; import type { AstralCastMode } from './astral';` and add `AstralCast` to the existing `import type { … } from './types';` line (don't duplicate the import).
  - Add these methods near `planDiceRoll()`:

```ts
planAstralCast(): { mode: AstralCastMode; offerRecast: boolean; sources: string[] } {
  const affinities = this.affinityEngine.getState();
  return planAstralCast(affinities, shouldOfferRecast(affinities));
}

resolveCastSelection(casts: AstralCast[], mode: AstralCastMode): { chosen: AstralCast; index: 0 | 1; auto: boolean } {
  return resolveCastSelection(casts, mode);
}
```

> `shouldOfferRecast` (Task 7) reproduces the legacy offered-reroll chance (Will Stirring, `notable` tier) without touching the dice `dice:roll` dispatch — astral stays self-contained, so removing d20 later cannot break it.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/GameEngine.test.ts` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(astral): GameEngine cast planning/selection façade"
```

---

# Phase 3 — Symbolic-resonance + omen responders

### Task 10: Symbolic-resonance responders

**Files:**
- Create: `src/engine/responders/astral.ts`
- Modify: `src/engine/GameEngine.ts` (register the builder)
- Test: `src/engine/__tests__/AstralResponders.test.ts` (NEW)

**Interfaces:**
- Consumes: `Responder`, `EffectReport`, `PhaseContext`, `AstralResult`.
- Produces: `buildAstralResponders(): Responder[]` with ids `astral-dignity`, `astral-debility`, `astral-great-trine`, `astral-duel`, `astral-saturns-gate`.

- [ ] **Step 1: Write the failing test** — create `src/engine/__tests__/AstralResponders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildAstralResponders } from '../responders/astral';
import { consolidateCast } from '../../data/astromancy';
import type { PhaseContext } from '../events/types';
import type { AstralCast } from '../types';

const ctx = (cast: AstralCast): PhaseContext => ({
  trigger: 'astral:commit',
  affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
  slots: [], hand: null, spread: [], minigame: null, event: null,
  draft: { outcome: consolidateCast(cast) }, rng: () => 0,
});
const R = (id: string) => buildAstralResponders().find((r) => r.id === id)!;
const cast = (o: Partial<AstralCast>): AstralCast => ({ planet: 'mars', planetHouse: 7, sign: 'aries', signHouse: 7, omens: [], ...o });

describe('astral symbolic responders', () => {
  it('dignity fires for a dignified planet (Mars in Aries) and amplifies a dimension', () => {
    const c = ctx(cast({ sign: 'aries' }));
    const r = R('astral-dignity');
    expect(r.condition(c)).toBe(true);
    const before = { ...(c.draft.outcome as any).dimensions };
    r.apply(c);
    const after = (c.draft.outcome as any).dimensions;
    const changed = (['favorability','certainty','volatility'] as const).some((a) => after[a] !== before[a]);
    expect(changed).toBe(true);
  });
  it('debility fires for Mars in Libra and not for a dignified cast', () => {
    expect(R('astral-debility').condition(ctx(cast({ sign: 'libra' })))).toBe(true);
    expect(R('astral-debility').condition(ctx(cast({ sign: 'aries' })))).toBe(false);
  });
  it('great-trine fires for a benefic at trine', () => {
    // Venus, planetHouse 1 vs signHouse 5 = trine
    expect(R('astral-great-trine').condition(ctx(cast({ planet: 'venus', planetHouse: 1, signHouse: 5 })))).toBe(true);
  });
  it('duel fires for Mars at opposition', () => {
    expect(R('astral-duel').condition(ctx(cast({ planet: 'mars', planetHouse: 1, signHouse: 7 })))).toBe(true);
  });
  it("saturn's gate fires for Saturn in house 10", () => {
    expect(R('astral-saturns-gate').condition(ctx(cast({ planet: 'saturn', planetHouse: 10 })))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/AstralResponders.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** — create `src/engine/responders/astral.ts`:

```ts
import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AstralResult, DimensionValues } from '../types';

const out = (c: PhaseContext) => (c.draft.outcome?.type === 'astral' ? (c.draft.outcome as AstralResult) : null);
const has = (c: PhaseContext, tag: string) => !!out(c)?.tags.includes(tag);
const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}
function bump(r: AstralResult, axis: keyof DimensionValues, by: number) {
  r.dimensions[axis] = clamp(r.dimensions[axis] + by);
}

export function buildAstralResponders(): Responder[] {
  return [
    {
      id: 'astral-dignity', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'dignified'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; const axis = dominantAxis(r.dimensions);
        bump(r, axis, Math.sign(r.dimensions[axis] || 1) * 0.5);
        return report('astral-dignity', 'Dignity', 'The planet sits enthroned in its own sign — its nature redoubles.', 'override');
      },
    },
    {
      id: 'astral-debility', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'debilitated'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'favorability', -0.5); bump(r, 'volatility', 0.5);
        return report('astral-debility', 'Debility', 'The planet languishes in a hostile sign — its strength curdles.', 'shroud');
      },
    },
    {
      id: 'astral-great-trine', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'aspect-trine') && (has(c, 'planet-jupiter') || has(c, 'planet-venus')),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'favorability', 1.0);
        if (!r.themes.includes('harmony')) r.themes = [...r.themes.slice(0, 1), 'harmony'];
        return report('astral-great-trine', 'The Great Trine', 'The benefic flows in perfect trine — fortune pours through the chart.', 'add-choice');
      },
    },
    {
      id: 'astral-duel', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'planet-mars') && (has(c, 'aspect-square') || has(c, 'aspect-opposition')),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'volatility', 1.0); bump(r, 'favorability', -0.5);
        if (!r.themes.includes('conflict')) r.themes = ['conflict', ...r.themes].slice(0, 2);
        return report('astral-duel', 'The Duel', 'Mars strikes across a hard angle — the cast turns to open conflict.', 'flip');
      },
    },
    {
      id: 'astral-saturns-gate', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'planet-saturn') && (has(c, 'house-1') || has(c, 'house-10')),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'certainty', 1.0); bump(r, 'favorability', -0.5);
        if (!r.themes.includes('authority')) r.themes = ['authority', ...r.themes].slice(0, 2);
        return report('astral-saturns-gate', "Saturn's Gate", 'Saturn guards the angle — the way forward exacts its toll.', 'override');
      },
    },
  ];
}
```

> The `band: 'MUTATE'` group means only one symbolic responder wins per commit (a weighted exclusive band) — correct, since these mutate the same `outcome`. Animation keys reuse existing `InteractionSequencer` animations (`override`, `shroud`, `add-choice`, `flip`); bespoke astral animations are optional later polish.

  - In `src/engine/GameEngine.ts`, add the import `import { buildAstralResponders } from './responders/astral';` and extend line 40:
    `this.responders = [...buildAffinityResponders(), ...buildInteractionResponders(), ...buildAstralResponders()];`

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AstralResponders.test.ts` and `npm test` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/astral.ts src/engine/GameEngine.ts src/engine/__tests__/AstralResponders.test.ts
git commit -m "feat(astral): symbolic-resonance responders (dignity/debility/trine/duel/gate)"
```

---

### Task 11: Omen responders

**Files:**
- Modify: `src/engine/responders/astral.ts`
- Test: `src/engine/__tests__/AstralResponders.test.ts`

**Interfaces:**
- Produces: responder ids `astral-errant-star` (SPAWN), `astral-conjunction-crowned` (MUTATE), `astral-veiled-oracle` (MUTATE).

- [ ] **Step 1: Write the failing test** — append to `src/engine/__tests__/AstralResponders.test.ts`:

```ts
describe('astral omen responders', () => {
  it('errant-star fires on the off-board omen and spawns a second cast', () => {
    const c = ctx(cast({ omens: ['errant-star'] }));
    const r = R('astral-errant-star');
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('astral');
  });
  it('conjunction-crowned fires only with the omen tag', () => {
    expect(R('astral-conjunction-crowned').condition(ctx(cast({ omens: ['crowned-conjunction'] })))).toBe(true);
    expect(R('astral-conjunction-crowned').condition(ctx(cast({ omens: [] })))).toBe(false);
  });
  it('veiled-oracle fires on the cocked-die omen', () => {
    expect(R('astral-veiled-oracle').condition(ctx(cast({ omens: ['veiled-oracle'] })))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/AstralResponders.test.ts -t "omen"`. Expected: FAIL.

- [ ] **Step 3: Implement** — add these to the array returned by `buildAstralResponders()` in `src/engine/responders/astral.ts`:

```ts
    {
      id: 'astral-errant-star', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 1,
      condition: (c) => has(c, 'errant-star'),
      roll: () => true,
      apply: (c) => {
        c.draft.spawnSecond = 'astral';
        return report('astral-errant-star', 'The Errant Star', 'A die flees the chart entirely — a force beyond the heavens answers.', 'second-result');
      },
    },
    {
      id: 'astral-conjunction-crowned', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 2,
      condition: (c) => has(c, 'crowned-conjunction'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; const axis = dominantAxis(r.dimensions);
        bump(r, axis, Math.sign(r.dimensions[axis] || 1) * 1.0);
        return report('astral-conjunction-crowned', 'Conjunction Crowned', 'The dice rest as one — their union blazes past all measure.', 'override');
      },
    },
    {
      id: 'astral-veiled-oracle', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'veiled-oracle'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'certainty', -1.0);
        if (!r.themes.includes('mystery')) r.themes = [...r.themes.slice(0, 1), 'mystery'];
        return report('astral-veiled-oracle', 'The Veiled Oracle', 'A die rests askew — the reading keeps its secret.', 'shroud');
      },
    },
```

> `astral-conjunction-crowned` has `weight: 2` so within the MUTATE band it outweighs `astral-dignity` when both could match (a crowned conjunction is the louder omen). `astral-errant-star` is in the SPAWN band, so it can co-occur with a MUTATE winner.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/AstralResponders.test.ts` and `npm test` then `npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/astral.ts src/engine/__tests__/AstralResponders.test.ts
git commit -m "feat(astral): omen responders (errant-star/crowned/veiled)"
```

---

### Task 12: Debug scenarios

**Files:**
- Modify: `src/engine/events/scenarios.ts`
- Test: build-verified + spot-checked via existing scenario tests if present

**Interfaces:**
- Consumes: `DEBUG_SCENARIOS` structure (follow the existing entries verbatim).

- [ ] **Step 1: Read the existing file** — open `src/engine/events/scenarios.ts` and copy the exact shape of two existing entries (one affinity-band scenario and one interaction scenario), including how they stage `questionType`, the method pool, affinity levels, and `forced`/`isolate`. The new entries MUST mirror that shape.

- [ ] **Step 2: Add scenarios** — append entries to `DEBUG_SCENARIOS` following that exact shape, one per new responder. Each must stage the precondition its `condition` needs (per the forced≠unconditional rule):
  - `astral-dignity` — a committed `astral` slot whose cast is Mars-in-Aries (tag `dignified`), `forced: ['astral-dignity']`.
  - `astral-debility` — Mars-in-Libra (`debilitated`), `forced: ['astral-debility']`.
  - `astral-great-trine` — Venus, planetHouse 1 / signHouse 5 (`aspect-trine`, `planet-venus`), `forced: ['astral-great-trine']`.
  - `astral-duel` — Mars, planetHouse 1 / signHouse 7 (`aspect-opposition`), `forced: ['astral-duel']`.
  - `astral-saturns-gate` — Saturn, planetHouse 10, `forced: ['astral-saturns-gate']`.
  - `astral-errant-star` — cast with `omens: ['errant-star']`, `forced: ['astral-errant-star']`.
  - `astral-conjunction-crowned` — `omens: ['crowned-conjunction']`, `forced: ['astral-conjunction-crowned']`.
  - `astral-veiled-oracle` — `omens: ['veiled-oracle']`, `forced: ['astral-veiled-oracle']`.

  Build each staged `astral` slot with `consolidateCast(<AstralCast>)` (import from `../../data/astromancy`), exactly how existing scenarios build their staged slots.

- [ ] **Step 3: Verify** — `npm test` then `npm run build`. Expected: PASS; build clean. If a scenario test enumerates scenarios, ensure the new ids are unique.

- [ ] **Step 4: Commit**

```bash
git add src/engine/events/scenarios.ts
git commit -m "feat(astral): debug scenarios for symbolic + omen responders"
```

---

# Phase 4 — Physics component + UI (build-verified)

> Per CLAUDE.md there are no component tests; these tasks verify with `npm run build`. Each task still ends with a commit.

### Task 13: Add matter.js + `AstralSigil` glyphs

**Files:**
- Modify: `package.json` (add `matter.js` + `@types/matter-js`)
- Create: `src/components/cards/AstralSigil.tsx`

**Interfaces:**
- Produces: `<AstralSigil kind="planet"|"sign"|"house" id={...} size={n} />` rendering the glyph from `PLANETS`/`SIGNS`/`HOUSES`.

- [ ] **Step 1: Install deps**

```bash
npm install matter-js
npm install -D @types/matter-js
```

- [ ] **Step 2: Create the sigil component** — `src/components/cards/AstralSigil.tsx`:

```tsx
import { PLANETS, SIGNS } from '../../data/astromancy';
import type { PlanetId, SignId } from '../../engine/types';

type Props =
  | { kind: 'planet'; id: PlanetId; size?: number }
  | { kind: 'sign'; id: SignId; size?: number }
  | { kind: 'house'; id: number; size?: number };

export default function AstralSigil(props: Props) {
  const size = props.size ?? 32;
  const glyph =
    props.kind === 'planet' ? PLANETS[props.id].glyph
    : props.kind === 'sign' ? SIGNS[props.id].glyph
    : String(props.id);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, fontSize: size * 0.7, color: '#d4a854',
        fontFamily: "'Cormorant Garamond', serif", lineHeight: 1,
      }}
      aria-label={props.kind === 'house' ? `House ${props.id}` : props.id}
    >
      {glyph}
    </span>
  );
}
```

- [ ] **Step 3: Verify** — `npm run build`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/cards/AstralSigil.tsx
git commit -m "feat(astral): add matter.js + AstralSigil glyph component"
```

---

### Task 14: `CelestialCast` physics component

**Files:**
- Create: `src/components/screens/CelestialCast.tsx`

**Interfaces:**
- Consumes: `matter-js`, `drawAstralCast`, `AstralSigil`.
- Produces: `<CelestialCast affinities={...} faces={AstralCast} onSettled={(cast: AstralCast) => void} />` — runs a 2D physics throw, lands the two dice in houses, reveals the drawn faces, and reports the resolved `AstralCast` (with computed `planetHouse`/`signHouse` and any `omens`).

- [ ] **Step 1: Create the component** — `src/components/screens/CelestialCast.tsx`. Responsibilities (single file, focused):
  - A circular **house board**: a Matter world with a ring of static wall bodies forming a bowl, plus 12 sector boundaries used only for the position→house read (not physical walls).
  - Two **die bodies** (the Planet die and the Sign die), launched on mount with an impulse + spin.
  - **Affinity-as-force:** before launch, scale the launch impulse jitter by `affinities.chaos` (more scatter) and add a centre-seeking force each tick scaled by `affinities.order`; apply a small constant lateral force from `affinities.light`/`affinities.shadow`.
  - **Settle detection:** when both bodies are near-stationary (speed < ε for N consecutive ticks) or a max-time cap elapses, stop the world.
  - **Read:** `house = sectorOf(angle(body.position - center))` (1..12). Compute `omens`: a body whose distance from centre exceeds the board radius → `errant-star`; the two bodies overlapping (`Matter.Bounds`/distance < sumRadii) → `crowned-conjunction`; a body still rotating past the cap → `veiled-oracle`.
  - **Faces:** use the `faces` prop (the drawn `AstralCast` from `drawAstralCast`) for `planet`/`sign`; render the glyph on each die via `<AstralSigil>` and reveal on settle. Emit `onSettled({ planet: faces.planet, sign: faces.sign, planetHouse, signHouse, omens })`.

  A concrete skeleton (fill geometry constants to taste; keep all matter-js imports in this file only):

```tsx
import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import type { AstralCast, OmenTag } from '../../engine/types';

interface Props {
  affinities: Record<string, number>;
  faces: AstralCast;                       // drawn planet/sign to display
  onSettled: (cast: AstralCast) => void;
}

const SIZE = 360, R = 150, CENTER = { x: SIZE / 2, y: SIZE / 2 };
const sectorOf = (x: number, y: number) => {
  const a = Math.atan2(y - CENTER.y, x - CENTER.x);          // -π..π
  const t = (a + Math.PI * 2.5) % (Math.PI * 2);             // rotate so 0 = top
  return (Math.floor(t / (Math.PI / 6)) % 12) + 1;           // 1..12
};

export default function CelestialCast({ affinities, faces, onSettled }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const engine = Matter.Engine.create();
    engine.gravity.y = 0;                                     // top-down
    const world = engine.world;
    // bowl walls (ring approximated by 24 short static segments)
    const walls = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return Matter.Bodies.rectangle(CENTER.x + Math.cos(a) * (R + 16), CENTER.y + Math.sin(a) * (R + 16), 8, 44, { isStatic: true, angle: a });
    });
    const chaos = (affinities.chaos ?? 0) / 100, order = (affinities.order ?? 0) / 100;
    const mk = (dx: number) => {
      const b = Matter.Bodies.circle(CENTER.x + dx, CENTER.y - R * 0.7, 22, { restitution: 0.6, frictionAir: 0.02 });
      Matter.Body.setVelocity(b, { x: (Math.random() - 0.5) * (6 + chaos * 14), y: 6 + Math.random() * 4 });
      Matter.Body.setAngularVelocity(b, (Math.random() - 0.5) * (0.4 + chaos));
      return b;
    };
    const planetBody = mk(-26), signBody = mk(26);
    Matter.Composite.add(world, [...walls, planetBody, signBody]);

    let still = 0, ticks = 0, raf = 0;
    const center = (b: Matter.Body, k: number) =>
      Matter.Body.applyForce(b, b.position, { x: (CENTER.x - b.position.x) * k, y: (CENTER.y - b.position.y) * k });
    const step = () => {
      ticks++;
      center(planetBody, 0.00002 * order); center(signBody, 0.00002 * order);
      Matter.Engine.update(engine, 1000 / 60);
      const speed = planetBody.speed + signBody.speed;
      still = speed < 0.4 ? still + 1 : 0;
      if (still > 30 || ticks > 600) { finish(); return; }
      raf = requestAnimationFrame(step);
    };
    const finish = () => {
      const dist = (b: Matter.Body) => Math.hypot(b.position.x - CENTER.x, b.position.y - CENTER.y);
      const omens: OmenTag[] = [];
      if (dist(planetBody) > R || dist(signBody) > R) omens.push('errant-star');
      if (Math.hypot(planetBody.position.x - signBody.position.x, planetBody.position.y - signBody.position.y) < 46) omens.push('crowned-conjunction');
      if (ticks > 600) omens.push('veiled-oracle');
      setSettled(true);
      onSettled({
        planet: faces.planet, sign: faces.sign,
        planetHouse: sectorOf(planetBody.position.x, planetBody.position.y),
        signHouse: sectorOf(signBody.position.x, signBody.position.y),
        omens,
      });
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Minimal visual: a canvas/host the renderer draws into, plus the wheel.
  // (Render the board ring + revealed glyphs here; matter-js Render optional.)
  return <div ref={hostRef} style={{ width: SIZE, height: SIZE, position: 'relative' }} data-settled={settled} />;
}
```

> The visual fidelity (board ring art, die meshes, glyph reveal) is presentation polish — extend the render inside this file. The contract that matters for the rest of the system is `onSettled(AstralCast)`. Keep ALL matter-js usage inside this component.

- [ ] **Step 2: Verify** — `npm run build`. Expected: clean (resolve any `@types/matter-js` strictness; `Matter.Body.speed` is a number).

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/CelestialCast.tsx
git commit -m "feat(astral): CelestialCast 2D-physics throw component"
```

---

### Task 15: `AstralMinigame` + wire into `GameTable` + display branches

**Files:**
- Create: `src/components/screens/AstralMinigame.tsx`
- Modify: `src/components/screens/GameTable.tsx`
- Modify: `src/components/screens/ResultReading.tsx`
- Modify: `src/components/overlays/HistoryTiles.tsx`

**Interfaces:**
- Consumes: `useGameEngine`, `drawAstralCast`, `consolidateCast`, `CelestialCast`, `planAstralCast`/`resolveCastSelection` façade.

- [ ] **Step 1: Create `AstralMinigame`** — `src/components/screens/AstralMinigame.tsx`. Mirror `DiceMinigame`'s *structure* (a separate file — do not import or edit `DiceMinigame`):
  - On throw: `const plan = engine.planAstralCast();`
  - Generate `faces` for each needed cast via `drawAstralCast(state.affinities)` (one for `single`; two for `favored`/`clouded`/`choice`).
  - Render `<CelestialCast>` per cast; collect each `onSettled` `AstralCast`.
  - `single`: consolidate the one cast → `engine.completeMinigame(consolidateCast(cast), { revealedAsDrawn: true })` after a reveal beat.
  - `favored`/`clouded`: after both settle, `const { chosen } = engine.resolveCastSelection([a, b], plan.mode);` → commit `consolidateCast(chosen)` with `{ revealedAsDrawn: true }`.
  - `choice`: show both consolidated readings; the player taps one → commit with `{ viaReroll: true }` (Will).
  - If `plan.offerRecast` (non-choice modes): after the settle, show **Keep / Re-cast**. Keep → `{ revealedAsDrawn: true }`; Re-cast → re-run the throw, then commit with `{ viaReroll: true }`.
  - Honor veiled state: when `state.affinityEffects.poolPreview === 'hidden'`, withhold the interpretation/aspect text until commit (mirror the dice/I Ching veiled rule).
  - Guard against double-commit with a `committedRef` (as `DiceMinigame` does) and keep a reveal-delay before transitioning.
  - After commit, prefer the engine slot for display: `state.activeSlotIndex !== null ? state.turnResults[state.activeSlotIndex] : local` so responder mutations show.

- [ ] **Step 2: Wire `GameTable`** — in `src/components/screens/GameTable.tsx`:
  - Add `import AstralMinigame from './AstralMinigame';`
  - In the method `switch`, after the `case 'd20'` block, add:

```tsx
      case 'astral':
        return <AstralMinigame key="astral-minigame" />;
```

- [ ] **Step 3: Add display branches** — additive only (do not change d20/tarot/iching branches):
  - `src/components/screens/ResultReading.tsx` — where it narrows the slot `type` to render a result, add a `case 'astral'` / `result.type === 'astral'` branch showing `<AstralSigil kind="planet" id={result.planet} />`, the `name`, "in the House of …", the `aspect`, and `interpretation` (respecting veiled).
  - `src/components/overlays/HistoryTiles.tsx` — add an `astral` branch rendering `result.symbol` (the planet glyph) like the other tiles use their symbols.

- [ ] **Step 4: Verify** — `npm run build`. Expected: clean, **including any previously non-exhaustive `SlotResult` switches now satisfied**. Manually run `npm run dev` and cast the new method via the debug panel if available.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/AstralMinigame.tsx src/components/screens/GameTable.tsx src/components/screens/ResultReading.tsx src/components/overlays/HistoryTiles.tsx
git commit -m "feat(astral): AstralMinigame + GameTable wiring + result/history display"
```

---

# Phase 5 — Documentation

### Task 16: Update game-systems.md + README

**Files:**
- Modify: `docs/game-systems.md`
- Modify: `README.md`

- [ ] **Step 1: game-systems.md** — add an **Astromancy** section documenting: the cast (Planet die + Sign die on a 12-house board), the four signals (planet/sign/house/aspect) and their data tables, the cast modes (single/favored/clouded/choice + offer-recast) and which affinity confers each, and the symbolic-resonance + omen responder catalogue (id → trigger condition → effect), mirroring how the existing affinity/interaction catalogue is written.

- [ ] **Step 2: README** — add astromancy to the methods/rule-tables section (player-facing): what the dice are, how to read Planet-in-Sign-in-House, aspects, and the named resonances/omens.

- [ ] **Step 3: Verify** — `npm run build` and `npm test` (docs-only, should remain green).

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(astral): document astromancy method, responders, and cast modes"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** cast/4-signals (Tasks 2–4) · physics-in-React + pure consolidate split (Tasks 4, 13–15) · new `AstralResult` union member, no d20 reuse (Task 1) · affinity-as-force (Task 14) · drawAstralCast for spawns (Task 5) · registration/profile/orchestrator (Task 6) · reshaped modes favored/clouded/choice/offer-recast (Tasks 7–9) · specific symbolic resonances + omens as named responders (Tasks 10–11) · debug scenarios (Task 12) · 2D matter.js renderer with bounce/roll (Tasks 13–14) · sigils + display (Tasks 13, 15) · docs (Task 16). Future-methods appendix is spec-only (no task) — intentional.

**Placeholder scan:** no `TBD`/`TODO`; component tasks carry concrete skeletons and are build-verified per CLAUDE.md; scenario task (12) instructs copying the verified in-repo shape rather than inventing one, because that file's exact entry schema must match existing entries.

**Type consistency:** `AstralCast`/`AstralResult`/`AstralCastMode`/`PlanetId`/`SignId`/`OmenTag`/`AspectName` used identically across tasks; `consolidateCast`/`drawAstralCast`/`aspectBetween`/`planAstralCast`/`resolveCastSelection`/`buildAstralResponders` signatures match their definitions; responder ids referenced in scenarios (Task 12) match Tasks 10–11; commit trigger `astral:commit` is the value `completeMinigame` auto-derives from `result.type === 'astral'` (no engine trigger change needed).

**Resolved during authoring:** (a) `AffinityBand`/`AffinityId` confirmed exported from `src/engine/types.ts`; `BAND_ORDER`/`bandOf`/`BAND_POWER_STEP`/`TIER_BASE_CHANCE` from `src/data/affinities.ts`. (b) There is no `offerReroll()` helper — the legacy offered-reroll is `bandRoll(c,'will','stirring',T.notable)` inside the `dice:roll` dispatch; Task 7's `shouldOfferRecast` reproduces that exact chance for astral standalone, and Task 9 uses it. (c) `astral:commit` is auto-derived by `completeMinigame` from `result.type === 'astral'` — no engine trigger change needed.

**Open verification points for the implementer (flagged, not blocking):** confirm exactly which `ResultReading`/`HistoryTiles` branches narrow on `type` (Task 15) and confirm `bandOf`'s Stirring threshold for the `shouldOfferRecast` test value (Task 7) — both noted inline in their tasks.
