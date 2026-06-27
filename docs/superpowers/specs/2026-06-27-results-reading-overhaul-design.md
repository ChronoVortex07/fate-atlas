# Results Reading Overhaul — Design (Beat Composer)

**Date:** 2026-06-27
**Status:** Approved
**Scope:** Replace the rigid stage-by-stage narrative generator with an offline beat-composer that reads organically while staying mystical. Fully offline/deterministic; the `Copy LLM Prompt` export is untouched.

## Problem

The current `NarrativeAssembler.assemble()` is a single stage-by-stage template slotter (opening → dimension → modifier frames → per-position → tension → closing). It picks 1 of ~2 fixed templates per stage. Player-reported problems:

1. **Theme bookending** — the opening *and* the closing both key off `dominantTheme`, so the first and last line are always about the main theme. Loses novelty fast.
2. **Listy, under-elaborated body** — modifier frames render as `"As for what you should do: {results}."` with draws concatenated by `;`. Reads as a list, not prose.
3. **Missing words / abrupt endings** — empty `pick()` results push `''` paragraphs; `framePool ?? [frameKey]` can emit a bare key; tokens that resolve empty leave dangling sentences; `paragraphs.splice(2)` (terse mode) can behead the close.

## Decisions (from brainstorming)

- **Fully offline**, deterministic procedural generation (no LLM call). Preserves offline play, tests, and reproducible share-as-image.
- **`Copy LLM Prompt` stays working** — `generateLLMPrompt()` builds its own structured brief and is left untouched.
- **Weave specifics in** — overall thematic prose *plus* the actual cards/numbers/hexagrams named inside flowing sentences.

## Architecture

`NarrativeAssembler` remains the **public façade** — its `assemble()`, `generateLLMPrompt()`, `resetRotation()`, `getRotationSnapshot()`, `restoreRotation()` signatures are preserved so `GameEngine` (result synthesis + debug `previewSynthesis` rotation snapshot/restore) needs no call-site changes. Internally it delegates to three new focused units in `src/engine/narrative/`:

- **`ReadingComposer.ts`** (pure): `AggregatedReading + results + question + effects → Beat[]`. Decides which beats exist, their payloads, and order. Emits no prose. De-bookending lives here.
- **`drawVoice.ts`** (pure): `signal + role + favBand → DrawVoice { subject, clause }`. Turns a concrete draw into a grammatical fragment.
- **`ProseBuilder.ts`**: owns fragment pools + rotation. `Beat[] + seed → { headline, paragraphs, tensionNote?, affinityNote? }`. Realizes beats into clauses and stitches them into paragraphs with connectives.

`src/data/narrative-templates.ts` is restructured from "one pool per stage" into fragment pools keyed by **beat-kind + variant**, plus **connective pools** and **verb-phrase pools** (`role × favorability`).

`ReadingPlanner.aggregate()` and `AggregatedReading` are **unchanged** — the composer consumes the existing aggregate.

## The Beat model

A `Beat` is a typed payload, not a string:

```ts
type Beat =
  | { kind: 'theme';       theme; secondary; favBand }
  | { kind: 'fortune';     favBand; strongestFavor?; strongestAdverse? }
  | { kind: 'temper';      axis: 'certainty'|'volatility'; band: 'high'|'low' }
  | { kind: 'force';       role: ModifierRole; draws: DrawVoice[] }
  | { kind: 'positions';   entries: { position: string; lean: 'favor'|'steady'|'adverse' }[] }
  | { kind: 'opposition';  favPole; advPole }
  | { kind: 'tensionPair'; pair: [ThemeTag, ThemeTag] }
  | { kind: 'close';       question; theme; carryForce? };
```

The composer does **selection + ordering**, breaking the "theme first AND last" pattern:

- **Opening is chosen, not fixed.** Candidate openers: the `theme` beat, the `fortune` beat, or a **cold-open** that promotes the strongest specific draw (`force`/`opposition`) to the front. Choice is driven by signal strength + per-reading seed: a strong adverse pole or dramatic draw opens directly; a scattered/no-dominant theme opens on fortune or a cold draw rather than the weak theme. When the theme beat is not the opener, it folds mid-reading.
- **Close varies form** and does not always restate the theme name. Variants: forward-guidance by question type, a callback to the strongest force/draw (`carryForce`), or a quieter dimensional sign-off. Only some variants interpolate `{theme}`.
- Mood beats (`fortune`, `temper`) are included only when they speak (preserve today's neutral-skip thresholds: favorability always speaks; certainty/volatility skip neutral).

## Prose builder & connective stitching

Each beat realizes to one or more **clauses** (plain fragments). The builder groups clauses into **2–4 paragraphs** and joins adjacent clauses with connectives chosen by the **relationship between beats**:

- **Contrast** ("— yet ", ", and still ", "but beneath this, ") when the next beat's valence opposes the current (favorable theme → adverse fortune, across `opposition`).
- **Additive** ("and so ", "; ", " — ", ", where ") when beats reinforce.
- Otherwise a plain sentence break.

Three `force` beats thus weave into one flowing sentence instead of three `"As for X:"` paragraphs. Connective choice is rotation-driven (deterministic; see Determinism).

`joinClauses()` is the grammar primitive and the bug-fix chokepoint: trims, **drops empty/whitespace clauses** (never pushes `''`), capitalizes sentence starts, guarantees terminal punctuation. The `framePool ?? [frameKey]` literal-key fallback and empty-`pick()` paragraph are removed by construction.

`tensionNote` (highlighted box) is emitted when an `opposition`/`tensionPair` beat is present. `affinityNote` (chaos/order + clarity/detail wording) is computed exactly as today — separate channels, not part of the woven flow.

## Weaving specifics per divination type (`drawVoice.ts`)

`describeDraw(signal, role, favBand) → { subject, clause }`. `subject` names the draw; `clause` is a role + favorability predicate from `verbPhrases[role][favBand]`, optionally folding the draw's own flavor text.

- **tarot (single):** subject `"The {name}, {orientation}"`; clause + occasional gloss from real `meaningUpright`/`meaningReversed` (trimmed).
- **tarot (multi-spread):** emits a `positions` beat (each `position` + lean), rendered as prose — replaces today's `Past leans… ·` bullet line.
- **d20:** subject `"the dice, settling on {result},"`; clause from `threshold` band + a phrase from real `interpretation`.
- **iching:** subject `"Hexagram {n}, {name},"`; clause from trimmed `judgment` + changing-lines aside when present.
- **strings:** subject `"the thread from {origin} to {dest}"`; clause from `interpretation`.
- **happening:** excluded from synthesis (filtered upstream) — unchanged.

A `force` beat carries an array of `DrawVoice`; the builder introduces role intent once, then folds draw subjects+clauses with connectives.

## Determinism & seed

Synthesis is computed once at result time and stored in `state.synthesis`, so share-as-image and the debug preview stay stable. No `Math.random`. A **per-reading seed** offsets rotation start indices so opener choice, connectives, and close form vary reading-to-reading:

- Seed = small hash of `(dominantTheme, favorability band, question, first draw name)`.
- Each `pick()` starts at `(base + seed) % pool.length`. Same reading → same prose; different readings → different cadence.
- `resetRotation()` / `getRotationSnapshot()` / `restoreRotation()` keep working for the debug preview's non-consuming calls.

## Bug fixes (explicit)

1. **No empty paragraphs** — `joinClauses()` drops empty clauses; a beat yielding nothing contributes nothing.
2. **No bare keys** — remove `framePool ?? [frameKey]`; missing pools resolve to a real fallback fragment or are skipped.
3. **No abrupt endings** — terminal punctuation guaranteed; empty-resolving tokens drop the clause.
4. **Terse/detail handling** — replace `paragraphs.splice(2)`: composer *omits* mood/force beats when `readingDetail < 0` and adds an elaboration beat when `readingDetail > 0`, so terse readings stay grammatical and keep a real close.

## Test plan

New focused suites in `src/engine/__tests__/`:

- **`ReadingComposer.test.ts`** — opposition present iff poles oppose; theme not both opener and closer; opener varies with seed; terse omits force beats; detail adds a beat.
- **`drawVoice.test.ts`** — each type yields non-empty `subject` + `clause`; names appear; favorability/role select the right verb-phrase band.
- **`ProseBuilder.test.ts`** — no empty paragraph; every sentence ends in terminal punctuation; draw names appear in the body; connectives appear with ≥2 force beats; deterministic given same seed; varies across seeds.

Existing `NarrativeAssembler.test.ts`: keep `generateLLMPrompt` tests and `affinityNote`/`tensionNote`-presence tests; rewrite pipeline-coupled assertions (exact opening template text, rotation-index identities, `"Past leans"`, `describeSlotBrief` exact strings, gap-count of 3) against the new contract. `ReadingPlanner` tests untouched.

## Docs

No affinity/happening/responder changes, so `docs/game-systems.md` needs no update. Update the README reading section only if it documents the synthesis format. This spec records the architecture.

## Out of scope

- No LLM call at synthesis.
- No change to `ReadingPlanner.aggregate()` / `AggregatedReading` / affinity engine.
- No change to `ResultReading.tsx` rendering contract (`SynthesisResult` shape preserved: `headline`, `paragraphs[]`, optional `tensionNote`, optional `affinityNote`).
