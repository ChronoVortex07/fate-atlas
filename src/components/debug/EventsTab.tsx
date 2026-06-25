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
