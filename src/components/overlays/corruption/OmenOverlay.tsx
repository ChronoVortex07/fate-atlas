import { useEffect } from 'react';
import { useGameEngine } from '../../../hooks/useGameEngine';

// Light's frightened seed-warning. Mirrors IntrusionOverlay: watches a transient
// state field, animates, then clears it after the animation runs.
export default function OmenOverlay() {
  const { state, engine } = useGameEngine();
  const omen = state.omen;
  useEffect(() => {
    if (!omen) return;
    const t = setTimeout(() => engine.clearOmen(), 4200); // matches cx-omen duration
    return () => clearTimeout(t);
  }, [omen, engine]);
  if (!omen) return null;
  return (
    <div className="cx-omen" aria-hidden>
      <span key={omen.text}>{omen.text}</span>
    </div>
  );
}
