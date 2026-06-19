import { useGameEngine } from '../../hooks/useGameEngine';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

export default function HistoryBar() {
  const { state } = useGameEngine();

  const readingCount = state.history.length;

  const handleClick = () => {
    // Future: expand to show past readings
  };

  return (
    <div style={barStyle} onClick={handleClick} title="Past readings">
      <span style={runicStyle}>{RUNES.slice(0, 10)}</span>
      <span style={countStyle}>
        {readingCount} reading{readingCount !== 1 ? 's' : ''} past
      </span>
      <span style={runicStyle}>{RUNES.slice(0, 10)}</span>
    </div>
  );
}

// ── Styles ──

const barStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  background: 'linear-gradient(180deg, rgba(7, 10, 18, 0.95), rgba(7, 10, 18, 0.7))',
  borderBottom: '1px solid #1a2440',
  zIndex: 1000,
  cursor: 'pointer',
  userSelect: 'none',
  padding: '0 1rem',
};

const runicStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '0.55rem',
  color: '#7b9ec7',
  opacity: 0.35,
  letterSpacing: '0.3em',
};

const countStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.65rem',
  color: '#7b9ec7',
  letterSpacing: '0.1em',
  whiteSpace: 'nowrap',
};
