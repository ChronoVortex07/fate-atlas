import MethodEmblem from './MethodEmblem';
import WardSeal, { type WardProp } from './WardSeal';
import { METHOD_FRONTS } from '../../data/method-cards';
import type { DivinationType } from '../../engine/types';

export type CorruptedProp = 'spreading' | 'virulent' | null;

// The face-up card content: Celestial-Veil frame + family-tinted emblem, title,
// and flavor. Fills its parent (MethodCard) which owns the 2:3 box + flip.
export default function MethodCardFront({ method, corrupted = null, ward = null }: { method: DivinationType; corrupted?: CorruptedProp; ward?: WardProp }) {
  const cfg = METHOD_FRONTS[method];
  return (
    <div style={{ ...frontStyle, borderColor: cfg.color + '55' }}>
      {/* corner brackets */}
      <span style={{ ...corner, top: 4, left: 4, borderColor: cfg.color, borderRight: 'none', borderBottom: 'none' }} />
      <span style={{ ...corner, top: 4, right: 4, borderColor: cfg.color, borderLeft: 'none', borderBottom: 'none' }} />
      <span style={{ ...corner, bottom: 4, left: 4, borderColor: cfg.color, borderRight: 'none', borderTop: 'none' }} />
      <span style={{ ...corner, bottom: 4, right: 4, borderColor: cfg.color, borderLeft: 'none', borderTop: 'none' }} />

      {/* corruption overlays for virulent band */}
      {corrupted === 'virulent' && <div className="cx-scanlines" />}
      {corrupted === 'virulent' && <div className="cx-mosh m1" />}
      {corrupted === 'virulent' && <div className="cx-mosh m2" />}
      {corrupted === 'virulent' && <div className="cx-mosh m3" />}

      <div className={corrupted ? 'cx-glyph' : undefined} style={{ color: cfg.color, filter: `drop-shadow(0 0 6px ${cfg.color}55)` }}>
        <MethodEmblem method={method} size={Math.round(0.42 * 100)} />
      </div>
      <div className={corrupted ? 'cx-name' : undefined} style={titleStyle}>{cfg.title}</div>
      <div style={flavorStyle}>{cfg.flavor}</div>
      <WardSeal ward={ward} />
    </div>
  );
}

const frontStyle: React.CSSProperties = {
  position: 'relative', width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.4rem', padding: '0.6rem',
  background: 'radial-gradient(120% 90% at 50% 18%, #141b33 0%, #0b0f1e 70%)',
  border: '1px solid', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden',
};

const corner: React.CSSProperties = {
  position: 'absolute', width: 10, height: 10, border: '1.5px solid', opacity: 0.8,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: 'clamp(0.78rem, 2.4vw, 0.98rem)', color: '#e6ecfb', letterSpacing: '0.08em',
  textAlign: 'center', lineHeight: 1.1,
};

const flavorStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 400,
  fontSize: 'clamp(0.58rem, 1.7vw, 0.72rem)', color: '#7b9ec7', letterSpacing: '0.02em',
  textAlign: 'center', lineHeight: 1.25, padding: '0 0.2rem',
};
