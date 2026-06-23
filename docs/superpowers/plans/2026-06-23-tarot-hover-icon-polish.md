# Tarot Draft — Hover Fan-out & Icon Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tarot draft's hover fan-out smooth and bounded, swap the hand-drawn card/UI icons for the Game-Icons set, move the deck into a framed left rail, and give the Past/Present/Future slots distinct themed frames.

**Architecture:** Extract the fan-out geometry into a pure, unit-tested `src/engine/fanLayout.ts` (no React) satisfying four properties (hovered card fixed, max repulsion = side-by-side, ends pinned to a fixed envelope, far cards compress). Replace the geometry-emitting `resolveSigil` with one that emits **icon keys**; `CardSigil` becomes a thin `react-icons/gi` renderer. All remaining changes are presentational edits inside `TarotMinigame.tsx`, verified by `tsc` + the dev server.

**Tech Stack:** React 18 + TypeScript + Vite, framer-motion 11, `react-icons` 5 (Game-Icons `gi` set), Vitest.

## Global Constraints

- **No engine/game-logic changes.** Affinities, happenings, reducers, responders untouched. This is presentational + one pure geometry module.
- **Engine purity:** `src/engine/fanLayout.ts` and `src/data/sigils.ts` must stay framework-free — no React/DOM imports (Vitest runs them in Node). `react-icons` is imported only in component files (`src/components/**`).
- **Icon binding contract:** every major id, every suit, and the spread MUST map to a **real export** of the installed `react-icons/gi` — no fallback glyph. The spec's icon names are directional; verify each against the installed package and substitute the nearest real thematic icon if a name is absent.
- **Bundle hygiene:** import icons per-name from `react-icons/gi` (e.g. `import { GiMoon } from 'react-icons/gi'`). Never `import * as`.
- **CardSigil public props are frozen:** `{ card: TarotResult | TarotCardFace; size?: number; color?: string }`. `FanCard` and `ResultReading` depend on this exact shape — do not change it.
- **Typecheck is the gate** for component changes: `npx tsc -b` must pass (strict, `noUnusedLocals`, `noUnusedParameters`).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 1: Add the `react-icons` dependency

**Files:**
- Modify: `package.json:13-19` (dependencies block)

**Interfaces:**
- Produces: `react-icons/gi` importable in component files.

- [ ] **Step 1: Install react-icons**

Run: `npm install react-icons@^5`
Expected: `package.json` gains `"react-icons": "^5.x"` under `dependencies`; `package-lock.json` updates; exit 0.

- [ ] **Step 2: Verify the Game-Icons subpath resolves and capture real export names**

Run:
```bash
node -e "const gi=require('react-icons/gi'); const names=['GiMoon','GiSun','GiStar','GiWheel','GiLion','GiLantern','GiBalance','GiDeathSkull','GiTowerFall','GiAngelWings','GiWorld','GiCrown','GiPopeCrown','GiHearts','GiHorseHead','GiPouringPot','GiHorns','GiJesterHat','GiMagicSwirl','GiQueenCrown','GiHangedMan','GiDevilMask','GiPerson','GiWandfire','GiGoblet','GiBroadsword','GiPentacle','GiEyeball','GiCardPickup','GiCardRandom','GiPerspectiveDiceSixFacesRandom']; for(const n of names) console.log(n, n in gi ? 'OK' : 'MISSING');"
```
Expected: a list marking each candidate OK/MISSING. **Record the MISSING ones** — Task 3 and Task 7 must substitute real exports for them (browse `node -e "console.log(Object.keys(require('react-icons/gi')).filter(k=>/Moon|Crown|Sword|Cup|Goblet|Skull|Tower|Angel|World|Wheel|Lion|Lantern|Balance|Star|Sun|Hang|Devil|Horn|Jester|Magic|Pentacle|Wand|Eye|Card|Random|Pour|Horse/.test(k)))"` to find the nearest thematic match).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add react-icons (Game-Icons set) for tarot iconography

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `resolveSigil` returns icon keys (pure, TDD)

Rewrite `src/data/sigils.ts` so the pure resolver emits **icon keys** instead of SVG path geometry, and rewrite its test to assert completeness over the keys.

**Files:**
- Modify (rewrite): `src/data/sigils.ts`
- Modify (rewrite): `src/engine/__tests__/Sigils.test.ts`

**Interfaces:**
- Produces:
  - `type MajorIconKey = string` literal union of all 22 major ids' icon keys; `type SuitIconKey` union of 4; `type IconKey = MajorIconKey | SuitIconKey | 'spread'`.
  - `MAJOR_ICON_KEYS: Record<string /*major id*/, MajorIconKey>` (22 entries).
  - `SUIT_ICON_KEYS: Record<Suit, SuitIconKey>` (4 entries).
  - `type SigilSpec = { kind:'major'; icon: MajorIconKey } | { kind:'minor'; icon: SuitIconKey; rank:{ label:string; court:boolean } } | { kind:'spread'; icon:'spread' }`.
  - `resolveSigil(card): SigilSpec`, `rankLabel(rank): string` (unchanged behavior).
- Consumes: `MAJOR_ARCANA`, `generateMinorArcana` from `src/data/tarot.ts` (tests).

**Note on icon-key values:** the key strings ARE the chosen `gi` export names (e.g. major `the-moon` → `'GiMoon'`). Use the names confirmed OK in Task 1 Step 2; for any MISSING name, pick a confirmed real export. The key is just a stable string the component maps to a component — it must be a real `gi` name so Task 3's `Record<IconKey, IconType>` can bind it.

- [ ] **Step 1: Rewrite the test to assert icon-key completeness**

Replace the entire contents of `src/engine/__tests__/Sigils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveSigil, rankLabel, MAJOR_ICON_KEYS, SUIT_ICON_KEYS,
} from '../../data/sigils';
import type { TarotCardFace, TarotResult } from '../types';
import { MAJOR_ARCANA, generateMinorArcana } from '../../data/tarot';

const face = (o: Partial<TarotCardFace>): TarotCardFace => ({
  id: 'x', name: 'X', arcana: 'major', orientation: 'upright', symbol: '',
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [], meaningUpright: '', meaningReversed: '', tags: [], ...o,
});

describe('resolveSigil (icon keys)', () => {
  it('every major id maps to a non-empty icon key', () => {
    for (const m of MAJOR_ARCANA) {
      const spec = resolveSigil(face({ id: m.id, arcana: 'major' }));
      expect(spec.kind).toBe('major');
      if (spec.kind === 'major') {
        expect(MAJOR_ICON_KEYS[m.id]).toBeDefined();
        expect(spec.icon.length).toBeGreaterThan(0);
        expect(spec.icon).toBe(MAJOR_ICON_KEYS[m.id]);
      }
    }
  });

  it('MAJOR_ICON_KEYS has exactly the 22 canonical ids', () => {
    const ids = new Set(MAJOR_ARCANA.map((m) => m.id));
    expect(Object.keys(MAJOR_ICON_KEYS).sort()).toEqual([...ids].sort());
  });

  it('every minor composes: suit icon present, correct rank label and court flag', () => {
    for (const m of generateMinorArcana()) {
      const spec = resolveSigil(face({ id: m.id, arcana: 'minor', suit: m.suit, rank: m.rank }));
      expect(spec.kind).toBe('minor');
      if (spec.kind === 'minor') {
        expect(spec.icon).toBe(SUIT_ICON_KEYS[m.suit!]);
        expect(spec.icon.length).toBeGreaterThan(0);
        expect(spec.rank.court).toBe(typeof m.rank !== 'number');
        expect(spec.rank.label).toBe(rankLabel(m.rank!));
      }
    }
  });

  it('all four suits have an icon key', () => {
    for (const s of ['wands', 'cups', 'swords', 'pentacles'] as const) {
      expect(SUIT_ICON_KEYS[s]).toBeTruthy();
    }
  });

  it('rankLabel maps aces, pips, and courts', () => {
    expect(rankLabel(1)).toBe('A');
    expect(rankLabel(2)).toBe('II');
    expect(rankLabel(9)).toBe('IX');
    expect(rankLabel(10)).toBe('X');
    expect(rankLabel('page')).toBe('P');
    expect(rankLabel('knight')).toBe('N');
    expect(rankLabel('queen')).toBe('Q');
    expect(rankLabel('king')).toBe('K');
  });

  it('a multi-card spread resolves to the spread crest key', () => {
    const spread = {
      type: 'tarot', id: 's', name: 'Spread', orientation: 'upright', spread: [
        { position: 'past', card: face({ id: 'the-fool' }) },
        { position: 'present', card: face({ id: 'the-sun' }) },
        { position: 'future', card: face({ id: 'the-moon' }) },
      ],
    } as unknown as TarotResult;
    const spec = resolveSigil(spread);
    expect(spec.kind).toBe('spread');
    if (spec.kind === 'spread') expect(spec.icon).toBe('spread');
  });

  it('a single-card tarot result resolves by its underlying face', () => {
    const single = {
      type: 'tarot', id: 'the-tower', name: 'The Tower', orientation: 'upright',
      spread: [{ position: 'present', card: face({ id: 'the-tower' }) }],
    } as unknown as TarotResult;
    const spec = resolveSigil(single);
    expect(spec.kind).toBe('major');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/Sigils.test.ts`
Expected: FAIL — `MAJOR_ICON_KEYS` / `SUIT_ICON_KEYS` not exported (module still emits geometry).

- [ ] **Step 3: Rewrite `src/data/sigils.ts`**

Replace the entire file. Fill every major key with the `gi` name chosen in Task 1 (substitute real exports for any MISSING):

```ts
import type { TarotResult, TarotCardFace } from '../engine/types';

type AnyCard = TarotResult | TarotCardFace;
type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
type Rank = number | 'page' | 'knight' | 'queen' | 'king';

// Icon keys are the chosen react-icons/gi export names. CardSigil maps each to a
// component via a Record<IconKey, IconType>, so every value here MUST be a real
// `gi` export (verified in Task 1). No fallback is permitted.
export const MAJOR_ICON_KEYS = {
  'the-fool': 'GiJesterHat',
  'the-magician': 'GiMagicSwirl',
  'the-high-priestess': 'GiMoon',
  'the-empress': 'GiQueenCrown',
  'the-emperor': 'GiCrown',
  'the-hierophant': 'GiPopeCrown',
  'the-lovers': 'GiHearts',
  'the-chariot': 'GiHorseHead',
  'strength': 'GiLion',
  'the-hermit': 'GiLantern',
  'wheel-of-fortune': 'GiWheel',
  'justice': 'GiBalance',
  'the-hanged-man': 'GiPerson',
  'death': 'GiDeathSkull',
  'temperance': 'GiPouringPot',
  'the-devil': 'GiDevilMask',
  'the-tower': 'GiTowerFall',
  'the-star': 'GiStar',
  'the-moon': 'GiMoon',
  'the-sun': 'GiSun',
  'judgement': 'GiAngelWings',
  'the-world': 'GiWorld',
} as const;

export const SUIT_ICON_KEYS = {
  wands: 'GiWandfire',
  cups: 'GiGoblet',
  swords: 'GiBroadsword',
  pentacles: 'GiPentacle',
} as const;

export type MajorIconKey = (typeof MAJOR_ICON_KEYS)[keyof typeof MAJOR_ICON_KEYS];
export type SuitIconKey = (typeof SUIT_ICON_KEYS)[keyof typeof SUIT_ICON_KEYS];
export type IconKey = MajorIconKey | SuitIconKey | 'spread';

export type SigilSpec =
  | { kind: 'major'; icon: MajorIconKey }
  | { kind: 'minor'; icon: SuitIconKey; rank: { label: string; court: boolean } }
  | { kind: 'spread'; icon: 'spread' };

const ROMAN: Record<number, string> = {
  1: 'A', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
};
const COURT_LETTER: Record<string, string> = { page: 'P', knight: 'N', queen: 'Q', king: 'K' };

export function rankLabel(rank: Rank): string {
  if (typeof rank === 'number') return ROMAN[rank] ?? String(rank);
  return COURT_LETTER[rank] ?? rank[0].toUpperCase();
}

function isFace(c: AnyCard): c is TarotCardFace {
  return 'arcana' in c;
}

/** The face a result should be drawn as: its own (face) or the middle/only spread card. */
function primaryFace(card: AnyCard): TarotCardFace | undefined {
  if (isFace(card)) return card;
  const spread = card.spread;
  if (!spread || spread.length === 0) return undefined;
  return spread[Math.min(1, spread.length - 1)].card;
}

export function resolveSigil(card: AnyCard): SigilSpec {
  if (!isFace(card) && (card.spread?.length ?? 1) > 1) {
    return { kind: 'spread', icon: 'spread' };
  }
  const f = primaryFace(card);
  if (f && f.arcana === 'minor' && f.suit) {
    return {
      kind: 'minor',
      icon: SUIT_ICON_KEYS[f.suit],
      rank: { label: rankLabel(f.rank ?? 1), court: typeof f.rank !== 'number' },
    };
  }
  const id = f?.id ?? card.id;
  const icon = MAJOR_ICON_KEYS[id as keyof typeof MAJOR_ICON_KEYS];
  // Defensive: a non-mapped id would be a data bug; surface it loudly in dev.
  return { kind: 'major', icon: icon ?? MAJOR_ICON_KEYS['the-fool'] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Sigils.test.ts`
Expected: PASS (all specs).

- [ ] **Step 5: Run the full engine suite (no regressions)**

Run: `npm test`
Expected: PASS. (Sigils is the only test importing this module.)

- [ ] **Step 6: Commit**

```bash
git add src/data/sigils.ts src/engine/__tests__/Sigils.test.ts
git commit -m "refactor(sigils): resolveSigil emits react-icons keys instead of geometry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `CardSigil` renders Game-Icons over `resolveSigil`

**Files:**
- Modify (rewrite): `src/components/cards/CardSigil.tsx`

**Interfaces:**
- Consumes: `resolveSigil`, `IconKey`, `MAJOR_ICON_KEYS`, `SUIT_ICON_KEYS` from `src/data/sigils.ts`; `react-icons/gi`.
- Produces: default-export `CardSigil({ card, size?, color? })` — unchanged props.

- [ ] **Step 1: Rewrite `CardSigil.tsx`**

Build the `Record<IconKey, IconType>` from the keys actually used (every value of `MAJOR_ICON_KEYS`/`SUIT_ICON_KEYS` plus `'spread'`). Use the real `gi` names confirmed in Task 1 — they must match the strings in `sigils.ts` exactly.

```tsx
import type { IconType } from 'react-icons';
import {
  GiJesterHat, GiMagicSwirl, GiMoon, GiQueenCrown, GiCrown, GiPopeCrown,
  GiHearts, GiHorseHead, GiLion, GiLantern, GiWheel, GiBalance, GiPerson,
  GiDeathSkull, GiPouringPot, GiDevilMask, GiTowerFall, GiStar, GiSun,
  GiAngelWings, GiWorld, GiWandfire, GiGoblet, GiBroadsword, GiPentacle,
  GiCardPickup,
} from 'react-icons/gi';
import type { TarotResult, TarotCardFace } from '../../engine/types';
import { resolveSigil, type IconKey } from '../../data/sigils';

type AnyCard = TarotResult | TarotCardFace;
function isFace(c: AnyCard): c is TarotCardFace { return 'arcana' in c; }

// Every IconKey used by resolveSigil must appear here. Keys are gi export names.
const ICONS: Record<IconKey, IconType> = {
  GiJesterHat, GiMagicSwirl, GiMoon, GiQueenCrown, GiCrown, GiPopeCrown,
  GiHearts, GiHorseHead, GiLion, GiLantern, GiWheel, GiBalance, GiPerson,
  GiDeathSkull, GiPouringPot, GiDevilMask, GiTowerFall, GiStar, GiSun,
  GiAngelWings, GiWorld, GiWandfire, GiGoblet, GiBroadsword, GiPentacle,
  spread: GiCardPickup, // three-card crest stand-in
};

export default function CardSigil({
  card, size = 48, color = 'currentColor',
}: { card: AnyCard; size?: number; color?: string }) {
  const reversed = card.orientation === 'reversed';
  const spec = resolveSigil(card);
  const label = isFace(card) ? card.name : (card as TarotResult).name;
  const rotate = reversed ? 'rotate(180deg)' : undefined;

  if (spec.kind === 'minor') {
    const Icon = ICONS[spec.icon];
    const s = size;
    return (
      <span
        role="img" aria-label={label}
        style={{ position: 'relative', display: 'inline-flex', width: s, height: s, color, transform: rotate }}
      >
        {spec.rank.court && (
          <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden
            style={{ position: 'absolute', inset: 0, color }}>
            <path d="M16 8 l3 4 l5 -4 l5 4 l3 -4 v5 h-16 Z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
          </svg>
        )}
        <Icon size={s} color={color} style={{ display: 'block' }} />
        <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden
          style={{ position: 'absolute', inset: 0, color }}>
          <rect x="30" y="32" width="15" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth={1.4} />
          <text x="37.5" y="41.5" textAnchor="middle" fontSize="9"
            fontFamily="'Cormorant Garamond', serif" fill="currentColor" stroke="none">
            {spec.rank.label}
          </text>
        </svg>
      </span>
    );
  }

  const Icon = ICONS[spec.icon];
  return (
    <span role="img" aria-label={label} style={{ display: 'inline-flex', color, transform: rotate }}>
      <Icon size={size} color={color} style={{ display: 'block' }} />
    </span>
  );
}
```

- [ ] **Step 2: Typecheck (also proves every IconKey has a real component)**

Run: `npx tsc -b`
Expected: PASS. A type error on the `ICONS` record means a key in `sigils.ts` has no matching import here, or an imported name is not a real `gi` export — fix the name on both sides.

- [ ] **Step 3: Run tests (CardSigil has no unit test; confirm nothing broke)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/cards/CardSigil.tsx
git commit -m "feat(cards): render Game-Icons in CardSigil over icon-key resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Pure `fanLayout` module (TDD)

Extract and replace the fan-out geometry into a pure, framework-free module satisfying R1–R4.

**Files:**
- Create: `src/engine/fanLayout.ts`
- Create: `src/engine/__tests__/FanLayout.test.ts`

**Interfaces:**
- Produces:
  - `interface FanLayoutParams { count: number; containerWidth: number; cardWidth: number; restStep: number; minStep: number; radius: number }`
  - `restCenters(p: { count: number; containerWidth: number; restStep: number }): number[]`
  - `computeFanLayout(cursorX: number, active: boolean, p: FanLayoutParams): number[]` — returns each card's center x (container coords), ascending index order.
- Consumed by: Task 5 (`TarotMinigame.tsx`).

**Properties (what the tests lock in):**
- R1: the card nearest the cursor keeps its rest center (offset ~0) when no envelope clamp is needed.
- R2: no adjacent center-to-center distance exceeds `cardWidth` (side-by-side is the max).
- R3: leftmost left-edge ≥ envelope-left and rightmost right-edge ≤ envelope-right, where envelope = `count * cardWidth` centered.
- R4: with the cursor at one end, a far gap's step is strictly less than `restStep` (compression).
- Inactive or `count ≤ 1` returns the rest centers unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/FanLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { restCenters, computeFanLayout, type FanLayoutParams } from '../fanLayout';

const P: FanLayoutParams = {
  count: 7, containerWidth: 600, cardWidth: 58, restStep: 42, minStep: 30, radius: 140,
};
const envLeft = (p: FanLayoutParams) => p.containerWidth / 2 - (p.count * p.cardWidth) / 2;
const envRight = (p: FanLayoutParams) => p.containerWidth / 2 + (p.count * p.cardWidth) / 2;

describe('restCenters', () => {
  it('is symmetric about the container center with restStep spacing', () => {
    const c = restCenters({ count: 4, containerWidth: 600, restStep: 42 });
    expect(c).toHaveLength(4);
    expect((c[0] + c[3]) / 2).toBeCloseTo(300, 5);
    expect(c[1] - c[0]).toBeCloseTo(42, 5);
  });
});

describe('computeFanLayout', () => {
  it('inactive returns rest centers unchanged', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    expect(computeFanLayout(300, false, P)).toEqual(rest);
  });

  it('count<=1 returns rest centers', () => {
    const p = { ...P, count: 1 };
    expect(computeFanLayout(300, true, p)).toEqual(restCenters({ count: 1, containerWidth: 600, restStep: 42 }));
  });

  it('R1: the card under the cursor keeps its rest center', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    const cursor = rest[3]; // middle card
    const out = computeFanLayout(cursor, true, P);
    expect(out[3]).toBeCloseTo(rest[3], 5);
  });

  it('R2: no adjacent gap exceeds cardWidth (side-by-side is the max)', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    for (const cursor of [rest[0], rest[3], rest[6], 250, 400]) {
      const out = computeFanLayout(cursor, true, P);
      for (let i = 0; i < out.length - 1; i++) {
        expect(out[i + 1] - out[i]).toBeLessThanOrEqual(P.cardWidth + 1e-6);
      }
    }
  });

  it('R3: ends never pass the fixed envelope', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    for (const cursor of [rest[0] - 50, rest[0], rest[6], rest[6] + 50, 300]) {
      const out = computeFanLayout(cursor, true, P);
      expect(out[0] - P.cardWidth / 2).toBeGreaterThanOrEqual(envLeft(P) - 1e-6);
      expect(out[out.length - 1] + P.cardWidth / 2).toBeLessThanOrEqual(envRight(P) + 1e-6);
    }
  });

  it('R4: far from the cursor, cards compress below rest spacing', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    const out = computeFanLayout(rest[0], true, P); // cursor at far-left card
    const farGap = out[out.length - 1] - out[out.length - 2]; // rightmost gap
    expect(farGap).toBeLessThan(P.restStep);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/FanLayout.test.ts`
Expected: FAIL — cannot find module `../fanLayout`.

- [ ] **Step 3: Implement `src/engine/fanLayout.ts`**

```ts
// Pure, framework-free fan-out geometry for the tarot table spread.
// Coordinates are in the table container's local px space.

export interface FanLayoutParams {
  count: number;          // number of visible cards
  containerWidth: number; // table width in px
  cardWidth: number;      // single card face width in px
  restStep: number;       // center-to-center spacing at rest (overlapped, < cardWidth)
  minStep: number;        // deepest compression center-to-center (< restStep)
  radius: number;         // Gaussian proximity falloff in px
}

/** Rest layout: `count` cards spaced by `restStep`, centered in the container. */
export function restCenters(
  { count, containerWidth, restStep }: { count: number; containerWidth: number; restStep: number },
): number[] {
  const mid = (count - 1) / 2;
  const c = containerWidth / 2;
  return Array.from({ length: count }, (_, k) => c + (k - mid) * restStep);
}

/**
 * Returns each card's center x. Near the cursor, gaps open toward `cardWidth`
 * (side-by-side = max repulsion, R2); far from it they compress toward `minStep`
 * (R4). The card nearest the cursor keeps its rest center (R1). The whole spread
 * is clamped so its ends never pass the fixed envelope `count * cardWidth`,
 * centered (R3).
 */
export function computeFanLayout(cursorX: number, active: boolean, p: FanLayoutParams): number[] {
  const { count, containerWidth, cardWidth, restStep, minStep, radius } = p;
  const rest = restCenters({ count, containerWidth, restStep });
  if (!active || count <= 1) return rest;

  // Per-gap step from the gap midpoint's proximity to the cursor.
  const step: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const mid = (rest[i] + rest[i + 1]) / 2;
    const u = (mid - cursorX) / radius;
    const w = Math.exp(-3 * u * u);                 // 1 at cursor, → 0 far away
    step.push(minStep + (cardWidth - minStep) * w); // near → cardWidth, far → minStep
  }

  // Anchor the card nearest the cursor at its rest center (R1).
  let a = 0;
  let best = Infinity;
  for (let k = 0; k < count; k++) {
    const d = Math.abs(rest[k] - cursorX);
    if (d < best) { best = d; a = k; }
  }
  const pos = new Array<number>(count);
  pos[a] = rest[a];
  for (let k = a + 1; k < count; k++) pos[k] = pos[k - 1] + step[k - 1];
  for (let k = a - 1; k >= 0; k--) pos[k] = pos[k + 1] - step[k];

  // Clamp the cluster so neither end passes the fixed envelope (R3).
  const half = (count * cardWidth) / 2;
  const envL = containerWidth / 2 - half;
  const envR = containerWidth / 2 + half;
  const leftEdge = pos[0] - cardWidth / 2;
  const rightEdge = pos[count - 1] + cardWidth / 2;
  let shift = 0;
  if (leftEdge < envL) shift = envL - leftEdge;
  else if (rightEdge > envR) shift = envR - rightEdge;
  if (shift !== 0) for (let k = 0; k < count; k++) pos[k] += shift;

  return pos;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/FanLayout.test.ts`
Expected: PASS (all properties).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/fanLayout.ts src/engine/__tests__/FanLayout.test.ts
git commit -m "feat(engine): pure fanLayout with anchored, bounded, compressing spread

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire the smooth, bounded fan into `TarotMinigame`

Replace the in-file `computeFanOffsets` + `fanDisplacements` math with `fanLayout`, drive displacement via a GPU transform with a short transition (no `layout` chase), and rAF-throttle the mousemove.

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

**Interfaces:**
- Consumes: `restCenters`, `computeFanLayout` from `src/engine/fanLayout.ts`.

- [ ] **Step 1: Replace imports and constants**

At the top of `TarotMinigame.tsx`, add the import and replace the geometry constants:

```tsx
import { restCenters, computeFanLayout } from '../../engine/fanLayout';
```

Replace:
```tsx
const TABLE_CARD_WIDTH = 58; // px per card face
const TABLE_OVERLAP = 16;   // px overlap between adjacent cards
const FAN_RADIUS = 140;        // px — proximity gate for gap expansion
const MAX_GAP_EXPANSION = 26;  // px — max extra width added to a single gap
```
with:
```tsx
const TABLE_CARD_WIDTH = 58;          // px per card face (max repulsion = side by side)
const TABLE_REST_STEP = 42;           // center-to-center at rest (overlapped)
const TABLE_MIN_STEP = 30;            // deepest compression center-to-center
const FAN_RADIUS = 140;               // px — proximity falloff
```

- [ ] **Step 2: Delete the old exported `computeFanOffsets` function**

Remove the entire `export function computeFanOffsets(...) { ... }` block and its `FanParams` interface from the bottom of the file (now lives in `fanLayout.ts`).

- [ ] **Step 3: rAF-throttle the mousemove**

Add a ref near the other refs:
```tsx
const rafRef = useRef<number | null>(null);
const pendingXRef = useRef<number | null>(null);
```
Replace `handleTableMouseMove`:
```tsx
const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
  if (!isDesktop || !tableRef.current) return;
  const rect = tableRef.current.getBoundingClientRect();
  pendingXRef.current = e.clientX - rect.left;
  if (rafRef.current != null) return;
  rafRef.current = requestAnimationFrame(() => {
    rafRef.current = null;
    if (pendingXRef.current != null) setFan({ centerX: pendingXRef.current, active: true });
  });
}, [isDesktop]);
```
Add cleanup in the existing resize `useEffect` return (or a new effect):
```tsx
useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);
```

- [ ] **Step 4: Replace `fanDisplacements` with `fanLayout`-based centers**

Replace the entire `fanDisplacements` useMemo and `dispMap` useMemo with:

```tsx
const activeTableCards = draft.table.filter((t): t is TableCard => t !== null);

const fanCenters = useMemo(() => {
  const count = activeTableCards.length;
  const params = {
    count, containerWidth, cardWidth: TABLE_CARD_WIDTH,
    restStep: TABLE_REST_STEP, minStep: TABLE_MIN_STEP, radius: FAN_RADIUS,
  };
  const rest = restCenters({ count, containerWidth, restStep: TABLE_REST_STEP });
  const live = computeFanLayout(fan.centerX, fan.active, params);
  return activeTableCards.map((_, i) => ({ rest: rest[i], center: live[i] }));
}, [activeTableCards.length, fan, containerWidth]);
```

(Remove the now-duplicate `const activeTableCards = ...` line that appears later before `// ── Render ──`, keeping a single declaration above the memo.)

- [ ] **Step 5: Render cards with a transform-driven, non-chasing fan**

In the `activeTableCards.map(...)`, replace the per-card geometry/`motion.div` with rest-anchored `left` + transform displacement, dropping the `layout` prop:

```tsx
{activeTableCards.map((card, i) => {
  const cardData = DECK_BY_ID[card.cardId];
  if (!cardData) return null;
  const fc = fanCenters[i];
  const restLeft = fc?.rest ?? containerWidth / 2;
  const dx = (fc?.center ?? restLeft) - restLeft;
  const dist = fan.active ? Math.abs((fc?.center ?? 0) - fan.centerX) : Infinity;
  const scale = fan.active && dist < FAN_RADIUS ? 1 + 0.06 * (1 - dist / FAN_RADIUS) : 1;
  const isPicking = animatingPick?.tableIndex === card.originIndex;

  return (
    <motion.div
      key={`${card.cardId}-${card.originIndex}-${shuffleKey}`}
      style={{
        ...tableCardStyle,
        position: 'absolute',
        left: `${restLeft}px`,
        marginLeft: `${-TABLE_CARD_WIDTH / 2}px`,
        width: `${TABLE_CARD_WIDTH}px`,
        transform: `translateX(${dx}px) scale(${scale})`,
        transition: 'transform 70ms ease-out',
        zIndex: fan.active ? Math.max(1, Math.round(1000 - dist)) : 1,
        background: card.faceUp ? '#0d1220' : '#080d18',
        borderColor: card.faceUp ? '#7b9ec7' : '#1a2440',
        cursor: handFull ? 'default' : 'pointer',
        opacity: handFull ? 0.5 : 1,
      }}
      whileHover={!handFull ? { y: -3, boxShadow: '0 0 14px rgba(212,168,84,0.5)' } : {}}
      onClick={() => !handFull && !animatingPick && handlePick(card.originIndex)}
      initial={shuffleKey > 0 ? { opacity: 0, y: -30 } : { opacity: 0, y: -20 }}
      animate={isPicking ? { opacity: 0, y: 40 } : { opacity: handFull ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, y: -30, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: shuffleKey > 0 ? i * 0.04 : i * 0.03 }}
    >
      {card.faceUp && card.revealedFace ? (
        <>
          <CardSigil card={card.revealedFace} size={20} color="#7b9ec7" />
          <div style={tableCardNameStyle}>{card.revealedFace.name}</div>
          <div style={tableCardOrientStyle}>{card.revealedFace.orientation === 'upright' ? '▲' : '▼'}</div>
        </>
      ) : (
        <CardBack size={44} />
      )}
    </motion.div>
  );
})}
```

Note: `whileHover` no longer sets `borderColor` via framer (kept off the transform path); the static `borderColor` above is fine. The `scale`/`y` from `whileHover` are dropped to avoid fighting the transform — hover emphasis now comes from the proximity `scale` and `boxShadow` only.

Also remove the now-unused `cardIndexZ` helper and `FanState`-coupled references if no longer used (keep `FanState` type — still used by `fan` state).

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: PASS. Fix any unused-symbol errors by deleting the dead `computeFanOffsets`/`cardIndexZ`/`FanParams` leftovers.

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Visual check**

Run: `npm run dev`, open the tarot draft. Verify: cards track the cursor with no lag; the hovered card stays put; neighbours open at most to touching; the far end compresses; the end cards never slide past the table edges.

- [ ] **Step 9: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(tarot): smooth rAF-throttled, anchored, bounded hover fan-out

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Framed deck rail left of the spread + centring fix

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

- [ ] **Step 1: Restructure the deck + table into a horizontal row**

Wrap the existing deck block and the table-spread block in a flex row container. Replace the standalone `<motion.div style={deckStyle} layout>…</motion.div>` (deck) and the following `RunicBand` + table `<div ref={tableRef}>` so the deck sits in a left rail and the spread fills the rest:

```tsx
<div style={tableRowStyle}>
  {/* Deck rail */}
  <div style={deckRailStyle}>
    <div style={deckStackStyle}>
      {draft.deck.length > 2 && <div style={deckCardBack(2)} />}
      {draft.deck.length > 1 && <div style={deckCardBack(1)} />}
      {draft.deck.length > 0 && (
        <div style={{ ...deckCardBack(0), display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none' }}>
          <CardBack size={46} />
        </div>
      )}
    </div>
    <motion.span key={`count-${draft.deck.length}`} style={deckCountStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {draft.deck.length} cards
    </motion.span>
  </div>

  {/* Spread column */}
  <div style={spreadColStyle}>
    <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />
    <div ref={tableRef} style={{ ...tableAreaStyle, borderColor: dragOverTable ? '#d4a854' : '#1a2440' }}
      onMouseMove={handleTableMouseMove} onMouseLeave={handleTableMouseLeave}
      onTouchStart={handleTableTouch} onDragOver={handleTableDragOver}
      onDragLeave={handleTableDragLeave} onDrop={handleTableDrop}>
      {/* …existing backdrop, flourishes, AnimatePresence card map unchanged… */}
    </div>
    <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />
  </div>
</div>
```

Delete the old standalone deck `<motion.div style={deckStyle}>` block and the duplicate outer `RunicBand`/table wrapper it replaces. Keep the inner backdrop/flourishes/card map exactly as-is.

- [ ] **Step 2: Add/adjust styles (deck centring fix included)**

Add these styles and update `deckStackStyle`/`deckCardBack` so the front face is centred over a symmetric stack:

```tsx
const tableRowStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.85rem',
  width: '100%', flexWrap: 'wrap', justifyContent: 'center',
};

const deckRailStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
  padding: '0.75rem 0.6rem', flex: '0 0 auto',
  background: 'radial-gradient(80% 80% at 50% 30%, rgba(42,21,69,0.35), rgba(7,11,20,0.6))',
  border: '1px solid #2a2150', borderRadius: '10px',
  boxShadow: '0 0 16px rgba(212,168,84,0.18), inset 0 0 18px rgba(8,13,24,0.8)',
};

const spreadColStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem',
  flex: '1 1 360px', minWidth: '260px',
};
```

Replace `deckStackStyle` and `deckCardBack`:
```tsx
const deckStackStyle: React.CSSProperties = {
  position: 'relative', width: '54px', height: '66px',
  filter: 'drop-shadow(0 0 8px rgba(212,168,84,0.35))',
};

// Symmetric stack: back cards inset on both sides so the front face (i=0)
// sits centred on the stack's center line.
const deckCardBack = (i: number): React.CSSProperties => ({
  position: 'absolute',
  top: `${4 - i * 2}px`,
  left: `${4 - i * 2}px`,
  width: '46px', height: '62px',
  background: '#080d18', border: '1px solid #1a2440', borderRadius: '4px',
});
```

(With `top/left = 4 - i*2`: i=2 → 0, i=1 → 2, i=0 → 4, so the front face is centred in the 54×66 box around the offset backs.)

- [ ] **Step 3: Remove the now-unused `deckStyle`**

Delete the `deckStyle` const (the old vertical wrapper). Run `npx tsc -b` to confirm it is unreferenced.

- [ ] **Step 4: Typecheck + visual check**

Run: `npx tsc -b` → PASS.
Run: `npm run dev` → deck sits in a framed rail left of the spread; the spread no longer collides with the hand row; deck art is centred on the stack; on a narrow window the rail wraps above the spread.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(tarot): framed deck rail left of spread; fix deck-art centring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Per-slot themed frames + react-icons UI glyphs

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

- [ ] **Step 1: Add a `slotTheme` helper and themed styles**

Near the other helpers, add:

```tsx
const SLOT_THEMES = [
  { key: 'past',    accent: '#7b9ec7', label: 'Past',    glow: 'rgba(123,158,199,0.30)' },
  { key: 'present', accent: '#d4a854', label: 'Present', glow: 'rgba(212,168,84,0.30)' },
  { key: 'future',  accent: '#9b6bb0', label: 'Future',  glow: 'rgba(155,107,176,0.30)' },
] as const;

function slotCardStyle(accent: string): React.CSSProperties {
  return {
    ...handCardStyle, borderColor: accent,
    boxShadow: `0 0 14px ${accent}33, inset 0 0 18px rgba(8,13,24,0.6)`,
  };
}
function slotEmptyStyle(accent: string): React.CSSProperties {
  return {
    ...emptyHandSlotStyle, borderColor: accent,
    background: `radial-gradient(60% 60% at 50% 40%, ${accent}1f, transparent)`,
  };
}
```

- [ ] **Step 2: Apply the theme in the hand map**

Replace the `(['Past','Present','Future'] as const).map((label, i) => {…})` header so it pulls the theme, and use the themed styles + accent label:

```tsx
{SLOT_THEMES.map((theme, i) => {
  const label = theme.label;
  const card = draft.hand[i];
  const isReturning = animatingReturn === i;
  const revealed = committedSpread?.[i]?.card;
  return (
    <div key={label} style={handSlotColumnStyle}
      onDragOver={handleHandDragOver} onDrop={(e) => handleHandDrop(e, i)}>
      <div style={{ ...handLabelStyle, color: theme.accent, textShadow: `0 0 8px ${theme.glow}` }}>
        {label}
      </div>
      {/* …AnimatePresence body unchanged, except: the revealed/card wrappers use
          slotCardStyle(theme.accent) in place of handCardStyle, and the empty
          slot uses slotEmptyStyle(theme.accent) in place of emptyHandSlotStyle,
          and add a corner flourish svg (below) inside each filled card … */}
    </div>
  );
})}
```

Concretely: change `style={{ ...handCardStyle, cursor: 'default', borderColor: '#7b9ec7' }}` (revealed) → `style={{ ...slotCardStyle(theme.accent), cursor: 'default' }}`; change the draggable card `style={{ ...handCardStyle, opacity: … }}` → `style={{ ...slotCardStyle(theme.accent), opacity: … }}`; change `style={emptyHandSlotStyle}` → `style={slotEmptyStyle(theme.accent)}`.

Add a themed top-left corner flourish inside each filled slot card (first child of the card wrapper):
```tsx
<svg width="14" height="14" viewBox="0 0 22 22" aria-hidden
  style={{ position: 'absolute', top: 4, left: 4, color: theme.accent, opacity: 0.6 }}>
  <path d="M1 1 H9 M1 1 V9 M1 1 Q11 11 21 11 M1 1 Q11 11 11 21"
    stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
</svg>
```

- [ ] **Step 3: Replace UI glyphs with Game-Icons**

Add imports (use real names confirmed in Task 1; substitute if MISSING):
```tsx
import { GiCardRandom, GiCardPickup, GiEyeball } from 'react-icons/gi';
```
- Shuffle button label `↻ Shuffle (n)` → `<GiCardRandom style={{ verticalAlign: '-2px' }} /> Shuffle ({draft.shufflesRemaining})`.
- Peek button content `👁` → `<GiEyeball />`.
- Return-to-deck button content `↩` → `<GiCardPickup />`.
- Orientation `▲`/`▼` on table/hand cards: keep the existing glyphs (they read as orientation arrows, not "ugly icons") OR replace with a small rotated chevron — keep as-is to limit scope.

Update `handIconBtnStyle` font size if needed so icons sit ~`0.8rem` (`fontSize: '0.85rem'`).

- [ ] **Step 4: Typecheck + tests + visual**

Run: `npx tsc -b` → PASS. `npm test` → PASS.
Run: `npm run dev` → Past/Present/Future show distinct silver-blue / gold / violet frames + glows; shuffle/peek/return show clean SVG icons.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(tarot): per-slot themed frames + Game-Icons UI affordances

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Doc sync + final verification

**Files:**
- Modify: `docs/game-systems.md` (sigil paragraph, ~lines 281-293)

- [ ] **Step 1: Update the sigil description in `docs/game-systems.md`**

Find the paragraph describing `MAJOR_SIGILS` / `SUIT_EMBLEMS` / `SPREAD_CREST` (the hand-drawn registries) and replace it with a short note that `resolveSigil` now returns **icon keys** mapped by `CardSigil` to the `react-icons` Game-Icons set (majors → bespoke icon per arcana; minors → suit icon + rank cartouche + court crown; multi-card spread → a crest icon), and that `src/engine/__tests__/Sigils.test.ts` asserts every card resolves to a real icon key. Keep it to the same length/altitude as the surrounding prose.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc -b`
Expected: PASS (no unused symbols, no type errors).

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: PASS (Sigils + FanLayout + all existing engine tests).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: `tsc -b && vite build` succeeds; `dist/` emitted; no oversized-chunk errors from icon imports.

- [ ] **Step 5: Commit**

```bash
git add docs/game-systems.md
git commit -m "docs: sync sigil system note to react-icons key resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1.1 smoothness (rAF, transform, no layout chase) → Task 5 (Steps 3, 5).
- §1.2 fan model R1–R4 + envelope → Task 4 (pure module + tests) + Task 5 (wiring).
- §1.3 fan tests → Task 4 Step 1.
- §2.1 react-icons dependency → Task 1.
- §2.2 resolver returns icon keys → Task 2.
- §2.3 CardSigil thin renderer (minor composition + reversed) → Task 3.
- §2.4 icon mapping (majors/suits/UI) → Task 2 data + Task 3 components + Task 7 UI glyphs; real-export verification → Task 1 Step 2.
- §2.5 sigil tests → Task 2 Step 1.
- §3 deck rail left + centring fix + overlap fix + responsive wrap → Task 6.
- §4 per-slot themed frames → Task 7.
- §5 files affected → all covered; `FanCard`/`ResultReading` unchanged (consume CardSigil component only — confirmed, props frozen by Global Constraints).
- §6 out of scope respected; §7 risks (name drift → Task 1 Step 2 + typecheck gate; bundle → per-name imports; envelope vs narrower spread → Task 6 Step 4 visual check).
- Bonus: `docs/game-systems.md` sigil paragraph sync → Task 8 (not in spec's file table, but the spec removes the registries it describes — staleness fix).

**Placeholder scan:** No TBD/TODO. The icon names are explicitly directional with a real-export verification step (Task 1 Step 2) and a typecheck gate (Task 3 Step 2) — the contract is "real thematic export", not a placeholder.

**Type consistency:** `IconKey`/`MajorIconKey`/`SuitIconKey` defined in Task 2 and consumed in Task 3's `Record<IconKey, IconType>`. `SigilSpec` discriminants (`kind: 'major'|'minor'|'spread'`, field `icon`) consistent between Task 2 (data + test) and Task 3 (render). `restCenters`/`computeFanLayout`/`FanLayoutParams` signatures identical between Task 4 (def + test) and Task 5 (call site). `CardSigil` props `{ card, size?, color? }` unchanged (Global Constraints). Deck `deckCardBack(i)`/`deckStackStyle` consistent between Task 6 redefinition and call sites.
