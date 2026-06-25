# Debug Panel Redesign

## Summary

Redesign the debug panel from a 4-tab raw-tools panel into a 3-tab dashboard-first debugging tool. Add affinity sliders with band labels, a "Current Decisions" section showing live affinity delta previews, and a live synthesis preview that shows how the current state will render on the results page.

## Motivation

- The current State tab is a raw JSON dump — useful for automated analysis but overwhelming for a human debugger.
- There's no way to adjust affinity values directly via the UI (only via JSON injection).
- There's no way to see what band an affinity is in without mentally computing thresholds.
- Decision points throughout the game have hidden affinity consequences; surfacing them helps debug the affinity system.
- The final results page depends on both turn results and affinity effects — a live preview of the synthesis would accelerate debugging of the narrative and affinity systems.

## Design

### 1. Tab Reorganization

**Current:** State | Inject | Steps | Events (all same prominence)

**New:** Dashboard (default) | Raw Data | Events

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Affinity sliders, current decisions with delta preview, scenario presets, state summary, synthesis preview |
| **Raw Data** | JSON state viewer + JSON injector (sub-sections within one tab) |
| **Events** | Reverse-chronological event log (unchanged) |

The old **Steps** tab (screen name + Reset Turn button) is absorbed into the Dashboard's State Summary section.

### 2. Panel Persistence

Today the debug panel closes on state transitions because `loadScenarioById()` (line 867), `returnToTitle()`, `returnToQuestionSelect()`, and `reset()` all call `this.state = this.defaultState()` which sets `debug: false`.

Make it **sticky**: once `debug` is set to `true`, nothing in the game loop sets it back to `false`.

Implementation: before any `this.state = this.defaultState()` call that should preserve debug, save and restore the `debug` and `debugConfig` fields:
```typescript
const { debug, debugConfig } = this.state;
this.state = this.defaultState();
if (debug) { this.state.debug = true; this.state.debugConfig = debugConfig; }
```

Alternatively, remove `debug` and `debugConfig` from `defaultState()`'s reset path and only clear them in a dedicated `clearHistory()` flow. The close button (`✕`) remains the only way to dismiss the panel: it calls `engine.loadState({ debug: false })`.

### 3. Dashboard Layout

Top-to-bottom, collapsible sections:

```
┌──────────────────────────────┐
│ ▲ Affinity Controls    [−]  │  open by default
│   Chaos    60 ████████░░ [range slider 0-100]
│             ascendant        │  band label, color-coded
│   Order    40 ████░░░░░░ [range slider]
│             stirring         │
│   ... (all 6 affinities)     │
├──────────────────────────────┤
│ ▼ Current Decisions   [+]  │  hidden when no decisions exist
│   [Decision context]         │
│   ▶ Choice   Aff +X (band → band)
│              └─ synthesis impact if any
├──────────────────────────────┤
│ ▼ Synthesis Preview   [−][⟳]│  open by default, live-toggle
│   Affinity Modifiers         │
│   Turn Stats (N/3 committed) │
│   Live Synthesis: headline + │
│     paragraphs               │
├──────────────────────────────┤
│ ▼ Scenario Presets    [+]  │
│   [dropdown] [Load]          │
├──────────────────────────────┤
│ ▼ State Summary       [+]  │
│   Screen, Turn progress,     │
│   Method, Question, [Reset]  │
└──────────────────────────────┘
```

### 4. Affinity Controls

- Six `<input type="range" min="0" max="100">` sliders, one per affinity.
- Dragging a slider calls `engine.loadState({ affinities: {...} })` directly — bypassing the normal `shift()` pipeline so exact values are set.
- Each slider shows the current numeric value and the band name below it.
- Band labels are color-coded:
  - `latent` (0-34): dim grey `#4a5568`
  - `stirring` (35-59): blue-grey `#7b9ec7`
  - `ascendant` (60-81): gold `#d4a854`
  - `dominant` (82-100): bright gold/white `#f0c060`
- A small bar visualization fills proportionally.

### 5. Current Decisions — Delta Preview

Auto-populates by reading the same data sources the engine uses. **Purely informative** — doesn't apply shifts, just previews what would happen.

**Data sources per decision type:**

| Screen | Decision | Delta Source |
|--------|----------|-------------|
| `happening` | Happening choices | `state.happening.choices[].affinityChanges` |
| `minigame` (tarot orient) | Reverse / Set orientation | `ACTION_FEEDS['reverse']`, `ACTION_FEEDS['set-orientation']` |
| `minigame` (reroll offer) | Take reroll / Decline | `ACTION_FEEDS['take-reroll']`, `ACTION_FEEDS['decline-reroll']` |
| `minigame` (peek offer) | Use peek / Decline | `ACTION_FEEDS['use-peek']`, `ACTION_FEEDS['decline-peek']` |
| `minigame` (reveal) | Reveal as drawn | `ACTION_FEEDS['reveal-as-drawn']` |
| `method-select` | Swap method | `ACTION_FEEDS['swap-method']` |
| Any (I Ching mandate) | N/A (auto) | Mandate factors from I Ching data |

**Format per choice:**
```
▶ [Choice Label]    Chaos  50+5 → 55 (stirring)
                    Will   45+3 → 48 (stirring)
```

Only affinities that actually change are listed.

### 6. Synthesis Preview

#### 6a. Affinity Modifiers (always visible)
Shows the current `AffinityEffects` that impact the results page:
- `readingDetail`: `+1 illuminated` | `0 neutral` | `-1 eclipsed`
- `hintClarity`: `-2` to `+2` with text description
- Affinity note preview (which chaos/order note will appear)

#### 6b. Turn Stats (when results are committed)
Runs `ReadingPlanner.aggregate()` against `state.turnResults`:
- Dominant theme + secondary theme
- Dimension profile: favorability, certainty, volatility (each with bar visualization, range -2 to +2)
- Tension status and tension pair
- Strongest favorable/adverse signals

#### 6c. Live Synthesis (headline + paragraphs)
Runs `NarrativeAssembler.assemble()` on every `notify()`:
- Headline in serif font
- All paragraphs
- Tension note (boxed)
- Affinity note (italic)

**Live toggle `[⟳]`:**
- On by default: synthesis re-runs on every state change
- When off: synthesis freezes, `[Refresh Preview]` button appears
- Toggle state is local component state, not persisted

#### 6d. Decision Impact Annotations
Each decision in "Current Decisions" also shows synthesis impacts if the delta crosses a meaningful threshold:
```
▶ Bargain    Shadow +8 (stirring → ascendant)
             └─ readingDetail: +1 → 0 ("illuminated" badge removed)
             └─ Light no longer ascendant: peek locked next run
```

Only shown when a threshold crossing changes a visible effect.

### 7. Raw Data Tab

Combines the old State viewer and JSON Injector:
- **JSON Viewer** (default sub-view): Same syntax-highlighted `<pre>` as today.
- **Inject** button toggles to the JSON textarea + "Inject State" button.
- Both share the tab; only one visible at a time.

### 8. Events Tab

Unchanged from today — reverse-chronological event log.

## Component Structure

```
src/components/debug/
  DebugPanel.tsx          — main panel, tab bar, persistence logic
  Dashboard.tsx           — NEW: affinity sliders, current decisions, scenario presets, state summary
  SynthesisPreview.tsx    — NEW: affinity modifiers, turn stats, live synthesis with toggle
  StateViewer.tsx         — keep, used by Raw Data tab
  JsonInjector.tsx        — keep, used by Raw Data tab
  RawDataTab.tsx          — NEW: thin wrapper combining StateViewer + JsonInjector with sub-navigation
  EventsTab.tsx           — NEW: extract events view from DebugPanel into its own file
```

## Engine Changes

### Panel Persistence

`loadScenarioById()`, `returnToTitle()`, `returnToQuestionSelect()`, and `reset()` all call `this.state = this.defaultState()` which sets `debug: false`. Each of these must preserve `debug` and `debugConfig` from the previous state so the panel stays open.

### Expose ReadingPlanner and NarrativeAssembler

Both are currently `private` on GameEngine. Add public getters:
```typescript
getReadingPlanner(): ReadingPlanner { return this.readingPlanner; }
getNarrativeAssembler(): NarrativeAssembler { return this.narrativeAssembler; }
```

These add no game logic — they only expose existing instances for the debug panel to call `aggregate()` and `assemble()` as read-only computations (no state mutation). The debug panel passes snapshot copies of state data; it never passes the live mutable state.

### No other engine changes

Everything else already exists:
- `engine.loadState({ affinities })` — for affinity sliders
- `engine.getState()` — for reading current state
- `state.affinities`, `state.turnResults`, `state.affinityEffects`, `state.happening` — for delta computation
- `ACTION_FEEDS`, `bandOf()`, `BAND_BOUNDS`, `bandOf()` from `src/data/affinities.ts` — importable from data layer

### Known Simplification: Delta Preview Shows Base Feeds

The delta preview reads `ACTION_FEEDS` and happening `affinityChanges` directly — it shows the **base feed values** (e.g. "Chaos +5"). The actual `AffinityEngine.shift()` pipeline applies diminishing returns, jitter (RNG), and coupling fan-out (opposite −60%, others −35%), so the real post-shift values will differ from the preview. This is acceptable: the preview shows intended direction and magnitude; actual values are observable by watching the affinity sliders update after the choice is made.

## Styling

Same palette and patterns as existing debug panel:
- Dark background `rgba(7, 10, 18, 0.95)`
- Gold accents `#d4a854`
- Blue-grey text `#7b9ec7`
- Monospace for code, Inter for UI
- Inline styles via `React.CSSProperties` objects

## Scope Boundaries

**In scope:**
- Tab reorganization (5→3 tabs)
- Dashboard with all sections described above
- Affinity sliders with band display
- Current Decisions delta preview
- Synthesis Preview with live toggle
- Panel persistence fix
- Raw Data tab combining State viewer + Injector
- Extracting Events tab to its own file

**Out of scope:**
- Changes to game logic or engine behavior
- Changes to the actual game UI (only debug panel changes)
- Component tests
- Mobile responsiveness of debug panel
