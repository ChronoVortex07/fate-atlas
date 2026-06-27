# Results Reading Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rigid stage-by-stage narrative generator with an offline beat-composer that reads organically, weaves in the actual draws, and stops bookending every reading with the dominant theme.

**Architecture:** `NarrativeAssembler` stays the public façade (signatures unchanged). Internally it delegates to three new pure-ish units in `src/engine/narrative/`: `ReadingComposer` (aggregate → typed `Beat[]`), `drawVoice` (a draw → a grammatical `{subject, clause}` fragment), and `ProseBuilder` (beats + seed → headline/paragraphs/tensionNote, with connective stitching). Fragment pools move to `src/data/reading-fragments.ts`. Deterministic per-reading via a seed offset on rotation; no `Math.random`.

**Tech Stack:** TypeScript (strict), Vitest (engine tests only, Node env). React untouched.

## Global Constraints

- Engine is framework-free: zero React/DOM imports in `src/engine/`.
- `SynthesisResult` shape is preserved exactly: `{ headline: string; paragraphs: string[]; tensionNote?: string; affinityNote?: string }`.
- `NarrativeAssembler` public API preserved: `assemble(aggregated, results, question, affinities, effects?)`, `generateLLMPrompt(run)`, `resetRotation()`, `getRotationSnapshot()`, `restoreRotation(snapshot)`.
- `generateLLMPrompt` and `describeSlotFull` are NOT changed.
- `ReadingPlanner.aggregate()` / `AggregatedReading` / affinity engine NOT changed.
- No `Math.random` in synthesis; determinism via seeded rotation so share-as-image and debug `previewSynthesis` stay stable.
- `tsc -b` clean (strict, noUnusedLocals, noUnusedParameters). `npm test` green.

---

## File Structure

- Create `src/engine/narrative/types.ts` — `FavBand`, `DrawVoice`, `Beat`.
- Create `src/engine/narrative/drawVoice.ts` — `describeDraw(slot, role)`, `favBandOf(value)`.
- Create `src/engine/narrative/ReadingComposer.ts` — `ReadingComposer.compose(input)`.
- Create `src/engine/narrative/ProseBuilder.ts` — `ProseBuilder` (rotation owner) + `seedFor(...)`, `joinClauses(...)`.
- Create `src/data/reading-fragments.ts` — `READING_FRAGMENTS` pools + `ReadingFragments` type.
- Modify `src/engine/NarrativeAssembler.ts` — rewrite `assemble()` to delegate; keep `generateLLMPrompt`/`describeSlotFull`; delegate rotation methods to `ProseBuilder`.
- Delete `src/data/narrative-templates.ts` and `NarrativeTemplates` type in `src/engine/types.ts` once unused.
- Create tests: `src/engine/__tests__/DrawVoice.test.ts`, `ReadingComposer.test.ts`, `ProseBuilder.test.ts`.
- Modify `src/engine/__tests__/NarrativeAssembler.test.ts` — keep LLM/affinity/tension-presence tests; rewrite pipeline-coupled assertions.

---

## Task 1: Narrative types + draw-voice fragments + `describeDraw`

**Files:**
- Create: `src/engine/narrative/types.ts`
- Create: `src/data/reading-fragments.ts` (verb-phrase + connective + draw pools; other pools added in Task 3)
- Create: `src/engine/narrative/drawVoice.ts`
- Test: `src/engine/__tests__/DrawVoice.test.ts`

**Interfaces:**
- Produces:
  - `type FavBand = 'high' | 'neutral' | 'low'`
  - `interface DrawVoice { subject: string; clause: string }`
  - `type Beat = …` (full union per spec; see code below)
  - `function favBandOf(value: number): FavBand` (high ≥ 0.5, low ≤ −0.5, else neutral)
  - `function describeDraw(slot: SlotResult, role: ModifierRole): DrawVoice`
  - `READING_FRAGMENTS.verbPhrases: Record<ModifierRole, Record<FavBand, string[]>>`

- [ ] **Step 1: Write `src/engine/narrative/types.ts`**

```ts
import type { ThemeTag, ModifierRole, QuestionType } from '../types';

export type FavBand = 'high' | 'neutral' | 'low';

export interface DrawVoice {
  subject: string; // e.g. "The Tower, reversed"
  clause: string;  // e.g. "unsettles the very ground you stand on"
}

export interface Pole { label: string; value: number }

export type Beat =
  | { kind: 'theme'; theme: ThemeTag; secondary: ThemeTag | null; favBand: FavBand }
  | { kind: 'fortune'; favBand: FavBand; strongestFavor: Pole | null; strongestAdverse: Pole | null }
  | { kind: 'temper'; axis: 'certainty' | 'volatility'; band: 'high' | 'low' }
  | { kind: 'force'; role: ModifierRole; draws: DrawVoice[] }
  | { kind: 'positions'; entries: { position: string; lean: 'favor' | 'steady' | 'adverse' }[] }
  | { kind: 'opposition'; favPole: Pole; advPole: Pole }
  | { kind: 'tensionPair'; pair: [ThemeTag, ThemeTag] }
  | { kind: 'close'; question: QuestionType; theme: ThemeTag; carryForce: string | null };
```

- [ ] **Step 2: Write `src/data/reading-fragments.ts` (Task-1 portion)**

Define `verbPhrases` (role × favBand, ≥2 each), `drawLeadIns` (role → intro fragments), and `connectives` (`contrast`, `additive`). Each pool ≥2 entries. Example shape:

```ts
import type { ModifierRole } from '../engine/types';
import type { FavBand } from '../engine/narrative/types';

export const READING_FRAGMENTS = {
  verbPhrases: {
    subject: {
      high: ['stands bright at the center of this', 'anchors the reading in something hopeful'],
      neutral: ['sits at the heart of the matter', 'holds the center without tipping the scales'],
      low: ['shadows the heart of the matter', 'sets an uneasy weight at the center'],
    },
    action: {
      high: ['urges you to move while the way is open', 'invites a bold and open hand'],
      neutral: ['asks for a measured, deliberate step', 'counsels patience over haste'],
      low: ['counsels you to hold rather than strike', 'warns against forcing the matter now'],
    },
    effect: {
      high: ['promises the current will carry you', 'points toward an opening ahead'],
      neutral: ['leaves the outcome genuinely in your hands', 'shapes an outcome still unwritten'],
      low: ['warns the cost will be felt before the gain', 'points to friction on the road ahead'],
    },
  } satisfies Record<ModifierRole, Record<FavBand, string[]>>,
  // ... drawLeadIns, connectives (added/extended here)
};
```

- [ ] **Step 3: Write failing test `DrawVoice.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { describeDraw, favBandOf } from '../narrative/drawVoice';
import type { SlotResult, ModifierRole } from '../types';

const tarot = (over: Record<string, unknown> = {}): SlotResult => ({
  type: 'tarot', id: 't', name: 'The Tower', number: 16, orientation: 'reversed',
  symbol: '☉', meaningUpright: 'Sudden upheaval', meaningReversed: 'Averted disaster',
  themes: ['upheaval'], tags: [], modifierRoles: ['subject'],
  dimensions: { favorability: -1, certainty: 0.5, volatility: 1 }, ...over,
} as unknown as SlotResult);

describe('describeDraw', () => {
  it('names a single tarot card and yields a non-empty clause', () => {
    const v = describeDraw(tarot(), 'subject' as ModifierRole);
    expect(v.subject).toContain('Tower');
    expect(v.subject).toContain('reversed');
    expect(v.clause.trim().length).toBeGreaterThan(0);
  });
  it('low favorability selects the low verb-phrase band', () => {
    const v = describeDraw(tarot({ dimensions: { favorability: -1, certainty: 0, volatility: 0 } }), 'action');
    expect(v.clause).toMatch(/hold|warns|friction|cost/);
  });
  it('d20 names the rolled value', () => {
    const d = describeDraw({ type: 'd20', result: 17, threshold: 'success', interpretation: 'A clear win',
      themes: ['authority'], tags: [], modifierRoles: ['effect'],
      dimensions: { favorability: 1, certainty: 0, volatility: 0 } } as unknown as SlotResult, 'effect');
    expect(d.subject).toContain('17');
    expect(d.clause.trim().length).toBeGreaterThan(0);
  });
  it('iching names the hexagram', () => {
    const h = describeDraw({ type: 'iching', hexagramNumber: 49, name: 'Revolution', symbol: '䷰',
      judgment: 'Change comes at the appointed hour', changingLines: [3], themes: ['transformation'],
      tags: [], modifierRoles: ['effect'], dimensions: { favorability: 0, certainty: 0, volatility: 1 } } as unknown as SlotResult, 'effect');
    expect(h.subject).toMatch(/49|Revolution/);
    expect(h.clause.trim().length).toBeGreaterThan(0);
  });
  it('favBandOf thresholds', () => {
    expect(favBandOf(0.5)).toBe('high');
    expect(favBandOf(-0.5)).toBe('low');
    expect(favBandOf(0.2)).toBe('neutral');
  });
});
```

- [ ] **Step 4: Run, expect FAIL** — `npx vitest run src/engine/__tests__/DrawVoice.test.ts` (module not found).

- [ ] **Step 5: Implement `src/engine/narrative/drawVoice.ts`**

`favBandOf`; `describeDraw` switches on `slot.type`. tarot single → `subject = "The {name}, {orientation}"`, clause = a `verbPhrases[role][favBand]` pick (rotation-free deterministic pick by a tiny per-slot index, e.g. `name.length % pool.length`) optionally suffixed with a trimmed meaning gloss. d20 → `subject = "the dice, settling on {result}"`. iching → `subject = "Hexagram {n}, {name}"` + changing-line aside. strings → `subject = "the thread from {origin} to {dest}"`. Multi-card tarot is handled by the composer (positions beat), so `describeDraw` treats a passed multi-spread by falling back to its first card. Never returns empty `subject`/`clause`.

- [ ] **Step 6: Run, expect PASS.**

- [ ] **Step 7: Commit** — `feat(reading): draw-voice fragments + describeDraw`.

---

## Task 2: ReadingComposer (aggregate → Beat[])

**Files:**
- Create: `src/engine/narrative/ReadingComposer.ts`
- Test: `src/engine/__tests__/ReadingComposer.test.ts`

**Interfaces:**
- Consumes: `Beat`, `DrawVoice` (Task 1); `describeDraw` (Task 1); `AggregatedReading`, `SlotResult`, `QuestionType`, `AffinityEffects` (existing).
- Produces:
  - `interface ComposeInput { aggregated: AggregatedReading; results: SlotResult[]; question: QuestionType; effects?: AffinityEffects; seed: number }`
  - `class ReadingComposer { compose(input: ComposeInput): Beat[] }`

**Behavior:**
- Build candidate beats: `theme`, `fortune` (favorability always speaks), `temper` (certainty/volatility only when non-neutral via existing `getPolarBand` thresholds: high ≥ 1.0, low ≤ −0.9), one `force` per filled modifier role (multi-card tarot diverted to a single `positions` beat), `opposition` when poles oppose (`favPole.value ≥ 1 && advPole.value ≤ −1`), `tensionPair` when `aggregated.tensionPair` set, `close`.
- **Opener selection:** if a strong `opposition` exists OR `dominantTheme` is weak/`'mystery'` fallback with scattered themes → cold-open with `opposition`/strongest `force`; else alternate between `theme` and `fortune` opener by `seed % 2`. The non-opener theme/fortune beat is placed mid-body. Guarantee: the `theme` beat is never both first and the `close`'s sole content (close varies form; see Task 3).
- **Order:** `[opener] → remaining mood beats → force/positions beats (role order subject, action, effect) → opposition/tensionPair (if not opener) → close`.
- **Detail/terse:** `effects.readingDetail < 0` → omit `temper` and all but the first `force` beat; `> 0` → keep all and mark `close.carryForce` from the strongest force's subject for an extra callback.
- De-dupe a SlotResult shared across roles into one `force` beat (assign to its strongest role) — mirror the existing single-frame de-dupe.

- [ ] **Step 1: Write failing `ReadingComposer.test.ts`** — assert: (a) opposition beat present iff poles oppose; (b) theme beat is not the only/duplicated content of opener+close — i.e. `kinds.indexOf('theme')` not both `0` and last; (c) opener kind changes between `seed=0` and `seed=1` for a neutral-theme aggregate; (d) terse (`readingDetail:-1`) yields ≤1 force beat; (e) a 3-card spread yields a `positions` beat, not 3 force draws.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `ReadingComposer`.**

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `feat(reading): ReadingComposer beat selection + de-bookending`.

---

## Task 3: ProseBuilder (Beat[] → headline/paragraphs/tensionNote)

**Files:**
- Create: `src/engine/narrative/ProseBuilder.ts`
- Modify: `src/data/reading-fragments.ts` (add `themeMoods`, `fortune`, `temper`, `closes`, `opposition`, `positions`, `headlines` pools)
- Test: `src/engine/__tests__/ProseBuilder.test.ts`

**Interfaces:**
- Consumes: `Beat` (Task 1); `READING_FRAGMENTS`.
- Produces:
  - `function seedFor(aggregated: AggregatedReading, question: QuestionType, results: SlotResult[]): number`
  - `function joinClauses(clauses: string[]): string` — trims, drops empties, capitalizes sentence starts, guarantees terminal punctuation.
  - `class ProseBuilder { resetRotation(): void; getRotationSnapshot(): Map<string,number>; restoreRotation(s: Map<string,number>): void; build(beats: Beat[], ctx: { aggregated: AggregatedReading; question: QuestionType; seed: number }): { headline: string; paragraphs: string[]; tensionNote?: string } }`

**Behavior:**
- Seeded `pick(poolKey, pool)`: index = `(rotation.get(key) ?? 0)`, but starting offset is `seed`; result `pool[(idx + seed) % pool.length]`, increment rotation. Deterministic per `(seed, key)`.
- `renderBeat(beat) → { text: string; valence: 'pos'|'neg'|'neu'; group: 'open'|'body'|'tension'|'close' }`. `force`/`positions` → body; `opposition`/`tensionPair` → tension; `close` → close; theme/fortune/temper → open (or body if not first). A `force` beat folds its `DrawVoice[]` (lead-in + subject + clause) with connectives.
- Group segments into paragraphs (open, body[1–2], tension, close). Within a paragraph, join with connectives: **contrast** when adjacent valence flips, **additive** when same, plain break otherwise — all via seeded `pick` over `connectives`.
- `tensionNote` = the rendered tension segment text (when present).
- `headline` via `pick` over `READING_FRAGMENTS.headlines["{theme}_{favBand}"]` with the `Threads of Fate Unspool…` fallback.
- Every output paragraph passes through `joinClauses` → no empty paragraph, terminal punctuation guaranteed.

- [ ] **Step 1: Write failing `ProseBuilder.test.ts`** — invariants on a hand-built `Beat[]`: no empty/whitespace paragraph; every paragraph ends with `.`/`!`/`?`/`…`/`—`-free terminal; a force beat's draw subject appears in some paragraph; with ≥2 force beats at least one connective token (`yet|and so|while|;|—`) appears; `build(beats, {seed:0})` deep-equals a second `build` with the same seed (determinism); differs for `seed:1` somewhere. Also `joinClauses(['', '  ', 'the way is open'])` → `'The way is open.'`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `ProseBuilder` + extend `reading-fragments.ts`.**

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `feat(reading): ProseBuilder connective stitching + seeded determinism`.

---

## Task 4: Wire ProseBuilder/Composer into the NarrativeAssembler façade

**Files:**
- Modify: `src/engine/NarrativeAssembler.ts`
- Modify: `src/engine/__tests__/NarrativeAssembler.test.ts`

**Interfaces:**
- Consumes: `ReadingComposer`, `ProseBuilder`, `seedFor` (Tasks 2–3).
- Produces: unchanged public API. `resetRotation`/`getRotationSnapshot`/`restoreRotation` delegate to the owned `ProseBuilder`. `generateLLMPrompt`/`describeSlotFull` retained verbatim.

**Behavior of new `assemble`:**
1. `seed = seedFor(aggregated, question, results)`.
2. `beats = this.composer.compose({ aggregated, results, question, effects, seed })`.
3. `{ headline, paragraphs, tensionNote } = this.builder.build(beats, { aggregated, question, seed })`.
4. `affinityNote` computed by the retained logic (chaos/order elevated bands; clarity ≥2 prefixes "name themselves"; ≤−2 cryptic; detail>0 adds the "every thread lies plain" wording as an extra paragraph appended *before* close — keep behavior but via composer's detail beat rather than `splice`).
5. Return `{ headline, paragraphs, tensionNote, affinityNote }`.

- [ ] **Step 1: Update `NarrativeAssembler.test.ts`** — keep: `generateLLMPrompt` tests (both), `affinity note appears for high chaos/order`, `clarity >= 2 names the forces`, `rich >= terse paragraph count`, `no tension -> tensionNote undefined`, `tension fires for opposing themes` (assert a paragraph mentions both theme words case-insensitively). Replace pipeline-coupled tests with new-contract assertions: produces ≥1 paragraph; no empty paragraph; every paragraph ends in terminal punctuation; a filled modifier role's draw name appears; the dominant theme word does not appear in BOTH `paragraphs[0]` and the last paragraph for at least one representative aggregate (de-bookending). Remove `describeSlotBrief` describe block (method removed).

- [ ] **Step 2: Run updated suite, expect FAIL** (assemble still old).

- [ ] **Step 3: Rewrite `assemble()`** to delegate; add `private composer`/`private builder`; delegate rotation methods; remove `describeSlotBrief`, the stage methods, and the `NARRATIVE_TEMPLATES` import.

- [ ] **Step 4: Run, expect PASS** — `npx vitest run src/engine/__tests__/NarrativeAssembler.test.ts`.

- [ ] **Step 5: Commit** — `feat(reading): delegate NarrativeAssembler to beat composer`.

---

## Task 5: Cleanup, typecheck, full suite, docs

**Files:**
- Delete: `src/data/narrative-templates.ts`
- Modify: `src/engine/types.ts` (remove `NarrativeTemplates` type if now unused)
- Modify: `README.md` (only if it documents synthesis paragraph format)

- [ ] **Step 1: Grep for `NARRATIVE_TEMPLATES` / `NarrativeTemplates`** — confirm only the deleted file + assembler referenced them; remove the type.

- [ ] **Step 2: `npx tsc -b`** — expect clean (watch `noUnusedLocals`/`noUnusedParameters`).

- [ ] **Step 3: `npm test`** — expect full green.

- [ ] **Step 4: Manual smoke** — `npm run dev`, play a reading (or `?debug` inject), confirm prose flows, names draws, varies opener/close, no dangling sentences.

- [ ] **Step 5: Update README reading section** if needed; commit `chore(reading): remove dead templates + docs`.

---

## Self-Review notes

- **Spec coverage:** module split (T1–T4), beat model (T1), de-bookending (T2), connective stitching + joinClauses bug-fixes (T3), weaving per type (T1 drawVoice + T2 positions), determinism/seed (T3), terse/detail without `splice` (T2+T4), test plan (T1–T4), cleanup/docs (T5). All spec sections mapped.
- **Type consistency:** `describeDraw(slot, role)`, `compose(input)`, `build(beats, ctx)`, `seedFor(...)`, `joinClauses(...)`, `favBandOf(...)` names used identically across tasks.
- **No `Math.random`; `SynthesisResult` shape and façade API preserved.**
