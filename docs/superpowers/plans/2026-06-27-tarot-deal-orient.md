# Tarot Deal & Orient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dead `tarot:deal` and `tarot:orient` affinity effects into the live tarot reveal so they actually fire, with a Fate orientation preempt (god-hand), a burn-reveal for deal-swap, and Chaos/Order post-modifiers — all narrated inline in `TarotMinigame`.

**Architecture:** Game logic stays in `src/engine/**` (no React/DOM). The reveal becomes a two-step the component drives — `planReveal()` (Fate orientation preempt, runs before the buttons) then `commitDraft(reverse)` (deal-swap → consolidate → orientation → Chaos/Order post-modify → `completeMinigame`). `commitDraft` records what happened on the draft (`revealSwap`/`revealWildCard`/`revealOrderAnchored`); `TarotMinigame` reads those markers and animates the affected hand slot(s) inline during the `committing` phase — mirroring how `DiceMinigame` consumes `planDiceRoll`. The deal/orient/preempt reports are kept in `turnEffects` (run record) but stripped from `eventQueue` so the sequencer never plays them; the post-commit `tarot:commit` fan effects use the sequencer unchanged.

**Tech Stack:** React 18, TypeScript (strict), Vite, framer-motion. No new dependencies. Burn uses a CSS/SVG mask.

## Global Constraints

- **Engine purity:** no React/DOM imports in `src/engine/**`. UI reads engine results and renders.
- **No new dependencies.**
- **The gate after every task:** `npx tsc -b` clean and `npm test` green. The suite is 518 tests today; tasks that change engine behavior update the affected tests so the count stays whole and green. There is no component-test harness — UI tasks are verified by `npm run build` + the headless Playwright probe recipe below (read the screenshot), not assertions.
- **Resolve-first, narrate-second:** engine rolls happen at commit; the component narrates from recorded markers. Deal/orient/preempt reports stay in `turnEffects` but are **stripped from `eventQueue`** (mirror `runHexagramTransform` / `GameEngine.ts`), so they never reach `InteractionSequencer`.
- **Odds targets (tunable, but implement these):** `fate-deal-swap` base `rare = 0.04` (one roll at reveal); `fate-fated-card` per-pick `0.014` (still one per draft); combined ≈ `fate-force-method` (~8%). `fate-auto-orient` gate raised to `ascendant`, base `major` (0.08).
- **Keep `commitDraft(reverse: boolean)`'s signature** — the component already calls `commitDraft(false)`/`commitDraft(true)`; the Fate preempt just passes `orientation === 'reversed'`.
- **Docs to keep in sync (CLAUDE.md):** `docs/game-systems.md` (responder tables + agency narrative) and the README tarot flow — updated in Task 8.
- **Commit after every task** with the message in its final step.

## Verification recipe (UI tasks)

1. `npx tsc -b` clean; `npm test` green.
2. `npm run dev` (note the port; base path `/fate-atlas/`). Create a throwaway `_probe.mjs` in the repo root:

```js
import { chromium } from 'playwright';
const URL = 'http://localhost:5173/fate-atlas/?debug'; // adjust port
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__engine, null, { timeout: 10000 });
// Each UI task's step says exactly what to loadState/loadScenarioById here.
await p.waitForTimeout(1200);
await p.screenshot({ path: 'probe.png' });
await b.close();
```

3. Read `probe.png`. Delete `_probe.mjs` + `probe.png` before committing.

---

## Task 1: Retune the Fate card-substitution odds + add the `rare` tier

**Files:**
- Modify: `src/data/affinities.ts` (`TIER_BASE_CHANCE`)
- Modify: `src/engine/responders/affinity.ts` (`fate-fated-card` roll)
- Test: `src/engine/__tests__/AffinityResponders.test.ts`

**Interfaces:**
- Produces: `TIER_BASE_CHANCE.rare = 0.04`, consumed by Task 3's `fate-deal-swap`. `fate-fated-card` per-pick base lowered to `0.014`.

- [ ] **Step 1: Add the `rare` tier.** In `src/data/affinities.ts`, change:

```ts
export const TIER_BASE_CHANCE = { ambient: 0.5, notable: 0.22, rare: 0.04, major: 0.08 } as const;
```

- [ ] **Step 2: Write the failing test.** In `src/engine/__tests__/AffinityResponders.test.ts`, add (use the file's existing `ctx`/`dispatch` helpers — match their import style at the top of that file):

```ts
import { buildAffinityResponders } from '../responders/affinity';

describe('fate-fated-card per-pick odds', () => {
  it('does not fire when rng is above the lowered per-pick base (0.014) at ascendant Fate', () => {
    const responder = buildAffinityResponders().find((r) => r.id === 'fate-fated-card')!;
    const ctx = {
      trigger: 'tarot:picked', affinities: { fate: 80, chaos: 50, order: 50, will: 50, light: 50, shadow: 50 },
      slots: [], hand: null, spread: [], minigame: null, event: {},
      draft: { handIndex: 0, tableIndex: 0 }, rng: () => 0.02,
    } as any;
    expect(responder.roll(ctx)).toBe(false); // 0.02 > 0.014 → no fire
  });
});
```

- [ ] **Step 3: Run it; confirm it FAILS** (current base is `notable` 0.22, so `0.02 < 0.22` → roll returns true).

Run: `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "per-pick odds"`
Expected: FAIL (`expected true to be false`).

- [ ] **Step 4: Lower the `fate-fated-card` roll.** In `src/engine/responders/affinity.ts`, find the `fate-fated-card` responder and change its `roll`:

```ts
      roll: (c) => bandRoll(c, 'fate', 'ascendant', 0.014),
```

- [ ] **Step 5: Run the test; confirm PASS.**

Run: `npx vitest run src/engine/__tests__/AffinityResponders.test.ts -t "per-pick odds"`
Expected: PASS.

- [ ] **Step 6: Full gate.** `npx tsc -b` clean; `npm test` green (fix any existing AffinityResponders odds assertion that hard-codes the old fated-card rate).

- [ ] **Step 7: Commit.**

```bash
git add src/data/affinities.ts src/engine/responders/affinity.ts src/engine/__tests__/AffinityResponders.test.ts
git commit -m "feat(tarot): add rare tier; lower fate-fated-card per-pick odds"
```

---

## Task 2: Move `fate-auto-orient` to a `tarot:reveal` preempt + add `planReveal()`

**Files:**
- Modify: `src/engine/responders/affinity.ts` (`fate-auto-orient`)
- Modify: `src/engine/GameEngine.ts` (add `planReveal()`, near `planDiceRoll` ~line 644)
- Test: `src/engine/__tests__/AgencyDecisions.test.ts`

**Interfaces:**
- Produces: `GameEngine.planReveal(): { preempt: boolean; orientation: 'upright' | 'reversed' | null }`. Consumed by Task 5 (`TarotMinigame`). `fate-auto-orient` now triggers on `tarot:reveal` and sets `draft.fateOrientation`.

- [ ] **Step 1: Rewire `fate-auto-orient`.** In `src/engine/responders/affinity.ts`, replace the whole `fate-auto-orient` responder with:

```ts
    {
      id: 'fate-auto-orient', source: 'affinity', triggers: ['tarot:reveal'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: () => true,
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        // Fate seizes the orientation choice. Narrated by the god-hand overlay
        // (component-driven), so this emits no sequencer report.
        c.draft.fateOrientation = c.rng() < 0.5 ? 'reversed' : 'upright';
        return null;
      },
    },
```

- [ ] **Step 2: Add the failing test.** In `src/engine/__tests__/AgencyDecisions.test.ts`, replace the `describe('orientation', ...)` block's first test with:

```ts
  it('planReveal preempts and returns an orientation when fate-auto-orient is forced', () => {
    const e = new GameEngine();
    startMinigame(e);
    e.forceEffects(['fate-auto-orient'], false);
    const { preempt, orientation } = e.planReveal();
    expect(preempt).toBe(true);
    expect(orientation === 'upright' || orientation === 'reversed').toBe(true);
  });

  it('planReveal does not preempt at baseline Fate', () => {
    const e = new GameEngine();
    startMinigame(e);
    const orig = Math.random; Math.random = () => 0.99; // below any gate
    const { preempt, orientation } = e.planReveal();
    Math.random = orig;
    expect(preempt).toBe(false);
    expect(orientation).toBeNull();
  });
```

- [ ] **Step 3: Run; confirm it FAILS** (`planReveal` does not exist yet).

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "planReveal"`
Expected: FAIL (`planReveal is not a function`).

- [ ] **Step 4: Add `planReveal()`.** In `src/engine/GameEngine.ts`, just above `planDiceRoll()`, add:

```ts
  // Fate may seize the spread-wide orientation before the player chooses. Rolled
  // pre-commit so TarotMinigame can suppress the Reveal/Invert buttons and play
  // the god-hand. Returns the decided orientation, or null when the player keeps
  // the choice. fate-auto-orient emits no report, so nothing reaches the queue.
  planReveal(): { preempt: boolean; orientation: 'upright' | 'reversed' | null } {
    const { draft } = this.dispatchAt('tarot:reveal', {});
    this.notify();
    const orientation = (draft.fateOrientation as 'upright' | 'reversed' | undefined) ?? null;
    return { preempt: orientation !== null, orientation };
  }
```

- [ ] **Step 5: Run the tests; confirm PASS.**

Run: `npx vitest run src/engine/__tests__/AgencyDecisions.test.ts -t "planReveal"`
Expected: PASS (both).

- [ ] **Step 6: Full gate.** `npx tsc -b`; `npm test`. Update the old `resolveSpreadOrientation auto-sets` test if it still references `tarot:orient` for auto-orient — that path moves to Task 4; for now, if that test fails, leave it failing only if Task 4 will fix it, otherwise delete it here and note it. (It is removed in Task 4.)

> If `resolveSpreadOrientation auto-sets when fate-auto-orient is forced` now fails because auto-orient left `tarot:orient`, delete that single test here and add the note "moved to planReveal (Task 2)". Task 4 removes the method itself.

- [ ] **Step 7: Commit.**

```bash
git add src/engine/responders/affinity.ts src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "feat(tarot): fate-auto-orient preempts via planReveal (tarot:reveal)"
```

---

## Task 3: `commitDraft` pipeline — deal-swap + Chaos/Order post-modify + reveal markers

**Files:**
- Modify: `src/engine/types.ts` (`TarotDraftState` reveal markers)
- Modify: `src/engine/responders/affinity.ts` (`fate-deal-swap`, `order-anchor`)
- Modify: `src/engine/responders/affinity.ts` (`chaos-wild-card`)
- Modify: `src/engine/GameEngine.ts` (`commitDraft`, ~line 1129)
- Test: `src/engine/__tests__/Tarot.test.ts`

**Interfaces:**
- Consumes: `TIER_BASE_CHANCE.rare` (Task 1).
- Produces: after `commitDraft`, `(state.minigameState as TarotDraftState)` carries `revealSwap?: { index: number; fromCardId: string }`, `revealWildCard?: number`, `revealOrderAnchored?: boolean`. Consumed by Tasks 6–7.

- [ ] **Step 1: Add the reveal-marker fields.** In `src/engine/types.ts`, extend `TarotDraftState`:

```ts
export interface TarotDraftState {
  method: 'tarot';
  deck: string[];
  table: (TableCard | null)[];
  hand: [HandSlot, HandSlot, HandSlot];
  dealCount: number;
  shufflesRemaining: number;
  phase: 'drafting' | 'committing';
  fatedDrawnThisDraft?: boolean;
  // Reveal-time markers recorded by commitDraft for the inline reveal animations.
  revealSwap?: { index: number; fromCardId: string }; // fate-deal-swap
  revealWildCard?: number;                              // chaos-wild-card (flipped slot)
  revealOrderAnchored?: boolean;                        // order-anchor (straightened all)
}
```

- [ ] **Step 2: Rewire `fate-deal-swap`** (guard against fated faces + record markers + `rare` odds). In `src/engine/responders/affinity.ts`, replace the `fate-deal-swap` responder with:

```ts
    {
      id: 'fate-deal-swap', source: 'affinity', triggers: ['tarot:deal'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) =>
        Array.isArray(c.draft.faces) && (c.draft.faces as unknown[]).length >= 1
        && Array.isArray(c.draft.fated) && (c.draft.fated as boolean[]).some((f) => !f),
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.rare),
      apply: (c) => {
        const faces = c.draft.faces as unknown as TarotCardFace[];
        const fated = c.draft.fated as boolean[];
        const candidates = faces.map((_, i) => i).filter((i) => !fated[i]);
        const idx = candidates[Math.floor(c.rng() * candidates.length)];
        const used = new Set(faces.map((f) => f.id));
        const replacement = drawTarotCard(c.affinities).spread![0].card;
        if (used.has(replacement.id)) return null;
        c.draft.swapFromCardId = faces[idx].id;
        faces[idx] = replacement;
        c.draft.faces = faces as unknown as typeof c.draft.faces;
        c.draft.swappedIndex = idx;
        return report('fate-deal-swap', 'Fate', 'The weave deals you another — a card changes before it turns.', 'override');
      },
    },
```

- [ ] **Step 3: Record the Chaos/Order markers.** In `src/engine/responders/affinity.ts`, in `chaos-wild-card.apply`, add `c.draft.wildCardIndex = i;` immediately before its `return report(...)`. In `order-anchor.apply`, add `c.draft.orderAnchored = true;` immediately before its `return report(...)`. (Leave their triggers `['tarot:orient']`, bands, and rolls unchanged.)

- [ ] **Step 4: Write the failing test.** In `src/engine/__tests__/Tarot.test.ts`, add (match the file's existing engine-setup helpers; if it lacks a "fill a tarot hand then commit" helper, write one inline using `engine.loadScenarioById` is NOT enough — use the real draft API: `startTurn` → `selectMethod` the tarot index → `pickForHand(0..2, tableIndex)` three times):

```ts
describe('commitDraft deal-swap pipeline', () => {
  it('records revealSwap on a non-fated face when fate-deal-swap is forced', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const tIdx = e.getState().availableMethods.indexOf('tarot');
    e.selectMethod(tIdx);
    // Fill the 3-slot hand from the table.
    for (let h = 0; h < 3; h++) {
      const draft = e.getState().minigameState as any;
      const tableIdx = draft.table.findIndex((t: any) => t !== null);
      e.pickForHand(h, tableIdx);
    }
    e.forceEffects(['fate-deal-swap'], false);
    e.commitDraft(false);
    const draft = e.getState().minigameState as any;
    expect(draft.revealSwap).toBeTruthy();
    expect(typeof draft.revealSwap.index).toBe('number');
    expect(typeof draft.revealSwap.fromCardId).toBe('string');
  });
});
```

- [ ] **Step 5: Run; confirm it FAILS** (`commitDraft` does not dispatch `tarot:deal` yet, so `revealSwap` is undefined).

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts -t "deal-swap pipeline"`
Expected: FAIL (`expected undefined to be truthy`).

- [ ] **Step 6: Rewrite `commitDraft`.** In `src/engine/GameEngine.ts`, replace the body of `commitDraft` with:

```ts
  commitDraft(reverse: boolean = false): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand.some((h) => h === null)) throw new Error('Hand is not full');

    draft.phase = 'committing';

    const fated: boolean[] = draft.hand.map((h) => h!.fated === true);
    let faces = draft.hand.map((h) => {
      if (h!.revealedFace) return h!.revealedFace;
      return buildFace(DECK_BY_ID[h!.cardId], pickOrientation(this.affinityEngine.getState()));
    });

    // Deal-swap: Fate may replace one non-fated face before reveal.
    const dealBefore = this.state.eventQueue.length;
    const { draft: dealDraft } = this.dispatchAt('tarot:deal', {
      faces: faces as unknown as SlotResult[],
      fated,
    });
    faces = (dealDraft.faces as unknown as TarotCardFace[]) ?? faces;
    if (typeof dealDraft.swappedIndex === 'number' && typeof dealDraft.swapFromCardId === 'string') {
      draft.revealSwap = { index: dealDraft.swappedIndex, fromCardId: dealDraft.swapFromCardId };
    }
    // Narrated inline by the reveal — keep the report out of the sequencer queue
    // (it stays in turnEffects for the run record).
    this.state.eventQueue = this.state.eventQueue.slice(0, dealBefore);

    // Existing pre-consolidation hook.
    this.dispatchAt('tarot:committed', { faces: faces as unknown as SlotResult[], reverse });

    let result = consolidateSpread(faces);
    if (reverse) result = reverseSpread(result);

    // Orient post-modifiers: Chaos flips one face; Order straightens all.
    const orientBefore = this.state.eventQueue.length;
    const { draft: orientDraft } = this.dispatchAt('tarot:orient', { outcome: result });
    result = (orientDraft.outcome as TarotResult) ?? result;
    if (typeof orientDraft.wildCardIndex === 'number') draft.revealWildCard = orientDraft.wildCardIndex;
    if (orientDraft.orderAnchored === true) draft.revealOrderAnchored = true;
    this.state.eventQueue = this.state.eventQueue.slice(0, orientBefore);

    const meta: MinigameMeta = reverse ? { reversed: true } : { revealedAsDrawn: true };
    this.completeMinigame(result, meta);
  }
```

(Confirm `TarotResult` is imported in `GameEngine.ts`; it is used elsewhere there. `buildFace`, `DECK_BY_ID`, `pickOrientation`, `consolidateSpread`, `reverseSpread` are already imported for the old `commitDraft`.)

- [ ] **Step 7: Run the test; confirm PASS.**

Run: `npx vitest run src/engine/__tests__/Tarot.test.ts -t "deal-swap pipeline"`
Expected: PASS.

- [ ] **Step 8: Full gate.** `npx tsc -b`; `npm test`. The existing `completeMinigame meta feeds` tests (AgencyDecisions) still pass — `commitDraft` still calls `completeMinigame` with the same meta.

- [ ] **Step 9: Commit.**

```bash
git add src/engine/types.ts src/engine/responders/affinity.ts src/engine/GameEngine.ts src/engine/__tests__/Tarot.test.ts
git commit -m "feat(tarot): commitDraft runs deal-swap + chaos/order, records reveal markers"
```

---

## Task 4: Remove the superseded `resolveTarotDeal` / `resolveSpreadOrientation` / `setOrientation`

**Files:**
- Modify: `src/engine/GameEngine.ts` (delete three methods)
- Test: `src/engine/__tests__/AgencyDecisions.test.ts`

**Interfaces:**
- Removes: `resolveTarotDeal`, `resolveSpreadOrientation`, `setOrientation`. No remaining caller (they were test-only; the pipeline now lives in `commitDraft`/`planReveal`).

- [ ] **Step 1: Confirm no production callers.**

Run: `git grep -n "resolveTarotDeal\|resolveSpreadOrientation\|setOrientation" -- src/components src/hooks src/context`
Expected: no matches (only tests + the engine definitions reference them).

- [ ] **Step 2: Delete the three methods** in `src/engine/GameEngine.ts` (`resolveTarotDeal`, `resolveSpreadOrientation`, and `setOrientation` — the stub that only fed Will). Remove now-unused imports if `tsc`'s `noUnusedLocals` flags any.

- [ ] **Step 3: Update the tests.** In `src/engine/__tests__/AgencyDecisions.test.ts`, delete the `describe('resolveTarotDeal (Fate override)', ...)` block and the `setOrientation feeds Will` test. If the `resolveSpreadOrientation auto-sets` test was not already removed in Task 2, remove it now. Keep the `completeMinigame meta feeds`, `resolveReroll`, `dice pair`, and `planReveal` blocks.

- [ ] **Step 4: Full gate.** `npx tsc -b` clean (no unused-symbol errors); `npm test` green.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/GameEngine.ts src/engine/__tests__/AgencyDecisions.test.ts
git commit -m "refactor(tarot): drop vestigial resolveTarotDeal/resolveSpreadOrientation/setOrientation"
```

---

## Task 5: `TarotMinigame` — `planReveal` hook + Fate god-hand preempt

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

**Interfaces:**
- Consumes: `engine.planReveal()` (Task 2), `engine.commitDraft(reverse)` (Task 3), `FateForceOverlay` + `HandTarget` (`src/components/overlays/FateForceOverlay.tsx`).

- [ ] **Step 1: Import the god-hand.** At the top of `TarotMinigame.tsx`, add:

```ts
import FateForceOverlay, { type HandTarget } from '../overlays/FateForceOverlay';
```

- [ ] **Step 2: Add preempt state + the hand-row ref for measuring the target.** Inside the component, near the other `useState`s:

```ts
  const [preempt, setPreempt] = useState<{ orientation: 'upright' | 'reversed' } | null>(null);
  const [godPressed, setGodPressed] = useState(false);
  const [handTarget, setHandTarget] = useState<HandTarget | null>(null);
  const planRequestedRef = useRef(false);
  const handRowRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 3: Attach `handRowRef` to the hand-slots row.** The row is the `<div ref={setOutcomeAnchor} style={handSlotsStyle}>` (around line 403). Give it both refs via a callback:

```tsx
          <div
            ref={(el) => { setOutcomeAnchor(el); handRowRef.current = el; }}
            style={handSlotsStyle}
          >
```

- [ ] **Step 4: Run the preempt check when the hand fills.** Add this effect (after the other effects, before `if (!draft) return null` is fine since hooks must be unconditional — place it among the top hooks, but guard on `draft`):

```tsx
  useEffect(() => {
    const d = state.minigameState as TarotDraftState | null;
    if (!d || d.method !== 'tarot') return;
    if (d.phase !== 'drafting') return;
    if (!d.hand.every((h) => h !== null)) return;
    if (planRequestedRef.current) return;
    planRequestedRef.current = true;
    const plan = engine.planReveal();
    if (!plan.preempt || !plan.orientation) return;
    // Fate seizes the choice: measure the hand row, drop the god-hand, commit.
    const rect = handRowRef.current?.getBoundingClientRect();
    if (rect) setHandTarget({ x: rect.left + rect.width / 2, topY: rect.top });
    setPreempt({ orientation: plan.orientation });
    const t1 = setTimeout(() => setGodPressed(true), 650);
    const t2 = setTimeout(() => engine.commitDraft(plan.orientation === 'reversed'), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [state.minigameState, engine]);
```

- [ ] **Step 5: Suppress the buttons during a preempt, and render the god-hand.** Change the commit-row guard (around line 539) to also require `!preempt`:

```tsx
          {handFull && draft.phase === 'drafting' && !preempt && (
```

Then, just before the closing of the component's returned tree (after the peek-result popup `AnimatePresence`), add:

```tsx
        <AnimatePresence>
          {preempt && (
            <FateForceOverlay
              text={preempt.orientation === 'reversed' ? 'Fate turns the spread' : 'Fate sets the spread'}
              target={handTarget}
              pressed={godPressed}
            />
          )}
        </AnimatePresence>
```

- [ ] **Step 6: Reset `planRequestedRef` on a fresh draft.** Add an effect so a new reading re-arms the check:

```tsx
  useEffect(() => {
    const d = state.minigameState as TarotDraftState | null;
    if (d && d.phase === 'drafting' && !d.hand.every((h) => h !== null)) {
      planRequestedRef.current = false;
      setPreempt(null);
      setGodPressed(false);
    }
  }, [state.minigameState]);
```

- [ ] **Step 7: Build + probe.** `npx tsc -b`; `npm run build`. Probe: in `_probe.mjs`, after the engine is ready, stage a high-Fate tarot draft with a full hand and force the preempt, then screenshot:

```js
await p.evaluate(() => {
  const e = window.__engine;
  e.startTurn('self');
  const tIdx = e.getState().availableMethods.indexOf('tarot');
  e.selectMethod(tIdx);
  // Stage the force BEFORE the hand fills, so the component's planReveal effect
  // (which runs async after the hand is full) consumes it at tarot:reveal.
  e.forceEffects(['fate-auto-orient'], false);
  for (let h = 0; h < 3; h++) {
    const d = e.getState().minigameState;
    const ti = d.table.findIndex((t) => t !== null);
    e.pickForHand(h, ti);
  }
});
await p.waitForTimeout(900); // god-hand mid-press
await p.screenshot({ path: 'probe.png' });
```

Confirm the god-hand descends over the hand row with the "Fate … the spread" text and the Reveal/Invert buttons are suppressed. Delete `_probe.mjs` + `probe.png`.

- [ ] **Step 8: Commit.**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(tarot): Fate god-hand preempts the orientation choice"
```

---

## Task 6: Burn-reveal component + inline burn on the swapped slot

**Files:**
- Create: `src/components/cards/BurnReveal.tsx`
- Modify: `src/components/screens/TarotMinigame.tsx` (overlay it on the swapped slot during `committing`)

**Interfaces:**
- Consumes: `draft.revealSwap` (Task 3), `DECK_BY_ID` + `buildFace` + `CardSigil` (existing).
- Produces: `BurnReveal` default export — `({ cardId, accent, onDone }: { cardId: string; accent: string; onDone?: () => void })`.

- [ ] **Step 1: Create `BurnReveal`.** It renders the rejected card's face and immolates it via an animated radial mask (holes grow outward), with an ember edge glow. No new deps — the mask is a CSS `maskImage` radial-gradient animated by framer-motion. Create `src/components/cards/BurnReveal.tsx`:

```tsx
import { motion } from 'framer-motion';
import { DECK_BY_ID, buildFace } from '../../data/tarot';
import CardSigil from './CardSigil';

/**
 * The rejected (swapped-out) card immolates to reveal the real card beneath it.
 * Rendered absolutely over the swapped hand slot; the real committed face is what
 * shows underneath once the burn finishes. Pure CSS mask — no new deps.
 */
export default function BurnReveal({ cardId, accent, onDone }:
  { cardId: string; accent: string; onDone?: () => void }) {
  const card = buildFace(DECK_BY_ID[cardId], 'upright');
  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, borderRadius: 6, zIndex: 3,
        background: 'linear-gradient(160deg, #14101a, #0a0710)',
        border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitMaskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 0%)',
        maskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 0%)',
      }}
      initial={{
        WebkitMaskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 2%)',
        maskImage: 'radial-gradient(circle at 50% 60%, transparent 0%, #000 2%)',
        filter: 'brightness(1)',
      }}
      animate={{
        WebkitMaskImage: 'radial-gradient(circle at 50% 60%, transparent 130%, #000 140%)',
        maskImage: 'radial-gradient(circle at 50% 60%, transparent 130%, #000 140%)',
        filter: ['brightness(1)', 'brightness(1.6)', 'brightness(1)'],
      }}
      transition={{ duration: 1.1, ease: 'easeIn' }}
      onAnimationComplete={onDone}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
        <CardSigil card={card} size={22} color="#c75b4a" />
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.6rem', color: '#c8853a' }}>{card.name}</div>
      </div>
      {/* Ember edge that rides the burn outward. */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
          boxShadow: 'inset 0 0 24px #ff6a2a, inset 0 0 8px #ffd08a' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.1, ease: 'easeIn' }}
      />
    </motion.div>
  );
}
```

- [ ] **Step 2: Overlay it on the swapped slot during `committing`.** In `TarotMinigame.tsx`, import it:

```ts
import BurnReveal from '../cards/BurnReveal';
```

Add local burn state + a trigger when the committed spread appears:

```tsx
  const [burnDone, setBurnDone] = useState(false);
```

Render the burn as an **absolute overlay on the slot column**, as a sibling of the `<AnimatePresence mode="wait">` (NOT a child of it — that wrapper expects a single keyed child). Inside the hand-slot `.map((theme, i) => { ... })`, the column is `<div ... style={handSlotColumnStyle} ...>` containing the label and the `<AnimatePresence mode="wait">…</AnimatePresence>`. Immediately after the closing `</AnimatePresence>` of that column, add:

```tsx
                  {draft.phase === 'committing' && draft.revealSwap?.index === i && !burnDone && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      <BurnReveal cardId={draft.revealSwap.fromCardId} accent={theme.accent} onDone={() => setBurnDone(true)} />
                    </div>
                  )}
```

Give the column a positioning context: add `position: 'relative'` to `handSlotColumnStyle` if it is not already set (the burn's `inset: 0` overlay positions against the column).

- [ ] **Step 3: Reset `burnDone` on a fresh draft.** In the same reset effect from Task 5 Step 6, add `setBurnDone(false);`.

- [ ] **Step 4: Build + probe.** `npx tsc -b`; `npm run build`. Probe: stage a committed tarot slot with a `revealSwap` marker directly via `loadState` so the burn renders without needing the roll:

```js
await p.evaluate(() => {
  const e = window.__engine;
  e.startTurn('self');
  const tIdx = e.getState().availableMethods.indexOf('tarot');
  e.selectMethod(tIdx);
  for (let h = 0; h < 3; h++) {
    const d = e.getState().minigameState;
    const ti = d.table.findIndex((t) => t !== null);
    e.pickForHand(h, ti);
  }
  e.forceEffects(['fate-deal-swap'], false);
  e.commitDraft(false); // sets phase=committing + revealSwap; the burn plays
});
await p.waitForTimeout(600); // mid-burn
await p.screenshot({ path: 'probe.png' });
```

Confirm the swapped slot shows a card burning away (holes spreading, ember glow) over the revealed face. Delete `_probe.mjs` + `probe.png`.

- [ ] **Step 5: Commit.**

```bash
git add src/components/cards/BurnReveal.tsx src/components/screens/TarotMinigame.tsx
git commit -m "feat(tarot): burn-reveal on the deal-swapped card"
```

---

## Task 7: Inline Chaos wild-card flip + Order straighten glow

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx`

**Interfaces:**
- Consumes: `draft.revealWildCard`, `draft.revealOrderAnchored` (Task 3).

- [ ] **Step 1: Chaos wild-card — emphasize the rogue slot's flip.** In the revealed-card `<motion.div>` (keyed `revealed-${revealed.id}-${i}`), make the flipped slot do a fuller rotate by branching its `animate`/`transition` on `draft.revealWildCard === i`:

```tsx
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: draft.revealWildCard === i ? [90, 320, 360] : 0 }}
                        transition={{ type: draft.revealWildCard === i ? 'tween' : 'spring',
                          duration: draft.revealWildCard === i ? 0.9 : undefined,
                          stiffness: 260, damping: 22, delay: i * 0.12 }}
```

Add a small chaos-tinted ring on that slot, right after the revealed card's inner content:

```tsx
                        {draft.revealWildCard === i && (
                          <motion.div
                            style={{ position: 'absolute', inset: -4, borderRadius: 8, border: '1.5px solid #ff7a4a', pointerEvents: 'none' }}
                            initial={{ opacity: 0, scale: 1.2 }}
                            animate={{ opacity: [0, 0.9, 0], scale: [1.2, 1, 1] }}
                            transition={{ duration: 0.9 }}
                          />
                        )}
```

- [ ] **Step 2: Order anchor — a brief straightening glow across the row.** Just inside the hand-slots row `<div>` (the one with `handRowRef`), add an overlay when the spread was order-anchored:

```tsx
            {draft.phase === 'committing' && draft.revealOrderAnchored && (
              <motion.div
                aria-hidden
                style={{ position: 'absolute', inset: '-6%', borderRadius: 8, pointerEvents: 'none',
                  border: '1.5px solid #aac4ff',
                  background: 'radial-gradient(circle, rgba(170,196,255,0.18) 0%, transparent 70%)' }}
                initial={{ opacity: 0, scale: 1.3 }}
                animate={{ opacity: [0, 0.9, 0], scale: [1.3, 1, 1] }}
                transition={{ duration: 1.0, ease: 'easeOut' }}
              />
            )}
```

(For the overlay to position correctly the row `<div style={handSlotsStyle}>` needs `position: 'relative'`; add it to `handSlotsStyle` if absent.)

- [ ] **Step 3: Build + probe both.** `npx tsc -b`; `npm run build`. Probe chaos (force `chaos-wild-card` with high Chaos) then order (force `order-anchor` with high Order), each: fill the hand, `forceEffects([...])`, `commitDraft(false)`, screenshot at ~500 ms. Confirm one face spins/ringed for chaos, and a blue straightening glow sweeps the row for order. Delete `_probe.mjs` + `probe.png`.

```js
// chaos:
e.loadState({ affinities: { ...e.getState().affinities, chaos: 85 } });
e.forceEffects(['chaos-wild-card'], false);
e.commitDraft(false);
// order (separate run):
e.loadState({ affinities: { ...e.getState().affinities, order: 85 } });
e.forceEffects(['order-anchor'], false);
e.commitDraft(false);
```

- [ ] **Step 4: Commit.**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(tarot): inline chaos wild-card flip + order anchor glow"
```

---

## Task 8: Documentation sync + final verification

**Files:**
- Modify: `docs/game-systems.md`
- Modify: `README.md` (only if it documents the tarot reveal/commit flow)

- [ ] **Step 1: Update `docs/game-systems.md`.** In the affinity responder table, for `fate-auto-orient` change the Trigger to `tarot:reveal` and the Min-band/tier to `Fate ascendant · major`; for `fate-deal-swap` change the tier to `Fate ascendant · rare (~0.04)`; for `fate-fated-card` note the per-pick `~0.014`. Add a sentence to the Fate/Chaos/Order agency narrative that deal/orient now fire live at the tarot reveal (Fate preempts the orientation via a god-hand; Chaos flips one face; Order straightens all; Fate may swap a card with a burn-reveal). Note these reveal effects are narrated inline by the minigame, not the InteractionSequencer.

- [ ] **Step 2: Update the README** tarot section if it describes the Reveal-as-Drawn / Invert-Meaning commit — add that Fate may seize the orientation choice and that a dealt card may burn-swap before reveal. If the README does not cover this, write "no change needed" and skip.

- [ ] **Step 3: Final full verification.**

Run: `npx tsc -b` — clean.
Run: `npm test` — green (the suite count holds; updated tests pass).
Run: `npm run build` — succeeds.

- [ ] **Step 4: Manual smoke (optional but recommended).** `npm run dev`, open `?debug`, Force Effects → `fate-auto-orient` (high Fate) and play a tarot reading: confirm the buttons are suppressed, the god-hand turns the spread, and it commits. Force `fate-deal-swap` and confirm the burn.

- [ ] **Step 5: Commit.**

```bash
git add docs/game-systems.md README.md
git commit -m "docs(tarot): deal & orient now fire live at the reveal"
```

---

## Self-review notes

- **Spec coverage:** Reveal pipeline order (Task 5 preempt → Task 6 burn → Task 3 orientation/post-modify → reveal) ✓; engine split auto-orient vs chaos/order (Tasks 2–3) ✓; `planReveal` (Task 2) ✓; deal-swap non-fated guard + markers (Task 3) ✓; remove `setOrientation`/resolve* (Task 4) ✓; burn-reveal (Task 6) ✓; god-hand preempt (Task 5) ✓; chaos/order inline (Task 7) ✓; odds retune deal-swap 0.04 / fated 0.014 / auto-orient ascendant·0.08 (Tasks 1–3) ✓; docs (Task 8) ✓.
- **Type consistency:** `planReveal(): { preempt; orientation }`, `commitDraft(reverse: boolean)`, `TarotDraftState.revealSwap/{index,fromCardId}/revealWildCard/revealOrderAnchored`, draft dispatch fields `faces/fated/swappedIndex/swapFromCardId/fateOrientation/wildCardIndex/orderAnchored` (covered by `PhaseDraft`'s index signature), `BurnReveal({ cardId, accent, onDone })` — names used identically across tasks.
- **Inline, not sequencer:** deal/orient/preempt reports are stripped from `eventQueue` (kept in `turnEffects`); the component narrates from `revealSwap`/`revealWildCard`/`revealOrderAnchored`. Post-commit `tarot:commit` fan effects are untouched.
- **Odds:** combined deal-swap (~4%) + fated-card (~4%/reading) ≈ 8% ≈ fate-force-method; auto-orient ascendant·major (~8%). Tunable.
