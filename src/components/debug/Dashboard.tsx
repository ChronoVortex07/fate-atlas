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
    const options: DecisionOption[] = state.happening.choices.map((choice) => {
      const deltas: Partial<Record<AffinityId, number>> = {};
      for (const effect of choice.effects) {
        if (effect.kind === 'shift') {
          deltas[effect.affinity] = (deltas[effect.affinity] ?? 0) + effect.amount;
        }
      }
      return {
        label: choice.text.length > 50 ? choice.text.slice(0, 47) + '…' : choice.text,
        deltas,
        impacts: computeImpacts(deltas),
      };
    });
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

    // Tarot: check phase (narrow discriminated union)
    if (ms.method === 'tarot') {
      // Tarot draft phases
      if (ms.phase === 'drafting') {
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
  const [corruptionOpen, setCorruptionOpen] = useState(false);

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

  const handleCorruptionChange = useCallback(
    (value: number) => engine.setCorruption(value),
    [engine],
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

      {/* ════ Corruption ════ */}
      <div style={sectionBorderStyle}>
        <button
          style={sectionHeaderStyle}
          onClick={() => setCorruptionOpen((p) => !p)}
        >
          <span style={triangleStyle(corruptionOpen)}>{corruptionOpen ? '▼' : '▶'}</span>
          <span style={sectionLabelStyle}>Corruption</span>
        </button>
        {corruptionOpen && (
          <div style={affinityBodyStyle}>
            <div style={affinityHeaderRowStyle}>
              <span style={affinityNameStyle}>Value</span>
              <span style={affinityValueStyle}>{state.corruption.value}</span>
              <span style={{ ...bandLabelStyle, color: '#d4a854' }}>
                {state.corruption.band}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={state.corruption.value}
              onChange={(e) => handleCorruptionChange(Number(e.target.value))}
              style={sliderStyle}
            />
            <div style={corruptionBtnRowStyle}>
              {([
                ['Clear', 0], ['Seed', 5], ['Spreading', 50], ['Virulent', 80], ['Pinnacle', 100],
              ] as [string, number][]).map(([label, value]) => (
                <button
                  key={label}
                  style={corruptionBtnStyle}
                  onClick={() => handleCorruptionChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ ...summaryRowStyle, marginTop: '0.35rem' }}>
              <span style={summaryKeyStyle}>Has intruded</span>
              <span style={summaryValueStyle}>
                {String(engine.corruptionEngineForTest().getHasIntruded())}
              </span>
            </div>
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
                {state.minigamesCompleted}/{state.minigamesPerTurn} complete
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

// ── Corruption Styles ──

const corruptionBtnRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem',
  marginTop: '0.4rem',
};

const corruptionBtnStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: '0.55rem',
  color: '#d4a854',
  background: 'rgba(26, 36, 64, 0.6)',
  border: '1px solid #d4a854',
  borderRadius: '3px',
  padding: '0.2rem 0.4rem',
  cursor: 'pointer',
  outline: 'none',
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
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.55rem',
  color: '#d4a854',
  marginTop: '4px',
  wordBreak: 'break-all',
};
