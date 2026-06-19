import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { GameEngine } from '../engine/GameEngine';
import type { GameState } from '../engine/types';

interface EngineContextValue {
  state: GameState;
  engine: GameEngine;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<GameEngine>(new GameEngine());
  const engine = engineRef.current;

  // Mount-time initialisation: debug param and persisted data restore
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('debug')) {
      engine.loadState({ debug: true });
    }

    engine.loadFromStorage();
  }, []);

  const state = useSyncExternalStore(
    (onStoreChange) => engine.subscribe(() => onStoreChange()),
    () => engine.getState(),
  );

  return (
    <EngineContext.Provider value={{ state, engine }}>
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return ctx;
}
