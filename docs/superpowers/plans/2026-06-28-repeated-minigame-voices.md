# Repeated-Minigame Reading Voices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the woven *Interpretation* from repeating prose when the same minigame type runs multiple times in one reading, by giving each divination type its own reading voice that aggregates same-role draws and varies framing across roles.

**Architecture:** Replace the monolithic `describeDraw` type-switch with a registry of per-type `MinigameVoice` objects. Each voice exposes `describeOne` (single draw, occurrence-aware) and `describeGroup` (collapse ≥2 same-type, same-role draws). `ReadingComposer` computes per-type occurrence ordinals, groups each role's draws by type, and dispatches to the right voice method. All new prose strings live in `reading-fragments.ts`.

**Tech Stack:** TypeScript (strict), Vitest. Framework-free engine code under `src/engine/`. No React changes.

## Global Constraints

- Engine code is framework-free: **no React or DOM imports** anywhere under `src/engine/`.
- **Deterministic only:** no `Math.random()` in any new narrative code — variation must derive from the existing seed/rotation/`stableIndex` mechanisms.
- **Single-draw output must stay byte-identical** to today's per type. The regression guard is [src/engine/__tests__/NarrativeAssembler.test.ts:95](../../../src/engine/__tests__/NarrativeAssembler.test.ts#L95) (`"the dice, settling on 10"`) and the whole of [src/engine/__tests__/DrawVoice.test.ts](../../../src/engine/__tests__/DrawVoice.test.ts).
- `describeDraw(slot, role)` and `favBandOf(value)` must remain exported from [src/engine/narrative/drawVoice.ts](../../../src/engine/narrative/drawVoice.ts) (existing callers: `ReadingComposer`, `ProseBuilder`, `DrawVoice.test.ts`).
- Typecheck with `npx tsc -b` (strict, `noUnusedLocals`, `noUnusedParameters`). Run the engine suite with `npx vitest run`.
- `docs/game-systems.md` documents affinities/effects, **not** draw framing — no sync needed for this work.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/engine/narrative/voices/shared.ts` (new) | Leaf module: `favBandOf`, `stableIndex`, `withArticle`, `gloss`, `verbPhrase`, `joinSeq`, `joinAnd`, `meanFavorability`. No imports from `drawVoice`/`voices` (breaks cycles). |
| `src/engine/narrative/voices/types.ts` (new) | `DrawOccurrence` + `MinigameVoice` interface. |
| `src/engine/narrative/voices/index.ts` (new) | Per-type voice objects (tarot/d20/iching/strings) + generic fallback + `voiceFor(type)` registry. |
| `src/engine/narrative/drawVoice.ts` (modify) | Becomes a compat shim: re-export `favBandOf`; `describeDraw` delegates to `voiceFor(...).describeOne(...)`. |
| `src/data/reading-fragments.ts` (modify) | New `drawFraming` block: variant scaffolds + group lead/join strings. |
| `src/engine/narrative/ReadingComposer.ts` (modify) | Occurrence pass + per-role type-grouping; dispatch to voices. |
| `src/engine/__tests__/MinigameVoices.test.ts` (new) | Voice-level tests: single-draw parity, variation, aggregation, fallback. |
| `src/engine/__tests__/NarrativeAssembler.test.ts` (modify) | Integration tests for repeated minigames. |

---

## Task 1: Extract shared narrative helpers + voice interface

Pure refactor. Moves the private helpers out of `drawVoice.ts` into a leaf module and adds the voice interface. No behavior change; the existing switch in `describeDraw` stays but imports its helpers from the new module. Existing tests must stay green.

**Files:**
- Create: `src/engine/narrative/voices/shared.ts`
- Create: `src/engine/narrative/voices/types.ts`
- Modify: `src/engine/narrative/drawVoice.ts`
- Test: existing `src/engine/__tests__/DrawVoice.test.ts` (unchanged, must pass)

**Interfaces:**
- Produces: `favBandOf(value: number): FavBand`, `stableIndex(key: string, len: number): number`, `withArticle(name: string): string`, `gloss(text: string): string`, `verbPhrase(role: ModifierRole, dims: DimensionValues, seedKey: string): string`, `joinSeq(items: string[], last: string, mid: string): string`, `joinAnd(items: string[], last: string, mid: string): string`, `meanFavorability(slots: { dimensions: DimensionValues }[]): number` — all from `voices/shared.ts`.
- Produces: `interface DrawOccurrence { index: number; total: number }` and `interface MinigameVoice { type; describeOne; describeGroup }` from `voices/types.ts`.

- [ ] **Step 1: Create `voices/shared.ts` with the moved helpers + new join/mean helpers**

```ts
import type { ModifierRole, DimensionValues } from '../../types';
import type { FavBand } from '../types';
import { READING_FRAGMENTS } from '../../../data/reading-fragments';

export function favBandOf(value: number): FavBand {
  if (value >= 0.5) return 'high';
  if (value <= -0.5) return 'low';
  return 'neutral';
}

/** Deterministic, rotation-free index into a pool, varied per draw. */
export function stableIndex(key: string, len: number): number {
  if (len <= 0) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

/** Prefix "The " for a card name unless it already carries an article. */
export function withArticle(name: string): string {
  return /^(the|a|an) /i.test(name) ? name : `The ${name}`;
}

/** Trim a flavor sentence to a short, lower-cased gloss phrase. */
export function gloss(text: string): string {
  const first = text.split(/[.;—]/)[0]?.trim() ?? '';
  if (!first) return '';
  return first.charAt(0).toLowerCase() + first.slice(1);
}

export function verbPhrase(role: ModifierRole, dims: DimensionValues, seedKey: string): string {
  const band = favBandOf(dims.favorability);
  const pool = READING_FRAGMENTS.verbPhrases[role][band];
  return pool[stableIndex(seedKey, pool.length)];
}

/** Join with `mid` between items and `last` before the final item (sequence style). */
export function joinSeq(items: string[], last: string, mid: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(mid)}${last}${items[items.length - 1]}`;
}

/** Same as joinSeq; named for list-of-names readability at call sites. */
export function joinAnd(items: string[], last: string, mid: string): string {
  return joinSeq(items, last, mid);
}

export function meanFavorability(slots: { dimensions: DimensionValues }[]): number {
  if (slots.length === 0) return 0;
  return slots.reduce((s, r) => s + r.dimensions.favorability, 0) / slots.length;
}
```

- [ ] **Step 2: Create `voices/types.ts`**

```ts
import type { SlotResult, ModifierRole, DivinationType } from '../../types';
import type { DrawVoice } from '../types';

/** Where a draw sits among same-type, force-eligible draws in one reading. */
export interface DrawOccurrence {
  index: number; // 0-based ordinal in narration order
  total: number; // total same-type force draws in this reading
}

/** A divination type's reading voice. One per type; a generic fallback covers the rest. */
export interface MinigameVoice {
  type: DivinationType;
  /** One draw. occ.total === 1 (or occ.index === 0) returns today's exact framing. */
  describeOne(slot: SlotResult, role: ModifierRole, occ: DrawOccurrence): DrawVoice;
  /** Collapse 2+ same-type, same-role draws into a single combined voice. */
  describeGroup(slots: SlotResult[], role: ModifierRole, occBase: number): DrawVoice;
}
```

- [ ] **Step 3: Rewrite `drawVoice.ts` to import helpers from `shared.ts` (keep the switch for now)**

Replace the entire contents of [src/engine/narrative/drawVoice.ts](../../../src/engine/narrative/drawVoice.ts) with:

```ts
import type { SlotResult, ModifierRole } from '../types';
import type { DrawVoice } from './types';
import { favBandOf, withArticle, gloss, verbPhrase, stableIndex } from './voices/shared';

export { favBandOf };

/**
 * Turn a single concrete draw into a grammatical fragment: a named `subject`
 * and a role/favorability-aware `clause`. Multi-card tarot spreads are handled
 * upstream by the composer (positions beat); if one is passed here, the first
 * card is used. Never returns an empty subject or clause.
 */
export function describeDraw(slot: SlotResult, role: ModifierRole): DrawVoice {
  switch (slot.type) {
    case 'tarot': {
      if (slot.spread && slot.spread.length > 1) {
        const first = slot.spread[0].card;
        return {
          subject: `${withArticle(first.name)}, ${first.orientation}`,
          clause: verbPhrase(role, first.dimensions, first.name + first.orientation),
        };
      }
      const subject = `${withArticle(slot.name)}, ${slot.orientation}`;
      const meaning = slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed;
      let clause = verbPhrase(role, slot.dimensions, slot.name + slot.orientation);
      if (meaning && stableIndex('gloss' + slot.name, 2) === 0) {
        const g = gloss(meaning);
        if (g) clause = `${clause} — ${g}`;
      }
      return { subject, clause };
    }
    case 'd20': {
      const subject = `the dice, settling on ${slot.result}`;
      const g = gloss(slot.interpretation);
      let clause = verbPhrase(role, slot.dimensions, 'd20' + slot.result);
      if (g && stableIndex('gloss-d20-' + slot.result, 2) === 0) clause = `${clause}, ${g}`;
      return { subject, clause };
    }
    case 'iching': {
      const subject = `Hexagram ${slot.hexagramNumber}, ${slot.name}`;
      let clause = verbPhrase(role, slot.dimensions, 'iching' + slot.hexagramNumber);
      const g = gloss(slot.judgment);
      if (g) clause = `${clause} — ${g}`;
      if (slot.changingLines.length > 0) clause = `${clause}, its lines already turning`;
      return { subject, clause };
    }
    case 'strings': {
      const parts = slot.name.split(' · ');
      const origin = parts[0] ?? 'the start';
      const dest = parts[parts.length - 1] ?? 'the end';
      const subject = parts.length > 1
        ? `the thread drawn from ${origin} to ${dest}`
        : `the thread at ${origin}`;
      let clause = verbPhrase(role, slot.dimensions, 'strings' + slot.name);
      const g = gloss(slot.interpretation);
      if (g) clause = `${clause} — ${g}`;
      return { subject, clause };
    }
    default: {
      const named = (slot as { name?: string }).name ?? slot.type;
      const interp = (slot as { interpretation?: string }).interpretation ?? '';
      const subject = `the ${named}`;
      let clause = verbPhrase(role, slot.dimensions, named);
      const g = gloss(interp);
      if (g) clause = `${clause} — ${g}`;
      return { subject, clause };
    }
  }
}
```

- [ ] **Step 4: Typecheck and run the affected suites — expect green (no behavior change)**

Run: `npx tsc -b`
Expected: no errors.

Run: `npx vitest run src/engine/__tests__/DrawVoice.test.ts src/engine/__tests__/NarrativeAssembler.test.ts src/engine/__tests__/ReadingPlanner.test.ts`
Expected: PASS (all existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/narrative/voices/shared.ts src/engine/narrative/voices/types.ts src/engine/narrative/drawVoice.ts
git commit -m "refactor(narrative): extract draw-voice helpers + add MinigameVoice interface"
```

---

## Task 2: Add `drawFraming` fragments block

Data-only addition. All new prose strings for variant scaffolds and group framing, in the file the design chose for content.

**Files:**
- Modify: `src/data/reading-fragments.ts`
- Test: `src/engine/__tests__/MinigameVoices.test.ts` (new — one structural assertion here; the file grows in later tasks)

**Interfaces:**
- Produces: `READING_FRAGMENTS.drawFraming` with shape:
  - `variantScaffolds: Record<string, string[]>` — templates containing `{n}`, keyed by type.
  - `group: { lead: Record<string, string>; seqLast: string; listLast: string; mid: string }`.

- [ ] **Step 1: Write the failing structural test**

Create `src/engine/__tests__/MinigameVoices.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { READING_FRAGMENTS } from '../../data/reading-fragments';

describe('drawFraming fragments', () => {
  it('exposes variant scaffolds and group framing', () => {
    const df = READING_FRAGMENTS.drawFraming;
    expect(df.variantScaffolds.d20.length).toBeGreaterThan(0);
    expect(df.variantScaffolds.d20[0]).toContain('{n}');
    expect(df.group.lead.d20).toBeTruthy();
    expect(df.group.lead.generic).toBeTruthy();
    expect(typeof df.group.seqLast).toBe('string');
    expect(typeof df.group.listLast).toBe('string');
    expect(typeof df.group.mid).toBe('string');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'variantScaffolds')`.

- [ ] **Step 3: Add the `drawFraming` block to `reading-fragments.ts`**

In [src/data/reading-fragments.ts](../../../src/data/reading-fragments.ts), inside the `READING_FRAGMENTS` object, add this block immediately after the `drawLeadIns` block (before `connectives`):

```ts
  // ── Repeated-minigame framing (consumed by voices/index.ts) ──
  // variantScaffolds: alternate single-draw subjects for the 2nd+ same-type draw.
  //   {n} = the draw's identifying value (d20 result, hexagram number).
  // group.lead: opener for an aggregated run of same-type, same-role draws.
  // group.seqLast / listLast / mid: list connectives (structural glue).
  drawFraming: {
    variantScaffolds: {
      d20: ['the cast that lands on {n}', 'a later throw reading {n}', 'the roll that shows {n}'],
      iching: ['Hexagram {n} answering in turn', 'a further cast, Hexagram {n}'],
    } as Record<string, string[]>,
    group: {
      lead: {
        d20: 'the dice fall in turn —',
        iching: 'the hexagrams answer in sequence —',
        tarot: 'the cards arrive together —',
        strings: 'the threads gather —',
        generic: 'together —',
      } as Record<string, string>,
      seqLast: ', then ',
      listLast: ', and ',
      mid: ', ',
    },
  },
```

- [ ] **Step 4: Run the test and typecheck — expect green**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts`
Expected: PASS.

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/reading-fragments.ts src/engine/__tests__/MinigameVoices.test.ts
git commit -m "feat(narrative): add drawFraming fragment pools for repeated minigames"
```

---

## Task 3: Implement per-type voices + registry; rewire `describeDraw`

Builds the voice objects. `describeOne` reproduces today's output for the first occurrence and varies for later ones; `describeGroup` aggregates. `describeDraw` is rewired to the registry so the existing call sites get voices for free.

**Files:**
- Create: `src/engine/narrative/voices/index.ts`
- Modify: `src/engine/narrative/drawVoice.ts`
- Test: `src/engine/__tests__/MinigameVoices.test.ts` (extend)

**Interfaces:**
- Consumes: `voices/shared.ts` helpers, `voices/types.ts` (`MinigameVoice`, `DrawOccurrence`), `READING_FRAGMENTS.drawFraming`.
- Produces: `voiceFor(type: DivinationType): MinigameVoice` from `voices/index.ts`.
- Produces (unchanged signature): `describeDraw(slot, role): DrawVoice` now delegates to `voiceFor(slot.type).describeOne(slot, role, { index: 0, total: 1 })`.

- [ ] **Step 1: Write failing voice tests**

Append to `src/engine/__tests__/MinigameVoices.test.ts`:

```ts
import { voiceFor } from '../narrative/voices/index';
import { describeDraw } from '../narrative/drawVoice';
import type { SlotResult, ModifierRole } from '../types';

const d20 = (result: number, fav = 0): SlotResult => ({
  type: 'd20', result, threshold: 'neutral', interpretation: 'Steady',
  themes: ['mystery'], tags: [], modifierRoles: ['effect'],
  dimensions: { favorability: fav, certainty: 0, volatility: 0 },
} as unknown as SlotResult);

const tarot = (name: string, fav = 0): SlotResult => ({
  type: 'tarot', id: name, name, number: 1, orientation: 'upright', symbol: '☉',
  meaningUpright: 'New beginnings', meaningReversed: 'Recklessness',
  themes: ['mystery'], tags: [], modifierRoles: ['subject'],
  dimensions: { favorability: fav, certainty: 0, volatility: 0 },
} as unknown as SlotResult);

describe('MinigameVoice — single-draw parity', () => {
  it('describeOne (index 0) matches legacy describeDraw for d20', () => {
    const slot = d20(10);
    const viaVoice = voiceFor('d20').describeOne(slot, 'effect' as ModifierRole, { index: 0, total: 1 });
    const viaLegacy = describeDraw(slot, 'effect');
    expect(viaVoice).toEqual(viaLegacy);
    expect(viaVoice.subject).toBe('the dice, settling on 10');
  });

  it('describeDraw still returns the legacy d20 subject', () => {
    expect(describeDraw(d20(10), 'effect').subject).toBe('the dice, settling on 10');
  });
});

describe('MinigameVoice — occurrence variation', () => {
  it('a 2nd d20 draw uses a variant scaffold, not the base one', () => {
    const v = voiceFor('d20').describeOne(d20(7), 'effect', { index: 1, total: 2 });
    expect(v.subject).not.toBe('the dice, settling on 7');
    expect(v.subject).toContain('7');
  });

  it('two same-role siblings do not end on the identical clause', () => {
    const a = voiceFor('d20').describeOne(d20(5), 'effect', { index: 0, total: 2 });
    const b = voiceFor('d20').describeOne(d20(12), 'effect', { index: 1, total: 2 });
    expect(a.clause).not.toBe(b.clause);
  });
});

describe('MinigameVoice — aggregation', () => {
  it('collapses 3 d20 draws into one combined subject naming each value', () => {
    const g = voiceFor('d20').describeGroup([d20(5), d20(12), d20(18)], 'effect', 0);
    expect(g.subject).toContain('5');
    expect(g.subject).toContain('12');
    expect(g.subject).toContain('18');
    expect(g.subject).toContain('the dice fall in turn');
    // exactly one scaffold, not three
    expect(g.subject.match(/the dice/g)?.length).toBe(1);
    expect(g.clause.trim().length).toBeGreaterThan(0);
  });

  it('collapses tarot draws naming each card once', () => {
    const g = voiceFor('tarot').describeGroup([tarot('The Tower'), tarot('The Star')], 'subject', 0);
    expect(g.subject).toContain('Tower');
    expect(g.subject).toContain('Star');
    expect(g.clause.trim().length).toBeGreaterThan(0);
  });
});

describe('MinigameVoice — fallback', () => {
  it('an unmapped type (astral) still yields subject + clause', () => {
    const astral = { type: 'astral', name: 'Mars in the 7th', interpretation: 'Tension in partnership',
      themes: ['conflict'], tags: [], modifierRoles: ['subject'],
      dimensions: { favorability: -0.5, certainty: 0, volatility: 0 } } as unknown as SlotResult;
    const one = voiceFor('astral').describeOne(astral, 'subject', { index: 0, total: 1 });
    expect(one.subject).toContain('Mars');
    expect(one.clause.trim().length).toBeGreaterThan(0);
    const group = voiceFor('astral').describeGroup([astral, astral], 'subject', 0);
    expect(group.subject.length).toBeGreaterThan(0);
    expect(group.clause.trim().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts`
Expected: FAIL — cannot find module `../narrative/voices/index`.

- [ ] **Step 3: Implement `voices/index.ts`**

Create `src/engine/narrative/voices/index.ts`:

```ts
import type { SlotResult, ModifierRole, DivinationType, DimensionValues } from '../../types';
import type { DrawVoice } from '../types';
import type { MinigameVoice, DrawOccurrence } from './types';
import { READING_FRAGMENTS as F } from '../../../data/reading-fragments';
import {
  withArticle, gloss, verbPhrase, stableIndex, joinSeq, joinAnd, meanFavorability,
} from './shared';

const DF = F.drawFraming;

/** Pick a variant scaffold for a 2nd+ draw; falls back to null when none defined. */
function variantScaffold(type: string, value: string | number, occ: DrawOccurrence): string | null {
  const pool = DF.variantScaffolds[type];
  if (!pool || pool.length === 0) return null;
  const tpl = pool[(occ.index - 1) % pool.length];
  return tpl.replace('{n}', String(value));
}

/** Clause seed key offset by occurrence so siblings don't collide; '' for index 0. */
function occSuffix(occ: DrawOccurrence): string {
  return occ.index > 0 ? `#${occ.index}` : '';
}

const groupDims = (slots: SlotResult[]): DimensionValues =>
  ({ favorability: meanFavorability(slots), certainty: 0, volatility: 0 });

// ── Tarot ──
const tarotVoice: MinigameVoice = {
  type: 'tarot',
  describeOne(slot, role, occ) {
    if (slot.type !== 'tarot') return genericVoice.describeOne(slot, role, occ);
    if (slot.spread && slot.spread.length > 1) {
      const first = slot.spread[0].card;
      return {
        subject: `${withArticle(first.name)}, ${first.orientation}`,
        clause: verbPhrase(role, first.dimensions, first.name + first.orientation + occSuffix(occ)),
      };
    }
    const subject = `${withArticle(slot.name)}, ${slot.orientation}`;
    const meaning = slot.orientation === 'upright' ? slot.meaningUpright : slot.meaningReversed;
    let clause = verbPhrase(role, slot.dimensions, slot.name + slot.orientation + occSuffix(occ));
    if (meaning && stableIndex('gloss' + slot.name, 2) === 0) {
      const g = gloss(meaning);
      if (g) clause = `${clause} — ${g}`;
    }
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const cards = slots.filter((s): s is Extract<SlotResult, { type: 'tarot' }> => s.type === 'tarot');
    const items = cards.map((c, i) => {
      const label = `${withArticle(c.name)} ${c.orientation}`;
      return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
    });
    const subject = `${DF.group.lead.tarot} ${joinAnd(items, DF.group.listLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'tarot-group' + cards.map((c) => c.name).join('|'));
    return { subject, clause };
  },
};

// ── D20 ──
const d20Voice: MinigameVoice = {
  type: 'd20',
  describeOne(slot, role, occ) {
    if (slot.type !== 'd20') return genericVoice.describeOne(slot, role, occ);
    const variant = occ.index > 0 ? variantScaffold('d20', slot.result, occ) : null;
    const subject = variant ?? `the dice, settling on ${slot.result}`;
    const g = gloss(slot.interpretation);
    let clause = verbPhrase(role, slot.dimensions, 'd20' + slot.result + occSuffix(occ));
    if (g && stableIndex('gloss-d20-' + slot.result, 2) === 0) clause = `${clause}, ${g}`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const dice = slots.filter((s): s is Extract<SlotResult, { type: 'd20' }> => s.type === 'd20');
    const items = dice.map((d) => String(d.result));
    const subject = `${DF.group.lead.d20} ${joinSeq(items, DF.group.seqLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'd20-group' + items.join('|'));
    return { subject, clause };
  },
};

// ── I Ching ──
const ichingVoice: MinigameVoice = {
  type: 'iching',
  describeOne(slot, role, occ) {
    if (slot.type !== 'iching') return genericVoice.describeOne(slot, role, occ);
    const variant = occ.index > 0 ? variantScaffold('iching', slot.hexagramNumber, occ) : null;
    const subject = variant ?? `Hexagram ${slot.hexagramNumber}, ${slot.name}`;
    let clause = verbPhrase(role, slot.dimensions, 'iching' + slot.hexagramNumber + occSuffix(occ));
    const g = gloss(slot.judgment);
    if (g) clause = `${clause} — ${g}`;
    if (slot.changingLines.length > 0) clause = `${clause}, its lines already turning`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const hexes = slots.filter((s): s is Extract<SlotResult, { type: 'iching' }> => s.type === 'iching');
    const items = hexes.map((h) => String(h.hexagramNumber));
    const subject = `${DF.group.lead.iching} ${joinSeq(items, DF.group.seqLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'iching-group' + items.join('|'));
    return { subject, clause };
  },
};

// ── Strings ──
const stringsVoice: MinigameVoice = {
  type: 'strings',
  describeOne(slot, role, occ) {
    if (slot.type !== 'strings') return genericVoice.describeOne(slot, role, occ);
    const parts = slot.name.split(' · ');
    const origin = parts[0] ?? 'the start';
    const dest = parts[parts.length - 1] ?? 'the end';
    const subject = parts.length > 1
      ? `the thread drawn from ${origin} to ${dest}`
      : `the thread at ${origin}`;
    let clause = verbPhrase(role, slot.dimensions, 'strings' + slot.name + occSuffix(occ));
    const g = gloss(slot.interpretation);
    if (g) clause = `${clause} — ${g}`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const threads = slots.filter((s): s is Extract<SlotResult, { type: 'strings' }> => s.type === 'strings');
    const items = threads.map((t) => {
      const parts = t.name.split(' · ');
      return `to ${parts[parts.length - 1] ?? 'the end'}`;
    });
    const subject = `${DF.group.lead.strings} ${joinAnd(items, DF.group.listLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'strings-group' + threads.map((t) => t.name).join('|'));
    return { subject, clause };
  },
};

// ── Generic fallback (astral, rune, happening, any future type) ──
const genericVoice: MinigameVoice = {
  type: 'astral', // nominal; used for any unmapped type
  describeOne(slot, role, occ) {
    const named = (slot as { name?: string }).name ?? slot.type;
    const interp = (slot as { interpretation?: string }).interpretation ?? '';
    const subject = `the ${named}`;
    let clause = verbPhrase(role, slot.dimensions, named + occSuffix(occ));
    const g = gloss(interp);
    if (g) clause = `${clause} — ${g}`;
    return { subject, clause };
  },
  describeGroup(slots, role, _occBase) {
    const items = slots.map((s, i) => {
      const named = (s as { name?: string }).name ?? s.type;
      return i === 0 ? `the ${named}` : named;
    });
    const subject = `${DF.group.lead.generic} ${joinAnd(items, DF.group.listLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'generic-group' + items.join('|'));
    return { subject, clause };
  },
};

const REGISTRY: Partial<Record<DivinationType, MinigameVoice>> = {
  tarot: tarotVoice,
  d20: d20Voice,
  iching: ichingVoice,
  strings: stringsVoice,
};

/** The voice for a type, or the generic fallback (astral/rune/happening/future). */
export function voiceFor(type: DivinationType): MinigameVoice {
  return REGISTRY[type] ?? genericVoice;
}
```

- [ ] **Step 4: Rewire `describeDraw` in `drawVoice.ts` to the registry**

Replace the body of `describeDraw` (the whole `switch`) in [src/engine/narrative/drawVoice.ts](../../../src/engine/narrative/drawVoice.ts) so the function reads:

```ts
import type { SlotResult, ModifierRole } from '../types';
import type { DrawVoice } from './types';
import { favBandOf } from './voices/shared';
import { voiceFor } from './voices/index';

export { favBandOf };

/**
 * Back-compat wrapper: a single draw narrated as the first (and only) occurrence.
 * The per-type logic now lives in voices/index.ts; the composer calls voices
 * directly with real occurrence/grouping context.
 */
export function describeDraw(slot: SlotResult, role: ModifierRole): DrawVoice {
  return voiceFor(slot.type).describeOne(slot, role, { index: 0, total: 1 });
}
```

- [ ] **Step 5: Run voice + regression suites — expect green**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts src/engine/__tests__/DrawVoice.test.ts src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS — including the parity assertions and the legacy `"the dice, settling on 10"` checks.

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/narrative/voices/index.ts src/engine/narrative/drawVoice.ts src/engine/__tests__/MinigameVoices.test.ts
git commit -m "feat(narrative): per-minigame voices with aggregation + occurrence variation"
```

---

## Task 4: Wire occurrence pass + per-role grouping into the composer

The composer stops calling `describeDraw` per draw. It computes occurrence ordinals across the whole reading, groups each role's force-eligible draws by type, and dispatches: groups of ≥2 → `describeGroup`, singles → `describeOne`. This is where repeated minigames actually stop repeating.

**Files:**
- Modify: `src/engine/narrative/ReadingComposer.ts`
- Test: `src/engine/__tests__/NarrativeAssembler.test.ts` (add integration tests)

**Interfaces:**
- Consumes: `voiceFor` from `voices/index.ts`, `DrawOccurrence` from `voices/types.ts`, `DrawVoice` from `narrative/types.ts`.
- Produces: no signature change — `compose(input)` still returns `Beat[]`; force beats just carry better `draws`.

- [ ] **Step 1: Write failing integration tests**

Add to `src/engine/__tests__/NarrativeAssembler.test.ts` (inside the top `describe('NarrativeAssembler', …)` block):

```ts
it('aggregates three same-role d20 draws into one combined mention', () => {
  const mk = (result: number) => makeSlot('d20', { result, modifierRoles: ['effect' as ModifierRole],
    dimensions: { favorability: 0.0, certainty: 0, volatility: 0 } });
  const agg = {
    ...baseAggregated,
    modifierAssignments: { subject: [], action: [], effect: [mk(5), mk(12), mk(18)] },
  };
  const result = assembler.assemble(agg, [], 'future', { chaos: 40, order: 50 });
  const body = result.paragraphs.join('\n');
  // one combined scaffold, not three "settling on" repeats
  expect((body.match(/the dice/g) ?? []).length).toBe(1);
  expect(body).toContain('the dice fall in turn');
  expect(body).toContain('5');
  expect(body).toContain('12');
  expect(body).toContain('18');
});

it('varies framing for the same type split across two roles', () => {
  const subj = makeSlot('d20', { result: 4, modifierRoles: ['subject' as ModifierRole],
    dimensions: { favorability: 0, certainty: 0, volatility: 0 } });
  const eff = makeSlot('d20', { result: 19, modifierRoles: ['effect' as ModifierRole],
    dimensions: { favorability: 0, certainty: 0, volatility: 0 } });
  const agg = { ...baseAggregated, modifierAssignments: { subject: [subj], action: [], effect: [eff] } };
  const result = assembler.assemble(agg, [], 'decision', { chaos: 40, order: 50 });
  const body = result.paragraphs.join('\n');
  // the 2nd occurrence uses a variant scaffold, so "settling on" appears at most once
  expect((body.match(/settling on/g) ?? []).length).toBeLessThanOrEqual(1);
  expect(body).toContain('4');
  expect(body).toContain('19');
});

it('remains deterministic with repeated minigames', () => {
  const mk = (result: number) => makeSlot('d20', { result, modifierRoles: ['effect' as ModifierRole] });
  const agg = { ...baseAggregated, modifierAssignments: { subject: [], action: [], effect: [mk(5), mk(12), mk(18)] } };
  const a = new NarrativeAssembler(); a.resetRotation();
  const r1 = a.assemble(agg, [], 'future', { chaos: 40, order: 50 });
  const b = new NarrativeAssembler(); b.resetRotation();
  const r2 = b.assemble(agg, [], 'future', { chaos: 40, order: 50 });
  expect(r2.paragraphs).toEqual(r1.paragraphs);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts -t "aggregates three same-role"`
Expected: FAIL — body contains three `"the dice"` mentions (current additive merge), so the count assertion fails.

- [ ] **Step 3: Update the imports at the top of `ReadingComposer.ts`**

In [src/engine/narrative/ReadingComposer.ts](../../../src/engine/narrative/ReadingComposer.ts), replace the import of `describeDraw`:

Change:
```ts
import { describeDraw, favBandOf } from './drawVoice';
```
to:
```ts
import { favBandOf } from './drawVoice';
import type { DrawVoice } from './types';
import type { DrawOccurrence } from './voices/types';
import { voiceFor } from './voices/index';
import type { DivinationType } from '../types';
```

- [ ] **Step 4: Replace the force-beat construction block**

In `compose()`, replace this block (the force-beat loop, currently lines ~64-69):

```ts
    let forceBeats: Beat[] = [];
    for (const role of ROLE_ORDER) {
      const draws = byRole[role].filter((r) => !isMultiSpread(r)).map((r) => describeDraw(r, role));
      if (draws.length > 0) forceBeats.push({ kind: 'force', role, draws });
    }
    if (terse) forceBeats = forceBeats.slice(0, 1);
```

with:

```ts
    // ── Occurrence pass: ordinal of each force-eligible draw among its type ──
    // Narration order = role order, then the sort already applied within each role.
    const narrationOrder: SlotResult[] = [];
    for (const role of ROLE_ORDER) {
      for (const r of byRole[role]) if (!isMultiSpread(r)) narrationOrder.push(r);
    }
    const totals = new Map<DivinationType, number>();
    for (const r of narrationOrder) totals.set(r.type, (totals.get(r.type) ?? 0) + 1);
    const occMap = new Map<SlotResult, DrawOccurrence>();
    const running = new Map<DivinationType, number>();
    for (const r of narrationOrder) {
      const index = running.get(r.type) ?? 0;
      occMap.set(r, { index, total: totals.get(r.type) ?? 1 });
      running.set(r.type, index + 1);
    }

    // ── Force beats: group each role's draws by type; aggregate runs of ≥2 ──
    let forceBeats: Beat[] = [];
    for (const role of ROLE_ORDER) {
      const eligible = byRole[role].filter((r) => !isMultiSpread(r));
      if (eligible.length === 0) continue;
      const groups: SlotResult[][] = [];
      const byType = new Map<DivinationType, SlotResult[]>();
      for (const r of eligible) {
        let g = byType.get(r.type);
        if (!g) { g = []; byType.set(r.type, g); groups.push(g); }
        g.push(r);
      }
      const draws: DrawVoice[] = groups.map((g) => {
        const voice = voiceFor(g[0].type);
        return g.length >= 2
          ? voice.describeGroup(g, role, occMap.get(g[0])!.index)
          : voice.describeOne(g[0], role, occMap.get(g[0])!);
      });
      forceBeats.push({ kind: 'force', role, draws });
    }
    if (terse) forceBeats = forceBeats.slice(0, 1);
```

- [ ] **Step 5: Run the new tests + full suite — expect green**

Run: `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS — aggregation, variation, and determinism tests pass; all prior tests stay green (single-draw paths unchanged).

Run: `npx tsc -b`
Expected: no errors (watch for `noUnusedLocals` — `describeDraw` import was removed from the composer).

- [ ] **Step 6: Run the entire engine suite**

Run: `npx vitest run`
Expected: PASS — full suite green.

- [ ] **Step 7: Commit**

```bash
git add src/engine/narrative/ReadingComposer.ts src/engine/__tests__/NarrativeAssembler.test.ts
git commit -m "feat(narrative): composer aggregates + varies repeated-minigame draws"
```

---

## Self-Review

**Spec coverage:**
- Per-minigame `MinigameVoice` + registry → Task 1 (interface), Task 3 (voices/registry). ✓
- Hybrid: aggregate same-role same-type → Task 3 `describeGroup` + Task 4 grouping. ✓
- Vary framing across roles → Task 3 variant scaffold + clause `occSuffix`, Task 4 occurrence pass. ✓
- Single-draw byte-compatibility → Task 1 (unchanged switch), Task 3 (index-0 path + parity test), regression suites run in Tasks 1/3/4. ✓
- Content in `reading-fragments.ts` → Task 2. ✓
- Determinism (no `Math.random`) → all picks via `stableIndex`/seed; explicit determinism test in Task 4. ✓
- Interpretation-only scope → only `narrative/` + `reading-fragments.ts` touched; no React/`CardReadingDetail`/`describeSlotFull`. ✓
- Fallback for astral/rune/happening → Task 3 `genericVoice` + fallback test. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `voiceFor`, `describeOne(slot, role, occ)`, `describeGroup(slots, role, occBase)`, `DrawOccurrence { index, total }` used identically across Tasks 1, 3, 4. `DrawVoice` import added to the composer. The `groups`/`byType`/`occMap` locals are all consumed. ✓

**Edge cases covered:** multi-card spreads excluded from occurrence/grouping (still routed to positions beat via `isMultiSpread` filter, unchanged); mixed aggregate+lone of one type across roles (lone draw's `occ.index` ≥ group size → variant). ✓
