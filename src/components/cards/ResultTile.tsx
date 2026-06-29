import type { SlotResult, TarotResult, TarotCardFace } from '../../engine/types';
import CardSigil from './CardSigil';
import AstralSigil from './AstralSigil';
import RuneSigil from './RuneSigil';
import StringSigil from './StringSigil';
import { HOUSES } from '../../data/astromancy';

const POS = [
  { key: 'present', color: '#d4a854' },
  { key: 'past', color: '#7b9ec7' },
  { key: 'future', color: '#9b6bb0' },
] as const;

// Sigil node for a result (mirrors CardReadingDetail's symbol logic).
function Sigil({ result, size }: { result: SlotResult; size: number }) {
  switch (result.type) {
    case 'astral': return <AstralSigil kind="planet" id={result.planet} size={size} />;
    case 'rune': return <RuneSigil rune={result.rune} orientation={result.orientation} size={size} />;
    case 'tarot': return <CardSigil card={result} size={size - 4} color="#d4a854" />;
    case 'strings': return <StringSigil glyph={result.symbol} state="lit" size={size - 2} />;
    default: return <span style={{ fontSize: size, color: '#d4a854', lineHeight: 1 }}>{symbolFor(result)}</span>;
  }
}

function symbolFor(r: SlotResult): string {
  switch (r.type) {
    case 'd20': return String.fromCodePoint(0x2685);
    case 'iching': return r.symbol;
    case 'happening': return String.fromCodePoint(0x2726);
    default: return '✦';
  }
}

function nameFor(r: SlotResult): string {
  switch (r.type) {
    case 'd20': return `D20 · ${r.result}`;
    case 'iching': return `Hexagram ${r.hexagramNumber}`;
    case 'happening': return 'Happening';
    default: return (r as { name?: string }).name ?? '—';
  }
}

function metaFor(r: SlotResult): { text: string; rev?: boolean } {
  switch (r.type) {
    case 'tarot': return { text: r.orientation === 'upright' ? '▲ Upright' : '▼ Reversed', rev: r.orientation === 'reversed' };
    case 'd20': return { text: r.threshold.replace('-', ' ') };
    case 'iching': return { text: r.name };
    case 'rune': return { text: `${r.orientation === 'upright' ? '▲' : '▼'} ${r.ring}`, rev: r.orientation !== 'upright' };
    case 'astral': return { text: HOUSES[r.house - 1]?.arena ?? `House ${r.house}` };
    case 'strings': return { text: 'Woven' };
    default: return { text: '' };
  }
}

export default function ResultTile({ result, index, onOpen }: { result: SlotResult; index: number; onOpen: () => void }) {
  const spread = result.type === 'tarot' ? (result as TarotResult).spread : undefined;
  const isSpread = !!spread && spread.length > 1;

  return (
    <button type="button" onClick={onOpen} style={tileStyle} className="result-tile">
      <span style={idxStyle}>{index + 1}</span>
      {isSpread ? (
        <div style={triStyle}>
          {/* Present (apex), then Past + Future on the base row. */}
          {(() => {
            const byPos = (k: string) => spread!.find((s) => s.position === k)?.card;
            const present = byPos('present');
            const past = byPos('past');
            const future = byPos('future');
            const cluster = (face: TarotCardFace | undefined, color: string) => face && (
              <div style={cluStyle}>
                <CardSigil card={face} size={20} color={color} />
                <span style={cluNameStyle}>{face.name}</span>
                <span style={{ ...cluOrientStyle, color }}>{face.orientation === 'upright' ? '▲' : '▼'}</span>
              </div>
            );
            return (
              <>
                {cluster(present, POS[0].color)}
                <div style={triRowStyle}>
                  {cluster(past, POS[1].color)}
                  {cluster(future, POS[2].color)}
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <>
          <div style={sigilStyle}><Sigil result={result} size={32} /></div>
          <span style={nameStyle}>{nameFor(result)}</span>
          {(() => { const m = metaFor(result); return <span style={{ ...metaStyle, ...(m.rev ? metaRevStyle : null) }}>{m.text}</span>; })()}
        </>
      )}
    </button>
  );
}

const tileStyle: React.CSSProperties = {
  position: 'relative', minHeight: '112px', background: '#0d1220', border: '1px solid #1a2440',
  borderRadius: '7px', padding: '0.7rem 0.45rem', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease',
};
const idxStyle: React.CSSProperties = {
  position: 'absolute', top: '6px', left: '8px', fontFamily: "'Inter', sans-serif",
  fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: '#5b7290',
};
const sigilStyle: React.CSSProperties = { fontSize: '1.95rem', color: '#d4a854', lineHeight: 1 };
const nameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.82rem',
  color: '#c8d8f0', textAlign: 'center', lineHeight: 1.12,
};
const metaStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '0.52rem', letterSpacing: '0.13em',
  textTransform: 'uppercase', color: '#7b9ec7', textAlign: 'center',
};
const metaRevStyle: React.CSSProperties = { color: '#d4a854' };
const triStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.34rem' };
const triRowStyle: React.CSSProperties = { display: 'flex', gap: '0.85rem' };
const cluStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 };
const cluNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: '0.52rem',
  color: '#c8d8f0', lineHeight: 1.04, textAlign: 'center', maxWidth: '52px', marginTop: '1px',
};
const cluOrientStyle: React.CSSProperties = { fontSize: '0.5rem', lineHeight: 1 };
