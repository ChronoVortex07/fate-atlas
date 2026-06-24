# Rune Casting Minigame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth divination minigame — Rune Casting — where the player flings rune-stones onto a concentric cloth and the scatter resolves into one governing `RuneResult`, with Fate drifting the throw and Will honoring the aim.

**Architecture:** Pure data/logic in `src/data/runes.ts` (rune dataset, scatter fall, consolidation) and `src/engine/runes.ts` (plan modes, governing resolution) — framework-free, fully unit-tested. Tag-matched meta-interactions in `src/engine/responders/runes.ts`. A React screen (`RuneMinigame.tsx`) drives the aim-fling gesture with lightweight 2D Framer-Motion springs, mirroring `AstralMinigame`. Everything plugs into the existing one-`SlotResult`-per-minigame machinery.

**Tech Stack:** React 18 + TypeScript (strict) + Vite, Framer Motion, Vitest (engine tests only), `react-icons/gi`.

## Global Constraints

- **Engine purity:** `src/data/**` and `src/engine/**` import zero React/DOM. (CLAUDE.md)
- **Snapshot contract:** every `GameEngine` mutator ends with `notify()`.
- **Strict TS:** `noUnusedLocals` + `noUnusedParameters` on — no dead code; `npm run build` must pass.
- **Tests:** Vitest runs **only** `src/engine/__tests__/**` (Node env). Tests for data-layer code live there and import from `../../data/*`. Stub `Math.random` for any randomness assertion.
- **Dimensions:** `favorability`/`certainty`/`volatility`, each clamped to `[-2, 2]` at 0.5 granularity via the shared `clampDim` pattern (`max(-2, min(2, round(v*2)/2))`).
- **Palette/fonts:** bg `#070b14`/`#0d1220`, gold `#d4a854`, blue `#7b9ec7`, purple `#9b6bb0`, green `#5b8c5a`; Cormorant Garamond (serif/headings), Inter (labels).
- **Docs sync:** changes to affinities/responders/interactions require updating `docs/game-systems.md` + `README.md` (Task 12).
- **Commit trailer:** end commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Create:**
- `src/data/runes.ts` — `RuneDef`, `RUNES` (24), aettir, `RING_BOUNDS`/`ringOf`, `resolveScatter`, `drawRuneScatter`, `consolidateScatter`, `stoneBrightness`.
- `src/engine/runes.ts` — `RuneCastMode`, `planRuneCast`, `resolveGoverning`, `shouldOfferRecast`.
- `src/engine/responders/runes.ts` — `buildRuneResponders()`.
- `src/components/cards/RuneSigil.tsx` — reusable stone face (upright/merkstave/silent).
- `src/components/screens/runic/cloth.ts` — concentric-ring SVG geometry + decorations.
- `src/components/screens/runic/runeArt.ts` — per-rune glyph metadata for rendering.
- `src/components/screens/runic/scatter.ts` — aim→target geometry + tumble-spring helpers (wraps `resolveScatter`).
- `src/components/screens/RuneMinigame.tsx` — the screen + phase machine.
- Tests: `src/engine/__tests__/Runes.test.ts`, `RuneCast.test.ts`, `RuneResponders.test.ts`.

**Modify:**
- `src/engine/types.ts` — `'rune'` in `DivinationType`; rune types; `RuneResult` in `DivinationResult`.
- `src/engine/TurnOrchestrator.ts` — `drawSingleResult` `case 'rune'`; `QUESTION_WEIGHTS` rune weights.
- `src/data/divination-profiles.ts` — `rune` profile.
- `src/engine/GameEngine.ts` — register responders; `planRuneCast()`/`resolveGoverning()`; widen `spawnSecond`/`removeUsedMethod` unions.
- `src/engine/events/scenarios.ts` — `DEBUG_SCENARIOS` for rune responders.
- `src/components/screens/GameTable.tsx` — `renderMinigame` `case 'rune'`.
- `src/components/screens/MethodSelect.tsx` — rune method metadata.
- `src/components/overlays/ConstellationFan.tsx` + result reading — render `RuneResult` via `RuneSigil`.
- `docs/game-systems.md`, `README.md`.

---

## Task 1: Rune types + dataset

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/data/runes.ts`
- Test: `src/engine/__tests__/Runes.test.ts`

**Interfaces:**
- Produces: `RuneId`, `RuneOrientation`, `RuneRing`, `RuneOmenTag`, `LandedRune`, `RuneScatter`, `RuneResult` (types); `RuneDef`, `RUNES: Record<RuneId, RuneDef>`, `AETTIR`, `NON_REVERSIBLE: RuneId[]`, `RING_BOUNDS`, `ringOf(r: number): RuneRing`.

- [ ] **Step 1: Add types to `src/engine/types.ts`**

Add `'rune'` to `DivinationType`:
```ts
export type DivinationType = 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'happening';
```
Add after the Astromancy types block:
```ts
// ── Rune Types ──
export type RuneId =
  | 'fehu'|'uruz'|'thurisaz'|'ansuz'|'raidho'|'kenaz'|'gebo'|'wunjo'
  | 'hagalaz'|'nauthiz'|'isa'|'jera'|'eihwaz'|'perthro'|'algiz'|'sowilo'
  | 'tiwaz'|'berkano'|'ehwaz'|'mannaz'|'laguz'|'ingwaz'|'othala'|'dagaz';
export type RuneAett = 'freyr' | 'heimdall' | 'tyr';
export type RuneOrientation = 'upright' | 'merkstave';
export type RuneRing = 'heart' | 'field' | 'margin';
export type RuneOmenTag = 'bindrune' | 'merkstave-cascade' | 'true-cast' | 'silent-field' | 'errant-rune';

export interface LandedRune {
  rune: RuneId;
  faceUp: boolean;
  orientation: RuneOrientation;
  ring: RuneRing;
  x: number; y: number; // normalized cloth coords; proximity + render
}
export interface RuneScatter {
  stones: LandedRune[];
  governingIndex: number;
  omens: RuneOmenTag[];
}
export interface RuneResult extends ThematicData {
  type: 'rune';
  id: string;
  name: string;
  symbol: string;
  rune: RuneId;
  orientation: RuneOrientation;
  ring: RuneRing;
  interpretation: string;
  tags: Tag[];
  scatter: RuneScatter;
}
```
Add `RuneResult` to the union:
```ts
export type DivinationResult = TarotResult | DiceResult | IChingResult | AstralResult | RuneResult;
```

- [ ] **Step 2: Write the failing dataset test** in `src/engine/__tests__/Runes.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { RUNES, NON_REVERSIBLE, ringOf } from '../../data/runes';
import type { RuneId } from '../types';

const ALL: RuneId[] = Object.keys(RUNES) as RuneId[];

describe('rune dataset', () => {
  it('has all 24 Elder Futhark runes', () => {
    expect(ALL).toHaveLength(24);
  });
  it('splits into three aettir of 8', () => {
    const byAett = { freyr: 0, heimdall: 0, tyr: 0 };
    for (const id of ALL) byAett[RUNES[id].aett]++;
    expect(byAett).toEqual({ freyr: 8, heimdall: 8, tyr: 8 });
  });
  it('marks exactly the symmetric runes non-reversible', () => {
    expect([...NON_REVERSIBLE].sort()).toEqual(
      ['dagaz','eihwaz','gebo','hagalaz','ingwaz','isa','jera','sowilo'].sort()
    );
    for (const id of ALL) expect(RUNES[id].reversible).toBe(!NON_REVERSIBLE.includes(id));
  });
  it('has unique glyphs and within-range dimensions', () => {
    const glyphs = new Set(ALL.map((id) => RUNES[id].glyph));
    expect(glyphs.size).toBe(24);
    for (const id of ALL) {
      const d = RUNES[id].dimensions;
      for (const a of ['favorability','certainty','volatility'] as const) {
        expect(d[a]).toBeGreaterThanOrEqual(-2);
        expect(d[a]).toBeLessThanOrEqual(2);
      }
    }
  });
  it('derives rings from radius', () => {
    expect(ringOf(0.1)).toBe('heart');
    expect(ringOf(0.5)).toBe('field');
    expect(ringOf(0.9)).toBe('margin');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts`
Expected: FAIL — cannot resolve `../../data/runes`.

- [ ] **Step 4: Create `src/data/runes.ts` dataset + ring geometry**

```ts
import type {
  RuneId, RuneAett, RuneRing, DimensionValues, ThemeTag, ModifierRole,
} from '../engine/types';

export interface RuneDef {
  id: RuneId; glyph: string; name: string; aett: RuneAett;
  reversible: boolean;
  theme: ThemeTag; modifierRole: ModifierRole;
  dimensions: DimensionValues;
  meaningUpright: string; meaningReversed: string;
}

const D = (favorability: number, certainty: number, volatility: number): DimensionValues =>
  ({ favorability, certainty, volatility });

// f = freyr, h = heimdall, t = tyr aett. reversible=false → symmetric stave.
const ROWS: [RuneId, string, string, RuneAett, boolean, ThemeTag, ModifierRole, DimensionValues, string, string][] = [
  ['fehu','ᚠ','Fehu','freyr',true,'renewal','effect',D(1,0.5,0),'Wealth earned, abundance, new energy.','Loss, greed, what slips through the fingers.'],
  ['uruz','ᚢ','Uruz','freyr',true,'transformation','subject',D(0.5,0,1),'Raw vitality, untamed strength, will.','Weakness, misused force, sickness.'],
  ['thurisaz','ᚦ','Thurisaz','freyr',true,'conflict','action',D(-0.5,0,1.5),'Reactive force, a defended threshold.','Danger, compulsion, a thorn turned inward.'],
  ['ansuz','ᚨ','Ansuz','freyr',true,'illumination','subject',D(1,0.5,0),'Insight, the divine word, a true message.','Deception, misheard counsel, vanity.'],
  ['raidho','ᚱ','Raidho','freyr',true,'authority','action',D(0.5,0.5,0),'Right action, the journey, rhythm kept.','Crisis, a wrong road, dislocation.'],
  ['kenaz','ᚲ','Kenaz','freyr',true,'illumination','effect',D(1,0.5,0.5),'The torch, craft, controlled fire.','Loss of vision, exposure, a guttering flame.'],
  ['gebo','ᚷ','Gebo','freyr',false,'harmony','subject',D(1.5,0.5,0),'Gift, partnership, balanced exchange.','Gift, partnership, balanced exchange.'],
  ['wunjo','ᚹ','Wunjo','freyr',true,'harmony','effect',D(1.5,0.5,0),'Joy, harmony, belonging.','Sorrow, discord, alienation.'],
  ['hagalaz','ᚺ','Hagalaz','heimdall',false,'upheaval','effect',D(-1,0.5,1.5),'Hail — the storm that breaks and resets.','Hail — the storm that breaks and resets.'],
  ['nauthiz','ᚾ','Nauthiz','heimdall',true,'stagnation','effect',D(-1,0.5,0),'Need, constraint, the lesson of limits.','Deprivation, despair, want unmet.'],
  ['isa','ᛁ','Isa','heimdall',false,'stagnation','effect',D(-0.5,1,-1.5),'Ice — standstill, stasis, the held breath.','Ice — standstill, stasis, the held breath.'],
  ['jera','ᛃ','Jera','heimdall',false,'renewal','effect',D(1,1,0),'Harvest, the turning year, reward in time.','Harvest, the turning year, reward in time.'],
  ['eihwaz','ᛇ','Eihwaz','heimdall',false,'transformation','subject',D(0.5,1,-0.5),'The world-axis, endurance, death and return.','The world-axis, endurance, death and return.'],
  ['perthro','ᛈ','Perthro','heimdall',true,'mystery','subject',D(0,-1,1),'The lot-cup — fate, chance, the cast itself.','Secrets withheld, luck stalled, a closed hand.'],
  ['algiz','ᛉ','Algiz','heimdall',true,'authority','effect',D(1,0.5,0),'Protection, the warding elk, a raised hand.','Vulnerability, a guard let down, hidden danger.'],
  ['sowilo','ᛋ','Sowilo','heimdall',false,'illumination','subject',D(1.5,1,0),'The sun — victory, wholeness, guiding light.','The sun — victory, wholeness, guiding light.'],
  ['tiwaz','ᛏ','Tiwaz','tyr',true,'authority','action',D(1,1,0),'Victory, justice, honor, the just sacrifice.','Injustice, defeat, lost faith.'],
  ['berkano','ᛒ','Berkano','tyr',true,'renewal','subject',D(1,0,0.5),'Growth, fertility, a new beginning.','Stagnation, a stalled bloom, family trouble.'],
  ['ehwaz','ᛖ','Ehwaz','tyr',true,'harmony','action',D(1,0.5,0.5),'Trust, partnership, steady movement.','Disharmony, mistrust, a faithless step.'],
  ['mannaz','ᛗ','Mannaz','tyr',true,'authority','subject',D(0.5,0.5,0),'The self, humanity, the measured mind.','Isolation, self-deception, the crowd misjudged.'],
  ['laguz','ᛚ','Laguz','tyr',true,'mystery','effect',D(0.5,-1,0.5),'Flow, intuition, the deep water.','Confusion, fear, what drowns the unwary.'],
  ['ingwaz','ᛜ','Ingwaz','tyr',false,'renewal','effect',D(1,0.5,-0.5),'Gestation, stored potential, the sealed seed.','Gestation, stored potential, the sealed seed.'],
  ['othala','ᛟ','Othala','tyr',true,'authority','subject',D(1,1,0),'Heritage, home, lasting ground.','Rootlessness, loss of legacy, a broken hearth.'],
  ['dagaz','ᛞ','Dagaz','tyr',false,'transformation','effect',D(1.5,0.5,0.5),'Breakthrough, dawn, the turning point.','Breakthrough, dawn, the turning point.'],
];

export const RUNES: Record<RuneId, RuneDef> = Object.fromEntries(
  ROWS.map(([id, glyph, name, aett, reversible, theme, modifierRole, dimensions, meaningUpright, meaningReversed]) =>
    [id, { id, glyph, name, aett, reversible, theme, modifierRole, dimensions, meaningUpright, meaningReversed }]),
) as Record<RuneId, RuneDef>;

export const AETTIR: Record<RuneAett, RuneId[]> = {
  freyr: ROWS.filter(r => r[3] === 'freyr').map(r => r[0]),
  heimdall: ROWS.filter(r => r[3] === 'heimdall').map(r => r[0]),
  tyr: ROWS.filter(r => r[3] === 'tyr').map(r => r[0]),
};

export const NON_REVERSIBLE: RuneId[] = ROWS.filter(r => !r[4]).map(r => r[0]);

// ── Cloth ring geometry ──
export const RING_BOUNDS = { heartMax: 0.33, fieldMax: 0.75, clothMax: 1.1 };
export function ringOf(r: number): RuneRing {
  if (r < RING_BOUNDS.heartMax) return 'heart';
  if (r < RING_BOUNDS.fieldMax) return 'field';
  return 'margin';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc -b
git add src/engine/types.ts src/data/runes.ts src/engine/__tests__/Runes.test.ts
git commit -m "feat(rune): add rune types and Elder Futhark dataset"
```

---

## Task 2: Scatter consolidation (`consolidateScatter`)

**Files:**
- Modify: `src/data/runes.ts`
- Test: `src/engine/__tests__/Runes.test.ts`

**Interfaces:**
- Consumes: `RUNES`, `RuneScatter`, `LandedRune` (Task 1).
- Produces: `consolidateScatter(scatter: RuneScatter): RuneResult`; `stoneBrightness(stone: LandedRune): number`.

- [ ] **Step 1: Add the failing consolidation test** (append to `Runes.test.ts`)

```ts
import { consolidateScatter } from '../../data/runes';
import type { LandedRune, RuneScatter } from '../types';

const stone = (rune: LandedRune['rune'], faceUp: boolean, orientation: LandedRune['orientation'], ring: LandedRune['ring']): LandedRune =>
  ({ rune, faceUp, orientation, ring, x: 0, y: 0 });

describe('consolidateScatter', () => {
  it('folds governing + supporting + crossing into clamped dimensions', () => {
    const scatter: RuneScatter = {
      stones: [
        stone('sowilo', true, 'upright', 'heart'),   // governing  (1.5,1,0)
        stone('wunjo', true, 'upright', 'field'),     // supporting (half of 1.5,0.5,0)
        stone('thurisaz', true, 'merkstave', 'field'),// crossing   (tax -0.5 fav, +0.5 vol)
        stone('isa', false, 'upright', 'field'),       // silent — ignored
      ],
      governingIndex: 0,
      omens: ['true-cast'],
    };
    const r = consolidateScatter(scatter);
    expect(r.type).toBe('rune');
    expect(r.rune).toBe('sowilo');
    expect(r.orientation).toBe('upright');
    expect(r.dimensions).toEqual({ favorability: 1, certainty: 0.5, volatility: 0.5 });
    expect(r.themes).toEqual(['illumination', 'harmony']);
    expect(r.tags).toEqual(expect.arrayContaining([
      'draw','rune','random','rune-sowilo','aett-heimdall','ring-heart',
      'orientation-upright','upright','non-reversible','true-cast',
    ]));
  });

  it('applies the merkstave shadow transform to a merkstave governing', () => {
    const scatter: RuneScatter = {
      stones: [stone('wunjo', true, 'merkstave', 'field')], // (1.5,0.5,0) → (-1.0 fav,+0.5 vol,-0.5 cert) then /2
      governingIndex: 0,
      omens: [],
    };
    const r = consolidateScatter(scatter);
    // governing dims pre-/2: fav 1.5-1.0=0.5, cert 0.5-0.5=0, vol 0+0.5=0.5 → /2 → (0.25,0,0.25) → clamp 0.5 granularity
    expect(r.orientation).toBe('merkstave');
    expect(r.dimensions.favorability).toBeLessThan(0.5);
    expect(r.tags).toEqual(expect.arrayContaining(['orientation-merkstave','reversed','reversible']));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts -t consolidateScatter`
Expected: FAIL — `consolidateScatter` is not a function.

- [ ] **Step 3: Implement `consolidateScatter` + `stoneBrightness`** (append to `src/data/runes.ts`)

```ts
import type { RuneScatter, LandedRune, RuneResult, Tag } from '../engine/types';
import type { DimensionValues } from '../engine/types';

const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const addDims = (t: DimensionValues, s: Partial<DimensionValues>) => { for (const a of AXES) t[a] += s[a] ?? 0; };

// Brightness for favored/clouded selection: favorability with a merkstave penalty.
export function stoneBrightness(stone: LandedRune): number {
  const base = RUNES[stone.rune].dimensions.favorability;
  return stone.orientation === 'merkstave' ? base - 2 : base;
}

export function consolidateScatter(scatter: RuneScatter): RuneResult {
  const gov = scatter.stones[scatter.governingIndex];
  const def = RUNES[gov.rune];
  const dims: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };

  // Governing (full), with merkstave shadow transform.
  addDims(dims, def.dimensions);
  if (gov.orientation === 'merkstave') addDims(dims, { favorability: -1, volatility: 0.5, certainty: -0.5 });

  // Supporting (face-up upright, non-governing, heart/field): half dims + theme.
  // Crossing (face-up merkstave, or any stone in the margin): tax.
  const themes: ThemeTag[] = [def.theme];
  const seen = new Set<ThemeTag>(themes);
  scatter.stones.forEach((s, i) => {
    if (i === scatter.governingIndex || !s.faceUp) return;
    const crossing = s.orientation === 'merkstave' || s.ring === 'margin';
    if (crossing) {
      addDims(dims, { favorability: -0.5, volatility: 0.5 });
    } else {
      const sd = RUNES[s.rune].dimensions;
      addDims(dims, { favorability: sd.favorability / 2, certainty: sd.certainty / 2, volatility: sd.volatility / 2 });
      const t = RUNES[s.rune].theme;
      if (!seen.has(t)) { themes.push(t); seen.add(t); }
    }
  });
  for (const a of AXES) dims[a] = clampDim(dims[a] / 2);
  themes.splice(2);

  const tags: Tag[] = [
    'draw', 'rune', 'random',
    `rune-${gov.rune}`, `aett-${def.aett}`, `ring-${gov.ring}`,
    `orientation-${gov.orientation}`,
    gov.orientation === 'upright' ? 'upright' : 'reversed',
    def.reversible ? 'reversible' : 'non-reversible',
    ...scatter.omens,
  ];

  const meaning = gov.orientation === 'upright' ? def.meaningUpright : def.meaningReversed;
  return {
    type: 'rune',
    id: `rune:${gov.rune}-${gov.orientation}-${gov.ring}`,
    name: `${def.name}${gov.orientation === 'merkstave' ? ' — Merkstave' : ''}`,
    symbol: def.glyph,
    rune: gov.rune, orientation: gov.orientation, ring: gov.ring,
    interpretation: `${def.name} in the ${gov.ring[0].toUpperCase()}${gov.ring.slice(1)} — ${meaning}`,
    themes, dimensions: dims, modifierRoles: [def.modifierRole],
    tags, scatter,
  };
}
```
Add the missing `ThemeTag` import to the existing import line at the top of `runes.ts`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/data/runes.ts src/engine/__tests__/Runes.test.ts
git commit -m "feat(rune): consolidate a scatter into a governing RuneResult"
```

---

## Task 3: Scatter fall (`resolveScatter` + `drawRuneScatter`)

**Files:**
- Modify: `src/data/runes.ts`
- Test: `src/engine/__tests__/Runes.test.ts`

**Interfaces:**
- Consumes: `RUNES`, `ringOf`, `RING_BOUNDS`, `RuneScatter`, `LandedRune` (Tasks 1-2).
- Produces:
  - `resolveScatter(input: { affinities: Record<string, number>; aim?: { angle: number; power: number }; drift?: number; reveal?: boolean; rng?: () => number }): RuneScatter`
  - `drawRuneScatter(affinities: Record<string, number>, rng?: () => number): RuneScatter`

- [ ] **Step 1: Add failing tests** (append to `Runes.test.ts`)

```ts
import { resolveScatter, drawRuneScatter, RUNES as _R, NON_REVERSIBLE as _NR } from '../../data/runes';

describe('resolveScatter', () => {
  const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

  it('produces a 6-stone scatter with a face-up governing stone', () => {
    const s = resolveScatter({ affinities: { chaos: 50, order: 50, fate: 50 }, rng: seq([0.5]) });
    expect(s.stones).toHaveLength(6);
    expect(s.stones[s.governingIndex].faceUp).toBe(true);
  });

  it('never lands a non-reversible rune merkstave', () => {
    // force high chaos so merkstave rolls are likely; assert symmetric runes stay upright
    const s = resolveScatter({ affinities: { chaos: 100, order: 0, fate: 50 }, rng: seq([0.01]) });
    for (const st of s.stones) {
      if (st.faceUp && _NR.includes(st.rune)) expect(st.orientation).toBe('upright');
    }
  });

  it('Order tightens the scatter relative to Chaos', () => {
    const spread = (aff: Record<string, number>) => {
      const s = resolveScatter({ affinities: aff, rng: seq([0.3, 0.7, 0.2, 0.8, 0.5, 0.4, 0.6, 0.1]) });
      return Math.max(...s.stones.map(st => Math.hypot(st.x, st.y)));
    };
    expect(spread({ chaos: 0, order: 100, fate: 0 })).toBeLessThan(spread({ chaos: 100, order: 0, fate: 0 }));
  });
});

describe('drawRuneScatter', () => {
  it('returns a consolidatable scatter for engine-spawned results', () => {
    const s = drawRuneScatter({ chaos: 50, order: 50, fate: 50 });
    expect(s.stones.length).toBe(6);
    expect(s.governingIndex).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts -t resolveScatter`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement `resolveScatter` + `drawRuneScatter`** (append to `src/data/runes.ts`)

Logic:
- Shuffle the 24 ids with `rng`, take 6.
- Cluster centroid from `aim` (`angle`,`power`) or origin; per-stone jitter radius `spread = base * (1 + chaos - order)`; angle from `rng`. Apply Fate `drift`: lerp each toward `(0,0)` by `drift`.
- `faceUp` = `rng() < 0.6 + light*0.4 - shadow*0.4` (or `reveal` forces true).
- `orientation` = (reversible && faceUp && `rng() < 0.35 + chaos*0.4 - order*0.3`) ? 'merkstave' : 'upright'.
- `ring = ringOf(hypot(x,y))`.
- Guarantee a face-up governing: if none face-up, set the nearest stone `faceUp = true`.
- `governingIndex` = index of the face-up stone with the smallest radius.
- Omens via the rules in the spec (`bindrune`, `merkstave-cascade`, `true-cast`, `silent-field`, `errant-rune`).

```ts
const ALL_RUNE_IDS = Object.keys(RUNES) as RuneId[];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface ScatterInput {
  affinities: Record<string, number>;
  aim?: { angle: number; power: number };
  drift?: number;
  reveal?: boolean;
  rng?: () => number;
}

export function resolveScatter(input: ScatterInput): RuneScatter {
  const rng = input.rng ?? Math.random;
  const chaos = (input.affinities.chaos ?? 0) / 100;
  const order = (input.affinities.order ?? 0) / 100;
  const light = (input.affinities.light ?? 0) / 100;
  const shadow = (input.affinities.shadow ?? 0) / 100;
  const drift = Math.max(0, Math.min(1, input.drift ?? 0));

  // cluster centroid from aim (power 0..1 → distance), else origin
  const aimDist = input.aim ? input.aim.power * 0.5 : 0;
  const cx = input.aim ? Math.cos(input.aim.angle) * aimDist : 0;
  const cy = input.aim ? Math.sin(input.aim.angle) * aimDist : 0;
  const spreadBase = 0.45 * (1 + chaos - order); // wider with chaos, tighter with order

  const ids = [...ALL_RUNE_IDS];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const drawn = ids.slice(0, 6);

  const stones: LandedRune[] = drawn.map((rune) => {
    const ang = rng() * Math.PI * 2;
    const rad = spreadBase * (0.3 + rng());
    let x = cx + Math.cos(ang) * rad;
    let y = cy + Math.sin(ang) * rad;
    x = lerp(x, 0, drift); y = lerp(y, 0, drift);
    const r = Math.hypot(x, y);
    const faceUp = input.reveal ? true : rng() < 0.6 + light * 0.4 - shadow * 0.4;
    const canMerk = RUNES[rune].reversible && faceUp;
    const orientation: RuneOrientation = canMerk && rng() < 0.35 + chaos * 0.4 - order * 0.3 ? 'merkstave' : 'upright';
    return { rune, faceUp, orientation, ring: ringOf(r), x, y };
  });

  // guarantee a face-up governing stone
  if (!stones.some((s) => s.faceUp)) {
    let nearest = 0; for (let i = 1; i < stones.length; i++) if (Math.hypot(stones[i].x, stones[i].y) < Math.hypot(stones[nearest].x, stones[nearest].y)) nearest = i;
    stones[nearest].faceUp = true;
  }
  let governingIndex = -1;
  stones.forEach((s, i) => {
    if (!s.faceUp) return;
    if (governingIndex < 0 || Math.hypot(s.x, s.y) < Math.hypot(stones[governingIndex].x, stones[governingIndex].y)) governingIndex = i;
  });

  const omens = detectOmens(stones, governingIndex);
  return { stones, governingIndex, omens };
}

function detectOmens(stones: LandedRune[], governingIndex: number): RuneOmenTag[] {
  const omens: RuneOmenTag[] = [];
  const faceUp = stones.filter((s) => s.faceUp);
  const supporters = stones.filter((s, i) => i !== governingIndex && s.faceUp && s.orientation === 'upright');
  const aettCount = supporters.reduce((m, s) => (m[RUNES[s.rune].aett] = (m[RUNES[s.rune].aett] ?? 0) + 1, m), {} as Record<string, number>);
  if (Object.values(aettCount).some((n) => n >= 2)) omens.push('bindrune');
  if (faceUp.length >= 2 && faceUp.every((s) => s.orientation === 'merkstave')) omens.push('merkstave-cascade');
  const gov = stones[governingIndex];
  if (gov && gov.orientation === 'upright' && gov.ring === 'heart') omens.push('true-cast');
  if (stones.filter((s) => !s.faceUp).length >= Math.ceil(stones.length / 2)) omens.push('silent-field');
  if (stones.some((s) => Math.hypot(s.x, s.y) > RING_BOUNDS.clothMax)) omens.push('errant-rune');
  return omens;
}

export function drawRuneScatter(affinities: Record<string, number>, rng: () => number = Math.random): RuneScatter {
  return resolveScatter({ affinities, rng });
}
```
Ensure `RuneOmenTag`, `RuneOrientation` are imported.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/data/runes.ts src/engine/__tests__/Runes.test.ts
git commit -m "feat(rune): resolve the scatter fall with affinity bias and omens"
```

---

## Task 4: Plan modes (`src/engine/runes.ts`)

**Files:**
- Create: `src/engine/runes.ts`
- Test: `src/engine/__tests__/RuneCast.test.ts`

**Interfaces:**
- Consumes: `bandOf`, `BAND_ORDER`, `BAND_POWER_STEP`, `TIER_BASE_CHANCE` (`data/affinities`); `RUNES`, `consolidateScatter`, `stoneBrightness` (`data/runes`); `RuneScatter` (types).
- Produces:
  - `type RuneCastMode = 'single' | 'favored' | 'clouded' | 'claim'`
  - `planRuneCast(affinities, offerRecast): { mode: RuneCastMode; drift: number; offerRecast: boolean; sources: string[] }`
  - `resolveGoverning(scatter: RuneScatter, mode: RuneCastMode): number`
  - `shouldOfferRecast(affinities, rng?): boolean`

- [ ] **Step 1: Write failing tests** in `src/engine/__tests__/RuneCast.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { planRuneCast, resolveGoverning, shouldOfferRecast } from '../runes';
import type { RuneScatter, LandedRune } from '../types';

const lo = 20, asc = 70, dom = 90;
const base = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };

describe('planRuneCast', () => {
  it('defaults to single', () => {
    expect(planRuneCast(base, false).mode).toBe('single');
  });
  it('Will dominant → claim, and claim suppresses the recast offer', () => {
    const p = planRuneCast({ ...base, will: dom, fate: lo }, true);
    expect(p.mode).toBe('claim');
    expect(p.offerRecast).toBe(false);
  });
  it('Light ascendant → favored; Shadow ascendant → clouded', () => {
    expect(planRuneCast({ ...base, light: asc }, false).mode).toBe('favored');
    expect(planRuneCast({ ...base, shadow: asc, light: lo }, false).mode).toBe('clouded');
  });
  it('drift scales with the Fate band', () => {
    expect(planRuneCast({ ...base, fate: lo }, false).drift).toBe(0);
    expect(planRuneCast({ ...base, fate: dom, will: lo }, false).drift).toBe(1);
  });
  it('Fate ascendant+ suppresses the recast offer', () => {
    expect(planRuneCast({ ...base, fate: asc, will: lo }, true).offerRecast).toBe(false);
  });
});

const stone = (rune: LandedRune['rune'], faceUp: boolean, orientation: LandedRune['orientation'], x: number): LandedRune =>
  ({ rune, faceUp, orientation, ring: 'field', x, y: 0 });

describe('resolveGoverning', () => {
  const scatter: RuneScatter = {
    stones: [stone('sowilo', true, 'upright', 0.2), stone('hagalaz', true, 'upright', 0.3)],
    governingIndex: 0, omens: [],
  };
  it('single keeps the nearest-Heart default', () => {
    expect(resolveGoverning(scatter, 'single')).toBe(0);
  });
  it('favored picks the brighter; clouded the dimmer', () => {
    expect(resolveGoverning(scatter, 'favored')).toBe(0); // sowilo brighter
    expect(resolveGoverning(scatter, 'clouded')).toBe(1); // hagalaz dimmer
  });
});

describe('shouldOfferRecast', () => {
  it('is false below stirring', () => {
    expect(shouldOfferRecast({ will: 10 }, () => 0.0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/RuneCast.test.ts`
Expected: FAIL — cannot resolve `../runes`.

- [ ] **Step 3: Implement `src/engine/runes.ts`**

```ts
import type { AffinityBand, RuneScatter } from './types';
import { bandOf, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE } from '../data/affinities';
import { stoneBrightness } from '../data/runes';

export type RuneCastMode = 'single' | 'favored' | 'clouded' | 'claim';

interface RuneModifier { affinity: 'will' | 'light' | 'shadow'; minBand: AffinityBand; mode: Exclude<RuneCastMode, 'single'>; source: string; }
const MODIFIERS: RuneModifier[] = [
  { affinity: 'will',   minBand: 'dominant',  mode: 'claim',   source: 'Your will seizes the casting' },
  { affinity: 'light',  minBand: 'ascendant', mode: 'favored', source: 'Light unveils the silent stones' },
  { affinity: 'shadow', minBand: 'ascendant', mode: 'clouded', source: 'Shadow veils the scatter' },
];

const idx = (band: AffinityBand) => BAND_ORDER.indexOf(band);
const atLeast = (value: number, band: AffinityBand) => idx(bandOf(value)) >= idx(band);
const DRIFT_BY_BAND: Record<AffinityBand, number> = { latent: 0, stirring: 0.33, ascendant: 0.66, dominant: 1 };

export function planRuneCast(
  affinities: Record<string, number>,
  offerRecast: boolean,
): { mode: RuneCastMode; drift: number; offerRecast: boolean; sources: string[] } {
  const sources: string[] = [];
  let mode: RuneCastMode = 'single';
  for (const m of MODIFIERS) {
    if (atLeast(affinities[m.affinity] ?? 0, m.minBand)) {
      if (m.mode === 'claim') { mode = 'claim'; sources.push(m.source); break; }
      if (mode === 'single') { mode = m.mode; sources.push(m.source); }
    }
  }
  const fateBand = bandOf(affinities.fate ?? 0);
  const drift = DRIFT_BY_BAND[fateBand];
  const fateMovesHand = idx(fateBand) >= idx('ascendant');
  return { mode, drift, offerRecast: offerRecast && mode !== 'claim' && !fateMovesHand, sources };
}

export function shouldOfferRecast(affinities: Record<string, number>, rng: () => number = Math.random): boolean {
  const i = BAND_ORDER.indexOf(bandOf(affinities.will ?? 0));
  const minI = BAND_ORDER.indexOf('stirring');
  if (i < minI) return false;
  const scaled = TIER_BASE_CHANCE.notable * (1 + (i - minI) * BAND_POWER_STEP);
  return rng() < Math.min(1, scaled);
}

// Default governing = nearest-Heart face-up (set by resolveScatter). Favored/clouded
// re-pick between the two nearest by brightness; claim defers to the player (fallback default).
export function resolveGoverning(scatter: RuneScatter, mode: RuneCastMode): number {
  const faceUp = scatter.stones.map((s, i) => ({ s, i })).filter(({ s }) => s.faceUp);
  if (faceUp.length === 0) return scatter.governingIndex;
  faceUp.sort((a, b) => Math.hypot(a.s.x, a.s.y) - Math.hypot(b.s.x, b.s.y));
  if (mode === 'favored' || mode === 'clouded') {
    const top2 = faceUp.slice(0, 2);
    top2.sort((a, b) => stoneBrightness(b.s) - stoneBrightness(a.s)); // brightest first
    return mode === 'favored' ? top2[0].i : top2[top2.length - 1].i;
  }
  return scatter.governingIndex;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/__tests__/RuneCast.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/engine/runes.ts src/engine/__tests__/RuneCast.test.ts
git commit -m "feat(rune): plan modes, drift, and governing resolution"
```

---

## Task 5: Orchestrator draw + divination profile

**Files:**
- Modify: `src/engine/TurnOrchestrator.ts`, `src/data/divination-profiles.ts`
- Test: `src/engine/__tests__/Runes.test.ts` (append)

**Interfaces:**
- Consumes: `drawRuneScatter`, `consolidateScatter` (Tasks 2-3).
- Produces: `drawSingleResult('rune', affinities)` → `RuneResult`; `DIVINATION_PROFILES.rune`.

- [ ] **Step 1: Append the failing test** to `Runes.test.ts`

```ts
import { consolidateScatter as _c, drawRuneScatter as _d } from '../../data/runes';
describe('engine-spawned rune', () => {
  it('drawRuneScatter → consolidateScatter yields a valid rune slot', () => {
    const r = _c(_d({ chaos: 50, order: 50, fate: 50 }, () => 0.5));
    expect(r.type).toBe('rune');
    expect(r.tags).toContain('rune');
  });
});
```
(This already passes from Tasks 2-3; it documents the orchestrator contract. The orchestrator wiring itself is typecheck-verified.)

- [ ] **Step 2: Wire `drawSingleResult`** in `src/engine/TurnOrchestrator.ts`

Add the import near the other data imports:
```ts
import { drawRuneScatter, consolidateScatter } from '../data/runes';
```
Add a case in the `switch (method)` block of `drawSingleResult`, after `case 'astral'`:
```ts
      case 'rune':
        result = consolidateScatter(drawRuneScatter(affinities));
        break;
```

- [ ] **Step 3: Add `QUESTION_WEIGHTS` for rune** in `TurnOrchestrator.ts`

Find `QUESTION_WEIGHTS` and give `rune` a weight in each question type (mirror `astral`/`iching` magnitudes), e.g. add `rune: 1.0` (or per-question values matching the file's style) to each `QuestionType` entry so rune can appear in the pool.

- [ ] **Step 4: Add the divination profile** in `src/data/divination-profiles.ts`

```ts
  rune: {
    type: 'rune',
    themeCoverage: 'all',
    themePool: ['renewal','transformation','conflict','illumination','harmony','mystery','authority','stagnation','upheaval','surrender'],
    dimensionStrengths: ['favorability', 'volatility', 'certainty'],
    modifierStrengths: ['subject', 'effect', 'action'],
  },
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/engine/__tests__/Runes.test.ts && npx tsc -b`
Expected: PASS + clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add src/engine/TurnOrchestrator.ts src/data/divination-profiles.ts src/engine/__tests__/Runes.test.ts
git commit -m "feat(rune): wire rune draws into the orchestrator and profiles"
```

---

## Task 6: Rune responders

**Files:**
- Create: `src/engine/responders/runes.ts`
- Modify: `src/engine/GameEngine.ts` (register), `src/engine/events/scenarios.ts` (debug scenarios)
- Test: `src/engine/__tests__/RuneResponders.test.ts`

**Interfaces:**
- Consumes: `Responder`, `EffectReport`, `PhaseContext` (`events/types`); `RuneResult` (types).
- Produces: `buildRuneResponders(): Responder[]`.

- [ ] **Step 1: Write failing responder tests** in `src/engine/__tests__/RuneResponders.test.ts`

Model on `src/engine/__tests__/AstralResponders.test.ts` (read it first for the harness: how it builds a `PhaseContext`, sets `draft.outcome`, and asserts on the returned `EffectReport`/draft mutation). Cover: `bindrune` amplifies; `merkstave-cascade` raises volatility; `true-cast` raises certainty; `silent-field` lowers certainty; `errant-rune` sets `spawnSecond='rune'`; `perthro` governing sets `spawnSecond='rune'`; `hagalaz` raises volatility; `isa` lowers volatility; and a free-participation test that a rune with the `reversible` tag plus another reversible slot satisfies the existing `mirror` responder's condition.

```ts
import { describe, it, expect } from 'vitest';
import { buildRuneResponders } from '../responders/runes';
import type { RuneResult, PhaseContext } from '../types';

const R = buildRuneResponders();
const find = (id: string) => R.find((r) => r.id === id)!;

function runeOutcome(over: Partial<RuneResult>): RuneResult {
  return {
    type: 'rune', id: 'rune:test', name: 'Test', symbol: 'ᚠ',
    rune: 'fehu', orientation: 'upright', ring: 'heart',
    interpretation: '', themes: ['renewal'], modifierRoles: ['effect'],
    dimensions: { favorability: 1, certainty: 0, volatility: 0 },
    tags: ['rune'], scatter: { stones: [], governingIndex: 0, omens: [] }, ...over,
  };
}
function ctx(outcome: RuneResult, spread: RuneResult[] = [outcome]): PhaseContext {
  return { draft: { outcome }, spread, rng: () => 0, /* + any other required fields per AstralResponders.test.ts */ } as unknown as PhaseContext;
}

describe('rune responders', () => {
  it('true-cast raises certainty', () => {
    const o = runeOutcome({ tags: ['rune', 'true-cast'], dimensions: { favorability: 0, certainty: 0, volatility: 0 } });
    const r = find('rune-true-cast');
    const c = ctx(o);
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    expect((c.draft.outcome as RuneResult).dimensions.certainty).toBeGreaterThan(0);
  });
  it('errant-rune spawns a second rune', () => {
    const o = runeOutcome({ tags: ['rune', 'errant-rune'] });
    const r = find('rune-errant');
    const c = ctx(o);
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('rune');
  });
});
```
Add the remaining cases (bindrune, merkstave-cascade, silent-field, perthro, hagalaz, isa, tiwaz) following the same shape.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/RuneResponders.test.ts`
Expected: FAIL — cannot resolve `../responders/runes`.

- [ ] **Step 3: Implement `src/engine/responders/runes.ts`**

Model precisely on `src/engine/responders/astral.ts` (same `report`, `out`, `has`, `bump`, `dominantAxis` helpers; same `group`/`weight`/`condition`/`roll`/`apply` shape). Implement the 8 internal responders + `tiwaz-victory` per the catalogue table in the spec. Triggers: `rune:commit` (internal) and `['dice:commit','rune:commit']` for `tiwaz-victory`. Use exclusive `MUTATE` band for the dimension-mutators, exclusive `SPAWN` band for `rune-errant` and `rune-perthro` (perthro `weight: () => 2`).

- [ ] **Step 4: Register in `GameEngine.ts`**

Add import:
```ts
import { buildRuneResponders } from './responders/runes';
```
Find where `buildAstralResponders()` is spread into the responder registration array and add `...buildRuneResponders()` alongside it.

- [ ] **Step 5: Add debug scenarios** in `src/engine/events/scenarios.ts`

Read the existing `astral-*` `DEBUG_SCENARIOS` entries; add a `rune-*` entry per new responder that stages the precondition (a committed `RuneResult` carrying the needed tag/rune in the slot the condition reads). Match the existing structure exactly.

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/engine/__tests__/RuneResponders.test.ts && npx tsc -b`
Expected: PASS + clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/responders/runes.ts src/engine/GameEngine.ts src/engine/events/scenarios.ts src/engine/__tests__/RuneResponders.test.ts
git commit -m "feat(rune): meta-interaction responders + debug scenarios"
```

---

## Task 7: GameEngine plan methods + union widening

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/RuneCast.test.ts` (append)

**Interfaces:**
- Consumes: `planRuneCast`, `resolveGoverning`, `shouldOfferRecast` (Task 4).
- Produces: `engine.planRuneCast()`, `engine.resolveGoverning(scatter, mode)`; `spawnSecond`/`removeUsedMethod` accept `'rune'`.

- [ ] **Step 1: Add imports** in `GameEngine.ts`

```ts
import { planRuneCast as planRuneCastPure, resolveGoverning as resolveGoverningPure, shouldOfferRecast as shouldOfferRuneRecast } from './runes';
import type { RuneCastMode } from './runes';
import type { RuneScatter } from './types';
```

- [ ] **Step 2: Add the engine methods** near `planAstralCast`

```ts
  planRuneCast(): { mode: RuneCastMode; drift: number; offerRecast: boolean; sources: string[] } {
    const affinities = this.affinityEngine.getState();
    return planRuneCastPure(affinities, shouldOfferRuneRecast(affinities));
  }

  resolveGoverning(scatter: RuneScatter, mode: RuneCastMode): number {
    return resolveGoverningPure(scatter, mode);
  }
```

- [ ] **Step 3: Widen the `spawnSecond` union**

At the `draft.spawnSecond as 'tarot' | 'd20' | 'iching' | 'astral'` cast (in `completeMinigame`), add `| 'rune'`.

- [ ] **Step 4: Widen the `removeUsedMethod` cast**

At `result.type as 'tarot' | 'd20' | 'iching' | 'astral'`, add `| 'rune'`.

- [ ] **Step 5: Append a smoke test** to `RuneCast.test.ts`

```ts
import { GameEngine } from '../GameEngine';
describe('engine rune integration', () => {
  it('exposes planRuneCast', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    const p = engine.planRuneCast();
    expect(['single','favored','clouded','claim']).toContain(p.mode);
  });
});
```
(Check `GameEngine.test.ts` for the correct constructor/`startTurn` usage and match it.)

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/engine/__tests__/RuneCast.test.ts && npx tsc -b`
Expected: PASS + clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/RuneCast.test.ts
git commit -m "feat(rune): GameEngine plan methods + spawn/remove union widening"
```

---

## Task 8: `RuneSigil` component

**Files:**
- Create: `src/components/cards/RuneSigil.tsx`

**Interfaces:**
- Produces: `export default function RuneSigil({ rune, orientation, silent, size, color }: { rune: RuneId; orientation?: RuneOrientation; silent?: boolean; size?: number; color?: string })`.

- [ ] **Step 1: Read the analog** — open `src/components/cards/AstralSigil.tsx` for the prop/style conventions (size, color, glyph rendering).

- [ ] **Step 2: Implement `RuneSigil.tsx`**

Render a rounded "stone" containing the rune glyph from `RUNES[rune].glyph`:
- `silent` → blank knotwork back (no glyph), muted.
- `orientation === 'merkstave'` → glyph `transform: rotate(180deg)` with a dim red-violet (`#9b6bb0`) cast.
- upright → gold (`#d4a854`) glyph with a soft glow.
Use inline-style objects matching the existing cards. No engine logic.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -b
git add src/components/cards/RuneSigil.tsx
git commit -m "feat(rune): RuneSigil stone-face component"
```

---

## Task 9: Cloth + runeArt + scatter helpers (`screens/runic/`)

**Files:**
- Create: `src/components/screens/runic/cloth.ts`, `runeArt.ts`, `scatter.ts`

**Interfaces:**
- `cloth.ts` → `CLOTH_RINGS` (radii + labels for Heart/Field/Margin), decorative star/flourish constants, a `ClothBackdrop`-style data export consumed by the screen's SVG.
- `runeArt.ts` → `runeGlyph(id)`, any per-rune color/accent metadata.
- `scatter.ts` → `toPixel(stone, size)` (normalized → px on the cloth), `throwTransition` (Framer spring config), `tumble(i)` (per-stone tumble keyframes). Imports `resolveScatter` from `../../../data/runes` for the canonical fall when the screen needs a fresh scatter from an aim.

- [ ] **Step 1: Read analogs** — `src/components/screens/celestial/board.ts` and `constellationArt.ts` for the data-module conventions.

- [ ] **Step 2: Implement the three helper modules** (pure TS, no JSX) with the exports above.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -b
git add src/components/screens/runic/
git commit -m "feat(rune): cloth geometry, rune art, and scatter helpers"
```

---

## Task 10: `RuneMinigame` screen + routing

**Files:**
- Create: `src/components/screens/RuneMinigame.tsx`
- Modify: `src/components/screens/GameTable.tsx`, `src/components/screens/MethodSelect.tsx`

**Interfaces:**
- Consumes: `engine.planRuneCast()`, `engine.resolveGoverning()`, `engine.completeMinigame()`, `resolveScatter`, `consolidateScatter`, `RuneSigil`, the `runic/` helpers.

- [ ] **Step 1: Read the template** — `src/components/screens/AstralMinigame.tsx` (phase machine, `commit`, recast/keep, veiled handling, committed-slot display) and `TarotMinigame.tsx` (desktop pointer vs mobile touch drag handling).

- [ ] **Step 2: Implement `RuneMinigame.tsx`** with the phase machine from the spec:

`idle → aiming → casting → settling → reading → (claim | recast-offer | auto) → done`.
- **Aim:** pointer/touch drag from the bag computes `{ angle, power }` (clamped). Render the dashed-gold trajectory arc + power ring; render the Fate-drift vector from `plan.drift`.
- **Cast:** on release, `const plan = engine.planRuneCast()`; `const scatter = resolveScatter({ affinities: state.affinities, aim, drift: plan.drift, reveal: plan.mode === 'favored' })`; set `scatter.governingIndex = engine.resolveGoverning(scatter, plan.mode)`; animate stones to `toPixel` targets with `tumble`/`throwTransition`.
- **Reading:** `consolidateScatter(scatter)` → show governing `RuneSigil` + name/orientation/ring + interpretation + omen badge. Veiled when `state.affinityEffects.poolPreview === 'hidden'` (Shadow), mirroring Astral.
- **Agency beat:** `claim` → face-up stones tappable, `↻ Turn` on a merkstave governing (re-consolidate on pick/turn); `offerRecast` → `↺ Re-cast / Keep it`; else auto-commit after `REVEAL_DELAY_MS`.
- **Commit:** `engine.completeMinigame(consolidateScatter(scatter), meta)` where `meta` is `{ revealedAsDrawn: true }` for as-fallen/keep, `{ viaReroll: true }` after a re-cast, and include `{ reversed: true }` when the player turned a stone (Will). Prefer the committed slot for display post-commit (as Astral does) so responder mutations show.
- Match the existing per-phase headings, `OrnamentalBorder`/`RunicBand` decorations, and AnimatePresence transitions.

- [ ] **Step 3: Route it** in `GameTable.tsx`

Add to `renderMinigame`'s switch:
```tsx
      case 'rune':
        return <RuneMinigame key="rune-minigame" />;
```
and import `RuneMinigame`.

- [ ] **Step 4: Add method metadata** in `MethodSelect.tsx`

Read how each `DivinationType` gets its label/glyph/blurb and add a `rune` entry (glyph `ᚠ`, label "Rune Casting", a one-line mystical blurb).

- [ ] **Step 5: Typecheck + manual verify**

Run: `npm run build` (expect clean). Then `npm run dev`, start a reading, pick Rune Casting, and confirm: aim-fling works (desktop + touch), stones scatter/settle, governing reads correctly, claim/recast/veiled behave, commit advances. (Use the debug panel to force high Will / high Fate / high Shadow to exercise each mode.)

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/RuneMinigame.tsx src/components/screens/GameTable.tsx src/components/screens/MethodSelect.tsx
git commit -m "feat(rune): RuneMinigame screen, routing, and method entry"
```

---

## Task 11: Fan + result-reading rendering

**Files:**
- Modify: `src/components/overlays/ConstellationFan.tsx`, the result-reading component(s) that render per-slot result faces.

**Interfaces:**
- Consumes: `RuneSigil`, `RuneResult`.

- [ ] **Step 1: Find the per-type branches** — grep for `type === 'astral'` across `src/components/` to locate the fan + reading render switches.

- [ ] **Step 2: Add a `'rune'` branch** in each, rendering the governing rune via `RuneSigil` (+ name/orientation/ring), mirroring the `astral` branch's layout.

- [ ] **Step 3: Typecheck + manual verify**

Run: `npm run build`. Then in dev, complete a rune reading and confirm the bottom fan and the final reading both show the rune correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/overlays/ConstellationFan.tsx src/components/screens/
git commit -m "feat(rune): render rune results in the fan and reading"
```

---

## Task 12: Documentation

**Files:**
- Modify: `docs/game-systems.md`, `README.md`

- [ ] **Step 1: Add a Rune Casting section to `docs/game-systems.md`**

Document: the scatter mechanic + cloth rings; the plan modes (single/favored/clouded/claim) and Fate drift; per-affinity behavior; the consolidation rules (governing/supporting/crossing + merkstave transform); and the full meta-interaction catalogue (the 8 internal + `tiwaz-victory` + free participation in `mirror`/`iching-resonant-change`). Match the document's existing structure and depth.

- [ ] **Step 2: Update `README.md`**

Add Rune Casting to the methods/gameplay tables and the debug-scenario list (player-facing blurb).

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(rune): document rune casting systems and player flow"
```

---

## Task 13: Full verification

- [ ] **Step 1: Run the whole engine suite**

Run: `npm test`
Expected: all green (existing + `Runes`, `RuneCast`, `RuneResponders`).

- [ ] **Step 2: Full typecheck + build**

Run: `npm run build`
Expected: clean `tsc -b` + successful Vite bundle.

- [ ] **Step 3: Manual smoke (dev)**

`npm run dev` → play a full turn including a rune cast under default affinities, then force (debug panel) each of: high Will (claim + turn), high Fate (drift + auto), high Light (favored/reveal), high Shadow (clouded/veiled), high Chaos (wide scatter + merkstave), high Order (tight + upright). Confirm responders fire via forced scenarios.

- [ ] **Step 4: Final commit if any fixups**

```bash
git add -A
git commit -m "chore(rune): verification fixups"
```

---

## Self-Review Notes

- **Spec coverage:** types/dataset (T1), consolidation (T2), scatter fall + omens (T3), plan modes/drift/governing (T4), orchestrator+profile (T5), responders+scenarios (T6), engine methods+unions (T7), sigil (T8), cloth/art/scatter helpers (T9), screen+routing+method (T10), fan/reading (T11), docs (T12), verification (T13). All spec sections mapped.
- **Type consistency:** `RuneCastMode`, `RuneScatter`, `LandedRune`, `resolveScatter` input shape, `planRuneCast` return shape, and `consolidateScatter`/`stoneBrightness` signatures are defined once (T1-T4) and consumed unchanged downstream.
- **Pragmatic note:** React component tasks (T8-T11) give precise file specs + template references rather than full inline JSX, because Vitest cannot test them (they're verified by `tsc` + manual dev) and the existing minigames are the canonical templates. All logic that *can* be unit-tested lives in T1-T7 with complete TDD code.
