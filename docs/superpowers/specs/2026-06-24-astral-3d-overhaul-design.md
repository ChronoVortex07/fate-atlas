# Astral Minigame: 3D Overhaul — Design

**Date:** 2026-06-24
**Status:** Approved (pending spec review)

## Summary

Overhaul the astral ("Celestial Cast") minigame on three axes:

1. **Reduce the vortex** that clumps the dice at board center, so they spread across slices.
2. **Visually enrich the board** — outer framing, per-slice zodiac art (cleared CC0 line-art set), darkened slice backgrounds, element tinting, house labels.
3. **Make the board visible before "cast"** is pressed.
4. **Replace the 2D Matter.js tokens with real 3D dice** (three.js + cannon-es) — two d12 dice whose faces carry the 12 planets / 12 signs; the face that lands up *is* the result.

The `onSettled(cast: AstralCast)` contract from the board component to the engine stays **identical**, so all engine logic, responders, and Vitest engine tests are untouched. All new code lives in the React/component layer; the engine remains framework-free.

## Background (current behavior)

- [src/components/screens/CelestialCast.tsx](../../../src/components/screens/CelestialCast.tsx) renders two flat tokens on a 2D canvas via Matter.js: a "planet" token (☉) and a "sign" token (☽), each showing one pre-drawn glyph.
- The **vortex** is `centreForce` with `orderK = 0.000008 + order * 0.000025`, applied to both bodies every tick — this clumps them at center, leaving little landing variance.
- Planet & sign identity is drawn **uniformly at random** in [src/data/astromancy.ts](../../../src/data/astromancy.ts) `drawAstralCast`; only the **house** (the 1–12 sector a token rests in) comes from physics (`sectorOf`).
- There are exactly **12 planets** and **12 signs** — a natural fit for two d12 dice.
- Physical landing drives real gameplay omens (`OmenTag`): a token leaving the bowl → `errant-star` (spawns a second result via [src/engine/responders/astral.ts](../../../src/engine/responders/astral.ts)), tokens close together → `crowned-conjunction`, slow settle → `veiled-oracle`. Physics must stay *meaningful*, not cosmetic.
- [src/data/constellations.ts](../../../src/data/constellations.ts) holds a vector star/line art system already in the project.

## Decisions (from brainstorming)

- **Rendering/physics:** Full 3D — `three` + `cannon-es`, used vanilla inside the component's `useEffect` (mirrors existing Matter.js pattern).
- **Slice art:** Raster/vector image per sign, sourced from the cleared **OpenClipart "Line Art Zodiac Signs" set (CC0 / public domain, no attribution required)** — https://openclipart.org/detail/284446/line-art-zodiac-signs . Ships as one combined SVG; split into 12 per-sign files.
- **Camera:** Dynamic — tilted/low during the tumble, easing to top-down as dice settle.
- **Core mechanic:** the die roll decides planet & sign (top face), physics decides houses (resting slice). Confirmed.
- **Slice mapping:** the 12 slices are houses 1–12, each decorated with its **natural-zodiac** sign (House 1 → Aries … House 12 → Pisces). Cosmetic only. Confirmed.

## Core mechanic change

In the new model the **die roll itself decides the planet and sign** (the top face when it settles), rather than a uniform pre-draw. Each die is a **d12 (dodecahedron)**:

- **Planet die** (gold glyphs) → top face = planet.
- **Sign die** (cool-blue glyphs) → top face = sign.
- **Resting slice** of each die = its house (the 12 board sectors, as today).
- Distribution is uniform-random over faces, matching today's planet/sign distribution. House distribution comes from physics (affinity-biased), as today.

`drawAstralCast` remains in the codebase for: engine tests, the no-WebGL/reduced-motion fallback, and any non-physics path. It is no longer the source of faces in the 3D path.

## The board (12 slices)

- 12 pie slices = **houses 1–12**, each decorated with its **natural-zodiac** sign image (House 1 → Aries … House 12 → Pisces).
- Per slice: the cleared line-art zodiac SVG (darkened, ~25–40% opacity) + an **element tint** radial wash (fire/earth/air/water) + the house number/arena label at the rim.
- **Framing:** outer gold ring/bezel, inner spoke dividers, subtle center sigil. The board is a shallow 3D **bowl** (gentle concave floor) so dice settle naturally.
- Element tints follow `ELEMENT_BY_SIGN` for each slice's natural sign.

## 3D rendering & physics

- **Libraries:** `three`, `cannon-es`, `@types/three`. Used vanilla inside `useEffect`. Engine stays React/DOM-free; all 3D in the component layer.
- **Module folder** `src/components/screens/celestial/`, split into focused files:
  - `scene.ts` — three.js scene/renderer/lights + cannon-es world setup and step loop.
  - `dice.ts` — d12 geometry, per-face glyph texture atlas, top-face readout (face normal best aligned with world-up), targeted-snap helper.
  - `board.ts` — bowl mesh, slice textures composited from the zodiac SVGs + element tint + labels, framing.
  - `readout.ts` — settled (x,z) → sector mapping and omen detection (errant-star / crowned-conjunction / veiled-oracle).
  - `CelestialCast.tsx` — React wrapper; **same props/`onSettled` contract** as today, plus optional `target?: AstralCast`.
- **Camera:** `PerspectiveCamera` tweened from a tilted low angle (~55° elevation) during the tumble to near top-down (~85–90°) on settle (~0.8s ease).
- **Settle readout:** top face = the die face whose world-space normal is most aligned with +Y; house = settled (x,z)→sector angle; thresholds match today.

## The vortex fix

Replace the constant strong centering force with a shallow **bowl + gravity**, and make centering *gentle and affinity-scaled*:

- **Order** → mild centering + lower restitution (calmer, tighter grouping).
- **Chaos** → higher restitution + scatter impulse + occasional turbulence (wider spread, more extreme aspects).
- **Light / Shadow** → slight lateral gravity bias (preserves today's drift meaning).

Net effect: dice come to rest spread across different slices instead of spinning together in the middle.

## Omens (preserved, made physical)

- **errant-star** — a die comes to rest past the board rim (a hard/chaotic throw can clear the low rim; chaos raises the odds). Still spawns a second result.
- **crowned-conjunction** — planet & sign dice settle within a proximity threshold.
- **veiled-oracle** — a die settles **cocked/askew** (no face clearly up) *or* the settle exceeds the time cap — matching its "a die rests askew" flavor.

## Modes, recast, idle, debug, fallback

- **single / favored / clouded / choice & recast:** flow in [src/components/screens/AstralMinigame.tsx](../../../src/components/screens/AstralMinigame.tsx) unchanged at the state-machine level.
- **Two-cast modes (favored/clouded/choice):** roll sequentially in the one board (cast A settles → brief beat → board clears → cast B rolls), keeping a single WebGL context. The existing two result/choice **cards** still handle visual comparison. This replaces the current two-side-by-side-canvas render block.
- **Idle:** the board renders immediately (slow ambient rotation, dice resting/floating), with the existing ✦ "Tap to cast" affordance over it.
- **Debug scenarios:** the board accepts optional `target?: AstralCast`; when a `DEBUG_SCENARIOS` astral cast is staged, the tumble plays then **snaps** the dice to the staged faces/sectors ("the stars align") so staged preconditions hold. Free physics otherwise.
- **Fallback:** if WebGL is unavailable or `prefers-reduced-motion` is set, skip the 3D scene and resolve a valid cast instantly (faces uniform, houses via `drawAstralCast`'s affinity bias, no/empty omens) so the game always works.

## Assets, docs, dependencies

- `src/assets/zodiac/{aries,taurus,…,pisces}.svg` — 12 files split from the cleared OpenClipart set, plus `src/assets/zodiac/SOURCE.md` noting CC0/OpenClipart provenance and the source URL.
- Update **README** (astral section) and **docs/game-systems.md** for the changed omen trigger (cocked-die veiled-oracle) and reduced clustering frequency, per CLAUDE.md's keep-in-sync rule.
- Add deps: `three`, `cannon-es`, `@types/three`.

## Testing

- **Engine/data tests unchanged:** the `onSettled` → `AstralCast` contract is identical, so existing Vitest suites (`AstralCast`, `AstralResponders`, `Astromancy`, etc.) remain valid and green. Run `npm test` and `npm run build` to confirm no regressions and a clean typecheck.
- **Pure helpers:** where practical, factor sector- and omen-detection into deterministic pure functions so they *could* be unit-tested; note Vitest only runs `src/engine/__tests__/**`, so any such tests would need an engine-side home or are covered by manual verification.
- **3D layer:** verified visually/manually (dev server) — roll variance across slices, idle board visibility, camera tween, omen triggers, debug snap, and fallback path.

## Risks / tradeoffs

- 3D physics settling has edge cases (cocked dice, jitter, rare jams) → mitigated by the time cap, cocked→veiled-oracle mapping, and a final snap-settle.
- Bundle grows (~three.js core) → acceptable for this game; tree-shaken.
- Sequential two-cast rolling is a behavior change from side-by-side, accepted for single-context performance and added drama; comparison preserved via result cards.

## Out of scope

- No changes to affinity math, responders, narrative assembly, or the engine event system.
- No raster-image pipeline beyond loading the cleared SVGs; no per-sign photographic art.
- No change to the other minigames (tarot, dice, I Ching).
