# Animation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the screen-divorced centered overlay animations with effects that play on the real card on the real screen — anchored, thematic, and flashy — via shared slot-anchoring + canvas-particle infrastructure.

**Architecture:** A new `AnchorRegistry` context lets any screen register its affectable cards by key (`outcome`, `constellation:<i>`); a single shared `<canvas>` `ParticleField` driven by one rAF loop renders dense bursts; the refactored `InteractionSequencer` resolves each `EffectReport` to a target rect, renders a primitive component (from a ~10-verb library) into a portal over that card, fires particles, and publishes an affect signal the real card reads. A pure `theme.ts` module maps affinity/source-element → palette + particle model.

**Tech Stack:** React 18, TypeScript (strict), Vite, framer-motion, HTML Canvas 2D. No new dependencies.

## Global Constraints

- **Engine purity:** no React/DOM imports in `src/engine/**`. This work is presentation-only; do not modify responder logic or probabilities. (CLAUDE.md)
- **No new dependencies.** Canvas 2D only; no WebGL/PixiJS. (spec Non-goals)
- **Typecheck is the gate:** `npm run build` (`tsc -b && vite build`, strict + `noUnusedLocals`/`noUnusedParameters`) must pass after every task. There is no component-test harness (Vitest globs `src/engine/__tests__/**` only) — visual tasks are verified by `npm run build` + manual debug-scenario playtest, not assertions.
- **Engine tests stay green:** `npm test` must pass after any task that touches `src/engine/**`.
- **If `EffectReport` gains fields,** update `docs/game-systems.md` in the same change (CLAUDE.md). The slice is designed to need none.
- **Affinity palette is canonical** in [EventBanner.tsx](../../../src/components/overlays/EventBanner.tsx) `AFFINITY_COLOR`; reuse those exact hex values.
- **Graceful fallback:** an unresolved anchor (`null` rect) must center the animation, never crash or blank.
- **Commit after every task** with the message shown in its final step.

## Verification model (read once)

Most tasks end with two checks:
1. **Build:** `npm run build` → expect `tsc` clean + Vite bundle success.
2. **Playtest:** `npm run dev`, open `http://localhost:5173/?debug`, use the debug panel's forced-effect path (`state.debugConfig` `forced`/`isolate`; scenarios in [scenarios.ts](../../../src/engine/events/scenarios.ts)) to fire the named effect, and confirm the described visual. Forced bypasses `roll` but not `condition` — the scenario must stage the precondition.

---

## PHASE 0 — Infrastructure + 3 showcase effects → PLAYTEST GATE

### Task 1: `AnchorRegistry` context + hook

**Files:**
- Create: `src/context/AnchorRegistry.tsx`
- Modify: `src/components/screens/GameTable.tsx` (wrap tableau in provider)

**Interfaces:**
- Produces:
  - `AnchorProvider: React.FC<{ children: ReactNode }>`
  - `useAnchorRegister(key: string) => (el: HTMLElement | null) => void` — ref callback a target node attaches.
  - `useAnchorResolver() => { resolve: (key: string) => DOMRect | null }`
  - Key helpers: `outcomeKey = 'outcome'`, `constellationKey(i: number) => `constellation:${i}``.

- [ ] **Step 1: Create the registry.** A `Map<string, HTMLElement>` held in a `ref` (mutation must not re-render). `register(key)` returns a stable callback storing/deleting the node. `resolve(key)` returns `map.get(key)?.getBoundingClientRect() ?? null`.

```tsx
// src/context/AnchorRegistry.tsx
import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';

export const outcomeKey = 'outcome';
export const constellationKey = (i: number) => `constellation:${i}`;

interface AnchorApi {
  register: (key: string) => (el: HTMLElement | null) => void;
  resolve: (key: string) => DOMRect | null;
}
const Ctx = createContext<AnchorApi | null>(null);

export function AnchorProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, HTMLElement>());
  // One stable callback per key, memoised so refs stay referentially stable.
  const cbs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const register = useCallback((key: string) => {
    let cb = cbs.current.get(key);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) map.current.set(key, el);
        else map.current.delete(key);
      };
      cbs.current.set(key, cb);
    }
    return cb;
  }, []);
  const resolve = useCallback(
    (key: string) => map.current.get(key)?.getBoundingClientRect() ?? null,
    [],
  );
  return <Ctx.Provider value={{ register, resolve }}>{children}</Ctx.Provider>;
}

export function useAnchorRegister(key: string) {
  const api = useContext(Ctx);
  return api ? api.register(key) : () => {};
}
export function useAnchorResolver() {
  const api = useContext(Ctx);
  return api ?? { register: () => () => {}, resolve: () => null };
}
```

- [ ] **Step 2: Mount the provider** in [GameTable.tsx](../../../src/components/screens/GameTable.tsx). Wrap the existing `InteractionFocusProvider` subtree (and the center render, so screens can register) in `<AnchorProvider>`. Place it just inside `hubStyle`'s root `<div>` so both the screens and the sequencer share one registry.

- [ ] **Step 3: Build.** `npm run build` → expect clean.

- [ ] **Step 4: Commit.**
```bash
git add src/context/AnchorRegistry.tsx src/components/screens/GameTable.tsx
git commit -m "feat(anim): AnchorRegistry context for slot-anchored effects"
```

---

### Task 2: Register the `outcome` + `constellation` anchors

**Files:**
- Modify: `src/components/cards/FanCard.tsx` (register `constellation:<index>` on the card root)
- Modify: `src/components/overlays/ConstellationFan.tsx` (no change expected — index already passed to FanCard; verify)
- Modify: each minigame result view to register `outcome` on its committed result card. Start with the two the slice needs: `src/components/screens/DiceMinigame.tsx` (fool-reroll target) and `src/components/screens/TarotMinigame.tsx` / wherever the committed outcome card renders for chaos-second-result.

**Interfaces:**
- Consumes: `useAnchorRegister`, `outcomeKey`, `constellationKey` from Task 1.
- Produces: live anchors resolvable by the sequencer for keys `outcome` and `constellation:<i>`.

- [ ] **Step 1: FanCard registers its slot.** In [FanCard.tsx](../../../src/components/cards/FanCard.tsx), call `const setAnchor = useAnchorRegister(constellationKey(index));` and attach it to the root `motion.div` via a merged ref. framer-motion's `motion.div` forwards `ref`. Add `ref={setAnchor}` (the existing component has no ref; add one).

- [ ] **Step 2: Identify the outcome card node** in DiceMinigame and TarotMinigame. Find the element that displays the freshly-committed result during the post-commit/awaiting-continue phase (when the sequencer plays). Attach `ref={useAnchorRegister(outcomeKey)}` to that card's root. (Inspect each screen for its result-display element; register only while the result is mounted.)

- [ ] **Step 3: Build + sanity playtest.** `npm run build`. Then in dev, temporarily log `resolve('outcome')` / `resolve(constellationKey(0))` from the sequencer (remove after) to confirm non-null rects when those cards are on-screen.

- [ ] **Step 4: Commit.**
```bash
git add src/components/cards/FanCard.tsx src/components/screens/DiceMinigame.tsx src/components/screens/TarotMinigame.tsx
git commit -m "feat(anim): register outcome + constellation anchors"
```

---

### Task 3: `ParticleField` shared canvas

**Files:**
- Create: `src/components/overlays/ParticleField.tsx`
- Create: `src/context/ParticleContext.tsx` (provider + `useParticles`)
- Modify: `src/components/screens/GameTable.tsx` (mount canvas + provider once)

**Interfaces:**
- Produces:
  - `type ParticleModel = 'radial' | 'rising' | 'falling' | 'swirl' | 'implode' | 'shard';`
  - `interface BurstSpec { origin: DOMRect | { x: number; y: number }; count: number; palette: string[]; model: ParticleModel; gravity?: number; lifetimeMs?: number; spread?: number; size?: number; blend?: GlobalCompositeOperation; }`
  - `useParticles() => { emit: (spec: BurstSpec) => void }`

- [ ] **Step 1: Particle simulation + canvas.** One `<canvas>` fixed to the viewport, `pointerEvents:'none'`, `zIndex` above the sequencer veil but below the banner. A module-level array of live particles; `emit` seeds particles from the spec; one `requestAnimationFrame` loop integrates position/velocity/alpha and draws, sleeping (cancels rAF) when empty.

```tsx
// src/components/overlays/ParticleField.tsx — core loop sketch
interface P { x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:string;blend:GlobalCompositeOperation; }
// emit(): compute origin center from rect; for each i, derive velocity from `model`
//   radial: angle=2πi/n, speed=rand; rising: vy<0; falling: vy>0; swirl: tangential;
//   implode: start on a ring, velocity toward center; shard: few, fast, long, thin.
// frame(dt): p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=gravity*dt; p.life-=dt;
//   alpha=clamp(p.life/p.max); ctx.globalCompositeOperation=p.blend; draw dot/streak.
```

Expose `emit` via an imperative handle stored in `ParticleContext` so any component can call it. Cap `count` (e.g. ≤ 200/burst) to bound cost.

- [ ] **Step 2: Provider + hook** in `ParticleContext.tsx`; mount `<ParticleField/>` once in GameTable inside `AnchorProvider`.

- [ ] **Step 3: Build + smoke test.** Add a temporary dev-only button calling `emit({origin:{x:innerWidth/2,y:innerHeight/2}, count:80, palette:['#d4a854','#f0d890'], model:'radial'})`; confirm a gold burst; remove the button.

- [ ] **Step 4: Commit.**
```bash
git add src/components/overlays/ParticleField.tsx src/context/ParticleContext.tsx src/components/screens/GameTable.tsx
git commit -m "feat(anim): shared canvas ParticleField + useParticles"
```

---

### Task 4: `theme.ts` — derivation of primitive + theme + anchor

**Files:**
- Create: `src/components/overlays/anim/theme.ts`

**Interfaces:**
- Consumes: `EffectReport` ([events/types.ts:15](../../../src/engine/events/types.ts#L15)) fields `animation`, `label`, `sourceSlot`, `targetSlot`; `SlotResult` tags (for `element-*`); `ParticleModel`, `BurstSpec` from Task 3; `outcomeKey`/`constellationKey` from Task 1.
- Produces:
  - `type Primitive = 'glow'|'flip'|'spawn'|'dissolve'|'veil'|'reroll'|'override'|'mirror'|'amplify'|'interrupt';`
  - `interface Theme { palette: string[]; model: ParticleModel; key: string; }` (`key` = affinity or element id, for styling)
  - `primitiveFor(animation: string): Primitive`
  - `themeFor(report: EffectReport, results: SlotResult[]): Theme`
  - `anchorKeyFor(report: EffectReport): string` — `typeof sourceSlot==='number' ? constellationKey(sourceSlot) : typeof targetSlot==='number' ? constellationKey(targetSlot) : outcomeKey` (refined per-effect in wiring tasks).

- [ ] **Step 1: Maps.** `primitiveFor`: `{ reroll:'reroll', flip:'flip', mirror:'mirror', widen:'spawn', 'second-result':'spawn', 'add-choice':'spawn', thin:'dissolve', shroud:'veil', override:'override', interrupt:'interrupt', amplify:'amplify', anchor:'glow' }` with a `'glow'` default. Affinity palettes copied verbatim from `AFFINITY_COLOR` plus the accents from the spec theming table; element palettes (fire/water/air/earth) from the spec.

```ts
const AFFINITY: Record<string, Theme> = {
  Will:   { palette:['#5b8c5a','#8fd49a'], model:'rising',  key:'will' },
  Fate:   { palette:['#d4a854','#f0d890'], model:'swirl',   key:'fate' },
  Shadow: { palette:['#9b6bb0','#1a0f2e'], model:'falling', key:'shadow' },
  Light:  { palette:['#e6d8a8','#fffbe8'], model:'radial',  key:'light' },
  Chaos:  { palette:['#c75b4a','#ff7a4a'], model:'shard',   key:'chaos' },
  Order:  { palette:['#5b7ec7','#aac4ff'], model:'implode', key:'order' },
};
const ELEMENT: Record<string, Theme> = {
  fire:  { palette:['#c75b4a','#ff9a4a'], model:'rising',  key:'fire' },
  water: { palette:['#4a8cc7','#7ac4e6'], model:'swirl',   key:'water' },
  air:   { palette:['#c8d8f0','#ffffff'], model:'radial',  key:'air' },
  earth: { palette:['#8a9a5b','#c7b06b'], model:'falling', key:'earth' },
};
const FALLBACK = AFFINITY.Fate;
```

- [ ] **Step 2: `themeFor`.** If `report.label` matches an affinity → that affinity theme. Else if `sourceSlot` indexes a result with an `element-*` tag → that element theme. Else `FALLBACK`.

- [ ] **Step 3: Build.** `npm run build` → clean (pure module, no runtime wiring yet).

- [ ] **Step 4: Commit.**
```bash
git add src/components/overlays/anim/theme.ts
git commit -m "feat(anim): primitive + theme + anchor derivation"
```

---

### Task 5: Showcase primitive components (Spawn, Reroll, Veil) + `AnchoredStage`

**Files:**
- Create: `src/components/overlays/anim/AnchoredStage.tsx` (positions children over a rect; fires particles)
- Create: `src/components/overlays/anim/primitives/SpawnPrimitive.tsx`
- Create: `src/components/overlays/anim/primitives/RerollPrimitive.tsx`
- Create: `src/components/overlays/anim/primitives/VeilPrimitive.tsx`

**Interfaces:**
- Consumes: `Theme` (Task 4), `useParticles` (Task 3), a resolved `DOMRect | null`.
- Produces: `interface PrimitiveProps { rect: DOMRect | null; theme: Theme; durationMs: number; }` and the three components, each default-exported, plus `AnchoredStage` rendering a portal box at `rect` (fallback: viewport center) with `position:fixed; left/top/width/height` from the rect.

- [ ] **Step 1: `AnchoredStage`.** A `createPortal` to `document.body` rendering a `position:fixed` box at `rect` (or centered when `null`), `pointerEvents:'none'`. Children animate within. On mount, call `emit` once at the rect with the theme palette/model.

- [ ] **Step 2: SpawnPrimitive** (chaos showcase). Over the outcome rect: a duplicate ghost card scales/fractures into being beside the original (offset +60px x), framer-motion `scale 0→1` + `rotate` jitter; `emit` a `shard` burst from the rect. Card reaction (chaos): the original shakes briefly (handled via affect signal in Task 6).

- [ ] **Step 3: RerollPrimitive** (fool showcase). Over the target (dice outcome) rect: the value-face scatters (particles `radial`) then a new face snaps in (scale pulse). The source Fool card glow is the affect signal (Task 6); particles use the source element theme.

- [ ] **Step 4: VeilPrimitive** (shadow showcase). Over the constellation rect: a violet veil panel scales down over the card (`scaleY 0→1` from top), `emit` `falling` ink-smoke (`source-over` blend), card desaturates via affect signal.

- [ ] **Step 5: Build.** `npm run build` → clean.

- [ ] **Step 6: Commit.**
```bash
git add src/components/overlays/anim/AnchoredStage.tsx src/components/overlays/anim/primitives/
git commit -m "feat(anim): AnchoredStage + Spawn/Reroll/Veil primitives"
```

---

### Task 6: Refactor `InteractionSequencer` to anchored rendering + affect signal

**Files:**
- Modify: `src/components/overlays/InteractionSequencer.tsx`
- Modify: `src/context/InteractionFocusContext.tsx` (extend with affect info if needed)
- Modify: `src/components/cards/FanCard.tsx` (read affect signal → desaturate/shake/glow)

**Interfaces:**
- Consumes: `useAnchorResolver` (Task 1), `primitiveFor`/`themeFor`/`anchorKeyFor` (Task 4), the three primitives (Task 5), `state.turnResults` for source-card lookup.
- Produces: sequencer renders the resolved primitive at the resolved rect instead of the centered `renderAnimation` switch.

- [ ] **Step 1: Resolve per report.** In the sequencer's render, replace `renderAnimation(report)` with: compute `primitive = primitiveFor(report.animation)`, `theme = themeFor(report, state.turnResults)`, `rect = resolve(anchorKeyFor(report))`; render `<AnchoredStage rect theme>` containing the primitive component for that `primitive` (slice: spawn/reroll/veil; others fall through to the legacy centered component for now so nothing regresses mid-rollout).

- [ ] **Step 2: Affect signal.** Extend `InteractionFocusContext` so FanCard can read `{ slot, affect: Primitive | null, phase }`. In FanCard, when `affect==='veil'` desaturate (`filter:grayscale(0.8) brightness(0.5)`), `'reroll'`/`'spawn'` keep/raise the glow, with framer-motion transitions. (The existing `glowing` prop already covers source/target highlight; add the desaturate/shake cases.)

- [ ] **Step 3: Keep legacy fallthrough.** Animations not yet migrated (flip/mirror/override/thin/widen/shroud-on-method/interrupt/add-choice/amplify/anchor) still render their existing `InteractionAnimations/*` component centered. This keeps the app fully working after Phase 0; Phase 1 swaps them one batch at a time.

- [ ] **Step 4: Build + playtest the 3 effects.** Force each via debug scenarios (Task 7 adds/uses them): confirm spawn plays on the outcome, reroll on the dice outcome with Fool-themed motes, veil on the constellation card.

- [ ] **Step 5: Commit.**
```bash
git add src/components/overlays/InteractionSequencer.tsx src/context/InteractionFocusContext.tsx src/components/cards/FanCard.tsx
git commit -m "feat(anim): sequencer renders anchored primitives + affect signal"
```

---

### Task 7: Debug scenarios for the slice + PLAYTEST GATE

**Files:**
- Modify: `src/engine/events/scenarios.ts` (ensure `DEBUG_SCENARIOS` stage chaos-second-result, fool-reroll, shadow-shroud)

- [ ] **Step 1: Confirm/extend scenarios.** Ensure each showcase effect has a `DEBUG_SCENARIOS` entry staging its `condition` (slots/screen/affinity) so `forced` fires it. Add any missing. (Engine file — `npm test` must stay green.)

- [ ] **Step 2: Build + test.** `npm run build` && `npm test`.

- [ ] **Step 3: Commit.**
```bash
git add src/engine/events/scenarios.ts
git commit -m "test(anim): debug scenarios for showcase effects"
```

- [ ] **Step 4: 🚦 PLAYTEST GATE.** Hand off to the user: play the three effects via `?debug`, tune timing (`DURATION` table), particle counts, and intensities until the feel is right. **Do not start Phase 1 until the user signs off on the feel.** Record any tuning constants that changed so batches inherit them.

---

## PHASE 1+ — Batch rollout (after the gate)

Each batch swaps a group of effects from the legacy centered fallthrough to the anchored primitive. Because primitives + theme + anchoring already exist, a batch is: add the primitive component if new, map its effects in the sequencer, wire each effect's anchor (outcome vs constellation) and any affect-signal reaction, add/confirm debug scenarios, build, playtest. Each batch is one task ending in a commit.

### Task 8 — Flip batch
Effects: `critical-resonance`, `chaos-wild-card`, `spread-cascade`, `fate-auto-orient`. Create `FlipPrimitive` (card Y-rotation revealing the changed face; theme by affinity/source). Anchor: `outcome`. Verify each via debug scenario. Commit `feat(anim): flip primitive batch`.

### Task 9 — Spawn batch (remaining)
Effects: `will-widen-pool`, `major-convergence`, `iching-happening-boost`. Reuse `SpawnPrimitive` with Will/Fate/I-Ching themes. Note: `will-widen-pool`/`thin` already have bespoke MethodSelect handling — only migrate their **sequencer** path (when they appear outside MethodSelect). Commit `feat(anim): spawn primitive batch`.

### Task 10 — Veil batch (remaining)
Effects: `shadow-veil-position`, `fate-fated-card`. Reuse `VeilPrimitive`. `shadow-veil-position` targets a card in the committed spread (`outcome`); `fate-fated-card` uses fate-gold theme. Commit `feat(anim): veil primitive batch`.

### Task 11 — Glow batch (fills silent gaps)
Effects: `light-advantage`, `order-anchor`, `spread-aligned`. Create `GlowPrimitive` (themed aura + particles, no structural change). These currently render nothing (`anchor`/no-switch) — this is the fix. Anchor: `outcome`. Commit `feat(anim): glow primitive batch`.

### Task 12 — Override batch
Effects: `fate-deal-swap` (+ optionally migrate `fate-force-method` onto shared infra — optional, keep bespoke if risky). Create `OverridePrimitive` (reject + replace). Anchor: `outcome`. Commit `feat(anim): override primitive batch`.

### Task 13 — Mirror batch
Effects: `mirror`, `iching-resonant-change`. Create `MirrorPrimitive` (two cards turn in sympathy + a reflection arc between two rects — resolve both `sourceSlot` and `targetSlot` constellation anchors). Commit `feat(anim): mirror primitive batch`.

### Task 14 — Amplify batch (fills silent gaps)
Effects: `suit-accord`, `elemental-clash`. Create `AmplifyPrimitive` (particles `implode` inward, card intensifies/pulses). Currently silent. Anchor: `outcome`. Commit `feat(anim): amplify primitive batch`.

### Task 15 — Dissolve + Interrupt batch
Effects: `fate-thin-pool` (sequencer path), `fate-hollow-reroll` (Reroll, hollow variant — same face returns), `chaos-happening-interrupt`. Create `DissolvePrimitive` + `InterruptPrimitive` (reality-tear). Commit `feat(anim): dissolve + interrupt batch`.

### Task 16 — Remove dead legacy animations + docs
Once every effect is migrated, delete the now-unused `InteractionAnimations/*` components and the legacy `renderAnimation` fallthrough. Update `docs/game-systems.md` only if any `EffectReport` field changed (the slice adds none). `npm run build` + `npm test` green. Commit `chore(anim): remove legacy centered animations`.

---

## Self-review notes

- **Spec coverage:** AnchorRegistry (Task 1–2) ✓; ParticleField substrate (Task 3) ✓; sequencer refactor + affect signal (Task 6) ✓; theming bible — affinities + element themes (Task 4) ✓; primitive library — all 10 verbs across Tasks 5,8–15 ✓; silent `amplify`/`anchor` gaps fixed (Tasks 11,14) ✓; vertical slice + playtest gate (Tasks 5–7) ✓; phasing by primitive (Tasks 8–15) ✓; graceful fallback (Task 1 Step 1, Task 6 Step 3) ✓.
- **No engine changes required** for the slice (renderer derives everything from existing `EffectReport` fields). If a later batch genuinely needs an `anchorKey`/`theme` hint on `EffectReport`, add it optionally and update `docs/game-systems.md` + engine tests per Global Constraints.
- **Type consistency:** `BurstSpec`/`ParticleModel` (Task 3) consumed unchanged by `theme.ts` (Task 4) and primitives (Task 5); `Theme`/`Primitive`/`PrimitiveProps` names stable across Tasks 4–15; anchor key helpers `outcomeKey`/`constellationKey` used identically in Tasks 1,2,4,6.
