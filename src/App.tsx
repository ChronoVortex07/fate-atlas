import { AnimatePresence } from 'framer-motion';
import { EngineProvider } from './context/EngineContext';
import { useGameEngine } from './hooks/useGameEngine';
import TitleScreen from './components/screens/TitleScreen';
import QuestionSelect from './components/screens/QuestionSelect';
import DrawPhase from './components/screens/DrawPhase';
import InteractionOverlay from './components/screens/InteractionOverlay';
import Interpretation from './components/screens/Interpretation';
import HistoryBar from './components/overlays/HistoryBar';

function ScreenRouter() {
  const { state } = useGameEngine();

  return (
    <AnimatePresence mode="wait">
      {state.screen === 'title' && <TitleScreen key="title" />}
      {state.screen === 'question' && <QuestionSelect key="question" />}
      {state.screen === 'draw' && <DrawPhase key="draw" />}
      {state.screen === 'interaction' && <InteractionOverlay key="interaction" />}
      {state.screen === 'interpretation' && <Interpretation key="interpretation" />}
      {state.screen === 'happening' && <div key="happening">Happening</div>}
      {state.screen === 'result' && <div key="result">Result</div>}
    </AnimatePresence>
  );
}

function App() {
  return (
    <EngineProvider>
      <HistoryBar />
      <ScreenRouter />
    </EngineProvider>
  );
}

export default App;
