import { useState, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import StateViewer from './StateViewer';
import JsonInjector from './JsonInjector';
import StepControls from './StepControls';

type Tab = 'State' | 'Inject' | 'Steps' | 'Events';

const TABS: Tab[] = ['State', 'Inject', 'Steps', 'Events'];

export default function DebugPanel() {
  const { state, engine } = useGameEngine();
  const [activeTab, setActiveTab] = useState<Tab>('State');
  const [scenarioId, setScenarioId] = useState('');
  const presets = engine.getScenarioPresets();

  const handleClose = useCallback(() => {
    engine.loadState({ debug: false });
  }, [engine]);

  const handleLoadScenario = useCallback(() => {
    if (scenarioId) engine.loadScenarioById(scenarioId);
  }, [scenarioId, engine]);

  const handleForceFoolsReroll = useCallback(() => {
    engine.injectPendingEffect({
      id: 'debug-fools-reroll-' + Date.now(),
      sourceRunId: 'debug',
      sourceCard: 'The Fool',
      sourceSlotIndex: 0,
      triggerTags: ['roll', 'numeric'],
      action: 'reroll',
      description: "The Fool's wild energy ripples through fate — the dice must be cast again.",
      expiresAfter: 3,
      turnsRemaining: 3,
    });
  }, [engine]);

  const handleTriggerSwirl = useCallback(() => {
    engine.startDebugSwirl();
  }, [engine]);

  if (!state.debug) return null;

  return (
    <div style={panelStyle}>
      {/* Header with close button */}
      <div style={headerStyle}>
        <span style={titleStyle}>Debug</span>
        <button style={closeButtonStyle} onClick={handleClose}>
          X
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
        {activeTab === 'State' && <StateViewer />}
        {activeTab === 'Inject' && <JsonInjector />}
        {activeTab === 'Steps' && <StepControls />}
        {activeTab === 'Events' && <EventsTab />}
      </div>

      {/* Scenario controls */}
      <div style={scenarioSectionStyle}>
        <label style={labelStyle}>Scenario Preset</label>
        <div style={scenarioRowStyle}>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- Select --</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button onClick={handleLoadScenario} style={btnStyle}>
            Load
          </button>
        </div>
        <button onClick={handleForceFoolsReroll} style={{ ...btnStyle, marginTop: '8px' }}>
          Force Fool's Reroll
        </button>
        <button onClick={handleTriggerSwirl} style={{ ...btnStyle, marginTop: '8px' }}>
          Trigger Swirl
        </button>
      </div>
    </div>
  );
}

function EventsTab() {
  const { state } = useGameEngine();

  const events = state.eventLog;

  return (
    <div style={eventsContainerStyle}>
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

const eventsContainerStyle: React.CSSProperties = {
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

// ── Scenario controls ──

const scenarioSectionStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderTop: '1px solid #1a2440',
  flexShrink: 0,
};

const scenarioRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'center',
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  display: 'block',
  marginBottom: '4px',
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
