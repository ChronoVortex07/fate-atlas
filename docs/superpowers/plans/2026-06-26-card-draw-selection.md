# Card-Draw Method Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vertical tile-based `MethodSelect` screen with an animated card-drawing mechanic — cards deal in face-down, affinity effects (Will widen / Fate thin / Shadow shroud) animate in the spread with a banner, cards flip, the player picks, and Fate may force a different card via a hand-of-fate overlay.

**Architecture:** The engine already computes the entire draw-phase effect chain (`buildPool` runs `select:draw:start` → `generatePool` → `select:draw:end`; `selectMethod` runs `select:pick`). We do **not** add the spec's `initiateDrawPhase()`/`bannerQueue` API. Instead we (a) **divert** the already-produced `EffectReport`s for the draw phase out of the generic `eventQueue` into a new `drawPhase` state field (they stay in `turnEffects` for the run record), and (b) split selection into `beginSelection(index)` (dispatch + stash a `pendingSelection`, no screen change) and `confirmSelection()` (do the screen transition), with `selectMethod(index)` composing both so its existing synchronous contract — relied on by ~20 engine tests — is unchanged. A rewritten `MethodSelect` reads `availableMethods`, `shroudedMethods`, and `drawPhase`, and orchestrates a local deal → effects → flip → pick → resolve state machine with Framer Motion.

**Tech Stack:** React 18, TypeScript (strict), Vite, Framer Motion (already the project's only animation dependency), inline SVG for card art (matching existing `CardBack`/`RuneSigil`/`HexagramPillar` conventions). Engine is framework-free TS; tests are Vitest (engine only).

## Global Constraints

- **Engine purity:** `src/engine/**` stays free of React/DOM imports. All new logic-side code is plain TS. (CLAUDE.md)
- **Snapshot contract:** every engine mutator ends with `notify()`. `getState()` returns the immutable snapshot; never hand out `this.state`. (CLAUDE.md)
- **Typecheck is the lint gate:** `npm run build` runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`. No unused imports/vars/params. There is no ESLint/Prettier.
- **Tests are engine-only:** Vitest runs only `src/engine/__tests__/**` in Node. Do **not** add component test files — they will not run. Component correctness is gated by `npm run build` plus manual verification via `npm run dev` and the debug panel.
- **`selectMethod(index)` contract is frozen:** after `selectMethod(i)` returns, `state.screen === 'minigame'`, `state.selectedMethod` is set, Fate-force redirection has been applied, and `selectMethod(99)` throws `'out of bounds'`. ~20 test call sites depend on this.
- **Affinity → colour mapping (spec):** Will = green `#5b8c5a`, Fate = gold `#d4a854`, Shadow = purple `#9b6bb0` / veil `#4a3a60`. Method family colours: tarot `#9b6bb0`, d20 `#c75b4a`, iching `#5b8c5a`, astral `#5b7ec7`, rune `#c8a86a`.
- **Card form factor:** 2:3 portrait, sized from a `--card-w` CSS custom property (`clamp(86px, 22vw, 120px)`), `--card-h: calc(var(--card-w) * 1.5)`.
- **Animation pacing (spec):** deal stagger 50–80ms; effect step ~1.0–1.5s auto-advancing; flip ~400ms; ascend on click; Fate force ~2–2.5s; shrouded reveal ~600ms.
- **Docs sync:** this feature changes **presentation only** (no affinity math, no responders, no reducers), so `docs/game-systems.md` does **not** need changes. The README method-selection description and the design-spec status **do** (Task 14).

---

## File Structure

**New files**

- `src/components/shared/FateMark.tsx` — the Atlas-of-Fate sigil (fate-compass): used as favicon, card-back centerpiece, and inside the wordmark. *(Task 3A)*
- `src/components/shared/Wordmark.tsx` — "Atlas of Fate" lockup, `stacked` + `horizontal` variants. *(Task 3C)*
- `src/data/method-cards.ts` — `METHOD_FRONTS` config (title, flavor, family colour, fallback symbol) per `DivinationType`. Single source for the card fronts. *(Task 4)*
- `src/components/cards/MethodEmblem.tsx` — per-method illustrated inline-SVG emblem (the "art"). *(Task 4)*
- `src/components/cards/MethodCardFront.tsx` — the face-up card: Celestial-Veil frame + `MethodEmblem` + title + flavor. *(Task 4)*
- `src/components/cards/MethodCard.tsx` — one card; renders face-down / face-up / shrouded / selected / rejected / fated states with Framer Motion. *(Task 5)*
- `src/components/cards/CardSpread.tsx` — horizontal scroll row of `MethodCard`s. *(Task 6)*
- `src/components/screens/WillSwapButton.tsx` — extracted swap control. *(Task 7)*
- `src/components/overlays/EventBanner.tsx` — top-center auto-fading message line (presentational; driven by `MethodSelect`). *(Task 9)*
- `src/components/overlays/FateForceOverlay.tsx` — full-screen freeze + hand-of-fate SVG. *(Task 11)*

**Modified files**

- `src/engine/types.ts` — add `PendingSelection`, `DrawPhase`; add `drawPhase` to `GameState`. *(Task 1)*
- `src/engine/GameEngine.ts` — `buildPool` divert; `beginSelection`/`confirmSelection`; refactor `selectMethod`; reset `drawPhase`. *(Tasks 2–3)*
- `src/components/screens/MethodSelect.tsx` — full rewrite to the card-draw orchestrator. *(Task 8, extended in 10 & 12)*
- `index.html` — swap the favicon `data:` URI to the FateMark sigil. *(Task 3B)*
- `src/components/screens/TitleScreen.tsx` — replace the `<h1>ATLAS OF FATE</h1>` text with `<Wordmark variant="stacked" />`. *(Task 3C)*
- `src/components/cards/MethodEmblem.tsx` — rune emblem uses the smaller stave (approved tweak). *(Task 4)*
- `src/engine/events/scenarios.ts` — no change needed (existing `will-widen-pool`, `fate-thin-pool`, `shadow-shroud`, `fate-force-method`, `combo-widen-shroud` scenarios already stage `method-select`). Used for manual verification.
- `docs/superpowers/specs/2026-06-25-card-draw-selection-design.md` + `README.md` — status/description. *(Task 14)*

**Shipping layers** (each layer ends on a mergeable, playable state):
- **Layer A — Engine wiring (Tasks 1–3):** behaviour identical to today, but draw data is now exposed on `state.drawPhase`. Fully green test suite.
- **Layer A2 — Brand identity (Tasks 3A–3C):** the fate-compass `FateMark`, the favicon, and the `Wordmark` on the title screen. Independent of the card-draw mechanic and shippable on its own; `FateMark` is then reused by the card back in Layer B.
- **Layer B — Static card UI (Tasks 4–8):** tiles replaced by a dealing/flipping card spread (back uses `FateMark` + constellations; veil is the misty v2); picking works; Fate-force resolves instantly (no overlay yet).
- **Layer C — Effect banner + in-spread animations (Tasks 9–10):** Will/Fate/Shadow effects animate in the spread with the banner.
- **Layer D — Fate-force overlay + reveal + polish (Tasks 11–13).**
- **Docs (Task 14).**

---

## Task 1: Draw-phase state types

**Files:**
- Modify: `src/engine/types.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts` (existing; extended in Task 2)

**Interfaces:**
- Produces: `PendingSelection`, `DrawPhase`, and `GameState.drawPhase: DrawPhase | null` — consumed by `GameEngine` (Tasks 2–3) and every UI task.

- [ ] **Step 1: Add the types and the state field**

In `src/engine/types.ts`, immediately above `// ── Engine State ──`, add:

```typescript
// ── Draw Phase (card-draw method selection) ──

/** A selection in flight, awaiting the card-draw UI to finish animating before
 *  the screen transitions to the minigame. Set by beginSelection(). */
export interface PendingSelection {
  chosenIndex: number;            // index in availableMethods the player clicked
  finalIndex: number;             // index actually selected (Fate may redirect)
  method: DivinationType;         // availableMethods[finalIndex]
  wasForced: boolean;             // true when finalIndex !== chosenIndex (Fate force)
  shrouded: boolean;              // finalIndex was shrouded → play the reveal
  forceReport: EffectReport | null; // fate-force-method report, for overlay text
}

/** Snapshot of the current method-select draw, consumed by MethodSelect. The
 *  pool/shroud themselves remain on GameState.availableMethods/shroudedMethods;
 *  this carries the ordered pre-selection effect reports (diverted from the
 *  generic eventQueue) plus any in-flight selection. */
export interface DrawPhase {
  nonce: number;                  // bumps on each (re)deal — keys the UI deal/sequence
  effectReports: EffectReport[];  // ordered widen/thin/shroud reports to narrate
  pendingSelection: PendingSelection | null;
}
```

Then in `interface GameState`, add the field right after `shroudedMethods: number[];`:

```typescript
  drawPhase: DrawPhase | null;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: FAIL — `GameEngine.defaultState()` does not yet set `drawPhase`, so the object literal is missing a required property (`Property 'drawPhase' is missing`). This confirms the type is wired in. Fixed in Task 2, Step 1.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(engine): add DrawPhase/PendingSelection state types"
```

---

## Task 2: Divert draw-phase reports into `state.drawPhase`

**Files:**
- Modify: `src/engine/GameEngine.ts` (`defaultState`, `buildPool`, `returnToQuestionSelect`)
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Consumes: `DrawPhase` (Task 1).
- Produces: after any pool build, `state.drawPhase` is non-null with `effectReports` = the draw-phase reports, and those reports are **absent** from `state.eventQueue` but **present** in the per-turn `turnEffects` (→ `RunRecord.effects`).

- [ ] **Step 1: Initialise `drawPhase` in `defaultState`**

In `GameEngine.defaultState()` return object, add after `shroudedMethods: [],`:

```typescript
      drawPhase: null,
```

- [ ] **Step 2: Write the failing test**

Add to `src/engine/__tests__/GameEngine.test.ts` (inside the top-level `describe`, alongside the other tests). It forces Will-widen + Shadow-shroud at draw time and asserts the reports land on `drawPhase`, not `eventQueue`:

```typescript
  it('diverts draw-phase effect reports onto state.drawPhase, not the eventQueue', () => {
    const engine = new GameEngine();
    // Force the two draw-phase responders to fire on the next pool build.
    engine.forceEffects(['will-widen-pool', 'shadow-shroud'], true);
    // Stage affinities so their conditions are satisfiable, then start a turn.
    engine.loadState({ affinities: { chaos: 50, order: 50, fate: 50, will: 75, light: 50, shadow: 75 } });
    engine.startTurn('self');

    const s = engine.getState();
    expect(s.drawPhase).not.toBeNull();
    // Draw-phase reports were captured on drawPhase…
    const ids = s.drawPhase!.effectReports.map((r) => r.responderId);
    expect(ids).toContain('will-widen-pool');
    expect(ids).toContain('shadow-shroud');
    // …and are NOT sitting in the generic interaction queue.
    expect(s.eventQueue.map((r) => r.responderId)).not.toContain('will-widen-pool');
    expect(s.eventQueue.map((r) => r.responderId)).not.toContain('shadow-shroud');
  });
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "diverts draw-phase"`
Expected: FAIL — reports are currently appended to `eventQueue` by `dispatchAt`, so the `not.toContain` assertions fail (and `drawPhase` may be a default-built object without these reports).

- [ ] **Step 4: Implement the divert in `buildPool`**

Replace the whole `buildPool` method body with:

```typescript
  private buildPool(bias: Partial<Record<DivinationType, number>> = {}, refill = false): void {
    const baseCount = this.affinityEngine.getEffects().methodCount;
    const queueBefore = this.state.eventQueue.length;

    const startDraft: PhaseDraft = { poolTarget: baseCount };
    const { reports: startReports } = this.dispatchAt('select:draw:start', startDraft);
    const target = (startDraft.poolTarget as number) ?? baseCount;

    const affinities = this.affinityEngine.getState();
    const pool = refill
      ? this.orchestrator.refillPool(this.state.questionType!, affinities, bias, target)
      : this.orchestrator.generatePool(this.state.questionType!, affinities, target);
    this.state.availableMethods = pool;

    // Render the drawn pool through the end-of-draw trigger (shrouding, etc.).
    const poolResults = pool.map((m) => ({ tags: [], type: m } as unknown as SlotResult));
    const { draft: endDraftPool, reports: endReports } = this.dispatchAt('select:draw:end', { pool: poolResults });
    this.state.shroudedMethods = Array.isArray(endDraftPool.shrouded)
      ? (endDraftPool.shrouded as number[])
      : [];

    // The draw-phase effects (widen/thin/shroud) are narrated INSIDE the card
    // spread by MethodSelect (EventBanner + in-spread animation), not by the
    // generic InteractionSequencer. Pull them back off the queue — they remain
    // in turnEffects (added by dispatchAt) for the RunRecord — and stash them,
    // ordered, on drawPhase for the UI to sequence.
    this.state.eventQueue = this.state.eventQueue.slice(0, queueBefore);
    this.state.drawPhase = {
      nonce: (this.state.drawPhase?.nonce ?? 0) + 1,
      effectReports: [...startReports, ...endReports],
      pendingSelection: null,
    };
  }
```

- [ ] **Step 5: Reset `drawPhase` on `returnToQuestionSelect`**

In `returnToQuestionSelect()`, add after `this.state.shroudedMethods = [];`:

```typescript
    this.state.drawPhase = null;
```

(`reset`, `returnToTitle`, and `clearHistory` already go through `defaultState()`, which now nulls it.)

- [ ] **Step 6: Run the new test + full suite**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "diverts draw-phase"`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS. If `Scenarios.test.ts` or `EngineDispatch.test.ts` asserts that a draw-phase report (`will-widen-pool`/`fate-thin-pool`/`shadow-shroud`) appears on `state.eventQueue` after a `method-select` scenario/`startTurn`, update that assertion to read `state.drawPhase!.effectReports` instead — the report now lives there. (Interaction/tarot/dice `shroud`/`override` reports are unaffected: only `select:draw:*` reports are diverted.)

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc -b`
Expected: PASS.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): divert draw-phase effect reports onto state.drawPhase"
```

---

## Task 3: Two-step selection (`beginSelection` / `confirmSelection`)

**Files:**
- Modify: `src/engine/GameEngine.ts`
- Test: `src/engine/__tests__/GameEngine.test.ts`

**Interfaces:**
- Produces (consumed by `MethodSelect`):
  - `beginSelection(index: number): void` — dispatches `select:pick`, computes Fate redirection, diverts the `fate-force-method` report off `eventQueue`, sets `state.drawPhase.pendingSelection`, and `notify()`s **without** changing `screen`.
  - `confirmSelection(): void` — reads `pendingSelection`, sets `selectedMethod`, `screen='minigame'`, clears `drawPhase`, starts the tarot draft when needed, and `notify()`s. No-op if there is no pending selection.
  - `selectMethod(index: number): void` — unchanged contract; now implemented as `beginSelection(index); confirmSelection();`.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/GameEngine.test.ts`:

```typescript
  it('beginSelection stages a pendingSelection without leaving method-select', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.beginSelection(0);
    const s = engine.getState();
    expect(s.screen).toBe('method-select');           // not transitioned yet
    expect(s.selectedMethod).toBeNull();
    expect(s.drawPhase?.pendingSelection).not.toBeNull();
    expect(s.drawPhase?.pendingSelection?.finalIndex).toBe(0); // no Fate force at baseline
    expect(s.drawPhase?.pendingSelection?.wasForced).toBe(false);
  });

  it('confirmSelection transitions to the staged method and clears drawPhase', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const method = engine.getState().availableMethods[0];
    engine.beginSelection(0);
    engine.confirmSelection();
    const s = engine.getState();
    expect(s.screen).toBe('minigame');
    expect(s.selectedMethod).toBe(method);
    expect(s.drawPhase).toBeNull();
  });

  it('selectMethod still transitions synchronously and validates the index', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const method = engine.getState().availableMethods[0];
    engine.selectMethod(0);
    expect(engine.getState().screen).toBe('minigame');
    expect(engine.getState().selectedMethod).toBe(method);
    expect(() => engine.selectMethod(99)).toThrow('out of bounds');
  });
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "beginSelection"`
Expected: FAIL — `engine.beginSelection is not a function`.

- [ ] **Step 3: Replace `selectMethod` with the three methods**

In `GameEngine.ts`, replace the entire existing `selectMethod(index: number): void { ... }` method with:

```typescript
  // Stage a selection: resolve Fate-force, stash a pendingSelection, but do NOT
  // transition — the card-draw UI plays the ascend / hand-of-fate / reveal, then
  // calls confirmSelection(). The fate-force report is diverted off eventQueue
  // (the FateForceOverlay narrates it) but stays in turnEffects for the record.
  beginSelection(index: number): void {
    if (!this.state.availableMethods[index]) {
      throw new Error(`Method index ${index} out of bounds`);
    }
    const queueBefore = this.state.eventQueue.length;
    const { draft, reports } = this.dispatchAt('select:pick', {
      methodIndex: index,
      methodPool: this.state.availableMethods,
    });
    const finalIndex = typeof draft.methodIndex === 'number' ? draft.methodIndex : index;
    const methodType = this.state.availableMethods[finalIndex];
    if (!methodType) {
      throw new Error(`Method index ${finalIndex} out of bounds`);
    }
    const forceReport = reports.find((r) => r.responderId === 'fate-force-method') ?? null;
    this.state.eventQueue = this.state.eventQueue.slice(0, queueBefore);

    const pending: import('./types').PendingSelection = {
      chosenIndex: index,
      finalIndex,
      method: methodType,
      wasForced: finalIndex !== index,
      shrouded: this.state.shroudedMethods.includes(finalIndex),
      forceReport,
    };
    this.state.drawPhase = {
      nonce: this.state.drawPhase?.nonce ?? 0,
      effectReports: this.state.drawPhase?.effectReports ?? [],
      pendingSelection: pending,
    };
    this.notify();
  }

  // Complete a staged selection: transition to the minigame for the (possibly
  // Fate-redirected) method. No-op without a pendingSelection.
  confirmSelection(): void {
    const pending = this.state.drawPhase?.pendingSelection;
    if (!pending) return;
    this.state.selectedMethod = pending.method;
    this.state.activeSlotIndex = null;
    this.state.screen = 'minigame';
    this.state.drawPhase = null;
    if (pending.method === 'tarot') {
      this.startTarotDraft(); // notifies
    }
    this.notify();
  }

  // Synchronous convenience used by tests and any non-animated caller. Preserves
  // the original contract: after this returns, screen === 'minigame'.
  selectMethod(index: number): void {
    this.beginSelection(index);
    this.confirmSelection();
  }
```

- [ ] **Step 4: Run the targeted + full suite**

Run: `npx vitest run src/engine/__tests__/GameEngine.test.ts -t "beginSelection|confirmSelection|selectMethod"`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS (all pre-existing `selectMethod` call sites still transition synchronously).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b`
Expected: PASS.

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/GameEngine.test.ts
git commit -m "feat(engine): split selection into beginSelection/confirmSelection"
```

> **Layer A complete** — engine exposes `drawPhase` + staged selection; behaviour and tests unchanged. Mergeable.

---

## Task 3A: `FateMark` — the Atlas of Fate sigil

**Files:**
- Create: `src/components/shared/FateMark.tsx`

**Interfaces:**
- Produces: `FateMark({ size, detail, color }: { size?: number; detail?: boolean; color?: string })` — inline SVG. `detail={false}` drops the rings/ticks for legibility at tiny sizes. Reused by `Wordmark` (3C) and the card back (Task 5).

- [ ] **Step 1: Create `src/components/shared/FateMark.tsx`**

```tsx
import { useId } from 'react';

// The Atlas of Fate sigil — a fate-compass: an eight-point celestial star inside
// a double ring, sun-and-moon at its heart (the game's dualities), six outer
// stars for the six affinities. detail={false} drops the rings/ticks so the
// silhouette still reads at favicon size.
export default function FateMark({ size = 64, detail = true, color = '#d4a854' }:
  { size?: number; detail?: boolean; color?: string }) {
  const gid = useId();
  const longPts = 'M50 8 L55 45 L92 50 L55 55 L50 92 L45 55 L8 50 L45 45 Z';
  const diagPts = 'M50 20 L53 47 L80 50 L53 53 L50 80 L47 53 L20 50 L47 47 Z';
  const outerStars = detail ? Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180;
    const x = 50 + Math.cos(a) * 44, y = 50 + Math.sin(a) * 44;
    return <path key={i} d={`M${x} ${y - 2.4} l.7 1.7 1.7.7 -1.7.7 -.7 1.7 -.7-1.7 -1.7-.7 1.7-.7 Z`} fill={color} opacity={0.9} />;
  }) : null;
  const sunTicks = detail ? Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 * Math.PI / 180;
    const x1 = 46 + Math.cos(a) * 8, y1 = 50 + Math.sin(a) * 8;
    const x2 = 46 + Math.cos(a) * 10.5, y2 = 50 + Math.sin(a) * 10.5;
    return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
  }) : null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block' }} role="img" aria-label="Atlas of Fate">
      <defs>
        <radialGradient id={gid} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#f3dca0" /><stop offset="60%" stopColor={color} /><stop offset="100%" stopColor="#9a7330" />
        </radialGradient>
      </defs>
      {detail && (
        <>
          <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="1.4" opacity="0.55" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="0.8" opacity="0.4" />
          {outerStars}
        </>
      )}
      <g transform="rotate(45 50 50)"><path d={diagPts} fill={`url(#${gid})`} opacity={detail ? 0.5 : 0.65} /></g>
      <path d={longPts} fill={`url(#${gid})`} />
      <circle cx="50" cy="50" r={detail ? 14 : 13} fill="#0a0d1c" stroke={color} strokeWidth="1.2" />
      <circle cx="46" cy="50" r="6.5" fill={color} />
      <path d="M53.5 50 a6.8 6.8 0 1 1 -3.6 -6 a5.2 5.2 0 1 0 3.6 6 Z" fill="#0a0d1c" />
      {detail && <g stroke={color} strokeWidth="0.9" opacity="0.85">{sunTicks}</g>}
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/components/shared/FateMark.tsx
git commit -m "feat(brand): FateMark sigil component"
```

---

## Task 3B: Favicon

**Files:**
- Modify: `index.html`

**Interfaces:** none.

- [ ] **Step 1: Replace the favicon `data:` URI**

In `index.html`, replace the existing `<link rel="icon" …>` line with the FateMark (heavier strokes for 16px legibility; `#` is URL-encoded as `%23`):

```html
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='44' fill='none' stroke='%23d4a854' stroke-width='4'/><path d='M50 6 L56 44 L94 50 L56 56 L50 94 L44 56 L6 50 L44 44 Z' fill='%23d4a854'/><circle cx='50' cy='50' r='13' fill='%230a0d1c' stroke='%23d4a854' stroke-width='3'/><circle cx='46' cy='50' r='6.5' fill='%23d4a854'/><path d='M53.5 50 a6.8 6.8 0 1 1 -3.6 -6 a5.2 5.2 0 1 0 3.6 6 Z' fill='%230a0d1c'/></svg>" />
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, open the app, confirm the browser tab shows the gold fate-compass (not the old ✧).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(brand): fate-compass favicon"
```

---

## Task 3C: `Wordmark` + title screen

**Files:**
- Create: `src/components/shared/Wordmark.tsx`
- Modify: `src/components/screens/TitleScreen.tsx`

**Interfaces:**
- Consumes: `FateMark` (3A).
- Produces: `Wordmark({ variant }: { variant?: 'stacked' | 'horizontal' })`.

- [ ] **Step 1: Create `src/components/shared/Wordmark.tsx`**

```tsx
import FateMark from './FateMark';

// "Atlas of Fate" lockup. ATLAS in starlight (the map), FATE in gold (the
// thread). stacked = main menu; horizontal = headers.
export default function Wordmark({ variant = 'stacked' }: { variant?: 'stacked' | 'horizontal' }) {
  if (variant === 'horizontal') {
    return (
      <div style={hRow}>
        <FateMark size={40} />
        <div style={hWords}>
          <span style={hAtlas}>ATLAS</span>
          <span style={hOf}>of</span>
          <span style={hFate}>FATE</span>
        </div>
      </div>
    );
  }
  return (
    <div style={stack}>
      <FateMark size={54} />
      <div style={sAtlas}>ATLAS</div>
      <div style={sDiv}>
        <span style={sLn} /><span style={sStar}>✦</span><span style={sOf}>of</span><span style={sStar}>✦</span><span style={{ ...sLn, ...sLnR }} />
      </div>
      <div style={sFate}>FATE</div>
    </div>
  );
}

const GRAD = 'linear-gradient(180deg,#f0d595,#c08f3c)';
const goldText: React.CSSProperties = {
  background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
};

const stack: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' };
const sAtlas: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(2rem, 8vw, 2.7rem)',
  letterSpacing: '0.34em', textIndent: '0.34em', color: '#c8d8f0', lineHeight: 1,
};
const sFate: React.CSSProperties = { ...sAtlas, fontWeight: 600, ...goldText };
const sDiv: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', margin: '0.3rem 0' };
const sLn: React.CSSProperties = { width: '60px', height: '1px', background: 'linear-gradient(90deg,transparent,#d4a854)' };
const sLnR: React.CSSProperties = { background: 'linear-gradient(90deg,#d4a854,transparent)' };
const sStar: React.CSSProperties = { color: '#d4a854', fontSize: '0.6rem' };
const sOf: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.95rem', letterSpacing: '0.18em', color: '#c8a060' };

const hRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '16px' };
const hWords: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '13px' };
const hAtlas: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.4rem, 5vw, 1.9rem)', letterSpacing: '0.22em', color: '#c8d8f0' };
const hFate: React.CSSProperties = { ...hAtlas, fontWeight: 600, ...goldText };
const hOf: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(0.95rem, 3vw, 1.25rem)', letterSpacing: '0.04em', color: '#c8a060' };
```

- [ ] **Step 2: Use it on the title screen**

In `src/components/screens/TitleScreen.tsx`, add the import:

```tsx
import Wordmark from '../shared/Wordmark';
```

Replace `<h1 style={titleStyle}>ATLAS OF FATE</h1>` with:

```tsx
          <Wordmark variant="stacked" />
```

Then delete the now-unused `titleStyle` constant (its block) to satisfy `noUnusedLocals`.

- [ ] **Step 3: Typecheck + verify**

Run: `npx tsc -b` → PASS (confirm no unused `titleStyle`).
Run: `npm run dev` → the title screen shows the stacked wordmark (mark + ATLAS / of / FATE) between the runic bands; "Consult the stars" button unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/Wordmark.tsx src/components/screens/TitleScreen.tsx
git commit -m "feat(brand): wordmark on the title screen"
```

> **Layer A2 complete** — brand identity (mark, favicon, wordmark) shipped. Mergeable independently.

---

## Task 4: Card-front art (`method-cards.ts`, `MethodEmblem`, `MethodCardFront`)

**Files:**
- Create: `src/data/method-cards.ts`
- Create: `src/components/cards/MethodEmblem.tsx`
- Create: `src/components/cards/MethodCardFront.tsx`

**Interfaces:**
- Produces:
  - `METHOD_FRONTS: Record<DivinationType, { title: string; flavor: string; color: string; symbol: string }>`
  - `MethodEmblem({ method, size }: { method: DivinationType; size?: number })` — inline SVG art.
  - `MethodCardFront({ method }: { method: DivinationType })` — full face-up card content (fills its parent `MethodCard`).

- [ ] **Step 1: Create `src/data/method-cards.ts`**

```typescript
import type { DivinationType } from '../engine/types';

export interface MethodFrontConfig {
  title: string;
  flavor: string;  // short italic line under the title
  color: string;   // family accent
  symbol: string;  // roman numeral / glyph used as a fallback / corner mark
}

// Single source of truth for the illustrated method-card fronts. `happening`
// never appears in the selectable pool but is included for type-completeness.
export const METHOD_FRONTS: Record<DivinationType, MethodFrontConfig> = {
  tarot:     { title: 'Tarot',        flavor: 'The arcana reveal hidden truths.',   color: '#9b6bb0', symbol: 'XXI' },
  d20:       { title: 'Dice',         flavor: 'Fate speaks through numbers.',        color: '#c75b4a', symbol: '⚅' },
  iching:    { title: 'I Ching',      flavor: 'The hexagram illuminates the path.',  color: '#5b8c5a', symbol: '䷀' },
  astral:    { title: 'Astral',       flavor: 'The heavens disclose their wisdom.',  color: '#5b7ec7', symbol: '★' },
  rune:      { title: 'Rune Casting', flavor: 'The staves speak as they fall.',      color: '#c8a86a', symbol: 'ᚠ' },
  happening: { title: 'Happening',    flavor: 'Something stirs in the weave.',       color: '#d4a854', symbol: '✦' },
};
```

- [ ] **Step 2: Create `src/components/cards/MethodEmblem.tsx`**

Each method gets a distinct illustrated emblem. All use `currentColor` so the parent sets the family colour. `viewBox` is square; the parent constrains size.

```tsx
import type { DivinationType } from '../../engine/types';

// Per-method illustrated emblem (inline SVG, monochrome via currentColor). The
// parent (MethodCardFront) sets `color` to the family accent.
export default function MethodEmblem({ method, size = 64 }: { method: DivinationType; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 64 64',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.4,
    strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const,
    style: { display: 'block' as const },
  };
  switch (method) {
    case 'tarot':
      return (
        <svg {...common} role="img" aria-label="Tarot">
          {/* three fanned cards */}
          <g transform="rotate(-14 32 40)"><rect x="16" y="18" width="20" height="30" rx="2.5" opacity="0.5" /></g>
          <g transform="rotate(0 32 40)"><rect x="22" y="14" width="20" height="32" rx="2.5" opacity="0.75" /></g>
          <g transform="rotate(14 32 40)"><rect x="28" y="18" width="20" height="30" rx="2.5" /></g>
          <path d="M38 24 l2.6 5.2 5.4.8 -4 3.9.9 5.4 -4.8-2.5 -4.8 2.5.9-5.4 -4-3.9 5.4-.8 Z" strokeWidth="1" opacity="0.9" />
        </svg>
      );
    case 'd20':
      return (
        <svg {...common} role="img" aria-label="Dice">
          <path d="M32 8 L52 20 V44 L32 56 L12 44 V20 Z" />
          <path d="M32 8 L32 22 M12 20 L32 22 L52 20 M32 22 L20 44 M32 22 L44 44 M12 44 L20 44 L32 56 L44 44 L52 44" opacity="0.7" strokeWidth="1" />
          <text x="32" y="38" textAnchor="middle" fontSize="11" fontFamily="'Cormorant Garamond', serif" fill="currentColor" stroke="none">20</text>
        </svg>
      );
    case 'iching':
      return (
        <svg {...common} role="img" aria-label="I Ching">
          {/* six stacked lines: solid / broken alternating (Qian-over-Kun motif) */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const y = 14 + i * 7.6;
            const broken = i % 2 === 1;
            return broken ? (
              <g key={i}><line x1="16" y1={y} x2="29" y2={y} strokeWidth="3.2" /><line x1="35" y1={y} x2="48" y2={y} strokeWidth="3.2" /></g>
            ) : (
              <line key={i} x1="16" y1={y} x2="48" y2={y} strokeWidth="3.2" />
            );
          })}
        </svg>
      );
    case 'astral':
      return (
        <svg {...common} role="img" aria-label="Astral">
          <circle cx="32" cy="32" r="9" />
          <ellipse cx="32" cy="32" rx="22" ry="9" opacity="0.6" />
          <ellipse cx="32" cy="32" rx="22" ry="9" opacity="0.6" transform="rotate(60 32 32)" />
          <circle cx="54" cy="32" r="2" fill="currentColor" />
          <circle cx="14" cy="46" r="1.5" fill="currentColor" />
          <circle cx="48" cy="14" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'rune':
      return (
        <svg {...common} role="img" aria-label="Rune">
          <rect x="17" y="9" width="30" height="46" rx="6" opacity="0.5" />
          {/* Algiz stave — smaller, centered in the tablet (approved tweak) */}
          <path d="M32 22 V44 M32 28 L25 20 M32 28 L39 20" strokeWidth="2" />
        </svg>
      );
    case 'happening':
    default:
      return (
        <svg {...common} role="img" aria-label="Happening">
          <path d="M32 12 l3 14 14 3 -14 3 -3 14 -3 -14 -14 -3 14 -3 Z" />
        </svg>
      );
  }
}
```

- [ ] **Step 3: Create `src/components/cards/MethodCardFront.tsx`**

```tsx
import MethodEmblem from './MethodEmblem';
import { METHOD_FRONTS } from '../../data/method-cards';
import type { DivinationType } from '../../engine/types';

// The face-up card content: Celestial-Veil frame + family-tinted emblem, title,
// and flavor. Fills its parent (MethodCard) which owns the 2:3 box + flip.
export default function MethodCardFront({ method }: { method: DivinationType }) {
  const cfg = METHOD_FRONTS[method];
  return (
    <div style={{ ...frontStyle, borderColor: cfg.color + '55' }}>
      {/* corner brackets */}
      <span style={{ ...corner, top: 4, left: 4, borderColor: cfg.color, borderRight: 'none', borderBottom: 'none' }} />
      <span style={{ ...corner, top: 4, right: 4, borderColor: cfg.color, borderLeft: 'none', borderBottom: 'none' }} />
      <span style={{ ...corner, bottom: 4, left: 4, borderColor: cfg.color, borderRight: 'none', borderTop: 'none' }} />
      <span style={{ ...corner, bottom: 4, right: 4, borderColor: cfg.color, borderLeft: 'none', borderTop: 'none' }} />

      <div style={{ color: cfg.color, filter: `drop-shadow(0 0 6px ${cfg.color}55)` }}>
        <MethodEmblem method={method} size={Math.round(0.42 * 100)} />
      </div>
      <div style={titleStyle}>{cfg.title}</div>
      <div style={flavorStyle}>{cfg.flavor}</div>
    </div>
  );
}

const frontStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.4rem', padding: '0.6rem',
  background: 'radial-gradient(120% 90% at 50% 18%, #141b33 0%, #0b0f1e 70%)',
  border: '1px solid', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden',
};

const corner: React.CSSProperties = {
  position: 'absolute', width: 10, height: 10, border: '1.5px solid', opacity: 0.8,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.78rem, 2.4vw, 0.98rem)', color: '#e6ecfb', letterSpacing: '0.08em',
  textAlign: 'center', lineHeight: 1.1,
};

const flavorStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 400,
  fontSize: 'clamp(0.58rem, 1.7vw, 0.72rem)', color: '#7b9ec7', letterSpacing: '0.02em',
  textAlign: 'center', lineHeight: 1.25, padding: '0 0.2rem',
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS (components compile even though nothing imports them yet — `tsc -b` checks all files in the project graph; unused files still typecheck. If `noUnusedLocals` flags them as unimported it does not — that rule is per-symbol, not per-file).

- [ ] **Step 5: Commit**

```bash
git add src/data/method-cards.ts src/components/cards/MethodEmblem.tsx src/components/cards/MethodCardFront.tsx
git commit -m "feat(ui): illustrated method-card fronts (art + config)"
```

---

## Task 5: `MethodCard` — single card with all visual states

**Files:**
- Create: `src/components/cards/MethodCard.tsx`

**Interfaces:**
- Consumes: `MethodCardFront` (Task 4).
- Produces: `MethodCard` with this exact prop contract (consumed by `CardSpread`, Task 6):

```typescript
type MethodCardVisual = 'face-down' | 'face-up' | 'shrouded';
type MethodCardMotion = 'idle' | 'selected' | 'rejected' | 'fated';
interface MethodCardProps {
  method: import('../../engine/types').DivinationType;
  visual: MethodCardVisual;     // which face shows
  motion?: MethodCardMotion;    // selection emphasis (default 'idle')
  interactive: boolean;         // hover-lift + click enabled
  onClick?: () => void;
  index: number;                // for the flip stagger / aria
}
```

- [ ] **Step 1: Create `src/components/cards/MethodCard.tsx`**

```tsx
import { useId } from 'react';
import { motion } from 'framer-motion';
import MethodCardFront from './MethodCardFront';
import FateMark from '../shared/FateMark';
import { METHOD_FRONTS } from '../../data/method-cards';
import type { DivinationType } from '../../engine/types';

export type MethodCardVisual = 'face-down' | 'face-up' | 'shrouded';
export type MethodCardMotion = 'idle' | 'selected' | 'rejected' | 'fated';

export interface MethodCardProps {
  method: DivinationType;
  visual: MethodCardVisual;
  motion?: MethodCardMotion;
  interactive: boolean;
  onClick?: () => void;
  index: number;
}

export default function MethodCard({
  method, visual, motion: emphasis = 'idle', interactive, onClick, index,
}: MethodCardProps) {
  const flipped = visual !== 'face-down'; // face-up OR shrouded → rotated to front

  const motionState =
    emphasis === 'selected' ? { y: -22, scale: 1.06, boxShadow: '0 0 26px rgba(212,168,84,0.55)' }
    : emphasis === 'fated' ? { y: -14, scale: 1.04, boxShadow: '0 0 30px rgba(212,168,84,0.7)' }
    : emphasis === 'rejected' ? { y: 0, scale: 0.97, opacity: 0.4, filter: 'grayscale(0.4)' }
    : { y: 0, scale: 1, opacity: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' };

  return (
    <motion.button
      type="button"
      aria-label={METHOD_FRONTS[method].title}
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      style={cardBoxStyle}
      animate={motionState}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      whileHover={interactive ? { y: -8, scale: 1.03 } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
    >
      <motion.div
        style={flipInnerStyle}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut', delay: flipped ? index * 0.05 : 0 }}
      >
        {/* back */}
        <div style={faceStyle}>
          <CelestialVeilBack />
        </div>
        {/* front (rotated 180 so it reads correctly when flipped) */}
        <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
          {visual === 'shrouded' ? <ShroudedFront /> : <MethodCardFront method={method} />}
        </div>
      </motion.div>
    </motion.button>
  );
}

// Unified card back — Celestial Veil: deep indigo, gold corner brackets,
// constellations filling the field, and the FateMark sigil at center.
function CelestialVeilBack() {
  const constellations = [
    [[14, 20], [22, 30], [18, 42], [30, 38]],
    [[70, 24], [78, 34], [68, 40]],
    [[16, 100], [26, 106], [20, 116], [32, 114]],
    [[66, 102], [74, 112], [64, 118]],
  ];
  return (
    <div style={backStyle}>
      <svg width="100%" height="100%" viewBox="0 0 88 132" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0 }}>
        <rect x="4" y="4" width="80" height="124" rx="8" fill="none" stroke="#d4a854" strokeWidth="0.7" opacity="0.4" />
        <g stroke="#d4a854" strokeWidth="1" opacity="0.7" fill="none">
          <path d="M9 9 h7 M9 9 v7" /><path d="M79 9 h-7 M79 9 v7" />
          <path d="M9 123 h7 M9 123 v-7" /><path d="M79 123 h-7 M79 123 v-7" />
        </g>
        {constellations.map((c, ci) => (
          <g key={ci}>
            {c.slice(1).map(([x, y], i) => (
              <line key={i} x1={c[i][0]} y1={c[i][1]} x2={x} y2={y} stroke="#5b7ec7" strokeWidth="0.4" opacity="0.5" />
            ))}
            {c.map(([x, y], i) => <circle key={`d${i}`} cx={x} cy={y} r="0.8" fill="#9fb6e0" opacity="0.9" />)}
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FateMark size={72} />
      </div>
    </div>
  );
}

// Shadow-veiled front — drifting purple mist, an intricate 12-tick eye, VEILED.
function ShroudedFront() {
  const uid = useId();
  return (
    <div style={shroudedStyle}>
      <svg width="100%" height="100%" viewBox="0 0 140 210" preserveAspectRatio="none" aria-hidden
        style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id={`${uid}-mist`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
          <radialGradient id={`${uid}-grad`} cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#2a1d40" stopOpacity="0.55" /><stop offset="100%" stopColor="#050308" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.g
          filter={`url(#${uid}-mist)`} opacity={0.7}
          animate={{ x: [0, 6, -4, 0], y: [0, -4, 3, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="44" cy="70" rx="40" ry="26" fill="#1c1230" />
          <ellipse cx="96" cy="120" rx="46" ry="30" fill="#140d24" />
          <ellipse cx="60" cy="160" rx="50" ry="24" fill="#1a1030" />
        </motion.g>
        <rect x="0" y="0" width="140" height="210" fill={`url(#${uid}-grad)`} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '38%', display: 'flex', justifyContent: 'center' }}>
        <VeiledEye />
      </div>
      <span style={veiledLabelStyle}>VEILED</span>
    </div>
  );
}

// The veiled eye — an almond with a 12-tick iris, in muted violet.
function VeiledEye() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180;
    const x1 = 37 + Math.cos(a) * 8.5, y1 = 24 + Math.sin(a) * 8.5;
    const x2 = 37 + Math.cos(a) * 11, y2 = 24 + Math.sin(a) * 11;
    return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} />;
  });
  return (
    <svg width="74" height="48" viewBox="0 0 74 48" aria-label="Veiled" style={{ opacity: 0.85 }}>
      <g stroke="#8a73b8" fill="none" strokeWidth="1.3" opacity="0.75">
        <path d="M4 24 C 18 4, 56 4, 70 24 C 56 44, 18 44, 4 24 Z" />
        <circle cx="37" cy="24" r="8.5" />
        {ticks}
      </g>
      <circle cx="37" cy="24" r="3.2" fill="#8a73b8" /><circle cx="37" cy="24" r="1.2" fill="#050308" />
    </svg>
  );
}

const cardBoxStyle: React.CSSProperties = {
  width: 'var(--card-w)', height: 'var(--card-h)', flex: '0 0 auto',
  padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
  perspective: '900px', borderRadius: '8px', outline: 'none',
};

const flipInnerStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
};

const faceStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '8px', overflow: 'hidden',
};

const backStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
  background: 'radial-gradient(120% 90% at 50% 32%, #1a1f3e 0%, #0a0d1c 80%)',
  border: '1px solid #2a3358', borderRadius: '8px', boxSizing: 'border-box',
};

const shroudedStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
  background: 'radial-gradient(120% 100% at 50% 45%, #160f24 0%, #050308 85%)',
  border: '1px solid #241c38', borderRadius: '8px', boxSizing: 'border-box',
};

const veiledLabelStyle: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: '16px', textAlign: 'center',
  fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: '0.6rem',
  letterSpacing: '0.3em', color: '#6a5d88',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/MethodCard.tsx
git commit -m "feat(ui): MethodCard with flip/back/shrouded/selection states"
```

---

## Task 6: `CardSpread` — horizontal scroll row

**Files:**
- Create: `src/components/cards/CardSpread.tsx`

**Interfaces:**
- Consumes: `MethodCard` + its prop types (Task 5).
- Produces: `CardSpread` with this contract (consumed by `MethodSelect`, Task 8):

```typescript
interface CardSpreadProps {
  methods: import('../../engine/types').DivinationType[];
  visualFor: (index: number) => MethodCardVisual;
  motionFor: (index: number) => MethodCardMotion;
  interactive: boolean;
  onPick: (index: number) => void;
}
```

- [ ] **Step 1: Create `src/components/cards/CardSpread.tsx`**

```tsx
import { useRef, useEffect } from 'react';
import MethodCard, { type MethodCardVisual, type MethodCardMotion } from './MethodCard';
import type { DivinationType } from '../../engine/types';

export interface CardSpreadProps {
  methods: DivinationType[];
  visualFor: (index: number) => MethodCardVisual;
  motionFor: (index: number) => MethodCardMotion;
  interactive: boolean;
  onPick: (index: number) => void;
}

export default function CardSpread({ methods, visualFor, motionFor, interactive, onPick }: CardSpreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // When the pool grows (Will widen), smooth-scroll to reveal the new card.
  const count = methods.length;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }
  }, [count]);

  return (
    <div ref={scrollRef} style={spreadStyle}>
      {methods.map((method, i) => (
        <MethodCard
          key={i}
          index={i}
          method={method}
          visual={visualFor(i)}
          motion={motionFor(i)}
          interactive={interactive}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  );
}

const spreadStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'safe center',
  gap: 'clamp(0.6rem, 2.5vw, 1.4rem)',
  width: '100%', maxWidth: '100%', padding: '2.2rem 1rem',
  overflowX: 'auto', overflowY: 'visible',
  scrollbarWidth: 'thin', scrollbarColor: '#2a3358 transparent',
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/components/cards/CardSpread.tsx
git commit -m "feat(ui): horizontal CardSpread container"
```

---

## Task 7: `WillSwapButton` — extracted swap control

**Files:**
- Create: `src/components/screens/WillSwapButton.tsx`

**Interfaces:**
- Produces: `WillSwapButton({ onSwap, disabled }: { onSwap: () => void; disabled?: boolean })`.

- [ ] **Step 1: Create `src/components/screens/WillSwapButton.tsx`**

```tsx
import { motion } from 'framer-motion';

export default function WillSwapButton({ onSwap, disabled = false }: { onSwap: () => void; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      style={{ ...swapStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}
      whileHover={disabled ? undefined : { borderColor: '#9b6bb0', scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onSwap}
      disabled={disabled}
    >
      ↺ Call for different methods
    </motion.button>
  );
}

const swapStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.8rem, 1.4vw, 0.9rem)', letterSpacing: '0.08em',
  color: '#c8a0d0', background: '#0d1220', border: '1px solid #9b6bb040',
  borderRadius: '6px', padding: '0.6rem 1.25rem', outline: 'none', marginTop: '0.25rem',
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/components/screens/WillSwapButton.tsx
git commit -m "feat(ui): extract WillSwapButton"
```

---

## Task 8: Rewrite `MethodSelect` — deal → flip → pick (Layer B)

**Files:**
- Modify (full rewrite): `src/components/screens/MethodSelect.tsx`

**Interfaces:**
- Consumes: `CardSpread` (6), `WillSwapButton` (7), engine `beginSelection`/`confirmSelection`/`swapMethod`, and `state.drawPhase` / `availableMethods` / `shroudedMethods`.
- Produces: the card-draw screen. This task implements deal → flip → ready → selecting (simple ascend, **no** effect banner and **no** Fate overlay yet; Fate-force resolves by ascending the redirected card). Effects/overlay are layered on in Tasks 10 & 12.

- [ ] **Step 1: Replace the entire contents of `src/components/screens/MethodSelect.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import CardSpread from '../cards/CardSpread';
import WillSwapButton from './WillSwapButton';
import type { MethodCardVisual, MethodCardMotion } from '../cards/MethodCard';

// Local lifecycle of one draw. Effects/overlay phases are wired in later tasks;
// Layer B runs dealing → flip → ready → selecting.
type Phase = 'dealing' | 'flip' | 'ready' | 'selecting';

const DEAL_MS = 650;

export default function MethodSelect() {
  const { state, engine } = useGameEngine();
  const nonce = state.drawPhase?.nonce ?? 0;
  const pending = state.drawPhase?.pendingSelection ?? null;

  const [phase, setPhase] = useState<Phase>('dealing');
  const confirmedRef = useRef(false);

  // (Re)start the deal sequence whenever a fresh pool is dealt (turn start / swap).
  useEffect(() => {
    confirmedRef.current = false;
    setPhase('dealing');
    const t = setTimeout(() => setPhase('flip'), DEAL_MS);
    const t2 = setTimeout(() => setPhase('ready'), DEAL_MS + 450);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [nonce]);

  // When a selection is staged, ascend the chosen card, then confirm.
  useEffect(() => {
    if (!pending) return;
    setPhase('selecting');
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    const t = setTimeout(() => engine.confirmSelection(), 600);
    return () => clearTimeout(t);
  }, [pending, engine]);

  const visualFor = (i: number): MethodCardVisual => {
    if (phase === 'dealing') return 'face-down';
    return state.shroudedMethods.includes(i) ? 'shrouded' : 'face-up';
  };

  const motionFor = (i: number): MethodCardMotion => {
    if (!pending) return 'idle';
    if (i === pending.finalIndex) return pending.wasForced ? 'fated' : 'selected';
    if (i === pending.chosenIndex && pending.wasForced) return 'rejected';
    return 'idle';
  };

  const interactive = phase === 'ready';

  return (
    <motion.div style={containerStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div style={contentStyle}>
        <h1 style={headingStyle}>Choose your divination</h1>
        <p style={subtitleStyle}>
          {state.minigamesCompleted > 0
            ? `Reading ${state.minigamesCompleted + 1} of 3 — draw your next method`
            : 'The stars deal their cards — draw one to reveal your fate'}
        </p>
        <div style={turnProgressStyle}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{
              ...progressDotStyle,
              background: i < state.minigamesCompleted ? '#d4a854' : '#1a2440',
              boxShadow: i < state.minigamesCompleted ? '0 0 6px rgba(212,168,84,0.4)' : 'none',
            }} />
          ))}
        </div>
        <div style={goldRuleStyle} />

        <CardSpread
          methods={state.availableMethods}
          visualFor={visualFor}
          motionFor={motionFor}
          interactive={interactive}
          onPick={(i) => engine.beginSelection(i)}
        />

        {state.affinityEffects.spreadRedraws >= 1 && (
          <WillSwapButton onSwap={() => engine.swapMethod()} disabled={!interactive} />
        )}
      </div>
    </motion.div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'min(760px, 96vw)', padding: '1.5rem 0.5rem',
  // Card sizing custom properties consumed by MethodCard.
  ['--card-w' as string]: 'clamp(86px, 22vw, 120px)',
  ['--card-h' as string]: 'calc(var(--card-w) * 1.5)',
};

const contentStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem',
};

const headingStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', color: '#c8d8f0', letterSpacing: '0.12em', margin: 0, textAlign: 'center',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)', color: '#7b9ec7', letterSpacing: '0.05em', margin: 0, textAlign: 'center',
};

const goldRuleStyle: React.CSSProperties = {
  width: '40px', height: '2px', background: 'linear-gradient(90deg, transparent, #d4a854, transparent)',
};

const turnProgressStyle: React.CSSProperties = { display: 'flex', gap: '10px' };

const progressDotStyle: React.CSSProperties = {
  width: '10px', height: '10px', borderRadius: '50%',
  transition: 'background 0.4s ease, box-shadow 0.4s ease',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS (no unused symbols; old style constants removed with the rewrite).

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open http://localhost:5173, pick any question. Confirm: three cards deal in face-down, flip face-up, hover lifts a card, clicking ascends it and transitions to the minigame.

Then exercise affinity paths via the debug panel (append `?debug` to the URL → Scenarios):
- **"Shadow shrouds an option"** — at least one card flips to the VEILED front; you can still pick it.
- **"Fate forces the method"** — clicking one card ends up launching a *different* method (the redirected card ascends with the gold "fated" glow; no overlay yet — that's Task 12).
- **"Will widens the pool"** — four cards present (scroll if needed).

- [ ] **Step 4: Build + commit**

Run: `npm run build`
Expected: PASS (tsc + vite bundle).

```bash
git add src/components/screens/MethodSelect.tsx
git commit -m "feat(ui): card-draw MethodSelect (deal/flip/pick)"
```

> **Layer B complete** — the card-draw screen replaces the tile list and is fully playable. Mergeable.

---

## Task 9: `EventBanner` — auto-fading message line

**Files:**
- Create: `src/components/overlays/EventBanner.tsx`

**Interfaces:**
- Produces: `EventBanner({ message }: { message: BannerMessage | null })` where

```typescript
export interface BannerMessage {
  text: string;
  affinity?: 'will' | 'fate' | 'shadow' | 'light' | 'chaos' | 'order';
}
```

It renders nothing when `message` is null; otherwise fades a tinted label in at top-center. Sequencing/timing is owned by the caller (`MethodSelect`), keeping this purely presentational (no engine `bannerQueue`).

- [ ] **Step 1: Create `src/components/overlays/EventBanner.tsx`**

```tsx
import { AnimatePresence, motion } from 'framer-motion';

export interface BannerMessage {
  text: string;
  affinity?: 'will' | 'fate' | 'shadow' | 'light' | 'chaos' | 'order';
}

const AFFINITY_COLOR: Record<NonNullable<BannerMessage['affinity']>, string> = {
  will: '#5b8c5a', fate: '#d4a854', shadow: '#9b6bb0',
  light: '#e6d8a8', chaos: '#c75b4a', order: '#5b7ec7',
};

export default function EventBanner({ message }: { message: BannerMessage | null }) {
  const color = message?.affinity ? AFFINITY_COLOR[message.affinity] : '#d4a854';
  return (
    <div style={anchorStyle}>
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message.text}
            style={{ ...bannerStyle, borderColor: color + '66', color }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const anchorStyle: React.CSSProperties = {
  position: 'absolute', top: '18px', left: 0, right: 0,
  display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 14,
};

const bannerStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 500,
  fontSize: 'clamp(0.85rem, 2vw, 1.05rem)', letterSpacing: '0.04em', textAlign: 'center',
  background: 'rgba(13,18,32,0.92)', border: '1px solid', borderRadius: '6px',
  padding: '0.5rem 1.25rem', maxWidth: 'min(440px, 90vw)',
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/components/overlays/EventBanner.tsx
git commit -m "feat(ui): EventBanner presentational message line"
```

---

## Task 10: Effect sequence — banner + in-spread widen/thin/shroud (Layer C)

**Files:**
- Modify: `src/components/screens/MethodSelect.tsx`

**Interfaces:**
- Consumes: `EventBanner`/`BannerMessage` (9), `state.drawPhase.effectReports`.
- Produces: between `dealing` and `flip`, MethodSelect auto-sequences each effect report — showing the banner and tinting the affected card — before flipping.

The effect reports use `EffectReport.label` ∈ {`"Will"`,`"Fate"`,`"Shadow"`} and `animation` ∈ {`"widen"`,`"thin"`,`"shroud"`}, with `targetSlot` the affected index (see `src/engine/responders/affinity.ts`). We drive the banner from these; the in-spread emphasis is a tint/scale pulse on `targetSlot` (no separate animation component needed — the card itself reacts).

- [ ] **Step 1: Add the effects phase to the lifecycle**

In `MethodSelect.tsx`, update the `Phase` type and imports:

```tsx
import EventBanner, { type BannerMessage } from '../overlays/EventBanner';
```

```tsx
type Phase = 'dealing' | 'effects' | 'flip' | 'ready' | 'selecting';
```

- [ ] **Step 2: Replace the deal `useEffect` with a deal → effects → flip sequencer**

Replace the first lifecycle `useEffect` (the one keyed on `[nonce]`) with:

```tsx
  const reports = state.drawPhase?.effectReports ?? [];
  const [effectIndex, setEffectIndex] = useState(-1); // -1 = no active effect

  // Deal, then auto-play each draw effect, then flip.
  useEffect(() => {
    confirmedRef.current = false;
    setEffectIndex(-1);
    setPhase('dealing');
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      if (reports.length === 0) {
        setPhase('flip');
        timers.push(setTimeout(() => setPhase('ready'), 450));
      } else {
        setPhase('effects');
        setEffectIndex(0);
      }
    }, DEAL_MS));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Advance through effects, one per EFFECT_MS, then flip.
  useEffect(() => {
    if (phase !== 'effects') return;
    if (effectIndex < 0) return;
    if (effectIndex >= reports.length) {
      setPhase('flip');
      const t = setTimeout(() => setPhase('ready'), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setEffectIndex((n) => n + 1), EFFECT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, effectIndex]);
```

Add the constant near `DEAL_MS`:

```tsx
const EFFECT_MS = 1300;
```

- [ ] **Step 3: Derive the active banner message and target tint**

Add above the `return`:

```tsx
  const activeReport = phase === 'effects' && effectIndex >= 0 && effectIndex < reports.length
    ? reports[effectIndex] : null;

  const bannerMessage: BannerMessage | null = activeReport
    ? { text: activeReport.description, affinity: labelToAffinity(activeReport.label) }
    : null;

  const effectTarget = activeReport?.targetSlot ?? null;
```

And add this helper at module scope (below the component):

```tsx
function labelToAffinity(label: string): BannerMessage['affinity'] {
  const k = label.toLowerCase();
  if (k === 'will' || k === 'fate' || k === 'shadow' || k === 'light' || k === 'chaos' || k === 'order') {
    return k as BannerMessage['affinity'];
  }
  return undefined;
}
```

- [ ] **Step 4: Reflect effect targeting in `visualFor`/`motionFor` and render the banner**

Update `visualFor` so shrouds reveal progressively during the effects phase (a card becomes `shrouded` once its shroud effect has played), and keep everything face-down until flip otherwise:

```tsx
  const visualFor = (i: number): MethodCardVisual => {
    if (phase === 'dealing' || phase === 'effects') {
      // During effects the spread is still face-down; a shroud lands as the veil.
      return state.shroudedMethods.includes(i) && hasShroudPlayed(i) ? 'shrouded' : 'face-down';
    }
    return state.shroudedMethods.includes(i) ? 'shrouded' : 'face-up';
  };
```

Add the helper inside the component (it checks whether a shroud report targeting `i` has already been sequenced):

```tsx
  const hasShroudPlayed = (i: number): boolean => {
    if (phase !== 'effects') return phase === 'flip' || phase === 'ready' || phase === 'selecting';
    for (let r = 0; r <= effectIndex && r < reports.length; r++) {
      if (reports[r].animation === 'shroud' && reports[r].targetSlot === i) return true;
    }
    return false;
  };
```

Add an emphasis pulse for the currently-targeted card by extending `motionFor`’s idle branch:

```tsx
  const motionFor = (i: number): MethodCardMotion => {
    if (pending) {
      if (i === pending.finalIndex) return pending.wasForced ? 'fated' : 'selected';
      if (i === pending.chosenIndex && pending.wasForced) return 'rejected';
      return 'idle';
    }
    if (effectTarget === i) return 'selected'; // brief emphasis as the effect plays
    return 'idle';
  };
```

Finally, render the banner inside the root `motion.div` (first child, before `contentStyle` div):

```tsx
      <EventBanner message={bannerMessage} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: PASS. (Remove the now-unused simple deal effect if any leftover; ensure `useState` is imported — it already is.)

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, `?debug` → Scenarios:
- **"Will widens the pool"** — banner reads *"Your will widens the path…"* in green, a 4th card is present, then all flip.
- **"Fate thins the pool"** — banner *"Fate narrows the way…"* in gold.
- **"Shadow shrouds an option"** — banner *"Shadow falls across a path…"* in purple, the targeted card lands as the veil.
- **"Combo: widen + shroud"** — both banners play in sequence, then flip.
- No-effect turn (normal question start, baseline affinities) — deals straight to flip, **no** banner.

- [ ] **Step 7: Build + commit**

Run: `npm run build` → PASS.

```bash
git add src/components/screens/MethodSelect.tsx
git commit -m "feat(ui): sequence draw effects with EventBanner in the spread"
```

> **Layer C complete** — Will/Fate/Shadow draw effects animate with the banner. Mergeable.

---

## Task 11: `FateForceOverlay` — freeze + hand-of-fate

**Files:**
- Create: `src/components/overlays/FateForceOverlay.tsx`

**Interfaces:**
- Produces: `FateForceOverlay({ text }: { text: string })` — a full-viewport freeze (blurred scrim) with centered gold text and a spectral hand SVG descending then withdrawing. Purely presentational; the caller mounts/unmounts it for the duration.

- [ ] **Step 1: Create `src/components/overlays/FateForceOverlay.tsx`**

```tsx
import { motion } from 'framer-motion';

export default function FateForceOverlay({ text }: { text: string }) {
  return (
    <motion.div
      style={overlayStyle}
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(2px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div style={scrimStyle} />
      <motion.div
        style={textStyle}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {text}
      </motion.div>

      {/* Spectral hand descends from the top, slams down, withdraws. */}
      <motion.div
        style={handStyle}
        initial={{ y: '-60%', opacity: 0 }}
        animate={{ y: ['-60%', '8%', '8%', '-60%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.8, times: [0, 0.4, 0.7, 1], ease: 'easeInOut' }}
      >
        <svg width="120" height="150" viewBox="0 0 120 150" aria-hidden style={{ display: 'block' }}>
          <g fill="none" stroke="#d4a854" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             style={{ filter: 'drop-shadow(0 0 8px rgba(212,168,84,0.7))' }}>
            {/* palm */}
            <path d="M40 120 Q34 86 42 70 L46 96 Q48 60 56 56 L58 92 Q62 54 70 54 L70 92 Q76 58 82 64 L80 100 Q92 92 92 108 Q92 132 72 140 L52 140 Q42 136 40 120 Z" fill="rgba(212,168,84,0.12)" />
          </g>
        </svg>
      </motion.div>
    </motion.div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 25,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  pointerEvents: 'auto', overflow: 'hidden',
};

const scrimStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(3,5,12,0.55)', pointerEvents: 'none',
};

const textStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 600,
  fontSize: 'clamp(1.1rem, 3.4vw, 1.7rem)', color: '#d4a854', letterSpacing: '0.06em',
  textAlign: 'center', textShadow: '0 0 14px rgba(212,168,84,0.5)', maxWidth: '80vw',
};

const handStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1, pointerEvents: 'none',
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → PASS.

```bash
git add src/components/overlays/FateForceOverlay.tsx
git commit -m "feat(ui): FateForceOverlay freeze + hand-of-fate"
```

---

## Task 12: Wire Fate-force overlay + shrouded reveal into selection (Layer D)

**Files:**
- Modify: `src/components/screens/MethodSelect.tsx`

**Interfaces:**
- Consumes: `FateForceOverlay` (11), `pending.wasForced`, `pending.shrouded`, `pending.forceReport`.
- Produces: on a forced pick the overlay plays before transition; on a shrouded pick the veil lifts (the card flips to its real front) before transition. Timings extend the confirm delay accordingly.

- [ ] **Step 1: Import the overlay and add overlay/reveal state**

```tsx
import FateForceOverlay from '../overlays/FateForceOverlay';
```

Add state in the component:

```tsx
  const [showFateOverlay, setShowFateOverlay] = useState(false);
  const [revealShrouded, setRevealShrouded] = useState(false);
```

- [ ] **Step 2: Replace the selection `useEffect` with the dramatic sequence**

Replace the `useEffect` keyed on `[pending, engine]` with:

```tsx
  useEffect(() => {
    if (!pending) { setShowFateOverlay(false); setRevealShrouded(false); return; }
    setPhase('selecting');
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;

    // Chosen card ascends (always). Fate force: freeze + hand, reject + re-rise.
    if (pending.wasForced) {
      timers.push(setTimeout(() => setShowFateOverlay(true), (t += 450)));
      t += 2000; // overlay duration
      timers.push(setTimeout(() => setShowFateOverlay(false), t));
    } else {
      t += 600; // simple ascend
    }

    // Shrouded reveal: flip the veil to the real front before leaving.
    if (pending.shrouded) {
      timers.push(setTimeout(() => setRevealShrouded(true), t));
      t += 650;
    }

    timers.push(setTimeout(() => engine.confirmSelection(), t));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, engine]);
```

- [ ] **Step 3: Make the selected/fated card reveal its real front when `revealShrouded`**

Update `visualFor`’s final branch so the picked shrouded card un-veils:

```tsx
    // (ready/selecting branch)
    if (state.shroudedMethods.includes(i)) {
      const isPicked = pending && (i === pending.finalIndex);
      return isPicked && revealShrouded ? 'face-up' : 'shrouded';
    }
    return 'face-up';
```

- [ ] **Step 4: Render the overlay**

Inside the root `motion.div`, after `<EventBanner .../>`, add:

```tsx
      {showFateOverlay && (
        <FateForceOverlay text={pending?.forceReport?.description ?? 'Fate has marked another path.'} />
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, `?debug` → Scenarios:
- **"Fate forces the method"** — click a card: it ascends, the screen freezes/blurs, the gold hand descends and slams, the rejected card dims, the redirected card rises with the gold glow, then the minigame opens.
- **"Shadow shrouds an option"** — pick the veiled card: the veil lifts to the real front before the minigame opens.
- Normal pick — unchanged quick ascend.

- [ ] **Step 7: Build + commit**

Run: `npm run build` → PASS.

```bash
git add src/components/screens/MethodSelect.tsx
git commit -m "feat(ui): Fate-force overlay + shrouded reveal on selection"
```

---

## Task 13: Responsive sizing, edge cases & polish

**Files:**
- Modify: `src/components/screens/MethodSelect.tsx`
- Modify: `src/components/cards/CardSpread.tsx` (mobile scaling only if needed)

**Interfaces:** none new.

- [ ] **Step 1: Mobile card-size custom properties**

In `MethodSelect.tsx` `containerStyle`, the `--card-w` clamp already scales (`clamp(86px, 22vw, 120px)`). Add a narrow-viewport floor so 3 cards stay visible at ≤480px by reducing the spread gap. In `CardSpread.tsx` `spreadStyle`, change `gap` to:

```tsx
  gap: 'clamp(0.45rem, 2.2vw, 1.4rem)',
```

- [ ] **Step 2: Edge case — pool of 1 (Fate thinned to one)**

No code change required: a single-element `availableMethods` renders one card, `interactive` once `ready`, and the player must click it (it is never auto-selected). Verify under the **"Fate thins the pool"** scenario repeated until pool size 1, or via the debug JSON injector setting `availableMethods` to a single method (see memory: repro via `?debug` + JsonInjector + `engine.loadState`). Confirm the lone card deals, flips, and is pickable.

- [ ] **Step 3: Edge case — all shrouded**

Set affinities so Shadow is Dominant (debug: `loadState({ affinities: { ..., shadow: 95 } })`, then `startTurn`) or force `shadow-shroud` repeatedly. Confirm all cards flip to the veil, any pick triggers the reveal, and the minigame opens. No special handling needed — `visualFor` already covers it.

- [ ] **Step 4: Edge case — fast clicking**

Confirm `interactive` is only true in `phase === 'ready'`; once a card is picked, `beginSelection` sets `pending` → phase `selecting` → `interactive` false, so further clicks are ignored. Also confirm `GameTable` sets `pointer-events: none` only while `eventQueue.length > 0` — which stays empty during the draw phase (effects are diverted) so the spread remains interactive. No code change; verify by rapid double-click on a card → only one selection resolves.

- [ ] **Step 5: Build + full manual pass**

Run: `npm run build` → PASS.
Run: `npm run dev` and play one full 3-reading turn (no debug) to confirm the deal→pick loop works across all three method selections and that returning from a minigame re-deals (`nonce` bump → fresh deal animation).

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/MethodSelect.tsx src/components/cards/CardSpread.tsx
git commit -m "polish(ui): responsive card-draw sizing + edge cases"
```

> **Layer D complete** — full spec behaviour. Mergeable.

---

## Task 14: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-06-25-card-draw-selection-design.md`
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Flip the spec status**

In the design spec header, change:

```markdown
**Status:** Design approved, pending implementation plan
```

to:

```markdown
**Status:** Implemented (plan: docs/superpowers/plans/2026-06-26-card-draw-selection.md)
```

- [ ] **Step 2: Update the README method-selection description**

In `README.md`, locate the gameplay-flow description of method selection (the "pick one of three methods" text) and update it to describe the card-draw mechanic: cards are dealt face-down, affinity effects (Will widen / Fate thin / Shadow shroud) animate with a banner, cards flip, the player draws one, and Fate may force a different card. (Match the README's existing tone; one short paragraph.)

- [ ] **Step 3: Confirm `docs/game-systems.md` needs no change**

This feature changed only presentation — no affinity math, responders, reducers, or happenings. `docs/game-systems.md` stays as-is. (No edit; this step is a verification.)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-25-card-draw-selection-design.md README.md
git commit -m "docs: mark card-draw selection implemented; update README"
```

---

## Self-Review

**Spec coverage:**
- Card form factor / back / fronts / shrouded fronts → Tasks 4–5 (`MethodCardFront`, `CelestialVeilBack`, `ShroudedFront`). ✓
- **Brand identity (user-added, beyond the card-draw spec):** `FateMark` sigil, favicon, and `Wordmark` on the title screen → Tasks 3A–3C. Approved design tweaks folded in: card back v2 uses `FateMark` + constellations, veil v2 is animated misty, rune emblem uses the smaller stave. ✓
- Horizontal scroll layout + swap button below → Tasks 6–7. ✓
- Framer Motion only → all components use `framer-motion`. ✓
- Sequential auto-resolving effects + EventBanner → Tasks 9–10. ✓
- Deal / effects / flip / selection / fate-force / shrouded-reveal timeline → Tasks 8, 10, 12. ✓
- Engine integration (pool effects, fate-force, selection) → Tasks 1–3 (adapted: `drawPhase` + `beginSelection`/`confirmSelection` instead of `initiateDrawPhase`/`bannerQueue`; documented in Architecture). ✓
- Edge cases (pool 1, pool >5 scroll, all-shrouded, swap reset, no-effects, fast-click, mobile, debug forcing) → Task 13 + existing debug scenarios. ✓
- Open questions: card dims as CSS custom props (Task 8); hand SVG inline (Task 11); uniform banner timing `EFFECT_MS` (Task 10); animated scroll to new card (Task 6); hover micro-lift + full ascend on selected only (Task 5). ✓

**Deliberate deviations from the spec (all to fit the existing engine):**
1. No `initiateDrawPhase()` — the pool is already built by `buildPool` at `startTurn`/`advanceAfterCommit`/`resolveHappening`; we expose its reports via `state.drawPhase` instead of re-deriving on mount.
2. No engine `bannerQueue`/`pushBannerMessage` — `EventBanner` is presentational and driven by `MethodSelect`; the only consumer is the draw phase (YAGNI).
3. `selectMethod` keeps its synchronous contract (tests depend on it); the animated path uses `beginSelection`/`confirmSelection`.
4. In-spread effects reuse the card's own motion states (tint/scale pulse + veil) rather than five new generic animation components; the pre-existing `WidenAnimation`/`ThinAnimation`/`ShroudAnimation` overlays are left intact (now unused by the draw phase, still available to the InteractionSequencer for any non-draw triggers).

**Type consistency:** `DrawPhase`/`PendingSelection` defined in Task 1 are used verbatim in Tasks 2–3 and read in Tasks 8/10/12. `MethodCardVisual`/`MethodCardMotion` exported from `MethodCard` (Task 5) and imported by `CardSpread` (6) and `MethodSelect` (8). `BannerMessage` exported from `EventBanner` (9), imported in Task 10. `METHOD_FRONTS` shape consistent across Tasks 4 readers.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; engine steps carry real Vitest tests with explicit pass/fail expectations; component steps gate on `tsc`/`build` + named debug-scenario manual checks (Vitest is engine-only by config).
