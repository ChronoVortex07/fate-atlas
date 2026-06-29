# Corruption — Seed Visibility & Spawn-Odds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the silent corruption "seeded" band perceptible (a divination-flavored omen + debug-panel observability) and rebalance the seed spawn chance so breadth of imbalance dominates.

**Architecture:** Three independent slices — (1) a hybrid `seedChance(food, highCount)` in the data/engine layer; (2) a clean-prose seed omen woven into the synthesis at the `seeded` band; (3) a corruption readout + setter section in the debug Dashboard. The engine stays framework-free; React only reads `state.corruption` and calls `engine.setCorruption`.

**Tech Stack:** React 18 + TypeScript + Vite; Vitest (engine/data tests only, Node env, `Math.random` stubbed for randomness).

## Global Constraints

- Engine is framework-free: no React/DOM imports in `src/engine/**` or `src/data/**`.
- Every engine mutator that should re-render ends with `notify()`. `setCorruption` already does.
- Tests run only under `src/engine/__tests__/**`. No component tests — debug-panel UI (Task 3) is verified manually via `npm run dev`.
- Typecheck with `npm run build` (strict, `noUnusedLocals`, `noUnusedParameters`).
- `HIGH_THRESHOLD = 81`; an affinity is "high" iff its value is strictly `> 81` (matches `corruptionFood`, where 81 contributes 0).
- Playtest-default constants (this plan pins tests to them): `SEED_FOOD_FACTOR = 0.004`, `SEED_MAX_CHANCE = 0.85`, `SEED_COUNT_GROWTH = 1.7`.
- Per `CLAUDE.md`: corruption behavior is documented in `docs/game-systems.md` (+ README) and MUST be updated in the same change (Task 4).

---

### Task 1: Hybrid seed-odds rebalance (count gates, excess fills)

**Files:**
- Modify: `src/data/corruption.ts` (constants + `highAffinityCount` + rewrite `seedChance`)
- Modify: `src/engine/CorruptionEngine.ts:46-49` (pass `highCount` into `seedChance`)
- Test: `src/engine/__tests__/CorruptionData.test.ts` (rewrite `seedChance` block, add `highAffinityCount` block)
- Test: `src/engine/__tests__/CorruptionEngine.test.ts:23` (update stale arithmetic comment)

**Interfaces:**
- Produces: `seedChance(food: number, highCount: number): number`, `highAffinityCount(affinities: Record<AffinityId, number>): number`, exported const `SEED_COUNT_GROWTH: number`, and the raised `SEED_MAX_CHANCE = 0.85`.
- Consumes: existing `corruptionFood`, `HIGH_THRESHOLD`, `SEED_FOOD_FACTOR`, `AFFINITY_IDS` (already imported in `corruption.ts`).

- [ ] **Step 1: Write the failing tests**

In `src/engine/__tests__/CorruptionData.test.ts`, update the import line to add `SEED_COUNT_GROWTH` and `highAffinityCount`:

```ts
import {
  corruptionFood, corruptionBandOf, seedChance, highAffinityCount,
  HIGH_THRESHOLD, SEED_MAX_CHANCE, SEED_COUNT_GROWTH, PINNACLE,
} from '../../data/corruption';
```

Replace the entire existing `describe('seedChance', ...)` block (lines ~42-51) with:

```ts
describe('highAffinityCount', () => {
  it('counts only affinities strictly above the high threshold', () => {
    expect(highAffinityCount(vec({ chaos: HIGH_THRESHOLD }))).toBe(0); // exactly 81 does not count
    expect(highAffinityCount(vec({ chaos: 82, order: 100 }))).toBe(2);
    expect(highAffinityCount(vec({
      chaos: 100, order: 100, fate: 100, will: 100, light: 100, shadow: 100,
    }))).toBe(6);
  });
});

describe('seedChance', () => {
  it('is zero with no high affinities (no breadth → no corruption, ever)', () => {
    expect(seedChance(0, 0)).toBe(0);
    expect(seedChance(50, 0)).toBe(0); // guarded: food without count cannot seed
  });

  it('scales with food and is capped', () => {
    expect(seedChance(10, 1)).toBeGreaterThan(0);
    expect(seedChance(100_000, 6)).toBe(SEED_MAX_CHANCE);
  });

  it('gates exponentially on the count of high affinities (breadth dominates)', () => {
    // same food, more high affinities → strictly higher chance (below the cap)
    expect(seedChance(19, 2)).toBeCloseTo(seedChance(19, 1) * SEED_COUNT_GROWTH, 10);
    expect(seedChance(19, 3)).toBeGreaterThan(seedChance(19, 2));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/CorruptionData.test.ts`
Expected: FAIL — `highAffinityCount` is not exported; `seedChance` called with 2 args / new shape not yet implemented.

- [ ] **Step 3: Implement the data-layer changes**

In `src/data/corruption.ts`, raise the cap and add the growth constant (replace the existing `SEED_MAX_CHANCE` line, keep `SEED_FOOD_FACTOR`):

```ts
export const SEED_FOOD_FACTOR = 0.004; // per-reading seed chance added per excess point (the "fill")
export const SEED_MAX_CHANCE = 0.85;   // cap on the per-reading seed chance (raised from 0.25 so a full hoard dominates; never 1.0 — a seed is never guaranteed)
export const SEED_COUNT_GROWTH = 1.7;  // exponential multiplier per additional high affinity (the "gate")
```

Then replace the existing `seedChance` function (lines ~38-42) with the helper + hybrid form:

```ts
// How many affinities sit strictly above the high threshold — the breadth of imbalance.
export function highAffinityCount(affinities: Record<AffinityId, number>): number {
  let n = 0;
  for (const id of AFFINITY_IDS) if (affinities[id] > HIGH_THRESHOLD) n++;
  return n;
}

// Count gates an exponential multiplier; total excess (food) fills the magnitude.
// No high affinity → zero chance, ever. Capped so a seed is never guaranteed.
export function seedChance(food: number, highCount: number): number {
  if (highCount <= 0 || food <= 0) return 0;
  return Math.min(SEED_MAX_CHANCE, SEED_FOOD_FACTOR * food * Math.pow(SEED_COUNT_GROWTH, highCount - 1));
}
```

- [ ] **Step 4: Wire the engine call site**

In `src/engine/CorruptionEngine.ts`, add `highAffinityCount` to the existing import from `'../data/corruption'`:

```ts
import {
  corruptionFood, corruptionBandOf, seedChance, highAffinityCount,
  SEED_INITIAL, EROSION_RATE, SKIM_RATE, DRAIN_RATE, DECAY_RATE,
  HIGH_THRESHOLD, PINNACLE,
} from '../data/corruption';
```

Then update the dormant-branch seed roll (line ~47) to pass the count:

```ts
    if (this.value <= 0) {
      const seeded = food > 0 && rng() < seedChance(food, highAffinityCount(affinities));
      if (seeded) this.value = SEED_INITIAL;
      return this.report(seeded, {}); // a fresh seed neither drains nor ruptures this tick
    }
```

- [ ] **Step 5: Fix the stale comment in CorruptionEngine.test.ts**

In `src/engine/__tests__/CorruptionEngine.test.ts:23`, update the arithmetic comment (the test still passes — `hoarded` is `chaos:100, order:100` → food 38, highCount 2 → `seedChance(38, 2) ≈ 0.258`, and `rng=0` still seeds):

```ts
    const r = e.tick(hoarded, 0, () => 0); // 0 < seedChance(38, 2) ≈ 0.258
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npm test`
Expected: PASS (all corruption tests green, including the recomputed `seedChance`/`highAffinityCount`).
Run: `npm run build`
Expected: typecheck passes (the 2-arg `seedChance` signature has no other callers than `CorruptionEngine.tick`).

- [ ] **Step 7: Commit**

```bash
git add src/data/corruption.ts src/engine/CorruptionEngine.ts src/engine/__tests__/CorruptionData.test.ts src/engine/__tests__/CorruptionEngine.test.ts
git commit -m "feat(corruption): hybrid count-gated seed-spawn odds"
```

---

### Task 2: Seed omen woven into the seeded-band synthesis

**Files:**
- Modify: `src/engine/CorruptionGlitch.ts` (add `SEED_OMENS`, `seedOmen`, `appendSeedOmen`)
- Modify: `src/engine/GameEngine.ts:726-731` (branch the synthesis post-processing on band)
- Test: `src/engine/__tests__/CorruptionGlitch.test.ts` (unit-test the omen helpers)
- Test: `src/engine/__tests__/CorruptionGlitchWiring.test.ts` (wiring: omen at seeded, absent at dormant)

**Interfaces:**
- Produces: `SEED_OMENS: string[]`, `seedOmen(rng: () => number): string`, `appendSeedOmen(s: SynthesisResult, rng: () => number): SynthesisResult`.
- Consumes: `SynthesisResult` (already imported in `CorruptionGlitch.ts`); `corruptionEngine.getBand()` returning `'seeded'` for value 1–34 (Task 1 unchanged this).

- [ ] **Step 1: Write the failing helper unit tests**

In `src/engine/__tests__/CorruptionGlitch.test.ts`, extend the import on line 2:

```ts
import { corruptionTextLevel, interiorTypo, corruptText, corruptSynthesis, SEED_OMENS, seedOmen, appendSeedOmen } from '../CorruptionGlitch';
```

Append this describe block to the file:

```ts
describe('seed omen', () => {
  it('selects a line from the pool by rng', () => {
    expect(seedOmen(() => 0)).toBe(SEED_OMENS[0]);
    expect(seedOmen(() => 0.999)).toBe(SEED_OMENS[SEED_OMENS.length - 1]);
  });

  it('appends the omen as a closing paragraph without mutating the input', () => {
    const base = { headline: 'H', paragraphs: ['a', 'b'] };
    const out = appendSeedOmen(base, () => 0);
    expect(out.paragraphs).toEqual(['a', 'b', SEED_OMENS[0]]);
    expect(base.paragraphs).toEqual(['a', 'b']); // input untouched
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitch.test.ts`
Expected: FAIL — `SEED_OMENS`/`seedOmen`/`appendSeedOmen` not exported.

- [ ] **Step 3: Implement the omen helpers**

Append to `src/engine/CorruptionGlitch.ts` (it already imports `SynthesisResult` on line 1):

```ts
// ── The seed omen ──
// The ONLY tell at the otherwise-silent `seeded` band. Clean prose — never the
// glitch system. Innocuous flavor to a newcomer; a recurring theme (a seventh,
// uncounted presence) that veterans recognize as the planted seed.
export const SEED_OMENS = [
  'Something uncounted leans in to listen.',
  'A seventh shadow settles at the table you set for six.',
  'The reading holds its breath, as if it were read in turn.',
];

export function seedOmen(rng: () => number): string {
  return SEED_OMENS[Math.floor(rng() * SEED_OMENS.length)];
}

// Append the omen as a closing paragraph. Pure — returns a new SynthesisResult.
export function appendSeedOmen(s: SynthesisResult, rng: () => number): SynthesisResult {
  return { ...s, paragraphs: [...s.paragraphs, seedOmen(rng)] };
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitch.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing wiring tests**

In `src/engine/__tests__/CorruptionGlitchWiring.test.ts`, add the import:

```ts
import { SEED_OMENS } from '../CorruptionGlitch';
```

Add these two tests inside the existing `describe('corruption falsifies the reading output', ...)` block:

```ts
  it('weaves a clean seed omen into the reading while corruption is seeded', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic: omen index 0, no glitch path
    const e = new GameEngine(3);
    e.startTurn('self');
    // high (not maxed) affinities feed corruption so it stays active in the seeded band
    e.loadState({ affinities: { chaos: 90, order: 90, fate: 90, will: 90, light: 90, shadow: 90 } });
    e.setCorruption(10); // seeded band (1–34); grows but stays < 35 across 3 readings
    fullTurn(e);
    const s = e.getState();
    expect(s.corruption.band).toBe('seeded');
    expect(JSON.stringify(s.synthesis)).toContain(SEED_OMENS[0]);
    expect(JSON.stringify(s.synthesis)).not.toContain('█'); // clean prose, never the glitch system
  });

  it('adds no seed omen when corruption is dormant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    fullTurn(e);
    const s = e.getState();
    expect(s.corruption.band).toBe('dormant');
    for (const omen of SEED_OMENS) {
      expect(JSON.stringify(s.synthesis)).not.toContain(omen);
    }
  });
```

- [ ] **Step 6: Run the wiring tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitchWiring.test.ts`
Expected: FAIL — the seeded case has no omen yet (synthesis lacks `SEED_OMENS[0]`).

- [ ] **Step 7: Wire the omen into synthesizeAll**

In `src/engine/GameEngine.ts`, add `appendSeedOmen` to the existing `CorruptionGlitch` import (line ~11):

```ts
import { corruptionTextLevel, corruptSynthesis, corruptText, appendSeedOmen } from './CorruptionGlitch';
```

Replace the post-assemble corruption block in `synthesizeAll` (lines ~726-730) with a band branch (seeded → clean omen; spreading+ → existing glitch; the two are mutually exclusive since `corruptionTextLevel` is 0 at seeded):

```ts
    this.state.synthesis = synthesisResult;
    const band = this.corruptionEngine.getBand();
    if (band === 'seeded') {
      // Seeded is otherwise silent — the omen is the deliberate, innocuous tell.
      this.state.synthesis = appendSeedOmen(this.state.synthesis, Math.random);
    } else {
      const cLevel = corruptionTextLevel(band, this.corruptionEngine.getValue());
      if (cLevel > 0) {
        this.state.synthesis = corruptSynthesis(this.state.synthesis, cLevel, Math.random);
      }
    }
    this.bus.emit('synthesis-complete', { result: this.state.synthesis });
```

- [ ] **Step 8: Run the full suite + typecheck**

Run: `npm test`
Expected: PASS (omen helper + wiring tests green; the original dormant-clean test still passes).
Run: `npm run build`
Expected: typecheck passes (no unused imports — `corruptText` was already imported/used; `appendSeedOmen` now used).

- [ ] **Step 9: Commit**

```bash
git add src/engine/CorruptionGlitch.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionGlitch.test.ts src/engine/__tests__/CorruptionGlitchWiring.test.ts
git commit -m "feat(corruption): seed omen tell at the seeded band"
```

---

### Task 3: Corruption section in the debug Dashboard

**Files:**
- Modify: `src/components/debug/Dashboard.tsx` (new collapsible "Corruption" section + styles)

**Interfaces:**
- Consumes: `state.corruption` (`{ value: number; band: CorruptionBand }`), `engine.setCorruption(value: number)` (already exists, already calls `notify()`), `engine.corruptionEngineForTest().getHasIntruded()` for the read-only intrusion flag.
- Produces: nothing other tasks depend on (UI only).

No automated tests (Vitest covers engine only). Verified by `npm run build` (typecheck) + manual check in `npm run dev`.

- [ ] **Step 1: Add section open-state**

In `Dashboard.tsx`, alongside the other `useState` section flags (after line ~165 `const [forceOpen, setForceOpen] = useState(false);`), add:

```ts
  const [corruptionOpen, setCorruptionOpen] = useState(false);
```

- [ ] **Step 2: Add the corruption setter handler**

Alongside the other handlers (after `handleAffinityChange`, ~line 186), add:

```ts
  const handleCorruptionChange = useCallback(
    (value: number) => engine.setCorruption(value),
    [engine],
  );
```

- [ ] **Step 3: Render the Corruption section**

Insert this block immediately AFTER the closing `</div>` of the Affinity Controls section (after line ~267, before the `{/* ════ Current Decisions ════ */}` comment):

```tsx
      {/* ════ Corruption ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setCorruptionOpen((p) => !p)}
        >
          <span style={triangleStyle(corruptionOpen)}>{corruptionOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>Corruption</span>
        </button>
        {corruptionOpen && (
          <div style={affinityBodyStyle}>
            <div style={affinityHeaderRowStyle}>
              <span style={affinityNameStyle}>Value</span>
              <span style={affinityValueStyle}>{state.corruption.value}</span>
              <span style={{ ...bandLabelStyle, color: '#d4a854' }}>
                {state.corruption.band}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={state.corruption.value}
              onChange={(e) => handleCorruptionChange(Number(e.target.value))}
              style={sliderStyle}
            />
            <div style={corruptionBtnRowStyle}>
              {([
                ['Clear', 0], ['Seed', 5], ['Spreading', 50], ['Virulent', 80], ['Pinnacle', 100],
              ] as [string, number][]).map(([label, value]) => (
                <button
                  key={label}
                  style={corruptionBtnStyle}
                  onClick={() => handleCorruptionChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ ...summaryRowStyle, marginTop: '0.35rem' }}>
              <span style={summaryKeyStyle}>Has intruded</span>
              <span style={summaryValueStyle}>
                {String(engine.corruptionEngineForTest().getHasIntruded())}
              </span>
            </div>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Add the two new styles**

Append to the styles at the bottom of `Dashboard.tsx` (near the other style consts):

```ts
const corruptionBtnRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem',
  marginTop: '0.4rem',
};

const corruptionBtnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.55rem',
  color: '#d4a854',
  background: 'rgba(26, 36, 64, 0.6)',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.2rem 0.4rem',
  cursor: 'pointer',
  outline: 'none',
};
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: typecheck passes (no unused vars; `corruptionOpen`, `handleCorruptionChange`, both new styles are referenced).

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `http://localhost:5173/?debug`, expand the **Corruption** section.
Verify: value/band readout updates live as you drag the slider; each band-jump button sets the matching band label (Clear→dormant, Seed→seeded, Spreading→spreading, Virulent→virulent, Pinnacle→pinnacle); "Has intruded" shows `true`/`false`.

- [ ] **Step 7: Commit**

```bash
git add src/components/debug/Dashboard.tsx
git commit -m "feat(debug): corruption value/band readout + band-jump setters"
```

---

### Task 4: Documentation sync

**Files:**
- Modify: `docs/game-systems.md` (seeded-band tell + hybrid seed-chance)
- Modify: `README.md` (any corruption table citing the old `min(0.25, …)` chance)

**Interfaces:** none (docs only). This is required by `CLAUDE.md` and must land before the branch is considered complete.

- [ ] **Step 1: Locate the corruption sections**

Run: `npx vitest run --version` is not needed; instead grep for the spots to edit.
Run (Grep tool): pattern `seed` / `0.25` / `seeded` in `docs/game-systems.md`, and `corrupt` in `README.md`.
Identify: the corruption lifecycle / band table and the seed-chance description.

- [ ] **Step 2: Update `docs/game-systems.md`**

- In the **seeded band** description, document the new omen: at `seeded` the reading gains a single clean omen line (from a 3-line pool) — the *intended* signal, distinct from the spreading+ text glitching. Note it appears every reading while seeded and vanishes if corruption decays to dormant or escalates to spreading.
- In the **seed spawn-chance** description, replace the linear `min(0.25, food × 0.004)` with the hybrid curve: `min(0.85, 0.004 × food × 1.7^(highCount − 1))`, where `highCount` = affinities above 81. State the intent: breadth of imbalance dominates; one spike stays rare; full hoard ≈ 85%/reading. Reproduce the curve table from the spec if a table already exists there.

- [ ] **Step 3: Update `README.md`**

If a player-facing corruption table or sentence cites the old 25% / linear seed chance, update it to the hybrid description (kept non-technical for players). If the README does not mention seed odds, no change — note that in the commit body.

- [ ] **Step 4: Verify no stale references remain**

Run (Grep tool): pattern `0\.25` and `min\(0\.25` across `docs/` and `README.md`.
Expected: no remaining reference to the old seed cap in a corruption context.

- [ ] **Step 5: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(corruption): seed omen tell + hybrid spawn-odds"
```

---

## Self-Review

**Spec coverage:**
- Spec Part 1 (seed omen, every reading while seeded, 3-line pool, clean prose, `synthesizeAll`) → Task 2. ✓
- Spec Part 2 (debug readout + setter + band-jump + hasIntruded; notify) → Task 3; `setCorruption` already notifies (verified), so no engine change needed. ✓
- Spec Part 3 (hybrid `min(0.85, 0.004 × food × 1.7^(count−1))`, `highAffinityCount`, signature change + call site + recomputed tests) → Task 1. ✓
- Spec §6 (docs sync) → Task 4. ✓
- Spec §7 testing (omen unit + wiring; odds pinned tests incl. count-gate case; full `npm test` + `npm run build`) → covered across Tasks 1–2 steps. ✓

**Placeholder scan:** No TBD/TODO; all code steps show full code; doc steps (Task 4) specify exact content to write rather than "update docs". ✓

**Type consistency:** `seedChance(food, highCount)` defined in Task 1 and called identically in `CorruptionEngine.tick`; `highAffinityCount(affinities)` signature consistent across Task 1 def, engine call, and tests. `appendSeedOmen(s, rng)` / `seedOmen(rng)` / `SEED_OMENS` names identical across Task 2 def, helper tests, wiring tests, and the `GameEngine` import. `state.corruption.{value,band}` matches the `CorruptionSnapshot` type. ✓
