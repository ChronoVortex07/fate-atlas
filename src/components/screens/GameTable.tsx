import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import TitleScreen from './TitleScreen';
import QuestionSelect from './QuestionSelect';
import MethodSelect from './MethodSelect';
import TarotMinigame from './TarotMinigame';
import DiceMinigame from './DiceMinigame';
import IChingMinigame from './IChingMinigame';
import AstralMinigame from './AstralMinigame';
import RuneMinigame from './RuneMinigame';
import StringsMinigame from './StringsMinigame';
import HappeningScene from './HappeningScene';
import ResultReading from './ResultReading';
import HistoryModal from '../overlays/HistoryModal';
import ConstellationFan from '../overlays/ConstellationFan';
import InteractionSequencer from '../overlays/InteractionSequencer';
import { InteractionFocusProvider } from '../../context/InteractionFocusContext';
import { AnchorProvider } from '../../context/AnchorRegistry';
import ParticleField from '../overlays/ParticleField';
import CorruptionRift from '../overlays/corruption/CorruptionRift';
import RuptureInterstitial from './RuptureInterstitial';
import ForceRadarOverlay from '../overlays/corruption/ForceRadarOverlay';
import IntrusionOverlay from '../overlays/corruption/IntrusionOverlay';
import type { ForbiddenGlimpse } from '../../engine/types';

export default function GameTable() {
  const { state, engine } = useGameEngine();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [glimpse, setGlimpse] = useState<ForbiddenGlimpse | null>(null);

  const showTableau = state.screen !== 'title' && state.screen !== 'question' && state.screen !== 'result' && state.screen !== 'rupture';

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
      case 'rupture':
        return <RuptureInterstitial key="rupture" />;
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
      case 'astral':
        return <AstralMinigame key="astral-minigame" />;
      case 'rune':
        return <RuneMinigame key="rune-minigame" />;
      case 'strings':
        return <StringsMinigame key="strings-minigame" />;
      default:
        return null;
    }
  };

  return (
    <AnchorProvider>
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
      <div style={{
        ...centerStyle,
        ...(state.eventQueue.length > 0 ? { pointerEvents: 'none' as const } : {}),
      }}>
        <div style={{
          ...centerInnerStyle,
          // Reserve room for the constellation fan that floats at the bottom.
          ...(showTableau ? { paddingBottom: '100px' } : {}),
        }}>
          <AnimatePresence mode="wait">
            {renderCenter()}
          </AnimatePresence>
        </div>
      </div>
      <InteractionFocusProvider>
        {showTableau && (
          <ConstellationFan results={state.turnResults} />
        )}
        {state.eventQueue.length > 0 && (
          <InteractionSequencer />
        )}
      </InteractionFocusProvider>
      {state.screen === 'minigame' && state.awaitingContinue && state.eventQueue.length === 0 && (
        <ContinueBar />
      )}
      {state.forbiddenSightAvailable && state.screen === 'minigame' && (
        <CorruptionRift onSummon={() => setGlimpse(engine.useForbiddenSight())} />
      )}
      {glimpse && <ForceRadarOverlay glimpse={glimpse} onDismiss={() => setGlimpse(null)} />}
      <IntrusionOverlay />
      <ParticleField />
    </div>
    </AnchorProvider>
  );
}

function ContinueBar() {
  const { engine } = useGameEngine();
  return (
    <div style={continueBarStyle}>
      <button
        type="button"
        style={continueBtnStyle}
        onClick={() => engine.continueAfterReview()}
      >
        Continue →
      </button>
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

// Scroll container. The inner wrapper's `min-height: 100%` makes it exactly fill
// the viewport when the screen is short (so `justify-content: center` vertically
// centers it), but grow to its content's height when the screen is tall — at
// which point there is no free space to center and the content simply starts at
// the top and scrolls. This keeps the bottom (e.g. the tarot commit buttons)
// reachable on short mobile screens instead of being clipped. min-height:0 lets
// this flex child actually shrink so its own overflow can scroll.
const centerStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};

const centerInnerStyle: React.CSSProperties = {
  minHeight: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const continueBarStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 15,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'auto',
};

const continueBtnStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 600,
  fontSize: '0.95rem',
  letterSpacing: '0.1em',
  color: '#c8d8f0',
  background: '#0d1220',
  border: '1px solid #d4a854',
  borderRadius: '24px',
  padding: '0.6rem 2rem',
  cursor: 'pointer',
  outline: 'none',
};
