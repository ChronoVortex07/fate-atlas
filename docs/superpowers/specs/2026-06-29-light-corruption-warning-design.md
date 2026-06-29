# Light's Corruption Warning — design

- **Date:** 2026-06-29
- **Status:** Approved design (pre-implementation)
- **Closes:** TODO item 4 ("early warning system for light"). Resolves TODO item 8 as *already wired* (see Findings).
- **Mockups (reference fidelity):** `.superpowers/brainstorm/9848-1782709960/content/` — `ward-seal-v3.html`, `hijack-v3.html`.

## 1. Findings (items 4 & 8)

- **Item 8 (forbidden sight + corruption gameplay effects) — already wired, with UI.** Forbidden sight: `GameTable` renders `CorruptionRift` → `ForceRadarOverlay` (gated on `state.forbiddenSightAvailable`). Automatic effects: `corruption-extra-result` and `corruption-false-orientation` responders are registered and produce narrated `EffectReport`s at virulent+. Affinity drain runs in `applyCorruptionTick`; `infectedMethods` already render as corrupted cards. The effects only *manifest at virulent+*, which is why they read as "absent" in normal play — a tuning/discoverability matter, out of scope here.
- **Item 4 (Light warning) — backend ready, no UI.** `deriveCorruptionWarning` fully computes `state.corruptionWarning` (covered by `CorruptionWarning.test.ts`), but no component reads it. This spec gives it a surface — expanded, per the design conversation, into a small **Light-vs-corruption warning system**.

## 2. Scope

- **Build this pass — Light only:** the seed-moment popup, the tainted-card ward-seal arc, the corruption hijack (shatter → grasping lure), and the Light↔corruption taunt collision.
- **Spec-only — the affinity-vs-corruption framework** (§10): Shadow veils / Fate redirects / will·order·chaos react to corrupted cards in their own signature way, but **none can remove corruption**. Each becomes its own follow-on phase (spec → plan → build).

## 3. Core model — two axes

A tainted card's warning is governed by two independent bands that already exist in the engine:

- **Light's effective band → *precision* of the warning** (what Light can perceive).
- **Corruption's value → *state* of the seal** (how far gone it is).

### 3a. Precision (effective Light band, while corruption is active)

| Light band | Warning |
|---|---|
| below Ascendant | **nothing** — corruption is an invisible predator; it can seed and grow silently |
| **Ascendant** (vague) | the seed popup + **ambient unease** across the whole spread; *no specific card pinpointed* |
| **Dominant** (precise) | the **ward seal** pinpoints the actual tainted card(s) |
| *(virulent+ corruption overrides — see §5)* | |

Reads the **effective** (upheaval-bent) Light band, consistent with the existing `deriveCorruptionWarning`.

### 3b. Seal state (corruption value), on a pinpointed card — Light Dominant

Driven by corruption **value** so it is deterministic and reload-safe. Thresholds are playtest defaults, defined as tunable constants alongside the rest of corruption tuning:

| Corruption value | Band | Seal state |
|---|---|---|
| 1–34 | seeded | **no card seal** (nothing infected yet) — popup only |
| ~35–56 | spreading (early/mid) | seal **intact / calm** — barrier + gestating embryo |
| ~57–78 | late spreading → early virulent | seal **straining / blinking** — flicker, red cracks, swelling embryo, *before the break* |
| ~79–99 | virulent | seal **shattered** → corrupted look + grasping lure |
| ≥90 | near pinnacle | lure + **manic lunge** |

Proposed constants: `SEAL_INTACT_MAX = 56`, `SEAL_STRAIN_MAX = 78` (above → shattered). Tunable.

## 4. Narrative beats

**Light's warnings escalate — they are not one-and-done.** Light issues a fresh warning *each time it perceives corruption entering a worse band* (while Light ≥ Ascendant). This is the fix for the obvious objection: if Light only ever warned once (at first perception), there would be nothing live for corruption to interrupt at virulent. Tracked by `warnedBand` (§6), reset when the event starves out.

### Beat 1 — Light warns alone (escalation into `seeded`/`spreading`)
The **seed popup** in Light's voice — cryptic, urgent, hushed, *afraid corruption will notice it snitched*. Cards begin wearing the ward seal (Dominant) or ambient unease (Ascendant). Corruption is too weak to respond (intrusions require virulent+), so the warning stands unchallenged.

### Beat 2 — Corruption interrupts the escalation into `virulent` (Light ≥ Ascendant)
The escalation into **virulent** is Light's last, most urgent warning — and now corruption is finally strong enough to notice it. The warning is **interrupted by a guaranteed taunt** (a scripted one-shot, *not* the random intrusion roll): the overlay **chains** Light's furtive, cut-off line → corruption's taunt:

> The light: *"There is something in the —"*
> ◆ : *"i let it warn you. watch how little it matters."*

This beat **is** the takeover. From here the **hijack** holds (§5).

**Collapse case:** if Light only reaches Ascendant *after* corruption is already virulent (a late Light pump), Beats 1 and 2 collapse — Light's very first warning is the virulent one, and it is interrupted immediately. This is the "Light warns and the intrusion fires at the same time" interaction from the design conversation.

## 5. The hijack (virulent+)

Once corruption is strong enough, it stops hiding:

- **Banner/voice:** the persistent warning text uses the existing `deriveCorruptionWarning` virulent tier — the **false reassurance** (*"The light swells, certain and warm: there is nothing wrong here. All is well. All is well."*). Deliberately kept: the dissonance — words insisting all is well while the card visibly claws at you — is the horror.
- **Card (Light Dominant):** the seal **shatters** (one-shot transition — barrier bursts, runes scatter as false-gold motes, embryo flares red→gold), then the card snaps to the existing `cx-card-virulent` look + the **grasping lure**.
- **Card (any Light, including low):** the **grasping lure** layers onto `cx-card-virulent` for any infected card at virulent — this is corruption's own nature, not Light's. Low-Light players get the lure without the seal/shatter ceremony (they had no warning to hijack).

## 6. Engine additions (small)

Most of the system reads existing state. New work:

1. **Seed-omen on escalation.** Add `warnedBand` to `CorruptionEngine` — the highest corruption band Light has already warned about this event (starts `dormant`; reset on starve-to-0 and `clear()`). In `applyCorruptionTick`, after the tick: if effective Light band ≥ Ascendant **and** the current corruption band is *higher than* `warnedBand` → Light warns: set a transient `state.omen = { text }` and advance `warnedBand` to the current band. This covers **first perception** (a late Light pump is still warned the first time Light can see it) *and* every subsequent worsening — so a live warning always exists for corruption to interrupt. `warnedBand` only ever increases within an event, so oscillation/regrowth never re-warns the same band.
2. **The interrupting taunt.** A `TAUNT_LIGHT` phrase set in `data/corruption.ts`. When the escalation being warned (§6.1) is into **virulent+** (i.e. `warnedBand` advances to virulent while Light ≥ Ascendant), that omen is the *interrupted* warning: **guaranteed**, set `state.intrusion = { text: tauntText, taunt: true }` (overlay renders the chained Light lead-in → taunt), independent of the random intrusion roll, and take precedence over any generic intrusion that tick. The generic `INTRUSION_PHRASES` roll continues to fire on later virulent readings as before. Fires once per event (guarded by `warnedBand` already being virulent).
3. **Seal-state derivation.** A pure helper mapping corruption value → seal state (`intact | strain | shattered | lunge`) using the §3b constants, surfaced to the component (derived; not stored).
4. **No `gestatingMethod`.** Decided against — the seal starts at `spreading` where `infectedMethods` is real. `seeded` is popup-only.

`state.omen` and the taunt flag are transient turn state (reset each turn, never persisted), parallel to `state.intrusion`.

## 7. Components (presentation)

- **`OmenOverlay`** (new) — mirrors `IntrusionOverlay`: watches `state.omen`, animates the seed popup, schedules `engine.clearOmen()` after the animation. Distinct visual voice from the corruption intrusion (Light, not predator).
- **`IntrusionOverlay`** — extended to render the chained Light-lead → taunt sequence when `intrusion.taunt` is set.
- **`corruption.css`** — new classes for: the ward seal (full-card rune barrier: frame, lattice, sheen, lock-sigil, runes), the gestating embryo (heartbeat + nucleus + tendrils), the straining/blinking state (barrier flicker, red cracks), the shatter transition (shards + runes-to-gold-motes + embryo flare), and the grasping lure (sporadic blink-open eyes in the card's red/void palette, whispers, near-pinnacle lunge). Reuses the existing `cx-card-virulent` look as the lure's base. **No feelers** (dropped in review).
- **`MethodSelect`** — render the ward-seal/lure overlay on pinpointed cards (precision from §3a, state from §3b); render ambient unease across the spread at Light Ascendant.

**Composition with the existing telegraph:** infected cards already carry corruption's own self-expression via `corruptedFor` (`cx-card-spreading` at spreading, `cx-card-virulent` at virulent). The ward seal is **Light's overlay layered on top** of that base — corruption's subtle telegraph stays underneath. After the shatter, Light's overlay is gone and only corruption's base (now + lure) remains. The seal overlay is therefore additive and never removes the existing classes. "Ambient unease" at Ascendant is a faint cold shimmer over the whole spread (no per-card seal), kept deliberately low-fidelity so it reads as "something is wrong here" without pinpointing.

## 8. Copy

- **Seed popup (Light, sentence-case, hushed):** default *"Something has taken root in the weave that should not be. Say nothing — do not let it know I warned you."* (final wording tunable in review).
- **Taunt chain (chosen):** Light *"There is something in the —"* → ◆ *"i let it warn you. watch how little it matters."* (lowercase, matching `INTRUSION_PHRASES`).
- **False-reassurance banner:** existing `deriveCorruptionWarning` virulent text — unchanged.

## 9. Tests & docs

- **Engine (Vitest, engine-only per convention):**
  - omen fires on first perception **and** on each band escalation (guarded by `warnedBand`), never twice for the same band, and resets after starve-to-0;
  - omen does **not** fire below Ascendant Light;
  - the virulent escalation fires a **guaranteed** `TAUNT_LIGHT` interruption once per event, only with Light ≥ Ascendant, taking precedence over the random intrusion roll;
  - seal-state helper returns the right state at the §3b thresholds.
- **Visual treatments** verified live (`npm run dev`) — no component tests by convention.
- **Docs:** update the corruption section of `docs/game-systems.md` and the matching README sections (per CLAUDE.md's keep-in-sync rule).

## 10. Out of scope — the affinity-vs-corruption framework (follow-on)

The pattern Light instantiates, to be specced per-affinity later. **Invariant: a reaction may hinder, hide, or redirect corruption's effects, but never *remove* corruption — an affinity high enough to react is itself the excess that feeds it.**

- **Light** — *warn* (this spec).
- **Shadow** — *veil* the infected card (reuse `shroudedMethods` / `shadow-veil-position`, biased toward infected indices).
- **Fate** — *redirect/thin* away from the infected card (reuse `fate-thin` / fate-force, biased away from infected).
- **will / order / chaos** — reactions TBD (e.g. will: reroll/swap pressure; order: quarantine/isolate; chaos: scramble which card is tainted). Sketch only.

Each gets its own spec → plan → build.

## 11. Assumptions / decisions on record

- Warning reads the **effective** Light band (perception can be distorted), consistent with `deriveCorruptionWarning`.
- Light warns on **each perceived band escalation** (first perception + each worsening), not once — so a live warning exists for corruption to interrupt. The **virulent** escalation is the interrupted/taunt beat, and its taunt is a **guaranteed** scripted interruption, not contingent on the random intrusion roll.
- **No `gestatingMethod`** — seal starts at `spreading`.
- Seal **state is a function of corruption value** (deterministic/reload-safe); the taunt is a coincident narrative beat in the same band, not hard-coupled to the seal animation.
- The grasping **lure applies to all infected cards at virulent**; the **seal + shatter ceremony is Light-Dominant-only**.
- The virulent **false-reassurance banner is kept** for dissonance against the unhinged card.
