import { useEffect } from 'react';
import { useGameEngine } from '../../../hooks/useGameEngine';

export default function IntrusionOverlay() {
  const { state, engine } = useGameEngine();
  const intrusion = state.intrusion;
  useEffect(() => {
    if (!intrusion) return;
    const t = setTimeout(() => engine.clearIntrusion(), 2400); // matches cx-intr duration
    return () => clearTimeout(t);
  }, [intrusion, engine]);
  if (!intrusion) return null;
  return (
    <div className="cx-intrusion" aria-hidden>
      <span key={intrusion.text}>
        {intrusion.lead && <span className="cx-lead">{intrusion.lead}</span>}
        {intrusion.text}
      </span>
    </div>
  );
}
