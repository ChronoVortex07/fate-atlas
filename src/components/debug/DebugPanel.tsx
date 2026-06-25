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
