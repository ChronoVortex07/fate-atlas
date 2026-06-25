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
