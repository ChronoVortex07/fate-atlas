import { AnimatePresence } from 'framer-motion';
import { EngineProvider } from './context/EngineContext';
import { useGameEngine } from './hooks/useGameEngine';
import TitleScreen from './components/screens/TitleScreen';
import QuestionSelect from './components/screens/QuestionSelect';
import DrawPhase from './components/screens/DrawPhase';

function ScreenRouter() {
  const { state } = useGameEngine();

  return (
    <AnimatePresence mode="wait">
      {state.screen === 'title' && <TitleScreen key="title" />}
      {state.screen === 'question' && <QuestionSelect key="question" />}
      {state.screen === 'draw' && <DrawPhase key="draw" />}
      {state.screen === 'interaction' && <div key="interaction">Interactions</div>}
      {state.screen === 'interpretation' && <div key="interpretation">Interpretation</div>}
      {state.screen === 'happening' && <div key="happening">Happening</div>}
      {state.screen === 'result' && <div key="result">Result</div>}
    </AnimatePresence>
  );
}

function App() {
  return (
    <EngineProvider>
      <ScreenRouter />
    </EngineProvider>
  );
}

export default App;
