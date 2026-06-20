import { motion } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import type { RunRecord } from '../../engine/types';

function getTileIcon(run: RunRecord): string {
  if (!run.turnResults || run.turnResults.length === 0) return '*';
  const last = run.turnResults[run.turnResults.length - 1];
  if (last.type === 'happening') return '*';
  switch (last.type) {
    case 'tarot': return last.symbol;
    case 'd20': return String.fromCodePoint(0x2685);
    case 'iching': return last.symbol;
    default: return '*';
  }
}

function getTileLabel(run: RunRecord): string {
  if (!run.turnResults || run.turnResults.length === 0) return 'Empty';
  const last = run.turnResults[run.turnResults.length - 1];
  if (last.type === 'happening') return 'Happening';
  switch (last.type) {
    case 'tarot': return last.name;
    case 'd20': return `D20 ${last.result}`;
    case 'iching': return last.name;
    default: return 'Unknown';
  }
}

export default function HistoryTiles() {
  const { state } = useGameEngine();
  const history = state.history;
  const firstInteraction = state.interactionQueue[0];

  if (history.length === 0) return null;

  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>
        {history.map((run) => {
          const isSource = firstInteraction && run.id === firstInteraction.ruleId.split('-').slice(1, -1).join('-');
          return (
            <motion.div
              key={run.id}
              style={{
                ...tileStyle,
                borderColor: isSource ? '#d4a854' : '#1a2440',
                boxShadow: isSource ? '0 0 12px rgba(212, 168, 84, 0.4)' : 'none',
              }}
              animate={isSource ? { boxShadow: ['0 0 12px rgba(212,168,84,0.4)', '0 0 24px rgba(212,168,84,0.7)', '0 0 12px rgba(212,168,84,0.4)'] } : {}}
              transition={isSource ? { duration: 1.5, repeat: Infinity } : {}}
              title={getTileLabel(run)}
            >
              <span style={iconStyle}>{getTileIcon(run)}</span>
              <span style={labelStyle}>{getTileLabel(run).slice(0, 12)}</span>
              {run.interactions.length > 0 && (
                <span style={badgeStyle}>{run.interactions.length}</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: '10px 16px',
  pointerEvents: 'none',
};

const scrollStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  justifyContent: 'center',
  flexWrap: 'nowrap',
};

const tileStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '20px',
  fontSize: '0.7rem',
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  color: '#7b9ec7',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  pointerEvents: 'auto',
};

const iconStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#d4a854',
};

const labelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '80px',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '0.55rem',
  background: 'rgba(212,168,84,0.2)',
  color: '#d4a854',
  borderRadius: '50%',
  width: '14px',
  height: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
