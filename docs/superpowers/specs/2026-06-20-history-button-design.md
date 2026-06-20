# History Button Design

**Date:** 2026-06-20
**Status:** Approved

## Goal

Replace the inline `HistoryTiles` row at the top of every screen with a compact button that opens the existing `HistoryModal`. The inline tiles become cluttered after many readings.

## Design

### Changes (1 file)

**`src/components/screens/GameTable.tsx`:**
- Replace `<HistoryTiles />` with a small history button + `HistoryModal`
- Add `useState` toggle for modal visibility
- Button shows reading count, styled like the current tile aesthetic (dark translucent bg, gold accent, Inter 0.7rem)
- `HistoryModal` already exists and needs no changes

### What stays the same
- `HistoryTiles.tsx` — kept but no longer in the main render path
- `HistoryModal.tsx` — unchanged, already handles empty state, close, clear, Escape key
- `ResultReading.tsx` — already has its own "HISTORY (N)" button opening `HistoryModal`

### Button placement
- Top of screen, same position as current `HistoryTiles`
- Visible on all screens (title, question, method-select, minigame, happening, result)
