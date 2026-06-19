import { useEffect, useState } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function syntaxHighlight(json: string): string {
  const html = escapeHtml(json);
  return html.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    '<span style="color:#7b9ec7">$1</span>:',
  ).replace(
    /"((?:[^"\\]|\\.)*)"/g,
    '<span style="color:#c8d8f0">"$1"</span>',
  ).replace(
    /\b(true|false|null)\b/g,
    '<span style="color:#d4a854">$1</span>',
  ).replace(
    /\b(\d+(?:\.\d+)?)\b/g,
    '<span style="color:#d4a854">$1</span>',
  );
}

export default function StateViewer() {
  const { engine } = useGameEngine();
  const [json, setJson] = useState('');

  useEffect(() => {
    const state = engine.getState();
    setJson(JSON.stringify(state, null, 2));
  }, [engine]);

  // Re-read on every render to keep in sync — the parent DebugPanel
  // re-renders when the engine state changes, so this is sufficient.
  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      const state = engine.getState();
      setJson(JSON.stringify(state, null, 2));
    });
    return unsubscribe;
  }, [engine]);

  return (
    <div style={containerStyle}>
      <pre
        style={preStyle}
        dangerouslySetInnerHTML={{ __html: syntaxHighlight(json) }}
      />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: '0.5rem',
  overflow: 'auto',
  height: '100%',
};

const preStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: '0.65rem',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: '#7b9ec7',
  margin: 0,
};
