# Atlas of Fate

A web-based divination game that fuses Tarot, d20 dice, and I Ching into a roguelike reading loop. Hidden meta-interactions and an affinity system create emergent chain reactions between your divinations.

**"the stars await your question"**

---

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
```

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run all 68 engine tests (Vitest) |

---

## Gameplay Flow

1. **Title** — click **CONSULT THE STARS**
2. **Question** — pick one of four question types *(Decision, Relationship, Future/Forecast, Self-Analysis)*
3. **Method Select** — choose one of 3 divination methods dealt by the stars
4. **Minigame** — play a short interactive experience (pick a tarot card, roll the dice, cast coins)
5. **Result** — read the interpretation. Happenings may appear as cryptic events between turns. **Share as Image** or **Copy LLM Prompt**

---

## Divination Methods

| Method | Mechanic | Tags |
|--------|----------|------|
| **Tarot** | 22 Major Arcana, upright or reversed | `major-arcana` `reversible` `fool-archetype` ... |
| **d20 Dice** | 1d20 roll, 5-tier thresholds (critical-low → critical-high) | `roll` `numeric` `threshold` |
| **I Ching** | 64 hexagrams, 3-coin casting method, changing lines | `binary` `reversible` `changing-lines` |
| **Happenings** | 8 authored cryptic scenes with 2-3 choices each | `event` `choice` `affinity-shift` |

---

## Hidden Affinity System

Six hidden affinities in three opposed pairs shape your readings behind the scenes:
**Chaos ↔ Order** (fortune), **Fate ↔ Will** (agency), **Light ↔ Shadow** (information).
Values run 0–100 (baseline 50) across four bands — *latent, stirring, ascendant, dominant* —
and unlock progressively stronger effects as they rise. They persist across runs in
localStorage, drift back toward baseline each run, and are never shown directly — only hinted
at through atmospheric flavor text.

See [`docs/game-systems.md`](docs/game-systems.md) for the full affinity/band/effect reference.

---

## Meta-Interaction Rules

Interactions between divination results are **tag-matched** against the spread, so adding a
new entity with the right tags automatically participates.

| Interaction | Fires when… | Effect |
|-------------|-------------|--------|
| **Fool's Reroll** | The Fool is in the spread on a dice commit | Recasts the committed d20 |
| **Critical Resonance** | upright tarot + critical-low die (or reversed + critical-high) | Flips the tarot's orientation |
| **The Mirror** | exactly two reversible entities present | Both flip orientation (85%) |
| **I Ching Boost** | an I Ching with changing lines is present | Adds a hidden happening choice |

Affinity bands add their own probabilistic effects (widen/thin the pool, shroud methods,
spawn a second result, force a method, advantage/disadvantage, …) — see
[`docs/game-systems.md`](docs/game-systems.md).

---

## Debug Panel

Add `?debug` to the URL (e.g. `http://localhost:5173/fate-atlas/?debug`) or press `Ctrl+Shift+D` to open the debug panel:

- **State** — live JSON viewer of all engine state
- **Inject** — paste a JSON state blob to force exact scenarios
- **Steps** — resolve interactions one at a time or all at once
- **Events** — timestamped event log

Example injection:

```json
{
  "affinities": { "chaos": 0.8, "order": 0.2 },
  "questionType": "decision",
  "slots": [
    { "type": "tarot", "id": "the-fool", "orientation": "reversed", "tags": ["major-arcana", "fool-archetype", "reversible", "reversed"] },
    { "type": "d20", "result": 3, "threshold": "critical-low", "tags": ["roll", "numeric", "threshold", "critical-low", "low"] },
    null
  ]
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite |
| UI | React 18 + TypeScript |
| Animation | Framer Motion |
| Game engine | Pure TypeScript (no framework dependency) |
| Tests | Vitest (53 tests, 10 suites) |
| Image export | html2canvas |
| Persistence | localStorage |
| Typography | Cormorant Garamond + Inter |

---

## Project Structure

```
src/
├── engine/           # Pure TypeScript game engine (no React/DOM)
│   ├── types.ts
│   ├── EventBus.ts
│   ├── TagSystem.ts
│   ├── AffinityEngine.ts
│   ├── TurnOrchestrator.ts
│   ├── InteractionResolver.ts
│   ├── SynthesisEngine.ts
│   └── GameEngine.ts
├── data/             # Game data (typed TS objects)
│   ├── tarot.ts      # 22 Major Arcana
│   ├── dice.ts       # d20 thresholds
│   ├── iching.ts     # 64 hexagrams
│   ├── happenings.ts # 8 happenings
│   ├── interactions.ts  # 5 MVP rules
│   └── affinities.ts # Chaos & Order definitions
├── components/
│   ├── screens/      # 7 screen components
│   ├── cards/        # Card display components
│   ├── overlays/     # StarField, HistoryBar
│   ├── debug/        # Debug panel + tools
│   └── shared/       # RunicBand, MysticButton, OrnamentalBorder
├── hooks/            # useGameEngine hook
├── context/          # EngineContext (React ↔ Engine bridge)
├── utils/            # persistence, shareExport
├── styles/           # theme.css
├── App.tsx
└── main.tsx
```

---

## Visual Theme: Stellar Divination

Dark celestial aesthetics fused with runic mysticism. The player feels like they are divining the stars.

| Role | Color |
|------|-------|
| Background (deepest) | `#070a12` |
| Cards | `#0d1220` / `#0a1020` |
| Borders & midtones | `#1a2440` |
| Body text | `#7b9ec7` |
| Headings (starlight) | `#c8d8f0` |
| Gold accents | `#d4a854` / `#c8a060` |

**Typography:** Cormorant Garamond (display) · Inter 300 (body) · Elder Futhark Unicode (runic decoration)
