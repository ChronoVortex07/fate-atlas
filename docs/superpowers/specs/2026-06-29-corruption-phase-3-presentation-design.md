# Corruption Phase 3 — Presentation Design Spec

- **Date:** 2026-06-29
- **Status:** Design approved (visuals validated via the brainstorming visual companion), pending implementation plan
- **Builds on:** Phase 1 (CorruptionEngine), Phase 2 (automatic effects), Phase 2b-i (forbidden-sight + the `cx-` visual kit)
- **Scope:** The *player-facing presentation* of corruption — selection-screen telegraph, the corrupted reading output (results screen), the intrusion, the corrupted history record, and the Rupture interstitial. Engine *glue* (framework-free, what to corrupt + when) + React rendering. Validated mockups persist in `.superpowers/brainstorm/15713-1782663357/content/` (`corrupted-reading`, `intrusion`, `selection-telegraph-v2`, `corrupted-ascend-v8`, `results-overlay`, `rupture-v5`).
- **Out of scope:** the gain-pipeline rebalance (Phase 4, its own spec); force-the-weave (Phase 2b-ii, not yet built). To be implemented **together with Phase 4** after both specs + plans are approved.

## 1. Design pillars

- **One signature visual language.** Everything reuses the `cx-` kit from Phase 2b-i (white-hot text with pulse-only chromatic aberration — now a **red↔void tear, never cyan/magenta**; red datamosh slices; drifting scanlines; data-stream winks; the eye-rift). Phase 3 extends `src/styles/corruption.css`; it does not invent a second aesthetic.
- **A creeping-dread arc, not a constant state.** Corruption *gestates* invisibly, then leaks subtle wrongness, then rages. The "something is obviously wrong" guarantee lands at **Virulent**; **Spreading is deliberately, catchably subtle** (a softening of the original §2 "never quietly wrong" guarantee — intentional).
- **Anomalous, doesn't belong.** Corruption signals read as alien to the luminous star theme — red, torn, out-of-place. Where it mimics the world (the corrupted card's *fake* gold ascension), it does so only to betray it.
- **Diegetic, never numeric.** No values, bands, or system text are ever shown (the affinity/corruption system stays hidden). Every signal is glitch/flavor/feel.

## 2. Escalation curve (single source of truth)

| Band | Reading text | Selection telegraph | Results overlay | Intrusion | Rupture |
|------|--------------|---------------------|-----------------|-----------|---------|
| **Seeded** | clean (gestation) | none (0 infected) | none | no | — |
| **Spreading** | subtle: detail swaps, tone drift, interior typos | **0–1** card, clearer artifacts (still reads) | none | no | — |
| **Virulent** | heavy, **continuous ramp** toward Pinnacle | **1–2** cards, blatant | full (ramps with corruption) | yes — rare→insistent, **guaranteed once** | — |
| **Pinnacle** | — | — | — | — | the **Rupture** → Title |

This overrides the original mechanic-spec §7 note that put "faint results-screen glitches" at Seeded: **Seeded output is now fully clean.**

## 3. Reading-text falsification (engine module)

A new **framework-free, deterministic** module corrupts the committed reading. It corrupts **both** the rendered synthesis text **and** the copy-paste LLM prompt string (the prompt is generated text, so it must be tampered at the source — this also makes it unit-testable). Driven by corruption band + value + an injected `rng` (stub `Math.random` in tests, per repo convention).

- **Seeded:** no change.
- **Spreading** — light, scattered through the whole reading, **no fixed count**:
  - **Detail swaps:** a card orientation flipped in prose, a die value off by one, a hexagram number transposed (38→83), the counsel inverted (hold↔strike), an affinity attributed to the wrong force.
  - **Tone/word drift:** a few words swapped to eerie wrong-but-plausible synonyms (promise→warning, fortune→debt) — meaning tilts, no overt contradiction.
  - **Innocuous typos:** **interior letters only** (first + last preserved) so the eye skips them (softemed, perspetcive, voltaility).
- **Virulent** — Spreading techniques dialled up (typos may now break first/last letters, full word scrambles) **plus**:
  - **Glyph garble** (zalgo-style combining marks), **`█` redaction** spans, **repeats/stutters** ("new — new — new"), chromatic-duplicated words.
  - **Contradictory fragments:** whole impossible inserted sentences ("the way ahead does not exist", "The card you did not draw speaks the loudest.").
  - **Continuous intensity ramp:** density scales with corruption value from "just past the Virulent threshold" up to "near Pinnacle" — never fully illegible (legible with heavy accents; reading the lie is the horror).

## 4. Selection-screen telegraph + chance-based infection

### 4.1 Chance-based infection (engine tuning)
`infectedCountForBand` (currently fixed 0/1/2) becomes a **roll**:
- Seeded → 0 (always)
- Spreading → 0 *or* 1
- Virulent / Pinnacle → 1 *or* 2

Default split ~50/50 (tunable constant). Touches `src/data/corruption.ts` + `GameEngine.rollInfectedMethods`. At Spreading some readings show *no* telegraph — reinforcing "did I imagine it?".

### 4.2 Telegraph rendering
Tainted method cards (driven by `state.infectedMethods`) escalate:
- **Spreading (clearer, still reads):** chromatic pulse on the name, occasional red datamosh slices, faint scanlines + red edge-glow.
- **Virulent/Pinnacle (blatant):** strong red wash, persistent datamosh, edge data-stream winks, glyph jitter, garbled names. **No fracture cracks** (rejected during review — looked wrong on cards).

### 4.3 Corrupted card selection (the first hint)
Picking an **infected** card does **not** play the normal gold ascend. It plays a **deceptive** sequence (validated `corrupted-ascend-v8`):
1. It **mimics the normal pick** — smooth eased rise + gold bloom — and **holds a beat** at the apex (the lull).
2. The gold **crossfades to soft red** and the card **shears into displaced slices** like a GPU artifact: **irregular** band heights, irregular displacement, staggered timing, a framebuffer smear, a couple of stuck-pixel blocks, **only some slices discolor red** (no full-black frame).
3. The whole tear is a **fast ~0.45s blink**, then gone — short enough to evoke "wait, what was *that*?" for a player without ascendant Light. The glow container is **rounded** (no rectangle halo). Real build randomizes slice bands/offsets per use.

## 5. Results-screen corruption overlay (Virulent+)

On top of the falsified text (§3), the results panel gains a **screen-level overlay** at Virulent+, intensity ramping with corruption:
- **Drifting red scanlines** + a **pulsing red vignette/edge** (the "doesn't belong in a world of stars" tint).
- Occasional **red datamosh slices** sweeping across the panel.
- **One result row's art distorts** (garbled glyph, redaction, red inset).
- The **intrusion** mounts here (§6).

Spreading stays text-only-subtle; the ambient overlay is Virulent+ exclusively. Must stay readable.

## 6. The intrusion (corruption *adds*)

A phantom line "from beyond" that briefly addresses the player, then glitches away (Shadow only ever *removes*; corruption *intrudes*).

- **Tone:** directly **player-aware**, second-person, predatory, wrong-cased lowercase — the same entity as the watching eye. Authored pool, randomly chosen: *"i see you counting them." / "you keep feeding me." / "there is so much of you here." / "stop looking away." / "i was here before the stars."*
- **Delivery:** a **transient overlay** — glitch/stutter-in, white-hot hold, **datamosh shear-out** (validated `intrusion`). Not embedded permanently in the synthesis.
- **Where:** **results screen** + **minigame-end** (a brief intrusion over the table). Not elsewhere (avoids dilution).
- **When:** **Virulent+**, **low per-eligible-moment chance, ramping** as corruption nears Pinnacle.
- **At-least-once guarantee:** carryover flag `hasIntrudedThisEvent`; once corruption crosses a near-Pinnacle threshold, if still false the **next** eligible moment fires a **forced** intrusion. **Resets** when corruption clears — by starving to 0 *or* by the Rupture — so each corruption event earns a fresh guaranteed intrusion.

## 7. Corrupted history record + scrubbing

- While corruption is active, a corrupted run's saved record displays as a garbled **"error — recovered fragments: …"** entry in History (reusing the glitch-text/redaction kit), persisting visibly between games.
- **Scrubbing:** the **Rupture deletes** corrupted records outright — they vanish with everything else, leaving **no trace** (§8). The haunted record lingers, then is gone with no explanation.

## 8. The Rupture interstitial

The pinnacle event. `CorruptionEngine`/`GameEngine` already perform the mechanical wipe (`performRupture()`: affinities reset low, corruption→0, flags cleared, `corruption-ruptured` emitted); Phase 3 adds the **interstitial** and **defers** the wipe/transition so it plays.

- **New screen state** `'rupture'` in the lifecycle. When a corruption tick determines the Rupture, route to the interstitial; perform the wipe during/after it; **land on the Title screen** (a fresh world).
- **Unskippable, every time** (it is short).
- **The arc** (validated `rupture-v5`): tremor + **red creep** from the edges → the rift **rips open from a single vertical seam** (collapsed red maw pulled apart horizontally, **void bleeds in** as it widens — *not* an outline being drawn) → once the dark has filled, the **eye spawns** (shut) inside it → it **snaps open with a white flash** and glares → jagged **hairline cracks** shoot across the screen and it **rips apart along them** into a whiteout → black **void** (one red thread lingers, thins to nothing) → **stars re-form** cold and ordered.
- **Signature rift:** the same eye-tear shape as forbidden-sight (void interior, red stroke, data-stream winks), here grown to consume the screen — the corner-watcher finally opening fully.
- **No explanatory text** in the final build.

## 9. Architecture & integration points

**Engine glue (framework-free, in `src/engine/` + `src/data/`; unit-tested):**
- Reading falsification module (new), consumed by synthesis rendering + `generateLLMPrompt`.
- `infectedCountForBand` → chance-based roll (`src/data/corruption.ts`, `GameEngine.rollInfectedMethods`).
- Intrusion trigger glue + `hasIntrudedThisEvent` carryover (serialized into `fate-atlas-save`); reset on clear/Rupture.
- Rupture: `'rupture'` screen state + deferred wipe/transition in the turn lifecycle.
- Corrupted-record flag on `RunRecord`; scrubbed on Rupture.

**Snapshot additions** (`GameState`, surfaced via `notify()`): the **corrupted synthesis text + a `corrupted` flag** (the engine applies the *textual* corruption — swaps, typos, garble glyphs, redaction markers; React adds the *visual* glitch styling on top); `generateLLMPrompt()` returns the corrupted prompt; a transient `intrusion` payload; the `'rupture'` screen; corrupted-record markers. (Existing `corruption`, `infectedMethods`, `corruptionWarning`, `forbiddenSightAvailable` reused.)

**Presentation layer (React; verified by `npm run build` + manual dev check — no component test harness):**
- Extend `src/styles/corruption.css` with the new primitives (glitch-text tiers, datamosh slices, scanlines, vignette, corrupted-ascension slices, seam-rip + crack SVG).
- `MethodSelect` — telegraph + corrupted ascension.
- `ResultReading` — corrupted text + Virulent overlay + intrusion mount.
- `IntrusionOverlay` — transient line (results + minigame-end via `GameTable`).
- `RuptureInterstitial` — new full-screen sequence.
- `HistoryModal` — garbled corrupted records.

## 10. Testing considerations

- Engine glue gets Vitest tests in `src/engine/__tests__/` (Node): falsification **determinism** with stubbed `Math.random` (Seeded clean; Spreading produces N alterations; Virulent ramps), infection-roll range per band, intrusion guarantee + reset logic, Rupture screen transition + wipe + land-on-Title.
- React visuals are **not** unit-tested here (no component harness) — verified by build + manual.

## 11. Open tuning (resolve in plan, playtest defaults)

- Infection split probabilities (Spreading 0:1, Virulent 1:2).
- Spreading alteration density; Virulent ramp curve (value→intensity mapping).
- Intrusion per-moment chance curve + the near-Pinnacle guarantee threshold.
- Results-overlay ramp (scanline/vignette/datamosh strength vs corruption value).
- Rupture timing (seam→open speed, eye-spawn moment, crack spread, consume violence, total duration).

## 12. Docs to keep in sync

Per `CLAUDE.md`: corruption's presentation behavior is added to `docs/game-systems.md` (corruption section) and the matching README sections in the same change as the code.
