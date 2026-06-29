# Results-Synthesis Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the synthesised reading prose, generalise each minigame's repeated draws into one coherent aggregation — tarot into a single Past/Present/Future set (elaborated, contradiction-aware), and strings/d20/I Ching into bespoke combined voices.

**Architecture:** All work is in the framework-free narrative layer (`src/engine/narrative/**`) plus the fragment data (`src/data/reading-fragments.ts`). Per-type aggregation lives in the voices (`voices/index.ts`); the composer (`ReadingComposer`) stays prose-free and emits typed beats; `ProseBuilder` + fragment pools realise text. The result tiles, share card, and copy-able LLM prompt are deliberately untouched.

**Tech Stack:** TypeScript (strict), Vitest (engine tests only, Node env, globals on).

## Global Constraints

- Engine code is **framework-free**: no React/DOM imports in `src/engine/**`.
- Favorability lean thresholds are **symmetric**: `favor ≥ +0.5`, `adverse ≤ −0.5`, else `steady` (matches existing `ReadingComposer`/`NarrativeAssembler`).
- Merged favorability is **magnitude-weighted**: `Σ(v·|v|) / Σ|v|` (matches `ReadingPlanner.aggregate`).
- Typecheck must pass under `strict`, `noUnusedLocals`, `noUnusedParameters`: `npm run build`.
- Run a single test file with `npx vitest run <path>`; full suite with `npm test`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- `src/engine/narrative/types.ts` — add `PositionCard`, `PositionSummary`; change the `positions` Beat member from `entries` to `summaries`.
- `src/engine/narrative/voices/index.ts` — add `aggregateTarotPositions` (+ `leanOf`, `weightedMeanFavorability`, `trendOf` helpers); deepen `stringsVoice`/`d20Voice`/`ichingVoice` `describeGroup`.
- `src/engine/narrative/ReadingComposer.ts` — call `aggregateTarotPositions`, emit the new beat.
- `src/engine/narrative/ProseBuilder.ts` — render the new positions beat (per-position elaboration + contradiction).
- `src/data/reading-fragments.ts` — `positionFraming`, `positionContradiction`, and `drawFraming.group` additions (`stringsLead`, `stringsSplit`, `d20Trend`, `ichingMovement`).
- `src/engine/__tests__/TarotPositions.test.ts` — new; covers `aggregateTarotPositions` + ProseBuilder positions rendering.
- `src/engine/__tests__/MinigameVoices.test.ts` — extend with strings/d20/iching group tests; update the d20 group assertion.
- `src/engine/__tests__/ReadingComposer.test.ts` — update the positions-beat assertion to the new shape.
- `docs/game-systems.md` — sync the synthesis-aggregation paragraph (lines ~620-625).

---

### Task 1: Tarot positional aggregation (`aggregateTarotPositions`)

Pure addition — new interfaces + an exported function, consumed by nothing yet, so the build stays green.

**Files:**
- Modify: `src/engine/narrative/types.ts` (add interfaces; do **not** touch the `positions` Beat member in this task)
- Modify: `src/engine/narrative/voices/index.ts` (imports + helpers + function)
- Test: `src/engine/__tests__/TarotPositions.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface PositionCard { name: string; orientation: 'upright'|'reversed'; favorability: number; lean: 'favor'|'steady'|'adverse'; gloss: string; veiled: boolean }`
  - `interface PositionSummary { position: 'past'|'present'|'future'; cards: PositionCard[]; lean: 'favor'|'steady'|'adverse'; contradiction: boolean }`
  - `export function aggregateTarotPositions(spreads: SlotResult[]): PositionSummary[]`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/TarotPositions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aggregateTarotPositions } from '../narrative/voices/index';
import type { SlotResult } from '../types';

const face = (name: string, fav: number, over: Record<string, unknown> = {}) => ({
  id: name, name, arcana: 'major', orientation: fav < 0 ? 'reversed' : 'upright', symbol: '☉',
  themes: ['mystery'], dimensions: { favorability: fav, certainty: 0, volatility: 0 },
  modifierRoles: ['subject'], meaningUpright: 'Hope and renewal', meaningReversed: 'Loss and doubt',
  tags: [], ...over,
});

const spread = (cards: [string, number][]): SlotResult => ({
  type: 'tarot', id: 's', name: cards.map((c) => c[0]).join(' · '), number: 0,
  orientation: 'upright', symbol: '☉', meaningUpright: '', meaningReversed: '', tags: [],
  themes: ['mystery'], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'],
  spread: [
    { position: 'past', card: face(cards[0][0], cards[0][1]) },
    { position: 'present', card: face(cards[1][0], cards[1][1]) },
    { position: 'future', card: face(cards[2][0], cards[2][1]) },
  ],
} as unknown as SlotResult);

describe('aggregateTarotPositions', () => {
  it('one spread → three position summaries, one card each, no contradiction', () => {
    const out = aggregateTarotPositions([spread([['A', 1], ['B', 0], ['C', -1]])]);
    expect(out.map((s) => s.position)).toEqual(['past', 'present', 'future']);
    expect(out.every((s) => s.cards.length === 1)).toBe(true);
    expect(out.map((s) => s.lean)).toEqual(['favor', 'steady', 'adverse']);
    expect(out.some((s) => s.contradiction)).toBe(false);
  });

  it('three spreads collapse into still exactly three positions, cards pooled', () => {
    const out = aggregateTarotPositions([
      spread([['A', 1], ['B', 0], ['C', -1]]),
      spread([['D', 1], ['E', 0], ['F', -1]]),
      spread([['G', 1], ['H', 0], ['I', -1]]),
    ]);
    expect(out.length).toBe(3);
    expect(out.find((s) => s.position === 'past')!.cards.length).toBe(3);
  });

  it('flags contradiction when a position mixes a favorable and an adverse card', () => {
    const out = aggregateTarotPositions([
      spread([['Sun', 1.5], ['B', 0], ['C', 0]]),
      spread([['Five of Swords', -1.5], ['E', 0], ['F', 0]]),
    ]);
    expect(out.find((s) => s.position === 'past')!.contradiction).toBe(true);
  });

  it('veiled cards carry no gloss', () => {
    const s = spread([['A', 1], ['B', 0], ['C', -1]]);
    (s as unknown as { spread: { card: { veiled?: boolean } }[] }).spread[0].card.veiled = true;
    const past = aggregateTarotPositions([s]).find((p) => p.position === 'past')!;
    expect(past.cards[0].veiled).toBe(true);
    expect(past.cards[0].gloss).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/__tests__/TarotPositions.test.ts`
Expected: FAIL — `aggregateTarotPositions` is not exported.

- [ ] **Step 3: Add the interfaces to `narrative/types.ts`**

Insert after the `Pole` interface (before the `Beat` union), leaving the `Beat` union unchanged in this task:

```ts
export interface PositionCard {
  name: string;
  orientation: 'upright' | 'reversed';
  favorability: number;
  lean: 'favor' | 'steady' | 'adverse';
  gloss: string;
  veiled: boolean;
}

export interface PositionSummary {
  position: 'past' | 'present' | 'future';
  cards: PositionCard[];
  lean: 'favor' | 'steady' | 'adverse';
  contradiction: boolean;
}
```

- [ ] **Step 4: Implement `aggregateTarotPositions` in `voices/index.ts`**

Extend the first import and add an import for the new types (top of file):

```ts
import type { SlotResult, DivinationType, DimensionValues } from '../../types';
import type { MinigameVoice, DrawOccurrence } from './types';
import type { PositionCard, PositionSummary } from '../types';
```

Add these helpers and the function near the top of the file, after the `groupDims` const (around line 24):

```ts
const POSITION_ORDER: ('past' | 'present' | 'future')[] = ['past', 'present', 'future'];

function leanOf(fav: number): 'favor' | 'steady' | 'adverse' {
  return fav >= 0.5 ? 'favor' : fav <= -0.5 ? 'adverse' : 'steady';
}

/** Magnitude-weighted mean favorability: strong pulls dominate rather than cancel. */
function weightedMeanFavorability(favs: number[]): number {
  let num = 0, den = 0;
  for (const f of favs) { const w = Math.abs(f); num += f * w; den += w; }
  return den > 0 ? num / den : 0;
}

/**
 * Collapse every multi-card spread into one Past/Present/Future set: each
 * occupied position carries all cards that landed there (across every spread),
 * a magnitude-weighted merged lean, and a contradiction flag when the position
 * holds both a favorable (>= +0.5) and an adverse (<= -0.5) card.
 */
export function aggregateTarotPositions(spreads: SlotResult[]): PositionSummary[] {
  const byPos = new Map<'past' | 'present' | 'future', PositionCard[]>();
  for (const s of spreads) {
    if (s.type !== 'tarot' || !s.spread) continue;
    for (const { position, card } of s.spread) {
      const meaning = (card.orientation === 'upright' ? card.meaningUpright : card.meaningReversed) ?? '';
      const pc: PositionCard = {
        name: card.name,
        orientation: card.orientation,
        favorability: card.dimensions.favorability,
        lean: leanOf(card.dimensions.favorability),
        gloss: card.veiled ? '' : gloss(meaning),
        veiled: !!card.veiled,
      };
      const list = byPos.get(position) ?? [];
      list.push(pc);
      byPos.set(position, list);
    }
  }
  const summaries: PositionSummary[] = [];
  for (const position of POSITION_ORDER) {
    const cards = byPos.get(position);
    if (!cards || cards.length === 0) continue;
    const favs = cards.map((c) => c.favorability);
    const lean = leanOf(weightedMeanFavorability(favs));
    const contradiction = favs.some((f) => f >= 0.5) && favs.some((f) => f <= -0.5);
    summaries.push({ position, cards, lean, contradiction });
  }
  return summaries;
}
```

(`gloss` is already imported in `voices/index.ts`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/__tests__/TarotPositions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/narrative/types.ts src/engine/narrative/voices/index.ts src/engine/__tests__/TarotPositions.test.ts
git commit -m "feat(narrative): aggregateTarotPositions merges spreads into one P/P/F set"
```

---

### Task 2: Wire the positions beat + render elaborated, contradiction-aware prose

Atomic shape change: the `positions` Beat, `ReadingComposer`, `ProseBuilder`, the new fragments, and the existing `ReadingComposer` assertion all move together so the build stays green.

**Files:**
- Modify: `src/engine/narrative/types.ts` (change the `positions` Beat member)
- Modify: `src/engine/narrative/ReadingComposer.ts:105-115`
- Modify: `src/engine/narrative/ProseBuilder.ts` (imports + `positions` case + new methods)
- Modify: `src/data/reading-fragments.ts` (add `positionFraming`, `positionContradiction`)
- Modify: `src/engine/__tests__/ReadingComposer.test.ts:79` (new beat shape)
- Modify: `src/engine/__tests__/NarrativeAssembler.test.ts:98-111` (new merged-positions prose)
- Test: `src/engine/__tests__/TarotPositions.test.ts` (add a ProseBuilder describe block)

**Interfaces:**
- Consumes: `aggregateTarotPositions`, `PositionSummary`, `PositionCard` (Task 1).
- Produces: `Beat` union member `{ kind: 'positions'; summaries: PositionSummary[] }`.

- [ ] **Step 1: Write the failing ProseBuilder tests**

Append to `src/engine/__tests__/TarotPositions.test.ts`:

```ts
import { ProseBuilder } from '../narrative/ProseBuilder';
import type { Beat, PositionSummary } from '../narrative/types';
import type { AggregatedReading } from '../types';

const aggStub: AggregatedReading = {
  dominantTheme: 'mystery', secondaryTheme: null,
  dimensionProfile: { favorability: 0, certainty: 0, volatility: 0 },
  modifierAssignments: { subject: [], action: [], effect: [] },
  hasTension: false, tensionPair: null, strongestFavor: null, strongestAdverse: null,
};
const closeBeat: Beat = { kind: 'close', question: 'self', theme: 'mystery', carryForce: null };
const proseCtx = { aggregated: aggStub, question: 'self' as const, seed: 0 };

describe('ProseBuilder positions rendering', () => {
  it('single-card position names the card and weaves its gloss', () => {
    const summaries: PositionSummary[] = [{
      position: 'past', contradiction: false, lean: 'adverse',
      cards: [{ name: 'Tower', orientation: 'reversed', favorability: -1, lean: 'adverse', gloss: 'the ground already broken', veiled: false }],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ');
    expect(text).toContain('Tower');
    expect(text).toContain('the ground already broken');
  });

  it('contradiction position names both opposing cards', () => {
    const summaries: PositionSummary[] = [{
      position: 'present', contradiction: true, lean: 'steady',
      cards: [
        { name: 'Sun', orientation: 'upright', favorability: 1.5, lean: 'favor', gloss: 'warmth', veiled: false },
        { name: 'Five of Swords', orientation: 'reversed', favorability: -1.5, lean: 'adverse', gloss: 'a hollow win', veiled: false },
      ],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ');
    expect(text).toContain('Sun');
    expect(text).toContain('Five of Swords');
  });

  it('all-veiled position falls back to the bare lean phrase', () => {
    const summaries: PositionSummary[] = [{
      position: 'future', contradiction: false, lean: 'favor',
      cards: [{ name: '?', orientation: 'upright', favorability: 1, lean: 'favor', gloss: '', veiled: true }],
    }];
    const out = new ProseBuilder().build([{ kind: 'positions', summaries }, closeBeat], proseCtx);
    const text = out.paragraphs.join(' ').toLowerCase();
    expect(text).toContain('fortune'); // positionLeans.favor === 'leans toward fortune'
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/TarotPositions.test.ts`
Expected: FAIL — `positions` beat still has `entries`; ProseBuilder renders the old lean list, missing card names.

- [ ] **Step 3: Change the `positions` Beat member in `narrative/types.ts`**

Replace the existing line:

```ts
  | { kind: 'positions'; entries: { position: string; lean: 'favor' | 'steady' | 'adverse' }[] }
```

with:

```ts
  | { kind: 'positions'; summaries: PositionSummary[] }
```

- [ ] **Step 4: Add the fragment pools to `reading-fragments.ts`**

Insert immediately after the existing `positionLeans` line (~line 171):

```ts
  // ── Positions: per-position framing + contradiction templates ──
  positionFraming: {
    past:    ['In what has passed,', 'Behind the moment lies', 'The past holds'],
    present: ['At the present turn,', 'Here and now,', 'The present shows'],
    future:  ['Ahead,', 'What comes bends toward', 'The future opens onto'],
  } as Record<string, string[]>,
  positionContradiction: [
    '{pos} divides against itself — {favor} set against {adverse}',
    '{pos} speaks in two voices: {favor}, and yet {adverse}',
  ],
```

- [ ] **Step 5: Wire `ReadingComposer` to the aggregation**

Change the import (line 7):

```ts
import { voiceFor, aggregateTarotPositions } from './voices/index';
```

Replace the positions block (lines 105-115):

```ts
    // ── Positions beat (multi-card spreads → one Past/Present/Future set) ──
    const spreads = [...new Set([...results, ...unique])].filter(isMultiSpread);
    const summaries = aggregateTarotPositions(spreads);
    const positionsBeat: Beat | null = summaries.length > 0 ? { kind: 'positions', summaries } : null;
```

- [ ] **Step 6: Render the beat in `ProseBuilder`**

Change the imports at the top:

```ts
import type { Beat, PositionSummary, PositionCard } from './types';
import { favBandOf } from './drawVoice';
import { joinAnd } from './voices/shared';
```

Replace the `positions` case in `renderBeat` (lines 139-145):

```ts
      case 'positions':
        return { text: this.renderPositions(beat), valence: 'neu', group: 'body' };
```

Add these two private methods to the `ProseBuilder` class (e.g. after `renderForce`):

```ts
  private renderPositions(beat: Extract<Beat, { kind: 'positions' }>): string {
    return beat.summaries
      .map((s) => this.renderPosition(s))
      .filter((t) => t.trim())
      .map(capPunct)
      .join(' ');
  }

  private renderPosition(s: PositionSummary): string {
    const framing = this.pick(`pos_frame_${s.position}`, F.positionFraming[s.position]);
    const named = (c: PositionCard) => `the ${c.name}${c.orientation === 'reversed' ? ' reversed' : ''}`;
    const namedGloss = (c: PositionCard) => (c.gloss ? `${named(c)} — ${c.gloss}` : named(c));

    if (s.contradiction) {
      const favor = [...s.cards].filter((c) => c.favorability > 0).sort((a, b) => b.favorability - a.favorability)[0];
      const adverse = [...s.cards].filter((c) => c.favorability < 0).sort((a, b) => a.favorability - b.favorability)[0];
      return this.pick('pos_contradiction', F.positionContradiction)
        .replace('{pos}', `the ${s.position}`)
        .replace('{favor}', named(favor))
        .replace('{adverse}', named(adverse));
    }

    const visible = s.cards.filter((c) => !c.veiled);
    if (visible.length === 0) {
      return `${framing} what is veiled ${F.positionLeans[s.lean]}`;
    }
    const names = visible.length === 1
      ? namedGloss(visible[0])
      : joinAnd(visible.map(named), F.drawFraming.group.listLast, F.drawFraming.group.mid);
    return `${framing} ${names}, ${F.positionLeans[s.lean]}`;
  }
```

- [ ] **Step 7: Update the existing positions-shape assertions**

(7a) In `src/engine/__tests__/ReadingComposer.test.ts`, replace the body of the `if (positions && positions.kind === 'positions')` block (line 79):

```ts
      expect(positions.summaries.map((s) => s.position)).toEqual(['past', 'present', 'future']);
      expect(positions.summaries.map((s) => s.lean)).toEqual(['favor', 'steady', 'adverse']);
```

(7b) In `src/engine/__tests__/NarrativeAssembler.test.ts`, replace the whole `'renders a multi-card spread as named positions'` test (lines ~98-111) — the old version asserts the literal capitalized "Past"/"Future" labels that the new card-named prose no longer emits:

```ts
  it('renders a multi-card spread as one merged, elaborated positions line', () => {
    const spread = makeSlot('tarot', {
      spread: [
        { position: 'past', card: { name: 'Aurora', orientation: 'upright', themes: ['renewal'], dimensions: { favorability: 1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'a', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'present', card: { name: 'Beacon', orientation: 'upright', themes: ['harmony'], dimensions: { favorability: 0.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'b', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
        { position: 'future', card: { name: 'Cinder', orientation: 'reversed', themes: ['conflict'], dimensions: { favorability: -1.0, certainty: 0, volatility: 0 }, modifierRoles: ['subject'], id: 'c', arcana: 'minor', symbol: '✦', meaningUpright: '', meaningReversed: '', tags: [] } },
      ],
    });
    const agg = { ...baseAggregated, modifierAssignments: { subject: [spread], action: [], effect: [] } };
    const result = assembler.assemble(agg, [spread], 'self', { chaos: 40, order: 50 });
    const body = result.paragraphs.join('\n');
    expect(body).toContain('Aurora');
    expect(body).toContain('Cinder');
    expect(body).toMatch(/leans toward fortune|holds steady|turns adverse/);
  });
```

- [ ] **Step 8: Run the affected tests**

Run: `npx vitest run src/engine/__tests__/TarotPositions.test.ts src/engine/__tests__/ReadingComposer.test.ts src/engine/__tests__/NarrativeAssembler.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/engine/narrative/types.ts src/engine/narrative/ReadingComposer.ts src/engine/narrative/ProseBuilder.ts src/data/reading-fragments.ts src/engine/__tests__/ReadingComposer.test.ts src/engine/__tests__/NarrativeAssembler.test.ts src/engine/__tests__/TarotPositions.test.ts
git commit -m "feat(narrative): one elaborated, contradiction-aware P/P/F positions beat"
```

---

### Task 3: Strings — one woven journey (`stringsVoice.describeGroup`)

**Files:**
- Modify: `src/engine/narrative/voices/index.ts` (`stringsVoice.describeGroup`)
- Modify: `src/data/reading-fragments.ts` (`drawFraming.group.stringsLead`, `drawFraming.group.stringsSplit`)
- Test: `src/engine/__tests__/MinigameVoices.test.ts` (add a strings factory + 2 tests)

**Interfaces:**
- Consumes: existing `joinAnd`, `verbPhrase`, `groupDims`, `DF` (all in `voices/index.ts`).

- [ ] **Step 1: Write the failing tests**

Add a strings factory near the top of `src/engine/__tests__/MinigameVoices.test.ts` (after the `tarot` factory):

```ts
const strings = (name: string, fav = 0): SlotResult => ({
  type: 'strings', name, symbol: '✶', interpretation: 'A woven path',
  themes: ['mystery'], tags: [], modifierRoles: ['subject'],
  dimensions: { favorability: fav, certainty: 0, volatility: 0 },
} as unknown as SlotResult);
```

Add a describe block:

```ts
describe('MinigameVoice — strings journey aggregation', () => {
  it('converging destinations read as one journey through pooled waypoints', () => {
    const g = voiceFor('strings').describeGroup(
      [strings('Origin · Mid · End'), strings('Origin · Other · End')], 'subject', 0,
    );
    expect(g.subject.toLowerCase()).toContain('drawn from');
    expect(g.subject).toContain('Origin');
    expect(g.subject).toContain('Mid');
    expect(g.subject).toContain('Other');
    expect(g.subject).toContain('End');
    expect(g.clause.trim().length).toBeGreaterThan(0);
  });

  it('diverging destinations read as a split', () => {
    const g = voiceFor('strings').describeGroup(
      [strings('Origin · A'), strings('Origin · B')], 'subject', 0,
    );
    expect(g.subject.toLowerCase()).toContain('split');
    expect(g.subject).toContain('A');
    expect(g.subject).toContain('B');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts -t "strings journey"`
Expected: FAIL — current group subject lists `to {dest}` items, no "drawn from"/"split".

- [ ] **Step 3: Add the fragments**

In `src/data/reading-fragments.ts`, inside `drawFraming.group` (after the `lead` map, before `seqLast`), add:

```ts
      stringsLead: 'the threads, drawn from',
      stringsSplit: 'the threads split from',
```

- [ ] **Step 4: Rewrite `stringsVoice.describeGroup`**

Replace the `describeGroup` of `stringsVoice` (lines ~118-127):

```ts
  describeGroup(slots, role, _occBase) {
    const threads = slots.filter((s): s is Extract<SlotResult, { type: 'strings' }> => s.type === 'strings');
    const partsOf = (t: Extract<SlotResult, { type: 'strings' }>) => t.name.split(' · ');
    const origin = partsOf(threads[0])[0] ?? 'the start';
    const waypoints: string[] = [];
    const destinations: string[] = [];
    for (const t of threads) {
      const p = partsOf(t);
      for (const mid of p.slice(1, -1)) if (!waypoints.includes(mid)) waypoints.push(mid);
      const dest = p[p.length - 1] ?? 'the end';
      if (!destinations.includes(dest)) destinations.push(dest);
    }
    let subject: string;
    if (destinations.length > 1) {
      subject = `${DF.group.stringsSplit} ${origin} toward ${joinAnd(destinations, DF.group.listLast, DF.group.mid)}`;
    } else {
      const through = waypoints.length > 0 ? ` through ${joinAnd(waypoints, DF.group.listLast, DF.group.mid)}` : '';
      subject = `${DF.group.stringsLead} ${origin}${through} to ${destinations[0] ?? 'the end'}`;
    }
    const clause = verbPhrase(role, groupDims(slots), 'strings-group' + threads.map((t) => t.name).join('|'));
    return { subject, clause };
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/narrative/voices/index.ts src/data/reading-fragments.ts src/engine/__tests__/MinigameVoices.test.ts
git commit -m "feat(narrative): strings describeGroup reads as one woven journey"
```

---

### Task 4: D20 — trend, not a list (`d20Voice.describeGroup`)

**Files:**
- Modify: `src/engine/narrative/voices/index.ts` (`trendOf` helper + `d20Voice.describeGroup`)
- Modify: `src/data/reading-fragments.ts` (`drawFraming.group.d20Trend`)
- Test: `src/engine/__tests__/MinigameVoices.test.ts` (update the existing d20 group test + add 2 trend tests)

**Interfaces:**
- Consumes: existing `joinSeq`, `verbPhrase`, `groupDims`, `DF`.
- Produces: `function trendOf(values: number[]): 'rising' | 'falling' | 'scattered'`.

- [ ] **Step 1: Update the existing d20 group test + add trend tests**

In `src/engine/__tests__/MinigameVoices.test.ts`, in the `'collapses 3 d20 draws...'` test, replace the line asserting the old lead:

```ts
    expect(g.subject).toContain('the dice fall in turn');
```

with:

```ts
    expect(g.subject).toContain('the dice climbing'); // 5,12,18 is strictly rising
```

Then add a new describe block:

```ts
describe('MinigameVoice — d20 trend aggregation', () => {
  it('a strictly falling sequence reads as falling', () => {
    const g = voiceFor('d20').describeGroup([d20(18), d20(12), d20(5)], 'effect', 0);
    expect(g.subject).toContain('the dice falling');
    expect(g.subject.match(/the dice/g)?.length).toBe(1);
  });
  it('a non-monotonic sequence reads as scattered', () => {
    const g = voiceFor('d20').describeGroup([d20(5), d20(18), d20(11)], 'effect', 0);
    expect(g.subject).toContain('the dice scattering');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts -t "d20"`
Expected: FAIL — subject still says "the dice fall in turn".

- [ ] **Step 3: Add the fragment**

In `src/data/reading-fragments.ts`, inside `drawFraming.group` (after the `stringsSplit` line), add:

```ts
      d20Trend: { rising: 'the dice climbing —', falling: 'the dice falling —', scattered: 'the dice scattering —' } as Record<string, string>,
```

- [ ] **Step 4: Add `trendOf` and rewrite `d20Voice.describeGroup`**

Add the helper near the other top-level helpers in `voices/index.ts`:

```ts
function trendOf(values: number[]): 'rising' | 'falling' | 'scattered' {
  let rising = true, falling = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) rising = false;
    if (values[i] >= values[i - 1]) falling = false;
  }
  return rising ? 'rising' : falling ? 'falling' : 'scattered';
}
```

Replace `d20Voice.describeGroup` (lines ~71-77):

```ts
  describeGroup(slots, role, _occBase) {
    const dice = slots.filter((s): s is Extract<SlotResult, { type: 'd20' }> => s.type === 'd20');
    const values = dice.map((d) => d.result);
    const lead = DF.group.d20Trend[trendOf(values)];
    const subject = `${lead} ${joinSeq(values.map(String), DF.group.seqLast, DF.group.mid)}`;
    const clause = verbPhrase(role, groupDims(slots), 'd20-group' + values.join('|'));
    return { subject, clause };
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/narrative/voices/index.ts src/data/reading-fragments.ts src/engine/__tests__/MinigameVoices.test.ts
git commit -m "feat(narrative): d20 describeGroup leads with the roll trend"
```

---

### Task 5: I Ching — movement between states (`ichingVoice.describeGroup`)

**Files:**
- Modify: `src/engine/narrative/voices/index.ts` (`ichingVoice.describeGroup`)
- Modify: `src/data/reading-fragments.ts` (`drawFraming.group.ichingMovement`)
- Test: `src/engine/__tests__/MinigameVoices.test.ts` (add an iching factory + 1 test)

**Interfaces:**
- Consumes: existing `verbPhrase`, `groupDims`, `gloss`, `DF`.

- [ ] **Step 1: Write the failing test**

Add an iching factory near the top of `src/engine/__tests__/MinigameVoices.test.ts`:

```ts
const iching = (n: number, name: string, fav = 0): SlotResult => ({
  type: 'iching', hexagramNumber: n, name, symbol: '䷀',
  judgment: 'Success comes through perseverance', changingLines: [],
  themes: ['mystery'], tags: [], modifierRoles: ['effect'],
  dimensions: { favorability: fav, certainty: 0, volatility: 0 },
} as unknown as SlotResult);
```

Add a describe block:

```ts
describe('MinigameVoice — iching movement aggregation', () => {
  it('names the first and last hexagram and appends the final judgment gloss', () => {
    const g = voiceFor('iching').describeGroup([iching(1, 'The Creative'), iching(29, 'The Abyss')], 'effect', 0);
    expect(g.subject.toLowerCase()).toContain('turning from');
    expect(g.subject).toContain('The Creative');
    expect(g.subject).toContain('The Abyss');
    expect(g.clause.toLowerCase()).toContain('success comes through perseverance');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts -t "iching movement"`
Expected: FAIL — current group subject lists hexagram numbers, no "turning from".

- [ ] **Step 3: Add the fragment**

In `src/data/reading-fragments.ts`, inside `drawFraming.group` (after the `d20Trend` line), add:

```ts
      ichingMovement: 'the hexagrams turning from {from} toward {to}',
```

- [ ] **Step 4: Rewrite `ichingVoice.describeGroup`**

Replace `ichingVoice.describeGroup` (lines ~93-99):

```ts
  describeGroup(slots, role, _occBase) {
    const hexes = slots.filter((s): s is Extract<SlotResult, { type: 'iching' }> => s.type === 'iching');
    const first = hexes[0], last = hexes[hexes.length - 1];
    const subject = DF.group.ichingMovement
      .replace('{from}', `Hexagram ${first.hexagramNumber}, ${first.name}`)
      .replace('{to}', `Hexagram ${last.hexagramNumber}, ${last.name}`);
    let clause = verbPhrase(role, groupDims(slots), 'iching-group' + hexes.map((h) => h.hexagramNumber).join('|'));
    const g = gloss(last.judgment);
    if (g) clause = `${clause} — ${g}`;
    return { subject, clause };
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/MinigameVoices.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/narrative/voices/index.ts src/data/reading-fragments.ts src/engine/__tests__/MinigameVoices.test.ts
git commit -m "feat(narrative): iching describeGroup narrates movement between hexagrams"
```

---

### Task 6: Docs sync + full verification

**Files:**
- Modify: `docs/game-systems.md` (synthesis-aggregation paragraph, ~lines 620-625)

- [ ] **Step 1: Update the documented synthesis behavior**

In `docs/game-systems.md`, find the sentence in the "Synthesis profiles over atomic signals" paragraph that reads:

> emits one **per-position line** per spread (instead of re-listing the spread inside the modifier frames)

Replace it with:

> merges every multi-card spread into **one Past/Present/Future set** (`aggregateTarotPositions`) and emits a single positions beat that **names the card(s) per position, weaves a meaning gloss, and flags a contradiction** when a position holds both a favorable and an adverse card (instead of re-listing each spread inside the modifier frames)

Then, in the "Display touchpoints" list, update the `NarrativeAssembler` bullet to note that repeated same-type draws now collapse through their voice's `describeGroup` into one combined voice (tarot via positions; strings as one woven journey; d20 as a roll trend; I Ching as movement between hexagrams).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass (baseline was 697; this plan adds ~11 and updates 2).

- [ ] **Step 3: Typecheck the whole project**

Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md
git commit -m "docs: sync synthesis aggregation (merged P/P/F + per-modality voices)"
```

---

## Self-Review notes

- **Spec coverage:** tarot positional merge + elaboration + contradiction (Tasks 1-2); strings journey (Task 3); d20 trend (Task 4); I Ching movement (Task 5); non-goals (tiles/share/LLM prompt) untouched by construction; docs sync (Task 6). Edge cases covered by tests: single-spread (Task 1/2), three-spread merge (Task 1), contradiction (Task 1/2), veiled (Task 1/2).
- **Build-green ordering:** Task 1 is pure addition; Task 2 makes the breaking Beat-shape change atomically across types/composer/builder/fragments/test; Tasks 3-5 are independent `describeGroup` modifications.
- **Type consistency:** `PositionCard`/`PositionSummary` defined in Task 1 and consumed unchanged in Task 2; `aggregateTarotPositions`, `trendOf` signatures stable; fragment keys (`positionFraming`, `positionContradiction`, `stringsLead`, `stringsSplit`, `d20Trend`, `ichingMovement`) referenced exactly as defined.
- **Existing-test regressions audited:** the only tests that assert the old positions/group output are `ReadingComposer.test.ts:79` (Task 2.7a), `NarrativeAssembler.test.ts:98-111` (Task 2.7b), and `MinigameVoices.test.ts` d20 group (Task 4.1). All three are updated in-plan. A repo-wide search for `.entries`/`leans toward`/`the dice fall in turn` surfaced no other dependents. `MinigameVoices.test.ts:25` only checks `drawFraming.group.lead.*` keys still exist (they remain as data), so it stays green.
