# Debug Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the debug panel from a 4-tab raw-tools panel into a 3-tab dashboard-first debugging tool with affinity sliders, delta previews, and a live synthesis preview.

**Architecture:** Three new components (Dashboard, SynthesisPreview, RawDataTab) plus one extracted component (EventsTab) compose into a reworked DebugPanel. Two engine changes: public accessors for the planner/assembler with a side-effect-free `previewSynthesis()` method, and debug-flag preservation across state resets.

**Tech Stack:** React 18 + TypeScript, inline CSSProperties styling (matching existing debug panel conventions), no new dependencies.

## Global Constraints

- All game logic stays in `src/engine/` — zero React imports there.
- Debug panel uses inline `React.CSSProperties` styles — no CSS files.
- Color palette matches existing: `#d4a854` (gold), `#7b9ec7` (blue-grey), `#c8d8f0` (light text), `#1a2440` (borders), `rgba(7, 10, 18, 0.95)` (background).
- Type safety enforced by `tsc` with `strict`, `noUnusedLocals`, `noUnusedParameters`.
- No component tests (out of scope per spec).
- Panel persists across scenario loads and state resets until explicitly closed.

---

### Task 1: Engine — Getters, previewSynthesis, and persistence

**Files:**
- Modify: `src/engine/NarrativeAssembler.ts:36-39`
- Modify: `src/engine/GameEngine.ts:87-94, 861-890, 979-1007`

**Interfaces:**
- Produces: `GameEngine.getReadingPlanner(): ReadingPlanner`, `GameEngine.getNarrativeAssembler(): NarrativeAssembler`, `GameEngine.previewSynthesis(): SynthesisResult | null`, `NarrativeAssembler.getRotationSnapshot(): Map<string, number>`, `NarrativeAssembler.restoreRotation(snapshot): void`
- Also preserves `state.debug` and `state.debugConfig` across `loadScenarioById()`, `returnToTitle()`, and `reset()` calls

- [ ] **Step 1: Add rotation snapshot/restore to NarrativeAssembler**

In `src/engine/NarrativeAssembler.ts`, after the `resetRotation()` method (after line 39), add:

```typescript
/** Snapshot rotation state so preview calls don't consume template rotation. */
getRotationSnapshot(): Map<string, number> {
  return new Map(this.rotationState);
}

/** Restore rotation state from a snapshot. */
restoreRotation(snapshot: Map<string, number>): void {
  this.rotationState = new Map(snapshot);
}
```

- [ ] **Step 2: Add public accessors and previewSynthesis to GameEngine**

In `src/engine/GameEngine.ts`, after the `notify()` method closing brace (after line 93), insert:

```typescript
// ---------- Public accessors for debug panel ----------

getReadingPlanner(): ReadingPlanner { return this.readingPlanner; }
getNarrativeAssembler(): NarrativeAssembler { return this.narrativeAssembler; }

/**
 * Compute a synthesis preview without consuming template rotation state.
 * Safe to call every render — snapshots and restores the assembler's rotation.
 */
previewSynthesis(): import('./types').SynthesisResult | null {
  const results = this.state.turnResults;
  if (results.length === 0) return null;

  const rotSnapshot = this.narrativeAssembler.getRotationSnapshot();
  try {
    const question = this.state.questionType ?? 'self';
    const affinities = this.affinityEngine.getState();
    const aggregated = this.readingPlanner.aggregate(results, question);
    return this.narrativeAssembler.assemble(
      aggregated,
      results,
      question,
      affinities,
      this.affinityEngine.getEffects(),
    );
  } finally {
    this.narrativeAssembler.restoreRotation(rotSnapshot);
  }
}
```

- [ ] **Step 3: Fix loadScenarioById to preserve debug state**

In `src/engine/GameEngine.ts`, in `loadScenarioById()` (line 861), replace:

```typescript
loadScenarioById(id: string): boolean {
  const scenario = findScenario(id);
  if (!scenario) return false;

  // Reset to a fresh game, then stage the scenario.
  this.affinityEngine.setState(defaultAffinityState());
  this.state = this.defaultState();
```

with:

```typescript
loadScenarioById(id: string): boolean {
  const scenario = findScenario(id);
  if (!scenario) return false;

  // Preserve debug state across scenario load
  const { debug, debugConfig } = this.state;

  // Reset to a fresh game, then stage the scenario.
  this.affinityEngine.setState(defaultAffinityState());
  this.state = this.defaultState();

  // Restore debug state
  this.state.debug = debug;
  this.state.debugConfig = debugConfig;
```

- [ ] **Step 4: Fix returnToTitle to preserve debug state**

In `src/engine/GameEngine.ts`, in `returnToTitle()` (line 979), after `const saved = { ... };` and before `this.state = this.defaultState();`, save debug state. Replace the method body from:

```typescript
returnToTitle(): void {
  const saved = {
    affinities: this.affinityEngine.getState(),
    history: this.state.history,
    usedHappeningIds: Array.from(this.usedHappeningIds),
  };
  this.state = this.defaultState();
```

to:

```typescript
returnToTitle(): void {
  // Preserve debug state
  const { debug, debugConfig } = this.state;

  const saved = {
    affinities: this.affinityEngine.getState(),
    history: this.state.history,
    usedHappeningIds: Array.from(this.usedHappeningIds),
  };
  this.state = this.defaultState();

  // Restore debug state
  this.state.debug = debug;
  this.state.debugConfig = debugConfig;
```

- [ ] **Step 5: Fix reset to preserve debug state**

In `src/engine/GameEngine.ts`, in `reset()` (line 995), after `const usedIds = ...` and before `this.state = this.defaultState();`, save debug state. Replace from:

```typescript
reset(): void {
  const affinities = this.affinityEngine.getState();
  const history = this.state.history;
  const usedIds = Array.from(this.usedHappeningIds);
  this.state = this.defaultState();
```

to:

```typescript
reset(): void {
  // Preserve debug state
  const { debug, debugConfig } = this.state;

  const affinities = this.affinityEngine.getState();
  const history = this.state.history;
  const usedIds = Array.from(this.usedHappeningIds);
  this.state = this.defaultState();

  // Restore debug state
  this.state.debug = debug;
  this.state.debugConfig = debugConfig;
```

- [ ] **Step 6: Typecheck engine changes**

Run: `npx tsc -b --noEmit src/engine/GameEngine.ts src/engine/NarrativeAssembler.ts`
(Or just: `npx tsc -b`)

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/GameEngine.ts src/engine/NarrativeAssembler.ts
git commit -m "feat(engine): add debug accessors, previewSynthesis, and persistence fixes"
```

---

### Task 2: Extract EventsTab + Create RawDataTab

**Files:**
- Create: `src/components/debug/EventsTab.tsx`
- Create: `src/components/debug/RawDataTab.tsx`
- Modify: `src/components/debug/DebugPanel.tsx` (remove EventsTab inline, keep imports for now)

**Interfaces:**
- Produces: `EventsTab` (default export, no props — uses `useGameEngine()`), `RawDataTab` (default export, no props — uses `useGameEngine()`)
- Consumes: `StateViewer` (existing default export), `JsonInjector` (existing default export)

- [ ] **Step 1: Create EventsTab.tsx**

Create `src/components/debug/EventsTab.tsx`:

```typescript
import { useGameEngine } from '../../hooks/useGameEngine';

export default function EventsTab() {
  const { state } = useGameEngine();

  const events = state.eventLog;

  return (
    <div style={containerStyle}>
      {events.length === 0 ? (
        <div style={emptyStyle}>No events yet</div>
      ) : (
        events
          .slice()
          .reverse()
          .map((event, i) => (
            <div key={i} style={eventRowStyle}>
              <span style={eventTypeStyle}>{event.type}</span>
              <span style={eventTimeStyle}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: '0.5rem',
  overflow: 'auto',
  height: '100%',
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.7rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  textAlign: 'center',
  padding: '1rem',
};

const eventRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.3rem 0',
  borderBottom: '1px solid rgba(26, 36, 64, 0.4)',
  gap: '0.5rem',
};

const eventTypeStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.6rem',
  color: '#c8d8f0',
};

const eventTimeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.55rem',
  color: '#7b9ec7',
  whiteSpace: 'nowrap',
};
```

- [ ] **Step 2: Create RawDataTab.tsx**

Create `src/components/debug/RawDataTab.tsx`:

```typescript
import { useState } from 'react';
import StateViewer from './StateViewer';
import JsonInjector from './JsonInjector';

type SubTab = 'view' | 'inject';

export default function RawDataTab() {
  const [subTab, setSubTab] = useState<SubTab>('view');

  return (
    <div style={containerStyle}>
      <div style={subTabBarStyle}>
        <button
          style={{
            ...subTabBtnStyle,
            ...(subTab === 'view' ? activeSubTabStyle : {}),
          }}
          onClick={() => setSubTab('view')}
        >
          View
        </button>
        <button
          style={{
            ...subTabBtnStyle,
            ...(subTab === 'inject' ? activeSubTabStyle : {}),
          }}
          onClick={() => setSubTab('inject')}
        >
          Inject
        </button>
      </div>
      <div style={contentStyle}>
        {subTab === 'view' ? <StateViewer /> : <JsonInjector />}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const subTabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #1a2440',
  flexShrink: 0,
};

const subTabBtnStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  background: 'transparent',
  border: 'none',
  padding: '0.35rem 0',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
  outline: 'none',
  transition: 'border-color 0.2s ease, color 0.2s ease',
};

const activeSubTabStyle: React.CSSProperties = {
  color: '#d4a854',
  borderBottomColor: '#d4a854',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/debug/EventsTab.tsx src/components/debug/RawDataTab.tsx
git commit -m "feat(debug): extract EventsTab, add RawDataTab with View/Inject toggle"
```

---

### Task 3: Create SynthesisPreview component

**Files:**
- Create: `src/components/debug/SynthesisPreview.tsx`

**Interfaces:**
- Produces: `SynthesisPreview` (default export, no props — uses `useGameEngine()`)
- Consumes: `engine.getReadingPlanner().aggregate()`, `engine.previewSynthesis()`, `state.affinityEffects`, `state.turnResults`, `state.questionType`, `bandOf()` from `src/data/affinities`

- [ ] **Step 1: Create SynthesisPreview.tsx**

Create `src/components/debug/SynthesisPreview.tsx`:

```typescript
import { useState, useCallback, useMemo } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { bandOf } from '../../data/affinities';
import type { AggregatedReading, SynthesisResult, AffinityEffects } from '../../engine/types';

// ── Helper: human-readable readingDetail label ──
function detailLabel(rd: number): string {
  if (rd >= 1) return '+1 illuminated';
  if (rd <= -1) return '−1 eclipsed';
  return '0 neutral';
}

// ── Helper: human-readable hintClarity label ──
function clarityLabel(hc: number): string {
  const abs = Math.abs(hc);
  const prefix = hc >= 0 ? '+' : '−';
  if (abs >= 2) return `${prefix}2 forces name themselves`;
  if (abs >= 1) return `${prefix}1 subtle influence`;
  return '0 neutral';
}

// ── Mini bar visualization for dimension values (−2 to +2) ──
function DimBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, ((value + 2) / 4) * 100));
  const sign = value >= 0 ? '+' : '−';
  return (
    <div style={dimRowStyle}>
      <span style={dimLabelStyle}>{label}</span>
      <div style={dimBarTrackStyle}>
        <div style={{ ...dimBarFillStyle, width: `${pct}%` }} />
      </div>
      <span style={dimValueStyle}>{sign}{Math.abs(value).toFixed(1)}</span>
    </div>
  );
}

// ── Main component ──
export default function SynthesisPreview() {
  const { state, engine } = useGameEngine();
  const [live, setLive] = useState(true);
  const [cachedSynth, setCachedSynth] = useState<SynthesisResult | null>(null);

  // Always compute aggregated (pure function, no side effects)
  const aggregated: AggregatedReading | null = useMemo(() => {
    const results = state.turnResults.filter((r) => r.type !== 'happening');
    if (results.length === 0) return null;
    return engine.getReadingPlanner().aggregate(
      state.turnResults,
      state.questionType ?? 'self',
    );
  }, [state.turnResults, state.questionType, engine]);

  // Synthesis: live = compute every render; frozen = use cache
  const synthesis: SynthesisResult | null = live
    ? (state.turnResults.length > 0 ? engine.previewSynthesis() : null)
    : cachedSynth;

  const handleToggleLive = useCallback(() => {
    setLive((prev) => {
      if (prev) {
        // Freezing: snapshot current result
        setCachedSynth(engine.previewSynthesis());
      }
      return !prev;
    });
  }, [engine]);

  const handleRefresh = useCallback(() => {
    setCachedSynth(engine.previewSynthesis());
  }, [engine]);

  const eff: AffinityEffects = state.affinityEffects;

  const hasTurnData = state.turnResults.length > 0;

  // Determine affinity note preview from current Chaos/Order bands
  const chaosBand = bandOf(state.affinities.chaos);
  const orderBand = bandOf(state.affinities.order);
  let affinityNotePreview: string | null = null;
  if (chaosBand === 'ascendant' || chaosBand === 'dominant') {
    affinityNotePreview = 'The currents of chaos run strong…';
  } else if (orderBand === 'ascendant' || orderBand === 'dominant') {
    affinityNotePreview = 'Order shapes this reading with unusual clarity…';
  }

  return (
    <div style={containerStyle}>
      {/* ── Affinity Modifiers ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Affinity Modifiers</div>
        <div style={modifierRowStyle}>
          <span style={modLabelStyle}>Reading Detail</span>
          <span style={modValueStyle(eff.readingDetail)}>
            {detailLabel(eff.readingDetail)}
          </span>
        </div>
        <div style={modifierRowStyle}>
          <span style={modLabelStyle}>Hint Clarity</span>
          <span style={modValueStyle(eff.hintClarity)}>
            {clarityLabel(eff.hintClarity)}
          </span>
        </div>
        {affinityNotePreview && (
          <div style={modifierRowStyle}>
            <span style={modLabelStyle}>Affinity Note</span>
            <span style={notePreviewStyle}>"{affinityNotePreview}"</span>
          </div>
        )}
      </div>

      {/* ── Turn Stats ── */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Turn Stats ({state.turnResults.filter((r) => r.type !== 'happening').length}/{state.minigamesCompleted} committed)
        </div>
        {!hasTurnData ? (
          <div style={emptyStyle}>No results committed yet</div>
        ) : aggregated ? (
          <>
            <div style={themeRowStyle}>
              <span style={modLabelStyle}>Dominant Theme</span>
              <span style={themeValueStyle}>{aggregated.dominantTheme}</span>
            </div>
            {aggregated.secondaryTheme && (
              <div style={themeRowStyle}>
                <span style={modLabelStyle}>Secondary</span>
                <span style={themeSecondaryStyle}>{aggregated.secondaryTheme}</span>
              </div>
            )}
            <DimBar label="Favorability" value={aggregated.dimensionProfile.favorability} />
            <DimBar label="Certainty" value={aggregated.dimensionProfile.certainty} />
            <DimBar label="Volatility" value={aggregated.dimensionProfile.volatility} />
            {aggregated.hasTension && (
              <div style={tensionRowStyle}>
                <span style={modLabelStyle}>Tension</span>
                <span style={tensionValueStyle}>
                  {aggregated.tensionPair
                    ? `${aggregated.tensionPair[0]} vs ${aggregated.tensionPair[1]}`
                    : 'high variance'}
                </span>
              </div>
            )}
            {aggregated.strongestFavor && (
              <div style={themeRowStyle}>
                <span style={modLabelStyle}>Strongest +</span>
                <span style={signalValueStyle}>
                  {aggregated.strongestFavor.label} (+{aggregated.strongestFavor.value})
                </span>
              </div>
            )}
            {aggregated.strongestAdverse && (
              <div style={themeRowStyle}>
                <span style={modLabelStyle}>Strongest −</span>
                <span style={signalAdverseStyle}>
                  {aggregated.strongestAdverse.label} ({aggregated.strongestAdverse.value})
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ── Live Synthesis ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderRowStyle}>
          <div style={sectionTitleStyle}>Live Synthesis</div>
          <div style={toggleRowStyle}>
            <button
              style={live ? toggleOnStyle : toggleOffStyle}
              onClick={handleToggleLive}
              title={live ? 'Live — click to freeze' : 'Frozen — click to resume live'}
            >
              {live ? '⟳ Live' : '⟳ Off'}
            </button>
            {!live && (
              <button style={refreshBtnStyle} onClick={handleRefresh}>
                Refresh
              </button>
            )}
          </div>
        </div>
        {synthesis ? (
          <div style={synthBodyStyle}>
            <div style={headlineStyle}>{synthesis.headline}</div>
            {synthesis.paragraphs.map((p, i) => (
              <p key={i} style={paragraphStyle}>{p}</p>
            ))}
            {synthesis.tensionNote && (
              <div style={tensionBoxStyle}>{synthesis.tensionNote}</div>
            )}
            {synthesis.affinityNote && (
              <div style={affinityNoteStyle}>{synthesis.affinityNote}</div>
            )}
          </div>
        ) : (
          <div style={emptyStyle}>
            {state.turnResults.length === 0
              ? 'Complete at least one reading to preview synthesis'
              : 'No synthesis available'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──

const containerStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  overflow: 'auto',
  height: '100%',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid rgba(26, 36, 64, 0.5)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  marginBottom: '0.35rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.35rem',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.3rem',
  alignItems: 'center',
};

const toggleOnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.55rem',
  color: '#d4a854',
  background: 'rgba(212, 168, 84, 0.15)',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.15rem 0.4rem',
  cursor: 'pointer',
  outline: 'none',
  whiteSpace: 'nowrap',
};

const toggleOffStyle: React.CSSProperties = {
  ...toggleOnStyle,
  color: '#7b9ec7',
  background: 'rgba(123, 158, 199, 0.1)',
  border: '1px solid #7b9ec7',
};

const refreshBtnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.55rem',
  color: '#d4a854',
  background: 'transparent',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.15rem 0.4rem',
  cursor: 'pointer',
  outline: 'none',
  whiteSpace: 'nowrap',
};

const modifierRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.15rem 0',
};

const modLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#7b9ec7',
};

const modValueStyle = (val: number): React.CSSProperties => ({
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.6rem',
  color: val > 0 ? '#d4a854' : val < 0 ? '#7b9ec7' : '#c8d8f0',
});

const notePreviewStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.55rem',
  color: '#c8d8f0',
  fontStyle: 'italic',
  maxWidth: '180px',
  textAlign: 'right',
};

const themeRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.1rem 0',
};

const themeValueStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#d4a854',
  fontWeight: 600,
};

const themeSecondaryStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#c8d8f0',
};

const signalValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#d4a854',
};

const signalAdverseStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#7b9ec7',
};

const dimRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.1rem 0',
};

const dimLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.55rem',
  color: '#7b9ec7',
  width: '70px',
  flexShrink: 0,
};

const dimBarTrackStyle: React.CSSProperties = {
  flex: 1,
  height: '6px',
  background: 'rgba(26, 36, 64, 0.6)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const dimBarFillStyle: React.CSSProperties = {
  height: '100%',
  background: '#d4a854',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
};

const dimValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#c8d8f0',
  width: '32px',
  textAlign: 'right',
};

const tensionRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.15rem 0',
};

const tensionValueStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#e74c3c',
  fontWeight: 500,
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#7b9ec7',
  fontStyle: 'italic',
  padding: '0.25rem 0',
};

const synthBodyStyle: React.CSSProperties = {
  maxHeight: '400px',
  overflow: 'auto',
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#d4a854',
  marginBottom: '0.4rem',
  lineHeight: 1.3,
};

const paragraphStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#c8d8f0',
  lineHeight: 1.45,
  margin: '0 0 0.35rem 0',
};

const tensionBoxStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#e74c3c',
  fontStyle: 'italic',
  borderLeft: '2px solid #d4a854',
  paddingLeft: '0.5rem',
  margin: '0.35rem 0',
  lineHeight: 1.4,
};

const affinityNoteStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#c8d8f0',
  fontStyle: 'italic',
  textAlign: 'center',
  marginTop: '0.35rem',
  lineHeight: 1.4,
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`

Expected: No type errors. Fix any issues with imports or type mismatches.

- [ ] **Step 3: Commit**

```bash
git add src/components/debug/SynthesisPreview.tsx
git commit -m "feat(debug): add SynthesisPreview with live toggle and turn stats"
```

---

### Task 4: Create Dashboard component

**Files:**
- Create: `src/components/debug/Dashboard.tsx`

**Interfaces:**
- Produces: `Dashboard` (default export, no props — uses `useGameEngine()`)
- Consumes: `engine.loadState()`, `engine.loadScenarioById()`, `engine.getScenarioPresets()`, `engine.reset()`, `engine.forceEffects()`, `engine.getResponderIds()`, `state.affinities`, `state.screen`, `state.happening`, `state.minigameState`, `state.minigamesCompleted`, `state.selectedMethod`, `state.questionType`, `state.debugConfig`, `bandOf()`, `BAND_BOUNDS`, `AFFINITY_IDS`, `ACTION_FEEDS`, `FEED_PER_ACTION`, `SECONDARY_FEED_FACTOR`, `AffinityId` type, `AffinityAction` type
- Also renders: `SynthesisPreview`

**Note on Current Decisions detection:** The component examines `state.screen` and minigame substate to auto-detect which decisions are available. For tarot/dice/iching minigames, the detection logic inspects the minigame state's phase or flags. The exact detection patterns are documented inline.

- [ ] **Step 1: Create Dashboard.tsx**

Create `src/components/debug/Dashboard.tsx`:

```typescript
import { useState, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import { bandOf, BAND_ORDER, AFFINITY_IDS, ACTION_FEEDS, FEED_PER_ACTION, SECONDARY_FEED_FACTOR } from '../../data/affinities';
import type { AffinityId, AffinityAction, AffinityBand } from '../../engine/types';
import SynthesisPreview from './SynthesisPreview';

// ── Band color helper ──
const BAND_COLORS: Record<AffinityBand, string> = {
  latent: '#4a5568',
  stirring: '#7b9ec7',
  ascendant: '#d4a854',
  dominant: '#f0c060',
};

// ── Helper: compute what band a new value would be in ──
function wouldCrossBand(current: number, delta: number): { currentBand: AffinityBand; newBand: AffinityBand; crosses: boolean } {
  const currentBand = bandOf(current);
  const newValue = Math.max(0, Math.min(100, current + delta));
  const newBand = bandOf(newValue);
  return { currentBand, newBand, crosses: currentBand !== newBand };
}

// ── Types for decision detection ──
interface DecisionOption {
  label: string;
  deltas: Partial<Record<AffinityId, number>>;
  /** Which band thresholds this delta would cross, with synthesis impacts */
  impacts?: string[];
}

interface DecisionGroup {
  context: string;
  options: DecisionOption[];
}

// ── Detect currently available decisions from game state ──
function detectDecisions(state: ReturnType<typeof useGameEngine>['state']): DecisionGroup[] {
  const groups: DecisionGroup[] = [];
  const affinities = state.affinities;

  // Helper: build delta from ACTION_FEEDS
  function feedDeltas(action: AffinityAction): Partial<Record<AffinityId, number>> {
    const feed = ACTION_FEEDS[action];
    if (!feed) return {};
    const deltas: Partial<Record<AffinityId, number>> = {};
    deltas[feed.primary] = FEED_PER_ACTION;
    if (feed.secondary) {
      deltas[feed.secondary] = Math.round(FEED_PER_ACTION * SECONDARY_FEED_FACTOR);
    }
    return deltas;
  }

  // Helper: compute synthesis impacts for a set of deltas
  function computeImpacts(deltas: Partial<Record<AffinityId, number>>): string[] {
    const impacts: string[] = [];
    for (const [id, delta] of Object.entries(deltas) as [AffinityId, number][]) {
      if (!delta) continue;
      const current = affinities[id];
      const bandInfo = wouldCrossBand(current, delta);
      if (bandInfo.crosses) {
        impacts.push(
          `${id}: ${bandInfo.currentBand} → ${bandInfo.newBand}`,
        );
        // Check for readingDetail impact (Light/Shadow crossing)
        if (id === 'light' || id === 'shadow') {
          const lightBand = bandOf(id === 'light' ? current + delta : affinities.light);
          const shadowBand = bandOf(id === 'shadow' ? current + delta : affinities.shadow);
          const lightIdx = BAND_ORDER.indexOf(id === 'light' ? lightBand : bandOf(affinities.light));
          const shadowIdx = BAND_ORDER.indexOf(id === 'shadow' ? shadowBand : bandOf(affinities.shadow));
          const newReadingDetail = Math.max(-1, Math.min(1, lightIdx - shadowIdx));
          const currentReadingDetail = Math.max(-1, Math.min(1,
            BAND_ORDER.indexOf(bandOf(affinities.light)) - BAND_ORDER.indexOf(bandOf(affinities.shadow))));
          if (newReadingDetail !== currentReadingDetail) {
            impacts.push(
              `readingDetail: ${currentReadingDetail > 0 ? '+' : ''}${currentReadingDetail} → ${newReadingDetail > 0 ? '+' : ''}${newReadingDetail}`,
            );
          }
        }
      }
    }
    return impacts;
  }

  // 1. Happening choices
  if (state.screen === 'happening' && state.happening) {
    const options: DecisionOption[] = state.happening.choices.map((choice, i) => ({
      label: choice.text.length > 50 ? choice.text.slice(0, 47) + '…' : choice.text,
      deltas: (choice.affinityChanges ?? {}) as Partial<Record<AffinityId, number>>,
      impacts: computeImpacts((choice.affinityChanges ?? {}) as Partial<Record<AffinityId, number>>),
    }));
    groups.push({ context: `Happening: "${(state.happening.scene ?? '').slice(0, 40)}"`, options });
  }

  // 2. Method select — swap method
  if (state.screen === 'method-select' && state.availableMethods.length > 0) {
    const deltas = feedDeltas('swap-method');
    groups.push({
      context: 'Method Select',
      options: [{ label: 'Swap Method', deltas, impacts: computeImpacts(deltas) }],
    });
  }

  // 3. Minigame decisions
  if (state.screen === 'minigame' && state.minigameState) {
    const ms = state.minigameState;

    // Tarot: check phase
    if (ms.phase) {
      // Tarot draft phases
      if (ms.phase === 'orient') {
        const reverseDeltas = feedDeltas('reverse');
        const orientDeltas = feedDeltas('set-orientation');
        groups.push({
          context: 'Tarot: Orientation',
          options: [
            { label: 'Reverse', deltas: reverseDeltas, impacts: computeImpacts(reverseDeltas) },
            { label: 'Set Orientation (free)', deltas: orientDeltas, impacts: computeImpacts(orientDeltas) },
          ],
        });
      }
    }

    // NOTE: Reroll offers (take-reroll / decline-reroll) and reveal-as-drawn
    // are triggered by engine responders at specific moments within minigame flows.
    // Detecting these perfectly from snapshot state alone is fragile because they
    // depend on transient responder-triggered flags not exposed on GameState.
    // These decisions will appear in the delta preview only when the engine
    // surfaces an explicit offer flag in a future enhancement.
  }

  // 4. Peek availability
  if (state.affinityEffects.peekAvailable && state.screen === 'minigame' && state.minigameState) {
    const useDeltas = feedDeltas('use-peek');
    const declineDeltas = feedDeltas('decline-peek');
    groups.push({
      context: 'Peek Available',
      options: [
        { label: 'Use Peek', deltas: useDeltas, impacts: computeImpacts(useDeltas) },
        { label: 'Decline Peek', deltas: declineDeltas, impacts: computeImpacts(declineDeltas) },
      ],
    });
  }

  return groups;
}

// ── Main Dashboard component ──
export default function Dashboard() {
  const { state, engine } = useGameEngine();

  // ── Collapsible section state ──
  const [affinityOpen, setAffinityOpen] = useState(true);
  const [decisionsOpen, setDecisionsOpen] = useState(true);
  const [synthOpen, setSynthOpen] = useState(true);
  const [scenarioOpen, setScenariosOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);

  // ── Scenario state ──
  const [scenarioId, setScenarioId] = useState('');
  const presets = engine.getScenarioPresets();
  const groupedPresets = presets.reduce<Record<string, typeof presets>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  // ── Force effects state ──
  const responderIds = engine.getResponderIds();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isolate, setIsolate] = useState(false);

  // ── Handlers ──
  const handleAffinityChange = useCallback(
    (id: AffinityId, value: number) => {
      engine.loadState({ affinities: { ...state.affinities, [id]: value } });
    },
    [engine, state.affinities],
  );

  const handleLoadScenario = useCallback(() => {
    if (scenarioId) engine.loadScenarioById(scenarioId);
  }, [scenarioId, engine]);

  const handleResetTurn = useCallback(() => {
    engine.reset();
  }, [engine]);

  const handleToggleResponder = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleArm = useCallback(() => {
    engine.forceEffects(selectedIds, isolate);
  }, [engine, selectedIds, isolate]);

  const handleClearArmed = useCallback(() => {
    engine.forceEffects([], false);
    setSelectedIds([]);
    setIsolate(false);
  }, [engine]);

  // ── Detect current decisions ──
  const decisionGroups = detectDecisions(state);
  const { forced, isolate: armedIsolate } = state.debugConfig;

  return (
    <div style={dashContainerStyle}>
      {/* ════ Affinity Controls ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setAffinityOpen((p) => !p)}
        >
          <span style={triangleStyle(affinityOpen)}>{affinityOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>Affinity Controls</span>
        </button>
        {affinityOpen && (
          <div style={affinityBodyStyle}>
            {AFFINITY_IDS.map((id) => {
              const value = state.affinities[id];
              const band = bandOf(value);
              return (
                <div key={id} style={affinityRowStyle}>
                  <div style={affinityHeaderRowStyle}>
                    <span style={affinityNameStyle}>
                      {id.charAt(0).toUpperCase() + id.slice(1)}
                    </span>
                    <span style={affinityValueStyle}>{value}</span>
                    <span style={{ ...bandLabelStyle, color: BAND_COLORS[band] }}>
                      {band}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) =>
                      handleAffinityChange(id, Number(e.target.value))
                    }
                    style={sliderStyle}
                  />
                  <div style={barTrackStyle}>
                    <div
                      style={{
                        ...barFillStyle,
                        width: `${value}%`,
                        background: BAND_COLORS[band],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════ Current Decisions ════ */}
      {decisionGroups.length > 0 && (
        <div style={sectionBorderStyle}>
          <button
            style={sectionHeaderStyle}
            onClick={() => setDecisionsOpen((p) => !p)}
          >
            <span style={triangleStyle(decisionsOpen)}>{decisionsOpen ? '▼' : '▶'}</span>
            <span style={sectionLabelStyle}>Current Decisions</span>
          </button>
          {decisionsOpen && (
            <div style={decisionsBodyStyle}>
              {decisionGroups.map((group, gi) => (
                <div key={gi} style={decisionGroupStyle}>
                  <div style={decisionContextStyle}>{group.context}</div>
                  {group.options.map((opt, oi) => (
                    <div key={oi} style={decisionOptionStyle}>
                      <div style={decisionLabelStyle}>▶ {opt.label}</div>
                      {Object.entries(opt.deltas).map(([affId, delta]) => {
                        const current = state.affinities[affId as AffinityId];
                        const newVal = Math.max(0, Math.min(100, current + (delta as number)));
                        const sign = (delta as number) >= 0 ? '+' : '';
                        return (
                          <div key={affId} style={deltaRowStyle}>
                            <span style={deltaAffStyle}>
                              {affId.charAt(0).toUpperCase() + affId.slice(1)}
                            </span>
                            <span style={deltaMathStyle}>
                              {current}{sign}{delta} → {newVal}
                            </span>
                            <span
                              style={{
                                ...bandLabelStyle,
                                color: BAND_COLORS[bandOf(newVal)],
                                fontSize: '0.5rem',
                              }}
                            >
                              {bandOf(newVal)}
                            </span>
                          </div>
                        );
                      })}
                      {opt.impacts && opt.impacts.length > 0 && (
                        <div style={impactListStyle}>
                          {opt.impacts.map((imp, ii) => (
                            <div key={ii} style={impactItemStyle}>
                              └─ {imp}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ Synthesis Preview ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setSynthOpen((p) => !p)}
        >
          <span style={triangleStyle(synthOpen)}>{synthOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>Synthesis Preview</span>
        </button>
        {synthOpen && <SynthesisPreview />}
      </div>

      {/* ════ Scenario Presets ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setScenariosOpen((p) => !p)}
        >
          <span style={triangleStyle(scenarioOpen)}>{scenarioOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>Scenario Presets</span>
        </button>
        {scenarioOpen && (
          <div style={scenarioBodyStyle}>
            <div style={scenarioRowStyle}>
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- Select --</option>
                {Object.entries(groupedPresets).map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button onClick={handleLoadScenario} style={btnStyle}>
                Load
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════ State Summary ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setSummaryOpen((p) => !p)}
        >
          <span style={triangleStyle(summaryOpen)}>{summaryOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>State Summary</span>
        </button>
        {summaryOpen && (
          <div style={summaryBodyStyle}>
            <div style={summaryRowStyle}>
              <span style={summaryKeyStyle}>Screen</span>
              <span style={summaryValueStyle}>{state.screen}</span>
            </div>
            <div style={summaryRowStyle}>
              <span style={summaryKeyStyle}>Turn</span>
              <span style={summaryValueStyle}>
                {state.minigamesCompleted}/3 complete
              </span>
            </div>
            <div style={summaryRowStyle}>
              <span style={summaryKeyStyle}>Method</span>
              <span style={summaryValueStyle}>
                {state.selectedMethod ?? 'none'}
              </span>
            </div>
            <div style={summaryRowStyle}>
              <span style={summaryKeyStyle}>Question</span>
              <span style={summaryValueStyle}>
                {state.questionType ?? 'none'}
              </span>
            </div>
            <button style={resetBtnStyle} onClick={handleResetTurn}>
              Reset Turn
            </button>
          </div>
        )}
      </div>

      {/* ════ Force Effects ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setForceOpen((p) => !p)}
        >
          <span style={triangleStyle(forceOpen)}>{forceOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>Force Effects</span>
        </button>
        {forceOpen && (
          <div style={forceBodyStyle}>
            <div style={responderListStyle}>
              {responderIds.map((id) => (
                <label key={id} style={checkLabelStyle}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(id)}
                    onChange={() => handleToggleResponder(id)}
                    style={checkboxStyle}
                  />
                  <span style={checkTextStyle}>{id}</span>
                </label>
              ))}
            </div>
            <label style={{ ...checkLabelStyle, marginTop: '6px' }}>
              <input
                type="checkbox"
                checked={isolate}
                onChange={(e) => setIsolate(e.target.checked)}
                style={checkboxStyle}
              />
              <span style={checkTextStyle}>Isolate (suppress all others)</span>
            </label>
            <div style={armRowStyle}>
              <button onClick={handleArm} style={btnStyle}>
                Arm
              </button>
              <button onClick={handleClearArmed} style={clearBtnStyle}>
                Clear
              </button>
            </div>
            <div style={armedStatusStyle}>
              {forced.length > 0 || armedIsolate
                ? `Armed: [${forced.join(', ') || 'none'}]${armedIsolate ? ' isolate=on' : ''}`
                : 'No effects armed'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Styles ──

const dashContainerStyle: React.CSSProperties = {
  overflow: 'auto',
  height: '100%',
};

const sectionBorderStyle: React.CSSProperties = {
  borderBottom: '1px solid #1a2440',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  width: '100%',
  padding: '0.4rem 0.75rem',
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.65rem',
  color: '#7b9ec7',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
  textAlign: 'left',
};

const triangleStyle = (open: boolean): React.CSSProperties => ({
  fontSize: '0.55rem',
  color: open ? '#d4a854' : '#7b9ec7',
  width: '10px',
  flexShrink: 0,
  transition: 'color 0.2s ease',
});

const sectionLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

// ── Affinity Controls Styles ──

const affinityBodyStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem 0.5rem',
};

const affinityRowStyle: React.CSSProperties = {
  marginBottom: '0.5rem',
};

const affinityHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  marginBottom: '0.15rem',
};

const affinityNameStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.65rem',
  color: '#c8d8f0',
  minWidth: '52px',
};

const affinityValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.6rem',
  color: '#c8d8f0',
  minWidth: '24px',
};

const bandLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.55rem',
  fontWeight: 500,
  fontStyle: 'italic',
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  height: '4px',
  accentColor: '#d4a854',
  cursor: 'pointer',
  margin: 0,
  padding: 0,
};

const barTrackStyle: React.CSSProperties = {
  height: '3px',
  background: 'rgba(26, 36, 64, 0.6)',
  borderRadius: '2px',
  marginTop: '1px',
  overflow: 'hidden',
};

const barFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '2px',
  transition: 'width 0.2s ease',
};

// ── Current Decisions Styles ──

const decisionsBodyStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem 0.5rem',
};

const decisionGroupStyle: React.CSSProperties = {
  marginBottom: '0.5rem',
};

const decisionContextStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.6rem',
  color: '#7b9ec7',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const decisionOptionStyle: React.CSSProperties = {
  marginBottom: '0.35rem',
  paddingLeft: '0.25rem',
};

const decisionLabelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.65rem',
  color: '#c8d8f0',
  marginBottom: '0.1rem',
};

const deltaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  paddingLeft: '0.75rem',
  paddingTop: '1px',
  paddingBottom: '1px',
};

const deltaAffStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#7b9ec7',
  minWidth: '48px',
};

const deltaMathStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#c8d8f0',
};

const impactListStyle: React.CSSProperties = {
  paddingLeft: '0.75rem',
  marginTop: '1px',
};

const impactItemStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.5rem',
  color: '#d4a854',
  lineHeight: 1.5,
};

// ── Scenario Presets Styles ──

const scenarioBodyStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem 0.5rem',
};

const scenarioRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'center',
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.65rem',
  color: '#c8d8f0',
  background: 'rgba(26, 36, 64, 0.6)',
  border: '1px solid #1a2440',
  borderRadius: '3px',
  padding: '0.25rem 0.3rem',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.65rem',
  color: '#d4a854',
  background: 'rgba(26, 36, 64, 0.6)',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.25rem 0.5rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  outline: 'none',
};

// ── State Summary Styles ──

const summaryBodyStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem 0.5rem',
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.15rem 0',
};

const summaryKeyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.6rem',
  color: '#7b9ec7',
};

const summaryValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.6rem',
  color: '#c8d8f0',
  textTransform: 'capitalize',
};

const resetBtnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.65rem',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  padding: '0.35rem 0.5rem',
  cursor: 'pointer',
  outline: 'none',
  marginTop: '0.35rem',
  width: '100%',
};

// ── Force Effects Styles (from old DebugPanel) ──

const forceBodyStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem 0.5rem',
};

const responderListStyle: React.CSSProperties = {
  maxHeight: '120px',
  overflowY: 'auto',
  border: '1px solid #1a2440',
  borderRadius: '3px',
  padding: '0.25rem',
  background: 'rgba(13, 18, 32, 0.6)',
};

const checkLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  cursor: 'pointer',
  padding: '0.1rem 0',
};

const checkboxStyle: React.CSSProperties = {
  accentColor: '#d4a854',
  cursor: 'pointer',
};

const checkTextStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.6rem',
  color: '#c8d8f0',
};

const armRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  marginTop: '6px',
};

const clearBtnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  background: 'rgba(26, 36, 64, 0.6)',
  border: '1px solid #7b9ec7',
  borderRadius: '3px',
  padding: '0.25rem 0.5rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  outline: 'none',
};

const armedStatusStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace',
  fontSize: '0.55rem',
  color: '#d4a854',
  marginTop: '4px',
  wordBreak: 'break-all',
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`

Expected: No type errors. If there are issues with the happening/scene shape or minigameState discriminated union, adjust the type guards accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/components/debug/Dashboard.tsx
git commit -m "feat(debug): add Dashboard with affinity sliders, decisions, scenarios, and force controls"
```

---

### Task 5: Rewire DebugPanel with 3-tab layout

**Files:**
- Modify: `src/components/debug/DebugPanel.tsx` (full rewrite of tab system)
- Delete: `src/components/debug/StepControls.tsx`

**Interfaces:**
- Consumes: `Dashboard` (default export), `RawDataTab` (default export), `EventsTab` (default export)
- Produces: Updated `DebugPanel` with 3 tabs, Dashboard as default

- [ ] **Step 1: Rewrite DebugPanel.tsx**

Replace the entire contents of `src/components/debug/DebugPanel.tsx`:

```typescript
import { useState, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import Dashboard from './Dashboard';
import RawDataTab from './RawDataTab';
import EventsTab from './EventsTab';

type Tab = 'Dashboard' | 'Raw Data' | 'Events';

const TABS: Tab[] = ['Dashboard', 'Raw Data', 'Events'];

export default function DebugPanel() {
  const { state, engine } = useGameEngine();
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');

  const handleClose = useCallback(() => {
    engine.loadState({ debug: false });
  }, [engine]);

  if (!state.debug) return null;

  return (
    <div style={panelStyle}>
      {/* Header with close button */}
      <div style={headerStyle}>
        <span style={titleStyle}>Debug</span>
        <button style={closeButtonStyle} onClick={handleClose}>
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={tabBarStyle}>
        {TABS.map((tab) => (
          <button
            key={tab}
            style={{
              ...tabButtonStyle,
              ...(activeTab === tab ? activeTabButtonStyle : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={contentStyle}>
        {activeTab === 'Dashboard' && <Dashboard />}
        {activeTab === 'Raw Data' && <RawDataTab />}
        {activeTab === 'Events' && <EventsTab />}
      </div>
    </div>
  );
}

// ── Styles ──

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: '320px',
  height: '100vh',
  background: 'rgba(7, 10, 18, 0.95)',
  borderLeft: '1px solid #1a2440',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid #1a2440',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.8rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const closeButtonStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  background: 'transparent',
  border: '1px solid #1a2440',
  borderRadius: '3px',
  padding: '0.2rem 0.4rem',
  cursor: 'pointer',
  lineHeight: 1,
  outline: 'none',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #1a2440',
  flexShrink: 0,
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  background: 'transparent',
  border: 'none',
  padding: '0.45rem 0',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
  outline: 'none',
  transition: 'border-color 0.2s ease, color 0.2s ease',
};

const activeTabButtonStyle: React.CSSProperties = {
  color: '#d4a854',
  borderBottomColor: '#d4a854',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};
```

- [ ] **Step 2: Delete StepControls.tsx**

```bash
git rm src/components/debug/StepControls.tsx
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc -b`

Expected: No type errors. If StepControls is still imported somewhere (it shouldn't be, since we removed all imports in DebugPanel.tsx), remove those imports.

- [ ] **Step 4: Commit**

```bash
git add src/components/debug/DebugPanel.tsx src/components/debug/StepControls.tsx
git commit -m "feat(debug): rewire DebugPanel with 3-tab Dashboard-first layout, remove StepControls"
```

---

### Task 6: Build, typecheck, and verify

**Files:** (all previously created/modified)

- [ ] **Step 1: Full typecheck**

Run: `npm run build`

Expected: `tsc -b && vite build` succeeds with no errors.

Fix any type errors, unused imports, or unused locals that the compiler reports.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`

Open `http://localhost:5173?debug` and verify:
1. Debug panel opens with Dashboard tab active (not State)
2. All 6 affinity sliders work — dragging changes values and band labels update
3. Navigate through a turn — decisions appear in "Current Decisions" when available
4. Synthesis Preview updates live with committed results
5. Live toggle freezes/unfreezes synthesis
6. Scenario Presets load correctly and debug panel stays open
7. Raw Data tab shows JSON viewer and "Inject" sub-tab works
8. Events tab shows event log
9. Close button (✕) dismisses panel
10. Resetting turn / returning to title keeps panel open

- [ ] **Step 3: Commit any fixes**

If the smoke test reveals issues, fix and commit them.
