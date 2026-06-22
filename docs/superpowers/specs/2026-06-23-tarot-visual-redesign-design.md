# Tarot Visual Redesign — Design Spec

**Date:** 2026-06-23
**Status:** Spec 2 of 2. This spec covers the **visual redesign**: a complete,
standardized card-sigil icon system and a polish pass on the tarot draft UI. The
**functional fixes** (fan-out, continue gate, results rework) are covered by the
companion spec `2026-06-23-tarot-minigame-fixes-design.md` and are out of scope
here. The two specs are independent and can be implemented in either order.

## Motivation

1. **Card icons are incomplete and emoji-dependent.** `CardSigil`
   ([CardSigil.tsx](../../../src/components/cards/CardSigil.tsx)) defines an SVG
   line-art system but only **2 of 22** majors are authored (`the-fool`,
   `the-star`) — the other 20 fall back to a generic circle. Minors collapse to
   one of four suit emblems with no rank distinction. Several touchpoints still
   render the emoji `symbol` field (`☉ ⭐ ☀ ♀ ☽`…). The face-down card back is
   ad-hoc runes + a star (`ᚠᚢᚦ ✧`).
2. **The draft UI is visually plain.** Dark boxes, dashed borders, and rune
   placeholders. It should feel like a divination ritual.

## Visual direction (decided)

- **Sigil style:** refined **geometric line-art** — sacred-geometry
  constructions, thin uniform stroke, astrological/alchemical character.
  Continues the language of the two existing majors, at a higher craft bar.
- **Minor composition:** **suit emblem + numeral cartouche** — one clean suit
  emblem with the rank in a small corner cartouche (roman numeral I–X / "A" for
  aces; letter P/N/Q/K for courts, courts also get a small crown).
- **UI treatment:** **celestial + arcane** — cosmic atmosphere (starfield
  ground, glowing deck, gold focus-glow) combined with grimoire ornamentation
  (corner flourishes, runic-band dividers, an engraved constellation-crest card
  back).

---

## 1. Sigil system

### 1.1 Extract a pure, testable sigil module

Today the registry and resolution logic live inside the `CardSigil` component.
Move the **resolution** out into a framework-free module
`src/data/sigils.ts` (no React/DOM):

- `MAJOR_SIGILS: Record<string, SigilDef>` — all 22 majors.
- `SUIT_EMBLEMS: Record<Suit, string>` — the 4 refined suit emblem paths.
- `resolveSigil(card): SigilSpec` — pure function returning what to draw: for a
  major, its `SigilDef`; for a minor, `{ emblem, rank: { kind: 'pip'|'court', label, court? } }`;
  for a multi-card spread, the spread crest.

A `SigilDef`/`SigilSpec` describes geometry as data (path strings + optional
cartouche/crown flags) so it can be unit-tested without rendering. `CardSigil`
becomes a thin renderer over `resolveSigil`.

### 1.2 Author all 22 major sigils

Each major gets a bespoke geometric line-art sigil in the shared drawing
contract: `viewBox 0 0 48 48`, `stroke=currentColor`, `fill=none`,
`stroke-width ≈ 1.5`, rounded caps/joins, centered with balanced negative space,
and a **distinct silhouette** keyed to the card's symbolism (e.g. The Tower =
struck tower + bolt; Wheel of Fortune = spoked ring; The Moon = crescent + path).
No generic-circle fallback should ever render for a real card.

### 1.3 Compose the 56 minors (emblem + cartouche)

`CardSigil` renders, for a minor: the refined suit emblem centered, plus a small
corner **cartouche** (rounded rect) containing the rank label — a roman numeral
(A, II–X) for pips, or a court letter (P/N/Q/K) for courts. Courts additionally
render a small crown above the emblem. This requires `CardSigil` to render a
**group** (emblem path + cartouche rect + numeral text + optional crown path),
not a single path as today. Suit emblems are refined for visual consistency with
the majors.

### 1.4 Orientation & spread

- **Reversed** keeps the existing 180° rotation convention.
- **Multi-card spread** keeps a dedicated crest (the existing three-overlapping-
  cards motif), refined to match.

### 1.5 Replace remaining tarot emoji

Audit and route every tarot-card visual through `CardSigil`. Known straggler:
`ResultReading` sub-card layout renders `sc.symbol` (emoji)
([ResultReading.tsx:182](../../../src/components/screens/ResultReading.tsx#L182))
— switch to `<CardSigil card={sp.card} … />`. The tarot `symbol` field in
`src/data/tarot.ts` may remain in the data (it is harmless), but it should no
longer be *rendered* for tarot. Non-tarot symbols (dice, I Ching, question
types) are out of scope.

---

## 2. UI polish — celestial + arcane

Presentational only — no engine/logic changes; keep the engine/React split.

### 2.1 Card back (standardized)

Replace the ad-hoc `ᚠᚢᚦ ✧` runes on face-down cards (table, hand, deck) with a
single standardized **constellation-crest back**: a faint geometric crest over a
sparse star pattern, in muted blue/gold. Implement as a small reusable
`CardBack` element so table cards, hand cards, and the deck stack share it at
different sizes. (`FanCard`'s `RUNE_SETS` backs are updated to match.)

### 2.2 Celestial atmosphere ([TarotMinigame.tsx](../../../src/components/screens/TarotMinigame.tsx))

- Subtle starfield/nebula ground behind the table area (reuse the existing
  `StarField`/celestial patterns where possible).
- Deck stack gets a soft gold glow.
- Focused/hovered table card and the active hand slot get a gold focus-glow
  (pairs with the fan-out from Spec #1).

### 2.3 Arcane ornamentation

- Ornamental **corner flourishes** framing the tableau (reuse/extend
  `OrnamentalBorder`).
- **Runic-band dividers** above and below the table spread (reuse `RunicBand`).
- Engraved Past/Present/Future hand labels; refined empty-slot styling; refined
  heading type and gold hairline rules under headings/commit row.

### 2.4 Consistency

The reveal/commit and result surfaces (`FanCard`, `ResultReading`,
`ConstellationFan`) already use `CardSigil`; once the registry is complete they
upgrade automatically. Verify the card back and ornamentation read well at the
small `FanCard`/tableau sizes.

---

## 3. Files affected

| File | Change |
|------|--------|
| `src/data/sigils.ts` *(new)* | Pure sigil registry + `resolveSigil`; all 22 majors, 4 refined suit emblems, minor/court composition data |
| `src/components/cards/CardSigil.tsx` | Thin renderer over `resolveSigil`; render composed minor groups (emblem + cartouche + crown) |
| `src/components/cards/CardBack.tsx` *(new)* | Standardized constellation-crest face-down back |
| `src/components/screens/TarotMinigame.tsx` | Celestial atmosphere, ornament, runic dividers, `CardBack`, focus-glow |
| `src/components/cards/FanCard.tsx` | Use `CardBack`; confirm sub-sigil rendering with completed registry |
| `src/components/screens/ResultReading.tsx` | Sub-card layout uses `CardSigil` instead of emoji `sc.symbol` |
| `src/engine/__tests__/Sigils.test.ts` *(new)* | Assert `resolveSigil` covers all 22 majors (no generic fallback) and composes every minor rank/court |
| `docs/game-systems.md` / `README.md` | Note the standardized sigil system if referenced |

## 4. Testing

- `resolveSigil` completeness is unit-tested (the pure module lives in `src/data`,
  within the engine test scope): every major id resolves to a bespoke sigil and
  every minor (aces, II–X, four courts × four suits) composes correctly.
- The rendered look (sigil craft, card back, atmosphere, ornament) is verified by
  running the dev server — consistent with the repo having no component tests.

## 5. Out of scope

- Functional fixes (fan-out, continue gate, results rework) — see the companion
  spec.
- Non-tarot iconography (dice, I Ching, question-type symbols).
