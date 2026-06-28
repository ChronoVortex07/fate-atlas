# Repeated-Minigame Reading Voices — Design

**Date:** 2026-06-28
**Status:** Approved (brainstorming) — ready for implementation plan
**Scope:** Woven *Interpretation* synthesis only (narrative engine). No UI, no affinity/interaction changes.

## Problem

On the results page, the woven **Interpretation** repeats prose when the same minigame
type runs multiple times in one game. Today a longer reading (and especially the planned
5- and 7-game readings) reads badly in two distinct ways:

1. **Repeated framing grammar.** Each divination type narrates through one fixed template
   in `describeDraw` ([src/engine/narrative/drawVoice.ts](../../../src/engine/narrative/drawVoice.ts)).
   Three d20 rolls read `"the dice, settling on 5 … the dice, settling on 12 … the dice,
   settling on 18"` — the value varies, the scaffold does not.
2. **Identical predicate clauses.** `verbPhrases[role][favBand]` holds only three entries,
   picked by `stableIndex(cardName)`. Two same-role siblings collide and end on the *same*
   sentence verbatim.

The composer ([ReadingComposer.ts](../../../src/engine/narrative/ReadingComposer.ts)) already
de-dupes a draw to its single strongest role and merges same-role draws into one force beat,
but it joins them with plain additive connectives — it neither aggregates nor de-collides.

## Goal

Give **each minigame its own way to handle being run multiple times in one reading**, using
a **hybrid** behavior:

- **Aggregate** when same-type draws land in the **same role** — collapse them into one
  combined statement.
- **Vary the framing** otherwise (same type across different roles) — distinct scaffold and
  distinct clause so nothing repeats verbatim.

This must scale to 5–7 draws and stay fully deterministic (seed-driven, no `Math.random`).

## Non-goals

- The per-slot **Divination Results** card grid (`CardReadingDetail`) — unchanged.
- Happenings, the LLM prompt's `describeSlotFull`, affinity/effect/interaction systems.
- `docs/game-systems.md` — it documents affinities/effects, not draw framing, so it needs
  no sync for this change.

## Architecture

### New unit: `MinigameVoice`

A per-type voice abstraction replaces the monolithic `describeDraw` type-switch. Each
divination type owns one voice; a registry maps `type → voice`, with a generic fallback for
types without a bespoke voice (astral, rune today).

```ts
// src/engine/narrative/voices/types.ts
export interface DrawOccurrence {
  index: number;  // 0-based ordinal among same-type force-eligible draws in this reading
  total: number;  // total same-type force-eligible draws in this reading
}

export interface MinigameVoice {
  type: DivinationType;
  /** One draw. occ.total === 1 (or occ.index === 0) returns today's exact framing. */
  describeOne(slot: SlotResult, role: ModifierRole, occ: DrawOccurrence): DrawVoice;
  /** Collapse 2+ same-type, same-role draws into a single combined voice. */
  describeGroup(slots: SlotResult[], role: ModifierRole, occBase: number): DrawVoice;
}
```

- **`voices/index.ts`** — registry + `voiceFor(type)` returning the bespoke voice or the
  generic fallback.
- **`voices/types.ts`** — the interface + `DrawOccurrence`.
- Per-type voices live under `voices/` (one module per type, or grouped — implementation
  detail). Shared helpers `favBandOf`, `verbPhrase`, `gloss`, `withArticle` move to a shared
  module the voices import (or stay in `drawVoice.ts` and are imported from there).
- **`drawVoice.ts`** keeps exporting `describeDraw(slot, role)` and `favBandOf` for back-compat
  (`DrawVoice.test.ts` and any other callers). `describeDraw` becomes a thin wrapper:
  `voiceFor(slot.type).describeOne(slot, role, { index: 0, total: 1 })`.

### Behavior

**`describeOne`**
- `occ.total === 1` → byte-identical to today's output for that type (regression-critical:
  [NarrativeAssembler.test.ts:95](../../../src/engine/__tests__/NarrativeAssembler.test.ts#L95)
  asserts a lone d20 reads `"the dice, settling on 10"`).
- `occ.index >= 1` →
  - **variant subject scaffold** — matters most for d20, whose scaffold otherwise repeats
    verbatim across roles. Named-subject types (tarot/iching/strings) already vary by content;
    their variants are light/optional.
  - **clause rotation by `occ.index`** — offset the verb-phrase pick so two siblings never end
    on the same clause.

**`describeGroup`** — returns one `DrawVoice`:
- **subject** = a type-specific *list* of the group's draws, e.g.
  `"the dice fall in turn — 5, 12, then 18"`, `"Hexagrams 1, 49, and 12"`,
  `"The Tower reversed, the Star upright, and the Moon"`.
- **clause** = a single verb-phrase chosen from the group's **mean favorability** and the role,
  rotation/seed-varied. Collapses N clauses → 1.

Example (3 d20 in the `effect` role):

> **Now:** "…the dice, settling on 5, leaves the outcome in your hands, and the dice, settling
> on 12, leaves the outcome in your hands; the dice, settling on 18, shapes an outcome still
> unwritten."
>
> **After:** "…the dice fall in turn — 5, 12, then 18 — and together they leave the outcome
> genuinely in your hands."

### Composer changes (`ReadingComposer.compose`)

The dedup-to-strongest-role pass (`unique` → `byRole`) is unchanged. Two new steps before
building force beats:

1. **Occurrence pass.** Walk the force-eligible draws (excludes multi-card spreads, which stay
   diverted to the positions beat) in narration order; per type assign `{ index, total }` into a
   `Map<SlotResult, DrawOccurrence>`. Two passes: count per type, then assign indices in order.
2. **Per-role grouping.** Within each role, group the role's force-eligible draws by type,
   preserving order. For each type-group:
   - size ≥ 2 → `voiceFor(type).describeGroup(group, role, occBaseOfFirst)` → one `DrawVoice`
     (aggregate, same-role).
   - size 1 → `voiceFor(type).describeOne(draw, role, occ)` → one `DrawVoice`
     (varied framing across roles).
   Concatenate the results into the force beat's `draws: DrawVoice[]`.

`ProseBuilder.renderForce` is **untouched** — it still stitches `DrawVoice[]` with connectives;
it simply receives fewer, better entries.

### Fragments (`src/data/reading-fragments.ts`)

All new prose strings live here (per the chosen content location). A new `drawFraming` block:

- **`variantScaffolds`** — per-type alternate single-draw subject scaffolds, occ-rotated for
  `index >= 1` (d20 the priority; e.g. `"the cast that lands on {n}"`, `"a throw reading {n}"`).
- **`group.lead`** — per-type group opener (e.g. d20 `"the dice fall in turn —"`,
  iching `"the hexagrams answer in sequence —"`, generic `"in succession —"`).
- **`group.join`** — list joiners (`", "`, `", then "` for the final item).
- **`group.together`** — connector preceding the shared group clause (`"and together they"`,
  `"taken together they"`).

## Testing (TDD)

New `src/engine/__tests__/MinigameVoices.test.ts` plus additions to `NarrativeAssembler.test.ts`:

- **Regression:** 1 draw of each type → byte-identical to current output. (Keeps existing
  `DrawVoice.test.ts` and `NarrativeAssembler.test.ts` green.)
- **Aggregation:** 3 same-type, same-role draws → exactly one combined sentence; the per-type
  scaffold appears once; no duplicated clause.
- **Cross-role variation:** same type in two roles → distinct clauses and distinct scaffold;
  no verbatim repeat.
- **Determinism:** same reading twice → identical output; assert no `Math.random` dependence.
- **Fallback:** astral/rune (no bespoke voice) still produce non-empty subject + clause, single
  and grouped.

All randomness-sensitive assertions follow the existing pattern (seed-driven; stub
`Math.random` only where a test needs it).

## Risks / edge cases

- **Occurrence ordering** must be stable and match narration order so `index` is meaningful;
  derive it from the same de-duped, role-sorted traversal the force beats use.
- **Mixed roles + aggregation:** a type with 2 draws in one role (aggregated) and 1 in another
  (lone) — the lone draw's `occ.index` is ≥ the group size, so its variant scaffold/clause
  differs from the aggregate's. Verify in a test.
- **Single-draw byte-compatibility** is the hard constraint; the `index === 0 / total === 1`
  fast path must reproduce today's branch exactly per type.
