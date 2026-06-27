# UI/UX Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the rune band length, rebuild the dice minigame visuals (no board, bigger contained dice, dramatic tally → DC face-off), and replace the shrouded card's ellipse fog with a slowly-dispersing fractal cloud.

**Architecture:** Presentation-layer only. React + framer-motion for DOM animation; three.js + cannon-es for the dice scene. No `src/engine/` logic, data, or tag changes; the `notify()` snapshot contract is untouched.

**Tech Stack:** React 18, TypeScript (strict), Vite, framer-motion, three.js, cannon-es, SVG `feTurbulence`.

## Global Constraints

- No `src/engine/**`, `src/data/**`, reducer, responder, or affinity changes. Purely visual/animation.
- Type safety enforced by `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`. Verification gate per task: `npm run build` must pass. The engine suite `npm test` must stay green.
- No new component tests (repo has none; Vitest is scoped to `src/engine/__tests__/**`). Verify via typecheck + manual.
- Respect `prefers-reduced-motion`: new motion collapses to instant/quick (mirror existing patterns in `StringsMinigame.tsx` / `ShroudedFront`).
- Keep the 3D path gated behind `canUse3D()`; preserve the 2D `DiceThrowAnimation` fallback.
- Commit after each task.

---

### Task 1: Rune band wraps and clamps to ≤3 lines, degrading on short viewports

**Files:**
- Modify: `src/components/shared/RunicBand.tsx`
- Sanity-check (likely no change): `src/components/screens/TitleScreen.tsx` (`runicBandStyle` mirrored wrapper)

**Interfaces:**
- Produces: `RunicBand` gains optional prop `lines?: number` (default 3). Existing props (`text`, `color`, `opacity`, `fontSize`) unchanged.

- [ ] **Step 1: Rewrite `RunicBand` to wrap + line-clamp.** Replace `whiteSpace: 'nowrap'` single-line behavior with a centered `-webkit-box` clamp. Generate a modest rune count (enough to plausibly fill 3 lines at the inherited width, not a runaway 100). Use a CSS custom property `--rune-lines` for the clamp so a media query can lower it on short viewports.

```tsx
import { useMemo } from 'react';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

interface RunicBandProps {
  text?: string;
  color?: string;
  opacity?: number;
  fontSize?: string;
  lines?: number;       // max lines before clamp (default 3)
}

export default function RunicBand({
  text = RUNES,
  color = '#7b9ec7',
  opacity = 0.35,
  fontSize = 'clamp(0.6rem, 1.2vw, 0.85rem)',
  lines = 3,
}: RunicBandProps) {
  // Enough runes to fill up to `lines` wrapped rows at a typical decorated
  // width; the clamp hides any overflow, so exact length isn't load-bearing.
  const repeatCount = useMemo(() => Math.max(2, Math.ceil((18 * lines) / text.length)), [text, lines]);

  return (
    <div
      className="runic-band"
      style={{
        ['--rune-lines' as string]: String(lines),
        color,
        fontSize,
        letterSpacing: '0.5em',
        opacity,
        fontFamily: "'Cormorant Garamond', serif",
        // Wrap to the decorated element's width and flow up to --rune-lines
        // rows; the line-clamp truncates extra rows from the bottom first, so
        // on short/mobile viewports the lower lines drop before other UI.
        whiteSpace: 'normal',
        wordBreak: 'break-all',
        textAlign: 'center',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 'var(--rune-lines)' as unknown as number,
        overflow: 'hidden',
        maxWidth: '100%',
        userSelect: 'none',
      }}
    >
      {text.repeat(repeatCount)}
    </div>
  );
}
```

- [ ] **Step 2: Add viewport-height degradation CSS.** In the global stylesheet, lower `--rune-lines` on short viewports so the band sheds lines (3 → 2 → 1) before other UI is pushed off-screen. Find the global CSS first.

Run: locate the global stylesheet — check `src/index.css`, `src/styles/`, or imports in `src/main.tsx`.

Add:

```css
/* Rune band sheds its lower lines first when vertical space is tight. */
@media (max-height: 720px) { .runic-band { --rune-lines: 2; } }
@media (max-height: 560px) { .runic-band { --rune-lines: 1; } }
```

- [ ] **Step 3: Sanity-check `TitleScreen.tsx`.** The mirrored band wraps a second `<RunicBand>` in a `scaleX(-1)` div with its own `runicBandStyle` (which sets `wordBreak: 'break-all'`). That wrapper's styles apply to the div, not the inner band, so they don't fight the clamp — confirm by reading, leave unchanged unless it visibly conflicts.

- [ ] **Step 4: Typecheck.** Run: `npm run build`. Expected: PASS (tsc + vite bundle, no errors). The `WebkitLineClamp` cast is required because the React type expects a number.

- [ ] **Step 5: Manual check.** `npm run dev`; on the title screen the rune bands above/below the wordmark are no longer a full-width strip — they wrap to ≤3 lines at the wordmark's width. Shrink the window height: the bands drop to 2 then 1 line while the wordmark/button stay in view.

- [ ] **Step 6: Commit.**

```bash
git add src/components/shared/RunicBand.tsx
git commit -m "feat(ui): rune band wraps to <=3 lines, sheds lines on short viewports"
```

---

### Task 2: Shrouded card — fractal fog + slow dispersal on reveal

**Files:**
- Modify: `src/components/cards/MethodCard.tsx` (`ShroudedFront`, reveal layering, new visual state)
- Modify: `src/components/screens/MethodSelect.tsx` (`visualFor` reveal path)

**Interfaces:**
- Consumes: `MethodSelect` already owns `revealShrouded` (set ~`t` after pick, with a ~650ms window before `confirmSelection()`), and `state.shroudedMethods: number[]`.
- Produces: `MethodCardVisual` gains `'revealing'` — front rendered with the fog dispersing on top. `visualFor()` returns `'revealing'` for the picked shrouded card during the reveal window (was `'face-up'`).

- [ ] **Step 1: Add the `'revealing'` visual.** In `MethodCard.tsx`, extend the type and render path so the real front shows with a fog overlay that animates out.

```tsx
export type MethodCardVisual = 'face-down' | 'face-up' | 'shrouded' | 'revealing';
```

In the front face JSX, replace the `visual === 'shrouded' ? <ShroudedFront /> : <MethodCardFront .../>` ternary with logic that, for `'shrouded'` shows the fog statically, for `'revealing'` shows `<MethodCardFront>` underneath with a dispersing `<ShroudFog dispersing />` overlay, and otherwise shows the front:

```tsx
{visual === 'shrouded' ? (
  <ShroudedFront />
) : visual === 'revealing' ? (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <MethodCardFront method={method} />
    <ShroudFog dispersing />
  </div>
) : (
  <MethodCardFront method={method} />
)}
```

- [ ] **Step 2: Rebuild the fog as a fractal cloud (`ShroudFog`), reused by both states.** Replace the three `<ellipse>`s in `ShroudedFront` with an SVG `feTurbulence` fractalNoise cloud (violet-tinted to match the shroud), keeping the drift. Extract a `ShroudFog` component that takes a `dispersing` flag and, when set, fades + scales + blurs out over ~0.6s via framer-motion. Keep the veiled eye + `VEILED` label in `ShroudedFront` (they sit above the fog and are not part of `ShroudFog`).

```tsx
function ShroudFog({ dispersing = false }: { dispersing?: boolean }) {
  const uid = useId();
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      initial={dispersing ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : false}
      animate={dispersing
        ? { opacity: 0, scale: 1.18, filter: 'blur(8px)' }
        : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={dispersing ? { duration: 0.6, ease: 'easeOut' } : { duration: 0 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 140 210" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`${uid}-cloud`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves={5} seed={7} stitchTiles="stitch" result="n" />
            {/* violet shroud tint with a hard alpha ramp so the cloud reads as dense mist */}
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.11  0 0 0 0 0.07  0 0 0 0 0.20  0 0 0 1.2 -0.35" />
          </filter>
          <radialGradient id={`${uid}-grad`} cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#2a1d40" stopOpacity="0.5" /><stop offset="100%" stopColor="#050308" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.rect x="-20" y="-20" width="180" height="250" filter={`url(#${uid}-cloud)`}
          animate={{ x: [-20, -8, -28, -20], y: [-20, -32, -10, -20] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
        <rect x="0" y="0" width="140" height="210" fill={`url(#${uid}-grad)`} />
      </svg>
    </motion.div>
  );
}
```

Rewrite `ShroudedFront` to compose it:

```tsx
function ShroudedFront() {
  return (
    <div style={shroudedStyle}>
      <ShroudFog />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '38%', display: 'flex', justifyContent: 'center' }}>
        <VeiledEye />
      </div>
      <span style={veiledLabelStyle}>VEILED</span>
    </div>
  );
}
```

- [ ] **Step 3: Wire the reveal state in `MethodSelect.tsx`.** In `visualFor(i)`, the picked shrouded card returns `'revealing'` while `revealShrouded` is true (instead of `'face-up'`):

```tsx
if (state.shroudedMethods.includes(i)) {
  const isPicked = pending && (i === pending.finalIndex);
  return isPicked && revealShrouded ? 'revealing' : 'shrouded';
}
```

- [ ] **Step 4: Reduced-motion guard.** Confirm dispersal degrades acceptably under `prefers-reduced-motion`; framer-motion respects it for `filter`/`scale` loops, but if needed gate the drift loop with `useReducedMotion()` inside `ShroudFog` so the cloud is static (the dispersal opacity fade is fine to keep). Keep this minimal — only add the hook if the drift is distracting.

- [ ] **Step 5: Typecheck.** Run: `npm run build`. Expected: PASS. Watch for unused `useId` import if removed from `ShroudedFront`.

- [ ] **Step 6: Manual check.** Stage a shrouded draw (`?debug` JsonInjector + `engine.loadState`, or play until a shroud effect lands). The veiled card now shows a drifting fractal cloud (not 3 circles); picking it makes the fog fade/scale/blur away over ~0.6s, revealing the real method front beneath, before the card ascends.

- [ ] **Step 7: Commit.**

```bash
git add src/components/cards/MethodCard.tsx src/components/screens/MethodSelect.tsx
git commit -m "feat(ui): shrouded card uses fractal fog that disperses on reveal"
```

---

### Task 3: Dice scene — remove board, contain dice, enlarge, contact shadow

**Files:**
- Modify: `src/components/screens/dice3d/scene.ts`
- Modify: `src/components/screens/dice3d/DiceCast.tsx` (clamp flick power)

**Interfaces:**
- Consumes: `BOARD_RADIUS`, `WALL_RADIUS` from `src/engine/astralGeometry.ts` (do not change — used by engine logic/tests). Tighten containment in scene-local constants instead.
- Produces: no signature changes to `DiceSceneController` / `DiceCastHandle`. Dice are larger and always settle within frame; board is invisible.

- [ ] **Step 1: Remove visual board, keep invisible walls.** In `scene.ts`, delete the `disc` mesh and `rim` torus (lines creating `CircleGeometry` + `TorusGeometry`). Keep the 24-plane `world` wall ring. The canvas already renders with `alpha: true`, so the app background shows through.

- [ ] **Step 2: Add a shadow-only contact ground.** After removing the disc, add a `ShadowMaterial` plane at y≈0 so dice cast a soft shadow onto an otherwise invisible surface (gives depth without a visible board). Ensure `renderer.shadowMap.enabled` (already true) and the key light `castShadow` (already true); set the plane `receiveShadow = true`.

```ts
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(WALL_RADIUS * 2.4, WALL_RADIUS * 2.4),
  new THREE.ShadowMaterial({ opacity: 0.32 }),
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0.001;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);
```

- [ ] **Step 3: Enlarge dice + reframe camera.** Increase `DIE_R` (e.g. `0.6 → 0.95`) and `D4_R` (e.g. `0.4 → 0.6`). Pull the camera in so the bigger dice read large: tighten `CAM_TILT`/`CAM_TOP` (e.g. `CAM_TILT = (0, 8, 10.5)`, `CAM_TOP = (0, 15, 0.001)`) and/or narrow FOV slightly. Keep throw spawn heights (`throwDie` uses `6 + …`) and d4 drop heights proportional so larger dice still clear the spawn and settle.

- [ ] **Step 4: Contain the throw (fix "fall off board").** Two guards:
  1. In `DiceCast.tsx` `onPointerUp`, clamp the flick so a hard drag can't launch a die past the wall ring or tunnel a plane in one step:

```tsx
const power = Math.min(1, Math.hypot(dx, dy) / 200);
const clamp = (n: number, m: number) => Math.max(-m, Math.min(m, n));
const flick: FlickVector = {
  vx: clamp((dx / dt) * 6, 9),
  vz: clamp((dy / dt) * 6, 9),
  power: Math.max(0.15, power),
};
```

  2. In `scene.ts` `throwDie`, cap the resulting velocity magnitude and spawn dice a touch inward (reduce the `BOARD_RADIUS * 0.45` start so they begin well inside the ring). Optionally reduce scene-local containment radius by using `WALL_RADIUS` as-is but lowering restitution if dice still rim-hop. Keep `castTuning` (affinity) inputs intact.

- [ ] **Step 5: Typecheck.** Run: `npm run build`. Expected: PASS. Remove any now-unused imports (`BOARD_RADIUS` may still be used by `throwDie`/`startModifiers`; only drop imports that truly go unused, or `noUnusedLocals` fails).

- [ ] **Step 6: Manual check.** `npm run dev`, open the dice minigame. No dark disc/gold rim — dice tumble on an invisible surface with a soft shadow; dice are noticeably larger and legible; flick hard repeatedly — dice always settle within the canvas, never fly off.

- [ ] **Step 7: Commit.**

```bash
git add src/components/screens/dice3d/scene.ts src/components/screens/dice3d/DiceCast.tsx
git commit -m "feat(dice): remove board, enlarge + contain dice, add contact shadow"
```

---

### Task 4: Dice tally drama — ghost number → counter → DC face-off → verdict

**Files:**
- Modify: `src/components/screens/dice3d/DiceTally.tsx` (DC face-off + verdict beat)
- Modify: `src/components/screens/DiceMinigame.tsx` (ghost-number overlay)

**Interfaces:**
- Consumes: `DiceTally` props `{ dc, breakdown, veiled, onDone }`; `breakdown: DiceCheckBreakdown | null` with `d20`, `bless: number[]`, `bane: number[]`, `total`, `critical`. `THRESHOLD_COLORS` from `DiceThrowAnimation`.
- Produces: `DiceTally` adds a held DC face-off + green/red verdict before `onDone()`. `DiceMinigame` renders ghost numbers from canvas-center during the `tally` phase.

- [ ] **Step 1: Add DC face-off + verdict to `DiceTally`.** After the running total finishes stepping (existing `buildSteps` schedule), add a beat where the total and `DC <n>` sit side by side, hold ~600ms, then flash green/red with a verdict label (`TRIUMPH`/`FUMBLE` from `breakdown.critical`, else `SUCCESS`/`FAILURE`), then call `onDone()`. Keep the `veiled` branch showing `DC ?` and suppressing the verdict text. Drive the new beat from the existing `useEffect` timeline (extend, don't replace, the `setTimeout` chain).

```tsx
// new local state
const [faceoff, setFaceoff] = useState(false);
const [verdict, setVerdict] = useState<{ label: string; color: string } | null>(null);
// in the timeline, replace the single "final verdict" timeout with:
timers.push(setTimeout(() => setFaceoff(true), 500 + steps.length * 650));
timers.push(setTimeout(() => {
  const crit = breakdown.critical;
  const success = crit === 'triumph' || (crit !== 'fumble' && breakdown.total >= dc);
  const label = crit === 'triumph' ? 'TRIUMPH' : crit === 'fumble' ? 'FUMBLE' : success ? 'SUCCESS' : 'FAILURE';
  setVerdict({ label, color: success ? '#5b8c5a' : '#c0392b' });
  setFlash(success ? '#5b8c5a' : '#c0392b');
  if (!doneRef.current) { doneRef.current = true; onDone(); }
}, 500 + steps.length * 650 + 600));
```

Render the face-off row (total vs DC) and verdict label below the counter; show the verdict only when `!veiled`.

- [ ] **Step 2: Ghost-number overlay in `DiceMinigame`.** During `phase === 'tally'`, spawn framer-motion ghost numbers that arc up from canvas-center toward where `DiceTally` sits (below the canvas), timed to the tally steps. Launch the d20 ghost first, then one per bless (gold `+n`) / bane (crimson `−n`). Use `breakdown` for values and `THRESHOLD_COLORS`/affinity gold/crimson for tint. Gate to `use3D` (the die rests at canvas-center under the top-down camera, so no WebGL→screen projection is needed); skip under `prefers-reduced-motion`.

Add an overlay layer inside the `position: relative` canvas wrapper:

```tsx
{use3D && phase === 'tally' && breakdown && (
  <DiceGhosts breakdown={breakdown} />
)}
```

Implement `DiceGhosts` (new small component, can live in `DiceMinigame.tsx` or a sibling file) that renders absolutely-positioned `motion.span`s starting near center and animating up/out with opacity, staggered to match `DiceTally`'s `500 + i*650` cadence so each ghost lands as the counter ticks.

- [ ] **Step 3: Reduced-motion + fallback.** Under `prefers-reduced-motion`, render no ghosts (the counter still steps). The 2D fallback (`DiceThrowAnimation`) is unchanged; the `DiceTally` verdict beat applies to it too (it already renders in both paths).

- [ ] **Step 4: Typecheck.** Run: `npm run build`. Expected: PASS.

- [ ] **Step 5: Manual check.** Play a dice reading: the d20 value flies up into the tally counter, each Bless/Bane d4 flings its number in adjusting the total, then the total faces off against the DC and flashes green/red with a verdict, then the reading text fades in. Trigger a crit (debug) to see `TRIUMPH`/`FUMBLE`. Veiled (hidden pool preview) still shows `DC ?` and no spoiler verdict.

- [ ] **Step 6: Commit.**

```bash
git add src/components/screens/dice3d/DiceTally.tsx src/components/screens/DiceMinigame.tsx
git commit -m "feat(dice): tally ghost numbers, DC face-off, and verdict beat"
```

---

## Final Verification

- [ ] `npm run build` passes (full typecheck + bundle).
- [ ] `npm test` passes (engine suite unaffected).
- [ ] Manual sweep: title rune bands ≤3 lines and degrade on short viewports; shrouded card fractal fog disperses on pick; dice minigame has no board, larger contained dice, and the full value→tally→DC→verdict drama.

## Self-Review notes
- **Spec coverage:** rune length+degradation (Task 1), fractal fog+dispersal (Task 2), board removal+containment+size+shadow (Task 3), ghost→tally→DC face-off→verdict (Task 4). All spec sections mapped.
- **No engine/data edits** — constraint honored; `astralGeometry` constants untouched (containment tuned scene-locally).
- **Type consistency:** `MethodCardVisual` extended once (Task 2) and consumed in `MethodSelect` (same task); `DiceTally`/`DiceMinigame` share `DiceCheckBreakdown` fields already defined in `engine/types`.
