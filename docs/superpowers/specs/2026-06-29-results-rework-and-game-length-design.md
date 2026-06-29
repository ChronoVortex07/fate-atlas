# Design — Results Rework, Game Length, Corruption Presentation & Narrative Voice

**Date:** 2026-06-29
**Status:** Approved design (visual mockups validated in the brainstorm visual companion)
**Topic:** Compact, scalable results presentation + selectable game length + richer corruption presentation + per-affinity / entity narrative voice + a shareable export image.

---

## 1. Overview & Goals

The results page is visually strong but **too tall**, and it does not scale: a longer reading (5–7 methods) would produce an unsustainable scroll. We want to:

1. **Make the results page compact** — preserve the thematic effects (corruption) and legibility on both large screens and mobile, while staying short as the card count grows.
2. **Let players choose game length** on the question-select page via thematic named tiers.
3. **Enrich corruption presentation** in the new compact layout (random sigil chromatic aberration, live word-swaps, full-intensity synthesis rendering, tainted tiles).
4. **Give every affinity a voice** and let the corruption entity **replace** narrative text at Virulent+.
5. **Produce a share image** with a fixed aspect ratio and curated, reading-first presentation that makes a stranger want to play.

### Non-goals

- No change to the minigames themselves, the affinity math, draw biasing, or happenings logic.
- No LLM-based generation — narrative stays deterministic/template-based.
- No rebalancing of corruption thresholds (see the deliberate hidden consequence in §3.4).

---

## 2. Scope — five pillars

| # | Pillar | Layer |
|---|--------|-------|
| A | Game-length tiers | Engine + question-select UI |
| B | Results presentation rework | React (results screen) |
| C | Corruption presentation | React + CSS (presentation only) |
| D | Narrative voice (per-affinity notes + entity voice) | Engine (NarrativeAssembler / CorruptionGlitch) |
| E | Share image | React (new ShareCard) + shareExport |

---

## 3. Pillar A — Game-length tiers

### 3.1 Tiers

Three thematic named tiers (player-facing names + method counts):

| Tier | Methods | Flavor line (shown under the selector) |
|------|---------|-----------------------------------------|
| **Glimpse** | 3 | "A brief glance through the veil." |
| **Reading** *(default)* | 5 | "A measured consultation." |
| **Deep Divination** | 7 | "A long descent into deeper waters." |

**No corruption is ever mentioned here.** Players discover corruption only by experiencing it. "Deep Divination" reads purely as depth/atmosphere.

### 3.2 Question-select UI

- A **segmented control** (a single rounded pill-bar with three segments, each: serif tier name + a row of depth "pips" matching the count), placed between the heading and the question grid, under a small `— Depth of the Reading —` label.
- It is **deliberately not card-shaped** so it reads as a setting, not a fifth question.
- Selected segment: gold fill/glow + gold pips; a single italic flavor line below updates per tier.
- Default selection: **Reading (5)**.
- Selecting a **question card** starts the turn at the currently selected depth.

### 3.3 Engine changes

- `GameEngine` already has `private minigamesPerTurn` (constructor default `3`). Change the lifecycle so the **count is set per turn**:
  - `startTurn(question: QuestionType, methodCount?: number)` sets `this.minigamesPerTurn = methodCount ?? this.defaultMinigamesPerTurn` (keep the constructor value as the fallback so existing tests that call `startTurn` / construct `new GameEngine(3)` are unaffected).
  - Store the active count on `GameState` (e.g. `state.minigamesPerTurn`) so the UI/results can read it (THE CARDS · N header, etc.).
- All existing reads of `this.minigamesPerTurn` (final-reading check `completed >= this.minigamesPerTurn`, `lastReading`, `remaining = this.minigamesPerTurn - completed`) already key off the field — they keep working once it is set in `startTurn`.
- `QuestionSelect.tsx` calls `engine.startTurn(type, tierCount)`.
- **Pool sizing:** verify `TurnOrchestrator.buildPool` / `refillPool` supply enough distinct draws for 7 readings. The pool already refills between readings; confirm no fixed assumption of 3 limits it. (Implementation task: add a test that a 7-method turn completes.)
- **Tier persistence:** the selected tier lives on engine/UI state for the session; it is **not** persisted to `localStorage` (defaults back to Reading on reload). Carryover state (affinities, history, corruption) is unaffected.
- **History:** `RunRecord.turnResults` already records the draws, so length is derivable for the history badge; no schema change required (optionally store the tier name for display).

### 3.4 Deliberate hidden consequence (documented, not advertised)

Corruption accrues by *value* across draws and persists across runs. A 7-method reading therefore exposes the player to **more** corruption growth than a 3-method one. This is intentional and is left **undocumented in-game** — it is one of the things a player "discovers by experiencing it." No threshold rebalancing; just note it in `docs/game-systems.md`.

---

## 4. Pillar B — Results presentation rework

Layout, top → bottom, inside the existing `maxWidth: 560px` reading card:

### 4.1 Synthesis hero (the focal point)

The synthesis becomes a framed **hero panel** (subtle gradient panel + faint border) containing, in order: section label `INTERPRETATION`, the **headline** (serif), the paragraph(s), the **tension box** (gold left-bar), and the **affinity note**. This is the visual anchor of the page. Glitch rendering (`GlitchText` over `synthesisSegments`) is unchanged in mechanism.

### 4.2 THE CARDS — compact tile grid

- A reflowing grid: `grid-template-columns: repeat(auto-fill, minmax(112px, 1fr))` → ~4-up on desktop (560px), **2-up on mobile**.
- Header rule: `THE CARDS · N`.
- **Every tile is the same size.** A single-method tile shows: index (top-left), one large **sigil** (the existing `CardSigil`/`AstralSigil`/`RuneSigil`/`StringSigil` or symbol), the **name**, and one **meta** line (orientation / house / ring / threshold).
- **Tap any tile → the existing `CardDetailModal`** (which renders `CardReadingDetail` — the full breakdown incl. the multi-card sub-spread). This is the same modal used by the expanded-hand wheel, so there is one source of truth. Wire the results tiles to open it.

### 4.3 Spread tile (tarot 3-card) — "Design A: triangle"

A tarot three-card spread occupies **one uniform tile** (same size as the rest), rendered as a **triangle of three bare sigils** (no inner card boxes):

- **Present** at the apex, **Past** bottom-left, **Future** bottom-right.
- **Position is encoded by color + placement** (Present = gold, Past = blue `#7b9ec7`, Future = purple `#9b6bb0`) — matching the tarot minigame's hand-slot accents — so the per-position word labels are not needed in the tile.
- Each mini-cluster shows its **sigil + card name + a ▲/▼ orientation tick**. Names stay visible (wrap to two lines for long names like "Wheel of Fortune").
- Tapping opens the full breakdown (`CardDetailModal` → `CardReadingDetail`), which restores the Past/Present/Future **word labels and each card's meaning**.

### 4.4 Happening & actions

- The happening section stays, compacted (label, scene, "You chose …").
- Actions row unchanged (DRAW AGAIN / SHARE AS IMAGE / HISTORY / Copy LLM Prompt).

### 4.5 Responsiveness

Verified at desktop (560px) and mobile (≈330px) in mockups: hero panel reflows; tile grid drops to 2-up; spread triangle holds in a single cell at both sizes.

---

## 5. Pillar C — Corruption presentation (Virulent+)

All presentation-layer; reuses [src/styles/corruption.css](../../../src/styles/corruption.css) primitives.

### 5.1 Card-wide overlay (unchanged mechanism)

The reading card keeps `cx-results` + `cx-scan` (scanlines), `cx-vignette` (breathing red ring), and `cx-mosh` bars. Carried into the new layout (hero + tiles sit above the overlay via z-index).

### 5.2 Tainted tiles

A corrupted draw (carries `CORRUPTED_TAG`) renders its tile with a red border + white-hot pulsing sigil/name (`cx-capulse`). Clean draws are untouched. Requires surfacing the corrupted tag per result to the tile (the tag already exists on results).

### 5.3 Random sigil chromatic aberration *(new)*

At Virulent+, a **random subset** of tile sigils get a chromatic-aberration pulse (red↔void, **never cyan** — matches the game's established kit). Staggered durations/delays so it reads as random/alive. Implemented as CSS classes (e.g. `cx-sig`, `cx-sig.d1/.d2/.d3`) applied to a seeded-random subset of sigils.

### 5.4 Live word-swap *(new)*

At Virulent+, some synthesis words **randomly swap** between their clean form and a more-distorted variant (brief flips, staggered), layered on the existing static `GlitchSegment` rendering. The distorted variant is produced **at render time** (reuse the `garble`/zalgo logic from `CorruptionGlitch.ts`) — no engine change. `GlitchText` renders flagged segments as two stacked spans (clean `v0` + distorted `v1`) cross-fading via CSS.

### 5.5 Full-intensity synthesis rendering

The engine **already** generates the full glitch vocabulary in [src/engine/CorruptionGlitch.ts](../../../src/engine/CorruptionGlitch.ts) — tone-drift, interior typos, zalgo garble, stutter-repeats, budgeted redactions, ghost whispers — ramping toward the pinnacle. The compact hero must render these segments at the **near-Pinnacle intensity** shown in the reference (`corrupted-reading.html`). This is a rendering fidelity check, not new generation: ensure the hero's `GlitchText` path applies every `cx-w-*` style and does not truncate.

---

## 6. Pillar D — Narrative voice (engine / content)

Lives in [src/engine/NarrativeAssembler.ts](../../../src/engine/NarrativeAssembler.ts) and [src/engine/CorruptionGlitch.ts](../../../src/engine/CorruptionGlitch.ts). **Update [docs/game-systems.md](../../../docs/game-systems.md) in the same change** (per CLAUDE.md).

### 6.1 Per-affinity notes (all six)

Today only **Chaos** and **Order** produce an `affinityNote`. Extend it so each of the six affinities has an elevated-band line. The six are three opposed pairs: **chaos↔order, fate↔will, light↔shadow**.

- Choose the note from the **most-elevated** affinity at Ascendant+ (dominant outranks ascendant; tie-break by a fixed pair order, e.g. chaos/order → fate/will → light/shadow).
- New lines needed for **fate, will, light, shadow** (chaos/order keep their current lines). Suggested voices (final copy in implementation):
  - **Fate** — the thread pulls taut; the outcome is already written.
  - **Will** — your hand outweighs the omens; nothing here is fixed.
  - **Light** — the reading is lit plainly; the forces name themselves. *(coordinate with the existing `hintClarity` reframe so they don't double up.)*
  - **Shadow** — much is withheld; what is shown is the smaller truth. *(coordinate with the existing low-clarity "Something stirs beneath the surface…" line.)*
- Keep the existing clarity reframes (`clarity >= 2` / `<= -2`).

### 6.2 Entity voice at Virulent+ *(replaces, not garbles)*

At **Virulent/Pinnacle**, the corruption entity's voice **replaces** the `affinityNote` with a declaration from a pool (e.g. `"It watches. It is pleased."`, `"Expect us."`, `"The card you did not draw speaks the loudest."`, `"This reading was never yours."`). Near the pinnacle it may also replace the closing sign-off beat. This is *replacement of normal text*, distinct from the per-word glitch styling layered on the body. Reuse/extend the existing `WHISPERS` pool. Implement as a post-pass in `assemble` (or a dedicated corruption-narrative step) gated on corruption band — the engine owns this, the renderer just displays the resulting segments.

---

## 7. Pillar E — Share image

### 7.1 Format

- **Fixed 4:5 portrait**, exported at **1080×1350** (render the card at 380×475 logical, html2canvas `scale` tuned to reach 1080×1350).
- A **dedicated, curated composition** — *not* a screenshot of the scrolling results page.

### 7.2 Content (the reading itself)

Top → bottom:
1. **Question** (gold italic, uppercase) + thin ornament.
2. **Headline** (the hook — real `synthesis.headline`).
3. **One concise interpretation line** — the real **tension note** if present, else the **first sentence** of the first paragraph. (Long paragraphs are omitted; both chosen fields are inherently one-liners.)
4. **THE CARDS · N** — a clean reading **list**: each row = sigil · name · orientation/meta; the tarot spread expands to its three positions (`Moon ▼ · Star ▲ · Sun ▲`).
5. **Affinity badge** (e.g. "Chaos ascendant").
6. **Footer sign-off** — the **wordmark** (`ATLAS of FATE`) + tagline *"the stars await your question"* (quiet, branding as sign-off, not headline). No URL/QR/CTA.

### 7.3 Corrupted export (frozen frame)

`html2canvas` cannot capture animation, so the corrupted share is a **static frozen frame**: chromatic headline via baked `text-shadow`, ▮redaction▮ bars, a ghost interpretation line, tainted card rows, red vignette/scanlines, and the **entity tagline** in the footer (e.g. "It watches. It is pleased."). Needs a **static rendering mode** for glitch segments (chromatic as static shadow, redactions as solid bars, no CSS animation).

### 7.4 Implementation

- New **`ShareCard`** React component rendering the 4:5 composition from the current `GameState` (question, synthesis, results, affinity snapshot, corruption band).
- `shareExport.ts`: render `ShareCard` into an **off-screen fixed-size node** on demand, `html2canvas` it at the export dimensions, then remove the node. Replaces the current `shareRef` capture of the whole results card.
- Keep the existing Web Share / download fallback in `shareAsImage`.

---

## 8. Files touched (anticipated)

**Engine**
- `src/engine/GameEngine.ts` — per-turn `minigamesPerTurn`, set in `startTurn`; expose on state.
- `src/engine/types.ts` — add `minigamesPerTurn` to `GameState` (and optional tier label).
- `src/engine/NarrativeAssembler.ts` — per-affinity notes; entity-voice replacement pass.
- `src/engine/CorruptionGlitch.ts` — entity-voice pool/helpers (reuse `WHISPERS`); export `garble` for render-time word-swap if needed.

**React**
- `src/components/screens/QuestionSelect.tsx` — segmented depth control; `startTurn(type, count)`.
- `src/components/screens/ResultReading.tsx` — hero + compact tile grid; tap-to-expand wiring; tainted/aberration classes; render `THE CARDS · N`.
- `src/components/cards/` — new compact result tile + Design-A spread tile (may extend `CardReadingDetail` or add a `ResultTile`).
- `src/components/overlays/CardDetailModal.tsx` — reused as the tap target (no change expected).
- `src/components/share/ShareCard.tsx` *(new)* — the 4:5 export composition (clean + corrupted).
- `src/utils/shareExport.ts` — off-screen render of `ShareCard`; fixed export size.

**CSS**
- `src/styles/corruption.css` — add `cx-sig*` (sigil aberration) and `cx-swap*` (live word-swap) primitives; static-mode variants for the share.

**Docs**
- `docs/game-systems.md` + README — game-length tiers, per-affinity notes, entity voice, corruption-presentation additions, hidden corruption-exposure consequence.

---

## 9. Testing

- **Engine (Vitest):** a Deep-Divination (7) turn completes through final synthesis; `minigamesPerTurn` set per turn and respected by the final-reading check and pool refill; per-affinity note selection (each of the six elevated produces its line; precedence when multiple elevated); entity-voice replacement fires at Virulent+ and not below.
- **No component tests** (project has none) — the presentation pillars are validated by the approved mockups + manual `?debug` state injection (see the repro-game-state memory).
- `npm run build` (tsc strict) must stay green; existing corruption/glitch tests must keep passing.

---

## 10. Decisions made (during brainstorm)

- Length exposed as **thematic named tiers** (Glimpse 3 / Reading 5 / Deep Divination 7), **default Reading**.
- Results layout = **synthesis hero + collapsible compact tiles**; tap → existing detail modal.
- Spread tile = **Design A** (single uniform tile, triangle of three bare color-coded sigils with names).
- Corruption: add **random sigil chromatic aberration** + **live word-swaps**; render synthesis at **near-Pinnacle** intensity.
- Narrative scope = **entity voice + affinity voices** (all six speak; entity replaces text at Virulent+).
- Share = **4:5 portrait**, **reading-first** content, **wordmark-only** sign-off; corrupted = frozen static frame.

## 11. Open questions (resolve in planning)

- Exact final copy for the four new affinity notes and the entity-voice pool.
- Whether near-pinnacle entity voice *also* overrides the closing sign-off beat, or only the affinity note.
- `html2canvas` scale factor needed to hit exactly 1080×1350 from the 380×475 logical card.
- Confirm `TurnOrchestrator` pool/refill needs no change for 7 methods (verify, not assumed).
