import { useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';

export default function StepControls() {
  const { state, engine } = useGameEngine();

  const handleResolveAll = useCallback(() => {
    engine.resolveAllInteractions();
  }, [engine]);

  const handleResetTurn = useCallback(() => {
    engine.reset();
  }, [engine]);

  return (
    <div style={containerStyle}>
      <div style={screenLabelStyle}>
        <span style={screenLabelKeyStyle}>Screen:</span>
        <span style={screenLabelValueStyle}>{state.screen}</span>
      </div>

      <div style={buttonGroupStyle}>
        <button style={buttonStyle} onClick={handleResolveAll}>
          Resolve All
        </button>
        <button style={buttonStyle} onClick={handleResetTurn}>
          Reset Turn
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '0.5rem',
};

const screenLabelStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  fontFamily: "'Inter', sans-serif",
  fontSize: '0.75rem',
};

const screenLabelKeyStyle: React.CSSProperties = {
  color: '#7b9ec7',
  fontWeight: 400,
};

const screenLabelValueStyle: React.CSSProperties = {
  color: '#d4a854',
  fontWeight: 600,
  textTransform: 'capitalize',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const buttonStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  padding: '0.5rem 0.75rem',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease',
  outline: 'none',
  textAlign: 'center',
};
