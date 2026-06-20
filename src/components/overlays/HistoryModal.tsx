import { useCallback } from 'react';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { RunRecord, SlotResult } from '../../engine/types';

const QUESTION_LABELS: Record<string, string> = {
  decision: 'Decision',
  relationship: 'Relationship',
  future: 'Future',
  self: 'Self',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function slotLabel(s: SlotResult): string {
  if (s.type === 'tarot') return `${s.name} (${s.orientation})`;
  if (s.type === 'd20') return `D20 → ${s.result}`;
  if (s.type === 'iching') return `${s.name} (Hexagram ${s.hexagramNumber})`;
  return s.type;
}

export default function HistoryModal({ onClose }: { onClose: () => void }) {
  const { state, engine } = useGameEngine();
  const runs = state.history;

  const handleClear = useCallback(() => {
    engine.clearHistory();
    onClose();
  }, [engine, onClose]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  return (
    <div style={backdropStyle} onClick={onClose} onKeyDown={handleKeyDown}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>Past Readings</h2>
          <button style={closeBtn} onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        {/* List */}
        <div style={listStyle}>
          {runs.length === 0 ? (
            <p style={emptyStyle}>No readings have been recorded yet. The stars await.</p>
          ) : (
            runs
              .slice()
              .reverse()
              .map((run: RunRecord) => (
                <div key={run.id} style={runCardStyle}>
                  <div style={runHeaderStyle}>
                    <span style={badgeStyle}>
                      {QUESTION_LABELS[run.question] ?? run.question}
                    </span>
                    <span style={dateStyle}>{formatDate(run.timestamp)}</span>
                  </div>
                  <div style={chipsRow}>
                    {run.turnResult && (
                      <span style={chipStyle}>
                        {slotLabel(run.turnResult)}
                      </span>
                    )}
                  </div>
                  {run.synthesis?.headline && (
                    <p style={headlineStyle}>{run.synthesis.headline}</p>
                  )}
                </div>
              ))
          )}
        </div>

        {/* Footer */}
        {runs.length > 0 && (
          <div style={footerStyle}>
            <button style={clearBtn} onClick={handleClear} type="button">
              Clear All History &amp; Reset Affinities
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(3, 5, 12, 0.85)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: '1rem',
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '540px',
  maxHeight: '80vh',
  background: 'linear-gradient(180deg, #0b1120 0%, #070a12 100%)',
  border: '1px solid #1e2c4a',
  borderRadius: '6px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 0 60px rgba(123, 158, 199, 0.12)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #1a2440',
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '1.25rem',
  color: '#c8d8f0',
  letterSpacing: '0.15em',
  margin: 0,
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#7b9ec7',
  fontSize: '1.1rem',
  cursor: 'pointer',
  padding: '0.3rem 0.5rem',
  lineHeight: 1,
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '1rem 1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.85rem',
  color: '#5a7094',
  textAlign: 'center',
  padding: '3rem 1rem',
};

const runCardStyle: React.CSSProperties = {
  background: 'rgba(26, 36, 64, 0.4)',
  border: '1px solid #1a2440',
  borderRadius: '4px',
  padding: '0.85rem 1rem',
};

const runHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
};

const badgeStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 500,
  fontSize: '0.7rem',
  color: '#d4a854',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const dateStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.65rem',
  color: '#4a6080',
};

const chipsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  marginBottom: '0.5rem',
};

const chipStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  background: 'rgba(123, 158, 199, 0.08)',
  border: '1px solid rgba(123, 158, 199, 0.2)',
  borderRadius: '3px',
  padding: '0.15rem 0.5rem',
};

const headlineStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 400,
  fontSize: '0.85rem',
  color: '#9ab5d4',
  fontStyle: 'italic',
  margin: 0,
  lineHeight: 1.3,
};

const footerStyle: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid #1a2440',
  display: 'flex',
  justifyContent: 'center',
};

const clearBtn: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  color: '#b06060',
  background: 'transparent',
  border: '1px solid rgba(176, 96, 96, 0.35)',
  padding: '0.5rem 1.2rem',
  cursor: 'pointer',
  borderRadius: '3px',
};
