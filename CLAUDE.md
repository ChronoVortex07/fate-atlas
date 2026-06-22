# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Atlas of Fate is a browser divination game (React 18 + TypeScript + Vite) that fuses Tarot, d20, and I Ching into a roguelike reading loop. The README has the player-facing details (gameplay flow, rule tables, debug panel, theme colors); this file covers what you need to work in the code.

## Documentation (keep in sync)

The behavior of the **affinities, per-band effects, meta-interactions, and happenings** is documented in [docs/game-systems.md](docs/game-systems.md) — the authoritative, hand-maintained reference. **When you change any of these systems — `src/data/affinities.ts` (affinities, bands, feeds, tuning), `src/data/happenings.ts`, `src/engine/AffinityEngine.ts` (shift math, static effects), `src/engine/responders/affinity.ts` or `src/engine/responders/interactions.ts` (event-driven effects), or `src/engine/events/reducers.ts` — update `docs/game-systems.md` (and the matching README sections) in the same change.**

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server → http://localhost:5173 |
| `npm run build` | `tsc -b && vite build` — typecheck then bundle to `dist/` |
| `npm test` | Run the engine test suite once (Vitest) |
| `npm run test:watch` | Vitest watch mode |

Run a single test file: `npx vitest run src/engine/__tests__/IChing.test.ts`
Run tests matching a name: `npx vitest run -t "chaos"`

There is no ESLint/Prettier config — type safety is enforced by `tsc` with `strict`, `noUnusedLocals`, and `noUnusedParameters` all on. Run `npm run build` (or `npx tsc -b`) to typecheck.

## Architecture: engine / React split

The core design constraint: **all game logic lives in `src/engine/` as framework-free TypeScript with zero React or DOM imports.** React only renders state and forwards user actions. Keep it that way — logic changes go in the engine, not in components.

- **`GameEngine`** ([src/engine/GameEngine.ts](src/engine/GameEngine.ts)) is the façade and single source of truth. It owns a mutable `this.state`, composes the subsystems below, and is the only class React talks to.
- The React bridge is **`EngineProvider`** ([src/context/EngineContext.tsx](src/context/EngineContext.tsx)), which instantiates one `GameEngine` and exposes it via `useSyncExternalStore`. Components call `const { state, engine } = useGameEngine()` ([src/hooks/useGameEngine.ts](src/hooks/useGameEngine.ts)), read `state`, and invoke methods on `engine`.
- **Snapshot contract:** the engine mutates `this.state` internally but never hands it out. Every mutator ends with `notify()`, which deep-clones state into `cachedSnapshot` and pushes it to subscribers. `getState()` returns the immutable snapshot. React relies on this clone for change detection — a mutator that forgets `notify()` will not re-render.

### Engine subsystems (all in `src/engine/`)

- **`TurnOrchestrator`** — generates the method `pool` (`DivinationType[]`, weighted by question type via `QUESTION_WEIGHTS`), draws single results (`drawSingleResult`), and refills/prunes the pool between readings (`refillPool`, `removeUsedMethod`).
- **`AffinityEngine`** — tracks the six affinities (0–100, baseline 50). `shift()` is the single mutation chokepoint: gains pass diminishing-returns → jitter → coupling fan-out (opposite −60%, others −35%); penalties apply directly. `applyResultTags`/`applyAction` feed it; `getEffects()` derives the static per-band modifiers (hand size, method count, hint clarity, pool preview, peek).
- **Event dispatch (`src/engine/events/`)** — the effect engine that replaced the old InteractionResolver. `dispatch()` ([EventDispatcher.ts](src/engine/events/EventDispatcher.ts)) runs **`Responder`s** at namespaced triggers; `eligibility.ts` holds the `bandRoll` chance gate; `reducers.ts` collapses `combine` channels; `scenarios.ts` defines the debug `DEBUG_SCENARIOS`.
- **Responders (`src/engine/responders/`)** — `affinity.ts` (band-gated affinity effects) and `interactions.ts` (tag/spread-matched meta-interactions). These produce the effects catalogued in [docs/game-systems.md](docs/game-systems.md).
- **`ReadingPlanner`** — analyzes thematic/dimension/modifier gaps in the committed results (`analyzeGaps`), biases pool refills toward them (`getBiasForRefill`), and builds the final reading summary (`aggregate`).
- **`NarrativeAssembler`** — turns the aggregated reading into synthesis text (`assemble`) and the copy-paste LLM prompt (`generateLLMPrompt`).
- **`EventBus`** — append-only event log; `getHistory()` feeds `state.eventLog` (drives the debug panel).

### Event-driven effects (the key extensibility pattern)

Effects are **`Responder`s** ([src/engine/events/types.ts](src/engine/events/types.ts)) invoked by `dispatch()` at namespaced triggers (`select:draw:start`, `select:pick`, `tarot:commit`, `dice:roll`, `minigame:end`, …). Each has:

- **`condition(ctx)`** — structural precondition, *always* required;
- **`roll(ctx)`** — probabilistic gate (affinity responders use `bandRoll`); **bypassed when forced**;
- **`apply(ctx)`** — mutates `ctx.draft` and returns an optional `EffectReport`.

Resolution: exclusive responders compete within priority bands **STRUCTURAL → MUTATE → SPAWN → OVERRIDE** (one weighted winner per band); `combine` responders (channel `roll-mode`) all contribute and a reducer collapses them. Reports queue onto `state.eventQueue`; the `InteractionSequencer` auto-plays them — **resolve first, narrate second**.

Because interaction responders match by **tags on the spread** (committed slots + hand), **adding a new card/divination type with the right tags automatically participates** — no responder edits needed. Conversely, changing the tags a data file emits can silently enable or break interactions and affinity feeds.

> The full behavior catalogue — every affinity band, effect, meta-interaction, and happening — lives in [docs/game-systems.md](docs/game-systems.md). Keep it in sync (see the Documentation note above).

### Turn lifecycle & gotchas

Flow: `startTurn` → `selectMethod` → minigame play → `completeMinigame` (×3) → final synthesis → `result`; happenings interleave via `triggerHappening`/`resolveHappening`. Notable non-obvious behavior:

- **Effects resolve at commit, narrate after.** `completeMinigame` dispatches `*:commit` synchronously (flips/rerolls/spawns happen immediately), but if that queues any `EffectReport`s the post-commit transition is **deferred** (`runOrDefer`) so the screen freezes until the sequencer drains the batch via `finishEventBatch()`. Anything that must advance *after* narration routes through this.
- **Forced ≠ unconditional.** The debug panel's `forced`/`isolate` (`state.debugConfig`) bypasses a responder's `roll`, but **never** its `condition`. Every `DEBUG_SCENARIOS` entry must stage the precondition (slots/screen/affinity) the condition needs.
- **Happenings are special.** The real happening is selected in `triggerHappening()` via `selectHappening()`. Happening slots are **filtered out** of synthesis and run records, and **do not** accumulate affinity on reveal — only happening *choices* shift affinity.
- **Per-turn effect log.** `turnEffects` accumulates every `EffectReport` of the turn and is stored on the `RunRecord` (drives the history badge + the LLM prompt's Meta Events).
- **Carryover vs. turn state.** `affinities`, `history`, and `usedHappeningIds` persist across runs (localStorage key `fate-atlas-save`); everything else (including `turnEffects` and `eventQueue`) resets each turn. `reset`, `returnToTitle`, and `returnToQuestionSelect` all deliberately preserve carryover — preserve this distinction when adding state.

### Data layer (`src/data/`)

Content lives in typed TS objects (`tarot`, `dice`, `iching`, `happenings`, `affinities`, plus `dice-modifiers`, `divination-profiles`, `narrative-templates`, `constellations`). The `drawTarotCard` / `rollD20` / `castHexagram` functions **take the current affinities** and bias their RNG accordingly (e.g. order pulls d20 toward center, chaos toward extremes — see [src/data/dice.ts](src/data/dice.ts)). When adding content, the result object must carry the tags that responders and the affinity engine key off of.

## Tests

Vitest is configured ([vitest.config.ts](vitest.config.ts)) to run **only `src/engine/__tests__/**`** in a Node environment with globals enabled. [vitest.setup.ts](vitest.setup.ts) provides an in-memory `localStorage` polyfill. Tests cover the engine and data layer only — there are no component tests. Because draws and several rules use `Math.random()`, tests that assert on randomness stub `Math.random`.
