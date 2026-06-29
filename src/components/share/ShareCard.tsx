import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { GameState, SlotResult, TarotResult, SpreadPosition } from '../../engine/types';
import { bandOf } from '../../data/affinities';
import { fitList, type FitResult } from './fitList';

const W = 380, H = 475;
const ROW_GAP = 3;          // px gap between rows (must match listInnerStyle.gap)
const TENSION_MAX = 160;    // hard cap on the interpretation line
const ROW_BG = '#0a1018';   // row background — the fade mask must resolve to this

// A row's primary text is a list of segments. One segment fills the row and
// ellipsizes; several segments (a tarot spread's cards, a Strings path's nodes)
// each get an equal flexible share so they truncate together instead of the last
// one vanishing. `suffix` glyphs (orientation) are never truncated.
interface RowSegment { text: string; suffix?: string }
interface ShareRow { sigil: string; segments: RowSegment[]; meta?: string }

const SPREAD_ORDER: SpreadPosition[] = ['past', 'present', 'future'];

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
function clamp(s: string | undefined, max: number): string | undefined {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}
function rowFor(r: SlotResult): ShareRow {
  switch (r.type) {
    case 'tarot': {
      const sp = (r as TarotResult).spread;
      if (sp && sp.length > 1) {
        const ordered = [...sp].sort(
          (a, b) => SPREAD_ORDER.indexOf(a.position) - SPREAD_ORDER.indexOf(b.position),
        );
        return {
          sigil: '✶',
          segments: ordered.map((s) => ({
            text: s.card.name,
            suffix: s.card.orientation === 'upright' ? '▲' : '▼',
          })),
        };
      }
      return { sigil: r.symbol, segments: [{ text: r.name }], meta: r.orientation === 'upright' ? '▲ Upright' : '▼ Reversed' };
    }
    case 'd20': return { sigil: '⚅', segments: [{ text: `D20 · ${r.result}` }], meta: r.threshold.replace('-', ' ') };
    case 'iching': return { sigil: r.symbol, segments: [{ text: `Hexagram ${r.hexagramNumber} · ${r.name}` }], meta: 'Judgment' };
    case 'astral': return { sigil: r.symbol, segments: [{ text: r.name }], meta: r.aspect };
    case 'rune': return { sigil: r.symbol, segments: [{ text: r.name }], meta: r.orientation === 'upright' ? '▲ Upright' : '▼ Merkstave' };
    case 'strings': {
      const parts = r.name.split(' · ').map((p) => p.trim()).filter(Boolean);
      return { sigil: r.symbol, segments: parts.length > 1 ? parts.map((text) => ({ text })) : [{ text: r.name }] };
    }
    default: return { sigil: '✦', segments: [{ text: '—' }] };
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

function Row({ row }: { row: ShareRow }) {
  const multi = row.segments.length > 1;
  return (
    <div style={rowStyle}>
      <span style={rowSigilStyle}>{row.sigil}</span>
      <div style={segGroupStyle}>
        {row.segments.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && <span style={segDividerStyle}>·</span>}
            <span style={segCellStyle}>
              <span style={segTextWrapStyle}>
                <span style={segTextStyle}>{s.text}</span>
                {/* fade rather than text-overflow:ellipsis — html2canvas (the share
                    export) clips text but won't draw the "…" glyph, so a gradient
                    masks the cut. Invisible over empty space when the text fits. */}
                <span style={segFadeStyle} />
              </span>
              {s.suffix && <span style={segSuffixStyle}>{s.suffix}</span>}
            </span>
          </Fragment>
        ))}
      </div>
      {!multi && row.meta && <span style={rowMetaStyle}>{row.meta}</span>}
    </div>
  );
}

export default function ShareCard({ state }: { state: GameState }) {
  const { turnResults, synthesis, questionType, affinities, corruption } = state;
  const reading = turnResults.filter((r) => r.type !== 'happening');
  const total = reading.length;
  const interp = clamp(synthesis?.tensionNote ?? firstSentence(synthesis?.paragraphs?.[0]), TENSION_MAX);
  const badge = affinityBadge(affinities);
  const headline = synthesis?.headline ?? 'Your Reading';
  const corrupted = corruption.band === 'virulent' || corruption.band === 'pinnacle';
  const footTag = corrupted ? (synthesis?.affinityNote ?? 'It watches. It is pleased.') : 'the stars await your question';

  const viewportRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitResult>({ scale: 1, visibleRows: total, hiddenRows: 0 });

  // Measure the rendered list against its (font-dependent) viewport and decide how
  // much to shrink / whether to cap. Layout values (offsetHeight/clientHeight) ignore
  // the applied transform, so re-running converges rather than oscillating. We re-run
  // after web fonts settle, since glyph metrics change the row height.
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      const vp = viewportRef.current, row = firstRowRef.current;
      if (!alive) return;
      if (!vp || !row || total === 0) { setFit({ scale: 1, visibleRows: total, hiddenRows: 0 }); return; }
      const rowH = row.offsetHeight;
      const stride = rowH + ROW_GAP;
      const contentHeight = total * rowH + (total - 1) * ROW_GAP;
      const next = fitList({ available: vp.clientHeight, contentHeight, rowStride: stride, totalRows: total });
      setFit((prev) =>
        prev.scale === next.scale && prev.visibleRows === next.visibleRows && prev.hiddenRows === next.hiddenRows
          ? prev
          : next,
      );
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { alive = false; };
  }, [total, interp, headline, badge, corrupted]);

  const cap = fit.hiddenRows > 0;
  const shown = cap ? reading.slice(0, fit.visibleRows) : reading;
  const hidden = total - shown.length;

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
        <div style={{ ...headlineStyle, ...(corrupted ? headlineCx : null) }}>{headline}</div>
        {interp && <div style={tensionStyle}><p style={tensionTextStyle}>{interp}</p></div>}
        <div style={cardsHdrStyle}>The Cards · {total}</div>
        <div ref={viewportRef} style={listViewportStyle}>
          <div style={{ ...listInnerStyle, transform: `scale(${fit.scale})` }}>
            {shown.map((r, i) => (
              <div key={i} ref={i === 0 ? firstRowRef : undefined} style={rowOuterStyle}>
                <Row row={rowFor(r)} />
              </div>
            ))}
            {hidden > 0 && <div style={moreRowStyle}>+ {hidden} more {hidden === 1 ? 'reading' : 'readings'}</div>}
          </div>
        </div>
        {badge && <div style={badgeStyle}>{badge}</div>}
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
const padStyle: React.CSSProperties = { padding: '22px 22px 16px', width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const qStyle: React.CSSProperties = { flex: 'none', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#d4a854', fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase' };
const ornStyle: React.CSSProperties = { flex: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem', width: '64%', color: '#d4a854', opacity: 0.6, margin: '2px 0', justifyContent: 'center' };
const ornStarStyle: React.CSSProperties = { fontSize: '0.5rem' };
const headlineStyle: React.CSSProperties = { flex: 'none', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: '#eaf1ff', fontSize: '1.26rem', lineHeight: 1.22, textAlign: 'center', margin: '4px 2px 2px' };
const tensionStyle: React.CSSProperties = { flex: 'none', position: 'relative', width: '100%', background: '#0d1220', borderRadius: 6, padding: '0.55rem 0.8rem', marginTop: 4, boxSizing: 'border-box' };
const tensionTextStyle: React.CSSProperties = { margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: 300, fontStyle: 'italic', color: '#cdd9ec', fontSize: '0.72rem', lineHeight: 1.5, textAlign: 'left' };
const cardsHdrStyle: React.CSSProperties = { flex: 'none', fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#5b7290', marginTop: 9 };

// The list is the flexible, clipped region: it absorbs the leftover height and never
// pushes the badge/footer past the card edge. Its inner wrapper is scaled to fit.
const listViewportStyle: React.CSSProperties = { width: '100%', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', marginTop: 5 };
const listInnerStyle: React.CSSProperties = { width: '100%', display: 'flex', flexDirection: 'column', gap: ROW_GAP, transformOrigin: 'top center' };
const rowOuterStyle: React.CSSProperties = { flex: 'none', width: '100%' };

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '5px 9px', background: '#0a1018', border: '1px solid #1a2440', borderRadius: 6 };
const rowSigilStyle: React.CSSProperties = { fontSize: '1.05rem', lineHeight: 1, width: 20, textAlign: 'center', color: '#d4a854', flex: 'none' };
const segGroupStyle: React.CSSProperties = { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' };
// Equal shares (flex-basis 0) so several cards truncate evenly rather than the last
// one vanishing; a lone segment simply fills the row.
const segCellStyle: React.CSSProperties = { flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden' };
const segTextWrapStyle: React.CSSProperties = { position: 'relative', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' };
const segTextStyle: React.CSSProperties = { display: 'block', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.82rem', color: '#c8d8f0', overflow: 'hidden', whiteSpace: 'nowrap' };
const segFadeStyle: React.CSSProperties = { position: 'absolute', top: 0, right: 0, bottom: 0, width: 18, background: `linear-gradient(90deg, rgba(10,16,24,0), ${ROW_BG})`, pointerEvents: 'none' };
const segSuffixStyle: React.CSSProperties = { flex: 'none', fontSize: '0.62rem', color: '#d4a854' };
const segDividerStyle: React.CSSProperties = { flex: 'none', color: '#3a4a66', fontSize: '0.62rem' };
const rowMetaStyle: React.CSSProperties = { flex: 'none', maxWidth: '46%', fontFamily: "'Inter', sans-serif", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7b9ec7', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const moreRowStyle: React.CSSProperties = { flex: 'none', fontFamily: "'Inter', sans-serif", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5b7290', textAlign: 'center', padding: '5px 0 1px' };

const badgeStyle: React.CSSProperties = { flex: 'none', fontFamily: "'Inter', sans-serif", fontSize: '0.54rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7b9ec7', border: '1px solid #1a2440', borderRadius: 999, padding: '3px 9px', marginTop: 6 };
const footerStyle: React.CSSProperties = { flex: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 9, borderTop: '1px solid rgba(212,168,84,0.18)' };
const wmStyle: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 6 };
const wmAtlasStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, letterSpacing: '0.18em', color: '#c8d8f0', fontSize: '0.78rem' };
const wmOfStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '0.62rem', color: '#c8a060' };
// Solid gold rather than a background-clip:text gradient: html2canvas (the share
// export) can't clip a gradient to glyphs, so it filled the whole box and left the
// transparent text invisible — "FATE" exported as a redacted bar. A solid colour
// rasterises identically to what's on screen.
const wmFateStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, letterSpacing: '0.18em', fontSize: '0.78rem', color: '#e6c071' };
const footTagStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', color: '#5b7290', fontSize: '0.6rem' };
