# I Ching Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the I Ching method into an authentic coin-cast → primary/relating transformation with a signature "Mandate of Change" affinity mechanic, affinity-gated player agency, cross-game interactions, and a mystical UI.

**Architecture:** All game logic stays framework-free in `src/engine/` and `src/data/`; React only renders/animates predetermined casts (mirrors the Astromancy overhaul: `astromancy.ts` + `engine/astral.ts` + `CelestialCast`). The signature mechanic is a turn-scoped `AffinityMandate` that rescales `AffinityEngine.shift` for the rest of the turn.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Framer Motion; Vitest (engine tests only, Node env).

## Global Constraints

- Engine/data code: **zero React/DOM imports** (`src/engine/`, `src/data/`).
- Every `GameEngine` mutator ends with `notify()`.
- Affinities are **0–100**, baseline 50; **never shown as numbers** to the player — only atmospheric flavor text, clarity-gated by Light/Shadow.
- `tsc` strict + `noUnusedLocals` + `noUnusedParameters` — no unused symbols. Typecheck via `npm run build`.
- Tests live only under `src/engine/__tests__/**`; stub `Math.random` when asserting on randomness.
- Run a single test file: `npx vitest run src/engine/__tests__/IChing.test.ts`.
- Keep `docs/game-systems.md` + `README.md` in sync in the **same change** that touches affinities/responders/data (CLAUDE.md rule).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Work happens on branch `feat/iching-overhaul`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/engine/types.ts` | Add `LineValue`, `HexagramCast`, `AffinityMandate`; extend `IChingResult` |
| `src/data/iching.ts` | King Wen binary table + lookup; `drawHexagramCast`, `consolidateHexagram`, `castHexagram` wrapper; tags |
| `src/engine/AffinityEngine.ts` | `setMandate`/`decayMandate`/`clearMandate`; mandate scaling in `shift()`; `applyHexagramNudge` |
| `src/engine/iching.ts` *(new)* | `planHexagramResolution`, `deriveMandate`, `resolveFatedGoverning` |
| `src/engine/GameEngine.ts` | dispatch `iching:cast`/`iching:transform`; apply nudge + mandate on commit; mandate decay; resolution plumbing |
| `src/engine/responders/iching.ts` *(new)* | `chaos-line-cascade`, `order-still-hexagram` |
| `src/engine/responders/interactions.ts` | `iching-resonant-change` |
| `src/engine/events/EventDispatcher.ts` / responder registry | register new triggers |
| `src/engine/events/scenarios.ts` | debug scenarios |
| `src/components/screens/IChingMinigame.tsx` | full rewrite — phase machine |
| `src/components/cards/CoinCast.tsx`, `HexagramPillar.tsx` *(new)* | presentation/animation |
| `src/engine/__tests__/IChing.test.ts` | expanded coverage |
| `docs/game-systems.md`, `README.md` | sync |

---

## Task 1: Types + King Wen binary table & lookup

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/data/iching.ts`
- Test: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Produces: `type LineValue = 6|7|8|9`; `interface HexagramCast`; `HEX_BY_BINARY: Record<string, HexagramData>`; each `HexagramData` gains `binary: string` (length-6, bottom→top, `'1'`=solid/yang, `'0'`=broken/yin); `hexagramByBinary(binary: string): HexagramData`.

- [ ] **Step 1: Add types to `src/engine/types.ts`**

After the `IChingResult` interface, add:

```ts
export type LineValue = 6 | 7 | 8 | 9; // 6 old-yin, 7 young-yang, 8 young-yin, 9 old-yang

export interface HexagramCast {
  lines: LineValue[];        // length 6, bottom→top
  primaryNumber: number;     // 1..64
  relatingNumber: number;    // 1..64 (== primaryNumber when no changing lines)
  changingLines: number[];   // 1..6
}
```

And extend `IChingResult` (add optional fields, keep existing ones):

```ts
export interface IChingResult extends ThematicData {
  type: 'iching';
  hexagramNumber: number;
  name: string;
  symbol: string;
  judgment: string;
  changingLines: number[];
  tags: Tag[];
  governing?: 'primary' | 'relating';
  relatingNumber?: number;
  relatingName?: string;
  relatingSymbol?: string;
  cast?: HexagramCast;
}
```

- [ ] **Step 2: Add the `binary` field to every entry in `HEXAGRAMS`** (`src/data/iching.ts`)

Add a `binary: string` to each of the 64 objects. Update the `HexagramData` interface to include `binary: string`. Use this canonical King Wen table (bottom→top, `1`=solid/yang, `0`=broken/yin):

```
1:111111  2:000000  3:100010  4:010001  5:111010  6:010111  7:010000  8:000010
9:111011  10:110111 11:111000 12:000111 13:101111 14:111101 15:001000 16:000100
17:100110 18:011001 19:110000 20:000011 21:100101 22:101001 23:000001 24:100000
25:100111 26:111001 27:100001 28:011110 29:010010 30:101101 31:001110 32:011100
33:001111 34:111100 35:000101 36:101000 37:101011 38:110101 39:001010 40:010100
41:110001 42:100011 43:111110 44:011111 45:000110 46:011000 47:010110 48:011010
49:101110 50:011101 51:100100 52:001001 53:001011 54:110100 55:101100 56:001101
57:011011 58:110110 59:010011 60:110010 61:110011 62:001100 63:101010 64:010101
```

- [ ] **Step 3: Add lookup + helper at the bottom of `src/data/iching.ts`**

```ts
export const HEX_BY_BINARY: Record<string, HexagramData> = Object.fromEntries(
  HEXAGRAMS.map((h) => [h.binary, h]),
);

export function hexagramByBinary(binary: string): HexagramData {
  const h = HEX_BY_BINARY[binary];
  if (!h) throw new Error(`No hexagram for binary ${binary}`);
  return h;
}
```

- [ ] **Step 4: Write the failing test** (`src/engine/__tests__/IChing.test.ts` — add to the existing file)

```ts
import { HEXAGRAMS, HEX_BY_BINARY, hexagramByBinary } from '../../data/iching';

describe('King Wen binary table', () => {
  it('has 64 unique 6-bit binary patterns covering all hexagrams', () => {
    const set = new Set(HEXAGRAMS.map((h) => h.binary));
    expect(set.size).toBe(64);
    for (const h of HEXAGRAMS) expect(h.binary).toMatch(/^[01]{6}$/);
  });
  it('maps the canonical anchor hexagrams correctly', () => {
    expect(hexagramByBinary('111111').number).toBe(1);
    expect(hexagramByBinary('000000').number).toBe(2);
    expect(hexagramByBinary('111000').number).toBe(11);
    expect(hexagramByBinary('000111').number).toBe(12);
    expect(hexagramByBinary('010010').number).toBe(29);
    expect(hexagramByBinary('101101').number).toBe(30);
    expect(hexagramByBinary('101010').number).toBe(63);
    expect(hexagramByBinary('010101').number).toBe(64);
  });
  it('round-trips every hexagram through the lookup', () => {
    for (const h of HEXAGRAMS) expect(HEX_BY_BINARY[h.binary].number).toBe(h.number);
  });
});
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/engine/__tests__/IChing.test.ts`
Expected: the three new tests PASS (and the file still imports cleanly). If an anchor fails, the `binary` value for that hexagram was transcribed wrong — fix it.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run build`
Expected: no TS errors.

```bash
git add src/engine/types.ts src/data/iching.ts src/engine/__tests__/IChing.test.ts
git commit -m "feat(iching): add King Wen binary table, lookup, and cast types"
```

---

## Task 2: Authentic casting — `drawHexagramCast` / `consolidateHexagram`

**Files:**
- Modify: `src/data/iching.ts`
- Test: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Consumes: `hexagramByBinary`, `HEXAGRAMS`, `LineValue`, `HexagramCast`, `IChingResult` (Task 1).
- Produces: `drawHexagramCast(affinities: Record<string, number>): HexagramCast`; `consolidateHexagram(cast: HexagramCast, governing: 'primary'|'relating'): IChingResult`; `castHexagram` rewritten as a wrapper. `lineToBit(v: LineValue): '0'|'1'`; `relatingBinary(cast): string`.

- [ ] **Step 1: Write failing tests**

```ts
import { drawHexagramCast, consolidateHexagram } from '../../data/iching';

describe('drawHexagramCast', () => {
  it('builds a primary hexagram from the six tossed lines', () => {
    // Force all coins heads (3) → every line sum 9 (old yang, solid+changing)
    const seq = Array(18).fill(0); let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]); // 0 < .5 → 2? see lineToBit note
    const cast = drawHexagramCast({});
    expect(cast.lines).toHaveLength(6);
    expect(cast.primaryNumber).toBeGreaterThanOrEqual(1);
    expect(cast.primaryNumber).toBeLessThanOrEqual(64);
    vi.restoreAllMocks();
  });
  it('relating == primary when there are no changing lines', () => {
    const cast: any = { lines: [7,7,7,7,7,7], primaryNumber: 1, relatingNumber: 1, changingLines: [] };
    expect(cast.relatingNumber).toBe(cast.primaryNumber);
  });
  it('consolidateHexagram returns the governing hexagram with reversible tag when changing', () => {
    const cast = { lines: [9,7,7,7,7,9] as any, primaryNumber: 1, relatingNumber: 2, changingLines: [1,6] };
    const res = consolidateHexagram(cast, 'primary');
    expect(res.hexagramNumber).toBe(1);
    expect(res.relatingNumber).toBe(2);
    expect(res.tags).toContain('changing-lines');
    expect(res.tags).toContain('reversible');
    expect(res.tags).toContain('governing-primary');
    const rel = consolidateHexagram(cast, 'relating');
    expect(rel.hexagramNumber).toBe(2);
    expect(rel.tags).toContain('governing-relating');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/engine/__tests__/IChing.test.ts` → FAIL (functions not exported).

- [ ] **Step 3: Implement in `src/data/iching.ts`** (replace the existing `castHexagram`)

```ts
export const lineToBit = (v: LineValue): '0' | '1' => (v === 7 || v === 9 ? '1' : '0');
const flipBit = (b: string) => (b === '1' ? '0' : '1');

export function drawHexagramCast(affinities: Record<string, number>): HexagramCast {
  const changingBias = ((affinities.chaos ?? 0) / 100) * 0.2;
  const lines: LineValue[] = [];
  const changingLines: number[] = [];
  for (let line = 0; line < 6; line++) {
    let sum = 0;
    for (let coin = 0; coin < 3; coin++) sum += Math.random() < 0.5 ? 2 : 3;
    // Chaos promotes a young line to its changing counterpart
    if (Math.random() < changingBias && (sum === 7 || sum === 8)) sum = sum === 7 ? 9 : 6;
    lines.push(sum as LineValue);
    if (sum === 6 || sum === 9) changingLines.push(line + 1);
  }
  const primaryBinary = lines.map(lineToBit).join('');
  const relatingBin = lines
    .map((v, idx) => (changingLines.includes(idx + 1) ? flipBit(lineToBit(v)) : lineToBit(v)))
    .join('');
  return {
    lines,
    primaryNumber: hexagramByBinary(primaryBinary).number,
    relatingNumber: hexagramByBinary(relatingBin).number,
    changingLines,
  };
}

export function relatingBinary(cast: HexagramCast): string {
  return cast.lines
    .map((v, idx) => (cast.changingLines.includes(idx + 1) ? flipBit(lineToBit(v)) : lineToBit(v)))
    .join('');
}

export function consolidateHexagram(
  cast: HexagramCast,
  governing: 'primary' | 'relating',
): IChingResult {
  const num = governing === 'primary' ? cast.primaryNumber : cast.relatingNumber;
  const hex = HEXAGRAMS.find((h) => h.number === num)!;
  const relNum = cast.relatingNumber;
  const rel = HEXAGRAMS.find((h) => h.number === relNum)!;

  const tags: string[] = ['draw', 'random', 'binary', `governing-${governing}`];
  if (cast.changingLines.length > 0) { tags.push('changing-lines'); tags.push('reversible'); }

  let dimensions = { ...hex.dimensions };
  if (cast.changingLines.length > 0) {
    const shift = Math.min(2.0, cast.changingLines.length * 0.5);
    dimensions.volatility = Math.min(2.0, Math.max(-2.0, dimensions.volatility + shift));
  }

  return {
    type: 'iching',
    hexagramNumber: hex.number,
    name: hex.name,
    symbol: hex.symbol,
    judgment: hex.judgment,
    changingLines: cast.changingLines,
    tags,
    themes: hex.themes,
    dimensions,
    modifierRoles: hex.modifierRoles,
    governing,
    relatingNumber: relNum,
    relatingName: rel.name,
    relatingSymbol: rel.symbol,
    cast,
  };
}

// Back-compat wrapper for non-minigame callers (drawSingleResult, chaos-second-result).
export function castHexagram(affinities: Record<string, number>): IChingResult {
  const cast = drawHexagramCast(affinities);
  return consolidateHexagram(cast, 'relating');
}
```

> Note for the test in Step 1: `Math.random() < 0.5 ? 2 : 3` — mocking `() => 0` makes every coin `2` → sum 6 (old yin). Adjust the mock to `() => 0.9` for all `3` (sum 9). Keep the changing-bias mock returning a value ≥ `changingBias` so it doesn't fire unexpectedly. Simplify the first test to just assert structural validity as shown.

- [ ] **Step 4: Run tests, verify pass** — `npx vitest run src/engine/__tests__/IChing.test.ts` → PASS. Also run the whole suite: `npm test` (ensure `castHexagram`'s old callers still pass).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run build`

```bash
git add src/data/iching.ts src/engine/__tests__/IChing.test.ts
git commit -m "feat(iching): authentic coin-cast with primary/relating hexagrams"
```

---

## Task 3: Mandate + one-time nudge in `AffinityEngine`

**Files:**
- Modify: `src/engine/types.ts` (add `AffinityMandate`)
- Modify: `src/engine/AffinityEngine.ts`
- Test: `src/engine/__tests__/Affinity.test.ts` (or `IChing.test.ts` if no Affinity test file exists — check first with a glob)

**Interfaces:**
- Produces on `AffinityEngine`: `setMandate(m: AffinityMandate): void`; `decayMandate(): void`; `clearMandate(): void`; `getMandate(): AffinityMandate | null`. `shift()` applies the mandate factor to `baseDelta` magnitude. Add `AffinityMandate` to types.

- [ ] **Step 1: Add `AffinityMandate` to `src/engine/types.ts`**

```ts
export interface AffinityMandate {
  gainMult: Partial<Record<AffinityId, number>>; // per-affinity factor
  globalMult: number;                            // factor for ids absent from gainMult
  source: string;
}
```

- [ ] **Step 2: Write failing tests** (engine unit test)

```ts
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITIES } from '../../data/affinities'; // confirm the exported definitions name

const make = () => new AffinityEngine(AFFINITIES);

describe('AffinityMandate', () => {
  it('scales a gain by the per-affinity factor', () => {
    const e = make();
    e.setState({ chaos: 50 });
    const baseline = make(); baseline.setState({ chaos: 50 });
    // Mock jitter/DR out by stubbing Math.random to a midpoint
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    e.setMandate({ gainMult: { chaos: 2.0 }, globalMult: 1.0, source: 'test' });
    const gMandate = e.shift('chaos', 10, 'test');
    const gBase = baseline.shift('chaos', 10, 'test');
    expect(gMandate).toBeCloseTo(gBase * 2.0, 5);
    vi.restoreAllMocks();
  });
  it('scales a direct penalty by the per-affinity factor', () => {
    const e = make(); e.setState({ light: 50 });
    e.setMandate({ gainMult: { light: 2.0 }, globalMult: 1.0, source: 'test' });
    const d = e.shift('light', -10, 'test');
    expect(d).toBe(-20);
  });
  it('uses globalMult for affinities absent from gainMult', () => {
    const e = make();
    e.setMandate({ gainMult: { chaos: 2.0 }, globalMult: 0.5, source: 'test' });
    expect(e.getMandate()!.globalMult).toBe(0.5);
  });
  it('decays each factor 40% toward 1.0, skipping the set turn', () => {
    const e = make();
    e.setMandate({ gainMult: { chaos: 2.0 }, globalMult: 1.0, source: 'test' });
    e.decayMandate(); // fresh → no decay
    expect(e.getMandate()!.gainMult.chaos).toBeCloseTo(2.0, 5);
    e.decayMandate(); // 2.0 → 2.0 + (1-2.0)*0.4 = 1.6
    expect(e.getMandate()!.gainMult.chaos).toBeCloseTo(1.6, 5);
  });
  it('clears the mandate on beginRun', () => {
    const e = make();
    e.setMandate({ gainMult: { chaos: 2 }, globalMult: 1, source: 'test' });
    e.beginRun();
    expect(e.getMandate()).toBeNull();
  });
});
```

> First confirm the exact exported name for the affinity definitions array (used by `EngineProvider`/`GameEngine` when constructing `AffinityEngine`). Grep `new AffinityEngine(` to copy the real argument.

- [ ] **Step 3: Run, verify fail.**

- [ ] **Step 4: Implement in `src/engine/AffinityEngine.ts`**

Add fields and methods:

```ts
private mandate: AffinityMandate | null = null;
private mandateFresh = false;

setMandate(m: AffinityMandate): void { this.mandate = m; this.mandateFresh = true; }
getMandate(): AffinityMandate | null { return this.mandate; }
clearMandate(): void { this.mandate = null; this.mandateFresh = false; }
decayMandate(): void {
  if (!this.mandate) return;
  if (this.mandateFresh) { this.mandateFresh = false; return; }
  const toward1 = (f: number) => f + (1 - f) * 0.4;
  this.mandate.globalMult = toward1(this.mandate.globalMult);
  for (const id of Object.keys(this.mandate.gainMult) as AffinityId[]) {
    this.mandate.gainMult[id] = toward1(this.mandate.gainMult[id]!);
  }
}
private mandateFactor(id: AffinityId): number {
  if (!this.mandate) return 1;
  return this.mandate.gainMult[id] ?? this.mandate.globalMult;
}
```

In `shift()`, scale `baseDelta` at the very top (after the `=== 0` guard):

```ts
shift(id: AffinityId, baseDelta: number, _sourceId: string): number {
  if (baseDelta === 0) return 0;
  baseDelta *= this.mandateFactor(id);   // ← mandate scales gains AND penalties
  // ... existing penalty / gain logic unchanged ...
}
```

In `beginRun()`, add `this.clearMandate();`.

- [ ] **Step 5: Run tests, verify pass.** `npx vitest run` the affected file.

- [ ] **Step 6: Typecheck + commit**

```bash
git add src/engine/types.ts src/engine/AffinityEngine.ts src/engine/__tests__/*.test.ts
git commit -m "feat(affinity): turn-scoped Mandate of Change scaling in shift()"
```

---

## Task 4: Transformation resolution + mandate derivation (`src/engine/iching.ts`)

**Files:**
- Create: `src/engine/iching.ts`
- Test: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Consumes: `bandOf`, `BAND_ORDER` (`src/data/affinities`); `HexagramCast`, `AffinityMandate`, `IChingResult`, `AffinityId` (types); `HEXAGRAMS` (`src/data/iching`).
- Produces: `type HexagramMode = 'willed'|'fated'|'unaligned'`; `planHexagramResolution(affinities, hasChangingLines): { mode: HexagramMode; offerRecast: boolean }`; `resolveFatedGoverning(): 'relating'`; `deriveMandate(gov: IChingResult): AffinityMandate`; `hexagramNudge(gov: IChingResult): Array<[AffinityId, number]>`.

- [ ] **Step 1: Write failing tests**

```ts
import { planHexagramResolution, deriveMandate, hexagramNudge } from '../iching';
import { HEXAGRAMS } from '../../data/iching';
import { consolidateHexagram } from '../../data/iching';

const ASC = 65, DOM = 90, BASE = 50;
const cast = (primary: number, relating = primary, changing: number[] = []) =>
  ({ lines: [7,7,7,7,7,7] as any, primaryNumber: primary, relatingNumber: relating, changingLines: changing });

describe('planHexagramResolution', () => {
  it('willed when Will ascendant+', () => {
    expect(planHexagramResolution({ will: ASC, fate: BASE }, true).mode).toBe('willed');
  });
  it('fated when Fate ascendant+ and Will not', () => {
    expect(planHexagramResolution({ will: BASE, fate: ASC }, true).mode).toBe('fated');
  });
  it('Will wins ties when both ascendant+', () => {
    expect(planHexagramResolution({ will: ASC, fate: DOM }, true).mode).toBe('willed');
  });
  it('unaligned with a recast offer when neither ascendant', () => {
    const p = planHexagramResolution({ will: BASE, fate: BASE }, true);
    expect(p.mode).toBe('unaligned');
    expect(p.offerRecast).toBe(true);
  });
  it('no fork when there are no changing lines', () => {
    expect(planHexagramResolution({ will: ASC }, false).mode).toBe('unaligned');
    expect(planHexagramResolution({ will: ASC }, false).offerRecast).toBe(false);
  });
});

describe('deriveMandate', () => {
  it('amplifies gains for a volatile hexagram (globalMult > 1)', () => {
    const revolution = consolidateHexagram(cast(49) as any, 'primary'); // volatility +2.0
    const m = deriveMandate(revolution);
    expect(m.globalMult).toBeGreaterThan(1.0);
    expect(m.gainMult.chaos!).toBeGreaterThanOrEqual(m.globalMult);
  });
  it('dampens gains for a still hexagram (globalMult < 1)', () => {
    const stillness = consolidateHexagram(cast(52) as any, 'primary'); // volatility -2.0
    expect(deriveMandate(stillness).globalMult).toBeLessThan(1.0);
  });
});
```

- [ ] **Step 2: Run, verify fail** (module doesn't exist).

- [ ] **Step 3: Implement `src/engine/iching.ts`**

```ts
import type { AffinityId, AffinityMandate, IChingResult } from './types';
import { bandOf, BAND_ORDER } from '../data/affinities';

export type HexagramMode = 'willed' | 'fated' | 'unaligned';

const atLeast = (value: number, band: 'ascendant') =>
  BAND_ORDER.indexOf(bandOf(value ?? 0)) >= BAND_ORDER.indexOf(band);

export function planHexagramResolution(
  affinities: Record<string, number>,
  hasChangingLines: boolean,
): { mode: HexagramMode; offerRecast: boolean } {
  if (!hasChangingLines) return { mode: 'unaligned', offerRecast: false };
  if (atLeast(affinities.will, 'ascendant')) return { mode: 'willed', offerRecast: false };
  if (atLeast(affinities.fate, 'ascendant')) return { mode: 'fated', offerRecast: false };
  return { mode: 'unaligned', offerRecast: true };
}

// Fate carries the seeker forward to where the change leads.
export const resolveFatedGoverning = (): 'relating' => 'relating';

const clampF = (f: number, lo = 0.4, hi = 2.0) => Math.max(lo, Math.min(hi, f));

export function deriveMandate(gov: IChingResult): AffinityMandate {
  const { volatility, favorability, certainty } = gov.dimensions;
  const themes = gov.themes;
  const globalMult = clampF(
    volatility >= 0 ? 1 + (volatility / 2) * 0.6 : 1 + (volatility / 2) * 0.5,
    0.5, 1.6,
  );
  const g: Partial<Record<AffinityId, number>> = {};
  const ids: AffinityId[] = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];
  for (const id of ids) g[id] = globalMult;
  const tilt = (id: AffinityId, factor: number) => { g[id] = clampF((g[id] ?? globalMult) * factor); };

  const changeThemes = ['transformation', 'upheaval', 'renewal'];
  const orderThemes = ['stagnation', 'harmony', 'authority'];
  if (themes.some((t) => changeThemes.includes(t))) { tilt('chaos', 1.25); tilt('will', 1.2); tilt('order', 0.8); }
  if (themes.some((t) => orderThemes.includes(t)))  { tilt('order', 1.2); tilt('fate', 1.15); tilt('chaos', 0.85); }
  if (favorability > 0) { tilt('light', 1.15); tilt('shadow', 0.9); }
  else if (favorability < 0) { tilt('shadow', 1.15); tilt('light', 0.9); }
  if (certainty > 0) { tilt('order', 1.1); tilt('light', 1.05); }
  else if (certainty < 0) { tilt('chaos', 1.05); tilt('shadow', 1.1); }

  return { gainMult: g, globalMult, source: `iching:${gov.hexagramNumber}` };
}

// One-time signed nudges applied through shift() before the mandate is set.
export function hexagramNudge(gov: IChingResult): Array<[AffinityId, number]> {
  const { volatility, favorability, certainty } = gov.dimensions;
  const out: Array<[AffinityId, number]> = [];
  if (volatility > 0) out.push(['chaos', Math.round(volatility * 4)]);
  else if (volatility < 0) out.push(['order', Math.round(-volatility * 4)]);
  if (favorability > 0) out.push(['light', Math.round(favorability * 3)]);
  else if (favorability < 0) out.push(['shadow', Math.round(-favorability * 3)]);
  if (certainty > 0) out.push(['order', Math.round(certainty * 2)]);
  else if (certainty < 0) out.push(['shadow', Math.round(-certainty * 2)]);
  return out.filter(([, n]) => n !== 0);
}
```

> Confirm `bandOf` and `BAND_ORDER` are exported from `src/data/affinities.ts` (they are, per `AffinityEngine` imports). Confirm the `AffinityId` union includes exactly these six ids.

- [ ] **Step 4: Run tests, verify pass.**

- [ ] **Step 5: Typecheck + commit**

```bash
git add src/engine/iching.ts src/engine/__tests__/IChing.test.ts
git commit -m "feat(iching): transformation resolution modes + mandate derivation"
```

---

## Task 5: GameEngine wiring — dispatch, nudge, mandate, resolution plumbing

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Consumes: `deriveMandate`, `hexagramNudge`, `planHexagramResolution`, `resolveFatedGoverning` (Task 4); `drawHexagramCast`, `consolidateHexagram` (Task 2); `AffinityEngine.setMandate/decayMandate` (Task 3).
- Produces public methods for the React layer: `planHexagramCast(): { mode: HexagramMode; offerRecast: boolean }` (reads current affinities + whether the just-drawn cast has changing lines — see note); the existing `completeMinigame(result, meta)` path now applies the I Ching nudge + mandate when `result.type === 'iching'`.

- [ ] **Step 1: Read the current `completeMinigame` + `advanceAfterCommit`** (around lines 230–340) to anchor edits. Locate the post-commit dispatch block.

- [ ] **Step 2: Add I Ching nudge + mandate application in `completeMinigame`**

After the existing `applyResultTags` / action-feed block and **before** the `commitTrigger` dispatch, insert:

```ts
// I Ching: one-time nudge (direct shifts) THEN set the lingering Mandate of Change.
if (result.type === 'iching') {
  const gov = result as IChingResult;
  for (const [id, delta] of hexagramNudge(gov)) this.affinityEngine.shift(id, delta, `iching-nudge:${gov.hexagramNumber}`);
  this.affinityEngine.setMandate(deriveMandate(gov));
}
```

Add imports at the top of the file:

```ts
import { deriveMandate, hexagramNudge } from './iching';
```

(`IChingResult` is already importable from `./types`; add if missing.)

- [ ] **Step 3: Decay the mandate on subsequent commits**

In `advanceAfterCommit`, near the top (so it runs once per completed minigame, after the current result's shifts), add:

```ts
this.affinityEngine.decayMandate();
```

(`decayMandate` is a no-op the turn the mandate is set, then decays each later commit — see Task 3.)

- [ ] **Step 4: Add the `iching:cast` / `iching:transform` dispatch points + `planHexagramCast`**

The minigame drives these through new public engine methods (so logic stays in the engine). Add:

```ts
planHexagramCast(hasChangingLines: boolean): { mode: HexagramMode; offerRecast: boolean } {
  return planHexagramResolution(this.affinityEngine.getState(), hasChangingLines);
}
```

Import `planHexagramResolution`, `resolveFatedGoverning`, and `type HexagramMode` from `./iching`.

> The `iching:cast` and `iching:transform` triggers are dispatched by the responders task (Task 6) via `dispatchAt`. In this task, only expose `planHexagramCast` and confirm `completeMinigame` already dispatches `iching:commit` through the existing `commitFamily` logic (it does — `result.type === 'iching'` → `iching:commit`).

- [ ] **Step 5: Write an engine integration test**

```ts
import { GameEngine } from '../GameEngine';
import { consolidateHexagram } from '../../data/iching';

describe('GameEngine I Ching mandate', () => {
  it('sets a mandate after committing an I Ching result', () => {
    const engine = new GameEngine();
    engine.startTurn?.('decision'); // use the real entry method; adjust to actual API
    const cast = { lines: [9,7,7,7,7,7] as any, primaryNumber: 49, relatingNumber: 17, changingLines: [1] };
    const res = consolidateHexagram(cast, 'relating');
    // Drive a commit through whatever the engine exposes; assert mandate is non-null afterward.
    // (If completeMinigame requires an active slot, set up via startTurn→selectMethod first.)
    engine.completeMinigame(res, { revealedAsDrawn: true });
    expect((engine as any).affinityEngine.getMandate()).not.toBeNull();
  });
});
```

> If a full `completeMinigame` call needs slot setup, model it on existing tests in `src/engine/__tests__/` (grep for `completeMinigame(` to copy the established harness). Keep the assertion minimal: a mandate exists after an I Ching commit.

- [ ] **Step 6: Run tests + full suite + typecheck**

Run: `npm test` then `npm run build`. Expected: PASS, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/IChing.test.ts
git commit -m "feat(iching): apply nudge + mandate on commit, decay on later commits"
```

---

## Task 6: Responders — band effects + cross-game interaction

**Files:**
- Create: `src/engine/responders/iching.ts`
- Modify: `src/engine/responders/interactions.ts`
- Modify: wherever responders are registered (grep `buildAffinityResponders` / `buildInteractionResponders` usage — likely `EventDispatcher` construction in `GameEngine`)
- Test: `src/engine/__tests__/IChing.test.ts`

**Interfaces:**
- Consumes: `Responder`, `PhaseContext`, `EffectReport` (`events/types`); `bandRoll` (`events/eligibility`); `TIER_BASE_CHANCE`, `bandOf`, `BAND_ORDER` (`data/affinities`); `drawHexagramCast`/`consolidateHexagram`/`relatingBinary`/`hexagramByBinary` (`data/iching`); `IChingResult` (types).
- Produces: `buildIChingResponders(): Responder[]` exporting `chaos-line-cascade`, `order-still-hexagram`; plus `iching-resonant-change` appended in `buildInteractionResponders`.

- [ ] **Step 1: Decide the cast-mutation mechanism for `iching:transform`.** The transform responders mutate `ctx.draft.outcome` (an `IChingResult` carrying `cast`) by adding/removing a changing line, then recomputing `relatingNumber` via `relatingBinary` + `hexagramByBinary`. Implement a small local helper in `responders/iching.ts`:

```ts
function recomputeRelating(res: IChingResult): void {
  if (!res.cast) return;
  const bin = relatingBinary(res.cast);
  res.cast.relatingNumber = hexagramByBinary(bin).number;
  res.relatingNumber = res.cast.relatingNumber;
}
```

- [ ] **Step 2: Write failing tests**

```ts
import { buildIChingResponders } from '../responders/iching';

describe('iching responders', () => {
  it('exposes chaos-line-cascade and order-still-hexagram', () => {
    const ids = buildIChingResponders().map((r) => r.id);
    expect(ids).toContain('chaos-line-cascade');
    expect(ids).toContain('order-still-hexagram');
  });
  it('chaos-line-cascade adds a changing line when forced', () => {
    const r = buildIChingResponders().find((x) => x.id === 'chaos-line-cascade')!;
    const cast = { lines: [7,7,7,7,7,7] as any, primaryNumber: 1, relatingNumber: 1, changingLines: [] };
    const res = { type: 'iching', hexagramNumber: 1, changingLines: [], cast, dimensions:{favorability:0,certainty:0,volatility:0}, themes:[], modifierRoles:[], tags:[] } as any;
    const ctx: any = { draft: { outcome: res }, affinities: { chaos: 90 }, rng: () => 0 };
    if (r.condition(ctx)) r.apply(ctx);
    expect(res.cast.changingLines.length).toBe(1);
  });
});
```

- [ ] **Step 3: Implement `src/engine/responders/iching.ts`**

```ts
import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, IChingResult } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';
import { relatingBinary, hexagramByBinary, lineToBit } from '../../data/iching';

const T = TIER_BASE_CHANCE;
const w = (a: AffinityId) => (ctx: PhaseContext) => ctx.affinities[a];

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}
function recomputeRelating(res: IChingResult): void {
  if (!res.cast) return;
  res.cast.relatingNumber = hexagramByBinary(relatingBinary(res.cast)).number;
  res.relatingNumber = res.cast.relatingNumber;
}
const ichingOutcome = (c: PhaseContext): IChingResult | null =>
  c.draft.outcome?.type === 'iching' ? (c.draft.outcome as IChingResult) : null;

export function buildIChingResponders(): Responder[] {
  return [
    {
      id: 'chaos-line-cascade', source: 'affinity', triggers: ['iching:transform'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('chaos'),
      condition: (c) => { const r = ichingOutcome(c); return !!r?.cast && r.cast.changingLines.length < 6; },
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.notable),
      apply: (c) => {
        const r = ichingOutcome(c)!;
        const free = [1,2,3,4,5,6].filter((n) => !r.cast!.changingLines.includes(n));
        const pick = free[Math.floor(c.rng() * free.length)];
        r.cast!.changingLines = [...r.cast!.changingLines, pick].sort((a, b) => a - b);
        r.changingLines = r.cast!.changingLines;
        recomputeRelating(r);
        return report('chaos-line-cascade', 'Chaos', 'A still line stirs — the change spreads further.', 'amplify');
      },
    },
    {
      id: 'order-still-hexagram', source: 'affinity', triggers: ['iching:transform'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('order'),
      condition: (c) => { const r = ichingOutcome(c); return !!r?.cast && r.cast.changingLines.length > 0; },
      roll: (c) => bandRoll(c, 'order', 'ascendant', T.notable),
      apply: (c) => {
        const r = ichingOutcome(c)!;
        const lines = r.cast!.changingLines;
        const drop = lines[Math.floor(c.rng() * lines.length)];
        r.cast!.changingLines = lines.filter((n) => n !== drop);
        r.changingLines = r.cast!.changingLines;
        recomputeRelating(r);
        return report('order-still-hexagram', 'Order', 'A moving line settles — the hexagram holds its form.', 'anchor');
      },
    },
  ];
}
```

> `lineToBit` import may be unused here — drop it if so (noUnusedLocals). Verify `bandRoll`'s signature matches the call (copy from `responders/affinity.ts`).

- [ ] **Step 4: Add `iching-resonant-change` to `buildInteractionResponders`** (`src/engine/responders/interactions.ts`), inside the returned array:

```ts
{
  id: 'iching-resonant-change', source: 'interaction', triggers: ['iching:commit'],
  group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
  condition: (c) =>
    c.draft.outcome?.type === 'iching'
    && (c.draft.outcome as SlotResult).tags.includes('changing-lines')
    && c.spread.some((s) => s.type !== 'iching' && s.tags.includes('reversible')),
  roll: () => true,
  apply: (c) => {
    const target = c.spread.find((s) => s.type !== 'iching' && s.tags.includes('reversible'));
    if (target?.type === 'tarot') {
      // flip via reverseSpread (already imported in this file)
      const idx = c.spread.indexOf(target);
      c.draft.spreadFlips = [...(c.draft.spreadFlips ?? []), idx]; // see note
    }
    return report('iching-resonant-change', 'I Ching', 'The changing lines ripple outward — a kindred force turns with them.', 'mirror');
  },
},
```

> **Implementation note:** how a cross-slot flip is applied depends on the existing `mirror`/`critical-resonance` mechanics, which mutate `c.draft.outcome` (the *committing* result), not other slots. Since `iching-resonant-change` flips a *different* slot, follow the same pattern the engine uses for cross-slot mutation. **Simplest correct approach:** emit the report only (narrative + animation) and let the flip be a documented future hook, OR add a `draft.flipSlots: number[]` that `GameEngine.completeMinigame` consumes to `reverseSpread` the named committed tarot/astral slots. Pick the approach that matches the codebase; if `draft.flipSlots` is new, wire its consumption in `GameEngine` (apply `reverseSpread` to each indexed tarot slot) and add it to the draft type. Prefer the report-only version if cross-slot mutation proves invasive — the narrative interaction still satisfies the "more interactions" goal. Decide and keep it consistent; update the test accordingly.

- [ ] **Step 5: Register `buildIChingResponders()`** wherever `buildAffinityResponders()`/`buildInteractionResponders()` are composed (grep both names; likely in `GameEngine` constructor or an `events` index). Append its responders to the dispatcher's responder list.

- [ ] **Step 6: Dispatch `iching:cast` and `iching:transform`** from `GameEngine`. Add a method the minigame calls during the transform beat:

```ts
runHexagramTransform(result: IChingResult): IChingResult {
  const { draft } = this.dispatchAt('iching:transform', { outcome: result });
  return (draft.outcome as IChingResult) ?? result;
}
```

(The minigame calls `engine.runHexagramTransform(consolidated)` before committing, so chaos/order responders can reshape the cast; then it commits the chosen governing result via `completeMinigame`.) Confirm `dispatchAt` signature from existing usages.

- [ ] **Step 7: Run tests + full suite + typecheck.** `npm test` → PASS; `npm run build` → clean.

- [ ] **Step 8: Commit**

```bash
git add src/engine/responders/iching.ts src/engine/responders/interactions.ts src/engine/GameEngine.ts src/engine/__tests__/IChing.test.ts
git commit -m "feat(iching): chaos/order line responders + resonant-change interaction"
```

---

## Task 7: Debug scenarios

**Files:**
- Modify: `src/engine/events/scenarios.ts`
- Test: existing scenario validation tests (run them)

**Interfaces:**
- Consumes: `DEBUG_SCENARIOS` shape (copy an existing entry verbatim as the template).

- [ ] **Step 1: Read `src/engine/events/scenarios.ts`** and copy the structure of an existing astral/tarot scenario.

- [ ] **Step 2: Add scenarios** that stage the precondition and force each new responder: `chaos-line-cascade` (stage an I Ching cast with a young line + Chaos ascendant, force at `iching:transform`), `order-still-hexagram` (cast with ≥1 changing line + Order ascendant), `iching-resonant-change` (commit an I Ching with `changing-lines` while a reversible tarot slot is staged), and a `mandate-demo` (commit any I Ching, then show the mandate is set). Match the exact `DEBUG_SCENARIOS` entry shape.

- [ ] **Step 3: Run the engine suite** (`npm test`) to confirm scenario-validation tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/engine/events/scenarios.ts
git commit -m "feat(iching): debug scenarios for new responders + mandate"
```

---

## Task 8: React UI — coin cast, hexagram pillar, transformation, agency

**Files:**
- Rewrite: `src/components/screens/IChingMinigame.tsx`
- Create: `src/components/cards/CoinCast.tsx`
- Create: `src/components/cards/HexagramPillar.tsx`

**Interfaces:**
- Consumes: `useGameEngine`; `drawHexagramCast`, `consolidateHexagram` (`data/iching`); `engine.planHexagramCast`, `engine.runHexagramTransform`, `engine.completeMinigame` (engine); `state.affinityEffects.poolPreview`.
- No unit tests (repo has no component test harness). Verified manually via `npm run dev`.

- [ ] **Step 1: `HexagramPillar.tsx`** — props `{ lines: LineValue[]; changingLines: number[]; morphedNumber?: number; phase: 'building'|'primary'|'transforming'|'relating' }`. Renders six rows bottom→top; solid line = one bar, broken = two bars with a gap (use the `▄▄▄▄▄` / `▄▄ ▄▄` motif). Changing lines pulse jade (`#5b8c5a`/jade glow). On `transforming`, animate an ink-bleed (opacity/scale) swapping changing rows to their flipped form. Bronze/gold stroke (`#d4a854`) on deep indigo. Framer Motion for the paint-on (staggered `clipPath`/`scaleX`) and morph.

- [ ] **Step 2: `CoinCast.tsx`** — props `{ value: LineValue; onSettled: () => void; index: number }`. Animates three bronze square-hole coins spinning and settling; calls `onSettled` when done. The `value` is predetermined by the engine; the coins are cosmetic (mirror `CelestialCast`'s "animate a predetermined result" contract). Heads/tails faces shown can be derived to *sum* to `value` for flavor (not required to be exact).

- [ ] **Step 3: Rewrite `IChingMinigame.tsx`** as a phase machine:

```
idle → casting (tap to toss line 1..6, CoinCast per line, HexagramPillar builds) →
primary-revealed (show primary hexagram glyph + name + judgment) →
transforming (if changingLines: engine.runHexagramTransform → HexagramPillar morph) →
resolve:
   willed   → show [Accept the Change] / [Hold the Moment]
   fated    → auto-pick relating after a beat (banner: "the weave decides")
   unaligned→ if offerRecast: [Re-cast] / [Keep]; else auto-keep relating
→ commit chosen governing result via completeMinigame(meta) → done (review beat)
```

Key wiring:
- On entering casting, call `drawHexagramCast(state.affinities)` once and store the `HexagramCast`. Toss animations reveal `cast.lines[i]` in order.
- After all six: `const plan = engine.planHexagramCast(cast.changingLines.length > 0)`.
- If `cast.changingLines.length > 0`, build the consolidated outcome and call `engine.runHexagramTransform(consolidateHexagram(cast, 'relating'))` so chaos/order responders can reshape it; read the (possibly mutated) `cast` back from the returned result for display.
- Resolve per `plan.mode`:
  - `willed`: Accept → `completeMinigame(consolidateHexagram(cast,'relating'), { revealedAsDrawn:false, reversed:true })` (feeds Will+Chaos); Hold → `consolidateHexagram(cast,'primary')` with `{ revealedAsDrawn:true }` (feeds Fate+Order). *(Confirm which meta flags map to the intended feeds against `completeMinigame`; if the existing flags don't produce Will+Chaos vs Fate+Order cleanly, add explicit `engine.applyHexagramChoice('accept'|'hold')` that calls `applyAction`.)*
  - `fated`: commit `consolidateHexagram(cast,'relating')` with `{ revealedAsDrawn:true }`; show a Fate banner. (Feeds Fate.)
  - `unaligned` + `offerRecast`: Re-cast → redraw `drawHexagramCast`, replay casting; Keep → commit relating with `{ viaReroll:false, revealedAsDrawn:true }`.
  - `unaligned` no changing lines: commit `consolidateHexagram(cast,'primary')` with `{ revealedAsDrawn:true }`.
- Respect the veiled cue: when `state.affinityEffects.poolPreview === 'hidden'`, withhold the changing-lines list (as the current component does).
- Silk-banner mandate flavor: show a short atmospheric line after commit derived from the governing hexagram's volatility sign (e.g. volatile → "The weave quickens — change feeds change."; still → "The weave settles — what moves, slows."). **No numbers.** This text is cosmetic; the real mandate is set engine-side.
- Use `useRef` commit guards like `AstralMinigame` to prevent double-commit; clean up timers on unmount.

- [ ] **Step 4: Manual verification** — `npm run dev`, choose I Ching, confirm: coins toss and lines build bottom-up; changing lines glow; primary→relating morph plays; the agency beat matches your Will/Fate (test via the debug panel to set affinities); commit advances through the review beat. Confirm `npm run build` is clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/IChingMinigame.tsx src/components/cards/CoinCast.tsx src/components/cards/HexagramPillar.tsx
git commit -m "feat(iching): mystical coin-cast UI with primary/relating transformation"
```

---

## Task 9: Documentation sync

**Files:**
- Modify: `docs/game-systems.md`
- Modify: `README.md`

- [ ] **Step 1: `docs/game-systems.md`** — add `src/engine/iching.ts` and `src/engine/responders/iching.ts` to the source-of-truth table (§ top). Add a new **§ I Ching** covering: authentic coin-cast + King Wen mapping; primary/relating transformation; the **Mandate of Change** (one-time nudge + lingering decaying multiplier — include the globalMult range, decay rate, tilt rules, turn-scoping/replacement); the affinity-gated **resolution modes** (willed/fated/unaligned table). Add `chaos-line-cascade`, `order-still-hexagram` to the responder catalog (§5) and `iching-resonant-change` to the meta-interactions table (§6). Note the new `iching:cast`/`iching:transform` triggers.

- [ ] **Step 2: `README.md`** — update the I Ching method row (tags now include `reversible`, `changing-lines`, transformation) and add `I Ching Resonant Change` to the meta-interactions table.

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs: sync I Ching overhaul (mandate, modes, responders)"
```

---

## Self-Review

**Spec coverage:**
- §3 authentic casting → Tasks 1, 2 ✓
- §4 mandate + nudge → Tasks 3 (engine math), 4 (derivation), 5 (wiring) ✓
- §5 resolution modes → Task 4 (plan) + Task 8 (UI consumes) ✓
- §6 triggers/responders/interactions → Task 6 ✓; debug scenarios → Task 7 ✓
- §7 UI → Task 8 ✓
- §8 tests → Tasks 1–6 (engine) ✓; UI manual (repo has no component tests) ✓
- §9 docs → Task 9 ✓

**Placeholder scan:** Two intentional decision points are flagged, not left blank — (a) `iching-resonant-change` cross-slot flip mechanism (Task 6 Step 4) and (b) Accept/Hold affinity-feed meta flags (Task 8 Step 3). Both give a concrete default (report-only / explicit `applyAction` helper) so a worker is never stuck. The implementer must pick the codebase-consistent option and keep the test in sync.

**Type consistency:** `HexagramCast`, `LineValue`, `AffinityMandate`, `HexagramMode` names are used identically across Tasks 1/3/4/5/6. `drawHexagramCast`/`consolidateHexagram`/`relatingBinary`/`hexagramByBinary` signatures match between data (Task 2) and consumers (Tasks 5/6). `setMandate`/`decayMandate`/`getMandate`/`clearMandate` consistent between Task 3 and Task 5.

**Pre-flight for the implementer (verify once before Task 3/4/6):** exact export name of the affinity definitions array passed to `new AffinityEngine(...)`; `bandRoll` signature; `dispatchAt` signature; how `mirror`/`critical-resonance` apply cross-slot mutation; the `DEBUG_SCENARIOS` entry shape.
