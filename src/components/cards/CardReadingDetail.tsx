import type { SlotResult, TarotCardFace, TarotResult } from '../../engine/types';
import CardSigil from './CardSigil';
import AstralSigil from './AstralSigil';
import { HOUSES } from '../../data/astromancy';

function getResultDisplay(result: SlotResult): {
  symbol: string;
  name: string;
  subtitle: string;
  subCards?: { position: string; name: string; orientation: string; symbol: string; meaning: string; face: TarotCardFace }[];
} {
  switch (result.type) {
    case 'tarot': {
      const spread = (result as TarotResult).spread;
      if (spread && spread.length > 1) {
        return {
          symbol: result.symbol,
          name: result.name,
          subtitle: `${result.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'} — Three-card spread`,
          subCards: spread.map((sp) => ({
            position: sp.position.charAt(0).toUpperCase() + sp.position.slice(1),
            name: sp.card.name,
            orientation: sp.card.orientation === 'upright' ? '▲ Upright' : '▼ Reversed',
            symbol: sp.card.symbol,
            meaning: (sp.card.orientation === 'upright' ? sp.card.meaningUpright : sp.card.meaningReversed).slice(0, 80),
            face: sp.card,
          })),
        };
      }
      return {
        symbol: result.symbol,
        name: result.name,
        subtitle: result.orientation === 'upright'
          ? `Upright — ${result.meaningUpright.slice(0, 100)}`
          : `Reversed — ${result.meaningReversed.slice(0, 100)}`,
      };
    }
    case 'd20':
      return {
        symbol: String.fromCodePoint(0x2685),
        name: `D20 — ${result.result}`,
        subtitle: result.interpretation.slice(0, 100),
      };
    case 'iching':
      return {
        symbol: result.symbol,
        name: `Hexagram #${result.hexagramNumber} — ${result.name}`,
        subtitle: result.judgment.slice(0, 100),
      };
    case 'astral':
      return {
        symbol: result.symbol,
        name: result.name,
        subtitle: `in the House of ${HOUSES[result.house - 1]?.arena ?? result.house} — ${result.aspect}`,
      };
    case 'happening':
      return {
        symbol: String.fromCodePoint(0x2726),
        name: 'Happening',
        subtitle: result.scene.slice(0, 100),
      };
    default:
      return { symbol: '?', name: 'Unknown', subtitle: '' };
  }
}

/**
 * Full per-card reading breakdown — symbol/sigil, name, subtitle (or astral
 * house/aspect), and the three-position sub-spread when present. Shared by the
 * results page and the expanded-hand tap-to-inspect modal so there is one
 * source of truth for how a card's reading is presented.
 */
export default function CardReadingDetail({ result, index }: { result: SlotResult; index?: number }) {
  const d = getResultDisplay(result);
  return (
    <div style={resultCardStyle}>
      {typeof index === 'number' && <div style={resultIndexStyle}>{index + 1}</div>}
      <div style={resultSymbolStyle}>
        {result.type === 'astral'
          ? <AstralSigil kind="planet" id={result.planet} size={32} />
          : result.type === 'tarot'
            ? <CardSigil card={result} size={28} color="#d4a854" />
            : d.symbol}
      </div>
      <div style={resultNameStyle}>{d.name}</div>
      {result.type === 'astral' ? (
        <>
          <div style={resultSubtitleStyle}>
            in the House of {HOUSES[result.house - 1]?.arena ?? result.house}
          </div>
          <div style={resultSubtitleStyle}>{result.aspect} — {result.interpretation}</div>
        </>
      ) : (
        <div style={resultSubtitleStyle}>{d.subtitle}</div>
      )}
      {/* Sub-card spread layout for multi-card tarot */}
      {d.subCards && d.subCards.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          width: '100%',
          marginTop: '0.25rem',
        }}>
          {d.subCards.map((sc) => (
            <div key={sc.position} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.2rem',
              background: '#080d18',
              border: '1px solid #1a2440',
              borderRadius: '4px',
              padding: '0.4rem 0.25rem',
            }}>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                fontSize: '0.6rem',
                color: '#d4a854',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                {sc.position}
              </span>
              <CardSigil
                card={sc.face}
                size={26}
                color={sc.orientation === '▲ Upright' ? '#7b9ec7' : '#d4a854'}
              />
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                fontSize: '0.65rem',
                color: '#c8d8f0',
                textAlign: 'center',
                lineHeight: 1.15,
              }}>
                {sc.name}
              </span>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 300,
                fontSize: '0.5rem',
                color: sc.orientation === '▲ Upright' ? '#7b9ec7' : '#d4a854',
              }}>
                {sc.orientation}
              </span>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 300,
                fontSize: '0.55rem',
                color: '#5b7290',
                textAlign: 'center',
                lineHeight: 1.3,
                marginTop: '0.15rem',
              }}>
                {sc.meaning}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const resultIndexStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 600,
  fontSize: '0.6rem', color: '#5b7290', letterSpacing: '0.1em',
  position: 'absolute', top: '0.5rem', left: '0.5rem',
};

const resultCardStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: '0.3rem', padding: '1rem', background: '#0d1220',
  border: '1px solid #1a2440', borderRadius: '6px', width: '100%',
  boxSizing: 'border-box',
};

const resultSymbolStyle: React.CSSProperties = { fontSize: '2rem', color: '#d4a854' };
const resultNameStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '1rem', color: '#c8d8f0', letterSpacing: '0.05em',
};
const resultSubtitleStyle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontWeight: 300,
  fontSize: '0.75rem', color: '#7b9ec7', textAlign: 'center', lineHeight: 1.4,
};
