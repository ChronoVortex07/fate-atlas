import { createContext, useContext, useState, useCallback } from 'react';
import type { EffectReport } from '../engine/types';

export type FocusPhase = 'focusing' | 'animating' | null;

interface FocusValue {
  activeReport: EffectReport | null;
  phase: FocusPhase;
  setFocus: (report: EffectReport | null, phase: FocusPhase) => void;
}

const Ctx = createContext<FocusValue>({
  activeReport: null,
  phase: null,
  setFocus: () => {},
});

export const useInteractionFocus = () => useContext(Ctx);

/**
 * Bridges the InteractionSequencer (which owns the per-report cursor) and the
 * ConstellationFan (which must expand, scroll to, and glow the triggering hand
 * card). The sequencer publishes the active report + phase; the fan reacts.
 */
export function InteractionFocusProvider({ children }: { children: React.ReactNode }) {
  const [activeReport, setActiveReport] = useState<EffectReport | null>(null);
  const [phase, setPhase] = useState<FocusPhase>(null);
  const setFocus = useCallback((report: EffectReport | null, p: FocusPhase) => {
    setActiveReport(report);
    setPhase(p);
  }, []);
  return (
    <Ctx.Provider value={{ activeReport, phase, setFocus }}>
      {children}
    </Ctx.Provider>
  );
}
