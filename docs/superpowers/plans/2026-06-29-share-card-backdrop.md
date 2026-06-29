# ShareCard Constellation Backdrop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the share card's flat CSS-gradient background — and the corrupted variant's broken `repeating-linear-gradient` + inset-box-shadow overlay that `html2canvas` exports as a solid red block — with a static, export-safe SVG star-field backdrop (crimson + frozen glitch when corrupted).

**Architecture:** A new self-contained `ShareBackdrop` SVG component (no engine/React-context dependency, deterministic star generation) renders as a behind-content layer of `ShareCard`. The corrupted prop swaps the palette to crimson and adds SVG scanlines, frozen mosh bars, and a red vignette. `html2canvas` rasterises inline SVG faithfully, which both fixes the bug and enables the constellation look.

**Tech Stack:** React 18 + TypeScript, inline SVG, `html2canvas` (existing export path). No new dependencies.

## Global Constraints

- Engine/React-framework split: this is presentation-only — **no** changes under `src/engine/`, `src/data/`, responders, or `docs/game-systems.md`.
- Typecheck is the CI gate: `npm run build` runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters` all on. No unused imports/vars/params.
- Vitest is scoped to `src/engine/__tests__/**`; this presentational change has **no** unit tests. The gate is `npm run build` + visual export verification.
- The exported card is a fixed **380×475** box rasterised with `overflow:hidden`; anything outside is clipped. Keep all geometry inside that box.
- Corrupted variant: **no cracks, no eye/watcher** (explicit user decision). Glitch = frozen frame only.

---

### Task 1: Create the `ShareBackdrop` SVG component

**Files:**
- Create: `src/components/share/ShareBackdrop.tsx`

**Interfaces:**
- Produces: `export default function ShareBackdrop({ corrupted }: { corrupted: boolean }): JSX.Element` — an absolutely-positioned inline `<svg>` (`viewBox 0 0 380 475`) intended to fill a `position:relative; overflow:hidden` parent at `zIndex:0`.

- [ ] **Step 1: Write the component**

Create `src/components/share/ShareBackdrop.tsx` with exactly this content:

```tsx
// Static SVG star-field backdrop for the share card. Self-contained — no engine /
// React-context dependency — so the off-screen, html2canvas-rasterised ShareCard stays
// deterministic. html2canvas renders inline SVG faithfully, unlike the CSS
// repeating-gradient + inset box-shadow this replaces (which exported as a solid red block).

interface Star { cx: number; cy: number; r: number; opacity: number }
interface ClusterStar { cx: number; cy: number; r: number }
interface Cluster { stars: ClusterStar[]; lines: [number, number][]; gold: boolean }

const W = 380, H = 475;

// Mirrors StarField's seeded RNG so the field looks composed, not noisy, and is identical
// on every render (the share card is rasterised off-screen — determinism matters).
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeStars(seed: number, count: number, rMin: number, rRange: number, oMin: number, oRange: number): Star[] {
  const rng = seededRandom(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cx: rng() * W,
      cy: rng() * H,
      r: rng() * rRange + rMin,
      opacity: rng() * oRange + oMin,
    });
  }
  return out;
}

// A few small constellation-like clusters: 4-5 points joined by a hairline path.
function makeClusters(seed: number): Cluster[] {
  const rng = seededRandom(seed);
  const anchors = [{ x: 70, y: 80 }, { x: 290, y: 150 }, { x: 150, y: 340 }];
  return anchors.map((a, c) => {
    const n = 4 + Math.floor(rng() * 2); // 4-5 points
    const stars: ClusterStar[] = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        cx: a.x + (rng() - 0.5) * 90,
        cy: a.y + (rng() - 0.5) * 90,
        r: rng() * 0.8 + 0.9,
      });
    }
    const lines: [number, number][] = [];
    for (let i = 1; i < n; i++) lines.push([i - 1, i]);
    return { stars, lines, gold: c === 1 };
  });
}

const DUST = makeStars(42, 90, 0.4, 0.5, 0.18, 0.32);
const MEDIUM = makeStars(137, 22, 0.7, 0.6, 0.32, 0.3);
const CLUSTERS = makeClusters(311);

const SCANLINES = Array.from({ length: Math.ceil(H / 4) }, (_, i) => i * 4);
const MOSH = [
  { y: Math.round(H * 0.24), h: 3, o: 0.5 },
  { y: Math.round(H * 0.47), h: 5, o: 0.4 },
  { y: Math.round(H * 0.70), h: 2, o: 0.45 },
];

export default function ShareBackdrop({ corrupted }: { corrupted: boolean }) {
  const starWhite = corrupted ? '#ff8a98' : '#c8d8f0';
  const starGold = corrupted ? '#ff2d4a' : '#d4a854';
  const lineWhite = corrupted ? '#ff2d4a' : '#c8d8f0';
  const lineGold = corrupted ? '#ff2d4a' : '#d4a854';

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'block' }}
    >
      <defs>
        <radialGradient id="sb-neb-a" cx="30%" cy="32%">
          <stop offset="0%" stopColor={corrupted ? '#3a0a14' : '#2a1545'} stopOpacity={corrupted ? 0.5 : 0.28} />
          <stop offset="100%" stopColor={corrupted ? '#3a0a14' : '#2a1545'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-neb-b" cx="72%" cy="60%">
          <stop offset="0%" stopColor={corrupted ? '#1a0006' : '#0f1f3d'} stopOpacity={corrupted ? 0.5 : 0.2} />
          <stop offset="100%" stopColor={corrupted ? '#1a0006' : '#0f1f3d'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-neb-c" cx="50%" cy="88%">
          <stop offset="0%" stopColor={corrupted ? '#2a0608' : '#1a0a1e'} stopOpacity={corrupted ? 0.45 : 0.14} />
          <stop offset="100%" stopColor={corrupted ? '#2a0608' : '#1a0a1e'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sb-vignette" cx="50%" cy="46%" r="62%">
          <stop offset="55%" stopColor="#ff2d4a" stopOpacity="0" />
          <stop offset="100%" stopColor="#ff2d4a" stopOpacity="0.22" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={corrupted ? '#0c0306' : '#070a12'} />
      <rect width={W} height={H} fill="url(#sb-neb-a)" />
      <rect width={W} height={H} fill="url(#sb-neb-b)" />
      <rect width={W} height={H} fill="url(#sb-neb-c)" />

      {DUST.map((s, i) => (
        <circle key={`d${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={starWhite} opacity={s.opacity} />
      ))}
      {MEDIUM.map((s, i) => (
        <circle key={`m${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={starWhite} opacity={s.opacity} />
      ))}

      {CLUSTERS.map((cl, ci) => (
        <g key={`c${ci}`}>
          {cl.lines.map(([a, b], li) => (
            <line
              key={`l${li}`}
              x1={cl.stars[a].cx} y1={cl.stars[a].cy}
              x2={cl.stars[b].cx} y2={cl.stars[b].cy}
              stroke={cl.gold ? lineGold : lineWhite}
              strokeWidth="0.6" strokeOpacity="0.32"
            />
          ))}
          {cl.stars.map((s, si) => (
            <circle key={`s${si}`} cx={s.cx} cy={s.cy} r={s.r} fill={cl.gold ? starGold : starWhite} opacity="0.9" />
          ))}
        </g>
      ))}

      {corrupted && (
        <>
          {SCANLINES.map((y, i) => (
            <rect key={`sl${i}`} x="0" y={y} width={W} height="1" fill="#ff2d4a" opacity="0.07" />
          ))}
          {MOSH.map((m, i) => (
            <rect key={`mo${i}`} x="0" y={m.y} width={W} height={m.h} fill="#ff2d4a" opacity={m.o} />
          ))}
          <rect width={W} height={H} fill="url(#sb-vignette)" />
        </>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (no `tsc` errors; the new file compiles, no unused vars).

- [ ] **Step 3: Commit**

```bash
git add src/components/share/ShareBackdrop.tsx
git commit -m "feat(share): static SVG constellation backdrop component"
```

---

### Task 2: Wire `ShareBackdrop` into `ShareCard` and delete the buggy overlay

**Files:**
- Modify: `src/components/share/ShareCard.tsx`

**Interfaces:**
- Consumes: `ShareBackdrop` (default export) from Task 1.

- [ ] **Step 1: Import the component**

In `src/components/share/ShareCard.tsx`, add the import after the existing `fitList` import (line 4):

```tsx
import ShareBackdrop from './ShareBackdrop';
```

- [ ] **Step 2: Delete the broken corrupted overlay style**

Remove the `cardCxOverlay` definition (currently around lines 147-151):

```tsx
  const cardCxOverlay: React.CSSProperties = {
    position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 14,
    boxShadow: 'inset 0 0 70px rgba(255,45,74,0.16), inset 0 0 0 1px rgba(255,45,74,0.4)',
    background: 'repeating-linear-gradient(0deg, rgba(255,45,74,0.06) 0 1px, transparent 1px 4px)',
  };
```

(Keep the `headlineCx` definition that follows it — the chromatic-split headline stays.)

- [ ] **Step 3: Swap the overlay render for the backdrop**

Replace this line (currently line 156):

```tsx
      {corrupted && <div style={cardCxOverlay} />}
```

with:

```tsx
      <ShareBackdrop corrupted={corrupted} />
```

- [ ] **Step 4: Lift the content above the backdrop**

The backdrop is a positioned (`absolute`) child, so it paints above static siblings. Give the content wrapper its own stacking position. Change `padStyle` (currently line 189) from:

```tsx
const padStyle: React.CSSProperties = { padding: '22px 22px 16px', width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
```

to (add `position: 'relative', zIndex: 1`):

```tsx
const padStyle: React.CSSProperties = { position: 'relative', zIndex: 1, padding: '22px 22px 16px', width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
```

- [ ] **Step 5: Drop the flat gradient from `cardStyle`, keep a solid fallback**

Change `cardStyle` (currently lines 185-188) from:

```tsx
const cardStyle: React.CSSProperties = {
  position: 'relative', overflow: 'hidden', width: W, height: H, borderRadius: 14, border: '1px solid #1a2440',
  background: 'radial-gradient(120% 55% at 50% -6%, rgba(40,60,110,0.28), transparent 55%), radial-gradient(90% 50% at 50% 112%, rgba(150,110,50,0.14), transparent 60%), linear-gradient(180deg,#080c16,#05070e)',
};
```

to (background becomes a solid fallback that the SVG paints over; `position:relative` + `overflow:hidden` stay so the SVG is clipped to the rounded card):

```tsx
const cardStyle: React.CSSProperties = {
  position: 'relative', overflow: 'hidden', width: W, height: H, borderRadius: 14, border: '1px solid #1a2440',
  background: '#05070e',
};
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: PASS. In particular, no "`cardCxOverlay` is declared but never read" error (confirms Step 2 removed it cleanly) and no unused-import error.

- [ ] **Step 7: Commit**

```bash
git add src/components/share/ShareCard.tsx
git commit -m "fix(share): SVG backdrop replaces solid-red corrupted overlay"
```

---

### Task 3: Visual export verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite serves on http://localhost:5173.

- [ ] **Step 2: Verify the normal export**

Reach a completed reading (play through, or inject state via `?debug` + the JsonInjector +
`engine.loadState`, per the `repro-game-state-injection` memory). On the result screen click
**SHARE AS IMAGE** and open the exported PNG. Confirm:
- The background shows the star field (nebula tints + scattered stars + the faint
  constellation clusters), not a flat panel.
- Headline, rows, badge, footer/wordmark are all legible and inside the card; the `+ N more`
  cap and per-row fade still behave (regression check on the prior overflow fix).

- [ ] **Step 3: Verify the corrupted export**

Inject or reach a state with `corruption.band` set to `virulent` or `pinnacle`. Export again
and confirm the PNG shows:
- A crimson star field — **not** a solid red block.
- Visible scanlines, the 2-3 frozen mosh bars, and the red edge vignette.
- The chromatic-split headline.
- Reading rows still readable over the crimson field (if the nebula washes out row contrast,
  raise the row background opacity in `ShareCard.tsx`'s `rowStyle` and re-export).

- [ ] **Step 4: Final typecheck**

Run: `npm run build`
Expected: PASS.

---

## Self-Review notes

- **Spec coverage:** new `ShareBackdrop` (Task 1) covers the normal star field, crimson
  palette, scanlines, mosh bars, vignette; `ShareCard` rewiring (Task 2) covers removing the
  buggy overlay + flat gradient and the solid fallback; Task 3 covers the visual verification
  the spec requires. No spec section is unaddressed.
- **No placeholders:** every code step shows complete content.
- **Type consistency:** `ShareBackdrop`'s sole prop `corrupted: boolean` is produced in Task 1
  and consumed identically in Task 2. Interfaces `Star` / `ClusterStar` / `Cluster` are used
  only within Task 1.
- **Stacking:** Task 2 Steps 3-4 deliberately pair the positioned backdrop (`zIndex:0`) with a
  `position:relative; zIndex:1` content wrapper so foreground content paints above it.
