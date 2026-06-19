# Atlas of Fate — Game Design Spec

**Date:** 2026-06-19
**Status:** Approved
**Scope:** MVP vertical slice — all core systems at minimum depth

---

## 1. Overview

Atlas of Fate is a web-based divination game where multiple divination methods are fused into a roguelike reading loop. Hidden meta interactions and an affinity system create emergent chain reactions between divination results. The player consults the stars, draws three divinations, and receives a synthesized interpretation.

**Core experience:** A single run = question → draw 3 divinations → watch meta interactions unfold → receive synthesis → optionally encounter a happening → see the result. Affinities carry over between runs, creating a quiet meta-progression.

---

## 2. Architecture

### 2.1 High-Level Structure

```
React App (Vite)
├── UI Layer: screens, card components, overlays
├── Animation Layer: Framer Motion (card flips, dice tumbles, flash reveals)
├── Debug Panel: togglable overlay (state viewer, JSON injector, step-through)
├── Share Export: html2canvas for image export
│
├── useGameEngine() hook — React context + subscription to engine state
│
└── Game Engine (pure TypeScript, no React dependency)
    ├── Tag System: query, match, evaluate rules by tags
    ├── Turn Orchestrator: draw → apply affinities → resolve meta → present
    ├── Affinity Engine: accumulate, decay, threshold queries
    ├── Synthesis Engine: template-based combinatorial interpretation
    ├── Data Registries: divination methods, interaction rules, happenings, tags
    ├── Event Bus: every action emits an event → history log
    └── State Manager: loadState(json) for debug injection, serialize for persistence
```

### 2.2 Design Principles

- **Game engine is pure TypeScript** — testable without React, serializable, no DOM dependency
- **React is the view layer only** — components read engine state, dispatch actions
- **Tag-driven rules** — interactions match by tags, not hard-coded IDs. Adding a new divination method with the right tags automatically qualifies for existing interactions.
- **Separation of data from logic** — divination methods, interaction rules, happenings, and tags are defined as structured data (TS objects), not code paths.

---

## 3. Tag System

### 3.1 Concept

Every game entity carries tags. Rules query tags rather than referencing specific entity IDs. This makes the system inherently expandable.

### 3.2 Entity Tags

| Entity type | Example tags |
|-------------|-------------|
| Tarot card | `draw`, `random`, `major-arcana`, `reversible`, `fool-archetype` (archetype-specific) |
| d20 roll | `roll`, `random`, `numeric`, `threshold`, `high` or `low` |
| I Ching hexagram | `draw`, `random`, `binary`, `reversible` (if changing lines present) |
| Happening | `event`, `choice`, `affinity-shift` |
| Affinity | `hidden`, `accumulating`, `random-influenced` (Chaos) or `stabilizing` (Order) |

### 3.3 Interaction Rule Structure

```typescript
interface InteractionRule {
  trigger: {
    on: EventType;              // e.g., "on-drawn", "on-revealed"
    sourceTags: string[];       // all must match for rule to fire
  };
  target: {
    tags: string[];             // which entities can be affected
    action: string;             // e.g., "reroll", "flip", "add-choice"
  };
  modifier?: {
    tags: string[];             // contextual modifier tags
    evaluate: "contextual";     // modifier depends on source state
  };
  display: {
    flashSource: boolean;
    flashTarget: boolean;
    description: string;        // flavor text shown during trigger
  };
}
```

### 3.4 MVP Interaction Rules

| # | Trigger | Target | Effect |
|---|---------|--------|--------|
| 1 | `[major-arcana]` + `[fool-archetype]` drawn | any `[roll]` + `[pending]` | Reroll. If Fool reversed → disadvantage (take lower). If upright → advantage (take higher). |
| 2 | `[roll]` result is `[critical-low]` | any `[major-arcana]` + `[reversible]` | Flip the tarot card's orientation |
| 3 | `[iching]` drawn with `[changing-lines]` | `[happening]` if present in draw | +1 extra happening choice |
| 4 | Two entities share `[reversible]` | both entities | "Mirror event" — both flip orientation/meaning |
| 5 | `[chaos]` affinity above threshold (0.5) | any `[random]` entity | 15% chance of a second result appearing alongside |

**Resolution:** sequential top-to-bottom, chain reactions allowed but capped at 3 chains to prevent loops.

---

## 4. Affinity System

### 4.1 MVP Affinities

Affinity values range from 0.0 to 1.0. They accumulate gradually (typical change per run: ±0.05–0.15) and persist across runs.

| Affinity | Accumulates from | Effect when dominant (≥ 0.5) |
|----------|-----------------|------------------------------|
| **Chaos** | `[random]` actions, reversed cards, changing lines, low dice rolls | +% chance of wild modifiers, interaction chains more likely, Happenings appear more often |
| **Order** | Stable results (upright cards, neutral dice, stable hexagrams), choosing predictable Happening options | Reduces chance of negative reversals, `[threshold]` results lean toward middle, extra interpretation clarity |

### 4.2 Hidden by Design

- Players never see exact affinity values
- Subtle flavor-text hints: "The air feels charged with unpredictability..." (high Chaos), "Patterns align with unusual clarity..." (high Order)
- Happening choices hint at which affinity they'll shift
- Affinities persist across runs in localStorage

---

## 5. Game Flow

```
TITLE → QUESTION → DRAW (3 cards) → REVEAL → META INTERACTIONS → INTERPRETATION → HAPPENING (chance) → RESULT
```

### 5.1 Screen-by-Screen

1. **Title Screen** — atmospheric entry, "CONSULT THE STARS" button. Load saved affinities from localStorage on mount.
2. **Question Selection** — 4 options: Decision, Relationship, Future/Forecast, Self-Analysis. Question type filters the divination pool and adds session tags.
3. **Draw Phase** — 3 face-down cards. Player clicks each to reveal. Each card is one divination method from the pool.
4. **Meta Interaction Resolution** — Engine checks rules. Cards flash, history bar shows involved entities. Chain reactions play sequentially with descriptions.
5. **Interpretation** — Synthesized reading from the template engine. Individual divination details expandable. "Copy LLM Prompt" button generates structured markdown for external LLM use.
6. **Happening** (chance-based, affinity-weighted) — Cryptic scene with 2-3 choices, each a vague description hinting at affinity shifts.
7. **Result Screen** — Full summary. Actions: [Draw Again], [Share as Image] (html2canvas), [View Run History].

### 5.2 Question Type Influence

| Question | Divination Weight | Effect |
|----------|------------------|--------|
| Decision | d20 favored | Probability assessment |
| Relationship | Tarot favored | Archetype-driven insight |
| Future/Forecast | I Ching favored | Long-view patterns |
| Self-Analysis | Tarot + I Ching equal | Introspective |

**Pool generation:** The 3 slots are randomly drawn from the available divination methods. "Favored" means the method has a higher weight (e.g., 2×) in the random selection — not exclusive. Non-favored methods still appear and can trigger interactions that reshape the reading.

---

## 6. Divination Methods (MVP)

### 6.1 Tarot

- **Deck:** 22 Major Arcana only (full 78-card deck deferred)
- **Mechanics:** Draw 1 card, upright or reversed (50/50 base, modified by affinities)
- **Tags:** `[draw] [random] [major-arcana] [reversible] [<archetype-tag>]`
- **Output:** Card name, symbol, orientation, meaning snippet

### 6.2 d20 Dice

- **Mechanics:** Roll 1d20. Thresholds: 1-5 (critical low), 6-9 (low), 10-11 (neutral), 12-16 (high), 17-20 (critical high)
- **Tags:** `[roll] [random] [numeric] [threshold] [high/low]`
- **Output:** Arabic numeral with runic accents, threshold label, interpretation snippet

### 6.3 I Ching

- **Mechanics:** 3-coin method (simplified). 6 lines → 1 hexagram. Each line can be changing or stable.
- **Tags:** `[draw] [random] [binary] [reversible]` (changing lines add `[reversible]`)
- **Output:** Hexagram number + name, Unicode symbol, judgment text

### 6.4 Happening

- **Mechanics:** Cryptic story event with 2-3 choices. Each choice maps to affinity changes.
- **Tags:** `[event] [choice] [affinity-shift]`
- **Output:** Player picks, affinities adjust silently, atmospheric text confirms choice
- **Pool:** 8-10 authored happenings, chosen randomly, weighted by current affinities

---

## 7. Interpretation & Synthesis

### 7.1 Template-Based Synthesis (MVP)

Each divination result carries meaning fragments keyed by tags + question context. The synthesis engine stitches based on:

- **Tag alignment:** entities with shared tags → reinforcement narrative
- **Tag opposition:** entities with opposing tags (e.g., `[fool-archetype]` boldness vs `[low]` caution) → tension narrative
- **Affinity influence:** high Chaos → more dramatic language; high Order → more measured language
- **Question context:** the question type colors the synthesis framing

### 7.2 LLM Prompt Export

A "Copy LLM Prompt" button generates structured markdown:

```markdown
## Atlas of Fate Reading
**Question:** Decision about [topic]
**Affinity state:** [hints]

### Divinations
1. **Tarot:** The Fool (Upright) — ...
2. **d20:** 3 (Critical Low) — ...
3. **I Ching:** Hexagram 27 (䷛) with changing lines 3, 5 — ...

### Meta Events
- The Fool triggered a d20 reroll with advantage

[Instructions: synthesize into a cohesive reading. Consider the tension between...]
```

No API key required — the player pastes this into their LLM of choice.

---

## 8. Debug Panel

### 8.1 Features

- **Togglable:** via `?debug` URL param or keyboard shortcut
- **Live State Viewer:** affinities, current draw, pool, recent events
- **JSON State Injection:** paste a JSON state blob to force exact game state
- **Step Controls:** step through resolution one interaction at a time, or resolve all
- **Event Log:** timestamped event history, filterable

### 8.2 JSON Injection Format

```json
{
  "affinities": { "chaos": 0.8, "order": 0.2 },
  "questionType": "decision",
  "draw": {
    "slot1": { "type": "tarot", "id": "the-fool", "orientation": "upright" },
    "slot2": { "type": "d20", "result": 3 },
    "slot3": { "type": "iching", "hexagram": 27, "changingLines": [3, 5] }
  }
}
```

---

## 9. Persistence

### 9.1 localStorage Schema

```
fate-atlas:affinities    → { chaos: number, order: number }
fate-atlas:run-history   → Array<RunRecord>
fate-atlas:settings      → { debugMode: boolean, animationsEnabled: boolean }
```

### 9.2 Run Record

```typescript
interface RunRecord {
  id: string;
  timestamp: number;
  question: QuestionType;
  slots: DivinationResult[];
  interactions: InteractionEvent[];
  synthesis: SynthesisResult;
  happening?: HappeningResult;
}
```

---

## 10. Visual Design

### 10.1 Style: "Stellar Divination"

Dark celestial meets runic mysticism. The player feels like they are divining the stars.

### 10.2 Palette

| Role | Color |
|------|-------|
| Background (deepest) | `#070a12` |
| Background (card) | `#0d1220` / `#0a1020` |
| Midtone (borders, lines) | `#1a2440` |
| Steel blue (text, UI) | `#7b9ec7` |
| Starlight (headings) | `#c8d8f0` |
| Gold accent (interactions, flashes, highlights) | `#d4a854` / `#c8a060` |

### 10.3 Typography

| Role | Font |
|------|------|
| Display titles | Serif (Cormorant Garamond) |
| Body / UI text | Sans-serif light (Inter, weight 300) |
| Labels | Uppercase, wide letter-spacing |
| Runic flavor | Elder Futhark Unicode — decorative only, never functional |

### 10.4 Ornament

- Horizontal runic bands on card tops and bottoms (not corner rivets)
- Thin gradient rule lines with gold center accent
- Constellation dot-and-line motifs in backgrounds
- Moon phase symbols (☽ ☾) flanking buttons/headers
- Star-field backgrounds with subtle parallax
- Card frames: thin border, runic header band, runic footer band

### 10.5 Dice Display

Arabic numerals with runic accent marks, warm gold glow (`text-shadow`), subtle orbital ring behind the numeral.

---

## 11. Technology Stack

| Layer | Technology |
|-------|-----------|
| Build tool | Vite |
| UI framework | React 18+ |
| Animation | Framer Motion |
| Image export | html2canvas |
| Game engine | Pure TypeScript (no framework dependency) |
| Persistence | localStorage |
| Typography | Cormorant Garamond + Inter (Google Fonts or self-hosted) |

---

## 12. Out of Scope (Post-MVP)

- Full 78-card tarot deck
- Additional divination methods (runes, pendulum, astrology)
- LLM API integration (copy-paste prompt only for MVP)
- Backend / user accounts / social features
- Sound / music
- Accessibility audit
- Mobile-native packaging (PWA can be considered)

---

## 13. Project Structure (Proposed)

```
fate-atlas/
├── src/
│   ├── engine/           # Pure TypeScript game engine
│   │   ├── GameEngine.ts
│   │   ├── TagSystem.ts
│   │   ├── TurnOrchestrator.ts
│   │   ├── AffinityEngine.ts
│   │   ├── SynthesisEngine.ts
│   │   ├── EventBus.ts
│   │   └── types.ts
│   ├── data/             # Structured game data
│   │   ├── tarot.ts
│   │   ├── dice.ts
│   │   ├── iching.ts
│   │   ├── happenings.ts
│   │   ├── interactions.ts
│   │   └── affinities.ts
│   ├── components/       # React components
│   │   ├── screens/
│   │   ├── cards/
│   │   ├── overlays/
│   │   ├── debug/
│   │   └── shared/
│   ├── hooks/
│   │   └── useGameEngine.ts
│   ├── context/
│   │   └── EngineContext.tsx
│   ├── utils/
│   │   ├── persistence.ts
│   │   └── shareExport.ts
│   ├── App.tsx
│   └── main.tsx
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-06-19-atlas-of-fate-design.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
