# Hand Slot UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the collapsed Constellation hand, fix its hitbox, turn the expanded state into a draggable infinite-scroll radial wheel with snap-to-front and click-to-inspect detail, and sequence hand-involved meta-interactions as expand → scroll → glow → animate.

**Architecture:** Engine stays framework-free; hand-triggered interaction responders stamp the triggering card's hand index onto their `EffectReport.sourceSlot`. The expanded hand becomes a coverflow-style rotating wheel driven by a single continuous `rotation` value in `ConstellationFan`. A small React `InteractionFocusContext` lets `InteractionSequencer` tell the fan which report is active and gate the centered effect animation behind a focus beat. A shared `CardReadingDetail` component renders a card's full breakdown for both the results page and the new tap-to-inspect modal.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Vite, framer-motion, Vitest (engine/data tests only).

## Global Constraints

- Engine (`src/engine/**`) imports zero React/DOM. UI choreography lives in React only.
- Every engine mutator path already routes through `dispatch`/`notify`; do not bypass it.
- Typecheck with `npm run build` (`tsc -b && vite build`). `strict`, `noUnusedLocals`, `noUnusedParameters` are on — no unused vars/params.
- Vitest runs only `src/engine/__tests__/**` (Node env). No component tests exist; UI tasks verify via `npm run build` + manual.
- `sourceSlot` is presentational metadata, not a rules change → no `docs/game-systems.md` edit required.
- Commit after each task. Branch: `feat/hand-slot-ux-overhaul` (already created).

---

### Task 1: Engine — `sourceSlot` on hand-triggered interaction reports

**Files:**
- Modify: `src/engine/responders/interactions.ts`
- Test: `src/engine/__tests__/InteractionResponders.test.ts`

**Interfaces:**
- Consumes: `EffectReport { sourceSlot?: number; targetSlot?: number }` (already in `src/engine/events/types.ts`), `PhaseContext.spread`.
- Produces: hand-triggered reports now carry `sourceSlot` = index of the triggering card in `ctx.spread` (which equals `state.turnResults` at commit). `mirror` also sets `targetSlot`.

- [ ] **Step 1: Write failing tests**

Add to `src/engine/__tests__/InteractionResponders.test.ts`:

```ts
it('fool-reroll reports the Fool index as sourceSlot', () => {
  const other = { type: 'iching', tags: [] } as any;
  const c = ctx({ trigger: 'dice:commit', slots: [other, fool], spread: [other, fool], draft: { outcome: { type: 'd20' } as any } });
  const { reports } = dispatch('dice:commit', c, buildInteractionResponders(), noDebug);
  const r = reports.find((x) => x.responderId === 'fool-reroll')!;
  expect(r.sourceSlot).toBe(1);
});

it('critical-resonance reports the critical die index as sourceSlot', () => {
  const card = spreadCard('the-fool', 'upright');
  const c = ctx({ trigger: 'tarot:commit', slots: [critLow], spread: [critLow, card], draft: { outcome: card } });
  const { reports } = dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
  const r = reports.find((x) => x.responderId === 'critical-resonance')!;
  expect(r.sourceSlot).toBe(0);
});

it('mirror reports both reversible indices as sourceSlot/targetSlot', () => {
  const a = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
  const b = spreadCard('the-tower', 'reversed');
  const c = ctx({ trigger: 'tarot:commit', spread: [a, b], rng: () => 0, draft: { outcome: b } });
  const { reports } = dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
  const r = reports.find((x) => x.responderId === 'mirror')!;
  expect(r.sourceSlot).toBe(0);
  expect(r.targetSlot).toBe(1);
});

it('iching-happening-boost reports the changing-lines hex index as sourceSlot', () => {
  const pad = { type: 'd20', tags: [] } as any;
  const hex = { type: 'iching', tags: ['changing-lines'], changingLines: [0, 2] } as any;
  const c = ctx({ trigger: 'happening:start', slots: [pad, hex], spread: [pad, hex], draft: {} });
  const { reports } = dispatch('happening:start', c, buildInteractionResponders(), noDebug);
  const r = reports.find((x) => x.responderId === 'iching-happening-boost')!;
  expect(r.sourceSlot).toBe(1);
});

it('iching-resonant-change reports the reversible non-iching index as sourceSlot', () => {
  const rev = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
  const out = { type: 'iching', tags: ['changing-lines'] } as any;
  const c = ctx({ trigger: 'iching:commit', slots: [rev], spread: [rev], draft: { outcome: out } });
  const { reports } = dispatch('iching:commit', c, buildInteractionResponders(), noDebug);
  const r = reports.find((x) => x.responderId === 'iching-resonant-change')!;
  expect(r.sourceSlot).toBe(0);
});

it('field-internal spread interactions carry no sourceSlot', () => {
  const c = ctx({ trigger: 'tarot:commit', spread: [], draft: { outcome: { type: 'd20' } as any } });
  const { reports } = dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
  expect(reports.every((r) => r.sourceSlot === undefined || r.responderId === 'mirror')).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/InteractionResponders.test.ts`
Expected: the new `sourceSlot`/`targetSlot` assertions FAIL (undefined).

- [ ] **Step 3: Implement**

In `src/engine/responders/interactions.ts`, extend the `report` helper signature and the relevant responders:

```ts
function report(id: string, label: string, description: string, animation: string, targetSlot?: number, sourceSlot?: number): EffectReport {
  return { responderId: id, label, description, animation, targetSlot, sourceSlot };
}
```

- `fool-reroll.apply`:
```ts
apply: (c) => {
  c.draft.rerollOutcome = true;
  const i = c.spread.findIndex((s) => has(s, 'major-arcana', 'fool-archetype'));
  return report('fool-reroll', "The Fool", "The Fool's wild energy ripples through fate — the dice must be cast again.", 'reroll', undefined, i < 0 ? undefined : i);
},
```

- `critical-resonance.apply`: compute the critical die index from the same threshold the condition used:
```ts
apply: (c) => {
  const card = c.draft.outcome as TarotResult;
  const wasUpright = card.orientation === 'upright';
  const wanted = wasUpright ? 'critical-low' : 'critical-high';
  const i = c.spread.findIndex((s) => s.type === 'd20' && (s as DiceResult).threshold === wanted);
  c.draft.outcome = reverseSpread(card);
  return report('critical-resonance', 'Critical Resonance',
    wasUpright ? 'A dire omen drags the spread down — it inverts.' : 'A bright omen lifts the spread — it rights itself.',
    'flip', undefined, i < 0 ? undefined : i);
},
```

- `mirror.apply`: report both reversible indices:
```ts
apply: (c) => {
  const idxs = c.spread.map((s, i) => (s.tags.includes('reversible') ? i : -1)).filter((i) => i >= 0);
  if (c.draft.outcome?.type === 'tarot') {
    c.draft.outcome = reverseSpread(c.draft.outcome as TarotResult);
  }
  return report('mirror', 'The Mirror', 'Two forces reflect each other across the weave — both turn.', 'mirror', idxs[1], idxs[0]);
},
```

- `iching-happening-boost.apply`:
```ts
apply: (c) => {
  c.draft.addChoice = true;
  const i = c.spread.findIndex((s) => s.type === 'iching' && s.tags.includes('changing-lines'));
  return report('iching-happening-boost', 'I Ching', 'The changing lines reveal hidden branches — more choices emerge.', 'add-choice', undefined, i < 0 ? undefined : i);
},
```

- `iching-resonant-change.apply`:
```ts
apply: (c) => {
  const i = c.spread.findIndex((s) => s.type !== 'iching' && s.tags.includes('reversible'));
  return report('iching-resonant-change', 'I Ching', 'The changing lines resonate outward — a kindred force stirs in sympathy.', 'mirror', undefined, i < 0 ? undefined : i);
},
```

Leave the `spreadEntry(...)` family and `report()` calls inside them unchanged (no `sourceSlot`).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engine/__tests__/InteractionResponders.test.ts`
Expected: PASS. Then `npx vitest run` — full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/responders/interactions.ts src/engine/__tests__/InteractionResponders.test.ts
git commit -m "feat(hand): stamp triggering hand-slot index on interaction reports"
```

---

### Task 2: Shared `CardReadingDetail` component

**Files:**
- Create: `src/components/cards/CardReadingDetail.tsx`
- Modify: `src/components/screens/ResultReading.tsx`
- Test: none (refactor; verify with `npm run build`)

**Interfaces:**
- Produces: `export default function CardReadingDetail({ result, index }: { result: SlotResult; index?: number }): JSX.Element` — renders the full per-card breakdown (symbol/sigil, name, subtitle, astral house/aspect, multi-card sub-spread) currently inlined in `ResultReading`.
- Consumes: `getResultDisplay` logic moves into this component (or a colocated helper it owns).

- [ ] **Step 1: Create the component**

Move `getResultDisplay` and the per-card JSX (the `resultCardStyle` block including astral branch and the `subCards` spread layout) from `ResultReading.tsx` into `src/components/cards/CardReadingDetail.tsx`. Export the styles it needs locally. Signature:

```tsx
import type { SlotResult } from '../../engine/types';
import CardSigil from './CardSigil';
import AstralSigil from './AstralSigil';
import { HOUSES } from '../../data/astromancy';

export default function CardReadingDetail({ result, index }: { result: SlotResult; index?: number }) {
  // ...getResultDisplay(result) + the resultCard JSX, using `index` for the corner number when provided
}
```

- [ ] **Step 2: Reuse it in `ResultReading`**

In `ResultReading.tsx`, replace the inlined per-card block inside `turnResults.map(...)` with `<CardReadingDetail key={i} result={r} index={i} />`. Remove the now-dead `getResultDisplay`, the moved styles, and any imports (`CardSigil`/`AstralSigil`/`HOUSES`) that are no longer referenced there. Keep synthesis/happening/actions sections as-is.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: typecheck passes, no unused-symbol errors. Manually load the results screen — the per-card rows look identical to before.

- [ ] **Step 4: Commit**

```bash
git add src/components/cards/CardReadingDetail.tsx src/components/screens/ResultReading.tsx
git commit -m "refactor(cards): extract shared CardReadingDetail from ResultReading"
```

---

### Task 3: Collapsed hand — reposition bottom-right + hitbox fix

**Files:**
- Modify: `src/components/overlays/ConstellationFan.tsx`

**Interfaces:**
- No new exports. Changes the collapsed footprint geometry only.

- [ ] **Step 1: Anchor collapsed footprint bottom-right on both breakpoints**

In the fan-cards wrapper `div` (currently `bottom/right/left/transform` block), make the **collapsed** branch always bottom-right (drop the desktop `left:50%`/`translateX(-50%)` when not expanded). Keep the **expanded** branch centered (`left:50%`, `translateX(-50%)`) on desktop; center it on mobile too. Concretely, compute position from `expanded`:

```tsx
const collapsed = !expanded;
// wrapper style:
left: expanded ? '50%' : undefined,
right: expanded ? undefined : (isDesktop ? '20px' : '14px'),
transform: expanded ? 'translateX(-50%)' : undefined,
```

Move the "N ✧ tap to expand" hint to match (bottom-right both breakpoints).

- [ ] **Step 2: Fix the collapsed hitbox**

The collapsed wrapper must cover the full visible stack. The top card translates up to `~(results.length-1)*step + base + cardHeight`. Set the collapsed wrapper height to span it:

```tsx
const cardH = isDesktop ? 116 : 72;
const step = isDesktop ? 14 : 6;
const base = isDesktop ? 60 : 36;
const stackH = base + (results.length - 1) * step + cardH + 8;
// collapsed width: card width + small margin
const stackW = (isDesktop ? 80 : 50) + 16;
// wrapper (collapsed):
width: expanded ? (isDesktop ? '100%' : '220px') : `${stackW}px`,
height: expanded ? (isDesktop ? '320px' : '220px') : `${stackH}px`,
```

Keep `onClick={!expanded ? handleToggle : undefined}` on the wrapper, `cursor: !expanded ? 'pointer' : undefined`, and `pointerEvents: expanded ? 'none' : 'auto'`. Collapsed `FanCard`s keep `pointerEvents:'none'` so taps fall through to the wrapper across the whole stack.

- [ ] **Step 3: Verify build + manual**

Run: `npm run build`
Manual: collapsed hand sits in the bottom-right and tapping anywhere on the visible stack (top card included) expands it.

- [ ] **Step 4: Commit**

```bash
git add src/components/overlays/ConstellationFan.tsx
git commit -m "fix(hand): collapsed hand bottom-right with full-stack hitbox"
```

---

### Task 4: Expanded rotating wheel (infinite scroll, snap-to-front)

**Files:**
- Modify: `src/components/overlays/ConstellationFan.tsx`
- Modify: `src/components/cards/FanCard.tsx`

**Interfaces:**
- `FanCard` gains expanded-wheel transform props and a glow flag:
  `wheelX?: number; wheelY?: number; wheelRotate?: number; wheelScale?: number; wheelOpacity?: number; wheelZ?: number; glowing?: boolean; instant?: boolean; onSelect?: () => void;`
  When `isExpanded` and `wheelX !== undefined`, the card animates to the wheel transform; `instant` disables the spring during active drag; `glowing` renders a gold spotlight ring; `onSelect` fires on a clean tap.
- `ConstellationFan` owns `rotation` (continuous float) and `focusIndex = round(rotation) mod N`.

- [ ] **Step 1: Wheel math helpers in `ConstellationFan`**

```tsx
const N = results.length;
function wrappedOffset(i: number, rot: number, n: number): number {
  let d = ((i - rot) % n + n) % n; // [0, n)
  if (d > n / 2) d -= n;            // (-n/2, n/2]
  return d;
}
const ANGLE_STEP = isDesktop ? 24 : 28; // deg between adjacent cards
const RADIUS = isDesktop ? 210 : 150;   // px
function wheelTransform(offset: number) {
  const a = offset * ANGLE_STEP * Math.PI / 180;
  const dist = Math.abs(offset);
  return {
    x: RADIUS * Math.sin(a),
    y: -(RADIUS * Math.cos(a)) + RADIUS, // front (offset 0) sits highest; arc dips at sides
    rotate: offset * ANGLE_STEP,
    scale: Math.max(0.5, 1 - dist * 0.16),
    opacity: dist > (isDesktop ? 3.2 : 2.4) ? 0 : Math.max(0.12, 1 - dist * 0.26),
    zIndex: Math.round(100 - dist * 10),
  };
}
```

- [ ] **Step 2: `rotation` state + drag handling**

```tsx
const [rotation, setRotation] = useState(0);
const [dragging, setDragging] = useState(false);
const dragRef = useRef<{ startX: number; startRot: number; moved: boolean } | null>(null);
const PX_PER_CARD = 90;

const onPointerDown = (e: React.PointerEvent) => {
  if (!expanded) return;
  (e.target as Element).setPointerCapture?.(e.pointerId);
  dragRef.current = { startX: e.clientX, startRot: rotation, moved: false };
  setDragging(true);
};
const onPointerMove = (e: React.PointerEvent) => {
  const d = dragRef.current;
  if (!d) return;
  const dx = e.clientX - d.startX;
  if (Math.abs(dx) > 6) d.moved = true;
  setRotation(d.startRot - dx / PX_PER_CARD);
};
const endDrag = () => {
  if (!dragRef.current) return;
  dragRef.current = null;
  setDragging(false);
  setRotation((r) => Math.round(r)); // snap-to-front; spring handled by per-card transition
};
```

Attach `onPointerDown/Move/Up/Cancel` to the expanded wheel container. Also support wheel/trackpad: `onWheel={(e) => expanded && setRotation((r) => r + Math.sign(e.deltaX || e.deltaY) * 0.0...)}` — debounce-free, increment by `e.deltaX/600`.

- [ ] **Step 3: Render wheel cards in expanded state**

Replace the expanded mapping so each `FanCard` receives `wheelTransform(wrappedOffset(i, rotation, N))`, `glowing` (see Task 6, default false for now), `instant={dragging}`, and `onSelect={() => openDetail(i)}` (Task 5 wires `openDetail`). Skip rendering cards with `opacity === 0` to keep the DOM light. The collapsed branch keeps the existing stacked render (`isExpanded={false}`).

- [ ] **Step 4: `FanCard` honors wheel transform + glow**

In `FanCard.tsx`, when `isExpanded` and `wheelX !== undefined`, use the wheel transform for `animate` (`x/y/rotate/scale/opacity`, `zIndex`), set `transition={ instant ? { duration: 0 } : { type:'spring', stiffness: 260, damping: 26 } }`, and wire `onClick`/`onPointerUp` to call `onSelect` only when the parent reports a clean tap (parent passes `onSelect` already gated by `dragRef.moved`). Add a glow ring when `glowing`:

```tsx
{glowing && (
  <motion.div style={{ position:'absolute', inset:'-6px', borderRadius:'10px', border:'2px solid rgba(212,168,84,0.8)', boxShadow:'0 0 24px rgba(212,168,84,0.6)', pointerEvents:'none' }}
    animate={{ opacity:[0.5,1,0.5] }} transition={{ duration:1.1, repeat:Infinity, ease:'easeInOut' }} />
)}
```

Gate `onSelect` against drag: the wheel container's `onClickCapture` checks `dragRef.current?.moved` — simpler, have the parent pass `onSelect` that itself early-returns if the last gesture moved. Implement by reading a `lastMovedRef` the parent sets in `endDrag`.

- [ ] **Step 5: Verify build + manual**

Run: `npm run build`
Manual: expand the hand → cards form the radial wheel; drag left/right rotates infinitely; releasing snaps a card to front; front card is largest/brightest.

- [ ] **Step 6: Commit**

```bash
git add src/components/overlays/ConstellationFan.tsx src/components/cards/FanCard.tsx
git commit -m "feat(hand): rotating radial wheel with infinite drag scroll and snap-to-front"
```

---

### Task 5: Tap-to-inspect card detail modal

**Files:**
- Create: `src/components/overlays/CardDetailModal.tsx`
- Modify: `src/components/overlays/ConstellationFan.tsx`

**Interfaces:**
- `CardDetailModal({ result, onClose }: { result: SlotResult; onClose: () => void })` — centered modal: dim backdrop (click closes) + a panel wrapping `<CardReadingDetail result={result} />` + a close control.
- `ConstellationFan` holds `const [detailIndex, setDetailIndex] = useState<number|null>(null)`; `openDetail(i)` sets it; renders the modal when non-null.

- [ ] **Step 1: Create `CardDetailModal`**

```tsx
import { motion } from 'framer-motion';
import type { SlotResult } from '../../engine/types';
import CardReadingDetail from '../cards/CardReadingDetail';

export default function CardDetailModal({ result, onClose }: { result: SlotResult; onClose: () => void }) {
  return (
    <motion.div style={backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div style={panel} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}>
        <button type="button" style={closeBtn} onClick={onClose}>×</button>
        <CardReadingDetail result={result} />
      </motion.div>
    </motion.div>
  );
}
```
with `backdrop` (`position:absolute; inset:0; zIndex:30; display:flex; align/justify:center; background:rgba(7,10,18,0.8)`), `panel` (`maxWidth:420px; width:90%; background:#070a12; border:1px solid #1a2440; borderRadius:8px; padding:1.5rem; position:relative; maxHeight:85vh; overflowY:auto`), and `closeBtn` (top-right, gold ×).

- [ ] **Step 2: Wire into `ConstellationFan`**

Add `detailIndex` state, pass `onSelect={() => setDetailIndex(i)}` from the wheel cards (gated against drag per Task 4), and render inside the existing `AnimatePresence`:

```tsx
<AnimatePresence>
  {detailIndex !== null && results[detailIndex] && (
    <CardDetailModal result={results[detailIndex]} onClose={() => setDetailIndex(null)} />
  )}
</AnimatePresence>
```

- [ ] **Step 3: Verify build + manual**

Run: `npm run build`
Manual: in the expanded wheel, a clean tap (not a drag) on a card opens the centered breakdown; backdrop/× closes it; the wheel is preserved behind.

- [ ] **Step 4: Commit**

```bash
git add src/components/overlays/CardDetailModal.tsx src/components/overlays/ConstellationFan.tsx
git commit -m "feat(hand): tap a wheel card to open its reading breakdown modal"
```

---

### Task 6: Meta-interaction sequencing (expand → scroll → glow → animate)

**Files:**
- Create: `src/context/InteractionFocusContext.tsx`
- Modify: `src/components/screens/GameTable.tsx`
- Modify: `src/components/overlays/InteractionSequencer.tsx`
- Modify: `src/components/overlays/ConstellationFan.tsx`

**Interfaces:**
- `InteractionFocusContext` value: `{ activeReport: EffectReport | null; phase: 'focusing' | 'animating' | null }`, plus a provider `InteractionFocusProvider` and a setter exposed to the sequencer. Implement as a provider holding state with a `setFocus(report, phase)` callback in context.
- `ConstellationFan` no longer receives `activeSlots` as a prop; it reads the context instead. `GameTable` drops `deriveActiveSlots`.

- [ ] **Step 1: Create the context/provider**

```tsx
import { createContext, useContext, useState, useCallback } from 'react';
import type { EffectReport } from '../engine/types';

type Phase = 'focusing' | 'animating' | null;
interface FocusValue { activeReport: EffectReport | null; phase: Phase; setFocus: (r: EffectReport | null, p: Phase) => void; }
const Ctx = createContext<FocusValue>({ activeReport: null, phase: null, setFocus: () => {} });
export const useInteractionFocus = () => useContext(Ctx);

export function InteractionFocusProvider({ children }: { children: React.ReactNode }) {
  const [activeReport, setActive] = useState<EffectReport | null>(null);
  const [phase, setPhase] = useState<Phase>(null);
  const setFocus = useCallback((r: EffectReport | null, p: Phase) => { setActive(r); setPhase(p); }, []);
  return <Ctx.Provider value={{ activeReport, phase, setFocus }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Wrap fan + sequencer in `GameTable`**

In `GameTable.tsx`, wrap the `ConstellationFan` + `InteractionSequencer` region in `<InteractionFocusProvider>`. Remove `deriveActiveSlots` and the `activeSlots` prop; render `<ConstellationFan results={state.turnResults} />`.

- [ ] **Step 3: Sequencer drives the two sub-phases**

In `InteractionSequencer.tsx`, replace the single per-report timer with a focus-then-animate cycle using the context `setFocus`:

```tsx
const { setFocus } = useInteractionFocus();
const FOCUS_BEAT = 750;
useEffect(() => {
  if (queue.length === 0) return;
  if (i >= queue.length) { engine.finishEventBatch(); setFocus(null, null); setI(0); return; }
  const report = queue[Math.min(i, queue.length - 1)];
  const hasHand = typeof report.sourceSlot === 'number';
  let t: ReturnType<typeof setTimeout>;
  if (hasHand) {
    setFocus(report, 'focusing');
    t = setTimeout(() => {
      setFocus(report, 'animating');
      const ms = DURATION[report.animation] ?? DEFAULT_DURATION;
      t = setTimeout(() => setI((n) => n + 1), ms);
    }, FOCUS_BEAT);
  } else {
    setFocus(report, 'animating');
    const ms = DURATION[report.animation] ?? DEFAULT_DURATION;
    t = setTimeout(() => setI((n) => n + 1), ms);
  }
  return () => clearTimeout(t);
}, [i, queue.length, engine, setFocus]);
```

Only render the centered animation/banner when `phase === 'animating'` (during `focusing`, show the dim veil but not the effect visual). On `skip`, also `setFocus(null, null)`.

- [ ] **Step 4: Fan reacts to focus**

In `ConstellationFan.tsx`, read `const { activeReport, phase } = useInteractionFocus();`. Derive the focus slot: `const focusSlot = activeReport?.sourceSlot ?? null;`. Effects:
- When `focusSlot !== null`: `setExpanded(true)` and animate `rotation` to the nearest equivalent of `focusSlot`:
```tsx
useEffect(() => {
  if (focusSlot === null) return;
  setExpanded(true);
  setRotation((r) => {
    let t = focusSlot;
    while (t - r > N / 2) t -= N;
    while (t - r < -N / 2) t += N;
    return t;
  });
}, [focusSlot, N]);
```
- Glow: pass `glowing={phase !== null && i === ((focusSlot ?? -1) % N + N) % N && focusSlot !== null}` to the wheel cards (and to the source/target). Optionally also glow `activeReport?.targetSlot`.
- Keep the existing auto-collapse timer (collapses after `activeReport` returns to null).

- [ ] **Step 5: Verify build + manual**

Run: `npm run build` and `npx vitest run`.
Manual (use the debug panel `forced` scenarios to fire `fool-reroll`/`mirror`): the hand auto-expands, the wheel scrolls to the triggering card, it glows for the focus beat, *then* the centered reroll/mirror animation plays. A field-only effect (e.g., `chaos-second-result`) plays centered with the hand untouched.

- [ ] **Step 6: Commit**

```bash
git add src/context/InteractionFocusContext.tsx src/components/screens/GameTable.tsx src/components/overlays/InteractionSequencer.tsx src/components/overlays/ConstellationFan.tsx
git commit -m "feat(hand): sequence hand-involved interactions as expand/scroll/glow then animate"
```

---

## Self-Review

**Spec coverage:**
- Collapsed reposition + hitbox → Task 3. ✓
- Rotating wheel, infinite scroll, snap-to-front → Task 4. ✓
- Tap-to-inspect detail modal + shared component → Tasks 2, 5. ✓
- Hand-involved sequencing (expand/scroll/glow/animate) + engine `sourceSlot` → Tasks 1, 6. ✓
- Field-only effects leave hand untouched → Task 6 (`hasHand` gate + `focusSlot === null`). ✓
- Engine/React split, no game-systems.md change → respected (Task 1 only adds metadata). ✓
- Engine tests for `sourceSlot` → Task 1. ✓

**Placeholder scan:** No TBD/TODO; code shown for each code step. ✓

**Type consistency:** `EffectReport.sourceSlot/targetSlot` (existing optional numbers) used uniformly; `report(...sourceSlot)` helper signature matches call sites; `useInteractionFocus()`/`InteractionFocusProvider` names consistent across Tasks 6.1–6.4; `CardReadingDetail({ result, index? })` matches its use in Tasks 2 and 5; `wheelTransform`/`wrappedOffset` names consistent in Task 4. ✓

**Note for executor:** Tasks 4–6 touch `ConstellationFan.tsx` repeatedly; apply them in order. The drag/tap gating (`dragRef.moved` / `lastMovedRef`) introduced in Task 4 is what Task 5's `onSelect` relies on — keep that ref when wiring the modal.
