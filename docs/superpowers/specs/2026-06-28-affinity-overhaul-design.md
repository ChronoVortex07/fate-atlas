# Affinity Overhaul — Design Spec

**Date:** 2026-06-28
**Status:** Approved design, ready for Phase 1 implementation planning
**Scope:** One spec, phased build. Phase 1 is planned/built first; Phases 2–3 are
designed here and planned as we reach them. The *Seed of Corruption* is explicitly
out of scope (a future Phase 4 hook).

---

## 1. Terminology

| Term | Meaning |
|------|---------|
| **Run** / **turn** | One question → 3 readings → synthesis cycle. `GameEngine.startTurn` calls `AffinityEngine.beginRun`; they are the same boundary. |
| **Reading** | One minigame (3 per turn). The atomic unit where bands and effects are evaluated. |
| **Base** | The permanent, persisted affinity value (0–100, baseline 50). |
| **Effective** | What the game *acts on*: `base + surges`, then upheaval transforms. Bands, effects, hints all read this. |

---

## 2. Problem & diagnosis

Two problems, one root cause.

**A. One affinity (Chaos) runs away; others (esp. Order, Light, Shadow) barely move.**
Affinities are fed two incompatible ways:

- **Chaos & Order** are fed by *result tags* — they accrue **passively** on every draw,
  no player intent involved. Critically, the `random` tag (Chaos +5) is emitted by
  **almost every non-tarot method** (d20, I Ching, astromancy, runes), so Chaos climbs on
  nearly every reading just by playing.
  ([`src/data/affinities.ts`](../../../src/data/affinities.ts) `CHAOS_AFFINITY.feeds.tags`,
  [`src/engine/AffinityEngine.ts`](../../../src/engine/AffinityEngine.ts) `applyResultTags`)
- **Fate, Will, Light, Shadow** only move on *deliberate choices*. Worse, **Order has no
  behavior feed at all**, and **Light's richest feed (peek) is self-gated** —
  `peekAvailable()` requires Light ascendant+, so you must already have Light to peek, and
  peeking is the main way to feed Light.

Net: affinity tracks **RNG outcomes**, not "what the player likes to do."

**B. Maxing out (reaching `dominant`, 82+) is too hard, so players rarely see high-band
mechanics.** Three forces fight accumulation simultaneously: diminishing returns
(−8%/feed), 33% drift back to baseline each turn, and coupling fan-out (every gain pushes
the opposite −60% and the other four −35%). Reaching `dominant` means netting +32 against
all three.

---

## 3. Approved design decisions

| Decision | Choice |
|----------|--------|
| **Feed model** | **Hybrid: behavior-led, tags capped.** Behavior is the main driver for all six affinities; results still nudge Chaos/Order but under a hard per-turn cap so passive RNG can never dominate. |
| **Band structure** | **Two layers: base + surge.** A permanent base that climbs slowly from long-term preference, plus a temporary surge layer that spikes on top and decays. Bands read from base + surge. |
| **Happening effects** | **All four categories** in scope: affinity surges, reading effects, upheavals, costs/gambles. |
| **Upheavals** | **Temporary** (invert/scramble *effective* values for a few readings, then revert), fired by **opt-in** happening choices and **emergent** at extremes. Permanent destruction is left to the later corruption seed. |
| **Temporary-layer representation** | **Unified timed-modifier list.** One list of active modifiers (additive surge / transform upheaval) with per-entry lifetime; absorbs surges, upheavals, and later the corruption seed. |
| **Packaging** | One spec, phased build; plan Phase 1 first. |

---

## 4. Phase breakdown

- **Phase 1 — Affinity-model foundation** (planned & built first): two-layer base+surge
  state, unified modifier list, hybrid behavior-led feeds, capped Fortune tag feeds,
  retuned drift/coupling/DR.
- **Phase 2 — Happenings overhaul**: richer happening data model carrying the four effect
  categories, engine resolution, decoupled cadence, play-style-weighted selection, UI.
- **Phase 3 — Upheavals**: temporary effective-value transforms built on Phase 1's
  modifier framework, opt-in (happenings) + emergent (extremes) triggers, narration.
- **Phase 4 — Seed of Corruption** *(out of scope; noted as a hook so the architecture
  leaves room)*: a counter to all six affinities that plugs into the same modifier list.

---

## 5. Phase 1 — Affinity-model foundation

### 5.1 State shape (`AffinityEngine`)

```ts
base: Record<AffinityId, number>          // permanent 0–100; the ONLY serialized affinity state
modifiers: AffinityModifier[]             // run-scoped, NOT serialized (lost on reload)

interface AffinityModifier {
  id: string;
  kind: 'surge' | 'transform';
  payload: SurgePayload | TransformPayload;
  readingsRemaining: number;
  source: string;                         // e.g. 'happening:falling-star'
}

type SurgePayload     = { deltas: Partial<Record<AffinityId, number>> };
type TransformPayload = { transform: 'invert-pair' | 'invert-all' | 'scramble'; axis?: AffinityAxis };
```

- `shift()` continues to mutate **base** only.
- `beginRun()` drifts **base** toward baseline and resets per-turn counters, but **does not
  clear** `modifiers` (they decay per reading, surviving turn boundaries within a session).
- The I Ching **Mandate** (multiplicative `gainMult`) may remain as-is alongside, or fold
  into the modifier list as a `kind: 'mandate'` entry — implementer's call during planning;
  the list is designed to accommodate it.

### 5.2 Effective values

```
effective(id) = clamp(base[id] + Σ surge deltas for id)   // additive layer
then apply transform modifiers in list order               // upheaval layer (Phase 3)
```

- `getState()` returns **effective**, so every existing `bandOf` / `getEffects` / hint
  consumer keeps working unchanged.
- New `getBase()` exposes the permanent value for the few places that need it (drift, save,
  debug panel).
- `bandOf` reads effective.

### 5.3 Surges

- **Magnitude:** +20 to +35 to one affinity (vs. permanent feeds of +5–6). The headline
  band-vaulting mechanic.
- **Lifetime:** measured in **readings**; default ~3. **Step-down decay**
  (e.g. 100% → 66% → 33% → gone) so high-band access tapers rather than snaps.
- **Ticking:** decremented once per `completeMinigame` (per reading).
- **Persistence:** survives turn boundaries within a session; **not** serialized (reload
  drops surges — base is what persists).
- **Stacking:** multiple surges stack additively and expire independently.

### 5.4 Hybrid behavior-led feeds

**Three axes, each fed by a kind of choice:**

| Axis | Meaning | Poles |
|------|---------|-------|
| **Agency** (Fate/Will) | who decides | accept-given → Fate · assert-control → Will |
| **Information** (Light/Shadow) | reveal vs. conceal | seek-clarity → Light · embrace-mystery → Shadow |
| **Fortune** (Chaos/Order) | what outcome you steer toward | embrace-change/volatility → Chaos · choose-stability/measure → Order |

**Dual-axis feeds.** A single choice may feed **at most two axes** — one **primary (+6)**
and one **secondary (+3)** — picked by its dominant character. No triple-feeds (legibility
cap). The engine already supports primary+secondary (`ActionFeed`); extend it so the
secondary may be a Fortune or Information affinity.

Representative mapping (full per-action table finalized in the Phase 1 plan):

| Choice | Primary | Secondary |
|--------|---------|-----------|
| Invert Meaning (reverse spread) | Will | **Chaos** |
| Reveal as Drawn | Fate | **Shadow** *(only if a peek was available but unused)* |
| Accept the Change (relating hexagram) | Will | **Chaos** |
| Hold the Moment (primary hexagram) | Fate | **Order** |
| Take reroll / recast / reshuffle | Will | **Chaos** |
| Decline reroll / keep first | Fate | **Order** |
| Swap method | Will | — |
| Set orientation yourself | Will | — |
| Peek / study a card | **Light** | — |
| Seek the pattern / examine spread breakdown | **Light** | — |
| Decline an offered peek | **Shadow** | — |
| Embrace mystery / commit veiled | **Shadow** | — |

**Ungate entry-level Light/Shadow.** Peek's *power* (foresight) stays Light-gated, but the
*act of seeking* must not require already having Light. Add an always-available, low-cost
**"study / look closer"** affordance at reveal that feeds Light a little; committing blind
or leaving a card veiled feeds Shadow. This gives the Information axis an ungated
behavioral surface so preference can build it from baseline — symmetric with Order now
having real behavior feeds.

### 5.5 Capped Fortune tag feeds (the "results still nudge" half)

- **Drop `random` from Chaos** entirely — it is on every non-tarot draw, is not a player
  choice, and is the runaway culprit.
- Chaos tag feeds → `reversed`, `changing-lines`; Order tag feeds → `upright`, `stable`.
- **All Fortune *tag* feeds share a per-turn cap (~+8 total)**, including the all-upright →
  Order and all-reversed → Chaos spread-coherence bonuses
  ([`docs/game-systems.md`](../../game-systems.md) §4g). Passive outcomes nudge Fortune but
  never drive it.
- Behavior feeds are **uncapped** (diminishing returns still applies).

### 5.6 Maxing retune (starting playtest numbers)

| Constant | Today | Proposed | Why |
|----------|-------|----------|-----|
| `RUN_DRIFT` | 0.33 | **~0.12** | Preference carries between turns instead of being wiped (biggest lever). |
| `COUPLING_OPPOSITE` | 0.60 | **~0.35** | Opposite pole still trades off meaningfully (the pair fantasy). |
| `COUPLING_OTHER` | 0.35 | **~0.15** | Building one affinity no longer craters the *other two pairs* — multiple affinities can be up at once. |
| `DR_FLOOR` | 0.30 | **~0.50** | Sustained preferred play keeps yielding. |
| `DR_STEP` | 0.08 | **~0.05** | Slower diminishing returns within a turn. |

All numbers are starting points to playtest; the spec fixes the *direction* of each lever,
not a final value.

### 5.7 Phase 1 integration points

- `AffinityEngine`: state split, `getBase()`, modifier list, surge add/tick/expire, feed
  changes, retune constants ([`src/data/affinities.ts`](../../../src/data/affinities.ts)
  tuning + `ACTION_FEEDS` + per-affinity `feeds.tags`).
- `GameEngine`: tick modifiers in `completeMinigame`; expose surges/base to the snapshot;
  surface a `grantSurge` path (used by Phase 2 happenings and any responder).
- Snapshot/serialization: `serialize`/`loadFrom` persist **base** only; effective values
  flow through `getState()`. Confirm the debug panel reads base where it shows raw numbers.

---

## 6. Phase 2 — Happenings overhaul

### 6.1 Data model

A choice becomes `{ text, effects: HappeningEffect[] }`; one choice can carry several
effects (trade-offs emerge from combining a reward with a cost):

```ts
type HappeningEffect =
  | { kind: 'shift';    affinity: AffinityId; amount: number }                 // permanent nudge (today's behavior)
  | { kind: 'surge';    deltas: Partial<Record<AffinityId, number>>; readings: number }
  | { kind: 'reading';  effect: ReadingEffectId }                              // modify the next reading(s)
  | { kind: 'cost';     affinity: AffinityId; amount: number }                 // a drain (negative)
  | { kind: 'gamble';   outcomes: { weight: number; effects: HappeningEffect[] }[] }
  | { kind: 'upheaval'; transform: TransformPayload; readings: number };       // Phase 3 (data stubbed here)
```

### 6.2 Reading effects

Reuse the existing draft/responder vocabulary via a small `state.pendingReadingEffects`
queue that the next minigame consumes at its relevant trigger — **no new effect engine,
just queued flags**:

| `ReadingEffectId` | Maps onto |
|-------------------|-----------|
| `force-method` / `add-method` | `methodPool` / `poolTarget` (cf. `will-widen-pool`) |
| `guarantee-peek` / `deny-peek` | one-reading bypass/disable of the Light peek gate |
| `grant-reroll` | `offer-reroll` roll modifier |
| `spawn-second` | `spawnSecond` |
| `shroud-card` | `shrouded` (cf. `shadow-shroud`) |
| `widen-pool` | `poolTarget + 1` |

### 6.3 Example reworked happening

> *A star tears across the sky…*
> - "Make a wish on the falling light." → **Chaos surge +30 / 3 readings**, *cost* Order −10
> - "Chart its arc — find the pattern." → **Light surge +25 / 3 readings** + next reading **peek guaranteed**
> - "Look away; let it pass." → safe permanent **Order +6**

All eight existing happenings are reworked to this model; new ones may be added.

### 6.4 Cadence & selection

- **Decouple from Chaos-only gating.** Today happenings fire only via
  `chaos-happening-interrupt` (Chaos ascendant). Instead, a happening is offered
  **~once per turn**, between readings, **never on the last reading** (so the granted effect
  has a reading to land on).
- `selectHappening` weights scenes by the player's **dominant axis** (data-driven via
  per-happening axis tags) so the scenes you meet reflect your leanings.
- Preserve the existing changing-lines hidden-bonus-choice interaction
  (`iching-happening-boost`, [`docs/game-systems.md`](../../game-systems.md) §6).

### 6.5 UI / narration

- Stay true to "**never show raw numbers**": choices show **atmospheric flavor** with a
  subtle category cue telegraphed in fiction (cost → "a price will be paid"; upheaval →
  "the weave may tear"; gamble → "fortune decides").
- Resolution narrates through the existing event sequencer / `EffectReport` pipeline.
- `HappeningScene` ([`src/components/screens/HappeningScene.tsx`](../../../src/components/screens/HappeningScene.tsx))
  updated to render effect flavor and route resolution.

---

## 7. Phase 3 — Upheavals

### 7.1 Mechanic

A `transform` entry in the unified modifier list, applied to **effective** values *after*
surges, for a fixed number of readings, then it expires and values **snap back** (a
**cliff**, not a step-down).

| Transform | Effect on effective values |
|-----------|----------------------------|
| `invert-pair: <axis>` | Both members of one polar pair flip `v → 100 − v` (dominant pole becomes recessive) |
| `invert-all` | All three pairs invert at once — total inversion |
| `scramble` | Effective values randomly redistributed — a chaotic reshuffle |

### 7.2 The base-untouched invariant

`shift()` still writes **base** during an active upheaval; a transform only bends what
`getState()` / bands / effects / hints *see*. The player keeps feeding their true
preference underneath; when the upheaval lifts, real values resurface. Upheavals create
drama **without corrupting long-term progression** (and without colliding with the later
corruption seed).

### 7.3 Triggers

- **Opt-in:** a happening choice with `{ kind: 'upheaval', transform, readings }` — the
  risky branch.
- **Emergent:** a responder (e.g. at `*:commit` / `minigame:end`) whose **condition** is
  "an *effective* affinity sits at the extreme top of dominant (≈95+) **and** no upheaval
  is already active," rolling a small per-reading chance. Lean too hard into one pole and
  reality flips. The "no active upheaval" guard prevents flapping. Threshold and odds are
  tunable; default **rare**.

### 7.4 Narration

- A dramatic beat through the existing report → sequencer pipeline
  (`animation: 'upheaval'`).
- Active-upheaval hints reflect the inverted reality.

---

## 8. Out of scope (future hook)

**Phase 4 — Seed of Corruption:** a counter to all six affinities. Not designed here. The
unified modifier list and the base/effective split are deliberately built to accommodate it
(it can plug in as another modifier kind and/or a base-side drain) without re-architecting.

---

## 9. Testing strategy

Engine tests only (Vitest, `src/engine/__tests__/**`), consistent with the repo's
no-component-test convention. Randomness is stubbed via `Math.random`.

- **Phase 1:** base vs. effective separation; surge add / step-down decay / expiry / stack;
  `beginRun` drifts base but preserves modifiers; serialization round-trips base only;
  dual-axis feed application and the two-axis cap; `random` no longer feeds Chaos; Fortune
  tag-feed per-turn cap; retuned drift/coupling/DR math.
- **Phase 2:** happening effect resolution per `kind`; `pendingReadingEffects` consumed by
  the next reading; cadence (offered ~once/turn, never last reading); selection weighting;
  changing-lines bonus choice preserved.
- **Phase 3:** transform math (`invert-pair`, `invert-all`, `scramble`); cliff expiry +
  revert; **base-untouched invariant**; emergent condition + "no active upheaval" guard.

---

## 10. Documentation to update (per CLAUDE.md "keep in sync")

- [`docs/game-systems.md`](../../game-systems.md): §2 (feeds, shift mechanics, new
  base/effective + surge model), §3 (bands now read effective), §7 (happenings rewrite),
  and a new Upheavals section; the source-of-truth table.
- README affinity / happenings sections.
- Debug scenarios ([`src/engine/events/scenarios.ts`](../../../src/engine/events/scenarios.ts))
  for surge, happening-effect, and upheaval demos.

---

## 11. Open tuning questions (resolve in playtest, not blocking)

- Exact surge magnitude (+20…+35) and lifetime (~3 readings) per happening tier.
- Final retune constants (§5.6 directions are fixed; values are starting points).
- Fortune tag-feed cap value (~+8/turn).
- Emergent upheaval threshold (≈95+) and per-reading odds.
- Happening cadence (once/turn vs. a tuned chance with a guaranteed-pacing floor).
