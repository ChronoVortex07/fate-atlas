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
| **Astromancy** | Planet die + Sign die thrown onto a 12-house zodiac board | `draw` `random` `astral` `planet-<id>` `sign-<id>` `house-<N>` ... |
| **Happenings** | 8 authored cryptic scenes with 2-3 choices each | `event` `choice` `affinity-shift` |

### Astromancy: Planet-in-Sign-in-House

Two physical dice are thrown onto a 12-house zodiac board. The **Planet die** (12 faces: Sun
through South Node) lands in a house and contributes the planet's theme and dimension values.
The **Sign die** (12 faces: Aries through Pisces) lands in a different house; its element and
modality add dimension leans. The angle between the two landing houses produces an **aspect**
(conjunction, sextile, square, trine, opposition, or minor), which adds its own dimension
modifier and theme.

The reading is expressed as **Planet in Sign, House of \<Arena\>** plus the aspect name.

#### How the four signals combine

Dimensions (favorability, certainty, volatility) are the sum of planet + element lean +
modality lean + aspect dimensions, halved and clamped to −2 … +2. Themes are ranked:
house → planet → aspect → element; the top two (deduplicated) are kept.

#### Aspects

| Aspect | Houses apart | Flavor |
|--------|:------------:|--------|
| Conjunction | 0 (same house) | Perfect union — certainty surges |
| Sextile | 2 | Gentle flow — favorability rises |
| Square | 3 | Tension — conflict enters, favor dips |
| Trine | 4 | Harmony — fortune pours in |
| Opposition | 6 | Full polarity — upheaval, high certainty *and* volatility |
| Minor | 1 or 5 | Ambiguous glance — slight mystery |

#### Named resonances and omens

Eight special conditions are checked when the cast is committed:

| Name | Fires when… | Effect |
|------|-------------|--------|
| **Dignity** | Planet lands in its own sign | The dominant dimension intensifies (+0.5) |
| **Debility** | Planet lands in a hostile sign | Favor −0.5, volatility +0.5 |
| **The Great Trine** | Jupiter or Venus in a trine aspect | Favor +1.0, harmony theme forced |
| **The Duel** | Mars in square or opposition | Volatility +1.0, favor −0.5, conflict theme forced |
| **Saturn's Gate** | Saturn in House 1 or 10 | Certainty +1.0, favor −0.5, authority theme forced |
| **Conjunction Crowned** | Both dice land in the same house *(omen)* | Dominant dimension amplified +1.0 |
| **The Veiled Oracle** | A die lands askew on an edge *(omen)* | Certainty −1.0, mystery theme forced |
| **The Errant Star** | A die flies off the board *(omen)* | A second astral result is spawned |

#### Affinity and the cast

Affinities shape the throw in two ways — as physical forces and as cast modes:

- **Chaos** adds turbulence to the physics (dice scatter wider, more extreme aspects). **Order**
  centers the dice (smaller separation between landing houses). This is cosmetic; the same
  influence is baked into the engine-side fallback generator.
- **Will dominant** → `choice` mode: two casts are drawn and the player picks one.
- **Light ascendant** → `favored` mode: two casts drawn; the higher-favorability result is kept automatically.
- **Shadow ascendant** → `clouded` mode: two casts drawn; the lower-favorability result is kept automatically.
- **Will stirring** → may offer a free recast prompt (probabilistic, same chance as the dice reroll offer).

See [`docs/game-systems.md §8`](docs/game-systems.md) for the full data tables and responder catalogue.

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
