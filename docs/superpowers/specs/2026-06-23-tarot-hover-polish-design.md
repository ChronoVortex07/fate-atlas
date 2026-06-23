# Tarot Draft — Hover Fan-out & Icon Polish

**Date:** 2026-06-23
**Status:** Design approved. Presentational + pure-function changes only — no engine
or game-systems changes. Companion to the earlier `2026-06-23-tarot-visual-redesign-design.md`
(this supersedes that spec's hand-drawn-sigil direction in favour of an external
icon set; the card-back, atmosphere, and ornament work from that spec remain).

## Motivation

Five rough edges on the tarot draft screen
([TarotMinigame.tsx](../../../src/components/screens/TarotMinigame.tsx)):

1. **The hover fan-out feels laggy and unbounded.** Cards chase the cursor with a
   visible delay, can separate past touching, and the whole cluster drifts (ends
   are not anchored).
2. **The card-face sigils and UI glyphs look amateurish.** 78 hand-drawn
   geometric sigils ([sigils.ts](../../../src/data/sigils.ts)) plus emoji
   affordances (👁 ↩ ↻, ▲▼).
3. **The deck art is off-centre** within its stack.
4. **The deck (stacked above the table) crowds the Past/Present/Future hand**, so
   the spread area visually overlaps the hand row.
5. **The Past/Present/Future slots are visually plain** — identical dark boxes.

## Decisions (approved)

- **Icons:** replace **both** the card faces **and** the UI glyphs with the
  **Game-Icons set via `react-icons`** (`react-icons/gi`, MIT-licensed wrappers
  over CC-BY Game-Icons artwork; tree-shakeable per-icon imports).
- **Slot frames:** **distinct per-slot** identity — Past = cool faded silver-blue,
  Present = radiant gold, Future = violet/arcane.
- **Layout:** deck moves to a **framed left rail**, spread to its right.

---

## 1. Hover fan-out mechanic

### 1.1 Smoothness (remove the chase/lag)

Root cause: each table card carries framer-motion's `layout` prop, so every
cursor move animates the `left` change through a spring → the cards trail the
pointer. Fixes:

- Drive the per-card fan displacement as a GPU **`translateX` transform**, not an
  animated `left`. Remove `layout` from the hover-driven transform path (keep it
  only for genuine enter/exit/shuffle reflows, which are keyed by `shuffleKey`).
- Apply the transform with a **snappy, near-critically-damped** response (spring
  ~`stiffness 700, damping 38`) **or** a short `transform 70ms ease-out` CSS
  transition — either tracks the pointer with no perceptible delay.
- **rAF-throttle** `handleTableMouseMove`: store the raw `clientX` and commit
  `fan.centerX` once per animation frame, so rapid mousemoves don't thrash React.

### 1.2 Deformation model (the four properties)

Refine the existing pure `computeFanOffsets` (still unit-tested, no React). The
geometry uses a fixed **envelope**: `ENVELOPE = N * CARD_W` (all cards side by
side, zero overlap), centred in the table. Define `CARD_W` (face width) and a
`REST_OVERLAP` (rest spacing) and `MAX_OVERLAP` (deepest compression).

The function must satisfy, and tests assert, these four properties:

- **R1 — hovered card stays put.** Offsets integrate outward from the cursor
  (cursor-anchored), so the card directly under the pointer has ~zero net
  displacement.
- **R2 — max repulsion is side-by-side.** A single gap opens **at most** to
  touching edges (centre-to-centre `= CARD_W`); cards never separate into a
  visible gap. (Per-gap step is clamped to `CARD_W`.)
- **R3 — ends pinned to the envelope.** Replace the current "subtract the mean"
  re-centre with a hard clamp: the leftmost card's left edge ≥ envelope-left and
  the rightmost card's right edge ≤ envelope-right. Ends may approach the
  extremes but never pass them. The cluster may shift (it is not re-centred), but
  it is bounded.
- **R4 — compression away from the cursor.** Gaps far from the cursor fall
  **below** `REST_OVERLAP` spacing (cards overlap more, toward `MAX_OVERLAP`) —
  genuine expansion-near / compression-far, not expand-only.

At rest (`fan.active === false`) the spread stays overlapped and centred (today's
compact look). The proximity falloff stays a smooth Gaussian gated by a radius.

### 1.3 Test plan (pure function)

Extend `TarotMinigame`'s `computeFanOffsets` tests (or a dedicated test file in
`src/engine/__tests__/`) to assert, on a representative `cardCenters` array:

- R1: the card whose centre is nearest the cursor has `|offset| < ε`.
- R2: no adjacent pair's resulting centre-to-centre distance exceeds `CARD_W`.
- R3: with the cursor at an extreme, the near end-edge sits exactly on the
  envelope bound and does not exceed it; total span ≤ `ENVELOPE`.
- R4: with the cursor at one end, a far gap's centre-to-centre distance is
  **strictly less** than `REST` spacing (compression occurred).
- Inactive/`n≤1` cases return zero offsets (unchanged).

---

## 2. Icon system → Game-Icons via `react-icons`

### 2.1 Dependency

Add `react-icons` (`^5`) to `dependencies`. Import per-icon from `react-icons/gi`
so only used glyphs are bundled. Icons render as `currentColor` SVGs sized by the
`size` prop — drop-in for the current `color`/`size` contract of `CardSigil`.

### 2.2 Pure resolver returns an icon **key**, not geometry

`resolveSigil(card)` ([sigils.ts](../../../src/data/sigils.ts)) stays framework-free
and pure, but its return type changes from path geometry to an **icon key**:

```ts
type IconKey = MajorIconKey | SuitIconKey; // string unions

type SigilSpec =
  | { kind: 'major'; icon: MajorIconKey }
  | { kind: 'minor'; icon: SuitIconKey; rank: { label: string; court: boolean } }
  | { kind: 'spread'; icon: 'spread' };
```

- `MAJOR_ICON_KEYS: Record<string /*major id*/, MajorIconKey>` — all 22 majors.
- `SUIT_ICON_KEYS: Record<Suit, SuitIconKey>` — the 4 suits.
- Minor composition (suit icon + rank cartouche + court crown) and the
  reversed-rotation convention are preserved from today.
- The path-string registries (`MAJOR_SIGILS`, `SUIT_EMBLEMS`, `SPREAD_CREST`) and
  the geometry `SigilDef` are **removed**; `rankLabel`, `primaryFace`, `isFace`
  stay.

### 2.3 `CardSigil` becomes a thin react-icons renderer

`CardSigil` maps `IconKey → IconType` via a `Record<IconKey, IconType>` built from
`react-icons/gi`. Because the record is keyed by the string union, TypeScript
enforces exhaustiveness — every key has a component. It renders:

- **major / spread:** the single mapped icon at `size`, `color` via `currentColor`,
  `rotate(180deg)` when reversed.
- **minor:** a small composed group — the suit icon centred, a rank **cartouche**
  (rounded rect + numeral, reuse current geometry) bottom-right, and a court
  **crown** above for courts. Implemented by wrapping the react-icon in a
  positioned container with the cartouche/crown as a tiny inline SVG overlay
  (keeps the icon a clean glyph while preserving rank/court legibility).

### 2.4 Icon mapping (Game-Icons)

A bespoke, hand-picked mapping. Representative majors (final names verified
against `react-icons/gi` exports during implementation; every id MUST map to a
real export — no fallback):

| Major | Icon (gi) | Major | Icon (gi) |
|---|---|---|---|
| the-fool | `GiJesterHat` | the-magician | `GiMagicSwirl` |
| the-high-priestess | `GiMoon` | the-empress | `GiQueenCrown` |
| the-emperor | `GiCrown` | the-hierophant | `GiPopeCrown` |
| the-lovers | `GiHearts` | the-chariot | `GiHorseHead` |
| strength | `GiLion` | the-hermit | `GiLantern` |
| wheel-of-fortune | `GiWheel` | justice | `GiBalance` |
| the-hanged-man | `GiHangedMan` / `GiPerson` | death | `GiDeathSkull` |
| temperance | `GiPouringPot` | the-devil | `GiHorns` / `GiDevilMask` |
| the-tower | `GiTowerFall` | the-star | `GiStar` |
| the-moon | `GiMoon` | the-sun | `GiSun` |
| judgement | `GiAngelWings` | the-world | `GiWorld` |

Suits: wands → `GiWandfire`, cups → `GiGoblet`, swords → `GiBroadsword`,
pentacles → `GiPentacle`. A `A / B` pair means: prefer `A`; if it is not a real
export in the installed version, use `B`. **The implementer verifies each name
against the installed package and adjusts to the closest real icon — the binding
contract is "thematic + real export", not these exact strings.**

UI glyphs:

| Use | Icon (gi) |
|---|---|
| peek | `GiEyeball` |
| return-to-deck | `GiCardPickup` / `GiReturnArrow` |
| shuffle | `GiCardRandom` / `GiPerspectiveDiceSixFacesRandom` |
| upright | `GiUpCard` / a chevron |
| reversed | rotated form of the upright glyph |

### 2.5 Tests

`src/engine/__tests__/Sigils.test.ts`: assert `resolveSigil` returns a
non-empty, in-union `icon` for **every** major id, every suit, all pip ranks
(A, II–X) and four courts × four suits, and the multi-card spread. A separate
unit check asserts the `IconKey` union is fully covered by `MAJOR_ICON_KEYS` ∪
`SUIT_ICON_KEYS` ∪ `'spread'` (no orphan keys). The component map's exhaustiveness
is guaranteed by the `Record<IconKey, IconType>` type.

---

## 3. Layout — framed deck rail left of the spread

Presentational restructure of [TarotMinigame.tsx](../../../src/components/screens/TarotMinigame.tsx):

- Wrap the deck + table spread in a **horizontal row**: a **deck rail** on the
  left (its own panel) and the **spread** filling the rest.
- **Deck rail panel:** distinct framing from the spread — inset border, soft gold
  glow, the stacked card backs, and the `{n} cards` count. Visually a "draw pile"
  separate from the "table".
- **Deck-art centring fix:** the front `CardBack` is centred within a **symmetric**
  stack (offset the back cards by `±` rather than `+` only, or centre the front
  face over the stack's bounding box) so the art sits on the stack's centre line.
- **Spread area:** keeps the celestial backdrop, corner flourishes, runic bands;
  the fan envelope (1.2) is computed from the spread's width (now narrower because
  the rail takes left space) — `containerWidth` already measures the table ref, so
  this stays correct.
- **Overlap fix:** removing the tall stacked deck above the table reclaims the
  vertical space that pushed the spread onto the hand; add explicit separation
  (gap / a runic divider) between the spread row and the hand row.
- **Responsive:** below a narrow breakpoint (reuse the existing
  `pointer: fine` / a width check) the row wraps so the deck rail sits above the
  spread again — mobile keeps a single column.

---

## 4. Per-slot themed frames (Past / Present / Future)

Presentational. Each slot column gets a themed frame keyed to its position, using
existing palette tokens:

| Slot | Accent | Feel |
|---|---|---|
| Past | `#7b9ec7` (silver-blue), slightly desaturated | cool, faded, "behind" |
| Present | `#d4a854` (gold) | radiant, focal |
| Future | `#9b6bb0` (violet) | arcane, "ahead" |

Each frame: a themed border colour, a small corner ornament (reuse the corner
flourish path), a label glow in the slot accent, and an empty-slot tint in the
same accent. Filled cards keep their face/back; the **frame** is the per-slot
identity. Encapsulate as a small `slotTheme(index)` helper returning the accent +
derived styles so the three columns stay DRY.

---

## 5. Files affected

| File | Change |
|---|---|
| `package.json` | add `react-icons` `^5` |
| `src/data/sigils.ts` | `resolveSigil` returns icon keys; add `MAJOR_ICON_KEYS`, `SUIT_ICON_KEYS`, `IconKey` unions; remove path registries; keep `rankLabel`/`primaryFace` |
| `src/components/cards/CardSigil.tsx` | thin `IconKey → react-icons/gi` renderer; composed minor (icon + cartouche + crown); reversed rotation |
| `src/components/screens/TarotMinigame.tsx` | rAF-throttled hover, transform-based fan, refined `computeFanOffsets` (R1–R4 + envelope), deck-rail left layout, deck centring fix, per-slot themed frames, react-icons UI glyphs |
| `src/engine/__tests__/Sigils.test.ts` | assert full icon-key coverage (no fallback) for majors/suits/ranks/courts/spread |
| `src/engine/__tests__/*` (fan) | assert R1–R4 + inactive cases on `computeFanOffsets` |
| `src/components/cards/FanCard.tsx`, `src/components/screens/ResultReading.tsx` | only if they import removed sigil exports — update to the new `CardSigil`/resolver contract |

## 6. Out of scope

- Engine/game logic, affinities, happenings, `docs/game-systems.md` (no systems
  change).
- The `CardBack` constellation crest (kept as-is — not a tarot "icon").
- Non-tarot iconography beyond the listed tarot-draft UI glyphs (dice, I Ching,
  question-type symbols).
- The reveal/commit results surfaces beyond inheriting the new `CardSigil`
  automatically.

## 7. Risks

- **Game-Icons name drift:** exact `gi` export names must be verified against the
  installed `react-icons` version; the mapping table is directional, the contract
  is "thematic + real export, no fallback". Implementer adjusts names and the test
  enforces completeness.
- **Bundle size:** per-icon imports from `react-icons/gi` keep only used glyphs;
  avoid `import * as` / barrel imports.
- **Fan envelope vs. narrower spread:** the envelope is derived from the measured
  table width, which shrinks once the deck rail takes left space — verify the
  spread still reads well at the reduced width and on resize.
