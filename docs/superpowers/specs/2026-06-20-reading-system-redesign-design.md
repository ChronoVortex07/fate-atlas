# Reading System Redesign — Design Spec

**Date:** 2026-06-20
**Status:** Approved
**Branch:** feat/interaction-redesign

## Problem

The current `SynthesisEngine` is a template-stitcher with hardcoded per-type `switch` statements. It cannot synthesize across divination types, its tension detection is brittle boolean logic that doesn't scale, and it produces "Card A says X. Dice say Y. I Ching says Z." rather than a cohesive narrative. Adding a new divination type requires editing the engine.

## Solution Overview

Replace `SynthesisEngine` with a two-class system: **ReadingPlanner** (data analysis) + **NarrativeAssembler** (text generation). Every divination result carries three layers of structured data — themes, dimensions, modifiers — that feed a pipeline producing a cohesive narrative reading. The planner also provides gap-aware feedback to pool generation so the draw phase steers toward data completeness.

---

## 1. Data Model — New Fields on Divination Results

Every `DivinationResult` and `HappeningResult` gains three new fields.

### 1a. Theme Tags (`themes: string[]`)

A closed, curated set of cross-cutting thematic categories. Each result contributes 1-3 themes. Themes determine the **atmosphere and emotional texture** of the reading.

| Theme | Covers |
|---|---|
| `upheaval` | Sudden change, destruction, disruption, shock |
| `renewal` | Rebirth, new beginnings, hope, recovery |
| `stagnation` | Delay, blockage, waiting, resistance |
| `illumination` | Clarity, truth revealed, insight, awakening |
| `harmony` | Balance, connection, peace, alignment |
| `conflict` | Opposition, tension, struggle, discord |
| `transformation` | Gradual change, evolution, metamorphosis |
| `mystery` | The unknown, hidden forces, the unconscious |
| `authority` | Power, structure, control, discipline |
| `surrender` | Letting go, acceptance, release, yielding |

The set is extensible: adding a new theme means (a) adding it to this list, (b) assigning it to relevant divination results, and (c) adding opening/closing templates. No engine code changes.

### 1b. Dimension Values (`dimensions: { favorability, certainty, volatility }`)

Each value is a number in **-2.0 to +2.0**, inclusive, at 0.5 granularity.

| Axis | -2 means | +2 means |
|------|---------|----------|
| **Favorability** | Dire, unfavorable | Excellent, fortunate |
| **Certainty** | Completely ambiguous, unknowable | Definite, clear, settled |
| **Volatility** | Fixed, stable, unchanging | Highly mutable, in flux, conditional |

Dimensions produce the **forecast profile**: the reading's answer to "is this favorable, is it clear, will it change?"

### 1c. Modifier Roles (`modifierRoles: ('subject' | 'action' | 'effect')[]`)

Each result declares which narrative role(s) it contributes to. Role *meanings* are resolved per question type at narrative assembly time:

| Role | decision | relationship | future | self |
|------|----------|-------------|--------|------|
| **Subject** | The choice itself | The bond/connection | The horizon | Your inner nature |
| **Action** | What to do | Forces acting on it | Influences shaping it | Internal forces |
| **Effect** | Outcome of choice | Where it leads | What manifests | Growth/transformation |

### 1d. Example: The Tower

```typescript
{
  type: 'tarot',
  name: 'The Tower',
  orientation: 'upright',
  // ...existing fields...
  themes: ['upheaval', 'illumination'],
  dimensions: { favorability: -1.5, certainty: 1.5, volatility: 2.0 },
  modifierRoles: ['action', 'effect'],
}
```

### 1e. Type Changes (`src/engine/types.ts`)

```typescript
// New shared shape added to TarotResult, DiceResult, IChingResult, HappeningResult:
export interface ThematicData {
  themes: string[];           // 1-3 from curated set
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

export interface DimensionValues {
  favorability: number;  // -2.0 to +2.0
  certainty: number;     // -2.0 to +2.0
  volatility: number;    // -2.0 to +2.0
}

export type ModifierRole = 'subject' | 'action' | 'effect';

// Each result type extends ThematicData via intersection.
// DivinationProfile describes what a divination type tends to provide:
export interface DivinationProfile {
  type: DivinationType;
  themeCoverage: 'all' | 'limited';      // 'all' = rich thematic data, 'limited' = few themes
  themePool: string[];                    // which themes this type can produce
  dimensionStrengths: (keyof DimensionValues)[];  // which dimensions it reliably covers
  modifierStrengths: ModifierRole[];      // which roles it tends to fill
}

export interface GapReport {
  themeConfidence: boolean;        // ≥2 results share a theme?
  missingDimensions: (keyof DimensionValues)[];
  missingModifiers: ModifierRole[];
}

export interface AggregatedReading {
  dominantTheme: string;
  secondaryTheme: string | null;
  dimensionProfile: DimensionValues;
  modifierAssignments: Map<ModifierRole, SlotResult[]>;
  hasTension: boolean;
  tensionPair: [string, string] | null;
}
```

---

## 2. ReadingPlanner (`src/engine/ReadingPlanner.ts`)

A new class with three responsibilities.

### 2a. Data Gap Analysis

Runs after each `revealSlot()`. Examines current `turnResults` and produces a `GapReport`:

1. **Theme confidence**: `true` if any theme tag appears on ≥2 revealed results.
2. **Missing dimensions**: any dimension axis where no revealed result has an absolute value ≥ 0.5 on that axis. (A result with favorability 0.0 is neutral but still "covers" that dimension — it provides data. Only truly absent or zeroed-out data counts as missing.)
3. **Missing modifiers**: any modifier role with no revealed result assigned to it.

```typescript
analyzeGaps(results: SlotResult[]): GapReport
```

### 2b. Pool Bias Feedback

Given a `GapReport`, produces bias weights to steer `refillPool()` toward divination types whose `DivinationProfile` matches the gaps. Weights are **additive** to base `QUESTION_WEIGHTS` — they influence but never override.

Algorithm:
1. Start with neutral bias `{ tarot: 0, d20: 0, iching: 0 }`.
2. For each missing dimension, find types where `dimensionStrengths` includes it → +1 bias each.
3. For each missing modifier, find types where `modifierStrengths` includes it → +1 bias each.
4. If theme confidence is false, find `themeCoverage: 'all'` types → +1 bias each.
5. Clamp final bias per type to [-2, +3] to prevent over-domination.

```typescript
getBiasForRefill(gaps: GapReport): Partial<Record<DivinationType, number>>
```

With only 3 divination types today, bias has limited observable effect (the pool will mostly draw whatever's available). The architecture is ready for 5+ types where steering becomes meaningful.

### 2c. Aggregation

Runs at synthesis time when all slots are revealed. Consumes all `turnResults` + `questionType` → produces `AggregatedReading`.

**Theme ranking:**
1. Count theme tag occurrences across all results.
2. Pick top 1-2 by count. Tie-break: prefer themes from results whose primary modifier role matches the question type's most important role (decision→action, relationship→subject, future→effect, self→subject). If still tied, pick higher average dimension magnitude.

**Dimension profiling:**
Weighted average across all results. Results whose modifier roles include the question type's primary role count **2×**. Each dimension clamped to [-2, +2] after averaging.

**Modifier assignment:**
Each result assigned to its declared `modifierRoles`. Multiple results per role → ordered by sum-of-absolute-dimensions (stronger signal first). Empty role → recorded as gap for narrative assembly to acknowledge.

**Tension detection:**
Tension exists if the top two themes are in the opposition set: `[upheaval↔harmony, renewal↔stagnation, illumination↔mystery, conflict↔surrender, authority↔surrender]`, OR if favorability dimension standard deviation across results exceeds 1.5.

```typescript
aggregate(results: SlotResult[], question: QuestionType): AggregatedReading
```

---

## 3. NarrativeAssembler (`src/engine/NarrativeAssembler.ts`)

Consumes `AggregatedReading` + `questionType` + `affinities` → produces `SynthesisResult` and an enriched `generateLLMPrompt()`.

### 3a. Template System

All narrative text lives in `src/data/narrative-templates.ts` as template pools. Each pool is a map from a key (theme name, dimension band, modifier role, question type, tension pair) to an array of template strings. Templates use `{placeholder}` substitution.

The assembler selects templates via **rotation**: it tracks a `lastUsedIndex` per pool key in memory (per turn), increments on each use, and wraps to 0 after exhausting the pool. This prevents short-term repetition without requiring persistence.

#### Template Pool Structure

```typescript
interface NarrativeTemplates {
  openings: Record<string, string[]>;           // key = theme name
  dimensionBands: Record<string, string[]>;     // key = "favorability_high", "certainty_low", etc.
  modifierFrames: Record<string, string[]>;     // key = "subject_decision", "action_self", etc.
  closings: Record<QuestionType, string[]>;     // key = question type
  tensionPatterns: Record<string, string[]>;    // key = "upheaval_harmony", "high_variance", etc.
  fallbacks: {
    noDominantTheme: string[];
    missingModifier: Record<ModifierRole, string[]>;
    singleResult: string[];
  };
}
```

### 3b. Assembly Pipeline

The assembler runs 5 stages in order. Stages 3d (tension) and the affinity note are skipped when not applicable.

#### Stage 1: Opening (1 paragraph)

Selects template from `openings[dominantTheme]` via rotation. Substitutes `{subject}` with the question-type's subject noun phrase.

> *"The currents of upheaval swirl around your path forward. Threads of mystery weave through the edges, tempering what lies ahead."*

If no dominant theme: uses `fallbacks.noDominantTheme` template.

#### Stage 2: Dimension Body (1-2 sentences)

Each dimension axis maps to a band:
- **favorability**: `high` (+1.0 to +2.0), `neutral` (-0.9 to +0.9), `low` (-1.0 to -2.0) — always speaks, all three bands have templates
- **certainty**: `high` (+1.0 to +2.0), `low` (-2.0 to -0.9) — neutral range (-0.9 to +0.9) skips; ambiguity is the absence of a statement
- **volatility**: `high` (+1.0 to +2.0), `low` (-2.0 to -0.9) — neutral range (-0.9 to +0.9) skips; stability is the absence of a statement

Selects one template per applicable band, joins into flowing sentence(s). Favorability always produces a phrase; certainty and volatility only produce phrases when outside the neutral range.

> *"The signs lean favorably, though the shape of things remains elusive. Nothing here is fixed — change is imminent."*

#### Stage 3: Modifier Weaving (1 paragraph per role)

For each modifier role that has assigned results, selects a template from `modifierFrames[role_questionType]`. The template frames the role's meaning and weaves in the result(s). Single result per role:

> *"The Tower speaks to the forces shaping your path — upheaval breaks what must be broken, revelation follows destruction."*

Multiple results per role (same template, pluralized):

> *"Together, The Tower and Hexagram 51 illuminate the forces shaping your path — one through sudden disruption, the other through the shock that awakens."*

If a role has no results: uses `fallbacks.missingModifier[role]` — acknowledges the gap authentically.

#### Stage 4: Tension Acknowledgment (1 sentence, conditional)

If `aggregatedReading.hasTension` is true, selects from `tensionPatterns[oppositionPair]` or `tensionPatterns['high_variance']`. Skips entirely if no tension.

> *"These forces do not speak with one voice. Upheaval pulls against harmony — the path is not simple, and the contradiction itself is the message."*

#### Stage 5: Closing (1 sentence)

Selects from `closings[questionType]` via rotation. Substitutes `{dominantTheme}`.

> *"As you stand at the crossroads, upheaval marks the way. Choose with eyes open."*

### 3c. Headline

Generated separately from the narrative paragraphs. The headline distills the dominant theme + dimension lean into a single evocative line. Template pools keyed by `{dominantTheme}_{favorabilityBand}`:

> *"Upheaval Looms — the Stars Counsel Caution"*
> *"A Dawn of Renewal Awaits"*

If no dominant theme, falls back to a question-type generic: *"The Threads of Fate Unspool..."*

### 3d. Affinity Note (unchanged from current)

The existing affinity note logic (chaos ≥ 0.5 / order ≥ 0.5) is preserved and appended after the closing.

### 3d. LLM Prompt

`generateLLMPrompt()` is rewritten to pass structured data alongside the narrative. The prompt includes:
- Aggregated theme/dimension/modifier data as a structured brief
- Individual result descriptions (reusing `describeSlot`-style summaries)
- The assembled narrative as a reference point
- Instructions keyed to the question type

---

## 4. Divination Profiles (`src/data/divination-profiles.ts`)

Declares what each divination type tends to provide. Used by ReadingPlanner for bias calculation.

```typescript
export const DIVINATION_PROFILES: Record<DivinationType, DivinationProfile> = {
  tarot: {
    type: 'tarot',
    themeCoverage: 'all',
    themePool: ['upheaval', 'renewal', 'stagnation', 'illumination', 'harmony',
                'conflict', 'transformation', 'mystery', 'authority', 'surrender'],
    dimensionStrengths: ['certainty', 'favorability'],
    modifierStrengths: ['subject', 'action'],
  },
  d20: {
    type: 'd20',
    themeCoverage: 'limited',
    themePool: ['upheaval', 'stagnation', 'harmony'],
    dimensionStrengths: ['favorability', 'volatility'],
    modifierStrengths: ['effect'],
  },
  iching: {
    type: 'iching',
    themeCoverage: 'all',
    themePool: ['transformation', 'mystery', 'stagnation', 'renewal',
                'harmony', 'conflict', 'authority', 'surrender'],
    dimensionStrengths: ['certainty', 'volatility'],
    modifierStrengths: ['action', 'effect'],
  },
  happening: {
    type: 'happening',
    themeCoverage: 'limited',
    themePool: ['upheaval', 'mystery', 'renewal'],
    dimensionStrengths: ['volatility'],
    modifierStrengths: ['action', 'effect'],
  },
};
```

---

## 5. Data File Changes

### 5a. Tarot (`src/data/tarot.ts`)

Each `TarotCardData` gains `themes`, `dimensions`, `modifierRoles`. `drawTarotCard()` includes them in the return value. Reversed orientation flips favorability sign and swaps some themes (e.g., The Tower reversed: `upheaval` → `stagnation`).

### 5b. Dice (`src/data/dice.ts`)

`rollD20()` already produces threshold-based tags. New fields derived from threshold:
- `critical-low`: themes=[upheaval, conflict], favorability=-2.0, volatility=+1.5, modifierRoles=['effect']
- `low`: themes=[stagnation], favorability=-1.0, volatility=+0.5, modifierRoles=['effect']
- `neutral`: themes=[harmony], favorability=0.0, certainty=-1.0, modifierRoles=['effect']
- `high`: themes=[harmony], favorability=+1.0, volatility=+0.5, modifierRoles=['effect']
- `critical-high`: themes=[renewal, harmony], favorability=+2.0, volatility=+1.5, modifierRoles=['effect']

### 5c. I Ching (`src/data/iching.ts`)

Each `HexagramData` gains `themes`, `dimensions`, `modifierRoles`. If the hexagram has changing lines, volatility shifts toward +2.0.

### 5d. Happenings (`src/data/happenings.ts`)

Each happening gains `themes`, `dimensions`, `modifierRoles` on its data definition.

---

## 6. Integration with Existing Engine

### New files
```
src/engine/ReadingPlanner.ts
src/engine/NarrativeAssembler.ts
src/data/narrative-templates.ts
src/data/divination-profiles.ts
```

### Changed files

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `ThematicData`, `DimensionValues`, `ModifierRole`, `DivinationProfile`, `GapReport`, `AggregatedReading`, `NarrativeTemplates` types. Extend all result types with `themes`, `dimensions`, `modifierRoles`. |
| `src/engine/SynthesisEngine.ts` | **Replaced** by `ReadingPlanner` + `NarrativeAssembler`. |
| `src/engine/TurnOrchestrator.ts` | `refillPool()` accepts optional `bias` parameter. `generatePool()` unchanged (bias only applies on refill). |
| `src/engine/GameEngine.ts` | Instantiate `ReadingPlanner` and `NarrativeAssembler`. After `revealSlot()`, call `planner.analyzeGaps()`. Before `refillPool()`, call `planner.getBiasForRefill()`. Replace `synthesize()` with `assembler.assemble()`. |
| `src/data/tarot.ts` | Add themes/dimensions/modifierRoles per card. Reversed orientation adjusts values. |
| `src/data/dice.ts` | Derive themes/dimensions/modifierRoles from threshold. |
| `src/data/iching.ts` | Add themes/dimensions/modifierRoles per hexagram. Changing lines adjust volatility. |
| `src/data/happenings.ts` | Add themes/dimensions/modifierRoles per happening. |

### Unchanged
- `InteractionResolver`, `AffinityEngine`, `EventBus`, `TagSystem` — no changes
- Turn lifecycle: `startTurn` → `drawSlot`/`revealSlot` ×3 → `synthesize` — same shape
- `GameState.synthesis` — shape stays compatible (headline + paragraphs + tensionNote + affinityNote)
- React components — they read `state.synthesis`, no changes needed
- `RunRecord` — synthesis field shape unchanged

---

## 7. Adding a New Divination Type (Future)

To add e.g., constellation reading:

1. Define result type extending `ThematicData`
2. Add `DivinationProfile` entry describing its data tendencies
3. Add draw function
4. Register in `TurnOrchestrator`'s method table and `QUESTION_WEIGHTS`
5. Add theme/dimension/modifier template variants if the new type introduces unique narrative patterns (optional — existing templates work for shared themes)
6. Add new type to `DivinationType` union and `DivinationProfile` record

**No engine logic changes needed.**

---

## 8. Testing Strategy

### New test files (all in `src/engine/__tests__/`)

**ReadingPlanner.test.ts:**
- Gap analysis: 1 result → reports all gaps
- Gap analysis: 3 complementary results → no gaps
- Gap analysis: 3 same-theme results → theme confidence true, dimension/modifier gaps still checked
- Bias: missing certainty → biases toward tarot + iching
- Bias: missing effect modifier → biases toward d20
- Bias: all gaps filled → neutral bias (all zeros)
- Aggregation: theme ranking with clear winner
- Aggregation: theme tie-breaking by question-type primary role
- Aggregation: dimension weighted averaging (primary role → 2× weight)
- Aggregation: empty results array (defensive)
- Aggregation: tension detection for opposing themes
- Aggregation: tension detection for high favorability variance

**NarrativeAssembler.test.ts:**
- Opening: correct template selected per dominant theme
- Opening: fallback when no dominant theme
- Dimension body: correct band thresholds (test boundary values -2.0, -0.9, +0.9, +2.0)
- Dimension body: neutral band skips phrasing
- Modifier weaving: single result per role
- Modifier weaving: multiple results share role (pluralized)
- Modifier weaving: missing role produces gap acknowledgment
- Tension: opposing themes produce tension paragraph
- Tension: high variance produces tension paragraph
- Tension: no tension → section absent from output
- Closing: correct question-type template
- Template rotation: same call twice → different template indices used
- Template rotation: wraps to 0 after exhausting pool
- Full assembly: produces valid SynthesisResult for each question type
- Happening slot: included in modifier weaving
- Single result (defensive): focused reading, no modifier weaving
- LLM prompt: contains structured brief

**DivinationProfile.test.ts:**
- Every curated theme used by at least one divination type
- Every dimension axis covered by at least one type
- Every modifier role covered by at least one type
- Profile data matches actual divination result data (consistency)

### Updated tests

**tarot/dice/iching draw tests:** Verify `themes`, `dimensions`, `modifierRoles` present on returned results with values in valid ranges.

**GameEngine.test.ts:** Verify planner called after revealSlot, bias passed to refillPool, synthesis uses assembler.

**TurnOrchestrator.test.ts:** Verify refillPool accepts and applies bias weights.

### Not tested
- Natural language quality (subjective — manual review)
- Template rotation over many runs (probabilistic — playtesting)
- Visual rendering of synthesis output (no component tests)

---

## 9. Edge Cases & Defensive Behavior

| Scenario | Behavior |
|----------|----------|
| All results share same theme | Narrative acknowledges overwhelming convergence; "the forces speak with one voice" |
| No clear dominant theme (all count=1) | Fallback to "mystery" theme opening; note forces are scattered |
| Missing dimension data | Narrative explicitly notes uncertainty; no fabrication |
| Missing modifier role | Gap acknowledgment; "what lies ahead remains veiled" |
| Single result only | Skip modifier weaving; produce focused single-paragraph reading |
| All three results same type | Works normally — themes/dimensions/modifiers still aggregate |
| Happening in results | Contributes themes and dimensions normally; `scene` used as modifier content |
| Opposing themes with neutral dimension | Tension section fires (thematic opposition is enough) |
| High favorability variance, same theme | Tension section fires (dimension opposition) |
| Affinity at extremes (0.0 or 1.0) | Affinity note appended but doesn't affect narrative assembly |
| Template pool exhausted mid-turn | Index wraps — each pool key tracks its own rotation independently |
