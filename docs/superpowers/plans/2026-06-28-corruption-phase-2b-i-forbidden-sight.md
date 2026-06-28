# Corruption Phase 2b-i — Forbidden-Sight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the forbidden-sight exploit end-to-end — a corruption-summoned glimpse of the six forces (one a plausible lie, corruption itself never shown), surfaced through a "watching tear" eye in the top-right corner that opens a hex force-radar overlay, costing corruption once per minigame.

**Architecture:** Engine support is framework-free TypeScript in `src/engine` (a `useForbiddenSight()` action on `GameEngine` that charges corruption once per minigame, picks the lie, and returns a glimpse payload; an availability flag on the snapshot). The UI is React: a reusable corruption visual kit (CSS), a `CorruptionRift` summon component mounted in `GameTable`, and a `ForceRadarOverlay` that renders the glimpse. This also establishes the shared "signature corruption" visual language reused by Phase 2b-ii and Phase 3.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + framer-motion; Vitest (Node env, **`src/engine/__tests__/**` only** — there is no component-test harness, so UI tasks are verified by `npm run build` + manual dev check, and all *logic* lives in engine tasks that ARE unit-tested).

## Global Constraints

- Engine code is framework-free: **zero React/DOM imports** in `src/engine` and `src/data`.
- The affinity/corruption scalars are hidden from the player; every signal is diegetic — never raw numbers. The radar shows force *intensities as a web*, not numeric values.
- **Forbidden-sight never reveals corruption itself** — corruption is a soft, borderless haze behind the radar web; it is never an axis, never a number, never bordered.
- **The lie:** exactly one (non-corruption) force is shown at a plausible wrong magnitude; the UI betrays it *only* by a pulse barely out of sync with the others.
- **Availability:** corruption band **Virulent+** only. **Cost:** corruption added on the **first** use per minigame; re-opening within the same minigame is free.
- **Signature visual language** (build once, reuse): white-hot text with **pulse-only** chromatic aberration (clean by default); red pixel-bar datamosh (horizontal slices); a sparse field of short **vertical** red data-segments that wink in/out on slow staggered stepped rhythms; thin **non-glowing** red fracture cracks. Palette: `#ff2d4a` (and `#c20f22`/`#ff6678` iris), pink glints `#ffb3bc`/`#ffc2ca`, void darks `#07010c`/`#180108`, white-hot `#fff`.
- Tuning values live in `src/data/corruption.ts`.
- Typecheck with `npx tsc -b`; engine tests with `npx vitest run <file>`; full suite `npm test`; production build `npm run build`.

## Reference: as-built code this plan integrates with

- `CorruptionEngine` (`src/engine/CorruptionEngine.ts`): `getValue()/getBand()/setValue(v)/clear()/tick(...)/serialize()/loadFrom()`. **No `add()` yet** (this plan adds it).
- `src/data/corruption.ts`: `CORRUPTION_BANDS` (`['dormant','seeded','spreading','virulent','pinnacle']`), `corruptionBandOf`, `PINNACLE=100`, plus rate constants.
- `src/engine/types.ts`: `AffinityId`, `CorruptionBand`, `CorruptionSnapshot`, `CorruptionWarning`; `GameState` already has `corruption`, `corruptionWarning`, `infectedMethods`.
- `GameEngine` (`src/engine/GameEngine.ts`): composes `private corruptionEngine: CorruptionEngine`; `notify()` (~line 104) sets `state.corruption`/`state.corruptionWarning`; `defaultState()` (~line 72); `confirmSelection()` (~line 328) is where the screen becomes `'minigame'`; `setCorruption(v)` (~line 560) exists for debug/tests; `AFFINITY_IDS` and `CORRUPTION_BANDS` are imported already (used by `deriveCorruptionWarning`).
- Player-action method pattern to mirror: `usePeek()` / `swapMethod()` — mutate via subsystems then call `this.notify()`.
- React bridge: `const { state, engine } = useGameEngine()` (`src/hooks/useGameEngine.ts`); overlays mount in `GameTable` (`src/components/screens/GameTable.tsx`).
- CSS convention: one global stylesheet `src/styles/theme.css` imported in `src/main.tsx`; `@keyframes` either there or in component `<style>` blocks (e.g. `StarField.tsx`).

---

### Task 1: Engine — availability flag + corruption `add()` + tuning constants

**Files:**
- Modify: `src/engine/CorruptionEngine.ts`
- Modify: `src/data/corruption.ts`
- Modify: `src/engine/types.ts` (`GameState`, ~line 576)
- Modify: `src/engine/GameEngine.ts` (`defaultState`, `notify`, new `forbiddenSightAvailable()`)
- Test: `src/engine/__tests__/ForbiddenSightAvailability.test.ts`

**Interfaces:**
- Consumes: `CORRUPTION_BANDS`, `corruptionBandOf`, `PINNACLE`.
- Produces: `CorruptionEngine.add(amount: number): void`; `SIGHT_COST`, `LIE_OFFSET` constants; `GameState.forbiddenSightAvailable: boolean`; `GameEngine.forbiddenSightAvailable(): boolean`.

- [ ] **Step 1: Write the failing test** at `src/engine/__tests__/ForbiddenSightAvailability.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CorruptionEngine } from '../CorruptionEngine';

describe('forbidden-sight availability (Virulent+)', () => {
  it('is false while corruption is below virulent', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    expect(e.getState().forbiddenSightAvailable).toBe(false);
  });

  it('is true at virulent and pinnacle', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    expect(e.getState().forbiddenSightAvailable).toBe(true);
    e.setCorruption(100); // pinnacle
    expect(e.getState().forbiddenSightAvailable).toBe(true);
  });

  it('defaults to false on a fresh engine', () => {
    expect(new GameEngine(3).getState().forbiddenSightAvailable).toBe(false);
  });
});

describe('CorruptionEngine.add', () => {
  it('adds and clamps to [0,100]', () => {
    const c = new CorruptionEngine();
    c.setValue(50); c.add(10);
    expect(c.getValue()).toBe(60);
    c.add(100);
    expect(c.getValue()).toBe(100);
    c.add(-500);
    expect(c.getValue()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/ForbiddenSightAvailability.test.ts`
Expected: FAIL — `forbiddenSightAvailable` is `undefined`; `add` is not a function.

- [ ] **Step 3: Add `add()` to `CorruptionEngine`**

In `src/engine/CorruptionEngine.ts`, after `clear()` (~line 27):

```typescript
  // Direct add (used by forbidden-sight's once-per-minigame cost). Clamped.
  add(amount: number): void { this.value = Math.max(0, Math.min(PINNACLE, this.value + amount)); }
```

- [ ] **Step 4: Add tuning constants**

In `src/data/corruption.ts`, append:

```typescript
export const SIGHT_COST = 6;   // corruption added on the first forbidden-sight use per minigame
export const LIE_OFFSET = 18;  // magnitude the one falsified force is shifted by
```

- [ ] **Step 5: Add the snapshot field**

In `src/engine/types.ts`, in `GameState`, add after `corruptionWarning: CorruptionWarning | null;` (~line 581):

```typescript
  forbiddenSightAvailable: boolean; // corruption Virulent+ — the watching eye may be summoned
```

- [ ] **Step 6: Default + derive the flag in `GameEngine`**

In `defaultState()`, add after `corruptionWarning: null,`:

```typescript
      forbiddenSightAvailable: false,
```

Add the helper after `deriveCorruptionWarning()` (search for that method; place this right after it):

```typescript
  // Forbidden-sight unlocks only at the virulent band or deeper.
  forbiddenSightAvailable(): boolean {
    return CORRUPTION_BANDS.indexOf(this.corruptionEngine.getBand()) >= CORRUPTION_BANDS.indexOf('virulent');
  }
```

In `notify()`, after `this.state.corruptionWarning = this.deriveCorruptionWarning();`, add:

```typescript
    this.state.forbiddenSightAvailable = this.forbiddenSightAvailable();
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/ForbiddenSightAvailability.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + full suite**

Run: `npx tsc -b && npm test`
Expected: no errors; all pass (new field is additive; `setCorruption` already notifies).

- [ ] **Step 9: Commit**

```bash
git add src/engine/CorruptionEngine.ts src/data/corruption.ts src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/ForbiddenSightAvailability.test.ts
git commit -m "feat(corruption): forbidden-sight availability flag + CorruptionEngine.add"
```

---

### Task 2: Engine — `useForbiddenSight()` glimpse, the lie, once-per-minigame cost

**Files:**
- Modify: `src/engine/types.ts` (new `ForbiddenGlimpse` interface)
- Modify: `src/engine/GameEngine.ts` (field, `confirmSelection` reset, `useForbiddenSight`)
- Test: `src/engine/__tests__/ForbiddenSight.test.ts`

**Interfaces:**
- Consumes: `SIGHT_COST`, `LIE_OFFSET` (Task 1); `AFFINITY_IDS`; `CorruptionEngine.add` (Task 1); `AffinityEngine.getState()`.
- Produces: `interface ForbiddenGlimpse { forces: Record<AffinityId, number>; lieId: AffinityId }`; `GameEngine.useForbiddenSight(rng?: () => number): ForbiddenGlimpse`.

- [ ] **Step 1: Add the `ForbiddenGlimpse` type**

In `src/engine/types.ts`, after the `CorruptionWarning` interface (~line 61):

```typescript
// A corruption glimpse of the six forces. `forces` already contains the falsified
// value at `lieId`; corruption itself is never included.
export interface ForbiddenGlimpse {
  forces: Record<AffinityId, number>;
  lieId: AffinityId;
}
```

- [ ] **Step 2: Write the failing test** at `src/engine/__tests__/ForbiddenSight.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { AFFINITY_IDS } from '../../data/affinities';
import { SIGHT_COST, LIE_OFFSET } from '../../data/corruption';
import type { AffinityId } from '../types';

const vec = (over: Partial<Record<AffinityId, number>>): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...over });

describe('useForbiddenSight — glimpse + lie', () => {
  it('returns all six forces; exactly one (the lie) is offset, the rest are true', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: vec({ chaos: 90 }) });
    e.setCorruption(80); // virulent
    const g = e.useForbiddenSight(() => 0); // rng=0 → lieId = AFFINITY_IDS[0] = 'chaos', dir = -1
    expect(g.lieId).toBe('chaos');
    expect(g.forces.chaos).toBe(90 - LIE_OFFSET); // falsified
    expect(g.forces.order).toBe(50);              // untouched
    expect(Object.keys(g.forces).sort()).toEqual([...AFFINITY_IDS].sort());
    expect('corruption' in g.forces).toBe(false); // never itself
  });

  it('clamps the lie into [0,100]', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: vec({ chaos: 5 }) });
    e.setCorruption(80);
    const g = e.useForbiddenSight(() => 0); // chaos, dir -1 → 5-18 → clamp 0
    expect(g.forces.chaos).toBe(0);
  });
});

describe('useForbiddenSight — cost once per minigame', () => {
  it('charges SIGHT_COST on first use, is free on re-open, recharges in a new minigame', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.setCorruption(80);
    const before = e.getState().corruption.value;

    e.useForbiddenSight(() => 0);
    const afterFirst = e.getState().corruption.value;
    expect(afterFirst).toBe(before + SIGHT_COST);

    e.useForbiddenSight(() => 0);
    expect(e.getState().corruption.value).toBe(afterFirst); // re-open free

    e.selectMethod(0); // enter a new minigame → flag resets
    e.useForbiddenSight(() => 0);
    expect(e.getState().corruption.value).toBe(afterFirst + SIGHT_COST); // charges again
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/ForbiddenSight.test.ts`
Expected: FAIL — `useForbiddenSight` is not a function.

- [ ] **Step 4: Add the per-minigame flag and reset it on entering a minigame**

In `src/engine/GameEngine.ts`, add a field near the other per-turn flags (search for `private happeningOfferedThisTurn`):

```typescript
  private forbiddenSightUsedThisMinigame = false;
```

In `confirmSelection()`, after `const pending = this.state.drawPhase?.pendingSelection;` and the `if (!pending) return;` guard, add:

```typescript
    this.forbiddenSightUsedThisMinigame = false; // each minigame allows one charged glimpse
```

- [ ] **Step 5: Add the `useForbiddenSight` method**

In `src/engine/GameEngine.ts`, add near the other information actions (after `declinePeek()` is a good home):

```typescript
  // Corruption's glimpse of the six forces. Charges corruption once per minigame,
  // shows the true effective forces with exactly one (the lie) shifted by LIE_OFFSET,
  // and never includes corruption itself. `rng` is injectable for tests.
  useForbiddenSight(rng: () => number = Math.random): import('./types').ForbiddenGlimpse {
    if (!this.forbiddenSightUsedThisMinigame) {
      this.corruptionEngine.add(SIGHT_COST);
      this.forbiddenSightUsedThisMinigame = true;
    }
    const forces = this.affinityEngine.getState(); // fresh effective vector (safe to mutate the copy)
    const lieId = AFFINITY_IDS[Math.floor(rng() * AFFINITY_IDS.length)];
    const dir = rng() < 0.5 ? -1 : 1;
    forces[lieId] = Math.max(0, Math.min(100, forces[lieId] + dir * LIE_OFFSET));
    this.notify();
    return { forces, lieId };
  }
```

- [ ] **Step 6: Import the constants**

Extend the corruption-data import in `src/engine/GameEngine.ts` to include `SIGHT_COST, LIE_OFFSET` (add them to the existing `from '../data/corruption'` import line):

```typescript
import { RUPTURE_RESET, infectedCountForBand, INFECTION_GAIN_MULT, CORRUPTED_TAG, CORRUPTION_BANDS, SIGHT_COST, LIE_OFFSET } from '../data/corruption';
```

(If the existing import list differs, keep its members and append `SIGHT_COST, LIE_OFFSET`.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/ForbiddenSight.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + full suite**

Run: `npx tsc -b && npm test`
Expected: no errors; all pass.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/ForbiddenSight.test.ts
git commit -m "feat(corruption): useForbiddenSight glimpse with the lie + once-per-minigame cost"
```

---

### Task 3: Shared corruption visual kit (CSS)

**Files:**
- Create: `src/styles/corruption.css`
- Modify: `src/main.tsx` (import the stylesheet)

**Interfaces:**
- Produces: reusable CSS classes consumed by Tasks 4: `.cx-glitch-text`, `.cx-desync`, `.cx-eye-iris`, `.cx-eye-glow`, `.cx-eye-lid`, `.cx-haze`, segment flicker `.cx-fa`/`.cx-fb`/`.cx-fc`/`.cx-fd`/`.cx-fe`, twinkle `.cx-tk1`..`.cx-tk4`.

> No automated test (no CSS/DOM harness). Verified by `npm run build` and consumed visually in Task 4.

- [ ] **Step 1: Create `src/styles/corruption.css`**

```css
/* Signature corruption visual language — reused by forbidden-sight, force-the-weave, and Phase 3. */

/* White-hot text: clean by default; chromatic split only on the periodic pulse. */
.cx-glitch-text { fill: #fff; filter: drop-shadow(0 0 3px rgba(255,45,74,.55)); animation: cx-pab 3.2s infinite; }
@keyframes cx-pab {
  0%,91%,100% { filter: drop-shadow(0 0 3px rgba(255,45,74,.55)); }
  94% { filter: drop-shadow(-3px 0 #ff003c) drop-shadow(3px 0 #00e5ff); }
  97% { filter: drop-shadow(3px 0 #ff003c) drop-shadow(-3px 0 #00e5ff); }
}
/* The lie: same look, pulse a hair off-beat. */
.cx-desync { animation: cx-pab 3.05s infinite; }

/* Eye (rift). */
.cx-eye-iris { transform-box: fill-box; transform-origin: center; animation: cx-gaze 6s ease-in-out infinite; }
@keyframes cx-gaze { 0%,100%{transform:translate(0,0)} 30%{transform:translate(1.2px,.8px)} 60%{transform:translate(-1.2px,-.8px)} }
.cx-eye-glow { animation: cx-eglow 2.8s ease-in-out infinite; }
@keyframes cx-eglow { 0%,100%{opacity:.5} 50%{opacity:.95} }
.cx-eye-lid { transform-box: fill-box; transform-origin: center; animation: cx-blink 6s infinite; }
@keyframes cx-blink { 0%,95.5%,100%{transform:scaleY(0)} 97.5%{transform:scaleY(1)} }

/* Corruption haze (radar): soft breathing, behind the web. */
.cx-haze { animation: cx-breathe 5s ease-in-out infinite; transform-origin: center; }
@keyframes cx-breathe { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.72;transform:scale(1.06)} }

/* Data-stream segments: wink in/out on slow, staggered, stepped rhythms. */
.cx-fa{animation:cx-fk 2.6s steps(1) infinite}.cx-fb{animation:cx-fk 3.2s steps(1) infinite}.cx-fc{animation:cx-fk 3.8s steps(1) infinite}.cx-fd{animation:cx-fk 4.6s steps(1) infinite}.cx-fe{animation:cx-fk 3.0s steps(1) infinite}
@keyframes cx-fk { 0%{opacity:0} 10%{opacity:1} 30%{opacity:.4} 48%{opacity:.95} 66%{opacity:0} 100%{opacity:0} }
.cx-tk1{animation:cx-tw 2.4s steps(1) infinite}.cx-tk2{animation:cx-tw 3.0s steps(1) infinite}.cx-tk3{animation:cx-tw 2.0s steps(1) infinite}.cx-tk4{animation:cx-tw 3.4s steps(1) infinite}
@keyframes cx-tw { 0%,45%,100%{opacity:0} 52%{opacity:1} 62%{opacity:.3} 72%{opacity:.9} 82%{opacity:0} }
```

- [ ] **Step 2: Import it globally**

In `src/main.tsx`, add after the existing `import './styles/theme.css';`:

```typescript
import './styles/corruption.css';
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `tsc -b` passes and Vite bundles with no errors (the CSS is bundled).

- [ ] **Step 4: Commit**

```bash
git add src/styles/corruption.css src/main.tsx
git commit -m "feat(corruption): shared signature visual kit (glitch text, eye, haze, data-streams)"
```

---

### Task 4: Forbidden-sight UI — the watching rift + hex force-radar

**Files:**
- Create: `src/components/overlays/corruption/CorruptionRift.tsx`
- Create: `src/components/overlays/corruption/ForceRadarOverlay.tsx`
- Modify: `src/components/screens/GameTable.tsx`
- (No unit test — no component harness. Verified by `npm run build` + manual dev check; the logic is covered by Tasks 1–2.)

**Interfaces:**
- Consumes: `GameState.forbiddenSightAvailable`, `GameEngine.useForbiddenSight()` → `ForbiddenGlimpse`; CSS classes from Task 3; `useGameEngine()`.
- Produces: `CorruptionRift` (props: `{ onSummon: () => void }`), `ForceRadarOverlay` (props: `{ glimpse: ForbiddenGlimpse; onDismiss: () => void }`).

- [ ] **Step 1: Create the rift summon — `src/components/overlays/corruption/CorruptionRift.tsx`**

```tsx
// The "watching tear": a torn rift in the top-right corner with an eye peering out.
// Tempting to press (it pulses and the data-streams stir); summons the glimpse.
import type { CSSProperties } from 'react';

const SEG = [
  ['cx-fa',0.0,6,36,9,.30],['cx-fc',1.0,8,52,5,.26],['cx-fb',2.0,10,22,8,.30],['cx-fe',.6,12,60,7,.28],
  ['cx-fd',1.6,14,40,11,.34],['cx-fa',2.4,16,14,6,.30],['cx-fc',.4,18,48,5,.26],['cx-fb',1.4,20,30,9,.32],
  ['cx-fe',2.6,22,64,6,.28],['cx-fd',.8,24,18,8,.32],['cx-fa',1.8,26,44,11,.36],['cx-fc',2.8,28,56,5,.28],
  ['cx-fb',.5,30,24,8,.32],['cx-fe',1.5,32,12,7,.34],['cx-fd',2.2,33,68,6,.28],['cx-fa',.9,34,38,12,.38],
  ['cx-fc',1.9,36,52,6,.30],['cx-fb',2.9,38,28,9,.34],['cx-fe',.7,40,60,5,.28],['cx-fd',1.7,42,18,8,.32],
  ['cx-fa',2.5,44,46,10,.36],['cx-fc',.3,46,34,7,.32],['cx-fb',1.3,48,56,6,.30],['cx-fe',2.3,50,24,8,.32],
  ['cx-fd',1.1,52,42,6,.30],['cx-fa',2.1,54,52,5,.26],['cx-fc',.95,56,32,7,.28],
] as const;
const TWK = [['cx-tk1',14,42],['cx-tk2',26,46],['cx-tk3',34,40],['cx-tk4',44,48]] as const;
const CRACKS = ['M44,34 L51,29','M48,62 L55,67','M38,70 L41,79 M40,74 L36,81','M18,60 L11,64','M24,30 L17,23','M38,16 L43,9','M22,50 L15,52'];
const RIFT = 'M32,5 L38,16 L34,24 L44,34 L40,42 L54,47 L44,52 L48,62 L38,70 L42,80 L32,88 L24,80 L26,70 L18,60 L22,50 L10,47 L20,40 L24,30 L16,22 L26,16 Z';

export default function CorruptionRift({ onSummon }: { onSummon: () => void }) {
  return (
    <button type="button" aria-label="Something watches" style={btnStyle} onClick={onSummon}>
      <svg width="48" height="68" viewBox="-8 -10 80 112">
        <defs>
          <radialGradient id="cx-ir" cx="52%" cy="48%"><stop offset="0%" stopColor="#ff6678"/><stop offset="45%" stopColor="#c20f22"/><stop offset="100%" stopColor="#3a0410"/></radialGradient>
          <radialGradient id="cx-vd"><stop offset="0%" stopColor="#180108"/><stop offset="100%" stopColor="#07010c"/></radialGradient>
          <clipPath id="cx-riftclip"><path d={RIFT}/></clipPath>
        </defs>
        <g>
          {SEG.map(([cls, delay, x, y, h, op], i) => (
            <rect key={i} className={cls} x={x} y={y} width={1.6} height={h} fill="#ff2d4a" fillOpacity={op} style={{ animationDelay: `${delay}s` }} />
          ))}
          {TWK.map(([cls, x, y], i) => (
            <rect key={`t${i}`} className={cls} x={x} y={y} width={2} height={4.5} fill="#ffc2ca" />
          ))}
        </g>
        <g stroke="#ff2d4a" fill="none" strokeWidth={0.8}>
          {CRACKS.map((d, i) => <path key={i} d={d} strokeOpacity={0.5} />)}
        </g>
        <path d={RIFT} fill="url(#cx-vd)" stroke="#ff2d4a" strokeWidth={1} strokeOpacity={0.55} />
        <g clipPath="url(#cx-riftclip)">
          <g className="cx-eye-iris">
            <ellipse className="cx-eye-glow" cx={32} cy={47} rx={14} ry={8} fill="#ff2d4a" fillOpacity={0.13} />
            <path d="M20,47 Q32,38 44,47 Q32,56 20,47 Z" fill="#0c0306" />
            <circle cx={34} cy={47} r={6} fill="url(#cx-ir)" />
            <circle cx={34} cy={47} r={2.4} fill="#0a0002" />
            <circle cx={35.6} cy={44.8} r={1.2} fill="#ffd9dd" />
            <path className="cx-eye-lid" d="M20,47 Q32,38 44,47 Q32,56 20,47 Z" fill="#0c0306" />
          </g>
        </g>
      </svg>
    </button>
  );
}

const btnStyle: CSSProperties = {
  position: 'absolute', top: '12px', right: '12px', zIndex: 20,
  width: '52px', height: '72px', padding: 0, border: 'none', background: 'transparent',
  cursor: 'pointer', outline: 'none', lineHeight: 0,
};
```

- [ ] **Step 2: Create the radar overlay — `src/components/overlays/corruption/ForceRadarOverlay.tsx`**

```tsx
// The glimpse: a hex force-radar of the six affinities (polar pairs opposite),
// corruption a soft haze BEHIND the web, the lie betrayed only by an off-beat pulse.
import type { CSSProperties } from 'react';
import type { ForbiddenGlimpse, AffinityId } from '../../../engine/types';

const C = 130, CY = 132, R = 95;
// id, unit vector (y-down), label position, text-anchor
const AXES: { id: AffinityId; ux: number; uy: number; lx: number; ly: number; anchor: 'start'|'middle'|'end'; name: string }[] = [
  { id: 'chaos',  ux: 0,      uy: -1,   lx: 130, ly: 24,  anchor: 'middle', name: 'Chaos'  },
  { id: 'will',   ux: 0.866,  uy: -0.5, lx: 224, ly: 82,  anchor: 'start',  name: 'Will'   },
  { id: 'shadow', ux: 0.866,  uy: 0.5,  lx: 224, ly: 190, anchor: 'start',  name: 'Shadow' },
  { id: 'order',  ux: 0,      uy: 1,    lx: 130, ly: 250, anchor: 'middle', name: 'Order'  },
  { id: 'fate',   ux: -0.866, uy: 0.5,  lx: 36,  ly: 190, anchor: 'end',    name: 'Fate'   },
  { id: 'light',  ux: -0.866, uy: -0.5, lx: 36,  ly: 82,  anchor: 'end',    name: 'Light'  },
];
const pt = (ux: number, uy: number, r: number) => `${(C + ux * r).toFixed(1)},${(CY + uy * r).toFixed(1)}`;
const hexAt = (r: number) => AXES.map((a) => pt(a.ux, a.uy, r)).join(' ');

export default function ForceRadarOverlay({ glimpse, onDismiss }: { glimpse: ForbiddenGlimpse; onDismiss: () => void }) {
  const web = AXES.map((a) => pt(a.ux, a.uy, R * Math.max(0, Math.min(100, glimpse.forces[a.id])) / 100)).join(' ');
  return (
    <div style={scrimStyle} onClick={onDismiss}>
      <svg width="280" height="280" viewBox="0 0 260 270" onClick={(e) => e.stopPropagation()}>
        <defs>
          <radialGradient id="cx-rhaze"><stop offset="0%" stopColor="#4a0614"/><stop offset="55%" stopColor="#1c0309"/><stop offset="100%" stopColor="rgba(28,3,9,0)"/></radialGradient>
        </defs>
        <ellipse className="cx-haze" cx={C} cy={CY} rx={74} ry={70} fill="url(#cx-rhaze)" />
        <polygon points={hexAt(R)} fill="none" stroke="#9b6bb0" strokeOpacity={0.19} />
        <polygon points={hexAt(R / 2)} fill="none" stroke="#9b6bb0" strokeOpacity={0.13} />
        <g stroke="#9b6bb0" strokeOpacity={0.13}>
          {AXES.map((a) => <line key={a.id} x1={C} y1={CY} x2={C + a.ux * R} y2={CY + a.uy * R} />)}
        </g>
        <polygon points={web} fill="#ff2d4a" fillOpacity={0.13} stroke="#ff2d4a" strokeWidth={1.5} />
        {AXES.map((a) => (
          <text key={a.id} className={`cx-glitch-text${a.id === glimpse.lieId ? ' cx-desync' : ''}`}
                x={a.lx} y={a.ly} textAnchor={a.anchor} fontSize={13} fontFamily="'Cormorant Garamond', serif">
            {a.name}
          </text>
        ))}
      </svg>
    </div>
  );
}

const scrimStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(4,6,12,0.82)', cursor: 'pointer',
};
```

- [ ] **Step 3: Mount them in `GameTable`**

In `src/components/screens/GameTable.tsx`:

Add imports (with the other overlay imports, ~line 20):

```tsx
import CorruptionRift from '../overlays/corruption/CorruptionRift';
import ForceRadarOverlay from '../overlays/corruption/ForceRadarOverlay';
import type { ForbiddenGlimpse } from '../../engine/types';
```

Change the hook line (line 23) to also pull `engine`, and add glimpse state:

```tsx
  const { state, engine } = useGameEngine();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [glimpse, setGlimpse] = useState<ForbiddenGlimpse | null>(null);
```

Inside the `hubStyle` div, just before `<ParticleField />` (~line 104), add:

```tsx
      {state.forbiddenSightAvailable && showTableau && (
        <CorruptionRift onSummon={() => setGlimpse(engine.useForbiddenSight())} />
      )}
      {glimpse && <ForceRadarOverlay glimpse={glimpse} onDismiss={() => setGlimpse(null)} />}
```

- [ ] **Step 4: Verify the build (typecheck + bundle)**

Run: `npm run build`
Expected: `tsc -b` passes (props/types line up) and Vite bundles with no errors.

- [ ] **Step 5: Manual dev check**

Run: `npm run dev` → open http://localhost:5173. Start a reading and enter a minigame. To make the eye appear, drive corruption to the virulent band (e.g. via the debug panel, or temporarily call `engine.setCorruption(80)` from a dev build). Confirm:
- the watching rift appears in the **top-right**, eye blinking/gazing, data-streams winking in/out;
- clicking it opens the **hex radar** (centered, dark scrim), with corruption as a soft haze behind the web and one label pulsing slightly off-beat;
- tapping the scrim dismisses it; re-opening within the same minigame does not further raise corruption (Tasks 1–2 already prove the cost logic).

- [ ] **Step 6: Commit**

```bash
git add src/components/overlays/corruption/CorruptionRift.tsx src/components/overlays/corruption/ForceRadarOverlay.tsx src/components/screens/GameTable.tsx
git commit -m "feat(corruption): forbidden-sight UI — watching rift + hex force-radar"
```

---

### Task 5: Documentation sync

**Files:**
- Modify: `docs/game-systems.md` (extend the Corruption section)
- Modify: `README.md` (extend the corruption note)

**Interfaces:** none. Required by `CLAUDE.md`.

- [ ] **Step 1: Extend `docs/game-systems.md`**

Append under the Corruption section:

```markdown
### Forbidden-sight (Phase 2b-i)

At the **virulent** band, a watching tear (`CorruptionRift`, top-right) can be summoned.
It calls `GameEngine.useForbiddenSight()`, which charges corruption **once per minigame**
(`SIGHT_COST`) and returns a `ForbiddenGlimpse` — the six effective forces with exactly
one (`lieId`) shifted by `LIE_OFFSET`. The `ForceRadarOverlay` renders them as a hex
radar; corruption is a soft haze *behind* the web and never shown; the lie is betrayed
only by a label pulsing a hair off-beat. Following the glimpse can guide the player, but
the act of looking feeds corruption — and the Light high enough to keep glimpsing is
itself the excess that sustains it.
```

- [ ] **Step 2: Extend the README corruption note**

Add a sentence to the corruption paragraph in `README.md`:

```markdown
When corruption runs deep, a watching tear opens at the edge of the world — peer through
it and the hidden forces show themselves, though one of them is always a lie, and looking
only feeds the thing that watches back.
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(corruption): document forbidden-sight (phase 2b-i)"
```

---

## Self-Review

**Spec coverage (forbidden-sight slice of the Phase 2b spec):**
- Glimpse of the six forces, never corruption itself → Task 2 (`useForbiddenSight`), Task 4 (`ForceRadarOverlay` haze-behind). ✓
- The plausible lie, betrayed only by an off-beat pulse → Task 2 (`lieId`/offset), Task 4 (`.cx-desync` on the lie label). ✓
- Availability Virulent+ → Task 1. ✓
- Cost once per minigame → Task 2. ✓
- Watching tear, top-right, tempting, eye peering/blinking, scattered cracks, sparse flickering data-stream aura → Task 4 (`CorruptionRift`) + Task 3 kit. ✓
- Hex radar, polar pairs opposite, summoned centered overlay, scrim, tap-dismiss, mobile → Task 4. ✓
- Signature visual language (pulse-only aberration, data-streams, non-glowing cracks) → Task 3. ✓
- Docs → Task 5. ✓

**Out of scope (deferred):** force-the-weave (engine actions + per-minigame affordance tab) → Phase 2b-ii; the optional on-use "aftershock" glitch; staging corruption in debug scenarios. Force-the-weave will reuse the Task 3 visual kit and the `.cx-glitch-text` tab styling.

**Type consistency:** `ForbiddenGlimpse { forces: Record<AffinityId,number>; lieId: AffinityId }` defined in Task 2, consumed by `ForceRadarOverlay`/`GameTable` (Task 4). `useForbiddenSight(rng?)` signature matches `onSummon={() => setGlimpse(engine.useForbiddenSight())}`. `forbiddenSightAvailable` (Task 1) gates the rift mount (Task 4). CSS class names (`.cx-glitch-text`, `.cx-desync`, `.cx-eye-*`, `.cx-haze`, `.cx-fa..fe`, `.cx-tk1..4`) defined in Task 3, used verbatim in Task 4.

**Placeholder scan:** none — every code/test step carries complete content. UI tasks (3–4) intentionally use build + manual verification because the repo's Vitest harness runs `src/engine/__tests__` only; all *logic* is unit-tested in Tasks 1–2.
