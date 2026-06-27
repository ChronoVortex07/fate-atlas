# Animation Overhaul — Phase 1 (Remaining Effect Batches) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining ~16 affinity/meta-interaction effects from the legacy centered overlays to the anchored, themed, flashy primitive system proven in Phase 0 — so every effect plays on the real card on the real screen.

**Architecture:** The Phase 0 infrastructure is built and proven (see "What already exists"). Each remaining effect maps to one of 7 new "verb" primitives (Flip, Glow, Mirror, Amplify, Override, Interrupt) or reuses an existing one (Spawn, Reroll, Veil). A primitive is an `AnchoredStage`-based component; wiring it = add it to the sequencer's `ANCHORED` map + theme's `MIGRATED_SET`, patch the engine to tag commit-triggered reports with the committed fan-slot index, and verify with a headless Playwright probe.

**Tech Stack:** React 18, TypeScript (strict), Vite, framer-motion, HTML Canvas 2D. No new dependencies.

## Global Constraints

- **Engine purity:** no React/DOM imports in `src/engine/**`. Engine edits here are limited to tagging existing `EffectReport`s with `targetSlot` (an animation anchor hint) inside `completeMinigame` — do **not** change effect logic, probabilities, or which effects fire.
- **No new dependencies.** Canvas 2D only.
- **Typecheck + tests are the gate:** `npx tsc -b` clean and `npm test` (518 tests) green after every task. There is no component-test harness — visual tasks are verified by `npm run build` + a headless Playwright probe (recipe below), not assertions.
- **Affinity palette is canonical** in [theme.ts](../../../src/components/overlays/anim/theme.ts) (already populated from `EventBanner`'s `AFFINITY_COLOR` + the design bible). Reuse it; do not hardcode hexes in primitives beyond pulling from the passed `theme.palette`.
- **Graceful fallback:** an unresolved anchor (`null` rect) centers the animation via `AnchoredStage`'s `fallbackRect` — never crash/blank.
- **Do NOT touch** the inline, already-polished animations: MethodSelect's draw effects (`will-widen-pool`, `fate-thin-pool`, `shadow-shroud` — pulled off `eventQueue` in `buildPool`, narrated by [MethodSelect.tsx](../../../src/components/screens/MethodSelect.tsx)) and `fate-force-method` ([FateForceOverlay.tsx](../../../src/components/overlays/FateForceOverlay.tsx)). These never reach the sequencer.
- **Commit after every task** with the message in its final step.

---

## What already exists (Phase 0 — do not rebuild)

- **`AnchorRegistry`** ([src/context/AnchorRegistry.tsx](../../../src/context/AnchorRegistry.tsx)): `useAnchorRegister(key)`, `useAnchorResolver().resolve(key)`, keys `outcomeKey` and `constellationKey(i)`. Registered today: `outcome` on [DiceMinigame.tsx](../../../src/components/screens/DiceMinigame.tsx) (dice-visual wrapper) and [TarotMinigame.tsx](../../../src/components/screens/TarotMinigame.tsx) (committed-spread row); `constellation:<index>` on every [FanCard.tsx](../../../src/components/cards/FanCard.tsx).
- **`ParticleField`** ([src/components/overlays/ParticleField.tsx](../../../src/components/overlays/ParticleField.tsx)): one shared canvas; `emitBurst(spec)` via `useParticles()`. `BurstSpec` = `{ origin, count, palette, model, gravity?, lifetimeMs?, spread?, size?, blend? }`; `ParticleModel` = `radial|rising|falling|swirl|implode|shard`.
- **`theme.ts`** ([src/components/overlays/anim/theme.ts](../../../src/components/overlays/anim/theme.ts)): `Primitive` union; `primitiveFor(animation)`; `themeFor(report, turnResults)` (affinity by `report.label`, else source-card element, else fate-gold); `anchorKeyFor(report)` (`targetSlot`→constellation, else outcome); `MIGRATED_SET` + `isMigrated(p)`; `expandSlotFor(report)` (migrated→`targetSlot` or null; legacy→`sourceSlot`).
- **`AnchoredStage`** ([src/components/overlays/anim/AnchoredStage.tsx](../../../src/components/overlays/anim/AnchoredStage.tsx)): `PrimitiveProps = { rect, theme, durationMs }`; portals a fixed box over the rect (or centered fallback) and fires one `emit` burst on mount.
- **Primitives built:** `SpawnPrimitive`, `RerollPrimitive`, `VeilPrimitive` in [src/components/overlays/anim/primitives/](../../../src/components/overlays/anim/primitives/).
- **Sequencer** ([src/components/overlays/InteractionSequencer.tsx](../../../src/components/overlays/InteractionSequencer.tsx)): `ANCHORED: Partial<Record<Primitive, React.FC<PrimitiveProps>>>` currently `{ spawn, reroll, veil }`. Migrated primitives render anchored; everything else falls through to the legacy centered `InteractionAnimations/*`. Focus beat runs when `expandSlotFor(report) !== null`.
- **FanCard affect props:** `glowing`, `dimmed` (veil → grayscale), `appearing` (`'pending'`→held invisible, `'materializing'`→springs in). Spawn's empty-slot→materialize is driven from [ConstellationFan.tsx](../../../src/components/overlays/ConstellationFan.tsx) (`spawningSlot`/`appearingState`).
- **Engine anchor patches** in `completeMinigame` ([src/engine/GameEngine.ts](../../../src/engine/GameEngine.ts) ~line 393): `chaos-second-result`→`targetSlot=newIndex`; `fool-reroll`→`targetSlot=committedIndex`; `shadow-veil-position`→`targetSlot=committedIndex`.
- **Done & approved effects:** chaos-second-result (Spawn), fool-reroll (Reroll), shadow-veil-position (Veil).
- **Debug hook:** under `?debug`, `window.__engine` is the live `GameEngine` (set in [EngineContext.tsx](../../../src/context/EngineContext.tsx)) — used by the verification recipe.

### The venue model (critical — determines each effect's anchor)

An effect's report is queued by `dispatchAt`. **Where** it should anchor depends on **when** it fires:

- **Commit-triggered** (`dice|tarot|iching|strings:commit`, dispatched inside `completeMinigame` *after* the result is appended to `turnResults` at `committedIndex`): the result is a fan card. Anchor to the committed fan card by patching the report's `targetSlot = committedIndex` in `completeMinigame` (the established pattern). The fan auto-expands to it. **All Phase 0 effects + the Flip/Amplify/Glow/Mirror commit effects use this.**
- **Spread-internal** (combine channel `spread`, also at `tarot:commit`): same — patch `targetSlot = committedIndex`.
- **Mid-game** (`tarot:orient`, `tarot:deal`, `tarot:picked`, `dice:roll`, `dice:reroll`): fire *before* the result is committed; the result lives on the minigame screen, not the fan. These are returned to and often consumed inline by the minigame component (e.g. `planDiceRoll`/`resolveSpreadOrientation` return `reports`; the report is also left on `eventQueue`). **Venue is uncertain per effect — each has a "verify venue" step.** Likely anchor: `outcome`. Some may be inline-only (no sequencer play) and need no primitive.

---

## Verification recipe (use in every visual task)

1. **Build:** `npx tsc -b` (clean) then `npm test` (518 pass) if the engine was touched.
2. **Headless probe** — create a throwaway `_probe.mjs` in the repo root (so `playwright` resolves), run `npm run dev` (note the port, base path is `/fate-atlas/`), then:

```js
import { chromium } from 'playwright';
const URL = 'http://localhost:5173/fate-atlas/?debug';   // adjust port
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__engine, null, { timeout: 10000 });
// Stage a screen with a fan card, then inject the report directly into eventQueue.
await p.evaluate(() => window.__engine.loadScenarioById('major-convergence')); // gives turnResults=[3-card tarot spread]
await p.waitForTimeout(700);
await p.evaluate(() => window.__engine.loadState({ eventQueue: [
  { responderId: 'critical-resonance', label: 'Critical Resonance', description: 'it inverts', animation: 'flip', targetSlot: 0 }
]}));
await p.waitForTimeout(1300);
await p.screenshot({ path: 'probe.png' });
await b.close();
```

3. **Read `probe.png`** to confirm the effect plays on the real card (not screen-center) and reads as intended. Delete `_probe.mjs` + `probe.png` before committing.

> Injecting a report with `targetSlot` bypasses the engine patch, letting you verify the primitive + anchoring in isolation. For the real end-to-end path, also confirm the engine patch (Task 1) tags the report.

---

## Task 1: Engine anchor patches for all commit-triggered + spread effects

**Files:** Modify `src/engine/GameEngine.ts` (`completeMinigame`, near the existing patches ~line 405); Test: `src/engine/__tests__/` (existing must stay green).

**Interfaces:** Produces commit reports carrying `targetSlot = committedIndex` so they anchor to the committed fan card. Consumed by `anchorKeyFor`/`expandSlotFor` (unchanged).

- [ ] **Step 1:** After the existing `shadow-veil-position` patch, add a generalized patch that tags every committed-spread effect with `committedIndex`. Use an explicit id set so intent is clear:

```ts
// Commit/spread effects that act on the just-committed card → anchor to its fan
// slot so the fan expands and the animation plays on the real card.
const COMMIT_ANCHORED = new Set([
  'critical-resonance', 'spread-cascade', 'spread-aligned',
  'suit-accord', 'elemental-clash', 'major-convergence',
  'iching-resonant-change',
]);
this.state.eventQueue = this.state.eventQueue.map((r) =>
  COMMIT_ANCHORED.has(r.responderId) && typeof r.targetSlot !== 'number'
    ? { ...r, targetSlot: committedIndex } : r,
);
```

(Leave `mirror` alone — it already carries `targetSlot`/`sourceSlot` fan indices.)

- [ ] **Step 2:** `npx tsc -b` clean; `npm test` → 518 pass (no behavior change, only metadata).
- [ ] **Step 3:** Update `docs/game-systems.md` only if it documents animation anchoring for these effects (it documents behavior, not anchors — likely a no-op; confirm and note "no change needed" if so).
- [ ] **Step 4:** Commit `feat(anim): anchor commit-triggered effects to the committed fan card`.

---

## Task 2: Flip primitive (critical-resonance, spread-cascade)

**Files:** Create `src/components/overlays/anim/primitives/FlipPrimitive.tsx`; Modify `InteractionSequencer.tsx` (ANCHORED map), `theme.ts` (`MIGRATED_SET`).

**Interfaces:** Consumes `PrimitiveProps`, `AnchoredStage`. `primitiveFor('flip') === 'flip'` already maps. Produces `FlipPrimitive` default export.

- [ ] **Step 1:** Create `FlipPrimitive` — a card-shaped sheath over the real card doing a single 3D Y-flip (`rotateY 0→180`), a theme-edge light sweep, and a `radial` accent burst, settling to reveal the (now-changed) real card.

```tsx
import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

export default function FlipPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 40, model: 'radial', spread: 90 }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `1.5px solid ${accent}`,
          background: `linear-gradient(160deg, ${core}bb, ${core}33)`, boxShadow: `0 0 22px ${core}aa`,
          transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 0, opacity: 0 }}
        animate={{ rotateY: [0, 180], opacity: [0, 1, 1, 0] }}
        transition={{ duration: sec, ease: 'easeInOut', times: [0, 0.15, 0.85, 1] }}
      />
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6,
          background: `linear-gradient(105deg, transparent 40%, ${accent}cc 50%, transparent 60%)`, mixBlendMode: 'screen' }}
        initial={{ opacity: 0, x: '-40%' }} animate={{ opacity: [0, 1, 0], x: ['-40%', '40%'] }}
        transition={{ duration: sec * 0.5, ease: 'easeOut' }}
      />
    </AnchoredStage>
  );
}
```

- [ ] **Step 2:** In `theme.ts`, add `'flip'` to `MIGRATED_SET`. In `InteractionSequencer.tsx`, import `FlipPrimitive` and add `flip: FlipPrimitive` to `ANCHORED`.
- [ ] **Step 3:** `npx tsc -b`. Probe with `critical-resonance` (animation `flip`, `targetSlot:0`) and `spread-cascade` (animation `flip`) on `major-convergence`. Confirm the committed card flips in place.
- [ ] **Step 4:** Commit `feat(anim): flip primitive (critical-resonance, spread-cascade)`.

---

## Task 3: Glow primitive (spread-aligned, order-anchor + roll-mode group)

**Files:** Create `src/components/overlays/anim/primitives/GlowPrimitive.tsx`; Modify `InteractionSequencer.tsx`, `theme.ts`. Possibly `theme.ts` `PRIMITIVE_BY_ANIMATION` for `'roll-mode'`.

**Interfaces:** `primitiveFor('anchor') === 'glow'` already. `'roll-mode'` currently defaults to `'glow'` too. Produces `GlowPrimitive`.

- [ ] **Step 1:** Create `GlowPrimitive` — a themed aura that blooms over the card and fades, plus a gentle `theme.model` particle haze. No structural change. Order/`anchor` reads as a crisp lattice lock (square frame snapping in); Light reads as a radiant bloom. Use `theme.key` to branch the accent shape:

```tsx
import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

export default function GlowPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  const lattice = theme.key === 'order';
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 36, spread: 80 }}>
      <motion.div
        style={{ position: 'absolute', inset: '-12%', borderRadius: lattice ? 4 : '50%',
          background: `radial-gradient(circle, ${accent}88 0%, ${core}22 45%, transparent 70%)`,
          border: lattice ? `1.5px solid ${accent}` : 'none' }}
        initial={{ opacity: 0, scale: lattice ? 1.4 : 0.6 }}
        animate={{ opacity: [0, 0.9, 0], scale: lattice ? [1.4, 1, 1] : [0.6, 1.2, 1.4] }}
        transition={{ duration: sec, ease: 'easeOut', times: [0, lattice ? 0.4 : 0.5, 1] }}
      />
    </AnchoredStage>
  );
}
```

- [ ] **Step 2:** Add `'glow'` to `MIGRATED_SET`; add `glow: GlowPrimitive` to `ANCHORED`. (This activates the currently-silent `anchor`/`amplify`-default effects via the glow default.)
- [ ] **Step 3 — venue check (roll-mode):** Probe whether the `roll-mode` report (label "The Cast", animation `roll-mode`, fired at `dice:roll`) actually reaches the sequencer during a dice throw, or is consumed inline by [DiceMinigame.tsx](../../../src/components/screens/DiceMinigame.tsx) (`planDiceRoll` returns `reports`). Drive: `loadScenarioById('light-advantage')`, play the dice (or inject a `roll-mode` report while on the dice screen) and observe. **If it reaches the sequencer:** it has no slots → anchors to `outcome` (dice screen); confirm the glow plays on the die and is not disruptive mid-throw. **If inline-only:** leave it (DiceMinigame already shows the mode label) and do not migrate. Record the finding in the commit message.
- [ ] **Step 4:** Probe `order-anchor` and `spread-aligned` (animation `anchor`, `targetSlot:0`) on `major-convergence`. Confirm the lattice/bloom plays on the committed card (these render nothing today — this is the fix).
- [ ] **Step 5:** Commit `feat(anim): glow primitive (order-anchor, spread-aligned, roll-mode)`.

---

## Task 4: Amplify primitive (suit-accord, elemental-clash)

**Files:** Create `AmplifyPrimitive.tsx`; Modify `InteractionSequencer.tsx`, `theme.ts`.

**Interfaces:** `primitiveFor('amplify') === 'amplify'` already. Produces `AmplifyPrimitive`.

- [ ] **Step 1:** Create `AmplifyPrimitive` — particles `implode` inward to the card center, and a card-framed pulse that brightens then deepens (nature intensifies). `elemental-clash` themes off the source element via `themeFor`; `suit-accord` likewise.

```tsx
import { motion } from 'framer-motion';
import AnchoredStage, { type PrimitiveProps } from '../AnchoredStage';

export default function AmplifyPrimitive({ rect, theme, durationMs }: PrimitiveProps) {
  const [core, accent] = theme.palette;
  const sec = durationMs / 1000;
  return (
    <AnchoredStage rect={rect} theme={theme} burst={{ count: 60, model: 'implode', spread: 120 }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, border: `2px solid ${accent}`,
          boxShadow: `inset 0 0 24px ${core}aa, 0 0 26px ${core}88` }}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [1.1, 1.04, 1, 1] }}
        transition={{ duration: sec, ease: 'easeIn', times: [0, 0.55, 0.8, 1] }}
      />
    </AnchoredStage>
  );
}
```

- [ ] **Step 2:** Add `'amplify'` to `MIGRATED_SET`; `amplify: AmplifyPrimitive` to `ANCHORED`.
- [ ] **Step 3:** Probe `suit-accord` / `elemental-clash` (animation `amplify`, `targetSlot:0`) on `suit-accord` scenario. Confirm implode + pulse on the committed card (silent today — this is the fix).
- [ ] **Step 4:** Commit `feat(anim): amplify primitive (suit-accord, elemental-clash)`.

---

## Task 5: Mirror primitive (mirror, iching-resonant-change)

**Files:** Create `MirrorPrimitive.tsx`; Modify `InteractionSequencer.tsx`, `theme.ts`. **Special:** Mirror needs BOTH the target and source rects.

**Interfaces:** `primitiveFor('mirror') === 'mirror'`. The sequencer must pass the source rect too. Extend `PrimitiveProps` with an optional `sourceRect?: DOMRect | null`, resolved in the sequencer via `constellationKey(report.sourceSlot)` and passed only to `MirrorPrimitive`.

- [ ] **Step 1:** In `AnchoredStage.tsx`, add `sourceRect?: DOMRect | null` to `PrimitiveProps`. In `InteractionSequencer.tsx`'s `renderAnimation`, when `primitive === 'mirror'` and `report.sourceSlot` is a number, also `resolve(constellationKey(report.sourceSlot))` and pass as `sourceRect`.
- [ ] **Step 2:** Create `MirrorPrimitive` — both cards (target `rect`, source `sourceRect`) get a synchronized flip-pulse, and a reflection arc (an SVG line/gradient drawn in a full-viewport portal between the two rect centers) shimmers between them. If `sourceRect` is null, fall back to a single-card flip on `rect`. (Draw the arc via a second `createPortal` to body, fixed full-viewport SVG, `pointerEvents:none`.)
- [ ] **Step 3:** `iching-resonant-change` was tagged `targetSlot=committedIndex` in Task 1 and carries `sourceSlot`. `mirror` already carries both. Add `'mirror'` to `MIGRATED_SET`; `mirror: MirrorPrimitive` to `ANCHORED`.
- [ ] **Step 4:** Probe `mirror` on the `mirror` scenario (two reversibles) — confirm both fan cards react and the arc draws between them. Verify the focus beat expands the fan (it does, via `expandSlotFor` → `targetSlot`).
- [ ] **Step 5:** Commit `feat(anim): mirror primitive with reflection arc`.

---

## Task 6: Reuse Spawn / Reroll / Veil for their remaining effects

**Files:** Modify `src/engine/GameEngine.ts` (anchor patches for the mid-game/other reuse effects, where they reach the sequencer); verify only.

These animations already exist; this task wires their remaining effects + verifies venue.

- [ ] **Step 1 — major-convergence (Spawn):** spread-internal at `tarot:commit`; Task 1 tagged it `targetSlot=committedIndex`, animation `second-result`→`spawn`. But Spawn's materialize assumes the card is *newly added*. major-convergence does NOT add a card — it spotlights an existing committed card. **Decision:** for major-convergence, the Spawn materialize (empty→pop) would wrongly hide an existing card. Instead map it to a non-removing emphasis: either (a) reuse `GlowPrimitive` by giving its report animation `anchor`, or (b) add a `convergence` emphasis. Simplest: change major-convergence's report `animation` from `'second-result'` to `'amplify'` in [interactions.ts](../../../src/engine/responders/interactions.ts) so it reads as intensification, not a new card. Update `docs/game-systems.md` if it names the animation. Verify it does not blank the existing card.
- [ ] **Step 2 — iching-happening-boost (Spawn/add-choice):** fires at `happening:start`; venue is the happening screen, not a fan card. **Verify** whether it reaches the sequencer and whether a fan/outcome anchor exists on the happening screen. If no clean anchor, let it center (fallback) with the Spawn burst, or map to `GlowPrimitive`. Record finding.
- [ ] **Step 3 — fate-hollow-reroll (Reroll):** fires at `dice:reroll` (mid-game). **Verify venue** — likely `outcome` (dice screen) since it's pre-commit. Confirm the Reroll primitive plays on the die. No engine patch (no fan slot yet).
- [ ] **Step 4 — fate-fated-card (Veil):** fires at `tarot:picked` (drafting). **Verify venue** — the tarot screen. The card isn't committed; anchor `outcome` (tarot hand row) or let it center. Confirm the Veil reads.
- [ ] **Step 5:** Commit `fix(anim): wire remaining spawn/reroll/veil effects + venues`.

---

## Task 7: Override primitive (fate-deal-swap)

**Files:** Create `OverridePrimitive.tsx`; Modify `InteractionSequencer.tsx`, `theme.ts`.

**Interfaces:** `primitiveFor('override') === 'override'`. `fate-deal-swap` fires at `tarot:deal` (mid-game, pre-commit) — venue is the tarot screen.

- [ ] **Step 1:** Create `OverridePrimitive` — a card-framed sheath that greys/pushes (rejected card slides + desaturates) while a fresh fate-gold card sheath rises into its place. Two stacked motion layers over the `rect`.
- [ ] **Step 2:** Add `'override'` to `MIGRATED_SET`; `override: OverridePrimitive` to `ANCHORED`.
- [ ] **Step 3 — venue check:** `fate-deal-swap` is returned by `resolveTarotDeal` and consumed by TarotMinigame during the deal. **Verify** whether it also plays through the sequencer. If the deal screen has no registered anchor, register the dealt-card row as `outcome` in TarotMinigame's deal view, or accept the centered fallback. Probe `fate-deal-swap` scenario.
- [ ] **Step 4:** Commit `feat(anim): override primitive (fate-deal-swap)`.

---

## Task 8: Interrupt primitive (chaos-happening-interrupt) + orient effects

**Files:** Create `InterruptPrimitive.tsx`; Modify `InteractionSequencer.tsx`, `theme.ts`. Investigate `tarot:orient` effects.

- [ ] **Step 1:** Create `InterruptPrimitive` — screen-level (NOT card-anchored): a jagged chaos rift tears across the viewport (full-viewport portal), red `shard` particles spray, then it closes. Render via `createPortal` to body at full viewport; ignore `rect` (or use it as the rift origin). Add `'interrupt'` to `MIGRATED_SET`; `interrupt: InterruptPrimitive` to `ANCHORED`. Note: `anchorKeyFor` returns `outcome` (no slots) — fine, the primitive ignores the rect for the rift but can originate particles from it.
- [ ] **Step 2:** Probe `chaos-happening-interrupt` — confirm the rift reads as "something intrudes" before the happening screen appears.
- [ ] **Step 3 — orient effects (chaos-wild-card, fate-auto-orient):** fire at `tarot:orient` (pre-commit). `chaos-wild-card` animation `flip`, `fate-auto-orient` animation `override`. **Verify venue** — these are consumed by `resolveSpreadOrientation` during the tarot commit flow; determine if they reach the sequencer and whether the tarot `outcome` row is mounted/registered then. Wire to `outcome` or accept centered fallback. (order-anchor is also `tarot:orient` but handled in Task 3.) Probe each.
- [ ] **Step 4:** Commit `feat(anim): interrupt primitive + orient-effect venues`.

---

## Task 9: Remove dead legacy animations + final verification

**Files:** Delete unused `src/components/overlays/InteractionAnimations/*` once every animation string is migrated; Modify `InteractionSequencer.tsx` (drop the legacy `switch`/imports).

- [ ] **Step 1:** Confirm every `animation` string emitted by responders now maps to an entry in `ANCHORED` (grep responder files for `report(...,'<anim>')`). Any still falling through to legacy must be migrated or deliberately left.
- [ ] **Step 2:** Remove the legacy `renderAnimation` `switch` body and the `InteractionAnimations/*` imports; delete the now-unused files.
- [ ] **Step 3:** Remove the temporary `window.__engine` debug hook from `EngineContext.tsx` if not wanted long-term (it is `?debug`-gated; keep only if useful).
- [ ] **Step 4:** `npx tsc -b` clean; `npm test` green; `npm run build` succeeds. Full manual playtest of every `DEBUG_SCENARIOS` entry via `?debug`.
- [ ] **Step 5:** Update `docs/game-systems.md` + README per CLAUDE.md if any effect's documented animation/behavior changed (e.g. major-convergence). Commit `chore(anim): remove legacy centered animations`.

---

## Self-review notes

- **Coverage:** Flip (Task 2) ✓; Glow incl. silent anchor/roll-mode (Task 3) ✓; Amplify incl. silent suit-accord/elemental-clash (Task 4) ✓; Mirror w/ source rect (Task 5) ✓; Spawn/Reroll/Veil reuse (Task 6) ✓; Override (Task 7) ✓; Interrupt + orient (Task 8) ✓; cleanup (Task 9) ✓. Untouched by design: will-widen/fate-thin/shadow-shroud/fate-force (inline).
- **Venue risk:** the mid-game effects (roll-mode, dice:reroll, tarot:deal, tarot:picked, tarot:orient, happening:start) each carry a "verify venue" step because their sequencer-vs-inline behavior and on-screen anchor are not yet proven — do NOT assume; use the probe.
- **Engine edits** are `targetSlot` metadata only (Task 1, Task 6 Step 1's animation-string change). Keep `npm test` green and `docs/game-systems.md` synced.
- **Type consistency:** `PrimitiveProps` gains optional `sourceRect` (Task 5) — additive, existing primitives ignore it. `MIGRATED_SET`/`ANCHORED` extended in lockstep each task. New primitives all follow the `AnchoredStage` + `theme.palette` contract.
- **Each task ends green and committed**; primitives are independently reviewable.
```
