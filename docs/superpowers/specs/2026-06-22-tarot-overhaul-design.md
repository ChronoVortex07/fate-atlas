# Tarot Minigame Overhaul — Design

**Date:** 2026-06-22
**Status:** Approved design, pending implementation plan

## 1. Summary

Overhaul the tarot minigame to:

1. Add a **minor arcana** (procedurally generated from suit × rank) that is **dimension-heavy and theme-light**, complementing the theme-heavy major arcana.
2. Replace the single "pick one card from a hand" draw with an authentic **three-card Past / Present / Future spread**, drawn from the full 78-card deck, that **consolidates into a single reading slot** so tarot stays one of three methods and does not overpower the synthesis.
3. Replace the inconsistent unicode/emoji symbols with a **unified custom SVG line-art sigil system**.
4. Add new **tarot-facing meta-interactions and affinity effects** that the richer spread makes possible (and adapt the existing ones whose pick/orient steps disappear).

The core design constraint of the project is preserved: all game logic stays in framework-free `src/engine/` + `src/data/`; React only renders state and forwards actions.

## 2. Decisions (locked during brainstorming)

| # | Question | Decision |
|---|----------|----------|
| 1 | How do the 3 spread cards feed the reading? | **Consolidate into one slot** (Past/Present/Future framing; one reading contribution) |
| 2 | How are minors built? | **Procedural from suit × rank** (all 56 generated from rules + templates) |
| 3 | Spread orientation/agency? | **One spread-wide orientation choice** (reveal-as-drawn vs reverse the spread) |
| 4 | Card representation? | **Custom SVG line-art sigils** (gold/purple, composed minors) |
| 5 | New tarot interactions/affinities in scope? | **All four sets** — elemental, spread-coherence, Chaos/Order, Light/Shadow (plus the mandatory Fate/Will repurposing) |

## 3. Core architecture — the consolidated spread

### 3.1 Data model

Extend [`TarotResult`](../../../src/engine/types.ts) so it optionally carries the three dealt cards, while its top-level `ThematicData` (themes/dimensions/modifierRoles) and `tags` remain the **consolidated** values every existing consumer already reads (ReadingPlanner, AffinityEngine, interaction responders, NarrativeAssembler).

```ts
type SpreadPosition = 'past' | 'present' | 'future';

interface TarotCardFace {            // one dealt card
  id: string;
  name: string;
  arcana: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';            // minors
  rank?: number | 'page' | 'knight' | 'queen' | 'king';        // minors (number = 1..10, 1 = Ace)
  number?: number;                                              // majors 0..21
  orientation: 'upright' | 'reversed';
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag?: string;             // majors
  veiled?: boolean;                  // Shadow — Veiled Position
  tags: Tag[];
}

interface TarotResult extends ThematicData {
  type: 'tarot';
  // existing: id, name, orientation, symbol, meaningUpright, meaningReversed, tags
  spread?: { position: SpreadPosition; card: TarotCardFace }[];  // NEW
  // top-level themes / dimensions / modifierRoles / tags = CONSOLIDATED
}
```

`TarotCardData` (the static definition in `tarot.ts`) gains `arcana`, `suit?`, `rank?` so both majors and minors share one definition shape and `<CardSigil>` can derive art.

### 3.2 Consolidation rules — `consolidateSpread(faces: TarotCardFace[]): TarotResult`

Works for **N = 1..3** faces (single draws are just N = 1), so `drawTarotCard` and `drawTarotSpread` share one code path.

- **Dimensions:** equal-weight average of the faces' dimensions (after orientation applied), each axis rounded to 0.5 granularity, clamped −2..+2. *(Past/present/future remains a narrative framing; ReadingPlanner already double-weights the slot when it matches the question's primary role, so no per-position weighting here — avoids double-counting.)*
- **Themes (balance lever):** count theme frequency across the faces; keep the **top 2** (tie-break by summed dimension magnitude of the faces carrying each theme). Caps tarot at ≤2 themes, on par with one other result, so the theme histogram in `ReadingPlanner.aggregate()` cannot be flooded by an all-majors spread.
- **Modifier roles:** union of the faces' intrinsic roles, deduped (data-driven — *not* auto all-three; preserves gap-steering).
- **Tags (deduped union):** `draw`, `random`, `reversible`, the **majority** orientation tag, `major-arcana`/`minor-arcana`, **all archetype tags of any majors present** (so Fool's Reroll etc. still fire), and `suit-*` / `element-*` tags.
- **orientation:** majority of the faces (for N = 3, two or more reversed → `reversed`).
- **id / name / symbol / meanings:** single (N=1) → the face's own values. Spread (N=3) → `id = 'spread:' + faces.map(f=>f.id).join('+')`, `name = 'Three-Card Spread'`, `symbol` = the spread emblem fallback glyph, meanings = the Present-position card's meaning as representative (full per-position detail lives in `spread`).
- **spread:** `[{position,card}]` — `['past','present','future']` for N=3; `[{position:'present', card}]` for N=1.

### 3.3 Draw and flow

- **Deck:** `FULL_DECK = [...MAJOR_ARCANA, ...MINOR_ARCANA]` (22 + 56 = 78), uniform draw.
- `drawTarotSpread(affinities)` draws **3 distinct** cards (no replacement), builds a `TarotCardFace` for each with affinity-biased per-card orientation (existing reversal-chance math), assigns Past/Present/Future, returns `consolidateSpread(faces)`.
- `drawTarotCard(affinities)` stays as `consolidateSpread([oneFace])` for internal reuse: deal-swap replacements, Will redraws, and `chaos-second-result` (which spawns a **single** bonus card, not a whole second spread, to avoid doubling weight).
- **Helpers:** `reverseFace(face)` (flip orientation + favorability sign + theme-swap map + orientation tag) and `reverseSpread(result)` (map faces through `reverseFace`, re-consolidate). Used by both the player "reverse" choice and the mutating responders.
- **Minigame flow:** deal 3 face-down in Past/Present/Future → flip in sequence → **one spread-wide orientation choice** (reveal-as-drawn → Fate feed; reverse-the-spread → Will + Chaos feed, via `reverseSpread`) → peek (Light) glimpses the spread's leaning → commit one slot. Will may grant redraws during the deal (see §5.A).

### 3.4 Why balance holds

- **Reading aggregation:** tarot is one slot → one dimension vector, ≤2 themes, union of modifier roles. No 3:1:1 dominance.
- **Affinity feeds:** one `random` tag + one majority-orientation tag + one orientation action feed per spread — identical magnitude to a single card today.
- **Deck dilution:** 78 cards (~28% majors) skews spreads toward dimension-heavy minors and keeps single-card events (e.g., The Fool) at roughly today's frequency.

### 3.5 Display & the two interaction scopes

A committed tarot result is **one entry** in the reading fan but represents a spread.

- **Fan card** ([`FanCard.tsx`](../../../src/components/cards/FanCard.tsx), small): a three-card "spread" emblem (or the Present face as representative) + the consolidated orientation leaning + a subtle "×3 / Past·Present·Future" marker. The existing `isExpanded` state can fan the three faces out.
- **Big reveal** ([`CardSlot.tsx`](../../../src/components/cards/CardSlot.tsx), 220×330): a full Past / Present / Future strip of three `<CardSigil>` faces (each with its orientation) + the consolidated reading line.
- **Minigame screen** (600px): the spread is the centerpiece — all three dealt large.

**Interactions split into two scopes (both must be documented):**

1. **Cross-slot interactions** (`fool-reroll`, `critical-resonance`, `mirror`, `iching-happening-boost`) read the **consolidated slot tags**. Because consolidation lifts every face's identity tags up to the slot, a spread containing The Fool carries `major-arcana` + `fool-archetype` → **Fool's Reroll fires whenever the Fool is anywhere in the spread** (no "pick" required — more faithful to the flavor, and ~3.8% per spread, comparable to today). Critical Resonance uses the spread's majority orientation and flips via `reverseSpread`; Mirror counts the spread as one `reversible` entity.
2. **Spread-internal interactions** (the new elemental/coherence ones) read the `result.spread` **faces array** — they are about patterns *within* one spread.

## 4. Content

### 4.1 Procedural minor arcana

`MINOR_ARCANA: TarotCardData[]` is generated once at module load (like `MAJOR_ARCANA`) — 4 suits × 14 ranks (Ace–10 + Page/Knight/Queen/King) = 56. Stable list → easy to test and to draw without replacement.

**Suits = dimension leanings** — base unit-vectors `(favorability, certainty, volatility)`:

| Suit | Element | Base vector | Pip modifier role | Rare light theme |
|------|---------|-------------|-------------------|------------------|
| Wands | fire | (+0.3, +0.2, **+0.8**) | action | conflict / transformation |
| Cups | water | (**+0.8**, −0.3, +0.2) | subject | harmony / mystery |
| Swords | air | (−0.6, +0.5, +0.5) | effect | conflict / illumination |
| Pentacles | earth | (+0.5, **+0.7**, −0.5) | subject | stagnation / harmony |

Each pip carries exactly **one** modifier role (above); courts carry their own (Page/Queen → subject, Knight/King → action). Single roles keep the consolidated role union small and deterministic. Reading-level coverage stays balanced: subject (Cups, Pentacles, Page, Queen), action (Wands, Knight, King), effect (Swords) — with effect also supplied by majors and the d20 (whose profile strength is `effect`).

**Rank = intensity:** `intensity(rank) = 0.6 + (rank − 1) / 9 × 1.4` (Ace ≈ 0.6 focused essence … 10 ≈ 2.0 culmination). `dimensions[axis] = clamp(round(base[axis] × intensity, 0.5), −2, +2)`. Special cases: **Ace** adds a small purity bonus to the suit's dominant axis; **10** adds a volatility bump. **Courts** use fixed intensity ≈ 1.2 with dampened volatility (×0.6) and carry people/role modifiers: Page → subject, Knight → action, Queen → subject, King → action.

**Themes:** only Aces, 10s, and courts carry **one** light theme (from the suit's list); pips 2–9 carry **none**. Majors remain the theme layer.

**Meanings:** templated from compact suit-phrase × rank-phrase tables (no 56 bespoke strings). Reversed flips favorability + uses reversed phrasing (parallels majors).

**Tags per face:** `draw, random, reversible, minor-arcana, suit-<x>, element-<x>, rank-<key>` + orientation (added at face build).

**Data update:** add `volatility` to tarot's `dimensionStrengths` in [`divination-profiles.ts`](../../../src/data/divination-profiles.ts), since minors now bring real volatility.

### 4.2 SVG sigil system

New presentational `<CardSigil card={face|result} size=… state=… />` in [`src/components/cards/`](../../../src/components/cards/), **zero engine logic**, rendering line-art SVG (`stroke="currentColor"`, `fill="none"`) so it inherits the gold/purple palette.

- **Majors (22):** a registry mapping major id → an SVG sigil (small viewBox line drawings — e.g. Tower = broken tower, Star = 8-point star, Moon = crescent). The bulk of the art effort, but each is a simple line drawing.
- **Minors (56) — composed, not drawn 56×:** 4 **suit emblems** (staff/flame, chalice, blade, coin) + a **pip-layout function** (emblem arranged by count for Ace–10) + 4 **court motifs** (figure/crown). 4 + 4 + a function cover all 56.
- **Spread emblem:** a "three overlapping cards" sigil for the compact fan representation.
- **Reversed = SVG rotated 180°** (literal inversion). **Flip reveal** animates via `stroke-dashoffset` draw-on (framer-motion).
- **Fallback:** `symbol` (unicode) is kept for the LLM prompt text and `aria-label`.

Components switching from raw `symbol` text to `<CardSigil>`: TarotMinigame, CardSlot (tarot case → P/P/F strip), FanCard (→ spread emblem), HistoryTiles, ResultReading. Dice and I Ching keep their current symbols (out of scope).

## 5. Meta-interactions & affinity effects

Three tarot dispatch points drive these: **`tarot:deal`** (new — after 3 cards dealt, before reveal), **`tarot:orient`** (orientation decision), **`tarot:commit`** (post-commit).

### 5.A Core repurposed effects (mandatory — the pick/orient steps are gone)

| Effect | Trigger / band | Gate | Behavior |
|--------|----------------|------|----------|
| **Fate — Deal-Swap** (`fate-deal-swap`, replaces `fate-override-pick`) | `tarot:deal` / OVERRIDE | `bandRoll(fate, ascendant, major)` | Swap one dealt position's face for a fresh single draw before reveal |
| **Fate — Auto-Orient** (`fate-auto-orient`, adapted) | `tarot:orient` / OVERRIDE | `bandRoll(fate, stirring, notable)` | Decide the spread-wide reveal-vs-reverse for the player |
| **Will — Spread-Redraw** (replaces `handSize`) | static effect `spreadRedraws = clamp(willIdx − 1, 0, 2)` | — | Player may redraw up to N disliked positions during the deal; each redraw feeds Will. UI affordance + action feed, not a responder |
| **Critical Resonance / Mirror** (adapted) | `tarot:commit` / MUTATE | unchanged | Operate via `reverseSpread()`; majority orientation; spread = one `reversible` entity |

### 5.B Orientation tug-of-war — Chaos vs Order (`tarot:orient`, exclusive MUTATE, `weight = affinity value`)

| Effect | Gate | Behavior |
|--------|------|----------|
| **Chaos — Wild Card** (`chaos-wild-card`) | `bandRoll(chaos, ascendant, notable)` | Flip ONE random position against the spread, then recompute consolidation |
| **Order — Anchored Spread** (`order-anchor`) | `bandRoll(order, ascendant, notable)` | Force the spread to coherent as-drawn upright, then recompute |

Both sit in MUTATE at the same trigger → at most one wins, weighted by Chaos vs Order value (the dominant force prevails). Fate Auto-Orient (OVERRIDE) can still co-fire.

### 5.C Spread-internal patterns — new stackable `spread` combine channel (`tarot:commit`)

Read the `result.spread` faces array. They go on a **new combine channel `spread`** so several can apply at once (e.g., Cascade + Elemental Clash):

| Pattern | Fires when | Effect |
|---------|-----------|--------|
| **Suit Accord** (`suit-accord`) | all 3 faces share a suit | amplify that suit's primary (largest-magnitude base) axis — Wands→volatility, Cups→favorability, Swords→favorability, Pentacles→certainty (×1.5, clamped) |
| **Elemental Clash** (`elemental-clash`) | opposing elements present (fire+water / air+earth) | +volatility (turbulent reading) |
| **Major Convergence** (`major-convergence`) | ≥2 majors | dominant theme emphasized — a "fated" reading |
| **All Upright** (`spread-aligned`) | all 3 upright | small **Order** feed + clarity banner |
| **All Reversed** (`spread-cascade`) | all 3 reversed | small **Chaos** feed + dramatic banner |
| **Shadow — Veiled Position** (`shadow-veil-position`) | `bandRoll(shadow, ascendant, notable)` | one face's `veiled = true` (hidden in the reading; dimensions still count) |

### 5.D Light — Position Foresight

Extends the existing **peek** (Light-gated already): on a successful peek, name *which position* (Past/Present/Future) carries the strongest pull, rather than just the overall leaning. An enhancement to `describeLeaning`/peek, not a new responder.

### 5.E Required engine change

Generalize `CombineReducer.reduce` → `EffectReport | EffectReport[] | null` and the dispatcher's combine loop ([`EventDispatcher.ts`](../../../src/engine/events/EventDispatcher.ts) ~L59) to push arrays. `roll-mode` is unchanged; a new `spreadReducer` applies each contributor's mutation/feed and emits one banner per applied pattern. This is the only core-engine touch.

**Affinity coverage:** all six affinities now have a tarot-facing effect — Chaos (Wild Card + reversal bias + second-result), Order (Anchor + reversal bias), Fate (Deal-Swap, Auto-Orient), Will (Redraw), Light (Foresight + pool preview), Shadow (Veil). Affinity-feed balance holds: the All-Upright/All-Reversed feeds are small and the spread still emits just one orientation tag overall.

## 6. Files touched

**Data** — `tarot.ts` (arcana/suit/rank fields, `MINOR_ARCANA` generator, `FULL_DECK`, `consolidateSpread`/`drawTarotSpread`/`reverseSpread`/`reverseFace`, refactor `drawTarotCard`); `divination-profiles.ts` (tarot volatility).

**Engine** — `types.ts` (`SpreadPosition`, `TarotCardFace`, `TarotResult.spread?`, `handSize`→`spreadRedraws`, `CombineReducer` return); `AffinityEngine.ts` (`spreadRedraws`); `GameEngine.ts` (`resolveTarotDeal`, `resolveSpreadOrientation`, redraw + Will feed, spread-aware commit, single-card chaos second-result); `events/EventDispatcher.ts` + `events/reducers.ts` (array combine + `spreadReducer`); `responders/affinity.ts` (`fate-deal-swap`, spread-wide `fate-auto-orient`, `chaos-wild-card`, `order-anchor`, `shadow-veil-position`); `responders/interactions.ts` (adapt `critical-resonance`/`mirror`; add `suit-accord`/`elemental-clash`/`major-convergence`/`spread-aligned`/`spread-cascade`); `events/scenarios.ts` (debug scenario per new responder); `NarrativeAssembler.ts` (spread positions + veil in LLM prompt).

**Components** — NEW `cards/CardSigil.tsx`; rewrite `screens/TarotMinigame.tsx`; update `cards/CardSlot.tsx`, `cards/FanCard.tsx`, `overlays/HistoryTiles.tsx`, `screens/ResultReading.tsx`.

**Docs** — `docs/game-systems.md` (§3a handSize→spreadRedraws, §4 new responders, §5 new + adapted interactions, new spread/consolidation subsection); `README.md` (tarot section) — in the same change as their systems (per CLAUDE.md).

## 7. Testing (Vitest, engine + data only)

- `Tarot.test.ts`: majors still 22, minors 56, deck 78; minor dimension ranges per suit; courts carry roles; **consolidation** (themes ≤2, dims averaged, tags union including lifted archetype/suit, majority orientation); `reverseSpread` flips all + recomputes; `drawTarotSpread` returns 3 distinct.
- New responder/interaction tests: `fate-deal-swap`, `chaos-wild-card`, `order-anchor`, `shadow-veil-position`, `suit-accord`, `elemental-clash`, `major-convergence`, `spread-aligned`, `spread-cascade`; and **Fool's Reroll still fires when The Fool is anywhere in the spread**.
- Reducer test: `spread` channel emits multiple reports.
- `AffinityEffects.test.ts`: `spreadRedraws` replaces `handSize`.
- Randomness is stubbed via `Math.random` where assertions depend on it (existing convention).

## 8. Build order (each phase ends green before the next)

1. **Data foundation** — types, minor generator, consolidation/draw/reverse helpers, `FULL_DECK` + tests (engine-pure, no UI).
2. **Engine wiring** — spread-aware commit, deal/orient methods, `spreadRedraws`, profiles + tests.
3. **Responders & `spread` channel** — reducer generalization, repurposed Fate, new Chaos/Order/Shadow responders, new interactions, debug scenarios + tests.
4. **SVG sigils** — `CardSigil`; swap `symbol`→sigil in slot/fan/history/result (non-minigame).
5. **Minigame UI** — rewrite for the dealt spread (deal/flip/orient/peek/redraw), P/P/F, veil.
6. **Docs** — game-systems.md + README.

Phases 1–3 deliver the full mechanical overhaul behind the existing UI (tests prove it); 4–5 are the visual layer; 6 keeps docs in sync.

## 9. Non-goals / out of scope

- No changes to dice or I Ching content or visuals (their symbols stay as-is).
- No per-card orientation choices (one spread-wide choice only).
- No new question types or changes to the 3-minigames-per-turn turn structure.
- Minor arcana are procedurally generated, not individually hand-authored.
- `chaos-second-result` for tarot spawns a single bonus card, not a second full spread.

## 10. Open tuning knobs (safe to adjust during implementation)

- Suit base vectors, rank intensity curve, Ace/10 special-case magnitudes.
- Theme cap (default 2) and which ranks carry a light theme.
- Suit Accord amplification factor (×1.5) and Elemental Clash volatility bump.
- Spread-coherence feed magnitudes (All Upright / All Reversed).
- Gate bands/tiers for the new responders.
