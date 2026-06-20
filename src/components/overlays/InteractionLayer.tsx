import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import FoolsRerollAnimation from './InteractionAnimations/FoolsRerollAnimation';
import StubAnimation from './InteractionAnimations/StubAnimations';

export default function InteractionLayer() {
  const { state, engine } = useGameEngine();
  const active = state.activeInteraction;

  const handleComplete = useCallback(() => {
    engine.clearActiveInteraction();
  }, [engine]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          style={layerStyle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleComplete}
        >
          {active.effect === 'reroll' ? (
            <FoolsRerollAnimation event={active} onComplete={handleComplete} />
          ) : (
            <StubAnimation event={active} onComplete={handleComplete} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const layerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'auto',
};
