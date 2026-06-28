# Corruption Phase 3 (Presentation) + Phase 4 (Gain Rebalance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make affinities rewarding to build (loosen three anti-hoard knobs) and render the full corruption presentation — selection telegraph, falsified reading, intrusion, corrupted history record, and the Rupture interstitial — reusing the existing `cx-` visual kit.

**Architecture:** Phase 4 is three constants + recomputed tests (do it first; it's foundational and isolated). Phase 3 adds a thin, framework-free *engine glue* layer (what to corrupt + when, surfaced on the `getState()` snapshot, all TDD'd) and a React *presentation layer* (verified by `npm run build` + manual dev check — this repo has **no component test harness**, only `src/engine/__tests__/**`).

**Tech Stack:** TypeScript (strict), React 18, Vite, Vitest (Node env, engine tests only), framer-motion. CSS in `src/styles/corruption.css`.

## Global Constraints

- Engine code stays **framework-free** (zero React/DOM imports in `src/engine/**`, `src/data/**`). [verbatim: CLAUDE.md architecture rule]
- Every engine mutator ends with `notify()`; `getState()` returns the deep-cloned snapshot. Never hand out `this.state`.
- Randomness is injected or via `Math.random`; **tests stub `Math.random`** (or pass a seeded rng). [repo convention]
- Vitest runs **only `src/engine/__tests__/**`** (Node). No component tests — UI tasks are verified by `npm run build` (which runs `tsc -b`) + manual.
- Typecheck with `npm run build` or `npx tsc -b` (strict, `noUnusedLocals`, `noUnusedParameters` all on — no unused symbols).
- Corruption is **diegetic, never numeric**: no values/bands/system text shown to the player.
- Reuse the `cx-` kit and palette: red `#ff2d4a`, deep `#c20f22`, void `#07010c`/`#180108`, pink `#ffb3bc`/`#ffc2ca`, white-hot `#fff`. **No cyan/magenta** — the "chromatic" tear is red↔void.
- Tuning values in this plan are **playtest defaults**; tests are recomputed against exactly these values.
- Validated visual mockups (the canonical look for the UI tasks) live on disk at
  `.superpowers/brainstorm/15713-1782663357/content/`:
  `corrupted-reading.html`, `intrusion.html`, `selection-telegraph-v2.html`,
  `corrupted-ascend-v8.html`, `results-overlay.html`, `rupture-v5.html`.
- Per `CLAUDE.md`, corruption behavior changes must update `docs/game-systems.md` + README in the **same change** (final task).

---

## File map

**Phase 4 (rebalance)**
- Modify `src/data/affinities.ts` — `COUPLING_OTHER`, `DR_FLOOR`, `RUN_DRIFT`.
- Modify `src/engine/__tests__/AffinityShift.test.ts`, `src/engine/__tests__/GameEngine.test.ts` — recompute pinned values.

**Phase 3 engine glue (framework-free, TDD)**
- Modify `src/data/corruption.ts` — chance-based infection helper, intrusion constants/phrases, near-pinnacle + visible-band helpers.
- Create `src/engine/CorruptionGlitch.ts` — pure text-falsification module.
- Modify `src/engine/CorruptionEngine.ts` — `hasIntruded` carryover flag (serialize/clear).
- Modify `src/engine/GameEngine.ts` — wire infection roll, falsify synthesis + LLM prompt, intrusion trigger, rupture screen + scrub, corrupted-record flag, `clearIntrusion()`, `completeRupture()`.
- Modify `src/engine/types.ts` — `Screen` gains `'rupture'`; `GameState` gains `intrusion`; `RunRecord` gains `corrupted?`.

**Phase 3 presentation (React, build + manual)**
- Modify `src/styles/corruption.css` — new primitives (telegraph, corrupted-ascension, results overlay, intrusion, rupture).
- Create `src/components/overlays/corruption/CorruptedAscend.tsx` — the GPU-artifact card-deletion.
- Create `src/components/overlays/corruption/IntrusionOverlay.tsx` — transient phantom line.
- Create `src/components/screens/RuptureInterstitial.tsx` — the Rupture sequence.
- Modify `src/components/screens/MethodSelect.tsx` — telegraph + corrupted ascension.
- Modify `src/components/screens/ResultReading.tsx` — corrupted-text styling + Virulent overlay + intrusion mount.
- Modify `src/components/screens/GameTable.tsx` — `'rupture'` screen case; mount IntrusionOverlay.
- Modify `src/components/overlays/HistoryModal.tsx` — garbled corrupted records.

**Docs**
- Modify `docs/game-systems.md`, `README.md`.

---

# PART A — Phase 4: gain-pipeline rebalance (do first)

### Task A1: Soften the three knobs + recompute value-pinned tests

**Files:**
- Modify: `src/data/affinities.ts:10-16`
- Modify: `src/engine/__tests__/AffinityShift.test.ts`
- Modify: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces: `COUPLING_OTHER = 0.09`, `DR_FLOOR = 0.67`, `RUN_DRIFT = 0.08` (others unchanged: `COUPLING_OPPOSITE = 0.35`, `DR_STEP = 0.05`).

- [ ] **Step 1: Change the constants.** In `src/data/affinities.ts` set:

```ts
export const COUPLING_OPPOSITE = 0.35; // unchanged — thematic opposite suppression
export const COUPLING_OTHER = 0.09;    // was 0.15 — corruption now polices excess
export const DR_STEP = 0.05;
export const DR_FLOOR = 0.67;          // was 0.5 — sustained building stays rewarding
export const JITTER_MIN = 0.85;
export const JITTER_MAX = 1.15;
export const RUN_DRIFT = 0.08;         // was 0.12 — highs persist longer, still decay
```

- [ ] **Step 2: Run the affected suites to see them fail.**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/GameEngine.test.ts`
Expected: FAIL — coupling/DR/drift expectations and the `GameEngine` coherence arithmetic now mismatch.

- [ ] **Step 3: Recompute `AffinityShift.test.ts`.** With `Math.random = () => 0.5` (jitter ×1.0):
  - **Coupling test (`:63`)** — `shift('chaos', 10)` with all at 50: `gain = 10`. Opposite `order = round(50 − 10×0.35) = round(46.5) = 47` (unchanged). Others `round(50 − 10×0.09) = round(49.1) = 49` (value unchanged, but **update the test title** to "opposite −0.35g, others −0.09g" and the comment to `50 − 10×0.09 = 49.1 → 49`).
  - **DR-floor test (`:75-84`)** — the floor is now `0.67`. After many same-run feeds of base 10, the diminished gain floors at `10 × 0.67 = 6.7`. Change the assertion `expect(last).toBeGreaterThanOrEqual(5 - 0.001)` → `expect(last).toBeGreaterThanOrEqual(6.7 - 0.001)` and update the comment to `floor 0.67 → 10 × 0.67`.
  - **Drift test (`:139-144`)** — `RUN_DRIFT = 0.08`. From chaos 80 / order 20: `chaos = round(80 + (50−80)×0.08) = round(77.6) = 78`; `order = round(20 + (50−20)×0.08) = round(22.4) = 22`. Change expectations `76→78`, `24→22`, update the test title ("drifts 8% toward 50") and the inline arithmetic comments.
  - Scan the whole file for any other `0.15`, `0.5` (DR floor), or `0.12` literals/comments tied to these constants and recompute identically. Leave `0.35` (opposite), `0.05` (DR step), jitter `0.85/1.15`, `0.12` REACH_UP, and `0.5` mandate values alone.

- [ ] **Step 4: Recompute `GameEngine.test.ts:369-430`.** These spell out coupling arithmetic in comments and pin `Order=58` / `Chaos=58` / `Order=55`. Recompute each step with `COUPLING_OTHER=0.09` (and `DR_FLOOR=0.67` if a step's DR is below floor). Work top-to-bottom through each test's documented steps, replacing every `×0.15` with `×0.09`, recomputing the running affinity values, and updating **both** the `expect(...).toBe(N)` literal and its multi-line comment so a reader can re-derive N. (Opposite steps keep `×0.35`.)

- [ ] **Step 5: Run until green.**

Run: `npx vitest run src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/GameEngine.test.ts`
Expected: PASS. Then `npm test` — full suite PASS (no other test pinned these).

- [ ] **Step 6: Typecheck + commit.**

Run: `npx tsc -b`
```bash
git add src/data/affinities.ts src/engine/__tests__/AffinityShift.test.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(affinity): rebalance gain pipeline (coupling 0.09, DR floor 0.67, drift 0.08)"
```

---

# PART B — Phase 3 engine glue (framework-free, TDD)

### Task B1: Chance-based infection

**Files:**
- Modify: `src/data/corruption.ts`
- Modify: `src/engine/GameEngine.ts:258-268` (`rollInfectedMethods`)
- Test: `src/engine/__tests__/CorruptionInfection.test.ts`

**Interfaces:**
- Produces: `rollInfectedCount(band: CorruptionBand, rng: () => number): number` — Seeded/dormant 0; Spreading 0 or 1; Virulent/Pinnacle 1 or 2 (default ~50/50). `INFECT_SPLIT = 0.5`.

- [ ] **Step 1: Write the failing test.** Append to `src/engine/__tests__/CorruptionInfection.test.ts`:

```ts
import { rollInfectedCount } from '../../data/corruption';

describe('rollInfectedCount (chance-based)', () => {
  it('is always 0 at dormant/seeded regardless of roll', () => {
    expect(rollInfectedCount('dormant', () => 0)).toBe(0);
    expect(rollInfectedCount('seeded', () => 0.99)).toBe(0);
  });
  it('spreading rolls 0 or 1 around the split', () => {
    expect(rollInfectedCount('spreading', () => 0.2)).toBe(1); // < 0.5 → 1
    expect(rollInfectedCount('spreading', () => 0.8)).toBe(0); // >= 0.5 → 0
  });
  it('virulent/pinnacle rolls 1 or 2 around the split', () => {
    expect(rollInfectedCount('virulent', () => 0.2)).toBe(2);
    expect(rollInfectedCount('virulent', () => 0.8)).toBe(1);
    expect(rollInfectedCount('pinnacle', () => 0.2)).toBe(2);
  });
});
```

Also **delete/replace** any existing assertions in this file that call the old fixed `infectedCountForBand` and expect `1`/`2` — they no longer describe behavior. If `infectedCountForBand` is still referenced by other tests in this file for the *count ceiling*, keep the function but the engine no longer uses it for the roll.

- [ ] **Step 2: Run to verify it fails.**

Run: `npx vitest run src/engine/__tests__/CorruptionInfection.test.ts`
Expected: FAIL — `rollInfectedCount` is not exported.

- [ ] **Step 3: Implement.** In `src/data/corruption.ts` add:

```ts
export const INFECT_SPLIT = 0.5; // P(higher count) at spreading/virulent

// Chance-based taint count. Seeded shows nothing (gestation); Spreading 0–1;
// Virulent/Pinnacle 1–2. rng < INFECT_SPLIT picks the higher of the two.
export function rollInfectedCount(band: CorruptionBand, rng: () => number): number {
  switch (band) {
    case 'spreading': return rng() < INFECT_SPLIT ? 1 : 0;
    case 'virulent':
    case 'pinnacle':  return rng() < INFECT_SPLIT ? 2 : 1;
    default:          return 0; // dormant, seeded
  }
}
```

- [ ] **Step 4: Wire the engine.** In `src/engine/GameEngine.ts` `rollInfectedMethods` change the count line:

```ts
const count = Math.min(poolSize, rollInfectedCount(this.corruptionEngine.getBand(), Math.random));
```

Update the import on line 10 to add `rollInfectedCount` (and drop `infectedCountForBand` from the import **only if** nothing else in this file uses it).

- [ ] **Step 5: Run tests + typecheck.**

Run: `npx vitest run src/engine/__tests__/CorruptionInfection.test.ts` → PASS. Then `npx tsc -b`.

- [ ] **Step 6: Commit.**

```bash
git add src/data/corruption.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionInfection.test.ts
git commit -m "feat(corruption): chance-based infection count (0 / 0-1 / 1-2)"
```

---

### Task B2: Reading-falsification module (pure)

**Files:**
- Create: `src/engine/CorruptionGlitch.ts`
- Test: `src/engine/__tests__/CorruptionGlitch.test.ts`

**Interfaces:**
- Produces:
  - `corruptionTextLevel(band: CorruptionBand, value: number): number` — 0 (dormant/seeded), 1 (spreading), 2→3 (virulent ramp by value).
  - `interiorTypo(word: string, rng: () => number): string` — swaps two interior letters; words < 4 chars unchanged.
  - `corruptText(text: string, level: number, rng: () => number): string` — applies the band-appropriate corruption.
  - `corruptSynthesis(s: SynthesisResult, level: number, rng: () => number): SynthesisResult`.

- [ ] **Step 1: Write the failing test.** Create `src/engine/__tests__/CorruptionGlitch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { corruptionTextLevel, interiorTypo, corruptText, corruptSynthesis } from '../CorruptionGlitch';

// deterministic PRNG so corruption output is reproducible in tests
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('corruptionTextLevel', () => {
  it('is 0 below spreading, 1 at spreading, >=2 at virulent', () => {
    expect(corruptionTextLevel('dormant', 0)).toBe(0);
    expect(corruptionTextLevel('seeded', 20)).toBe(0);
    expect(corruptionTextLevel('spreading', 50)).toBe(1);
    expect(corruptionTextLevel('virulent', 67)).toBeGreaterThanOrEqual(2);
    expect(corruptionTextLevel('virulent', 99)).toBeGreaterThan(corruptionTextLevel('virulent', 67));
  });
});

describe('interiorTypo', () => {
  it('preserves first and last letter and length', () => {
    const out = interiorTypo('softened', mulberry32(1));
    expect(out.length).toBe('softened'.length);
    expect(out[0]).toBe('s');
    expect(out[out.length - 1]).toBe('d');
    expect(out).not.toBe('softened');
  });
  it('leaves short words (<4) unchanged', () => {
    expect(interiorTypo('and', mulberry32(1))).toBe('and');
  });
});

describe('corruptText', () => {
  it('level 0 returns the text untouched', () => {
    const t = 'Fortune inclines toward you and the way ahead carries real promise.';
    expect(corruptText(t, 0, mulberry32(1))).toBe(t);
  });
  it('level 1 alters the text but stays free of redaction blocks and contradictions', () => {
    const t = 'Fortune inclines toward you and the way ahead carries real promise.';
    const out = corruptText(t, 1, mulberry32(7));
    expect(out).not.toBe(t);
    expect(out).not.toContain('█');
  });
  it('level >=2 introduces heavy artifacts (redaction or garble) and a contradiction', () => {
    const t = 'Fortune inclines toward you and the way ahead carries real promise.';
    const out = corruptText(t, 2, mulberry32(3));
    const heavy = out.includes('█') || /[̴̶̗]/.test(out);
    expect(heavy).toBe(true);
  });
  it('is deterministic for a given seed', () => {
    const t = 'the shape of things softening toward something new';
    expect(corruptText(t, 2, mulberry32(42))).toBe(corruptText(t, 2, mulberry32(42)));
  });
});

describe('corruptSynthesis', () => {
  it('corrupts headline + paragraphs at level>=1', () => {
    const s = { headline: 'Transformation Bears Its Fruit',
      paragraphs: ['Fortune inclines toward you and the way ahead carries real promise.'],
      tensionNote: undefined, affinityNote: undefined };
    const out = corruptSynthesis(s, 1, mulberry32(9));
    expect(out.paragraphs[0]).not.toBe(s.paragraphs[0]);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module.** Create `src/engine/CorruptionGlitch.ts`:

```ts
import type { CorruptionBand, SynthesisResult } from './types';

// Band+value → corruption intensity for the reading text.
// 0 = clean (gestation), 1 = subtle (Spreading), 2..3 = heavy ramp (Virulent).
export function corruptionTextLevel(band: CorruptionBand, value: number): number {
  if (band === 'spreading') return 1;
  if (band === 'virulent' || band === 'pinnacle') {
    // 67 → 2, ramping to 3 near the pinnacle.
    return 2 + Math.min(1, Math.max(0, (value - 67) / (99 - 67)));
  }
  return 0;
}

const DRIFT: Record<string, string> = {
  promise: 'warning', fortune: 'debt', guidance: 'warning',
  hope: 'dread', clarity: 'static', light: 'dark', good: 'ill',
};
const COMBINING = ['̴', '̶', '̗', '̖', '҉'];
const CONTRADICTIONS = [
  'the way ahead does not exist.',
  'The card you did not draw speaks the loudest.',
  'this reading was never yours.',
];

// Swap two adjacent interior letters; first + last preserved so the eye skips it.
export function interiorTypo(word: string, rng: () => number): string {
  if (word.length < 4) return word;
  const i = 1 + Math.floor(rng() * (word.length - 2));
  const j = i + 1 <= word.length - 2 ? i + 1 : i - 1;
  const a = [...word];
  [a[i], a[j]] = [a[j], a[i]];
  return a.join('');
}

function garble(word: string, rng: () => number): string {
  return [...word].map((ch) =>
    /\w/.test(ch) && rng() < 0.4 ? ch + COMBINING[Math.floor(rng() * COMBINING.length)] : ch,
  ).join('');
}

function redact(word: string): string {
  return '█'.repeat(Math.min(6, Math.max(2, word.length)));
}

// Strip trailing punctuation so word-matching/replacement keeps it.
function splitWord(token: string): [string, string] {
  const m = token.match(/^([\p{L}']+)([^\p{L}']*)$/u);
  return m ? [m[1], m[2]] : [token, ''];
}

export function corruptText(text: string, level: number, rng: () => number): string {
  if (level <= 0 || !text) return text;
  const tokens = text.split(/(\s+)/); // keep whitespace tokens
  const out = tokens.map((tok) => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const [word, tail] = splitWord(tok);
    let w = word;
    const heavy = level >= 2;
    const p = heavy ? 0.28 : 0.12;
    // tone drift (both levels)
    const lower = w.toLowerCase();
    if (DRIFT[lower] && rng() < p) {
      const rep = DRIFT[lower];
      w = w[0] === w[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
      return w + tail;
    }
    if (rng() < p) w = interiorTypo(w, rng);          // typo (both)
    if (heavy && rng() < 0.18) return redact(w) + tail; // redaction (virulent)
    if (heavy && rng() < 0.30) w = garble(w, rng);      // glyph garble (virulent)
    if (heavy && rng() < 0.10) return `${w} — ${w}` + tail; // stutter (virulent)
    return w + tail;
  });
  let result = out.join('');
  if (level >= 2) {
    const n = level >= 3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      result += ' ' + CONTRADICTIONS[Math.floor(rng() * CONTRADICTIONS.length)];
    }
  }
  return result;
}

export function corruptSynthesis(s: SynthesisResult, level: number, rng: () => number): SynthesisResult {
  if (level <= 0) return s;
  return {
    headline: corruptText(s.headline, level, rng),
    paragraphs: s.paragraphs.map((p) => corruptText(p, level, rng)),
    tensionNote: s.tensionNote ? corruptText(s.tensionNote, level, rng) : s.tensionNote,
    affinityNote: s.affinityNote ? corruptText(s.affinityNote, level, rng) : s.affinityNote,
  };
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitch.test.ts`
Expected: PASS. (If the `level>=2 heavy` test is flaky for a seed, the `corruptText` thresholds guarantee at least the contradiction is appended; the test checks redaction/garble — pick the test seed `mulberry32(3)` which exercises them. If needed, raise heavy `p`/garble odds slightly, never lower.)

- [ ] **Step 5: Typecheck + commit.**

Run: `npx tsc -b`
```bash
git add src/engine/CorruptionGlitch.ts src/engine/__tests__/CorruptionGlitch.test.ts
git commit -m "feat(corruption): pure reading-falsification module (spreading subtle, virulent ramp)"
```

---

### Task B3: Falsify the synthesis + the LLM prompt in the engine

**Files:**
- Modify: `src/engine/GameEngine.ts` (`synthesizeAll` ~662-680; `generateLLMPrompt` ~1511-1525)
- Test: `src/engine/__tests__/CorruptionGlitchWiring.test.ts` (create)

**Interfaces:**
- Consumes: `corruptionTextLevel`, `corruptSynthesis`, `corruptText` (B2); `corruption.band`/`value` from `CorruptionEngine`.
- Produces: `state.synthesis` is corrupted in place at Spreading+; `generateLLMPrompt()` returns corrupted text at Spreading+.

- [ ] **Step 1: Write the failing test.** Create `src/engine/__tests__/CorruptionGlitchWiring.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });

function fullTurn(e: GameEngine) {
  for (let i = 0; i < 3; i++) {
    e.completeMinigame(dice());
    if (e.getState().eventQueue.length > 0) e.finishEventBatch();
    e.continueAfterReview();
  }
}

describe('corruption falsifies the reading output', () => {
  it('leaves the reading clean when corruption is dormant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    fullTurn(e);
    const s = e.getState();
    expect(s.screen).toBe('result');
    // a clean reading contains no redaction blocks
    expect(JSON.stringify(s.synthesis)).not.toContain('█');
  });
});
```

- [ ] **Step 2: Run to verify it fails or passes-trivially.** Run it (`npx vitest run src/engine/__tests__/CorruptionGlitchWiring.test.ts`). The dormant case should already pass; it guards against regressions. (We assert the *negative* — no corruption when dormant — because asserting positive corruption through a full turn is brittle; the positive path is covered by B2's unit tests on `corruptText`.)

- [ ] **Step 3: Implement synthesis falsification.** In `synthesizeAll`, after `this.state.synthesis = synthesisResult;` and before the emit, insert:

```ts
const cLevel = corruptionTextLevel(this.corruptionEngine.getBand(), this.corruptionEngine.getValue());
if (cLevel > 0) {
  this.state.synthesis = corruptSynthesis(this.state.synthesis, cLevel, Math.random);
}
```

Add `corruptionTextLevel, corruptSynthesis, corruptText` to the imports from `./CorruptionGlitch`.

- [ ] **Step 4: Implement prompt falsification.** In `generateLLMPrompt`, change the return to:

```ts
const prompt = this.narrativeAssembler.generateLLMPrompt({ /* unchanged args */ });
const lvl = corruptionTextLevel(this.corruptionEngine.getBand(), this.corruptionEngine.getValue());
return lvl > 0 ? corruptText(prompt, lvl, Math.random) : prompt;
```

(Keep the existing `narrativeAssembler.generateLLMPrompt(...)` call; just capture it in `prompt` first.)

- [ ] **Step 5: Run tests + typecheck.**

Run: `npx vitest run src/engine/__tests__/CorruptionGlitchWiring.test.ts` → PASS. `npm test` → PASS. `npx tsc -b`.

- [ ] **Step 6: Commit.**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/CorruptionGlitchWiring.test.ts
git commit -m "feat(corruption): falsify synthesis + LLM prompt at spreading+"
```

---

### Task B4: Intrusion trigger + once-per-event guarantee

**Files:**
- Modify: `src/data/corruption.ts` (constants + phrases)
- Modify: `src/engine/CorruptionEngine.ts` (`hasIntruded` flag, serialize/clear)
- Modify: `src/engine/types.ts` (`GameState.intrusion`)
- Modify: `src/engine/GameEngine.ts` (`maybeIntrude`, call site, `clearIntrusion`, default state, clears)
- Test: `src/engine/__tests__/CorruptionIntrusion.test.ts` (create); extend `CorruptionPersistence.test.ts`

**Interfaces:**
- Produces:
  - `NEAR_PINNACLE = 90`, `INTRUSION_PHRASES: string[]`, `intrusionChance(value: number): number`.
  - `CorruptionEngine.markIntruded()`, `CorruptionEngine.getHasIntruded(): boolean` (serialized; reset by `clear()`).
  - `GameState.intrusion: { text: string } | null`.
  - `GameEngine.clearIntrusion(): void`.

- [ ] **Step 1: Write the failing tests.** Create `src/engine/__tests__/CorruptionIntrusion.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { intrusionChance } from '../../data/corruption';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('intrusionChance', () => {
  it('is 0 below virulent and ramps within virulent', () => {
    expect(intrusionChance(50)).toBe(0);
    expect(intrusionChance(67)).toBeGreaterThan(0);
    expect(intrusionChance(99)).toBeGreaterThan(intrusionChance(67));
  });
});

describe('intrusion firing', () => {
  it('never fires below virulent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // would fire if eligible
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 90, order: 50, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(40); // seeded/spreading boundary — below virulent
    oneReading(e);
    expect(e.getState().intrusion).toBeNull();
  });

  it('fires at virulent when the roll passes, and marks the event', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // roll always passes
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 95, order: 95, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); // virulent
    oneReading(e);
    expect(e.getState().intrusion).not.toBeNull();
    expect(typeof e.getState().intrusion!.text).toBe('string');
  });

  it('clearIntrusion clears it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 95, order: 95, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); oneReading(e);
    e.clearIntrusion();
    expect(e.getState().intrusion).toBeNull();
  });
});
```

Append to `src/engine/__tests__/CorruptionPersistence.test.ts` a case asserting `getHasIntruded()` survives serialize/loadFrom and resets on `clear()` (follow that file's existing CorruptionEngine instantiation pattern):

```ts
import { CorruptionEngine } from '../CorruptionEngine';
it('persists hasIntruded and resets it on clear', () => {
  const e = new CorruptionEngine(); e.setValue(80); e.markIntruded();
  const e2 = new CorruptionEngine(); e2.loadFrom(e.serialize());
  expect(e2.getHasIntruded()).toBe(true);
  e2.clear();
  expect(e2.getHasIntruded()).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run src/engine/__tests__/CorruptionIntrusion.test.ts`
Expected: FAIL — `intrusionChance`/`clearIntrusion`/`state.intrusion` missing.

- [ ] **Step 3: Add data constants.** In `src/data/corruption.ts`:

```ts
export const NEAR_PINNACLE = 90; // force a guaranteed intrusion past here if none yet this event
export const INTRUSION_PHRASES = [
  'i see you counting them.',
  'you keep feeding me.',
  'there is so much of you here.',
  'stop looking away.',
  'i was here before the stars.',
];
// Virulent-only; low base, ramping toward the pinnacle.
export function intrusionChance(value: number): number {
  if (value < 67) return 0;
  return 0.08 + ((value - 67) / (99 - 67)) * 0.25;
}
```

- [ ] **Step 4: Add the carryover flag to `CorruptionEngine`.** In `src/engine/CorruptionEngine.ts`:
  - add field `private hasIntruded = false;`
  - add methods `markIntruded(): void { this.hasIntruded = true; }` and `getHasIntruded(): boolean { return this.hasIntruded; }`
  - in `clear()` set `this.hasIntruded = false;`
  - in `tick()`: when the post-decay value reaches 0 (the corruption event is over), set `this.hasIntruded = false` so a future event re-earns its guaranteed intrusion (spec: reset when corruption clears by **starving to 0** *or* by the Rupture). Add a test for this in `CorruptionLifecycle.test.ts` (starve a virulent corruption that has intruded down to 0, assert `getHasIntruded()` is false).
  - `serialize()` → `JSON.stringify({ value: this.value, hasIntruded: this.hasIntruded })`
  - `loadFrom(json)` → parse and set `this.hasIntruded = !!parsed.hasIntruded` (default false if absent), keeping the existing `value` load.

- [ ] **Step 5: Add `intrusion` to state.** In `src/engine/types.ts` `GameState`, after `infectedMethods`:

```ts
intrusion: { text: string } | null; // transient phantom line; React animates then clears
```

In `GameEngine` `defaultState()` add `intrusion: null,`.

- [ ] **Step 6: Implement the trigger + clear.** In `src/engine/GameEngine.ts`:

```ts
private maybeIntrude(rng: () => number = Math.random): void {
  const band = this.corruptionEngine.getBand();
  if (band !== 'virulent' && band !== 'pinnacle') return;
  const value = this.corruptionEngine.getValue();
  const forced = !this.corruptionEngine.getHasIntruded() && value >= NEAR_PINNACLE;
  if (!forced && rng() >= intrusionChance(value)) return;
  const text = INTRUSION_PHRASES[Math.floor(rng() * INTRUSION_PHRASES.length)];
  this.state.intrusion = { text };
  this.corruptionEngine.markIntruded();
}

clearIntrusion(): void {
  if (!this.state.intrusion) return;
  this.state.intrusion = null;
  this.notify();
}
```

Call `this.maybeIntrude();` in `advanceAfterCommit` **immediately after** `this.applyCorruptionTick();` (and after the rupture guard added in B6 — for now place it right after the tick; B6 inserts its guard above this call). Add `NEAR_PINNACLE, INTRUSION_PHRASES, intrusionChance` to the corruption imports. Clear stale intrusions in `confirmSelection` (set `this.state.intrusion = null;` where it resets per-reading UI state).

- [ ] **Step 7: Run tests + typecheck.**

Run: `npx vitest run src/engine/__tests__/CorruptionIntrusion.test.ts src/engine/__tests__/CorruptionPersistence.test.ts` → PASS. `npm test` → PASS. `npx tsc -b`.

- [ ] **Step 8: Commit.**

```bash
git add src/data/corruption.ts src/engine/CorruptionEngine.ts src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionIntrusion.test.ts src/engine/__tests__/CorruptionPersistence.test.ts
git commit -m "feat(corruption): player-aware intrusion with once-per-event guarantee"
```

---

### Task B5: Corrupted history record

**Files:**
- Modify: `src/engine/types.ts` (`RunRecord.corrupted?`)
- Modify: `src/engine/GameEngine.ts` (`buildRunRecord`)
- Modify: `src/data/corruption.ts` (`isVisibleCorruption` helper)
- Test: `src/engine/__tests__/CorruptionRecord.test.ts` (create)

**Interfaces:**
- Produces: `isVisibleCorruption(band: CorruptionBand): boolean` (spreading/virulent/pinnacle); `RunRecord.corrupted?: boolean`.

- [ ] **Step 1: Write the failing test.** Create `src/engine/__tests__/CorruptionRecord.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { isVisibleCorruption } from '../../data/corruption';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });
function fullTurn(e: GameEngine) {
  for (let i = 0; i < 3; i++) { e.completeMinigame(dice());
    if (e.getState().eventQueue.length > 0) e.finishEventBatch(); e.continueAfterReview(); }
}

describe('isVisibleCorruption', () => {
  it('is true for spreading+ only', () => {
    expect(isVisibleCorruption('dormant')).toBe(false);
    expect(isVisibleCorruption('seeded')).toBe(false);
    expect(isVisibleCorruption('spreading')).toBe(true);
    expect(isVisibleCorruption('virulent')).toBe(true);
  });
});

describe('corrupted run record', () => {
  it('flags the record when corruption is visible', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3); e.startTurn('self');
    e.loadState({ affinities: { chaos: 95, order: 95, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(75); // virulent
    fullTurn(e);
    const last = e.getState().history.at(-1)!;
    expect(last.corrupted).toBe(true);
  });
  it('does not flag a clean record', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3); e.startTurn('self');
    fullTurn(e);
    const last = e.getState().history.at(-1)!;
    expect(last.corrupted ?? false).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run src/engine/__tests__/CorruptionRecord.test.ts`
Expected: FAIL — `isVisibleCorruption` missing / `corrupted` not set.

- [ ] **Step 3: Implement.**
  - `src/data/corruption.ts`: `export function isVisibleCorruption(band: CorruptionBand): boolean { return band === 'spreading' || band === 'virulent' || band === 'pinnacle'; }`
  - `src/engine/types.ts` `RunRecord`: add `corrupted?: boolean;`
  - `src/engine/GameEngine.ts` `buildRunRecord`: add to the record literal `corrupted: isVisibleCorruption(this.corruptionEngine.getBand()),` and import `isVisibleCorruption`.

- [ ] **Step 4: Run + typecheck.**

Run: `npx vitest run src/engine/__tests__/CorruptionRecord.test.ts` → PASS. `npx tsc -b`.

- [ ] **Step 5: Commit.**

```bash
git add src/data/corruption.ts src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionRecord.test.ts
git commit -m "feat(corruption): flag run records corrupted at spreading+"
```

---

### Task B6: Rupture screen state + deferred wipe + record scrub

**Files:**
- Modify: `src/engine/types.ts` (`Screen` += `'rupture'`)
- Modify: `src/engine/GameEngine.ts` (`pendingRupture`, `performRupture`, `advanceAfterCommit` guard, `completeRupture`)
- Test: `src/engine/__tests__/CorruptionLifecycle.test.ts` (extend)

**Interfaces:**
- Consumes: `RunRecord.corrupted` (B5).
- Produces: `Screen` includes `'rupture'`; `GameEngine.completeRupture(): void` (UI calls it when the interstitial ends).

- [ ] **Step 1: Write the failing test.** Append to `src/engine/__tests__/CorruptionLifecycle.test.ts`:

```ts
it('routes to the rupture screen, wipes, scrubs corrupted records, then completeRupture → title', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
  const e = new GameEngine(3);
  e.startTurn('self');
  e.loadState({
    affinities: { chaos: 100, order: 100, fate: 100, will: 100, light: 100, shadow: 100 },
    history: [
      { id: 'a', timestamp: 1, question: 'self', turnResults: [], effects: [], synthesis: null as any, corrupted: true },
      { id: 'b', timestamp: 2, question: 'self', turnResults: [], effects: [], synthesis: null as any },
    ],
  });
  e.setCorruption(99);
  oneReading(e);
  const s = e.getState();
  expect(s.screen).toBe('rupture');
  expect(s.affinityBase.chaos).toBe(RUPTURE_RESET);
  expect(s.corruption.band).toBe('dormant');
  expect(s.history.map((r) => r.id)).toEqual(['b']); // corrupted record scrubbed

  e.completeRupture();
  expect(e.getState().screen).toBe('title');
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run src/engine/__tests__/CorruptionLifecycle.test.ts`
Expected: FAIL — screen is not `'rupture'`; `completeRupture` missing.

- [ ] **Step 3: Add the screen + flag.**
  - `src/engine/types.ts` `Screen` union: add `| 'rupture'`.
  - `src/engine/GameEngine.ts`: add field `private pendingRupture = false;`

- [ ] **Step 4: Defer the wipe into a flag + scrub.** Change `performRupture` to also scrub and flag (keep the existing wipe/clear/emit):

```ts
private performRupture(): void {
  const reset = AFFINITY_IDS.reduce((acc, id) => ((acc[id] = RUPTURE_RESET), acc), {} as Record<AffinityId, number>);
  this.affinityEngine.setState(reset);
  this.affinityEngine.clearModifiers();
  this.corruptionEngine.clear();
  this.state.history = this.state.history.filter((r) => !r.corrupted); // scrub — no trace
  this.pendingRupture = true;
  this.bus.emit('corruption-ruptured', {});
}
```

- [ ] **Step 5: Route to the interstitial.** In `advanceAfterCommit`, immediately after `this.applyCorruptionTick();` (and **before** the final-reading guard and before the `maybeIntrude()` call from B4):

```ts
if (this.pendingRupture) {
  this.pendingRupture = false;
  this.state.screen = 'rupture';
  this.saveToStorage();
  this.notify();
  return;
}
```

- [ ] **Step 6: Add `completeRupture()`.** The interstitial calls it when the (unskippable) animation ends. Mirror `returnToTitle`'s reset of turn state (open `returnToTitle` and copy its body), but force `screen = 'title'`:

```ts
completeRupture(): void {
  this.returnToTitle(); // resets turn state, preserves carryover; lands on title
}
```

(If `returnToTitle` is the method that already sets `screen='title'` and resets turn state while preserving carryover, delegate to it as above. Confirm by reading `returnToTitle`.)

- [ ] **Step 7: Run tests + typecheck.**

Run: `npx vitest run src/engine/__tests__/CorruptionLifecycle.test.ts` → PASS. `npm test` → full PASS (check the pre-existing pinnacle test at `CorruptionLifecycle.test.ts:43` still passes; if it asserted a post-rupture screen of `result`/`method-select`, update it to `'rupture'`). `npx tsc -b`.

- [ ] **Step 8: Commit.**

```bash
git add src/engine/types.ts src/engine/GameEngine.ts src/engine/__tests__/CorruptionLifecycle.test.ts
git commit -m "feat(corruption): rupture interstitial screen state + deferred wipe + record scrub"
```

---

# PART C — Phase 3 presentation (React; verified by build + manual)

> No Vitest here. After each task: `npm run build` (runs `tsc -b` + bundles) must succeed, then `npm run dev` and eyeball against the named mockup. Use the `?debug` panel + `engine.setCorruption(n)` to stage bands (seeded ≤34, spreading 35–66, virulent 67–99, pinnacle 100).

### Task C1: Extend the `cx-` visual kit

**Files:**
- Modify: `src/styles/corruption.css` (append; do not edit existing Phase 2b rules)

**Interfaces:**
- Produces CSS classes consumed by C2–C6: telegraph (`.cx-card-spreading`, `.cx-card-virulent`), corrupted-ascension (`.cx-ca-*`), results overlay (`.cx-scan`, `.cx-vignette`, `.cx-mosh`, `.cx-redact`, `.cx-ghost`, `.cx-ca-text`), intrusion (`.cx-intrusion`), rupture (`.cx-rupt-*`).

- [ ] **Step 1: Append the primitives.** Add to `src/styles/corruption.css` the rules below. These are ported verbatim from the validated mockups (`selection-telegraph-v2.html`, `corrupted-ascend-v8.html`, `results-overlay.html`, `intrusion.html`, `rupture-v5.html` in `.superpowers/brainstorm/15713-1782663357/content/`) — open those for the exact keyframe values if any rule needs adjustment.

```css
/* ───────────────────────── Phase 3 corruption presentation ───────────────────────── */
:root{ --cx-red:#ff2d4a; --cx-red-deep:#c20f22; --cx-void:#07010c; --cx-pink:#ffb3bc; }

/* shared chromatic = red↔void tear (never cyan) */
@keyframes cx-capulse{0%,82%,100%{text-shadow:none}87%{text-shadow:-1px 0 var(--cx-red),1px 0 #1a0006}92%{text-shadow:.8px 0 var(--cx-red-deep),-.8px 0 var(--cx-void)}}

/* ── selection-screen telegraph (apply to a method card root) ── */
.cx-card-spreading{border-color:#5a2230 !important;box-shadow:0 6px 18px #00000055,0 0 12px #ff2d4a22}
.cx-card-spreading .cx-name{animation:cx-capulse 4.6s ease-in-out infinite}
.cx-card-virulent{border-color:var(--cx-red) !important;box-shadow:0 6px 18px #00000066,0 0 18px #ff2d4a55,inset 0 0 22px #ff2d4a22}
.cx-card-virulent .cx-name{color:#fff;text-shadow:0 0 7px var(--cx-red);animation:cx-capulse 2.4s ease-in-out infinite}
.cx-card-virulent .cx-glyph{color:#ff8a98;animation:cx-capulse 2.4s ease-in-out infinite, cx-jitter 3.7s steps(1) infinite}
@keyframes cx-jitter{0%,90%,100%{transform:translate(0,0)}91%{transform:translate(-2px,1px)}93%{transform:translate(2px,-1px)}95%{transform:translate(-1px,0)}}
.cx-scanlines{position:absolute;inset:0;pointer-events:none;opacity:.1;background:repeating-linear-gradient(0deg,var(--cx-red) 0 1px,transparent 1px 4px)}
.cx-mosh{position:absolute;left:0;right:0;background:var(--cx-red);opacity:0;pointer-events:none}
.cx-mosh.m1{top:24%;height:3px;animation:cx-mq 3.4s steps(1) infinite}
.cx-mosh.m2{top:47%;height:5px;animation:cx-mq 4.1s steps(1) infinite .7s}
.cx-mosh.m3{top:70%;height:2px;animation:cx-mq 2.9s steps(1) infinite 1.3s}
@keyframes cx-mq{0%,38%,100%{opacity:0}39%{opacity:.6;transform:translateX(-5px)}42%{opacity:0}60%{opacity:.4;transform:translateX(4px)}63%{opacity:0}}

/* ── corrupted card ascension (fake gold bloom → quick GPU-artifact tear) ──
   See corrupted-ascend-v8.html for the full slice markup the component emits. */
.cx-ca-root{position:relative;border-radius:11px;animation:cx-ca-ascend 3.0s ease-in-out forwards}
@keyframes cx-ca-ascend{
  0%,14%{transform:translateY(0) scale(1);box-shadow:0 6px 18px #00000055}
  44%{transform:translateY(-46px) scale(1.06);box-shadow:0 0 30px 5px rgba(212,168,84,.6)}
  53%{transform:translateY(-46px) scale(1.06);box-shadow:0 0 36px 7px rgba(212,168,84,.72)}
  58%{transform:translateY(-46px) scale(1.05);box-shadow:0 0 24px 4px rgba(255,45,74,.5)}
  72%{transform:translateY(-50px) scale(1.03);box-shadow:0 0 0 rgba(0,0,0,0)}
  100%{transform:translateY(-50px) scale(1.03);opacity:0}
}
.cx-ca-base{animation:cx-ca-basedie 3.0s linear forwards}
@keyframes cx-ca-basedie{0%,55%{opacity:1}59%{opacity:.12}62%{opacity:0}100%{opacity:0}}
.cx-ca-slice{opacity:0;animation:cx-ca-tear 3.0s steps(1) forwards}
@keyframes cx-ca-tear{0%,55%{opacity:0;transform:translateX(0)}57%{opacity:1;transform:translateX(var(--dx))}62%{transform:translateX(calc(var(--dx)*-0.6))}66%{opacity:.9;transform:translateX(calc(var(--dx)*1.2))}70%{opacity:1;transform:translateX(calc(var(--dx)*-0.5))}72%{opacity:0}100%{opacity:0}}
.cx-ca-slice.dis::after{content:'';position:absolute;inset:0;background:var(--cx-red);mix-blend-mode:multiply;opacity:.5;pointer-events:none} /* discolour only some slices */

/* ── results-screen overlay (Virulent+) ── */
.cx-results{position:relative}
.cx-results .cx-scan{position:absolute;inset:0;pointer-events:none;z-index:5;opacity:.07;background:repeating-linear-gradient(0deg,var(--cx-red) 0 1px,transparent 1px 4px);animation:cx-scanmove 7s linear infinite}
@keyframes cx-scanmove{0%{background-position:0 0}100%{background-position:0 8px}}
.cx-results .cx-vignette{position:absolute;inset:0;pointer-events:none;z-index:6;border-radius:8px;animation:cx-vigpulse 4.5s ease-in-out infinite}
@keyframes cx-vigpulse{0%,100%{box-shadow:inset 0 0 40px rgba(255,45,74,.08),inset 0 0 0 1px rgba(255,45,74,.25)}50%{box-shadow:inset 0 0 80px rgba(255,45,74,.2),inset 0 0 0 1px rgba(255,45,74,.5)}}
.cx-ca-text{animation:cx-capulse 4.6s ease-in-out infinite}

/* ── intrusion (transient phantom line) ── */
.cx-intrusion{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60;pointer-events:none}
.cx-intrusion span{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(1.2rem,4vw,1.6rem);color:#fff;animation:cx-intr 2.4s linear forwards}
@keyframes cx-intr{
  0%{opacity:0}
  6%{opacity:1;transform:translateX(-6px);text-shadow:-2px 0 var(--cx-void),2px 0 var(--cx-red)}
  8%{opacity:0}10%{opacity:1;transform:translateX(5px)}12%{opacity:1;text-shadow:0 0 10px var(--cx-red);transform:translateX(0)}
  72%{opacity:1}
  80%{opacity:1;transform:translateX(8px) skewX(-6deg);text-shadow:-3px 0 var(--cx-void),3px 0 var(--cx-red)}
  86%{opacity:0}100%{opacity:0}
}

/* ── Rupture interstitial (see rupture-v5.html for the full SVG + keyframes) ── */
/* The component ports the validated keyframes: cx-rupt-stars, cx-rupt-creep, cx-rupt-tremor,
   cx-rupt-mawrip, cx-rupt-ripfill, cx-rupt-eyespawn, cx-rupt-lidopen, cx-rupt-core,
   cx-rupt-crackrip (vector-effect:non-scaling-stroke), cx-rupt-flash, cx-rupt-void,
   cx-rupt-thread, cx-rupt-reform. Total ~8s, then onEnd fires. */
```

- [ ] **Step 2: Confirm it imports.** `src/styles/corruption.css` is already imported in `src/main.tsx` (Phase 2b-i). No new import needed. Run `npm run build`.

- [ ] **Step 3: Commit.**

```bash
git add src/styles/corruption.css
git commit -m "feat(corruption): extend cx- kit with phase 3 presentation primitives"
```

---

### Task C2: Selection telegraph + corrupted ascension

**Files:**
- Create: `src/components/overlays/corruption/CorruptedAscend.tsx`
- Modify: `src/components/screens/MethodSelect.tsx`

**Interfaces:**
- Consumes: `state.infectedMethods` (already on snapshot), `state.corruption.band`, the `cx-card-*` / `cx-ca-*` classes (C1).

- [ ] **Step 1: Telegraph on infected cards.** In `MethodSelect.tsx`, when rendering each method card, add the telegraph class based on `state.infectedMethods.includes(i)` and `state.corruption.band`:
  - band `spreading` → add class `cx-card-spreading`; band `virulent`/`pinnacle` → `cx-card-virulent`, and render `<div className="cx-scanlines"/>` + three `<div className="cx-mosh m1|m2|m3"/>` inside the card.
  - The card's name element gets class `cx-name`, the glyph `cx-glyph` (so the keyframes target them). Find where `MethodCard`/`MethodCardFront` renders name/glyph; add those classNames (additive, behind a `corrupted` prop you thread through, default false).
  - Thread a `corrupted?: 'spreading' | 'virulent' | null` prop from `MethodSelect` → `CardSpread` → `MethodCard` for index `i`. Keep it optional so non-corrupted rendering is unchanged.

- [ ] **Step 2: Corrupted ascension component.** Create `src/components/overlays/corruption/CorruptedAscend.tsx`:

```tsx
// Plays once when a corrupted method card is picked: mimics the gold ascend, then
// shears the card into displaced GPU-artifact slices and un-renders it. ~3s, then onDone.
import { useEffect } from 'react';

const SLICES: Array<{ clip: string; dx: string; dis?: boolean }> = [
  { clip: 'inset(0 0 91% 0)', dx: '7px' },
  { clip: 'inset(9% 0 74% 0)', dx: '-19px', dis: true },
  { clip: 'inset(26% 0 66% 0)', dx: '4px' },
  { clip: 'inset(34% 0 45% 0)', dx: '-11px', dis: true },
  { clip: 'inset(55% 0 37% 0)', dx: '22px' },
  { clip: 'inset(63% 0 18% 0)', dx: '-6px', dis: true },
  { clip: 'inset(82% 0 0 0)', dx: '10px' },
];

export default function CorruptedAscend({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="cx-ca-root" style={{ position: 'relative' }}>
      <div className="cx-ca-base">{children}</div>
      {SLICES.map((s, i) => (
        <div key={i} className={`cx-ca-slice${s.dis ? ' dis' : ''}`}
             style={{ position: 'absolute', inset: 0, clipPath: s.clip, ['--dx' as string]: s.dx }}>
          {children}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Use it on pick.** In `MethodSelect.tsx`, when the picked index is infected (`pending?.finalIndex` ∈ `infectedMethods`), render the chosen card wrapped in `<CorruptedAscend onDone={() => engine.confirmSelection()}>` **instead of** the normal gold ascend motion, and **suppress** the normal `confirmSelection` timer for that pick (the component drives it). Non-infected picks are unchanged. (The simplest seam: in the `pending` effect, if the pick is infected, skip scheduling `engine.confirmSelection()` and let `CorruptedAscend`'s `onDone` call it.)

- [ ] **Step 4: Build + manual check.**

Run: `npm run build` (must pass). Then `npm run dev`: open `?debug`, `engine.setCorruption(50)` (spreading) → start a draw, confirm 0–1 cards show subtle telegraph and picking an infected one plays the quick tear; `engine.setCorruption(80)` (virulent) → 1–2 blatant cards. Compare to `selection-telegraph-v2.html` + `corrupted-ascend-v8.html`.

- [ ] **Step 5: Commit.**

```bash
git add src/components/overlays/corruption/CorruptedAscend.tsx src/components/screens/MethodSelect.tsx src/components/cards/MethodCard.tsx
git commit -m "feat(corruption): selection telegraph + corrupted card ascension"
```

---

### Task C3: Corrupted results screen (text styling + Virulent overlay)

**Files:**
- Modify: `src/components/screens/ResultReading.tsx`

**Interfaces:**
- Consumes: `state.corruption.band` (the synthesis text is already falsified by B3); `cx-results`/`cx-scan`/`cx-vignette`/`cx-mosh`/`cx-ca-text` (C1).

- [ ] **Step 1: Wrap the panel.** In `ResultReading.tsx`, when `state.corruption.band` is `virulent` or `pinnacle`, add `className="cx-results"` to the results card container and render, as its first children, `<div className="cx-scan"/>`, `<div className="cx-vignette"/>`, and three `<div className="cx-mosh m1|m2|m3"/>`. Add `position: relative` + `overflow: hidden` to `cardStyle` (it is already `overflow` clean; add if missing). At `spreading` add **no** overlay (text is already subtly corrupted by the engine).

- [ ] **Step 2: Light text glitch on synthesis.** When band is virulent/pinnacle, add `className="cx-ca-text"` to the `headlineStyle` element so the headline carries the chromatic pulse. (Body paragraphs already contain the in-text garble/redaction from B3 — no per-span markup needed.)

- [ ] **Step 3: Build + manual check.**

Run: `npm run build`. `npm run dev`: stage `engine.setCorruption(80)`, complete a reading → results show falsified text + scanlines/vignette/datamosh; compare to `results-overlay.html`. Stage `50` → subtle text only, no overlay.

- [ ] **Step 4: Commit.**

```bash
git add src/components/screens/ResultReading.tsx
git commit -m "feat(corruption): corrupted results screen overlay at virulent+"
```

---

### Task C4: Intrusion overlay

**Files:**
- Create: `src/components/overlays/corruption/IntrusionOverlay.tsx`
- Modify: `src/components/screens/GameTable.tsx`

**Interfaces:**
- Consumes: `state.intrusion` + `engine.clearIntrusion()` (B4); `.cx-intrusion` (C1).

- [ ] **Step 1: Component.** Create `src/components/overlays/corruption/IntrusionOverlay.tsx`:

```tsx
import { useEffect } from 'react';
import { useGameEngine } from '../../../hooks/useGameEngine';

export default function IntrusionOverlay() {
  const { state, engine } = useGameEngine();
  const intrusion = state.intrusion;
  useEffect(() => {
    if (!intrusion) return;
    const t = setTimeout(() => engine.clearIntrusion(), 2400); // matches cx-intr duration
    return () => clearTimeout(t);
  }, [intrusion, engine]);
  if (!intrusion) return null;
  return (
    <div className="cx-intrusion" aria-hidden>
      <span key={intrusion.text}>{intrusion.text}</span>
    </div>
  );
}
```

- [ ] **Step 2: Mount it globally.** In `GameTable.tsx`, render `<IntrusionOverlay />` alongside the other overlays (near the `CorruptionRift` mount) so it shows over results **and** the table (minigame-end). It self-hides when `state.intrusion` is null.

- [ ] **Step 3: Build + manual check.**

Run: `npm run build`. `npm run dev`: `engine.setCorruption(95)` then complete a reading → the phantom line glitches in/out over the screen; compare to `intrusion.html`.

- [ ] **Step 4: Commit.**

```bash
git add src/components/overlays/corruption/IntrusionOverlay.tsx src/components/screens/GameTable.tsx
git commit -m "feat(corruption): intrusion overlay (results + minigame-end)"
```

---

### Task C5: Rupture interstitial

**Files:**
- Create: `src/components/screens/RuptureInterstitial.tsx`
- Modify: `src/components/screens/GameTable.tsx` (screen switch + `showTableau`)

**Interfaces:**
- Consumes: `engine.completeRupture()` (B6); the `cx-rupt-*` keyframes (C1).

- [ ] **Step 1: Component.** Create `src/components/screens/RuptureInterstitial.tsx`. Port the full markup/animation from `.superpowers/brainstorm/15713-1782663357/content/rupture-v5.html` (the screen frame, starfield generation, the eye-rift SVG with the maw `cx-rupt-mawrip`, void infill `cx-rupt-ripfill`, eye spawn/lid/core, the non-scaling-stroke cracks `cx-rupt-crackrip`, flash/void/thread/reform). It is **unskippable**; call `engine.completeRupture()` once when the sequence ends:

```tsx
import { useEffect } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';

const RUPTURE_MS = 8000; // matches the ported 8s keyframe timeline

export default function RuptureInterstitial() {
  const { engine } = useGameEngine();
  useEffect(() => {
    const t = setTimeout(() => engine.completeRupture(), RUPTURE_MS);
    return () => clearTimeout(t);
  }, [engine]);
  // ...ported full-screen rupture markup from rupture-v5.html (stars, creep, eye-rift svg,
  //    cracks svg, flash/void/thread/reform). No skip control.
  return (/* ported JSX */ null as any);
}
```

Replace the `return (... null as any)` with the actual ported JSX (convert the mockup's `class`→`className`, inline `style` strings → style objects, `stroke-width`→`strokeWidth`, `clip-path`→`clipPath`, generate the starfield with a `useMemo` of random positions). Keep the CSS in `corruption.css` (move the mockup's `<style>` rules there under the `cx-rupt-` names referenced in C1).

- [ ] **Step 2: Wire the screen.** In `GameTable.tsx` `renderScreen()` add:

```tsx
case 'rupture':
  return <RuptureInterstitial key="rupture" />;
```

and extend `showTableau` to also exclude `'rupture'`:

```tsx
const showTableau = state.screen !== 'title' && state.screen !== 'question'
  && state.screen !== 'result' && state.screen !== 'rupture';
```

- [ ] **Step 3: Build + manual check.**

Run: `npm run build`. `npm run dev`: `engine.setCorruption(99)` with all affinities maxed (via JSON injector), complete a reading → the Rupture plays then lands on Title; affinities are reset. Compare to `rupture-v5.html`.

- [ ] **Step 4: Commit.**

```bash
git add src/components/screens/RuptureInterstitial.tsx src/components/screens/GameTable.tsx src/styles/corruption.css
git commit -m "feat(corruption): rupture interstitial screen"
```

---

### Task C6: Corrupted history record rendering

**Files:**
- Modify: `src/components/overlays/HistoryModal.tsx`

**Interfaces:**
- Consumes: `RunRecord.corrupted` (B5); `.cx-ca-text` / inline glitch styling (C1).

- [ ] **Step 1: Render corrupted records garbled.** In `HistoryModal.tsx`, when `run.corrupted`, render the record card with a red-tinted border and the headline replaced by a garbled label, e.g. `error — recovered fragments`:

```tsx
{run.corrupted ? (
  <p style={{ ...headlineStyle, color: '#ff8a98' }} className="cx-ca-text">error — recovered fragments</p>
) : run.synthesis?.headline ? (
  <p style={headlineStyle}>{run.synthesis.headline}</p>
) : null}
```

Optionally add `boxShadow: '0 0 12px #ff2d4a33'` and `borderColor: '#5a2230'` to the `runCardStyle` for corrupted entries (spread a conditional style object). Keep clean records exactly as-is.

- [ ] **Step 2: Build + manual check.**

Run: `npm run build`. `npm run dev`: with a corrupted record in history (after a virulent reading), open History → it shows the garbled "recovered fragments" entry; trigger a Rupture → it vanishes (scrubbed by B6).

- [ ] **Step 3: Commit.**

```bash
git add src/components/overlays/HistoryModal.tsx
git commit -m "feat(corruption): garbled corrupted records in history"
```

---

# PART D — Docs

### Task D1: Sync `docs/game-systems.md` + README

**Files:**
- Modify: `docs/game-systems.md`
- Modify: `README.md`

- [ ] **Step 1: Update the corruption section of `docs/game-systems.md`** to document: the rebalanced gain knobs (coupling-other 0.09, DR floor 0.67, run-drift 0.08) in the affinity tuning table; the chance-based infection (0 / 0–1 / 1–2); the reading-falsification escalation (Seeded clean → Spreading subtle → Virulent ramp); the intrusion (player-aware, results + minigame-end, once-per-event guarantee); the corrupted record + Rupture scrub; the Rupture interstitial (unskippable → Title).

- [ ] **Step 2: Update the README** wherever it lists affinity tuning values and the corruption/player-facing behavior, matching the above.

- [ ] **Step 3: Commit.**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(corruption): document phase 3 presentation + phase 4 rebalance"
```

---

## Notes for the executor

- **Order matters:** A → B1…B6 → C1…C6 → D. Part B is pure engine + TDD (run `npm test`). Part C has no unit tests — gate each on `npm run build` + the named mockup.
- **`oneReading(e)` / `fullTurn(e)`** helpers (commit a die → drain `eventQueue` via `finishEventBatch()` → `continueAfterReview()`) are the established way to advance readings in tests — copy them from `CorruptionLifecycle.test.ts`.
- If a positive-corruption engine assertion proves flaky through a full turn, prefer asserting the **pure** function (`corruptText`, `intrusionChance`, `rollInfectedCount`, `corruptionTextLevel`) directly — the wiring tests only need to prove the glue calls them and the dormant path stays clean.
- Stage bands in the dev build with `engine.setCorruption(n)` (debug-only setter) + the JSON injector for maxed affinities (see `repro-game-state-injection`).
