# Results-Synthesis Aggregation — Design

**Date:** 2026-06-29
**Branch:** `feat/results-synthesis-aggregation`
**TODO item:** "Result synthesis for multiple minigames are still bugged. There can be
multiple sets of past/present/future readings with multiple tarot readings, when all
minigames should generalise one coherent set first before sending in for final
synthesis. Other minigames also have this problem, such as strings of fate."

## Problem

When a turn plays the same minigame more than once (a deep reading), the **synthesised
prose** narrates each play as a separate block. The most visible case is tarot: three
tarot plays produce three independent Past/Present/Future spreads, so the reading reads
"…the Past leans favourably, the Present holds steady, the Future turns adverse, the
Past…" — multiple disjoint sets. Each position is also reduced to a bare
favour/steady/adverse *lean*, never naming the card, which the user finds too simple.

This is **prose-only**. The result tiles, share card, and copy-able LLM prompt are out of
scope and must keep showing every game.

## Diagnosis

The narrative layer already has a per-type aggregation mechanism — the **voices**
(`src/engine/narrative/voices/index.ts`), where each `MinigameVoice.describeGroup`
collapses 2+ same-type, same-role draws into one combined voice. Single-result draws
(d20, I Ching, strings, single-card tarot) already route through it in the **force
beats** (`ReadingComposer` lines 84–102).

**Multi-card tarot spreads bypass the voices entirely.** `ReadingComposer.compose`
excludes multi-spreads from the force beats (lines 71, 86) and builds a separate
**positions beat** inline (lines 106–115) via `spreads.flatMap(...)`. That code never
de-duplicates by position (N spreads → N×3 entries) and discards the card, keeping only
a lean. Tarot is the one modality whose aggregation never went through the voices
mechanism — that is the entire bug.

Separately, the existing `describeGroup` implementations for d20 / I Ching / strings
collapse correctly but shallowly (a bare list of values / hexagram numbers /
destinations). The user asked for **all modalities deepened** into bespoke aggregations.

## Goals

1. Tarot: generalise all spread cards across every tarot play into **one** Past/Present/
   Future set; elaborate each position by naming the card(s) and weaving a gloss; **handle
   contradictions** when a position holds both a favourable and an adverse card.
2. Strings: aggregate multiple paths into **one woven journey** (origin → waypoints →
   destination), surfacing convergence vs divergence of destinations.
3. D20: aggregate multiple rolls into a **trend** (rising / falling / scattered), still
   naming each value.
4. I Ching: aggregate multiple casts as **movement** between states (first → last) with the
   final judgment's gloss.
5. Each minigame owns its own aggregation, in its voice. Composer stays prose-free;
   ProseBuilder + fragment pools realise the text.

## Non-goals

- No change to result tiles, `ShareCard`, or `CardDetailModal` (they show every game).
- No change to `NarrativeAssembler.generateLLMPrompt` (the LLM prompt already carries a
  Structured Brief plus every raw draw, which is correct for an LLM).
- No change to `ReadingPlanner.aggregate` or `AggregatedReading` (the dimension/theme
  aggregation is already coherent). All work is in `src/engine/narrative/**` and
  `src/data/reading-fragments.ts`.
- No cross-role merging of single-result draws. A draw is still narrated in its strongest
  modifier role (subject/action/effect); that is intentional narrative structure, not the
  "multiple sets" bug.

## Design

### 1. Tarot positional aggregation (the special path)

New structured payload for the positions beat, in `src/engine/narrative/types.ts`:

```ts
export interface PositionCard {
  name: string;
  orientation: 'upright' | 'reversed';
  lean: 'favor' | 'steady' | 'adverse';
  gloss: string;          // short phrase from meaningUpright/Reversed; '' when veiled
  veiled: boolean;
}
export interface PositionSummary {
  position: 'past' | 'present' | 'future';
  cards: PositionCard[];  // all cards that landed in this position, across every spread
  lean: 'favor' | 'steady' | 'adverse';  // magnitude-weighted merged lean
  contradiction: boolean; // ≥1 card fav ≥ +0.5 AND ≥1 card fav ≤ −0.5
}
// Beat union member changes from { entries: {position, lean}[] } to:
| { kind: 'positions'; summaries: PositionSummary[] }
```

Aggregation lives in the tarot voice as an exported helper
`aggregateTarotPositions(spreads: SlotResult[]): PositionSummary[]`:

- Bucket every `{ position, card }` from every multi-card spread by position.
- Emit occupied positions in canonical order `[past, present, future]`.
- `lean`: `leanOf(weightedMeanFavorability(cards))`, where
  `leanOf(f) = f >= 0.5 ? 'favor' : f <= -0.5 ? 'adverse' : 'steady'` (matches the existing
  threshold) and the weighted mean is `Σ(fav·|fav|) / Σ|fav|` (matches
  `ReadingPlanner`'s favourability weighting), `steady` when the denominator is 0.
- `contradiction`: `cards.some(fav ≥ +0.5) && cards.some(fav ≤ −0.5)`.
- `gloss`: `gloss(orientation === 'upright' ? meaningUpright : meaningReversed)`; `''` and
  `veiled: true` when the card is veiled.

`ReadingComposer.compose` replaces the inline `entries` construction with a call to
`aggregateTarotPositions(spreads)` and emits `{ kind: 'positions', summaries }`. The set
of spreads collected is unchanged (`[...new Set([...results, ...unique])].filter(isMultiSpread)`).

### 2. ProseBuilder rendering of the positions beat

`renderBeat`'s `positions` case builds one Segment (group `body`) by realising each
`PositionSummary` into a clause and stitching them in temporal order:

- **Single card, no contradiction:** `{framing} {The Card} {orientation}{ — gloss}{, leanTail}`
  e.g. "In what has passed, the Tower reversed — the ground already broken once."
- **Multiple agreeing cards:** name them with `joinAnd`, then the merged lean tail.
  e.g. "Ahead, the Star and the World gather, both leaning toward fortune."
- **Contradiction:** a contradiction template naming the strongest favourable card and the
  strongest adverse card (with their glosses); the merged lean is suppressed.
  e.g. "The present divides against itself — the Sun's promise set against the Five of
  Swords' hollow win."
- **Veiled card:** named as "(veiled)" with no gloss; if all cards in a position are veiled,
  fall back to the bare lean phrase.

New fragment pools in `src/data/reading-fragments.ts`:

```ts
positionFraming: {
  past:    ['In what has passed,', 'Behind the moment lies', 'The past holds'],
  present: ['At the present turn,', 'Here and now,', 'The present shows'],
  future:  ['Ahead,', 'What comes bends toward', 'The future opens onto'],
},
positionContradiction: [
  '{pos} divides against itself — {favor} set against {adverse}',
  '{pos} speaks in two voices: {favor}, and yet {adverse}',
],
```

The existing `positionLeans` map (`favor`/`steady`/`adverse`) is reused for the lean tail
appended after the card name(s) and as the all-veiled fallback; no new lean fragments are
added.

### 3. Strings — one woven journey (`stringsVoice.describeGroup`)

From each thread's `name` (`"A · B · C"`), take origin = first part, destination = last
part, waypoints = middle parts. Across all threads:

- `origin` = the first thread's origin (lead).
- `waypoints` = distinct middle concepts pooled in encounter order.
- `destinations` = distinct final parts.
- **Converging** (1 destination): `the threads, drawn from {origin} through {waypoints}, to {dest}`.
- **Diverging** (≥2 destinations): `the threads split from {origin} toward {joinAnd(destinations)}`
  (the strings analogue of contradiction).
- Clause: `verbPhrase(role, groupDims(slots), …)` (unchanged pattern).

Reuses `joinAnd`/`joinSeq`; lead text from `drawFraming.group.lead.strings` plus a new
`drawFraming.group.stringsSplit` connector for the diverging case.

### 4. D20 — trend (`d20Voice.describeGroup`)

Compute trend over the rolls in order: strictly increasing → `rising`, strictly
decreasing → `falling`, else `scattered` (for two equal values, `scattered`). Subject leads
with a trend phrase that still names every value:

```ts
drawFraming.group.d20Trend: {
  rising:    'the dice climbing —',
  falling:   'the dice falling —',
  scattered: 'the dice scattering —',
}
```

Subject = `{trendLead} {joinSeq(values)}`; clause unchanged (`verbPhrase` on group dims).
"the dice" still appears exactly once.

### 5. I Ching — movement (`ichingVoice.describeGroup`)

Subject narrates the turn from the first cast toward the last:
`the hexagrams turning from {first.name} toward {last.name}` (new lead fragment
`drawFraming.group.ichingMovement` with `{from}`/`{to}` slots). Clause = `verbPhrase` on
group dims, with the final hexagram's judgment gloss appended:
`{clause} — {gloss(last.judgment)}`.

## Files touched

- `src/engine/narrative/types.ts` — `PositionCard`, `PositionSummary`, new `positions` Beat shape.
- `src/engine/narrative/voices/index.ts` — `aggregateTarotPositions`; deepen
  `stringsVoice`/`d20Voice`/`ichingVoice` `describeGroup`.
- `src/engine/narrative/ReadingComposer.ts` — call `aggregateTarotPositions`, emit new beat.
- `src/engine/narrative/ProseBuilder.ts` — render the new positions beat (elaboration +
  contradiction).
- `src/data/reading-fragments.ts` — `positionFraming`, `positionContradiction`, and the
  strings/d20/iching group framing additions.
- Docs: `docs/game-systems.md` + README synthesis section if they describe synthesis prose
  (verify and sync per CLAUDE.md).

## Testing strategy

Unit tests (Vitest, engine only):

- `aggregateTarotPositions`: one spread → 3 summaries, one card each, no contradiction;
  three spreads → still exactly 3 summaries (past/present/future), cards pooled; merged
  lean = weighted mean; contradiction flag set when a position mixes ≥+0.5 and ≤−0.5;
  veiled card → `gloss === ''`, `veiled === true`.
- `ProseBuilder` positions rendering: names the card(s); contradiction template fires and
  names both poles; all-veiled position falls back to the lean phrase; output is one
  paragraph segment, not N repeated position lists.
- `stringsVoice.describeGroup`: converging vs diverging destinations; origin/waypoints/dest
  present; one lead only.
- `d20Voice.describeGroup`: rising / falling / scattered selects the right lead; every
  value named; exactly one "the dice".
- `ichingVoice.describeGroup`: movement names first and last; judgment gloss appended.
- Update existing assertions: `ReadingComposer.test.ts` ("multi-card spread yields a
  positions beat") to the new `summaries` shape; `MinigameVoices.test.ts` d20/tarot
  `describeGroup` wording.

Full `npm test` + `npm run build` (tsc) green before completion.

## Edge cases

- **Single spread (common case):** each position one card, no contradiction → elaborated
  single-card prose (an improvement, not just a bug fix).
- **Mixed tarot:** multi-card spreads → positions beat; single-card tarot → force beat.
  Both coexist unchanged.
- **Veiled cards:** never gloss; name as "(veiled)"; all-veiled position → lean fallback.
- **Single draw of a type (`describeOne`, `occ.total === 1`):** untouched; deepening only
  affects `describeGroup` (2+ draws).
- **readingDetail terse/rich (Light):** terse still trims force beats; the positions beat is
  unaffected by terse trimming today and stays that way.
