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
| `npm test` | Run all 251 engine tests (Vitest) |

---

## Gameplay Flow

1. **Title** — click **CONSULT THE STARS**
2. **Question** — pick one of four question types *(Decision, Relationship, Future/Forecast, Self-Analysis)*
3. **Method Select** — the stars deal 3 cards face-down. Affinity effects animate in with a banner before the reveal (Will *widens* the spread with a fourth card, Fate *thins* it, Shadow *shrouds* a card behind a veil), then the cards flip face-up. Draw one to begin — though at high Fate the weave may force your hand, an unseen hand descending to choose a different card for you.
4. **Minigame** — play a short interactive experience (pick a tarot card, roll the dice, cast coins). After it commits, the result is held on a **review beat** showing the face-up outcome; play advances only when you click **Continue**.
5. **Result** — read the interpretation. The reading is **woven organically**: the actual cards, numbers, and hexagrams are named inside flowing sentences (not listed), the opening and closing vary so the dominant theme no longer bookends every reading, and balanced readings **name their opposing forces** (the strongest favorable and adverse signals) in a tension note. Multi-card spreads read **per position** rather than re-listing the cards. Happenings may appear as cryptic events between turns. **Share as Image** or **Copy LLM Prompt**

---

## Divination Methods

| Method | Mechanic | Tags |
|--------|----------|------|
| **Tarot** | 78 cards (22 Major Arcana + 56 Minor Arcana by suit×rank), three-card Past/Present/Future spread consolidated into one result, upright or reversed per face. Complete standardized geometric **sigil system** — 22 bespoke major line-art sigils + composed minors (suit emblem + rank cartouche, court crowns) — with a constellation-crest card back, replacing the old emoji/rune placeholders | `major-arcana` `minor-arcana` `reversible` `fool-archetype` `suit-*` `element-*` ... |
| **d20 Dice** | Flick a 3D d20 into the bowl; the rest of your reading sets a **Difficulty Class**; favorable earlier results grant **Bless d4s**, grim ones impose **Bane d4s**; natural 20 is **Triumph** (critical-high), natural 1 is **Fumble** (critical-low). Five relative tiers: critical-low → critical-high | `roll` `numeric` `threshold` `triumph` *(nat 20)* `fumble` *(nat 1)* |
| **I Ching** | 64 hexagrams (King Wen), authentic 3-coin casting per line. Changing lines (old yang/yin) transform the **primary hexagram** into a **relating hexagram**. Affinities gate whether the player chooses which to commit (Will ascendant), fate chooses (Fate ascendant), or a re-cast is offered (unaligned). The committed hexagram sets a lingering **Mandate of Change** (per-affinity multiplier on all future shift magnitude) that decays 40%/commit toward ×1.0. | `draw` `random` `binary` `governing-primary\|relating` · `changing-lines` `reversible` *(only when changing lines exist)* |
| **Astromancy** | Two 3D d12 dice (planet + sign) thrown onto a 12-house zodiac board (board visible before cast) | `draw` `random` `astral` `planet-<id>` `sign-<id>` `house-<N>` ... |
| **Rune Casting** | A handful of 6 Elder Futhark stones flung onto a concentric cloth (Heart / Field / Margin). Each lands upright, reversed (**merkstave**), or face-down (**silent**). The **governing** stone (nearest the Heart) is read, modified by supporting and crossing stones. **Will** lets you claim/turn a stone; **Fate** drifts the throw and reads it as-fallen; **Light/Shadow** reveal/veil; **Chaos/Order** widen/tighten the scatter and bias merkstave. | `draw` `random` `rune` `rune-<id>` `aett-<x>` `ring-<heart\|field\|margin>` `orientation-<upright\|merkstave>` `upright\|reversed` `reversible\|non-reversible` + omen tags |
| **Strings of Fate** | Trace the red thread through a fog-shrouded web of concepts to a destination that answers your question. From a fixed origin only adjacent concept-stars un-veil (a Sigil-Gem + one mood word); picking one disperses the fog along the thread and reveals the next ring. The full traversed path consolidates **destination-governed** into one result. **Light/Shadow** set clarity + veil; **Will** widens picks and grants backtrack/redraw; **Fate** narrows and may pull the thread; **Chaos/Order** lengthen/straighten the weave. | `draw` `random` `strings` `weave` `concept-<id>` `family-<benevolent\|challenging\|neutral>` + theme tags |
| **Happenings** | 8 authored cryptic scenes offered at most once per turn, in a between-reading gap (never after the final reading). Each presents 2–3 choices whose effects can include permanent affinity shifts, decaying temporary surges, drains (costs), reading modifiers queued for the next divination, or weighted gambles. Selection is axis-weighted toward the player's widest affinity polar pair. | `event` `choice` `affinity-shift` |

### d20 Skill-Check: The Cast

A **3D d20** is flicked into a stone bowl. Before you throw, the reading you have built so
far sets a **Difficulty Class**: favorable earlier divinations raise the bar, grim ones
lower it. The DC formula is `clamp(round(11 + 2.5 × priorFav), 5, 17)` — at baseline
(no prior slots) the DC is 11, exactly median on a d20.

Prior slots with strong favorability also modify the throw. A committed slot with
**favorability ≥ +1.0** grants **Bless (+1d4)** added to your natural roll; one with
**favorability ≤ −1.0** imposes **Bane (−1d4)** subtracted from it. The total (d20 ±
modifiers) is compared to the DC, and the margin determines your tier:

| Margin (total − DC) | Tier |
|:-------------------:|------|
| ≥ +5 | Critical High |
| 0 … +4 | High |
| −1 … −4 | Neutral |
| −5 … −9 | Low |
| ≤ −10 | Critical Low |

**Natural 20** is always **Triumph** (critical-high), regardless of the DC. **Natural 1**
is always **Fumble** (critical-low). These override the margin and emit the `triumph` /
`fumble` tags for meta-interactions.

**Advantage** (**Light** ascendant) and **disadvantage** (**Shadow** ascendant) now show
as a **physical smash-down**: two d20s crash into the bowl simultaneously, the unfavored
die settling visually suppressed. **Will dominant** grants **choice** — both dice settle
and you pick which result stands.

See [`docs/game-systems.md §15`](docs/game-systems.md) for the full DC formula, Bless/Bane
rules, and affinity responder details.

---

### Astromancy: Planet-in-Sign-in-House

Two **3D d12 dice** are thrown onto a 12-house zodiac board — the board is **visible before
casting**. Each slice shows its zodiac **constellation** on a blue field, a small element-colored
sign icon at the edge, and the sign's **name** in a divider band; an astrolabe-style **outer
ring** rims the wheel and is the out-of-bounds zone, with a collision wall at its edge. The **Planet
die** (12 faces: Sun through South Node) lands in a house and contributes the planet's theme
and dimension values. The **Sign die** (12 faces: Aries through Pisces) lands in a house; its
element and modality add dimension leans. The up-most face of each die decides the
planet/sign; the slice it rests in decides the house. The angle between the two landing houses
produces an **aspect** (conjunction, sextile, square, trine, opposition, or minor), which adds
its own dimension modifier and theme.

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
| **Conjunction Crowned** | Planet and sign dice settle close together *(omen)* | Dominant dimension amplified +1.0 |
| **The Veiled Oracle** | You tap to settle while the dice still tumble hard *(omen — the rushed oracle keeps its secret; also the hang-guard cap)* | Certainty −1.0, mystery theme forced |
| **The Errant Star** | A die comes to rest in the outer ring (out of bounds) *(omen)* | A second astral result is spawned |

#### Affinity and the cast

Affinities shape the throw in two ways — as physical forces and as cast modes:

- **Chaos** makes the dice bouncier, with a wider throw and longer spin (more extreme aspects).
  **Order** calms the settle (more damping). The dice are kept in play by a real collision wall
  at the rim, so there is no artificial centering, turbulence, or drift. This is cosmetic; the
  same affinity influence is baked into the engine-side fallback generator.
- **Will dominant** → `choice` mode: two casts are drawn and the player picks one.
- **Light ascendant** → `favored` mode: two casts drawn; the higher-favorability result is kept automatically.
- **Shadow ascendant** → `clouded` mode: two casts drawn; the lower-favorability result is kept automatically.
- **Will stirring** → may offer a free recast prompt (probabilistic, same chance as the dice reroll offer).

See [`docs/game-systems.md §13`](docs/game-systems.md) for the full data tables and responder catalogue.

---

### Rune Casting: The Scatter

A fistful of **6 Elder Futhark stones** is flung onto a dark casting cloth marked with three
concentric rings — the **Heart** (center), the **Field**, and the **Margin** (edge). The player
**aims by pulling back** from the rune-bag and releasing — a slingshot throw. The stones tumble
and settle scattered: each lands **upright**, **reversed (merkstave)**, or **face-down (silent)**.

The reading is read off the scatter. The **governing** stone is the face-up stone nearest the
Heart; its rune (and orientation) sets the base dimensions, theme, and modifier role. A merkstave
governing takes a fixed shadow transform (favor −1.0, volatility +0.5, certainty −0.5). Other
face-up **upright** stones in Heart/Field are **supporting** (half their dimensions + their theme);
face-up **merkstave** stones or any stone in the **Margin** are **crossing** (favor −0.5,
volatility +0.5 each). Silent stones say nothing unless **Light** reveals them.

The 24 runes split into three **aettir** (Freyr's, Heimdall's, Tyr's). The eight **symmetric**
runes (Gebo, Hagalaz, Isa, Jera, Eihwaz, Sowilo, Ingwaz, Dagaz) never fall merkstave — they carry
`non-reversible` and anchor Order.

#### Affinity and the cast

- **Fate** drifts the fling toward the Heart's fated anchor (drift 0 / .33 / .66 / 1.0 by band);
  at ascendant+ the cast is read **as-fallen** with no Keep/Re-cast prompt.
- **Will dominant** → `claim` mode: you pick which face-up stone governs and may **turn** one
  merkstave upright. **Will stirring** → a probabilistic **Re-cast / Keep** offer.
- **Light ascendant** → `favored`: silent stones are revealed; the brighter of the two nearest governs.
- **Shadow ascendant** → `clouded`: the reading is veiled; the dimmer of the two nearest governs.
- **Chaos** widens the scatter and raises merkstave; **Order** tightens it toward the Heart and
  favors upright. The governing stone emits `upright` or `reversed`, feeding Order or Chaos.

#### Scatter omens

| Omen | Fires when… | Effect |
|------|-------------|--------|
| **Bindrune** | ≥2 supporting upright stones share an aett | Governing's dominant dimension amplified ×1.5 |
| **Merkstave Cascade** | every face-up stone is reversed | Volatility +1.0, favor −0.5, upheaval theme |
| **True Cast** | governing is upright in the Heart | Certainty +1.0, illumination theme |
| **The Silent Field** | half or more stones are face-down | Certainty −1.0, mystery theme |
| **The Errant Rune** | a stone flies clear off the cloth | A second rune result is spawned |
| **Perthro, the Lot-Cup** | Perthro is the governing stone | The cup spills — a second rune result is spawned |
| **Hagalaz, the Hailstone** | Hagalaz governs with another face-up stone | Volatility +1.0, favor −0.5, upheaval theme |
| **Isa, the Standstill** | Isa governs | Volatility −1.0, certainty +0.5, stagnation theme |

See [`docs/game-systems.md`](docs/game-systems.md) for the full rune data tables and responder catalogue.

---

## Hidden Affinity System

Six hidden affinities in three opposed pairs shape your readings behind the scenes:
**Chaos ↔ Order** (fortune), **Fate ↔ Will** (agency), **Light ↔ Shadow** (information).
Values run 0–100 (baseline 50) across four bands — *latent, stirring, ascendant, dominant* —
and unlock progressively stronger effects as they rise. They persist across runs in
localStorage, drift back toward baseline each run, and are never shown directly — only hinted
at through atmospheric flavor text.

See [`docs/game-systems.md`](docs/game-systems.md) for the full affinity/band/effect reference.

**Corruption.** Hoard a few forces too high for too long and something from beyond
the stars takes notice — a red, glitching wrongness that feeds on imbalance and
erodes what you've hoarded. It cannot be fought head-on, only starved by letting
your strongest forces fall. Left unchecked it builds to a Rupture that tears the
reading apart and leaves the world low and quiet again, as if nothing happened.
As it grows, corruption begins to taint the methods you're offered — and if your
inner Light burns bright enough, you may catch a warning of where the wrongness
festers, though heeding it will never be enough to drive corruption out.

### Upheavals

At rare extremes the weave can **invert or scramble the displayed affinities** for a few readings. An upheaval bends the *effective* affinity vector — the values that drive every band, hint, and effect — without touching the underlying base. When it expires the real values resurface unchanged.

Two triggers: **opt-in** (a risky happening choice explicitly marked "the weave may tear" will invert one polar pair, invert all three pairs, or shuffle all six values by a fixed permutation for a set number of readings) and **emergent** (if any effective affinity reaches 95 or above and no upheaval is already active, there is a small per-reading chance the weave spontaneously inverts). Progression is preserved underneath — you are not losing your affinities, only temporarily seeing them through a distorted lens.

See [`docs/game-systems.md §9`](docs/game-systems.md) for the full upheaval mechanic reference.

---

## Meta-Interaction Rules

Interactions between divination results are **tag-matched** against the spread, so adding a
new entity with the right tags automatically participates.

| Interaction | Scope | Fires when… | Effect |
|-------------|-------|-------------|--------|
| **Fool's Reroll** | cross-slot | The Fool is in the spread on a dice commit | Recasts the committed d20 |
| **Critical Resonance** | cross-slot | upright spread + critical-low die (or reversed + critical-high) | Flips the whole spread |
| **The Mirror** | cross-slot | exactly two reversible entities present | Both flip orientation (85%) |
| **I Ching Boost** | cross-slot | an I Ching with changing lines is present | Adds a hidden happening choice |
| **I Ching Resonant Change** | cross-slot | committed I Ching has changing lines + another reversible entity in the spread | Narrates that the changing lines resonated outward (report-only) |
| **Suit Accord** | spread-internal | all three spread faces share the same suit | Amplifies the suit's primary dimension |
| **Elemental Clash** | spread-internal | opposing elements are present in the spread | Increases volatility |
| **Major Convergence** | spread-internal | two or more Major Arcana in the spread | Emits a fated-current report |
| **Spread Aligned** | spread-internal | every spread face is upright | Emits a clarity report |
| **Spread Cascade** | spread-internal | every spread face is reversed | Emits an upheaval report |
| **Tiwaz's Victory** | cross-slot | a Tiwaz rune + a critical-high d20 in the spread | Favorability +1.0 on the committed result |

Rune scatters carry the `reversible` and `reversed` tags, so they **automatically participate** in
The Mirror and I Ching Resonant Change with no extra code. The eight rune-internal scatter omens
(Bindrune, Merkstave Cascade, True Cast, Silent Field, Errant Rune, Perthro, Hagalaz, Isa) are
catalogued in the Rune Casting section above.

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
- **Scenarios** — one-click presets that stage and force a single responder, grouped by family (Affinity, Interaction, Combination, Astral, Rune, **Strings**)

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
| Tests | Vitest (251 tests, 27 suites) |
| Image export | html2canvas |
| Persistence | localStorage |
| Typography | Cormorant Garamond + Inter |

---

## Project Structure

```
src/
├── engine/           # Pure TypeScript game engine (no React/DOM)
│   ├── types.ts
│   ├── GameEngine.ts
│   ├── AffinityEngine.ts
│   ├── TurnOrchestrator.ts
│   ├── ReadingPlanner.ts
│   ├── NarrativeAssembler.ts  # Façade: composes + builds the reading, LLM prompt
│   ├── EventBus.ts
│   ├── TagSystem.ts
│   ├── narrative/    # ReadingComposer (beats), drawVoice, ProseBuilder (stitching)
│   ├── events/       # Event dispatch, responders, reducers
│   └── responders/   # Affinity & interaction responders
├── data/             # Game data (typed TS objects)
│   ├── tarot.ts      # 78 cards (22 Major + 56 Minor Arcana)
│   ├── dice.ts       # d20 thresholds
│   ├── iching.ts     # 64 hexagrams
│   ├── happenings.ts # 8 happenings
│   ├── affinities.ts # 6 affinity definitions
│   ├── divination-profiles.ts
│   ├── dice-modifiers.ts
│   └── constellations.ts
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
