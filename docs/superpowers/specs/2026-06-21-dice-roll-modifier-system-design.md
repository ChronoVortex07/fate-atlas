# Dice Roll-Modifier System — Design

**Date:** 2026-06-21
**Status:** Approved (design); ready for implementation planning
**Scope:** The d20 dice minigame and the engine that drives it. No changes to Tarot or I Ching.

## Problem

The dice minigame has accumulated several overlapping "reroll-ish" mechanics that were
wired ad hoc:

- **Optional reroll (Will)** — pre-commit `Keep`/`Reroll` buttons (`offerReroll` / `resolveReroll`).
- **Forced reroll (interaction, e.g. The Fool)** — post-commit, `executeEffect('reroll')` redraws
  the die in place, shown via the `InteractionSequencer`.
- **Keep one of two (Will Dominant)** — `maybeKeepOneOfTwo` returns two candidates, but is **never
  wired into the UI**.

We also want two new mechanics — **roll with advantage** and **roll with disadvantage** (two dice,
take the higher / lower) — and the user wants these to be triggerable by **any** affinity or
interaction, so new features are cheap to add later. "Keep one of two" is really the player-pick
variant of advantage/disadvantage.

The current per-mechanic wiring is buggy and does not generalize. We want a single, declarative
trigger→mechanic layer for the dice domain.

## Approach

**Approach A — a roll-planning layer (chosen).** Before a die is shown, the engine resolves all
active *roll modifiers* from any source into a single **roll plan**; the dice minigame renders that
plan. Triggers are declarative (an affinity table) or tag-driven (interaction pending effects), so
adding a trigger later is one row or one rule.

Rejected for now: **Approach B — full effect-bus unification** across all divinations and both
pre/post-commit timings. It matches the long-term goal ("any affinity or interaction can trigger any
mechanic, everywhere") but is a large, risky rewrite. See **Future work**. Also rejected: **Approach
C — minimal hardcoded `if`-checks**, which is exactly the scattered wiring we're removing.

## Model

### Roll modifiers

A roll carries zero or more **modifiers**, each one of:

```ts
type RollModifier = 'advantage' | 'disadvantage' | 'choice' | 'offer-reroll';
type RollMode     = 'single' | 'advantage' | 'disadvantage' | 'choice';
```

### Combination rule (pure)

`resolveRollMode(mods: RollModifier[]): { mode: RollMode; offerReroll: boolean }`

1. If any `choice` is present → `mode = 'choice'` (player pick wins over everything).
2. Otherwise net = `count('advantage') − count('disadvantage')`:
   - `> 0` → `'advantage'`
   - `< 0` → `'disadvantage'`
   - `= 0` → `'single'` (advantage and disadvantage cancel out, D&D-style)
3. `offerReroll = mods.includes('offer-reroll')`, but is **suppressed when `mode === 'choice'`**
   (the pick is already the act of agency).

This function is pure and unit-tested in isolation.

### The roll plan

```ts
interface RollPlan {
  mode: RollMode;
  offerReroll: boolean;
  sources: string[]; // human-readable, for a caption e.g. "Light favors you"
}

planDiceRoll(): RollPlan
```

`planDiceRoll()` gathers modifiers from the two generic sources below into a single
`RollModifier[]`, runs `resolveRollMode(mods)`, and attaches `sources` for narration. The
`offerReroll` flag is owned entirely by `resolveRollMode`: when the existing `offerReroll()` returns
`true`, `planDiceRoll` appends `'offer-reroll'` to `mods`, and `resolveRollMode` decides the final
flag (including suppression in `choice` mode). Nothing sets `offerReroll` outside `resolveRollMode`.

## Trigger sources

Both source types contribute to the same modifier list consumed by `resolveRollMode`.

### 1. Affinity table (declarative, state-like)

New data file `src/data/dice-modifiers.ts`:

```ts
interface AffinityRollModifier {
  affinity: AffinityId;
  minBand: AffinityBand;
  modifier: RollModifier;
  source: string; // caption text
}

export const AFFINITY_ROLL_MODIFIERS: AffinityRollModifier[] = [
  { affinity: 'light',  minBand: 'ascendant', modifier: 'advantage',    source: 'Light favors you' },
  { affinity: 'shadow', minBand: 'ascendant', modifier: 'disadvantage', source: 'Shadow clouds the cast' },
  { affinity: 'will',   minBand: 'dominant',  modifier: 'choice',       source: 'Your will seizes the cast' },
  // offer-reroll stays on the existing probabilistic offerReroll() path (see below).
];
```

A modifier from this table applies **deterministically while the affinity is at or above `minBand`**
(a *state*, not a random per-roll event). This is a deliberate divergence from the probabilistic
band-gated agency events (`forcedOrRoll`), because advantage/disadvantage/choice read more clearly as
persistent states than as surprises. They remain **debug-forceable** via `debugForcedEffect`
(`'advantage'`, `'disadvantage'`, `'choice'`), so a scenario can force one without setting the
affinity.

**`offer-reroll` is the exception:** it is not in the table. It keeps the existing probabilistic
`offerReroll()` (Will Stirring, Notable base chance) so current balance is unchanged. `planDiceRoll()`
appends `'offer-reroll'` to the modifier list when `offerReroll()` returns `true` (that method already
honors the `offer-reroll` and `hollow-reroll` debug flags).

### 2. Pending effects (interactions / cards)

`PendingEffect['action']` gains `'advantage' | 'disadvantage' | 'choice'`. A pending effect whose
action is one of these and whose `triggerTags` match the upcoming die (`'roll'` / `'numeric'`)
contributes that modifier at roll-planning time. This reuses the existing tag-driven mechanism; a new
card/interaction trigger is just a new `InteractionRule` (or seeded `PendingEffect`) with the action.

Unlike post-commit pending effects (reroll/flip/mirror/second-result, applied in `executeEffect`),
roll-modifier pending effects are **consumed at `planDiceRoll()` time** (pre-roll), and removed from
`pendingEffects` when consumed.

## Engine API

```ts
// pure
resolveRollMode(mods: RollModifier[]): { mode: RollMode; offerReroll: boolean }

// aggregates affinity table + matching pending effects, applies resolveRollMode
planDiceRoll(): RollPlan

// rolls two d20s via the orchestrator; keptIndex is the auto-kept die for
// advantage/disadvantage, or null for choice (player picks)
rollDicePair(mode: 'advantage' | 'disadvantage' | 'choice'):
  { dice: [DiceResult, DiceResult]; keptIndex: 0 | 1 | null }

// already implemented — the offered-reroll path (Fate may make it hollow)
resolveReroll(current: DiceResult): { result: DiceResult; hollow: boolean }
```

`rollDicePair` ties (equal values) resolve to `keptIndex = 0` for advantage/disadvantage.

`maybeKeepOneOfTwo` is **removed**, superseded by `choice` mode + `rollDicePair`. Its test moves to
cover `planDiceRoll` returning `mode: 'choice'` and `rollDicePair('choice')`.

## Dice minigame UX

`DiceMinigame` calls `planDiceRoll()` to decide how to present the throw.

- **single** — unchanged: one die throws, reveals, then auto-commits after the reveal beat or shows
  the offered-reroll prompt.
- **advantage / disadvantage** — `rollDicePair(mode)` yields two dice + `keptIndex`. Both dice roll
  side by side (`DiceThrowAnimation` each). After they settle, the kept die (higher for advantage,
  lower for disadvantage) scales up and glows while the other dims and tucks behind it. A caption
  shows the source (`plan.sources`), e.g. *"Light favors you — advantage."* Then the offered-reroll
  prompt appears if `plan.offerReroll`; otherwise it auto-commits the kept die.
- **choice** — two dice settle, both stay lit and tappable, caption *"Keep one — your will decides."*
  The player taps one; the other fades; commit.

```
throw → [ 14 ] [ 7 ]   →   [ 14 ]  ·7·   →   result 14   (+ Keep/Reroll if offered)
        both roll             higher holds      (disadvantage = lower holds)
```

**Timing:** every transition into `completeMinigame` waits `REVEAL_DELAY_MS` so animations finish
before the screen changes (the same discipline applied to the reroll-timing bug fix).

**Veiled (Shadow) interplay:** Shadow Ascendant confers both `disadvantage` and the existing veiled
pool-preview (`poolPreview === 'hidden'`). The dice values still show for the merge; only the
threshold/interpretation stays shrouded until commit, exactly as today.

## Affinity feeds

Derived from how the result was reached (via `completeMinigame` meta):

| Outcome | Meta | Feeds |
|---|---|---|
| Accept single / advantage / disadvantage result | `revealedAsDrawn` | Fate |
| Take an offered reroll | `viaReroll` | Will (Fate may make it hollow) |
| Pick a die in `choice` mode | `viaReroll` | Will |

The *conferred* modifier itself (e.g. advantage from Light) does **not** feed an affinity — it is an
outcome/state, consistent with how Fate's auto-orient does not feed when it decides for the player.

## Forced reroll (The Fool)

Unchanged. It remains a **post-commit** interaction: `executeEffect('reroll')` redraws the committed
die in place, surfaced through the `InteractionSequencer`. It is documented here as the fourth reroll
type for completeness. (Under Approach B it could later become a pre-roll modifier too.)

## Testing

Per CLAUDE.md, Vitest covers the engine/data layer only; components are **build-verified** (`tsc -b`).

**Engine unit tests:**
- `resolveRollMode`: choice priority; advantage+disadvantage cancel to single; net advantage / net
  disadvantage; `offer-reroll` suppressed in choice mode; tie handling.
- `rollDicePair`: returns the higher die for advantage and the lower for disadvantage (stub
  `Math.random`); `keptIndex === null` for choice.
- `planDiceRoll`: affinity table → mode (Light→advantage, Shadow→disadvantage, Will Dominant→choice);
  `debugForcedEffect` forces a mode; a matching pending effect contributes a modifier and is consumed;
  advantage + disadvantage from different sources cancel.

**Debug scenarios** (`src/engine/scenarios.ts`):
- `dice-advantage` — Light Ascendant (or debug-force `advantage`).
- `dice-disadvantage` — Shadow Ascendant.
- `dice-choice` — Will Dominant (replaces `will-keep-one-of-two`).
- `dice-disadvantage-interaction` — a pending effect confers `disadvantage`, proving the interaction
  path.
- Keep the existing offered-reroll and hollow-reroll scenarios.

All new scenarios must establish the turn baseline already added to `loadScenarioById` (questionType
+ method pool) so they don't crash on completion.

## Scope / non-goals

- No generalization to Tarot or I Ching mechanics (that is Approach B).
- Happenings remain affinity-only (no gameplay effects yet).
- The Fool's forced reroll stays post-commit.

## Future work (Approach B)

Unify **all** game effects — pre- and post-commit, across every divination — through a single
modifier registry/bus so that any affinity or interaction can trigger any mechanic everywhere. This
should be done soon: the current ad-hoc agency/interaction wiring is buggy and hard to extend. The
dice affinity table + `planDiceRoll` layer built here is the prototype to generalize from.
