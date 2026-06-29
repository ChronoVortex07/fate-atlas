import type { GameState, SlotResult, TarotResult } from '../../engine/types';
import { bandOf } from '../../data/affinities';

const W = 380, H = 475;

function questionLabel(qt: string | null): string {
  switch (qt) {
    case 'decision': return 'Decision';
    case 'relationship': return 'Relationship';
    case 'future': return 'Future / Forecast';
    case 'self': return 'Self-Analysis';
    default: return 'A Reading';
  }
}
function firstSentence(p?: string): string | undefined {
  if (!p) return undefined;
  const m = p.match(/^[^.!?]+[.!?]/);
  return (m ? m[0] : p).trim();
}
function rowFor(r: SlotResult): { sigil: string; name: string; meta: string } {
  switch (r.type) {
    case 'tarot': {
      const sp = (r as TarotResult).spread;
      if (sp && sp.length > 1) {
        const by = (k: string) => sp.find((s) => s.position === k)?.card;
        const o = (c?: { orientation: string }) => c ? (c.orientation === 'upright' ? '▲' : '▼') : '';
        return { sigil: '✶', name: 'Tarot Spread', meta: `${by('past')?.name} ${o(by('past'))} · ${by('present')?.name} ${o(by('present'))} · ${by('future')?.name} ${o(by('future'))}` };
      }
      return { sigil: r.symbol, name: r.name, meta: r.orientation === 'upright' ? '▲ Upright' : '▼ Reversed' };
    }
    case 'd20': return { sigil: '⚅', name: `D20 · ${r.result}`, meta: r.threshold.replace('-', ' ') };
    case 'iching': return { sigil: r.symbol, name: `Hexagram ${r.hexagramNumber} · ${r.name}`, meta: 'Judgment' };
    case 'astral': return { sigil: r.symbol, name: r.name, meta: r.aspect };
    case 'rune': return { sigil: r.symbol, name: r.name, meta: r.orientation === 'upright' ? '▲ Upright' : '▼ Merkstave' };
    case 'strings': return { sigil: r.symbol, name: r.name, meta: 'Woven' };
    default: return { sigil: '✦', name: '—', meta: '' };
  }
}
function affinityBadge(aff: Record<string, number>): string | null {
  const ids = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];
  const top = ids
    .map((id) => ({ id, v: aff[id] ?? 0, band: bandOf(aff[id] ?? 0) }))
    .filter((a) => a.band === 'ascendant' || a.band === 'dominant')
    .sort((a, b) => b.v - a.v)[0];
  if (!top) return null;
  return `${top.id[0].toUpperCase()}${top.id.slice(1)} ${top.band}`;
}

export default function ShareCard({ state }: { state: GameState }) {
  const { turnResults, synthesis, questionType, affinities, corruption } = state;
  const reading = turnResults.filter((r) => r.type !== 'happening');
  const interp = synthesis?.tensionNote ?? firstSentence(synthesis?.paragraphs?.[0]);
  const badge = affinityBadge(affinities);
  const corrupted = corruption.band === 'virulent' || corruption.band === 'pinnacle';
  const footTag = corrupted ? (synthesis?.affinityNote ?? 'It watches. It is pleased.') : 'the stars await your question';
  const cardCxOverlay: React.CSSProperties = {
    position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 14,
    boxShadow: 'inset 0 0 70px rgba(255,45,74,0.16), inset 0 0 0 1px rgba(255,45,74,0.4)',
    background: 'repeating-linear-gradient(0deg, rgba(255,45,74,0.06) 0 1px, transparent 1px 4px)',
  };
  const headlineCx: React.CSSProperties = { color: '#fff', textShadow: '-1.4px 0 #ff2d4a, 1.4px 0 #1a0006' };

  return (
    <div style={cardStyle}>
      {corrupted && <div style={cardCxOverlay} />}
      <div style={padStyle}>
        <div style={qStyle}>{questionLabel(questionType)}</div>
        <div style={ornStyle}><span style={ornStarStyle}>✦</span></div>
        <div style={{ ...headlineStyle, ...(corrupted ? headlineCx : null) }}>{synthesis?.headline ?? 'Your Reading'}</div>
        {interp && <div style={tensionStyle}><p style={tensionTextStyle}>{interp}</p></div>}
        <div style={cardsHdrStyle}>The Cards · {reading.length}</div>
        <div style={listStyle}>
          {reading.map((r, i) => {
            const row = rowFor(r);
            return (
              <div key={i} style={rowStyle}>
                <span style={rowSigilStyle}>{row.sigil}</span>
                <span style={rowNameStyle}>{row.name}</span>
                <span style={rowMetaStyle}>{row.meta}</span>
              </div>
            );
          })}
        </div>
        {badge && <div style={badgeStyle}>{badge}</div>}
        <div style={spacerStyle} />
        <div style={footerStyle}>
          <div style={wmStyle}>
            <span style={wmAtlasStyle}>ATLAS</span><span style={wmOfStyle}>of</span><span style={wmFateStyle}>FATE</span>
          </div>
          <div style={footTagStyle}>{footTag}</div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  position: 'relative', overflow: 'hidden', width: W, height: H, borderRadius: 14, border: '1px solid #1a2440',
  background: 'radial-gradient(120% 55% at 50% -6%, rgba(40,60,110,0.28), transparent 55%), radial-gradient(90% 50% at 50% 112%, rgba(150,110,50,0.14), transparent 60%), linear-gradient(180deg,#080c16,#05070e)',
};
const padStyle: React.CSSProperties = { padding: '22px 22px 16px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const qStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#d4a854', fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase' };
const ornStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', width: '64%', color: '#d4a854', opacity: 0.6, margin: '2px 0' };
const ornStarStyle: React.CSSProperties = { fontSize: '0.5rem' };
const headlineStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: '#eaf1ff', fontSize: '1.26rem', lineHeight: 1.22, textAlign: 'center', margin: '4px 2px 2px' };
const tensionStyle: React.CSSProperties = { position: 'relative', width: '100%', background: '#0d1220', borderRadius: 6, padding: '0.55rem 0.8rem', marginTop: 4 };
const tensionTextStyle: React.CSSProperties = { margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: 300, fontStyle: 'italic', color: '#cdd9ec', fontSize: '0.72rem', lineHeight: 1.5, textAlign: 'left' };
const cardsHdrStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#5b7290', marginTop: 9 };
const listStyle: React.CSSProperties = { width: '100%', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 5 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '5px 9px', background: '#0a1018', border: '1px solid #1a2440', borderRadius: 6 };
const rowSigilStyle: React.CSSProperties = { fontSize: '1.05rem', lineHeight: 1, width: 20, textAlign: 'center', color: '#d4a854', flex: 'none' };
const rowNameStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.82rem', color: '#c8d8f0', flex: 1, textAlign: 'left' };
const rowMetaStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b9ec7', flex: 'none' };
const badgeStyle: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: '0.54rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7b9ec7', border: '1px solid #1a2440', borderRadius: 999, padding: '3px 9px', marginTop: 6 };
const spacerStyle: React.CSSProperties = { flex: 1 };
const footerStyle: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 9, borderTop: '1px solid rgba(212,168,84,0.18)' };
const wmStyle: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6 };
const wmAtlasStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, letterSpacing: '0.18em', color: '#c8d8f0', fontSize: '0.78rem' };
const wmOfStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.62rem', color: '#c8a060' };
const wmFateStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, letterSpacing: '0.18em', fontSize: '0.78rem', background: 'linear-gradient(180deg,#f0d595,#c08f3c)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
const footTagStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#5b7290', fontSize: '0.6rem' };
