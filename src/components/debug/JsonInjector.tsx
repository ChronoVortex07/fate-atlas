import { useState, useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';

const PLACEHOLDER = `{
  "screen": "draw",
  "affinities": {
    "chaos": 0.7,
    "order": 0.3
  }
}`;

export default function JsonInjector() {
  const { engine } = useGameEngine();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      setError(null);
    },
    [],
  );

  const handleInject = useCallback(() => {
    if (!value.trim()) {
      setError('Cannot inject empty JSON');
      return;
    }

    try {
      const parsed = JSON.parse(value);
      engine.loadState(parsed);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? `Invalid JSON: ${e.message}` : 'Invalid JSON',
      );
    }
  }, [value, engine]);

  return (
    <div style={containerStyle}>
      <textarea
        style={textareaStyle}
        value={value}
        onChange={handleChange}
        placeholder={PLACEHOLDER}
        spellCheck={false}
      />
      <button style={buttonStyle} onClick={handleInject}>
        Inject State
      </button>
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.5rem',
  height: '100%',
};

const textareaStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.65rem',
  lineHeight: 1.5,
  background: '#0d1220',
  color: '#c8d8f0',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  padding: '0.5rem',
  resize: 'vertical',
  minHeight: '200px',
  outline: 'none',
  flex: 1,
};

const buttonStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.75rem',
  letterSpacing: '0.1em',
  color: '#d4a854',
  background: 'transparent',
  border: '1px solid #d4a854',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
  transition: 'box-shadow 0.3s ease',
  outline: 'none',
};

const errorStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: '0.7rem',
  color: '#e74c3c',
  padding: '0.25rem 0',
  lineHeight: 1.4,
};
