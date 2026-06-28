# Corruption Mechanic — Design Spec

- **Date:** 2026-06-28
- **Status:** Design approved, pending implementation plan
- **Topic:** A self-correcting "corruption" system that punishes affinity hoarding and forces re-diversification.

## 1. Problem & goals

Players currently rack up a few affinities to max and leave the rest low. The
existing throttles (coupling fan-out, diminishing returns, the Fortune cap,
run-drift) only slow accumulation; they don't create a *reason* to diversify, so
progression stagnates — the same few forces sit at the ceiling and the other
affinities are never experienced.

**Goal:** Replace "boring decay" pressure with an interesting *corrective force* —
**corruption** — that:

1. Arises **only** from imbalance (hoarding affinities high), scaling with how far
   the world has been pushed from its natural baseline.
2. Erodes the hoarded affinities and grows into a mounting, ominous threat.
3. Resolves in a dramatic **Rupture** that resets affinities low and vanishes
   without a trace — forcing the player to rebuild and re-diversify.
4. Lets the gain pipeline be **loosened** (affinities become rewarding to build),
   with corruption — not friction — policing excess.

## 2. Core principle

> Corruption is **not** a natural mechanic. It is a corrective force summoned by
> the player's own greed. It is a power *from beyond the world* — a natural
> predator of the six affinities — and is **not subject to the world's laws**
> (no coupling, no diminishing returns, no pairing, no baseline-decay).

Two hard guarantees that flow from this:

- **No imbalance → no corruption, ever.** If nothing is hoarded high, the seed
  cannot roll. Corruption is always a *direct consequence* of the player's
  hoarding.
- **Rebalance → corruption starves and vanishes.** Drop the highs and its food is
  gone; it reliably decays to nothing.

**Anomalous, not deceptive.** Every corruption signal makes output *visibly
wrong*, never quietly wrong. The player should always be able to tell *something*
is wrong — just not *what*. Corruption never tries to convincingly lie; a lie the
player would miss defeats the purpose.

## 3. Key constraint: the affinity system is hidden

Affinity values, bands, and even the system's existence are deliberately withheld
from the player (to prevent abuse). **Therefore every corruption signal must be
diegetic** — glitches, flavor, feel, telegraphs — never numbers. The player can
only act on corruption blindly. This makes the starve-it-out lever real but hard
to execute intentionally.

## 4. Architecture

**A dedicated `CorruptionEngine` subsystem**, parallel to `AffinityEngine`,
composed by `GameEngine`.

- Corruption is a single scalar (0–100) with **its own** band thresholds and
  **its own** rules. It is **not** in `AFFINITY_IDS`, so none of the affinity
  laws apply to it — this is the literal code expression of "a power not subject
  to the world's laws."
- It **reads** `AffinityEngine`'s effective vector each reading to compute its
  food, and **acts on the world** through existing machinery:
  - **corruption responders** in the event system (`src/engine/responders/`) for
    in-game effects (minigame infection, corrupted-variant effects, intrusions);
  - the **surge/transform modifier layer** for the Rupture's affinity wipe.

**Rejected alternatives:**

- *7th affinity in `AFFINITY_IDS`* — forces special-case carve-outs in
  coupling / DR / pairs / drift everywhere; fights the uniform vector design;
  fragile.
- *Pure upheaval modifier* — too transient; corruption needs persistent scalar
  state, its own bands, and cross-game carryover the modifier layer doesn't give.

## 5. Food metric (imbalance)

```
food = Σ over all six affinities of max(0, value − HIGH_THRESHOLD)
```

- `HIGH_THRESHOLD` ≈ the ascendant boundary (81); exact value tuned in the plan.
- This measures **distance from the natural order** = imbalance = greed.
- Concentration is punished: two maxed affinities feed corruption as hard as four
  merely-high ones — directly targeting the "few maxed, rest low" stagnation.
- Maxing *all six* (maximal greed) feeds it hardest of all — consistent.

## 6. Lifecycle

1. **Seed.** At each reading boundary, if `food > 0`, roll a seed chance that
   scales with `food`. Zero food → zero chance. On success, corruption goes
   0 → small positive and now exists.
2. **Grow (both engines).**
   - **Passive erosion (primary):** each reading, drain a % of `food` directly
     into corruption — hoarded affinities visibly bleed down as corruption rises.
     Works even when affinities are maxed and no longer gaining.
   - **Skim-on-gain (secondary):** divert a portion of each affinity gain into
     corruption — pushing higher feeds the predator too. This skim is also the
     engine of the risk/reward tension (§9).
   - Growth rate scales with `food` (more imbalance → faster growth).
3. **Starve / decay (the hidden lever).** When `food` ≈ 0, corruption has nothing
   to eat and reliably decays toward 0, then vanishes. The **only** way to be rid
   of it short of the Rupture — and, since values are hidden, only achievable by
   blindly crippling one's strongest forces.
4. **Pinnacle → Rupture.** At max corruption, the Rupture fires (§11).
5. **Carryover.** Corruption persists across games (new entry in the localStorage
   carryover alongside `affinities` / `history` / `usedHappeningIds`), worsening
   game-over-game until either starved out or ruptured. It does **not** reset on
   `reset` / `returnToTitle` / `returnToQuestionSelect` (same carryover rules as
   affinities).

## 7. Corruption bands & effects

Corruption has its **own** bands (distinct names from affinity bands to avoid
confusion), escalating in *wrongness*:

| Band | Effects |
|------|---------|
| **Dormant** (0) | Nothing. |
| **Seeded** (low) | No mechanical bite yet. Faint results-screen glitches begin (occasional red artifact). Something *vaguely* wrong with the affected method's card on the selection screen — easy to miss. Quietly growing. |
| **Spreading** (mid) | **Minigame infection:** the wrongness on the selection screen sharpens into clearer glitch artifacts on corrupted methods; in-game, a glitch effect replaces the ascension-effect display and corruption gained in that game is **amplified**. (Risk/reward hotspot — see §9.) |
| **Virulent** (high) | **Corrupts affinities themselves:** their banded effects fire as **corrupted variants** (§10). Corrupted methods are blatantly glitched on selection. **Intrusions** appear on the results screen. **Light's warning becomes tainted** (§8). |
| **Pinnacle** (max) | Triggers **the Rupture** (§11). |

Band thresholds are tuned in the plan.

## 8. Light as early-warning system (and the trap)

Corruption ties into Light's existing "reveals more" identity. Light can perceive
the predator — **but only when strong enough**, and doing so feeds it.

- **Below ascendant Light:** nothing. "Cannot recognize a predator of itself."
- **Ascendant Light:** warns that *something is wrong* — vague details,
  *occasionally* names which methods are tainted.
- **Dominant Light:** *always* highlights exactly which methods are corrupted.

**The contradiction (the heart of the mechanic):** Light's guidance only helps the
player **farm** corrupted games (§9) — it can **never** help *remove* corruption,
because Light high enough to warn you is itself excess that feeds the predator. To
starve corruption you must drop your highs *including Light*, which blinds the very
warning you relied on. A perfect catch-22: the instinct to navigate by Light is
exactly what sustains corruption.

**Late-stage taint (terminal lucidity).** At **Virulent+**, *after* corruption is
already blatantly obvious (so the warning has no practical value left), Light's
warning becomes **visibly corrupted itself** — artifacts bleeding into the warning,
transparently false reassurance (e.g. "there is no war in Ba Sing Se"). It must
read as the immune system giving up, not a cure — a final burst of clarity that is
itself the disease. It never denies corruption in a way the player would believe;
the corruption of the signal is *obvious*.

## 9. Risk / reward layer — what corruption is good for

Corruption is dangerous but exploitable. A player who *recognizes* corrupted
methods (via the selection-screen telegraph or Light's warning) can deliberately
**farm** them. The unifying logic: **corruption breaks the world's laws, and that
is its appeal** — everything the affinity system throttles or hides, corruption
can override, always for the same price: *feed the predator, hasten the Rupture.*

**The three exploits:**

1. **Overcharged effects.** Corrupted-variant banded effects are strictly *more
   potent* than their clean versions, but anomalous/noisy (raw power traded for
   reliability). Same system as the §7 Virulent "curse" — see §10; it is
   double-edged, not purely a downside.
2. **Force the weave (wishes).** Corruption lets the player force outcomes the
   affinity RNG would never grant — lock the exact card/roll/hexagram, re-draw the
   whole spread, or undo a commit. The forced result still carries a visible
   corruption taint (anomalous, per §2). Available from **Spreading+**; each use
   spikes corruption.
3. **Forbidden sight.** Corruption shows truths the game hides — full pool
   preview, future results, even glimpses of the otherwise-hidden affinity/band
   state — but what it shows is a *mix of true and anomalous*, so it can never be
   fully trusted. This deliberately, partially pierces the hidden-system design;
   gate it to higher corruption bands and keep the unreliability real so it stays
   tempting rather than authoritative.

**Farming model (convert hoard → power).** A corrupted minigame **amplifies
corruption gain** (erodes excess faster) while **dampening the affinity feed** that
turn. Farming therefore *spends down* the imbalance you accumulated, turning hoard
into payoff before the Rupture claims it. To keep farming, the player must keep
re-hoarding (greed) — but corruption tends to outrun their spending, racing them to
the Rupture. Self-correcting *and* a genuine deal-with-the-devil.

**Balance invariant (non-negotiable):** **no corruption exploit may accelerate raw
affinity accumulation.** Exploits spend the *existing* hoard for power / control /
sight — never grow it. (This is why "forbidden growth / over-cap gains" was
rejected: a faster growth path would break the starve lever and make corruption
impossible to fight off.)

## 10. Corrupted-variant effects (double-edged)

Affinity banded-effects can fire as twisted variants — implemented by reusing the
existing responders with a **corruption flag**, not new responders where avoidable.
These are **double-edged**, and the same system serves both faces:

- As the §7 **Virulent curse**: at high corruption they fire *unbidden*, the
  player's own powers visibly turning against them.
- As the §9 **overcharged exploit**: deliberately triggered in corrupted games,
  they are *more potent* than the clean version — power traded for reliability.

Examples (final set chosen in the plan; each is potent **and** anomalous per §2):

| Clean effect | Corrupted variant |
|--------------|-------------------|
| Light **peek** (foresight) | Reveals the whole pool + a future result — but salts in an anomalous false entry you can't distinguish. |
| Will **choice** (cast two, keep one) | Cast *three*, keep one — but one option is visibly garbage. |
| Chaos **wild-surge** (spawn a second result) | Spawns *extra* results — one or more arrive garbled/corrupted. |
| Fate **fated-card** (lock a picked card) | Locks the card — but it may be the *wrong* one. |
| Any **reroll** | Re-rolls freely / repeatedly — but results glitch (garbage, repeats, visible malfunction). |

The principle: corruption's power is real but *wrong* — you can lean on it, never
trust it.

## 11. The Rupture (pinnacle event)

When corruption maxes:

1. Reality tears — a brief, unsettling **between-worlds interstitial**.
2. The world re-forms fresh:
   - **Affinities reset *low*** (toward / below baseline, not just to 50) so the
     player must genuinely rebuild and re-diversify — the entire point.
   - **Corruption → 0**, all corruption modifiers/flags cleared.
   - **No lingering trace:** no debuff and no badge carries forward; the player is
     left unsettled with no explanation.
3. **Record scrubbing.** Corrupted run records are erased on Rupture — *either*
   deleted outright, *or* shown as "error with record — recovered fragments: …".
   (Pick one in the plan.)

Implementation: the affinity wipe routes through the existing surge/transform
modifier layer; the interstitial is a new screen/state in the turn lifecycle.

## 12. Results screen (distinct from Shadow)

> Shadow withholds the truth (terse, veiled, hidden). **Corruption replaces the
> truth with *visible* falsehood — it lies obviously, it intrudes, it doesn't
> belong.** A different axis entirely from concealment.

- **Anomalously false reading:** synthesis text (and the copy-paste LLM prompt)
  shows *visibly* tampered output — garbled glyphs, impossible/contradictory
  fragments. Never a clean plausible lie.
- **Red glitch overlay:** scanlines / datamosh / distorted card & constellation
  visuals / red artifacts — the "doesn't belong in a world of stars" signal.
- **Intrusion (rare):** a phantom line "from beyond" that briefly addresses the
  player, then glitches away. Corruption *adds*; Shadow only removes.
- **Corrupted record:** the saved run record displays glitched/garbled, and
  persists visibly between games until the Rupture wipes it (§11).

## 13. Aesthetic direction

Red glitch effects — scanlines, datamosh, garbled/flickering glyphs, chromatic
aberration, broken card art. Corruption must look *alien to the star theme*: where
the world is luminous and ordered, corruption is a red, wrong, out-of-place tear.
Ominous enough that the player feels *something is wrong* without being told what.

## 14. Gain-pipeline rebalance

Because corruption now polices hoarding, loosen the throttles that exist *only* to
fight runaway gains:

- **Soften coupling-to-others** (`COUPLING_OTHER`, currently 0.15) so building one
  affinity doesn't gut the rest.
- **Raise the DR floor** (`DR_FLOOR`, currently 0.5) so sustained building stays
  rewarding.
- **Likely ease run-drift** (`RUN_DRIFT`, currently 0.12).

Principle: *affinities become rewarding to build; corruption — not friction —
polices excess.* Exact values are tuned in the plan (with playtest defaults).

## 15. Integration points

- `GameEngine` composes `CorruptionEngine`; drives seed/grow/decay at the reading
  boundary (alongside `beginRun` / `tickModifiers`).
- Snapshot: corruption scalar + band + active telegraphs exposed on `getState()`
  (so React can render glitches) via the usual `notify()` clone.
- Event system: corruption responders at the relevant triggers
  (`select:draw:start` for selection-screen telegraph, `minigame:*` for
  infection, affinity effect triggers for corrupted variants, `*:commit` /
  results for intrusions).
- Surge/transform layer: the Rupture's affinity wipe.
- Carryover: corruption serialized into the `fate-atlas-save` localStorage blob.

## 16. Open tuning questions (resolve in plan)

- `HIGH_THRESHOLD`, seed-chance curve, erosion %, skim %, decay rate, band cutoffs.
- Rebalance knob values (and confirming reduction stays feasible vs growth — the
  starve lever must remain viable; see §9 balance invariant).
- Corrupted-game farming factors: corruption-gain amplification and affinity-feed
  dampening per turn.
- Force-the-weave: cost-per-use (corruption spike) and which bands unlock it.
- Forbidden-sight: which bands unlock it and the true/anomalous mix ratio.
- Record-scrubbing: delete vs "recovered fragments".
- Exact corrupted-variant effect set.
- Whether the between-worlds interstitial is skippable / how long it lingers.

## 17. Docs to keep in sync

Per `CLAUDE.md`, changes to affinity/effect systems must update
`docs/game-systems.md` and the matching README sections. Corruption is a new
top-level system — it needs its own section in `docs/game-systems.md` and a
player-facing note in the README, added in the same change as the code.

## 18. Testing considerations

- Engine tests live in `src/engine/__tests__/` (Node, Vitest). Add
  `CorruptionEngine.test.ts` covering: no-food → no-seed; food → seed/grow;
  starve → decay → 0; pinnacle → Rupture wipe; carryover serialize/deserialize.
- Stub `Math.random` for the seed/grow rolls (project convention for randomness).
