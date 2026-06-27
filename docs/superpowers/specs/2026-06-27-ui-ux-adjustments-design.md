# UI/UX Adjustments — Rune Band, Dice Minigame, Shrouded Card

**Date:** 2026-06-27
**Status:** Approved design, ready for implementation plan

Three presentation-layer adjustments to Atlas of Fate. All changes live in the
React / three.js component layer — **no `src/engine/` logic, no data tags, no
`docs/game-systems.md` changes**. The engine/React snapshot contract
(`notify()` → cloned snapshot) is untouched, and the Vitest engine suite is
unaffected (we still run `npm run build` + `npm test` to verify nothing
regresses).

---

## 1. Rune band is too long — `RunicBand.tsx`

### Problem
[`src/components/shared/RunicBand.tsx`](../../../src/components/shared/RunicBand.tsx)
emits `text.repeat(ceil(100 / text.length))` on a single
`whiteSpace: 'nowrap'` line with `overflow: 'hidden'`, so it stretches to the
full width of whatever centered parent it sits in (the wordmark, a heading, a
card). It reads as one long edge-to-edge strip rather than a contained
decorative flourish.

### Desired behavior
- The band wraps to the width of the element it decorates and flows **up to 3
  lines**, centered.
- It matches the adjacent element's width (inherits the centered parent's
  intrinsic width via `maxWidth: '100%'`), per the approved "match adjacent
  element" option.
- **Responsive vertical degradation:** when vertical space runs short (mobile /
  short viewports), the band sheds lines from the bottom first — degrading
  3 → 2 → 1 lines — rather than pushing other UI off-screen.

### Approach
- Add props: `lines` (default `3`) and keep `maxWidth` inheriting `'100%'`.
- Switch styles to wrap: `whiteSpace: 'normal'`, `wordBreak: 'break-all'`,
  `textAlign: 'center'`, `lineHeight ~1.4`.
- Clamp the rendered height to the line count using
  `display: '-webkit-box'`, `WebkitBoxOrient: 'vertical'`,
  `WebkitLineClamp: lines`, `overflow: 'hidden'`. This caps the band at 3 lines
  and lets fewer lines show naturally as the band wraps narrower.
- **Vertical-space degradation:** drive the effective clamp from viewport height
  so the cap drops on short screens. Use a CSS approach so it stays responsive
  without JS: a small responsive custom property / media queries that set the
  line clamp to 2 (and then 1) below height breakpoints (e.g. `max-height`
  around 700px → 2 lines, very short → 1). The clamp always hides the *extra*
  (lower) lines first because `-webkit-line-clamp` truncates from the bottom.
- Reduce the generated string so it fills at most ~3 lines of runes at the band
  width rather than a runaway 100-char repeat (compute a modest repeat count;
  exact length isn't load-bearing since the clamp hides overflow).
- The mirrored copy on `TitleScreen` (the `scaleX(-1)` wrapper around a second
  `RunicBand`) continues to work unchanged — it just clamps the same way.

### Touch points
- `src/components/shared/RunicBand.tsx` (primary).
- No call-site changes required, though `TitleScreen.tsx`'s local
  `runicBandStyle` (the mirrored wrapper) should be sanity-checked so its
  `wordBreak`/`lineHeight` don't fight the new clamp.

---

## 2. Dice minigame visuals — `dice3d/scene.ts`, `DiceCast.tsx`, `DiceTally.tsx`, `DiceMinigame.tsx`

Four sub-problems: dice fall off the board, dice too small, the board itself
looks bad, and the dramatic "value → tally → DC face-off → outcome" animation is
missing.

### 2a. Remove the board, keep containment (invisible walls + soft contact shadow)
- Delete the visual `disc` mesh (`CircleGeometry`) and the gold `rim`
  (`TorusGeometry`) from
  [`scene.ts`](../../../src/components/screens/dice3d/scene.ts).
- **Keep** the 24-plane circular collision wall but make it purely physical
  (invisible) so dice can never fly off-screen.
- **Tighten containment / fix "fall off":**
  - Clamp the flick velocity and `power` in `DiceCast.tsx`'s pointer-up handler
    (and/or in `scene.throwDie`) so a hard flick can't launch a die past the
    wall ring or cause tunneling through the thin planes in one `fixedStep`.
  - Optionally reduce `WALL_RADIUS` slightly and/or keep restitution modest so
    dice settle within frame.
- Add a **soft contact shadow** so dice read as resting on a surface without a
  visible board: a shadow-only ground plane (`THREE.ShadowMaterial`, low
  opacity) under the dice, or a cheap blurred dark radial sprite that follows
  each die. The surface itself stays invisible (transparent canvas / app
  background shows through).

### 2b. Bigger dice
- Increase `DIE_R` (d20) and `D4_R` (d4) proportionally, and/or pull the camera
  in (`CAM_TILT` / `CAM_TOP` and FOV) so a settled d20 face is large and clearly
  legible. Keep the throw spawn heights / scatter tuned so larger dice still
  settle cleanly inside the (now invisible) wall ring.

### 2c. Tally drama — the missing animation
Sequence after the d20 resolves (camera is already easing to top-down
`CAM_TOP`, so the kept die rests near board center → canvas center):

1. **Value → tally.** A glowing **ghost number** lifts off the settled d20 and
   arcs up into the tally counter; the counter ticks to the d20 value.
2. **Modifiers fling in.** Each Bless (`+`, gold) and Bane (`−`, crimson) d4
   flings its number into the counter, adjusting the running total one step at a
   time. This reuses the existing `buildSteps()` ordering in
   [`DiceTally.tsx`](../../../src/components/screens/dice3d/DiceTally.tsx)
   (d20 → bless… → bane…).
3. **DC face-off + verdict.** The final total and `DC <n>` slide side by side,
   hold a beat, then flash **green/red** with a `SUCCESS` / `FAILURE` verdict
   (or `TRIUMPH` / `FUMBLE` on a crit, using the existing `breakdown.critical`).
4. **Reading.** The interpretation text fades in (existing `reading` phase /
   `REVEAL_DELAY_MS`), then auto-commit or the reroll prompt as today.

Implementation:
- The flying ghost-number overlay is a **framer-motion layer in
  `DiceMinigame.tsx`**, launched from canvas-center coordinates. No
  WebGL→screen projection is needed because the kept die settles at board center
  under the top-down camera; modifier d4 ghosts can launch from approximate
  side positions. This keeps three.js out of the DOM-animation concern.
- Extend `DiceTally.tsx` to render the **DC face-off + verdict** beat (total and
  DC side by side, held pause, green/red verdict label) in addition to its
  current running-total counter. The `veiled` branch (`DC ?`) is preserved.
- Timing stays driven by `DiceTally`'s existing stepped `setTimeout` schedule
  and `onDone()` so `DiceMinigame`'s phase flow (`tally` → `reading` → commit)
  is unchanged.
- **Fallback path:** the 2D `DiceThrowAnimation` (non-WebGL) keeps its current
  simpler reveal. The upgraded `DiceTally` verdict beat applies to both paths
  (it already renders for `use3D` and fallback alike); the ghost-number overlay
  is gated to the 3D path.

### Touch points
- `src/components/screens/dice3d/scene.ts` — remove disc/rim, invisible walls,
  contact shadow, bigger dice, velocity clamp/tuning.
- `src/components/screens/dice3d/DiceCast.tsx` — clamp flick power; possibly
  expose canvas size for ghost launch coords; camera/size tweaks if needed.
- `src/components/screens/dice3d/DiceTally.tsx` — DC face-off + verdict beat.
- `src/components/screens/DiceMinigame.tsx` — ghost-number overlay layer.

### Risks / notes
- Larger dice + tighter walls need retuning so throws still look natural and
  always settle in view; verify across the affinity-driven `castTuning` extremes
  (order pulls toward center, chaos toward extremes).
- `canUse3D()` gating and `prefers-reduced-motion` handling preserved; under
  reduced motion the ghost arc should be skipped/instant (mirror the strings
  minigame's `reduce` collapse).

---

## 3. Shrouded card fog — `MethodCard.tsx` (+ shared fog params), `MethodSelect.tsx`

### Problem
[`MethodCard.tsx`](../../../src/components/cards/MethodCard.tsx)'s
`ShroudedFront` renders three blurred `<ellipse>`s (the "few black circles").
On selection, the reveal is an **instant swap** from the `shrouded` visual to
`face-up` (`MethodSelect.tsx` flips `revealShrouded`, and `visualFor()` returns
`'face-up'`), so the veil pops away rather than dispersing.

### Desired behavior
- The shroud uses a **`feTurbulence` fractal-noise cloud** like the strings
  minigame fog (drifting, soft), tinted to the shroud's violet palette, with the
  existing veiled eye + `VEILED` label on top.
- On select, the fog **slowly disperses** (~0.6s fade + scale/blur out)
  revealing the real `MethodCardFront` beneath, instead of an instant swap.

### Approach
- **Fog cloud:** replace the three ellipses in `ShroudedFront` with an SVG
  `feTurbulence` (`type="fractalNoise"`) + `feColorMatrix` filter, mirroring the
  strings approach in
  [`weave/fog.ts`](../../../src/components/screens/weave/fog.ts) /
  `StringsMinigame.tsx` (the `*-cloud` filter), but recolored to the violet
  shroud tones (`#1c1230` / `#2a1d40` family) so it matches the card, not the
  crimson weave. Keep the slow drift animation (framer-motion `animate` x/y
  loop, as `ShroudedFront` already does for its mist `<g>`). Consider extracting
  the shared turbulence params into a tiny constant (e.g. alongside the existing
  `FOG_CLOUD`) if it avoids duplication, but a card-local filter is acceptable
  since the tint differs.
- **Slow dispersal on reveal:** restructure the reveal so the real
  `MethodCardFront` and the fog **coexist** during the transition rather than
  swapping. Options (to settle during planning):
  - Render `MethodCardFront` underneath and overlay the fog as an
    `AnimatePresence` layer that animates `exit` (opacity → 0, scale up slightly,
    blur increase) over ~0.6s when reveal begins; **or**
  - Add a `revealing` visual state so `MethodCard` shows the front with a fading
    fog overlay on top.
- **Drive timing from existing state:** `MethodSelect.tsx` already sets
  `revealShrouded` and budgets a ~650ms reveal window before
  `confirmSelection()` (`pending.shrouded` branch). Hook the fog dispersal to
  that flag/window so no new engine timing is needed. `visualFor()` gains a
  `revealing`/coexist path instead of the hard `shrouded → face-up` flip.
- Preserve `prefers-reduced-motion`: collapse the dispersal to a quick fade.

### Touch points
- `src/components/cards/MethodCard.tsx` — `ShroudedFront` fog cloud + reveal
  layering / new visual state.
- `src/components/screens/MethodSelect.tsx` — `visualFor()` reveal path wired to
  `revealShrouded`.
- (Optional) a shared turbulence constant near `weave/fog.ts` if it cleanly
  avoids duplication.

---

## Out of scope
- No engine, data, reducer, responder, or affinity changes.
- No new gameplay behavior — purely visual/animation.
- No changes to `docs/game-systems.md` or README rule tables (those cover game
  systems, not presentation).

## Verification
- `npm run build` (tsc strict typecheck + bundle) passes.
- `npm test` (engine suite) passes — should be unaffected.
- Manual: title screen rune band wraps ≤3 lines and degrades on short/mobile
  viewports; dice never leave frame, read large, and play the
  value→tally→DC→verdict sequence; a shrouded method card shows a fractal fog
  that disperses slowly on pick. The `?debug` JsonInjector + `engine.loadState`
  flow (see memory: repro-game-state-injection) can stage a shrouded draw and a
  dice reading for inspection.
