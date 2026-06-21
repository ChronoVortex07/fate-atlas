# Handover — Event-Driven Effects Engine: Follow-ups & Fixes

**Date:** 2026-06-22
**Context:** The event-driven effects engine (spec `docs/superpowers/specs/2026-06-21-event-driven-effects-engine-design.md`, plan `docs/superpowers/plans/2026-06-21-event-driven-effects-engine.md`) is merged to `main` (commits `a416e59..442d6f8`). Build green, 201 engine tests passing. This document compiles the outstanding work: **Part A** = newly-reported bugs/changes to fix; **Part B** = follow-ups deferred during the original build. Each item lists symptom, root cause with `file:line`, intended behavior, and a recommended approach.

Quick architecture refresher:
- Effects = `Responder`s gathered and run by `dispatch()` (`src/engine/events/EventDispatcher.ts`) at namespaced trigger points fired by `GameEngine`.
- Resolution: `exclusive` (one weighted winner per priority band) + `combine` (reducer). Affinity catalog in `src/engine/responders/affinity.ts`; interactions in `src/engine/responders/interactions.ts`.
- Effects resolve **synchronously** into `state.eventQueue: EffectReport[]`, then the **`InteractionSequencer`** auto-plays them ("resolve first, narrate second").
- Continuous biases (RNG weighting, `poolPreview`, reading verbosity) live in `AffinityEngine.getEffects()` / the data layer — NOT the event system.

---

## Part A — Reported items to fix

### A1. Animations are cut off — phase transitions before the animation finishes (HIGH)

**Symptom:** Effects like Fool's Reroll don't get to play. You only see the rerolled number appear in the fan; the reroll animation is clipped because the next draw phase has already started.

**Root cause — two compounding issues:**
1. **Uniform auto-advance.** `src/components/overlays/InteractionSequencer.tsx:27` advances every report after a flat `1400` ms regardless of the animation. Several animations need longer (e.g. `RerollAnimation`, `SecondResultAnimation` ripples run ~0.8–1.0s *with* delays; the reveal of the rerolled value needs to land *after* the animation).
2. **The screen transition is not gated on narration.** Because the engine resolves "first" and narrates "second", `GameEngine.completeMinigame` (and the commit path) resolves the effect, **advances to the next phase, and `notify()`s synchronously** — so by the time the sequencer plays, the screen is already the next `method-select`. The old design froze the screen via `interactionQueue` until the animation reached its reveal step; that gating was dropped in the rewrite (Task 7/8) and not replaced.

**Intended behavior:** The committing phase stays on screen until its event batch has been narrated; each animation plays its full duration before the next report (or the phase transition) proceeds.

**Recommended approach:**
- Add a per-animation duration map in `InteractionSequencer` (replace the flat `1400`), e.g. `reroll: 2600, second-result: 2400, flip: 1800, mirror: 1800, override: 1800, shroud: 1600, widen: 1500, 'add-choice': 1800, default: 1400`. Drive the `setTimeout` from `DURATION[report.animation] ?? 1400`.
- Gate the post-commit phase transition on the queue draining. Two options:
  - **(Preferred)** Have `completeMinigame`/commit *defer* the next-phase transition (pool refill / happening / synthesis) when the commit produced queued events: store the pending transition and expose `engine.continueAfterEvents()` that the sequencer calls on drain (`InteractionSequencer` currently calls `engine.clearEventQueue()` at line 23 — call a `finishEventBatch()` that both clears the queue and runs the deferred transition). This restores the old "freeze until narrated" behavior under the resolve-first model.
  - Or keep the screen frozen while `state.eventQueue.length > 0` (`GameTable` already sets `pointerEvents:'none'` then) and only perform the transition once it clears.
- This item is closely tied to **B3** (fan slot-highlight) and **A4** (second-result): the animations need the relevant slot visible while they play.

**Files:** `src/components/overlays/InteractionSequencer.tsx`, `src/engine/GameEngine.ts` (commit/transition path), `src/components/screens/GameTable.tsx`.

---

### A2. ConstellationFan has an oversized invisible hit area (HIGH)

**Symptom:** The fan's clickable area is much larger than its visible sprite. On some displays it overlaps the third method option and makes it impossible to press. On mobile, the invisible area also shows a tap-highlight when pressed.

**Root cause:** `src/components/overlays/ConstellationFan.tsx:206-218` — the collapsed deck's clickable container is a large absolutely-positioned box (`isDesktop` → `width:100%, height:320px`; mobile → `width:220px, height:220px`) carrying `onClick={handleToggle}`. The actual card sprites (`FanCard`, ~50×72 mobile / 80×116 desktop, `src/components/cards/FanCard.tsx:89-94`) are stacked near the bottom and occupy a small fraction of that box. The fan renders during `method-select` (`showTableau` is true for every screen except title/question/result, see `GameTable.tsx:31`), so the big invisible box sits over the centered method grid and intercepts taps on the third card. No tap-highlight suppression is set.

**Intended behavior:** Only the visible deck footprint is tappable; it never overlaps the method options; no mobile tap-highlight on empty space.

**Recommended approach:**
- Constrain the collapsed clickable region to the deck's real footprint. Either wrap only the card stack in the `onClick` (a small element sized to the stack near bottom-right/bottom-center) or shrink the container's `width`/`height` to the visible stack bounds. Keep the expanded overlay full-screen as-is.
- Add `WebkitTapHighlightColor: 'transparent'` (and consider `touchAction: 'manipulation'`) to the clickable element to remove the mobile highlight.
- Consider lowering the collapsed deck's `zIndex` below the method grid, or disabling its pointer events while on `method-select`, so it can never block selection.

**Files:** `src/components/overlays/ConstellationFan.tsx` (collapsed container, lines ~206-218), possibly `src/components/screens/GameTable.tsx`.

---

### A3. Shadow shroud hides ALL options + wrong shroud count (HIGH)

**Symptom:** When Shadow shrouds an option (correctly shown as "Shadow conceals this path"), every *other* option is also hidden as "An unmarked path awaits."

**Root cause (the all-hidden bug):** `src/components/screens/MethodSelect.tsx:59` computes `isHidden = state.affinityEffects.poolPreview === 'hidden'` *in addition to* the per-slot `isShrouded`. `AffinityEngine.getEffects()` sets `poolPreview = 'hidden'` whenever Shadow is Ascendant+ (`shadowIdx >= 2`, see `src/engine/AffinityEngine.ts` getEffects). Since the discrete `shadow-shroud` responder *also* only fires at Shadow Ascendant+, whenever a shroud lands, `poolPreview === 'hidden'` is simultaneously true — so every non-shrouded card renders the `isHidden` branch (`MethodSelect.tsx:74,77,82-84` → "An unmarked path awaits"). The discrete shroud event and the continuous `poolPreview` bias are two concealment systems colliding.

**Fix part A (the bug):** Make method-card concealment the **discrete shroud only**. Remove the `isHidden`/`poolPreview === 'hidden'` branch from `MethodSelect.tsx` (the `isHidden` const at line 59 and its uses at 74, 77, 82-84); keep only `isShrouded` (`state.shroudedMethods.includes(i)`). **Do NOT remove `poolPreview` globally** — it is still used as the dice "veiled" cue (`DiceMinigame` reads `poolPreview === 'hidden'`); only stop it from blanket-hiding method cards.

**Root cause (the count):** `shadow-shroud` (`src/engine/responders/affinity.ts:38-49`) shrouds exactly **one** random index and is gated at `bandRoll(shadow, 'ascendant', notable)` — so it never starts at Stirring and never shrouds 2–3.

**Fix part B (intended progressive count):** Rewrite `shadow-shroud` to the per-band escalation:
- **Stirring+** gate; base **20%** chance to shroud the first option (this is the firing roll).
- **Ascendant+**: if the first succeeded, reroll **20%** for a second (distinct) option.
- **Dominant**: if the first two succeeded, reroll **20%** for a third (distinct) option.
Implementation sketch: `roll(c)` = Shadow at Stirring+ AND `c.rng() < 0.20`; `apply(c)` shrouds one distinct index, then while `band >= ascendant && c.rng() < 0.20` shroud a second, then `band >= dominant && c.rng() < 0.20` a third — each a distinct index, capped at `pool.length`. Use a named constant `SHROUD_STEP_CHANCE = 0.20` (tunable). Update the report to reflect the count (e.g. "Shadow conceals N paths"). Note this intentionally uses a flat per-step chance rather than the scaled `bandRoll` pattern — document that.
- Keep `state.shroudedMethods` (already supports multiple indices) and the `MethodSelect` rendering (already maps `includes(i)`).
- The `shadow-shroud` debug scenario (`src/engine/events/scenarios.ts`) forces the responder; forcing bypasses the firing roll so you always get ≥1 shroud plus probabilistic extras — fine for the demo.

**Files:** `src/components/screens/MethodSelect.tsx`, `src/engine/responders/affinity.ts`, tests in `src/engine/__tests__/`.

---

### A4. Chaos second result needs clearer indication (MEDIUM)

**Symptom:** When Chaos spawns a second slot you may not notice you suddenly have two readings.

**Root cause:** `chaos-second-result` (`src/engine/responders/affinity.ts:87-96`) sets `draft.spawnSecond` and the engine appends a slot, but the narration is weak: the report uses `animation: 'second-result'` → `SecondResultAnimation` (`src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx`) which is just two expanding ripples in the screen center — it ignores `targetSlot` and never points at the newly-added fan card. The banner copy ("a second possibility emerges from the void") doesn't say "you now have an extra reading." Compounded by A1 (clipped timing) and B3 (fan highlight disabled), the new slot silently appears.

**Recommended approach:**
- Have the engine include the new slot's index as `targetSlot` on the `chaos-second-result` report (the `report(...)` helper supports `targetSlot`; the apply currently passes none). Then make `SecondResultAnimation` spotlight that fan slot — e.g. a portal/burst that resolves onto the new card, expand the fan, and pulse the new slot (depends on B3 restoring fan highlighting).
- Strengthen the banner copy (e.g. "Chaos surges — a second reading manifests").
- Ensure on-screen time via A1's per-animation duration.
- Note: `chaos-happening-interrupt` also uses `animation: 'second-result'` (see B5) — give them distinct treatments if they should look different.

**Files:** `src/engine/responders/affinity.ts` (pass `targetSlot`), `src/components/overlays/InteractionAnimations/SecondResultAnimation.tsx`, ties to A1/B3.

---

### A5. Add the remaining responders to the test suite (MEDIUM)

**Currently covered** (`src/engine/__tests__/`): `will-widen-pool`, `shadow-shroud` (lands in queue + populates `shroudedMethods`), `light-advantage`+`shadow-disadvantage` cancel-to-single, `fate-override-pick` (empty-candidate guard + positive swap), `fool-reroll` (unit + integration redraw of committed slot), `critical-resonance` (upright + critical-low → reversed), `mirror` (flips exactly two reversibles).

**Missing — add tests (via `dispatch()` with forced/isolate or constructed `PhaseContext`):**
- `fate-thin-pool` — Fate Ascendant+ forced → `draft.poolTarget` decremented; guarded at `poolTarget > 2`.
- `fate-auto-orient` — `tarot:orient`, forced → `draft.outcome.orientation` set (deterministic with stubbed `rng`).
- `fate-hollow-reroll` — `dice:reroll` with `event.previous` set → `draft.outcome` reverts to the previous die.
- `chaos-second-result` — `*:commit` forced → `draft.spawnSecond` set to the result type; engine-level: a committed reading spawns a second slot in `turnResults`.
- `chaos-happening-interrupt` — `minigame:end` with `lastReading !== true` → `draft.interruptHappening` true; and that it cannot fire on the final reading (the trigger isn't dispatched there).
- `will-choice` / `will-offer-reroll` — `dice:roll` combine contributors push `choice`/`offer-reroll`; resolved mode via the reducer (choice trumps; offer-reroll surfaces).
- `iching-happening-boost` — `happening:start` with a changing-lines I Ching in spread → `draft.addChoice` true.
- `critical-resonance` negative/other paths — reversed + critical-high → upright; non-matching pairings (upright+critical-high, reversed+critical-low) → no fire.
- After A3: `shadow-shroud` progressive count (Stirring → 1; Ascendant → up to 2; Dominant → up to 3, with stubbed `rng`).

**Files:** extend `src/engine/__tests__/AffinityResponders.test.ts`, `InteractionResponders.test.ts`, `EngineDispatch.test.ts`.

---

## Part B — Deferred follow-ups (from the original build)

### B1. "Fate forces the method" is not implemented (MEDIUM)
The migration mapped this to `fate-override-pick` on `select:pick`, but the method pool is `DivinationType[]` (strings), incompatible with that `SlotResult`-shaped responder, and `select:pick` is never dispatched. The dead `select:pick` trigger was removed (`src/engine/responders/affinity.ts:51-53` has the note). To implement: add a method-pool-shaped override effect, dispatch `select:pick` in `GameEngine.selectMethod` with the chosen index + `availableMethods`, and read back a redirected index. Decide UX (the player taps one method, Fate reveals a different one was chosen).

### B2. `RunRecord.interactions` no longer populates (MEDIUM)
`state.interactions` was fed by the deleted `InteractionResolver`; it is now always `[]`. Consequences: the `HistoryTiles` interaction-count badge (`src/components/overlays/HistoryTiles.tsx`) never renders, and the LLM prompt's interaction section (`GameEngine.generateLLMPrompt` / `NarrativeAssembler`) is empty. Fix: accumulate the turn's `EffectReport`s (or a summarized form) into `RunRecord` at build time, and point the badge + prompt at that — or remove the dead `interactions` field and its readers if not wanted.

### B3. ConstellationFan slot-highlight during playback disabled (MEDIUM)
`GameTable.tsx:76` passes a constant `activeSlots={{sourceIndex:null,targetIndex:null,effect:null}}`, so the fan never highlights the source/target slots during an event (the old step-machine drove this). Each `EffectReport` carries `sourceSlot`/`targetSlot`; restore by deriving `activeSlots` from the sequencer's current `report` and threading it to `ConstellationFan`. This is needed for A4 (spotlight the new slot) and improves A1 (reroll target visibility).

### B4. Orphaned legacy types cleanup (LOW)
`PendingEffect`, `InteractionRule`, `RollPlan`, `InteractionEvent`, and the `debugForcedEffect` `GameState` field remain exported in `src/engine/types.ts` though the engine no longer uses them. Remove once any remaining readers are gone.

### B5. Shared animation keys (LOW)
`fate-thin-pool` reuses `animation: 'widen'` (same as `will-widen-pool`); `chaos-happening-interrupt` reuses `'second-result'` (same as `chaos-second-result`). The banner shows distinct label/description so it's not broken, but give them distinct visuals if the effects should read differently (ties to A4).

### B6. Minor / cosmetic (LOW)
- `dispatch()` discards combine-contributor `apply()` return values — safe by contract (combine contributors push via `ctx.draft` and return `null`); a clarifying comment was added. Add a defensive collection only if a future combine contributor needs to report.
- `Reducers.test.ts` empty-mods case doesn't assert the `draft` mutation (tests 1–2 cover it).
- `describeRollMode`'s `single && !offerReroll` branch is unreachable (null-return guard precedes it).
- `PRIORITY_BANDS` is `PriorityBand[]`, not `readonly`.
- Broaden dispatcher edge-case tests (zero/negative weights, multiple same-band winners) as desired.

---

## Suggested sequencing
1. **A3 (bug half)** + **A2** — small, high-impact, unblock method selection and stop the all-hidden concealment.
2. **A1** + **B3** — the timing/freeze + fan-highlight rework go together and unblock A4.
3. **A4** — builds on A1/B3.
4. **A3 (mechanic half)** — progressive shroud count.
5. **A5** — lock everything in with tests.
6. **B1, B2, B4, B5, B6** — as capacity allows.
