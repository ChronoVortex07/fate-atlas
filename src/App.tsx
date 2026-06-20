import { EngineProvider } from './context/EngineContext';
import GameTable from './components/screens/GameTable';
import StarField from './components/overlays/StarField';
import DebugPanel from './components/debug/DebugPanel';

function App() {
  return (
    <EngineProvider>
      <StarField />
      <GameTable />
      <DebugPanel />
    </EngineProvider>
  );
}

export default App;
