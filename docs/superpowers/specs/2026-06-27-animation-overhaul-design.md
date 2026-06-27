# Affinity & Meta-Interaction Animation Overhaul — Design

**Date:** 2026-06-27
**Status:** Approved design, ready for implementation planning

## Problem

Atlas of Fate has two animation paradigms that are night-and-day in quality:

- **Polished, screen-integrated** — the Fate-force-method sequence ([MethodSelect.tsx](../../../src/components/screens/MethodSelect.tsx) + [FateForceOverlay.tsx](../../../src/components/overlays/FateForceOverlay.tsx)). The effect plays *on the actual cards in the actual screen*: the board freezes, a hand descends onto the real card the player picked (located via `getBoundingClientRect`), presses it down, it greys out, and the fated card ascends. Widen / thin / shroud get the same bespoke treatment here. It feels intentional because the real game objects respond.
- **Lacklustre, screen-divorced** — the [InteractionSequencer](../../../src/components/overlays/InteractionSequencer.tsx) + the [InteractionAnimations/](../../../src/components/overlays/InteractionAnimations/) folder. These dim the whole screen and play an **abstract centered overlay** disconnected from the cards. `ShroudAnimation` drops a generic dark rectangle in screen-center; `WidenAnimation` fades a generic green card in the middle of nowhere. `amplify` and `anchor` are not even in the render switch — `suit-accord`, `elemental-clash`, `spread-aligned`, `order-anchor` produce **no animation at all**, just a banner.

The same logical effect (e.g. shroud) therefore looks great in MethodSelect and barely-there everywhere else, because the sequencer version cannot point at the real card.

### Root cause

The "obvious to the user" goal is structurally blocked by the centered-overlay approach. An animation that plays in screen-center, divorced from the card that actually changed, can never read as intentional — it reads as a bug or a screensaver. The targeting data already exists (`EffectReport.sourceSlot` / `targetSlot`, and the [ConstellationFan](../../../src/components/overlays/ConstellationFan.tsx) already auto-expands, scrolls to, and *glows* the right card during the focus beat) — the animation simply ignores it and plays centered.

## Goals (priority order, from the request)

1. **Obvious** — make it unmistakable *what happened*. A card appears, disappears, is hidden, or another choice is taken — and the player sees it happen to the real card on the real screen, never as an ambient centered effect.
2. **Thematic** — each affinity has a fixed visual vocabulary matching its vibe (Light glows, Shadow casts shadows, etc.). Meta-interactions theme off the **triggering card** (its element/suit).
3. **Flashy** — it should feel like playing a game, not watching a presentation.

## Decisions made during brainstorming

- **Direction:** build slot-anchoring infrastructure — generalize the FateForceOverlay approach so any effect can play on the real card on any screen. (Not: flashier centered overlays; not: a hybrid.)
- **Substrate:** keep framer-motion for choreography and add **one** lightweight shared `<canvas>` particle layer for dense bursts. No WebGL / no new heavy dependency.
- **Scope/rollout:** this document designs the **full system** (infra + theming bible + primitive library + per-effect mapping); implementation proves it on **3 showcase effects first**, then a playtest-and-tune gate, then rolls out the rest in batches by primitive.

## Non-goals

- No rewrite of the engine layer (`src/engine/**`). Responders already emit `EffectReport`s with the targeting data we need; the overhaul is presentation-only. The one allowed engine-adjacent change is enriching `EffectReport` with optional theming/primitive hints (see Data contract) if the renderer cannot derive them from existing fields.
- No change to *which* effects fire or their probabilities.
- No new third-party rendering dependency (PixiJS / shaders explicitly rejected as overkill).
- The bespoke MethodSelect / FateForceOverlay sequence stays as-is for now. It is the gold-standard reference; folding it onto the shared infra is optional future cleanup, not part of this work.

---

## Architecture: three new primitives

### 1. `AnchorRegistry` (React context, mounted at GameTable level)

Solves "where is the target" uniformly. Screens register their affectable targets by a stable key; the sequencer and animations resolve a live `DOMRect` on demand.

- **Keys:**
  - `outcome` — the freshly-committed result card(s) on the active minigame screen.
  - `constellation:<i>` — the fan card at committed-results (turnResults) index `i`.
  - `method:<i>` — a MethodSelect card (reserved; MethodSelect keeps its bespoke sequence for now but may register so future effects can target it).
- **API:**
  - `useAnchor(key: string)` → a `ref` callback the target DOM node attaches to. Registering the same key twice (e.g. transient remounts) keeps the latest node.
  - `resolveAnchor(key: string)` → live `DOMRect | null`, measured via `getBoundingClientRect()` at call time. `null` when the key is unregistered/unmounted.
- **Graceful fallback:** if an anchor resolves to `null`, the animation plays centered (today's behavior) instead of crashing. This guarantees the refactor can never regress to a blank screen, and lets effects be migrated incrementally.
- **Coordinate space:** rects are viewport-space (`getBoundingClientRect`); the portal overlay and ParticleField are both fixed/viewport-anchored so no coordinate translation is needed. (Matches how FateForceOverlay already positions the hand with `left`/`top` from a `getBoundingClientRect`.)

The ConstellationFan focus mechanism stays and is *reused*: when a report has a hand target the fan still auto-expands and scrolls that card to the front during the focus beat. The new registry then lets the animation resolve that now-visible card's rect and play on it, instead of playing centered while the fan merely glows.

### 2. `ParticleField` (one shared `<canvas>`) — the substrate upgrade

A single full-screen canvas, `pointer-events: none`, mounted high in the tree (sibling of the sequencer), driven by **one** `requestAnimationFrame` loop.

- **Imperative API:** `emit(spec)` where `spec` describes a burst:
  - `origin: DOMRect` (or point) — where particles spawn.
  - `count` — number of particles.
  - `palette` — array of colors (from the theme).
  - `model` — motion model: `radial` | `rising` | `falling` | `swirl` | `implode` | `shard`.
  - `gravity`, `lifetimeMs`, `spread`, `size`, `blend` (`'lighter'` for glows, `'source-over'` for smoke).
- **One rAF loop** updates and draws all live particles across all concurrent bursts; particles self-expire. The canvas is invisible/no-op when no particles are live.
- **Why:** DOM caps practical particle counts (today's `RerollAnimation` fakes a burst with 16 divs). Canvas does hundreds cheaply with GPU compositing — the difference between "a few dots" and embers/shards/smoke/motes that read as *flashy*.
- **Access:** exposed via a small context/singleton hook (`useParticles()` → `{ emit }`) so any animation component can fire a burst at a resolved rect.

### 3. Anchored-animation convention — refactor the sequencer

[InteractionSequencer](../../../src/components/overlays/InteractionSequencer.tsx) stops rendering centered overlays. Per report it now:

1. Resolves the target anchor(s) → rect(s) via `resolveAnchor`. (Primitive + theme are derived per the Data contract below.)
2. Renders the primitive component into a **portal positioned over the real card** (a small overlay box at the rect), not screen-center.
3. Fires `ParticleField.emit` at that rect with the theme palette/model.
4. Publishes an **affect signal** the real card reads to react itself — dim / lift / desaturate / flip / veil — via the existing [InteractionFocusContext](../../../src/context/InteractionFocusContext.tsx) channel that [FanCard](../../../src/components/cards/FanCard.tsx) already consumes for its glow. FanCard (and the outcome card components) gain a small `affect` switch, the generalization of MethodSelect's `motionFor`/`visualFor`.

The dimming veil, info banner, progress dots, and tap-to-skip stay. The `DURATION` table and the focus-beat timing (`FOCUS_BEAT`, `runOrDefer` deferral, `finishEventBatch`) stay — only *what is drawn* changes. The banner may be repositioned near the affected card (stretch) but defaults to its current top placement.

---

## Theming bible

### Affinities (fixed vocabulary)

Palette source: [EventBanner.tsx](../../../src/components/overlays/EventBanner.tsx) `AFFINITY_COLOR`.

| Affinity | Palette | Particle model / motion signature | Card reaction |
|---|---|---|---|
| **Will** `#5b8c5a` | + `#8fd49a` | `rising` life-motes; an upward surge; new paths grow in along a sprouting line | lifts, green underglow swells |
| **Fate** `#d4a854` | + `#f0d890` | golden filament threads pull taut; the hand/weave; cards tugged by invisible strings | a thread snaps on and tugs it (reuses Strings/Fate-force language) |
| **Shadow** `#9b6bb0` | + `#1a0f2e` | `falling` ink-smoke wisps (`source-over` blend); a veil falls; shadow creeps from edges | desaturates, dims, violet rim |
| **Light** `#e6d8a8` | + warm white | `radial` god-rays + bloom; rising light-sparks (`lighter` blend) | brightens, white-gold halo, scale pulse |
| **Chaos** `#c75b4a` | + `#ff7a4a` | `shard` fracture cracks + embers fly out; jitter; reality tears | shakes, chromatic-splits, cracks, spawns a duplicate |
| **Order** `#5b7ec7` | + `#aac4ff` | angular glints; a lattice/grid snaps into place; crisp upright lock | snaps upright, edges sharpen, blue geometric frame locks on |

### Meta-interactions (themed off the triggering card)

When a report has a `sourceSlot`, derive palette + particle model from that card's **element** (already on every card via `element-*` tags; suits map fire/water/air/earth per [tarot.ts](../../../src/data/tarot.ts)):

| Element (suit) | Palette | Particle |
|---|---|---|
| Fire (Wands) | `#c75b4a` / `#ff9a4a` | rising embers, licking flame |
| Water (Cups) | `#4a8cc7` / `#7ac4e6` | ripples, droplets, fluid wash |
| Air (Swords) | `#c8d8f0` / silver | swift slicing gusts |
| Earth (Pentacles) | `#8a9a5b` / `#c7b06b` | falling stone-dust, weight |

The **choreography** (the primitive) is shared; only the **skin** (palette + particle model) comes from the source. A meta-interaction with no source card (pure dimension shifts like `amplify`) falls back to neutral **fate-gold**.

---

## Primitive library (the "verbs")

Every effect composes from ~10 reusable choreography primitives. Each is a component taking `(anchorRect, theme, ...effectData)` and playing a self-contained animation (framer-motion choreography + ParticleField bursts + an affect signal to the real card). This is what makes the rollout tractable: ~10 primitives × theme skins cover all ~20 effects, and also fills the current gaps where `amplify`/`anchor` render nothing.

| Primitive | What it does | Effects that use it |
|---|---|---|
| **Glow** | themed aura + particles, no structural change | light-advantage, order-anchor, spread-aligned |
| **Flip** | card rotates Y, reveals changed face | critical-resonance, chaos-wild-card, spread-cascade, fate-auto-orient |
| **Spawn** | a new card materializes into a slot | chaos-second-result, will-widen-pool, major-convergence, iching-happening-boost |
| **Dissolve** | card disintegrates into particles, gone | fate-thin-pool |
| **Veil** | card covered / desaturated / hidden | shadow-shroud, shadow-veil-position, fate-fated-card |
| **Reroll** | card scatters and reforms as a new value | fool-reroll, fate-hollow-reroll |
| **Override** | one card rejected, another takes its place | fate-force-method, fate-deal-swap |
| **Mirror** | two cards turn in sympathy, a reflection arc between them | mirror, iching-resonant-change |
| **Amplify** | nature deepens; particles implode inward, value intensifies | suit-accord, elemental-clash |
| **Interrupt** | reality tears, a happening intrudes | chaos-happening-interrupt |

The legacy animation strings on existing `EffectReport`s (`reroll`, `flip`, `mirror`, `widen`, `thin`, `shroud`, `override`, `second-result`, `interrupt`, `add-choice`, `amplify`, `anchor`) map onto these primitives; the renderer translates the string + report fields into `(primitive, theme, anchorKey)`.

### Data contract

The renderer derives, per report:

- **primitive** — from `report.animation` (string → primitive map above).
- **theme** — affinity reports: from `report.label` (already the affinity name) → affinity vocabulary. Meta-interaction reports with a `sourceSlot`: from the source card's element. Otherwise: fate-gold.
- **anchorKey** — from `report.targetSlot` / `report.sourceSlot`: a constellation index → `constellation:<i>`; an effect on the freshly-committed result → `outcome`. The mapping of which reports target `outcome` vs `constellation` is enumerated in the per-effect catalogue during planning.

If any of these cannot be derived cleanly from existing fields for a given effect, add an **optional** hint field to `EffectReport` (e.g. `anchorKey?`, `theme?`) set in the responder — preferred over brittle inference. This is the only sanctioned engine-layer touch and must keep `docs/game-systems.md` in sync per CLAUDE.md.

---

## Vertical slice (Phase 0)

Build the three infra primitives + **three showcase effects** spanning all three target classes, three choreography primitives, and all three goals:

1. **chaos-second-result** → **Spawn** on `outcome`, chaos theme. The committed result fractures and a duplicate card splits off in a burst of embers/shards. *(Outcome anchoring · flashiest · "a card appeared.")*
2. **fool-reroll** → **Reroll**, themed off The Fool (source-card element). The Fool's card in the fan throws its element-colored motes; the dice outcome scatters and recasts to a new value. *(Fan/constellation anchoring · source-card theming · "the value changed.")*
3. **shadow-shroud** → **Veil** on a `constellation` card, shadow theme. Violet ink-smoke descends; the real fan card desaturates and a veil falls over it. *(Pure affinity vibe — literal shadows · "that card is hidden now.")*

**Playtest gate:** the user plays the three in-game (via the debug `DEBUG_SCENARIOS` forced-effect path — see [scenarios.ts](../../../src/engine/events/scenarios.ts) and the `forced`/`isolate` debug config) and tunes timing/intensity before any further effects are built.

## Phasing

- **Phase 0** — AnchorRegistry, ParticleField, sequencer refactor, the three showcase primitives (Spawn, Reroll, Veil) + the three effects above + their `DEBUG_SCENARIOS` entries. → **playtest & tune gate.**
- **Phase 1+** — roll out the remaining effects grouped by primitive, each a small reviewable increment:
  - **Flip batch:** critical-resonance, chaos-wild-card, spread-cascade, fate-auto-orient.
  - **Spawn batch:** will-widen-pool, major-convergence, iching-happening-boost.
  - **Veil batch:** shadow-veil-position, fate-fated-card.
  - **Glow batch:** light-advantage, order-anchor, spread-aligned (fills the silent `anchor`/`amplify` gaps).
  - **Override batch:** fate-deal-swap (+ optionally migrate fate-force-method onto the shared infra).
  - **Mirror batch:** mirror, iching-resonant-change.
  - **Amplify batch:** suit-accord, elemental-clash.
  - **Dissolve / Interrupt:** fate-thin-pool, fate-hollow-reroll, chaos-happening-interrupt.

Each batch reuses the proven primitive + theme bible, so later phases are mostly data/skinning, not new infra.

## Testing

Per CLAUDE.md, Vitest covers `src/engine/__tests__/**` only — there are no component/animation tests, and animation feel is validated by playtest, not assertions. Engine-side, the only risk is the optional `EffectReport` hint fields: if added, existing dispatch tests ([EngineDispatch.test.ts](../../../src/engine/__tests__/EngineDispatch.test.ts), [GameEngine.test.ts](../../../src/engine/__tests__/GameEngine.test.ts)) must still pass, and `docs/game-systems.md` updated. `npm run build` (tsc strict) must stay green throughout. Manual verification is via the debug panel's forced-effect scenarios.

## Risks & mitigations

- **Anchor not present when the effect fires.** Mitigated by the `null` → centered fallback; effects only migrate to anchoring once their target is confirmed on-screen at play time (the ConstellationFan focus beat already guarantees hand cards are visible for hand-targeted reports).
- **Timing drift between the structural change (resolved at commit) and the narration.** Unchanged — the existing `runOrDefer` / `finishEventBatch` deferral and the `DURATION` table still govern pacing; we only swap the drawn content.
- **Particle performance on low-end/mobile.** One shared rAF loop + canvas, capped particle counts per burst, blend-mode batching; tune counts at the playtest gate.
- **Scope creep across 20 effects on an unproven feel.** Mitigated by the Phase 0 playtest gate before any batch rollout.
