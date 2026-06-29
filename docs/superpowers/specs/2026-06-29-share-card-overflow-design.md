# ShareCard overflow — design

**Date:** 2026-06-29
**Branch:** `fix/share-card-overflow`
**Issue (TODO.md):** "In the share page, some readings may overflow out of the card, such as tarot
spreads with long names. It also overflows downwards if there are a large number of games."

## Context

`src/components/share/ShareCard.tsx` renders a fixed **380×475** card. `src/utils/shareExport.ts`
rasterises that exact box with html2canvas (`overflow: hidden`), so anything past the edges is
clipped in the exported PNG — there is no scrolling to fall back on.

Two failure modes:

1. **Horizontal.** A row is `[sigil] [name] [meta]`. For a tarot *spread* the `meta` holds three
   card names (`Card ▲ · Card ▼ · Card ▲`) and is `flex: 'none'`, so it never shrinks and has no
   ellipsis — long names spill past the card edge and get clipped mid-character. `name` (flex:1)
   likewise lacks `min-width:0`/ellipsis.
2. **Vertical.** A reading is **3 / 5 / 7** rows (game-length tiers; could exceed 7 if effects spawn
   extra committed results). The list sits above a `flex:1` spacer + footer; at the high end the
   rows push the badge/footer past H=475 and they clip.

Confirmed product decisions:
- Vertical: **auto-fit, then cap** — shrink to fit as many rows as possible; only cap with a
  `+ N more readings` line if it would shrink past a floor.
- Horizontal: **truncate**, and **even per-segment truncation** for multi-part rows so every card/node
  stays visible rather than the last one disappearing. (Implemented as a right-edge fade mask rather
  than `text-overflow: ellipsis` — see Rendering below — because the html2canvas export won't draw the
  `…` glyph.)
- A tarot spread's **primary text shows the drawn card names**, not the useless "Tarot Spread" label.

## Row model (horizontal)

`rowFor(result)` returns:

```ts
interface ShareRow {
  sigil: string;
  segments: { text: string; suffix?: string }[]; // 1 = simple row; >1 = even-truncated multi-part
  meta?: string;                                   // right-side descriptor; omitted for multi-part rows
}
```

Per type:

| type          | segments                                             | meta              |
|---------------|------------------------------------------------------|-------------------|
| tarot (card)  | `[{ text: name }]`                                   | `▲ Upright` / `▼ Reversed` |
| tarot (spread)| one per card: `{ text: card.name, suffix: ▲/▼ }`     | — (dropped)       |
| d20           | `[{ text: 'D20 · <n>' }]`                            | threshold words   |
| iching        | `[{ text: 'Hexagram <n> · <name>' }]`                | `Judgment`        |
| astral        | `[{ text: name }]`                                   | aspect            |
| rune          | `[{ text: name }]`                                   | `▲ Upright` / `▼ Merkstave` |
| strings       | `name.split(' · ').map(text => ({ text }))`          | — (dropped)       |

Rendering:
- Row is a flex line, fixed single-line height (uniform across all rows — keeps the fit math simple).
- Sigil: fixed width, no shrink.
- Segments live in a `flex:1; min-width:0` group. Each segment cell is `flex: 1 1 0` (equal shares,
  so several cards truncate evenly instead of the last one vanishing). The cell holds a relatively
  positioned text wrapper (`overflow:hidden; white-space:nowrap`) and a `flex:none` `suffix` glyph
  (orientation — never truncated). Adjacent segments are joined by a muted `·` divider.
- **Truncation cue = a right-edge fade mask, not `text-overflow: ellipsis`.** html2canvas (the share
  export) clips overflowing text but does **not** draw the `…` glyph, so a CSS-ellipsis row exports as
  a hard mid-character cut that reads like a glitch. Instead each text wrapper carries an absolutely
  positioned `linear-gradient(90deg, transparent, <row-bg>)` overlay at its right edge: invisible
  over empty space when the text fits, a soft dissolve when it overflows. This renders identically
  on-screen and in the html2canvas export.
- For single-segment rows the segment group fills the available width and the `meta` sits on the
  right (`flex:none`, with its own ellipsis as a safety). Multi-segment rows have no meta.
- The interpretation/tension note gets a hard character cap (insurance against a very long sentence).

## Auto-fit + cap (vertical)

- The list container becomes the flexible, clipped region: `flex:1; min-height:0; overflow:hidden`.
  The badge + footer follow it and are therefore **pinned to the bottom and never clipped**. The old
  `flex:1` spacer is removed.
- An inner wrapper holds the rows. A `useLayoutEffect` measures the wrapper's natural height
  (`scrollHeight`) against the container's `clientHeight` and computes a uniform
  `transform: scale(s)` (origin top-center) to shrink the rows so more fit. Re-measured on
  `document.fonts.ready` (web-font load changes row heights) and whenever the reading changes.
- If the required scale would drop below a floor (`MIN_SCALE ≈ 0.72`), it clamps to the floor and
  **caps**: render the rows that fit at the floor scale, minus one slot for a `+ N more readings`
  line.

The shrink/cap arithmetic is a **pure function**, isolated for unit testing:

```ts
// src/components/share/fitList.ts
export interface FitResult { scale: number; visibleRows: number; hiddenRows: number; }
export function fitList(opts: {
  available: number;      // list viewport height (px, measured)
  contentHeight: number;  // natural rows height (px, measured)
  rowStride: number;      // per-row height incl. gap (px, measured)
  totalRows: number;
  minScale?: number;      // default 0.72
  moreStride?: number;    // height the "+N more" line needs (px); default rowStride
}): FitResult;
```

Logic: `total ≤ available` → `{1, total, 0}`. Else `s = available/content`; `s ≥ minScale` →
`{s, total, 0}` (shrink, show all). Else clamp `s = minScale`, compute how many rows fit at that
scale reserving one `+N more` slot → `{minScale, visible, total − visible}` (`visible ≥ 1`).

## Scope / files

- `src/components/share/fitList.ts` — new pure helper.
- `src/engine/__tests__/ShareCardFit.test.ts` — new unit tests (Vitest is scoped to
  `src/engine/__tests__/**`; the test imports the helper from `src/components/share/`).
- `src/components/share/ShareCard.tsx` — `rowFor` → segment model, row renderer, measured auto-fit
  layout, footer pinning, tension cap.

No engine/data/affinity/happening logic changes, so `docs/game-systems.md` and the README rule tables
are unaffected.

## Verification

- `npm test` (fitList unit tests + existing 697 green) and `npm run build` (typecheck).
- Visual: inject a worst-case state via `?debug` JsonInjector + `engine.loadState` — 7 readings
  including a long-named tarot spread and a Strings path — and confirm in the rendered ShareCard that
  (a) no row clips horizontally, (b) the footer/wordmark stay visible, and (c) the `+N more` line
  appears only when rows are dropped.
