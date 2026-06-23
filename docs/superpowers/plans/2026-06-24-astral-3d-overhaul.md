# Astral Minigame 3D Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the astral minigame's flat 2D Matter.js tokens with real 3D d12 dice (three.js + cannon-es) on a visually rich, pre-visible zodiac board, with a weakened center-vortex so dice spread across slices.

**Architecture:** All new code lives in the React/component layer; the engine stays framework-free. The board component's `onSettled(cast: AstralCast)` contract to the engine is unchanged, so engine logic, responders, and Vitest engine tests are untouched. Pure, testable math (sector mapping, top-face readout, omen predicates, affinity→physics tuning, natural-zodiac mapping) is added to `src/engine/` and `src/data/` with unit tests. The 3D scene (board, dice, camera, physics) lives in a new `src/components/screens/celestial/` module folder and is verified by typecheck + manual dev-server observation.

**Tech Stack:** React 18 + TypeScript + Vite, three.js (3D rendering), cannon-es (3D physics), Vitest (engine tests).

**Dice physics model (decided):** Each die is a cannon-es **Sphere** collider with a three.js **DodecahedronGeometry** visual mesh and 12 glyph planes (one per face). Dice tumble as spheres; on settle each die **snaps** (short slerp) so its up-most face points exactly to +Y, guaranteeing a clean readout. The same snap mechanism orients dice to a `target` cast for debug scenarios. `veiled-oracle` remains **timeout-based** (slow settle), as in the current 2D version.

## Global Constraints

- Engine code (`src/engine/**`) MUST NOT import React, the DOM, three.js, or cannon-es. Pure helpers added there use plain numbers/objects only. (Per CLAUDE.md engine/React split.)
- Every engine mutator that changes state ends with `notify()` — N/A here (no engine state changes), but do not alter the engine event/affinity systems.
- Vitest runs ONLY `src/engine/__tests__/**` in Node (no DOM). New unit tests go there.
- Typecheck is the lint gate: `npm run build` runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`. No unused vars/params.
- Keep docs in sync: when omen/affinity/board behavior changes, update `docs/game-systems.md` and `README.md` (per CLAUDE.md Documentation rule).
- The board component's external contract is: it calls `onSettled(cast: AstralCast)` exactly once per cast, where `AstralCast = { planet: PlanetId; sign: SignId; planetHouse: number; signHouse: number; omens: OmenTag[] }`. Do not change `AstralCast`, `AstralResult`, or `consolidateCast`.
- Cleared art is CC0 OpenClipart "Line Art Zodiac Signs" (https://openclipart.org/detail/284446/line-art-zodiac-signs). No attribution required; record provenance in `src/assets/zodiac/SOURCE.md`.

---

## File Structure

**Create (engine / data — pure, tested):**
- `src/engine/astralGeometry.ts` — Vec3/Quat types, board constants, `sectorOf`, `rotateVec3ByQuat`, `topFaceIndex`, `sectorCenter`, omen predicates.
- `src/engine/__tests__/AstralGeometry.test.ts`
- `src/engine/astralPhysics.ts` — `CastTuning` + `castTuning(affinities)` (the vortex/scatter tuning).
- `src/engine/__tests__/AstralPhysics.test.ts`

**Modify (data — pure, tested):**
- `src/data/astromancy.ts` — add `NATURAL_ZODIAC_BY_HOUSE`.
- `src/engine/__tests__/Astromancy.test.ts` — add mapping test (file already exists; append).

**Create (assets):**
- `src/assets/zodiac/{aries,taurus,gemini,cancer,leo,virgo,libra,scorpio,sagittarius,capricorn,aquarius,pisces}.svg`
- `src/assets/zodiac/SOURCE.md`

**Create (3D component layer — manual verification):**
- `src/components/screens/celestial/signArt.ts` — static `?url` imports of the 12 SVGs → `SIGN_ART` map.
- `src/components/screens/celestial/board.ts` — `createBoard()` builds the textured board group (canvas texture + framing + fallback).
- `src/components/screens/celestial/dice.ts` — `createDie`, `computeFaceData`, `readTopFace`, `snapToFace`, `faceIndexOfId`.
- `src/components/screens/celestial/scene.ts` — `createCelestialScene` (renderer, lights, camera tween, physics loop, settle/omen, idle, roll).

**Rewrite:**
- `src/components/screens/CelestialCast.tsx` — React wrapper; `forwardRef` imperative `roll(target?)`; same `onSettled`; WebGL/reduced-motion fallback.

**Modify:**
- `src/components/screens/AstralMinigame.tsx` — persistent board (visible in idle), sequential two-cast rolling via ref, fallback wiring.
- `package.json` — add `three`, `cannon-es`, `@types/three`.
- `README.md`, `docs/game-systems.md` — docs sync.

---

## Task 1: Add 3D dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install three@^0.169.0 cannon-es@^0.20.0
npm install -D @types/three@^0.169.0
```
Expected: packages added to `package.json` dependencies/devDependencies, no peer-dep errors.

- [ ] **Step 2: Verify typecheck/build still passes**

Run: `npm run build`
Expected: PASS (clean `tsc -b`, Vite bundles to `dist/`). If `three` version and `@types/three` version mismatch causes type errors, align them to the same minor (e.g. both `0.169.x`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add three.js and cannon-es for 3D astral minigame"
```

---

## Task 2: Pure astral geometry helpers (engine)

**Files:**
- Create: `src/engine/astralGeometry.ts`
- Test: `src/engine/__tests__/AstralGeometry.test.ts`

**Interfaces:**
- Produces:
  - `type Vec3 = { x: number; y: number; z: number }`
  - `type Quat = { x: number; y: number; z: number; w: number }`
  - `const BOARD_RADIUS = 5` (world units), `const CONJUNCTION_DIST = 1.4`
  - `function sectorOf(x: number, z: number): number` → 1..12 (house 1 centered at board "top", increasing clockwise)
  - `function sectorCenter(house: number, radius: number): { x: number; z: number }`
  - `function rotateVec3ByQuat(v: Vec3, q: Quat): Vec3`
  - `function topFaceIndex(faceNormals: Vec3[], q: Quat): number`
  - `function isErrantStar(x: number, z: number): boolean`
  - `function isCrownedConjunction(a: Vec3, b: Vec3): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AstralGeometry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  sectorOf, sectorCenter, rotateVec3ByQuat, topFaceIndex,
  isErrantStar, isCrownedConjunction, BOARD_RADIUS,
} from '../astralGeometry';

describe('sectorOf', () => {
  it('puts the board top (x=0, z<0) in house 1', () => {
    expect(sectorOf(0, -1)).toBe(1);
  });
  it('increases clockwise: right side is house 4', () => {
    expect(sectorOf(1, 0)).toBe(4);
  });
  it('bottom is house 7', () => {
    expect(sectorOf(0, 1)).toBe(7);
  });
  it('left side is house 10', () => {
    expect(sectorOf(-1, 0)).toBe(10);
  });
  it('always returns 1..12', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const a = (deg * Math.PI) / 180;
      const h = sectorOf(Math.sin(a), -Math.cos(a));
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThanOrEqual(12);
    }
  });
});

describe('sectorCenter', () => {
  it('round-trips back to the same house via sectorOf', () => {
    for (let h = 1; h <= 12; h++) {
      const c = sectorCenter(h, 3);
      expect(sectorOf(c.x, c.z)).toBe(h);
    }
  });
});

describe('rotateVec3ByQuat', () => {
  it('identity quaternion leaves the vector unchanged', () => {
    const v = rotateVec3ByQuat({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0, w: 1 });
    expect(v.x).toBeCloseTo(1); expect(v.y).toBeCloseTo(2); expect(v.z).toBeCloseTo(3);
  });
  it('90° about Z maps +X to +Y', () => {
    const q = { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) };
    const v = rotateVec3ByQuat({ x: 1, y: 0, z: 0 }, q);
    expect(v.x).toBeCloseTo(0); expect(v.y).toBeCloseTo(1); expect(v.z).toBeCloseTo(0);
  });
});

describe('topFaceIndex', () => {
  const normals = [
    { x: 0, y: 1, z: 0 },  // up
    { x: 0, y: -1, z: 0 }, // down
    { x: 1, y: 0, z: 0 },  // side
  ];
  it('picks the face already pointing up under identity rotation', () => {
    expect(topFaceIndex(normals, { x: 0, y: 0, z: 0, w: 1 })).toBe(0);
  });
  it('picks the face that rotates to up', () => {
    // 180° about Z flips +Y(normal 0) down and -Y(normal 1) up
    const q = { x: 0, y: 0, z: 1, w: 0 };
    expect(topFaceIndex(normals, q)).toBe(1);
  });
});

describe('omen predicates', () => {
  it('errant-star when settled beyond the board radius', () => {
    expect(isErrantStar(BOARD_RADIUS + 0.5, 0)).toBe(true);
    expect(isErrantStar(0, 0)).toBe(false);
  });
  it('crowned-conjunction when the two dice are close', () => {
    expect(isCrownedConjunction({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0.5 })).toBe(true);
    expect(isCrownedConjunction({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 4 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AstralGeometry.test.ts`
Expected: FAIL — cannot find module `../astralGeometry`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/astralGeometry.ts`:
```ts
// Pure 3D geometry helpers for the astral minigame. No three.js / DOM imports —
// the component layer passes plain numbers in and reads plain results out.

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }

// World-space board radius (three.js units). The board plane is X–Z; +Y is up;
// the camera looks down −Y. "Top" of the board is −Z.
export const BOARD_RADIUS = 5;
export const CONJUNCTION_DIST = 1.4;

const TAU = Math.PI * 2;
const SECTOR = Math.PI / 6; // 30°

// House 1 is centered at the board top (−Z), houses increase clockwise.
export function sectorOf(x: number, z: number): number {
  const a = Math.atan2(x, -z);          // 0 = top, +π/2 = right (clockwise)
  const t = (a + SECTOR / 2 + TAU) % TAU; // shift so house 1 is centered on top
  return (Math.floor(t / SECTOR) % 12) + 1;
}

// Center (x,z) of a house wedge at a given radius — inverse of sectorOf's mid-angle.
export function sectorCenter(house: number, radius: number): { x: number; z: number } {
  const a = (house - 1) * SECTOR; // house 1 → a=0 (top)
  return { x: Math.sin(a) * radius, z: -Math.cos(a) * radius };
}

// Rotate a vector by a unit quaternion: v' = q * v * q⁻¹ (expanded form).
export function rotateVec3ByQuat(v: Vec3, q: Quat): Vec3 {
  const { x, y, z } = v;
  const ix = q.w * x + q.y * z - q.z * y;
  const iy = q.w * y + q.z * x - q.x * z;
  const iz = q.w * z + q.x * y - q.y * x;
  const iw = -q.x * x - q.y * y - q.z * z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

// Index of the face whose (rotated) normal points most directly up (+Y).
export function topFaceIndex(faceNormals: Vec3[], q: Quat): number {
  let best = 0;
  let bestY = -Infinity;
  for (let i = 0; i < faceNormals.length; i++) {
    const y = rotateVec3ByQuat(faceNormals[i], q).y;
    if (y > bestY) { bestY = y; best = i; }
  }
  return best;
}

export function isErrantStar(x: number, z: number): boolean {
  return Math.hypot(x, z) > BOARD_RADIUS;
}

export function isCrownedConjunction(a: Vec3, b: Vec3): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < CONJUNCTION_DIST;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AstralGeometry.test.ts`
Expected: PASS (all cases). If the `sectorOf` direction cases fail, re-check the `atan2(x, -z)` argument order — `x` first, `-z` second.

- [ ] **Step 5: Commit**

```bash
git add src/engine/astralGeometry.ts src/engine/__tests__/AstralGeometry.test.ts
git commit -m "feat(astral): pure 3D geometry helpers (sector, top-face, omens)"
```

---

## Task 3: Affinity → physics tuning (engine)

**Files:**
- Create: `src/engine/astralPhysics.ts`
- Test: `src/engine/__tests__/AstralPhysics.test.ts`

**Interfaces:**
- Produces:
  - `interface CastTuning { centering: number; restitution: number; scatter: number; linearDamping: number; angularDamping: number; lateralBias: number; turbulence: number }`
  - `function castTuning(affinities: Record<string, number>): CastTuning`

This encodes the vortex fix: centering is small and order-scaled; chaos raises restitution/scatter/turbulence and lowers damping; light−shadow sets lateral bias.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/AstralPhysics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { castTuning } from '../astralPhysics';

const A = (o: Partial<Record<string, number>>) =>
  ({ order: 50, chaos: 50, light: 50, shadow: 50, ...o }) as Record<string, number>;

describe('castTuning', () => {
  it('keeps centering gentle (much weaker than the old 2D vortex)', () => {
    expect(castTuning(A({})).centering).toBeLessThan(1.2);
  });
  it('order increases centering and linear damping', () => {
    const lo = castTuning(A({ order: 10 }));
    const hi = castTuning(A({ order: 90 }));
    expect(hi.centering).toBeGreaterThan(lo.centering);
    expect(hi.linearDamping).toBeGreaterThan(lo.linearDamping);
  });
  it('chaos increases restitution, scatter, and turbulence', () => {
    const lo = castTuning(A({ chaos: 10 }));
    const hi = castTuning(A({ chaos: 90 }));
    expect(hi.restitution).toBeGreaterThan(lo.restitution);
    expect(hi.scatter).toBeGreaterThan(lo.scatter);
    expect(hi.turbulence).toBeGreaterThan(lo.turbulence);
  });
  it('lateral bias follows light minus shadow', () => {
    expect(castTuning(A({ light: 90, shadow: 10 })).lateralBias).toBeGreaterThan(0);
    expect(castTuning(A({ light: 10, shadow: 90 })).lateralBias).toBeLessThan(0);
    expect(castTuning(A({ light: 50, shadow: 50 })).lateralBias).toBeCloseTo(0);
  });
  it('missing affinities default to neutral (no throw)', () => {
    expect(() => castTuning({})).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/AstralPhysics.test.ts`
Expected: FAIL — cannot find module `../astralPhysics`.

- [ ] **Step 3: Write the implementation**

Create `src/engine/astralPhysics.ts`:
```ts
// Pure mapping from affinities to 3D physics tuning for the astral cast.
// Centering is deliberately gentle so dice spread across slices (the vortex fix).

export interface CastTuning {
  centering: number;       // radial pull toward board center (world units/s², small)
  restitution: number;     // bounciness of dice
  scatter: number;         // spread of the initial throw velocity
  linearDamping: number;   // cannon-es body linearDamping
  angularDamping: number;  // cannon-es body angularDamping
  lateralBias: number;     // x-axis gravity nudge from light vs shadow
  turbulence: number;      // magnitude of in-flight random impulses
}

const norm = (v: number | undefined) => (v ?? 50) / 100; // 0..1, default neutral 0.5

export function castTuning(affinities: Record<string, number>): CastTuning {
  const order = norm(affinities.order);
  const chaos = norm(affinities.chaos);
  const light = norm(affinities.light);
  const shadow = norm(affinities.shadow);

  return {
    // Gentle: 0.3..0.9 — far weaker than the old constant per-tick pull.
    centering: 0.3 + order * 0.6,
    restitution: 0.25 + chaos * 0.4,        // 0.25..0.65
    scatter: 0.6 + chaos * 1.6,             // 0.6..2.2 (throw velocity spread)
    linearDamping: 0.18 + order * 0.22,     // 0.18..0.40 (order = calmer)
    angularDamping: 0.32 - chaos * 0.18,    // 0.32..0.14 (chaos = spins longer)
    lateralBias: (light - shadow) * 1.2,    // ±0.6 gravity nudge on x
    turbulence: chaos * 1.5,                 // 0..1.5
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/AstralPhysics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/astralPhysics.ts src/engine/__tests__/AstralPhysics.test.ts
git commit -m "feat(astral): affinity->physics tuning (gentle centering, chaos scatter)"
```

---

## Task 4: Natural-zodiac house mapping (data)

**Files:**
- Modify: `src/data/astromancy.ts`
- Test: `src/engine/__tests__/Astromancy.test.ts` (append)

**Interfaces:**
- Produces: `const NATURAL_ZODIAC_BY_HOUSE: SignId[]` (length 12; index `house-1` → natural sign; House 1 → `aries` … House 12 → `pisces`).

- [ ] **Step 1: Write the failing test (append to the existing file)**

Add to `src/engine/__tests__/Astromancy.test.ts`:
```ts
import { NATURAL_ZODIAC_BY_HOUSE } from '../../data/astromancy';

describe('NATURAL_ZODIAC_BY_HOUSE', () => {
  it('maps the 12 houses to the zodiac in order', () => {
    expect(NATURAL_ZODIAC_BY_HOUSE).toHaveLength(12);
    expect(NATURAL_ZODIAC_BY_HOUSE[0]).toBe('aries');   // House 1
    expect(NATURAL_ZODIAC_BY_HOUSE[11]).toBe('pisces'); // House 12
  });
});
```
(If the file's existing imports already pull from `../../data/astromancy`, add `NATURAL_ZODIAC_BY_HOUSE` to that import instead of adding a duplicate import line — `noUnusedLocals`/duplicate-import rules apply.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/__tests__/Astromancy.test.ts`
Expected: FAIL — `NATURAL_ZODIAC_BY_HOUSE` is not exported.

- [ ] **Step 3: Implement**

In `src/data/astromancy.ts`, immediately after the `SIGNS` / `ELEMENT_BY_SIGN` definitions (the `SIGN_ROWS` array is already in zodiac order), add:
```ts
// The "natural zodiac": House 1 ↔ Aries … House 12 ↔ Pisces. Cosmetic mapping
// used to decorate the 12 board slices; gameplay house = the physical sector.
export const NATURAL_ZODIAC_BY_HOUSE: SignId[] = SIGN_ROWS.map(([id]) => id);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/__tests__/Astromancy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/astromancy.ts src/engine/__tests__/Astromancy.test.ts
git commit -m "feat(astral): natural-zodiac house->sign mapping for board slices"
```

---

## Task 5: Source & split the cleared zodiac SVG assets

**Files:**
- Create: `src/assets/zodiac/{aries,taurus,gemini,cancer,leo,virgo,libra,scorpio,sagittarius,capricorn,aquarius,pisces}.svg`
- Create: `src/assets/zodiac/SOURCE.md`

**Goal:** produce 12 individual SVG files (one per sign). The board's fallback (Task 6) covers any sign whose art fails to load at runtime, but all 12 **files must exist** so the static imports in Task 6's `signArt.ts` resolve at build time.

- [ ] **Step 1: Create the assets directory and provenance note**

Create `src/assets/zodiac/SOURCE.md`:
```markdown
# Zodiac slice art

Source: OpenClipart — "Line Art Zodiac Signs"
URL: https://openclipart.org/detail/284446/line-art-zodiac-signs
License: CC0 1.0 / Public Domain (no attribution required).

The original is a single combined SVG of all 12 signs; it was split into one
file per sign (`aries.svg` … `pisces.svg`). Replace any file with a different
image freely — the board loads each by filename and falls back to a gradient +
glyph if a file is missing or fails to parse.
```

- [ ] **Step 2: Download the cleared combined SVG**

Run:
```bash
mkdir -p src/assets/zodiac
curl -L -o /tmp/zodiac-combined.svg "https://openclipart.org/download/284446/line-art-zodiac-signs.svg"
```
If that URL 404s, fall back to the freesvg mirror download id 69815:
```bash
curl -L -o /tmp/zodiac-combined.svg "https://freesvg.org/download/69815"
```
Expected: a non-empty `.svg` file. Inspect it: `head -c 2000 /tmp/zodiac-combined.svg`.

- [ ] **Step 3: Split into 12 per-sign files**

Open `/tmp/zodiac-combined.svg` and inspect its structure (it is typically 12 `<g>` groups laid out in a grid, often with `transform="translate(...)"`, or 12 labeled groups). For each sign, create `src/assets/zodiac/<sign>.svg` containing a standalone SVG that wraps just that sign's group, with a `viewBox` cropped to that group's bounding box. Naming order (left→right, top→bottom or by the group's label) must map to the correct sign id from this list:
`aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces`.

Each output file must be a valid standalone SVG, e.g.:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <!-- extracted paths for this sign, transformed into the 0..200 box -->
</svg>
```

If clean extraction is impractical for any sign (overlapping coordinates, no group boundaries), write a minimal placeholder for that file so the build resolves and the runtime fallback handles the visual:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"></svg>
```
Do NOT leave any of the 12 files missing.

- [ ] **Step 4: Verify all 12 files exist and parse**

Run:
```bash
ls src/assets/zodiac/*.svg | wc -l   # expect 12
for f in src/assets/zodiac/*.svg; do head -c 60 "$f"; echo " <- $f"; done
```
Expected: 12 files, each starting with `<svg` (or `<?xml`).

- [ ] **Step 5: Commit**

```bash
git add src/assets/zodiac
git commit -m "assets(astral): CC0 zodiac line-art, split into 12 per-sign SVGs"
```

---

## Task 6: Board module (textured 3D board with fallback)

**Files:**
- Create: `src/components/screens/celestial/signArt.ts`
- Create: `src/components/screens/celestial/board.ts`

**Interfaces:**
- Consumes: `NATURAL_ZODIAC_BY_HOUSE`, `ELEMENT_BY_SIGN`, `SIGNS`, `HOUSES` from `src/data/astromancy.ts`; `BOARD_RADIUS` from `src/engine/astralGeometry.ts`.
- Produces:
  - `signArt.ts`: `const SIGN_ART: Record<SignId, string>` (URL per sign).
  - `board.ts`: `async function createBoard(): Promise<THREE.Group>` — board group (textured disc + gold rim) sized to `BOARD_RADIUS`, lying in the X–Z plane (top face up).

- [ ] **Step 1: Create the sign-art URL map**

Create `src/components/screens/celestial/signArt.ts`:
```ts
import type { SignId } from '../../../engine/types';
import aries from '../../../assets/zodiac/aries.svg?url';
import taurus from '../../../assets/zodiac/taurus.svg?url';
import gemini from '../../../assets/zodiac/gemini.svg?url';
import cancer from '../../../assets/zodiac/cancer.svg?url';
import leo from '../../../assets/zodiac/leo.svg?url';
import virgo from '../../../assets/zodiac/virgo.svg?url';
import libra from '../../../assets/zodiac/libra.svg?url';
import scorpio from '../../../assets/zodiac/scorpio.svg?url';
import sagittarius from '../../../assets/zodiac/sagittarius.svg?url';
import capricorn from '../../../assets/zodiac/capricorn.svg?url';
import aquarius from '../../../assets/zodiac/aquarius.svg?url';
import pisces from '../../../assets/zodiac/pisces.svg?url';

export const SIGN_ART: Record<SignId, string> = {
  aries, taurus, gemini, cancer, leo, virgo,
  libra, scorpio, sagittarius, capricorn, aquarius, pisces,
};
```
(Vite resolves `?url` to a string URL. If TS complains it cannot find the `*.svg?url` module, add `/// <reference types="vite/client" />` at the top of this file, or ensure `vite/client` is in `tsconfig`'s types — `vite/client` declares `*.svg?url`.)

- [ ] **Step 2: Implement the board texture + mesh**

Create `src/components/screens/celestial/board.ts`:
```ts
import * as THREE from 'three';
import type { SignId } from '../../../engine/types';
import { NATURAL_ZODIAC_BY_HOUSE, ELEMENT_BY_SIGN, SIGNS, HOUSES } from '../../../data/astromancy';
import { BOARD_RADIUS } from '../../../engine/astralGeometry';
import { SIGN_ART } from './signArt';

const TEX = 1024;              // texture resolution
const C = TEX / 2;             // canvas center
const R = TEX * 0.46;          // board radius in texture px
const SECTOR = Math.PI / 6;

const ELEMENT_TINT: Record<'fire' | 'earth' | 'air' | 'water', string> = {
  fire:  'rgba(180, 70, 45, 0.40)',
  earth: 'rgba(90, 110, 70, 0.38)',
  air:   'rgba(150, 160, 120, 0.34)',
  water: 'rgba(60, 110, 165, 0.40)',
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fallback path handles null
    img.src = url;
  });
}

// Draw one wedge: dark base, element tint, darkened sign art (or glyph fallback),
// spokes, and the house number/arena label near the rim.
function drawWedge(
  ctx: CanvasRenderingContext2D,
  house: number,
  sign: SignId,
  art: HTMLImageElement | null,
) {
  const a0 = (house - 1) * SECTOR - SECTOR / 2 - Math.PI / 2; // canvas: -π/2 = top
  const a1 = a0 + SECTOR;
  const mid = a0 + SECTOR / 2;
  const element = ELEMENT_BY_SIGN[sign];

  ctx.save();
  // Clip to the wedge.
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.arc(C, C, R, a0, a1);
  ctx.closePath();
  ctx.clip();

  // Base fill.
  ctx.fillStyle = '#0b0f1c';
  ctx.fillRect(0, 0, TEX, TEX);

  // Element tint wash.
  ctx.fillStyle = ELEMENT_TINT[element];
  ctx.fillRect(0, 0, TEX, TEX);

  // Sign art (darkened) centered in the wedge, or glyph fallback.
  const ax = C + Math.cos(mid) * R * 0.6;
  const ay = C + Math.sin(mid) * R * 0.6;
  const size = R * 0.42;
  if (art) {
    ctx.globalAlpha = 0.32; // darkened for clarity
    ctx.drawImage(art, ax - size / 2, ay - size / 2, size, size);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(212, 168, 84, 0.30)';
    ctx.font = `${size}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIGNS[sign].glyph, ax, ay);
  }
  ctx.restore();

  // Spoke line on the wedge's leading edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 168, 84, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(C, C);
  ctx.lineTo(C + Math.cos(a0) * R, C + Math.sin(a0) * R);
  ctx.stroke();
  ctx.restore();

  // House number + arena near the rim.
  ctx.save();
  ctx.translate(C + Math.cos(mid) * R * 0.9, C + Math.sin(mid) * R * 0.9);
  ctx.rotate(mid + Math.PI / 2);
  ctx.fillStyle = 'rgba(212, 168, 84, 0.7)';
  ctx.textAlign = 'center';
  ctx.font = '34px "Cormorant Garamond", serif';
  ctx.fillText(String(house), 0, -14);
  ctx.font = '18px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(123, 158, 199, 0.7)';
  ctx.fillText(HOUSES[house - 1].arena, 0, 10);
  ctx.restore();
}

async function buildBoardTexture(): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX;
  const ctx = canvas.getContext('2d')!;

  // Deep background disc.
  ctx.fillStyle = '#070a14';
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.fill();

  // Preload art for all houses' natural signs (null on failure → glyph fallback).
  const arts = await Promise.all(
    NATURAL_ZODIAC_BY_HOUSE.map((s) => loadImage(SIGN_ART[s])),
  );

  for (let h = 1; h <= 12; h++) {
    drawWedge(ctx, h, NATURAL_ZODIAC_BY_HOUSE[h - 1], arts[h - 1]);
  }

  // Outer rim.
  ctx.strokeStyle = 'rgba(212, 168, 84, 0.85)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.stroke();

  // Center sigil.
  ctx.fillStyle = 'rgba(212, 168, 84, 0.18)';
  ctx.font = '70px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', C, C);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export async function createBoard(): Promise<THREE.Group> {
  const group = new THREE.Group();

  const tex = await buildBoardTexture();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(BOARD_RADIUS, 96),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 }),
  );
  disc.rotation.x = -Math.PI / 2; // lay flat in X–Z, face up
  disc.receiveShadow = true;
  group.add(disc);

  // Raised gold rim torus.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BOARD_RADIUS, 0.12, 16, 96),
    new THREE.MeshStandardMaterial({ color: 0xd4a854, roughness: 0.4, metalness: 0.8 }),
  );
  rim.rotation.x = -Math.PI / 2;
  group.add(rim);

  return group;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run build`
Expected: PASS. Common issues: missing `vite/client` types for `?url` (add the reference comment from Step 1); `@types/three` API drift (e.g. `colorSpace`/`SRGBColorSpace` exist in three ≥0.152 — fine for 0.169).

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/celestial/signArt.ts src/components/screens/celestial/board.ts
git commit -m "feat(astral): 3D zodiac board texture with element tint + art fallback"
```

---

## Task 7: Dice module (d12 mesh + sphere body + snap)

**Files:**
- Create: `src/components/screens/celestial/dice.ts`

**Interfaces:**
- Consumes: `Vec3`, `topFaceIndex` from `src/engine/astralGeometry.ts`; `PLANETS`, `SIGNS` from `src/data/astromancy.ts`; `PlanetId`, `SignId` from `src/engine/types.ts`.
- Produces:
  - `interface Die { object: THREE.Group; body: CANNON.Body; faceNormals: Vec3[]; faceIds: string[]; kind: 'planet' | 'sign' }`
  - `function createDie(kind, world, faceIds, radius): Die`
  - `function readTopFace(die: Die): string` (the planet/sign id of the up face)
  - `function faceIndexOfId(die: Die, id: string): number`
  - `function snapToFace(die: Die, faceIndex: number): void` (orients so that face points up; syncs mesh + body)
  - `const PLANET_FACE_IDS: PlanetId[]`, `const SIGN_FACE_IDS: SignId[]` (12 each, the face→id order)

- [ ] **Step 1: Implement the dice module**

Create `src/components/screens/celestial/dice.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { PlanetId, SignId } from '../../../engine/types';
import { PLANETS, SIGNS } from '../../../data/astromancy';
import { topFaceIndex, type Vec3 } from '../../../engine/astralGeometry';

// Face → id ordering. Index i of these arrays maps to face i of the geometry.
export const PLANET_FACE_IDS = Object.keys(PLANETS) as PlanetId[];     // 12
export const SIGN_FACE_IDS = Object.keys(SIGNS) as SignId[];           // 12

export interface Die {
  object: THREE.Group;
  body: CANNON.Body;
  faceNormals: Vec3[]; // local-space outward normal per face (index = face id index)
  faceIds: string[];
  kind: 'planet' | 'sign';
}

// Cluster a DodecahedronGeometry's 36 triangles into its 12 pentagon faces by
// grouping near-parallel triangle normals. Returns { center, normal } per face.
function computeFaceData(geo: THREE.BufferGeometry): { center: Vec3; normal: Vec3 }[] {
  const pos = geo.getAttribute('position');
  const tris: { c: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    tris.push({ c: center, n });
  }
  const faces: { center: Vec3; normal: Vec3; _ns: THREE.Vector3[]; _cs: THREE.Vector3[] }[] = [];
  for (const t of tris) {
    let f = faces.find((g) => g.normal && new THREE.Vector3(g.normal.x, g.normal.y, g.normal.z).dot(t.n) > 0.95);
    if (!f) {
      f = { center: { x: 0, y: 0, z: 0 }, normal: { x: t.n.x, y: t.n.y, z: t.n.z }, _ns: [], _cs: [] };
      faces.push(f);
    }
    f._ns.push(t.n); f._cs.push(t.c);
  }
  for (const f of faces) {
    const n = new THREE.Vector3();
    f._ns.forEach((v) => n.add(v));
    n.normalize();
    const cen = new THREE.Vector3();
    f._cs.forEach((v) => cen.add(v));
    cen.multiplyScalar(1 / f._cs.length);
    f.normal = { x: n.x, y: n.y, z: n.z };
    f.center = { x: cen.x, y: cen.y, z: cen.z };
  }
  return faces.map((f) => ({ center: f.center, normal: f.normal })); // expect length 12
}

function glyphTexture(glyph: string, color: string): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = color;
  ctx.font = `${S * 0.62}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, S / 2, S / 2 + 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDie(
  kind: 'planet' | 'sign',
  world: CANNON.World,
  faceIds: string[],
  radius: number,
): Die {
  const object = new THREE.Group();

  // Visual dodecahedron body.
  const geo = new THREE.DodecahedronGeometry(radius);
  const bodyMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x141c33, roughness: 0.5, metalness: 0.35 }),
  );
  bodyMesh.castShadow = true;
  object.add(bodyMesh);

  const faceData = computeFaceData(geo);
  const glyphColor = kind === 'planet' ? '#d4a854' : '#9bc4e2';

  // One glyph plane per face, positioned just outside the face, facing outward.
  faceData.forEach((f, i) => {
    const id = faceIds[i];
    const glyph = kind === 'planet' ? PLANETS[id as PlanetId].glyph : SIGNS[id as SignId].glyph;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 0.9, radius * 0.9),
      new THREE.MeshBasicMaterial({ map: glyphTexture(glyph, glyphColor), transparent: true, depthWrite: false }),
    );
    const c = new THREE.Vector3(f.center.x, f.center.y, f.center.z);
    const n = new THREE.Vector3(f.normal.x, f.normal.y, f.normal.z);
    plane.position.copy(c).addScaledVector(n, 0.01);
    plane.lookAt(c.clone().add(n));
    object.add(plane);
  });

  // Sphere collider (radius ≈ dodeca inradius so the snapped face sits ~flush).
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius * 0.82),
  });
  world.addBody(body);

  return {
    object,
    body,
    faceNormals: faceData.map((f) => f.normal),
    faceIds,
    kind,
  };
}

export function faceIndexOfId(die: Die, id: string): number {
  return Math.max(0, die.faceIds.indexOf(id));
}

export function readTopFace(die: Die): string {
  const q = die.body.quaternion;
  const idx = topFaceIndex(die.faceNormals, { x: q.x, y: q.y, z: q.z, w: q.w });
  return die.faceIds[idx];
}

// Orient the die so that the given face points exactly up (+Y), then sync mesh.
export function snapToFace(die: Die, faceIndex: number): void {
  const n = die.faceNormals[faceIndex];
  const from = new THREE.Vector3(n.x, n.y, n.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(from, up);
  die.body.quaternion.set(q.x, q.y, q.z, q.w);
  die.body.angularVelocity.set(0, 0, 0);
  die.body.velocity.set(0, 0, 0);
  die.object.quaternion.copy(q);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS. If `computeFaceData` produces a `noUnusedLocals` error for the temporary `_ns`/`_cs`, they are used — ignore. If `@types/three` flags `DodecahedronGeometry`/`TorusGeometry` constructors, confirm the installed `three` minor matches `@types/three`.

- [ ] **Step 3: Add a face-count sanity log (temporary, manual)**

Temporarily, at the end of `createDie` before `return`, add `if (faceData.length !== 12) console.warn('dodeca faces', faceData.length);` — you'll watch for this when the scene runs in Task 8/9. Remove it before the Task 8 commit if it never fires. (This guards the triangle-clustering threshold; if it logs ≠12, loosen/tighten the `0.95` dot threshold in `computeFaceData`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/celestial/dice.ts
git commit -m "feat(astral): d12 dice (dodeca mesh, glyph faces, sphere body, snap)"
```

---

## Task 8: Scene module (renderer, physics loop, camera, settle, omens)

**Files:**
- Create: `src/components/screens/celestial/scene.ts`

**Interfaces:**
- Consumes: `createBoard`; `createDie`, `readTopFace`, `faceIndexOfId`, `snapToFace`, `PLANET_FACE_IDS`, `SIGN_FACE_IDS`, `Die`; `castTuning`; `sectorOf`, `sectorCenter`, `isErrantStar`, `isCrownedConjunction`, `BOARD_RADIUS`.
- Produces:
  - `interface CelestialSceneController { roll(target: AstralCast | null): void; dispose(): void }`
  - `function createCelestialScene(opts: { canvas: HTMLCanvasElement; affinities: Record<string, number>; onSettled: (cast: AstralCast) => void }): CelestialSceneController`

Behavior: builds the scene + board + two dice; runs an idle loop (board gently rotating, dice resting off to the side); `roll(target)` throws both dice; on settle, snaps dice (to up-face, or to `target` faces/sectors when provided), computes `AstralCast`, and calls `onSettled` once; camera tweens from tilted → top-down across the roll.

- [ ] **Step 1: Implement the scene**

Create `src/components/screens/celestial/scene.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { AstralCast, OmenTag, PlanetId, SignId } from '../../../engine/types';
import { castTuning } from '../../../engine/astralPhysics';
import {
  sectorOf, sectorCenter, isErrantStar, isCrownedConjunction, BOARD_RADIUS,
} from '../../../engine/astralGeometry';
import { createBoard } from './board';
import {
  createDie, readTopFace, faceIndexOfId, snapToFace,
  PLANET_FACE_IDS, SIGN_FACE_IDS, type Die,
} from './dice';

const DIE_R = 0.55;
const SETTLE_FRAMES = 35;      // frames of near-stillness before settling
const SETTLE_TICK_CAP = 600;   // hard timeout → veiled-oracle
const CAM_TILT = new THREE.Vector3(0, 7, 9);     // during roll
const CAM_TOP = new THREE.Vector3(0, 14, 0.001); // settled

export interface CelestialSceneController {
  roll(target: AstralCast | null): void;
  dispose(): void;
}

export function createCelestialScene(opts: {
  canvas: HTMLCanvasElement;
  affinities: Record<string, number>;
  onSettled: (cast: AstralCast) => void;
}): CelestialSceneController {
  const { canvas, affinities, onSettled } = opts;
  const tuning = castTuning(affinities);

  // ── Renderer / scene / camera ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const size = () => Math.min(canvas.clientWidth || 420, 480);
  renderer.setSize(size(), size(), false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.copy(CAM_TILT);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x6b7fb0, 0.7));
  const key = new THREE.DirectionalLight(0xffe6b0, 1.1);
  key.position.set(4, 12, 6);
  key.castShadow = true;
  scene.add(key);

  // ── Physics world ──
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  const floorMat = new CANNON.Material('floor');
  const dieMat = new CANNON.Material('die');
  world.addContactMaterial(new CANNON.ContactMaterial(floorMat, dieMat, {
    restitution: tuning.restitution, friction: 0.35,
  }));
  const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorMat });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  // ── Dice ──
  const planet = createDie('planet', world, PLANET_FACE_IDS, DIE_R);
  const sign = createDie('sign', world, SIGN_FACE_IDS, DIE_R);
  [planet, sign].forEach((d) => {
    d.body.material = dieMat;
    d.body.linearDamping = tuning.linearDamping;
    d.body.angularDamping = tuning.angularDamping;
    scene.add(d.object);
  });

  // Board (async). Dice rest off-board until the texture is ready / a roll starts.
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);
  let boardReady = false;
  createBoard().then((g) => { boardGroup.add(g); boardReady = true; });

  const restPose = (d: Die, x: number) => {
    d.body.position.set(x, DIE_R, BOARD_RADIUS * 0.62);
    d.body.velocity.set(0, 0, 0);
    d.body.angularVelocity.set(0, 0, 0);
    d.body.quaternion.set(0, 0, 0, 1);
  };
  restPose(planet, -DIE_R * 1.4);
  restPose(sign, DIE_R * 1.4);

  // ── State ──
  type Phase = 'idle' | 'rolling' | 'done';
  let phase: Phase = 'idle';
  let still = 0, ticks = 0, raf = 0;
  let target: AstralCast | null = null;
  let settledFired = false;

  const throwDie = (d: Die, dx: number) => {
    d.body.position.set(dx, 6 + Math.random() * 1.5, BOARD_RADIUS * 0.35 + Math.random());
    const s = tuning.scatter;
    d.body.velocity.set((Math.random() - 0.5) * 3 * s, -2 - Math.random() * 2, -3 - Math.random() * 2 * s);
    d.body.angularVelocity.set(
      (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
    );
    d.body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  };

  const applyForces = () => {
    for (const d of [planet, sign]) {
      const p = d.body.position;
      // Gentle radial centering (the weakened vortex).
      d.body.applyForce(new CANNON.Vec3(-p.x * tuning.centering, 0, -p.z * tuning.centering), p);
      // Lateral light/shadow drift.
      if (tuning.lateralBias) d.body.applyForce(new CANNON.Vec3(tuning.lateralBias, 0, 0), p);
      // Chaos turbulence.
      if (tuning.turbulence && ticks % 8 === 0) {
        d.body.applyForce(new CANNON.Vec3(
          (Math.random() - 0.5) * tuning.turbulence * 6, 0, (Math.random() - 0.5) * tuning.turbulence * 6,
        ), p);
      }
    }
  };

  const syncMesh = (d: Die) => {
    d.object.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
    const q = d.body.quaternion;
    d.object.quaternion.set(q.x, q.y, q.z, q.w);
  };

  const settle = () => {
    if (settledFired) return;
    settledFired = true;
    phase = 'done';

    // Snap each die flat (to target face if provided, else to up-most face).
    if (target) {
      snapToFace(planet, faceIndexOfId(planet, target.planet));
      snapToFace(sign, faceIndexOfId(sign, target.sign));
      const pc = sectorCenter(target.planetHouse, BOARD_RADIUS * 0.55);
      const sc = sectorCenter(target.signHouse, BOARD_RADIUS * 0.55);
      planet.body.position.set(pc.x, DIE_R, pc.z);
      sign.body.position.set(sc.x, DIE_R, sc.z);
    } else {
      // Snap to whatever face is currently up.
      const pIdx = planet.faceIds.indexOf(readTopFace(planet));
      const sIdx = sign.faceIds.indexOf(readTopFace(sign));
      snapToFace(planet, pIdx);
      snapToFace(sign, sIdx);
    }
    syncMesh(planet); syncMesh(sign);

    const pPos = planet.body.position, sPos = sign.body.position;
    const omens: OmenTag[] = [];
    if (isErrantStar(pPos.x, pPos.z) || isErrantStar(sPos.x, sPos.z)) omens.push('errant-star');
    if (isCrownedConjunction(
      { x: pPos.x, y: pPos.y, z: pPos.z }, { x: sPos.x, y: sPos.y, z: sPos.z },
    )) omens.push('crowned-conjunction');
    if (ticks >= SETTLE_TICK_CAP) omens.push('veiled-oracle');

    const cast: AstralCast = target ?? {
      planet: readTopFace(planet) as PlanetId,
      sign: readTopFace(sign) as SignId,
      planetHouse: sectorOf(pPos.x, pPos.z),
      signHouse: sectorOf(sPos.x, sPos.z),
      omens,
    };
    // When target-driven, still attach physically-derived omens.
    if (target) cast.omens = omens;

    onSettled(cast);
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);

    if (phase === 'rolling') {
      ticks++;
      applyForces();
      world.fixedStep();
      syncMesh(planet); syncMesh(sign);

      const speed = planet.body.velocity.length() + sign.body.velocity.length()
        + planet.body.angularVelocity.length() + sign.body.angularVelocity.length();
      still = speed < 0.4 ? still + 1 : 0;

      // Camera ease tilt → top-down across the roll.
      const t = Math.min(1, ticks / 90);
      camera.position.lerpVectors(CAM_TILT, CAM_TOP, t * t);
      camera.lookAt(0, 0, 0);

      if (still > SETTLE_FRAMES || ticks >= SETTLE_TICK_CAP) settle();
    } else if (phase === 'idle') {
      boardGroup.rotation.y += 0.0015; // ambient life
      syncMesh(planet); syncMesh(sign);
    } else {
      // done: hold top-down
      camera.position.lerp(CAM_TOP, 0.1);
      camera.lookAt(0, 0, 0);
    }

    if (boardReady || phase !== 'idle') renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const onResize = () => { const s = size(); renderer.setSize(s, s, false); };
  window.addEventListener('resize', onResize);

  return {
    roll(t: AstralCast | null) {
      target = t;
      settledFired = false;
      still = 0; ticks = 0;
      boardGroup.rotation.y = 0;
      phase = 'rolling';
      throwDie(planet, -DIE_R * 1.4);
      throwDie(sign, DIE_R * 1.4);
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS. If `world.fixedStep` is missing on the installed cannon-es, use `world.step(1 / 60)` instead. If `AstralCast` omens typing complains, confirm `OmenTag` import is from `../../../engine/types`.

- [ ] **Step 3: Commit**

```bash
git add src/components/screens/celestial/scene.ts
git commit -m "feat(astral): 3D cast scene (physics roll, camera tween, settle, omens)"
```

---

## Task 9: Rewrite CelestialCast.tsx (React wrapper + fallback)

**Files:**
- Rewrite: `src/components/screens/CelestialCast.tsx`

**Interfaces:**
- Consumes: `createCelestialScene` from `./celestial/scene`; `drawAstralCast` from `../../data/astromancy` (fallback only); `AstralCast` from `../../engine/types`.
- Produces: a `forwardRef` component with imperative handle `CelestialCastHandle = { roll: (target?: AstralCast | null) => void }`. Props: `{ affinities: Record<string, number>; onSettled: (cast: AstralCast) => void }`.

Behavior: mounts a canvas + scene on mount (board visible immediately, idle). `roll()` delegates to the scene. If WebGL is unavailable or `prefers-reduced-motion` is set, it skips the scene and `roll()` resolves a fallback cast via `drawAstralCast` after a short delay (still calling `onSettled` exactly once).

- [ ] **Step 1: Implement the component**

Replace the entire contents of `src/components/screens/CelestialCast.tsx`:
```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { AstralCast } from '../../engine/types';
import { drawAstralCast } from '../../data/astromancy';
import { createCelestialScene, type CelestialSceneController } from './celestial/scene';

export interface CelestialCastHandle {
  roll: (target?: AstralCast | null) => void;
}

interface Props {
  affinities: Record<string, number>;
  onSettled: (cast: AstralCast) => void;
}

function canUse3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const CelestialCast = forwardRef<CelestialCastHandle, Props>(function CelestialCast(
  { affinities, onSettled },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<CelestialSceneController | null>(null);
  const settledRef = useRef(false);
  const use3DRef = useRef(false);

  // Wrap onSettled so it can only fire once per roll.
  const fireSettled = (cast: AstralCast) => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettled(cast);
  };

  useEffect(() => {
    use3DRef.current = canUse3D();
    if (use3DRef.current && canvasRef.current) {
      sceneRef.current = createCelestialScene({
        canvas: canvasRef.current,
        affinities,
        onSettled: fireSettled,
      });
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    roll(target?: AstralCast | null) {
      settledRef.current = false;
      if (use3DRef.current && sceneRef.current) {
        sceneRef.current.roll(target ?? null);
      } else {
        // Fallback: resolve instantly with a valid affinity-biased cast.
        const cast = target ?? drawAstralCast(affinities);
        setTimeout(() => fireSettled(cast), 600);
      }
    },
  }));

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
});

export default CelestialCast;

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: 'min(440px, 80vw)',
  height: 'min(440px, 80vw)',
  userSelect: 'none',
};

const canvasStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS. (The old `CelestialCast` props `faces`/the Matter.js imports are gone; Task 10 updates the only caller, so a temporary "unused import" or caller type error here is expected until Task 10 — if `npm run build` fails only inside `AstralMinigame.tsx`, proceed to Task 10 and re-verify there.)

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `npm run dev`, open http://localhost:5173, start a reading, and choose the astral method. (Until Task 10 wires the new ref API, the board may not roll yet — at minimum confirm the page compiles and the canvas mounts without console errors. Full visual verification happens in Task 10/12.)

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/CelestialCast.tsx
git commit -m "feat(astral): CelestialCast 3D wrapper with imperative roll + fallback"
```

---

## Task 10: Wire AstralMinigame to the persistent 3D board

**Files:**
- Modify: `src/components/screens/AstralMinigame.tsx`

**Interfaces:**
- Consumes: `CelestialCast` (default export) and `CelestialCastHandle` from `./CelestialCast`.
- Behavior change: one persistent `CelestialCast` (visible from idle through done) driven imperatively; two-cast modes (favored/clouded/choice) roll **sequentially**; planet/sign now come from the die roll (no `drawAstralCast` pre-draw for faces in the 3D path); debug staged cast passed as `target`.

- [ ] **Step 1: Replace the casting state machine + render**

In `src/components/screens/AstralMinigame.tsx`, make these changes:

1. Update imports — remove `drawAstralCast`, `AstralCast` face usage for two-board rendering; add the ref type:
```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { consolidateCast, HOUSES } from '../../data/astromancy';
import CelestialCast, { type CelestialCastHandle } from './CelestialCast';
import AstralSigil from '../cards/AstralSigil';
import type { AstralCast, AstralResult } from '../../engine/types';
import type { AstralCastMode } from '../../engine/astral';
```

2. Replace the per-cast `facesA`/`facesB` state and the two `handleSettledA`/`handleSettledB` callbacks with a single sequential driver. Keep `plan`, `castA`, `castB`, `localResult`, `choiceResults`, `committedRef`, `recastUsedRef`, `choiceTimerRef`, `commit`, and the `stagedCast` debug logic. Add:
```tsx
  const castRef = useRef<CelestialCastHandle | null>(null);
  const castIndexRef = useRef<0 | 1>(0);

  // Roll cast N. Cast 0 always; cast 1 only for two-cast modes. Debug target
  // applies to the first (pre-recast) cast when an astral scenario is staged.
  const rollCast = useCallback((index: 0 | 1) => {
    castIndexRef.current = index;
    const useStaged = !!stagedCast && index === 0 && !recastUsedRef.current;
    castRef.current?.roll(useStaged ? stagedCast! : null);
  }, [stagedCast]);

  const handleCast = useCallback(() => {
    const p = engine.planAstralCast();
    setPlan(p);
    recastUsedRef.current = false;
    setCastA(null); setCastB(null); setLocalResult(null);
    setPhase('casting');
    rollCast(0);
  }, [engine, rollCast]);

  // Unified settle handler — the scene calls this once per roll.
  const handleCastSettled = useCallback((cast: AstralCast) => {
    if (!plan) return;
    if (castIndexRef.current === 0) {
      setCastA(cast);
      if (plan.mode === 'single') {
        const result = consolidateCast(cast);
        setLocalResult(result);
        setPhase(plan.offerRecast && !recastUsedRef.current ? 'recast-offer' : 'settled');
      } else {
        setPhase('settle-b');
        rollCast(1);
      }
    } else {
      setCastB(cast);
      setPhase('both-settled');
    }
  }, [plan, rollCast]);
```

3. Keep the existing `both-settled` effect (resolves favored/clouded/choice from `castA`/`castB`) and the `settled` auto-commit effect unchanged.

4. Update `handleRecast` to roll via the ref instead of redrawing faces:
```tsx
  const handleRecast = useCallback(() => {
    if (!plan) return;
    recastUsedRef.current = true;
    committedRef.current = false;
    setCastA(null); setCastB(null); setLocalResult(null);
    setPhase('casting');
    rollCast(0);
  }, [plan, rollCast]);
```

5. Replace the render so the board is **always mounted** (idle → done). The idle "Tap to cast" button overlays the live board; the casting/result/choice UI sits below. Replace the `{isCasting && facesA && (...)}` block and the idle button block with:
```tsx
        {/* Persistent 3D board — visible from idle through the result */}
        <div style={boardWrapStyle}>
          <CelestialCast
            ref={castRef}
            affinities={state.affinities}
            onSettled={handleCastSettled}
          />
          {isIdle && (
            <motion.button
              style={castOverlayBtnStyle}
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCast}
            >
              <span style={castGlyphStyle}>✦</span>
              <span style={tapHintStyle}>Tap to cast</span>
            </motion.button>
          )}
        </div>
```
Keep the `showResult`, `showChoice`, and `showRecastOffer` blocks exactly as they are (they read `displayResult` / `choiceResults`). Remove the now-unused `facesA`/`facesB`/`setFacesA`/`setFacesB` state and `veiled` only if still used elsewhere (it is — keep `veiled`).

6. Add the new styles near the other styles:
```tsx
const boardWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const castOverlayBtnStyle: React.CSSProperties = {
  position: 'absolute',
  width: '120px', height: '120px',
  background: 'rgba(13, 18, 32, 0.72)',
  border: '2px solid #d4a854', borderRadius: '50%',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.5rem', cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
};
```
Keep the existing `castGlyphStyle` and `tapHintStyle`. Delete the old `castButtonStyle` and `castRowStyle` if no longer referenced (`noUnusedLocals` will flag them).

- [ ] **Step 2: Verify typecheck**

Run: `npm run build`
Expected: PASS with no unused-locals errors. Remove any now-dead state/styles the compiler flags.

- [ ] **Step 3: Manual verification (dev server)**

Run `npm run dev`, open the app, start a reading, pick the astral method, and verify:
- The **board is visible immediately** (before casting), gently rotating, with the ✦ "Tap to cast" overlay.
- Tapping casts: two 3D dice tumble, the **camera eases from tilted to top-down**, dice **settle on different slices** (not clumped in the center).
- The result shows the planet/sign of the **up faces** and the correct houses.
- Drive a two-cast mode (e.g. set Will high via the debug panel for `choice`): dice roll **twice sequentially**, then the two choice cards appear.
- Recast (Will offer) re-rolls in place.
- Toggle OS "reduce motion" (or temporarily force `canUse3D` to return `false`) and confirm the **fallback** still produces a result.

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/AstralMinigame.tsx
git commit -m "feat(astral): persistent 3D board, sequential casts, face-driven results"
```

---

## Task 11: Debug scenarios & docs sync

**Files:**
- Modify: `docs/game-systems.md`
- Modify: `README.md`
- (Verify only) `src/engine/events/scenarios.ts`

- [ ] **Step 1: Verify astral debug scenarios still stage correctly**

Read `src/engine/events/scenarios.ts` and confirm the `astral-*` `DEBUG_SCENARIOS` still place an `AstralCast` in the committed slot (the `stagedCast` logic in `AstralMinigame` reads `state.turnResults[last]` when `forced` starts with `astral-`). No code change expected — the staged cast is now passed to the scene as `target`, which snaps the dice to the staged planet/sign/houses. If a scenario relied on a specific omen, note that omens are still derived physically at settle and merged onto the target cast (see `scene.ts` `settle()`), so staged-omen scenarios may need their omen added to the staged cast's `omens` array. Document any such adjustment here and apply it in `scenarios.ts` if a scenario regresses during Task 12 manual testing.

- [ ] **Step 2: Update `docs/game-systems.md`**

In the astral/astromancy section, update the omen and physics description to match the new model. Replace the relevant prose with:
```markdown
- **3D cast:** Two d12 dice (planets / signs) are thrown onto the zodiac board.
  The up-most face decides the planet/sign; the slice the die rests in decides
  the house. Affinities shape the throw (order → gentler centering + calmer
  settle; chaos → bouncier, wider scatter and turbulence; light/shadow → lateral
  drift). The center pull is deliberately gentle so dice spread across slices.
- **errant-star** — a die comes to rest beyond the board rim (chaos raises the
  odds). Spawns a second astral result.
- **crowned-conjunction** — the planet and sign dice settle close together.
- **veiled-oracle** — the cast fails to settle before the time cap (a slow,
  unsettled reading). *(Timeout-based, as before; a dedicated "cocked die"
  signal is not used with the sphere-collider physics.)*
```

- [ ] **Step 3: Update `README.md`**

In the astral minigame section, replace the board/dice description with a short note that the cast now uses **3D d12 dice on a zodiac board** (planet die + sign die), the board is **visible before casting**, slices are decorated with their natural-zodiac art (CC0 OpenClipart), and the center vortex was softened so dice spread across slices. Keep the rule tables (planets/signs/houses/aspects) unchanged.

- [ ] **Step 4: Commit**

```bash
git add docs/game-systems.md README.md src/engine/events/scenarios.ts
git commit -m "docs(astral): sync 3D dice, board, and omen behavior"
```

---

## Task 12: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the engine test suite**

Run: `npm test`
Expected: PASS — all existing engine/data suites green (the `AstralCast`, `AstralResponders`, `Astromancy` suites still pass because the `onSettled`/`AstralCast` contract is unchanged), plus the new `AstralGeometry` and `AstralPhysics` suites.

- [ ] **Step 2: Typecheck + production build**

Run: `npm run build`
Expected: PASS — clean `tsc -b` (no unused locals/params) and a successful Vite bundle.

- [ ] **Step 3: Manual acceptance pass (dev server)**

Run `npm run dev` and confirm the spec's acceptance criteria:
- Board visible before "cast" (idle), gently alive.
- 3D d12 dice with planet/sign glyphs on faces; up face = result.
- Dice **spread across slices** — no center clumping (the vortex fix).
- Camera tilts during the roll and eases to top-down on settle.
- Slices show darkened zodiac art (or glyph fallback) + element tint + house labels + gold rim.
- Omens fire: throw hard/chaotic to land a die off-board (`errant-star` → second result); dice landing close (`crowned-conjunction`); a stalled cast (`veiled-oracle`).
- Two-cast modes roll sequentially; choice shows two cards; favored/clouded auto-pick.
- Reduced-motion / no-WebGL fallback still yields a result.
- Debug `astral-*` scenarios snap to their staged planet/sign/house.

- [ ] **Step 4: Finalize the branch**

Per the superpowers:finishing-a-development-branch skill, present merge/PR options to the user. Do not merge without the user's choice.

---

## Self-Review (completed during planning)

- **Spec coverage:** vortex fix (Task 3 + scene forces), board art/framing/labels (Tasks 5–6), board visible before cast (Tasks 9–10), 3D d12 dice with faces (Tasks 7–8), face-driven planet/sign (Tasks 8, 10), physical omens (Tasks 2, 8), modes/recast/idle/debug/fallback (Tasks 9–11), assets/docs/deps (Tasks 1, 5, 11) — all covered.
- **Deviation from spec (documented):** `veiled-oracle` stays timeout-based (no "cocked die" signal) due to the sphere-collider decision; recorded in Task 11 docs.
- **Type consistency:** `AstralCast`/`OmenTag`/`PlanetId`/`SignId` used consistently; `Die`, `CelestialSceneController`, `CelestialCastHandle`, `CastTuning`, `Vec3`/`Quat` defined once and consumed by name; `castTuning`, `sectorOf`, `sectorCenter`, `topFaceIndex`, `readTopFace`, `snapToFace`, `faceIndexOfId`, `createBoard`, `createDie`, `createCelestialScene`, `NATURAL_ZODIAC_BY_HOUSE` referenced with matching signatures across tasks.
- **No placeholders:** every code step contains complete code; asset extraction (Task 5) gives an explicit procedure plus a valid-file fallback.
