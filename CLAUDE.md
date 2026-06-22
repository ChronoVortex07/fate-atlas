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

- **`TurnOrchestrator`** — generates the 3-slot `pool` (weighted by question type, see `QUESTION_WEIGHTS`), and draws/reveals slots by calling into the data layer.
- **`InteractionResolver`** — the meta-event engine. Matches `INTERACTION_RULES` against revealed slots and recurses for chain reactions (capped at `MAX_CHAIN_DEPTH = 3`, deduped per source→target pair).
- **`AffinityEngine`** — tracks chaos/order (0.0–1.0). `apply()` nudges values by `CHANGE_PER_MATCH` per matching tag; values clamp to [0,1] rounded to 2 decimals.
- **`TagSystem`** — pure tag predicates (`hasAllTags`, etc.). This is the matching primitive everything else uses.
- **`SynthesisEngine`** — turns final slots into the reading text and the copy-paste LLM prompt.
- **`EventBus`** — append-only event log; `getHistory()` feeds `state.eventLog` (drives the debug panel).

### Tag-driven interactions (the key extensibility pattern)

Interactions match entities by **tags, not IDs** ([src/data/interactions.ts](src/data/interactions.ts), `InteractionRule` in [src/engine/types.ts](src/engine/types.ts)). A rule fires when a revealed slot has all `trigger.sourceTags` and some other slot has all `target.tags`. Consequently, **adding a new card/divination type with the right tags automatically participates in existing rules** — no rule edits needed. Conversely, changing the tags a data file emits can silently enable or break interactions.

Two special cases in the resolver to be aware of:
- `chaos-dominant` is a synthetic source tag injected by the resolver when `affinities.chaos >= 0.5` (it is not on any entity).
- `chaos-second-result` is gated by a `Math.random() > 0.15` chance check inside the resolver.

### Turn lifecycle & gotchas

Flow: `startTurn` → `drawSlot`/`revealSlot` (×3) → `synthesize` → `triggerHappening` → `resolveHappening`. Notable non-obvious behavior:

- **Interactions resolve eagerly inside `revealSlot()`**, not in a separate phase. `resolveAllInteractions()` is just a finalizing `notify()` for the interaction screen.
- **Happenings are special.** A `happening` slot drawn during the draw phase is only a placeholder (`id: 'pending'`); the real happening is selected later in `triggerHappening()` via `selectHappening()`. Happening slots are **filtered out** of synthesis and run records, and **do not** accumulate affinity on reveal — only happening *choices* shift affinity.
- **Carryover vs. turn state.** `affinities`, `history`, and `usedHappeningIds` persist across runs (localStorage key `fate-atlas-save`); everything else resets each turn. `reset`, `returnToTitle`, and `returnToQuestionSelect` all deliberately preserve carryover — preserve this distinction when adding state.

### Data layer (`src/data/`)

Content lives in typed TS objects (tarot, dice, iching, happenings, interactions, affinities). The `drawTarotCard` / `rollD20` / `castHexagram` functions **take the current affinities** and bias their RNG accordingly (e.g. order pulls d20 toward center, chaos toward extremes — see [src/data/dice.ts](src/data/dice.ts)). When adding content, the result object must carry the tags that interaction rules and the affinity engine key off of.

## Tests

Vitest is configured ([vitest.config.ts](vitest.config.ts)) to run **only `src/engine/__tests__/**`** in a Node environment with globals enabled. [vitest.setup.ts](vitest.setup.ts) provides an in-memory `localStorage` polyfill. Tests cover the engine and data layer only — there are no component tests. Because draws and several rules use `Math.random()`, tests that assert on randomness stub `Math.random`.
