import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import TitleScreen from './TitleScreen';
import QuestionSelect from './QuestionSelect';
import MethodSelect from './MethodSelect';
import TarotMinigame from './TarotMinigame';
import DiceMinigame from './DiceMinigame';
import IChingMinigame from './IChingMinigame';
import HappeningScene from './HappeningScene';
import ResultReading from './ResultReading';
import HistoryModal from '../overlays/HistoryModal';
import CardTableau from '../overlays/CardTableau';
import InteractionSequencer from '../overlays/InteractionSequencer';

interface ActiveSlots {
  sourceIndex: number | null;
  targetIndex: number | null;
}

export default function GameTable() {
  const { state } = useGameEngine();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSlots, setActiveSlots] = useState<ActiveSlots>({
    sourceIndex: null,
    targetIndex: null,
  });

  const showTableau = state.screen !== 'title' && state.screen !== 'question';

  const handleActiveSlotsChange = useCallback(
    (slots: ActiveSlots) => setActiveSlots(slots),
    [],
  );

  const renderCenter = () => {
    switch (state.screen) {
      case 'title':
        return <TitleScreen key="title" />;
      case 'question':
        return <QuestionSelect key="question" />;
      case 'method-select':
        return <MethodSelect key="method-select" />;
      case 'minigame':
        return renderMinigame();
      case 'happening':
        return <HappeningScene key="happening" />;
      case 'result':
        return <ResultReading key="result" />;
      default:
        return null;
    }
  };

  const renderMinigame = () => {
    switch (state.selectedMethod) {
      case 'tarot':
        return <TarotMinigame key="tarot-minigame" />;
      case 'd20':
        return <DiceMinigame key="dice-minigame" />;
      case 'iching':
        return <IChingMinigame key="iching-minigame" />;
      default:
        return null;
    }
  };

  return (
    <div style={hubStyle}>
      {state.history.length > 0 && (
        <button
          type="button"
          style={historyBtnStyle}
          onClick={() => setHistoryOpen(true)}
        >
          Past Readings ({state.history.length})
        </button>
      )}
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
      <div style={centerStyle}>
        <AnimatePresence mode="wait">
          {renderCenter()}
        </AnimatePresence>
      </div>
      {showTableau && (
        <CardTableau results={state.turnResults} activeSlots={activeSlots} />
      )}
      {state.interactionQueue.length > 0 && (
        <InteractionSequencer
          onActiveSlotsChange={handleActiveSlotsChange}
          onAnimationComplete={() => setActiveSlots({ sourceIndex: null, targetIndex: null })}
        />
      )}
    </div>
  );
}

const hubStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1,
  overflow: 'hidden',
};

const historyBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 10,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 300,
  fontSize: '0.7rem',
  color: '#7b9ec7',
  background: '#0d1220',
  border: '1px solid #1a2440',
  borderRadius: '20px',
  padding: '4px 16px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};
