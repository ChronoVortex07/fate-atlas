# History Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline `<HistoryTiles />` row in `GameTable.tsx` with a compact button that opens the existing `HistoryModal`.

**Architecture:** Add `useState` toggle in `GameTable`, replace `<HistoryTiles />` JSX with a styled button + conditional `<HistoryModal>`. The `HistoryModal` component is already built and needs no changes.

**Tech Stack:** React 18 + TypeScript, framer-motion (already in project)

## Global Constraints

- All game logic stays in `src/engine/` — this is a pure UI change
- Follow existing styling patterns (inline CSS objects, project color palette)
- `tsc -b` must pass (strict mode, noUnusedLocals, noUnusedParameters)

---

### Task 1: Replace HistoryTiles with button + modal in GameTable

**Files:**
- Modify: `src/components/screens/GameTable.tsx`

**Interfaces:**
- Consumes: `useGameEngine()` hook (already imported), `HistoryModal` component (already exists at `../overlays/HistoryModal`)
- Produces: Same component export, same render contract — just different top bar content

- [ ] **Step 1: Add imports and state, replace JSX**

Edit `src/components/screens/GameTable.tsx`:

1. Add `useState` import (line 1):
```tsx
import { useState, useCallback } from 'react';  // was just useCallback? No, let me check the actual imports...
```

Actually, let me check the current imports first and then show the exact edit.

The file currently has no `useState` import. Add it alongside `AnimatePresence` from framer-motion. Then:

```tsx
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import TitleScreen from './TitleScreen';
import QuestionSelect from './QuestionSelect';
import MethodSelect from './MethodSelect';
import TarotMinigame from './TarotMinigame';
import DiceMinigame from './DiceMinigame';
import IChingMinigame from './IChingMinigame';
import HappeningScene from './HappeningScene';
import ResultReading from './ResultReading';
import HistoryModal from '../overlays/HistoryModal';
import InteractionLayer from '../overlays/InteractionLayer';
```

2. Remove `HistoryTiles` import (line 11).

3. Add state inside the component (after `const { state } = useGameEngine()`):
```tsx
const [historyOpen, setHistoryOpen] = useState(false);
```

4. Replace `<HistoryTiles />` (line 51) with:
```tsx
{state.history.length > 0 && (
  <button
    type="button"
    style={historyBtnStyle}
    onClick={() => setHistoryOpen(true)}
  >
    Past Readings ({state.history.length})
  </button>
)}
{historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
```

5. Add style object at bottom of file (before or after `centerStyle`):
```tsx
const historyBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '20px',
  padding: '4px 16px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: No errors.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All existing tests pass (this is a UI-only change, no logic affected).

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/GameTable.tsx docs/superpowers/specs/2026-06-20-history-button-design.md docs/superpowers/plans/2026-06-20-history-button.md
git commit -m "feat: replace inline history tiles with button that opens HistoryModal

Co-Authored-By: Claude <noreply@anthropic.com>"
```
