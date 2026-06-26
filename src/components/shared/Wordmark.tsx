import FateMark from './FateMark';

// "Atlas of Fate" lockup. ATLAS in starlight (the map), FATE in gold (the
// thread). stacked = main menu; horizontal = headers.
export default function Wordmark({ variant = 'stacked' }: { variant?: 'stacked' | 'horizontal' }) {
  if (variant === 'horizontal') {
    return (
      <div style={hRow}>
        <FateMark size={40} />
        <div style={hWords}>
          <span style={hAtlas}>ATLAS</span>
          <span style={hOf}>of</span>
          <span style={hFate}>FATE</span>
        </div>
      </div>
    );
  }
  return (
    <div style={stack}>
      <FateMark size={54} />
      <div style={sAtlas}>ATLAS</div>
      <div style={sDiv}>
        <span style={sLn} /><span style={sStar}>✦</span><span style={sOf}>of</span><span style={sStar}>✦</span><span style={{ ...sLn, ...sLnR }} />
      </div>
      <div style={sFate}>FATE</div>
    </div>
  );
}

const GRAD = 'linear-gradient(180deg,#f0d595,#c08f3c)';
const goldText: React.CSSProperties = {
  background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
};

const stack: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' };
const sAtlas: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(2rem, 8vw, 2.7rem)',
  letterSpacing: '0.34em', textIndent: '0.34em', color: '#c8d8f0', lineHeight: 1,
};
const sFate: React.CSSProperties = { ...sAtlas, fontWeight: 600, ...goldText };
const sDiv: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px', margin: '0.3rem 0' };
const sLn: React.CSSProperties = { width: '60px', height: '1px', background: 'linear-gradient(90deg,transparent,#d4a854)' };
const sLnR: React.CSSProperties = { background: 'linear-gradient(90deg,#d4a854,transparent)' };
const sStar: React.CSSProperties = { color: '#d4a854', fontSize: '0.6rem' };
const sOf: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.95rem', letterSpacing: '0.18em', color: '#c8a060' };

const hRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '16px' };
const hWords: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '13px' };
const hAtlas: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 'clamp(1.4rem, 5vw, 1.9rem)', letterSpacing: '0.22em', color: '#c8d8f0' };
const hFate: React.CSSProperties = { ...hAtlas, fontWeight: 600, ...goldText };
const hOf: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(0.95rem, 3vw, 1.25rem)', letterSpacing: '0.04em', color: '#c8a060' };
