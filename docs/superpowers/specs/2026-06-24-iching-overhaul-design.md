# I Ching Overhaul — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan
**Scope:** Overhaul the I Ching divination method — authentic casting, a signature
"change" affinity mechanic, affinity-gated player agency, cross-game interactions, and a
mystical UI — paralleling the prior Tarot and Astromancy overhauls.

---

## 1. Motivation

The current I Ching minigame ([src/components/screens/IChingMinigame.tsx](../../../src/components/screens/IChingMinigame.tsx))
is "press a button six times," with no agency, no mystical drama, and a casting routine
that picks a **random hexagram independent of the coins** ([src/data/iching.ts](../../../src/data/iching.ts) `castHexagram`).
It is also under-integrated with the affinity system and the other methods.

This overhaul makes the I Ching the *Book of Changes*: its signature is that **a cast bends
how affinities themselves move** for the rest of the turn — a genuinely new class of effect
(Tarot mutates results, Astral reads symbols, Dice gambles outcomes; none touch the *rules of
affinity flow*).

---

## 2. Goals / Non-goals

**Goals**
- Authentic three-coin casting that actually *builds* the hexagram from its six lines.
- A primary→relating hexagram **transformation** as the visual + mechanical centerpiece.
- A signature affinity mechanic: a **one-time nudge** plus a lingering, decaying **Mandate of
  Change** that rescales affinity gains/losses for the rest of the turn.
- Affinity-gated **player agency** over the transformation (Accept / Hold / fated / re-cast).
- New **cross-game interactions** and Chaos/Order band responders.
- A mystical, visually-fun UI (bronze coins + ink-brush lines + jade-glow transformation).
- Keep all game logic framework-free in `src/engine/`; React only renders/animates.
- Keep `docs/game-systems.md` and README in sync (CLAUDE.md requirement).

**Non-goals**
- No new icon/sigil system — keep the existing Unicode hexagram glyphs (䷀…䷿).
- No change to the turn lifecycle, snapshot contract, or carryover rules beyond adding the
  turn-scoped mandate (cleared each turn).
- No rebalance of the other methods.

---

## 3. Data layer — authentic casting (`src/data/iching.ts`)

### 3.1 Line values and hexagram derivation

Each of the 6 lines is a 3-coin toss; coins are heads (3) / tails (2). The sum maps to a line:

| Sum | Line | Solid/Broken | Changing? | Becomes (relating) |
|-----|------|--------------|-----------|--------------------|
| 6 | old yin | broken | yes | yang (solid) |
| 7 | young yang | solid | no | — |
| 8 | young yin | broken | no | — |
| 9 | old yang | solid | yes | yin (broken) |

- The six line values (bottom→top) form a 6-bit pattern (solid = 1, broken = 0) that
  **determines the primary hexagram** via a canonical line-pattern → King Wen number lookup.
- The **relating hexagram** is the same pattern with the changing-line bits flipped.
- **Chaos bias** (carried over): Chaos increases the probability that a young line (7/8) is
  promoted to its changing counterpart (6/9), producing more changing lines. Applied to coin
  sums per line, as today.

### 3.2 New data structures & functions (mirror `astromancy.ts` / `astral.ts` split)

```ts
type LineValue = 6 | 7 | 8 | 9; // bottom→top

interface HexagramCast {
  lines: LineValue[];        // length 6, bottom→top
  primaryNumber: number;     // 1..64
  relatingNumber: number;    // 1..64 (== primaryNumber if no changing lines)
  changingLines: number[];   // 1..6 indices
}

drawHexagramCast(affinities): HexagramCast            // engine-side RNG (Chaos-biased)
consolidateHexagram(cast, governing: 'primary'|'relating'): IChingResult
```

- A canonical 64-entry binary→King Wen table is added to `iching.ts` (e.g. a `lines`/`binary`
  field per `HexagramData`, plus a `HEX_BY_BINARY` lookup). Correctness is enforced by a
  round-trip test (§8).
- `castHexagram(affinities)` is **retained** as a thin wrapper (`drawHexagramCast` →
  `consolidateHexagram(cast, 'relating')`) so any non-minigame caller (e.g. `chaos-second-result`
  spawning an I Ching, `drawSingleResult`) keeps working.

### 3.3 `IChingResult` extension (`src/engine/types.ts`)

```ts
interface IChingResult extends ThematicData {
  type: 'iching';
  hexagramNumber: number;   // governing hexagram (unchanged consumers read this)
  name: string;
  symbol: string;
  judgment: string;
  changingLines: number[];
  tags: Tag[];
  // new (all optional for back-compat):
  governing?: 'primary' | 'relating';
  relatingNumber?: number;
  relatingName?: string;
  relatingSymbol?: string;
  cast?: HexagramCast;
}
```

`hexagramNumber`/`name`/`symbol`/`judgment`/`changingLines` always describe the **governing**
hexagram, so synthesis, history tiles, fan cards, and the LLM prompt continue to work without
edits.

### 3.4 Tags emitted

`draw`, `random`, `binary`, and:
- `changing-lines` — when `changingLines.length > 0` (feeds Chaos, as today).
- `reversible` — when changing lines exist (so `mirror` and `iching-resonant-change` include
  the hexagram; the I Ching previously never emitted this despite the README claiming it).
- `governing-primary` / `governing-relating`.

Plus the governing hexagram's existing `themes`/`dimensions`/`modifierRoles`.

---

## 4. The Mandate of Change + one-time nudge (`AffinityEngine`)

On a committed I Ching, the **governing** hexagram applies two effects, in order:

### 4.1 One-time nudge (applied first)
A set of **direct** affinity shifts derived from the governing hexagram's dimensions/themes,
applied through `shift()` *before* the mandate is set (so the nudge is not self-multiplied).
Magnitude comparable to a strong tag feed. Examples:
- `volatility > 0` → Chaos +; `volatility < 0` → Order +.
- `favorability`/`certainty`/themes tilt Light/Shadow/Fate/Will modestly.

Exact mapping table to be finalized in the plan; magnitudes in the ~+6…+12 band, signed.

### 4.2 Mandate of Change (lingering, turn-scoped)

Add a `mandate` to `AffinityEngine`. `shift(id, baseDelta, source)` multiplies the **base
delta magnitude** by a per-affinity mandate factor at the **top** of the method, before the
existing gain/penalty split — so it scales **both gains and direct penalties** for the affected
affinity, then DR → jitter → coupling proceed unchanged.

```ts
interface AffinityMandate {
  gainMult: Partial<Record<AffinityId, number>>; // per-affinity; default 1.0
  globalMult: number;                            // applies to ids not in gainMult
  source: string;                                // e.g. 'iching:49'
}
setMandate(m: AffinityMandate): void
// shift(): const f = mandate ? (mandate.gainMult[id] ?? mandate.globalMult) : 1; baseDelta *= f;
```

Derivation from the governing hexagram:
- **globalMult** from volatility — volatile hexagrams accelerate all affinity movement
  (≈ ×1.6 at volatility +2), still hexagrams dampen it (≈ ×0.5 at volatility −2), centered on
  ×1.0. Linear map, clamped to **[0.5, 1.6]**.
- **Per-pair tilt** layered on top: transformation/upheaval themes boost Chaos & Will and
  dampen Order; certainty/authority themes boost Order & Fate; favorability sign tilts
  Light/Shadow. (Concrete coefficients in the plan.)

Lifecycle:
- **Decay:** at each subsequent commit (`*:commit` of any method, or `minigame:end`), each
  mandate factor moves **40% toward 1.0**. Casting the I Ching early in a turn matters most.
- **Cleared** in `beginRun()` and at `startTurn` (turn-scoped; never serialized — consistent
  with the carryover rules: affinities persist, mandate does not).
- **Replacement:** a second I Ching cast in a turn **replaces** the mandate (re-attunes the
  weave) rather than compounding.

**UI/secrecy constraint:** affinities and their multipliers are hidden. The mandate is
**never** shown as numbers — only as atmospheric flavor text (silk banner), with Light/Shadow
clarity gating explicitness (mirrors `hintClarity`/veiled conventions). The ×-values here are
for design/balance only.

---

## 5. Affinity-gated transformation modes (`src/engine/iching.ts`)

New framework-free module mirroring `src/engine/astral.ts`. `planHexagramResolution(affinities)`
returns a mode. **Modes only branch when `changingLines.length > 0`**; with no changing lines
the primary == relating and the cast auto-commits the primary.

| Mode | Gate | Behavior | Feeds |
|------|------|----------|-------|
| **willed** | Will ascendant+ | Player picks **Accept the Change** (commit *relating*) or **Hold the Moment** (commit *primary*) | Accept → Will + Chaos; Hold → Fate + Order |
| **fated** | Fate ascendant+ AND not willed | No choice; the weave auto-commits the **relating** hexagram | Fate |
| **unaligned** | neither ascendant | No fork; exactly one **Re-cast** offer (throw all coins again), then auto-commit the **relating** | Re-cast → Will (take-reroll); else neutral |

- **Precedence when both Will & Fate are high:** Will wins (`willed`), matching Astral's
  choice-wins rule.
- Gate thresholds (`ascendant`) are tunable; stated here as the default.
- Re-cast in unaligned mode is a single use per cast (like Astral's offer-recast), routed
  through the existing reveal/commit meta (`viaReroll`).

The minigame consumes the action affinity feeds through the existing
`completeMinigame(result, meta)` meta flags (`reversed`/`revealedAsDrawn`/`viaReroll`) plus
explicit `applyAction` calls for the Accept/Hold semantics where the existing flags don't fit.

---

## 6. Event triggers, responders & cross-game interactions

### 6.1 New trigger points (mirroring Tarot's `deal`/`orient`)
- `iching:cast` — coins settled, primary hexagram determined.
- `iching:transform` — changing lines about to resolve into the relating hexagram (responders
  here can add/remove changing lines; the relating hexagram is recomputed afterward).
- `iching:commit` — existing final commit.

### 6.2 New band responders (`src/engine/responders/iching.ts`)
Parallel to the Tarot `chaos-wild-card` / `order-anchor` pair, gated by `bandRoll`:

| Responder | Trigger | Band | Min band / tier | Effect | Animation |
|-----------|---------|------|-----------------|--------|-----------|
| `chaos-line-cascade` | `iching:transform` | MUTATE | Chaos ascendant · notable | Adds one changing line; relating recomputed (stronger transformation) | `amplify` |
| `order-still-hexagram` | `iching:transform` | MUTATE | Order ascendant · notable | Removes one changing line; relating recomputed (stills toward primary) | `anchor` |

### 6.3 New cross-game meta-interaction (`src/engine/responders/interactions.ts`)

| Interaction | Trigger | Scope | Fires when… | Effect | Animation |
|-------------|---------|-------|-------------|--------|-----------|
| `iching-resonant-change` | `iching:commit` | cross-slot | committed hexagram has `changing-lines` AND a `reversible` Tarot/Astral entity is in the spread | Flips that entity's orientation (change propagates across methods) | `mirror` |

### 6.4 Kept as-is
- `iching-happening-boost` (changing-lines → bonus happening choice).
- `mirror` (now qualifies because the I Ching emits `reversible`).
- `chaos-second-result` (already triggers on `iching:commit`).

> The Mandate itself (§4) is the primary cross-game interaction: it rescales how every
> later Tarot/Dice/Astral cast feeds affinity for the rest of the turn.

---

## 7. UI overhaul (`IChingMinigame.tsx` + new presentation components)

Phase state machine modeled on `AstralMinigame`. The engine predetermines the cast
(`drawHexagramCast`); React only animates the predetermined values (as `CelestialCast` does for
dice faces). No game logic in components.

Phases: `idle → casting (6 lines) → primary-revealed → transforming → resolve → done`,
where `resolve` branches on the planned mode (willed fork / fated auto / unaligned recast),
and respects the existing **review beat** (`awaitingContinue` / `continueAfterReview`).

New components:
- **`CoinCast`** — three bronze square-hole coins spin / tumble / settle for one line.
- **`HexagramPillar`** — paints each line bottom-up with a brush-ink stroke; changing lines
  pulse **jade**; an **ink-bleed morph** transitions primary→relating.
- **Silk-banner Mandate** — atmospheric flavor (no numbers), clarity-gated; **Accept / Hold**
  buttons (willed) or auto/recast beats.

Visual language: warm gold + jade on deep indigo — distinct from Tarot's arcana sigils and
Astral's cold blues. Keeps the large Unicode hexagram glyph for the symbol. Honors the veiled
state (`affinityEffects.poolPreview === 'hidden'`) for withholding the changing-lines detail,
as today.

Display surfaces that already read `IChingResult` (FanCard/ConstellationFan, ResultReading,
HistoryTiles) keep working from `symbol`/`name`; optionally surface the relating hexagram
where space allows (nice-to-have, not required).

---

## 8. Tests (`src/engine/__tests__/IChing.test.ts`)

- **Line→hexagram round-trip:** every hexagram's line pattern resolves back to its King Wen
  number; the 64-entry table is complete and bijective.
- **Relating computation:** flipping changing lines yields the correct relating hexagram; no
  changing lines ⇒ relating == primary.
- **Mandate scaling:** `shift()` scales both a positive gain and a negative penalty by the
  mandate factor; unaffected affinities use `globalMult`.
- **Mandate decay & clearing:** decays ~40%/commit toward 1.0; cleared on `beginRun`.
- **One-time nudge:** governing hexagram applies the expected signed shifts, before the mandate.
- **Plan resolution modes:** `planHexagramResolution` returns willed/fated/unaligned by
  affinity band, with Will winning ties.
- Stub `Math.random` where randomness is asserted (existing convention).

`DEBUG_SCENARIOS` (`src/engine/events/scenarios.ts`): add entries that stage and force
`chaos-line-cascade`, `order-still-hexagram`, `iching-resonant-change`, and a mandate demo.

---

## 9. Docs to keep in sync (CLAUDE.md requirement)

- `docs/game-systems.md`: add a new **§ I Ching** (casting, mandate table, transformation
  modes, responders); extend the responder/interaction catalog tables; add `src/engine/iching.ts`
  and `src/engine/responders/iching.ts` to the source-of-truth table.
- `README.md`: update the I Ching method row and the meta-interactions table.

---

## 10. File-change summary

| File | Change |
|------|--------|
| `src/data/iching.ts` | binary line table + lookup; `drawHexagramCast`, `consolidateHexagram`; `castHexagram` becomes a wrapper; new tags |
| `src/engine/types.ts` | extend `IChingResult`; add `HexagramCast`, `LineValue`, `AffinityMandate` |
| `src/engine/AffinityEngine.ts` | `setMandate`/decay/clear; mandate scaling in `shift()`; one-time-nudge helper |
| `src/engine/iching.ts` *(new)* | `planHexagramResolution`, mandate derivation, fated/recast helpers |
| `src/engine/GameEngine.ts` | wire `iching:cast`/`iching:transform` dispatch; apply nudge + mandate; mandate decay hook; resolution-mode plumbing |
| `src/engine/responders/iching.ts` *(new)* | `chaos-line-cascade`, `order-still-hexagram` |
| `src/engine/responders/interactions.ts` | `iching-resonant-change` |
| `src/engine/events/*` | register new triggers; scenarios |
| `src/components/screens/IChingMinigame.tsx` | full rewrite (phase machine) |
| `src/components/cards/CoinCast.tsx`, `HexagramPillar.tsx` *(new)* | presentation |
| `src/engine/__tests__/IChing.test.ts` | expand coverage |
| `docs/game-systems.md`, `README.md` | sync |

---

## 11. Default balance values (tunable; flagged for review)

- Mandate `globalMult` range **[0.5, 1.6]**, linear in volatility, centered ×1.0.
- Mandate decay **40%/commit** toward 1.0.
- One-time nudge magnitudes **±6…±12**.
- Transformation gates: **willed** = Will ascendant+, **fated** = Fate ascendant+, Will wins
  ties; unaligned = one re-cast.
- `chaos-line-cascade` / `order-still-hexagram`: ascendant · notable tier.
- Second I Ching cast in a turn **replaces** the mandate.
