# Event-Driven Effects Engine — Design

**Status:** Approved for planning (2026-06-21)
**Scope:** Replace the two tangled effect mechanisms (affinity powers + tag interactions) with one event-driven *responder pipeline*, while keeping affinities and meta-interactions as distinct authoring layers.

---

## 1. Problem & motivation

The engine currently has **two separate, tangled mechanisms** for "things that react to the reading," and neither flows through a real event system:

1. **Tag interactions** — declarative `INTERACTION_RULES`, but resolved through a deferred *pending-effects* model that fires on a *later* slot commit, then queued + animated by `InteractionSequencer`.
2. **Affinity powers** — declared as `bandedEffects` data, but actually implemented as ~12 hardcoded `maybe*`/`resolve*` methods on `GameEngine` (`maybeWildSurge`, `resolveTarotPick`, `maybeAutoOrient`, `planDiceRoll`, …), each called by hand at the right spot and gated by `forcedOrRoll` (band × probability).

The `EventBus` has an `on()` method but drives no game logic — it is only an append-only log for the debug panel. There is no shared notion of *trigger points*, no priority ordering, no way for one effect to build on another, and no uniform way to author or test effects. This is the source of the "messy, buggy, hard to extend" state.

**Goal:** collapse both mechanisms onto **one event-driven responder pipeline** with explicit trigger points, priority, a rich shared context, deterministic resolution rules, and a first-class debug/test harness — *without* merging the two mechanics conceptually.

### Two mechanics, one substrate

- **Affinities** — broad, theme-driven effects scoped to a *section* of gameplay (Will/Fate → agency; Light/Shadow → information; Chaos/Order → randomness).
- **Meta-interactions** — narrow, specific, context-matched "easter eggs" (Fool's Reroll, Mirror, Critical Resonance).

Both compile down to the same `Responder` interface and run through the same dispatcher. They differ only in how their `condition`/`roll` are authored and where their config comes from.

### Non-goals

- No change to **continuous biases**: RNG weighting (Order pulls the d20 toward center), reading verbosity (`readingDetail`, `hintClarity`, `poolPreview`), and Light/Shadow narrative tone stay in the data/narrative layer. The event system is only for **discrete, observable, one-shot changes** the player can watch happen.
- No tarot redesign in this pass (the eventual "pick N from the whole suite" tarot is future work; its trigger points are reserved but unused — see §9).
- Firing stays **probabilistic** — we are not converting effects to deterministic-in-band.

---

## 2. Key decisions (resolved during brainstorming)

| # | Decision |
|---|---|
| D1 | Keep affinities and meta-interactions as **two distinct mechanics** hosted by one event engine. |
| D2 | **Probabilistic firing stays** (band × chance). Predictability comes from the debug harness, not from determinism. |
| D3 | Dispatch model = **priority pipeline of responders** (not pub/sub, not a pure data table). |
| D4 | Batch presentation = **auto-play, skippable** sequence (no per-event tap; one tap skips the whole batch). |
| D5 | Trigger points are **namespaced per minigame** (`dice:roll`, not `action:roll`) to prevent "works for one game, silently broken for another" bugs. |
| D6 | **Draws resolve blind**: deal face-down → run draw responders → flip up, so concealment effects land before the player sees anything. |
| D7 | Resolution uses **two policies**: `exclusive` (one effect per priority band) and `combine` (a pure reducer nets/cancels modifiers). |
| D8 | First-class **debug harness**: force a *set* of effects, isolate (fresh state + suppress all others), and combine = force-set + isolate. |
| D9 | **Resolve first, narrate second**: logic applies synchronously; animations replay it; skipping skips visuals only. |

---

## 3. Trigger-point taxonomy

A **round** = `repeat[ method-draw → minigame → (maybe happening) ] until N readings done → result`.

Trigger points are **namespaced strings** (open-ended, not a closed enum), so adding a minigame adds trigger points without touching the dispatcher. Each minigame module declares its own.

| Scope | Trigger points | Notes |
|---|---|---|
| **Round** | `round:start`, `round:end` | engine-level; run drift, carryover |
| **Method draw** (`select`) | `select:start`, `select:draw:start`, `select:draw:end`, `select:pick`, `select:end` | the method pool — its *own* draw, separate from any minigame's draw. Subject to the blind-draw rule (§3.1). |
| **Tarot** | `tarot:start`, `tarot:draw:start`, `tarot:draw:end`, `tarot:pick`, `tarot:orient`, `tarot:commit`, `tarot:end` | `tarot:draw:*` are **reserved but unused** this pass (cards are face-down by the game's own design). |
| **Dice** | `dice:start`, `dice:roll`, `dice:reroll`, `dice:commit`, `dice:end` | no internal draw |
| **I Ching** | `iching:start`, `iching:cast`, `iching:commit`, `iching:end` | `iching:cast` may fire per line |
| **Happening** | `happening:start`, `happening:choose`, `happening:end` | |

**Ordering is two-layered:** first by *which* trigger point (temporal — `:start` before `:end`), then by *priority band* within a trigger point (§5).

**Authoring shorthand:** `*:commit` / `*:peek` below mean "every minigame's `:commit` / `:peek` trigger" — the responder lists each one explicitly in its `triggers` array. No wildcard is resolved at dispatch time, so the per-minigame namespacing of D5 is preserved.

**"Commit"** = the single beat where a minigame's *final* outcome is locked in and recorded into the round's results. Actions (`roll`/`pick`/`cast`/`orient`/`reroll`) happen *during* play and can repeat or be intercepted; commit is the one finalizing moment after which cross-slot interactions and the engine's bookkeeping run. The engine's own bookkeeping (count readings, choose the next screen) is plain engine code, not a responder.

### 3.1 Draws resolve blind

Any draw phase:
1. `*:draw:start` responders run (e.g. Will widens the pool) — **before** the deal, so they can change *how many* items are dealt.
2. The engine deals the pool **face-down**.
3. `*:draw:end` responders run (e.g. Shadow shrouds an option) while items are still hidden — so a shroud can target the very item a `:start` responder added.
4. Items **flip face-up** only at the transition out of the draw (after the narration batch, §7).

This rule matters for **normally-visible draws** (the method pool). Tarot cards are face-down anyway, so the rule is mostly about `select`.

---

## 4. The `Responder` interface & `PhaseContext`

```ts
type TriggerPoint = string; // namespaced: 'select:draw:end', 'dice:roll', 'tarot:commit'

type ResolutionGroup =
  | { kind: 'exclusive'; band: PriorityBand }   // one winner per band (default)
  | { kind: 'combine'; channel: string };       // contributes to a reducer, e.g. 'roll-mode'

interface Responder {
  id: string;
  source: 'affinity' | 'interaction';   // which authoring layer it came from
  triggers: TriggerPoint[];             // which points it listens to
  group: ResolutionGroup;
  condition(ctx: PhaseContext): boolean; // STRUCTURAL precondition — ALWAYS required
  roll(ctx: PhaseContext): boolean;      // PROBABILISTIC gate — bypassed when forced
  apply(ctx: PhaseContext): EffectReport | null; // mutate the draft, report what happened
}
```

- **Normal eligibility:** `condition(ctx) && roll(ctx)`.
- **Forced (debug):** `condition(ctx)` only — skips the chance/band gate but still needs its precondition, so `apply` can never crash.
- **Suppressed (debug):** never runs.

Splitting `condition` (structural) from `roll` (probabilistic) is what makes forcing *safe* and makes responders unit-testable in two independent halves. For affinity responders `roll` contains the band-gate × tier-chance (today's `forcedOrRoll`); for interactions `roll` is the optional chance, with the tag/spread match living in `condition`.

### `PhaseContext` — rich read surface + mutable draft

The context must be big enough to express *any* condition (e.g. "is The Fool in the spread?", "exactly two reversible cards?"), so it exposes the whole relevant game state for reading and a trigger-specific `draft` for mutation.

```ts
interface PhaseContext {
  trigger: TriggerPoint;
  affinities: Record<AffinityId, number>; // read-only snapshot
  slots: SlotResult[];        // committed results this round  → "is The Fool present?"
  hand: SlotResult[] | null;  // current uncommitted pool/hand → "Fool in the dealt hand?"
  spread: SlotResult[];       // slots + hand — the full picture → "exactly 2 reversible?"
  minigame: MinigameState | null;
  event: TriggerPayload;      // payload of the triggering action (the die rolled, the card picked)
  draft: PhaseDraft;          // MUTABLE working state for this trigger point
  rng: () => number;          // injectable RNG (tests pass a deterministic stream)
}

interface PhaseDraft {
  pool?: SlotResult[];        // draw phases: items being dealt (responders push / shroud)
  outcome?: SlotResult;       // action hooks: the candidate result (responders may REPLACE → interception)
  rollMods?: RollModifier[];  // 'roll-mode' combine channel accumulator
  // extended per trigger family as needed
}
```

### Interception is free

"Fate overrides your pick" needs no special machinery: at `tarot:pick` the engine sets `draft.outcome = chosenCard`; dispatch runs; Fate's OVERRIDE responder rewrites `draft.outcome = otherCard` and returns a report; the engine commits whatever `draft.outcome` ended up being. Any action hook that exposes `draft.outcome` is interceptable.

---

## 5. Resolution model

Two policies, chosen per responder via its `ResolutionGroup`.

### 5.1 `exclusive` — one effect per priority band

Independent effects (shroud, flip, spawn, override) live here. **Priority bands** double as both the *ordering* mechanism and the *one-per-band cap*:

| Band | Value | For | Examples |
|---|---|---|---|
| `STRUCTURAL` | 100 | change counts / pool size | Will widens pool, Fate thins pool |
| `MUTATE` | 200 | alter an existing item | Shadow shrouds, Critical Resonance, Mirror |
| `SPAWN` | 300 | add a new item | Chaos second result, I Ching happening boost |
| `OVERRIDE` | 400 | replace the outcome | Fate seizes the pick, auto-orient, force-method |

- Bands fire **in order** (`STRUCTURAL` → `OVERRIDE`), so e.g. Will's widen provably precedes Shadow's shroud.
- **At most one** effect fires per band per trigger point. This caps a trigger at ~4 independent events and prevents two effects double-touching the same thing.
- **Tiebreak** when multiple are eligible in one band: **weighted by affinity strength** (the more dominant force wins the band more often); ties random. Interaction responders carry a default weight.

### 5.2 `combine` — a pure reducer nets/cancels modifiers

Stackable modifiers (the dice roll mode) live here and are **exempt from the one-per-band cap**. Each contributor pushes into the channel accumulator (`draft.rollMods`); after all contributors run, the channel's **reducer** collapses them into one resolved effect + one report.

The `roll-mode` reducer is the existing `resolveRollMode`:
- any `choice` **trumps** everything (player picks one of two dice; suppresses offer-reroll);
- else `advantage`/`disadvantage` **net** by count; ties **cancel** to `single`;
- `offer-reroll` surfaces on a single/advantage result.

This is why "advantage from affinity + disadvantage from a card" cancels to one steady cast, and "Will choice" trumps both — without conflicting with one-per-band, because they are a different channel.

### 5.3 Dispatch loop (the single chokepoint)

```
dispatch(trigger, draft):
  ctx        = buildContext(trigger, draft, affinities, slots, hand, event)
  candidates = responders listening to `trigger`
  candidates = debugFilter(candidates)                 // force / suppress  (§6)
  eligible   = candidates.filter(r => r.condition(ctx) && (forced(r) || r.roll(ctx)))

  reports = []
  // exclusive groups, band by band, in order:
  for band in [STRUCTURAL, MUTATE, SPAWN, OVERRIDE]:
     winners = eligible where group = exclusive(band)
     if winners non-empty:
        pick one (weighted by affinity strength; ties random)
        report = winner.apply(ctx)                      // mutates ctx.draft
        if report: reports.push(report)
  // combine channels:
  for channel in channels present among eligible:
     for c in eligible where group = combine(channel): c.apply(ctx)  // push contribution
     report = REDUCERS[channel].reduce(ctx)             // collapses + applies final mutation
     if report: reports.push(report)

  engine reads back ctx.draft (final pool / outcome / mode)
  engine enqueues `reports` for the sequencer (§7)
```

### 5.4 Two builders

- `buildAffinityResponders()` — from affinity effect definitions; `roll` = band-gate × tier-chance; scoped to a section of trigger points. Replaces the scattered `maybe*`/`resolve*` methods.
- `buildInteractionResponders()` — from `INTERACTION_RULES`; `condition` = source/target tag + spread match; `roll` = optional chance.

The dispatcher treats both identically. The `EventBus` is repurposed as the **log + report feed** (debug panel + sequencer source); it no longer pretends to dispatch.

---

## 6. Debug & test harness

```ts
interface DebugConfig {
  forced: string[];   // responder IDs guaranteed to fire on their next trigger (one-shot, then cleared)
  isolate: boolean;   // when true, ONLY forced responders may fire — everything else suppressed
}
```

`debugFilter` is the whole implementation: if `isolate`, drop every non-forced candidate; for a forced candidate, skip `roll()` (but still require `condition()`).

### Scenarios = reset-to-fresh, then stage

```ts
interface DebugScenario {
  id: string; label: string; group: string;
  forced: string[];        // e.g. ['fool-reroll']  — or ['will-choice','shadow-shroud'] for a combo
  isolate: boolean;        // default true
  setup(state): void;      // stage a FRESH game: affinities in-band, slots/hand, screen position, preconditions
}
```

Loading a scenario = `resetToFresh()` (baseline affinities, cleared round + carryover) → `setup(state)` (stage the precondition the effect needs, e.g. "The Fool is in the spread") → write `forced` / `isolate`.

- **Single-effect test:** `forced: ['x'], isolate: true` → fresh game, only `x` can fire, on its next trigger. The behavior you see is unambiguously `x`.
- **Combinations need no special code:** `forced: ['a','b'], isolate: true` tests A+B together and suppresses the rest. Same machinery.

### Testing strategy

Every piece is a pure function:
- `condition(ctx)` and `roll(ctx)` (with a stubbed `ctx.rng`) tested independently.
- `apply(ctx)` tested by asserting the `draft` mutation + the returned `EffectReport`.
- Combine reducers tested in isolation (`resolveRollMode` already is).
- The dispatch loop tested directly: given responders + ctx → assert reports + final draft.
- `debugFilter` tested for force/suppress.
- **Every debug scenario doubles as an integration test** — fresh + forced + isolate is a deterministic fixture, so "does Shadow shroud correctly?" is both a debug button and a test case.

`ctx.rng` is injectable, so engine tests no longer monkeypatch `Math.random` (though the Vitest setup still allows it for legacy paths). Vitest config continues to run `src/engine/__tests__/**` in Node.

---

## 7. Notification flow — resolve first, narrate second

The current code interleaves *applying* an effect with its *animation steps*, a major bug source. The new flow decouples them:

1. **Resolve** — `dispatch` runs synchronously and applies all winners to the `draft`. For draws this happens while items are **face-down**; for an intercepted pick the outcome is already swapped. Logic is done; nothing can desync.
2. **Narrate** — the resolved `EffectReport[]` batch goes into `state.eventQueue`. The sequencer (evolved from `InteractionSequencer`) **auto-plays each report's animation in band order, no per-event tap; a single tap skips the whole remaining sequence.** Skipping skips *visuals only*.
3. **Reveal** — on batch complete/skip, the engine performs the post-batch transition: draw cards **flip up** (showing the shroud already in place), or the screen advances.

```ts
interface EffectReport {
  responderId: string;
  label: string;        // "Shadow"
  description: string;  // "A path is shrouded..."
  animation: string;    // selects an animation: reroll | flip | mirror | add-choice | second-result | shroud | widen | override
  sourceSlot?: number;
  targetSlot?: number;
}
```

So the Will→Shadow batch on the method draw plays as one auto-advancing sequence ("the pool widens" → "a path is shrouded"), then the pool flips face-up with the shroud baked in. In `isolate` mode the batch contains exactly one report, so you see precisely the effect under test. The existing `InteractionAnimations/*` components are reused; new animations (`shroud`, `widen`, `override`) are added.

---

## 8. Migration map & flagged redesigns

### Boundary: event vs continuous

Discrete, observable, one-shot changes → **events (responders)**. Continuous always-on biases → **stay in the data/narrative layer**: RNG weighting (Order → d20 toward center), `readingDetail`, `hintClarity`, `poolPreview`, Light/Shadow narrative tone.

### Migration table

| Effect | Today | New trigger → group | Disposition |
|---|---|---|---|
| Will widens pool | `methodCount` (static) | `select:draw:start` → STRUCTURAL | **convert to event** |
| Fate thins pool | `methodCount` (static) | `select:draw:start` → STRUCTURAL | **convert to event** (competes with Will in-band) |
| Shadow shrouds an option | `veiled` (static, dice-only) | `select:draw:end` → MUTATE | **new/redesign** (method pool only) |
| Fate overrides the pick | `card-swap` + `the-hand-chooses` | `tarot:pick` → OVERRIDE | **merge two into one** band-scaling effect |
| Fate auto-orients | `maybeAutoOrient` | `tarot:orient` → OVERRIDE | port |
| Fate forces the method | `maybeForceMethod` | `select:pick` → OVERRIDE | port |
| Fate hollow reroll | `resolveReroll`/`takeReroll`/`planDiceRoll` | `dice:reroll` → OVERRIDE | **port + untangle** into one interceptor |
| Roll mods: Will choice / Light adv / Shadow disadv / offer-reroll | `AFFINITY_ROLL_MODIFIERS` + `resolveRollMode` | `dice:roll` → **combine(`roll-mode`)** | **already in target shape** — becomes the reference impl |
| Chaos second result | `wild-surge` **and** `chaos-second-result` | `*:commit` → SPAWN | **merge into one**; drop the synthetic `chaos-dominant` tag |
| Chaos happening interrupt | `maybeHappeningInterrupt` | `minigame:end` → SPAWN | port |
| Fool's Reroll | `fool-reroll` rule | `dice:roll` → MUTATE | port (condition: Fool in spread) |
| Critical Resonance (was Critical flip) | `critical-low-flip` rule | `tarot:commit` → MUTATE | **redesign** (see below) |
| I Ching happening boost | `iching-happening-boost` rule | `happening:start` → SPAWN | port |
| Mirror | `mirror-event` rule | `*:commit` → MUTATE | port (keep symmetric, undirected dedup) |
| Peek (Light foresight) | `usePeek` | player action + `*:peek` hook | **stays a player action** + band-gated availability, not auto-fired |
| Will free orientation | `setOrientation` / `free-orientation` | — | **dropped** (see below) |

### Critical Resonance (redesigned)

- **Trigger:** `tarot:commit` (group MUTATE).
- **Condition:** a committed d20 in the spread is critical, and the just-committed tarot is at the matching orientation.
- **Effect:** critical-**low** die + tarot **upright** → invert to **reversed** (the dark omen drags it down); critical-**high** die + tarot **reversed** → invert to **upright** (the bright omen lifts it up).
- **Ordering:** fires on `tarot:commit`, so the die must already be in the spread; a tarot laid before any die won't retrigger when a die later lands. (If order-independence is wanted later, add a `dice:commit` trigger too.)

### Will free orientation — dropped

The base tarot game already lets everyone keep/orient, so the Will event granted what the player already had. **Decision: drop the `free-orientation` event; keep orientation choice in the base game.** Fate's `auto-orient` (which *takes* the choice away) is the meaningful counterpart, so base↔Fate form the real tension. Will's agency stays expressed via offer-reroll / choice / swap-method; it has no tarot-specific event for now, which is acceptable (better than a forced fit).

### Flagged redesigns (summary)

1. **Two second-result spawners** doing the same thing (`wild-surge` + `chaos-second-result`) → one Chaos SPAWN responder; delete the interaction rule and the synthetic `chaos-dominant` tag-injection hack (the new model reads `ctx.affinities.chaos` directly).
2. **`card-swap` vs `the-hand-chooses`** → one Fate OVERRIDE whose aggressiveness scales with band.
3. **`hollow-reroll`** smeared across three methods → one clean `dice:reroll` interceptor.
4. **Recursive chain resolver** (`checkAndResolve` / `MAX_CHAIN_DEPTH`, currently unused and a bug source) → **dropped**. Cross-effect reactions still emerge: a spawned second result *commits*, and that commit re-enters dispatch, so chains arise from re-entry instead of in-trigger recursion.

---

## 9. Future / out of scope

- **Tarot redesign** — "pick N cards from the whole suite." The `tarot:draw:*` trigger points are reserved for it; no responders use them yet.
- **Other minigame redesigns** — each will declare its own namespaced trigger points; the dispatcher needs no changes.
- **Order events** — Order currently has no discrete event (only RNG bias). A future "Order steadies the result" MUTATE responder could be added without engine changes.

---

## 10. Component & file impact (orientation for planning)

- `src/engine/` — new: `EventDispatcher`, `Responder`/`PhaseContext`/`EffectReport`/`ResolutionGroup` types, combine `REDUCERS`, `debugFilter`, the two responder builders. `GameEngine` shrinks to: own state, fire trigger points around lifecycle steps, expose the event queue + debug config. The `maybe*`/`resolve*` methods are replaced by responders.
- `src/data/` — affinity effect definitions and `INTERACTION_RULES` re-expressed as responder configs; `dice-modifiers.ts` (`AFFINITY_ROLL_MODIFIERS` + `resolveRollMode`) becomes the reference combine channel; scenarios re-expressed as `DebugScenario`s.
- `src/components/` — `InteractionSequencer` → a batch sequencer driven by `state.eventQueue` (auto-play, single skip); minigame components fire action trigger points (`dice:roll`, `tarot:pick`, …) instead of calling bespoke engine methods; new animations (`shroud`, `widen`, `override`); debug panel surfaces forced-set + isolate + scenario list.
- `src/engine/__tests__/` — unit tests per responder (`condition`/`roll`/`apply`), reducers, dispatch loop, `debugFilter`, and scenario integration fixtures.
```
